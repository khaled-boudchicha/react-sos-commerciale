import { modeleParDefaut, resoudreVersion } from '@softly/report/core';

/**
 * Modèle d'impression d'une demande : celui imposé par l'écran (ticket du poste, variantes du journal…), sinon le
 * modèle par défaut de l'utilisateur pour ce type de document, sinon le premier modèle livré. Un modèle livré qui a
 * été personnalisé est remplacé par sa version personnelle (tant que le fichier existe).
 */
export function choisirModele(d: { kind: string; modele?: string }, liste: { ref: string }[]): string | null {
  const refs = new Set(liste.map((m) => m.ref));
  const impose = d.modele ? (d.modele.includes(':') ? d.modele : `integre:${d.modele}`) : null;
  const defaut = modeleParDefaut(d.kind);
  const ref = impose && refs.has(impose) ? impose : defaut && refs.has(defaut) ? defaut : liste[0]?.ref ?? null;
  return ref ? resoudreVersion(ref, liste) : null;
}
