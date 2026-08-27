import { useEffect } from 'react';
import { gql, useApolloClient } from '@apollo/client';
import { REFRESH_TOKEN } from './auth';
import { useSession } from '../store/session';

const SESSION_STATUS = gql`query SessionStatus { sessionStatus }`;

/** Toutes les 6 h : le JWT vit 7 jours, on le renouvelle largement avant. */
const INTERVALLE_REFRESH = 6 * 60 * 60 * 1000;
/** Toutes les 2 min : détecte un blocage de compte ou une fin d'abonnement. */
const INTERVALLE_VEILLE = 2 * 60 * 1000;

/**
 * Maintient la session vivante et réactive :
 *  - renouvelle le JWT avant expiration (sinon déconnexion brutale au bout de 7 j) ;
 *  - interroge `sessionStatus` régulièrement : si le compte est bloqué ou
 *    l'abonnement expiré, le serveur répond avec un code que l'errorLink
 *    transforme en bandeau d'alerte (même mécanisme que l'app mobile).
 */
export function useSessionKeepAlive() {
  const client = useApolloClient();
  // On ne dépend QUE de la présence d'un jeton, pas de sa valeur : `renouveler`
  // appelle `setAuth` avec un nouveau JWT à chaque cycle, et re-souscrire à la
  // valeur du jeton relancerait l'effet en boucle (refresh en continu).
  const authentifie = useSession((s) => !!s.token);

  useEffect(() => {
    if (!authentifie) return;

    async function renouveler() {
      try {
        const { data } = await client.mutate({ mutation: REFRESH_TOKEN, fetchPolicy: 'no-cache' });
        const res = data?.refreshToken;
        const s = useSession.getState();
        if (res?.success && res.access_token && s.agent) {
          s.setAuth(res.access_token, s.agent);
        }
      } catch {
        /* hors ligne ou serveur indisponible : on retentera au prochain cycle */
      }
    }

    async function veiller() {
      try {
        await client.query({ query: SESSION_STATUS, fetchPolicy: 'no-cache' });
      } catch {
        /* les codes ACCOUNT_BLOCKED / SUBSCRIPTION_* sont traités par l'errorLink */
      }
    }

    void renouveler();
    void veiller();
    const idRefresh = setInterval(() => void renouveler(), INTERVALLE_REFRESH);
    const idVeille = setInterval(() => void veiller(), INTERVALLE_VEILLE);
    return () => { clearInterval(idRefresh); clearInterval(idVeille); };
  }, [authentifie, client]);
}
