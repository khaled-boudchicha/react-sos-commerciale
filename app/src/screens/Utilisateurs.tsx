import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  DOSSIER_USERS, CREATE_DOSSIER_USER, UPDATE_DOSSIER_USER, DELETE_DOSSIER_USER, SOLDES_COMPTES,
} from '../api/queries';
import { useSession } from '../store/session';
import { CATALOGUE_DROITS, Droits, ModuleDroit, MODULES_DROITS } from '../lib/droits';
import { fmtDate } from '../lib/format';
import { PageHeader, StatusPill, Tabs } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox, Field, Select, TextInput } from '../components/ui/Field';
import { Alert, EmptyState, Loading } from '../components/ui/States';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

type UserDossier = {
  id: number; username: string; nom?: string | null; prenom?: string | null; name?: string | null;
  typeuser?: string | null; compte?: string | null; compte_id?: number | null;
  last_connect?: string | null; droits: Droits;
};

type Brouillon = {
  id: number | null; username: string; prenom: string; nom: string; password: string;
  typeuser: 'admin' | 'user'; compte_id: string; droits: Droits;
};

const DROITS_VIDES: Droits = { admin: false, vente: [], achat: [], stock: [], tiers: [], bank: [], autre: [], dossier: [] };

function brouillonDepuis(u: UserDossier | null): Brouillon {
  if (!u) return { id: null, username: '', prenom: '', nom: '', password: '', typeuser: 'user', compte_id: '', droits: DROITS_VIDES };
  return {
    id: u.id, username: u.username ?? '', prenom: u.prenom ?? '', nom: u.nom ?? '', password: '',
    typeuser: String(u.typeuser).toLowerCase() === 'admin' ? 'admin' : 'user',
    compte_id: u.compte_id != null ? String(u.compte_id) : '',
    droits: { ...DROITS_VIDES, ...u.droits },
  };
}

/** Nombre de droits accordés dans un module (« tout » affiché comme tel). */
function compte(v: '*' | string[]): string {
  return v === '*' ? 'tout' : String(v.length);
}

export default function Utilisateurs() {
  const toast = useToast();
  const moi = useSession((s) => s.dossierUser);
  const { data, loading, refetch } = useQuery(DOSSIER_USERS, { fetchPolicy: 'network-only' });
  const { data: soldes } = useQuery(SOLDES_COMPTES);
  const users: UserDossier[] = Array.isArray(data?.dossierUsers) ? data.dossierUsers : [];
  const comptes: { compte_id: number; compte: string }[] = (Array.isArray(soldes?.soldesComptes) ? soldes.soldesComptes : [])
    .filter((c: any) => c.compte);

  const [selection, setSelection] = useState<number | 'nouveau' | null>(null);
  const [b, setB] = useState<Brouillon>(brouillonDepuis(null));
  const [module, setModule] = useState<ModuleDroit>('vente');
  const [confirmSuppr, setConfirmSuppr] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [creer, { loading: creation }] = useMutation(CREATE_DOSSIER_USER);
  const [maj, { loading: majEnCours }] = useMutation(UPDATE_DOSSIER_USER);
  const [supprimer, { loading: suppression }] = useMutation(DELETE_DOSSIER_USER);

  // Sélection par défaut : le premier utilisateur
  useEffect(() => {
    if (selection === null && users.length) setSelection(users[0].id);
  }, [users, selection]);

  useEffect(() => {
    if (selection === 'nouveau') setB(brouillonDepuis(null));
    else if (selection != null) setB(brouillonDepuis(users.find((u) => u.id === selection) ?? null));
    setErreur(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, data]);

  const estAdmin = b.typeuser === 'admin';

  function setModuleDroits(m: ModuleDroit, v: '*' | string[]) {
    setB((x) => ({ ...x, droits: { ...x.droits, [m]: v } }));
  }

  function basculer(m: ModuleDroit, libelle: string) {
    const cur = b.droits[m];
    const liste = cur === '*' ? [] : [...cur];
    const i = liste.indexOf(libelle);
    if (i >= 0) liste.splice(i, 1); else liste.push(libelle);
    setModuleDroits(m, liste);
  }

  // Groupes affichés : catalogue + libellés présents chez l'utilisateur mais
  // inconnus du catalogue (conservés tels quels à l'enregistrement).
  const groupes = useMemo(() => {
    if (module === 'bank') {
      const noms = new Set(comptes.map((c) => c.compte));
      const cur = b.droits.bank;
      if (Array.isArray(cur)) cur.forEach((n) => noms.add(n));
      return [{ groupe: 'Comptes de trésorerie accessibles', libelles: [...noms] }];
    }
    const cat = CATALOGUE_DROITS[module];
    const connus = new Set(cat.flatMap((g) => g.libelles));
    const cur = b.droits[module];
    const autres = Array.isArray(cur) ? cur.filter((l) => !connus.has(l)) : [];
    return autres.length ? [...cat, { groupe: 'Autres libellés (desktop)', libelles: autres }] : cat;
  }, [module, b.droits, comptes]);

  async function enregistrer() {
    setErreur(null);
    if (!b.username.trim()) { setErreur('Le nom d’utilisateur est requis.'); return; }
    const c = comptes.find((x) => String(x.compte_id) === b.compte_id);
    const input = {
      username: b.username.trim(), prenom: b.prenom || null, nom: b.nom || null,
      typeuser: b.typeuser,
      compte: c?.compte ?? null, compte_id: b.compte_id === '' ? null : Number(b.compte_id),
      ...(b.password ? { password: b.password } : {}),
      droits: {
        vente: b.droits.vente, achat: b.droits.achat, stock: b.droits.stock, tiers: b.droits.tiers,
        bank: b.droits.bank, autre: b.droits.autre, dossier: b.droits.dossier,
      },
    };
    try {
      if (b.id == null) {
        const { data: r } = await creer({ variables: { input } });
        toast.success(`Utilisateur ${b.username} créé.`);
        await refetch();
        if (r?.createDossierUser?.id) setSelection(Number(r.createDossierUser.id));
      } else {
        await maj({ variables: { id: b.id, input } });
        toast.success(`Utilisateur ${b.username} enregistré.`);
        await refetch();
        // Ses propres droits changent → la session les reprend au prochain rafraîchissement
      }
    } catch (e: any) {
      setErreur(e.message ?? 'Enregistrement impossible.');
      toast.error(e.message ?? 'Enregistrement impossible.');
    }
  }

  async function confirmerSuppression() {
    if (b.id == null) return;
    try {
      await supprimer({ variables: { id: b.id } }); // acteur = utilisateur du jeton de session
      toast.success(`Utilisateur ${b.username} supprimé.`);
      setConfirmSuppr(false);
      setSelection(null);
      await refetch();
    } catch (e: any) {
      setConfirmSuppr(false);
      setErreur(e.message ?? 'Suppression impossible.');
    }
  }

  const tout = b.droits[module] === '*';

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Utilisateurs & droits" icon="shield"
                  breadcrumb={[{ label: 'Paramètres', to: '/parametres' }, { label: 'Utilisateurs & droits' }]}
                  description="Utilisateurs du dossier partagés avec le logiciel desktop : les droits accordés ici s’appliquent aux deux applications.">
        <Button icon="plus" onClick={() => setSelection('nouveau')}>Nouvel utilisateur</Button>
      </PageHeader>

      <div className="grid grid-cols-[280px_1fr] gap-3.5 items-start">
        {/* Liste */}
        <Card padding="none" className="overflow-hidden">
          {loading && !users.length && <Loading className="p-4" />}
          {users.map((u) => (
            <button key={u.id} type="button" onClick={() => setSelection(u.id)} aria-pressed={selection === u.id}
                    className={`w-full text-left px-3.5 py-2.5 border-b border-line-soft last:border-0 transition-colors duration-fast ${selection === u.id ? 'bg-brand-soft' : 'hover:bg-hover'}`}>
              <div className="flex items-center gap-2">
                <b className="text-base text-ink">{u.username}</b>
                {String(u.typeuser).toLowerCase() === 'admin' && <StatusPill tone="ok">admin</StatusPill>}
                {Number(moi?.id) === u.id && <StatusPill tone="mut">vous</StatusPill>}
              </div>
              <div className="text-xs text-ink-muted">
                {u.name || '—'}{u.last_connect ? ` · vu le ${fmtDate(u.last_connect)}` : ''}
              </div>
            </button>
          ))}
          {selection === 'nouveau' && (
            <div className="px-3.5 py-2.5 bg-brand-soft text-base font-bold text-brand-text">Nouvel utilisateur…</div>
          )}
        </Card>

        {/* Fiche */}
        {selection == null && !loading && (
          <Card><EmptyState icon="user" title="Aucun utilisateur sélectionné" description="Choisissez un utilisateur dans la liste ou créez-en un nouveau." /></Card>
        )}
        {selection != null && (
          <Card className="flex flex-col gap-4">
            {erreur && <Alert tone="danger" compact>{erreur}</Alert>}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Nom d’utilisateur" required>
                <TextInput value={b.username} onChange={(e) => setB({ ...b, username: e.target.value })} maxLength={50} />
              </Field>
              <Field label="Prénom">
                <TextInput value={b.prenom} onChange={(e) => setB({ ...b, prenom: e.target.value })} maxLength={50} />
              </Field>
              <Field label="Nom">
                <TextInput value={b.nom} onChange={(e) => setB({ ...b, nom: e.target.value })} maxLength={50} />
              </Field>
              <Field label="Mot de passe">
                <TextInput type="password" value={b.password} onChange={(e) => setB({ ...b, password: e.target.value })}
                           placeholder={b.id == null ? '' : 'inchangé si vide'} maxLength={50} autoComplete="new-password" />
              </Field>
              <Field label="Profil">
                <Select value={b.typeuser} onChange={(e) => setB({ ...b, typeuser: e.target.value as 'admin' | 'user' })}>
                  <option value="user">Utilisateur (droits ci-dessous)</option>
                  <option value="admin">Administrateur (tous les droits)</option>
                </Select>
              </Field>
              <Field label="Caisse par défaut">
                <Select value={b.compte_id} onChange={(e) => setB({ ...b, compte_id: e.target.value })}>
                  <option value="">—</option>
                  {comptes.map((c) => <option key={c.compte_id} value={String(c.compte_id)}>{c.compte}</option>)}
                </Select>
              </Field>
            </div>

            {/* Matrice des droits */}
            <div className={estAdmin ? 'opacity-50 pointer-events-none' : ''}>
              <div className="mb-3">
                <Tabs value={module} onChange={setModule} variant="underline" size="sm" label="Modules de droits"
                      options={MODULES_DROITS.map((m) => ({
                        code: m.module,
                        label: <>{m.label} <span className="text-ink-muted font-semibold">({estAdmin ? 'tout' : compte(b.droits[m.module])})</span></>,
                      }))} />
              </div>
              <Checkbox className="mb-3 font-bold" label="Tous les droits de ce module"
                        checked={tout} onChange={(e) => setModuleDroits(module, e.target.checked ? '*' : [])} />
              <div className={`grid grid-cols-2 gap-3 ${tout ? 'opacity-50 pointer-events-none' : ''}`}>
                {groupes.map((g) => (
                  <div key={g.groupe} className="border border-line-soft rounded-md p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-2xs font-bold uppercase tracking-wide text-ink-muted">{g.groupe}</div>
                      <Button variant="link" size="xs"
                              onClick={() => {
                                const cur = b.droits[module];
                                const liste = new Set(cur === '*' ? [] : cur);
                                const tousCoches = g.libelles.every((l) => liste.has(l));
                                g.libelles.forEach((l) => (tousCoches ? liste.delete(l) : liste.add(l)));
                                setModuleDroits(module, [...liste]);
                              }}>
                        tout / rien
                      </Button>
                    </div>
                    {g.libelles.length === 0 && <div className="text-xs text-ink-muted">Aucun élément.</div>}
                    {g.libelles.map((l) => (
                      <div key={l} className="py-0.5">
                        <Checkbox label={l.trim()}
                                  checked={tout || (Array.isArray(b.droits[module]) && (b.droits[module] as string[]).includes(l))}
                                  onChange={() => basculer(module, l)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {estAdmin && <div className="text-xs text-ink-muted -mt-2">Un administrateur dispose de tous les droits.</div>}

            <div className="flex gap-2 justify-end border-t border-line-soft pt-3">
              {b.id != null && Number(moi?.id) !== b.id && (
                <Button variant="danger" icon="trash" className="mr-auto" onClick={() => setConfirmSuppr(true)}>
                  Supprimer
                </Button>
              )}
              <Button variant="primary" icon="save" onClick={() => void enregistrer()} disabled={creation || majEnCours}
                      loading={creation || majEnCours}>
                {creation || majEnCours ? 'Enregistrement…' : b.id == null ? 'Créer l’utilisateur' : 'Enregistrer'}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {confirmSuppr && (
        <ConfirmDialog title="Supprimer cet utilisateur ?"
                       message={<>L’utilisateur <b>{b.username}</b> ne pourra plus se connecter (desktop et application). Ses pièces restent intactes.</>}
                       confirmLabel="Supprimer l’utilisateur" danger loading={suppression}
                       onConfirm={() => void confirmerSuppression()} onCancel={() => setConfirmSuppr(false)} />
      )}
    </div>
  );
}
