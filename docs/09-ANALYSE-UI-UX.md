# Gestion Commerciale Desktop — Analyse UI/UX critique et plan d'amélioration

> Cahier des charges « design system v2 ». Lecture complète du code dans `app/src` (jetons, config Tailwind, `components/ui/*`, coquille, ruban, registre de commandes, grille, écrans Dashboard / Login / Ventes / VenteDetail / VenteEditor / Stock / Tiers / ClientDetail / Parametres / Tresorerie / Comptoir, CommandPalette, Toast, ErrorBoundary, NotFound, RequireDroit, useCrud, LignesTable, ArticleSearch, modales métier), de `docs/01-CHARTE-GRAPHIQUE.md`, `design/maquettes.html`, des tests (`app/src/__tests__`), du script e2e (`app/e2e/flux-critiques.mjs`) et de la config Tailwind de `packages/report`.
> Analyse réalisée le 31/10/2026 ; elle a servi de cahier des charges à la refonte « charte v2 » (voir [01-CHARTE-GRAPHIQUE.md](01-CHARTE-GRAPHIQUE.md) pour la charte en vigueur). Noms de code en anglais, explications en français ; chemins relatifs à `app/src`.

---

## 0. Synthèse exécutive

L'application est fonctionnellement riche et déjà structurée (registre unique de commandes, grille maison complète, module comptoir fidèle à sa maquette, jetons CSS clair/sombre). Le problème n'est pas l'absence de système, mais le fait qu'il n'est **pas incarné dans des composants** : les recettes de classes Tailwind sont recopiées à la main dans chaque écran, ce qui produit une dérive visible (6 recettes de boutons, 22 tailles de police arbitraires, 3 coquilles modales + 18 overlays ad hoc, deux jeux d'icônes + des emoji).

Les dix points qui pèsent le plus, dans l'ordre :

| # | Constat | Gravité |
|---|---|---|
| 1 | Texte secondaire `--text-muted` (#7C8AA5) à **3,48:1** sur blanc, utilisé 265 fois pour du texte informatif (sous-titres KPI, messages vides, onglets inactifs, libellés) → échec WCAG AA. | Haute |
| 2 | Couleurs sémantiques utilisées **en texte** alors qu'elles sont calibrées pour des aplats : success 3,30:1, warning 3,19:1, teal 2,49:1, orange 2,80:1 ; badges (StatusPill, DocBadge) entre 2,2 et 2,9:1. | Haute |
| 3 | **Mode sombre incomplet** : `brand-50/100/300`, `pos-overlay`, teintes « soft » ne sont pas redéfinies → aplats pastel clairs dans une UI sombre (nav active, lignes sélectionnées de la grille, résultats de recherche) et liens `text-brand-700` à 2,72:1. Seul le ruban a un correctif local (`--ruban-accent`). | Haute |
| 4 | Trois coquilles modales incohérentes (`Dialog` avec piège de focus/Échap/ARIA ; `ConfirmDialog` et `FormModal` sans aucun des trois) + 18 modales « `fixed inset-0` » maison. Les confirmations destructives ne se ferment pas à Échap et n'ont pas de focus initial. | Haute |
| 5 | Pas de composant `Button` : ≥ 6 recettes, aucun état hover/active sur la plupart, `disabled:opacity` à 40/45/50/60 selon le fichier, action destructrice rendue de 4 façons différentes. | Haute |
| 6 | Iconographie : emoji / symboles typographiques comme icônes (📁 🖥 🔍 ✕ ✎ ⬇ ⚠ ☀ 🌙 ⚙ ＋ ← →) dans 60 fichiers, alors que deux jeux SVG coexistent (`navigation/icones.tsx` et `components/ui/Icon.tsx`) avec des tracés en doublon. | Moyenne |
| 7 | Typographie : 22 tailles arbitraires (`text-[9px]` → `text-[50px]`), corps réel à 12 px (268 occurrences) alors que `body` est à 13 px ; titres d'écran 18 px, de modale 15 ou 18 px, du backstage 26 px « light ». | Moyenne |
| 8 | États : chargement = texte « Chargement… » / « … » (17 occurrences), pas de squelette ; erreurs = `error.message` brut en rouge sans action ; vides = une phrase sans appel à l'action ; les toasts n'ont pas d'`aria-live` et les erreurs graves disparaissent après 6 s. | Moyenne |
| 9 | Repérage : pas de fil d'Ariane, « ← Retour » rendu comme un lien texte au milieu des actions, titre de fenêtre jamais mis à jour, deux rangées de `Tabs` empilées (Ventes) sans hiérarchie, onglets sans `role="tab"`. | Moyenne |
| 10 | `hover:bg-surface-alt` pointe vers une couleur inexistante dans `tailwind.config.js` → aucun survol (atoms.tsx:128, LignesTable.tsx:173,180). | Basse (mais révélateur) |

Le plan proposé est **purement présentationnel** : les requêtes GraphQL, les droits, les calculs, les stores zustand, l'impression et la grille (`components/grille/moteur.ts`) restent intacts. Il se déroule en 8 lots : fondations (jetons) → primitives (Button, Field, Icon, Card, Badge) → modales / feedback / états → coquille & navigation → écrans de liste → écrans de détail et éditeurs → tableau de bord, login, grille → alignement du comptoir.

---

## 1. Analyse critique priorisée

Chaque point : constat → preuves (`fichier:ligne`) → impact → correction visée (le « comment » est détaillé aux §3–5).

### 1.1 Gravité HAUTE

#### H1 — Contraste du texte secondaire insuffisant (clair)
- **Preuves** : `styles/tokens.css:24` (`--text-muted: #7C8AA5`) ; utilisé via `text-ink-muted` 265 fois, p. ex. `screens/Dashboard.tsx:56,58,71,80,88` (libellés et sous-textes des KPI), `components/ui/atoms.tsx:66` (onglet inactif), `atoms.tsx:113` (pagination), `components/grille/Grille.tsx:919` (message vide), `Grille.tsx:672` (en-têtes de colonnes 10,5 px), `components/CommandPalette.tsx:147,163`.
- **Mesures** : 3,48:1 sur `#FFFFFF`, 3,27:1 sur `--bg #F6F8FC`. AA exige 4,5:1 pour du texte < 18 px ; ici il est à 10–12 px.
- **Impact** : lecture 8 h/jour, écrans de pharmacie souvent sous néons ; les informations « secondaires » sont en réalité des données (montants +60 j, nombre de comptes, codes articles).
- **Correction** : `--text-muted` → `#5F6D87` (4,91:1 sur bg, 5,4:1 sur surface) ; réserver un `--text-placeholder` (#8A96AD) aux seuls placeholders et textes décoratifs non porteurs d'information. Mode sombre : `#8093B0` est déjà conforme (5,55:1).

#### H2 — Couleurs sémantiques employées en texte et en badges sous le seuil AA
- **Preuves** : `atoms.tsx:27-40` (StatusPill : success sur teinte 12 % = 2,89:1, warning = 2,75:1), `atoms.tsx:5-15` (DocBadge BL/BCT teal = 2,19:1, BR orange ≈ 2,5:1, FP muted sur line-soft = 3,07:1), `screens/Stock.tsx:109` (stock bas en `--warning` 3,19:1), `screens/Tiers.tsx:129,343` (solde client en warning), `screens/ClientDetail.tsx:64` (montant négatif en `--success` 3,30:1), `screens/Tresorerie.tsx:140` (montant ± en success/danger), `components/ui/Toast.tsx:441-442` (blanc sur success 3,30:1 et sur `--brand-700`/danger OK mais info/success non).
- **Impact** : les statuts « Partiel », « Stock bas », « OK » sont précisément ceux que l'utilisateur doit repérer d'un coup d'œil ; en mode sombre les mêmes hex passent (success 5,26:1) mais pas `danger` (3,59:1).
- **Correction** : distinguer trois rôles par couleur sémantique — `*-solid` (aplat sous texte blanc), `*-text` (texte sur surface/soft) et `*-soft` (fond) + `*-line` (bordure) — avec valeurs clair/sombre distinctes (§3.2). Aucune couleur « base » ne doit plus être utilisée directement en `color:`.

#### H3 — Mode sombre partiel : échelle `brand`, overlay et teintes non redéfinies
- **Preuves** : `styles/tokens.css:67-103` ne redéfinit ni `--brand-50/100/300`, ni `--pos-overlay`, ni les mélanges `color-mix(... transparent)` qui, sur fond sombre, restent lisibles mais les aplats `bg-brand-50` non : `components/AppShell.tsx:130` (nav active `bg-brand-50 text-brand-700`), `components/CommandPalette.tsx:160`, `components/ArticleSearch.tsx:99`, `screens/Login.tsx:242-243`, `screens/Parametres.tsx:94`, `screens/comptoir/Comptoir.tsx:310,392,434`, `components/grille/Grille.tsx:476,599` (ligne sélectionnée et en-tête de groupe en `--brand-50/--brand-100`), `screens/ClientDetail.tsx:88`.
- **Liens/texte de marque** : `text-brand-700` sur surface sombre = 2,72:1 (`screens/VenteDetail.tsx:91`, `ClientDetail.tsx:82`, `navigation/Backstage.tsx:110`, `components/document/LignesTable.tsx:186`, `screens/Parametres.tsx:83,107`). Le ruban contourne le problème avec `--ruban-accent` (`styles/index.css:16-17`) — preuve que le besoin est connu mais traité localement.
- **Bonne nouvelle** : `design/maquettes.html:65-68` définit déjà les valeurs sombres manquantes (`--b50:#17223D; --b100:#1D2C52; --b300:#4F6ECB; --okbg:#122B1E; --warnbg:#2E2312; --badbg:#2F1616; --tealbg:#0F2A27; --violetbg:#221A38; --orangebg:#2E1D10`). Il suffit de les porter dans `tokens.css`.
- **Correction** : §3.2 — jetons `--brand-soft/--brand-soft-strong/--brand-text/--brand-line` thémés, `--overlay` global, suppression des `color-mix(... transparent)` au profit de jetons `*-soft` explicites.

#### H4 — Trois coquilles modales, dont deux sans accessibilité, et 18 overlays maison
- **Preuves** :
  - `components/ui/Dialog.tsx:30-71` : complet (overlay, `role="dialog"`, `aria-modal`, `aria-labelledby`, piège de focus, Échap, restauration du focus) mais ombre et rayon codés en dur (`:190` `boxShadow: '0 24px 64px…'`, `borderRadius: 16`), bouton fermer `tabIndex={-1}` (`:196`) et utilisé seulement par le comptoir et `ImprimerPieceDialog`.
  - `components/ui/ConfirmDialog.tsx:246-265` : `div` sans rôle, pas d'Échap, pas de focus initial (Entrée ne valide pas, Tab repart dans la page derrière), fermeture au clic sur l'overlay (dangereux pour une confirmation : un clic raté annule), overlay `rgb(15 26 46 / .45)` codé en dur.
  - `components/ui/FormModal.tsx:341-346` : idem (ni rôle, ni Échap, ni piège de focus), bouton « ✕ » sans `aria-label`.
  - 18 autres fichiers reconstruisent `fixed inset-0 z-50 … rgb(15 26 46 / .45)` : `components/{MouvementDetailModal,AgentSwitcher,TransfertStockModal,BonStockModal,AvancesPanel,ArreteCaisseModal,ReglerTiersModal,MouvementCaisseModal,DossierSwitcher}.tsx`, `components/document/{RetourModal,ReglerPieceModal,GrouperBLModal}.tsx`, `components/CommandPalette.tsx:132`, `navigation/Backstage.tsx:29`, `screens/{ClientDetail:201,MouvementsStock,Parametres:221,Inventaires}.tsx`, `components/grille/Grille.tsx`.
  - `z-index` ad hoc : `z-50` (23×), `z-30`, `z-[60]` (popups grille), `z-[70]` (backstage), `z-[80]` (info-bulle ruban), `z-[100]` (toasts).
- **Impact** : un utilisateur clavier (héritage Delphi) ne peut pas confirmer une suppression à Entrée ni annuler à Échap ; une modale ouverte depuis le comptoir désactive les hotkeys (`Comptoir.tsx:263`) mais n'offre pas de sortie clavier → blocage perçu.
- **Correction** : un seul `Modal` (le `Dialog` actuel, généralisé), sur lequel `ConfirmDialog` et `FormModal` sont réécrits ; échelle `z-*` nommée ; `--overlay` thémé ; migration progressive des 18 modales métier (§5, lot 3 et 6).

#### H5 — Pas de composant bouton : dérive des recettes et des états
- **Preuves** (recettes distinctes) :
  1. Primaire liste : `rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700` (`screens/Ventes.tsx:125`, `Stock.tsx:153`, `Tiers.tsx:137`, `Tresorerie.tsx:193`, 55 occurrences de `bg-brand-700`).
  2. Primaire détail : `px-3 py-1.5` (`components/ErrorBoundary.tsx:40`, `screens/NotFound.tsx:9`, `Utilisateurs.tsx:155`).
  3. Secondaire : `const btn = 'rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label'` dupliqué (`screens/VenteDetail.tsx:27`, `screens/AchatDetail.tsx:22`) et variante `px-3 py-2` (`Ventes.tsx:112`, `Stock.tsx:136`).
  4. Grille : `rounded-sm px-2.5 py-1 text-[11.5px]` (`components/grille/Grille.tsx:685-716`).
  5. Modale/formulaire : `px-4 py-2 rounded-md … text-[12px]` (`ConfirmDialog.tsx:254-258`, `FormModal.tsx:408-412`) et `py-2.5 flex-1 / flex-[2]` (`Login.tsx:254-256`, `ClientDetail.tsx:224-227`, `Parametres.tsx:235-239`).
  6. Comptoir : `DialogButton` 48 px rayon 11 (`Dialog.tsx:217-231`) + boutons 52/70/78 px sur mesure (`Comptoir.tsx:420-457`).
  - **Aucun état hover/active** sur les primaires (seuls quelques `hover:border-brand-300`) ; `disabled:opacity` à 40 (7×), 45 (4×), 50 (15×), 60 (50×).
  - **Destructif** rendu de 4 façons : teinte douce (`VenteDetail.tsx:117-120`), contour + texte rouge (`Tresorerie.tsx:185-188`, `:147`), texte seul (`Parametres.tsx:328`), pleine couleur (`ConfirmDialog.tsx:259`).
  - Glyphes dans les libellés : « ＋ Nouvelle pièce », « − Décaissement », « ⬇ CSV » (`Ventes.tsx:126`, `Tresorerie.tsx:170,189,194`).
- **Impact** : impossible de garantir cibles ≥ 24 px (WCAG 2.5.8), focus visible homogène, et libellés cohérents ; chaque nouvel écran repart de zéro.
- **Correction** : `Button` + `IconButton` (§5.1) avec variantes `primary | secondary | ghost | danger | success` et tailles `sm | md | lg`, adoption écran par écran.

#### H6 — Confirmations destructives : libellés ambigus et absence de garde-fou clavier
- **Preuves** : `screens/comptoir/Comptoir.tsx:494-497` : titre « Annuler le ticket », bouton d'abandon « Annuler », bouton de confirmation « Annuler le ticket » ; `screens/Tresorerie.tsx:203-210` : « Annuler ce mouvement ? » / « Annuler » / « Annuler le mouvement ». `ConfirmDialog.tsx:253` impose le libellé « Annuler » pour l'abandon. Clic sur l'overlay = abandon silencieux (`:247`).
- **Impact** : double sens du mot « Annuler » sur une action irréversible ; aucun focus initial donc Entrée n'a pas d'effet prévisible.
- **Correction** : `ConfirmDialog` v2 avec `cancelLabel` par défaut « Conserver » / « Fermer » lorsque `danger`, focus initial sur le bouton **sûr**, Échap = abandon, overlay non cliquable quand `danger`, et libellé de confirmation toujours au verbe (« Supprimer la pièce »).

### 1.2 Gravité MOYENNE

#### M1 — Iconographie : emoji, symboles et deux jeux SVG
- **Preuves** : emoji : `components/AppShell.tsx:142` (📁), `:147` (🖥), `:160` (🔍) ; `components/CommandPalette.tsx:137` (🔍) ; `screens/Parametres.tsx:95` (☀️/🌙) ; `components/grille/Grille.tsx` (🗑 ✎ ✕ ☰ ⬇ ⊞ ⊟ ⏷ ▲ ▼ ▾ ▸) ; symboles : `forms/useCrud.tsx:126,131` (✎ ✕ 11 px), `components/ui/Toast.tsx:441-443` (✓ ⚠ ℹ), `atoms.tsx:115,118` (← →), `atoms.tsx:129` (⬇), `components/document/LignesTable.tsx:135,174` (✕ ⚙), `:71` (⚠), `components/ui/FormModal.tsx:346` et `Dialog.tsx:197` (✕), `screens/ClientDetail.tsx:205`, `screens/Parametres.tsx:213` (✎).
  - Deux jeux : `navigation/icones.tsx` (`Icone`, props `nom/taille/trait`, 55 tracés, toujours `aria-hidden`) et `components/ui/Icon.tsx` (`Icon`, props `name/size/strokeWidth/label`, 11 tracés). Doublons : `imprimante`, `retour`, `utilisateur`, `panier`, `croix`≈`fermer`.
- **Impact** : rendu des emoji dépendant de l'OS (Windows Segoe Emoji vs macOS), couleur non héritée, taille incohérente, lecture d'écran (« dossier de fichiers », « loupe »), poids visuel aléatoire à côté des tracés 1,75 px du ruban.
- **Correction** : un seul `Icon` (§3.6, §5.2) : fusion des deux registres, tailles 14/16/18/20 (+24 comptoir), trait 1,75 par défaut (2 pour ≤ 16 px), `label` optionnel ; interdiction des glyphes textuels dans les boutons.

#### M2 — Typographie arbitraire et hiérarchie floue
- **Preuves** : 22 tailles `text-[Npx]` (268× 12, 173× 11, 60× 11,5, 54× 10,5, 41× 10, 38× 15, 32× 12,5, 20× 14, 19× 18, 8× 19, 8× 16, 3× 26, 3× 20, 3× 17, 2× 9,5, 1× 9, + 28/30/32/34/50). `styles/index.css:12` fixe `body` à 13 px mais le corps effectif est 12 px. Titres : écran 18 px (`atoms.tsx:101`), modale 15 px (`ConfirmDialog.tsx:250`, `FormModal.tsx:345`) ou 18 px (`Dialog.tsx:193`), backstage 26 px `font-light` (`Backstage.tsx:46`), sections 13 px bold (`Parametres.tsx:90`, `Dashboard.tsx:97`), eyebrow 9,5–10 px (`AppShell.tsx:122`, `CommandPalette.tsx:155`). Charte §3 prévoyait 20/15/13/11.
- **Impact** : la grille d'alignement vertical n'est jamais la même ; les éléments « secondaires » tombent sous 11 px (limite pratique de lisibilité à 100 % Windows).
- **Correction** : échelle nommée de 9 crans (§3.4) injectée dans `tailwind.config.js` (`fontSize`), interdiction lint de `text-[Npx]` hors `print/` et comptoir (`text-pos`).

#### M3 — États de chargement, d'erreur et vides
- **Preuves** : chargement = texte (`VenteDetail.tsx:147`, `VenteEditor.tsx:252`, `Login.tsx:269`, `Dashboard.tsx:43,57,69,78` affiche « … » dans les KPI), overlay « Chargement… » dans la grille (`Grille.tsx:924-926`) — correct mais sans squelette au premier rendu ; erreur = `error.message` brut rouge (`VenteDetail.tsx:137-138`, `ClientDetail.tsx:84`, `Dashboard.tsx:50` **à l'intérieur du bandeau dégradé**, donc blanc sur bleu à 11 px) sans bouton « Réessayer » ; vides = phrase seule (`Grille.tsx:919`, `Dashboard.tsx:98,109`, `CommandPalette.tsx:147`). `ErrorBoundary`, `NotFound`, `RequireDroit` sont trois cartes quasi identiques (`ErrorBoundary.tsx:30-44`, `NotFound.tsx:6-10`, `RequireDroit.tsx:8-15`).
- **Correction** : `Skeleton` (KPI, lignes de grille au premier chargement, en-tête de pièce), `EmptyState` (icône + titre + aide + action), `StatePanel` (erreur / introuvable / refusé avec action), `Alert` inline pour les erreurs de mutation (§5.6).

#### M4 — Feedback : toasts non annoncés, durées inadaptées, messages critiques volatils
- **Preuves** : `components/ui/Toast.tsx:470` (conteneur sans `role="status"`/`aria-live`), `:458` (erreur effacée après 6 s), messages métier longs envoyés en toast (`Comptoir.tsx:195` « Ticket … enregistré, mais l'encaissement a échoué … Réglez-le depuis la pièce. », `VenteEditor.tsx:169`), toast « info » bleu plein (`Toast.tsx:443`) identique visuellement au primaire.
- **Correction** : `Toast` v2 (§5.7) : `aria-live="polite"` (succès/info) et `assertive` (erreur), erreurs **persistantes** jusqu'à fermeture, variante `warning`, surface claire avec barre latérale colorée (contraste texte garanti), action optionnelle (« Ouvrir la pièce »), empilement max 3, pause au survol.

#### M5 — Navigation et repérage
- **Preuves** : `atoms.tsx:98-105` (`PageHeader` = h1 + enfants, pas de fil d'Ariane ni de zone méta) ; retour sous forme de lien texte parmi les boutons (`VenteDetail.tsx:91`, `VenteEditor.tsx:260` « ← Annuler », `ClientDetail.tsx:82`, `Parametres.tsx:83` « Utilisateurs & droits → ») ; `document.title` jamais mis à jour ; deux rangées de `Tabs` identiques empilées (`Ventes.tsx:133,139` vue puis type) ; `Tabs` sans `role="tab"`/`aria-selected` ni flèches (`atoms.tsx:58-73`) ; barre latérale sans `<nav aria-label>` (`AppShell.tsx:103`), « Changer d'utilisateur » = déconnexion (`AppShell.tsx:150`) ; en mode ruban aucun rappel de l'écran courant hors onglet actif ; `CommandPalette` : liste sans `role="listbox"/option`, pas d'`aria-activedescendant` (`CommandPalette.tsx:145-170`).
- **Correction** : `PageHeader` v2 avec `breadcrumb`, `backTo`, `meta` (badge type, statut), `actions` ; hook `usePageTitle` ; `Tabs` v2 (variants `pill` pour les vues, `underline` pour les sous-filtres) avec clavier ; `Breadcrumb` ; attributs ARIA sur palette et nav.

#### M6 — Formulaires : requis, erreurs, saisie numérique
- **Preuves** : requis signalé par « * » textuel sans `aria-required` (`FormModal.tsx:373`) ; erreurs agrégées dans un bandeau (« Champs obligatoires : A, B ») sans marquage du champ (`FormModal.tsx:356-361`) ; `<input type="number">` natifs avec spinner navigateur dans les lignes (`LignesTable.tsx:91-112`), `VenteEditor.tsx:303,334`, `ClientDetail.tsx:217`, alors que `NumberEdit` (format fr-DZ, ↑/↓, sélection au focus) existe ; placeholders servant de libellé (`Stock.tsx:134`, `atoms.tsx:89-96` `SearchInput` sans `aria-label`) ; `PeriodPicker` : deux `<input type=date>` sans libellé, séparés par « → » (`atoms.tsx:79-85`) ; `label` 11 px bold + input 12,5 px : hiérarchie inversée (le libellé pèse plus que la valeur).
- **Correction** : `Field` (label, `required`, `help`, `error`, `aria-*`), `TextInput`/`Select`/`Textarea`/`Checkbox`, `NumberField` (enveloppe `NumberEdit`), `DateField`, `DateRangeField` (remplace `PeriodPicker`), `SearchField` (icône, effacement, `aria-label`) — §5.3.

#### M7 — Cartes, panneaux de totaux et listes de propriétés dupliqués
- **Preuves** : 42× `bg-surface border border-line-soft rounded-md shadow-soft` ; `TotRow` (`VenteEditor.tsx:382-389`) ≡ `Row` (`VenteDetail.tsx:210-218`) ; `Field` (`VenteDetail.tsx:206-208`) ≡ `Head` (`ClientDetail.tsx:170-177`) ; `Bucket` (`atoms.tsx:135-143`) ≡ `Kpi` (`Statistiques.tsx:617-625`) ≡ cartes KPI du Dashboard (`Dashboard.tsx:55-92`) ; `Carte` (`Statistiques.tsx:30-40`) ≡ `Carte` (`Backstage.tsx:98-107`) ≡ sections `Parametres`.
- **Correction** : `Card` (+ `CardHeader`), `DescriptionList`, `TotalsPanel`, `KpiTile` (§5.4, §5.8).

#### M8 — Grille : densité, en-têtes et commandes
- **Preuves** : `Grille.tsx:44` (`hauteurLigne = 34`) alors que les jetons `--row-compact: 32px` / `--row-comfortable: 40px` (`tokens.css:52-53`) ne sont utilisés nulle part ; en-têtes 10,5 px capitales muted (`Grille.tsx:672`, contraste H1) ; boutons de barre d'outils en glyphes (`:685-716`) ; sélection `--brand-50` non thémée (`:476`) ; survol `brightness-[0.98]` invisible en sombre (`:492`) ; actions de ligne `✎`/`✕` de ~16 px (`useCrud.tsx:126-131`, `Grille.tsx:561-564`).
- **Correction** : prop `density: 'compact' | 'comfortable'` câblée sur les jetons, en-têtes 11 px `--text-label`, `IconButton` 24–28 px pour les actions de ligne, jetons `--surface-hover` / `--brand-soft` pour survol/sélection. **Le moteur (`moteur.ts`) et l'API `GrilleProps` ne changent pas.**

#### M9 — Jetons et hex hors `tokens.css`
- **Preuves** : `navigation/Ruban.tsx:230` (`#4ADE80`/`#F87171`), `screens/VenteEditor.tsx:368` & `AchatEditor.tsx:295` (`#3A2A05` sur `--gold-400`), `screens/Statistiques.tsx:358,434` (`#B45309`, `#0D9488`), `components/charts/palette.ts:7-29` (palette catégorielle hex), `components/grille/exportGrille.ts:105`, ombre de `Dialog.tsx:190`, overlay `rgb(15 26 46 / .45)` ×18, `Comptoir.tsx` rayons 9/10/11/14 px et `rounded-2xl`. `hover:bg-surface-alt` inexistant (`atoms.tsx:128`, `LignesTable.tsx:173,180`).
- **Correction** : jetons `--gold-text`, `--status-online/--status-offline` (contraste sur dégradé), `--overlay`, `--shadow-modal`, `--chart-1..6`, rayons `--r-xs/sm/md/lg/xl`, et contrôle lint `no-hex-outside-tokens`.

#### M10 — Comptoir : second langage visuel
- **Preuves** : `tokens.css:60-80` (`--pos-*`, `--text-secondary`, `--surface-sunken` = jetons « généraux » nés dans le comptoir), `Comptoir.tsx` : rayons 9/10/11/14/`xl`/`2xl`, hauteurs 38/52/70/78 px, `Kbd` et `Icon` n'existent que pour lui, `DialogButton` (`Dialog.tsx:217`) est un bouton de plus. L'écran est **bon** (états vides illustrés `LignesComptoir.tsx:49-54`, raccourcis visibles, `aria-live` sur le net, `role="alert"` hors ligne) : c'est le reste de l'application qui doit monter à son niveau.
- **Correction** : promouvoir `Kbd`, `Icon`, le gabarit `Dialog` et l'état vide illustré au rang de composants généraux ; faire pointer les `--pos-*` vers les jetons sémantiques v2 (alias) sans toucher aux métriques de la maquette.

### 1.3 Gravité BASSE

- **B1 — Transitions** : 8 `transition*` dans tout le code, pas de `prefers-reduced-motion` (`styles/index.css`), alors que la charte §7 prévoit 150 ms ease-out. → jetons `--dur-fast/base/slow` + `@media (prefers-reduced-motion)`.
- **B2 — Focus** : anneau global correct (`index.css:26-29`) mais `--focus-ring` = `brand-300` à 2,68:1 sur blanc (anneau non conforme à 3:1 pour un composant UI) ; bouton fermer `tabIndex={-1}` (`Dialog.tsx:196`) ; nav sans `aria-current` (NavLink le gère via classe `active` non stylée). → anneau `brand-500` + offset 1 px (clair), `brand-300` (sombre).
- **B3 — Libellés d'export** : « ⬇ Exporter CSV » (`atoms.tsx:129`), « ⬇ CSV » (`Tresorerie.tsx:170`), « ⬇ Exporter » (`Grille.tsx:716`). → un libellé « Exporter » + icône `download`.
- **B4 — Montants** : signe « + » préfixé uniquement en trésorerie (`Tresorerie.tsx:141`) ; `Money` colore le négatif en rouge mais `TotRow` recode la règle (`VenteEditor.tsx:386`). → `Money` unique avec prop `signed`.
- **B5 — Pagination** : boutons « ← » / « → » sans `aria-label` (`atoms.tsx:114-118`). Peu utilisé depuis la grille paginée ; à aligner ou retirer.
- **B6 — Login** : pas d'`autocomplete="username|current-password"`, pas d'affichage du mot de passe, étapes en texte (`Login.tsx:176-188`) ; carte 400 px correcte. → `Field` + `Stepper` léger.
- **B7 — Dashboard** : graphiques « maison » sans axe ni valeur lisible (`Dashboard.tsx:99-104`, info-bulle via `title` uniquement), cartes KPI sans icône ni tendance, carte « réservé » visuellement identique à une carte cliquable (`Dashboard.tsx:61-65`). → `KpiTile` avec icône tonale, `BarList`, et réutilisation de `components/charts/BarChart`.
- **B8 — Backstage** : `h1` 26 px `font-light` (`Backstage.tsx:46,77`) contraire au ton 700/800 du reste. → `text-2xl font-extrabold`.
- **B9 — Statut agent** : pastille 8 px sans texte en < xl (`Ruban.tsx:230-231`), rouge/vert seuls (daltonisme). → `StatusDot` avec libellé ou icône (`wifi-off`).
- **B10 — z-index** : échelle implicite (voir H4). → `zIndex` nommé dans Tailwind : `dropdown 30`, `sticky 20`, `ribbon 35`, `modal 50`, `popover 60`, `backstage 70`, `tooltip 80`, `toast 100`.

### 1.4 Ce qui est bien et doit être conservé
- Registre unique de commandes (`navigation/commandes.ts`) avec droits, info-bulles et raccourcis : base idéale pour `PageHeader`/`Breadcrumb`.
- Grille : clavier complet (`Grille.tsx:399-424`), mode distant, état mémorisé.
- `Dialog` du comptoir : modèle à généraliser.
- `NumberEdit` : modèle de champ numérique métier.
- Hotkeys déclaratifs (`lib/useHotkeys.ts`) désactivés quand une modale est ouverte.
- Couleurs de documents stables (`DOC_TONES`), identité bleu roi + or, Plus Jakarta Sans + JetBrains Mono tabulaire.

---

## 2. Charte graphique v2 (jetons et règles)

Principes : **compatibilité ascendante** (aucun jeton existant n'est supprimé ; `report-theme.css` et `packages/report` continuent de lire `--bg --surface --surface-sunken --line --line-soft --text --text-label --text-muted --brand-700 --success --warning --danger --r-* --shadow-* --font-*`), **sémantique avant valeur** (on écrit `text-fg-muted`, jamais `#5F6D87`), **un rôle par jeton** (aplat / texte / fond doux / bordure).

### 2.1 Couleurs — jetons CSS (`styles/tokens.css` v2)

#### Marque
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--brand-50` | `#EEF3FE` | `#17223D` | fond sélection, survol doux |
| `--brand-100` | `#DCE6FD` | `#1D2C52` | fond badge FA, en-tête de groupe |
| `--brand-300` | `#7C9BF2` | `#4F6ECB` | bordure active, séparateurs accentués |
| `--brand-500` | `#3B66F5` | `#3B66F5` | anneau de focus (clair), barres de graphique |
| `--brand-700` | `#2450E0` | `#2450E0` | **primaire** (aplat sous blanc : 6,37:1) |
| `--brand-900` | `#1E3FB5` | `#1E3FB5` | pressed, bandeau net à payer |
| `--brand-text` *(nouveau)* | `#2450E0` | `#7C9BF2` | liens, texte et icônes de marque sur surface (6,37 / 6,46:1) — remplace `--ruban-accent` (conservé en alias) |
| `--brand-soft` *(nouveau)* | `#EEF3FE` | `#17223D` | = brand-50, nommé pour les composants |
| `--brand-line` *(nouveau)* | `#7C9BF2` | `#4F6ECB` | bordure d'élément sélectionné |
| `--gradient-hero` | inchangé | inchangé | bandeaux |

#### Or (identité logo)
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--gold-400` | `#F6B93B` | `#F6B93B` | aplat accent (bouton « Encaisser tout »), toujours avec `--gold-ink` |
| `--gold-600` | `#E89B0C` | `#F6B93B` | icônes accent |
| `--gold-ink` *(nouveau)* | `#3A2A05` | `#3A2A05` | texte sur `--gold-400` (7,88:1) — remplace le hex de `VenteEditor.tsx:368` |
| `--gold-text` *(nouveau)* | `#8A5A00` | `#F6B93B` | texte or sur surface (5,93 / 9,84:1) |

#### Neutres, surfaces, bordures
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--bg` | `#F6F8FC` | `#0B1220` | fond application |
| `--surface` | `#FFFFFF` | `#111A2E` | cartes, grille, champs |
| `--surface-raised` | `#FFFFFF` | `#16213A` | popovers, modales (sombre : un cran plus clair) |
| `--surface-sunken` | `#FBFCFE` | `#0E1627` | pied de modale, en-tête de table, zones de saisie désactivées |
| `--surface-hover` *(nouveau)* | `#F3F6FB` | `#182338` | survol de ligne/élément de menu — remplace `surface-alt` |
| `--surface-active` *(nouveau)* | `#EEF3FE` | `#17223D` | élément sélectionné (= brand-soft) |
| `--line-soft` | `#EDF1F8` | `#1C2942` | séparateurs, bordure de carte |
| `--line` | `#C9D3E4` | `#31415F` | bordure de champ, de bouton secondaire |
| `--line-strong` *(nouveau)* | `#9AA9C2` | `#4A5B7D` | bordure de champ au survol, séparateur de pied de grille |
| `--overlay` *(nouveau)* | `rgb(8 20 40 / .5)` | `rgb(0 0 0 / .62)` | voile des modales — remplace `--pos-overlay` (alias) et les 18 `rgb(15 26 46 / .45)` |

#### Texte
| Jeton | Clair | Sombre | Contraste (sur surface) | Usage |
|---|---|---|---|---|
| `--text` | `#0F1A2E` | `#E9EEF7` | 16,9 / 14,9 | corps, montants |
| `--text-label` | `#42536F` | `#B7C3D9` | 7,8 / 9,8 | libellés de champ, en-têtes de colonnes |
| `--text-muted` | **`#5F6D87`** (était #7C8AA5) | `#8093B0` | 5,4 / 5,6 | texte secondaire porteur d'information |
| `--text-placeholder` *(nouveau)* | `#8A96AD` | `#6B7D9C` | ≈3 (toléré : non informatif) | placeholders uniquement |
| `--text-inverse` *(nouveau)* | `#FFFFFF` | `#FFFFFF` | — | texte sur aplats colorés |
| `--text-secondary` | alias de `--text-muted` | alias | — | conservé pour le comptoir |

#### Sémantiques — quatre rôles par couleur
Règle : `*-solid` = aplat sous `--text-inverse` ; `*-text` = texte/icône sur surface **ou** sur `*-soft` ; `*-soft` = fond doux ; `*-line` = bordure. Les anciens `--success/--warning/--danger/--info/--teal/--violet/--orange` deviennent des alias de `*-solid` (compatibilité `report-theme.css`).

| Famille | Rôle | Clair | Sombre | Contraste vérifié |
|---|---|---|---|---|
| success | solid | `#15803D` | `#15803D` | blanc 5,02 |
| | text | `#15803D` | `#4ADE80` | 5,02 (surface) · 4,53 (soft) / 9,95 · 8,67 |
| | soft | `#E8F7EE` | `#122B1E` | |
| | line | `#A7E3BD` | `#1F5A36` | |
| warning | solid | `#B45309` | `#B45309` | blanc 5,02 |
| | text | `#B45309` | `#FBBF24` | 5,02 · 4,57 / 10,4 · 9,2 |
| | soft | `#FDF3E4` | `#2E2312` | |
| | line | `#F3C98A` | `#6B4A12` | |
| danger | solid | `#DC2626` (hover `#B91C1C`) | `#DC2626` | blanc 4,83 / 6,47 |
| | text | `#B91C1C` | `#F87171` | 6,47 · 5,63 / 6,27 · 6,09 |
| | soft | `#FDEBEB` | `#2F1616` | |
| | line | `#F2B8B8` | `#6B1F1F` | |
| info | solid | `#0E7490` | `#0E7490` | blanc 5,4 |
| | text | `#0E7490` | `#22D3EE` | 5,36 · 4,75 / 9,6 · 8,3 |
| | soft | `#E0F5FA` | `#0E2A33` | |
| | line | `#9ADCEB` | `#155E6E` | |
| teal | text | `#0F766E` | `#2DD4BF` | 5,47 · 4,93 / 9,3 · 8,2 |
| | soft | `#E4F7F4` | `#0F2A27` | |
| violet | text | `#6D28D9` | `#A78BFA` | 7,1 · 6,1 / 6,4 · 6,1 |
| | soft | `#F1EBFD` | `#221A38` | |
| orange | text | `#C2410C` | `#FB923C` | 5,18 · 4,64 / 7,7 · 7,1 |
| | soft | `#FEF0E5` | `#2E1D10` | |
| neutral | text | `#42536F` | `#B7C3D9` | badge FP, « Brouillon » |
| | soft | `#EDF1F8` | `#1C2942` | |

Les familles teal/violet/orange gardent leurs « solid » historiques (`#14B8A6`, `#8B5CF6`, `#F97316`) pour les icônes du ruban et les graphiques (où ils ne portent pas de texte).

#### Documents (inchangés en principe, re-câblés sur les rôles)
| Doc | text | soft |
|---|---|---|
| FA | `--brand-text` | `--brand-100` |
| BL / BCT | `--teal-text` | `--teal-soft` |
| BC / DO | `--violet-text` | `--violet-soft` |
| FP | `--neutral-text` | `--neutral-soft` |
| FAV / BRT | `--danger-text` | `--danger-soft` |
| BR (achat) | `--orange-text` | `--orange-soft` |
| Règlement | `--success-text` | `--success-soft` |

#### Statut, graphiques, focus
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--status-online` | `#4ADE80` | `#4ADE80` | pastille sur dégradé (remplace hex `Ruban.tsx:230`) |
| `--status-offline` | `#F87171` | `#F87171` | idem |
| `--chart-1..6` | `#2450E0 #B45309 #0D9488 #9333EA #DB2777 #65A30D` | `#7C9BF2 #FBBF24 #2DD4BF #C4B5FD #F472B6 #A3E635` | palette catégorielle (déplace `charts/palette.ts`) |
| `--chart-neutral` | `#64748B` | `#8093B0` | « Autres » |
| `--focus-ring` | `0 0 0 2px var(--surface), 0 0 0 4px #3B66F5` | `0 0 0 2px var(--surface), 0 0 0 4px #7C9BF2` | anneau 2 px avec offset (≥ 3:1) |

#### Comptoir (alias, aucune valeur changée)
`--pos-cash` → `var(--success-solid)` · `--pos-alert` → `var(--danger-text)` clair / `--danger-solid` · `--pos-ok-soft/line/text` → `--success-soft/line/text` · `--pos-alert-soft/line` → `--danger-soft/line` · `--pos-amber` → `--warning-text` · `--pos-overlay` → `--overlay`. Les `--pos-return*` (orange brûlé `#C2410C/#9A3412/#FFF4EC/#F3B58C`) restent **spécifiques** au mode retour, comme le prévoit la maquette.

### 2.2 Rayons, ombres, z-index, durées, espacements, densité
| Jeton | Valeur | Usage |
|---|---|---|
| `--r-xs` | 4 px | keycaps, chips, cellules éditables |
| `--r-sm` | 6 px | champs, boutons `sm`, badges rectangulaires |
| `--r-md` | 10 px | boutons `md/lg`, cartes, menus |
| `--r-lg` | 16 px | modales, bandeaux hero, carte « net à payer » |
| `--r-xl` | 20 px | tuiles comptoir (remplace `rounded-2xl`) |
| `--r-full` | 9999 px | pills, pastilles |
| `--shadow-soft` | `0 1px 3px rgb(15 26 46 / .06)` · sombre `none` | cartes |
| `--shadow-card` | `0 4px 12px rgb(15 26 46 / .08)` · sombre `none` | cartes survolées, KPI |
| `--shadow-lifted` | `0 12px 32px rgb(15 26 46 / .16)` · sombre `0 12px 32px rgb(0 0 0 / .5)` | popovers, menus, toasts |
| `--shadow-modal` *(nouveau)* | `0 24px 64px rgb(8 20 40 / .35)` · sombre `0 24px 64px rgb(0 0 0 / .7)` | modales (remplace `Dialog.tsx:190`) |
| `--z-sticky` 20 · `--z-dropdown` 30 · `--z-ribbon` 35 · `--z-modal` 50 · `--z-popover` 60 · `--z-backstage` 70 · `--z-tooltip` 80 · `--z-toast` 100 | | échelle unique, exposée dans Tailwind `zIndex` |
| `--dur-fast` 100 ms · `--dur-base` 150 ms · `--dur-slow` 250 ms · `--ease` `cubic-bezier(.2,.8,.2,1)` | | transitions ; aucune animation dans les grilles ; `prefers-reduced-motion` → 0 ms |
| Espacement | grille 4 px : 4 / 8 / 12 / 16 / 20 / 24 / 32 | classes Tailwind standard (`gap-1` … `gap-8`) ; **plus de `gap-3.5` / `py-[9px]`** hors comptoir |
| `--row-compact` 32 px · `--row-comfortable` 40 px | | câblés sur `Grille` via prop `density` (défaut compact pour les documents, comfortable pour les référentiels) |
| `--control-sm` 28 px · `--control-md` 34 px · `--control-lg` 40 px · `--control-xl` 48 px | | hauteurs uniques de boutons et champs (xl = pied de modale comptoir) |

### 2.3 Échelle typographique nommée (remplace les tailles arbitraires)
À déclarer dans `tailwind.config.js › theme.fontSize` (vérifié : aucune classe `text-xs/sm/base/lg/xl` par défaut n'est utilisée aujourd'hui, le remplacement est sûr).

| Classe | Taille / interligne | Graisse usuelle | Rôle | Remplace |
|---|---|---|---|---|
| `text-2xs` | 10 / 14 px | 700, `tracking-wide`, capitales | eyebrow, keycaps, badges, en-têtes de colonne compactes | 9, 9.5, 10 |
| `text-xs` | 11 / 16 px | 600–700 | libellés de champ, sous-textes, en-têtes de colonne | 10.5, 11, 11.5 |
| `text-sm` | 12 / 18 px | 400–600 | corps dense : cellules de grille, texte de modale, boutons `sm` | 12, 12.5 |
| `text-base` | 13 / 20 px | 400–600 | corps standard, boutons `md`, champs | 13 |
| `text-md` | 14 / 20 px | 600–700 | boutons `lg`, nom de client, valeurs mises en avant | 14 |
| `text-lg` | 16 / 22 px | 700 | titres de section, titre de carte | 15, 16, 17 |
| `text-xl` | 18 / 24 px | 800 | titres de modale, valeur de KPI secondaire | 18, 19 |
| `text-2xl` | 20 / 26 px | 800, `tracking-tight` | **titre d'écran** (H1), titre backstage | 20 |
| `text-3xl` | 26 / 30 px | 800, mono pour montants | KPI principal, net à payer éditeur | 26, 28 |
| `text-display` | 32 / 36 px | 800, mono | montant d'encaissement | 30, 32, 34 |
| `text-pos` | 50 / 52 px | 800, mono, `tracking-[-1px]` | net à payer comptoir (seul usage) | 50 |

Règles : corps de l'application = `text-base` (13 px, `body`), grilles et modales denses = `text-sm` ; jamais sous `text-2xs` ; les capitales (`uppercase`) seulement en `text-2xs`/`text-xs` avec `tracking-wide` ; montants toujours `.money` (mono tabulaire) ; `font-light` interdit.

### 2.4 Règles d'usage des couleurs
1. **Une seule action primaire pleine par zone** (`--brand-700`) : l'action principale de l'écran, le bouton de validation d'une modale. Jamais deux boutons pleins côte à côte (exception comptoir : « Encaisser » vert + « Encaisser tout » or sont des actions distinctes documentées).
2. **Les couleurs sémantiques ne sont jamais utilisées en `color:` sous leur forme `solid`** : texte → `*-text`, fond → `*-soft`, bordure → `*-line`.
3. **Rouge = perte, danger, irréversible** : reste à payer, rupture, suppression, hors ligne. **Ambre = attention, action attendue** : partiel, stock bas, retard 30–60 j, solde dû. **Vert = acquis** : payé, encaissement, en ligne, stock OK. **Bleu marque = navigation et action** ; **or = accent d'identité et d'opportunité** (jamais un statut).
4. **Un seul statut coloré par ligne de grille** (le reste en neutre) pour éviter le sapin de Noël.
5. **Mode sombre** : les ombres disparaissent, la hiérarchie est portée par `--surface` < `--surface-raised` et `--line-soft` ; aucune valeur `brand-50/100` ni `color-mix(... transparent)` écrite en dur.
6. **Dégradé hero** réservé aux bandeaux (login, dashboard, barre de titre ruban, backstage, net à payer) : texte blanc ≥ 6:1 vérifié sur `--brand-700/900`, pastilles de statut en `--status-*`.
7. **Couleurs de documents** : une seule source (`DOC_TONES` v2 → jetons), même rendu en badge, en onglet actif (bordure basse colorée) et en en-tête d'éditeur.

### 2.5 Iconographie
- **Un seul jeu** : `components/ui/Icon.tsx` absorbe les tracés de `navigation/icones.tsx` (registre `ICONS`, 24 × 24, `fill="none"`, `stroke="currentColor"`, `strokeLinecap/Linejoin="round"`). `navigation/icones.tsx` devient un ré-export (`export { Icon as Icone }` + adaptateur `nom/taille/trait`) le temps de la migration, puis est supprimé.
- **Tailles** : 14 (inline dans un texte `text-xs`), 16 (boutons `sm`, cellules, menus), 18 (boutons `md`, nav latérale), 20 (boutons `lg`, titres de carte, ruban petit), 24 (grands boutons de ruban, états vides 32–40).
- **Trait** : 1,75 à 18–24 px ; 2 à ≤ 16 px (sinon le trait disparaît à 100 % Windows).
- **Couleur** : héritée (`currentColor`) ; pastille tonale `IconBadge` (fond `*-soft`, icône `*-text`) pour KPI, états vides, ruban.
- **Accessibilité** : `aria-hidden` par défaut ; `label` → `role="img" aria-label`. Un `IconButton` exige toujours `label`.
- **Noms** (anglais, kebab-case) : `search, folder, server, user, users, close, check, alert-triangle, info, edit, trash, download, upload, printer, plus, minus, arrow-left/right/up/down, chevron-*, sun, moon, columns, filter, settings, refresh, external-link, lock, cash, percent, list, cart, receipt, invoice, delivery, order, quote, credit-note, return, package, warehouse, movements, inventory, expiry, tag, suppliers, debtors, collection, statement, references, treasury, bank, due-dates, stats, pie, trend, journal, templates, rights, grid, diagnostic, logout, layout-sidebar, layout-ribbon, pin, dashboard, counter, home, scan`. Les `NomIcone` actuels sont conservés en alias typés jusqu'à la fin du lot 4 (le test `navigation.test.ts` ne vérifie pas les icônes, mais `commandes.ts` les référence).
- **Interdits** : emoji, caractères ✕ ✓ ⚠ ✎ ⬇ ← → ＋ − dans les boutons, info-bulles ou badges. Les flèches typographiques restent admises dans la prose (« Paramètres → Utilisateurs »).

### 2.6 Boutons
| Variante | Fond | Texte | Bordure | Survol | Actif | Usage |
|---|---|---|---|---|---|---|
| `primary` | `--brand-700` | inverse | — | `--brand-900` | `--brand-900` + translateY(0.5px) | action principale |
| `secondary` | `--surface` | `--text-label` | `--line` | `--surface-hover`, bordure `--line-strong` | `--surface-sunken` | la majorité des actions |
| `ghost` | transparent | `--text-label` | — | `--surface-hover` | `--surface-sunken` | barres d'outils, actions de ligne, fermer |
| `danger` | `--danger-soft` | `--danger-text` | `--danger-line` | `--danger-solid` + texte inverse | idem | suppression, annulation de mouvement (hors modale) |
| `danger-solid` | `--danger-solid` | inverse | — | `#B91C1C` | | confirmation finale dans `ConfirmDialog` |
| `success` | `--success-solid` | inverse | — | `#166534` | | encaisser, valider la vente |
| `accent` | `--gold-400` | `--gold-ink` | — | `--gold-600` | | « Encaisser tout · F10 » uniquement |
| `link` | — | `--brand-text` | — | souligné | | navigation inline (« Diagnostic → ») |

Tailles : `sm` 28 px / `text-sm` / `px-2.5` / icône 16 · `md` 34 px / `text-base` / `px-3.5` / icône 18 (défaut) · `lg` 40 px / `text-md` / `px-5` / icône 20 · `xl` 48 px / `text-md` 800 / `px-6` (pied de modale comptoir, remplace `DialogButton`). Rayon `--r-sm` en `sm`, `--r-md` sinon. Désactivé : `opacity .5` + `cursor-not-allowed` **partout**. Chargement : `loading` affiche un spinner 16 px à la place de l'icône et fige la largeur (plus de « Export… » qui redimensionne). Focus : anneau global. Raccourci : prop `kbd` rend un `Kbd` aligné à droite (hérité du comptoir). Icône seule → `IconButton` (carré, `label` obligatoire, 28/34/40 px).

### 2.7 Champs
- Hauteur `--control-md` 34 px (`sm` 28 px dans les grilles éditables), `text-base`, padding 0 10 px, rayon `--r-sm`, fond `--surface`, bordure `--line` → survol `--line-strong` → focus `--brand-500` + anneau, erreur `--danger-text` + anneau danger, désactivé fond `--surface-sunken` texte `--text-muted`, lecture seule sans bordure.
- Libellé : `text-xs` 600 `--text-label`, au-dessus, `required` = astérisque `--danger-text` + `aria-required` ; aide `text-xs --text-muted` sous le champ ; erreur `text-xs --danger-text` avec icône 14, `aria-describedby`.
- Numérique : `NumberEdit` partout (alignement droite, mono, ↑/↓, suffixe « DA » / « % »), jamais `<input type="number">` nu.
- Date : `DateField` (input natif stylé + libellé) ; période : `DateRangeField` avec raccourcis « Aujourd'hui / Ce mois / Mois dernier / Exercice ».
- Recherche : `SearchField` (icône `search` à gauche, bouton effacer, `aria-label`, largeur 240–320 px, raccourci affiché « / » ou « Ctrl K »).

### 2.8 Cartes
`Card` : fond `--surface`, bordure `--line-soft`, rayon `--r-md`, ombre `--shadow-soft`, padding `md` 16 px (`sm` 12, `lg` 20). `interactive` → survol bordure `--brand-line` + `--shadow-card`, focusable, curseur pointeur. `CardHeader` : titre `text-lg` 700 + actions à droite + description `text-sm --text-muted`. `tone` optionnel (`info|warning|danger|success`) → fond `*-soft` + bordure `*-line` (bandeaux d'avertissement « mode retour », « BL facturé »).

### 2.9 Badges
`Badge` : `text-2xs` 700, hauteur 20 px, padding 0 8 px, `tone` ∈ `brand|neutral|success|warning|danger|info|teal|violet|orange`, `shape` `pill|square`, `dot` optionnel (pastille 6 px pour les statuts), `icon` optionnel. `DocBadge` et `StatusPill` deviennent des enveloppes typées de `Badge`. Contraste garanti par construction (`*-text` sur `*-soft` ≥ 4,5:1 dans les deux thèmes).

### 2.10 Extraits d'implémentation

`tailwind.config.js` (extension, noms existants conservés) :
```js
colors: {
  brand: { 50:'var(--brand-50)', 100:'var(--brand-100)', 300:'var(--brand-300)', 500:'var(--brand-500)', 700:'var(--brand-700)', 900:'var(--brand-900)',
           text:'var(--brand-text)', soft:'var(--brand-soft)', line:'var(--brand-line)' },
  gold: { 400:'var(--gold-400)', 600:'var(--gold-600)', ink:'var(--gold-ink)', text:'var(--gold-text)' },
  bg:'var(--bg)', surface:'var(--surface)', raised:'var(--surface-raised)', sunken:'var(--surface-sunken)',
  hover:'var(--surface-hover)', active:'var(--surface-active)', overlay:'var(--overlay)',
  line: { DEFAULT:'var(--line)', soft:'var(--line-soft)', strong:'var(--line-strong)' },
  ink: { DEFAULT:'var(--text)', label:'var(--text-label)', muted:'var(--text-muted)', placeholder:'var(--text-placeholder)', inverse:'var(--text-inverse)' },
  ok:'var(--success)', warn:'var(--warning)', bad:'var(--danger)', info:'var(--info)', teal:'var(--teal)', violet:'var(--violet)', orange:'var(--orange)', // alias historiques (report)
  success: { solid:'var(--success-solid)', text:'var(--success-text)', soft:'var(--success-soft)', line:'var(--success-line)' },
  warning: { /* idem */ }, danger: { /* idem */ }, infos: { /* idem (nom distinct de `info`) */ },
  tealc: {...}, violetc: {...}, orangec: {...}, neutral: { text:'var(--neutral-text)', soft:'var(--neutral-soft)' },
},
fontSize: {
  '2xs':['10px','14px'], xs:['11px','16px'], sm:['12px','18px'], base:['13px','20px'], md:['14px','20px'],
  lg:['16px','22px'], xl:['18px','24px'], '2xl':['20px','26px'], '3xl':['26px','30px'], display:['32px','36px'], pos:['50px','52px'],
},
borderRadius: { xs:'var(--r-xs)', sm:'var(--r-sm)', md:'var(--r-md)', lg:'var(--r-lg)', xl:'var(--r-xl)', full:'9999px' },
boxShadow: { soft:'var(--shadow-soft)', card:'var(--shadow-card)', lifted:'var(--shadow-lifted)', modal:'var(--shadow-modal)' },
zIndex: { sticky:'20', dropdown:'30', ribbon:'35', modal:'50', popover:'60', backstage:'70', tooltip:'80', toast:'100' },
transitionDuration: { fast:'100ms', DEFAULT:'150ms', slow:'250ms' },
height: { 'control-sm':'28px', 'control-md':'34px', 'control-lg':'40px', 'control-xl':'48px' },
```

`styles/index.css` (ajouts) :
```css
*:focus-visible { outline: none; box-shadow: var(--focus-ring); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0ms !important; animation: none !important; } }
::placeholder { color: var(--text-placeholder); }
```

---

## 3. Principes UX (outil métier clavier)

1. **Le clavier d'abord** : toute action a un chemin clavier ; les raccourcis F sont affichés sur le bouton (`Kbd`) et dans l'info-bulle, pas seulement dans la documentation. Une modale ouverte se ferme à Échap, se valide à Entrée depuis n'importe quel champ (sauf `textarea`).
2. **Un focus, toujours visible, jamais perdu** : anneau 2 px + offset ; à l'ouverture d'une modale le focus va au premier champ (ou au bouton sûr pour une confirmation) ; à la fermeture il revient à l'élément d'origine.
3. **Une action primaire par écran**, en haut à droite, pleine, avec son raccourci ; les autres sont secondaires ou fantômes ; le destructif est isolé à droite ou dans un menu.
4. **Dire où l'on est** : fil d'Ariane (Module › Liste › Pièce), titre d'écran `text-2xl`, méta (badge type + statut) à côté du titre, titre de fenêtre synchronisé.
5. **Dire ce qui se passe** : squelette au premier chargement, voile « Chargement… » sur rafraîchissement, bouton en état `loading`, toast de succès bref, erreur persistante avec cause et action.
6. **Les vides sont des pages** : icône, phrase explicative, action (« Créer la première facture », « Élargir la période »).
7. **Densité assumée mais lisible** : 32 px par ligne, 13 px de corps, jamais sous 10 px, contraste AA partout, colonnes numériques en mono alignées à droite.
8. **La couleur a un sens unique** : rouge perte/danger, ambre attention, vert acquis, bleu action, or identité ; un statut coloré par ligne.
9. **Confirmer le destructif, jamais l'ordinaire** : la suppression décrit sa conséquence (stock reversé, solde rouvert) et le bouton nomme l'action (« Supprimer la pièce ») ; enregistrer/imprimer ne demandent rien.
10. **Pas de surprise de souris** : un clic sur le voile ne ferme pas une saisie en cours ; `onRowClick` ouvre, double-clic édite ; le survol ne déclenche rien de persistant (sauf info-bulle différée).
11. **Même geste, même rendu** : exporter, imprimer, créer, modifier, supprimer ont un libellé, une icône et une place constants dans toute l'application (ruban, barre latérale, palette, écrans).
12. **Le comptoir reste souverain** : plein écran, grandes cibles, hotkeys exclusives ; il consomme les mêmes jetons et composants mais garde ses métriques de maquette.

---

## 4. Bibliothèque de composants (à créer / refondre)

Emplacement : `components/ui/`. Tout composant accepte `className` (fusion simple) et transmet les `...rest` HTML pertinents. Les `cn()` sont un helper maison de 5 lignes (pas de `clsx`).

### 4.1 `Button` / `IconButton` — nouveaux (`components/ui/Button.tsx`)
```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'success' | 'accent' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;          // défaut 'secondary'
  size?: ButtonSize;                // défaut 'md'
  icon?: IconName;                  // icône à gauche
  iconRight?: IconName;
  kbd?: string;                     // « F10 », « Entrée » → <Kbd> à droite
  loading?: boolean;                // spinner + aria-busy, largeur figée
  block?: boolean;                  // w-full
  pressed?: boolean;                // aria-pressed (bascule « Vue groupée »)
  as?: 'button' | 'a' | typeof Link; to?: string; href?: string;
};
export type IconButtonProps = Omit<ButtonProps, 'icon' | 'children'> & { icon: IconName; label: string; /* aria-label obligatoire */ };
export function Button(props: ButtonProps): JSX.Element;
export function IconButton(props: IconButtonProps): JSX.Element;
export function ButtonGroup({ children, attached }: { children: ReactNode; attached?: boolean }): JSX.Element;
```
Adoptants : tous les écrans (`Ventes`, `Achats`, `Stock`, `Tiers`, `Tresorerie`, `Echeances`, `MouvementsStock`, `Inventaires`, `Referentiels`, `Utilisateurs`, `Statistiques`, `Parametres`, `VenteDetail`, `AchatDetail`, `ClientDetail`, `FournisseurDetail`, `ArticleDetail`, `InventaireDetail`, `VenteEditor`, `AchatEditor`, `Login`, `Diagnostic`, `NotFound`, `Dashboard`), `ErrorBoundary`, `RequireDroit`, `useCrud.rowActions` (→ `IconButton` `edit`/`trash` taille `sm`), `atoms.ExportBtn` (supprimé), `atoms.Pagination`, `Grille.tsx` barre d'outils (`:685-716`), `LignesTable.SelecteurColonnes`, toutes les modales métier, `Backstage.Action` (→ `variant="link"`), `Dialog.DialogButton` (→ `size="xl"`), comptoir (`Comptoir.tsx:420-457` : `variant="success" size="xl"`, tuiles d'outils conservées en composant local `PosToolButton` bâti sur `Button`).

### 4.2 `Icon`, `IconBadge`, `Kbd` — refonte (`components/ui/Icon.tsx`)
```ts
export type IconName = keyof typeof ICONS;   // registre fusionné (icones.tsx + Icon.tsx), noms anglais + alias français typés temporaires
export type IconProps = { name: IconName; size?: 14 | 16 | 18 | 20 | 24 | 32 | 40; strokeWidth?: number; label?: string; className?: string; style?: React.CSSProperties };
export function Icon(p: IconProps): JSX.Element;
export function IconBadge({ name, tone, size }: { name: IconName; tone: Tone; size?: 'sm' | 'md' | 'lg' }): JSX.Element; // pastille soft/text
export function Kbd({ children, tone, size }: { children: ReactNode; tone?: 'line' | 'brand' | 'inverse'; size?: 'sm' | 'md' }): JSX.Element; // inchangé
```
Adoptants : `navigation/icones.tsx` (devient ré-export), `AppShell` (📁 🖥 🔍), `CommandPalette` (🔍, ↵), `Parametres` (☀ 🌙 ✎), `Toast`, `useCrud`, `LignesTable` (✕ ⚙ ⚠), `Grille.tsx` + `Popups.tsx` (✕ ✎ 🗑 ☰ ⬇ ⊞ ⊟ ⏷ ▲ ▼ ▾ ▸), `FormModal`/`Dialog`/`ConfirmDialog` (✕), `atoms` (← → ⬇), `Tresorerie` (⬇ − ＋), `MouvementsStock`, `AvancesPanel`, `ReglerTiersModal`, `ArreteCaisseModal`, `TransfertStockModal`, `BonStockModal`, `FicheStockPanel`, `Diagnostic`, `Dashboard` (KPI), `Login`, `Ruban`/`Backstage`/`ChoixDisposition` (import renommé), comptoir (import renommé uniquement).

### 4.3 Champs — nouveaux (`components/ui/Field.tsx`, `Inputs.tsx`)
```ts
export type FieldProps = { label: ReactNode; htmlFor?: string; required?: boolean; help?: ReactNode; error?: ReactNode; hint?: ReactNode /* à droite du libellé, ex. « F3 » */; span?: number /* grille 12 */; children: ReactNode };
export function Field(p: FieldProps): JSX.Element;                      // gère id, aria-describedby, aria-invalid via contexte
export type InputSize = 'sm' | 'md';
export const TextInput: ForwardRef<HTMLInputElement, InputHTMLAttributes & { size?: InputSize; invalid?: boolean; mono?: boolean; align?: 'left' | 'right'; leading?: IconName; trailing?: ReactNode }>;
export const Select: ForwardRef<HTMLSelectElement, SelectHTMLAttributes & { size?: InputSize; invalid?: boolean; placeholder?: string }>;
export const Textarea: ForwardRef<HTMLTextAreaElement, TextareaHTMLAttributes & { invalid?: boolean }>;
export function Checkbox(p: InputHTMLAttributes & { label: ReactNode; description?: ReactNode }): JSX.Element; // accent-color brand
export function Switch(p: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; size?: 'sm' | 'md' }): JSX.Element; // « Ticket auto », « Masquer les tiers soldés »
export function NumberField(p: NumberEditProps & Omit<FieldProps, 'children'>): JSX.Element;  // enveloppe NumberEdit (inchangé)
export function DateField(p: Omit<FieldProps, 'children'> & { value: string; onChange: (iso: string) => void; min?: string; max?: string }): JSX.Element;
export function DateRangeField(p: { from: string; to: string; onChange: (from: string, to: string) => void; presets?: boolean; label?: string }): JSX.Element; // remplace PeriodPicker
export function SearchField(p: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; width?: number; autoFocus?: boolean; shortcut?: string }): JSX.Element; // remplace SearchInput
export function SegmentedControl<T extends string>(p: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: IconName }[]; size?: 'sm' | 'md'; label: string }): JSX.Element; // thème clair/sombre, vue groupée/détaillée, disposition
```
Adoptants : `FormModal` (rendu des `Field` du schéma — `forms/schemas.ts` inchangé), `Login`, `VenteEditor`/`AchatEditor` (en-tête : client/date/mode/remise/note/délai/montant reçu), `ClientDetail.CreditInitialModal`, `Parametres` (imprimante, compteur, thème → `SegmentedControl`), `Tresorerie` (période, bascule groupée), `Ventes`/`Achats`/`Echeances`/`MouvementsStock`/`Statistiques`/`ClientDetail` (`DateRangeField`), `Stock`/`Tiers`/`Echeances`/`MouvementsStock`/`Statistiques` (`SearchField`), `Tiers.EtatsGrid` (checkbox), `ReglerTiersModal`, `MouvementCaisseModal`, `ArreteCaisseModal`, `BonStockModal`, `TransfertStockModal`, `RetourModal`, `ReglerPieceModal`, `GrouperBLModal`, `DossierSwitcher`, `AgentSwitcher`, `AvancesPanel`, `Utilisateurs`, `Referentiels`, `Popups.FiltreEntete` (input de recherche), `LignesTable` (cellules → `TextInput size="sm" mono align="right"` ou `NumberEdit size="sm"`).

### 4.4 `Card`, `CardHeader`, `DescriptionList`, `TotalsPanel` — nouveaux (`components/ui/Card.tsx`, `Data.tsx`)
```ts
export function Card(p: { children: ReactNode; padding?: 'none' | 'sm' | 'md' | 'lg'; interactive?: boolean; tone?: 'info' | 'warning' | 'danger' | 'success'; as?: 'div' | 'section' | 'article' | typeof Link; to?: string; className?: string }): JSX.Element;
export function CardHeader(p: { title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: IconName }): JSX.Element;
export function DescriptionList(p: { items: { label: ReactNode; value: ReactNode; mono?: boolean }[]; columns?: 1 | 2 | 3; inline?: boolean /* en-tête de pièce */ }): JSX.Element;
export function TotalsPanel(p: { rows: { label: ReactNode; value: number; tone?: 'neg' | 'danger' | 'success'; muted?: boolean }[]; total: { label: ReactNode; value: number; currency?: string }; after?: ReactNode; sticky?: boolean }): JSX.Element; // bandeau hero du net à payer
```
Adoptants : les 42 cartes (`Dashboard`, `Parametres` ×6, `Statistiques.Carte`, `Backstage.Carte`, `VenteDetail`, `ClientDetail`, `Tresorerie.CompteCard` → `Card interactive`, `Login`, `ErrorBoundary`, `NotFound`, `RequireDroit`, `LignesTable`, `LignesComptoir`, `Comptoir` cartes client/récap) ; `VenteDetail.Row`+`VenteEditor.TotRow`+`AchatDetail`/`AchatEditor` → `TotalsPanel` ; `VenteDetail.Field`, `ClientDetail.Head`, `Parametres` coordonnées (`:151-158`), `Backstage` → `DescriptionList`.

### 4.5 `Modal` + `ConfirmDialog` + `FormModal` — refonte (`components/ui/Modal.tsx`)
```ts
export type ModalProps = {
  title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';   // 420 / 560 / 720 / 920 / plein écran (backstage)
  closeOnEscape?: boolean; closeOnOverlay?: boolean; // défaut true / false
  initialFocus?: 'first' | 'none' | React.RefObject<HTMLElement>;
  tone?: 'default' | 'danger' | 'return';        // liseré d'en-tête (mode retour comptoir)
  icon?: IconName; scrollBody?: boolean; id?: string;
};
export function Modal(p: ModalProps): JSX.Element;           // = Dialog actuel généralisé : overlay --overlay, role/aria, piège de focus, Échap, restauration, --shadow-modal, --r-lg, z-modal
export function ModalFooter(p: { children: ReactNode; start?: ReactNode }): JSX.Element; // pied sunken, boutons à droite, zone gauche (aide, kbd)
export function useModalStack(): { depth: number };          // Échap ne ferme que la modale du dessus ; désactive useHotkeys en dessous (déjà le cas via `enabled`)

export type ConfirmDialogProps = {
  title: string; message: ReactNode; confirmLabel: string;   // toujours un verbe : « Supprimer la pièce »
  cancelLabel?: string;                                      // défaut « Conserver » si danger, sinon « Annuler »
  danger?: boolean; loading?: boolean; icon?: IconName;
  onConfirm: () => void; onCancel: () => void;
  requireText?: string;                                      // saisie de confirmation optionnelle (« SUPPRIMER ») pour les cas extrêmes
};
export type FormModalProps = /* inchangé côté données : sections, initial, onSubmit… */ & { size?: ModalProps['size']; submitKbd?: string };
```
Comportements : focus initial sur le bouton **sûr** quand `danger` (Entrée = sûr, l'utilisateur doit atteindre « Supprimer » par Tab ou clic), sinon premier champ ; Entrée dans un champ de `FormModal` = submit ; erreurs de validation **par champ** (`Field error`) + résumé ; `closeOnOverlay=false` par défaut sur les formulaires. `Dialog.tsx` devient `export default Modal` (compatibilité comptoir), `DialogButton` → `Button size="xl"`.
Adoptants : `ConfirmDialog` (17 usages), `FormModal` (4 + `useCrud`), `CommandPalette`, `Backstage` (`size="full"`), les 18 modales métier listées en H4, `ClientDetail.CreditInitialModal`, `Parametres` compteur, `MouvementsStock`, `Inventaires`, `Grille.tsx` formulaire d'édition (`:980-990`), comptoir (`PaiementDialog`, `RemiseDialog`, `VentesJourDialog`, `ImprimerPieceDialog` : import renommé).

### 4.6 États — nouveaux (`components/ui/States.tsx`)
```ts
export function Skeleton(p: { width?: number | string; height?: number | string; rounded?: 'sm' | 'md' | 'full'; lines?: number; className?: string }): JSX.Element; // animate-pulse, désactivé en reduced-motion
export function SkeletonGrid(p: { rows?: number; columns?: number[] /* largeurs relatives */ }): JSX.Element;
export function EmptyState(p: { icon?: IconName; title: ReactNode; description?: ReactNode; action?: ReactNode; size?: 'sm' | 'md' | 'lg'; tone?: 'neutral' | 'return' }): JSX.Element;
export function StatePanel(p: { kind: 'error' | 'forbidden' | 'not-found' | 'offline'; title?: ReactNode; description?: ReactNode; detail?: string /* message technique repliable */; actions?: ReactNode }): JSX.Element;
export function Alert(p: { tone: 'info' | 'success' | 'warning' | 'danger'; title?: ReactNode; children: ReactNode; onClose?: () => void; action?: ReactNode; compact?: boolean; role?: 'alert' | 'status' }): JSX.Element;
export function LoadingOverlay(p: { label?: string }): JSX.Element;    // celui de Grille.tsx:924, extrait
```
Adoptants : `ErrorBoundary`, `NotFound`, `RequireDroit`, `Comptoir.tsx:266` (accès refusé) → `StatePanel` ; `Dashboard` (KPI/cartes → `Skeleton`), `VenteDetail`/`ClientDetail`/`AchatDetail`/`ArticleDetail` (en-tête → `Skeleton`, erreur → `StatePanel kind="error"` avec `refetch`) ; `Grille.tsx:919` et `DataGrid emptyMessage` (string → `EmptyState` via prop `empty?: ReactNode`), `CommandPalette`, `ArticleSearch`/`ClientSearch`/`FournisseurSearch` (« Aucun article ») ; bandeaux d'erreur inline (`VenteEditor.tsx:268`, `FormModal.tsx:350-361`, `Login.tsx:190`, `useCrud.tsx:90`, `VenteEditor.tsx:251` blocage, `AppShell.BandeauAcces`, `Comptoir.tsx:339` hors ligne, `Comptoir.tsx:349` mode retour, `VenteDetail.tsx:178` note avoir) → `Alert`.

### 4.7 `Toast` — refonte (`components/ui/Toast.tsx`, API conservée + extensions)
```ts
type ToastOptions = { title?: string; duration?: number | 'persistent'; action?: { label: string; onClick: () => void }; id?: string };
export type ToastApi = {
  success: (message: string, o?: ToastOptions) => void;   // 3,5 s
  info: (message: string, o?: ToastOptions) => void;      // 4 s
  warning: (message: string, o?: ToastOptions) => void;   // 6 s
  error: (message: string, o?: ToastOptions) => void;     // persistant par défaut
  dismiss: (id: string) => void;
};
```
Rendu : surface `--surface-raised`, bordure gauche 3 px `*-solid`, icône `*-text`, texte `--text`, bouton fermer `IconButton ghost sm`, conteneur `role="region" aria-label="Notifications"`, chaque toast `role="status"` (`aria-live="polite"`) ou `role="alert"` pour `error`, pause au survol/focus, max 3 visibles, `z-toast`. `useToast()` reste compatible (les appels existants ne changent pas).
Adoptants : aucun changement d'appel ; `Comptoir.tsx:195`, `VenteEditor.tsx:169` bénéficient de la persistance et peuvent ajouter `action: { label: 'Ouvrir la pièce' }` (optionnel).

### 4.8 `PageHeader`, `Breadcrumb`, `usePageTitle`, `Tabs` — refonte (`components/ui/Page.tsx`, `Tabs.tsx`)
```ts
export type Crumb = { label: ReactNode; to?: string };
export function PageHeader(p: { title: ReactNode; breadcrumb?: Crumb[]; backTo?: string; backLabel?: string; meta?: ReactNode /* badges, statut, date */; description?: ReactNode; actions?: ReactNode; primary?: ReactNode /* bouton primaire isolé à droite */; children?: ReactNode /* compat */ }): JSX.Element;
export function Breadcrumb(p: { items: Crumb[] }): JSX.Element;      // nav aria-label="Fil d'Ariane", séparateur chevron 14
export function usePageTitle(title: string): void;                   // document.title = `${title} — Gestion Commerciale`
export function Tabs<T extends string>(p: { value: T; onChange: (v: T) => void; options: readonly { code: T; label: ReactNode; count?: number; icon?: IconName; tone?: DocTone }[]; variant?: 'pill' | 'underline'; size?: 'sm' | 'md'; label: string; id?: string }): JSX.Element; // role=tablist/tab, aria-selected, ←/→/Home/End, onglet actif `underline` coloré par tone (documents)
```
Règle d'empilement : vues d'écran (`Documents | Journal`) = `pill` ; sous-filtres (types FA/BL/…) = `underline` (`Ventes.tsx:133,139`, `Achats`, `Stock.tsx:160`, `Tiers.tsx:84`, `ClientDetail.tsx:138`, `Statistiques.tsx:73,199,226,340,356,432`, `MouvementsStock`, `Echeances`, `VenteEditor.tsx:264` type de pièce). Fil d'Ariane construit depuis `navigation/commandes.ts` (`C.ventes.libelle` etc.) : aucune nouvelle source de vérité.
Adoptants : tous les écrans à `PageHeader` (23), `VenteDetail`/`AchatDetail`/`ClientDetail`/`FournisseurDetail`/`ArticleDetail`/`InventaireDetail` (`backTo`, `meta`), `VenteEditor`/`AchatEditor` (`backTo` + bouton « Annuler » secondaire, pas un lien), `Parametres` (`actions` link).

### 4.9 `Badge`, `DocBadge`, `StatusPill`, `StatusDot`, `Money` — refonte (`components/ui/Badge.tsx`, `atoms.tsx` conservé pour l'export)
```ts
export type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'teal' | 'violet' | 'orange';
export function Badge(p: { tone?: Tone; shape?: 'pill' | 'square'; dot?: boolean; icon?: IconName; size?: 'sm' | 'md'; children: ReactNode; title?: string }): JSX.Element;
export function DocBadge(p: { code: string; label?: boolean /* « Facture » au lieu de « FA » */ }): JSX.Element;      // API inchangée
export function StatusPill(p: { tone: 'ok' | 'warn' | 'bad' | 'mut'; children: ReactNode }): JSX.Element;            // API inchangée, rendu via Badge dot
export function PayStatus(p: { regler: number; reste: number }): JSX.Element;                                          // inchangé
export function StatusDot(p: { online: boolean; label?: boolean; onGradient?: boolean }): JSX.Element;                 // AppShell, Ruban, Backstage, Login, Comptoir
export function Money(p: { value: unknown; digits?: number; colorNeg?: boolean; signed?: boolean; currency?: boolean; tone?: 'danger' | 'success' | 'warning' | 'muted'; size?: 'sm' | 'md' | 'lg' }): JSX.Element; // remplace les 20+ <span className="money" style={{color…}}>
```
Adoptants : `Ventes`, `Achats`, `Stock`, `Tiers`, `ClientDetail`, `Tresorerie`, `Echeances`, `Utilisateurs`, `VenteDetail`, `Dashboard`, `Statistiques.MargeCell/Pct`, `ArticleSearch`, `CommandPalette`, `Login` (en ligne/hors ligne), `AppShell`/`Ruban`/`Backstage`/`Comptoir` (`StatusDot`).

### 4.10 `KpiTile`, `BarList` — nouveaux (`components/ui/Kpi.tsx`)
```ts
export function KpiTile(p: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: Tone; delta?: { value: number; label?: string; invert?: boolean }; to?: string; loading?: boolean; locked?: ReactNode /* « Réservé à… » : rendu non interactif, icône cadenas */; size?: 'sm' | 'md' | 'lg' }): JSX.Element;
export function BarList(p: { items: { label: ReactNode; value: number; display?: string; to?: string }[]; max?: number; tone?: Tone }): JSX.Element;
```
Adoptants : `Dashboard.tsx:53-93` (4 KPI), `:107-123` (top familles → `BarList`), `atoms.Bucket` (`Tiers.DebiteursGrid`, `Echeances`), `Statistiques.Kpi`, `Tresorerie.CompteCard` (→ `KpiTile size="sm"` sélectionnable), `Comptoir` récap du jour (optionnel).

### 4.11 `Menu` / `Dropdown`, `Tooltip`, `Popover` — nouveaux (`components/ui/Overlay.tsx`)
```ts
export function Dropdown(p: { trigger: (p: { open: boolean; toggle: () => void; ref: Ref<HTMLElement> }) => ReactNode; items: ({ label: ReactNode; icon?: IconName; kbd?: string; tone?: 'default' | 'danger'; disabled?: boolean; onSelect: () => void } | 'separator')[]; align?: 'start' | 'end'; width?: number }): JSX.Element; // role=menu, ↑/↓/Entrée/Échap, fermeture clic extérieur (reprend Popups.Flottant)
export function Popover(p: { anchor: DOMRect | HTMLElement; onClose: () => void; width?: number; children: ReactNode }): JSX.Element; // = Popups.Flottant promu, z-popover
export function Tooltip(p: { content: ReactNode; kbd?: string; delay?: number; children: ReactElement }): JSX.Element; // role=tooltip, z-tooltip ; reprend Ruban.InfoBulle
```
Adoptants : `TransformerMenu` (boutons « → Facture » → `Dropdown` « Transformer en… »), `LignesTable.SelecteurColonnes`, `Grille.tsx` menus d'en-tête/export/colonnes (`Popups.tsx` devient un consommateur de `Popover`), `VenteDetail` actions secondaires (Imprimer / Ticket / Dupliquer regroupables), `Ruban.InfoBulle` (optionnel, le ruban peut garder le sien), boutons `IconButton` (info-bulle = `label`).

### 4.12 `DataGrid` — ajustements d'API (sans toucher au moteur)
```ts
// components/ui/DataGrid.tsx — props ajoutées, toutes optionnelles
density?: 'compact' | 'comfortable';   // → hauteurLigne 32 / 40 via jetons
empty?: ReactNode;                       // EmptyState riche (sinon emptyMessage)
skeletonRows?: number;                   // premier chargement sans données
toolbarActions?: ReactNode;              // = actions (alias clair)
```
Dans `components/grille/Grille.tsx`, seules les classes/`style` changent (en-têtes `text-xs --text-label`, fond sélection `--surface-active`, survol `--surface-hover`, boutons de barre → `Button size="sm"`/`IconButton`, glyphes → `Icon`, overlay de chargement → `LoadingOverlay`). `moteur.ts`, `useEtatGrille.ts`, `useSourceDistante.ts`, `exportGrille.ts`, `types.ts` : inchangés.

### 4.13 Vitrine `screens/DemoUI.tsx` (route `/outils/ui`, même droit que `/outils/grille`)
Page interne listant chaque composant dans ses variantes, en clair et en sombre (bascule locale), avec les raccourcis. Sert de recette visuelle à chaque lot et de documentation vivante. Ajoutée au registre `C.ui` sous « Configuration › Outils » (le test `navigation.test.ts` exige un `id` unique et un `to`, c'est le cas).

---

## 5. Plan d'exécution par lots

Contraintes transverses : aucun changement dans `api/`, `store/`, `lib/droits.ts`, `lib/timbre.ts`, `forms/schemas.ts` (données), `components/grille/moteur.ts`, `impression/`, `print/`, `screens/comptoir/comptoirCalc.ts`, `comptoirStore.ts`, `useHotkeys.ts`. Chaque lot est livrable seul, `npm run typecheck` + `npm test` verts, recette manuelle clair + sombre + clavier.

### Lot 0 — Garde-fous et vitrine (½ j)
- Ajouter `screens/DemoUI.tsx` (vide au départ) + commande `C.ui`.
- Script `scripts/ui-lint.mjs` (Node, sans dépendance) exécuté dans `npm test` : interdit dans `app/src` hors `print/`, `impression/`, `styles/` : hex `#RRGGBB`, `text-[Npx]` (sauf `text-pos`), `rgb(15 26 46`, `surface-alt`, emoji/glyphes listés §2.5, `fixed inset-0` hors `components/ui/Modal.tsx`/`Overlay.tsx`/`Toast.tsx`. Démarre en mode « rapport » (compte les occurrences), passe en mode « bloquant » à la fin du lot 6.
- **Risque** : aucun (outillage).

### Lot 1 — Fondations : jetons et configuration (1 j)
- `styles/tokens.css` v2 (§2.1–2.2) : nouveaux jetons + alias des anciens ; bloc `[data-theme="dark"]` complété (`brand-50/100/300`, `*-soft/line/text`, `overlay`, `surface-hover/active`, `chart-*`). `--text-muted` passe à `#5F6D87`.
- `tailwind.config.js` v2 (§2.10) : `fontSize`, `colors` étendues, `zIndex`, `transitionDuration`, `height.control-*`, `borderRadius.xs/xl`. **Tous les noms existants restent** (`ink`, `line`, `brand-700`, `shadow-*`, `rounded-sm/md/lg`) car `packages/report/src` est compilé avec cette config (`tailwind.config.js:6`) et utilise `text-ink-muted`, `border-line`, `rounded-md`, `shadow-lifted`, `bg-brand-700`.
- `styles/index.css` : focus ring v2, `prefers-reduced-motion`, `::placeholder`, `--ruban-accent` → alias de `--brand-text`.
- `styles/report-theme.css` : inchangé (les variables qu'il lit existent toujours).
- Correctifs immédiats sans composant : `hover:bg-surface-alt` → `hover:bg-hover` (`atoms.tsx:128`, `LignesTable.tsx:173,180`) ; `Ruban.tsx:230` → `var(--status-online/offline)` ; `VenteEditor.tsx:368`/`AchatEditor.tsx:295` → `text-gold-ink` ; `charts/palette.ts` → lit `--chart-*` via `getComputedStyle` ou expose les jetons (les graphiques SVG acceptent `var(--chart-1)` directement en `fill`).
- **Recette** : capture clair/sombre des 10 écrans principaux avant/après ; vérifier que l'assombrissement de `--text-muted` et le nouveau `--text-placeholder` n'ont pas inversé des hiérarchies ; `/modeles` (paquet report) inchangé visuellement.
- **Risques** : (a) `packages/report` possède sa propre `tailwind.config.cjs` pour sa `dist/report.css`, mais ses classes sont *aussi* générées par la config de l'app → ne jamais retirer une clé de couleur ; (b) passage de `fontSize` : aucun `text-sm`… par défaut n'est utilisé (vérifié), donc pas de régression ; (c) `applyTheme` écrit `data-theme` sur `<html>` (`Parametres.tsx:15-24`) : conserver le sélecteur.

### Lot 2 — Primitives (2 j)
- `Icon.tsx` fusionné (+ `IconBadge`, `Kbd`), `icones.tsx` → ré-export avec adaptateur ; `Button.tsx` ; `Field.tsx` + `Inputs.tsx` (dont `DateRangeField`, `SearchField`, `SegmentedControl`) ; `Card.tsx` ; `Badge.tsx` (+ `DocBadge`, `StatusPill`, `StatusDot`, `Money` re-exportés depuis `atoms.tsx` pour ne pas casser les imports) ; `Data.tsx` (`DescriptionList`, `TotalsPanel`) ; `Kpi.tsx`.
- Remplir `DemoUI`.
- **Recette** : vitrine clair/sombre, navigation Tab complète, zoom 125 % et 150 % Windows (trait d'icône, hauteurs de contrôle).
- **Risques** : `atoms.tsx` est importé par 20 écrans → garder tous ses exports (même signature) ; `NumberEdit` n'est pas modifié (le comptoir en dépend pour `size="pos" | "montant"`).

### Lot 3 — Modales, feedback, états (2 j)
- `Modal.tsx` (ex-`Dialog`, `Dialog.tsx` devient un ré-export) ; `ConfirmDialog` et `FormModal` réécrits sur `Modal` (API conservée + `cancelLabel`, erreurs par champ) ; `Toast` v2 ; `States.tsx` ; `Overlay.tsx` (`Popover`, `Dropdown`, `Tooltip`) ; `Popups.Flottant` → `Popover`.
- `ErrorBoundary`, `NotFound`, `RequireDroit`, `CommandPalette` (modale + `role="listbox"`), `Backstage` (`Modal size="full"`, titres `text-2xl font-extrabold`), `useCrud` (`IconButton`, `Alert`).
- Libellés : `cancelLabel` par défaut « Conserver » sur `danger` ; relire `Tresorerie.tsx:203-210`, `Comptoir.tsx:482-497`, `VenteDetail.tsx:140-145`, `TransformerMenu`, `useCrud.tsx:110-115`.
- **Recette** : pour chacune des 17 confirmations et 4 formulaires : ouverture → focus, Tab cyclique, Échap, Entrée, clic overlay ; lecteur d'écran (NVDA) annonce titre et toasts.
- **Risques** : `PaiementDialog`/`RemiseDialog`/`VentesJourDialog` importent `Dialog` par défaut et `DialogButton` → conserver ces exports (alias) ; les hotkeys du comptoir sont désactivées quand `dialogue !== null` (`Comptoir.tsx:263`) : le `Modal` ne doit **pas** stopper la propagation d'Échap lorsque `closeOnEscape=false` (sinon `focusScan` ne reçoit plus Échap) ; `ConfirmDialog` ne ferme plus au clic overlay quand `danger` → vérifier qu'aucun flux ne s'en servait comme « annuler ».

### Lot 4 — Coquille et navigation (1,5 j)
- `AppShell.tsx` : `<nav aria-label="Navigation principale">`, `Icon`, bloc dossier/utilisateur en `Card padding="sm"` avec `IconButton`, « Changer d'utilisateur » → « Se déconnecter » (icône `logout`), recherche d'en-tête → `SearchField`-like bouton avec `Kbd`, `StatusDot`, bandeau d'accès → `Alert tone="danger" role="alert"`.
- `PageHeader` v2 + `Breadcrumb` + `usePageTitle` (`Page.tsx`), `Tabs` v2 (`Tabs.tsx`, `atoms.Tabs` ré-exporté).
- `Ruban.tsx` : import `Icon`, `--brand-text`, `InfoBulle` → `Tooltip` (optionnel), tailles via échelle ; `ChoixDisposition` : `Card interactive` + `role="radio"` conservé.
- **Recette** : `navigation.test.ts` inchangé et vert (le registre n'est pas touché) ; touches d'accès Alt du ruban ; mode latéral et ruban en clair/sombre ; `document.title` sur 5 écrans.
- **Risques** : ne pas renommer les `id`/`libelle`/`touche` de `commandes.ts` (tests) ; les `NomIcone` référencés dans `commandes.ts` doivent rester valides (alias dans le registre fusionné).

### Lot 5 — Écrans de liste (2,5 j)
`Ventes`, `Achats`, `JournalVentes`, `Stock`, `Tiers` (4 grilles + `RecouvrementPanel`), `Echeances`, `MouvementsStock`, `Inventaires`, `Referentiels`, `Utilisateurs`, `Tresorerie`, `Statistiques`, `PeremptionPanel`, `Etat104Panel`, `FicheStockPanel`.
- Remplacements mécaniques : boutons → `Button` (1 `primary` par écran, destructif → `danger`), `PeriodPicker` → `DateRangeField`, `SearchInput` → `SearchField`, `Bucket/Kpi/CompteCard` → `KpiTile`, cartes → `Card`, `Tabs` empilés → `pill` + `underline`, `ExportBtn` → `Button icon="download"` « Exporter », colonnes de montant → `Money tone`, `StatusPill` conservé.
- `DataGrid` : `density`, `empty` (EmptyState avec action « Nouvelle pièce » quand le droit le permet), `skeletonRows`.
- **Recette** : chaque écran en 1366 × 768 (poste pharmacie) et 1920 × 1080, clair/sombre ; tri/filtre/groupe/export de la grille inchangés (moteur intact) ; `cleEtat` des grilles inchangées (dispositions mémorisées en `localStorage` conservées).
- **Risques** : `Statistiques.tsx` (625 l.) : les `Tabs` imbriqués servent de contrôle de groupement dans `actions` de `Carte` → garder `size="sm"` ; `Tresorerie` : le bouton `aria-pressed` « Vue groupée » → `Button pressed`.

### Lot 6 — Détails, éditeurs, modales métier (3 j)
- `VenteDetail`/`AchatDetail` : `PageHeader` (`backTo`, `meta` = `DocBadge` + `PayStatus` + date), actions secondaires regroupées (`Dropdown` « Plus »), `Supprimer` en `Button variant="danger"` isolé, en-tête → `DescriptionList inline`, totaux → `TotalsPanel`, `LiensPiece`/`ReglementsPiece` → `Card`.
- `VenteEditor`/`AchatEditor` : en-tête → `Field` ×4, `LignesTable` (cellules `TextInput size="sm"`/`NumberEdit size="sm"`, `IconButton trash`, sélecteur de colonnes → `Dropdown`), panneau → `TotalsPanel` + `Field` montant reçu (`NumberField`), boutons `primary` / `accent kbd="F10"`. Les raccourcis F2/F3 continuent de viser les placeholders existants (`VenteEditor.tsx:212-214`) : **conserver les placeholders « Article… » / « Client… »** ; option hors périmètre strict : ajouter `data-hotkey="article|client"` et faire chercher cet attribut (changement de 2 lignes, à décider).
- `ClientDetail`/`FournisseurDetail`/`ArticleDetail`/`InventaireDetail` : en-tête `Card` + `DescriptionList`, `KpiTile` solde, `Tabs underline`, `CreditInitialModal` → `Modal`.
- Modales métier (18) : enveloppe `Modal` + `Field`/`Button`, contenu et mutations intacts.
- `Parametres` : sections → `Card`+`CardHeader`, thème → `SegmentedControl` avec `Icon sun/moon`, compteur → `Modal` + `NumberField`, coordonnées → `DescriptionList`.
- **Recette** : création/modification/duplication d'une FA et d'un BR de bout en bout, règlement, retour, transformation, impression (aperçu et modèle) ; `enLettres`, `timbre`, `lignesDocument`, `venteModeles`, `impression-modeles` tests verts (non concernés mais exécutés).
- **Risques** : `LignesTable` a une config de colonnes persistée (`useColonnesConfig`) → ne pas changer les `ColonneId` ; `RetourModal`/`GrouperBLModal` ont des listes à cases à cocher → `Checkbox` doit rester un `input` natif contrôlé ; `ImprimerDocument`/`PrintPreview` (iframe isolée) ne doivent pas hériter du `Modal` (leur CSS est volontairement séparée).

### Lot 7 — Tableau de bord, login, grille (1,5 j)
- `Dashboard` : hero conservé (erreur sortie du hero → `Alert`), 4 `KpiTile` avec icônes tonales et `loading` → `Skeleton`, CA par jour → `components/charts/BarChart` existant (axes, valeurs), top familles → `BarList`, raccourcis « Nouvelle facture / Comptoir » en `Button` si droits.
- `Login` : `Card`, `Field` + `autocomplete`, bouton œil, `Stepper` simple (3 points nommés), agents → `Card interactive` + `StatusDot`.
- `Grille.tsx` : cosmétique uniquement (§4.12), `Popups.tsx` sur `Popover`.
- **Recette** : `grille.test.ts` (moteur) et `DemoGrille` : toutes les fonctionnalités (édition cellule/ligne/lot, groupes, bandes, colonnes figées, export) ; `Dashboard` avec droits restreints (`voitCaisse=false`) → `KpiTile locked`.
- **Risques** : la grille utilise `color-mix` pour l'alternance et les groupes (`Grille.tsx:477,599`) → remplacer par jetons sans changer la structure DOM (sticky/colgroup) ; l'export PDF (`exportGrille.ts:105`) garde son hex (document imprimé, hors UI).

### Lot 8 — Alignement du comptoir (1 j, dernier, QA caisse obligatoire)
- Imports `Icon`/`Kbd`/`Modal`/`Button size="xl"` ; `--pos-*` → alias (aucune valeur changée) ; `secondaire` inline → `text-ink-muted` ; rayons `rounded-[9px|10px|11px|14px]` → `rounded-md`/`rounded-lg` **uniquement** si la maquette le tolère (sinon conserver : la maquette prime) ; `text-[50px]` → `text-pos`.
- **Recette** : scénario complet au clavier (F6 scan → quantité +/− → F7 → F8 → F2 → Entrée → F9 → F10 → F4 → Ctrl+1…5), mode retour, agent hors ligne, impression silencieuse ; `comptoir.test.ts` vert.
- **Risques** : `useHotkeys` écoute `window` et est désactivé par `dialogue === null && apercu === null` → tout nouveau `Modal` du comptoir doit passer par `setDialogue` ; `ChampScan` stoppe la propagation d'Échap/flèches (`ChampScan.tsx:81-84`) → `Modal` ne doit pas capturer en phase de capture.

### Risques de régression transverses (tableau de surveillance)
| Zone | Risque | Garde |
|---|---|---|
| `app/src/__tests__/navigation.test.ts` | renommage d'id/libellé/touche dans `commandes.ts` | registre non modifié ; ajout `C.ui` seulement |
| `grille.test.ts`, `lignesDocument.test.ts`, `comptoir.test.ts`, `timbre.test.ts`, `format.test.ts`, `enLettres.test.ts` | aucun (fonctions pures non touchées) | exécuter à chaque lot |
| `impression-modeles.test.ts`, `venteModeles.test.ts` | aucun (`print/`, `impression/` exclus) | exclure ces dossiers du lint UI |
| `app/e2e/flux-critiques.mjs` | aucun : le script attaque GraphQL directement, sans sélecteur d'UI | — |
| `packages/report` | suppression d'un nom de couleur/rayon/ombre Tailwind ou d'une variable `--*` lue par `report-theme.css` | lot 1 : alias, jamais de suppression ; vérifier `/modeles` |
| Thème sombre | nouveaux jetons oubliés dans `[data-theme="dark"]` | lint : chaque `--x` déclaré en `:root` doit l'être aussi en sombre sauf liste blanche |
| Dispositions mémorisées (`gc.grille.<cleEtat>`, `useColonnesConfig`, `usePreferencesNavigation`) | changement de clés | aucune clé modifiée |
| Comptoir plein écran | capture d'événements clavier par les nouveaux overlays | `Modal` écoute en bouillonnement ; QA caisse en lot 8 |
| Hotkeys `VenteEditor`/`AchatEditor` (F2/F3 par placeholder) | changement de placeholder | placeholders conservés (ou `data-hotkey`, décision explicite) |
| Zoom Windows 125 % | hauteurs fixes en px | contrôles en `height` jetonisée, test à 125/150 % |

### Estimation
≈ 15 jours-homme de développement + 3 jours de recette (clair/sombre/clavier), répartis sur 8 lots indépendants et réversibles (chaque lot = une PR ; le lint du lot 0 mesure la progression : objectif 0 hex, 0 `text-[Npx]`, 0 emoji, 0 overlay maison hors `components/ui`).

---

## Annexe A — Correspondance des tailles arbitraires
| Actuel | Occurrences | Cible |
|---|---|---|
| `text-[9px]`, `[9.5px]`, `[10px]` | 44 | `text-2xs` |
| `[10.5px]`, `[11px]`, `[11.5px]` | 287 | `text-xs` |
| `[12px]`, `[12.5px]` | 300 | `text-sm` |
| `[13px]` | 42 | `text-base` |
| `[14px]` | 20 | `text-md` |
| `[15px]`, `[16px]`, `[17px]` | 49 | `text-lg` |
| `[18px]`, `[19px]` | 27 | `text-xl` |
| `[20px]` | 3 | `text-2xl` |
| `[26px]`, `[28px]` | 4 | `text-3xl` |
| `[30px]`, `[32px]`, `[34px]` | 4 | `text-display` |
| `[50px]` | 1 | `text-pos` |

## Annexe B — Correspondance glyphes → icônes
📁 `folder` · 🖥 `server` · 🔍 `search` · ✕ `close` (ou `trash` pour supprimer une ligne) · ✓ `check` · ⚠ `alert-triangle` · ℹ `info` · ✎ `edit` · 🗑 `trash` · ⬇ `download` · ⚙ `settings` (sélecteur de colonnes : `columns`) · ☰ `columns` · ☀ `sun` · 🌙 `moon` · ＋ `plus` · − `minus` · ← `arrow-left` · → `arrow-right` (ou `chevron-right` dans un fil d'Ariane) · ↵ `Kbd Entrée` · ▲▼ `chevron-up/down` · ▾▸ `chevron-down/right` · ⏷ `filter` · ⊞⊟ `expand-all/collapse-all` · ↺ `refresh` · ⇄ `movements`.

## Annexe C — Table de contraste des jetons v2 (extraits vérifiés)
| Paire | Clair | Sombre |
|---|---|---|
| `--text-muted` / surface | 5,40 | 5,55 |
| `--text-muted` / bg | 4,91 | 5,99 |
| `--success-text` / surface · / soft | 5,02 · 4,53 | 9,95 · 8,67 |
| `--warning-text` / surface · / soft | 5,02 · 4,57 | 10,39 · 9,21 |
| `--danger-text` / surface · / soft | 6,47 · 5,63 | 6,27 · 6,09 |
| `--info-text` / surface · / soft | 5,36 · 4,75 | 9,60 · 8,31 |
| `--teal-text` / surface · / soft | 5,47 · 4,93 | 9,32 · 8,17 |
| `--violet-text` / surface · / soft | 7,10 · 6,10 | 6,37 · 6,06 |
| `--orange-text` / surface · / soft | 5,18 · 4,64 | 7,66 · 7,14 |
| `--brand-text` / surface · / brand-soft | 6,37 · 5,73 | 6,46 · 5,87 |
| inverse / `--brand-700` · `--success-solid` · `--danger-solid` · `--warning-solid` | 6,37 · 5,02 · 4,83 · 5,02 | idem |
| `--gold-ink` / `--gold-400` | 7,88 | 7,88 |

## Annexe D — Check-list de recette par lot
1. `npm run typecheck`, `npm test`, `node scripts/ui-lint.mjs` (rapport).
2. Clair et sombre : captures des écrans touchés, vérification visuelle des badges/statuts/liens.
3. Clavier : Tab/Shift+Tab sur tout l'écran, focus visible, Échap/Entrée dans chaque modale, raccourcis F affichés et fonctionnels.
4. Zoom 125 % Windows et fenêtre 1366 × 768 : pas de débordement horizontal, barres d'actions qui replient (`flex-wrap`).
5. Lecteur d'écran (NVDA) : titre d'écran annoncé, modales annoncées, toasts lus, onglets annoncés « onglet 2 sur 5 ».
6. Non-régression métier : un flux complet par module (vente, achat, stock, tiers, trésorerie, comptoir), impression d'une pièce et d'un ticket.
