# Demandes aux équipes agent, tray et cloud — suivi consolidé

> Tenu à jour par l'équipe de l'app desktop. Dernière mise à jour : 1er novembre 2026.
> Ce document **liste** tout ce que l'application ne peut pas faire seule ; le détail technique (contrats,
> exigences numérotées, recettes) des chantiers de connexion est dans
> [11-CAHIER-DES-CHARGES-AGENT-CLOUD.md](11-CAHIER-DES-CHARGES-AGENT-CLOUD.md).
> Sources : analyse de la connexion ([10](10-ANALYSE-CONNEXION.md)), audit fonctionnel ([08](08-AUDIT-FONCTIONNEL-2026-10-29.md)),
> travaux des PR #7 à #10 et de la série en cours.

**Légende** — Dépôt : `agent` (sos-agent), `tray` (agent_tray), `cloud` (sos-cloud-server), `ops` (exploitation).
Priorité : **P0** intégrité des données / sécurité · **P1** fonction attendue par les utilisateurs · **P2** confort.

---

## 0. Prérequis : publier le schéma du cloud

| # | Dépôt | Demande | Pourquoi |
|---|---|---|---|
| D0 | cloud | Publier `src/proxy/proxy.schema.gql` (ou un export à jour) dans `docs/` de ce dépôt, ou en artefact de chaque version du cloud. | Plusieurs commandes de l'agent sont « disponibles » mais leurs **arguments et formes de réponse** ne sont pas documentés ici. L'app ne les branche pas à l'aveugle : une erreur de signature ne se voit qu'en production (la recette locale utilise un serveur simulé). Bloque D20, D21, D22. |

## 1. Intégrité et sécurité (P0)

| # | Dépôt | Demande | En attendant, l'app… | Réf. |
|---|---|---|---|---|
| D1 | agent + cloud | **Idempotence des écritures** : `client_request_id` dans `input`, journal transactionnel, rejeu sans réexécution. | relit les ventes du jour avant de réencaisser un ticket resté sans réponse (heuristique montant + caissier), avertit dans les éditeurs. | 11 §3, AG-01…08 |
| D2 | agent + cloud | **Commande atomique `CreateVenteEncaissee`** (pièce + règlement, une transaction). | enchaîne `createVente` puis `addReglementClient` ; si le second échoue, message « réglez depuis la pièce ». | 11 §3.5 |
| D3 | cloud | Codes **`AGENT_TIMEOUT`** (commande transmise, pas de réponse) et **`AGENT_OFFLINE`** (non transmise) au lieu de messages libres. | devine le caractère « incertain » d'après le message. | 11 §3.7 |
| D4 | agent | Annoncer ses **capacités** (`idempotence-v1`, `vente-encaissee-v1`, …) dans le heartbeat ; `myAgents` les renvoie. | — (prérequis d'un déploiement sans ordre imposé). | 11 §3.6 |
| D5 | ops | **Signature de code** des installeurs + manifestes de mise à jour signés ; hébergement des mises à jour séparé de l'API. | rien : l'updater installe des binaires non signés. | 10 S7, 11 OP-03 |
| D6 | ops | Activer **`exiger_jeton_utilisateur`** (mode strict des droits) sur tous les agents une fois les clients à jour. | applique les droits côté interface seulement. | 07 §6 |
| D7 | agent | **`addLot` avec `qte`** : refuser la quantité (ou créer le mouvement de stock correspondant) — sinon du stock apparaît sans pièce. | crée toujours les lots **vides** depuis la fiche article. | PR #10 |
| D8 | agent | **Toujours renvoyer les droits** au `loginDossierUser` (même vides), pour que l'app puisse refuser par défaut quand ils manquent. | droits absents ⇒ tout autorisé côté interface (comportement historique, I1). | 08 I1 |

## 2. Sessions, appairage, connexion (P0–P1)

| # | Dépôt | Demande | En attendant, l'app… | Réf. |
|---|---|---|---|---|
| D9 | cloud | Conflit de session : renvoyer **`deviceName`** du poste en place ; code **`SESSION_REPLACED`** pour le poste évincé. | nomme l'établissement (pas le poste) ; affiche « session expirée ou fermée depuis un autre poste ». | 11 CL-10, CL-11 |
| D10 | cloud + tray | **Appairage à usage unique** (10 min) et **jetons par poste** révocables ; QR / fichier v2 `{v,u,c,a,exp,lan,fp}`. | lit v1 et un fichier `.druxamed-pairing` ; masque le code et vide le presse-papiers. | 11 §4.2 |
| D11 | cloud | **JWT asymétriques + JWKS** (prérequis du mode LAN). | — | 11 §4.3 |
| D12 | cloud | Autoriser l'en-tête **`X-Druxamed-Request-Id`** dans les `allowedHeaders` CORS (traçabilité ; l'idempotence passe, elle, par `input`). | ne l'envoie pas (sinon toutes les requêtes échoueraient). | 10 R2 |
| D13 | agent + tray + cloud | **Mode LAN** (vendre sans Internet) : endpoint HTTPS local, TLS épinglé, vérification hors ligne des jetons, statut d'abonnement signé + grâce, découverte. | état Internet / serveur / agent, cache hors ligne en lecture (référentiels 7 j, articles consultés 24 h), encaissement suspendu hors ligne. | 11 §5 |

## 3. Fonctions métier qui attendent l'agent ou le cloud (P1)

| # | Dépôt | Demande | En attendant, l'app… | Réf. |
|---|---|---|---|---|
| D20 | cloud (doc) | **Paiements détaillés** des tiers : confirmer les signatures de `etatPaiementsClient`, `etatPaiementsFournisseur`, `reglementsClients`, `reglementsFournisseurs`. | relevé du tiers (état client / fournisseur) seulement. | 08 I17, D0 |
| D21 | agent + cloud | **Stock par dépôt** : signatures de `stocks` / `stockArticle` ; dépôt sur les pièces ; lots rattachés à un dépôt (aujourd'hui les transferts ne sont qu'une trace documentaire). | stock global ; transferts documentaires. | 08 I15, 07 §7 |
| D22 | agent | **Tarifs par quantité et promotions** : tables `tarifqte` / promotions absentes des bases de test ; décider qui applique le prix (agent à la création via `prixPourQte` / `calculerPrix`, ou l'app à la saisie). | affiche les tarifs par quantité dans la fiche article, prix à saisir à la main. | 08 I11 |
| D23 | agent + cloud | **Journal des ventes filtrable par utilisateur** (`journalVentes(user_id)`), pour appliquer « … par utilisateur » au journal. | applique la restriction aux listes, bordereaux et statistiques, pas au journal. | 08 I3 |
| D24 | agent | **Retours comptoir (BRT)** : vérifier que l'agent crée la sortie de caisse du remboursement ; sinon l'ajouter (ou l'accepter dans `input`). | n'enregistre aucun remboursement ; l'arrêté de caisse peut être faux après un retour. | 08 I7 |
| D25 | agent + cloud | **Échéances fournisseurs** (`echeances` ne prend que les clients). | échéances clients seulement ; règlement partiel / mode / caisse disponible depuis les échéances. | 08 I8 |
| D26 | agent | **Mutations de modification** des référentiels qui n'en ont pas (sous-familles, rayons, unités, TVA, modes de paiement). | « supprimez puis recréez l'élément ». | 08 C6 |
| D27 | agent | **Règlement multi-lignes** à la création d'une pièce ; `unite_colis`. | un seul règlement à la création ; les autres depuis la pièce. | 08 I16 |
| D28 | agent | **Contrôles du comptoir côté serveur** : droit de modifier le prix / la remise, plafond de crédit (`plafond_credit`) — parité Delphi à confirmer. | aucun contrôle (prix, remises et crédit libres au comptoir). | 08 I5 |
| D29 | agent | **Droits Delphi non appliqués** : « Les BL livrés ne doivent pas être modifiés », « Changer le propriétaire », « Alimenter la caisse », « Format des numérotations » — définir leur sens exact et les appliquer côté agent (l'app suivra). | droits proposés dans la matrice mais sans effet. | 08 I6 |

## 4. Gros chantiers (P2, à planifier)

| # | Dépôt | Demande | Réf. |
|---|---|---|---|
| D40 | agent | Sauvegarde / restauration, clôture d'exercice, gestion des dossiers (créer, fermer, synchroniser). | 08 I18 |
| D41 | agent | Portefeuille chèques / effets (remise en banque, échéances) — présence dans le Delphi à confirmer. | 08 I19 |
| D42 | agent | Module production (bons, journaux, consommation). | 08 I20 |
| D43 | agent | Piste d'audit (qui a modifié / supprimé quoi), import Excel. | 08 I21 |
| D44 | agent | API GraphQL **locale** de l'agent : `annulerMouvement` est un stub (renvoie `false`), `mouvementTresorie` sans résolveur — à corriger avant tout usage (mode LAN). | 08 C11 |
| D45 | ops | Exécuter une première fois le pipeline GitLab (builds Windows / Linux) ; héberger les mises à jour (`GC_UPDATE_URL`). | 08 B6, 04 |
| D46 | cloud | *(Option)* Point de collecte des erreurs de l'application, **avec consentement** et sans donnée métier, pour remplacer le copier-coller du rapport de diagnostic. | — (l'app tient un journal local et produit un rapport copiable, Diagnostic › « Copier le rapport ») |

## 5. Questions à trancher par le propriétaire

| # | Question | Proposition |
|---|---|---|
| Q1 | Une table préfixée `gc_` peut-elle être ajoutée aux bases des dossiers (journal d'idempotence) ? | Oui : seule option sans risque résiduel de doublon. |
| Q2 | Durée de grâce quand l'abonnement ne peut pas être vérifié (mode LAN, cloud injoignable) ? | 7 jours, avertissement dès 72 h. |
| Q3 | Les dossiers contiennent-ils des données de santé nominatives (ordonnances, chifa) ? | Si oui, le mode LAN devient une exigence de conformité (loi 18-07). |
| Q4 | Droits absents au login : refuser tout par défaut ? | Oui, une fois D8 livré partout. |
| Q5 | Client obligatoire sur les factures, BL et BR ? | À aligner sur le Delphi. |
| Q6 | Sens exact de « Statistique par utilisateur » et « liste des vente par utilisateur » (restriction ou permission) ? | Traités comme des restrictions (comme « <pièce> par utilisateur »). |
| Q7 | Budget et identité de la signature de code (Authenticode, Apple) ? | Certificat OV au nom de SOFTLY. |

## 6. Déjà livré côté application (pour mémoire)

Sécurité de la connexion (PR #7), résilience et cache hors ligne (PR #8), audit fonctionnel (PR #9, #10), puis :
écrans secondaires chargés à la demande, règlement détaillé depuis les échéances, requêtes GraphQL dédupliquées,
modes de paiement disponibles hors ligne.
