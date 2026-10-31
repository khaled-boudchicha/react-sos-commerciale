import { useMemo, useState } from 'react';
import { useApolloClient, useLazyQuery, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { COORDONNEES_SOCIETE, RECOUVREMENT } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column, DataGridDistant, totalDistant } from './ui/DataGrid';
import { ReponseDistante } from './grille/types';
import { ExportBtn, Money, Toolbar } from './ui/atoms';
import { Button } from './ui/Button';
import { Checkbox, Field, TextInput } from './ui/Field';
import { KpiTile } from './ui/Kpi';
import type { Tone } from './ui/Icon';
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
    { key: 'client', header: 'Client', field: 'raison', render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-xs">{r.code_cli}</span></span> },
    { key: 'tel', header: 'Téléphone', width: '110px', field: 'tel', render: (r) => <span className="money text-xs">{r.tel || '—'}</span> },
    { key: 'nb', header: 'Pièces', align: 'right', width: '70px', field: 'nb_pieces', type: 'number', render: (r) => <span className="money">{r.nb_pieces}</span> },
    { key: 'anc', header: 'Plus ancienne', align: 'right', width: '120px', field: 'plus_ancienne', type: 'date', render: (r) => (
      <span className="money" style={{ color: r.jours_max > 90 ? 'var(--danger-text)' : r.jours_max > 60 ? 'var(--warning-text)' : undefined }}>
        {fmtDate(r.plus_ancienne)} · {r.jours_max} j
      </span>
    ) },
    { key: 'du', header: 'Dû total', align: 'right', width: '120px', field: 'total_du', render: (r) => <span className="money">{fmtMoney(r.total_du)}</span> },
    { key: 'retard', header: 'En retard', align: 'right', width: '120px', field: 'du_en_retard', render: (r) => <Money value={r.du_en_retard} tone="danger" className="font-semibold" /> },
    { key: 'echu', header: 'Échu', align: 'right', width: '110px', field: 'echu', render: (r) => <span className="money">{fmtMoney(r.echu)}</span> },
    { key: 'b90', header: '+90 j', align: 'right', width: '110px', field: 'b_90_plus', render: (r) => <span className="money">{fmtMoney(r.b_90_plus)}</span> },
  ];

  const tot = (field: string) => totalDistant(res, field) ?? 0;
  return (
    <>
      <Toolbar className="items-end">
        <Field label="Retard supérieur à (jours)" className="w-44">
          <TextInput type="number" min={0} value={nbrjour} mono align="right"
                     onChange={(e) => { setNbrjour(Math.max(0, Number(e.target.value) || 0)); }} />
        </Field>
        <Checkbox className="pb-2" label="Clients sans pièce depuis ce délai (mode desktop)"
                  checked={inactifs} onChange={(e) => { setInactifs(e.target.checked); }} />
        <div className="ml-auto flex gap-2">
          <Button icon="printer" disabled={chargement}
                  onClick={async () => {
                    const all = await complet(); if (!all) return;
                    setPrintDoc(demandeRecouvrement({ rows: all.data, totaux: all.totaux, nbrjour, inactifs },
                      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>));
                  }}>
            Imprimer
          </Button>
          <ExportBtn loading={chargement}
                     onClick={async () => { const all = await complet(); if (all) exporterCsv('recouvrement', CSV, all.data); }} />
        </div>
      </Toolbar>
      {res && (
        <div className="grid grid-cols-7 gap-3">
          {([
            { l: 'Total dû', v: tot('total_du'), c: undefined, s: `${res.total} client(s)` },
            { l: `En retard (+${nbrjour} j)`, v: tot('du_en_retard'), c: 'danger' },
            { l: 'Échu (échéance dépassée)', v: tot('echu'), c: 'danger' },
            { l: '0–30 jours', v: tot('b_0_30'), c: undefined },
            { l: '31–60 jours', v: tot('b_31_60'), c: 'warning' },
            { l: '61–90 jours', v: tot('b_61_90'), c: 'warning' },
            { l: '+90 jours', v: tot('b_90_plus'), c: 'danger' },
          ] as { l: string; v: number; c?: Tone; s?: string }[]).map((k) => (
            <KpiTile key={k.l} size="sm" label={k.l} value={fmtMoney(k.v)} valueTone={k.c} sub={k.s} />
          ))}
        </div>
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rowKey={(r) => r.code_cli}
                distant={distant} cleEtat="recouvrement"
                footer={(r) => ({
                  _label: `${r?.total ?? 0} client(s)`,
                  du: <span className="money">{fmtMoney(totalDistant(r, 'total_du'))}</span>,
                  retard: <Money value={totalDistant(r, 'du_en_retard')} tone="danger" className="font-semibold" />,
                  echu: <span className="money">{fmtMoney(totalDistant(r, 'echu'))}</span>,
                  b90: <span className="money">{fmtMoney(totalDistant(r, 'b_90_plus'))}</span>,
                })}
                emptyMessage="Aucun client en retard pour ce critère."
                onRowClick={(r) => navigate(`/tiers/client/${encodeURIComponent(r.code_cli)}`)} />
    </>
  );
}
