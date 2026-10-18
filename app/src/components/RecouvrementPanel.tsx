import { useMemo, useState } from 'react';
import { useApolloClient, useLazyQuery, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { COORDONNEES_SOCIETE, RECOUVREMENT } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column, DataGridDistant, totalDistant } from './ui/DataGrid';
import { ReponseDistante } from './grille/types';
import { Bucket, ExportBtn } from './ui/atoms';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeRecouvrement } from '../impression/demandes';
import type { RecouvrementLigne } from '../print/templates';

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
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const vars = { nbrjour, inactifs, search: search || undefined };
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [toutCharger, { loading: chargement }] = useLazyQuery(RECOUVREMENT, { fetchPolicy: 'network-only' });
  const client = useApolloClient();
  // Dernière réponse de premier niveau : totaux affichés dans les indicateurs
  const [res, setRes] = useState<ReponseDistante<RecouvrementLigne> | null>(null);
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<RecouvrementLigne>>(() => ({
    cle: JSON.stringify([nbrjour, inactifs, search]),
    totaux: ['total_du', 'du_en_retard', 'echu', 'b_0_30', 'b_31_60', 'b_61_90', 'b_90_plus']
      .map((field) => ({ field, type: 'sum' as const })),
    charger: async (grille) => {
      const { data } = await client.query({
        query: RECOUVREMENT, fetchPolicy: 'network-only',
        variables: { nbrjour, inactifs, search: search || undefined, grille },
      });
      const r = data.recouvrement as ReponseDistante<RecouvrementLigne>;
      if (!grille.groupe || grille.groupe.chemin.length === 0) setRes(r);
      return r;
    },
  }), [client, nbrjour, inactifs, search]);

  async function complet() {
    const { data: all } = await toutCharger({ variables: { ...vars, limit: 5000, offset: 0 } });
    return all?.recouvrement;
  }

  const columns: Column<RecouvrementLigne>[] = [
    { key: 'client', header: 'Client', field: 'raison', render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-[10.5px]">{r.code_cli}</span></span> },
    { key: 'tel', header: 'Téléphone', width: '110px', field: 'tel', render: (r) => <span className="money text-[11.5px]">{r.tel || '—'}</span> },
    { key: 'nb', header: 'Pièces', align: 'right', width: '70px', field: 'nb_pieces', type: 'number', render: (r) => <span className="money">{r.nb_pieces}</span> },
    { key: 'anc', header: 'Plus ancienne', align: 'right', width: '120px', field: 'plus_ancienne', type: 'date', render: (r) => (
      <span className="money" style={{ color: r.jours_max > 90 ? 'var(--danger)' : r.jours_max > 60 ? 'var(--warning)' : undefined }}>
        {fmtDate(r.plus_ancienne)} · {r.jours_max} j
      </span>
    ) },
    { key: 'du', header: 'Dû total', align: 'right', width: '120px', field: 'total_du', render: (r) => <span className="money">{fmtMoney(r.total_du)}</span> },
    { key: 'retard', header: 'En retard', align: 'right', width: '120px', field: 'du_en_retard', render: (r) => <span className="money font-semibold" style={{ color: 'var(--danger)' }}>{fmtMoney(r.du_en_retard)}</span> },
    { key: 'echu', header: 'Échu', align: 'right', width: '110px', field: 'echu', render: (r) => <span className="money">{fmtMoney(r.echu)}</span> },
    { key: 'b90', header: '+90 j', align: 'right', width: '110px', field: 'b_90_plus', render: (r) => <span className="money">{fmtMoney(r.b_90_plus)}</span> },
  ];

  const tot = (field: string) => totalDistant(res, field) ?? 0;
  return (
    <>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11px] font-bold text-ink-label">Retard supérieur à (jours)
          <input type="number" min={0} value={nbrjour} onChange={(e) => { setNbrjour(Math.max(0, Number(e.target.value) || 0)); }}
                 className="mt-1 block w-28 border border-line rounded-sm px-3 py-1.5 bg-surface text-ink money text-right font-normal" />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-label pb-2">
          <input type="checkbox" checked={inactifs} onChange={(e) => { setInactifs(e.target.checked); }} />
          Clients sans pièce depuis ce délai (mode desktop)
        </label>
        <div className="ml-auto flex gap-2">
          <button disabled={chargement}
                  onClick={async () => {
                    const all = await complet(); if (!all) return;
                    setPrintDoc(demandeRecouvrement({ rows: all.data, totaux: all.totaux, nbrjour, inactifs },
                      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>));
                  }}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
            Imprimer
          </button>
          <ExportBtn loading={chargement}
                     onClick={async () => { const all = await complet(); if (all) exporterCsv('recouvrement', CSV, all.data); }} />
        </div>
      </div>
      {res && (
        <div className="grid grid-cols-7 gap-3">
          {[
            { l: 'Total dû', v: tot('total_du'), c: 'var(--text)', s: `${res.total} client(s)` },
            { l: `En retard (+${nbrjour} j)`, v: tot('du_en_retard'), c: 'var(--danger)' },
            { l: 'Échu (échéance dépassée)', v: tot('echu'), c: 'var(--danger)' },
            { l: '0–30 jours', v: tot('b_0_30'), c: 'var(--text)' },
            { l: '31–60 jours', v: tot('b_31_60'), c: 'var(--warning)' },
            { l: '61–90 jours', v: tot('b_61_90'), c: 'var(--warning)' },
            { l: '+90 jours', v: tot('b_90_plus'), c: 'var(--danger)' },
          ].map((k) => <Bucket key={k.l} label={k.l} value={k.v} tone={k.c} sub={k.s} />)}
        </div>
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rowKey={(r) => r.code_cli}
                distant={distant} cleEtat="recouvrement"
                footer={(r) => ({
                  _label: `${r?.total ?? 0} client(s)`,
                  du: <span className="money">{fmtMoney(totalDistant(r, 'total_du'))}</span>,
                  retard: <span className="money font-semibold" style={{ color: 'var(--danger)' }}>{fmtMoney(totalDistant(r, 'du_en_retard'))}</span>,
                  echu: <span className="money">{fmtMoney(totalDistant(r, 'echu'))}</span>,
                  b90: <span className="money">{fmtMoney(totalDistant(r, 'b_90_plus'))}</span>,
                })}
                emptyMessage="Aucun client en retard pour ce critère."
                onRowClick={(r) => navigate(`/tiers/client/${encodeURIComponent(r.code_cli)}`)} />
    </>
  );
}
