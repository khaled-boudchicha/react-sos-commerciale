import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApolloClient, useQuery, useLazyQuery } from '@apollo/client';
import {
  CLIENTS, FOURNISSEURS, DEBITEURS, COORDONNEES_SOCIETE, ETAT_CLIENTS, ETAT_FOURNISSEURS,
  CREATE_CLIENT, UPDATE_CLIENT, DELETE_CLIENT,
  CREATE_FOURNISSEUR, UPDATE_FOURNISSEUR, DELETE_FOURNISSEUR,
} from '../api/queries';
import { useCrud } from '../forms/useCrud';
import { D, useDroits } from '../lib/droits';
import RecouvrementPanel from '../components/RecouvrementPanel';
import { CLIENT_SECTIONS, FOURNISSEUR_SECTIONS } from '../forms/schemas';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeCreances } from '../impression/demandes';
import { ClientsResult, Client, FournisseursResult, Fournisseur, DebiteursResult, Debiteur } from '../api/types';
import { fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import { RequeteDistante } from '../components/grille/types';
import { Money, Tabs, PageHeader, ExportBtn, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Checkbox, SearchField } from '../components/ui/Field';
import { KpiTile } from '../components/ui/Kpi';

// Limite de sécurité pour l'export « tout » : au-delà, on prévient plutôt que
// d'exporter silencieusement une liste tronquée.
const LIMIT_EXPORT = 5000;


const csvClients: ExportColumn<Client>[] = [
  { header: 'Code', value: (c) => c.code },
  { header: 'Nom', value: (c) => `${c.nom ?? ''}${c.prenom ? ' ' + c.prenom : ''}`.trim() },
  { header: 'Téléphone', value: (c) => c.telephone ?? '' },
  { header: 'Ville', value: (c) => c.ville ?? '' },
  { header: 'Plafond crédit', value: (c) => c.plafond_credit, numeric: true },
  { header: 'Solde', value: (c) => c.credit, numeric: true },
];

const csvFournisseurs: ExportColumn<Fournisseur>[] = [
  { header: 'Code', value: (f) => f.code },
  { header: 'Nom', value: (f) => f.nom ?? '' },
  { header: 'Téléphone', value: (f) => f.telephone ?? '' },
  { header: 'Ville', value: (f) => f.ville ?? '' },
  { header: 'Solde', value: (f) => f.credit_initial, numeric: true },
];

const csvDebiteurs: ExportColumn<Debiteur>[] = [
  { header: 'Code', value: (d) => String(d.code_cli ?? '') },
  { header: 'Client', value: (d) => String(d.raison ?? '') },
  { header: 'Factures', value: (d) => Number(d.nb_factures ?? 0), numeric: true },
  { header: 'Jours de retard', value: (d) => Number((d as any).jours_retard ?? 0), numeric: true },
  { header: 'Créance', value: (d) => Number((d as any).montant ?? d.total_reste ?? 0), numeric: true },
];

/** Requête de premier niveau (ni valeurs d'un filtre d'en-tête, ni sous-groupe) : ses champs annexes valent pour la liste */
const estRacine = (req: RequeteDistante) => !req.sauf && (!req.groupe || req.groupe.chemin.length === 0);

const VUES = [
  { code: 'clients', label: 'Clients', icon: 'users' },
  { code: 'fournisseurs', label: 'Fournisseurs', icon: 'building' },
  { code: 'debiteurs', label: 'Débiteurs', icon: 'debtors' },
  { code: 'recouvrement', label: 'Recouvrement', icon: 'history' },
  { code: 'etat_clients', label: 'États clients', icon: 'statement' },
  { code: 'etat_fournisseurs', label: 'États fournisseurs', icon: 'journal' },
] as const;

/** Emplacement de l'action primaire dans l'en-tête : la vue active y projette son bouton « Nouveau … ». */
function ActionEntete({ cible, children }: { cible: HTMLElement | null; children: ReactNode }) {
  return cible ? createPortal(children, cible) : null;
}

export default function Tiers() {
  const { peut } = useDroits();
  // Onglets visibles selon les droits Delphi « Clients » / « Fournisseurs »
  const vues = VUES.filter((v) => (v.code === 'fournisseurs' || v.code === 'etat_fournisseurs')
    ? peut('tiers', D.tiers.fournisseurs) : peut('tiers', D.tiers.clients));
  const [params] = useSearchParams();
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>(vues.find((v) => v.code === params.get('vue'))?.code ?? vues[0]?.code ?? 'clients');
  // Liens directs (ruban) : ?vue=fournisseurs, ?vue=debiteurs…
  useEffect(() => {
    const v = vues.find((x) => x.code === params.get('vue'));
    if (v) setVue(v.code);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState('');
  const [slotAction, setSlotAction] = useState<HTMLElement | null>(null);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Clients & fournisseurs" icon="users"
                  description="Fiches, soldes, créances et recouvrement des tiers">
        <SearchField value={search} onChange={setSearch} placeholder="Nom, code…" label="Rechercher un tiers" width={260} />
        <span ref={setSlotAction} className="contents" />
      </PageHeader>
      <Tabs value={vue} onChange={setVue} options={vues} label="Vues des tiers" />
      {vue === 'clients' && <ClientsGrid search={search} slotAction={slotAction} />}
      {vue === 'fournisseurs' && <FournisseursGrid search={search} slotAction={slotAction} />}
      {vue === 'debiteurs' && <DebiteursGrid search={search} />}
      {vue === 'recouvrement' && <RecouvrementPanel search={search} />}
      {vue === 'etat_clients' && <EtatsGrid sens="client" search={search} />}
      {vue === 'etat_fournisseurs' && <EtatsGrid sens="fournisseur" search={search} />}
    </div>
  );
}

function ClientsGrid({ search, slotAction }: { search: string; slotAction: HTMLElement | null }) {
  const navigate = useNavigate();
  const client = useApolloClient();
  // Incrémenté après création / modification / suppression : recharge la liste
  const [version, setVersion] = useState(0);
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<Client>>(() => ({
    cle: JSON.stringify([search, version]),
    charger: async (grille) => {
      const { data } = await client.query({
        query: CLIENTS, fetchPolicy: 'network-only',
        variables: { search: search || undefined, grille },
      });
      return data.clients as ClientsResult;
    },
  }), [client, search, version]);
  const [fetchAll, { loading: exporting }] = useLazyQuery(CLIENTS, { fetchPolicy: 'network-only' });
  async function exporter() {
    const { data: all } = await fetchAll({ variables: { search: search || undefined, limit: LIMIT_EXPORT, offset: 0 } });
    exporterCsv('clients', csvClients, all?.clients?.data ?? []);
  }
  const crud = useCrud<Client & { id: number }>({
    label: 'client', sections: CLIENT_SECTIONS,
    createDoc: CREATE_CLIENT, updateDoc: UPDATE_CLIENT, deleteDoc: DELETE_CLIENT,
    onDone: () => setVersion((v) => v + 1),
    labelOf: (c) => `${c.nom} (${c.code})`,
  });
  const columns: Column<Client>[] = [
    { key: 'code', header: 'Code', width: '90px', field: 'code', render: (c) => <span className="money">{c.code}</span> },
    { key: 'nom', header: 'Nom', field: 'nom', render: (c) => <b>{c.nom}{c.prenom ? ` ${c.prenom}` : ''}</b> },
    { key: 'tel', header: 'Téléphone', width: '120px', field: 'telephone', render: (c) => <span className="text-ink-muted">{c.telephone ?? '—'}</span> },
    { key: 'ville', header: 'Ville', width: '110px', field: 'ville', render: (c) => <span className="text-ink-muted">{c.ville ?? '—'}</span> },
    { key: 'plafond', header: 'Plafond crédit', align: 'right', width: '120px', render: (c) => <Money value={c.plafond_credit} /> },
    { key: 'solde', header: 'Solde', align: 'right', width: '120px', field: 'credit', render: (c) => (
      <Money value={c.credit} colorNeg={false} tone={Number(c.credit) > 0 ? 'warning' : undefined} className="font-semibold" />
    ) },
    { key: 'actions', header: '', align: 'right', width: '70px', render: (c) => crud.rowActions(c as Client & { id: number }) },
  ];
  return (
    <>
      <ActionEntete cible={slotAction}>
        <Button variant="primary" icon="plus" onClick={crud.openCreate}>Nouveau client</Button>
      </ActionEntete>
      {crud.modals}
      <DataGrid columns={columns} rowKey={(c) => c.id}
                distant={distant} cleEtat="tiers-clients"
                actions={<ExportBtn onClick={() => void exporter()} loading={exporting} />}
                onRowClick={(c) => navigate(`/tiers/client/${encodeURIComponent(c.code)}`)}
                footer={(r) => ({ _label: `${r?.total ?? 0} client(s)` })} />
    </>
  );
}

function FournisseursGrid({ search, slotAction }: { search: string; slotAction: HTMLElement | null }) {
  const navigate = useNavigate();
  const client = useApolloClient();
  // Incrémenté après création / modification / suppression : recharge la liste
  const [version, setVersion] = useState(0);
  const distant = useMemo<DataGridDistant<Fournisseur>>(() => ({
    cle: JSON.stringify([search, version]),
    charger: async (grille) => {
      const { data } = await client.query({
        query: FOURNISSEURS, fetchPolicy: 'network-only',
        variables: { search: search || undefined, grille },
      });
      return data.fournisseurs as FournisseursResult;
    },
  }), [client, search, version]);
  const [fetchAll, { loading: exporting }] = useLazyQuery(FOURNISSEURS, { fetchPolicy: 'network-only' });
  async function exporter() {
    const { data: all } = await fetchAll({ variables: { search: search || undefined, limit: LIMIT_EXPORT, offset: 0 } });
    exporterCsv('fournisseurs', csvFournisseurs, all?.fournisseurs?.data ?? []);
  }
  const crud = useCrud<Fournisseur & { id: number }>({
    label: 'fournisseur', sections: FOURNISSEUR_SECTIONS,
    createDoc: CREATE_FOURNISSEUR, updateDoc: UPDATE_FOURNISSEUR, deleteDoc: DELETE_FOURNISSEUR,
    onDone: () => setVersion((v) => v + 1),
    labelOf: (f) => `${f.nom} (${f.code})`,
  });
  const columns: Column<Fournisseur>[] = [
    { key: 'code', header: 'Code', width: '90px', field: 'code', render: (f) => <span className="money">{f.code}</span> },
    { key: 'nom', header: 'Nom', field: 'nom', render: (f) => <b>{f.nom}</b> },
    { key: 'tel', header: 'Téléphone', width: '120px', field: 'telephone', render: (f) => <span className="text-ink-muted">{f.telephone ?? '—'}</span> },
    { key: 'ville', header: 'Ville', width: '110px', field: 'ville', render: (f) => <span className="text-ink-muted">{f.ville ?? '—'}</span> },
    { key: 'solde', header: 'Solde', align: 'right', width: '120px', field: 'credit_initial', render: (f) => <Money value={f.credit_initial} /> },
    { key: 'actions', header: '', align: 'right', width: '70px', render: (f) => crud.rowActions(f as Fournisseur & { id: number }) },
  ];
  return (
    <>
      <ActionEntete cible={slotAction}>
        <Button variant="primary" icon="plus" onClick={crud.openCreate}>Nouveau fournisseur</Button>
      </ActionEntete>
      {crud.modals}
      <DataGrid columns={columns} rowKey={(f) => f.id}
                distant={distant} cleEtat="tiers-fournisseurs"
                actions={<ExportBtn onClick={() => void exporter()} loading={exporting} />}
                onRowClick={(f) => navigate(`/tiers/fournisseur/${encodeURIComponent(f.code)}`)}
                footer={(r) => ({ _label: `${r?.total ?? 0} fournisseur(s)` })} />
    </>
  );
}

function DebiteursGrid({ search }: { search: string }) {
  const navigate = useNavigate();
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const client = useApolloClient();
  // Totaux et ventilation par ancienneté de la dernière réponse (restreints aux filtres de la grille)
  const [res, setRes] = useState<DebiteursResult | null>(null);
  const distant = useMemo<DataGridDistant<Debiteur>>(() => ({
    cle: JSON.stringify([search]),
    charger: async (grille) => {
      const { data } = await client.query({
        query: DEBITEURS, fetchPolicy: 'network-only',
        variables: { search: search || undefined, grille },
      });
      const r = data.debiteurs as DebiteursResult & { total: number };
      if (estRacine(grille)) setRes(r);
      return r;
    },
  }), [client, search]);
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [fetchAll, { loading: printing }] = useLazyQuery(DEBITEURS, { fetchPolicy: 'network-only' });
  const [fetchExport, { loading: exporting }] = useLazyQuery(DEBITEURS, { fetchPolicy: 'network-only' });

  async function printAll() {
    // Récupère la liste complète (pas seulement la page affichée) pour l'état imprimé
    const { data: all } = await fetchAll({ variables: { search: search || undefined, limit: 1000, offset: 0 } });
    const full: DebiteursResult | undefined = all?.debiteurs;
    if (!full) return;
    setPrintDoc(demandeCreances(
      { rows: full.data ?? [], totaux: full },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  async function exporter() {
    const { data: all } = await fetchExport({ variables: { search: search || undefined, limit: LIMIT_EXPORT, offset: 0 } });
    exporterCsv('debiteurs', csvDebiteurs, all?.debiteurs?.data ?? []);
  }
  // Champs réels du retour GetDebiteurs : code_cli, raison, montant, nb_factures, jours_retard
  const columns: Column<Debiteur>[] = [
    { key: 'code', header: 'Code', width: '90px', field: 'code_cli', render: (d) => <span className="money">{String(d.code_cli ?? '')}</span> },
    { key: 'nom', header: 'Client', field: 'raison', render: (d) => <b>{String(d.raison ?? '')}</b> },
    { key: 'nb', header: 'Factures', align: 'right', width: '80px', field: 'nb_factures', type: 'number', render: (d) => <span className="money">{String(d.nb_factures ?? '')}</span> },
    { key: 'retard', header: 'Retard', align: 'right', width: '80px', field: 'jours_retard', type: 'number', render: (d) => {
      const j = Number((d as any).jours_retard ?? 0);
      return <span className="money" style={{ color: j > 60 ? 'var(--danger-text)' : j > 30 ? 'var(--warning-text)' : undefined }}>{j} j</span>;
    } },
    { key: 'reste', header: 'Créance', align: 'right', width: '130px', field: 'montant', render: (d) => (
      <Money value={(d as any).montant ?? d.total_reste} tone="danger" className="font-semibold" />
    ) },
  ];
  return (
    <>
      {res && (
        <div className="grid grid-cols-4 gap-3">
          <KpiTile label="Total créances" value={fmtMoney(res.total_creances)} icon="debtors" tone="danger" valueTone="danger"
                   sub={`${res.total_clients} clients · ${res.total_factures} factures`} />
          <KpiTile label="0–30 jours" value={fmtMoney(res.bucket_0_30)} icon="clock" tone="neutral" />
          <KpiTile label="30–60 jours" value={fmtMoney(res.bucket_30_60)} icon="clock" tone="warning" valueTone="warning" />
          <KpiTile label="+60 jours" value={fmtMoney(res.bucket_60_plus)} icon="alert" tone="danger" valueTone="danger" />
        </div>
      )}
      {res && (
        <Toolbar className="justify-end">
          <Button icon="printer" onClick={() => void printAll()} disabled={printing}>
            {printing ? 'Préparation…' : "Imprimer l'état des créances"}
          </Button>
          <ExportBtn onClick={() => void exporter()} loading={exporting} />
        </Toolbar>
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rowKey={(d) => String(d.code_cli)}
                distant={distant} cleEtat="tiers-debiteurs"
                onRowClick={(d) => d.code_cli && navigate(`/tiers/client/${encodeURIComponent(String(d.code_cli))}`)}
                footer={(r) => ({
                  _label: `${r?.total ?? 0} débiteur(s)`,
                  reste: r?.total_creances != null
                    ? <Money value={r.total_creances as number} tone="danger" />
                    : undefined,
                })} />
    </>
  );
}



type EtatLigne = Record<string, any> & { code_cli?: string; code_four?: string; nom: string };

/**
 * État financier global des tiers (équivalent EtatClients.pas / StatFournisseurs.pas) :
 * une ligne par tiers avec solde de départ, mouvements de la période et solde final.
 */
function EtatsGrid({ sens, search }: { sens: 'client' | 'fournisseur'; search: string }) {
  const navigate = useNavigate();
  const [sansZeros, setSansZeros] = useState(true);
  const client = sens === 'client';
  const apollo = useApolloClient();
  const distant = useMemo<DataGridDistant<EtatLigne>>(() => ({
    cle: JSON.stringify([sens, search, sansZeros]),
    totaux: [{ field: 'ca', type: 'sum' }],
    charger: async (grille) => {
      const { data } = await apollo.query({
        query: client ? ETAT_CLIENTS : ETAT_FOURNISSEURS, fetchPolicy: 'network-only',
        variables: { search: search || undefined, sans_zeros: sansZeros, grille },
      });
      // total_credit : somme des seuls crédits positifs, renvoyée à part par le serveur
      return (client ? data.etatClients : data.etatFournisseurs) as
        { data: EtatLigne[]; total: number; total_credit?: number; resumes?: Record<string, number | null> };
    },
  }), [apollo, sens, client, search, sansZeros]);

  const [fetchExport, { loading: exporting }] = useLazyQuery(client ? ETAT_CLIENTS : ETAT_FOURNISSEURS, { fetchPolicy: 'network-only' });
  async function exporter() {
    const { data: all } = await fetchExport({ variables: { search: search || undefined, sans_zeros: sansZeros, limit: LIMIT_EXPORT, offset: 0 } });
    const full: EtatLigne[] = (client ? all?.etatClients?.data : all?.etatFournisseurs?.data) ?? [];
    const cols: ExportColumn<EtatLigne>[] = [
      { header: 'Code', value: (l) => l.code_cli ?? l.code_four ?? '' },
      { header: client ? 'Client' : 'Fournisseur', value: (l) => l.nom ?? '' },
      { header: 'Solde départ', value: (l) => Number(l.solde_depart ?? 0), numeric: true },
      { header: client ? 'Ventes' : 'Achats', value: (l) => Number(l.total_ventes ?? l.total_achats ?? 0), numeric: true },
      { header: 'Réglé', value: (l) => Number(l.regler ?? 0), numeric: true },
      { header: 'Solde', value: (l) => Number(l.credit ?? 0), numeric: true },
    ];
    exporterCsv(client ? 'etat-clients' : 'etat-fournisseurs', cols, full);
  }

  const cols: Column<EtatLigne>[] = [
    { key: 'code', header: 'Code', width: '90px', field: client ? 'code_cli' : 'code_four',
      render: (l) => <span className="money">{l.code_cli ?? l.code_four}</span> },
    { key: 'nom', header: client ? 'Client' : 'Fournisseur', field: 'nom', render: (l) => <b>{l.nom || '—'}</b> },
    { key: 'depart', header: 'Solde départ', align: 'right', width: '120px', field: 'solde_depart',
      render: (l) => <span className="money">{fmtMoney(l.solde_depart)}</span> },
    { key: 'mouv', header: client ? 'Ventes' : 'Achats', align: 'right', width: '130px', field: client ? 'total_ventes' : 'total_achats',
      render: (l) => <span className="money">{fmtMoney(l.total_ventes ?? l.total_achats)}</span> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '130px', field: 'regler',
      render: (l) => <span className="money">{fmtMoney(l.regler)}</span> },
    { key: 'ca', header: "Chiffre d'affaires", align: 'right', width: '130px', field: 'ca',
      render: (l) => <span className="money">{fmtMoney(l.ca)}</span> },
    { key: 'credit', header: 'Solde', align: 'right', width: '130px', field: 'credit',
      render: (l) => (
        <Money value={l.credit} colorNeg={false} tone={Number(l.credit) > 0 ? 'warning' : undefined} className="font-semibold" />
      ) },
  ];

  return (
    <>
      <Toolbar className="justify-between">
        <Checkbox label="Masquer les tiers soldés" checked={sansZeros} onChange={(e) => setSansZeros(e.target.checked)} />
        <ExportBtn onClick={() => void exporter()} loading={exporting} />
      </Toolbar>
      <DataGrid columns={cols} rowKey={(l, i) => l.code_cli ?? l.code_four ?? i}
                distant={distant} cleEtat={client ? 'tiers-etat-clients' : 'tiers-etat-fournisseurs'}
                onRowClick={(l) => {
                  const code = l.code_cli ?? l.code_four;
                  if (code) navigate(`/tiers/${client ? 'client' : 'fournisseur'}/${encodeURIComponent(code)}`);
                }}
                footer={(r) => ({
                  _label: `${r?.total ?? 0} tiers`,
                  ca: <span className="money">{fmtMoney(totalDistant(r, 'ca'))}</span>,
                  credit: r?.total_credit != null
                    ? <span className="money">{fmtMoney(r.total_credit as number)}</span>
                    : undefined,
                })} />
    </>
  );
}
