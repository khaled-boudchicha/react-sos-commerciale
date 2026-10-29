import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { D, useDroits } from '../lib/droits';
import { useMutation, useQuery } from '@apollo/client';
import { COORDONNEES_SOCIETE, UPDATE_COORDONNEES, NUMEROTATION_DOCS, SET_NUMEROTATION } from '../api/queries';
import FormModal from '../components/ui/FormModal';
import { useSession } from '../store/session';
import { PageHeader } from '../components/ui/atoms';
import {
  supporteImpressionDirecte, listerImprimantes, getImprimanteTicket, setImprimanteTicket, PrinterInfo,
} from '../print/engine/silentPrint';
import { getCachet, lireImage, setCachet } from '../print/engine/cachet';
import ChoixDisposition from '../navigation/ChoixDisposition';

export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  void window.gc?.store.set('theme', theme);
}

export async function loadTheme() {
  const saved = (await window.gc?.store.get('theme')) as 'light' | 'dark' | undefined;
  if (saved) document.documentElement.dataset.theme = saved;
  return saved ?? 'light';
}

export default function Parametres() {
  const { agent, dossier } = useSession();
  const { peut } = useDroits();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { data, refetch } = useQuery(COORDONNEES_SOCIETE);
  const coord = (data?.coordonneesSociete ?? {}) as Record<string, unknown>;
  const [editCoord, setEditCoord] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [updateCoord, { loading: savingCoord }] = useMutation(UPDATE_COORDONNEES);

  const { data: numData, refetch: refetchNum } = useQuery(NUMEROTATION_DOCS);
  const [setNum, { loading: savingNum }] = useMutation(SET_NUMEROTATION);
  const [editNum, setEditNum] = useState<{ type: string; valeur: string; actuel: number; erreur?: string } | null>(null);

  /** Enregistre le compteur : entier, jamais en recul (même règle que l'agent). */
  async function enregistrerCompteur() {
    if (!editNum) return;
    const saisie = editNum.valeur.trim();
    const n = Number(saisie);
    if (saisie === '' || !Number.isInteger(n) || n < 0) {
      setEditNum({ ...editNum, erreur: 'Saisissez un nombre entier positif.' });
      return;
    }
    if (n < editNum.actuel) {
      setEditNum({ ...editNum, erreur: `Le compteur ne peut pas reculer (actuel : ${editNum.actuel}).` });
      return;
    }
    try {
      await setNum({ variables: { type: editNum.type, valeur: n } });
      setEditNum(null);
      void refetchNum();
    } catch (e: any) { setEditNum({ ...editNum, erreur: e.message ?? 'Enregistrement impossible.' }); }
  }

  // getNumerotationDocs renvoie un tableau [{ type, format, compteur }]
  const numerotations = (Array.isArray(numData?.numerotationDocs) ? numData.numerotationDocs : [])
    .map((n: any) => ({
      type: String(n.type),
      masque: String(n.format ?? ''),
      compteur: Number(n.compteur ?? 0),
    }));

  useEffect(() => { void loadTheme().then(setTheme); }, []);

  const [imprimantes, setImprimantes] = useState<PrinterInfo[]>([]);
  const [imprimanteTicket, setImprimanteTicketState] = useState('');
  const impressionDispo = supporteImpressionDirecte();
  useEffect(() => {
    if (!impressionDispo) return;
    void listerImprimantes().then(setImprimantes);
    void getImprimanteTicket().then((n) => setImprimanteTicketState(n ?? ''));
  }, [impressionDispo]);

  return (
    <div className="flex flex-col gap-3.5 max-w-[720px]">
      <PageHeader title="Paramètres">
        {peut('autre', D.autre.droitsAcces) && (
          <Link to="/parametres/utilisateurs" className="text-[12px] font-bold text-brand-700">Utilisateurs &amp; droits →</Link>
        )}
      </PageHeader>

      <SectionMisesAJour />

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <h2 className="font-bold text-[13px] mb-3">Apparence</h2>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} onClick={() => { setTheme(t); applyTheme(t); }}
                    className={`px-4 py-2 rounded-md border text-[12px] font-bold ${theme === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-label'}`}>
              {t === 'light' ? '☀️ Clair' : '🌙 Sombre'}
            </button>
          ))}
        </div>
        <h3 className="font-bold text-[12.5px] mt-5 mb-1">Disposition du menu</h3>
        <p className="text-[11.5px] text-ink-muted mb-3">Barre de navigation latérale ou ruban de commandes en haut, comme Microsoft Office. Réglage propre à ce poste.</p>
        <ChoixDisposition />
      </section>

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[13px]">Connexion</h2>
          <Link to="/diagnostic" className="text-[11.5px] font-bold text-brand-700">Diagnostic de connexion →</Link>
        </div>
        <div className="text-[12px] text-ink-label flex flex-col gap-1.5">
          <div>Agent : <b>{agent?.label ?? agent?.agentId}</b></div>
          <div>Dossier : <b>{dossier}</b></div>
        </div>
      </section>

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <h2 className="font-bold text-[13px] mb-3">Impression</h2>
        {impressionDispo ? (
          <label className="text-[11px] font-bold text-ink-label block max-w-md">
            Imprimante ticket (impression directe, sans dialogue)
            <select value={imprimanteTicket}
                    onChange={(e) => { setImprimanteTicketState(e.target.value); void setImprimanteTicket(e.target.value); }}
                    className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
              <option value="">— imprimante par défaut du système —</option>
              {imprimantes.map((p) => (
                <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? ' (défaut)' : ''}</option>
              ))}
            </select>
            <div className="text-[10.5px] text-ink-muted font-normal mt-1">
              Utilisée par le bouton « Impression directe » de l'aperçu (tickets comptoir).
            </div>
          </label>
        ) : (
          <div className="text-[12px] text-ink-muted">
            L'impression directe (silencieuse) est disponible uniquement dans l'application installée.
          </div>
        )}
        <CachetReglage />
      </section>

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <div className="flex items-center mb-3">
          <h2 className="font-bold text-[13px]">Coordonnées de la société</h2>
          {peut('autre', D.autre.coordonnees) && (
            <button onClick={() => { setErreur(null); setEditCoord(true); }}
                    className="ml-auto rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
              Modifier
            </button>
          )}
        </div>
        {erreur && <div className="text-[12px] mb-2" style={{ color: 'var(--danger)' }}>{erreur}</div>}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
          {['raison_sociale', 'adresse', 'wilaya', 'telephone', 'email', 'nif', 'nis', 'rc', 'art', 'rib'].map((k) => (
            <div key={k} className="flex justify-between border-b border-line-soft py-1">
              <span className="text-ink-muted uppercase text-[10px] font-bold tracking-wide">{k.replace('_', ' ')}</span>
              <span className="font-semibold">{String(coord[k] ?? '—')}</span>
            </div>
          ))}
        </div>
      </section>

      {editCoord && (
        <FormModal
          title="Coordonnées de la société"
          width={760}
          loading={savingCoord}
          error={erreur}
          initial={coord}
          sections={[
            { title: 'Identité', fields: [
              { name: 'raison_sociale', label: 'Raison sociale', span: 8, required: true },
              { name: 'slogan', label: 'Slogan', span: 4 },
              { name: 'adresse', label: 'Adresse', span: 12 },
            ] },
            { title: 'Contacts', fields: [
              { name: 'telephone', label: 'Téléphone', span: 4 },
              { name: 'fax', label: 'Fax', span: 4 },
              { name: 'email', label: 'Email', span: 4 },
              { name: 'site_web', label: 'Site web', span: 12 },
            ] },
            { title: 'Identifiants fiscaux (imprimés sur les documents)', fields: [
              { name: 'rc', label: 'RC', span: 3 },
              { name: 'nif', label: 'NIF', span: 3 },
              { name: 'nis', label: 'NIS', span: 3 },
              { name: 'art', label: 'Art. Imp.', span: 3 },
            ] },
          ]}
          onCancel={() => setEditCoord(false)}
          onSubmit={async (values) => {
            setErreur(null);
            try {
              await updateCoord({ variables: { input: values } });
              setEditCoord(false);
              void refetch();
            } catch (e: any) { setErreur(e.message ?? 'Enregistrement impossible.'); }
          }}
        />
      )}

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <h2 className="font-bold text-[13px] mb-1">Numérotation des documents</h2>
        <div className="text-[11px] text-ink-muted mb-3">
          Le compteur est le dernier numéro attribué : la prochaine pièce prendra la valeur suivante.
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
          {numerotations.length === 0 && <div className="text-ink-muted">Aucune numérotation configurée.</div>}
          {numerotations.map((n: { type: string; masque: string; compteur: number }) => (
            <div key={n.type} className="flex items-center gap-2 border-b border-line-soft py-1.5">
              <span className="font-semibold flex-1">{n.type}</span>
              <span className="text-ink-muted money text-[11px]">{n.masque}</span>
              <span className="money font-bold">{n.compteur}</span>
              {peut('autre', D.autre.numerotation) && (
                <button onClick={() => setEditNum({ type: n.type, valeur: String(n.compteur), actuel: n.compteur })}
                        className="px-1.5 py-0.5 rounded-sm border border-line text-ink-muted text-[11px]" title="Modifier le compteur">✎</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {editNum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
          <div className="w-[420px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
            <div className="font-extrabold text-[15px] mb-1">Compteur — {editNum.type}</div>
            <div className="text-[11.5px] text-ink-muted mb-4">
              Le compteur peut seulement avancer (actuel : {editNum.actuel}) : un numéro déjà attribué ne peut pas être réattribué.
            </div>
            <input type="number" min={editNum.actuel} step={1} value={editNum.valeur} autoFocus
                   onChange={(e) => setEditNum({ ...editNum, valeur: e.target.value, erreur: undefined })}
                   onKeyDown={(e) => { if (e.key === 'Enter' && !savingNum) void enregistrerCompteur(); }}
                   className="w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right" />
            {editNum.erreur && (
              <div className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--danger)' }}>{editNum.erreur}</div>
            )}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditNum(null)} disabled={savingNum}
                      className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">Annuler</button>
              <button disabled={savingNum}
                      onClick={() => void enregistrerCompteur()}
                      className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
                {savingNum ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Version installée + état des mises à jour automatiques (application installée uniquement). */
function SectionMisesAJour() {
  const [version, setVersion] = useState<string | null>(null);
  const [etat, setEtat] = useState<Awaited<ReturnType<NonNullable<typeof window.gc.majEtat>>> | null>(null);
  const electron = typeof window.gc?.majEtat === 'function';

  useEffect(() => {
    if (!electron) return;
    void window.gc.version?.().then(setVersion);
    void window.gc.majEtat?.().then(setEtat);
    return window.gc.onMaj?.(setEtat);
  }, [electron]);

  if (!electron) return null;
  const libelle = !etat ? '…' : {
    desactive: 'Mises à jour automatiques non configurées pour ce build.',
    verification: 'Recherche de mises à jour…',
    a_jour: 'L’application est à jour.',
    disponible: `Version ${'version' in etat ? etat.version : ''} disponible — téléchargement en cours…`,
    telechargee: `Version ${'version' in etat ? etat.version : ''} prête : elle sera installée à la fermeture.`,
    erreur: `Erreur : ${'message' in etat ? etat.message : ''}`,
  }[etat.etat];

  return (
    <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-bold text-[13px]">Application</h2>
        <span className="text-[11px] text-ink-muted money">v{version ?? '…'}</span>
      </div>
      <div className="text-[12px] text-ink-label">{libelle}</div>
      <div className="flex gap-2 mt-3">
        {etat?.etat !== 'desactive' && (
          <button onClick={() => void window.gc.majVerifier?.().then(setEtat)}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Rechercher une mise à jour
          </button>
        )}
        {etat?.etat === 'telechargee' && (
          <button onClick={() => void window.gc.majInstaller?.()}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] text-white bg-brand-700">
            Redémarrer et installer
          </button>
        )}
      </div>
    </section>
  );
}

/** Image du cachet (tampon) utilisée par les modèles d'impression « avec cachet ». */
function CachetReglage() {
  const [cachet, setCachetState] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { void getCachet().then(setCachetState); }, []);

  async function choisir(f: File | undefined) {
    if (!f) return;
    setErreur(null);
    try {
      const uri = await lireImage(f);
      await setCachet(uri);
      setCachetState(uri);
    } catch (e: any) { setErreur(e.message ?? String(e)); }
  }

  return (
    <div className="mt-4 pt-3 border-t border-line-soft flex items-center gap-4">
      <div className="w-[94px] h-[86px] rounded-md border border-dashed border-line flex items-center justify-center bg-bg overflow-hidden flex-none">
        {cachet ? <img src={cachet} alt="Cachet" className="max-w-full max-h-full object-contain" /> : <span className="text-[10.5px] text-ink-muted">Aucun cachet</span>}
      </div>
      <div className="flex flex-col gap-1.5 text-[12px]">
        <span className="text-[11px] font-bold text-ink-label">Cachet de la société</span>
        <span className="text-[11px] text-ink-muted">Image PNG ou JPEG (fond transparent de préférence), imprimée par les modèles « avec cachet ».</span>
        <div className="flex gap-2">
          <label className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label cursor-pointer hover:border-brand-300">
            {cachet ? 'Remplacer…' : 'Choisir une image…'}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => void choisir(e.target.files?.[0])} />
          </label>
          {cachet && (
            <button onClick={() => { void setCachet(null); setCachetState(null); }}
                    className="rounded-md px-3 py-1.5 font-bold text-[12px]" style={{ color: 'var(--danger)' }}>Retirer</button>
          )}
        </div>
        {erreur && <span style={{ color: 'var(--danger)' }}>{erreur}</span>}
      </div>
    </div>
  );
}
