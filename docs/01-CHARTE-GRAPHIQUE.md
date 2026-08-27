# Charte graphique — Gestion Commerciale Desktop

> App desktop (Electron + React) de gestion commerciale complète, connectée à `sos-cloud-server` → agent PC.
> La charte **étend le design system existant** de `app_mobile_client` (`lib/theme.ts`, tokens froids + bleu roi)
> et l'identité du logo (`logo gestion commerciale.png` : bleu roi + accent or/ambre).

## 1. Principes

1. **POS/fintech pro** — froid, précis, dense. C'est un outil de travail 8h/jour, pas une app grand public.
2. **Densité desktop** — tables de données compactes (32–36 px/ligne), raccourcis clavier partout (héritage Delphi : F-keys), double densité `comfortable`/`compact`.
3. **Source unique des tokens** — un seul fichier `src/theme/tokens.ts` (+ variables CSS générées). **Zéro hex hardcodé ailleurs** (règle déjà appliquée sur le mobile).
4. **Mode clair par défaut + mode sombre complet** (usage nocturne pharmacie/backoffice).
5. **Cohérence familles de documents** — chaque type de document (FA, BL, BC, devis, avoir…) a une couleur de badge stable dans toute l'app.

## 2. Palette

### Marque
| Token | Valeur | Usage |
|---|---|---|
| `brand.50` | `#EEF3FE` | fonds sélection, hover subtils |
| `brand.100` | `#DCE6FD` | fonds badges/chips |
| `brand.300` | `#7C9BF2` | bordures actives, focus secondaire |
| `brand.500` | `#3B66F5` | éléments interactifs, liens |
| `brand.700` | `#2450E0` | **primaire** — boutons, sidebar active, logo |
| `brand.900` | `#1E3FB5` | pressed, dégradés profonds |
| `gradient.hero` | `#3B66F5 → #2450E0 → #1E3FB5` | bandeaux hero, header dashboard (même dégradé que le mobile) |

### Accent or (identité logo)
| Token | Valeur | Usage |
|---|---|---|
| `gold.400` | `#F6B93B` | accent graphique, courbe « croissance », highlights KPI |
| `gold.600` | `#E89B0C` | icônes accent, états « attention positive » |

### Neutres froids (slate — identiques au mobile)
| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `neutral.0` | `#F6F8FC` | `#0B1220` | fond application |
| `surface` | `#FFFFFF` | `#111A2E` | cartes, panneaux, tables |
| `surface.raised` | `#FFFFFF` + ombre | `#16213A` | popovers, modales |
| `neutral.100` | `#EDF1F8` | `#1C2942` | séparateurs, fonds header de table |
| `neutral.300` | `#C9D3E4` | `#31415F` | bordures |
| `neutral.500` | `#7C8AA5` | `#8093B0` | texte secondaire, placeholders |
| `neutral.700` | `#42536F` | `#B7C3D9` | texte de labels |
| `neutral.900` | `#0F1A2E` | `#E9EEF7` | texte principal |

### Sémantiques
| Token | Valeur | Usage |
|---|---|---|
| `success.600` | `#16A34A` | payé, stock OK, connexion agent OK |
| `warning.600` | `#D97706` | reste à payer partiel, stock bas, péremption proche |
| `danger.600` | `#DC2626` | impayé, rupture, suppression, déconnecté |
| `info.600` | `#0891B2` | états informatifs, aides |
| `teal.500` | `#14B8A6` | accent charts 2 |
| `violet.500` | `#8B5CF6` | accent charts 3 |
| `orange.500` | `#F97316` | accent charts 4 |

### Couleurs par type de document (stables partout : badges, listes, en-têtes d'éditeur)
| Doc | Code | Couleur |
|---|---|---|
| Facture | FA | `brand.700` |
| Bon de livraison | BL | `teal.500` |
| Bon de commande | BC/BCT | `violet.500` |
| Facture proforma / Devis | FP | `neutral.500` |
| Avoir / Retour | FAV/BRT | `danger.600` |
| Achat | — | `orange.500` |
| Règlement | — | `success.600` |

## 3. Typographie

| Rôle | Police | Taille/Graisse |
|---|---|---|
| UI générale | **Plus Jakarta Sans** (déjà la police du système SOFTLY) | 13 px / 400–600 |
| Titres écran | Plus Jakarta Sans | 20 px / 700 |
| Titres section | Plus Jakarta Sans | 15 px / 600 |
| **Chiffres & montants** | **JetBrains Mono** (tabular) | 13 px / 500 — alignement colonne des montants dans les tables |
| KPI | Plus Jakarta Sans | 28 px / 800 |
| Petits labels / badges | Plus Jakarta Sans | 11 px / 600, letter-spacing 0.4 |

Montants : format `1 234 567,89 DA`, séparateur espace fine, toujours alignés à droite en mono tabulaire.

## 4. Espacement, rayons, ombres

- Grille d'espacement **4 px** : 4/8/12/16/24/32.
- Rayons : `sm 6px` (inputs, cellules éditables), `md 10px` (cartes, boutons), `lg 16px` (modales, hero), `full` (badges).
- Ombres (mode clair) : `soft` (cartes) `0 1px 3px rgb(15 26 46 / .06)`, `card` `0 4px 12px rgb(15 26 46 / .08)`, `lifted` (popover) `0 12px 32px rgb(15 26 46 / .16)`. Mode sombre : bordures `neutral.100` à la place des ombres.
- Densité tables : `compact` 32 px/ligne (défaut listes documents), `comfortable` 40 px (référentiels).

## 5. Composants (bibliothèque `src/ui/`)

Base recommandée : **Radix UI primitives + Tailwind** (tokens injectés en variables CSS), **TanStack Table** pour les grilles, **Recharts ou SVG maison** (même style Donut/Bars que le mobile).

| Composant | Description |
|---|---|
| `AppShell` | Sidebar navigation (icônes + labels, groupes repliables) + topbar (recherche globale ⌘K, sélecteur dossier/exercice, statut agent, user) |
| `GradientHero` | Bandeau dégradé bleu (port du composant mobile en SVG/CSS) pour le dashboard |
| `KpiTile` | Vignette KPI : valeur, delta %, sparkline, `IconBadge` tonal |
| `DataGrid` | Table dense : tri, filtres colonne, sélection, colonnes redimensionnables, virtualisation, pied de totaux, export |
| `DocBadge` | Badge type de document (couleurs §2) |
| `StatusPill` | Payé / Partiel / Impayé / Brouillon (success/warning/danger/neutral) |
| `MoneyCell` | Montant mono tabulaire, négatifs en `danger.600` |
| `DocumentEditor` | Écran maître de saisie de pièce : en-tête tiers + lignes éditables au clavier (Enter=ligne suivante, F2=recherche article) + panneau totaux |
| `EntitySearch` | Recherche article/client/fournisseur avec dropdown riche (stock, prix, solde) — F2/F3 |
| `CommandPalette` | ⌘K : navigation + actions rapides (« Nouvelle facture », « Fiche client… ») |
| `SidePanel` | Panneau latéral droit (fiche rapide tiers/article sans quitter la liste) |
| `Modal`, `ConfirmDialog` | Radix Dialog, confirmations destructives en `danger` |
| `Toast` | Notifications (succès enregistrement, erreurs agent) |
| `AgentStatusDot` | Indicateur temps réel connexion cloud→agent (vert/orange/rouge) |
| `Charts/*` | Donut, Bars, Line — mêmes conventions que le mobile |
| `PrintPreview` | Aperçu avant impression des pièces (A4 + ticket) |
| `EmptyState`, `Skeleton` | États vides/chargement |

## 6. Iconographie

**Lucide** (trait 1.5–1.75, cohérent avec le style froid). Pastilles `IconBadge` tonales (fond `*.100`, icône `*.600`) comme sur le mobile.

## 7. Interactions & raccourcis (héritage Delphi)

- `⌘K / Ctrl+K` palette de commandes · `F2` recherche article · `F3` recherche client · `F10` encaisser/valider · `Échap` fermer panneau · `Ctrl+N` nouvelle pièce · `Ctrl+P` imprimer.
- Focus ring : `2px brand.300`, offset 1 px — navigation clavier complète dans les grilles.
- Transitions 150 ms ease-out ; aucune animation sur les grilles de données.
