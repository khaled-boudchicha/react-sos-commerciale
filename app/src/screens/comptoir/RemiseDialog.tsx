import { useState } from 'react';
import Dialog, { DialogButton } from '../../components/ui/Dialog';
import NumberEdit from '../../components/ui/NumberEdit';
import { fmtMoney } from '../../lib/format';
import { arrondi2 } from './comptoirCalc';

/**
 * Remise globale du ticket (portage de RemiseComptoirs.pas) : pourcentage et montant
 * liés — modifier l'un recalcule l'autre sur la base TTC avant remise.
 */
export default function RemiseDialog({ pct, baseTtc, onValider, onClose }: {
  pct: number;
  baseTtc: number;
  onValider: (pct: number) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(pct);
  const montant = arrondi2(baseTtc * p / 100);
  const valider = () => onValider(Math.min(100, Math.max(0, p)));

  return (
    <Dialog title="Remise globale" subtitle={`Base : ${fmtMoney(baseTtc)} DA`} onClose={onClose} width={420}
            footer={<>
              <DialogButton onClick={() => onValider(0)}>Supprimer la remise</DialogButton>
              <DialogButton kind="primary" onClick={valider} kbd="Entrée">Appliquer</DialogButton>
            </>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs leading-[1.45] font-bold text-ink-label">Pourcentage
          <div className="mt-1">
            <NumberEdit value={p} onChange={setP} onEnter={valider} size="lg" suffix="%" min={0} max={100} autoFocus ariaLabel="Remise en pourcentage" />
          </div>
        </label>
        <label className="text-xs leading-[1.45] font-bold text-ink-label">Montant
          <div className="mt-1">
            <NumberEdit value={montant} onChange={(m) => setP(baseTtc > 0 ? Math.min(100, (m / baseTtc) * 100) : 0)}
                        onEnter={valider} size="lg" suffix="DA" min={0} max={baseTtc} ariaLabel="Remise en montant" />
          </div>
        </label>
      </div>
      <div className="mt-3 flex justify-between text-[12.5px] font-bold">
        <span className="text-ink-label">Net après remise</span>
        <span className="money">{fmtMoney(baseTtc - montant)} DA</span>
      </div>
    </Dialog>
  );
}
