import { useState } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { TRESORIE_COMPLETE, SOLDES_COMPTES, COORDONNEES_SOCIETE } from '../api/queries';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildTresoreriePrint } from '../print/templates';
import MouvementCaisseModal, { MouvementKind } from '../components/MouvementCaisseModal';
import { TresorieCompleteResult, MouvementTresorie, SoldeCompte } from '../api/types';
import { fmtDate, fmtMoney, isoFirstOfMonth, isoToday } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { PeriodPicker, PageHeader, Pagination } from '../components/ui/atoms';

const LIMIT = 50;

const csvMouvements: ExportColumn<MouvementTresorie>[] = [
  { header: 'Date', value: (m) => (m.date ? fmtDate(m.date) : '') },
  { header: 'Catégorie', value: (m) => m.categorie ?? '' },
  { header: 'Tiers / libellé', value: (m) => m.tier || m.objet || m.code_tier || m.observation || '' },
  { header: 'Compte', value: (m) => m.compte ?? '' },
  { header: 'Mode', value: (m) => m.mode_payement ?? '' },
  { header: 'Utilisateur', value: (m) => m.user ?? '' },
  { header: 'Montant', value: (m) => m.montant, numeric: true },
  { header: 'Solde cumulé', value: (m) => m.solde_cumul, numeric: true },
];

export default function Tresorerie() {
  const [compteId, setCompteId] = useState<number | null>(null);
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());
  const [offset, setOffset] = useState(0);

  const [mouvement, setMouvement] = useState<MouvementKind | null>(null);
  const { data: soldesData, refetch: refetchSoldes } = useQuery(SOLDES_COMPTES);
  const soldes: SoldeCompte[] = Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [];

  const { data, loading, error, refetch: refetchMvts } = useQuery(TRESORIE_COMPLETE, {
    variables: { compte_id: compteId ?? undefined, date_debut: debut, date_fin: fin, limit: LIMIT, offset },
  });
  const res: TresorieCompleteResult | undefined = data?.tresorieComplete;
  const rows = res?.data ?? [];

  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [fetchAll, { loading: printing }] = useLazyQuery(TRESORIE_COMPLETE, { fetchPolicy: 'network-only' });
  const [fetchExport, { loading: exporting }] = useLazyQuery(TRESORIE_COMPLETE, { fetchPolicy: 'network-only' });

  async function exporter() {
    // Tous les mouvements de la période/compte, dans l'ordre chronologique cumulé.
    const { data: all } = await fetchExport({
      variables: { compte_id: compteId ?? undefined, date_debut: debut, date_fin: fin, limit: 5000, offset: 0 },
    });
    exporterCsv('tresorerie', csvMouvements, all?.tresorieComplete?.data ?? []);
  }

  async function printEtat() {
    // Tous les mouvements de la période (pas seulement la page affichée)
    const { data: all } = await fetchAll({
      variables: { compte_id: compteId ?? undefined, date_debut: debut, date_fin: fin, limit: 2000, offset: 0 },
    });
    const full: TresorieCompleteResult | undefined = all?.tresorieComplete;
    if (!full) return;
    const compte = compteId != null
      ? (soldes.find((c) => c.compte_id === compteId)?.compte ?? `Compte ${compteId}`)
      : 'Tous les comptes';
    setPrintDoc(buildTresoreriePrint(
      { res: full, compte, debut, fin },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  const columns: Column<MouvementTresorie>[] = [
    { key: 'date', header: 'Date', width: '90px', render: (m) => fmtDate(m.date) },
    { key: 'categorie', header: 'Catégorie', width: '130px', render: (m) => <span className="text-ink-label font-semibold">{m.categorie ?? m.cle?.replace(/\d+$/, '') ?? '—'}</span> },
    { key: 'tier', header: 'Tiers / libellé', render: (m) => <span>{m.tier || m.objet || m.code_tier || m.observation || '—'}</span> },
    { key: 'compte', header: 'Compte', width: '120px', render: (m) => <span className="text-ink-muted">{m.compte ?? '—'}</span> },
    { key: 'mode', header: 'Mode', width: '90px', render: (m) => <span className="text-ink-muted">{m.mode_payement ?? '—'}</span> },
    { key: 'user', header: 'Utilisateur', width: '90px', render: (m) => <span className="text-ink-muted">{m.user ?? '—'}</span> },
    { key: 'montant', header: 'Montant', align: 'right', width: '120px', render: (m) => (
      <span className="money font-semibold" style={{ color: Number(m.montant) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {Number(m.montant) >= 0 ? '+' : ''}{fmtMoney(m.montant)}
      </span>
    ) },
    { key: 'solde', header: 'Solde cumulé', align: 'right', width: '120px', render: (m) => <span className="money">{fmtMoney(m.solde_cumul)}</span> },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Trésorerie">
        <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); setOffset(0); }} />
        <button onClick={() => void printEtat()} disabled={printing}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
          {printing ? 'Préparation…' : "Imprimer l'état"}
        </button>
        <button onClick={() => void exporter()} disabled={exporting}
                title="Exporter tous les mouvements en CSV (Excel)"
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
          {exporting ? 'Export…' : '⬇ CSV'}
        </button>
        <button onClick={() => setMouvement('transfert')}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
          Transfert
        </button>
        <button onClick={() => setMouvement('decaissement')}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line"
                style={{ color: 'var(--danger)' }}>
          − Décaissement
        </button>
        <button onClick={() => setMouvement('encaissement')}
                className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Encaissement
        </button>
      </PageHeader>
      {mouvement && (
        <MouvementCaisseModal kind={mouvement} onClose={() => setMouvement(null)}
                              onDone={() => { void refetchMvts(); void refetchSoldes(); }} />
      )}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}

      <div className="flex gap-3 flex-wrap">
        <CompteCard label="Tous les comptes" solde={soldes.reduce((s, c) => s + Number(c.solde ?? 0), 0)}
                    active={compteId === null} onClick={() => { setCompteId(null); setOffset(0); }} />
        {soldes.map((c) => (
          <CompteCard key={c.compte_id ?? c.compte} label={c.compte} solde={c.solde}
                      active={compteId === c.compte_id} onClick={() => { setCompteId(c.compte_id ?? null); setOffset(0); }} />
        ))}
      </div>

      {res && (
        <div className="text-[11.5px] text-ink-muted">
          Solde initial : <span className="money">{fmtMoney(res.solde_initial)}</span>
          {' · '}Crédits : <span className="money" style={{ color: 'var(--success)' }}>{fmtMoney(res.total_credit)}</span>
          {' · '}Débits : <span className="money" style={{ color: 'var(--danger)' }}>{fmtMoney(res.total_debit)}</span>
          {' · '}Solde final : <b className="money text-ink">{fmtMoney(res.solde_final)}</b>
        </div>
      )}

      <DataGrid columns={columns} rows={rows} rowKey={(m) => m.cle} loading={loading} error={error?.message}
                footer={{ _label: `${res?.total ?? 0} mouvement(s)` }} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={setOffset} />}
    </div>
  );
}

function CompteCard({ label, solde, active, onClick }: { label: string; solde: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className={`text-left bg-surface border rounded-md shadow-soft px-3.5 py-2.5 min-w-[170px] ${active ? 'border-brand-500' : 'border-line-soft'}`}
            style={active ? { boxShadow: '0 0 0 2px var(--brand-100)' } : undefined}>
      <div className="text-[10.5px] font-bold text-ink-muted">{label}</div>
      <div className="money text-[15px] font-extrabold mt-0.5">{fmtMoney(solde)} DA</div>
    </button>
  );
}
