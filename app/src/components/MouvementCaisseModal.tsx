import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { SOLDES_COMPTES, REFERENTIELS, TRANSFERT_COMPTE } from '../api/queries';
import { SoldeCompte } from '../api/types';
import { fmtMoney, isoToday } from '../lib/format';
import { useToast } from './ui/Toast';
import { useDroits } from '../lib/droits';
import Dialog from './ui/Dialog';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Alert } from './ui/States';
import type { IconName, Tone } from './ui/Icon';

const ADD_ENCAISSEMENT = gql`mutation AddEncaissement($input: JSON!) { addEncaissement(input: $input) }`;
const ADD_DECAISSEMENT = gql`mutation AddDecaissement($input: JSON!) { addDecaissement(input: $input) }`;

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
const ICONES: Record<MouvementKind, { icon: IconName; tone: Tone }> = {
  encaissement: { icon: 'plus', tone: 'success' },
  decaissement: { icon: 'minus', tone: 'danger' },
  transfert: { icon: 'movements', tone: 'brand' },
};

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
  const droitsComptes = useDroits();
  const comptes: SoldeCompte[] = (Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [])
    .filter((c: SoldeCompte) => c.compte_id != null && String(c.compte ?? '').trim() !== '')
    // Droit PrevilegeBank : seulement les comptes autorisés à l'utilisateur
    .filter((c: SoldeCompte) => droitsComptes.comptesAutorises([c], (x) => x.compte).length > 0);
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
          // Nom du compte source : l'agent l'utilise pour imputer la sortie au bon solde
          compte_source: src?.compte,
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
    <Dialog title={TITRES[kind]} icon={ICONES[kind].icon} iconTone={ICONES[kind].tone} width={520}
            onClose={onClose} closeOnOverlay={false}
            footer={(
              <>
                <Button onClick={onClose} disabled={loading}>Annuler</Button>
                <Button variant="primary" icon="save" onClick={() => void submit()} loading={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </>
            )}>
      {error && <Alert tone="danger" compact className="mb-3">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant (DA)" required>
          <TextInput type="number" min="0" step="0.01" autoFocus value={montant} mono align="right"
                     onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label={kind === 'transfert' ? 'Compte source' : 'Compte / caisse'} required>
          <Select value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">— choisir —</option>
            {comptes.map((c) => (
              <option key={String(c.compte_id)} value={String(c.compte_id)}>
                {c.compte} ({fmtMoney(c.solde)})
              </option>
            ))}
          </Select>
        </Field>

        {kind === 'transfert' ? (
          <Field label="Compte destination" required>
            <Select value={compteDestId} onChange={(e) => setCompteDestId(e.target.value)}>
              <option value="">— choisir —</option>
              {comptes.filter((c) => String(c.compte_id) !== compteId).map((c) => (
                <option key={String(c.compte_id)} value={String(c.compte_id)}>
                  {c.compte} ({fmtMoney(c.solde)})
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Mode de paiement">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="Espece">Espèces</option>
              {modes.map((m: any, i: number) => {
                const v = String(m.nom ?? m.name ?? m.mode ?? m);
                return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
              })}
            </Select>
          </Field>
        )}

        {kind !== 'transfert' && (
          <>
            <Field label="Objet / libellé" className="col-span-2">
              <TextInput value={objet} onChange={(e) => setObjet(e.target.value)}
                         placeholder={kind === 'encaissement' ? 'Recette diverse…' : 'Dépense, charge…'} />
            </Field>
            {kind === 'decaissement' && (
              <Field label="Catégorie" className="col-span-2">
                <Select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                  <option value="">Décaissement (défaut)</option>
                  <option value="Charge">Charge</option>
                  <option value="Charge Production">Charge Production</option>
                </Select>
              </Field>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
