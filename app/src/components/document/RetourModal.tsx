import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { CREER_RETOUR_ACHAT, CREER_RETOUR_VENTE } from '../../api/queries';
import { useDroits } from '../../lib/droits';
import { useSession } from '../../store/session';
import { fmtMoney, fmtQte, isoToday } from '../../lib/format';
import { useToast } from '../ui/Toast';
import { bandeauDanger } from './prefillPiece';

type LigneSource = {
  id: number; code_article?: string; designation?: string; qte?: number;
  total_ttc?: number | null; qte_retournee?: number | null;
};

/**
 * Retour partiel ou total d'une pièce : avoir (FAV) ou bon de retour (BRT).
 * Quantités à 0 par défaut ; le maximum par ligne = qté − déjà retournée
 * (le serveur revalide de toute façon).
 */
export default function RetourModal({ sens, source, onClose }: {
  sens: 'vente' | 'achat';
  source: { id: number; numero: string; type_doc: string; code: string; lignes: LigneSource[] };
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { peutDoc } = useDroits();
  const { dossierUser } = useSession();

  const typesPermis = (['FAV', 'BRT'] as const).filter((t) => peutDoc(sens, t, 'creer'));
  // Facture → avoir ; bon (BL, BCT, BR) → bon de retour, si permis
  const prefere = source.code === 'FA' ? 'FAV' : 'BRT';
  const [typeDoc, setTypeDoc] = useState<'FAV' | 'BRT'>(typesPermis.includes(prefere) ? prefere : (typesPermis[0] ?? prefere));
  const [date, setDate] = useState(isoToday());
  const [observation, setObservation] = useState('');
  const [qtes, setQtes] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  const [creer, { loading }] = useMutation(sens === 'vente' ? CREER_RETOUR_VENTE : CREER_RETOUR_ACHAT);

  const maxLigne = (l: LigneSource) => Math.max(0, Number(l.qte ?? 0) - Number(l.qte_retournee ?? 0));
  const toutRetourner = () => setQtes(Object.fromEntries(source.lignes.map((l) => [l.id, maxLigne(l)])));
  const choisies = source.lignes.filter((l) => (qtes[l.id] ?? 0) > 0);
  // Estimation : TTC unitaire net de remise ligne (hors remise globale)
  const montant = choisies.reduce((s, l) => s + (qtes[l.id] ?? 0) * (Number(l.total_ttc ?? 0) / (Number(l.qte) || 1)), 0);

  async function valider() {
    setError(null);
    if (!dossierUser) { setError('Utilisateur dossier manquant — reconnectez-vous.'); return; }
    if (choisies.length === 0) { setError('Saisissez au moins une quantité à retourner.'); return; }
    const depasse = choisies.find((l) => (qtes[l.id] ?? 0) > maxLigne(l) + 1e-9);
    if (depasse) { setError(`Quantité trop élevée pour ${depasse.designation ?? depasse.code_article}.`); return; }
    try {
      const { data } = await creer({
        variables: {
          input: {
            id: source.id,
            type_doc: typeDoc,
            date,
            observation: observation || undefined,
            lignes: choisies.map((l) => ({ ligne_id: l.id, qte: qtes[l.id] })),
            user_id: Number(dossierUser.id),
            user_name: String(dossierUser.username),
          },
        },
      });
      const doc = sens === 'vente' ? data?.creerRetourVente : data?.creerRetourAchat;
      toast.success(`${typeDoc === 'FAV' ? 'Avoir' : 'Bon de retour'} ${doc?.numero ?? ''} créé.`);
      onClose();
      if (doc?.id) navigate(`/${sens === 'vente' ? 'ventes' : 'achats'}/${doc.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Création du retour impossible.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[720px] max-h-full flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div>
            <div className="font-extrabold text-[15px]">Retour sur {source.type_doc} {source.numero}</div>
            <div className="text-[11px] text-ink-muted">Saisissez les quantités retournées ; les lignes à 0 sont ignorées.</div>
          </div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex flex-col gap-3">
          {error && <div className="text-[12px] rounded-md px-3 py-2" style={bandeauDanger}>{error}</div>}

          <div className="grid grid-cols-3 gap-3">
            <label className="text-[11px] font-bold text-ink-label">Type de pièce
              <select value={typeDoc} onChange={(e) => setTypeDoc(e.target.value as 'FAV' | 'BRT')}
                      className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
                {typesPermis.includes('FAV') && <option value="FAV">Avoir</option>}
                {typesPermis.includes('BRT') && <option value="BRT">Bon de retour</option>}
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink-label">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
            </label>
            <label className="text-[11px] font-bold text-ink-label">Observation
              <input value={observation} onChange={(e) => setObservation(e.target.value)}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
            </label>
          </div>

          <div className="border border-line-soft rounded-md overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-bg text-[10.5px] uppercase text-ink-muted">
                  <th className="text-left px-3 py-2">Article</th>
                  <th className="text-right px-3 py-2 w-[80px]">Qté</th>
                  <th className="text-right px-3 py-2 w-[90px]">Retourné</th>
                  <th className="text-right px-3 py-2 w-[120px]">
                    <button onClick={toutRetourner} className="normal-case font-bold text-brand-700">Tout retourner</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {source.lignes.map((l) => {
                  const max = maxLigne(l);
                  return (
                    <tr key={l.id} className="border-t border-line-soft">
                      <td className="px-3 py-1.5">
                        <b>{l.designation}</b> <span className="money text-[10.5px] text-ink-muted">{l.code_article}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right money">{fmtQte(l.qte)}</td>
                      <td className="px-3 py-1.5 text-right money text-ink-muted">{fmtQte(l.qte_retournee ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input type="number" min="0" max={max} step="any" disabled={max <= 0}
                               value={qtes[l.id] ?? 0}
                               onChange={(e) => setQtes((q) => ({ ...q, [l.id]: Math.max(0, parseFloat(e.target.value) || 0) }))}
                               title={`Maximum ${fmtQte(max)}`}
                               className="w-[90px] border border-line rounded-sm px-2 py-1 bg-surface text-ink money text-right disabled:opacity-50" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-line-soft flex-none">
          <span className="text-[12px] text-ink-label mr-auto">
            {choisies.length} ligne(s) · ≈ <b className="money">{fmtMoney(montant)} DA</b> TTC
          </span>
          <button onClick={onClose} disabled={loading}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">
            Annuler
          </button>
          <button onClick={() => void valider()} disabled={loading || choisies.length === 0 || typesPermis.length === 0}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            {loading ? 'Création…' : `Créer ${typeDoc === 'FAV' ? "l'avoir" : 'le bon de retour'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
