import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ACHATS } from '../api/queries';
import { AchatsResult, Achat, TYPES_ACHAT } from '../api/types';
import { fmtDate, isoFirstOfMonth, isoToday, fmtMoney } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { ExportColumn } from '../lib/export';
import Journal from './JournalVentes';
import { DocBadge, PayStatus, Money, Tabs, PeriodPicker, PageHeader, Pagination } from '../components/ui/atoms';

const LIMIT = 50;

export default function Achats() {
  const navigate = useNavigate();
  const [vue, setVue] = useState<'documents' | 'journal'>('documents');
  const [type, setType] = useState<(typeof TYPES_ACHAT)[number]['code']>('FA');
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());
  const [offset, setOffset] = useState(0);

  const { data, loading, error } = useQuery(ACHATS, {
    variables: { type_doc: type, date_debut: debut, date_fin: fin, limit: LIMIT, offset },
  });
  const res: AchatsResult | undefined = data?.achats;
  const rows = res?.data ?? [];

  const columns: Column<Achat>[] = [
    { key: 'numero', header: 'N° pièce', render: (a) => <span className="flex items-center gap-2"><DocBadge code={type === 'FA' ? 'BR' : type} /><span className="money">{a.numero}</span></span> },
    { key: 'date', header: 'Date', width: '90px', render: (a) => fmtDate(a.date) },
    { key: 'fournisseur', header: 'Fournisseur', render: (a) => <b>{a.raison ?? a.code_four ?? a.code_cli ?? '—'}</b> },
    { key: 'mode', header: 'Mode', width: '90px', render: (a) => <span className="text-ink-muted">{a.mode_payement ?? '—'}</span> },
    { key: 'ttc', header: 'Net à payer', align: 'right', width: '120px', render: (a) => <Money value={a.net_a_payer ?? a.total_ttc} /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '110px', render: (a) => <Money value={a.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '110px', render: (a) => (
      <span className="money font-medium" style={{ color: Number(a.reste_a_payer) > 0 ? 'var(--danger)' : undefined }}>{fmtMoney(a.reste_a_payer)}</span>
    ) },
    { key: 'statut', header: 'Statut', width: '86px', render: (a) => <PayStatus regler={Number(a.regler)} reste={Number(a.reste_a_payer)} /> },
  ];

  const csvDocs: ExportColumn<Achat>[] = [
    { header: 'N° pièce', value: (r) => r.numero },
    { header: 'Date', value: (r) => r.date },
    { header: 'Fournisseur', value: (r) => r.raison ?? r.code_four ?? r.code_cli ?? '' },
    { header: 'Mode', value: (r) => r.mode_payement ?? '' },
    { header: 'Net à payer', value: (r) => r.net_a_payer ?? r.total_ttc, numeric: true },
    { header: 'Réglé', value: (r) => r.regler, numeric: true },
    { header: 'Reste', value: (r) => r.reste_a_payer, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Documents d'achat">
        {vue === 'documents' && (
          <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); setOffset(0); }} />
        )}
        {vue === 'documents' && (
        <button onClick={() => navigate(`/achats/nouvelle?type=${type}`)}
                className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouvelle pièce
        </button>
        )}
      </PageHeader>
      <Tabs value={vue} onChange={setVue}
            options={[{ code: 'documents' as const, label: 'Documents' }, { code: 'journal' as const, label: 'Journal (lignes)' }]} />
      {vue === 'journal' && <Journal sens="achat" />}
      {vue === 'documents' && (
      <>
      <Tabs value={type} onChange={(t) => { setType(t); setOffset(0); }} options={TYPES_ACHAT} />
      <DataGrid
        titre="Export de la page affichée"
        exportCsv={{ nom: `achats-${type.toLowerCase()}`, columns: csvDocs }}
        columns={columns} rows={rows} rowKey={(a) => a.id}
        onRowClick={(a) => navigate(`/achats/${a.id}`)}
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
