import { useEffect, useRef, useState } from 'react';

/**
 * Brouillons automatiques des pièces en cours de création (vente, achat) : la saisie est recopiée sur le
 * poste au fil de l'eau, pour être reprise après une fermeture, un plantage ou une coupure de courant.
 * Un brouillon par sens, par dossier et par utilisateur ; il expire au bout de 7 jours ; il est effacé
 * à l'enregistrement de la pièce, ou quand l'utilisateur l'écarte (« Supprimer le brouillon »,
 * « Quitter sans enregistrer »). Les modifications de pièces existantes ne sont pas concernées.
 */

export type Brouillon<T> = { date: number; donnees: T };

export const DUREE_BROUILLON_MS = 7 * 24 * 3600_000;
const DELAI_ENREGISTREMENT_MS = 800;

export const cleBrouillon = (sens: 'vente' | 'achat', dossier: string | null | undefined, utilisateur: string | number | null | undefined) =>
  dossier ? `gc.brouillon.${sens}.${dossier}.${utilisateur ?? 'anonyme'}` : null;

export function lireBrouillon<T>(cle: string | null, maintenant = Date.now()): Brouillon<T> | null {
  if (!cle) return null;
  try {
    const b = JSON.parse(localStorage.getItem(cle) ?? 'null') as Brouillon<T> | null;
    if (!b || typeof b.date !== 'number' || maintenant - b.date > DUREE_BROUILLON_MS) return null;
    return b;
  } catch { return null; }
}

export function ecrireBrouillon<T>(cle: string | null, donnees: T, maintenant = Date.now()) {
  if (!cle) return;
  try { localStorage.setItem(cle, JSON.stringify({ date: maintenant, donnees } satisfies Brouillon<T>)); } catch { /* stockage plein ou indisponible */ }
}

export function effacerBrouillon(cle: string | null) {
  if (!cle) return;
  try { localStorage.removeItem(cle); } catch { /* stockage indisponible */ }
}

/**
 * Brouillon d'un éditeur :
 * - `existant` : brouillon trouvé à l'ouverture (avant toute saisie), à proposer de reprendre ;
 * - la saisie `donnees` est enregistrée (avec un court délai) tant que `actif` est vrai ;
 * - `effacer()` supprime le brouillon et masque la proposition.
 */
export function useBrouillon<T>(cle: string | null, donnees: T, actif: boolean) {
  const [existant, setExistant] = useState<Brouillon<T> | null>(() => lireBrouillon<T>(cle));
  const json = JSON.stringify(donnees);
  const cleRef = useRef(cle);
  cleRef.current = cle;

  // Écrit pendant cette ouverture de l'éditeur : si la saisie revient à son état de départ, on l'efface
  const aEcrit = useRef(false);
  useEffect(() => {
    if (!cle) return;
    if (!actif) {
      if (aEcrit.current) { effacerBrouillon(cle); aEcrit.current = false; }
      return;
    }
    const t = setTimeout(() => { ecrireBrouillon(cle, JSON.parse(json) as T); aEcrit.current = true; }, DELAI_ENREGISTREMENT_MS);
    return () => clearTimeout(t);
  }, [cle, json, actif]);

  return {
    existant,
    /** Le brouillon a été repris : masque la proposition ; il appartient désormais à cette saisie. */
    oublierProposition: () => { aEcrit.current = true; setExistant(null); },
    effacer: () => { effacerBrouillon(cleRef.current); setExistant(null); },
  };
}
