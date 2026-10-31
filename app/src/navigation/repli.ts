import type { Commande, Groupe } from './commandes';

/**
 * Adaptation du ruban à la largeur (comportement d'Office) et touches d'accès, en fonctions pures.
 *
 * Niveaux : 0 = complet · 1 = grands boutons compacts · 2 = petits boutons en icônes seules ·
 * 3 et plus = les groupes se replient un par un, en partant de la droite, en un seul bouton déroulant.
 */

/** Touches d'accès des commandes (après Alt puis la lettre de l'onglet). */
export const TOUCHES_COMMANDES = '123456789ABCDEGHIJKLMNOPQRSTUVWXYZ';

/** Niveau au-delà duquel on ne réduit plus (tous les groupes repliés). */
export const niveauMax = (nbGroupes: number) => 2 + nbGroupes;

/** Nombre de groupes repliés (à droite) pour un niveau donné. */
export const nbGroupesReplies = (niveau: number, nbGroupes: number) => Math.min(nbGroupes, Math.max(0, niveau - 2));

/** Le groupe d'indice `gi` est-il replié ? (on replie en partant de la droite) */
export const estReplie = (gi: number, niveau: number, nbGroupes: number) => gi >= nbGroupes - nbGroupesReplies(niveau, nbGroupes);

export type Cible = { touche: string } & ({ type: 'cmd'; cmd: Commande } | { type: 'groupe'; groupe: Groupe });

/**
 * Touches d'accès de l'onglet : une par commande visible, une seule par groupe replié.
 * Les groupes se repliant par la droite, les touches des groupes de gauche ne changent jamais.
 */
export function ciblesTouches(groupes: Groupe[], niveau: number): Cible[] {
  type SansTouche = { type: 'cmd'; cmd: Commande } | { type: 'groupe'; groupe: Groupe };
  const brut = groupes.flatMap((g, gi): SansTouche[] => (estReplie(gi, niveau, groupes.length)
    ? [{ type: 'groupe', groupe: g }]
    : g.elements.map((e): SansTouche => ({ type: 'cmd', cmd: e.cmd }))));
  return brut.map((c, i): Cible => ({ ...c, touche: TOUCHES_COMMANDES[i] ?? '' }));
}
