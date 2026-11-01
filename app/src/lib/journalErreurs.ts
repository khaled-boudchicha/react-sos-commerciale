import { create } from 'zustand';

/**
 * Journal local des erreurs de l'application (rendu d'écran, scripts, promesses non gérées), conservé sur
 * le poste — rien n'est envoyé à un serveur. Consultable dans /diagnostic et repris dans le rapport à
 * transmettre au support. Les répétitions rapprochées d'une même erreur sont regroupées.
 */

export type OrigineErreur = 'ecran' | 'script' | 'promesse';
export type ErreurApp = {
  debut: number; fin: number; n: number;
  origine: OrigineErreur;
  message: string;
  /** Écran (route) au moment de l'erreur. */
  ecran: string;
  /** Début de pile (5 lignes) pour le support. */
  pile?: string;
};

const CLE = 'gc.journalErreurs';
const MAX = 30;
const FENETRE = 60_000;

function lire(): ErreurApp[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.message === 'string').slice(0, MAX) : [];
  } catch { return []; }
}
function ecrire(j: ErreurApp[]) {
  try { localStorage.setItem(CLE, JSON.stringify(j)); } catch { /* stockage indisponible */ }
}

/** Ajoute une erreur (la plus récente en tête), en regroupant les répétitions. Fonction pure. */
export function ajouterErreur(journal: ErreurApp[], e: Omit<ErreurApp, 'debut' | 'fin' | 'n'>, maintenant: number): ErreurApp[] {
  const [dernier, ...reste] = journal;
  if (dernier && dernier.message === e.message && dernier.origine === e.origine && maintenant - dernier.fin < FENETRE) {
    return [{ ...dernier, fin: maintenant, n: dernier.n + 1 }, ...reste];
  }
  return [{ ...e, debut: maintenant, fin: maintenant, n: 1 }, ...journal].slice(0, MAX);
}

type Etat = {
  erreurs: ErreurApp[];
  journaliser: (origine: OrigineErreur, erreur: unknown) => void;
  vider: () => void;
};

const ecranCourant = () => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '') || '/');
const pileDe = (e: unknown) => (e instanceof Error && e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : undefined);
const messageDe = (e: unknown) => {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
};

export const useJournalErreurs = create<Etat>((set, get) => ({
  erreurs: lire(),
  journaliser: (origine, erreur) => {
    const erreurs = ajouterErreur(get().erreurs, { origine, message: messageDe(erreur).slice(0, 500), ecran: ecranCourant(), pile: pileDe(erreur) }, Date.now());
    ecrire(erreurs);
    set({ erreurs });
  },
  vider: () => { ecrire([]); set({ erreurs: [] }); },
}));

/** Capte les erreurs de script et les promesses non gérées (appelé une fois au démarrage). */
export function surveillerErreursGlobales() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    // Erreurs de chargement de ressource (image, police) : pas des erreurs de l'application
    if (!(ev.error instanceof Error) && !ev.message) return;
    useJournalErreurs.getState().journaliser('script', ev.error ?? ev.message);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    // Pannes réseau : déjà dans le journal des incidents réseau (store/reseau.ts)
    const r = ev.reason as { networkError?: unknown; name?: string } | null;
    if (r?.networkError || r?.name === 'DelaiDepasseError') return;
    useJournalErreurs.getState().journaliser('promesse', ev.reason);
  });
}
