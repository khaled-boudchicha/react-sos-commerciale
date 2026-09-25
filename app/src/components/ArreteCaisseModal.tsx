import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ARRETE_CAISSE, CLOTURER_CAISSE, SOLDES_COMPTES, COORDONNEES_SOCIETE } from '../api/queries';
import { SoldeCompte } from '../api/types';
import { fmtMoney, isoToday } from '../lib/format';
import { useSession } from '../store/session';
import { useToast } from './ui/Toast';
import ConfirmDialog from './ui/ConfirmDialog';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildArreteCaissePrint } from '../print/templates';
import type { ArreteCaisseData } from '../print/templates';
import { useDroits } from '../lib/droits';

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
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);

  const { data, loading, error: qError } = useQuery(ARRETE_CAISSE, {
    variables: { compte_id: compteId ? Number(compteId) : undefined, compte: compte?.compte ?? user?.compte ?? undefined, date },
    skip: !compteId && !user?.compte,
    fetchPolicy: 'network-only',
  });
  const arrete: ArreteCaisseData | undefined = cloture ?? data?.arreteCaisse ?? undefined;

  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [cloturer, { loading: closing }] = useMutation(CLOTURER_CAISSE);

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
    setPrintDoc(buildArreteCaissePrint(
      { arrete, montantCompte: compteSaisi, utilisateur: user?.name || user?.username },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  const inputCls = 'mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[760px] max-h-full flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div>
            <div className="font-extrabold text-[15px]">Arrêté de caisse</div>
            <div className="text-[11px] text-ink-muted">Rapprochement du solde théorique avec le comptage physique</div>
          </div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex flex-col gap-3.5">
          {(error || qError) && (
            <div className="text-[12px] rounded-md px-3 py-2"
                 style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
              {error ?? qError?.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-ink-label">Compte / caisse
              <select value={compteId} disabled={!!cloture}
                      onChange={(e) => { setCompteIdChoisi(e.target.value); setCloture(null); }} className={inputCls}>
                {!compteId && <option value="">— choisir —</option>}
                {comptes.map((c) => (
                  <option key={String(c.compte_id)} value={String(c.compte_id)}>{c.compte}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink-label">Date
              <input type="date" value={date} disabled={!!cloture}
                     onChange={(e) => { setDate(e.target.value); setCloture(null); }} className={inputCls} />
            </label>
          </div>

          {loading && !arrete && <div className="text-[12px] text-ink-muted">Calcul de l'arrêté…</div>}

          {arrete && (
            <>
              <div className="grid grid-cols-4 gap-2.5">
                <Kpi label="Solde d'ouverture" value={arrete.solde_ouverture} />
                <Kpi label="Entrées" value={arrete.total_entrees} color="var(--success)" />
                <Kpi label="Sorties" value={arrete.total_sorties} color="var(--danger)" />
                <Kpi label="Solde théorique" value={arrete.solde_theorique} strong />
              </div>

              <div className="border border-line-soft rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-bg text-[10px] font-bold uppercase tracking-wider text-ink-muted">Par mode de paiement</div>
                <table className="w-full text-[12px]">
                  <tbody>
                    {arrete.par_mode.length === 0 && (
                      <tr><td className="px-3 py-2 text-ink-muted">Aucun mouvement ce jour.</td></tr>
                    )}
                    {arrete.par_mode.map((p, i) => (
                      <tr key={i} className="border-t border-line-soft">
                        <td className="px-3 py-1.5 font-semibold">{p.mode || '—'}</td>
                        <td className="px-3 py-1.5 text-right money" style={{ color: 'var(--success)' }}>+{fmtMoney(p.entrees)}</td>
                        <td className="px-3 py-1.5 text-right money" style={{ color: 'var(--danger)' }}>−{fmtMoney(p.sorties)}</td>
                        <td className="px-3 py-1.5 text-right money font-semibold">{fmtMoney(Number(p.entrees) - Number(p.sorties))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border border-line-soft rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-bg text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Mouvements du jour ({arrete.mouvements.length})
                </div>
                <div className="max-h-[200px] overflow-auto">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {arrete.mouvements.map((m) => (
                        <tr key={m.cle} className="border-t border-line-soft first:border-t-0">
                          <td className="px-3 py-1.5 w-[120px] font-semibold text-ink-label">{m.categorie ?? m.cle.replace(/\d+$/, '')}</td>
                          <td className="px-3 py-1.5">{m.raison || m.objet || '—'}</td>
                          <td className="px-3 py-1.5 w-[90px] text-ink-muted">{m.mode_payement ?? '—'}</td>
                          <td className="px-3 py-1.5 w-[120px] text-right money font-semibold"
                              style={{ color: Number(m.montant) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {Number(m.montant) >= 0 ? '+' : ''}{fmtMoney(m.montant)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="text-[11px] font-bold text-ink-label">Montant compté (DA)
                  <input type="number" step="0.01" value={montantCompte} disabled={!!cloture} autoFocus
                         onChange={(e) => setMontantCompte(e.target.value)}
                         className={`${inputCls} money text-[14px] text-right`} />
                </label>
                <div className="text-right pb-1">
                  <div className="text-[10px] font-bold uppercase text-ink-muted">Écart</div>
                  <div className="money text-[19px] font-extrabold"
                       style={{ color: ecart == null ? 'var(--text-muted)' : ecart === 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {ecart == null ? '—' : `${ecart > 0 ? '+' : ''}${fmtMoney(ecart)} DA`}
                  </div>
                </div>
                <label className="text-[11px] font-bold text-ink-label col-span-2">Observation
                  <input value={observation} disabled={!!cloture} onChange={(e) => setObservation(e.target.value)} className={inputCls} />
                </label>
              </div>

              {cloture && (
                <div className="text-[12px] rounded-md px-3 py-2 font-semibold"
                     style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)' }}>
                  ✓ Caisse clôturée{Number(cloture.ecart ?? 0) !== 0 ? ` — écart de ${fmtMoney(cloture.ecart)} DA enregistré` : ''}.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-line-soft flex-none">
          <button onClick={onClose} disabled={closing}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">
            Fermer
          </button>
          <button onClick={imprimer} disabled={!arrete}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">
            Imprimer
          </button>
          {!cloture && (
            <button onClick={demanderCloture} disabled={!arrete || closing}
                    className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
              {closing ? 'Clôture…' : 'Clôturer'}
            </button>
          )}
        </div>
      </div>

      {confirm && ecart != null && (
        <ConfirmDialog title="Clôturer avec un écart ?"
          message={<>Le montant compté diffère du solde théorique de <b className="money">{ecart > 0 ? '+' : ''}{fmtMoney(ecart)} DA</b>.
            Un {ecart > 0 ? 'encaissement' : 'décaissement'} « Écart de caisse » sera enregistré sur {compte?.compte ?? 'ce compte'} pour régulariser le solde.</>}
          confirmLabel="Clôturer" danger loading={closing}
          onConfirm={() => void doCloture()} onCancel={() => setConfirm(false)} />
      )}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
    </div>
  );
}

function Kpi({ label, value, color, strong }: { label: string; value: unknown; color?: string; strong?: boolean }) {
  return (
    <div className="border border-line-soft rounded-md px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-ink-muted">{label}</div>
      <div className={`money ${strong ? 'text-[15px] font-extrabold' : 'text-[13px] font-semibold'} mt-0.5`} style={{ color }}>
        {fmtMoney(value)}
      </div>
    </div>
  );
}
