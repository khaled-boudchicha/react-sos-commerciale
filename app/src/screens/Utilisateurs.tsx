import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  DOSSIER_USERS, CREATE_DOSSIER_USER, UPDATE_DOSSIER_USER, DELETE_DOSSIER_USER, SOLDES_COMPTES,
} from '../api/queries';
import { useSession } from '../store/session';
import { CATALOGUE_DROITS, Droits, ModuleDroit, MODULES_DROITS } from '../lib/droits';
import { fmtDate } from '../lib/format';
import { PageHeader, StatusPill } from '../components/ui/atoms';
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

  const input = 'mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal text-[12.5px]';
  const tout = b.droits[module] === '*';

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Utilisateurs & droits">
        <button onClick={() => setSelection('nouveau')}
                className="rounded-md px-3 py-1.5 font-bold text-[12px] text-white bg-brand-700">
          + Nouvel utilisateur
        </button>
      </PageHeader>
      <div className="text-[11.5px] text-ink-muted -mt-2">
        Utilisateurs du dossier partagés avec le logiciel desktop : les droits accordés ici s’appliquent aux deux applications.
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-3.5 items-start">
        {/* Liste */}
        <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden">
          {loading && !users.length && <div className="p-4 text-[12px] text-ink-muted">Chargement…</div>}
          {users.map((u) => (
            <button key={u.id} onClick={() => setSelection(u.id)}
                    className={`w-full text-left px-3.5 py-2.5 border-b border-line-soft last:border-0 ${selection === u.id ? 'bg-brand-50' : 'hover:bg-line-soft'}`}>
              <div className="flex items-center gap-2">
                <b className="text-[12.5px] text-ink">{u.username}</b>
                {String(u.typeuser).toLowerCase() === 'admin' && <StatusPill tone="ok">admin</StatusPill>}
                {Number(moi?.id) === u.id && <StatusPill tone="mut">vous</StatusPill>}
              </div>
              <div className="text-[11px] text-ink-muted">
                {u.name || '—'}{u.last_connect ? ` · vu le ${fmtDate(u.last_connect)}` : ''}
              </div>
            </button>
          ))}
          {selection === 'nouveau' && (
            <div className="px-3.5 py-2.5 bg-brand-50 text-[12.5px] font-bold text-brand-700">Nouvel utilisateur…</div>
          )}
        </div>

        {/* Fiche */}
        {selection != null && (
          <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 flex flex-col gap-4">
            {erreur && (
              <div className="text-[12px] rounded-md px-3 py-2"
                   style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{erreur}</div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <label className="text-[11px] font-bold text-ink-label">Nom d’utilisateur *
                <input value={b.username} onChange={(e) => setB({ ...b, username: e.target.value })} className={input} maxLength={50} />
              </label>
              <label className="text-[11px] font-bold text-ink-label">Prénom
                <input value={b.prenom} onChange={(e) => setB({ ...b, prenom: e.target.value })} className={input} maxLength={50} />
              </label>
              <label className="text-[11px] font-bold text-ink-label">Nom
                <input value={b.nom} onChange={(e) => setB({ ...b, nom: e.target.value })} className={input} maxLength={50} />
              </label>
              <label className="text-[11px] font-bold text-ink-label">Mot de passe
                <input type="password" value={b.password} onChange={(e) => setB({ ...b, password: e.target.value })}
                       placeholder={b.id == null ? '' : 'inchangé si vide'} className={input} maxLength={50} autoComplete="new-password" />
              </label>
              <label className="text-[11px] font-bold text-ink-label">Profil
                <select value={b.typeuser} onChange={(e) => setB({ ...b, typeuser: e.target.value as 'admin' | 'user' })} className={input}>
                  <option value="user">Utilisateur (droits ci-dessous)</option>
                  <option value="admin">Administrateur (tous les droits)</option>
                </select>
              </label>
              <label className="text-[11px] font-bold text-ink-label">Caisse par défaut
                <select value={b.compte_id} onChange={(e) => setB({ ...b, compte_id: e.target.value })} className={input}>
                  <option value="">—</option>
                  {comptes.map((c) => <option key={c.compte_id} value={String(c.compte_id)}>{c.compte}</option>)}
                </select>
              </label>
            </div>

            {/* Matrice des droits */}
            <div className={estAdmin ? 'opacity-50 pointer-events-none' : ''}>
              <div className="flex gap-1 flex-wrap border-b border-line-soft mb-3">
                {MODULES_DROITS.map((m) => (
                  <button key={m.module} onClick={() => setModule(m.module)}
                          className={`px-3 py-1.5 text-[12px] font-bold rounded-t-sm -mb-px border-b-2 ${module === m.module ? 'border-brand-700 text-brand-700' : 'border-transparent text-ink-label'}`}>
                    {m.label} <span className="text-ink-muted font-semibold">({estAdmin ? 'tout' : compte(b.droits[m.module])})</span>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[12px] font-bold text-ink mb-3">
                <input type="checkbox" checked={tout} onChange={(e) => setModuleDroits(module, e.target.checked ? '*' : [])} />
                Tous les droits de ce module
              </label>
              <div className={`grid grid-cols-2 gap-3 ${tout ? 'opacity-50 pointer-events-none' : ''}`}>
                {groupes.map((g) => (
                  <div key={g.groupe} className="border border-line-soft rounded-md p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted">{g.groupe}</div>
                      <button className="text-[10.5px] font-bold text-brand-700"
                              onClick={() => {
                                const cur = b.droits[module];
                                const liste = new Set(cur === '*' ? [] : cur);
                                const tousCoches = g.libelles.every((l) => liste.has(l));
                                g.libelles.forEach((l) => (tousCoches ? liste.delete(l) : liste.add(l)));
                                setModuleDroits(module, [...liste]);
                              }}>
                        tout / rien
                      </button>
                    </div>
                    {g.libelles.length === 0 && <div className="text-[11.5px] text-ink-muted">Aucun élément.</div>}
                    {g.libelles.map((l) => (
                      <label key={l} className="flex items-center gap-2 text-[12px] text-ink-label py-0.5">
                        <input type="checkbox" checked={tout || (Array.isArray(b.droits[module]) && (b.droits[module] as string[]).includes(l))}
                               onChange={() => basculer(module, l)} />
                        {l.trim()}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {estAdmin && <div className="text-[11.5px] text-ink-muted -mt-2">Un administrateur dispose de tous les droits.</div>}

            <div className="flex gap-2 justify-end border-t border-line-soft pt-3">
              {b.id != null && Number(moi?.id) !== b.id && (
                <button onClick={() => setConfirmSuppr(true)}
                        className="mr-auto rounded-md px-3 py-2 font-bold text-[12px]"
                        style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
                  Supprimer
                </button>
              )}
              <button onClick={() => void enregistrer()} disabled={creation || majEnCours}
                      className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700 disabled:opacity-50">
                {creation || majEnCours ? 'Enregistrement…' : b.id == null ? 'Créer l’utilisateur' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmSuppr && (
        <ConfirmDialog title="Supprimer cet utilisateur ?"
                       message={<>L’utilisateur <b>{b.username}</b> ne pourra plus se connecter (desktop et application). Ses pièces restent intactes.</>}
                       confirmLabel="Supprimer" danger loading={suppression}
                       onConfirm={() => void confirmerSuppression()} onCancel={() => setConfirmSuppr(false)} />
      )}
    </div>
  );
}
