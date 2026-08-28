import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { VENTES } from '../api/queries';
import { VentesResult, Vente, TYPES_VENTE } from '../api/types';
import { fmtDate, isoFirstOfMonth, isoToday, fmtMoney } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { ExportColumn } from '../lib/export';
import Journal from './JournalVentes';
import { DocBadge, PayStatus, Money, Tabs, PeriodPicker, PageHeader, Pagination } from '../components/ui/atoms';

const LIMIT = 50;

export default function Ventes() {
  const navigate = useNavigate();
  const [vue, setVue] = useState<'documents' | 'journal'>('documents');
  const [type, setType] = useState<(typeof TYPES_VENTE)[number]['code']>('FA');
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());
  const [offset, setOffset] = useState(0);

  const { data, loading, error } = useQuery(VENTES, {
    variables: { type_doc: type, date_debut: debut, date_fin: fin, limit: LIMIT, offset },
  });
  const res: VentesResult | undefined = data?.ventes;
  const rows = res?.data ?? [];
  const isAvoir = type === 'FAV' || type === 'BRT';

  const columns: Column<Vente>[] = [
    { key: 'numero', header: 'N° pièce', render: (v) => <span className="flex items-center gap-2"><DocBadge code={type} /><span className="money">{v.numero}</span></span> },
    { key: 'date', header: 'Date', width: '90px', render: (v) => fmtDate(v.date) },
    { key: 'client', header: 'Client', render: (v) => <b>{v.raison ?? v.code_cli ?? '—'}</b> },
    { key: 'mode', header: 'Mode', width: '90px', render: (v) => <span className="text-ink-muted">{v.mode_payement ?? '—'}</span> },
    { key: 'ttc', header: 'Net à payer', align: 'right', width: '120px', render: (v) => <Money value={v.net_a_payer ?? v.total_ttc} /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '110px', render: (v) => <Money value={v.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '110px', render: (v) => (
      <span className="money font-medium" style={{ color: Number(v.reste_a_payer) > 0 ? 'var(--danger)' : undefined }}>{fmtMoney(v.reste_a_payer)}</span>
    ) },
    { key: 'statut', header: 'Statut', width: '86px', render: (v) => isAvoir ? null : <PayStatus regler={Number(v.regler)} reste={Number(v.reste_a_payer)} /> },
  ];

  const csvDocs: ExportColumn<Vente>[] = [
    { header: 'N° pièce', value: (r) => r.numero },
    { header: 'Date', value: (r) => (r.date ? fmtDate(r.date) : '') },
    { header: 'Client', value: (r) => r.raison ?? r.code_cli ?? '' },
    { header: 'Mode', value: (r) => r.mode_payement ?? '' },
    { header: 'Net à payer', value: (r) => r.net_a_payer ?? r.total_ttc, numeric: true },
    { header: 'Réglé', value: (r) => r.regler, numeric: true },
    { header: 'Reste', value: (r) => r.reste_a_payer, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Documents de vente">
        {vue === 'documents' && (
          <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); setOffset(0); }} />
        )}
        {vue === 'documents' && (
        <button onClick={() => navigate(`/ventes/nouvelle?type=${type}`)}
                className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouvelle pièce
        </button>
        )}
      </PageHeader>
      <Tabs value={vue} onChange={setVue}
            options={[{ code: 'documents' as const, label: 'Documents' }, { code: 'journal' as const, label: 'Journal (lignes)' }]} />
      {vue === 'journal' && <Journal sens="vente" />}
      {vue === 'documents' && (
      <>
      <Tabs value={type} onChange={(t) => { setType(t); setOffset(0); }} options={TYPES_VENTE} />
      <DataGrid
        titre="Export de la page affichée"
        exportCsv={{ nom: `ventes-${type.toLowerCase()}`, columns: csvDocs }}
        columns={columns} rows={rows} rowKey={(v) => v.id}
        onRowClick={(v) => navigate(`/ventes/${v.id}`)}
        loading={loading} error={error?.message}
        footer={{
          _label: `${res?.total ?? 0} pièce(s)`,
          ttc: <Money value={res?.total_ttc} />,
          reste: <span className="money" style={{ color: 'var(--danger)' }}>{fmtMoney(res?.total_reste)}</span>,
        }}
      />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={setOffset} />}
      </>
      )}
    </div>
  );
}
