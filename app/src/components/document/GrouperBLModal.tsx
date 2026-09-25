import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { GROUPER_BL, VENTES } from '../../api/queries';
import { Client, Vente } from '../../api/types';
import { useSession } from '../../store/session';
import { fmtDate, fmtMoney, isoToday } from '../../lib/format';
import ClientSearch from '../ClientSearch';
import { useToast } from '../ui/Toast';
import { bandeauDanger } from './prefillPiece';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[640px] max-h-full flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div>
            <div className="font-extrabold text-[15px]">Facturer des bons de livraison</div>
            <div className="text-[11px] text-ink-muted">Les BL cochés sont regroupés en une facture unique pour le client.</div>
          </div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex flex-col gap-3">
          {error && <div className="text-[12px] rounded-md px-3 py-2" style={bandeauDanger}>{error}</div>}
          <label className="text-[11px] font-bold text-ink-label">Client
            <div className="mt-1 font-normal"><ClientSearch value={client} onSelect={choisirClient} /></div>
          </label>

          {client && (
            <div className="border border-line-soft rounded-md overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-bg text-[10.5px] uppercase text-ink-muted">
                    <th className="px-3 py-2 w-[36px]">
                      <input type="checkbox" checked={tousCoches} disabled={bls.length === 0}
                             onChange={() => setSelection(tousCoches ? new Set() : new Set(bls.map((b) => b.id)))} />
                    </th>
                    <th className="text-left px-2 py-2">N° BL</th>
                    <th className="text-left px-2 py-2 w-[100px]">Date</th>
                    <th className="text-right px-3 py-2 w-[130px]">Net à payer</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={4} className="px-3 py-3 text-ink-muted">Chargement…</td></tr>}
                  {!loading && bls.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-3 text-ink-muted">Aucun bon de livraison à facturer pour ce client.</td></tr>
                  )}
                  {bls.map((b) => (
                    <tr key={b.id} className="border-t border-line-soft cursor-pointer" onClick={() => basculer(b.id)}>
                      <td className="px-3 py-1.5 text-center">
                        <input type="checkbox" checked={selection.has(b.id)} onChange={() => basculer(b.id)}
                               onClick={(e) => e.stopPropagation()} />
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

          <div className="grid grid-cols-[160px_1fr] gap-3">
            <label className="text-[11px] font-bold text-ink-label">Date de la facture
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
            </label>
            <label className="text-[11px] font-bold text-ink-label">Observation
              <input value={observation} onChange={(e) => setObservation(e.target.value)}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-line-soft flex-none">
          <span className="text-[12px] text-ink-label mr-auto">
            {selection.size} BL · <b className="money">{fmtMoney(total)} DA</b>
          </span>
          <button onClick={onClose} disabled={saving}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">
            Annuler
          </button>
          <button onClick={() => void valider()} disabled={saving || selection.size === 0}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            {saving ? 'Création…' : 'Créer la facture'}
          </button>
        </div>
      </div>
    </div>
  );
}
