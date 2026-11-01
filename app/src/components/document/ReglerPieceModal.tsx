import { useEffect, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { ADD_REGLEMENT_CLIENT, ADD_REGLEMENT_FOURNISSEUR, SOLDES_COMPTES, MODES_PAYEMENT } from '../../api/queries';
import { useSession } from '../../store/session';
import { useDroits } from '../../lib/droits';
import { fmtMoney, isoToday } from '../../lib/format';
import Dialog from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert } from '../ui/States';


/**
 * Règlement ciblé d'une pièce (sans lettrage FIFO, contrairement à
 * ReglerTiersModal) : montant proposé = reste à payer, plafonné à ce reste.
 */
export default function ReglerPieceModal({ sens, pieceId, numero, reste, onClose, onDone }: {
  sens: 'vente' | 'achat';
  pieceId: number;
  numero: string;
  reste: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [montant, setMontant] = useState(String(Math.round(reste * 100) / 100));
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [numCheque, setNumCheque] = useState('');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Caisse encaissante : par défaut celle de l'utilisateur (comme le desktop), limitée à ses comptes autorisés
  const moi = useSession((s) => s.dossierUser);
  const { comptesAutorises } = useDroits();
  const { data: soldesData } = useQuery(SOLDES_COMPTES);
  const comptes: { compte_id: number; compte: string }[] = comptesAutorises(
    (Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [])
      .filter((c: any) => c.compte_id != null && String(c.compte ?? '').trim() !== ''),
    (c: any) => c.compte,
  );
  const [compteId, setCompteId] = useState<string>(moi?.compte_id != null ? String(moi.compte_id) : '');
  // La caisse par défaut doit faire partie des comptes autorisés (PrevilegeBank) ;
  // sinon le select afficherait un autre compte que celui réellement envoyé.
  useEffect(() => {
    if (!soldesData) return;
    if (compteId && !comptes.some((c) => String(c.compte_id) === compteId)) {
      setCompteId(comptes[0] ? String(comptes[0].compte_id) : '');
    }
  }, [soldesData, comptes, compteId]);
  const { data: refs } = useQuery(MODES_PAYEMENT);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const [ajouter, { loading }] = useMutation(sens === 'vente' ? ADD_REGLEMENT_CLIENT : ADD_REGLEMENT_FOURNISSEUR);
  const verbe = sens === 'vente' ? 'Encaisser' : 'Payer';

  async function valider() {
    setError(null);
    const m = parseFloat(montant);
    if (!m || m <= 0) { setError('Saisissez un montant positif.'); return; }
    if (m > reste + 0.009) { setError(`Le montant dépasse le reste à payer (${fmtMoney(reste)} DA).`); return; }
    try {
      await ajouter({
        variables: {
          input: {
            ...(sens === 'vente' ? { vente_id: pieceId } : { achat_id: pieceId }),
            montant: m,
            date,
            mode_payement: mode || undefined,
            num_cheque: numCheque || undefined,
            observation: observation || undefined,
            compte_id: compteId ? Number(compteId) : undefined,
            compte: comptes.find((c) => String(c.compte_id) === compteId)?.compte ?? undefined,
          },
        },
      });
      onDone();
    } catch (e: any) {
      setError(e.message ?? 'Règlement impossible.');
    }
  }

  return (
    <Dialog
      title={`${verbe} — pièce ${numero}`}
      subtitle={<>Reste à payer : <span className="money">{fmtMoney(reste)} DA</span></>}
      icon={sens === 'vente' ? 'cash' : 'wallet'} iconTone="success" width={480}
      closeOnOverlay={false} onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant="primary" icon="check" loading={loading} onClick={() => void valider()} disabled={loading}>
            {loading ? 'Enregistrement…' : verbe}
          </Button>
        </>
      )}
    >
      {error && <Alert tone="danger" compact className="mb-3">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant (DA)" required>
          <TextInput type="number" min="0" step="0.01" autoFocus value={montant} size="lg" mono align="right"
                     onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Field label="Date" required>
          <TextInput type="date" value={date} size="lg" onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Mode de paiement">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="Espece">Espèces</option>
            {modes.map((m: any, i) => {
              const v = String(m.nom ?? m.name ?? m.mode ?? m);
              return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
            })}
          </Select>
        </Field>
        <Field label="N° chèque / pièce">
          <TextInput value={numCheque} onChange={(e) => setNumCheque(e.target.value)} />
        </Field>
        <Field label="Caisse / compte" className="col-span-2">
          <Select value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">— aucun —</option>
            {comptes.map((c) => <option key={c.compte_id} value={String(c.compte_id)}>{c.compte}</option>)}
          </Select>
        </Field>
        <Field label="Observation" className="col-span-2">
          <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
