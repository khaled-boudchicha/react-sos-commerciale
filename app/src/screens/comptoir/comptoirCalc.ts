import { Article, Client } from '../../api/types';
import type { TentativeIncertaine } from './reprise';
import { LigneDoc, ligneDepuisArticle, totauxDocument } from '../../components/document/lignesDocument';

/**
 * Logique pure de la vente au comptoir (portage de ComptoirMixts.pas) — sans React,
 * testée dans __tests__/comptoir.test.ts.
 */

export const NB_TICKETS = 5;

/** Un ticket en cours (onglet « Client 01…05 » du Delphi). Non persisté côté serveur avant validation. */
export type TicketComptoir = {
  lignes: LigneDoc[];
  client: Client | null;
  /** Remise globale en % (F7). */
  remisePct: number;
  /** Mode retour (bouton « Retour ») : la validation crée un bon de retour BRT. */
  retour: boolean;
  /**
   * Encaissement resté sans réponse (voir reprise.ts) : conservé avec le ticket, donc après un
   * redémarrage, pour vérifier les ventes du jour avant de réencaisser.
   */
  incertain?: TentativeIncertaine;
};

export const ticketVide = (): TicketComptoir => ({ lignes: [], client: null, remisePct: 0, retour: false });

/** Niveau de prix du comptoir (Delphi `DefaultComptoirPrice`) : 1..4 → tiers de prix de l'article. */
export type NiveauPrix = 1 | 2 | 3 | 4;

/** Ligne de comptoir depuis un article, au niveau de prix demandé (repli sur le tarif 1). */
export function ligneComptoir(a: Article, niveau: NiveauPrix): LigneDoc {
  const l = ligneDepuisArticle(a, 'vente');
  const prix = l.prixTiers?.[niveau - 1];
  return prix && prix > 0 ? { ...l, prix_ht: prix, tarif: niveau } : l;
}

/**
 * Ajout d'un article (scan / recherche / tuile) : si l'article est déjà sur le ticket,
 * sa quantité augmente de `qte` (comportement Delphi) ; sinon nouvelle ligne.
 * Retourne aussi la clé de la ligne touchée (pour la sélectionner) et si elle est nouvelle.
 */
export function ajouterArticle(lignes: LigneDoc[], a: Article, niveau: NiveauPrix, qte = 1) {
  const idx = lignes.findIndex((l) => l.code_article === a.code);
  if (idx >= 0) {
    const next = [...lignes];
    next[idx] = { ...next[idx], qte: arrondiQte(next[idx].qte + qte) };
    return { lignes: next, key: next[idx].key, nouvelle: false };
  }
  const l = { ...ligneComptoir(a, niveau), qte };
  return { lignes: [...lignes, l], key: l.key, nouvelle: true };
}

/** Numpad +/- : pas de 1 ; en dessous de 1 on ne descend pas (Delphi : Qte > 1 requis). */
export function ajusterQte(qte: number, sens: 1 | -1): number {
  if (sens === 1) return arrondiQte(qte + 1);
  return qte > 1 ? arrondiQte(qte - 1) : qte;
}

/** Ctrl+Q : conversion « montant TTC voulu » → quantité, au prix TTC unitaire de la ligne. */
export function qteDepuisMontant(l: LigneDoc, montantTtc: number): number {
  const pu = l.prix_ht * (1 - (l.remise || 0) / 100) * (1 + (l.tva || 0) / 100);
  return pu > 0 ? arrondiQte(montantTtc / pu) : l.qte;
}

export const arrondiQte = (q: number) => Math.round(q * 1000) / 1000;

/** Totaux du ticket (formules identiques à l'agent createVente — le comptoir n'applique pas de timbre). */
export function totauxTicket(t: TicketComptoir) {
  const tot = totauxDocument(t.lignes, t.remisePct);
  const articles = t.lignes.reduce((s, l) => s + (Number(l.qte) || 0), 0);
  return { ...tot, articles, net: arrondi2(tot.net) };
}

export const arrondi2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Encaissement (dialogue CacheReglements) : montant réellement réglé sur la pièce
 * (plafonné au net), monnaie à rendre et reste dû.
 */
export function calculerEncaissement(net: number, recu: number, credit: boolean) {
  const donne = credit ? 0 : Math.max(0, recu);
  const regle = arrondi2(Math.min(donne, net));
  return {
    regle,
    rendu: arrondi2(Math.max(0, donne - net)),
    reste: arrondi2(Math.max(0, net - regle)),
  };
}

/** Arrondis proposés en saisie rapide (DZD) : paliers de billets usuels. */
export const COUPURES = [500, 1000, 2000, 5000];

/** Boutons rapides : le net exact, puis jusqu'à 3 montants ronds supérieurs (maquette : Exact · 3 500 · 4 000 · 5 000). */
export function montantsRapides(net: number): number[] {
  const exact = arrondi2(net);
  const ronds = new Set<number>();
  for (const c of COUPURES) {
    const m = Math.ceil(net / c) * c;
    if (m > exact) ronds.add(m);
  }
  return [exact, ...[...ronds].sort((a, b) => a - b).slice(0, 3)];
}
