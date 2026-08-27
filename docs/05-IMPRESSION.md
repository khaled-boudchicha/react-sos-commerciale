# Impression — architecture et modèles

> Documentation développeur complète : [`app/src/print/README.md`](../app/src/print/README.md).
> Ce document résume l'architecture pour le dossier projet.

## Principe

Un seul moteur générique, des modèles par domaine :

```
Écran ──buildXxxPrint(données, societe)──▶ PrintDocument { title, html, css }
                                              │
                                              ▼
                              <PrintPreview doc={…} onClose={…}/>
                                              │
                              IFRAME isolée (srcDoc) ── aucun conflit avec le CSS de l'app
                                              │
                              Paged.js (polyfill DANS l'iframe)
                              → pagination @page A4, compteur « Page n / N »,
                                référence du doc en marge basse (string-set),
                                lignes insécables, thead répétés
                                              │
                              postMessage 'paged:rendered' → bouton Imprimer/PDF actif
                                              │
                              iframe.contentWindow.print() → dialogue natif
                              (imprimante ou « Enregistrer en PDF »)
```

- **Isolation iframe** : le thème/Tailwind de l'app n'atteint jamais le document, et le CSS du modèle ne fuit pas dans l'app (exigence : zéro conflit).
- **Polyfill embarqué** : `public/vendor/paged.polyfill.js`, synchronisé depuis node_modules par le script npm `sync:pagedjs` (exécuté au build) — l'export map du package pagedjs n'autorise pas l'import direct du dist.
- **Hors-ligne** : tout est local (polyfill vendorisé) ; les Google Fonts de l'iframe retombent sur `system-ui` sans réseau.

## Modèles disponibles

| Modèle | Fichier | Écran(s) branché(s) |
|---|---|---|
| Pièce de **vente** (FA/BL/BCT/BC/FP/avoir/retour) | `app/src/print/templates/vente.tsx` | Fiche vente (`/ventes/:id`) |
| Pièce d'**achat** (FA/BR/BC/DO/avoir/retour) | `app/src/print/templates/achat.tsx` | Fiche achat (`/achats/:id`) |
| **État / relevé client** (chronologie + solde cumulé + synthèse) | `app/src/print/templates/etatClient.tsx` | Fiche client (`/tiers/client/:code`) |
| Blocs partagés + CSS de base A4 | `app/src/print/templates/partials.tsx` | — |

Chaque modèle est une fonction pure `(données, societe) → PrintDocument` rendue via `renderToStaticMarkup` — voir le README pour en ajouter un (relevé fournisseur, ticket 80 mm via `@page { size: 80mm auto }`, bordereau, inventaire…).

## Validé E2E (25/08/2026, stack locale, données réelles)

- BL `1008/2026` (15 lignes, lots) → 1 page, aperçu conforme, bouton Imprimer/PDF actif.
- Relevé client 131 (UMC LAB, historique long) → **2 pages** : pied de page « Relevé client N° 131 » + « Page 1/2 », coupure propre entre pages, lignes insécables.

## Pièges connus

- La pagination utilise le rendu du navigateur : dans un onglet/panneau **masqué**, Chromium throttle le travail → la mise en page peut sembler bloquée tant que la fenêtre n'est pas visible (sans conséquence en usage réel Electron).
- Ne jamais remettre de règles `@media print` globales dans le CSS de l'app : l'impression passe uniquement par l'iframe.
