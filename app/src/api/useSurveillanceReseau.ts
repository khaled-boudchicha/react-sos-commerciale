import { useEffect } from 'react';
import { apollo } from './client';
import { MY_AGENTS } from './auth';
import { useSession, type AgentInfo } from '../store/session';
import { etatConnexion, useReseau, type EtatConnexion } from '../store/reseau';

/** Cadence de la sonde : normale, puis resserrée tant qu'une panne est en cours (détection < 30 s). */
export const INTERVALLE_NORMAL_MS = 20_000;
export const INTERVALLE_DEGRADE_MS = 6_000;

let sondeEnCours: Promise<void> | null = null;

/**
 * Interroge `myAgents` une fois : état de l'agent, et preuve que le cloud répond.
 * Sans relance (la cadence de la sonde s'en charge), délai court. Les appels simultanés sont fusionnés.
 */
export function sonderReseau(): Promise<void> {
  if (sondeEnCours) return sondeEnCours;
  sondeEnCours = (async () => {
    try {
      const { data } = await apollo.query({
        query: MY_AGENTS, fetchPolicy: 'network-only',
        context: { sansRelance: true, delaiMs: 10_000 },
      });
      if (Array.isArray(data?.myAgents)) useReseau.getState().definirAgents(data.myAgents as AgentInfo[]);
    } catch { /* panne déjà comptée par les liens Apollo ; erreur GraphQL : état de l'agent inchangé */ }
    finally { sondeEnCours = null; }
  })();
  return sondeEnCours;
}

/**
 * Surveillance unique de la connexion (montée une seule fois, dans AppShell) : remplace les deux
 * `useQuery(MY_AGENTS, { pollInterval })` de l'en-tête et du comptoir.
 */
export function useSurveillanceReseau() {
  const agentId = useSession((s) => s.agent?.agentId);

  useEffect(() => {
    useReseau.getState().reinitialiser();
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let actif = true;
    let generation = 0; // une seule boucle vivante, même après une relance anticipée

    const boucle = async () => {
      const g = ++generation;
      await sonderReseau();
      if (!actif || g !== generation) return;
      const { echecsCloud, navigateurEnLigne } = useReseau.getState();
      minuteur = setTimeout(boucle, echecsCloud > 0 || !navigateurEnLigne ? INTERVALLE_DEGRADE_MS : INTERVALLE_NORMAL_MS);
    };

    const relancer = () => { clearTimeout(minuteur); void boucle(); };
    const enLigne = () => { useReseau.getState().definirNavigateur(true); relancer(); };
    const horsLigne = () => useReseau.getState().definirNavigateur(false);

    window.addEventListener('online', enLigne);
    window.addEventListener('offline', horsLigne);
    void boucle();
    return () => {
      actif = false;
      clearTimeout(minuteur);
      window.removeEventListener('online', enLigne);
      window.removeEventListener('offline', horsLigne);
    };
  }, [agentId]);
}

/** État consolidé de la connexion pour l'agent courant (badges, bandeaux, blocage du comptoir). */
export function useConnexion(): EtatConnexion {
  const agent = useSession((s) => s.agent);
  const navigateurEnLigne = useReseau((s) => s.navigateurEnLigne);
  const echecsCloud = useReseau((s) => s.echecsCloud);
  const agents = useReseau((s) => s.agents);
  return etatConnexion({ navigateurEnLigne, echecsCloud, agents }, agent);
}
