# Grille de données

Composant `Grille<T>` inspiré du DataGrid DevExtreme, sans dépendance externe
(exceljs est chargé à la demande pour l'export Excel). Démo : menu **Grille (démo)**
(`#/outils/grille`, écran `screens/DemoGrille.tsx`).

| Fichier | Rôle |
|---|---|
| `types.ts` | `ColonneGrille`, `GrilleProps`, `EtatGrille`, résumés, édition |
| `moteur.ts` | Fonctions pures : filtre, tri, groupes, résumés, pagination, validation (testées dans `__tests__/grille.test.ts`) |
| `useEtatGrille.ts` | État (ordre, largeurs, masquées, tri, filtres, groupes, page) mémorisé dans `localStorage` sous `gc.grille.<cleEtat>` |
| `Popups.tsx` | Filtre d'en-tête, sélecteur de colonnes, menu contextuel |
| `exportGrille.ts` | Export Excel (typé, groupes en plan, totaux), CSV, PDF (moteur d'impression) |
| `Grille.tsx` | Le composant |

## Dans l'application

Tous les tableaux de consultation passent par `components/ui/DataGrid` (API `columns` / `rows`),
qui rend cette grille : colonnes réorganisables, redimensionnables, masquables, export,
clavier. Tri, filtres (bouton « Filtres »), recherche et regroupement (glisser un en-tête :
la zone apparaît) s'activent sur les colonnes qui ont un `sortAccessor`, ou sur toutes les
colonnes homonymes d'un champ avec `complet` — à réserver aux listes chargées en entier
(sur une liste paginée côté serveur, on ne trierait que la page). Les tableaux de saisie
(lignes de pièce, inventaire, modales) restent des formulaires dédiés.

## Exemple minimal

```tsx
<Grille<Article>
  donnees={articles}
  cle={(a) => a.id}
  colonnes={[
    { champ: 'code', titre: 'Code', figee: 'gauche', largeur: 110 },
    { champ: 'designation', titre: 'Désignation', validation: [{ type: 'requis' }] },
    { champ: 'famille', titre: 'Famille', choix: familles, groupeInitial: 0 },
    { champ: 'prix', titre: 'Prix HT', type: 'money', bande: 'Prix' },
  ]}
  cleEtat="articles"
  selection="multiple"
  pagination={{ tailles: [20, 50, 100], taille: 20 }}
  resumes={[{ colonne: 'prix', type: 'sum' }]}
  export={{ nom: 'articles' }}
  edition={{ mode: 'ligne', surModification: (id, changements) => enregistrer(id, changements) }}
/>
```

Sans `colonnes`, elles sont déduites de la première ligne.

## Fonctionnalités

- **Tri** : clic (asc → desc → aucun), Maj+clic tri multiple, Ctrl+clic retire ; menu contextuel d'en-tête.
- **Filtres** : ligne de filtre avec opérateur par colonne (contient, commence, =, <, entre, vide…,
  insensible aux accents), filtre d'en-tête par valeurs (⏷), recherche globale, panneau récapitulatif effaçable.
- **Groupes** : glisser un en-tête dans le panneau, niveaux multiples, résumés de groupe, tout déplier / replier.
- **Colonnes** : réorganisation par glisser-déposer (à l'intérieur de sa bande), redimensionnement,
  colonnes figées gauche/droite, bandes d'en-tête, sélecteur (afficher / masquer, rétablir).
- **Lignes** : sélection simple ou multiple (Maj : plage), ligne active, maître-détail (`detail`), `styleLigne`.
- **Volume** : pagination ou `defilementVirtuel` (seules les lignes visibles sont rendues).
- **Édition** : modes `ligne`, `cellule`, `lot` (modifications en attente, Enregistrer / Annuler),
  `formulaire` (fenêtre) ; ajout, suppression confirmée, validation (`requis`, `min`, `max`, `motif`, `custom`).
  La grille ne persiste rien : `surAjout` / `surModification` / `surSuppression` le font (peuvent être async).
- **Clavier** : flèches, Début/Fin, PgPréc/PgSuiv, Entrée/F2 (édition), Espace (sélection), Suppr.
- **Export** : Excel, CSV, PDF — exactement ce qui est affiché (colonnes visibles, filtre, tri, groupes).
- **RTL** : `rtl` inverse la disposition (colonnes figées et redimensionnement compris).
