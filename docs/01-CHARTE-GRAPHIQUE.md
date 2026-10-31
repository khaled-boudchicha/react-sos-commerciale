# Charte graphique & expérience utilisateur — v2

> App desktop (Electron + React) de gestion commerciale, connectée à `sos-cloud-server` → agent PC.
> **v2 (31/10/2026)** : la charte v1 (identité bleu roi + or, Plus Jakarta Sans + JetBrains Mono) est conservée et
> **incarnée dans une bibliothèque de composants** (`app/src/components/ui/`). L'analyse critique qui a motivé la
> refonte est archivée dans [09-ANALYSE-UI-UX.md](09-ANALYSE-UI-UX.md).
>
> **Sources de vérité :** les jetons sont dans `app/src/styles/tokens.css`, leur exposition Tailwind dans `app/tailwind.config.js`
> et les composants dans `app/src/components/ui/`.
> **Vitrine vivante :** l'écran *Configuration › Outils › Charte graphique* (route `/outils/ui`) montre chaque composant en clair et en sombre.

---

## 1. Principes

1. **Outil de travail pro** : froid, précis, dense. L'application est utilisée 8 h par jour, ce n'est pas une app grand public.
2. **Le clavier d'abord** : héritage Delphi (touches F, Ctrl+K, Alt pour le ruban). Chaque raccourci est affiché sur son bouton (`kbd`) et listé dans l'aide (Ctrl+/).
3. **Source unique** : zéro valeur hexadécimale, zéro taille arbitraire, zéro voile de modale fait main en dehors de `styles/tokens.css` et `components/ui/`.
4. **Clair par défaut, sombre complet** : chaque jeton a sa valeur en mode sombre.
5. **Accessibilité AA** : texte ≥ 4,5:1, composants ≥ 3:1, focus toujours visible, cibles ≥ 24 px.
6. **Couleurs de documents stables** : FA, BL, BC, FP, avoir, achat et règlement gardent la même teinte partout (badge, onglet, en-tête).

## 2. Couleurs

### 2.1 Marque
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--brand-700` | `#2450E0` | `#2450E0` | **primaire** : boutons pleins, indicateur de navigation |
| `--brand-900` | `#1E3FB5` | `#1E3FB5` | survol / pressé du primaire |
| `--brand-text` | `#2450E0` | `#7C9BF2` | liens, texte et icônes de marque sur surface |
| `--brand-soft` | `#EEF3FE` | `#17223D` | fond d'élément actif ou sélectionné |
| `--brand-line` | `#7C9BF2` | `#4F6ECB` | bordure d'élément sélectionné ou survolé |
| `--gradient-hero` | `#3B66F5 → #2450E0 → #1E3FB5` | idem | bandeaux (tableau de bord, connexion, ruban, net à payer) |
| `--gold-400` / `--gold-text` | `#F6B93B` / `#8A5A00` | `#F6B93B` / `#F6B93B` | accent identitaire (jamais un statut) |

### 2.2 Neutres et surfaces
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--bg` | `#F6F8FC` | `#0B1220` | fond de l'application |
| `--surface` | `#FFFFFF` | `#111A2E` | cartes, grilles, champs |
| `--surface-raised` | `#FFFFFF` | `#16213A` | modales, menus, popovers |
| `--surface-sunken` | `#FBFCFE` | `#0E1627` | pieds de modale, champs désactivés |
| `--surface-hover` / `--surface-active` | `#F3F6FB` / `#EEF3FE` | `#182338` / `#17223D` | survol / sélection |
| `--line-soft` / `--line` / `--line-strong` | `#EDF1F8` / `#C9D3E4` / `#9AA9C2` | `#1C2942` / `#31415F` / `#4A5B7D` | séparateurs / bordures / bordures au survol |
| `--text` / `--text-label` / `--text-muted` | `#0F1A2E` / `#42536F` / **`#5F6D87`** | `#E9EEF7` / `#B7C3D9` / `#8093B0` | corps / libellés / texte secondaire (AA) |
| `--text-placeholder` | `#8A96AD` | `#6B7D9C` | placeholders uniquement |
| `--overlay` | `rgb(8 20 40 / .5)` | `rgb(0 0 0 / .62)` | voile des modales |

### 2.3 Sémantiques : quatre rôles par couleur
Chaque famille (`success`, `warning`, `danger`, `info`, `teal`, `violet`, `orange`, `neutral`) expose quatre rôles :
- **`*-solid`** : aplat sous texte blanc (bouton, barre de toast) ;
- **`*-text`** : texte ou icône sur surface ou sur `*-soft` (≥ 4,5:1 dans les deux thèmes) ;
- **`*-soft`** : fond doux (badge, bandeau, pastille d'icône) ;
- **`*-line`** : bordure.

En Tailwind : `text-danger-text`, `bg-success-soft`, `border-warning-line`, `bg-danger-solid`… En style inline : `var(--danger-text)`.
Les anciens noms `--success`, `--warning`, `--danger`, `--info`, `--teal`, `--violet` et `--orange` restent des **alias d'aplat**, lus par `@softly/report` et les graphiques. **Ils ne doivent plus servir de couleur de texte.**

| Sens | Couleur | Exemples |
|---|---|---|
| Acquis, payé, connecté | success | Payée, Stock OK, Encaisser |
| Attention, action attendue | warning | Partiel, Stock bas, 30–60 jours |
| Perte, danger, irréversible | danger | Impayée, Rupture, Supprimer, Hors ligne |
| Information | info | aides, états neutres informatifs |
| Navigation, action | brand | liens, sélection, primaire |

### 2.4 Documents
FA → brand · BL / BCT → teal · BC / DO → violet · FP → neutral · FAV / BRT → danger · BR → orange · Règlement → success.
Une seule source : `DOC_TONE` dans `components/ui/atoms.tsx`, utilisée par `DocBadge` et par les onglets `Tabs variant="underline"`.

### 2.5 Autres jetons
- `--status-online` / `--status-offline` : pastille de connexion de l'agent.
- `--chart-1…6`, `--chart-neutral` : séries de graphiques.
- `--focus-ring` : `0 0 0 2px surface, 0 0 0 4px brand-500` (sombre : `brand-300`).
- Comptoir : `--pos-*` sont des alias des sémantiques v2 ; seul le mode retour garde sa gamme (`--pos-return*`).

## 3. Typographie

Polices : **Plus Jakarta Sans** pour l'interface, **JetBrains Mono** (chiffres tabulaires, classe `.money`) pour les montants, codes et quantités.

| Classe | Taille / interligne | Rôle |
|---|---|---|
| `text-2xs` | 10 / 14 | surtitres en capitales, badges, touches |
| `text-xs` | 11 / 16 | libellés de champ, sous-textes, aides |
| `text-sm` | 12 / 18 | cellules de grille, formulaires denses, boutons `sm` |
| `text-base` | 13 / 20 | **corps**, boutons `md`, champs |
| `text-md` | 14 / 20 | boutons `lg`, valeurs mises en avant |
| `text-lg` | 16 / 22 | titres de carte / section |
| `text-xl` | 18 / 24 | titres de modale, KPI secondaires |
| `text-2xl` | 20 / 26 | **titre d'écran** |
| `text-3xl` | 26 / 30 | KPI principal |
| `text-display` | 32 / 36 | montant hero / encaissement |
| `text-pos` | 50 / 52 | net à payer du comptoir |

Règles :
- jamais en dessous de `text-2xs` ;
- capitales seulement en `2xs` / `xs` ;
- `font-light` interdit ;
- montants alignés à droite en `.money`, format `1 234 567,89 DA`, négatifs en `--danger-text`.

## 4. Espacement, rayons, ombres, couches, mouvement

- **Espacement** sur une grille de 4 px : 4 / 8 / 12 / 16 / 20 / 24 / 32.
- **Rayons** : `rounded-xs` 4 (touches), `rounded-sm` 6 (champs, petits boutons), `rounded-md` 10 (boutons, cartes), `rounded-lg` 16 (modales, bandeaux), `rounded-full` (badges, pastilles).
- **Ombres** : `shadow-soft` (cartes), `shadow-card` (survol), `shadow-lifted` (menus, toasts), `shadow-modal` (modales). En sombre, les cartes n'ont pas d'ombre et c'est la bordure qui délimite.
- **Couches** : `z-sticky` 20 · `z-dropdown` 30 · `z-ribbon` 35 · `z-modal` 50 · `z-popover` 60 · `z-backstage` 70 · `z-tooltip` 80 · `z-toast` 100.
- **Hauteurs de contrôle** : `h-control-sm` 28 · `md` 34 · `lg` 40 · `xl` 48.
- **Mouvement** : `duration-fast` 100 ms, défaut 150 ms, `slow` 250 ms ; animations `animate-fade-in`, `pop-in`, `slide-in`, `shimmer`.
  `prefers-reduced-motion` coupe tout. Aucune animation dans les grilles de données.

## 5. Iconographie

- **Un seul jeu** : `components/ui/Icon.tsx`, en tracés SVG 24 × 24 au trait arrondi qui héritent de la couleur du texte, sans dépendance externe. Noms en anglais (`search`, `plus`, `edit`, `trash`, `download`, `printer`, `invoice`, `wallet`…). Les noms français historiques restent des alias, et `navigation/icones.tsx` est un simple adaptateur.
- **Tailles** : 14 / 16 / 18 / 20 / 24 px, 32–40 px pour les états vides.
- **Trait** : 2 jusqu'à 16 px, 1,75 au-delà.
- **Pastille tonale** `IconBadge` (fond `*-soft`, icône `*-text`) pour les KPI, les états vides et les en-têtes.
- **Interdits** : les emoji et les glyphes typographiques (✕ ✓ ⚠ ✎ ⬇ 🔍 📁 ← → ＋ − ☰ ⚙ 🗑) dans les boutons, info-bulles et badges.

## 6. Composants (`app/src/components/ui/`, point d'entrée `index.ts`)

| Composant | Rôle | Points clés |
|---|---|---|
| `Button` | toutes les actions | variantes `primary`, `secondary` (défaut), `ghost`, `danger`, `danger-solid`, `success`, `accent`, `link` ; tailles `xs` à `xl` ; `icon`, `iconRight`, `kbd`, `loading`, `pressed`, `to` |
| `IconButton` | action à icône seule | `label` obligatoire (nom accessible + info-bulle) ; `tone="danger"` pour les corbeilles |
| `Menu` | actions secondaires regroupées | `role=menu`, ↑ ↓ Début Fin Entrée Échap |
| `Field` + `TextInput` / `Select` / `Textarea` / `Checkbox` / `Switch` | formulaires | libellé au-dessus, requis `*`, `error` / `help` reliés par ARIA |
| `SearchField`, `DateRangeField`, `SegmentedControl` | filtres | loupe + effacement (Échap) ; période avec raccourcis (Aujourd'hui, Ce mois…) |
| `Card`, `CardHeader`, `SectionTitle` | conteneurs | une seule recette de carte ; `to` / `onClick` la rendent interactive |
| `DescriptionList`, `TotalsPanel` | données | fiches, en-têtes de pièce ; HT / TVA / timbre → net à payer |
| `KpiTile`, `BarList` | indicateurs | icône tonale, squelette, état verrouillé selon les droits, lien |
| `Badge`, `DocBadge`, `StatusPill`, `PayStatus`, `StatusDot`, `Money` | statuts et montants | contraste AA garanti |
| `Tabs` | onglets | `pill` (vues) ou `underline` (sous-filtres teintés) ; clavier ← → Début Fin |
| `PageHeader`, `Breadcrumb`, `usePageTitle`, `Toolbar` | gabarit d'écran | fil d'Ariane, bouton retour, méta (badges), actions ; titre de fenêtre synchronisé |
| `Dialog` (= `Modal`), `ConfirmDialog`, `FormModal`, `KeyHints` | modales | coquille unique : voile thémé, piège de focus, Échap, focus restauré ; confirmation destructive : focus sur le bouton **sûr**, « Conserver » par défaut |
| `Skeleton`, `Loading`, `LoadingOverlay`, `EmptyState`, `StatePanel`, `Alert` | états | chargement, vide actionnable, erreur, accès refusé, page introuvable |
| `useToast` | notifications | `success`, `info`, `warning`, `error` ; annoncées (`aria-live`) ; pause au survol ; erreurs longues |

### Gabarits d'écran
- **Liste** : `PageHeader` (titre et **une** action primaire) → `Toolbar` (période, recherche, onglets) → `DataGrid` (états vide, chargement et erreur intégrés).
- **Détail** : `PageHeader backTo breadcrumb meta` → `Card` + `DescriptionList` → lignes → `TotalsPanel` ; actions secondaires dans un `Menu`, `Supprimer` isolé en `danger`.
- **Éditeur** : même en-tête, champs `Field`, lignes, `TotalsPanel`, enregistrement `primary` + `accent kbd="F10"`.
- **Modale** : `Dialog` → corps `Field` → pied `KeyHints` + `Annuler` + action primaire.

## 7. Principes d'expérience utilisateur

1. **Le clavier d'abord** : chaque action a un chemin clavier. Les touches F sont affichées sur les boutons. Échap ferme, Entrée valide. L'aide aux raccourcis s'ouvre avec Ctrl+/.
2. **Un focus toujours visible et jamais perdu** : à l'ouverture d'une modale, il va au premier champ, ou au bouton sûr pour une confirmation. À la fermeture, il revient à l'élément d'origine.
3. **Une action primaire par écran**, en haut à droite, avec son raccourci. Le destructif est isolé ou placé dans un menu.
4. **Dire où l'on est** : fil d'Ariane, titre `text-2xl`, méta (type de pièce + statut), titre de fenêtre synchronisé, élément de navigation actif marqué d'un liseré.
5. **Dire ce qui se passe** : squelette au premier chargement, voile au rafraîchissement, bouton `loading`, toast bref pour un succès, erreur persistante avec sa cause et une action (Réessayer).
6. **Les états vides sont des pages** : une icône, une explication et, si possible, une action.
7. **Une densité assumée mais lisible** : lignes de 32–34 px, corps à 13 px, jamais de texte sous 10 px, contraste AA partout.
8. **La couleur a un sens unique** : rouge pour une perte, ambre pour l'attention, vert pour l'acquis, bleu pour l'action, or pour l'identité.
9. **Confirmer le destructif, jamais l'ordinaire** : le bouton nomme l'action (« Supprimer la pièce ») et le message décrit la conséquence.
10. **Pas de surprise à la souris** : un clic sur le voile ne ferme pas une saisie en cours.
11. **Même geste, même rendu** : exporter, imprimer, créer, modifier et supprimer gardent le même libellé, la même icône et la même place partout.
12. **Le comptoir reste souverain** : plein écran, grandes cibles, raccourcis exclusifs. Il utilise les mêmes jetons et composants, avec les métriques de sa maquette.

## 8. Navigation

- **Barre latérale** (par défaut) : groupes Activité / Analyse / Configuration, icônes colorées par famille, élément actif marqué d'un fond `brand-soft` et d'un liseré. Le menu peut se **réduire en icônes seules** (préférence du poste). En bas : carte utilisateur et dossier, bascule vers le ruban, déconnexion.
- **En-tête** : recherche globale (Ctrl+K), état de l'agent, bascule clair / sombre, aide aux raccourcis (Ctrl+/), menu de compte.
- **Ruban façon Office** (au choix, dans Paramètres) : onglets, groupes, touches d'accès Alt, menu Fichier (backstage).
- **Palette de commandes (Ctrl+K)** : aller à un écran, créer une pièce, chercher un client, un fournisseur ou un article. Les résultats sont groupés et iconographiés, et la navigation au clavier est annoncée (`listbox`).

## 9. Règles de contribution

- Un nouvel écran **compose** les composants de `components/ui/` et n'écrit pas ses propres recettes de classes.
- Si un composant manque, on l'ajoute à `components/ui/` (et à la vitrine `/outils/ui`), jamais localement.
- Pas de hex, pas de `text-[Npx]`, pas de `fixed inset-0` en dehors de `components/ui/` et du comptoir. Le module d'impression (`print/`, `impression/`) n'est pas concerné, car il produit des documents imprimés.
- Avant de livrer : vérifier le clair et le sombre, faire un tour complet au clavier (Tab, Échap, Entrée) et lancer `npm run typecheck` et `npm test`.
