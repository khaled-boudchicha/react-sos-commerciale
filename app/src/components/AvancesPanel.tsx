import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  AVANCES_CLIENTS, AVANCES_FOURNISSEURS, ADD_AVANCE_CLIENT, ADD_AVANCE_FOURNISSEUR, DELETE_AVANCE,
  REGLER_CLIENT, REGLER_FOURNISSEUR, SOLDES_COMPTES, REFERENTIELS,
} from '../api/queries';
import { SoldeCompte } from '../api/types';
import { fmtDate, fmtMoney, isoToday } from '../lib/format';
import { useDroits, D } from '../lib/droits';
import { useSession } from '../store/session';
import DataGrid, { Column } from './ui/DataGrid';
import ConfirmDialog from './ui/ConfirmDialog';
import { StatusPill } from './ui/atoms';
import { useToast } from './ui/Toast';

export type AvanceSens = 'client' | 'fournisseur';

type Avance = {
  id: number; code_cli?: string; code_four?: string; raison?: string | null;
  montant: number; reste: number; date: string; mode_payement?: string | null;
  banque?: string | null; compte?: string | null; compte_id?: number | null; observation?: string | null;
};
type ApercuLigne = { numero: string; montant_regle: number; reste_avant: number; reste_apres: number; solde: boolean };
type Apercu = {
  montant: number; distribue: number; reliquat: number; nb_factures: number;
  total_du_avant: number; lignes: ApercuLigne[]; executed?: boolean;
};

/**
 * Avances (acomptes) d'un client ou d'un fournisseur : liste, saisie,
 * imputation FIFO sur les pièces non réglées (aperçu dry_run puis validation)
 * et suppression. `onChanged` permet à la fiche parente de recharger ses soldes.
 */
export default function AvancesPanel({ sens, code, onChanged }: {
  sens: AvanceSens; code: string; onChanged?: () => void;
}) {
  const toast = useToast();
  const { peut } = useDroits();
  const peutAjouter = peut('autre', D.autre.nouveauTresorerie);
  const peutSupprimer = peut('autre', D.autre.suppressionTresorerie);

  const { data, loading, error, refetch } = useQuery(sens === 'client' ? AVANCES_CLIENTS : AVANCES_FOURNISSEURS, {
    variables: sens === 'client' ? { code_cli: code } : { code_four: code },
    fetchPolicy: 'cache-and-network',
  });
  const brut = sens === 'client' ? data?.avancesClients : data?.avancesFournisseurs;
  const avances: Avance[] = Array.isArray(brut) ? brut : [];
  const ouvertes = avances.filter((a) => Number(a.reste) > 0.009);
  const [toutes, setToutes] = useState(false);
  const affichees = toutes ? avances : ouvertes;

  const [ajout, setAjout] = useState(false);
  const [imputation, setImputation] = useState<Avance | null>(null);
  const [suppression, setSuppression] = useState<Avance | null>(null);
  const [supprimer, { loading: suppressionEnCours }] = useMutation(DELETE_AVANCE);

  function rafraichir() {
    void refetch();
    onChanged?.();
  }

  async function confirmerSuppression() {
    if (!suppression) return;
    try {
      await supprimer({ variables: { id: suppression.id, sens } });
      setSuppression(null);
      toast.success('Avance supprimée.');
      rafraichir();
    } catch (e: any) {
      setSuppression(null);
      toast.error(`Suppression impossible : ${e.message ?? 'erreur'}`);
    }
  }

  const columns: Column<Avance>[] = [
    { key: 'date', header: 'Date', width: '95px', render: (a) => fmtDate(a.date) },
    { key: 'mode', header: 'Mode', width: '110px', render: (a) => <span className="text-ink-muted">{a.mode_payement ?? '—'}</span> },
    { key: 'compte', header: 'Compte', width: '130px', render: (a) => <span className="text-ink-muted">{a.compte ?? a.banque ?? '—'}</span> },
    { key: 'obs', header: 'Observation', render: (a) => <span className="text-ink-muted">{a.observation || '—'}</span> },
    { key: 'montant', header: 'Montant', align: 'right', width: '115px', render: (a) => <span className="money">{fmtMoney(a.montant)}</span> },
    { key: 'reste', header: 'Reste', align: 'right', width: '115px', render: (a) => (
      <span className="money font-semibold" style={{ color: Number(a.reste) > 0.009 ? 'var(--info, var(--brand-700))' : 'var(--text-muted)' }}>{fmtMoney(a.reste)}</span>
    ) },
    { key: 'statut', header: '', width: '80px', render: (a) => (
      Number(a.reste) <= 0.009 ? <StatusPill tone="mut">Imputée</StatusPill>
        : Number(a.reste) < Number(a.montant) - 0.009 ? <StatusPill tone="warn">Partielle</StatusPill>
        : <StatusPill tone="ok">Ouverte</StatusPill>
    ) },
    { key: 'actions', header: '', align: 'right', width: '200px', render: (a) => (
      <span className="inline-flex gap-1.5">
        {Number(a.reste) > 0.009 && (
          <button onClick={(e) => { e.stopPropagation(); setImputation(a); }}
                  className="px-2 py-0.5 rounded-sm border border-line text-[11px] font-semibold text-brand-700">
            Imputer sur les factures
          </button>
        )}
        {peutSupprimer && (
          <button onClick={(e) => { e.stopPropagation(); setSuppression(a); }} title="Supprimer"
                  className="px-1.5 py-0.5 rounded-sm border border-line text-[11px]" style={{ color: 'var(--danger)' }}>✕</button>
        )}
      </span>
    ) },
  ];

  const totalReste = ouvertes.reduce((s, a) => s + Number(a.reste), 0);

  return (
    <div className="flex flex-col gap-2.5">
      <DataGrid columns={columns} rows={affichees} rowKey={(a) => a.id} loading={loading && avances.length === 0}
                error={error?.message}
                titre={sens === 'client' ? 'Avances reçues' : 'Avances versées'}
                emptyMessage={toutes ? 'Aucune avance.' : 'Aucune avance ouverte.'}
                actions={<>
                  <label className="text-[11.5px] font-semibold text-ink-label flex items-center gap-1.5">
                    <input type="checkbox" checked={toutes} onChange={(e) => setToutes(e.target.checked)} />
                    Afficher les avances imputées
                  </label>
                  {peutAjouter && (
                    <button onClick={() => setAjout(true)}
                            className="rounded-md px-3 py-1.5 font-bold text-[11.5px] text-white bg-brand-700">
                      ＋ Nouvelle avance
                    </button>
                  )}
                </>}
                footer={{ _label: `${ouvertes.length} avance(s) ouverte(s)`,
                          reste: <span className="money">{fmtMoney(totalReste)}</span> }} />

      {ajout && (
        <NouvelleAvanceModal sens={sens} code={code} onClose={() => setAjout(false)}
                             onDone={() => { setAjout(false); rafraichir(); }} />
      )}
      {imputation && (
        <ImputationModal sens={sens} code={code} avance={imputation} onClose={() => setImputation(null)}
                         onDone={rafraichir} />
      )}
      {suppression && (
        <ConfirmDialog title="Supprimer cette avance ?"
          message={<>Avance du {fmtDate(suppression.date)} de <b className="money">{fmtMoney(suppression.montant)} DA</b>.
            Le mouvement de trésorerie associé sera supprimé. Une avance déjà imputée (même partiellement) ne peut pas être supprimée.</>}
          confirmLabel="Supprimer" danger loading={suppressionEnCours}
          onConfirm={() => void confirmerSuppression()} onCancel={() => setSuppression(null)} />
      )}
    </div>
  );
}

/** Libellé d'un mode de paiement renvoyé par REFERENTIELS (forme variable selon l'agent). */
function nomMode(m: any): string {
  return String(m?.designation ?? m?.nom ?? m?.name ?? m?.mode ?? m ?? '');
}

function NouvelleAvanceModal({ sens, code, onClose, onDone }: {
  sens: AvanceSens; code: string; onClose: () => void; onDone: () => void;
}) {
  const user = useSession((s) => s.dossierUser);
  const toast = useToast();
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [compteId, setCompteId] = useState(user?.compte_id != null ? String(user.compte_id) : '');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: soldesData } = useQuery(SOLDES_COMPTES);
  const droitsComptes = useDroits();
  const comptes: SoldeCompte[] = (Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [])
    .filter((c: SoldeCompte) => c.compte_id != null && String(c.compte ?? '').trim() !== '')
    // Droit PrevilegeBank : seulement les comptes autorisés à l'utilisateur
    .filter((c: SoldeCompte) => droitsComptes.comptesAutorises([c], (x) => x.compte).length > 0);
  const { data: refs } = useQuery(REFERENTIELS);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];

  const [ajouter, { loading }] = useMutation(sens === 'client' ? ADD_AVANCE_CLIENT : ADD_AVANCE_FOURNISSEUR);

  async function valider() {
    setError(null);
    const m = parseFloat(montant);
    if (!m || m <= 0) { setError('Saisissez un montant positif.'); return; }
    if (!compteId) { setError('Choisissez un compte.'); return; }
    const c = comptes.find((x) => String(x.compte_id) === compteId);
    try {
      await ajouter({ variables: { input: {
        ...(sens === 'client' ? { code_cli: code } : { code_four: code }),
        montant: m, date, mode_payement: mode || undefined,
        observation: observation || undefined,
        compte: c?.compte, compte_id: Number(compteId),
      } } });
      toast.success(`Avance enregistrée · ${fmtMoney(m)} DA`);
      onDone();
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  const inputCls = 'mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[480px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-extrabold text-[15px]">Nouvelle avance {sens === 'client' ? 'client' : 'fournisseur'}</div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>
        <div className="text-[11.5px] text-ink-muted mb-4">
          {sens === 'client' ? 'Acompte reçu, imputable plus tard sur les factures du client.' : 'Acompte versé, imputable plus tard sur les pièces du fournisseur.'}
        </div>
        {error && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-bold text-ink-label">Montant (DA)
            <input type="number" min="0" step="0.01" autoFocus value={montant}
                   onChange={(e) => setMontant(e.target.value)}
                   className={`${inputCls} money text-[14px] text-right`} />
          </label>
          <label className="text-[11px] font-bold text-ink-label">Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[11px] font-bold text-ink-label">Mode de paiement
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
              <option value="Espece">Espèces</option>
              {modes.map((m: any, i: number) => {
                const v = nomMode(m);
                return !v || v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
              })}
            </select>
          </label>
          <label className="text-[11px] font-bold text-ink-label">Compte / caisse
            <select value={compteId} onChange={(e) => setCompteId(e.target.value)} className={inputCls}>
              <option value="">— choisir —</option>
              {comptes.map((c) => (
                <option key={String(c.compte_id)} value={String(c.compte_id)}>{c.compte} ({fmtMoney(c.solde)})</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-ink-label col-span-2">Observation
            <input value={observation} onChange={(e) => setObservation(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={loading}
                  className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">Annuler</button>
          <button onClick={() => void valider()} disabled={loading}
                  className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
            {loading ? 'Enregistrement…' : "Enregistrer l'avance"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Imputation d'une avance sur les pièces non réglées (FIFO, plus anciennes d'abord).
 * L'aperçu (dry_run) est demandé à l'ouverture ; la validation rejoue la même
 * distribution avec `depuis_avance_id` (aucun nouveau mouvement de trésorerie).
 */
function ImputationModal({ sens, code, avance, onClose, onDone }: {
  sens: AvanceSens; code: string; avance: Avance; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [montant, setMontant] = useState(String(Number(avance.reste)));
  const [date, setDate] = useState(isoToday());
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [fait, setFait] = useState<Apercu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regler, { loading }] = useMutation(sens === 'client' ? REGLER_CLIENT : REGLER_FOURNISSEUR);

  async function run(dryRun: boolean) {
    setError(null);
    const m = parseFloat(montant);
    if (!m || m <= 0) { setError('Saisissez un montant positif.'); return; }
    if (m > Number(avance.reste) + 0.009) { setError(`Le montant dépasse le reste de l'avance (${fmtMoney(avance.reste)} DA).`); return; }
    try {
      const { data } = await regler({ variables: { input: {
        ...(sens === 'client' ? { code_cli: code } : { code_four: code }),
        date, depuis_avance_id: avance.id, montant: m, dry_run: dryRun,
      } } });
      const res: Apercu = sens === 'client' ? data?.reglerClient : data?.reglerFournisseur;
      if (dryRun) setApercu(res);
      else {
        setFait(res);
        toast.success(`Avance imputée · ${fmtMoney(res?.distribue)} DA sur ${res?.nb_factures ?? 0} pièce(s)`);
        onDone();
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  // Aperçu immédiat avec le reste de l'avance : l'utilisateur voit la distribution sans clic préalable.
  useEffect(() => { void run(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const res = fait ?? apercu;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[580px] max-h-[85vh] overflow-auto bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-extrabold text-[15px]">Imputer l'avance sur les factures</div>
            <div className="text-[11px] text-ink-muted">
              Avance du {fmtDate(avance.date)} · reste <span className="money">{fmtMoney(avance.reste)}</span> DA — distribution sur les pièces les plus anciennes
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        {error && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
        )}

        {!fait && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-[11px] font-bold text-ink-label">Montant à imputer (DA)
              <input type="number" min="0" step="0.01" value={montant} autoFocus
                     onChange={(e) => { setMontant(e.target.value); setApercu(null); }}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-[14px] text-right font-normal" />
            </label>
            <label className="text-[11px] font-bold text-ink-label">Date
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setApercu(null); }}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
            </label>
          </div>
        )}

        {fait && <div className="text-[13px] font-bold mb-3" style={{ color: 'var(--success)' }}>✓ Imputation enregistrée</div>}

        {res && (
          <div className="mb-3 border border-line-soft rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-bg text-[11px] font-bold text-ink-label">
              {fait ? 'Distribution effectuée' : 'Aperçu de la distribution'}
            </div>
            {res.lignes.length === 0 ? (
              <div className="px-3 py-2.5 text-[12px] text-ink-muted">Aucune pièce en attente de règlement.</div>
            ) : (
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-[10px] uppercase text-ink-muted">
                    <th className="px-3 py-1.5 text-left">Pièce</th>
                    <th className="px-3 py-1.5 text-right">Reste avant</th>
                    <th className="px-3 py-1.5 text-right">Imputé</th>
                    <th className="px-3 py-1.5 text-right">Reste après</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {res.lignes.map((l, i) => (
                    <tr key={i} className="border-t border-line-soft">
                      <td className="px-3 py-1.5 money">{l.numero}</td>
                      <td className="px-3 py-1.5 text-right money text-ink-muted">{fmtMoney(l.reste_avant)}</td>
                      <td className="px-3 py-1.5 text-right money font-semibold">{fmtMoney(l.montant_regle)}</td>
                      <td className="px-3 py-1.5 text-right money">{fmtMoney(l.reste_apres)}</td>
                      <td className="px-3 py-1.5 text-right">{l.solde ? <StatusPill tone="ok">Soldée</StatusPill> : <StatusPill tone="warn">Partiel</StatusPill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-3 py-2 border-t border-line-soft text-[11.5px] text-ink-label flex gap-4 flex-wrap">
              <span>Distribué : <b className="money">{fmtMoney(res.distribue)}</b> sur {res.nb_factures} pièce(s)</span>
              <span>Dû avant : <span className="money">{fmtMoney(res.total_du_avant)}</span></span>
              {Number(res.reliquat) > 0.009 && (
                <span style={{ color: 'var(--warning)' }}>Reste sur l'avance : <b className="money">{fmtMoney(res.reliquat)}</b></span>
              )}
            </div>
          </div>
        )}

        {fait ? (
          <button onClick={onClose} className="w-full rounded-md py-2.5 font-bold text-white bg-brand-700">Fermer</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => void run(true)} disabled={loading}
                    className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">
              {loading && !apercu ? '…' : 'Aperçu'}
            </button>
            <button onClick={() => void run(false)} disabled={loading || !apercu || Number(apercu.distribue) <= 0}
                    title={!apercu ? "Faites d'abord un aperçu" : undefined}
                    className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
              {loading && apercu ? 'Imputation…' : "Confirmer l'imputation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
