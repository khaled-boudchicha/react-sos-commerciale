import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { SOLDES_COMPTES, REFERENTIELS } from '../api/queries';
import { SoldeCompte } from '../api/types';
import { fmtMoney, isoToday } from '../lib/format';
import { useToast } from './ui/Toast';

const ADD_ENCAISSEMENT = gql`mutation AddEncaissement($input: JSON!) { addEncaissement(input: $input) }`;
const ADD_DECAISSEMENT = gql`mutation AddDecaissement($input: JSON!) { addDecaissement(input: $input) }`;
const TRANSFERT_COMPTE = gql`mutation TransfertCompte($input: JSON!) { transfertCompte(input: $input) }`;

export type MouvementKind = 'encaissement' | 'decaissement' | 'transfert';

const TITRES: Record<MouvementKind, string> = {
  encaissement: 'Nouvel encaissement',
  decaissement: 'Nouveau décaissement',
  transfert: 'Transfert entre comptes',
};

/**
 * Saisie d'un mouvement de trésorerie : encaissement, décaissement ou transfert
 * entre comptes. Le compte (caisse/banque) est obligatoire : sans lui, le
 * mouvement n'entre dans aucun solde.
 */
export default function MouvementCaisseModal({ kind, onClose, onDone }: {
  kind: MouvementKind; onClose: () => void; onDone: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(isoToday());
  const [objet, setObjet] = useState('');
  const [mode, setMode] = useState('Espece');
  const [categorie, setCategorie] = useState('');
  const [compteId, setCompteId] = useState('');
  const [compteDestId, setCompteDestId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const { data: soldesData } = useQuery(SOLDES_COMPTES);
  // Seuls les comptes identifiés sont sélectionnables : les lignes sans compte_id
  // agrègent d'anciens mouvements non rattachés et ne sont pas une destination valide.
  const comptes: SoldeCompte[] = (Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [])
    .filter((c: SoldeCompte) => c.compte_id != null && String(c.compte ?? '').trim() !== '');
  const { data: refs } = useQuery(REFERENTIELS);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];

  const [addEnc, { loading: l1 }] = useMutation(ADD_ENCAISSEMENT);
  const [addDec, { loading: l2 }] = useMutation(ADD_DECAISSEMENT);
  const [transfert, { loading: l3 }] = useMutation(TRANSFERT_COMPTE);
  const loading = l1 || l2 || l3;

  const compteOf = (id: string) => comptes.find((c) => String(c.compte_id) === id);

  async function submit() {
    setError(null);
    const m = parseFloat(montant);
    if (!m || m <= 0) { setError('Saisissez un montant positif.'); return; }
    if (!compteId) { setError('Choisissez un compte.'); return; }
    if (kind === 'transfert' && !compteDestId) { setError('Choisissez le compte de destination.'); return; }
    if (kind === 'transfert' && compteDestId === compteId) { setError('Les deux comptes doivent être différents.'); return; }

    const src = compteOf(compteId);
    try {
      if (kind === 'transfert') {
        const dest = compteOf(compteDestId);
        await transfert({ variables: { input: {
          montant: m, date,
          compte_source_id: Number(compteId),
          compte_destination_id: Number(compteDestId),
          compte_destination: dest?.compte,
          observation: src?.compte,
        } } });
      } else {
        const input = {
          montant: m, date,
          objet: objet || undefined,
          mode_payement: mode || undefined,
          categorie: categorie || undefined,
          compte: src?.compte,
          compte_id: Number(compteId),
        };
        if (kind === 'encaissement') await addEnc({ variables: { input } });
        else await addDec({ variables: { input } });
      }
      onDone();
      onClose();
      toast.success(`${TITRES[kind]} enregistré · ${fmtMoney(m)} DA`);
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
      toast.error(`Échec : ${e.message ?? 'erreur'}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[520px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-[15px]">{TITRES[kind]}</div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        {error && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-bold text-ink-label">Montant (DA)
            <input type="number" min="0" step="0.01" autoFocus value={montant}
                   onChange={(e) => setMontant(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-[14px] text-right font-normal" />
          </label>
          <label className="text-[11px] font-bold text-ink-label">Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>

          <label className="text-[11px] font-bold text-ink-label">
            {kind === 'transfert' ? 'Compte source' : 'Compte / caisse'}
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)}
                    className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
              <option value="">— choisir —</option>
              {comptes.map((c) => (
                <option key={String(c.compte_id)} value={String(c.compte_id)}>
                  {c.compte} ({fmtMoney(c.solde)})
                </option>
              ))}
            </select>
          </label>

          {kind === 'transfert' ? (
            <label className="text-[11px] font-bold text-ink-label">Compte destination
              <select value={compteDestId} onChange={(e) => setCompteDestId(e.target.value)}
                      className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
                <option value="">— choisir —</option>
                {comptes.filter((c) => String(c.compte_id) !== compteId).map((c) => (
                  <option key={String(c.compte_id)} value={String(c.compte_id)}>
                    {c.compte} ({fmtMoney(c.solde)})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-[11px] font-bold text-ink-label">Mode de paiement
              <select value={mode} onChange={(e) => setMode(e.target.value)}
                      className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
                <option value="Espece">Espèces</option>
                {modes.map((m: any, i: number) => {
                  const v = String(m.nom ?? m.name ?? m.mode ?? m);
                  return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
                })}
              </select>
            </label>
          )}

          {kind !== 'transfert' && (
            <>
              <label className="text-[11px] font-bold text-ink-label col-span-2">Objet / libellé
                <input value={objet} onChange={(e) => setObjet(e.target.value)}
                       placeholder={kind === 'encaissement' ? 'Recette diverse…' : 'Dépense, charge…'}
                       className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
              </label>
              {kind === 'decaissement' && (
                <label className="text-[11px] font-bold text-ink-label col-span-2">Catégorie
                  <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
                          className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
                    <option value="">Décaissement (défaut)</option>
                    <option value="Charge">Charge</option>
                    <option value="Charge Production">Charge Production</option>
                  </select>
                </label>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={loading}
                  className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">
            Annuler
          </button>
          <button onClick={() => void submit()} disabled={loading}
                  className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
