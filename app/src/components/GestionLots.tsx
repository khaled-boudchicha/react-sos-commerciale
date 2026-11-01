import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { ADD_LOT, DELETE_LOT } from '../api/queries';
import Dialog, { DialogButton } from './ui/Dialog';
import ConfirmDialog from './ui/ConfirmDialog';
import { Field, TextInput } from './ui/Field';
import { Alert } from './ui/States';
import { useToast } from './ui/Toast';
import { messageErreur } from '../api/erreurs';
import { fmtDate } from '../lib/format';

export type LotGere = { id: number; n_lot?: string | null; date_peremption?: string | null; qte?: number | null };

/**
 * Nouveau lot (sans quantité : le stock y entre par un bon de réception ou un bon d'entrée, jamais
 * « de nulle part ») et suppression d'un lot épuisé, depuis la fiche article.
 */
export function NouveauLotDialog({ articleId, existants, onClose, onDone }: {
  articleId: number;
  existants: LotGere[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [numero, setNumero] = useState('');
  const [peremption, setPeremption] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajouter, { loading }] = useMutation(ADD_LOT);

  async function valider() {
    const n = numero.trim();
    setErreur(null);
    if (!n) { setErreur('Saisissez le numéro du lot.'); return; }
    if (existants.some((l) => String(l.n_lot ?? '').trim().toLowerCase() === n.toLowerCase())) {
      setErreur(`Le lot « ${n} » existe déjà pour cet article.`); return;
    }
    try {
      await ajouter({ variables: { article_id: articleId, n_lot: n, date_peremption: peremption || undefined } });
      toast.success(`Lot ${n} créé.`);
      onDone();
    } catch (e) {
      setErreur(messageErreur(e, 'Création du lot impossible.'));
    }
  }

  return (
    <Dialog title="Nouveau lot" icon="package" size="sm" width={440} onClose={onClose} closeOnOverlay={false}
            footer={<>
              <DialogButton onClick={onClose}>Annuler</DialogButton>
              <DialogButton kind="primary" onClick={() => void valider()} disabled={loading} kbd="Entrée">Créer le lot</DialogButton>
            </>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void valider(); }}>
        {erreur && <Alert tone="danger" compact>{erreur}</Alert>}
        <Field label="N° de lot" required>
          <TextInput value={numero} onChange={(e) => setNumero(e.target.value)} autoFocus maxLength={50} mono />
        </Field>
        <Field label="Date de péremption" help="Facultative.">
          <TextInput type="date" value={peremption} onChange={(e) => setPeremption(e.target.value)} />
        </Field>
        <p className="text-xs text-ink-muted">Le lot est créé vide : sa quantité viendra des bons de réception ou d’entrée.</p>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

export function SupprimerLotDialog({ lot, onClose, onDone }: { lot: LotGere; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [supprimer, { loading }] = useMutation(DELETE_LOT);
  return (
    <ConfirmDialog danger title="Supprimer ce lot ?" confirmLabel="Supprimer le lot" loading={loading}
                   message={<>Le lot <b className="money">{lot.n_lot}</b>{lot.date_peremption ? <> (péremption {fmtDate(lot.date_peremption)})</> : null} est épuisé ; il ne sera plus proposé.</>}
                   onCancel={onClose}
                   onConfirm={async () => {
                     try {
                       await supprimer({ variables: { lot_id: lot.id } });
                       toast.success(`Lot ${lot.n_lot ?? ''} supprimé.`);
                       onDone();
                     } catch (e) {
                       toast.error(messageErreur(e, 'Suppression du lot impossible.'));
                       onClose();
                     }
                   }} />
  );
}
