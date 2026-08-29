# TODO — Gestion Commerciale Desktop

> Plan de travail par phases. La **Phase 0 (validation de la charte graphique + maquettes) est le point de départ** :
> rien n'est implémenté tant qu'elle n'est pas validée. Chaque item décrit le livrable attendu.
> Légende statut : ☐ à faire · ◐ en cours · ☑ fait

## Phase 0 — Charte graphique & maquettes (VALIDATION REQUISE)
- ☑ **Charte graphique** — palette (bleu roi + or logo, neutres froids), typo, densités, composants ([01-CHARTE-GRAPHIQUE.md](01-CHARTE-GRAPHIQUE.md))
- ☑ **Design tokens** — variables CSS clair/sombre prêtes à l'emploi ([../design/tokens.css](../design/tokens.css))
- ☑ **Maquettes HTML** — dashboard, liste documents, éditeur de facture, fiche client, trésorerie, login (artifact partagé)
- ☑ **→ VALIDATION UTILISATEUR de la charte + maquettes** (validée le 25/08/2026)

## Phase 1 — Serveurs : combler les manques P1 (détail : [03-API-GRAPHQL-ET-MANQUES-SERVEURS.md](03-API-GRAPHQL-ET-MANQUES-SERVEURS.md)) — ☑ FAIT 25/08/2026 (non commité)
Chaque item = case bridge agent + champ proxy cloud (pattern §5 du doc 03), sauf mention.
- ☑ **CRUD articles** : `createArticle`/`updateArticle`/`deleteArticle` routés bout-en-bout
- ☑ **Lots** : `lots`, `lotPrix`, `addLot`, `deleteLot`
- ☑ **Tarifs** : `tarifsArticle`, `prixPourQte`, `promotions`, `nomenclature`, `calculerPrix` ; **codes-barres** : `barcodesArticle`
- ☑ **Alertes** : `alertesStock`, `articlesMargeNegative` ; `recalculerStock`
- ☑ **Champs cloud manquants** (bridge OK) : `tresorie`, `categoriesCharges`, `charge(id)`, `createInventaire`, `commercial(id)`, `centreCout(id)`
- ☑ **Bug** : `type_doc` transmis dans `facturesNonReglees` (résolveur + bridge)
- ☑ `RecalculerStock` → `commandTimeout.slow`, `GetCategoriesCharges` → `fast` ; `AGENT-GRPC.md` mis à jour
- ☐ Déployer (cloud VPS + agents) — les changements sont locaux, builds OK, non commités

## Phase 2 — Squelette app desktop (◐ démarré 25/08/2026 — `app/`)
- ☑ **Scaffold** Vite + React + TS + Tailwind(tokens) + Apollo + Zustand + Electron (pattern agent_tray : tsc electron + vite build + electron-builder ; `npm run typecheck`/`build` OK, login vérifié au navigateur)
- ☑ **AppShell** : sidebar groupes + topbar (statut agent par polling `myAgents`, bandeau erreurs abonnement) — thème sombre/densité à venir
- ◐ **Bibliothèque UI** : DataGrid (dense, totaux, pagination, export CSV, tri, **skeletons de chargement** ✅), DocBadge, StatusPill, Money, Tabs, PeriodPicker, SearchInput, FormModal, ConfirmDialog, EntitySearch, **CommandPalette ⌘K** ✅, export CSV ✅, **Toasts** ✅ (feedback global succès/erreur, câblé CRUD tiers/articles/référentiels + éditeurs vente/achat + caisse) — ☐ filtres/virtualisation, SidePanel
- ☑ **Duplication de pièce (vente ET achat)** (29/08/2026) : bouton « Dupliquer » sur les fiches → éditeur pré-rempli (lignes, tiers, mode, remise, note ; nouvelle date/numéro par le serveur) via `?from=<id>` + maps `VENTE_TYPE_CODE`/`ACHAT_TYPE_CODE`. Validé E2E vente (BL 17 lignes + toast).
- ☑ **Remise globale en % ou en montant (DA)** (29/08/2026) : `components/document/RemiseGlobale` avec bascule %/DA (valeur canonique = %, conversion via TTC avant remise), dans les deux éditeurs.
- ☑ **Tri de colonnes DataGrid** (28/08/2026) : opt-in par colonne via `sortAccessor` (clé de tri distincte du rendu JSX) ; clic sur l'en-tête croissant→décroissant→aucun, vides en fin, `localeCompare` fr + numérique ; l'export CSV suit l'ordre trié. Activé sur les 7 grilles analytiques des Statistiques (ventes/achats par article/client/fournisseur/famille, bénéfices) — données chargées en entier, donc tri correct (pas activé sur les grilles paginées côté serveur). Validé E2E : tri CA HT asc→AR321 (min 82 956), desc→AR10 (max 8 484 548).
- ☑ **CommandPalette ⌘K** (26/08/2026) : ouverte au ⌘K/Ctrl+K ou par la barre de recherche (qui était décorative), navigation vers les 10 écrans, 6 créations rapides, **recherche live clients / fournisseurs / articles** avec solde ou stock affiché, navigation ↑↓/Entrée/Échap — validé E2E
- ☑ **Scan de code-barres** (26/08/2026) : dans la recherche d'article des éditeurs, une saisie de douchette (code numérique + Entrée) déclenche une correspondance **exacte** via `articleParCodeBarre` et ajoute l'article directement ; message explicite si le code est inconnu — validé E2E
- ☑ **Couche API** : Apollo (authLink dynamique, errorLink codes `ACCOUNT_BLOCKED`/`SUBSCRIPTION_*`, header `X-Druxamed-Dossier`) — ☐ types TS dérivés des `.gql` agent + hooks par domaine
- ☑ **Flux session** : login 2 étapes (`loginIdentify`→`loginWithAgent` avec conflit/offline/quota) + choix dossier + `loginDossierUser` + persistance electron-store — ☐ appairage QR (`loginWithApiKey`), migration `safeStorage`
- ☑ **Robustesse de session** (27/08/2026) — validé E2E :
  - `useSessionKeepAlive` : `refreshToken` automatique toutes les 6 h (JWT valable 7 j, donc jamais d'expiration en cours de journée) + sonde `sessionStatus` toutes les 2 min, qui fait remonter un blocage de compte ou une expiration d'abonnement dans le bandeau de l'errorLink sans attendre la prochaine action de l'utilisateur
  - `DossierSwitcher` : changement de dossier **ou** d'utilisateur sans se déconnecter — le dossier est positionné *avant* `loginDossierUser`, le cache Apollo est vidé (`clearStore`) au succès pour qu'aucune donnée de l'ancienne base ne subsiste, et **le dossier précédent est restauré** si la ré-identification échoue (vérifié : passage vers une base inexistante → message serveur affiché, session intacte, données rechargées depuis la bonne base)
  - Piège corrigé : le nom de dossier mémorisé en session peut différer de la liste par la casse (« bon 2026 » vs « BON 2026 ») ; sans réalignement le `<select>` retombait silencieusement sur la première entrée et on aurait changé de dossier par erreur
- ☐ **Dashboard v1** branché (statVentes mois, soldesCaisse, debiteurs, alertesStock) — vérifier les formes JSON réelles contre un agent en ligne

## Phase 3 — Lecture (tout existe déjà côté serveurs) — ◐ démarré 25/08/2026
- ◐ **Dashboard** : KPI branchés (statVentes mois + marge, soldesCaisse, debiteurs+buckets, alertesStock) + barres CA/jour + **répartition « Top familles » du mois** (28/08/2026, `statVentesParFamille` ajouté à la requête Dashboard, tri CA desc top 6, barres) — ☐ péremption (nécessite une requête serveur lots-expirant)
- ☑ **Documents de vente** : liste unifiée 7 types + **détail pièce** + **journal ligne à ligne** (onglet Documents/Journal, filtre code article, marge par ligne et totaux) — validé E2E (100 lignes mars 2026, 3,99 M TTC / 375 170 de marge)
- ☑ **Documents d'achat** : liste 6 types + **détail pièce** + **journal ligne à ligne**
- ◐ **Articles & stock** : grille paginée (recherche, vues alerte/marge négative, état stock) + **fiche article** (lots avec badge péremption J-n, tarifs par qté, codes-barres) — ☐ stocks par dépôt, mouvements
- ☑ **Clients / Fournisseurs** : listes CRUD + vue Débiteurs (buckets) + fiches 360° client & fournisseur + **états financiers globaux** (onglets « États clients » / « États fournisseurs » : solde de départ, mouvements, réglé, solde final, option « masquer les tiers soldés ») — ☐ paiements détaillés, avances
- ☑ **Trésorerie** : cartes soldes par compte + mouvements (période, solde initial/final) + saisie encaissement/décaissement/transfert. Les **types de charges** sont un référentiel (onglet dédié) ; les dépenses réelles sont des décaissements de catégorie « Charge ».
- ☑ **Statistiques complètes** (27/08/2026) — 4 sections, 8 vues, validé E2E contre l'agent réel :
  - **Ventes** : par période (jour/mois), **par article** (200), **par client** (121), **par famille** (barres) — KPI CA TTC 126 814 418,55 / marge nette / charges (= parité Delphi)
  - **Achats** : par période, **par fournisseur** (44, reste à payer), **par article** (PMP moyen)
  - **Bénéfices** : CA HT − coût de revient par période, remises, taux de marge (bénéfice brut 12 919 018,44)
  - **Valorisation du stock** : par article, recherche + pagination — total 18 832 942,74 DA (= parité Delphi), marge potentielle
  - 7 requêtes serveur jusque-là jamais appelées désormais branchées (`statVentesParArticle/Client`, `benefices`, `statAchats*`, `statStock`) ; type `StatParFamille` complété (le serveur renvoie aussi HT/marge/retours)
- ☑ **Référentiels** (lecture) : familles, dépôts, banques, modes paiement, TVA, unités
- ☑ **Mode sombre** (toggle Paramètres, persisté) + sélecteur de serveur cloud
- ☑ **Correctif CORS cloud** : `X-Druxamed-*` ajoutés aux `allowedHeaders` (`main.ts`) — requis pour Electron/web, à déployer
- ☑ **Vérif contre agent réel (E2E local, 25/08/2026)** : stack complète montée en local (MariaDB + agent + cloud + app) — login 2 étapes réel, dossier « BON 2026 », utilisateur dossier Admin, dashboard/listes/fiches avec vraies données (892 BL, 115 débiteurs/51,6 M, relevé client, lots), aperçu lettrage sur vraies factures, **création + suppression d'un BL de bout en bout** (numéro format Delphi `1010/2026`), base restaurée à l'identique

## Phase 4 — Écriture (mutations existantes)
- ☑ **Éditeur de pièce (vente & achat) — table de lignes partagée & configurable** (28/08/2026) : composant unique `components/document/LignesTable` + `lignesDocument.ts` (type `LigneDoc`, calculs source-unique). **Colonnes paramétrables** par l'utilisateur (⚙ Colonnes, persistées par sens dans localStorage) : Tarif 1-4, Colisage, P.U. TTC, Remise (montant), N° de lot, Péremption, Total HT — en plus des colonnes fixes (Article, Qté, P.U. HT, Rem. %, TVA, Total TTC). **Calcul auto bidirectionnel** : qté→total live, P.U. TTC↔HT, remise %↔montant, sélecteur de tarif→prix HT. Vente : lot/péremption disponibles ; achat : lot/péremption visibles par défaut. Validé E2E (calc live ×5, unit-test formules, création vente avec lot+péremption+colis persistés puis nettoyée).
- ☑ **Sélection de lot FEFO (vente)** (28/08/2026) : `components/document/LotCell` — sur une ligne de vente, la cellule « N° de lot » liste les lots EXISTANTS en stock de l'article (requête `lots`), triés par péremption croissante ; choisir un lot renseigne aussi la date de péremption. Achat (réception) et article sans lot en stock → saisie libre (nouveau lot). Validé E2E : AR38 (5 lots) → select en vente / input libre en achat.
- ☑ **Formulaire article : matrice de marges live** (28/08/2026) : `FormModal.renderExtra` (générique, propagé via `useCrud.formExtra`) + `MatricePrix` — aperçu calculé des 4 tarifs (P.V. HT saisi → TTC via TVA, marge et marge % vs prix d'achat), rouge si marge négative, mis à jour en direct pendant la saisie. Validé E2E (HT 130→TTC 154,70/marge 30/30% ; HT 150→178,50/50/50%).
- ☑ **Stock disponible + alerte de survente (vente)** (28/08/2026) : `LigneDoc.stock` figé à l'ajout (`qte_reale`), affiché sous l'article (« · stock N ») ; en vente, si la quantité dépasse le stock → « ⚠ dépasse le stock » en rouge. Validé E2E (AR38 stock 6, qté 999 → alerte).
- ☑ **Encaissement POS : rendu de monnaie + raccourcis** (28/08/2026) : bloc « À rendre » (reçu − net, vert) / « Reste dû » (si insuffisant, orange) sous le montant reçu ; raccourcis **F2** (recherche article) / **F3** (recherche client/fournisseur) dans vente et achat. Validé E2E (reçu > net → à rendre ; F2 → focus article).
- ◐ **Éditeur de vente** — reste : timbre, gérer `unite_colis`, règlement multi-lignes.
- ☑ **Bug agent corrigé (inventaire)** : `articleinventaire.nlot` est NOT NULL avec la sentinelle `'-1'` (= « pas de lot », lue par `UpdateSingleArticleStock`) mais le service forçait `null` → toute création d'inventaire échouait
- ☑ **Bugs agent corrigés (caisse)** : `addEncaissement`/`addDecaissement` n'écrivaient ni `Compte`/`CompteID` (mouvement rattaché à aucun compte) ni de catégorie par défaut — or la vue trésorerie ne retient que les catégories exactes (`Encaissement`/`Décaissement`/`Charge`…) : un mouvement saisi aurait été **invisible** et hors de tout solde. Côté app : la colonne libellé ignorait le champ `objet`.
- ☑ **Bugs agent corrigés au passage** : `article.actif` n'existe pas en base (create/update échouaient) ; `updateArticle` ne recalculait pas `margep` (marge % figée → filtre « marge négative » faussé) ni les prix TTC — recalcul complet dès qu'un des trois leviers change (achat / vente / TVA)
- ☑ **Correctif login dossier** : `loginDossierUser` renvoie `{ok,message,user_id,username}` — l'écran lisait les mauvais champs
- ◐ **Éditeur d'achat** (`/achats/nouvelle`) : recherche fournisseur + article, colonne lot/péremption, coût HT (défaut PMP), `createAchat` 6 types, **mouvement de stock validé E2E via UI** (BR +7 → suppression −7), MAJ PMP côté serveur — ☐ règlement immédiat, sélection lot existant
- ☑ **Suppression de pièces** (fiches vente & achat) : `ConfirmDialog` réutilisable + `deleteVente`/`deleteAchat`, stock reversé — validé E2E via UI (25/08/2026)
- ☑ **Article : 4 prix de vente end-to-end** (28/08/2026) — **BUG SERVEUR corrigé** : l'agent `createArticle`/`updateArticle` n'écrivait que `prix_venteHT` (tier 1) → les 3 autres prix saisis dans le formulaire étaient **perdus**. Helper `tiersVenteUpdates` : persiste `prix_venteHT1..3` + calcule `prix_venteTTC1..3`, `marge1..3`, `margeP1..3` ; recalcule les TTC/marges de tous les tiers quand le prix d'achat ou la TVA change. Correction lecture : `mapArticle` lisait `a.margep1` alors que la colonne est `margeP1` (P majuscule) → marge % des tiers renvoyée nulle. Validé E2E : create (HT 130/140/150 → TTC 154,7/166,6/178,5, marge% 30/40/50), update (tier2→200 + TVA 9 → TTC 218 + recalcul tier3), suppression.
- - ☑ **CRUD tiers & articles (UI)** : `FormModal` générique piloté par schéma (`forms/schemas.ts`) + hook `useCrud` (create/update/delete, colonne d'actions ✎/✕, confirmation) — branché sur **clients**, **fournisseurs** et **articles** (listes déroulantes familles/dépôts/unités/TVA alimentées par `REFERENTIELS`). Validé E2E : création → modification → suppression pour article et client, base restaurée. ☐ crédit initial (mutation `setCreditInitialClient`)
- ◐ **Règlements** : modal **générique** `ReglerTiersModal` (client ET fournisseur — aperçu `dry_run` → distribution FIFO → confirmation, reliquat→avance) branché sur les deux fiches ; **règlement immédiat dans l'éditeur de vente** (champ « Montant reçu » + bouton/raccourci **« Encaisser tout · F10 »** → `addReglementClient` sur la pièce créée, plafonné au net, statut « Payée » immédiat — validé E2E avec nettoyage complet) — ☐ suppression règlements depuis l'UI, avances
- ◐ **Caisse** : **encaissement / décaissement / transfert entre comptes** depuis l'écran Trésorerie (`MouvementCaisseModal`, compte obligatoire, catégories Charge/Charge Production pour les décaissements) — validé E2E (mouvement écrit avec compte + catégorie, visible dans la grille, base nettoyée). ☐ arrêté de caisse
- ☑ **Inventaire complet** (`/stock/inventaires`) : liste (valeurs théorique/comptée, écart, statut) + **création** (motif, date, dépôt → toutes les lignes générées avec le stock théorique) + **feuille de comptage** (saisie par ligne enregistrée à la sortie de case/Entrée, filtre texte, bascule « écarts seulement », écart et valorisation recalculés en direct) + **clôture** avec confirmation (applique les quantités comptées au stock) + suppression. Validé E2E : inventaire de 2036 articles / 18 M DA, comptage avec écart +10 (valorisation +580 125 DA), suppression, stock inchangé.
- ☐ **Stock** : bons d'entrée/sortie
- ☑ **Référentiels : CRUD complet** (26/08/2026) — écran à 10 onglets (familles, sous-familles, dépôts, rayons, unités, TVA, comptes & banques, modes de paiement, commerciaux, centres de coût), piloté par une table de description (`REFS`) + `FormModal`/`useCrud`. Les référentiels sans mutation `update` côté serveur (sous-familles, rayons, unités, TVA, modes de paiement) masquent le bouton Modifier et affichent la raison. Validé E2E : famille créée → modifiée → supprimée.
- ☑ **Paramètres en écriture** (26/08/2026) : **coordonnées de la société** modifiables (identité, contacts, RC/NIF/NIS/Art. — ces valeurs alimentent tous les documents imprimés) et **compteurs de numérotation** éditables par type de document, avec avertissement sur le risque de doublons. Correctif : `numerotationDocs` renvoie un tableau `{type, format, compteur}` (le parsing initial le traitait comme un objet).

## Phase 5 — Impression & exports (◐ moteur pro en place 25/08/2026 — cf. [05-IMPRESSION.md](05-IMPRESSION.md))
- ☑ **Moteur d'impression** : `PrintPreview` générique = **iframe isolée** (zéro conflit CSS app) + **Paged.js** dans l'iframe (pagination `@page` A4, « Page n/N », réf. doc en marge via string-set, thead répétés, avoid-break) + `window.print()` natif (PDF intégré). Polyfill vendorisé `public/vendor/` (script `sync:pagedjs`). Documenté : `app/src/print/README.md`.
- ☑ **Modèles** : pièce de **vente** (fiche vente), pièce d'**achat** (fiche achat), **état/relevé client** (fiche client) — blocs partagés (DocHeader/TiersBlock/TotalsBlock/SignFooter) + BASE_CSS. Validé E2E données réelles : BL 1008/2026 (1 page), relevé client 131 (**2 pages**, pieds de page corrects).
- ☑ **Export CSV (Excel FR)** (27/08/2026) : helper `lib/export.ts` (séparateur `;`, virgule décimale, **BOM UTF-8** pour les accents) intégré au **DataGrid** via `exportCsv={{ nom, columns }}` — les accesseurs sont explicites (nombres bruts, pas le texte affiché à espaces insécables). Bouton « ⬇ Exporter CSV » câblé sur **Ventes**, **Achats**, **Stock** et les **8 vues de Statistiques**. Exporte les lignes affichées (page courante pour les grilles paginées). Validé E2E : fichier `articles-stock-….csv`, BOM `EF BB BF`, 51 lignes.
- ☑ **Bibliothèque complète des documents (25/08/2026)** : 9 modèles — pièce de vente A4 (facture/BL/devis…), **ticket 80 mm** (comptoir), pièce d'achat A4, relevé client, **relevé fournisseur** (+ nouvelle fiche fournisseur `/tiers/fournisseur/:code`), situation des impayés client, **état des créances** (liste complète re-requêtée, validé 4 pages), **état de trésorerie** (période/compte), **état du stock** (valeur PMP). Tous branchés dans l'UI (cf. tableau dans `app/src/print/README.md`), validés E2E données réelles.
- ☐ Modèles restants : bordereau de factures, inventaire, journaux ventes/achats ; impression silencieuse ticket (imprimante dédiée)
- ◐ **Exports CSV (Excel FR, BOM UTF-8)** : ventes, achats, stock, 8 vues Statistiques (page/ordre affiché) + **clients, fournisseurs, débiteurs, états clients/fournisseurs, trésorerie** (28/08/2026 — export de la **liste complète** via re-requête `limit 5000`, pas seulement la page ; états respectent « masquer les soldés » ; dates formatées `JJ/MM/AAAA`). Validé E2E : clients = 279 lignes / trésorerie = 977 lignes (vs 50 affichées). ☐ référentiels, XLSX natif
- ☐ Sélection d'imprimante + impression directe (silencieuse) pour tickets

## Phase 6 — Serveurs P2 (nouvelles capacités, agent+bridge+cloud)
- ☑ **Mouvements de stock** (create/delete vente & achat) via `recalcArticlesStock` → proc native `UpdateSingleArticleStock` + synchro `Qte_reale`=`SUM(lots.Qte)` — validé E2E (25/08/2026)
- ☐ **`updateVente` / `updateAchat`** (modification de pièces + lignes) — sans ça, correction = supprimer/recréer
- ☐ **Transformation de documents** : BC→BL→FA, FP→FA, regroupement BL→facture (`grouped`), BRT/FAV depuis pièce d'origine
- ☐ **Trésorerie** : `annulerMouvement` (réel), `mouvementTresorie(cle)`
- ☐ **Transfert de stock inter-dépôts** atomique
- ☐ **Recouvrement** : retards > N jours, buckets d'ancienneté, échéances (SQL « Recouvrement » du doc agent) ; **Stat 104**
- ☐ **Utilisateurs dossier & droits** : CRUD users + modèle de droits (IDs `DroitsConstants.pas`) exposé via agent, application dans l'UI (masquage menus/actions)
- ☐ (option) **Production** : module agent + écrans

## Phase 7 — Packaging & distribution (◐ 25/08/2026)
- ☑ **Icônes** générées depuis `logo gestion commerciale.png` (`resources/icon.icns` + `icon.png` 1024²)
- ☑ **Build macOS** : `npx electron-builder --dir` → `release/mac-arm64/Gestion Commerciale.app` (276 Mo) puis **DMG** `release/Gestion Commerciale-0.1.0-arm64.dmg` (105 Mo). Bundle vérifié : nom, identifiant `com.softly.gestion-commerciale`, version, icône, et `app.asar` contenant `dist-electron/main.js`, `preload.js`, `dist/index.html` **et `dist/vendor/paged.polyfill.js`** (moteur d'impression).
- ☑ **Bundle de production validé** (servi comme Electron le charge) : chemins d'assets relatifs OK, React monté, écran de login rendu, hook de dev `window.__session` bien absent, polyfill Paged.js résolu correctement depuis `document.baseURI`.
- ⚠️ **Non signé** : aucune identité « Developer ID Application » sur cette machine → l'app s'ouvre avec l'avertissement Gatekeeper (clic droit → Ouvrir). Signature + notarisation à faire pour la distribution (cf. `agent_tray/SIGNING.md`).
- ⚠️ **Lancement de la fenêtre non vérifiable ici** : la session d'automatisation n'a pas de session graphique macOS (Electron démarre mais `whenReady` n'aboutit pas). À lancer manuellement : `open "release/mac-arm64/Gestion Commerciale.app"`.
- ☐ Builds Windows (NSIS) et Linux (AppImage/deb) — à produire sur/pour ces plateformes (`npm run dist:all` depuis une machine ou un CI adapté)
- ☐ Auto-update (electron-updater) + canal de release
- ☐ Télémétrie d'erreurs (optionnel) + page diagnostic connexion

## Phase 8 — Qualité
- ◐ **Tests de parité chiffrée vs Delphi** (26/08/2026 — rapport : [06-PARITE-DELPHI.md](06-PARITE-DELPHI.md)) : ✅ soldes clients (5), CA TTC annuel, créances, solde fournisseur, valeur du stock, solde de trésorerie — **tous au centime**. 2 bugs graves corrigés au passage (signes de règlements inversés en trésorerie ; noms des tiers lus dans `nom` vide au lieu de `raison`). ☐ relevés ligne à ligne, stats par article/client/famille, bénéfices, Stat 104
- ☐ Tests E2E des flux critiques (vente comptoir → règlement → caisse)
- ☐ Revue sécurité (stockage tokens, IPC, CSP renderer)

---

### Ordre recommandé
Phase 0 (validation) → 1 et 2 en parallèle → 3 → 4 → 5 → 6 → 7 → 8 (les tests de parité dès Phase 3).

- ☑ **Impression directe / silencieuse (tickets)** (29/08/2026) : IPC Electron `printers:list` + `print:silent` (fenêtre cachée → `webContents.print({silent})`), exposé via preload `window.gc.printers/printSilent`, util `print/engine/silentPrint.ts`, bouton « Impression directe » dans `PrintPreview` (masqué hors Electron) + réglage « Imprimante ticket » dans Paramètres. Dégradation gracieuse en navigateur. ⚠️ impression physique à valider sur poste (Electron + imprimante réelle).

- ☑ **Page de diagnostic de connexion** (29/08/2026) : `/diagnostic` (lien depuis Paramètres) teste cloud (ping+latence), agent (myAgents), session (sessionStatus), et le chemin **cloud→agent→base** (modesPayement) ; pastilles vert/orange/rouge + latences + actions « Retester » et « Renouveler le jeton ». Validé E2E.
