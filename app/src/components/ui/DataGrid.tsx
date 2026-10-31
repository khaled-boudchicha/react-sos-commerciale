import { ReactNode, useMemo, useRef, useState } from 'react';
import { ExportColumn } from '../../lib/export';
import Grille from '../grille/Grille';
import { ColonneGrille, GrilleProps, ReponseDistante, RequeteDistante, Resume, TypeResume } from '../grille/types';

export type Column<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Largeur en px ('120px') ; absente → la colonne prend l'espace restant */
  width?: string;
  render: (row: T) => ReactNode;
  /**
   * Valeur brute de la colonne (nombre ou texte), distincte de `render` qui
   * produit du JSX. Elle active tri, filtres, regroupement et export de la
   * colonne. À ne fournir que sur des grilles chargées en entier : sur une
   * grille paginée côté serveur, on ne trierait que la page affichée.
   */
  sortAccessor?: (row: T) => number | string | null | undefined;
  /**
   * Mode distant : nom du champ côté serveur (colonne de sortie de la requête).
   * Active tri, filtres, recherche et regroupement faits par le serveur.
   */
  field?: string;
  /** Mode distant : type du champ (défaut : montant si aligné à droite, sinon texte) */
  type?: 'string' | 'number' | 'money' | 'date';
  /** Colonne optionnelle, masquée par défaut (l'utilisateur l'affiche via « Colonnes » ou une vue). */
  hidden?: boolean;
  /** Colonne figée par défaut (reste visible au défilement horizontal). */
  pinned?: 'left' | 'right';
};

/** Mode distant : la liste est triée, filtrée, paginée et regroupée par le serveur. */
export type DataGridDistant<T> = {
  charger: (requete: RequeteDistante) => Promise<ReponseDistante<T>>;
  /** Changer cette clé recharge la liste (critères de l'écran : période, onglet…) */
  cle?: string;
  /** Totaux calculés par le serveur sur tout le résultat filtré (et par groupe), lus dans `footer` */
  totaux?: { field: string; type: TypeResume }[];
  taillePage?: number;
};

type Pied = Partial<Record<string, ReactNode>> & { _label?: ReactNode };

/** Total lu dans une réponse distante (`totaux`) */
export const totalDistant = (r: ReponseDistante<unknown> | null | undefined, field: string, type: TypeResume = 'sum') =>
  r?.resumes?.[`${field}:${type}`] ?? null;

type Props<T> = {
  columns: Column<T>[];
  /** Lignes (mode local) ; ignorées en mode `distant` */
  rows?: T[];
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: string;
  /** Ligne de totaux (mêmes colonnes, cellules libres) */
  footer?: Pied | ((reponse: ReponseDistante<T> | null) => Pied | undefined);
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Titre affiché dans la barre au-dessus du tableau. */
  titre?: ReactNode;
  /** Contrôles libres placés dans la barre (filtres, onglets…). */
  actions?: ReactNode;
  /**
   * Export (Excel, CSV, PDF). Les accesseurs sont explicites et non dérivés
   * des cellules : le fichier doit contenir des nombres bruts, alors que
   * l'affichage utilise des espaces insécables qu'Excel ne relit pas.
   * N'exporte que `rows` (filtrées et triées), donc la page courante pour une grille paginée.
   */
  exportCsv?: { nom: string; columns: ExportColumn<T>[] };
  /**
   * Données chargées en entier (pas de pagination serveur) : les colonnes dont la
   * clé est un champ de la ligne deviennent triables / filtrables sans `sortAccessor`.
   */
  complet?: boolean;
  /** Mémorise la disposition (colonnes, tri, filtres, groupes) sur ce poste. */
  cleEtat?: string;
  /** Tri, filtres, recherche, pagination et groupes faits par le serveur (listes paginées). */
  distant?: DataGridDistant<T>;
  /** Options avancées de la grille (sélection, détail, pagination…). */
  grille?: Partial<GrilleProps<T>>;
};

/**
 * Tableau standard de l'application, rendu par la grille complète (components/grille) :
 * colonnes réorganisables / redimensionnables / masquables, export et navigation clavier.
 * Tri, filtres, recherche et regroupement :
 * - mode `distant` (listes paginées) : faits par le serveur, sur les colonnes qui ont un `field` ;
 * - sinon, en local, sur les colonnes qui ont un `sortAccessor` (ou toutes avec `complet`).
 */
export default function DataGrid<T>({
  columns, rows: rowsProp, rowKey, loading, error, footer, onRowClick, emptyMessage, titre, actions, exportCsv,
  complet, cleEtat, distant, grille,
}: Props<T>) {
  const rows = useMemo(() => rowsProp ?? [], [rowsProp]);
  const cles = useMemo(() => new Map(rows.map((r, i) => [r, rowKey(r, i)])), [rows, rowKey]);
  const premiere = rows[0];
  const [reponse, setReponse] = useState<ReponseDistante<T> | null>(null);

  // Accesseur de tri local : explicite, sinon (données complètes) le champ homonyme de la ligne
  const accesseurs = useMemo(() => columns.map((c) => {
    if (distant) return c.field ? (l: T) => (l as Record<string, unknown>)[c.field!] as string | number | null : undefined;
    if (c.sortAccessor) return c.sortAccessor;
    if (!complet || !c.header || premiere === undefined || !(c.key in (premiere as object))) return undefined;
    return (l: T) => {
      const v = (l as Record<string, unknown>)[c.key];
      // Décimaux MariaDB reçus en texte : triés comme des nombres dans une colonne numérique
      if (c.align === 'right' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
      return typeof v === 'number' || typeof v === 'string' ? v : null;
    };
  }), [columns, complet, premiere, distant]);
  const interactive = accesseurs.some(Boolean);

  const colonnes = useMemo<ColonneGrille<T>[]>(() => columns.map((c, i) => {
    const tri = accesseurs[i];
    const exportee = exportCsv?.columns.find((e) => e.header === c.header);
    const accesseur = tri ?? exportee?.value;
    let type: ColonneGrille<T>['type'];
    if (distant) type = c.type ?? (c.align === 'right' ? 'money' : 'string');
    else {
      const exemple = premiere !== undefined && tri ? tri(premiere) : undefined;
      type = typeof exemple === 'number' ? 'number'
        : typeof exemple === 'string' && /^\d{4}-\d{2}-\d{2}/.test(exemple) ? 'date' : 'string';
    }
    const largeur = c.width ? parseInt(c.width, 10) || undefined : undefined;
    return {
      // Mode distant : le champ serveur sert de clé (c'est lui qu'on trie / filtre / groupe)
      champ: distant && c.field ? c.field : c.key,
      titre: c.header,
      largeur,
      flexible: !largeur,
      largeurMin: 40,
      alignement: c.align,
      type,
      valeur: accesseur ? (l: T) => accesseur(l) ?? null : () => null,
      rendu: (l: T) => c.render(l),
      triable: !!tri,
      filtrable: !!tri,
      groupable: !!tri,
      filtreEntete: !!tri,
      masquable: !!c.header,
      visible: c.hidden ? false : undefined,
      figee: c.pinned === 'left' ? 'gauche' as const : c.pinned === 'right' ? 'droite' as const : undefined,
    };
  }), [columns, accesseurs, exportCsv, premiere, distant]);

  const colonnesExport = useMemo<ColonneGrille<T>[] | undefined>(() => exportCsv?.columns.map((e, i) => ({
    champ: `__export${i}`,
    titre: e.header,
    type: e.numeric ? 'number' as const : 'string' as const,
    valeur: (l: T) => e.value(l) ?? null,
  })), [exportCsv]);

  const exportable = !!exportCsv || (interactive && accesseurs.every((a, i) => a || !columns[i].header));

  // Pied : clés de colonne → clés de la grille (champ serveur en mode distant)
  const piedBrut = typeof footer === 'function' ? footer(reponse) : footer;
  const pied = useMemo(() => {
    if (!piedBrut) return undefined;
    const sortie: Record<string, ReactNode> = { _label: piedBrut._label };
    columns.forEach((c, i) => { if (piedBrut[c.key] !== undefined) sortie[colonnes[i].champ] = piedBrut[c.key]; });
    return sortie;
  }, [piedBrut, columns, colonnes]);

  // Source distante : les totaux demandés s'ajoutent à chaque requête de liste
  const distantRef = useRef(distant);
  distantRef.current = distant;
  const source = useMemo(() => (distant ? {
    cle: distant.cle,
    surReponse: (r: ReponseDistante<T>) => setReponse(r),
    charger: (req: RequeteDistante) => {
      const d = distantRef.current!;
      const feuille = req.groupe && req.groupe.chemin.length >= req.groupe.champs.length;
      const totaux = feuille ? [] : (d.totaux ?? []).map((t) => ({ champ: t.field, type: t.type }))
        .filter((t) => !req.resumes.some((r) => r.champ === t.champ && r.type === t.type));
      return d.charger({ ...req, resumes: [...req.resumes, ...totaux] });
    },
  } : undefined), [distant?.cle, !!distant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mode distant : totaux affichés sur les en-têtes de groupe
  const resumesGroupe = useMemo<Resume<T>[] | undefined>(() => distant?.totaux?.filter((t) => t.type === 'sum').map((t) => ({
    colonne: t.field, type: t.type, libelle: columns.find((c) => c.field === t.field)?.header ?? t.field,
  })), [distant?.totaux, columns]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Grille<T>
      donnees={rows}
      source={source}
      cle={(l) => cles.get(l) ?? rowKey(l, rows.indexOf(l))}
      colonnes={colonnes}
      chargement={loading}
      erreur={error}
      titre={titre}
      messageVide={emptyMessage ?? 'Aucun résultat.'}
      barreOutils={actions}
      pied={pied}
      surClicLigne={onRowClick}
      rechercheGlobale={interactive}
      ligneFiltre={interactive ? 'bascule' : false}
      panneauGroupes={interactive ? 'auto' : false}
      pagination={distant ? { tailles: [25, 50, 100, 200], taille: distant.taillePage ?? 50 } : false}
      resumesGroupe={resumesGroupe}
      export={exportable ? { nom: exportCsv?.nom ?? (typeof titre === 'string' ? titre : 'export'), colonnes: colonnesExport } : undefined}
      cleEtat={cleEtat}
      {...grille}
    />
  );
}
