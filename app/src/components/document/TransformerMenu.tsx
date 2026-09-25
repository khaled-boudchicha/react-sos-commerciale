import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { TRANSFORMER_ACHAT, TRANSFORMER_VENTE } from '../../api/queries';
import { useDroits } from '../../lib/droits';
import { isoToday } from '../../lib/format';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

/** Libellé singulier d'un type cible, par sens. */
export const LIBELLE_TYPE: Record<'vente' | 'achat', Record<string, string>> = {
  vente: { FA: 'Facture', BL: 'Bon de livraison', BCT: 'Bon de comptoir', BC: 'Bon de commande', FP: 'Proforma', BRT: 'Bon de retour', FAV: 'Avoir' },
  achat: { FA: "Facture d'achat", BR: 'Bon de réception', BC: 'Bon de commande', DO: "Demande d'offre", BRT: 'Bon de retour', FAV: 'Avoir' },
};

/**
 * Boutons « → Bon de livraison », « → Facture »… : un par transition encore
 * possible (`transformations_possibles` renvoyé par le serveur). La
 * transformation modifie la pièce elle-même (même ligne, nouveau type/numéro).
 */
export default function TransformerMenu({ sens, id, cibles, onDone }: {
  sens: 'vente' | 'achat';
  id: number;
  cibles: string[];
  onDone: () => void;
}) {
  const toast = useToast();
  const { peutDoc } = useDroits();
  const [cible, setCible] = useState<string | null>(null);
  const [date, setDate] = useState(isoToday());
  const [transformer, { loading }] = useMutation(sens === 'vente' ? TRANSFORMER_VENTE : TRANSFORMER_ACHAT);

  // Transformer = créer une pièce du type cible → droit de création requis
  const permises = cibles.filter((c) => peutDoc(sens, c, 'creer'));
  if (permises.length === 0) return null;

  async function confirmer() {
    if (!cible) return;
    try {
      const { data } = await transformer({ variables: { id, cible, date: date || undefined } });
      const res = sens === 'vente' ? data?.transformerVente : data?.transformerAchat;
      toast.success(`Pièce transformée en ${LIBELLE_TYPE[sens][cible] ?? cible}${res?.numero ? ` n° ${res.numero}` : ''}.`);
      setCible(null);
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? 'Transformation impossible.');
    }
  }

  return (
    <>
      {permises.map((c) => (
        <button key={c} onClick={() => { setDate(isoToday()); setCible(c); }}
                className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-brand-700">
          → {LIBELLE_TYPE[sens][c] ?? c}
        </button>
      ))}
      {cible && (
        <ConfirmDialog
          title={`Transformer en ${LIBELLE_TYPE[sens][cible] ?? cible} ?`}
          message={
            <div className="flex flex-col gap-3">
              <span>La pièce est convertie dans le type cible (numérotation par le serveur) ; ses lignes sont conservées.</span>
              <label className="text-[11px] font-bold text-ink-label">Date de la pièce
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                       className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
              </label>
            </div>
          }
          confirmLabel="Transformer" loading={loading}
          onConfirm={() => void confirmer()} onCancel={() => setCible(null)}
        />
      )}
    </>
  );
}
