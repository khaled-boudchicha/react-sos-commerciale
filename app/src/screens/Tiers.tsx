import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useLazyQuery } from '@apollo/client';
import {
  CLIENTS, FOURNISSEURS, DEBITEURS, COORDONNEES_SOCIETE, ETAT_CLIENTS, ETAT_FOURNISSEURS,
  CREATE_CLIENT, UPDATE_CLIENT, DELETE_CLIENT,
  CREATE_FOURNISSEUR, UPDATE_FOURNISSEUR, DELETE_FOURNISSEUR,
} from '../api/queries';
import { useCrud } from '../forms/useCrud';
import { CLIENT_SECTIONS, FOURNISSEUR_SECTIONS } from '../forms/schemas';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildDebiteursPrint } from '../print/templates';
import { ClientsResult, Client, FournisseursResult, Fournisseur, DebiteursResult, Debiteur } from '../api/types';
import { fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Money, Tabs, PageHeader, Pagination, SearchInput } from '../components/ui/atoms';

const LIMIT = 50;
// Limite de sécurité pour l'export « tout » : au-delà, on prévient plutôt que
// d'exporter silencieusement une liste tronquée.
const LIMIT_EXPORT = 5000;

/** Bouton d'export CSV de la liste COMPLÈTE (au-delà de la page affichée). */
function ExportBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
            title="Exporter la liste complète en CSV (Excel)"
            className="rounded-md px-3 py-1.5 font-semibold text-[11.5px] border border-line-soft bg-surface hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed">
      {loading ? 'Export…' : '⬇ Exporter CSV'}
    </button>
  );
}

const csvClients: ExportColumn<Client>[] = [
  { header: 'Code', value: (c) => c.code },
  { header: 'Nom', value: (c) => `${c.nom ?? ''}${c.prenom ? ' ' + c.prenom : ''}`.trim() },
  { header: 'Téléphone', value: (c) => c.telephone ?? '' },
  { header: 'Ville', value: (c) => c.ville ?? '' },
  { header: 'Plafond crédit', value: (c) => c.plafond_credit, numeric: true },
  { header: 'Solde', value: (c) => c.ancien_credit, numeric: true },
];

const csvFournisseurs: ExportColumn<Fournisseur>[] = [
  { header: 'Code', value: (f) => f.code },
  { header: 'Nom', value: (f) => f.nom ?? '' },
  { header: 'Téléphone', value: (f) => f.telephone ?? '' },
  { header: 'Ville', value: (f) => f.ville ?? '' },
  { header: 'Solde', value: (f) => f.ancien_credit, numeric: true },
];

const csvDebiteurs: ExportColumn<Debiteur>[] = [
  { header: 'Code', value: (d) => String(d.code_cli ?? '') },
  { header: 'Client', value: (d) => String(d.raison ?? '') },
  { header: 'Factures', value: (d) => Number(d.nb_factures ?? 0), numeric: true },
  { header: 'Jours de retard', value: (d) => Number((d as any).jours_retard ?? 0), numeric: true },
  { header: 'Créance', value: (d) => Number((d as any).montant ?? d.total_reste ?? 0), numeric: true },
];
const VUES = [
  { code: 'clients', label: 'Clients' },
  { code: 'fournisseurs', label: 'Fournisseurs' },
  { code: 'debiteurs', label: 'Débiteurs' },
  { code: 'etat_clients', label: 'États clients' },
  { code: 'etat_fournisseurs', label: 'États fournisseurs' },
] as const;

export default function Tiers() {
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>('clients');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Clients & fournisseurs">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0); }} placeholder="Nom, code…" />
      </PageHeader>
      <Tabs value={vue} onChange={(v) => { setVue(v); setOffset(0); }} options={VUES} />
      {vue === 'clients' && <ClientsGrid search={search} offset={offset} onOffset={setOffset} />}
      {vue === 'fournisseurs' && <FournisseursGrid search={search} offset={offset} onOffset={setOffset} />}
      {vue === 'debiteurs' && <DebiteursGrid search={search} offset={offset} onOffset={setOffset} />}
      {vue === 'etat_clients' && <EtatsGrid sens="client" search={search} offset={offset} onOffset={setOffset} />}
      {vue === 'etat_fournisseurs' && <EtatsGrid sens="fournisseur" search={search} offset={offset} onOffset={setOffset} />}
    </div>
  );
}

function ClientsGrid({ search, offset, onOffset }: { search: string; offset: number; onOffset: (o: number) => void }) {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(CLIENTS, { variables: { search: search || undefined, limit: LIMIT, offset } });
  const res: ClientsResult | undefined = data?.clients;
  const [fetchAll, { loading: exporting }] = useLazyQuery(CLIENTS, { fetchPolicy: 'network-only' });
  async function exporter() {
    const { data: all } = await fetchAll({ variables: { search: search || undefined, limit: LIMIT_EXPORT, offset: 0 } });
    exporterCsv('clients', csvClients, all?.clients?.data ?? []);
  }
  const crud = useCrud<Client & { id: number }>({
    label: 'client', sections: CLIENT_SECTIONS,
    createDoc: CREATE_CLIENT, updateDoc: UPDATE_CLIENT, deleteDoc: DELETE_CLIENT,
    onDone: () => { void refetch(); },
    labelOf: (c) => `${c.nom} (${c.code})`,
  });
  const columns: Column<Client>[] = [
    { key: 'code', header: 'Code', width: '90px', render: (c) => <span className="money">{c.code}</span> },
    { key: 'nom', header: 'Nom', render: (c) => <b>{c.nom}{c.prenom ? ` ${c.prenom}` : ''}</b> },
    { key: 'tel', header: 'Téléphone', width: '120px', render: (c) => <span className="text-ink-muted">{c.telephone ?? '—'}</span> },
    { key: 'ville', header: 'Ville', width: '110px', render: (c) => <span className="text-ink-muted">{c.ville ?? '—'}</span> },
    { key: 'plafond', header: 'Plafond crédit', align: 'right', width: '120px', render: (c) => <Money value={c.plafond_credit} /> },
    { key: 'solde', header: 'Solde', align: 'right', width: '120px', render: (c) => (
      <span className="money font-semibold" style={{ color: Number(c.ancien_credit) > 0 ? 'var(--warning)' : undefined }}>{fmtMoney(c.ancien_credit)}</span>
    ) },
    { key: 'actions', header: '', align: 'right', width: '70px', render: (c) => crud.rowActions(c as Client & { id: number }) },
  ];
  return (
    <>
      <div className="flex">
        <button onClick={crud.openCreate}
                className="ml-auto rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouveau client
        </button>
      </div>
      {crud.modals}
      <DataGrid columns={columns} rows={res?.data ?? []} rowKey={(c) => c.id} loading={loading} error={error?.message}
                titre={`${res?.total ?? 0} client(s)`}
                actions={<ExportBtn onClick={() => void exporter()} loading={exporting} />}
                onRowClick={(c) => navigate(`/tiers/client/${encodeURIComponent(c.code)}`)}
                footer={{ _label: `${res?.total ?? 0} client(s)` }} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={onOffset} />}
    </>
  );
}

function FournisseursGrid({ search, offset, onOffset }: { search: string; offset: number; onOffset: (o: number) => void }) {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(FOURNISSEURS, { variables: { search: search || undefined, limit: LIMIT, offset } });
  const res: FournisseursResult | undefined = data?.fournisseurs;
  const [fetchAll, { loading: exporting }] = useLazyQuery(FOURNISSEURS, { fetchPolicy: 'network-only' });
  async function exporter() {
    const { data: all } = await fetchAll({ variables: { search: search || undefined, limit: LIMIT_EXPORT, offset: 0 } });
    exporterCsv('fournisseurs', csvFournisseurs, all?.fournisseurs?.data ?? []);
  }
  const crud = useCrud<Fournisseur & { id: number }>({
    label: 'fournisseur', sections: FOURNISSEUR_SECTIONS,
    createDoc: CREATE_FOURNISSEUR, updateDoc: UPDATE_FOURNISSEUR, deleteDoc: DELETE_FOURNISSEUR,
    onDone: () => { void refetch(); },
    labelOf: (f) => `${f.nom} (${f.code})`,
  });
  const columns: Column<Fournisseur>[] = [
    { key: 'code', header: 'Code', width: '90px', render: (f) => <span className="money">{f.code}</span> },
    { key: 'nom', header: 'Nom', render: (f) => <b>{f.nom}</b> },
    { key: 'tel', header: 'Téléphone', width: '120px', render: (f) => <span className="text-ink-muted">{f.telephone ?? '—'}</span> },
    { key: 'ville', header: 'Ville', width: '110px', render: (f) => <span className="text-ink-muted">{f.ville ?? '—'}</span> },
    { key: 'solde', header: 'Solde', align: 'right', width: '120px', render: (f) => <Money value={f.ancien_credit} /> },
    { key: 'actions', header: '', align: 'right', width: '70px', render: (f) => crud.rowActions(f as Fournisseur & { id: number }) },
  ];
  return (
    <>
      <div className="flex">
        <button onClick={crud.openCreate}
                className="ml-auto rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouveau fournisseur
        </button>
      </div>
      {crud.modals}
      <DataGrid columns={columns} rows={res?.data ?? []} rowKey={(f) => f.id} loading={loading} error={error?.message}
                titre={`${res?.total ?? 0} fournisseur(s)`}
                actions={<ExportBtn onClick={() => void exporter()} loading={exporting} />}
                onRowClick={(f) => navigate(`/tiers/fournisseur/${encodeURIComponent(f.code)}`)}
                footer={{ _label: `${res?.total ?? 0} fournisseur(s)` }} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={onOffset} />}
    </>
  );
}

function DebiteursGrid({ search, offset, onOffset }: { search: string; offset: number; onOffset: (o: number) => void }) {
  const navigate = useNavigate();
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const { data, loading, error } = useQuery(DEBITEURS, { variables: { search: search || undefined, limit: LIMIT, offset } });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [fetchAll, { loading: printing }] = useLazyQuery(DEBITEURS, { fetchPolicy: 'network-only' });
  const [fetchExport, { loading: exporting }] = useLazyQuery(DEBITEURS, { fetchPolicy: 'network-only' });
  const res: DebiteursResult | undefined = data?.debiteurs;
  const rows: Debiteur[] = res?.data ?? [];

  async function printAll() {
    // Récupère la liste complète (pas seulement la page affichée) pour l'état imprimé
    const { data: all } = await fetchAll({ variables: { search: search || undefined, limit: 1000, offset: 0 } });
    const full: DebiteursResult | undefined = all?.debiteurs;
    if (!full) return;
    setPrintDoc(buildDebiteursPrint(
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
    { key: 'code', header: 'Code', width: '90px', render: (d) => <span className="money">{String(d.code_cli ?? '')}</span> },
    { key: 'nom', header: 'Client', render: (d) => <b>{String(d.raison ?? '')}</b> },
    { key: 'nb', header: 'Factures', align: 'right', width: '80px', render: (d) => <span className="money">{String(d.nb_factures ?? '')}</span> },
    { key: 'retard', header: 'Retard', align: 'right', width: '80px', render: (d) => {
      const j = Number((d as any).jours_retard ?? 0);
      return <span className="money" style={{ color: j > 60 ? 'var(--danger)' : j > 30 ? 'var(--warning)' : undefined }}>{j} j</span>;
    } },
    { key: 'reste', header: 'Créance', align: 'right', width: '130px', render: (d) => (
      <span className="money font-semibold" style={{ color: 'var(--danger)' }}>{fmtMoney((d as any).montant ?? d.total_reste)}</span>
    ) },
  ];
  return (
    <>
      {res && (
        <div className="grid grid-cols-4 gap-3">
          <Bucket label="Total créances" value={res.total_creances} tone="var(--danger)" sub={`${res.total_clients} clients · ${res.total_factures} factures`} />
          <Bucket label="0–30 jours" value={res.bucket_0_30} tone="var(--text)" />
          <Bucket label="30–60 jours" value={res.bucket_30_60} tone="var(--warning)" />
          <Bucket label="+60 jours" value={res.bucket_60_plus} tone="var(--danger)" />
        </div>
      )}
      {res && (
        <div className="flex gap-2">
          <button onClick={() => void printAll()} disabled={printing}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
            {printing ? 'Préparation…' : "Imprimer l'état des créances"}
          </button>
          <ExportBtn onClick={() => void exporter()} loading={exporting} />
        </div>
      )}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rows={rows} rowKey={(d) => String(d.code_cli)} loading={loading} error={error?.message}
                onRowClick={(d) => d.code_cli && navigate(`/tiers/client/${encodeURIComponent(String(d.code_cli))}`)} />
      {res && res.total_clients > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total_clients} onOffset={onOffset} />}
    </>
  );
}

function Bucket({ label, value, tone, sub }: { label: string; value: number; tone: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft p-3.5">
      <div className="text-[11px] font-semibold text-ink-muted mb-1">{label}</div>
      <div className="money text-[17px] font-extrabold" style={{ color: tone }}>{fmtMoney(value)}</div>
      {sub && <div className="text-[10.5px] text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}


type EtatLigne = Record<string, any> & { code_cli?: string; code_four?: string; nom: string };

/**
 * État financier global des tiers (équivalent EtatClients.pas / StatFournisseurs.pas) :
 * une ligne par tiers avec solde de départ, mouvements de la période et solde final.
 */
function EtatsGrid({ sens, search, offset, onOffset }: {
  sens: 'client' | 'fournisseur'; search: string; offset: number; onOffset: (o: number) => void;
}) {
  const navigate = useNavigate();
  const [sansZeros, setSansZeros] = useState(true);
  const client = sens === 'client';
  const { data, loading, error } = useQuery(client ? ETAT_CLIENTS : ETAT_FOURNISSEURS, {
    variables: { search: search || undefined, sans_zeros: sansZeros, limit: LIMIT, offset },
  });
  const res = (client ? data?.etatClients : data?.etatFournisseurs) as
    { data: EtatLigne[]; total: number; total_credit?: number } | undefined;
  const lignes = res?.data ?? [];

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
    { key: 'code', header: 'Code', width: '90px',
      render: (l) => <span className="money">{l.code_cli ?? l.code_four}</span> },
    { key: 'nom', header: client ? 'Client' : 'Fournisseur', render: (l) => <b>{l.nom || '—'}</b> },
    { key: 'depart', header: 'Solde départ', align: 'right', width: '120px',
      render: (l) => <span className="money">{fmtMoney(l.solde_depart)}</span> },
    { key: 'mouv', header: client ? 'Ventes' : 'Achats', align: 'right', width: '130px',
      render: (l) => <span className="money">{fmtMoney(l.total_ventes ?? l.total_achats)}</span> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '130px',
      render: (l) => <span className="money">{fmtMoney(l.regler)}</span> },
    { key: 'credit', header: 'Solde', align: 'right', width: '130px',
      render: (l) => (
        <span className="money font-semibold"
              style={{ color: Number(l.credit) > 0 ? 'var(--warning)' : undefined }}>
          {fmtMoney(l.credit)}
        </span>
      ) },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <label className="text-[12px] font-semibold text-ink-label flex items-center gap-1.5">
          <input type="checkbox" checked={sansZeros} onChange={(e) => { setSansZeros(e.target.checked); onOffset(0); }} />
          Masquer les tiers soldés
        </label>
        <ExportBtn onClick={() => void exporter()} loading={exporting} />
      </div>
      <DataGrid columns={cols} rows={lignes} rowKey={(l, i) => l.code_cli ?? l.code_four ?? i}
                loading={loading} error={error?.message}
                onRowClick={(l) => {
                  const code = l.code_cli ?? l.code_four;
                  if (code) navigate(`/tiers/${client ? 'client' : 'fournisseur'}/${encodeURIComponent(code)}`);
                }}
                footer={{
                  _label: `${res?.total ?? 0} tiers`,
                  credit: res?.total_credit != null
                    ? <span className="money">{fmtMoney(res.total_credit)}</span>
                    : undefined,
                }} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={onOffset} />}
    </>
  );
}
