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
la zone apparaît) s'activent : sur les listes paginées, côté serveur (`distant`, colonnes avec
`field`) ; sur les listes chargées en entier, en local (`sortAccessor`, ou `complet`). Les tableaux de saisie
(lignes de pièce, inventaire, modales) restent des formulaires dédiés.

## Mode distant (opérations côté serveur)

Pour les listes paginées, `source` (ou `distant` sur `DataGrid`) confie au serveur **tri, filtres
(ligne, en-tête, recherche), pagination, regroupement et totaux** — comme les « remote operations »
de DevExtreme. `useSourceDistante.ts` traduit l'état de la grille en `RequeteDistante` :

```ts
{ skip, take, tri, filtres, filtresEntete, recherche, champsRecherche, types,
  groupe: { champs, chemin } | null, resumes: [{ champ, type }], sauf? }
```

- sans groupe : une page de lignes `{ data, total, resumes }` ;
- avec groupes : les en-têtes du niveau (`groupes: [{ cle, nombre, resumes }]`), puis à
  l'ouverture d'un groupe ses sous-groupes ou ses lignes, par lots de 100 (« Afficher plus ») ;
- filtre d'en-tête : les valeurs possibles et leurs effectifs sont un regroupement sur la colonne ;
- export : tout le résultat filtré est redemandé (plafond 10 000 lignes).

Côté agent, `src/common/grille-distante.ts` applique la requête en SQL sur la requête de base de
la liste enveloppée en table dérivée (`executerGrille`) : noms de champ contrôlés, valeurs liées.
Chaque service de liste accepte `grille` (cloud : argument `grille: JSON`).

```tsx
<DataGrid columns={[{ key: 'client', header: 'Client', field: 'raison', render: … }]}
          rowKey={(v) => v.id} cleEtat="ventes"
          distant={{ cle: JSON.stringify([type, debut, fin]),
                     totaux: [{ field: 'net_a_payer', type: 'sum' }],
                     charger: (grille) => client.query({ query: VENTES, variables: { type, grille } }).then((r) => r.data.ventes) }}
          footer={(r) => ({ _label: `${r?.total ?? 0} pièce(s)`, client: totalDistant(r, 'net_a_payer') })} />
```

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
