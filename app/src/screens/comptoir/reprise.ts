import type { Vente } from '../../api/types';

/**
 * Protection contre le double encaissement après une réponse perdue.
 *
 * Quand `createVente` échoue sans réponse (coupure, délai dépassé), l'agent a peut-être enregistré le
 * ticket. Sans identifiant d'idempotence côté agent (lot serveur à venir), l'application garde une trace
 * de la tentative pour ce ticket et, avant de réencaisser, cherche dans les ventes du jour un ticket
 * apparu depuis, du même montant et du même caissier.
 */
export type TentativeIncertaine = {
  /** Montant net attendu du ticket au moment de la tentative. */
  net: number;
  /** Identifiants des ventes du jour déjà connues avant la tentative. */
  connus: number[];
  /** Caissier (user_name) de la tentative. */
  utilisateur: string;
  moment: number;
};

const TOLERANCE = 0.01;

/** Ventes apparues depuis la tentative qui pourraient être ce ticket (plus récentes d'abord). */
export function ventesSuspectes(t: TentativeIncertaine, ventes: Vente[]): Vente[] {
  const connus = new Set(t.connus);
  return ventes
    .filter((v) => !connus.has(Number(v.id)))
    .filter((v) => Math.abs(Number(v.net_a_payer) - t.net) < TOLERANCE)
    .filter((v) => !v.user_name || !t.utilisateur || v.user_name === t.utilisateur)
    .sort((a, b) => Number(b.id) - Number(a.id));
}
