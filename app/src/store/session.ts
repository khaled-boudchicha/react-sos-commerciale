import { create } from 'zustand';

export type AgentInfo = { agentId: string; label: string; isOnline: boolean; lastDossier?: string | null };
export type DossierUser = { id: number; username: string } & Record<string, unknown>;

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
      dossierUser: saved?.dossierUser ?? null,
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
