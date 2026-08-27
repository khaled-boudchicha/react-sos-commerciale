# API GraphQL & manques côté serveurs

> État des lieux (2026-08-25) de ce que `sos-cloud-server` + `sos-agent` offrent déjà, et de ce qu'il faut ajouter
> pour que l'app desktop couvre la gestion commerciale complète. L'app desktop **ne parle qu'au cloud** (GraphQL/JWT),
> le cloud proxy vers l'agent en gRPC (commande + payload JSON).

## 1. Architecture d'accès

```
App desktop (Electron+React+Apollo)
   │  GraphQL HTTPS  (Authorization: Bearer JWT, X-Druxamed-Dossier: <dossier>)
   ▼
sos-cloud-server  (proxy flat: retours JSON!, mutations input: JSON!)
   │  gRPC stream bidi (COMMAND {request_id, payload_json})
   ▼
sos-agent (PC pharmacie)  →  MariaDB (dossiers commercecommun / multi-lots)
```

- **Auth desktop recommandée (2 étapes)** : `loginIdentify(username, password)` → `{ token_temp, agents[] }` → `loginWithAgent({ token_temp, agentId, deviceId, deviceName, platform, force })`. Gérer les statuts `agent_conflit` (proposer `force`), `agent_offline`, `max_appareils_atteint`, `expire/suspendu/bloque`.
- Alternative appairage : `loginWithApiKey({ apiKey, agent_id })` via QR du tray (JWT 30 j).
- **Multi-dossier par requête** : envoyer `X-Druxamed-Dossier: encodeURIComponent(nom)` à chaque requête (ne pas dépendre de `switchDossier` qui change l'état global agent).
- **Utilisateur dossier obligatoire** : après choix du dossier, `loginDossierUser(username, password)` — `createVente` exige `user_id` + `user_name` (traçabilité).
- `refreshToken` pour prolonger la session ; sessions révocables côté serveur (table `sessions`).
- Erreurs à gérer globalement : `extensions.code` ∈ `ACCOUNT_BLOCKED | SUBSCRIPTION_SUSPENDED | SUBSCRIPTION_EXPIRED` (+ timeout commande 30 s/60 s, agent hors ligne).
- Pas de subscriptions : **polling** (statut agent via `myAgents`, listes via refetch/poll Apollo).

## 2. Déjà disponible bout-en-bout (à consommer tel quel)

| Domaine | Opérations |
|---|---|
| Ventes | `ventes`, `vente`, `createVente` (**tous types** FA/BL/BCT/BC/FP/FAV/BRT), `deleteVente`, `journalVentes` |
| Achats | `achats`, `achat`, `createAchat` (FA/BR/BC/DO/BRT/FAV), `deleteAchat`, `journalAchats` |
| Clients | CRUD + `clientParCode`, `etatClient`, `soldeClient`, `etatClients`, `facturesNonReglees`, `etatPaiementsClient`, `setCreditInitialClient` |
| Fournisseurs | CRUD + relevés/soldes/états symétriques clients |
| Règlements | `reglementsClients/Fournisseurs`, `addReglement*`, `reglerClient/Fournisseur` (lettrage FIFO multi-factures, `dry_run`), `deleteReglement*`, `avancesClients`, `addAvanceClient`, `ventesNonReglees`, `achatsNonRegles`, `debiteurs` |
| Articles/Stock (lecture) | `articles` (filtres stock_alerte, marge_negative…), `article`, `articleParCode`, `articleParCodeBarre`, `stocks`, `stockArticle`, `mouvementsStock` |
| Bons E/S | `bonsSortie`, `bonsEntree`, `createBonSortie/Entree`, `deleteBonSortie/Entree` |
| Inventaire | `inventaires`, `inventaire`, `preparerInventaire`, `updateLigneInventaire`, `cloturerInventaire`, `deleteInventaire` |
| Caisse/Trésorerie | `caisse`, `encaissements`, `decaissements`, `soldesCaisse`, `add/deleteEncaissement`, `add/deleteDecaissement`, `tresorieComplete`, `soldesComptes`, `transfertCompte` |
| Charges | CRUD + `totalChargesPeriode` |
| Statistiques | `statVentes(±ParArticle/ParClient/ParFamille)`, `benefices`, `statAchats(±ParFournisseur/ParArticle)`, `statStock` |
| Référentiels | familles, sous-familles, dépôts, rayons, unités, TVA, banques, modes paiement, numérotation, coordonnées société, commerciaux, centres coût — **CRUD complet** |
| Dossiers | `dossiers`, `switchDossier`, `dossierUsers`, `loginDossierUser` |
| Auth/agents | `login*`, `refreshToken`, `myAgents`, `switchAgentMobile`, notifications |

Échappatoire de prototypage : `proxyRaw(command, payload)` appelle n'importe quelle commande du bridge sans modifier le cloud.

## 3. Manques — travail serveur à faire

### P1 — Routage simple (le code agent existe, il manque 1 `case` bridge + 1 champ proxy chacun)
| Commande à router | Service agent existant | Champ cloud à créer |
|---|---|---|
| `CreateArticle` / `UpdateArticle` / `DeleteArticle` | `articles.service.ts` | `createArticle(input)`, `updateArticle(id,input)`, `deleteArticle(id)` — **trou le plus critique** |
| `GetLots` / `AddLot` / `DeleteLot` / `GetLotPrix` | articles (lots/péremption) | `lots(article_id)`, `addLot`, `deleteLot` |
| `GetTarifs` / `GetPrixPourQte` / `GetPromotions` / `CalculerPrix` / `GetNomenclature` | tarification | `tarifsArticle`, `prixPourQte`, `promotions`, `calculerPrix` |
| `GetBarcodes` | codes-barres multiples | `barcodesArticle(article_id)` |
| `GetAlertesStock` / `GetArticlesMargeNegative` | alertes | `alertesStock`, `articlesMargeNegative` |
| `RecalculerStock` | procédure stockée | `recalculerStock` |
| `GetCharge` (findOne), `GetCentreCout` | charges/referentiels | `charge(id)`, `centreCout(id)` |

### P1bis — Dans le bridge mais absents du schéma cloud (ajouter le champ proxy seulement)
`GetTresorie`, `GetCategoriesCharges` (nécessaire pour les selects), `CreateInventaire`, `GetCommercial`.

### P2 — À écrire de zéro (agent + bridge + cloud)
0. ~~**Mouvements de stock à la création/suppression de pièces**~~ ✅ **FAIT 25/08/2026** : `createVente`/`deleteVente`/`createAchat`/`deleteAchat` appellent désormais `recalcArticlesStock()` (`sos-agent/src/database/stock.util.ts`) → procédure stockée native `UpdateSingleArticleStock(id)` (recalc lots.Qte depuis tous les documents + inventaire, parité Delphi exacte) puis synchro `article.Qte_reale`/`Qte_theorique` = `SUM(lots.Qte)`. Vérifié E2E : vente −3 puis reversée, achat +10 puis reversé, base restaurée à l'identique. La procédure participe à la transaction appelante (rollback cohérent). **Modèle de stock confirmé** : le stock réel vit dans `lots.Qte`, et `article.Qte_reale` == `SUM(lots.Qte)` (pas la vue Delphi `ArticleQte` simple, qui est périmée sur cette base).
1. **`updateVente` / `updateAchat`** (modification de pièce + lignes) — aujourd'hui seul chemin : delete + recreate.
2. **Transformation de documents** : BC→BL→FA, FP→FA, regroupement de BL en facture (champ `grouped`), BR→facture achat. Commandes `transformerDocument`, `grouperBL`.
3. **`annulerMouvement` trésorerie** — actuellement TODO qui renvoie `false` ; + `mouvementTresorie(cle)` (détail) déclaré sans implémentation.
4. **Transfert de stock inter-dépôts** atomique (`transfertStock`) — contournement actuel : bon sortie + bon entrée non liés.
5. **Recouvrement/relances** : buckets d'ancienneté détaillés, factures en retard > N jours (SQL « Recouvrement » du doc), Stat 104 (CA client fiscal), bénéfice production.
6. **Gestion utilisateurs dossier + droits** (`commercecommun.users`) : création/modif/désactivation, matrice de droits par menu (comme le Delphi).
7. **Module production** (table `production` documentée, aucun module).

### P3 — Corrections / dette
- Bug : `facturesNonReglees(type_doc)` accepté par le schéma cloud mais **non transmis** par `proxy.resolver.ts` (~ligne 96).
- Vérifier la forme réelle des retours `deleteVente`/`deleteAchat` (`Boolean!` au schéma vs retour brut du bridge).
- Classer toute nouvelle commande lourde dans `config.commandTimeout.slow` (sinon coupure 30 s).
- `AGENT-GRPC.md` partiellement obsolète (mentionne des commandes disparues) — à remettre à jour au fil des ajouts.

## 4. Côté app desktop (pas serveur, mais à prévoir)
- **Types TS** : retours JSON opaques → générer/écrire les types depuis les `.gql` typés de l'agent (`sos-agent/src/modules/*/*.schema.gql`).
- **Impression/PDF** : rien côté serveur — imprimer côté Electron (facture A4 + ticket), en s'inspirant de `app_mobile_client/lib/facturePdf.ts` / `etatTiersPdf.ts`.
- **Statut agent temps réel** : polling `myAgents` + gestion des erreurs de timeout par commande (pattern errorLink du mobile).

## 5. Pattern d'ajout d'une opération bout-en-bout (référence)
1. Méthode dans `sos-agent/src/modules/<module>/<module>.service.ts` (+ module si neuf).
2. `case 'MaCommande':` dans `sos-agent/src/grpc/grpc-bridge.service.ts` (+ injection service).
3. Champ dans `sos-cloud-server/src/proxy/proxy.schema.gql` (retour `JSON!`).
4. Méthode dans `sos-cloud-server/src/proxy/proxy.resolver.ts` : `return this.p(u, 'MaCommande', args)`.
5. Si lourde : `commandTimeout.slow` dans `sos-cloud-server/src/config/config.ts`.
6. Doc : `sos-agent/docs/AGENT-GRPC.md`.
