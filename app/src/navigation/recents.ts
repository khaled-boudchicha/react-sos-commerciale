import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { commandeDeChemin } from './commandes';

/**
 * Écrans récemment ouverts (comme la liste « Récents » d'Office) : les 10 derniers écrans visités sur ce poste,
 * affichés dans le menu Fichier. Persistés dans localStorage (`gc.recents`) ; un stockage indisponible
 * (mode privé, quota) ne bloque jamais la navigation.
 */

export type Recent = {
  /** Chemin + paramètres de requête (`/ventes?type=FA`). */
  chemin: string;
  titre: string;
  /** Horodatage (ms). */
  date: number;
};

export const MAX_RECENTS = 10;
const CLE = 'gc.recents';
const SUFFIXE_TITRE = /\s+[—–-]\s+Gestion Commerciale\s*$/;
/** Écrans jamais mémorisés : la caisse plein écran. */
const EXCLUS = /^\/comptoir(\/|$)/;

/** Titre lisible d'un écran : titre de la fenêtre sans le nom de l'application. */
export function titreDePage(titreDocument: string): string {
  const t = titreDocument.replace(SUFFIXE_TITRE, '').trim();
  return t === 'Gestion Commerciale' ? '' : t;
}

/**
 * Ajoute un écran en tête de liste. Écran déjà présent : remonté (pas de doublon) ; même écran que le dernier :
 * seul son titre est rafraîchi. Écrans exclus ignorés.
 */
export function ajouterRecent(liste: readonly Recent[], r: Recent, max = MAX_RECENTS): Recent[] {
  const chemin = r.chemin.split('?')[0];
  if (!r.chemin || EXCLUS.test(chemin)) return [...liste];
  return [r, ...liste.filter((x) => x.chemin !== r.chemin)].slice(0, max);
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », « hier », « il y a 3 j », puis la date. */
export function ilYA(date: number, maintenant = Date.now()): string {
  const s = Math.max(0, Math.round((maintenant - date) / 1000));
  if (s < 60) return 'à l’instant';
  const min = Math.floor(s / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j === 1) return 'hier';
  if (j < 7) return `il y a ${j} j`;
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function lire(): Recent[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLE) || '[]');
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is Recent => !!x && typeof x.chemin === 'string' && typeof x.titre === 'string' && typeof x.date === 'number')
      .slice(0, MAX_RECENTS);
  } catch { return []; }
}

function ecrire(liste: Recent[]) {
  try { localStorage.setItem(CLE, JSON.stringify(liste)); } catch { /* stockage indisponible */ }
}

type Etat = {
  recents: Recent[];
  ajouter: (r: Recent) => void;
  vider: () => void;
};

export const useRecents = create<Etat>((set, get) => ({
  recents: lire(),
  ajouter: (r) => { const recents = ajouterRecent(get().recents, r); set({ recents }); ecrire(recents); },
  vider: () => { set({ recents: [] }); ecrire([]); },
}));

/**
 * Mémorise l'écran affiché à chaque changement de route (appelé une fois dans la coquille).
 * Le titre est lu après le rendu de l'écran (`usePageTitle`) ; à défaut, le libellé de la commande correspondante.
 */
export function useEnregistrerRecents() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (EXCLUS.test(pathname)) return;
    const chemin = pathname + search;
    const lireTitre = () => titreDePage(document.title) || commandeDeChemin(pathname, search)?.libelle || pathname;
    const minuterie = window.setTimeout(() => {
      useRecents.getState().ajouter({ chemin, titre: lireTitre(), date: Date.now() });
    }, 150);
    // Titre définitif d'une fiche chargée après coup (« Facture FA-0042 ») : rafraîchi une fois, s'il a changé
    const relecture = window.setTimeout(() => {
      const [dernier] = useRecents.getState().recents;
      const titre = lireTitre();
      if (dernier?.chemin === chemin && dernier.titre !== titre) useRecents.getState().ajouter({ ...dernier, titre });
    }, 1500);
    return () => { window.clearTimeout(minuterie); window.clearTimeout(relecture); };
  }, [pathname, search]);
}
