import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ECHEANCES, MARQUER_ECHEANCE_PAYEE } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Bucket, PageHeader, SearchInput, Tabs } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type Statut = 'tous' | 'echues' | 'a_echoir';
type Echeance = {
  id: number; code_cli: string; raison: string; numero: string; type_doc: string;
  date_doc: string; date_echeance: string; net_a_payer: number; reste: number; jours_retard: number;
};
type Reponse = {
  data: Echeance[]; total: number;
  totaux: { total_reste: number; total_echu: number; total_a_echoir: number };
};

const VUES: { code: Statut; label: string }[] = [
  { code: 'tous', label: 'Toutes' },
  { code: 'echues', label: 'Échues' },
  { code: 'a_echoir', label: 'À échoir' },
];

/**
 * Échéances clients : pièces avec un reste à payer dont la date de règlement est
 * atteinte ou à venir. « Marquer payé » règle le reste de la pièce (règlement client).
 */
export default function Echeances() {
  const [statut, setStatut] = useState<Statut>('tous');
  const [search, setSearch] = useState('');
  const [aPayer, setAPayer] = useState<Echeance | null>(null);

  const { data, loading, error, refetch } = useQuery(ECHEANCES, {
    variables: { statut, search: search || undefined, limit: 500, offset: 0 },
    fetchPolicy: 'network-only',
  });
  const res: Reponse | undefined = data?.echeances;
  const lignes = useMemo(() => res?.data ?? [], [res]);

  const [payer, { loading: paiement }] = useMutation(MARQUER_ECHEANCE_PAYEE);
  async function confirmerPaiement() {
    if (!aPayer) return;
    await payer({ variables: { input: { vente_id: aPayer.id, mode_payement: 'Espece' } } });
    setAPayer(null);
    void refetch();
  }

  const columns: Column<Echeance>[] = [
    { key: 'echeance', header: 'Échéance', width: '110px', render: (e) => <span className="money">{fmtDate(e.date_echeance)}</span> },
    { key: 'retard', header: 'Retard', align: 'right', width: '90px', render: (e) => {
      const j = Number(e.jours_retard ?? 0);
      return <span className="money" style={{ color: j > 60 ? 'var(--danger)' : j > 0 ? 'var(--warning)' : undefined }}>{j > 0 ? `${j} j` : 'à échoir'}</span>;
    } },
    { key: 'numero', header: 'Pièce', width: '130px', render: (e) => <span className="money">{e.type_doc} {e.numero}</span> },
    { key: 'client', header: 'Client', render: (e) => <><b>{e.raison}</b> <span className="text-ink-muted text-[11px]">{e.code_cli}</span></> },
    { key: 'net', header: 'Montant', align: 'right', width: '120px', render: (e) => <span className="money">{fmtMoney(e.net_a_payer)}</span> },
    { key: 'reste', header: 'Reste', align: 'right', width: '120px', render: (e) => <span className="money font-semibold" style={{ color: 'var(--danger)' }}>{fmtMoney(e.reste)}</span> },
    { key: 'action', header: '', width: '120px', render: (e) => (
      <button onClick={() => setAPayer(e)}
              className="rounded-md px-2.5 py-1 font-bold text-[11px] border border-line text-ink-label">
        Marquer payé
      </button>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4 p-5">
      <PageHeader title="Échéances clients">
        <SearchInput value={search} onChange={setSearch} placeholder="Client, code…" />
      </PageHeader>

      {res && (
        <div className="grid grid-cols-3 gap-3">
          <Bucket label="Total à régler" value={res.totaux.total_reste} tone="var(--text)" sub={`${res.total} pièce(s)`} />
          <Bucket label="Échues" value={res.totaux.total_echu} tone="var(--danger)" />
          <Bucket label="À échoir" value={res.totaux.total_a_echoir} tone="var(--warning)" />
        </div>
      )}

      <Tabs value={statut} onChange={setStatut} options={VUES} />

      <DataGrid titre="Pièces à régler" columns={columns} rows={lignes} rowKey={(e) => String(e.id)}
                loading={loading} error={error?.message} />

      {aPayer && (
        <ConfirmDialog
          title="Marquer la pièce comme payée ?"
          message={<>Le reste de <b>{aPayer.type_doc} {aPayer.numero}</b> ({fmtMoney(aPayer.reste)} DA) sera réglé en espèces à la date du jour.</>}
          confirmLabel="Régler"
          loading={paiement}
          onConfirm={() => void confirmerPaiement()}
          onCancel={() => setAPayer(null)}
        />
      )}
    </div>
  );
}
