import { useState } from 'react';
import Dialog, { DialogButton } from '../../components/ui/Dialog';
import NumberEdit from '../../components/ui/NumberEdit';
import type { LigneDoc } from '../../components/document/lignesDocument';
import { fmtMoney, fmtQte } from '../../lib/format';
import { qteDepuisMontant } from './comptoirCalc';

/**
 * Ctrl+Q (Delphi) : « je veux pour N dinars » — la quantité de la ligne sélectionnée est calculée à partir
 * du montant TTC voulu, au prix unitaire TTC de la ligne (vente au détail, vrac, découpe).
 */
export default function MontantDialog({ ligne, onValider, onClose }: {
  ligne: LigneDoc;
  onValider: (qte: number) => void;
  onClose: () => void;
}) {
  const [montant, setMontant] = useState(0);
  const qte = montant > 0 ? qteDepuisMontant(ligne, montant) : ligne.qte;
  const valider = () => { if (montant > 0 && qte > 0) onValider(qte); };

  return (
    <Dialog title="Quantité depuis un montant" subtitle={ligne.designation} onClose={onClose} width={420}
            footer={<DialogButton kind="primary" onClick={valider} kbd="Entrée">Appliquer</DialogButton>}>
      <label className="text-xs leading-[1.45] font-bold text-ink-label">Montant TTC voulu
        <div className="mt-1">
          <NumberEdit value={montant} onChange={setMontant} onEnter={valider} size="lg" suffix="DA" min={0} autoFocus ariaLabel="Montant TTC voulu" />
        </div>
      </label>
      <div className="mt-3 flex justify-between text-[12.5px] font-bold">
        <span className="text-ink-label">Quantité correspondante</span>
        <span className="money">{montant > 0 ? fmtQte(qte) : '—'}</span>
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>Prix unitaire TTC</span>
        <span className="money">{fmtMoney(ligne.prix_ht * (1 - (ligne.remise || 0) / 100) * (1 + (ligne.tva || 0) / 100))} DA</span>
      </div>
    </Dialog>
  );
}
