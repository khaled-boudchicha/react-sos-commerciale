import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ETAT_FOURNISSEUR, COORDONNEES_SOCIETE } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Money, PageHeader, StatusPill, Tabs, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, DescriptionList } from '../components/ui/Card';
import { DateRangeField } from '../components/ui/Field';
import { KpiTile } from '../components/ui/Kpi';
import { Alert, Skeleton } from '../components/ui/States';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeEtatFournisseur } from '../impression/demandes';
import type { EtatFournisseurSolde, EtatFournisseurLigne } from '../impression/donnees';
import ReglerTiersModal from '../components/ReglerTiersModal';
import AvancesPanel from '../components/AvancesPanel';

const VUES = [
  { code: 'releve', label: 'Relevé', icon: 'statement' },
  { code: 'avances', label: 'Avances', icon: 'wallet' },
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
      <Money value={l.montant} colorNeg={false} tone={Number(l.montant) < 0 ? 'success' : undefined} className="font-semibold" />
    ) },
    { key: 'cumul', header: 'Solde cumulé', align: 'right', width: '120px', sortAccessor: (l) => Number(l.total_cumul ?? 0), render: (l) => <span className="money">{fmtMoney(l.total_cumul)}</span> },
  ];

  const titre = fournisseur?.nom ?? `Fournisseur ${code}`;
  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} icon="building" backTo="/tiers" backLabel="Retour aux tiers"
                  breadcrumb={[{ label: 'Tiers', to: '/tiers' }, { label: 'Fournisseurs', to: '/tiers?vue=fournisseurs' }, { label: titre }]}
                  meta={fournisseur && (Number(fournisseur.credit) <= 0
                    ? <StatusPill tone="ok">À jour</StatusPill>
                    : <StatusPill tone="warn">À payer</StatusPill>)}>
        {fournisseur && (
          <>
            <Button icon="printer" onClick={() => setPrintDoc(demandeEtatFournisseur({ fournisseur, lignes, debut, fin }, societe))}>
              Imprimer le relevé
            </Button>
            <Button variant="primary" icon="cash" onClick={() => setShowRegler(true)}>Payer</Button>
          </>
        )}
      </PageHeader>
      {error && (
        <Alert tone="danger" action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      )}

      {!fournisseur && loading && <Card><Skeleton lines={3} /></Card>}
      {fournisseur && (
        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-3">
          <Card>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 flex-none rounded-md bg-brand-soft text-brand-text font-extrabold flex items-center justify-center">
                {(fournisseur.nom || fournisseur.code_four).slice(0, 2).toUpperCase()}
              </div>
              <DescriptionList columns={3} className="flex-1" items={[
                { label: 'Code', value: fournisseur.code_four, mono: true, full: true },
                { label: 'Total achats', value: fmtMoney(fournisseur.total_achats), mono: true },
                { label: 'Crédit initial', value: fmtMoney(fournisseur.credit_initial), mono: true },
                { label: 'Réglé', value: fmtMoney(fournisseur.regler), mono: true },
              ]} />
            </div>
          </Card>
          <KpiTile label="Solde (on lui doit)" icon="wallet"
                   tone={Number(fournisseur.credit) > 0 ? 'warning' : 'success'}
                   valueTone={Number(fournisseur.credit) > 0 ? 'warning' : 'success'}
                   value={`${fmtMoney(fournisseur.credit)} DA`}
                   sub={Number(fournisseur.credit) > 0 ? 'Reste à payer au fournisseur' : 'Aucune somme due'} />
        </div>
      )}

      {showRegler && fournisseur && (
        <ReglerTiersModal kind="fournisseur" codeTiers={fournisseur.code_four}
                          nom={fournisseur.nom || fournisseur.code_four}
                          onClose={() => setShowRegler(false)}
                          onDone={() => { void refetch(); }} />
      )}

      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      <Tabs value={vue} onChange={setVue} options={VUES} variant="underline" label="Vues du fournisseur" />
      {vue === 'releve' && (
        <Toolbar>
          <DateRangeField from={debut} to={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        </Toolbar>
      )}

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
