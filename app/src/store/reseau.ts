import { create } from 'zustand';
import type { AgentInfo } from './session';

/**
 * État de la connexion, en trois maillons distincts : Internet du poste, cloud SOFTLY, agent de
 * l'établissement. Alimenté par :
 * - les événements `online` / `offline` du navigateur ;
 * - chaque réponse du cloud (succès) et chaque panne de transport (liens Apollo, client.ts) ;
 * - la sonde `myAgents` (useSurveillanceReseau), seule source de l'état de l'agent.
 * Le cloud n'est déclaré injoignable qu'après SEUIL_ECHECS pannes consécutives (évite les faux positifs
 * d'un réseau lent) ; une seule réponse le rétablit.
 */

export const SEUIL_ECHECS = 2;
const JOURNAL_MAX = 50;
/** Deux pannes identiques à moins d'une minute d'écart sont regroupées dans le journal. */
const FENETRE_REGROUPEMENT = 60_000;
const CLE_JOURNAL = 'gc.journalReseau';

export type IncidentReseau = {
  /** Horodatage du premier et du dernier échec regroupés (ms epoch). */
  debut: number; fin: number;
  operation: string;
  message: string;
  /** Nombre d'échecs regroupés. */
  n: number;
};

export type Cause = 'internet' | 'cloud' | 'agent';

type EtatReseau = {
  navigateurEnLigne: boolean;
  echecsCloud: number;
  /** Dernière liste `myAgents` reçue (null = jamais reçue depuis l'ouverture). */
  agents: AgentInfo[] | null;
  derniereReponse: number | null;
  journal: IncidentReseau[];
  signalerSucces: () => void;
  signalerEchec: (operation: string, message: string) => void;
  definirAgents: (agents: AgentInfo[]) => void;
  definirNavigateur: (enLigne: boolean) => void;
  viderJournal: () => void;
  reinitialiser: () => void;
};

function lireJournal(): IncidentReseau[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_JOURNAL) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.operation === 'string').slice(0, JOURNAL_MAX) : [];
  } catch { return []; }
}
function ecrireJournal(j: IncidentReseau[]) {
  try { localStorage.setItem(CLE_JOURNAL, JSON.stringify(j)); } catch { /* stockage indisponible */ }
}

/** Ajoute un échec au journal (le plus récent en tête), en regroupant les répétitions. */
export function journaliser(journal: IncidentReseau[], operation: string, message: string, maintenant: number): IncidentReseau[] {
  const [dernier, ...reste] = journal;
  if (dernier && dernier.operation === operation && dernier.message === message && maintenant - dernier.fin < FENETRE_REGROUPEMENT) {
    return [{ ...dernier, fin: maintenant, n: dernier.n + 1 }, ...reste];
  }
  return [{ debut: maintenant, fin: maintenant, operation, message, n: 1 }, ...journal].slice(0, JOURNAL_MAX);
}

const enLigneInitial = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export const useReseau = create<EtatReseau>((set, get) => ({
  navigateurEnLigne: enLigneInitial(),
  echecsCloud: 0,
  agents: null,
  derniereReponse: null,
  journal: lireJournal(),
  signalerSucces: () => {
    if (get().echecsCloud === 0 && get().navigateurEnLigne) { set({ derniereReponse: Date.now() }); return; }
    // Une réponse du cloud prouve aussi qu'Internet fonctionne (navigator.onLine peut retarder)
    set({ echecsCloud: 0, navigateurEnLigne: true, derniereReponse: Date.now() });
  },
  signalerEchec: (operation, message) => {
    const journal = journaliser(get().journal, operation || 'requête', message, Date.now());
    ecrireJournal(journal);
    set({ echecsCloud: get().echecsCloud + 1, journal });
  },
  definirAgents: (agents) => set({ agents }),
  definirNavigateur: (navigateurEnLigne) => set({ navigateurEnLigne }),
  viderJournal: () => { ecrireJournal([]); set({ journal: [] }); },
  /** Changement de session / d'agent : l'état de l'ancien agent ne vaut plus. */
  reinitialiser: () => set({ echecsCloud: 0, agents: null }),
}));

export type EtatConnexion = {
  ok: boolean;
  cause: Cause | null;
  /** Libellé court (badge). */
  libelle: string;
  /** Explication et conduite à tenir (bandeaux, infobulles). */
  detail: string;
};

/**
 * État consolidé pour l'agent courant. Tant qu'aucune réponse `myAgents` n'est arrivée, on garde l'état
 * connu à la connexion (`agentInitial`) — mais jamais au-delà d'une panne : un cloud injoignable rend
 * l'état de l'agent inconnu, donc « hors service ».
 */
export function etatConnexion(
  s: Pick<EtatReseau, 'navigateurEnLigne' | 'echecsCloud' | 'agents'>,
  agent: { agentId: string; isOnline?: boolean } | null | undefined,
): EtatConnexion {
  if (!s.navigateurEnLigne) {
    return { ok: false, cause: 'internet', libelle: 'Pas d’Internet',
      detail: 'Ce poste n’a plus de connexion Internet. Vérifiez le câble, le Wi-Fi ou le modem.' };
  }
  if (s.echecsCloud >= SEUIL_ECHECS) {
    return { ok: false, cause: 'cloud', libelle: 'Serveur injoignable',
      detail: 'Le serveur SOFTLY ne répond pas. Internet fonctionne peut-être, mais le service est inaccessible pour le moment.' };
  }
  const live = s.agents?.find((a) => a.agentId === agent?.agentId);
  // Agent absent de la liste (ex. connexion par code d'appairage) : état connu à la connexion, comme avant
  const agentEnLigne = live ? !!live.isOnline : !!agent?.isOnline;
  if (!agentEnLigne) {
    return { ok: false, cause: 'agent', libelle: 'Agent hors ligne',
      detail: 'Le PC de l’établissement (agent) est éteint, en veille ou sans Internet.' };
  }
  return { ok: true, cause: null, libelle: 'Connecté', detail: 'Internet, serveur et agent répondent.' };
}
