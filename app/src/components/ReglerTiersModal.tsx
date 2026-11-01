import { useState } from 'react';
import { REGLER_CLIENT, REGLER_FOURNISSEUR } from '../api/queries';
import { gql, useMutation, useQuery } from '@apollo/client';
import { fmtMoney, isoToday } from '../lib/format';
import { StatusPill } from './ui/atoms';
import Dialog from './ui/Dialog';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Alert } from './ui/States';
import { useDroits } from '../lib/droits';

const MODES = gql`
  query ModesEtComptes { modesPayement banques }
`;

type ApercuLigne = {
  numero: string; type_facture: string; montant_regle: number;
  reste_avant: number; reste_apres: number; solde: boolean;
};
type Apercu = {
  montant: number; distribue: number; reliquat: number; avance_creee: boolean;
  nb_factures: number; total_du_avant: number; lignes: ApercuLigne[];
  executed?: boolean; uuid?: string;
};

/**
 * Règlement d'un tiers avec lettrage FIFO (distribution automatique sur les
 * pièces les plus anciennes) et aperçu `dry_run` avant validation.
 * kind='client' → mutation reglerClient (encaissement) ;
 * kind='fournisseur' → reglerFournisseur (décaissement).
 */
export default function ReglerTiersModal({ kind, codeTiers, nom, onClose, onDone }: {
  kind: 'client' | 'fournisseur';
  codeTiers: string; nom: string; onClose: () => void; onDone: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [compte, setCompte] = useState('');
  const [observation, setObservation] = useState('');
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [done, setDone] = useState<Apercu | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: refs } = useQuery(MODES);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const { comptesAutorises } = useDroits();
  // Droit PrevilegeBank : seulement les comptes autorisés à l'utilisateur
  const banques: any[] = comptesAutorises(Array.isArray(refs?.banques) ? refs.banques : [], (b: any) => String(b.nom ?? b.name ?? ''));

  const [regler, { loading }] = useMutation(kind === 'client' ? REGLER_CLIENT : REGLER_FOURNISSEUR);

  function buildInput(dryRun: boolean) {
    const b = banques.find((x) => String(x.nom ?? x.name) === compte);
    return {
      ...(kind === 'client' ? { code_cli: codeTiers } : { code_four: codeTiers }),
      montant: parseFloat(montant),
      date,
      mode_payement: mode || undefined,
      compte: compte || undefined,
      compte_id: b?.id ?? undefined,
      observation: observation || undefined,
      dry_run: dryRun,
    };
  }

  async function run(dryRun: boolean) {
    setError(null);
    const m = parseFloat(montant);
    if (!m || m <= 0) { setError('Saisissez un montant positif.'); return; }
    try {
      const { data } = await regler({ variables: { input: buildInput(dryRun) } });
      const res: Apercu = kind === 'client' ? data?.reglerClient : data?.reglerFournisseur;
      if (dryRun) setApercu(res);
      else { setDone(res); onDone(); }
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  const verb = kind === 'client' ? 'Encaisser' : 'Payer';

  return (
    <Dialog title={`${verb} — ${nom}`} subtitle="Distribution automatique sur les pièces les plus anciennes (reliquat → avance)"
            icon="cash" size="md" onClose={onClose} closeOnOverlay={false}
            footer={done ? (
              <Button variant="primary" onClick={onClose}>Fermer</Button>
            ) : (
              <>
                <Button icon="eye" onClick={() => run(true)} disabled={loading} loading={loading && !apercu}>Aperçu</Button>
                <Button variant="primary" icon="check" onClick={() => run(false)} disabled={loading || !apercu}
                        title={!apercu ? "Faites d'abord un aperçu" : undefined}>
                  Confirmer le règlement
                </Button>
              </>
            )}>
      {error && <Alert tone="danger" compact className="mb-3">{error}</Alert>}

      {done ? (
        <div className="flex flex-col gap-3">
          <Alert tone="success" compact>Règlement enregistré</Alert>
          <Recap a={done} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Montant (DA)" required>
              <TextInput type="number" min="0" step="0.01" autoFocus value={montant} mono
                         onChange={(e) => { setMontant(e.target.value); setApercu(null); }} />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            <Field label="Compte / caisse">
              <Select value={compte} onChange={(e) => setCompte(e.target.value)}>
                <option value="">— défaut —</option>
                {banques.map((b: any, i) => {
                  const v = String(b.nom ?? b.name ?? b);
                  return <option key={i} value={v}>{v}</option>;
                })}
              </Select>
            </Field>
            <Field label="Observation" className="col-span-2">
              <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} />
            </Field>
          </div>

          {apercu && (
            <div className="border border-line-soft rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-sunken text-xs font-bold text-ink-label">Aperçu de la distribution</div>
              <table className="w-full text-sm">
                <tbody>
                  {apercu.lignes.map((l, i) => (
                    <tr key={i} className="border-t border-line-soft">
                      <td className="px-3 py-1.5"><span className="money">{l.numero}</span></td>
                      <td className="px-3 py-1.5 text-right money">{fmtMoney(l.montant_regle)}</td>
                      <td className="px-3 py-1.5 text-right text-ink-muted money">reste {fmtMoney(l.reste_apres)}</td>
                      <td className="px-3 py-1.5 text-right">{l.solde ? <StatusPill tone="ok">Soldée</StatusPill> : <StatusPill tone="warn">Partiel</StatusPill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-line-soft"><Recap a={apercu} /></div>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

function Recap({ a }: { a: Apercu }) {
  return (
    <div className="text-sm text-ink-label flex gap-4 flex-wrap">
      <span>Distribué : <b className="money">{fmtMoney(a.distribue)}</b> sur {a.nb_factures} pièce(s)</span>
      <span>Dû avant : <span className="money">{fmtMoney(a.total_du_avant)}</span></span>
      {a.reliquat > 0 && <span style={{ color: a.avance_creee ? 'var(--info-text)' : 'var(--warning-text)' }}>
        Reliquat : <b className="money">{fmtMoney(a.reliquat)}</b>{a.avance_creee ? ' → avance' : ''}
      </span>}
    </div>
  );
}
