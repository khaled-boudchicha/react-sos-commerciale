# @softly/report

Générateur d'états façon FastReport, réutilisable dans n'importe quel projet React (ou sans React, côté Node) :

- **modèles `.gcr`** (JSON versionné, unités en mm) enregistrés en fichiers ;
- **designer visuel** (bandes, objets, magnétisme, expressions, arbre de données, annuler/rétablir…) ;
- **aperçu professionnel** (zoom, miniatures, navigation, impression, PDF, HTML) ;
- **moteur de pagination exact** (en-têtes répétés, groupes, détail, colonnes, tickets à hauteur continue) ;
- **bibliothèque de modèles** (miniatures, duplication, import / export, modèle par défaut).

Le paquet ne connaît ni Electron, ni un backend, ni une bibliothèque d'interface : tout ce qui dépend de
l'application (stockage, PDF, impression directe, notifications, types de documents) est **injecté**.

```
src/
├── core.ts            entrée sans interface (Node / navigateur) : modèle, expressions, moteur, stockage, registres
├── index.ts           core + composants React
├── config.ts          configurerReport() : stockage, impression, notifications, espace de noms
├── registre.ts        types de documents et modèles livrés déclarés par l'hôte
├── model.ts · format.ts · validate.ts · store.ts · lang/
├── expr/              langage d'expressions (parser sans eval + évaluation, agrégats, fonctions)
├── engine/            render (mise en page + pagination), measure (mesure DOM), barcode, output
├── data/functions.ts  catalogue des fonctions (affiché dans le designer)
├── exemples/          type « facture » + 2 modèles complets (point de départ)
└── ui/                ReportPreview, ReportDesigner, ImpressionModele, ModelesPage + styles/
demo/                  bac à sable sans Tailwind (npm run demo)
test/                  tests (moteur, pagination, expressions, stockage, opérations du designer)
```

## Installation

Dépendances « peer » : `react` et `react-dom` ≥ 18.

```bash
npm run build && npm pack                         # dans packages/report → softly-report-x.y.z.tgz
npm install ../chemin/softly-report-x.y.z.tgz     # dans le projet consommateur
```

ou, dans un monorepo, depuis les sources : alias `@softly/report` → `packages/report/src/index.ts`
(et `@softly/report/core` → `src/core.ts`), avec `resolve.dedupe: ['react', 'react-dom']` côté Vite.

## Démarrage rapide

```tsx
import { ImpressionModele, declarerModeleIntegre, declarerType, enregistrerFonction } from '@softly/report';
import '@softly/report/style.css';          // une fois (voir « Thème »)

// 1. Vos types de documents : champs exposés au designer + jeu d'exemple pour l'aperçu
declarerType({
  id: 'commande', label: 'Commande',
  datasets: [
    { name: 'Commande', label: 'Commande', mode: 'single', fields: [{ name: 'numero', label: 'Numéro', type: 'text' }] },
    { name: 'Lignes', label: 'Lignes', mode: 'list', fields: [{ name: 'designation', label: 'Désignation', type: 'text' }] },
  ],
  sample: { Commande: { numero: 'C-001' }, Lignes: [{ designation: 'Exemple' }] },
});

// 2. (optionnel) modèles livrés en lecture seule, fonctions métier
declarerModeleIntegre({ id: 'ma-commande', build: () => maCommandeDef() });
enregistrerFonction('TVA19', (a) => Number(a[0]) * 0.19, { categorie: 'Métier', signature: 'TVA19(Commande.ht)', description: 'TVA 19 %' });

// 3. Imprimer : aperçu → « Modifier le modèle » (designer) → aperçu à jour
<ImpressionModele modeleRef="integre:ma-commande" data={{ Commande: { numero: 'C-001' }, Lignes: [] }} titre="Commande C-001" onClose={fermer} />
```

`installerExemples()` déclare un type « facture » et deux modèles complets : copiez `src/exemples/index.ts`
comme point de départ. `listerModeles(kind)` donne les modèles disponibles (`ref` = `integre:<id>` ou `fichier:<nom.gcr>`).

### Composants

| Composant | Rôle |
|---|---|
| `ReportPreview` | aperçu seul (`def`, `data`, `params?`, `titre?`, `onClose`, `onEdit?`) |
| `ReportDesigner` | designer plein écran (`initial`, `fichier?`, `donneesApercu?`, `onClose`, `onSaved?`) |
| `ImpressionModele` | point d'entrée : charge un modèle, aperçu ⇄ designer |
| `ModelesPage` | bibliothèque de modèles (à monter sur une route) |

### Sans React (Node)

```ts
import { rendreEtat, documentComplet } from '@softly/report/core';
const r = rendreEtat(def, data);            // r.pages, r.pageCount, r.widthMm, r.heightMm, r.warnings
const html = documentComplet(r, 'Facture'); // HTML autonome, une « .rpt-page » par page
```

Hors navigateur, la hauteur des champs extensibles est estimée ; dans un navigateur elle est mesurée dans le DOM.

## Configuration — `configurerReport({...})`

| Option | Rôle | Défaut |
|---|---|---|
| `stockage` | `StockageModeles` : `liste`, `lire`, `ecrire`, `supprimer` (+ `importer`, `exporter`, `ouvrirDossier`, `dossier`) | localStorage |
| `impression.exporterPdf` | PDF aux dimensions exactes ; retourne le chemin, ou `null` | « Enregistrer en PDF » du dialogue d'impression |
| `impression.imprimerDirect` | impression sans dialogue (+ `impressionDirecteDisponible`) | bouton masqué |
| `notifier` | `{ success, error, info }` | pile de notifications intégrée |
| `espaceNoms` | préfixe des clés localStorage (`<ns>.fichiers`, `<ns>.defaut`) | `gcr.modeles` |

Exemple Electron : `stockage` = fichiers `.gcr` dans Documents, `exporterPdf` = `webContents.printToPDF`
(**`pageSize` en pouces**, jamais en microns : Electron tronque alors le PDF à ≈ 349 mm de haut).
Intégration de référence : `app/src/impression/` dans l'application Gestion Commerciale.

## Thème

Tout le CSS de l'interface est préfixé `.gcr-root` (aucune fuite, aucun reset global) ; chaque composant public
s'enveloppe dans `<div class="gcr-root">` (`display: contents`, sans effet sur la mise en page).

- **Projet sans Tailwind** : `import '@softly/report/style.css'` (≈ 16 Ko, utilitaires précompilés).
- **Projet avec Tailwind** : ajouter `node_modules/@softly/report/src/**/*.{ts,tsx}` au `content`, déclarer les
  couleurs `surface`, `line`, `line-soft`, `ink`, `ink-label`, `ink-muted`, `brand-700`, les rayons `sm|md|lg`
  et les ombres `soft|card|lifted`, puis définir les jetons ci-dessous.
- **Charte graphique** : surcharger les jetons sur `.gcr-root` (`--gcr-bg`, `--gcr-surface`, `--gcr-surface-sunken`,
  `--gcr-line`, `--gcr-line-soft`, `--gcr-text`, `--gcr-text-label`, `--gcr-text-muted`, `--gcr-brand-700`,
  `--gcr-success|warning|danger`, `--gcr-r-sm|md|lg`, `--gcr-shadow-soft|card|lifted`, `--gcr-font-ui|mono`).
  Exemple : `app/src/styles/report-theme.css`.

## Format `.gcr`

JSON versionné (`format: "gcr"`, `version: 1`). Unités : millimètres ; polices en points. Un état = **une page** +
des **bandes** (`reportTitle`, `pageHeader`, `dataHeader`, `groupHeader`, `data`, `groupFooter`, `dataFooter`,
`reportSummary`, `pageFooter`, `overlay`) contenant des **objets** (`text`, `image`, `line`, `shape`, `barcode`,
`checkbox`). Les bandes `data` se lient à un jeu de données (`dataSource`), avec tri, filtre, groupes, colonnes
(étiquettes) et bandes de détail (`parent`).

## Expressions

Dans les textes : `Total : [Facture.total_ttc] DA`. Opérateurs `+ - * / % & = <> < > and or not ?:`. Agrégats
(`SUM`, `COUNT`, `AVG`, `MIN`, `MAX`, `SUMIF`…), texte, dates, `IIF`, `FORMAT`, `ENLETTRES`… (liste :
`src/data/functions.ts`). Variables système : `Page`, `TotalPages`, `Date`, `Now`, `Row`. Aucune évaluation
dynamique (`eval` / `Function`) : compatible avec une CSP stricte. Fonctions métier : `enregistrerFonction`.

## Impression fidèle (pagination)

- Le moteur **découpe lui-même** les pages : chaque page est un bloc `.rpt-page` à sa taille finale en mm, avec
  `@page { size; margin: 0 }` et un saut de page explicite. Aucune fragmentation n'est laissée au navigateur : ce
  qui est vu dans l'aperçu est ce qui est imprimé.
- Les champs `canGrow` sont **mesurés dans le vrai DOM**, avec le CSS exact de l'impression (principe de paged.js).
- Un ticket continu plus haut que 5 m (limite du format PDF) est découpé en pages de 5 m, avec avertissement.
- Vérifié en PDF réel (Electron `printToPDF`) sur 29 combinaisons (A4/A3/A5/Letter/paysage, tickets, étiquettes,
  4 à 400 lignes) : nombre de pages identique au moteur, dimensions exactes à ±0,2 mm (arrondi de Chromium).

## Raccourcis du designer

`T I L R B C` outils · `Ctrl+Z/Y` annuler/rétablir · `Ctrl+C/X/V/D` copier/couper/coller/dupliquer ·
`Suppr` supprimer · flèches déplacer (`Maj` ×10, `Alt` fin) · `Ctrl+A` tout sélectionner · `Ctrl+S` enregistrer ·
`F5` aperçu · `Ctrl+molette` zoom.

## Scripts

| Commande | Effet |
|---|---|
| `npm test` | tests unitaires (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `dist/` : `index.js`, `core.js`, `.d.ts`, `report.css` |
| `npm run demo` | bac à sable sur http://localhost:5188 (sans Tailwind) |

## Limites connues

- Interface et messages **en français** uniquement (pas d'i18n) ; formats de nombres et dates en locale `fr`.
- Pas de code QR (Code 128, Code 39 et EAN-13), pas de sous-état ni de tableau croisé, pas d'export Excel.
- Impression directe sur imprimante et dialogue natif : fournis par l'hôte (`impression.imprimerDirect`).
