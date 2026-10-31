import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ECHEANCES, MARQUER_ECHEANCE_PAYEE } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { PageHeader, SearchInput, Tabs, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { KpiTile } from '../components/ui/Kpi';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { useSession } from '../store/session';

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

  const toast = useToast();
  const dossierUser = useSession((s) => s.dossierUser);
  const [payer, { loading: paiement }] = useMutation(MARQUER_ECHEANCE_PAYEE);
  async function confirmerPaiement() {
    if (!aPayer) return;
    try {
      // Caisse par défaut de l'utilisateur : sans compte, le règlement n'entre dans aucun solde
      await payer({ variables: { input: {
        vente_id: aPayer.id, mode_payement: 'Espece',
        compte: dossierUser?.compte ?? undefined, compte_id: dossierUser?.compte_id ?? undefined,
      } } });
      toast.success(`${aPayer.type_doc} ${aPayer.numero} réglée (${fmtMoney(aPayer.reste)} DA).`);
      setAPayer(null);
      void refetch();
    } catch (e: any) {
      toast.error(`Règlement impossible : ${e.message ?? e}`);
      setAPayer(null);
    }
  }

  const columns: Column<Echeance>[] = [
    { key: 'echeance', header: 'Échéance', width: '110px', render: (e) => <span className="money">{fmtDate(e.date_echeance)}</span> },
    { key: 'retard', header: 'Retard', align: 'right', width: '90px', render: (e) => {
      const j = Number(e.jours_retard ?? 0);
      return <span className="money" style={{ color: j > 60 ? 'var(--danger-text)' : j > 0 ? 'var(--warning-text)' : undefined }}>{j > 0 ? `${j} j` : 'à échoir'}</span>;
    } },
    { key: 'numero', header: 'Pièce', width: '130px', render: (e) => <span className="money">{e.type_doc} {e.numero}</span> },
    { key: 'client', header: 'Client', render: (e) => <><b>{e.raison}</b> <span className="text-ink-muted text-xs">{e.code_cli}</span></> },
    { key: 'net', header: 'Montant', align: 'right', width: '120px', render: (e) => <span className="money">{fmtMoney(e.net_a_payer)}</span> },
    { key: 'reste', header: 'Reste', align: 'right', width: '120px', render: (e) => <span className="money font-semibold" style={{ color: 'var(--danger-text)' }}>{fmtMoney(e.reste)}</span> },
    { key: 'action', header: '', width: '120px', render: (e) => (
      <Button size="xs" icon="check" onClick={() => setAPayer(e)}>
        Marquer payé
      </Button>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4 p-5">
      <PageHeader title="Échéances clients" icon="dueDates"
                  description="Pièces clients avec un reste à payer, échues ou à échoir." />

      {res && (
        <div className="grid grid-cols-3 gap-3">
          <KpiTile label="Total à régler" value={fmtMoney(res.totaux.total_reste)} sub={`${res.total} pièce(s)`} icon="wallet" tone="brand" />
          <KpiTile label="Échues" value={fmtMoney(res.totaux.total_echu)} icon="alert" tone="danger" valueTone="danger" />
          <KpiTile label="À échoir" value={fmtMoney(res.totaux.total_a_echoir)} icon="clock" tone="warning" valueTone="warning" />
        </div>
      )}

      <Toolbar>
        <Tabs value={statut} onChange={setStatut} options={VUES} label="Statut des échéances" />
        <div className="ml-auto">
          <SearchInput value={search} onChange={setSearch} placeholder="Client, code…" />
        </div>
      </Toolbar>

      <DataGrid titre="Pièces à régler" columns={columns} rows={lignes} rowKey={(e) => String(e.id)}
                loading={loading} error={error?.message} />

      {aPayer && (
        <ConfirmDialog
          title="Marquer la pièce comme payée ?"
          message={<>Le reste de <b>{aPayer.type_doc} {aPayer.numero}</b> ({fmtMoney(aPayer.reste)} DA) sera réglé en espèces à la date du jour
            {dossierUser?.compte ? <>, dans la caisse <b>{dossierUser.compte}</b></> : null}.</>}
          confirmLabel="Régler"
          loading={paiement}
          onConfirm={() => void confirmerPaiement()}
          onCancel={() => setAPayer(null)}
        />
      )}
    </div>
  );
}
