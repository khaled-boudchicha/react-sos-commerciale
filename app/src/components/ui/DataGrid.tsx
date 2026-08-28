import { ReactNode, useMemo, useState } from 'react';
import { exporterCsv, ExportColumn } from '../../lib/export';

export type Column<T> = {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  width?: string;
  render: (row: T) => ReactNode;
  /**
   * Rend la colonne triable côté client. La valeur retournée (nombre ou texte)
   * sert de clé de tri — distincte de `render`, qui produit du JSX. À n'activer
   * que sur des grilles chargées en entier : sur une grille paginée côté serveur,
   * on ne trierait que la page affichée.
   */
  sortAccessor?: (row: T) => number | string | null | undefined;
};

type SortState = { key: string; dir: 'asc' | 'desc' };

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
  /** Contrôles libres placés à droite de la barre (filtres, onglets…). */
  actions?: ReactNode;
  /**
   * Active le bouton « Exporter CSV ». Les accesseurs sont explicites et non
   * dérivés des cellules : le CSV doit contenir des nombres bruts, alors que
   * l'affichage utilise des espaces insécables qu'Excel ne relit pas.
   * N'exporte que `rows`, donc la page courante pour une grille paginée.
   */
  exportCsv?: { nom: string; columns: ExportColumn<T>[] };
};

/** Compare deux valeurs de tri ; les vides sont toujours renvoyés en fin de liste. */
function comparer(a: unknown, b: unknown): number {
  const videA = a === null || a === undefined || a === '';
  const videB = b === null || b === undefined || b === '';
  if (videA && videB) return 0;
  if (videA) return 1;
  if (videB) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'fr', { numeric: true });
}

export default function DataGrid<T>({
  columns, rows, rowKey, loading, error, footer, onRowClick, emptyMessage, titre, actions, exportCsv,
}: Props<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const barre = titre || actions || exportCsv;

  const rowsAffichees = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return rows;
    const accessor = col.sortAccessor;
    const signe = sort.dir === 'asc' ? 1 : -1;
    // copie : ne jamais muter le tableau du parent (qui alimente aussi le pied)
    return [...rows].sort((a, b) => signe * comparer(accessor(a), accessor(b)));
  }, [rows, sort, columns]);

  // Clic sur un en-tête triable : croissant → décroissant → aucun tri.
  function basculerTri(key: string) {
    setSort((s) => {
      if (s?.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {barre && (
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-[13px]">{titre}</div>
          <div className="flex items-center gap-2">
            {actions}
            {exportCsv && (
              <button type="button" title="Exporter les lignes affichées en CSV (Excel)"
                      disabled={rows.length === 0}
                      onClick={() => exporterCsv(exportCsv.nom, exportCsv.columns, rowsAffichees)}
                      className="rounded-md px-3 py-1.5 font-semibold text-[11.5px] border border-line-soft bg-surface hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed">
                ⬇ Exporter CSV
              </button>
            )}
          </div>
        </div>
      )}
    <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-x-auto">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr>
            {columns.map((c) => {
              const triable = !!c.sortAccessor;
              const actif = sort?.key === c.key;
              const fleche = actif ? (sort!.dir === 'asc' ? ' ▲' : ' ▼') : (triable ? ' ⇅' : '');
              return (
                <th key={c.key} style={{ width: c.width }}
                    onClick={triable ? () => basculerTri(c.key) : undefined}
                    title={triable ? 'Trier' : undefined}
                    className={`text-[10px] font-bold uppercase tracking-wider bg-bg border-b border-line-soft px-3.5 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'} ${triable ? 'cursor-pointer select-none hover:text-ink' : ''} ${actif ? 'text-ink' : 'text-ink-muted'}`}>
                  {c.header}<span className={actif ? '' : 'opacity-40'}>{fleche}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3.5 py-6 text-center text-ink-muted">Chargement…</td></tr>
          )}
          {error && (
            <tr><td colSpan={columns.length} className="px-3.5 py-6 text-center" style={{ color: 'var(--danger)' }}>{error}</td></tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3.5 py-8 text-center text-ink-muted">{emptyMessage ?? 'Aucun résultat.'}</td></tr>
          )}
          {rowsAffichees.map((r, i) => (
            <tr key={rowKey(r, i)} onClick={() => onRowClick?.(r)}
                className={`border-b border-line-soft last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-brand-50' : ''}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-3.5 h-8 align-middle ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && rows.length > 0 && (
          <tbody>
            <tr className="bg-bg font-bold">
              {columns.map((c, i) => (
                <td key={c.key} className={`px-3.5 py-2 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {i === 0 ? footer._label : footer[c.key]}
                </td>
              ))}
            </tr>
          </tbody>
        )}
      </table>
    </div>
    </div>
  );
}
