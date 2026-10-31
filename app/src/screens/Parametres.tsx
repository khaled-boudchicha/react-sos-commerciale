import { useEffect, useRef, useState } from 'react';
import { D, useDroits } from '../lib/droits';
import { useMutation, useQuery } from '@apollo/client';
import { COORDONNEES_SOCIETE, UPDATE_COORDONNEES, NUMEROTATION_DOCS, SET_NUMEROTATION } from '../api/queries';
import FormModal from '../components/ui/FormModal';
import { useSession } from '../store/session';
import { PageHeader } from '../components/ui/atoms';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardHeader, DescriptionList } from '../components/ui/Card';
import { Field, SegmentedControl, Select, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/States';
import Dialog from '../components/ui/Dialog';
import {
  supporteImpressionDirecte, listerImprimantes, getImprimanteTicket, setImprimanteTicket, PrinterInfo,
} from '../print/engine/silentPrint';
import { getCachet, lireImage, setCachet } from '../print/engine/cachet';
import ChoixDisposition from '../navigation/ChoixDisposition';
import ChoixPalette from '../components/ChoixPalette';

export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  void window.gc?.store.set('theme', theme);
}

export async function loadTheme() {
  const saved = (await window.gc?.store.get('theme')) as 'light' | 'dark' | undefined;
  if (saved) document.documentElement.dataset.theme = saved;
  return saved ?? 'light';
}

/** Libellés des coordonnées affichées (clés renvoyées par COORDONNEES_SOCIETE). */
const LIBELLES_COORD: Record<string, string> = {
  raison_sociale: 'Raison sociale', adresse: 'Adresse', wilaya: 'Wilaya', telephone: 'Téléphone', email: 'Email',
  nif: 'NIF', nis: 'NIS', rc: 'RC', art: 'Art. imposition', rib: 'RIB',
};

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
      <PageHeader title="Paramètres" icon="settings" description="Apparence, connexion, impression et identité de la société">
        {peut('autre', D.autre.droitsAcces) && (
          <Button icon="shield" iconRight="arrowRight" to="/parametres/utilisateurs">Utilisateurs &amp; droits</Button>
        )}
      </PageHeader>

      <SectionMisesAJour />

      <Card as="section">
        <CardHeader title="Apparence" icon="sun" description="Palette de couleurs, thème clair / sombre et disposition du menu" />
        <h3 className="font-bold text-base text-ink mb-1">Palette de couleurs</h3>
        <p className="text-sm text-ink-muted mb-3">Effet immédiat sur tout l’écran ; chaque palette existe en clair et en sombre. Réglage propre à ce poste.</p>
        <ChoixPalette />
        <h3 className="font-bold text-base text-ink mt-5 mb-2">Thème</h3>
        <SegmentedControl label="Thème" value={theme} onChange={(t) => { setTheme(t); applyTheme(t); }}
                          options={[{ value: 'light', label: 'Clair', icon: 'sun' }, { value: 'dark', label: 'Sombre', icon: 'moon' }]} />
        <h3 className="font-bold text-base text-ink mt-5 mb-1">Disposition du menu</h3>
        <p className="text-sm text-ink-muted mb-3">Barre de navigation latérale ou ruban de commandes en haut, comme Microsoft Office. Réglage propre à ce poste.</p>
        <ChoixDisposition />
      </Card>

      <Card as="section">
        <CardHeader title="Connexion" icon="server"
                    actions={<Button variant="link" size="sm" iconRight="arrowRight" to="/diagnostic">Diagnostic de connexion</Button>} />
        <DescriptionList items={[
          { label: 'Agent', value: agent?.label ?? agent?.agentId },
          { label: 'Dossier', value: dossier },
        ]} />
      </Card>

      <Card as="section">
        <CardHeader title="Impression" icon="printer" />
        {impressionDispo ? (
          <Field label="Imprimante ticket (impression directe, sans dialogue)" className="max-w-md"
                 help="Utilisée par le bouton « Impression directe » de l'aperçu (tickets comptoir).">
            <Select value={imprimanteTicket}
                    onChange={(e) => { setImprimanteTicketState(e.target.value); void setImprimanteTicket(e.target.value); }}>
              <option value="">— imprimante par défaut du système —</option>
              {imprimantes.map((p) => (
                <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? ' (défaut)' : ''}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="text-sm text-ink-muted">
            L'impression directe (silencieuse) est disponible uniquement dans l'application installée.
          </div>
        )}
        <CachetReglage />
      </Card>

      <Card as="section">
        <CardHeader title="Coordonnées de la société" icon="building"
                    actions={peut('autre', D.autre.coordonnees) && (
                      <Button size="sm" icon="edit" onClick={() => { setErreur(null); setEditCoord(true); }}>Modifier</Button>
                    )} />
        {erreur && <Alert tone="danger" compact className="mb-3">{erreur}</Alert>}
        <DescriptionList items={['raison_sociale', 'adresse', 'wilaya', 'telephone', 'email', 'nif', 'nis', 'rc', 'art', 'rib'].map((k) => ({
          label: LIBELLES_COORD[k] ?? k.replace('_', ' '),
          value: coord[k] == null ? null : String(coord[k]),
          mono: ['nif', 'nis', 'rc', 'art', 'rib'].includes(k),
        }))} />
      </Card>

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

      <Card as="section">
        <CardHeader title="Numérotation des documents" icon="templates"
                    description="Le compteur est le dernier numéro attribué : la prochaine pièce prendra la valeur suivante." />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {numerotations.length === 0 && <div className="text-ink-muted">Aucune numérotation configurée.</div>}
          {numerotations.map((n: { type: string; masque: string; compteur: number }) => (
            <div key={n.type} className="flex items-center gap-2 border-b border-line-soft py-1.5 min-h-[34px]">
              <span className="font-semibold flex-1">{n.type}</span>
              <span className="text-ink-muted money text-xs">{n.masque}</span>
              <span className="money font-bold">{n.compteur}</span>
              {peut('autre', D.autre.numerotation) && (
                <IconButton icon="edit" label="Modifier le compteur" size="xs"
                            onClick={() => setEditNum({ type: n.type, valeur: String(n.compteur), actuel: n.compteur })} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {editNum && (
        <Dialog title={`Compteur — ${editNum.type}`} size="sm" icon="templates" closeOnOverlay={false}
                onClose={() => { if (!savingNum) setEditNum(null); }}
                footer={(
                  <>
                    <Button onClick={() => setEditNum(null)} disabled={savingNum}>Annuler</Button>
                    <Button variant="primary" icon="save" loading={savingNum} onClick={() => void enregistrerCompteur()}>
                      {savingNum ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </>
                )}>
          <p className="text-sm text-ink-muted mb-4">
            Le compteur peut seulement avancer (actuel : {editNum.actuel}) : un numéro déjà attribué ne peut pas être réattribué.
          </p>
          <Field label="Dernier numéro attribué" required error={editNum.erreur}>
            <TextInput type="number" min={editNum.actuel} step={1} value={editNum.valeur} autoFocus mono align="right"
                       onChange={(e) => setEditNum({ ...editNum, valeur: e.target.value, erreur: undefined })}
                       onKeyDown={(e) => { if (e.key === 'Enter' && !savingNum) void enregistrerCompteur(); }} />
          </Field>
        </Dialog>
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
    <Card as="section">
      <CardHeader title="Application" icon="download" description={<span className="money">v{version ?? '…'}</span>} />
      <div className="text-sm text-ink-label">{libelle}</div>
      <div className="flex gap-2 mt-3">
        {etat?.etat !== 'desactive' && (
          <Button size="sm" icon="refresh" onClick={() => void window.gc.majVerifier?.().then(setEtat)}>
            Rechercher une mise à jour
          </Button>
        )}
        {etat?.etat === 'telechargee' && (
          <Button size="sm" variant="primary" icon="download" onClick={() => void window.gc.majInstaller?.()}>
            Redémarrer et installer
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Image du cachet (tampon) utilisée par les modèles d'impression « avec cachet ». */
function CachetReglage() {
  const [cachet, setCachetState] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
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
      <div className="w-[94px] h-[86px] rounded-md border border-dashed border-line flex items-center justify-center bg-sunken overflow-hidden flex-none">
        {cachet ? <img src={cachet} alt="Cachet" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-ink-muted">Aucun cachet</span>}
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-semibold text-ink-label">Cachet de la société</span>
        <span className="text-xs text-ink-muted">Image PNG ou JPEG (fond transparent de préférence), imprimée par les modèles « avec cachet ».</span>
        <div className="flex gap-2">
          <Button size="sm" icon="upload" onClick={() => fichier.current?.click()}>
            {cachet ? 'Remplacer…' : 'Choisir une image…'}
          </Button>
          <input ref={fichier} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => void choisir(e.target.files?.[0])} />
          {cachet && (
            <Button size="sm" variant="ghost" icon="trash" className="!text-danger-text"
                    onClick={() => { void setCachet(null); setCachetState(null); }}>Retirer</Button>
          )}
        </div>
        {erreur && <span className="text-danger-text font-semibold">{erreur}</span>}
      </div>
    </div>
  );
}
