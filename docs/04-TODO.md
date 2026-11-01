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
- ☑ **Bibliothèque UI** : DataGrid (dense, totaux, pagination, export CSV, tri, skeletons, **filtres de colonnes** ✅), DocBadge, StatusPill, Money, Tabs, PeriodPicker, SearchInput, FormModal, ConfirmDialog, EntitySearch, **CommandPalette ⌘K** ✅, export CSV ✅, **Toasts** ✅ (feedback global succès/erreur, câblé CRUD tiers/articles/référentiels + éditeurs vente/achat + caisse) — ☑ filtres de colonnes, défilement virtuel (`components/grille`), panneaux d'aperçu rapide (ventes, achats, tiers, articles)
- ☑ **Duplication de pièce (vente ET achat)** (29/08/2026) : bouton « Dupliquer » sur les fiches → éditeur pré-rempli (lignes, tiers, mode, remise, note ; nouvelle date/numéro par le serveur) via `?from=<id>` + maps `VENTE_TYPE_CODE`/`ACHAT_TYPE_CODE`. Validé E2E vente (BL 17 lignes + toast).
- ☑ **Remise globale en % ou en montant (DA)** (29/08/2026) : `components/document/RemiseGlobale` avec bascule %/DA (valeur canonique = %, conversion via TTC avant remise), dans les deux éditeurs.
- ☑ **Tri de colonnes DataGrid** (28/08/2026) : opt-in par colonne via `sortAccessor` (clé de tri distincte du rendu JSX) ; clic sur l'en-tête croissant→décroissant→aucun, vides en fin, `localeCompare` fr + numérique ; l'export CSV suit l'ordre trié. Activé sur les 7 grilles analytiques des Statistiques (ventes/achats par article/client/fournisseur/famille, bénéfices) — données chargées en entier, donc tri correct (pas activé sur les grilles paginées côté serveur). Validé E2E : tri CA HT asc→AR321 (min 82 956), desc→AR10 (max 8 484 548).
- ☑ **CommandPalette ⌘K** (26/08/2026) : ouverte au ⌘K/Ctrl+K ou par la barre de recherche (qui était décorative), navigation vers les 10 écrans, 6 créations rapides, **recherche live clients / fournisseurs / articles** avec solde ou stock affiché, navigation ↑↓/Entrée/Échap — validé E2E
- ☑ **Scan de code-barres** (26/08/2026) : dans la recherche d'article des éditeurs, une saisie de douchette (code numérique + Entrée) déclenche une correspondance **exacte** via `articleParCodeBarre` et ajoute l'article directement ; message explicite si le code est inconnu — validé E2E
- ☑ **Couche API** : Apollo (authLink dynamique, errorLink codes `ACCOUNT_BLOCKED`/`SUBSCRIPTION_*`, header `X-Druxamed-Dossier`) — ☐ types TS dérivés des `.gql` agent + hooks par domaine (attend la publication du schéma cloud, voir 12 D0)
- ☑ **Flux session** : login 2 étapes (`loginIdentify`→`loginWithAgent` avec conflit/offline/quota) + choix dossier + `loginDossierUser` + persistance electron-store — ☑ connexion par code d'appairage (bouton « Copier le code d'appairage » ajouté au tray) · ☑ jeton chiffré `safeStorage` (25/09/2026)
- ☑ **Robustesse de session** (27/08/2026) — validé E2E :
  - `useSessionKeepAlive` : `refreshToken` automatique toutes les 6 h (JWT valable 7 j, donc jamais d'expiration en cours de journée) + sonde `sessionStatus` toutes les 2 min, qui fait remonter un blocage de compte ou une expiration d'abonnement dans le bandeau de l'errorLink sans attendre la prochaine action de l'utilisateur
  - `DossierSwitcher` : changement de dossier **ou** d'utilisateur sans se déconnecter — le dossier est positionné *avant* `loginDossierUser`, le cache Apollo est vidé (`clearStore`) au succès pour qu'aucune donnée de l'ancienne base ne subsiste, et **le dossier précédent est restauré** si la ré-identification échoue (vérifié : passage vers une base inexistante → message serveur affiché, session intacte, données rechargées depuis la bonne base)
  - Piège corrigé : le nom de dossier mémorisé en session peut différer de la liste par la casse (« bon 2026 » vs « BON 2026 ») ; sans réalignement le `<select>` retombait silencieusement sur la première entrée et on aurait changé de dossier par erreur
- ☐ **Dashboard v1** branché (statVentes mois, soldesCaisse, debiteurs, alertesStock) — vérifier les formes JSON réelles contre un agent en ligne

## Phase 3 — Lecture (tout existe déjà côté serveurs) — ◐ démarré 25/08/2026
- ◐ **Dashboard** : KPI branchés (statVentes mois + marge, soldesCaisse, debiteurs+buckets, alertesStock) + barres CA/jour + **répartition « Top familles » du mois** (28/08/2026, `statVentesParFamille` ajouté à la requête Dashboard, tri CA desc top 6, barres) — ☑ péremption (carte tableau de bord + vue Stock → Péremption, horizon 30→365 j, 25/09/2026)
- ☑ **Documents de vente** : liste unifiée 7 types + **détail pièce** + **journal ligne à ligne** (onglet Documents/Journal, filtre code article, marge par ligne et totaux) — validé E2E (100 lignes mars 2026, 3,99 M TTC / 375 170 de marge)
- ☑ **Documents d'achat** : liste 6 types + **détail pièce** + **journal ligne à ligne**
- ◐ **Articles & stock** : grille paginée (recherche, vues alerte/marge négative, état stock) + **fiche article** (lots avec badge péremption J-n, tarifs par qté, codes-barres) — ☑ mouvements de stock (écran dédié), lots depuis la fiche ; ☐ stocks par dépôt (agent, voir 12 D21)
- ☑ **Clients / Fournisseurs** : listes CRUD + vue Débiteurs (buckets) + fiches 360° client & fournisseur + **états financiers globaux** (onglets « États clients » / « États fournisseurs » : solde de départ, mouvements, réglé, solde final, option « masquer les tiers soldés ») — ☑ avances (panneau dédié) ; ☐ paiements détaillés (signatures cloud, voir 12 D20)
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
- ☑ **Éditeur d'achat** (`/achats/nouvelle`) : recherche fournisseur + article, colonne lot/péremption, coût HT (défaut PMP), `createAchat` 6 types, **mouvement de stock validé E2E via UI** (BR +7 → suppression −7), MAJ PMP côté serveur — ☑ règlement immédiat, lots existants proposés (péremption reprise)
- ☑ **Suppression de pièces** (fiches vente & achat) : `ConfirmDialog` réutilisable + `deleteVente`/`deleteAchat`, stock reversé — validé E2E via UI (25/08/2026)
- ☑ **Article : 4 prix de vente end-to-end** (28/08/2026) — **BUG SERVEUR corrigé** : l'agent `createArticle`/`updateArticle` n'écrivait que `prix_venteHT` (tier 1) → les 3 autres prix saisis dans le formulaire étaient **perdus**. Helper `tiersVenteUpdates` : persiste `prix_venteHT1..3` + calcule `prix_venteTTC1..3`, `marge1..3`, `margeP1..3` ; recalcule les TTC/marges de tous les tiers quand le prix d'achat ou la TVA change. Correction lecture : `mapArticle` lisait `a.margep1` alors que la colonne est `margeP1` (P majuscule) → marge % des tiers renvoyée nulle. Validé E2E : create (HT 130/140/150 → TTC 154,7/166,6/178,5, marge% 30/40/50), update (tier2→200 + TVA 9 → TTC 218 + recalcul tier3), suppression.
- - ☑ **CRUD tiers & articles (UI)** : `FormModal` générique piloté par schéma (`forms/schemas.ts`) + hook `useCrud` (create/update/delete, colonne d'actions ✎/✕, confirmation) — branché sur **clients**, **fournisseurs** et **articles** (listes déroulantes familles/dépôts/unités/TVA alimentées par `REFERENTIELS`). Validé E2E : création → modification → suppression pour article et client, base restaurée. ☑ crédit initial (fiche client, `setCreditInitialClient`)
- ◐ **Règlements** : modal **générique** `ReglerTiersModal` (client ET fournisseur — aperçu `dry_run` → distribution FIFO → confirmation, reliquat→avance) branché sur les deux fiches ; **règlement immédiat dans l'éditeur de vente** (champ « Montant reçu » + bouton/raccourci **« Encaisser tout · F10 »** → `addReglementClient` sur la pièce créée, plafonné au net, statut « Payée » immédiat — validé E2E avec nettoyage complet) — ☑ panneau Règlements sur les fiches (encaisser/payer, supprimer), ☑ avances clients/fournisseurs (création, imputation FIFO, suppression) — 25/09/2026
- ☑ **Caisse** : **encaissement / décaissement / transfert entre comptes** depuis l'écran Trésorerie (`MouvementCaisseModal`, compte obligatoire, catégories Charge/Charge Production pour les décaissements) — validé E2E. **Arrêté de caisse** (25/09/2026) : solde d'ouverture, entrées/sorties par mode, comptage physique, écart enregistré, impression
- ☑ **Inventaire complet** (`/stock/inventaires`) : liste (valeurs théorique/comptée, écart, statut) + **création** (motif, date, dépôt → toutes les lignes générées avec le stock théorique) + **feuille de comptage** (saisie par ligne enregistrée à la sortie de case/Entrée, filtre texte, bascule « écarts seulement », écart et valorisation recalculés en direct) + **clôture** avec confirmation (applique les quantités comptées au stock) + suppression. Validé E2E : inventaire de 2036 articles / 18 M DA, comptage avec écart +10 (valorisation +580 125 DA), suppression, stock inchangé.
- ☑ **Stock** : bons d'entrée/sortie + transferts (`/stock/mouvements`, 25/09/2026) — numérotation `numerotation`, stock via `UpdateSingleArticleStock` (l'ancien code écrivait `BS-000001` dans une colonne BIGINT et contournait la procédure)
- ☑ **Référentiels : CRUD complet** (26/08/2026) — écran à 10 onglets (familles, sous-familles, dépôts, rayons, unités, TVA, comptes & banques, modes de paiement, commerciaux, centres de coût), piloté par une table de description (`REFS`) + `FormModal`/`useCrud`. Les référentiels sans mutation `update` côté serveur (sous-familles, rayons, unités, TVA, modes de paiement) masquent le bouton Modifier et affichent la raison. Validé E2E : famille créée → modifiée → supprimée.
- ☑ **Paramètres en écriture** (26/08/2026) : **coordonnées de la société** modifiables (identité, contacts, RC/NIF/NIS/Art. — ces valeurs alimentent tous les documents imprimés) et **compteurs de numérotation** éditables par type de document, avec avertissement sur le risque de doublons. Correctif : `numerotationDocs` renvoie un tableau `{type, format, compteur}` (le parsing initial le traitait comme un objet).

## Phase 5 — Impression & exports (◐ moteur pro en place 25/08/2026 — cf. [05-IMPRESSION.md](05-IMPRESSION.md))
- ☑ **Moteur d'impression** : `PrintPreview` générique = **iframe isolée** (zéro conflit CSS app) + **Paged.js** dans l'iframe (pagination `@page` A4, « Page n/N », réf. doc en marge via string-set, thead répétés, avoid-break) + `window.print()` natif (PDF intégré). Polyfill vendorisé `public/vendor/` (script `sync:pagedjs`). Documenté : `app/src/print/README.md`.
- ☑ **Modèles** : pièce de **vente** (fiche vente), pièce d'**achat** (fiche achat), **état/relevé client** (fiche client) — blocs partagés (DocHeader/TiersBlock/TotalsBlock/SignFooter) + BASE_CSS. Validé E2E données réelles : BL 1008/2026 (1 page), relevé client 131 (**2 pages**, pieds de page corrects).
- ☑ **Export CSV (Excel FR)** (27/08/2026) : helper `lib/export.ts` (séparateur `;`, virgule décimale, **BOM UTF-8** pour les accents) intégré au **DataGrid** via `exportCsv={{ nom, columns }}` — les accesseurs sont explicites (nombres bruts, pas le texte affiché à espaces insécables). Bouton « ⬇ Exporter CSV » câblé sur **Ventes**, **Achats**, **Stock** et les **8 vues de Statistiques**. Exporte les lignes affichées (page courante pour les grilles paginées). Validé E2E : fichier `articles-stock-….csv`, BOM `EF BB BF`, 51 lignes.
- ☑ **Bibliothèque complète des documents (25/08/2026)** : 9 modèles — pièce de vente A4 (facture/BL/devis…), **ticket 80 mm** (comptoir), pièce d'achat A4, relevé client, **relevé fournisseur** (+ nouvelle fiche fournisseur `/tiers/fournisseur/:code`), situation des impayés client, **état des créances** (liste complète re-requêtée, validé 4 pages), **état de trésorerie** (période/compte), **état du stock** (valeur PMP). Tous branchés dans l'UI (cf. tableau dans `app/src/print/README.md`), validés E2E données réelles.
- ☑ Modèles restants livrés : **bordereau** (ventes/achats, validé 892 BL/27 pages), **journaux ventes/achats** (ligne à ligne), **feuille d'inventaire** (2 boutons : « Feuille de comptage » vierge à remplir + « Imprimer l'état » chiffré avec écarts/valorisation). Bibliothèque d'impression complète.
- ☑ **Exports CSV (Excel FR, BOM UTF-8)** : ventes, achats, stock, 8 vues Statistiques (page/ordre affiché) + **clients, fournisseurs, débiteurs, états clients/fournisseurs, trésorerie** (28/08/2026 — export de la **liste complète** via re-requête `limit 5000`, pas seulement la page ; états respectent « masquer les soldés » ; dates formatées `JJ/MM/AAAA`). Validé E2E : clients = 279 lignes / trésorerie = 977 lignes (vs 50 affichées). ☑ référentiels (grilles complètes : bouton « Exporter »), ☑ XLSX natif (exceljs, menu « Exporter » des grilles)
- ☑ Sélection d'imprimante + impression directe (silencieuse) pour tickets (Paramètres › imprimante ticket ; comptoir : impression silencieuse, aperçu en cas d'échec)

## Phase 6 — Serveurs P2 (nouvelles capacités, agent+bridge+cloud)
- ☑ **Mouvements de stock** (create/delete vente & achat) via `recalcArticlesStock` → proc native `UpdateSingleArticleStock` + synchro `Qte_reale`=`SUM(lots.Qte)` — validé E2E (25/08/2026)
- ☑ **`updateVente` / `updateAchat`** (25/09/2026) — lignes supprimées/réinsérées, totaux + stock recalculés, numéro/type/règlements conservés ; garde-fous (BL groupé, facture de regroupement, avoir lié, net < réglé)
- ☑ **Transformation de documents** (25/09/2026) : même ligne comme Delphi (BC→BL/FA, FP→BC/BL/FA, BL/BCT→FA ; achats DO→BC→BR→FA), **regroupement BL→facture** (`grouped = id facture`, règlements rattachés, dégroupage à la suppression), **avoirs / bons de retour** liés ligne à ligne (`invoice_retour_id`), qté retournable contrôlée
- ☑ **Trésorerie** : `annulerMouvement(cle)` réel (RGF/RG/EN/DE/AVC, transfert annulé d'un bloc) — ☐ `mouvementTresorie(cle)` (détail)
- ☑ **Transfert de stock inter-dépôts** atomique (bon de sortie + bon d'entrée liés `TRF-…`) — les lots n'ont pas de dépôt dans ce schéma : trace documentaire, stock global inchangé
- ☑ **Recouvrement** (Tiers → Recouvrement) : dû en retard > N jours, ancienneté 0-30/31-60/61-90/+90, mode desktop « sans pièce depuis N jours », impression + CSV ; **État 104** (Statistiques) : CA par client avec RC/NIF/NIS/Art., avoirs déduits, option BL, alerte NIF manquant, impression paysage + CSV — 25/09/2026. ☑ échéances : `date_reglement` / `nbr_jour_reglement` renseignés à la création (délai du dossier par défaut, champ « Délai de paiement » dans l'éditeur, recalcul à la modification) — l'app laissait l'échéance vide ; affichage « en retard de N j » sur la fiche ; colonne « Échu » au recouvrement
- ☑ **Utilisateurs dossier & droits** (25/09/2026) : modèle réel = libellés `|` dans `commercecommun.users.Previlege*` (pas d'IDs numériques) ; CRUD + matrice de droits (écran Utilisateurs & droits), droits renvoyés au login et rafraîchis toutes les 5 min, menus / routes / actions masqués. ☑ droits « … par utilisateur » (listes, bordereaux, statistiques ; journal : agent, 12 D23) et comptes `PrevilegeBank` (règlements, avances)
- ☐ (option) **Production** : module agent + écrans

## Phase 7 — Packaging & distribution (◐ 25/08/2026)
- ☑ **Icônes** générées depuis `logo gestion commerciale.png` (`resources/icon.icns` + `icon.png` 1024²)
- ☑ **Build macOS** : `npx electron-builder --dir` → `release/mac-arm64/Gestion Commerciale.app` (276 Mo) puis **DMG** `release/Gestion Commerciale-0.1.0-arm64.dmg` (105 Mo). Bundle vérifié : nom, identifiant `com.softly.gestion-commerciale`, version, icône, et `app.asar` contenant `dist-electron/main.js`, `preload.js`, `dist/index.html` **et `dist/vendor/paged.polyfill.js`** (moteur d'impression).
- ☑ **Bundle de production validé** (servi comme Electron le charge) : chemins d'assets relatifs OK, React monté, écran de login rendu, hook de dev `window.__session` bien absent, polyfill Paged.js résolu correctement depuis `document.baseURI`.
- ⚠️ **Non signé** : aucune identité « Developer ID Application » sur cette machine → l'app s'ouvre avec l'avertissement Gatekeeper (clic droit → Ouvrir). Signature + notarisation à faire pour la distribution (cf. `agent_tray/SIGNING.md`).
- ⚠️ **Lancement de la fenêtre non vérifiable ici** : la session d'automatisation n'a pas de session graphique macOS (Electron démarre mais `whenReady` n'aboutit pas). À lancer manuellement : `open "release/mac-arm64/Gestion Commerciale.app"`.
- ◐ Builds Windows (NSIS) et Linux (AppImage/deb) : pipeline `.gitlab-ci.yml` (check à chaque push ; builds + publication dans le registre générique GitLab sur tag `vX.Y.Z` ; macOS sur runner `macos`, manuel) — ☐ à exécuter une première fois sur GitLab (non testé ici)
- ☑ Auto-update (electron-updater, fournisseur generic) : actif si le build est publié avec `GC_UPDATE_URL` ; téléchargement en fond, installation à la fermeture, état + bouton dans Paramètres. Cible mac `zip` ajoutée (requise), artefacts sans espace. Vérifié : `app-update.yml` / `latest-mac.yml` générés
- ◐ ☑ Journal local des erreurs de l'application + rapport de diagnostic copiable (sans secret) pour le support ; ☐ télémétrie distante (option, côté cloud : voir 12, D46) + ☑ page diagnostic connexion (`/diagnostic` : Internet / serveur / agent, protection de la session, journal des incidents réseau, cache hors ligne)

## Phase 8 — Qualité
- ◐ **Tests de parité chiffrée vs Delphi** (26/08/2026 — rapport : [06-PARITE-DELPHI.md](06-PARITE-DELPHI.md)) : ✅ soldes clients (5), CA TTC annuel, créances, solde fournisseur, valeur du stock, solde de trésorerie — **tous au centime**. 2 bugs graves corrigés au passage (signes de règlements inversés en trésorerie ; noms des tiers lus dans `nom` vide au lieu de `raison`). ☐ relevés ligne à ligne, stats par article/client/famille, bénéfices, Stat 104
- ☑ Tests (25/09/2026) : **18 tests unitaires** Vitest (`npm test` : calculs de pièce, droits, dates), **E2E flux critiques** à travers cloud→agent→base (`npm run test:e2e`, 14 vérifications : connexion par appairage, refresh du jeton, vente comptoir → encaissement → arrêté de caisse → annulation, filtre par utilisateur), **67 tests d'intégration** agent
- ☑ Revue sécurité (25/09/2026) : jeton chiffré au repos (`safeStorage`, migration auto), IPC restreints (liste blanche de clés, contrôle de l'expéditeur), `sandbox`, navigation/popups bloquées, CSP au build (script inline Paged.js externalisé), fenêtre d'impression sans JS

---

### Ordre recommandé
Phase 0 (validation) → 1 et 2 en parallèle → 3 → 4 → 5 → 6 → 7 → 8 (les tests de parité dès Phase 3).

- ☑ **Impression directe / silencieuse (tickets)** (29/08/2026) : IPC Electron `printers:list` + `print:silent` (fenêtre cachée → `webContents.print({silent})`), exposé via preload `window.gc.printers/printSilent`, util `print/engine/silentPrint.ts`, bouton « Impression directe » dans `PrintPreview` (masqué hors Electron) + réglage « Imprimante ticket » dans Paramètres. Dégradation gracieuse en navigateur. ⚠️ impression physique à valider sur poste (Electron + imprimante réelle).

- ☑ **Page de diagnostic de connexion** (29/08/2026) : `/diagnostic` (lien depuis Paramètres) teste cloud (ping+latence), agent (myAgents), session (sessionStatus), et le chemin **cloud→agent→base** (modesPayement) ; pastilles vert/orange/rouge + latences + actions « Retester » et « Renouveler le jeton ». Validé E2E.


- ☑ **Statistiques — graphiques professionnels + filtre serveur** (29/08/2026) : composants SVG auto-suffisants (`components/charts/`) — `LineChart` (aire+ligne 2px, grille discrète, survol crosshair+infobulle), `BarChart` horizontal (top-6, repli « Autres », survol=part %), `DonutChart` (segments + légende chiffrée + total au centre). Palette catégorielle **validée CVD-safe** (script du skill dataviz : PASS clair, PASS sombre). Intégrés : courbe d'évolution CA (ventes), achats HT, bénéfice brut ; barres+donut de répartition par famille. **Filtre famille server-side** sur les vues Par article / Par client (param `famille` déjà géré par l'agent — validé 200→125 HORMONO, 200→26 BIOCHEMIE). Aucun changement de schéma serveur → pas d'impact mobile.


## Lot du 25/09/2026 — cycle de vie des pièces, droits, caisse, stock, sécurité
Validé par **67 tests d'intégration** agent (`sos-agent/test/integration/cycle-pieces.itest.js`, sur copie de base `gc_test_2026`) puis **E2E navigateur** (cloud + agent locaux, dossier de test) : BC→BL→modification→encaissement partiel→regroupement 2 BL→avoir→suppressions en cascade (stock revenu à l'identique) ; achat BC→BR→retour ; bon d'entrée ; avance→imputation→annulation ; arrêté de caisse + impression ; masquage par droits (profil YAHIA).

Bugs corrigés au passage :
- **Types vente inversés** dans l'agent : en base Type 6 = bon de retour (BTN), 7 = avoir (FAVN) ; dates FP/FAV/BRT dans `DEDate`/`FAVDate`/`BTDate` (le filtre « Avoirs » du mobile ne renvoyait rien).
- `colis` NULL (colonne NOT NULL, mode SQL strict) faisait échouer toute création de pièce sans colisage ; `achat.User` NOT NULL.
- `addAvanceClient` n'écrivait pas la catégorie `Avance CL` (avance invisible) ; la création d'avance sur reliquat insérait une colonne `uuid` inexistante.
- **Cloud `refreshToken`** réémettait le JWT avec `users.agent_id` au lieu de l'agent de la session → dès le premier renouvellement (au démarrage de l'app) les commandes partaient vers un autre agent ou aucun.
- `transfertCompte` : décaissement sans libellé de compte (ligne de solde orpheline) ; transfert désormais lié par un code.
- App : dates décalées d'un jour (UTC) à la modification/duplication ; `isoToday` en UTC.

Suite du même jour : droits « par utilisateur » et `PrevilegeBank` appliqués ; **bug** : les règlements saisis sur une pièce n'étaient rattachés à aucune caisse (absents des soldes et de l'arrêté) et sans libellé de trésorerie — corrigé (caisse de l'utilisateur par défaut). Tests unitaires + E2E API, auto-update, CI GitLab.

Lot suivant (même jour) : recouvrement, État 104, péremption, connexion par code d'appairage. **Bugs corrigés** : la péremption saisie à la réception était écrite dans `lachat.DateF` (texte ignoré) au lieu de `EDate`, et les lots n'étaient jamais datés (`getLots` lisait des colonnes inexistantes → badges de péremption toujours vides ; `addLot` écrivait une colonne inexistante) ; `deleteLot` ne protégeait pas les lots en stock (`lot.qte` au lieu de `Qte`). Tests d'intégration agent : 71.

Puis : échéances de paiement, détail d'un mouvement de trésorerie (clic sur une ligne : nature, compte, tiers, lien vers la pièce, annulation). Timbre fiscal non implémenté : jamais utilisé dans les données (Timbre = 0 partout), règles à confirmer. Tests d'intégration agent : 73.

Revue de code (même jour) et correctifs :
- **Droits vérifiés côté agent** : `loginDossierUser` émet un jeton signé (HMAC, clé dérivée de secrets du PC), l'app l'envoie (`X-Druxamed-User`), le cloud le relaie (`_user_token`), l'agent contrôle les droits Delphi avant chaque écriture (`src/grpc/droits-guard.ts`). Nouvelles commandes : jeton obligatoire ; commandes historiques : contrôlées si jeton présent (compatibilité app mobile — à rendre obligatoire quand le mobile enverra le jeton). L'administration des utilisateurs ne se fie plus à un `acteur_id` fourni par le client (usurpation de l'admin possible).
- Retours d'achat cumulés plafonnés (lien `lachat.note = RET:<ligne>`), retours faits sur un BL reportés sur la facture groupée (`lvente.Qte_return`), règlements rendus aux BL au dégroupage, imputation d'avance liée à son avance (`uuid AVC<id>-…`), échéance Delphi conservée si ni date ni délai ne changent, caisse par défaut limitée aux comptes autorisés, pas de chargement « tous comptes » pour un utilisateur restreint, client retirable en modification. Tests d'intégration agent : 89 ; E2E : 15.

Puis : **droit de timbre** (barème LF 2025, art. 100 du Code du timbre : exonéré ≤ 300 DA, 1 / 1,5 / 2 DA par tranche de 100 DA, minimum 5 DA ; factures et comptoirs en espèces, calcul côté agent, aperçu désactivable dans l'éditeur, impressions) — correctif : la facture A4 imprimait la TVA deux fois (« Timbre / Taxes ») ; **mode strict** des droits (`exiger_jeton_utilisateur`) ; app mobile : mémorisation et envoi du jeton (non commité, mêlé au travail en cours du dépôt mobile) ; **guide de déploiement** ([07-DEPLOIEMENT.md](07-DEPLOIEMENT.md)). Tests d'intégration agent : 101 ; tests unitaires : 22.

Reste à faire : déploiement (cf. guide), commit + publication du mobile, activation du mode strict une fois tous les clients à jour, hébergement public des mises à jour, contrôle visuel de l'impression paysage de l'État 104, PMP non rejoué à la modification d'un achat (volontaire), recouvrement/Stat 104, déploiement cloud + agents, signature/auto-update/builds Windows-Linux. Tests E2E : ☑ parcours d'interface automatisés (`npm run test:ui`, CI job `ui`), dont un audit d'accessibilité axe-core (WCAG 2 A / AA) sur 18 écrans en thèmes clair et sombre (aucune violation) ; ☑ tests de l'application de bureau réelle (`npm run test:electron`, CI job `electron`) ; ☐ chaîne complète sur un agent de test en CI.

## Lot du 25/09/2026 (soir) — grille de données, opérations serveur, audit du schéma
- ☑ **Grille de données** (`app/src/components/grille`, type DataGrid DevExtreme) : tri multiple, filtres (ligne, en-tête, recherche), groupes par glisser-déposer avec totaux, colonnes figées / bandes / réorganisables / redimensionnables / masquables, sélection, maître-détail, édition ligne / cellule / lot / formulaire, export Excel / CSV / PDF, clavier, RTL, état mémorisé. Tous les tableaux de consultation passent par elle (`ui/DataGrid`).
- ☑ **Opérations côté serveur** sur les 17 listes paginées : tri, filtres, recherche, pagination, regroupement et totaux en SQL (`sos-agent/src/common/grille-distante.ts`, argument `grille` des requêtes de liste). Les totaux et exports portent sur tout le résultat filtré, plus sur la page.
- ☑ **Fiche de stock** (kardex) dans la fiche article, selon les règles de la procédure `UpdateSingleArticleStock` ; alerte + recalcul quand le stock enregistré ne correspond plus aux mouvements (7 articles sur 2036 dans la base de test).
- ☑ Éditeur d'achat : **paiement immédiat** du fournisseur (« Payer tout · F10 »).
- ☑ **Bugs corrigés** :
  - crédit initial client : la mutation effaçait les paiements du crédit (encaissements réels) et ramenait le solde à zéro ;
  - l'agent s'arrêtait à la reconnexion au cloud (erreur gRPC sans écouteur) ;
  - en-tête de la fiche article vide pour tous les articles ;
  - tables / colonnes inexistantes : tarifs par quantité (`tarifqte`), centres de coût (`centredescouts`), promotions, nomenclature, trésorerie historique, commerciaux.
- ☑ Tests agent : intégration 109 (cycle des pièces) + **`lectures.itest.js`** (91 commandes Get*, 0 erreur SQL) + **`schema.itest.js`** (tables et colonnes écrites contre la base Delphi).
- Reste (inchangé) : déploiement, commit du mobile, mode strict, push — en attente de votre accord.

## Dépendances et sécurité (01/11/2026)
- ☑ **Electron 31 → 44.10.1** (31 n'était plus maintenu : Chromium sans correctifs de sécurité). Adaptations : marges du
  PDF (`margins` à 0 au lieu de `marginType: 'none'`), imprimante par défaut (`isDefault` retiré de PrinterInfo, déduit des
  options système quand elles existent). Vérifié : tests Electron 9/9 (dont export PDF à la taille de page), empaquetage
  Linux avec electron-builder 24 et démarrage du paquet. ☐ à vérifier sur Windows : installeur NSIS, impression silencieuse
  des tickets, coffre de chiffrement de la session.
- ☑ `npm audit fix` : failles « hautes » de production corrigées (brace-expansion, fast-uri, js-yaml).
- ☑ **react-router v6 → v7.18.5** : les deux avis modérés (redirection par antislash, désérialisation) sont fermés.
  Migration sans changement de code : le routeur était déjà en mode « data » (`createHashRouter`), aucune route « splat »
  n'utilise de lien relatif (comportement modifié en v7), pas de loaders / actions. Les mises à jour de navigation passent
  désormais par `startTransition` (défaut v7). Vérifié : types, 264 tests unitaires, 49 parcours d'interface (dont la garde
  « quitter sans enregistrer », `useBlocker`), 9 tests Electron. Bundle principal +37 kB (1 245 → 1 282 kB).
  `npm audit --omit=dev` ne remonte plus que la chaîne d'exceljs.
- ☐ **exceljs** : chaîne `archiver` / `uuid` / `minimatch` (avis modérés) ; le correctif proposé est un retour à exceljs 3
  (inacceptable). Usage limité à l'écriture des exports ; suivre une version corrigée d'exceljs.
- ☑ **Démarrage allégé** : l'interface du paquet d'états (aperçu, designer, inspecteur) est chargée à la première
  impression (`impression/ImpressionModeleDiffere.tsx`) ; le reste de l'app n'importe que `@softly/report/core`. Script
  principal 1 282 → 1 166 kB. Parcours d'interface ajoutés : aperçu de l'état du stock, bibliothèque des modèles (51 tests).
- ☐ Passer à Electron 45 après quelques correctifs de cette branche (sortie fin octobre 2026) ; electron-builder 26.
