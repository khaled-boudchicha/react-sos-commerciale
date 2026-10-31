import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { GROUPER_BL, VENTES } from '../../api/queries';
import { Client, Vente } from '../../api/types';
import { useSession } from '../../store/session';
import { fmtDate, fmtMoney, isoToday } from '../../lib/format';
import ClientSearch from '../ClientSearch';
import { useToast } from '../ui/Toast';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading } from '../ui/States';
import { cn } from '../ui/cn';

/**
 * « Facturer des BL » : regroupe plusieurs bons de livraison d'un même client
 * en une facture. Le serveur n'expose que les BL non encore groupés.
 */
export default function GrouperBLModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { dossierUser } = useSession();
  const [client, setClient] = useState<Client | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(isoToday());
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, loading } = useQuery(VENTES, {
    variables: { type_doc: 'BL', code_cli: client?.code, limit: 500, offset: 0 },
    skip: !client, fetchPolicy: 'network-only',
  });
  const bls: Vente[] = client ? (data?.ventes?.data ?? []) : [];
  const [grouper, { loading: saving }] = useMutation(GROUPER_BL);

  const total = bls.filter((b) => selection.has(b.id)).reduce((s, b) => s + Number(b.net_a_payer ?? 0), 0);
  const tousCoches = bls.length > 0 && bls.every((b) => selection.has(b.id));

  function choisirClient(c: Client | null) {
    setClient(c);
    setSelection(new Set());
  }
  function basculer(id: number) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function valider() {
    setError(null);
    if (!dossierUser) { setError('Utilisateur dossier manquant — reconnectez-vous.'); return; }
    if (selection.size === 0) { setError('Cochez au moins un bon de livraison.'); return; }
    try {
      const { data: res } = await grouper({
        variables: {
          input: {
            ids: [...selection],
            date,
            observation: observation || undefined,
            user_id: Number(dossierUser.id),
            user_name: String(dossierUser.username),
          },
        },
      });
      const fa = res?.grouperBL;
      toast.success(`Facture ${fa?.numero ?? ''} créée à partir de ${selection.size} BL.`);
      onClose();
      if (fa?.id) navigate(`/ventes/${fa.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Regroupement impossible.');
    }
  }

  return (
    <Dialog
      title="Facturer des bons de livraison"
      subtitle="Les BL cochés sont regroupés en une facture unique pour le client."
      icon="invoice" size="md" width={640} closeOnOverlay={false} onClose={onClose}
      footerStart={(
        <span className="text-sm text-ink-label">
          {selection.size} BL · <b className="money text-ink">{fmtMoney(total)} DA</b>
        </span>
      )}
      footer={(
        <>
          <Button onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="primary" icon="check" loading={saving}
                  onClick={() => void valider()} disabled={saving || selection.size === 0}>
            {saving ? 'Création…' : 'Créer la facture'}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger" compact>{error}</Alert>}
        <Field label="Client" required>
          <ClientSearch value={client} onSelect={choisirClient} />
        </Field>

        {client && (
          <div className="border border-line-soft rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sunken text-2xs font-bold uppercase tracking-wider text-ink-label">
                  <th className="px-3 py-2 w-[36px]">
                    <input type="checkbox" checked={tousCoches} disabled={bls.length === 0} aria-label="Tout cocher"
                           className="h-4 w-4 cursor-pointer accent-[var(--brand-700)]"
                           onChange={() => setSelection(tousCoches ? new Set() : new Set(bls.map((b) => b.id)))} />
                  </th>
                  <th className="text-left px-2 py-2">N° BL</th>
                  <th className="text-left px-2 py-2 w-[100px]">Date</th>
                  <th className="text-right px-3 py-2 w-[130px]">Net à payer</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="px-3 py-3"><Loading /></td></tr>}
                {!loading && bls.length === 0 && (
                  <tr><td colSpan={4}>
                    <EmptyState size="sm" icon="delivery" title="Aucun bon de livraison à facturer pour ce client." />
                  </td></tr>
                )}
                {bls.map((b) => (
                  <tr key={b.id} onClick={() => basculer(b.id)}
                      className={cn('border-t border-line-soft cursor-pointer transition-colors duration-fast',
                        selection.has(b.id) ? 'bg-brand-soft' : 'hover:bg-hover')}>
                    <td className="px-3 py-1.5 text-center">
                      <input type="checkbox" checked={selection.has(b.id)} onChange={() => basculer(b.id)}
                             onClick={(e) => e.stopPropagation()} aria-label={`BL ${b.numero}`}
                             className="h-4 w-4 cursor-pointer accent-[var(--brand-700)]" />
                    </td>
                    <td className="px-2 py-1.5 money font-bold">{b.numero}</td>
                    <td className="px-2 py-1.5">{fmtDate(b.date)}</td>
                    <td className="px-3 py-1.5 text-right money">{fmtMoney(b.net_a_payer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-[170px_1fr] gap-3">
          <Field label="Date de la facture" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Observation">
            <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
