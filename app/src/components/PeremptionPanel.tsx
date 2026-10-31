import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { LOTS_EXPIRANT } from '../api/queries';
import { fmtDate, fmtQte } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from './ui/DataGrid';
import { Badge, Money, StatusPill, ExportBtn, Toolbar } from './ui/atoms';
import { Field, Select } from './ui/Field';

export type LotExpirant = {
  id: number; n_lot: string; date_peremption: string; qte: number; article_id: number;
  code_article: string; designation: string; jours_restants: number; valeur: number; perime: boolean;
};

const CSV: ExportColumn<LotExpirant>[] = [
  { header: 'Code', value: (l) => l.code_article },
  { header: 'Article', value: (l) => l.designation },
  { header: 'Lot', value: (l) => l.n_lot },
  { header: 'Péremption', value: (l) => fmtDate(l.date_peremption) },
  { header: 'Jours restants', value: (l) => l.jours_restants, numeric: true },
  { header: 'Quantité', value: (l) => l.qte, numeric: true },
  { header: 'Valeur (PMP)', value: (l) => l.valeur, numeric: true },
];

/** Lots en stock périmés ou arrivant à péremption dans l'horizon choisi (lots.DateE). */
export default function PeremptionPanel() {
  const navigate = useNavigate();
  const [jours, setJours] = useState(90);
  const { data, loading, error } = useQuery(LOTS_EXPIRANT, { variables: { jours }, fetchPolicy: 'cache-and-network' });
  const lots: LotExpirant[] = Array.isArray(data?.lotsExpirant) ? data.lotsExpirant : [];
  const perimes = lots.filter((l) => l.perime);

  const columns: Column<LotExpirant>[] = [
    { key: 'article', header: 'Article', render: (l) => <span><b>{l.designation}</b> <span className="money text-ink-muted text-xs">{l.code_article}</span></span>,
      sortAccessor: (l) => l.designation },
    { key: 'lot', header: 'Lot', width: '120px', render: (l) => <span className="money">{l.n_lot || '—'}</span> },
    { key: 'date', header: 'Péremption', align: 'right', width: '110px', render: (l) => <span className="money">{fmtDate(l.date_peremption)}</span>,
      sortAccessor: (l) => l.date_peremption },
    { key: 'j', header: 'Échéance', align: 'right', width: '110px', sortAccessor: (l) => l.jours_restants, render: (l) => (
      l.perime ? <StatusPill tone="bad">périmé</StatusPill>
        : <StatusPill tone={l.jours_restants <= 30 ? 'bad' : 'warn'}>J-{l.jours_restants}</StatusPill>
    ) },
    { key: 'qte', header: 'Qté', align: 'right', width: '80px', render: (l) => <span className="money">{fmtQte(l.qte)}</span>, sortAccessor: (l) => l.qte },
    { key: 'val', header: 'Valeur', align: 'right', width: '120px', render: (l) => <Money value={l.valeur} />, sortAccessor: (l) => l.valeur },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Toolbar className="items-end">
        <Field label="Horizon" className="w-[140px]">
          <Select value={jours} onChange={(e) => setJours(Number(e.target.value))}>
            {[30, 60, 90, 180, 365].map((j) => <option key={j} value={j}>{j} jours</option>)}
          </Select>
        </Field>
        <div className="flex items-center gap-2 text-sm text-ink-label h-control-md">
          <Badge tone={perimes.length ? 'danger' : 'neutral'} size="md">{perimes.length} lot(s) périmé(s)</Badge>
          <span>valeur <Money value={perimes.reduce((s, l) => s + l.valeur, 0)} currency /></span>
        </div>
        <span className="ml-auto"><ExportBtn disabled={!lots.length} onClick={() => exporterCsv('peremption', CSV, lots)} /></span>
      </Toolbar>
      <DataGrid columns={columns} rows={lots} rowKey={(l) => l.id} loading={loading} error={error?.message}
                emptyMessage="Aucun lot en stock n’arrive à péremption sur cet horizon."
                onRowClick={(l) => navigate(`/stock/article/${l.article_id}`)}
                footer={{ _label: `${lots.length} lot(s)`, val: <Money value={lots.reduce((s, l) => s + l.valeur, 0)} /> }} />
    </div>
  );
}
