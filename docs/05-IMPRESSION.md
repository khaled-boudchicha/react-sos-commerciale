# Impression — architecture et modèles

> État au 1er novembre 2026. Documentation développeur du moteur : [`packages/report/README.md`](../packages/report/README.md).
> Ancien moteur HTML (aperçu Paged.js) : [`app/src/print/README.md`](../app/src/print/README.md), encore utilisé pour deux cas (voir § 5).

## 1. Principe

Toutes les impressions de l'application passent par le **moteur d'états `@softly/report`** (paquet du dépôt, `packages/report`),
un générateur façon FastReport :

```
Écran ── demandeXxx(données, société) ──▶ DemandeImpression { kind, data, titre, modele? }
                                               │
                         ImprimerDocument : choix du modèle
                         (imposé par la demande › défaut de l'utilisateur › premier modèle livré)
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    ▼                                                     ▼
     Aperçu (ReportPreview, chargé à la demande)            Impression directe (tickets)
     zoom, miniatures, pages, « Modifier le modèle »         documentDeDemande → imprimerSilencieux
     → Imprimer · PDF · HTML                                  → Electron print:silent (imprimante ticket)
```

- **Modèles `.gcr`** : JSON versionné, unités en millimètres, bandes (en-tête, détail, groupes, pied…), objets (texte,
  image, code-barres, ligne, cadre), langage d'expressions sans `eval` (agrégats, formats, fonctions).
- **Pagination exacte** : en-têtes répétés, groupes, tickets à hauteur continue, formats A4 / A5 / 80 mm / 58 mm / paysage.
- **Types de documents** déclarés par l'application (`app/src/impression/types.ts`, 17 types : pièce de vente, pièce
  d'achat, articles, relevés client / fournisseur, impayés, créances, recouvrement, trésorerie, arrêté de caisse, bon de
  stock, bordereau, journal, inventaire, État 104, tickets…) avec leurs jeux de données et un exemple pour le designer.
- **Fonction métier** `ARRETE(montant)` : « Arrêtée la présente facture à la somme de … » (`lib/enLettres.ts`).
- **Chargement** : le moteur sans interface (`@softly/report/core`) est chargé au démarrage ; l'aperçu, le designer et
  la bibliothèque ne sont chargés qu'à la première impression (`impression/ImpressionModeleDiffere.tsx`).

## 2. Modèles livrés (33, lecture seule)

Déclarés dans `app/src/impression/modelesIntegres.ts`. Pour un même type, le **premier** est proposé par défaut ;
l'utilisateur peut en choisir un autre comme défaut, ou **dupliquer** un modèle livré pour le modifier dans le designer.

| Famille | Fichier | Modèles |
|---|---|---|
| Pièces (9) | `modelesPieces.ts` | Facture A4 Moderne / Classique / Prestige, BL A4, BL avec lot et péremption, BL sans prix, bon de comptoir A5, pièce d'achat Moderne / Classique |
| Tickets (4) | `modelesTickets.ts` | Ticket 80 mm, ticket 58 mm, ticket « articles / familles vendus », reçu de transfert d'espèces |
| États (17) | `modelesEtats.ts` | Relevés client et fournisseur (moderne, classique), impayés, créances, recouvrement, trésorerie, arrêté de caisse, état du stock, bon de stock, inventaire (état chiffré, feuille de comptage), bordereau, journaux des ventes / achats, État 104 |
| Étiquettes (3) | `modelesEtiquettes.ts` | Étiquettes de prix 2, 3 ou 4 colonnes sur A4 (code-barres) |

Le kit `impression/kit.ts` fournit les briques communes (en-tête société, cadre tiers, tableau, totaux, signatures, thèmes).

## 3. Modèles personnels et stockage

- **Application de bureau** : fichiers `.gcr` dans `Documents/Gestion Commerciale/Modeles` (IPC `modeles:*` de
  `electron/modeles.ts` : liste, lecture, écriture, suppression, import, export, ouverture du dossier). Noms de fichiers
  validés, contenu vérifié (`format: 'gcr'`) avant écriture.
- **Navigateur (développement)** : `localStorage`, espace de noms `gc.modeles`.
- Écran **Paramètres › Modèles d'impression** (`/modeles`) : bibliothèque avec miniatures, aperçu, duplication, import /
  export, modèle par défaut. Accès soumis au droit « Paramètres ».

## 4. Sorties

| Sortie | Mise en œuvre | Remarques |
|---|---|---|
| Impression avec dialogue | aperçu › « Imprimer » (iframe isolée) | CSS de l'application jamais appliqué au document |
| **PDF** | IPC `modeles:pdf` → `webContents.printToPDF` | page à la taille exacte du modèle, marges nulles (Electron 44 : `margins` à 0) ; testé (`npm run test:electron`) |
| **Impression directe** (tickets) | IPC `print:silent` → imprimante ticket choisie dans Paramètres (`gc.imprimanteTicket`) | sans aperçu ni dialogue ; ☐ à valider sur Windows avec une imprimante thermique |
| HTML | aperçu › « HTML » | pour archivage ou envoi |
| Liste des imprimantes | IPC `printers:list` | imprimante par défaut déduite des options système (Electron 44) |

## 5. Ancien moteur HTML (`app/src/print`)

Encore utilisé pour :

- l'export **PDF / Imprimer des grilles** (menu « Exporter » : `components/grille/exportGrille.ts` › `PrintPreview`, Paged.js
  vendorisé dans `public/vendor/paged.polyfill.js`, synchronisé par `npm run sync:pagedjs`) ;
- les **modèles « du desktop (Delphi) »** proposés à côté des modèles du moteur dans « Imprimer la pièce »
  (`components/document/ImprimerPieceDialog.tsx` › `print/templates/venteModeles.tsx`).

Les anciens gabarits HTML des autres documents ont été **supprimés** (novembre 2026) : leurs formes de données sont
dans `app/src/impression/donnees.ts`.

## 6. Pièges connus

- Ne jamais ajouter de règles `@media print` globales au CSS de l'application : l'impression passe par l'iframe du document.
- Dans un onglet ou une fenêtre **masqué**, Chromium ralentit la mise en page de l'ancien moteur (Paged.js) : sans
  conséquence en usage réel.
- État 104 en paysage : contrôle visuel de l'impression physique à faire (voir `04-TODO.md`).
