# Impression — modèles du moteur d'états (`src/impression/`)

Branchement de l'application sur le paquet générique `@softly/report` (`packages/report`) : types de documents,
**33 modèles professionnels livrés**, adaptateurs de données, et composant d'impression utilisé par tous les écrans.

```
impression/
├── index.ts               initialiserImpression() (appelé dans main.tsx) + documentDeDemande() (impression directe)
├── types.ts               17 types de documents : champs, jeu d'exemple, adaptateurs donnees*()
├── demandes.ts            demande*() : remplacent les anciens build*Print (mêmes arguments) → DemandeImpression
├── ImprimerDocument.tsx   aperçu → sélecteur de modèle → designer → PDF / HTML / impression
├── PontNotifications.tsx  route les notifications du paquet vers les toasts de l'app
├── kit.ts                 kit de design (thèmes, en-tête, cartes, tableaux, totaux, signatures, pied de page)
└── modelesPieces / modelesEtats / modelesTickets / modelesEtiquettes.ts   les modèles (assemblages de blocs du kit)
```

## Documents couverts

| Type (`kind`) | Écran | Modèles livrés |
|---|---|---|
| `vente` | Fiche vente (« Imprimer… », « Ticket 80mm »), Caisse | Facture A4 Moderne / Classique / Prestige, BL, BL N° lot + péremption, BL sans prix, bon de comptoir A5, ticket 80 mm, ticket 58 mm |
| `achat` | Fiche achat | Pièce d'achat Moderne / Classique |
| `articles` | Stock | État du stock, étiquettes de prix 2 / 3 / 4 colonnes |
| `etatClient`, `etatFournisseur` | Fiches client / fournisseur | Relevé Moderne / Classique |
| `impayes`, `creances`, `recouvrement` | Client, Tiers, Recouvrement | Situation des impayés, état des créances, état de recouvrement |
| `tresorerie`, `arreteCaisse`, `recuTransfert` | Trésorerie, Arrêté de caisse | État de trésorerie, arrêté de caisse (avec / sans comptage), reçu de transfert 80 mm |
| `bonStock`, `inventaire` | Mouvements de stock, Inventaire | Bon d'entrée / sortie, inventaire chiffré, feuille de comptage |
| `bordereau`, `journal`, `etat104`, `ticketVentes` | Ventes, Achats, Journal, Statistiques | Bordereau, journal des ventes / des achats, état 104 (paysage), ticket « articles vendus » |

Le **premier modèle livré** d'un type est celui proposé par défaut ; l'utilisateur change de modèle depuis l'aperçu
(étoile dans la bibliothèque = modèle par défaut du type). Les modèles `.gcr` personnels sont proposés au même endroit.

## Ajouter un modèle

1. Dans `modelesPieces.ts` / `modelesEtats.ts` : assembler les blocs du kit (`blocEntete`, `blocCartes`, `tableau`,
   `blocTotaux`, `blocSignatures`, `bandePied`) ou décrire un état dans `etat({...})` (colonnes, cartes, totaux).
2. Le déclarer dans la liste exportée du fichier (`MODELES_PIECES`, `MODELES_ETATS`…).
3. `npx vitest run` : chaque modèle est rendu avec son jeu d'exemple et avec 90 lignes (aucun avertissement,
   pagination et numérotation de pages vérifiées).

## Ajouter un type de document

`types.ts` : déclarer le type (jeux de données, exemple) + un adaptateur `donneesXxx(args, societe)`, puis une
`demandeXxx` dans `demandes.ts`, et remplacer l'appel d'impression de l'écran par `<ImprimerDocument demande={…} />`.

## Notes

- Ticket de caisse : modèle `integre:integre-ticket-80` par défaut ; clé locale `gc.impression.ticket` pour en
  choisir un autre (`integre:integre-ticket-58`, `fichier:<nom>.gcr`). L'envoi à l'imprimante reste silencieux
  (`documentDeDemande` → `imprimerSilencieux`) ; en cas d'échec l'aperçu s'ouvre.
- Les modèles du desktop Delphi (`src/print/templates/venteModeles.tsx`) restent proposés pour les pièces de vente
  (équivalence stricte des `.fr3`) ; les autres gabarits `src/print/templates/*` ne sont plus utilisés par les écrans.
- Mise en forme conditionnelle (rouge pour les retards, vert pour les règlements…) : propriété `highlight` des textes,
  éditable dans le designer (section « Mise en forme conditionnelle »).
