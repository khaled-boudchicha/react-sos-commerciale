# Système d'impression — `src/print/`

Moteur d'impression générique de l'application : **aperçu isolé en iframe** + **Paged.js**
pour la pagination. Un seul composant (`PrintPreview`) sert tous les documents ;
chaque type de document a son **modèle** dans `templates/`.

```
src/print/
├── engine/
│   ├── PrintPreview.tsx   ← composant d'aperçu/impression (générique, ne pas dupliquer)
│   └── types.ts           ← type PrintDocument { title, html, css }
├── templates/
│   ├── index.ts           ← ré-exporte tous les buildXxxPrint
│   ├── partials.tsx       ← blocs partagés (DocHeader, TiersBlock, TotalsBlock…) + BASE_CSS
│   ├── vente.tsx          ← pièce de vente A4, mise en page moderne (tous types)
│   ├── venteModeles.tsx   ← modèles du desktop (.fr3) : facture ± timbre, BL (lot, sans prix,
│   │                         facture de route), bon de comptoir A4/A5, avoir — option cachet
│   ├── ticket.tsx         ← ticket de caisse 80 mm (vente comptoir)
│   ├── achat.tsx          ← pièce d'achat A4 (FA/BR/BC/DO/avoir/retour)
│   ├── etatClient.tsx     ← état / relevé client (chronologie + solde cumulé)
│   ├── etatFournisseur.tsx← état / relevé fournisseur
│   ├── facturesNonReglees.tsx ← situation des impayés d'un client
│   ├── debiteurs.tsx      ← état des créances (tous débiteurs + ancienneté)
│   ├── tresorerie.tsx     ← état de trésorerie (mouvements période, soldes)
│   └── stock.tsx          ← état du stock (articles + valeur PMP)
└── README.md
```

## Où chaque document est branché

| Document | Fonction | Écran / bouton |
|---|---|---|
| Pièce de vente (facture, BL, devis…) | `buildVenteModelePrint` / `buildVentePrint` | Fiche vente → « Imprimer… » (choix du modèle, cachet ; dernier modèle retenu par type) |
| Ticket 80 mm | `buildTicketPrint` | Fiche vente (type comptoir) → « Ticket 80mm » |
| Pièce d'achat | `buildAchatPrint` | Fiche achat → « Imprimer » |
| Relevé client | `buildEtatClientPrint` | Fiche client → « Imprimer le relevé » |
| Relevé fournisseur | `buildEtatFournisseurPrint` | Fiche fournisseur → « Imprimer le relevé » |
| Impayés client | `buildFacturesNonRegleesPrint` | Fiche client, onglet Factures non réglées |
| État des créances | `buildDebiteursPrint` | Tiers → Débiteurs → « Imprimer l'état des créances » (liste complète re-requêtée, pas la page affichée) |
| État de trésorerie | `buildTresoreriePrint` | Trésorerie → « Imprimer l'état » (période + compte courants, mouvements complets) |
| État du stock | `buildStockPrint` | Stock → « Imprimer l'état du stock » (filtres courants) |

## Pourquoi cette architecture

1. **Isolation totale par iframe** : le HTML/CSS du document est injecté dans une
   iframe (`srcDoc`). Le Tailwind/thème de l'app n'atteint jamais le document, et
   le CSS du document ne fuit jamais dans l'app. Le thème sombre de l'app n'a
   aucun effet sur l'impression.
2. **Paged.js dans l'iframe** : le polyfill découpe le contenu en vraies pages
   selon les règles `@page` du modèle — marges, `size` (A4, 80mm…), compteurs
   `counter(page) / counter(pages)`, contenu de marge (`@bottom-center`…),
   `string-set` (référence du document répétée en bas de chaque page), `thead`
   de tableau répété à chaque page, `break-inside: avoid`.
3. **Impression native** : `iframe.contentWindow.print()` n'imprime QUE l'iframe.
   Dans Electron/Chromium, le dialogue propose « Enregistrer en PDF » — pas
   besoin d'IPC ni de `printToPDF`.

## Utiliser l'impression dans un écran

```tsx
import { useState } from 'react';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildVentePrint } from '../print/templates/vente';

function MonEcran() {
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  // societe = résultat de la query COORDONNEES_SOCIETE (src/api/queries.ts)

  return (
    <>
      <button onClick={() => setPrintDoc(buildVentePrint(vente, societe))}>Imprimer</button>
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
    </>
  );
}
```

C'est tout : l'aperçu s'ouvre plein écran, affiche « Mise en page… » puis le
nombre de pages, et le bouton **Imprimer / PDF** s'active quand Paged.js a fini.
`Échap` ferme l'aperçu.

## Écrire un nouveau modèle

Un modèle est une fonction pure `(données, societe) → PrintDocument` :

```tsx
// src/print/templates/monDocument.tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, Societe } from './partials';

export function buildMonDocumentPrint(data: MesDonnees, societe: Societe): PrintDocument {
  const body = (
    <div>
      <DocHeader societe={societe} docLabel="Mon document" numero={data.numero} date={data.date} />
      {/* … contenu JSX avec styles inline ou classes définies dans le css ci-dessous … */}
    </div>
  );
  return {
    title: `Mon document ${data.numero}`,       // onglet impression + nom PDF par défaut
    html: renderToStaticMarkup(body),
    css: BASE_CSS + `/* règles spécifiques ici */`,
  };
}
```

Règles à respecter :

- **JSX rendu en statique** (`renderToStaticMarkup`) : pas de hooks, pas
  d'événements, pas de composants de l'app (le document vit hors de l'app).
- **Aucune dépendance au CSS de l'app** : tout le style vient de `css` (le
  modèle est autosuffisant). `BASE_CSS` fournit la page A4, la typo, les
  classes utilitaires `.mono` `.r` `.muted` `.avoid-break` et `table.lines`
  (avec `thead` répété par page).
- **Référence en pied de page** : mettre la classe `doc-ref` sur l'élément dont
  le texte doit apparaître en bas de chaque page (déjà fait par `DocHeader`).
- **Autre format de papier** : redéfinir `@page { size: … }` dans le `css` du
  modèle (ex. ticket : `@page { size: 80mm auto; margin: 4mm; }`).
- **Blocs insécables** : classe `avoid-break` (totaux, signature…).

## Blocs partagés (`templates/partials.tsx`)

| Bloc | Rôle |
|---|---|
| `DocHeader` | En-tête société (raison sociale, slogan, adresse, contacts) + cartouche type/N°/date. Porte `doc-ref`. |
| `TiersBlock` | Cartouche client/fournisseur + identifiants fiscaux société (RC/NIF/NIS/Art). |
| `TotalsBlock` | Tableau de totaux aligné à droite, dernière ligne en bandeau bleu. |
| `SignFooter` | « Arrêtée la présente pièce à … » + zone cachet/signature. |
| `BASE_CSS` | `@page` A4 + pieds de page + typo + tableaux. |
| `INK/MUTED/LINE/BRAND` | Palette d'impression (fixe, indépendante du thème app). |

## Coordonnées société

Tous les modèles prennent `societe` en second argument : le résultat brut de la
query `COORDONNEES_SOCIETE` (`src/api/queries.ts`) — champs `raison_sociale`,
`adresse`, `telephone`, `fax`, `email`, `rc`, `nif`, `nis`, `art`, `slogan`.
Côté agent, ces valeurs viennent de la table `info` (name/value) du dossier.

## Dépannage

- **« Mise en page… » ne finit jamais** : erreur JS dans l'iframe — le moteur
  remonte le message (`paged:error`) dans la barre. Vérifier le HTML du modèle.
- **Police différente à l'impression** : les Google Fonts sont chargées dans
  l'iframe ; hors-ligne, retombée sur `system-ui` (prévu, lisible).
- **Tableau coupé au mauvais endroit** : `tr { break-inside: avoid }` est déjà
  dans `BASE_CSS` ; pour un bloc entier, ajouter la classe `avoid-break`.
