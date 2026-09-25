import { useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { DROITS_DOSSIER_USER } from './queries';
import { useSession } from '../store/session';

/** Rafraîchissement des droits : toutes les 5 min, sans reconnexion. */
const INTERVALLE = 5 * 60 * 1000;

/**
 * Garde les droits de l'utilisateur dossier à jour (modifiés par un
 * administrateur, ou session ouverte avant la gestion des droits). Un agent
 * ancien qui ne connaît pas la commande renvoie `{ error }` : on ne touche à
 * rien (aucun blocage).
 */
export function useDroitsSync() {
  const userId = useSession((s) => s.dossierUser?.id);
  const { data } = useQuery(DROITS_DOSSIER_USER, {
    variables: { user_id: Number(userId) },
    skip: !userId,
    pollInterval: INTERVALLE,
    fetchPolicy: 'network-only',
  });
  const droits = data?.droitsDossierUser;
  useEffect(() => {
    if (!droits || typeof droits !== 'object' || 'error' in droits || typeof droits.admin !== 'boolean') return;
    const s = useSession.getState();
    if (!s.dossierUser) return;
    if (JSON.stringify(s.dossierUser.droits) === JSON.stringify(droits)) return;
    s.setDossierUser({ ...s.dossierUser, droits });
  }, [droits]);
}
