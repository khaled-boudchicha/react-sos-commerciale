# Ancien moteur d'impression HTML — `src/print/`

> Les états de l'application (pièces, tickets, relevés, caisse, stock, journaux, étiquettes…) passent par le **moteur
> d'états `@softly/report`** : voir `src/impression/` et [`docs/05-IMPRESSION.md`](../../../docs/05-IMPRESSION.md).
> Ce dossier ne sert plus qu'aux cas ci-dessous ; n'y ajoutez pas de nouveau document.

```
src/print/
├── engine/
│   ├── PrintPreview.tsx   ← aperçu en iframe isolée + pagination Paged.js (public/vendor/paged.polyfill.js)
│   ├── types.ts           ← PrintDocument { title, html, css }
│   ├── silentPrint.ts     ← impression directe sans dialogue (Electron print:silent) + imprimante ticket
│   └── cachet.ts          ← image du cachet de la société (option « avec cachet »)
└── templates/
    ├── partials.tsx       ← type Societe, BASE_CSS et blocs partagés
    └── venteModeles.tsx   ← modèles « du desktop (Delphi) » des pièces de vente (.fr3) : facture ± timbre,
                              BL (lot, sans prix, facture de route), bon de comptoir A4/A5, avoir — option cachet
```

## Usages restants

| Usage | Point d'entrée |
|---|---|
| Modèles « du desktop » proposés dans « Imprimer la pièce » (fiche vente), à côté des modèles du moteur | `components/document/ImprimerPieceDialog.tsx` › `buildVenteModelePrint` |
| Export **PDF / Imprimer** des grilles (menu « Exporter ») | `components/grille/exportGrille.ts` › `documentPdfGrille` + `PrintPreview` |
| Impression directe des tickets (utilisée aussi par le moteur d'états) | `engine/silentPrint.ts` |

Les formes de données des états (arrêté de caisse, bons de stock, recouvrement, État 104…) sont dans
`src/impression/donnees.ts`.

## Règles

- **Isolation** : le document est rendu dans une iframe (`srcDoc`) ; le CSS de l'application ne l'atteint jamais et
  le CSS du document ne fuit pas. Ne jamais ajouter de règles `@media print` globales au CSS de l'application.
- **Hors ligne** : Paged.js est vendorisé (`npm run sync:pagedjs`, exécuté par `npm run build`).
- Tests : `src/__tests__/venteModeles.test.ts`.
