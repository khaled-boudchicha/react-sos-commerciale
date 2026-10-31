import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApolloClient, useQuery, useMutation } from '@apollo/client';
import { INVENTAIRES, CREATE_INVENTAIRE, DELETE_INVENTAIRE, REFERENTIELS } from '../api/queries';
import { fmtDate, isoToday } from '../lib/format';
import DataGrid, { Column, DataGridDistant } from '../components/ui/DataGrid';
import { Money, PageHeader, StatusPill } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Dialog from '../components/ui/Dialog';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/States';

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
    { key: 'vth', header: 'Valeur théorique', align: 'right', width: '140px', field: 'valeur_theorique', render: (i) => <Money value={i.valeur_theorique} /> },
    { key: 'vre', header: 'Valeur comptée', align: 'right', width: '140px', field: 'valeur_reale', render: (i) => <Money value={i.valeur_reale} /> },
    { key: 'ecart', header: 'Écart', align: 'right', width: '130px', field: 'ecart_valeur', render: (i) => (
      <Money value={i.ecart_valeur} className="font-semibold"
             tone={Number(i.ecart_valeur) < 0 ? 'danger' : Number(i.ecart_valeur) > 0 ? 'success' : undefined} />
    ) },
    { key: 'statut', header: 'Statut', width: '100px', render: (i) => (
      i.is_closed ? <StatusPill tone="ok">Clôturé</StatusPill> : <StatusPill tone="warn">Brouillon</StatusPill>
    ) },
    { key: 'actions', header: '', align: 'right', width: '50px', render: (i) => (
      i.is_closed ? null : (
        <IconButton icon="trash" label="Supprimer" tone="danger" size="xs"
                    onClick={(e) => { e.stopPropagation(); setDeleting(i); }} />
      )
    ) },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Inventaires" icon="inventory" backTo="/stock" backLabel="Retour au stock"
                  breadcrumb={[{ label: 'Stock', to: '/stock' }, { label: 'Inventaires' }]}>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Nouvel inventaire</Button>
      </PageHeader>

      {error && <Alert tone="danger">{error}</Alert>}

      {creating && (
        <Dialog title="Nouvel inventaire" icon="inventory" size="sm" width={480} closeOnOverlay={false}
                subtitle={<>Tous les articles {depot ? `du dépôt « ${depot} »` : 'du dossier'} seront listés avec leur stock théorique.</>}
                onClose={() => { if (!saving) setCreating(false); }}
                footer={(
                  <>
                    <Button onClick={() => setCreating(false)} disabled={saving}>Annuler</Button>
                    <Button variant="primary" onClick={() => void submitCreate()} loading={saving}>
                      {saving ? 'Préparation…' : "Créer l'inventaire"}
                    </Button>
                  </>
                )}>
          <div className="grid grid-cols-2 gap-3">
            {error && <Alert tone="danger" compact className="col-span-2">{error}</Alert>}
            <Field label="Motif" className="col-span-2">
              <TextInput value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Inventaire annuel…" />
            </Field>
            <Field label="Date" required>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Dépôt">
              <Select value={depot} onChange={(e) => setDepot(e.target.value)}>
                <option value="">Tous</option>
                {depots.map((d: any, i: number) => {
                  const v = String(d.nom ?? d.designation ?? d.depot ?? d);
                  return <option key={i} value={v}>{v}</option>;
                })}
              </Select>
            </Field>
          </div>
        </Dialog>
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
