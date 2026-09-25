import { ReactNode } from 'react';

/**
 * Grille de données complète (équivalent du DataGrid DevExtreme) — types publics.
 *
 * Le moteur (moteur.ts) est pur : filtres → recherche → tri → groupes → totaux →
 * aplatissement → pagination. Le composant (Grille.tsx) ne fait qu'afficher et
 * piloter l'état (useEtatGrille.ts, persistable).
 */

export type TypeDonnee = 'string' | 'number' | 'money' | 'date' | 'boolean';

export type OperateurFiltre =
  | 'contient' | 'ne_contient_pas' | 'commence' | 'finit'
  | '=' | '<>' | '<' | '<=' | '>' | '>=' | 'entre' | 'vide' | 'non_vide';

export type TypeResume = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type Resume<T> = {
  /** Colonne dont les valeurs sont agrégées (dataField) */
  colonne: string;
  type: TypeResume | 'custom';
  /** Colonne sous laquelle afficher le résultat (défaut : `colonne`) */
  afficherDans?: string;
  /** Agrégation personnalisée (type 'custom') */
  calculer?: (lignes: T[]) => number | string | null;
  /** Mise en forme du résultat ; défaut selon le type de la colonne */
  format?: (valeur: unknown) => ReactNode;
  libelle?: string;
};

export type RegleValidation<T> =
  | { type: 'requis'; message?: string }
  | { type: 'min' | 'max'; valeur: number; message?: string }
  | { type: 'motif'; motif: RegExp; message?: string }
  | { type: 'custom'; valider: (valeur: unknown, ligne: T) => boolean; message: string };

export type ColonneGrille<T> = {
  /** Champ de la ligne (clé unique de la colonne) */
  champ: string;
  titre?: string;
  type?: TypeDonnee;
  /** Largeur initiale en px */
  largeur?: number;
  /** Prend l'espace restant (au moins `largeur`, 170 px par défaut) */
  flexible?: boolean;
  largeurMin?: number;
  alignement?: 'left' | 'right' | 'center';
  visible?: boolean;
  /** Colonne figée à gauche / à droite (reste visible au défilement horizontal) */
  figee?: 'gauche' | 'droite';
  /** Valeur calculée (sinon ligne[champ]) — sert au tri, filtre, groupe, export */
  valeur?: (ligne: T) => unknown;
  /** Affichage de la cellule (sinon valeur formatée selon le type) */
  rendu?: (ligne: T, valeur: unknown) => ReactNode;
  /** Texte formaté (affichage par défaut, export, filtre d'en-tête) */
  format?: (valeur: unknown) => string;
  triable?: boolean;
  filtrable?: boolean;
  groupable?: boolean;
  redimensionnable?: boolean;
  masquable?: boolean;
  /** Filtre d'en-tête (liste des valeurs distinctes) */
  filtreEntete?: boolean;
  /** Modifiable en édition ; false = lecture seule */
  editable?: boolean;
  /** Liste de valeurs (éditeur « lookup » + affichage du libellé) */
  choix?: { valeur: unknown; libelle: string }[];
  /** Éditeur personnalisé */
  editeur?: (p: { valeur: unknown; ligne: T; changer: (v: unknown) => void; valider: () => void; annuler: () => void }) => ReactNode;
  validation?: RegleValidation<T>[];
  /** En-tête parent (bandes / en-têtes multi-niveaux) */
  bande?: string;
  /** Tri initial */
  triInitial?: 'asc' | 'desc';
  /** Regroupement initial (ordre = index) */
  groupeInitial?: number;
};

export type ModeEdition = 'ligne' | 'cellule' | 'lot' | 'formulaire';

export type ModeSelection = 'aucune' | 'simple' | 'multiple';

export type FiltreColonne = { operateur: OperateurFiltre; valeur?: unknown; valeur2?: unknown };

/** État complet et sérialisable (persistance « stateStoring »). */
export type EtatGrille = {
  ordreColonnes: string[];
  largeurs: Record<string, number>;
  masquees: string[];
  tri: { champ: string; sens: 'asc' | 'desc' }[];
  groupes: string[];
  filtres: Record<string, FiltreColonne>;
  /** Filtre d'en-tête : valeurs retenues par colonne (clés texte) */
  filtresEntete: Record<string, string[]>;
  recherche: string;
  taillePage: number;
  page: number;
  /** Groupes repliés (clé de chemin) — ou dépliés si tousReplies */
  groupesBascules: string[];
  tousReplies: boolean;
};

export type ChangementsLot<T> = {
  modifiees: Map<string | number, Partial<T>>;
  ajoutees: T[];
  supprimees: Set<string | number>;
};

export type GrilleProps<T> = {
  donnees: T[];
  cle: (ligne: T) => string | number;
  /** Colonnes ; absentes → déduites des clés de la première ligne */
  colonnes?: ColonneGrille<T>[];
  hauteur?: number | string;
  chargement?: boolean;
  erreur?: string | null;
  titre?: ReactNode;
  messageVide?: string;
  /** Contenu libre ajouté à la barre d'outils */
  barreOutils?: ReactNode;

  // Fonctionnalités (toutes désactivables)
  rechercheGlobale?: boolean;
  /** 'bascule' : ligne masquée derrière un bouton « Filtres » de la barre d'outils */
  ligneFiltre?: boolean | 'bascule';
  panneauFiltre?: boolean;
  /** 'auto' : zone affichée seulement si des groupes sont actifs ou pendant un glisser d'en-tête */
  panneauGroupes?: boolean | 'auto';
  selecteurColonnes?: boolean;
  reorganisationColonnes?: boolean;
  redimensionnementColonnes?: boolean;
  lignesAlternees?: boolean;
  bordures?: boolean;
  retourLigne?: boolean;
  rtl?: boolean;

  // Pagination / défilement
  pagination?: boolean | { tailles?: number[]; taille?: number };
  /** Défilement virtuel (désactive la pagination) : rend uniquement les lignes visibles */
  defilementVirtuel?: boolean;
  hauteurLigne?: number;

  // Sélection
  selection?: ModeSelection;
  /** Portée de « tout sélectionner » : page affichée ou toutes les lignes filtrées */
  toutSelectionner?: 'page' | 'tout';
  selectionnees?: (string | number)[];
  surSelection?: (cles: (string | number)[], lignes: T[]) => void;

  // Ligne active / navigation
  ligneActive?: boolean;
  surLigneActive?: (ligne: T | null) => void;
  surClicLigne?: (ligne: T) => void;
  surDoubleClicLigne?: (ligne: T) => void;

  // Édition
  edition?: {
    mode: ModeEdition;
    ajout?: boolean;
    modification?: boolean;
    suppression?: boolean;
    /** Confirmation avant suppression */
    confirmerSuppression?: boolean;
    /** Nouvelle ligne en tête (défaut) ou en fin */
    positionNouvelle?: 'debut' | 'fin';
    nouvelleLigne?: () => Partial<T>;
    surAjout?: (ligne: T) => Promise<void> | void;
    surModification?: (cle: string | number, changements: Partial<T>, ligne: T) => Promise<void> | void;
    surSuppression?: (cle: string | number, ligne: T) => Promise<void> | void;
  };

  // Totaux
  resumes?: Resume<T>[];
  resumesGroupe?: Resume<T>[];
  /** Pied libre (totaux calculés par l'appelant) : contenu par champ, `_label` dans la première colonne */
  pied?: Partial<Record<string, ReactNode>> & { _label?: ReactNode };

  // Maître-détail
  detail?: (ligne: T) => ReactNode;

  // Export
  export?: {
    nom: string; excel?: boolean; csv?: boolean; pdf?: boolean; selectionSeule?: boolean;
    /** Colonnes exportées (défaut : colonnes visibles, dans leur ordre) */
    colonnes?: ColonneGrille<T>[];
  };

  /** Persistance de l'état (colonnes, tri, filtres, groupes, page) dans localStorage */
  cleEtat?: string;
  /** Classes / styles par ligne */
  styleLigne?: (ligne: T) => React.CSSProperties | undefined;
};
