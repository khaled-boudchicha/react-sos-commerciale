import { create } from 'zustand';
import type { Droits } from '../lib/droits';

export type AgentInfo = { agentId: string; label: string; isOnline: boolean; lastDossier?: string | null };
export type DossierUser = {
  id: number; username: string;
  name?: string | null; typeuser?: string | null;
  /** Compte de trésorerie par défaut de l'utilisateur (Delphi : CompteID) */
  compte?: string | null; compte_id?: number | null;
  /** Droits d'accès (absent si l'agent ne les fournit pas encore → aucun blocage) */
  droits?: Droits;
  /** Jeton signé par l'agent, envoyé à chaque requête : l'agent y vérifie les droits */
  user_token?: string;
} & Record<string, unknown>;

/** Construit l'utilisateur de session depuis la réponse `loginDossierUser` de l'agent. */
export function dossierUserDepuisLogin(res: any): DossierUser {
  return {
    id: Number(res.user_id), username: String(res.username),
    name: res.name ?? null, typeuser: res.typeuser ?? null,
    compte: res.compte ?? null, compte_id: res.compte_id ?? null,
    droits: res.droits && typeof res.droits === 'object' ? res.droits : undefined,
    user_token: typeof res.user_token === 'string' ? res.user_token : undefined,
  };
}

export type SessionState = {
  hydrated: boolean;
  cloudUrl: string;
  token: string | null;
  agent: AgentInfo | null;
  dossier: string | null;
  dossierUser: DossierUser | null;
  /** Code d'erreur d'accès poussé par le serveur (ACCOUNT_BLOCKED / SUBSCRIPTION_*) */
  accessError: string | null;

  setCloudUrl: (url: string) => void;
  setAuth: (token: string, agent: AgentInfo) => void;
  setDossier: (dossier: string) => void;
  setDossierUser: (u: DossierUser) => void;
  setAccessError: (code: string | null) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
};

const DEFAULT_CLOUD_URL = import.meta.env.VITE_CLOUD_URL || 'https://api.druxamed.com/graphql';

const PERSIST_KEY = 'session';

function persist(s: SessionState) {
  void window.gc?.store.set(PERSIST_KEY, {
    cloudUrl: s.cloudUrl,
    token: s.token,
    agent: s.agent,
    dossier: s.dossier,
    dossierUser: s.dossierUser,
  });
}

export const useSession = create<SessionState>((set, get) => ({
  hydrated: false,
  cloudUrl: DEFAULT_CLOUD_URL,
  token: null,
  agent: null,
  dossier: null,
  dossierUser: null,
  accessError: null,

  setCloudUrl: (cloudUrl) => { set({ cloudUrl }); persist(get()); },
  setAuth: (token, agent) => { set({ token, agent, accessError: null }); persist(get()); },
  setDossier: (dossier) => { set({ dossier }); persist(get()); },
  setDossierUser: (dossierUser) => { set({ dossierUser }); persist(get()); },
  setAccessError: (accessError) => set({ accessError }),
  logout: () => {
    set({ token: null, agent: null, dossier: null, dossierUser: null, accessError: null });
    void window.gc?.store.delete(PERSIST_KEY);
  },
  hydrate: async () => {
    const saved = (await window.gc?.store.get(PERSIST_KEY)) as Partial<SessionState> | undefined;
    set({
      hydrated: true,
      cloudUrl: saved?.cloudUrl || DEFAULT_CLOUD_URL,
      token: saved?.token ?? null,
      agent: saved?.agent ?? null,
      dossier: saved?.dossier ?? null,
      // Session d'avant les droits côté serveur (sans jeton utilisateur) : on
      // redemande l'utilisateur du dossier, sans refaire la connexion cloud.
      dossierUser: saved?.dossierUser?.user_token ? saved.dossierUser : null,
    });
  },
}));

/** Identifiant stable de l'appareil (quota max_devices côté cloud). */
export async function getDeviceId(): Promise<string> {
  const existing = (await window.gc?.store.get('deviceId')) as string | undefined;
  if (existing) return existing;
  const id = crypto.randomUUID();
  await window.gc?.store.set('deviceId', id);
  return id;
}
