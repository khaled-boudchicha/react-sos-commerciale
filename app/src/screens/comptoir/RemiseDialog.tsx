import { useState } from 'react';
import Dialog, { DialogButton } from '../../components/ui/Dialog';
import NumberEdit from '../../components/ui/NumberEdit';
import { fmtMoney } from '../../lib/format';
import { arrondi2 } from './comptoirCalc';

/** Pourcentage de remise correspondant à un montant (borné à 100 %). */
export function pctDepuisMontant(m: number, baseTtc: number): number {
  return baseTtc > 0 ? Math.min(100, (m / baseTtc) * 100) : 0;
}

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
  const appliquer = (pourcentage: number) => onValider(Math.min(100, Math.max(0, pourcentage)));
  const valider = () => appliquer(p);
  // Entrée dans un champ : on applique la valeur saisie (reçue de NumberEdit), pas `p` qui
  // date du rendu précédent. Montant inchangé → on garde `p` (évite l'aller-retour d'arrondi).
  const appliquerMontant = (m: number) => appliquer(m === montant ? p : pctDepuisMontant(m, baseTtc));

  return (
    <Dialog title="Remise globale" subtitle={`Base : ${fmtMoney(baseTtc)} DA`} onClose={onClose} width={420}
            footer={<>
              <DialogButton onClick={() => onValider(0)}>Supprimer la remise</DialogButton>
              <DialogButton kind="primary" onClick={valider} kbd="Entrée">Appliquer</DialogButton>
            </>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-bold text-ink-label">Pourcentage
          <div className="mt-1">
            <NumberEdit value={p} onChange={setP} onEnter={appliquer} size="lg" suffix="%" min={0} max={100} autoFocus ariaLabel="Remise en pourcentage" />
          </div>
        </label>
        <label className="text-[11px] font-bold text-ink-label">Montant
          <div className="mt-1">
            <NumberEdit value={montant} onChange={(m) => setP(pctDepuisMontant(m, baseTtc))}
                        onEnter={appliquerMontant} size="lg" suffix="DA" min={0} max={baseTtc} ariaLabel="Remise en montant" />
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
