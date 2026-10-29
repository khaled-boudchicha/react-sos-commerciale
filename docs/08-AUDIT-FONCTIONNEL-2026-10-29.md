# Audit fonctionnel — Gestion Commerciale Desktop (29/10/2026)

Audit en lecture seule du commit `4278872`. Aucun fichier suivi n'a été modifié.
Chemins : `app/…` = ce dépôt ; `agent/…` = `..\sos-agent\src` ; `cloud/…` = `..\sos-cloud-server\src`.

Effort : **XS** < 1 h · **S** ½ j · **M** 1–3 j · **L** > 3 j.
Fiabilité : sans mention = vérifié dans le code ; **(à confirmer)** = dépend d'un agent connecté à une vraie base ou du comportement du Delphi.

---

## 1. Compilation et tests — tout est vert

| Vérification | Résultat |
|---|---|
| `app` : `tsc --noEmit` | 0 erreur |
| `app` : `tsc -p tsconfig.electron.json --noEmit` | 0 erreur |
| `app` : `vitest run` | 10 fichiers, **189 tests OK** |
| `app` : `vite build` | OK (sortie redirigée hors dépôt) — 2 avertissements, voir C8 |
| `packages/report` : `tsc --noEmit` | 0 erreur |
| `packages/report` : `vitest run` | 7 fichiers, **107 tests OK** |

Non exécutés : `npm run build` complet (`sync:pagedjs` copie un fichier suivi), `test:e2e` (exige cloud + agent + base), tests d'intégration de l'agent.

## 2. Chaîne app ↔ cloud ↔ agent

- Aucun appel cassé par nom : les 144 champs GraphQL utilisés par l'app existent dans `cloud/proxy/proxy.resolver.ts`, et chaque commande relayée a son `case` dans `agent/grpc/grpc-bridge.service.ts`.
- Les problèmes sont fonctionnels (contrats, paramètres manquants) : voir B1–B4.
- L'agent contrôle les droits des **écritures** dès que le jeton utilisateur est présent (`agent/grpc/droits-guard.ts`, refus par défaut d'une écriture sans règle) ; l'app desktop envoie toujours ce jeton. Les **lectures** (`Get*`) ne sont pas contrôlées par l'agent (`droits-guard.ts:119`) : leur confidentialité ne dépend que de l'app (voir I1).

---

## 3. BLOQUANT — données fausses ou fonction cassée

| # | Où | Constat | Impact utilisateur | Effort |
|---|---|---|---|---|
| B1 | `app/src/screens/AchatEditor.tsx` (envoi `createAchat`, l.139-154) ; `agent/modules/achats/achats.service.ts:392-393` | L'éditeur d'achat n'envoie ni `user_id` ni `user_name` (l'éditeur de vente le fait, `VenteEditor.tsx:148-149`). L'agent enregistre `UserID = 0`, `User = ''`. | Pièces d'achat sans auteur. Un utilisateur limité à « … par utilisateur » ne voit pas ses propres achats (le filtre force son `user_id`, `grpc-bridge.service.ts:107-110`). | XS |
| B2 | `agent/modules/ventes/ventes.service.ts:611`, `achats.service.ts:393,421,559`, `tresorie-complete.service.ts:509` | Le bridge prévoit que l'auteur vienne **uniquement** du jeton (`_user_name`, `grpc-bridge.service.ts:85-89`) mais les services écrivent `input.user_id` / `input.user_name` fournis par le client. | Auteur falsifiable ; journal « par utilisateur » et statistiques par utilisateur non fiables. | S (agent) |
| B3 | `app/src/screens/Echeances.tsx:42-47` | « Marquer payé » envoie `{vente_id, mode_payement:'Espece'}` sans `compte`/`compte_id` ; l'agent signale qu'un tel règlement « n'entre dans le solde d'aucun compte » (`reglements.service.ts:107`, `:863-870`). Pas de `try/catch` : en cas d'erreur, rejet non géré et dialogue figé. | Encaissement absent des soldes de caisse et de l'arrêté de caisse → écart de caisse inexpliqué. | S |
| B4 | `app/src/screens/Tresorerie.tsx:146-151` ; `agent/modules/tresorie-complete/tresorie-complete.service.ts:176` ; `grpc-bridge.service.ts:718-719` | En « Vue groupée », les lignes ont une clé `GRP|…` mais le bouton « Annuler » reste affiché ; l'agent n'accepte que `RGF|RG|EN|DE|TR|AVC<id>`. | Clic → erreur « Clé de mouvement invalide ». | XS |
| B5 | `app/src/screens/Parametres.tsx:216` | `Number(editNum.valeur)` sans validation : un champ vide envoie **0**. **Rectificatif** : l'agent refuse tout recul du compteur (`agent/modules/parametres/parametres.service.ts:186-189`), donc pas de doublon possible ; seulement une erreur peu claire, affichée dans la mauvaise section, et un avertissement inexact (« abaisser un compteur… »). Gravité réelle : confort. | Message d'erreur confus. | XS |

> **Corrigés le 29/10/2026 (non commités)** : B1 (`AchatEditor.tsx` envoie l'auteur), B2 (`agent/grpc/grpc-bridge.service.ts` : auteur des pièces créées = utilisateur du jeton), B3 (`Echeances.tsx` : caisse par défaut + erreur gérée ; `agent/grpc/droits-guard.ts` : compte contrôlé pour `MarquerEcheancePayee`), B4 (`Tresorerie.tsx` : pas d'annulation en vue groupée), B5 (`Parametres.tsx` : validation, erreur dans la fenêtre).
| B6 | Déploiement (`docs/04-TODO.md:22,151` ; `docs/07-DEPLOIEMENT.md`) | Cloud + agents non déployés, mode strict des droits non activé, aucun hébergement des mises à jour (`app/package.json` sans section `publish` ; seulement via `GC_UPDATE_URL` en CI), binaires non signés, pipeline GitLab jamais exécuté. | L'application n'est pas livrable en l'état aux clients. | M |

## 4. IMPORTANT — fonctions partielles, sécurité, robustesse

### 4.1 Droits et confidentialité

| # | Où | Constat | Impact | Effort |
|---|---|---|---|---|
| I1 | `app/src/lib/droits.ts:155,168,206` | Droits absents ⇒ tout autorisé (`admin: !droits`). Les écritures restent contrôlées par l'agent, pas les lectures. | Si l'agent ne renvoie pas les droits (ancien agent, réponse partielle), tout s'affiche. | XS |
| I2 | `Stock.tsx:102-106`, `ArticleDetail.tsx:62-64`, `JournalVentes.tsx:68-75`, `Statistiques.tsx:192-195,483,493` | PMP, marges et bénéfices affichés sans vérifier `D.vente.benefice` / `D.autre.beneficeStat` (seul le tableau de bord les masque). | Un vendeur voit les marges et prix d'achat. | S |
| I3 | `Ventes.tsx:65`, `Achats.tsx:63`, `Statistiques.tsx:252`, `JournalVentes.tsx` | Bordereaux, journal et statistiques « par utilisateur » ne respectent pas la restriction « … par utilisateur » ; libellés « Statistique par utilisateur » / « liste des vente par utilisateur » jamais vérifiés. | Contournement de la restriction par l'impression ou les stats. | S |
| I4 | `Stock.tsx:31-34` ; `MouvementsStock.tsx:178` ; `Dashboard` (route sans garde, `App.tsx:52`) ; `Ventes.tsx:28`, `Achats.tsx:26` | `?vue=alerte|peremption` ignore `D.stock.alerte` / `D.stock.lots` ; onglets des mouvements non filtrés (bon d'entrée seul ⇒ voit sorties et transferts) ; CA / créances du tableau de bord visibles par tous ; repli sur `FA` quand aucun type n'est autorisé. | Fuites d'information pour les profils restreints. | S |
| I5 | `comptoir/LignesComptoir.tsx:77-88`, `Comptoir.tsx:253,466-469` ; `comptoir/PaiementDialog.tsx:110` | Prix, remise ligne, remise globale et niveau de tarif modifiables sans contrôle ; vente à crédit sans contrôle du `plafond_credit`. | Risque commercial au comptoir. Parité Delphi sur ces contrôles : (à confirmer). | S |
| I6 | `D.vente.blLivresFiges`, `D.vente.changerProprietaire`, `D.autre.alimenterCaisse`, `D.autre.formatNumerotation` (`droits.ts`) | Droits définis et proposés dans la matrice mais jamais appliqués côté app (`blLivresFiges` peut l'être par l'agent : (à confirmer)). | Cocher ces droits n'a aucun effet visible. | S |

### 4.2 Fonctions incomplètes (écrans existants)

| # | Où | Constat | Impact | Effort |
|---|---|---|---|---|
| I7 | `comptoir/Comptoir.tsx:186,205,483` | Un retour comptoir (BRT) n'enregistre aucun remboursement (`if (!retour && …)`) alors que le message dit « à rembourser ». | Si l'agent ne crée pas la sortie de caisse (à confirmer), l'arrêté de caisse est faux après un retour. | S |
| I8 | `Echeances.tsx:44,89` | « Marquer payé » : toujours espèces, sans choix du compte, sans montant partiel ; pas d'échéances fournisseurs (`ECHEANCES` ne prend que `code_cli`). | Recouvrement limité au cas simple. | S |
| I9 | `Tresorerie.tsx:65` | `enAttente = … || !soldesData` : si `soldesComptes` échoue, la grille reste vide indéfiniment, sans message. | Écran muet en cas de coupure agent. | XS |
| I10 | `Parametres.tsx:132,148-166` | `wilaya` et `rib` affichés mais absents du formulaire ; `slogan`, `fax`, `site_web` modifiables mais non affichés ; format de numérotation non modifiable. | Coordonnées imprimées incomplètes / non corrigeables. | S |
| I11 | Ventes : `VenteEditor` / `Comptoir` ; agent `ventes.service.ts` (création) | Tarifs par quantité (`tarifqte`) et promotions seulement **affichés** dans la fiche article (`ArticleDetail.tsx:26`) ; ni l'app ni `CreateVente` ne les appliquent (`prixPourQte`, `promotions`, `calculerPrix` jamais appelés). | Prix dégressifs / promos à saisir à la main. Comportement Delphi : (à confirmer). | M |
| I12 | Global : `app/src/api/client.ts:32-42` ; `grpc-bridge.service.ts:705-707` | Le lien d'erreur global ne traite que l'auth / l'accès ; de nombreux écrans ignorent `error` (`Parametres.tsx:30,36`, `Login.tsx:39-40`, `ArticleDetail.tsx:25-27`, `comptoir/ChampScan.tsx:32` → « Aucun article. »). Une commande inconnue de l'agent revient comme donnée `{error}` et non comme erreur. | Pannes présentées comme « liste vide ». | M |
| I13 | `comptoir/comptoirStore.ts:37` ; `app/electron/main.ts` | Tickets en attente mémorisés par dossier mais pas par utilisateur ; pas de `requestSingleInstanceLock`. | Caissiers d'un même poste voient/reprennent les tickets des autres ; deux instances possibles. | XS |
| I14 | `VenteEditor.tsx`, `AchatEditor.tsx` | Aucun verrou « modifications non enregistrées » (`useBlocker` / `beforeunload` absents) ; client/fournisseur facultatif même pour FA/BL/BR (`VenteEditor.tsx:141`, `AchatEditor.tsx:140`). | Perte de saisie au changement d'écran ; factures sans client possibles. | S |

### 4.3 Parité Delphi manquante

| # | Fonction | État constaté | Effort |
|---|---|---|---|
| I15 | Stock par dépôt ; dépôt sur les pièces | Absent (aucun champ dépôt dans les éditeurs ; `stocks` / `stockArticle` de l'agent jamais appelés). Les transferts ne sont qu'une trace documentaire (lots sans dépôt, `07-DEPLOIEMENT.md` §7). | L |
| I16 | Règlement multi-lignes à la création, `unite_colis` | Absents (`docs/04-TODO.md:65`). | M |
| I17 | Onglet « Règlements / paiements détaillés » de la fiche tiers ; crédit initial fournisseur | Absents (`ClientDetail.tsx:30-32`). L'agent expose déjà `etatPaiementsClient`, `etatPaiementsFournisseur`, `reglementsClients`, `reglementsFournisseurs`, jamais appelés. | S |
| I18 | Sauvegarde / restauration, clôture d'exercice, gestion des dossiers (créer, fermer, synchroniser) | Absents : seuls les libellés de droits existent (`droits.ts:148`). Doc : « gérée par l'agent » (`02` §3). | M–L |
| I19 | Portefeuille chèques / effets (remise en banque, échéances) | Absent (seulement un N° de chèque). Présence dans le Delphi : (à confirmer). | M |
| I20 | Production (bons, journaux, consommation) | Absent dans l'app et dans l'agent (lecture seule de `production` dans la fiche de stock). Marqué « option ». | L |
| I21 | Import Excel, piste d'audit, choix de lot existant en achat | Absents. | M |
| I22 | Parité chiffrée non couverte | Relevés ligne à ligne, stats par article/client/famille, bénéfices, État 104 (`06-PARITE-DELPHI.md`). Contrôle visuel de l'État 104 paysage et impression physique silencieuse à valider sur poste. | M |

## 5. CONFORT

| # | Où | Constat | Effort |
|---|---|---|---|
| C1 | `navigation/commandes.ts:110,203,250` ; `screens/DemoGrille.tsx` | « Grille (démo) » présente dans le menu de production (5000 articles chargés, TVA 19 en dur, éditions factices). | XS |
| C2 | `app/electron/main.ts:11` ; `navigation/preferences.ts:19` | La clé `navigation` n'est pas dans `STORE_KEYS` : préférences de menu non persistées dans electron-store (repli localStorage seulement). | XS |
| C3 | `components/CommandPalette.tsx:32,40` | Palette : « Référentiels » visible avec un droit insuffisant (→ « Accès refusé ») ; « Nouvel inventaire » n'ouvre que la liste ; Échéances / Modèles / Diagnostic absents. | XS |
| C4 | `commandes.ts:63,78` | Entrées « Journal » visibles sans droit journal → ouvrent la liste sans message. | XS |
| C5 | `Statistiques.tsx:225,230,355,360` | Titres « — par mois » en regroupement par année. | XS |
| C6 | `Referentiels.tsx:69,196,203,278-282` | Charges : formulaire sur `montant`, colonne sur `prix_unit` (pré-remplissage probablement faux) ; famille d'une sous-famille saisie en texte libre ; plusieurs référentiels non modifiables (supprimer/recréer). | S |
| C7 | `Utilisateurs.tsx:104,207,265` | Mot de passe facultatif à la création ; l'interface permet de tenter une élévation en admin (l'agent la refuse : `dossier-users.service.ts:170-191`). | XS |
| C8 | Build Vite | Bundle principal 1,26 Mo + exceljs 938 ko (pas de découpage) ; `api/client.ts` importé statiquement et dynamiquement. | S |
| C9 | `Login.tsx:13,178`, `Diagnostic.tsx:61`, `Comptoir.tsx:290`, `comptoirCalc.ts:55-59,87`, `ChampScan.tsx:139` | Textes « pharmacie » / logo « GC » en dur ; Ctrl+Q (qté depuis montant) codé et testé mais non branché ; résultats du scan au prix tarif 1 quel que soit le tarif choisi. | XS |
| C10 | `api/dashboard.ts:14` ; `auth.ts:50` / `queries.ts:353` ; `MODES` ×4 ; `TRANSFERT_COMPTE` ×2 ; `REGLER_*` | Requête inutilisée et définitions GraphQL dupliquées. | XS |
| C11 | `agent/modules/tresorie-complete/tresorie-complete.resolver.ts:18-26`, `.schema.gql:67` | API GraphQL locale de l'agent : `annulerMouvement` stub (renvoie `false`), `mouvementTresorie` déclaré sans résolveur (hors chemin de l'app, mais trompeur). | XS |
| C12 | `app/electron/main.ts:33-37,44` ; `updater.ts:36-37` | Jeton écrit en clair sans avertissement si `safeStorage` indisponible ; `http://localhost:` accepté comme expéditeur IPC en production ; `app:version` / `maj:etat` sans contrôle d'expéditeur. | XS |
| C13 | `docs/` | Documentation en retard : cases ☐ périmées dans `04-TODO.md` (l.39, 70, 73, 87, 88, 94, 97, 108), « timbre non fait » (l.65, 143) contredit l.149 ; `03-API…` liste comme manquantes P1/P2 déjà faites ; `05-IMPRESSION.md` obsolète (3 modèles, « pas de printToPDF ») ; `02` décrit un modèle de droits numérique abandonné ; `07` en v0.2.0 (app en 0.3.0) ; comptoir plein écran, ruban, `@softly/report` (33 modèles) et étiquettes absents de `docs/`. | S |

## 6. Commandes de l'agent sans écran (fonctions disponibles)

`client`, `clientParCode`, `soldeClient`, `etatPaiementsClient`, `fournisseur`, `fournisseurParCode`, `soldeFournisseur`, `etatPaiementsFournisseur`, `reglementsClients`, `reglementsFournisseurs`, `ventesNonReglees`, `achatsNonRegles`, `stocks`, `stockArticle`, `lotPrix`, `prixPourQte`, `promotions`, `nomenclature`, `articlesMargeNegative`, `addLot`, `deleteLot`, `calculerPrix`, `recalculerStock`, `caisse`, `encaissements`, `decaissements`, `soldesCaisse`, `charge`, `categoriesCharges`, `tresorie`, `totalChargesPeriode`, `deleteEncaissement`, `deleteDecaissement`, `mouvementsStock`, `preparerInventaire`, `commercial`, `centreCout`, `switchDossier` (voulu : en-tête de dossier), `proxyRaw` (cloud).

Les plus utiles à brancher : `etatPaiements*` / `reglements*` (I17), `stocks` / `stockArticle` (I15), `prixPourQte` / `promotions` / `calculerPrix` (I11), `addLot` / `deleteLot` (gestion des lots depuis la fiche article), `recalculerStock` (recalcul global).

## 7. Non vérifié

- Tout ce qui exige un agent connecté à une vraie base : forme exacte des réponses JSON, règles métier internes de l'agent (stock, PMP, `blLivresFiges`, remboursement des retours), contraintes d'unicité de numérotation, délais (30 s par défaut pour `GetFicheStock`, `GetBenefices`, `GetStatVentesPar*`…).
- Parité chiffrée au-delà de `06-PARITE-DELPHI.md`, impression physique, exécution de la CI, app mobile.
- Comportement exact du Delphi sur les contrôles de prix/remise, plafond de crédit, tarifs par quantité et portefeuille d'effets (sources Delphi non lues).

---

## À faire en priorité

1. **B1 + B2** — auteur des pièces : envoyer `user_id`/`user_name` dans l'éditeur d'achat, et faire écrire l'auteur depuis le jeton côté agent.
2. **B3 + I8** — « Marquer payé » : passer le compte de caisse (et le mode), gérer l'erreur.
3. **B4** — masquer « Annuler » en vue groupée de la trésorerie.
4. **B5** — valider la saisie du compteur de numérotation (entier > 0, confirmation).
5. **I7** — vérifier avec un agent réel le remboursement des retours comptoir, et l'enregistrer s'il manque.
6. **I2 + I3 + I4 + I1** — appliquer les droits de lecture (marges, « par utilisateur », vues par URL) ; refuser par défaut si les droits sont absents.
7. **I9 + I12** — afficher les erreurs de requêtes au lieu d'écrans vides.
8. **B6** — déploiement : hébergement des mises à jour, signature, premier passage CI, puis mode strict.
9. **I17 + I15 + I11** — brancher les commandes agent déjà prêtes (paiements détaillés, stock par dépôt, tarifs par quantité).
10. **C1 + C13** — retirer la grille de démo du menu et remettre la documentation à jour.
