# Architecture & navigation — Gestion Commerciale Desktop

> Nouvelle app **Electron + React + TypeScript** installable Windows/macOS/Ubuntu, connectée à `sos-cloud-server`
> (GraphQL/JWT) qui proxy vers l'agent PC (gRPC → MariaDB). Équivalent complet du desktop Delphi
> « SOS et POS SYSTEM 2.37 » (variante Gestion Commerciale), en modernisant l'UX.

## 1. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Shell | **Electron + electron-builder** (NSIS Windows, DMG macOS, AppImage/deb Ubuntu) | même stack que `agent_tray` (Electron+React+Vite déjà maîtrisé) |
| Bundler | **Vite** + electron-vite | cohérence avec agent_tray |
| UI | **React 18 + TypeScript** | |
| Data | **Apollo Client** (pattern du mobile : authLink dynamique, errorLink codes abonnement, clearStore au switch) | |
| État local | **Zustand** (comme le mobile) | session, dossier courant, préférences UI |
| Styles | **Tailwind + tokens CSS** (`design/tokens.css`) + Radix primitives | |
| Grilles | **TanStack Table + TanStack Virtual** | listes 10k+ lignes |
| Charts | Recharts ou SVG maison (conventions Donut/Bars du mobile) | |
| Impression | fenêtre print Electron cachée (HTML→PDF via `webContents.printToPDF`) — A4 + ticket 80mm | remplace FastReport |
| Auto-update | electron-updater (GitHub Releases ou serveur) | |
| i18n | i18next — **FR d'abord**, structure prête pour AR (RTL) et EN comme le Delphi | |

Processus : `main` (fenêtre, impression, stockage sécurisé des tokens via `safeStorage`, auto-update) / `renderer` (app React) / `preload` (IPC typée).

## 2. Flux de session (miroir du Delphi, adapté cloud)

```
Démarrage
 1. Splash + vérif. connexion cloud
 2. Login cloud : loginIdentify(user, pass) → choix agent (si >1) → loginWithAgent
    (gérer agent_offline / agent_conflit(force) / max_appareils / expire/suspendu/bloque)
 3. Choix du dossier (query dossiers) → stocké localement → header X-Druxamed-Dossier sur chaque requête
 4. Login utilisateur dossier : loginDossierUser(username, password)  ← équivalent écran TSecurite
    (requis : user_id/user_name sur chaque pièce créée)
 5. → AppShell (dashboard)
Changer d'utilisateur / de dossier / d'exercice = retour aux étapes 3–4 sans re-login cloud.
```

Statut agent : polling `myAgents` (dot vert/orange/rouge dans la topbar) + gestion timeout par commande.

## 3. Navigation (mapping Ribbon Delphi → Sidebar)

Sidebar à groupes repliables + topbar (recherche ⌘K, sélecteur dossier/exercice, statut agent, utilisateur). Le ribbon « Fichier » (backstage) devient le **menu Dossier** en bas de sidebar + menus natifs Electron.

| Groupe sidebar | Écrans (v1) | Origine Delphi |
|---|---|---|
| **Tableau de bord** | Accueil : KPI (CA jour/mois, encaissé, créances, stock alerte, péremption), accès rapides, graphiques | onglet 0 + tuiles GCHome |
| **Ventes** | Documents de vente (liste unifiée filtrée par type : FA / BL / BCT / BC / FP / FAV / BRT) · Éditeur de pièce · Journal des ventes | onglet Ventes, TListeVente/TVente |
| **Achats** | Documents d'achat (FA / BR / BC / DO / BRT / FAV) · Éditeur · Journal des achats | onglet Achats |
| **Stock** | Articles (grille dense + fiche : tarifs, lots, codes-barres, photo) · Inventaires · Bons de sortie · Bons d'entrée · Mouvements · Alertes (stock min, péremption, marge négative) | onglet Stock, TArticle/TNewArticles |
| **Tiers** | Clients (liste + fiche 360° : relevé, factures non réglées, échéances, avances) · Fournisseurs (idem) · Recouvrement/débiteurs | onglet Tiers + états financiers |
| **Trésorerie** | Comptes & caisses (un écran par compte, comme les boutons dynamiques `banks`) · Encaissements/Décaissements · Règlements clients/fournisseurs (lettrage FIFO) · Avances · Transfert entre comptes · Arrêté de caisse | onglet Trésorerie |
| **Statistiques** | Ventes (générales, par article/client/famille/utilisateur) · Achats · Bénéfices · Stock · Charges · État 104 | onglet Statistiques |
| **Référentiels** | Familles/Sous-familles · Dépôts · Rayons · Unités · TVA/Taxes · Banques/Comptes · Modes de paiement · Commerciaux · Centres de coût · Charges (catégories) | onglet Tiers (partie référentiels) |
| **Paramètres** | Coordonnées société · Numérotation (formats + compteurs) · Utilisateurs dossier & droits (P2) · Préférences app (thème, densité, imprimantes) | onglet Paramètres |
| *(bas de sidebar)* | Dossier/exercice (sélecteur) · Changer d'utilisateur · À propos | backstage « Fichier » |

**Hors périmètre v1** (variantes/addons Delphi) : Production/Béton, CRM, fidélité/bonus, conditionnement/déconditionnement, restauration (tables/salles), devises multiples, sauvegardes locales (gérées par l'agent), synchronisation. → v2+ selon besoin.

## 4. Patterns d'écran clés

1. **Liste de documents unifiée** (`DocumentsPage type=vente|achat`) : reproduit TListeVente — un seul composant, onglet/filtre par type de pièce, colonnes (N°, date, tiers, montant HT/TTC, réglé, reste, statut, utilisateur), totaux pied de page, actions Nouveau/Modifier*/Supprimer/Imprimer/Transformer* (*: dépend des ajouts serveur P2).
2. **Éditeur de pièce** (`DocumentEditor`) : en-tête (tiers avec solde affiché, date, dépôt, mode paiement) + grille de lignes clavier-first (F2 recherche article, saisie code-barres, qté/remise/prix) + panneau totaux (HT, remises, TVA, timbre, TTC, marge) + règlement immédiat optionnel. Verrou « dirty state » avant navigation (équivalent CheckStateFrame).
3. **Fiche tiers 360°** : header solde + onglets Relevé / Factures non réglées / Règlements / Avances / Infos — boutons Régler (lettrage), Crédit initial.
4. **Trésorerie** : sélecteur de compte (cards), grille transactions filtrée par période (jour/semaine/mois/année/dates), nouveau mouvement, transfert, arrêté de caisse.
5. **Inventaire** : préparation par dépôt → grille de comptage (qté théorique/physique/écart) → clôture.
6. **Impression** : templates HTML React (facture A4, ticket, relevé tiers, bordereau) rendus dans une fenêtre cachée → print/PDF. S'inspirer de `app_mobile_client/lib/facturePdf.ts`.

## 5. Données & types

- Retours cloud = JSON opaque → écrire `src/api/types.ts` dérivé des schémas typés de l'agent (`sos-agent/src/modules/*/*.schema.gql`) + wrappers de query typés (pattern `agent-query-pattern` du mobile : zéro calcul client, tout agrégé en SQL côté agent).
- Constantes types de documents partagées : vente `FA=1, BL=2, FP=3, BCT=4, BRT=6, FAV=7, BC=0` ; achat `BC=0, FA=1, BR=2, DO=3, BRT=4, FAV=5` (source `ventes.service.ts` / `achats.service.ts` de l'agent).
- Pièges DB à respecter (cf. `sos-agent/docs/SQL-GESTION-COMMERCIALE.md`) : `reglemntfournisseur`=paiements CLIENTS (inversé), types 6/7 = retours à netter, `RemiseP` doc-level, pas de colonne `actif` sur `clients`.

## 6. Droits utilisateurs (cible)

S'appuyer sur le **nouveau** modèle du Delphi (`DroitsConstants.pas` : IDs par catégorie Tiers 1001+, Achat 2001+, Vente 3001+, Stock 4001+, Dossier 5001+, Autres 6001+, Banques 7001+ ; actions READ/CREATE/UPDATE/DELETE/PRINT/EXPORT…) — tables `user_rights`/`rights_definition` de `commercecommun`. Nécessite le chantier serveur P2 (exposition des droits via l'agent). En v1 : rôle admin/utilisateur simple (masquer suppression/paramètres aux non-admins).
