import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApolloClient, useQuery, useMutation } from '@apollo/client';
import { INVENTAIRES, CREATE_INVENTAIRE, DELETE_INVENTAIRE, REFERENTIELS } from '../api/queries';
import { fmtDate, fmtMoney, isoToday } from '../lib/format';
import DataGrid, { Column, DataGridDistant } from '../components/ui/DataGrid';
import { PageHeader, StatusPill } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type Inventaire = {
  id: number; code?: string | null; date: string; designation?: string | null;
  statut?: string | null; is_closed?: number | null;
  nb_articles?: number; valeur_theorique?: number; valeur_reale?: number; ecart_valeur?: number;
};

export default function Inventaires() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [motif, setMotif] = useState('');
  const [depot, setDepot] = useState('');
  const [date, setDate] = useState(isoToday());
  const [deleting, setDeleting] = useState<Inventaire | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tri, filtres, recherche, pagination et groupes faits par le serveur ;
  // `version` est incrémenté après création / suppression pour recharger la liste.
  const client = useApolloClient();
  const [version, setVersion] = useState(0);
  const refetch = () => setVersion((v) => v + 1);
  const distant = useMemo<DataGridDistant<Inventaire>>(() => ({
    cle: JSON.stringify([version]),
    charger: async (grille) => {
      const { data } = await client.query({ query: INVENTAIRES, fetchPolicy: 'network-only', variables: { grille } });
      return data.inventaires as { data: Inventaire[]; total: number };
    },
  }), [client, version]);
  const { data: refs } = useQuery(REFERENTIELS);
  const depots: any[] = Array.isArray(refs?.depots) ? refs.depots : [];

  const [create, { loading: saving }] = useMutation(CREATE_INVENTAIRE);
  const [remove, { loading: removing }] = useMutation(DELETE_INVENTAIRE);

  async function submitCreate() {
    setError(null);
    try {
      const { data: d } = await create({
        variables: { input: { designation: motif || `Inventaire ${fmtDate(date)}`, date, depot: depot || undefined } },
      });
      setCreating(false); setMotif(''); setDepot('');
      refetch();
      const id = d?.createInventaire?.id;
      if (id) navigate(`/stock/inventaires/${id}`);
    } catch (e: any) { setError(e.message ?? 'Erreur.'); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try { await remove({ variables: { id: deleting.id } }); setDeleting(null); refetch(); }
    catch (e: any) { setDeleting(null); setError(e.message ?? 'Suppression impossible.'); }
  }

  const columns: Column<Inventaire>[] = [
    { key: 'date', header: 'Date', width: '100px', field: 'date', type: 'date', render: (i) => fmtDate(i.date) },
    { key: 'designation', header: 'Motif', field: 'designation', render: (i) => <b>{i.designation || `Inventaire #${i.id}`}</b> },
    { key: 'nb', header: 'Articles', align: 'right', width: '90px', field: 'nb_articles', type: 'number', render: (i) => <span className="money">{i.nb_articles ?? '—'}</span> },
    { key: 'vth', header: 'Valeur théorique', align: 'right', width: '140px', field: 'valeur_theorique', render: (i) => <span className="money">{fmtMoney(i.valeur_theorique)}</span> },
    { key: 'vre', header: 'Valeur comptée', align: 'right', width: '140px', field: 'valeur_reale', render: (i) => <span className="money">{fmtMoney(i.valeur_reale)}</span> },
    { key: 'ecart', header: 'Écart', align: 'right', width: '130px', field: 'ecart_valeur', render: (i) => (
      <span className="money font-semibold" style={{ color: Number(i.ecart_valeur) < 0 ? 'var(--danger)' : Number(i.ecart_valeur) > 0 ? 'var(--success)' : undefined }}>
        {fmtMoney(i.ecart_valeur)}
      </span>
    ) },
    { key: 'statut', header: 'Statut', width: '100px', render: (i) => (
      i.is_closed ? <StatusPill tone="ok">Clôturé</StatusPill> : <StatusPill tone="warn">Brouillon</StatusPill>
    ) },
    { key: 'actions', header: '', align: 'right', width: '50px', render: (i) => (
      i.is_closed ? null : (
        <button onClick={(e) => { e.stopPropagation(); setDeleting(i); }} title="Supprimer"
                className="px-1.5 py-0.5 rounded-sm border border-line text-[11px]" style={{ color: 'var(--danger)' }}>✕</button>
      )
    ) },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Inventaires">
        <Link to="/stock" className="text-[12px] font-bold text-brand-700">← Stock</Link>
        <button onClick={() => setCreating(true)}
                className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouvel inventaire
        </button>
      </PageHeader>

      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
          <div className="w-[480px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
            <div className="font-extrabold text-[15px] mb-1">Nouvel inventaire</div>
            <div className="text-[11.5px] text-ink-muted mb-4">
              Tous les articles {depot ? `du dépôt « ${depot} »` : 'du dossier'} seront listés avec leur stock théorique.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-bold text-ink-label col-span-2">Motif
                <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Inventaire annuel…"
                       className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
              </label>
              <label className="text-[11px] font-bold text-ink-label">Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                       className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
              </label>
              <label className="text-[11px] font-bold text-ink-label">Dépôt
                <select value={depot} onChange={(e) => setDepot(e.target.value)}
                        className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
                  <option value="">Tous</option>
                  {depots.map((d: any, i: number) => {
                    const v = String(d.nom ?? d.designation ?? d.depot ?? d);
                    return <option key={i} value={v}>{v}</option>;
                  })}
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setCreating(false)} disabled={saving}
                      className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">Annuler</button>
              <button onClick={() => void submitCreate()} disabled={saving}
                      className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
                {saving ? 'Préparation…' : "Créer l'inventaire"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog title="Supprimer cet inventaire ?"
          message={<><b>{deleting.designation || `Inventaire #${deleting.id}`}</b> et toutes ses lignes de comptage seront supprimés.</>}
          confirmLabel="Supprimer" danger loading={removing}
          onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}

      <DataGrid columns={columns} rowKey={(i) => i.id}
                distant={distant} cleEtat="inventaires"
                onRowClick={(i) => navigate(`/stock/inventaires/${i.id}`)}
                emptyMessage="Aucun inventaire."
                footer={(r) => ({ _label: `${r?.total ?? 0} inventaire(s)` })} />
    </div>
  );
}
