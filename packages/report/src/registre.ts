import type { DatasetDef, ReportData, ReportDef } from './model';

/**
 * Registres alimentés par l'application hôte.
 *  - Types de documents (« vente », « facture », « commande »…) : jeux de données exposés au designer + jeu d'exemple.
 *  - Modèles livrés : en lecture seule, à dupliquer pour les modifier.
 * Le paquet n'en déclare aucun : voir `src/exemples/` pour un exemple complet.
 */

export type KindDef = {
  id: string;
  label: string;
  /** Jeux de données (champs) affichés dans l'arbre « Données » du designer. */
  datasets: DatasetDef[];
  /** Jeu d'exemple réaliste : aperçu dans le designer, sans accès aux vraies données. */
  sample: ReportData;
};

const types = new Map<string, KindDef>();

/** Déclare (ou remplace) un type de document. */
export function declarerType(k: KindDef): void { types.set(k.id, k); }
export const listerTypes = (): KindDef[] => [...types.values()];
export const typeDe = (id: string): KindDef | undefined => types.get(id);

const GENERIQUE: KindDef = { id: 'document', label: 'Document', datasets: [], sample: {} };
/** Type demandé, sinon le premier déclaré, sinon un type vide : le designer ne plante jamais sur un type inconnu. */
export const kindDe = (id: string): KindDef => types.get(id) ?? listerTypes()[0] ?? GENERIQUE;

export type ModeleIntegre = { id: string; build: () => ReportDef };

const integres = new Map<string, ModeleIntegre>();

export function declarerModeleIntegre(m: ModeleIntegre): void { integres.set(m.id, m); }
export const listerModelesIntegres = (): ModeleIntegre[] => [...integres.values()];

export function modeleIntegre(id: string): ReportDef | null {
  const m = integres.get(id);
  if (!m) return null;
  const e = m.build();
  e.id = m.id;
  return e;
}
