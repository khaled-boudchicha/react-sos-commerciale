import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ARRETE_CAISSE, CLOTURER_CAISSE, SOLDES_COMPTES, COORDONNEES_SOCIETE, TRANSFERT_COMPTE } from '../api/queries';
import { SoldeCompte } from '../api/types';
import { fmtMoney, isoToday } from '../lib/format';
import { useSession } from '../store/session';
import { useToast } from './ui/Toast';
import ConfirmDialog from './ui/ConfirmDialog';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeArreteCaisse, demandeRecuTransfert } from '../impression/demandes';
import type { ArreteCaisseData } from '../print/templates';
import { D, useDroits } from '../lib/droits';
import Dialog from './ui/Dialog';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { KpiTile } from './ui/Kpi';
import { Alert, Loading } from './ui/States';
import { Money } from './ui/atoms';
import type { Tone } from './ui/Icon';


/**
 * Arrêté de caisse d'une journée : solde d'ouverture, entrées/sorties par mode,
 * mouvements du jour et solde théorique. Le caissier saisit le montant compté ;
 * la clôture enregistre l'écart éventuel comme mouvement « Écart de caisse ».
 */
export default function ArreteCaisseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useSession((s) => s.dossierUser);
  const toast = useToast();

  const { data: soldesData } = useQuery(SOLDES_COMPTES);
  const droitsComptes = useDroits();
  const comptes: SoldeCompte[] = (Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [])
    .filter((c: SoldeCompte) => c.compte_id != null && String(c.compte ?? '').trim() !== '')
    // Droit PrevilegeBank : seulement les comptes autorisés à l'utilisateur
    .filter((c: SoldeCompte) => droitsComptes.comptesAutorises([c], (x) => x.compte).length > 0);

  // Compte par défaut : celui de l'utilisateur connecté (caisse attitrée), sinon le premier.
  const [compteIdChoisi, setCompteIdChoisi] = useState<string>(user?.compte_id != null ? String(user.compte_id) : '');
  const compteId = compteIdChoisi || (comptes[0] ? String(comptes[0].compte_id) : '');
  const compte = comptes.find((c) => String(c.compte_id) === compteId);
  const [date, setDate] = useState(isoToday());
  const [montantCompte, setMontantCompte] = useState('');
  const [observation, setObservation] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [cloture, setCloture] = useState<ArreteCaisseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);

  const { data, loading, error: qError } = useQuery(ARRETE_CAISSE, {
    variables: { compte_id: compteId ? Number(compteId) : undefined, compte: compte?.compte ?? user?.compte ?? undefined, date },
    skip: !compteId && !user?.compte,
    fetchPolicy: 'network-only',
  });
  const arrete: ArreteCaisseData | undefined = cloture ?? data?.arreteCaisse ?? undefined;

  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [cloturer, { loading: closing }] = useMutation(CLOTURER_CAISSE);
  // Transfert des espèces comptées vers une autre caisse, après clôture (reçu imprimé)
  const [transferer, { loading: transfert }] = useMutation(TRANSFERT_COMPTE);
  const peutTransfert = droitsComptes.peut('autre', D.autre.transfertComptes);
  const [destination, setDestination] = useState('');
  const [transfertFait, setTransfertFait] = useState(false);
  const [confirmTransfert, setConfirmTransfert] = useState(false);
  const destinations = comptes.filter((c) => String(c.compte_id) !== compteId);
  const cibleTransfert = destinations.find((c) => String(c.compte_id) === destination) ?? null;

  async function doTransfert() {
    if (!compte || !cibleTransfert || compteSaisi == null) return;
    try {
      await transferer({ variables: { input: {
        date, montant: compteSaisi, observation: observation || undefined,
        compte_source: compte.compte, compte_source_id: compte.compte_id,
        compte_destination: cibleTransfert.compte, compte_destination_id: cibleTransfert.compte_id,
      } } });
      setConfirmTransfert(false);
      setTransfertFait(true);
      toast.success(`Transfert de ${fmtMoney(compteSaisi)} DA enregistré.`);
      setPrintDoc(demandeRecuTransfert({
        source: compte.compte, destination: cibleTransfert.compte, montant: compteSaisi, date,
        utilisateur: user?.name || user?.username, observation,
        societe: (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
      }));
    } catch (e: any) {
      setError(e?.message ?? 'Transfert impossible.');
      setConfirmTransfert(false);
    }
  }

  const compteSaisi = montantCompte.trim() === '' ? null : parseFloat(montantCompte);
  const ecart = arrete && compteSaisi != null && Number.isFinite(compteSaisi)
    ? Math.round((compteSaisi - Number(arrete.solde_theorique)) * 100) / 100 : null;

  function demanderCloture() {
    setError(null);
    if (compteSaisi == null || !Number.isFinite(compteSaisi)) { setError('Saisissez le montant compté.'); return; }
    if (!compteId) { setError('Choisissez un compte.'); return; }
    // Un écart non nul crée un mouvement : on demande confirmation explicite.
    if (ecart !== 0) setConfirm(true);
    else void doCloture();
  }

  async function doCloture() {
    if (!arrete || compteSaisi == null) return;
    try {
      const { data: d } = await cloturer({ variables: { input: {
        compte_id: Number(compteId), compte: compte?.compte ?? arrete.compte, date,
        montant_compte: compteSaisi, observation: observation || undefined,
        user_name: user?.username,
      } } });
      setConfirm(false);
      setCloture(d?.cloturerCaisse ?? null);
      onDone();
      const e = Number(d?.cloturerCaisse?.ecart ?? 0);
      toast.success(e === 0 ? 'Caisse clôturée — aucun écart.' : `Caisse clôturée — écart de ${fmtMoney(e)} DA enregistré.`);
    } catch (e: any) {
      setConfirm(false);
      setError(e.message ?? 'Clôture impossible.');
      toast.error(`Échec : ${e.message ?? 'erreur'}`);
    }
  }

  function imprimer() {
    if (!arrete) return;
    setPrintDoc(demandeArreteCaisse(
      { arrete, montantCompte: compteSaisi, utilisateur: user?.name || user?.username },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  return (
    <>
    <Dialog title="Arrêté de caisse" subtitle="Rapprochement du solde théorique avec le comptage physique"
            icon="lock" width={760} onClose={onClose} closeOnOverlay={false}
            footer={(
              <>
                <Button onClick={onClose} disabled={closing}>Fermer</Button>
                <Button icon="printer" onClick={imprimer} disabled={!arrete}>Imprimer</Button>
                {!cloture && (
                  <Button variant="primary" icon="lock" onClick={demanderCloture} disabled={!arrete || closing} loading={closing}>
                    {closing ? 'Clôture…' : 'Clôturer'}
                  </Button>
                )}
              </>
            )}>
      <div className="flex flex-col gap-3.5">
        {(error || qError) && <Alert tone="danger" compact>{error ?? qError?.message}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Compte / caisse">
            <Select value={compteId} disabled={!!cloture}
                    onChange={(e) => { setCompteIdChoisi(e.target.value); setCloture(null); }}>
              {!compteId && <option value="">— choisir —</option>}
              {comptes.map((c) => (
                <option key={String(c.compte_id)} value={String(c.compte_id)}>{c.compte}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} disabled={!!cloture}
                       onChange={(e) => { setDate(e.target.value); setCloture(null); }} />
          </Field>
        </div>

        {loading && !arrete && <Loading label="Calcul de l'arrêté…" />}

        {arrete && (
          <>
            <div className="grid grid-cols-4 gap-2.5">
              {/* Totaux en espèces seulement : c'est ce que l'on compte physiquement */}
              <Kpi label="Ouverture espèces" value={arrete.solde_ouverture} />
              <Kpi label="Entrées espèces" value={arrete.total_entrees} tone="success" />
              <Kpi label="Sorties espèces" value={arrete.total_sorties} tone="danger" />
              <Kpi label="Espèces théoriques" value={arrete.solde_theorique} strong />
            </div>

            <div className="border border-line-soft rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-sunken text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Par mode de paiement <span className="normal-case font-normal">(chèques et virements : pour information, hors comptage)</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {arrete.par_mode.length === 0 && (
                    <tr><td className="px-3 py-2 text-ink-muted">Aucun mouvement ce jour.</td></tr>
                  )}
                  {arrete.par_mode.map((p, i) => (
                    <tr key={i} className="border-t border-line-soft">
                      <td className="px-3 py-1.5 font-semibold">{p.mode || '—'}</td>
                      <td className="px-3 py-1.5 text-right money" style={{ color: 'var(--success-text)' }}>+{fmtMoney(p.entrees)}</td>
                      <td className="px-3 py-1.5 text-right money" style={{ color: 'var(--danger-text)' }}>−{fmtMoney(p.sorties)}</td>
                      <td className="px-3 py-1.5 text-right money font-semibold">{fmtMoney(Number(p.entrees) - Number(p.sorties))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-line-soft rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-sunken text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Mouvements du jour ({arrete.mouvements.length})
              </div>
              <div className="max-h-[200px] overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {arrete.mouvements.map((m) => (
                      <tr key={m.cle} className="border-t border-line-soft first:border-t-0">
                        <td className="px-3 py-1.5 w-[120px] font-semibold text-ink-label">{m.categorie ?? m.cle.replace(/\d+$/, '')}</td>
                        <td className="px-3 py-1.5">{m.raison || m.objet || '—'}</td>
                        <td className="px-3 py-1.5 w-[90px] text-ink-muted">{m.mode_payement ?? '—'}</td>
                        <td className="px-3 py-1.5 w-[120px] text-right">
                          <Money value={m.montant} signed colorNeg={false} tone={Number(m.montant) >= 0 ? 'success' : 'danger'} className="font-semibold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Montant compté (DA)" required>
                <TextInput type="number" step="0.01" value={montantCompte} disabled={!!cloture} autoFocus mono align="right"
                           onChange={(e) => setMontantCompte(e.target.value)} />
              </Field>
              <div className="text-right pb-1">
                <div className="text-2xs font-bold uppercase text-ink-muted">Écart</div>
                <div className="money text-xl font-extrabold"
                     style={{ color: ecart == null ? 'var(--text-muted)' : ecart === 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                  {ecart == null ? '—' : `${ecart > 0 ? '+' : ''}${fmtMoney(ecart)} DA`}
                </div>
              </div>
              <Field label="Observation" className="col-span-2">
                <TextInput value={observation} disabled={!!cloture} onChange={(e) => setObservation(e.target.value)} />
              </Field>
            </div>

            {cloture && (
              <Alert tone="success" compact>
                Caisse clôturée{Number(cloture.ecart ?? 0) !== 0 ? ` — écart de ${fmtMoney(cloture.ecart)} DA enregistré` : ''}.
              </Alert>
            )}
          </>
        )}

        {cloture && peutTransfert && destinations.length > 0 && !transfertFait && (
          <div className="border border-line-soft rounded-md p-3 flex flex-col gap-2">
            <div className="text-sm font-bold">Transférer les espèces comptées vers une autre caisse</div>
            <div className="flex gap-2 items-center">
              <Select value={destination} onChange={(e) => setDestination(e.target.value)} className="flex-1"
                      aria-label="Caisse de destination">
                <option value="">— Caisse de destination —</option>
                {destinations.map((c) => <option key={c.compte_id} value={String(c.compte_id)}>{c.compte}</option>)}
              </Select>
              <Button icon="movements" onClick={() => setConfirmTransfert(true)}
                      disabled={!cibleTransfert || compteSaisi == null || transfert}>
                Transférer {compteSaisi != null ? fmtMoney(compteSaisi) : ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>

      {confirm && ecart != null && (
        <ConfirmDialog title="Clôturer avec un écart ?"
          message={<>Le montant compté diffère du solde théorique de <b className="money">{ecart > 0 ? '+' : ''}{fmtMoney(ecart)} DA</b>.
            Un {ecart > 0 ? 'encaissement' : 'décaissement'} « Écart de caisse » sera enregistré sur {compte?.compte ?? 'ce compte'} pour régulariser le solde.</>}
          confirmLabel="Clôturer avec écart" cancelLabel="Revenir au comptage" danger loading={closing}
          onConfirm={() => void doCloture()} onCancel={() => setConfirm(false)} />
      )}
      {confirmTransfert && cibleTransfert && compte && compteSaisi != null && (
        <ConfirmDialog title="Transférer les espèces ?"
          message={<>Transférer <b className="money">{fmtMoney(compteSaisi)} DA</b> de <b>{compte.compte}</b> vers <b>{cibleTransfert.compte}</b>. Un reçu sera imprimé.</>}
          confirmLabel="Transférer" loading={transfert}
          onConfirm={() => void doTransfert()} onCancel={() => setConfirmTransfert(false)} />
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
    </>
  );
}

function Kpi({ label, value, tone, strong }: { label: string; value: unknown; tone?: Tone; strong?: boolean }) {
  return (
    <KpiTile size="sm" label={label} value={fmtMoney(value)} valueTone={tone}
             icon={strong ? 'cash' : undefined} tone="brand" selected={strong} />
  );
}
