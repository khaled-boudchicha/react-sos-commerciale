import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ETAT_CLIENT, FACTURES_NON_REGLEES, COORDONNEES_SOCIETE, SET_CREDIT_INITIAL_CLIENT } from '../api/queries';
import { useToast } from '../components/ui/Toast';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeEtatClient, demandeImpayes } from '../impression/demandes';
import { fmtDate, fmtMoney, isoToday } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Money, PageHeader, StatusPill, Tabs, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, DescriptionList } from '../components/ui/Card';
import { DateRangeField, Field, TextInput } from '../components/ui/Field';
import { KpiTile } from '../components/ui/Kpi';
import { Alert, Skeleton } from '../components/ui/States';
import Dialog from '../components/ui/Dialog';
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
  { code: 'releve', label: 'Relevé', icon: 'statement' },
  { code: 'impayees', label: 'Factures non réglées', icon: 'invoice' },
  { code: 'avances', label: 'Avances', icon: 'wallet' },
] as const;

export default function ClientDetail() {
  const { code } = useParams();
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>('releve');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');

  const [showRegler, setShowRegler] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
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
      <Money value={l.montant} colorNeg={false} tone={Number(l.montant) < 0 ? 'success' : undefined} className="font-semibold" />
    ) },
    { key: 'cumul', header: 'Solde cumulé', align: 'right', width: '120px', sortAccessor: (l) => Number(l.total_cumul ?? 0), render: (l) => <span className="money">{fmtMoney(l.total_cumul)}</span> },
  ];

  const fnrCols: Column<FactureNR>[] = [
    { key: 'numero', header: 'Pièce', sortAccessor: (f) => `${f.type_facture ?? ''} ${f.numero ?? ''}`, render: (f) => <span><span className="font-semibold text-ink-label">{f.type_facture}</span> <span className="money">{f.numero}</span></span> },
    { key: 'date', header: 'Date', width: '90px', render: (f) => fmtDate(f.date) },
    { key: 'net', header: 'Montant', align: 'right', width: '115px', sortAccessor: (f) => Number(f.net_a_payer ?? 0), render: (f) => <Money value={f.net_a_payer} /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '115px', render: (f) => <Money value={f.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '115px', sortAccessor: (f) => Number(f.reste_a_payer ?? 0), render: (f) => (
      <Money value={f.reste_a_payer} tone="danger" className="font-semibold" />
    ) },
  ];

  const titre = client?.nom_client ?? `Client ${code}`;
  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} icon="user" backTo="/tiers" backLabel="Retour aux tiers"
                  breadcrumb={[{ label: 'Tiers', to: '/tiers' }, { label: 'Clients', to: '/tiers?vue=clients' }, { label: titre }]}
                  meta={client && (Number(client.credit) <= 0
                    ? <StatusPill tone="ok">À jour</StatusPill>
                    : <StatusPill tone="warn">Nous doit</StatusPill>)}>
        {client && (
          <>
            <Button icon="printer" onClick={() => setPrintDoc(demandeEtatClient({ client, lignes, debut, fin }, societe))}>
              Imprimer le relevé
            </Button>
            {peut('tiers', D.tiers.clients) && (
              <Button icon="edit" onClick={() => setShowCredit(true)}>Crédit initial</Button>
            )}
            <Button variant="primary" icon="cash" onClick={() => setShowRegler(true)}>Régler</Button>
          </>
        )}
      </PageHeader>
      {error && (
        <Alert tone="danger" action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      )}

      {!client && loading && <Card><Skeleton lines={3} /></Card>}
      {client && (
        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-3">
          <Card>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 flex-none rounded-md bg-brand-soft text-brand-text font-extrabold flex items-center justify-center">
                {client.nom_client?.slice(0, 2).toUpperCase()}
              </div>
              <DescriptionList columns={4} className="flex-1" items={[
                { label: 'Code', value: client.code_cli, mono: true, full: true },
                { label: 'CA', value: fmtMoney(client.ca), mono: true },
                { label: 'Crédit initial', value: fmtMoney(client.credit_initial), mono: true },
                { label: 'Réglé', value: fmtMoney(client.regler), mono: true },
                { label: 'Avances', value: fmtMoney(client.solde_avance), mono: true },
              ]} />
            </div>
          </Card>
          <KpiTile label="Solde" icon="wallet"
                   tone={Number(client.credit) > 0 ? 'warning' : 'success'}
                   valueTone={Number(client.credit) > 0 ? 'warning' : 'success'}
                   value={`${fmtMoney(client.credit)} DA`}
                   sub={Number(client.credit) > 0 ? 'Créance du client' : 'Aucune somme due'} />
        </div>
      )}

      {showCredit && client && (
        <CreditInitialModal codeCli={client.code_cli} nom={client.nom_client || client.code_cli}
                            actuel={Number(client.credit_initial ?? 0)}
                            onClose={() => setShowCredit(false)}
                            onDone={() => { setShowCredit(false); void refetch(); void refetchFnr(); toast.success('Crédit initial mis à jour.'); }} />
      )}

      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      {showRegler && client && (
        <ReglerTiersModal kind="client" codeTiers={client.code_cli} nom={client.nom_client || client.code_cli}
                          onClose={() => setShowRegler(false)}
                          onDone={() => { void refetch(); void refetchFnr(); }} />
      )}

      <Tabs value={vue} onChange={setVue} options={VUES} variant="underline" label="Vues du client" />
      {vue === 'releve' && (
        <Toolbar>
          <DateRangeField from={debut} to={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        </Toolbar>
      )}

      {vue === 'releve' && (
        <DataGrid complet columns={relCols} rows={lignes} rowKey={(_l, i) => i} loading={loading}
                  emptyMessage="Aucune opération sur la période." />
      )}
      {vue === 'impayees' && impayees.length > 0 && client && (
        <Toolbar>
          <Button size="sm" icon="printer"
                  onClick={() => setPrintDoc(demandeImpayes({ codeCli: client.code_cli, nom: client.nom_client, factures: impayees }, societe))}>
            Imprimer la situation des impayés
          </Button>
        </Toolbar>
      )}
      {vue === 'impayees' && (
        <DataGrid complet columns={fnrCols} rows={impayees} rowKey={(f) => f.id} loading={fnrLoading}
                  emptyMessage="Aucune facture en attente."
                  footer={{ _label: `${impayees.length} facture(s)`,
                            reste: <Money value={impayees.reduce((s, f) => s + Number(f.reste_a_payer), 0)} tone="danger" /> }} />
      )}
      {/* L'imputation d'une avance modifie le relevé et les impayés : on les recharge. */}
      {vue === 'avances' && code && (
        <AvancesPanel sens="client" code={code} onChanged={() => { void refetch(); void refetchFnr(); }} />
      )}
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
    <Dialog title={`Crédit initial — ${nom}`} size="sm" icon="wallet" onClose={onClose} closeOnOverlay={false}
            footer={(
              <>
                <Button onClick={onClose} disabled={loading}>Annuler</Button>
                <Button variant="primary" icon="save" onClick={() => void valider()} loading={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </>
            )}>
      <p className="text-sm text-ink-muted mb-4">
        Solde de départ du client (créance d'ouverture). Remplace la valeur actuelle ; les paiements
        déjà faits sur ce crédit sont conservés, le montant ne peut donc pas descendre en dessous.
      </p>
      {erreur && <Alert tone="danger" compact className="mb-3">{erreur}</Alert>}
      <Field label="Montant (DA)" required>
        <TextInput type="number" step="0.01" value={montant} autoFocus mono align="right"
                   onChange={(e) => setMontant(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') void valider(); }} />
      </Field>
    </Dialog>
  );
}
