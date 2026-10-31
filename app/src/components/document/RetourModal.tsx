import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { CREER_RETOUR_ACHAT, CREER_RETOUR_VENTE } from '../../api/queries';
import { useDroits } from '../../lib/droits';
import { useSession } from '../../store/session';
import { fmtMoney, fmtQte, isoToday } from '../../lib/format';
import { useToast } from '../ui/Toast';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, Select, TextInput, CONTROL } from '../ui/Field';
import { Alert } from '../ui/States';
import { cn } from '../ui/cn';

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
    <Dialog
      title={`Retour sur ${source.type_doc} ${source.numero}`}
      subtitle="Saisissez les quantités retournées ; les lignes à 0 sont ignorées."
      icon="return" iconTone="danger" size="lg" closeOnOverlay={false} onClose={onClose}
      footerStart={(
        <span className="text-sm text-ink-label">
          {choisies.length} ligne(s) · ≈ <b className="money text-ink">{fmtMoney(montant)} DA</b> TTC
        </span>
      )}
      footer={(
        <>
          <Button onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant="primary" icon="check" loading={loading}
                  onClick={() => void valider()} disabled={loading || choisies.length === 0 || typesPermis.length === 0}>
            {loading ? 'Création…' : `Créer ${typeDoc === 'FAV' ? "l'avoir" : 'le bon de retour'}`}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger" compact>{error}</Alert>}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Type de pièce" required>
            <Select value={typeDoc} onChange={(e) => setTypeDoc(e.target.value as 'FAV' | 'BRT')}>
              {typesPermis.includes('FAV') && <option value="FAV">Avoir</option>}
              {typesPermis.includes('BRT') && <option value="BRT">Bon de retour</option>}
            </Select>
          </Field>
          <Field label="Date" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Observation">
            <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} />
          </Field>
        </div>

        <div className="border border-line-soft rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sunken text-2xs font-bold uppercase tracking-wider text-ink-label">
                <th className="text-left px-3 py-2">Article</th>
                <th className="text-right px-3 py-2 w-[80px]">Qté</th>
                <th className="text-right px-3 py-2 w-[90px]">Retourné</th>
                <th className="text-right px-3 py-1 w-[130px]">
                  <Button size="xs" variant="link" icon="return" onClick={toutRetourner} className="normal-case tracking-normal">
                    Tout retourner
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {source.lignes.map((l) => {
                const max = maxLigne(l);
                return (
                  <tr key={l.id} className="border-t border-line-soft">
                    <td className="px-3 py-1.5">
                      <b>{l.designation}</b> <span className="money text-xs text-ink-muted">{l.code_article}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right money">{fmtQte(l.qte)}</td>
                    <td className="px-3 py-1.5 text-right money text-ink-muted">{fmtQte(l.qte_retournee ?? 0)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input type="number" min="0" max={max} step="any" disabled={max <= 0}
                             value={qtes[l.id] ?? 0}
                             onChange={(e) => setQtes((q) => ({ ...q, [l.id]: Math.max(0, parseFloat(e.target.value) || 0) }))}
                             title={`Maximum ${fmtQte(max)}`}
                             aria-label={`Quantité retournée — ${l.designation ?? l.code_article ?? ''}`}
                             className={cn(CONTROL, 'h-control-sm px-2 text-sm w-[90px] money text-right')} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
