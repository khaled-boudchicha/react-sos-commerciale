import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrilleProps } from '../grille/types';

/** Largeur du panneau d'aperçu (px) : défaut, bornes du redimensionnement. */
export const LARGEUR_APERCU = { defaut: 380, min: 320, max: 640 } as const;

/** Délai avant de charger la pièce quand on parcourt la liste au clavier (↑ / ↓ rapides). */
const DELAI_CLAVIER = 140;

const cle = (ecran: string) => `gc.apercu.${ecran}`;

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function ecrire(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* stockage indisponible : préférence non mémorisée */ }
}

export type Apercu<T> = {
  /** Panneau d'aperçu activé (préférence du poste, désactivé par défaut). */
  actif: boolean;
  basculer: (actif?: boolean) => void;
  /** Pièce affichée dans le panneau. */
  selection: T | null;
  deselectionner: () => void;
  largeur: number;
  changerLargeur: (px: number) => void;
  /**
   * Props à passer à `DataGrid` : sans aperçu, exactement le comportement d'origine
   * (clic = ouvrir) ; avec aperçu, clic / ↑ ↓ = afficher, double-clic / Entrée = ouvrir.
   */
  propsGrille: (grille?: Partial<GrilleProps<T>>) => { onRowClick: (ligne: T) => void; grille: Partial<GrilleProps<T>> };
};

/**
 * Aperçu rapide d'une liste (pièces, tiers, articles — FactBox Dynamics / volet Sage) : préférence mémorisée
 * par écran (`localStorage gc.apercu.<ecran>`), ligne sélectionnée, branchement sur la grille.
 * `cleListe` : quand elle change (onglet, période…), la sélection est vidée.
 */
export function useApercu<T>(ecran: string, ouvrir: (ligne: T) => void, cleListe?: string): Apercu<T> {
  const [actif, setActif] = useState(() => lire(cle(ecran)) === '1');
  const [largeur, setLargeur] = useState(() => {
    const n = Number(lire(`${cle(ecran)}.largeur`));
    return Number.isFinite(n) && n >= LARGEUR_APERCU.min && n <= LARGEUR_APERCU.max ? n : LARGEUR_APERCU.defaut;
  });
  const [selection, setSelection] = useState<T | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout>>();
  const annuler = () => { if (minuteur.current) clearTimeout(minuteur.current); minuteur.current = undefined; };
  useEffect(() => annuler, []);

  // Autre liste (type de pièce, période) : la pièce affichée n'en fait peut-être plus partie
  useEffect(() => { annuler(); setSelection(null); }, [cleListe]);

  const basculer = useCallback((v?: boolean) => {
    setActif((a) => {
      const n = v ?? !a;
      ecrire(cle(ecran), n ? '1' : '0');
      return n;
    });
    if (v === false) { annuler(); setSelection(null); }
  }, [ecran]);

  const deselectionner = useCallback(() => { annuler(); setSelection(null); }, []);

  const changerLargeur = useCallback((px: number) => {
    const n = Math.round(Math.min(LARGEUR_APERCU.max, Math.max(LARGEUR_APERCU.min, px)));
    setLargeur(n);
    ecrire(`${cle(ecran)}.largeur`, String(n));
  }, [ecran]);

  const ouvrirRef = useRef(ouvrir);
  ouvrirRef.current = ouvrir;

  const propsGrille = useMemo(() => (grille: Partial<GrilleProps<T>> = {}) => {
    if (!actif) return { onRowClick: (l: T) => ouvrirRef.current(l), grille };
    return {
      // Clic : affichage immédiat (annule le chargement différé déclenché par la ligne active)
      onRowClick: (l: T) => { annuler(); setSelection(l); },
      grille: {
        ...grille,
        // Ligne active (↑ / ↓, Début / Fin, PgPréc / PgSuiv) : affichage différé
        surLigneActive: (l: T | null) => {
          grille.surLigneActive?.(l);
          if (!l) return;
          annuler();
          minuteur.current = setTimeout(() => { minuteur.current = undefined; setSelection(l); }, DELAI_CLAVIER);
        },
        // Double-clic et Entrée (la grille appelle surDoubleClicLigne sur Entrée) : ouvrir la pièce
        surDoubleClicLigne: (l: T) => { annuler(); ouvrirRef.current(l); },
      },
    };
  }, [actif]);

  return { actif, basculer, selection, deselectionner, largeur, changerLargeur, propsGrille };
}
