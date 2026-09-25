import { useEffect, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { ADD_REGLEMENT_CLIENT, ADD_REGLEMENT_FOURNISSEUR, SOLDES_COMPTES } from '../../api/queries';
import { useSession } from '../../store/session';
import { useDroits } from '../../lib/droits';
import { fmtMoney, isoToday } from '../../lib/format';
import { bandeauDanger } from './prefillPiece';

const MODES = gql`
  query ModesPayementPiece { modesPayement }
`;

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
  const { data: refs } = useQuery(MODES);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[460px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-extrabold text-[15px]">{verbe} — pièce {numero}</div>
            <div className="text-[11px] text-ink-muted">Reste à payer : <span className="money">{fmtMoney(reste)} DA</span></div>
          </div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        {error && <div className="text-[12px] rounded-md px-3 py-2 mb-3" style={bandeauDanger}>{error}</div>}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-[11px] font-bold text-ink-label">Montant (DA)
            <input type="number" min="0" step="0.01" autoFocus value={montant}
                   onChange={(e) => setMontant(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-[14px] font-normal" />
          </label>
          <label className="text-[11px] font-bold text-ink-label">Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>
          <label className="text-[11px] font-bold text-ink-label">Mode de paiement
            <select value={mode} onChange={(e) => setMode(e.target.value)}
                    className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
              <option value="Espece">Espèces</option>
              {modes.map((m: any, i) => {
                const v = String(m.nom ?? m.name ?? m.mode ?? m);
                return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
              })}
            </select>
          </label>
          <label className="text-[11px] font-bold text-ink-label">N° chèque / pièce
            <input value={numCheque} onChange={(e) => setNumCheque(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>
          <label className="text-[11px] font-bold text-ink-label col-span-2">Caisse / compte
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)}
                    className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
              <option value="">— aucun —</option>
              {comptes.map((c) => <option key={c.compte_id} value={String(c.compte_id)}>{c.compte}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-bold text-ink-label col-span-2">Observation
            <input value={observation} onChange={(e) => setObservation(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={loading}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">
            Annuler
          </button>
          <button onClick={() => void valider()} disabled={loading}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            {loading ? 'Enregistrement…' : verbe}
          </button>
        </div>
      </div>
    </div>
  );
}
