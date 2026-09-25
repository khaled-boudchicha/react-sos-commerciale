import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { DELETE_REGLEMENT_CLIENT, DELETE_REGLEMENT_FOURNISSEUR } from '../../api/queries';
import { ReglementPiece } from '../../api/types';
import { D, useDroits } from '../../lib/droits';
import { fmtDate, fmtMoney } from '../../lib/format';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import ReglerPieceModal from './ReglerPieceModal';

/**
 * Types de pièces qui portent des règlements (pas les devis / commandes). Les
 * avoirs et retours en sont exclus : un « encaissement » y serait compté comme
 * une entrée d'argent alors qu'il s'agit d'un remboursement — ils viennent en
 * déduction du solde du tiers.
 */
export const TYPES_AVEC_REGLEMENT = ['FA', 'BL', 'BCT', 'BR'];
export const TYPES_RETOUR = ['FAV', 'BRT'];

/**
 * Règlements d'une pièce (vente : encaissements client, achat : paiements
 * fournisseur) avec ajout et suppression. `onChange` relit la pièce pour
 * rafraîchir réglé / reste.
 */
export default function ReglementsPiece({ sens, pieceId, numero, reglements, reste, onChange }: {
  sens: 'vente' | 'achat';
  pieceId: number;
  numero: string;
  reglements: ReglementPiece[];
  reste: number;
  onChange: () => void;
}) {
  const toast = useToast();
  const { peut } = useDroits();
  const [ajout, setAjout] = useState(false);
  const [aSupprimer, setASupprimer] = useState<ReglementPiece | null>(null);
  const [supprimer, { loading: deleting }] = useMutation(sens === 'vente' ? DELETE_REGLEMENT_CLIENT : DELETE_REGLEMENT_FOURNISSEUR);
  const peutSupprimer = peut('autre', D.autre.suppressionTresorerie);
  const verbe = sens === 'vente' ? 'Encaisser' : 'Payer';
  const total = reglements.reduce((s, r) => s + Number(r.montant ?? 0), 0);

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    try {
      await supprimer({ variables: { id: Number(aSupprimer.id) } });
      toast.success(`Règlement de ${fmtMoney(aSupprimer.montant)} DA supprimé.`);
      setASupprimer(null);
      onChange();
    } catch (e: any) {
      setASupprimer(null);
      toast.error(e.message ?? 'Suppression impossible.');
    }
  }

  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line-soft">
        <span className="text-[12px] font-extrabold">Règlements <span className="text-ink-muted font-bold">({reglements.length})</span></span>
        {reste > 0.009 && (
          <button onClick={() => setAjout(true)}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] text-white bg-brand-700">
            {verbe}
          </button>
        )}
      </div>
      {reglements.length === 0 ? (
        <div className="px-4 py-3 text-[12px] text-ink-muted">Aucun règlement sur cette pièce.</div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase text-ink-muted bg-bg">
              <th className="text-left px-4 py-1.5 w-[95px]">Date</th>
              <th className="text-left px-2 py-1.5 w-[130px]">Mode</th>
              <th className="text-left px-2 py-1.5">Observation</th>
              <th className="text-right px-2 py-1.5 w-[120px]">Montant</th>
              {peutSupprimer && <th className="w-[40px]" />}
            </tr>
          </thead>
          <tbody>
            {reglements.map((r) => (
              <tr key={r.id} className="border-t border-line-soft">
                <td className="px-4 py-1.5">{fmtDate(r.date)}</td>
                <td className="px-2 py-1.5">
                  {r.mode_payement ?? '—'}
                  {r.num_cheque ? <span className="text-ink-muted money text-[10.5px]"> · n° {r.num_cheque}</span> : null}
                </td>
                <td className="px-2 py-1.5 text-ink-muted">
                  {r.depuis_avance ? <span className="font-bold mr-1">Avance</span> : null}
                  {r.observation ?? ''}
                </td>
                <td className="px-2 py-1.5 text-right money font-medium">{fmtMoney(r.montant)}</td>
                {peutSupprimer && (
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => setASupprimer(r)} title="Supprimer ce règlement"
                            className="font-bold" style={{ color: 'var(--danger)' }}>✕</button>
                  </td>
                )}
              </tr>
            ))}
            <tr className="border-t border-line-soft font-bold">
              <td className="px-4 py-1.5 text-ink-label" colSpan={3}>Total réglé</td>
              <td className="px-2 py-1.5 text-right money">{fmtMoney(total)}</td>
              {peutSupprimer && <td />}
            </tr>
          </tbody>
        </table>
      )}

      {ajout && (
        <ReglerPieceModal sens={sens} pieceId={pieceId} numero={numero} reste={reste}
                          onClose={() => setAjout(false)} onDone={() => { setAjout(false); toast.success('Règlement enregistré.'); onChange(); }} />
      )}
      {aSupprimer && (
        <ConfirmDialog
          title="Supprimer ce règlement ?"
          message={<>Le règlement de <b className="money">{fmtMoney(aSupprimer.montant)} DA</b> du {fmtDate(aSupprimer.date)} sera supprimé et le reste à payer de la pièce recalculé.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={() => void confirmerSuppression()} onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
