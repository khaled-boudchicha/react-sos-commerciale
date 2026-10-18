import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ETAT_FOURNISSEUR, COORDONNEES_SOCIETE } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { PageHeader, StatusPill, PeriodPicker, Tabs } from '../components/ui/atoms';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeEtatFournisseur } from '../impression/demandes';
import type { EtatFournisseurSolde, EtatFournisseurLigne } from '../print/templates/etatFournisseur';
import ReglerTiersModal from '../components/ReglerTiersModal';
import AvancesPanel from '../components/AvancesPanel';

const VUES = [
  { code: 'releve', label: 'Relevé' },
  { code: 'avances', label: 'Avances' },
] as const;

export default function FournisseurDetail() {
  const { code } = useParams();
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const [showRegler, setShowRegler] = useState(false);
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>('releve');

  const { data, loading, error, refetch } = useQuery(ETAT_FOURNISSEUR, {
    variables: { code_four: code, date_debut: debut || undefined, date_fin: fin || undefined },
  });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const societe = (socData?.coordonneesSociete ?? {}) as Record<string, unknown>;

  const fournisseur: EtatFournisseurSolde | undefined = data?.etatFournisseur?.fournisseur;
  const lignes: EtatFournisseurLigne[] = data?.etatFournisseur?.lignes ?? [];

  const cols: Column<EtatFournisseurLigne>[] = [
    { key: 'date', header: 'Date', width: '90px', render: (l) => fmtDate(l.date) },
    { key: 'type', header: 'Opération', sortAccessor: (l) => l.type_doc ?? '', width: '150px', render: (l) => <span className="font-semibold text-ink-label">{l.type_doc}</span> },
    { key: 'numero', header: 'N°', width: '130px', render: (l) => <span className="money">{l.numero ?? '—'}</span> },
    { key: 'mode', header: 'Mode', width: '90px', sortAccessor: (l) => l.mode_payement ?? '', render: (l) => <span className="text-ink-muted">{l.mode_payement ?? '—'}</span> },
    { key: 'montant', header: 'Montant', align: 'right', width: '120px', render: (l) => (
      <span className="money font-semibold" style={{ color: Number(l.montant) < 0 ? 'var(--success)' : undefined }}>{fmtMoney(l.montant)}</span>
    ) },
    { key: 'cumul', header: 'Solde cumulé', align: 'right', width: '120px', sortAccessor: (l) => Number(l.total_cumul ?? 0), render: (l) => <span className="money">{fmtMoney(l.total_cumul)}</span> },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={fournisseur?.nom ?? `Fournisseur ${code}`}>
        <Link to="/tiers" className="text-[12px] font-bold text-brand-700">← Retour aux tiers</Link>
      </PageHeader>
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}

      {fournisseur && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3.5 flex items-center gap-6 flex-wrap">
          <div className="w-11 h-11 rounded-md bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center">
            {(fournisseur.nom || fournisseur.code_four).slice(0, 2).toUpperCase()}
          </div>
          <Head label="Code"><span className="money">{fournisseur.code_four}</span></Head>
          <Head label="Total achats"><span className="money">{fmtMoney(fournisseur.total_achats)}</span></Head>
          <Head label="Crédit initial"><span className="money">{fmtMoney(fournisseur.credit_initial)}</span></Head>
          <Head label="Réglé"><span className="money">{fmtMoney(fournisseur.regler)}</span></Head>
          <div className="ml-auto text-right">
            <div className="text-[10px] font-bold uppercase text-ink-muted">Solde (on lui doit)</div>
            <div className="money text-[19px] font-extrabold" style={{ color: Number(fournisseur.credit) > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {fmtMoney(fournisseur.credit)} DA
            </div>
          </div>
          {Number(fournisseur.credit) <= 0
            ? <StatusPill tone="ok">À jour</StatusPill>
            : <StatusPill tone="warn">À payer</StatusPill>}
          <button onClick={() => setPrintDoc(demandeEtatFournisseur({ fournisseur, lignes, debut, fin }, societe))}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Imprimer le relevé
          </button>
          <button onClick={() => setShowRegler(true)}
                  className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
            Payer
          </button>
        </div>
      )}

      {showRegler && fournisseur && (
        <ReglerTiersModal kind="fournisseur" codeTiers={fournisseur.code_four}
                          nom={fournisseur.nom || fournisseur.code_four}
                          onClose={() => setShowRegler(false)}
                          onDone={() => { void refetch(); }} />
      )}

      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={vue} onChange={setVue} options={VUES} />
        {vue === 'releve' && (
          <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        )}
      </div>

      {vue === 'releve' && (
        <DataGrid complet columns={cols} rows={lignes} rowKey={(_l, i) => i} loading={loading}
                  emptyMessage="Aucune opération sur la période." />
      )}
      {/* L'imputation d'une avance réduit le solde dû : on recharge l'état du fournisseur. */}
      {vue === 'avances' && code && (
        <AvancesPanel sens="fournisseur" code={code} onChanged={() => { void refetch(); }} />
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
