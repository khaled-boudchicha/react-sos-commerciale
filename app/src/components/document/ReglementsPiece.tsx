import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { DELETE_REGLEMENT_CLIENT, DELETE_REGLEMENT_FOURNISSEUR } from '../../api/queries';
import { ReglementPiece } from '../../api/types';
import { D, useDroits } from '../../lib/droits';
import { fmtDate, fmtMoney } from '../../lib/format';
import ConfirmDialog from '../ui/ConfirmDialog';
import DataGrid from '../ui/DataGrid';
import { useToast } from '../ui/Toast';
import { Button, IconButton } from '../ui/Button';
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
    <div>
      <DataGrid<ReglementPiece>
        complet
        titre={<>Règlements <span className="text-ink-muted font-bold">({reglements.length})</span></>}
        actions={reste > 0.009 ? (
          <Button size="sm" variant="success" icon={sens === 'vente' ? 'cash' : 'wallet'} onClick={() => setAjout(true)}>{verbe}</Button>
        ) : undefined}
        rows={reglements}
        rowKey={(r) => r.id}
        emptyMessage="Aucun règlement sur cette pièce."
        footer={reglements.length ? { _label: 'Total réglé', montant: <span className="money">{fmtMoney(total)}</span> } : undefined}
        columns={[
          { key: 'date', header: 'Date', width: '95px', render: (r) => fmtDate(r.date) },
          { key: 'mode_payement', header: 'Mode', width: '150px', render: (r) => (
            <>{r.mode_payement ?? '—'}{r.num_cheque ? <span className="text-ink-muted money text-xs"> · n° {r.num_cheque}</span> : null}</>
          ) },
          { key: 'observation', header: 'Observation', render: (r) => (
            <span className="text-ink-muted">{r.depuis_avance ? <span className="font-bold mr-1">Avance</span> : null}{r.observation ?? ''}</span>
          ) },
          { key: 'montant', header: 'Montant', align: 'right', width: '120px', render: (r) => <span className="money font-medium">{fmtMoney(r.montant)}</span> },
          ...(peutSupprimer ? [{ key: '_suppr', header: '', width: '44px', align: 'right' as const, render: (r: ReglementPiece) => (
            <IconButton icon="trash" label="Supprimer ce règlement" tone="danger" size="xs"
                        onClick={(e) => { e.stopPropagation(); setASupprimer(r); }} />
          ) }] : []),
        ]}
      />

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
