import { ReactNode, useMemo } from 'react';
import { ExportColumn } from '../../lib/export';
import Grille from '../grille/Grille';
import { ColonneGrille, GrilleProps } from '../grille/types';

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
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: string;
  /** Ligne de totaux (mêmes colonnes, cellules libres) */
  footer?: Partial<Record<string, ReactNode>> & { _label?: ReactNode };
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
  /** Options avancées de la grille (sélection, détail, pagination…). */
  grille?: Partial<GrilleProps<T>>;
};

/**
 * Tableau standard de l'application, rendu par la grille complète (components/grille) :
 * tri, filtres, recherche, regroupement, colonnes réorganisables / redimensionnables /
 * masquables, export et navigation clavier — sur les colonnes qui ont un `sortAccessor`.
 */
export default function DataGrid<T>({
  columns, rows, rowKey, loading, error, footer, onRowClick, emptyMessage, titre, actions, exportCsv, complet, cleEtat, grille,
}: Props<T>) {
  const cles = useMemo(() => new Map(rows.map((r, i) => [r, rowKey(r, i)])), [rows, rowKey]);
  const premiere = rows[0];

  // Accesseur de tri : explicite, sinon (données complètes) le champ homonyme de la ligne
  const accesseurs = useMemo(() => columns.map((c) => {
    if (c.sortAccessor) return c.sortAccessor;
    if (!complet || !c.header || premiere === undefined || !(c.key in (premiere as object))) return undefined;
    return (l: T) => {
      const v = (l as Record<string, unknown>)[c.key];
      // Décimaux MariaDB reçus en texte : triés comme des nombres dans une colonne numérique
      if (c.align === 'right' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
      return typeof v === 'number' || typeof v === 'string' ? v : null;
    };
  }), [columns, complet, premiere]);
  const interactive = accesseurs.some(Boolean);

  const colonnes = useMemo<ColonneGrille<T>[]>(() => columns.map((c, i) => {
    const tri = accesseurs[i];
    const exportee = exportCsv?.columns.find((e) => e.header === c.header);
    const accesseur = tri ?? exportee?.value;
    const exemple = premiere !== undefined && tri ? tri(premiere) : undefined;
    const type = typeof exemple === 'number' ? 'number' as const
      : typeof exemple === 'string' && /^\d{4}-\d{2}-\d{2}/.test(exemple) ? 'date' as const : 'string' as const;
    const largeur = c.width ? parseInt(c.width, 10) || undefined : undefined;
    return {
      champ: c.key,
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
    };
  }), [columns, accesseurs, exportCsv, premiere]);

  const colonnesExport = useMemo<ColonneGrille<T>[] | undefined>(() => exportCsv?.columns.map((e, i) => ({
    champ: `__export${i}`,
    titre: e.header,
    type: e.numeric ? 'number' as const : 'string' as const,
    valeur: (l: T) => e.value(l) ?? null,
  })), [exportCsv]);

  const exportable = !!exportCsv || (interactive && accesseurs.every((a, i) => a || !columns[i].header));

  return (
    <Grille<T>
      donnees={rows}
      cle={(l) => cles.get(l) ?? rowKey(l, rows.indexOf(l))}
      colonnes={colonnes}
      chargement={loading}
      erreur={error}
      titre={titre}
      messageVide={emptyMessage ?? 'Aucun résultat.'}
      barreOutils={actions}
      pied={footer}
      surClicLigne={onRowClick}
      rechercheGlobale={interactive}
      ligneFiltre={interactive ? 'bascule' : false}
      panneauGroupes={interactive ? 'auto' : false}
      pagination={false}
      export={exportable ? { nom: exportCsv?.nom ?? (typeof titre === 'string' ? titre : 'export'), colonnes: colonnesExport } : undefined}
      cleEtat={cleEtat}
      {...grille}
    />
  );
}
