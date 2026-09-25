import { useState } from 'react';
import { useLazyQuery, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { COORDONNEES_SOCIETE, RECOUVREMENT } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from './ui/DataGrid';
import { Bucket, ExportBtn, Pagination } from './ui/atoms';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildRecouvrementPrint, RecouvrementLigne } from '../print/templates';

const LIMIT = 50;

const CSV: ExportColumn<RecouvrementLigne>[] = [
  { header: 'Code', value: (r) => r.code_cli },
  { header: 'Client', value: (r) => r.raison },
  { header: 'Téléphone', value: (r) => r.tel },
  { header: 'Pièces', value: (r) => r.nb_pieces, numeric: true },
  { header: 'Plus ancienne', value: (r) => fmtDate(r.plus_ancienne) },
  { header: 'Dernière', value: (r) => fmtDate(r.derniere) },
  { header: 'Dû total', value: (r) => r.total_du, numeric: true },
  { header: 'En retard', value: (r) => r.du_en_retard, numeric: true },
  { header: 'Échu (échéance dépassée)', value: (r) => r.echu, numeric: true },
  { header: '0-30 j', value: (r) => r.b_0_30, numeric: true },
  { header: '31-60 j', value: (r) => r.b_31_60, numeric: true },
  { header: '61-90 j', value: (r) => r.b_61_90, numeric: true },
  { header: '+90 j', value: (r) => r.b_90_plus, numeric: true },
];

/**
 * Recouvrement (RecouverementForm.pas) : clients dont des pièces impayées ont
 * plus de N jours, ventilées par ancienneté — ou, mode desktop, clients sans
 * pièce depuis N jours (« inactifs »).
 */
export default function RecouvrementPanel({ search }: { search: string }) {
  const navigate = useNavigate();
  const [nbrjour, setNbrjour] = useState(30);
  const [inactifs, setInactifs] = useState(false);
  const [offset, setOffset] = useState(0);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const vars = { nbrjour, inactifs, search: search || undefined };
  const { data, loading, error } = useQuery(RECOUVREMENT, { variables: { ...vars, limit: LIMIT, offset }, fetchPolicy: 'cache-and-network' });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [toutCharger, { loading: chargement }] = useLazyQuery(RECOUVREMENT, { fetchPolicy: 'network-only' });
  const res = data?.recouvrement;
  const rows: RecouvrementLigne[] = res?.data ?? [];

  async function complet() {
    const { data: all } = await toutCharger({ variables: { ...vars, limit: 5000, offset: 0 } });
    return all?.recouvrement;
  }

  const columns: Column<RecouvrementLigne>[] = [
    { key: 'client', header: 'Client', render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-[10.5px]">{r.code_cli}</span></span> },
    { key: 'tel', header: 'Téléphone', width: '110px', render: (r) => <span className="money text-[11.5px]">{r.tel || '—'}</span> },
    { key: 'nb', header: 'Pièces', align: 'right', width: '70px', render: (r) => <span className="money">{r.nb_pieces}</span> },
    { key: 'anc', header: 'Plus ancienne', align: 'right', width: '120px', render: (r) => (
      <span className="money" style={{ color: r.jours_max > 90 ? 'var(--danger)' : r.jours_max > 60 ? 'var(--warning)' : undefined }}>
        {fmtDate(r.plus_ancienne)} · {r.jours_max} j
      </span>
    ) },
    { key: 'du', header: 'Dû total', align: 'right', width: '120px', render: (r) => <span className="money">{fmtMoney(r.total_du)}</span> },
    { key: 'retard', header: 'En retard', align: 'right', width: '120px', render: (r) => <span className="money font-semibold" style={{ color: 'var(--danger)' }}>{fmtMoney(r.du_en_retard)}</span> },
    { key: 'echu', header: 'Échu', align: 'right', width: '110px', render: (r) => <span className="money">{fmtMoney(r.echu)}</span> },
    { key: 'b90', header: '+90 j', align: 'right', width: '110px', render: (r) => <span className="money">{fmtMoney(r.b_90_plus)}</span> },
  ];

  const t = res?.totaux;
  return (
    <>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11px] font-bold text-ink-label">Retard supérieur à (jours)
          <input type="number" min={0} value={nbrjour} onChange={(e) => { setNbrjour(Math.max(0, Number(e.target.value) || 0)); setOffset(0); }}
                 className="mt-1 block w-28 border border-line rounded-sm px-3 py-1.5 bg-surface text-ink money text-right font-normal" />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-label pb-2">
          <input type="checkbox" checked={inactifs} onChange={(e) => { setInactifs(e.target.checked); setOffset(0); }} />
          Clients sans pièce depuis ce délai (mode desktop)
        </label>
        <div className="ml-auto flex gap-2">
          <button disabled={chargement}
                  onClick={async () => {
                    const all = await complet(); if (!all) return;
                    setPrintDoc(buildRecouvrementPrint({ rows: all.data, totaux: all.totaux, nbrjour, inactifs },
                      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>));
                  }}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
            Imprimer
          </button>
          <ExportBtn loading={chargement}
                     onClick={async () => { const all = await complet(); if (all) exporterCsv('recouvrement', CSV, all.data); }} />
        </div>
      </div>
      {t && (
        <div className="grid grid-cols-7 gap-3">
          {[
            { l: 'Total dû', v: t.total_du, c: 'var(--text)', s: `${res.total} client(s)` },
            { l: `En retard (+${nbrjour} j)`, v: t.du_en_retard, c: 'var(--danger)' },
            { l: 'Échu (échéance dépassée)', v: t.echu, c: 'var(--danger)' },
            { l: '0–30 jours', v: t.b_0_30, c: 'var(--text)' },
            { l: '31–60 jours', v: t.b_31_60, c: 'var(--warning)' },
            { l: '61–90 jours', v: t.b_61_90, c: 'var(--warning)' },
            { l: '+90 jours', v: t.b_90_plus, c: 'var(--danger)' },
          ].map((k) => <Bucket key={k.l} label={k.l} value={k.v} tone={k.c} sub={k.s} />)}
        </div>
      )}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rows={rows} rowKey={(r) => r.code_cli} loading={loading} error={error?.message}
                emptyMessage="Aucun client en retard pour ce critère."
                onRowClick={(r) => navigate(`/tiers/client/${encodeURIComponent(r.code_cli)}`)} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={setOffset} />}
    </>
  );
}
