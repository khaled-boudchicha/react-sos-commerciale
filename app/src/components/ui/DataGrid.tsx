import { ReactNode } from 'react';
import { exporterCsv, ExportColumn } from '../../lib/export';

export type Column<T> = {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  width?: string;
  render: (row: T) => ReactNode;
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

export default function DataGrid<T>({
  columns, rows, rowKey, loading, error, footer, onRowClick, emptyMessage, titre, actions, exportCsv,
}: Props<T>) {
  const barre = titre || actions || exportCsv;
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
                      onClick={() => exporterCsv(exportCsv.nom, exportCsv.columns, rows)}
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
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}
                  className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3.5 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.header}
              </th>
            ))}
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
          {rows.map((r, i) => (
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
