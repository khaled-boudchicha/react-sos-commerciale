import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ETAT_CLIENT, FACTURES_NON_REGLEES, COORDONNEES_SOCIETE, SET_CREDIT_INITIAL_CLIENT } from '../api/queries';
import { useToast } from '../components/ui/Toast';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildEtatClientPrint, buildFacturesNonRegleesPrint } from '../print/templates';
import { fmtDate, fmtMoney, isoToday } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Money, PageHeader, StatusPill, Tabs, PeriodPicker } from '../components/ui/atoms';
import ReglerTiersModal from '../components/ReglerTiersModal';
import AvancesPanel from '../components/AvancesPanel';
import { D, useDroits } from '../lib/droits';

type CreditDetails = {
  code_cli: string; nom_client: string; credit_initial: number; total_ventes: number;
  total_avoirs: number; regler: number; credit: number; solde_avance: number; ca: number;
};
type EtatLigne = {
  type_doc: string; numero?: string | null; date: string; montant: number;
  total_cumul: number; mode_payement?: string | null; observation?: string | null;
};
type FactureNR = {
  id: number; numero: string; type_facture: string; date: string;
  net_a_payer: number; regler: number; reste_a_payer: number; mode_payement?: string | null;
};

const VUES = [
  { code: 'releve', label: 'Relevé' },
  { code: 'impayees', label: 'Factures non réglées' },
  { code: 'avances', label: 'Avances' },
] as const;

export default function ClientDetail() {
  const { code } = useParams();
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>('releve');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');

  const [showRegler, setShowRegler] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const toast = useToast();
  const { peut } = useDroits();
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const societe = (socData?.coordonneesSociete ?? {}) as Record<string, unknown>;

  const { data, loading, error, refetch } = useQuery(ETAT_CLIENT, {
    variables: { code_cli: code, date_debut: debut || undefined, date_fin: fin || undefined },
  });
  const { data: fnrData, loading: fnrLoading, refetch: refetchFnr } = useQuery(FACTURES_NON_REGLEES, { variables: { code_cli: code } });

  const client: CreditDetails | undefined = data?.etatClient?.client;
  const lignes: EtatLigne[] = data?.etatClient?.lignes ?? [];
  const impayees: FactureNR[] = Array.isArray(fnrData?.facturesNonReglees) ? fnrData.facturesNonReglees : [];

  const relCols: Column<EtatLigne>[] = [
    { key: 'date', header: 'Date', width: '90px', render: (l) => fmtDate(l.date) },
    { key: 'type', header: 'Opération', sortAccessor: (l) => l.type_doc ?? '', width: '140px', render: (l) => <span className="font-semibold text-ink-label">{l.type_doc}</span> },
    { key: 'numero', header: 'N°', width: '130px', render: (l) => <span className="money">{l.numero ?? '—'}</span> },
    { key: 'mode', header: 'Mode', width: '90px', sortAccessor: (l) => l.mode_payement ?? '', render: (l) => <span className="text-ink-muted">{l.mode_payement ?? '—'}</span> },
    { key: 'montant', header: 'Montant', align: 'right', width: '120px', render: (l) => (
      <span className="money font-semibold" style={{ color: Number(l.montant) < 0 ? 'var(--success)' : undefined }}>{fmtMoney(l.montant)}</span>
    ) },
    { key: 'cumul', header: 'Solde cumulé', align: 'right', width: '120px', sortAccessor: (l) => Number(l.total_cumul ?? 0), render: (l) => <span className="money">{fmtMoney(l.total_cumul)}</span> },
  ];

  const fnrCols: Column<FactureNR>[] = [
    { key: 'numero', header: 'Pièce', sortAccessor: (f) => `${f.type_facture ?? ''} ${f.numero ?? ''}`, render: (f) => <span><span className="font-semibold text-ink-label">{f.type_facture}</span> <span className="money">{f.numero}</span></span> },
    { key: 'date', header: 'Date', width: '90px', render: (f) => fmtDate(f.date) },
    { key: 'net', header: 'Montant', align: 'right', width: '115px', sortAccessor: (f) => Number(f.net_a_payer ?? 0), render: (f) => <Money value={f.net_a_payer} /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '115px', render: (f) => <Money value={f.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '115px', sortAccessor: (f) => Number(f.reste_a_payer ?? 0), render: (f) => (
      <span className="money font-semibold" style={{ color: 'var(--danger)' }}>{fmtMoney(f.reste_a_payer)}</span>
    ) },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={client?.nom_client ?? `Client ${code}`}>
        <Link to="/tiers" className="text-[12px] font-bold text-brand-700">← Retour aux tiers</Link>
      </PageHeader>
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}

      {client && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3.5 flex items-center gap-6 flex-wrap">
          <div className="w-11 h-11 rounded-md bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center">
            {client.nom_client?.slice(0, 2).toUpperCase()}
          </div>
          <Head label="Code"><span className="money">{client.code_cli}</span></Head>
          <Head label="CA"><span className="money">{fmtMoney(client.ca)}</span></Head>
          <Head label="Crédit initial"><span className="money">{fmtMoney(client.credit_initial)}</span></Head>
          <Head label="Réglé"><span className="money">{fmtMoney(client.regler)}</span></Head>
          <Head label="Avances"><span className="money">{fmtMoney(client.solde_avance)}</span></Head>
          <div className="ml-auto text-right">
            <div className="text-[10px] font-bold uppercase text-ink-muted">Solde</div>
            <div className="money text-[19px] font-extrabold" style={{ color: Number(client.credit) > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {fmtMoney(client.credit)} DA
            </div>
          </div>
          {Number(client.credit) <= 0
            ? <StatusPill tone="ok">À jour</StatusPill>
            : <StatusPill tone="warn">Nous doit</StatusPill>}
          <button onClick={() => setPrintDoc(buildEtatClientPrint({ client, lignes, debut, fin }, societe))}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Imprimer le relevé
          </button>
          {peut('tiers', D.tiers.clients) && (
            <button onClick={() => setShowCredit(true)}
                    className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
              Crédit initial
            </button>
          )}
          <button onClick={() => setShowRegler(true)}
                  className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
            Régler
          </button>
        </div>
      )}

      {showCredit && client && (
        <CreditInitialModal codeCli={client.code_cli} nom={client.nom_client || client.code_cli}
                            actuel={Number(client.credit_initial ?? 0)}
                            onClose={() => setShowCredit(false)}
                            onDone={() => { setShowCredit(false); void refetch(); void refetchFnr(); toast.success('Crédit initial mis à jour.'); }} />
      )}

      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}

      {showRegler && client && (
        <ReglerTiersModal kind="client" codeTiers={client.code_cli} nom={client.nom_client || client.code_cli}
                          onClose={() => setShowRegler(false)}
                          onDone={() => { void refetch(); void refetchFnr(); }} />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={vue} onChange={setVue} options={VUES} />
        {vue === 'releve' && (
          <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        )}
      </div>

      {vue === 'releve' && (
        <DataGrid complet columns={relCols} rows={lignes} rowKey={(_l, i) => i} loading={loading}
                  emptyMessage="Aucune opération sur la période." />
      )}
      {vue === 'impayees' && impayees.length > 0 && client && (
        <div>
          <button onClick={() => setPrintDoc(buildFacturesNonRegleesPrint({ codeCli: client.code_cli, nom: client.nom_client, factures: impayees }, societe))}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Imprimer la situation des impayés
          </button>
        </div>
      )}
      {vue === 'impayees' && (
        <DataGrid complet columns={fnrCols} rows={impayees} rowKey={(f) => f.id} loading={fnrLoading}
                  emptyMessage="Aucune facture en attente."
                  footer={{ _label: `${impayees.length} facture(s)`,
                            reste: <span className="money" style={{ color: 'var(--danger)' }}>{fmtMoney(impayees.reduce((s, f) => s + Number(f.reste_a_payer), 0))}</span> }} />
      )}
      {/* L'imputation d'une avance modifie le relevé et les impayés : on les recharge. */}
      {vue === 'avances' && code && (
        <AvancesPanel sens="client" code={code} onChanged={() => { void refetch(); void refetchFnr(); }} />
      )}
    </div>
  );
}

function Head({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-ink-muted">{label}</div>
      <div className="text-[13px] font-semibold">{children}</div>
    </div>
  );
}

/** Définit le crédit initial (solde de départ) d'un client à une date donnée. */
function CreditInitialModal({ codeCli, nom, actuel, onClose, onDone }: {
  codeCli: string; nom: string; actuel: number; onClose: () => void; onDone: () => void;
}) {
  const [montant, setMontant] = useState(String(actuel || ''));
  const [erreur, setErreur] = useState<string | null>(null);
  const [set, { loading }] = useMutation(SET_CREDIT_INITIAL_CLIENT);

  async function valider() {
    setErreur(null);
    const m = parseFloat(montant);
    if (!Number.isFinite(m)) { setErreur('Montant invalide.'); return; }
    try {
      // Delphi ne date pas le crédit initial : la date transmise n'est pas conservée
      await set({ variables: { code: codeCli, montant: m, date: isoToday() } });
      onDone();
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[420px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-extrabold text-[15px]">Crédit initial — {nom}</div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>
        <div className="text-[11.5px] text-ink-muted mb-4">
          Solde de départ du client (créance d'ouverture). Remplace la valeur actuelle ; les paiements
          déjà faits sur ce crédit sont conservés, le montant ne peut donc pas descendre en dessous.
        </div>
        {erreur && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{erreur}</div>
        )}
        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-bold text-ink-label">Montant (DA)
            <input type="number" step="0.01" value={montant} autoFocus
                   onChange={(e) => setMontant(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') void valider(); }}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right font-normal" />
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={loading}
                  className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">Annuler</button>
          <button onClick={() => void valider()} disabled={loading}
                  className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
