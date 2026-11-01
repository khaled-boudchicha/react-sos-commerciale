import { create } from 'zustand';
import { LigneDoc, nouvelleCle } from '../../components/document/lignesDocument';
import { NB_TICKETS, NiveauPrix, TicketComptoir, ticketVide } from './comptoirCalc';

/**
 * État du comptoir : 5 tickets en attente (Ctrl+1…5 ; Alt+F1…F5 au Delphi) + options du poste.
 *
 * Les tickets sont sauvegardés localement par dossier (localStorage) pour survivre
 * à un redémarrage — amélioration du Delphi qui les perdait à la fermeture.
 * Tout accès au stockage est protégé : en cas d'échec le comptoir fonctionne en mémoire.
 */
export type OptionsComptoir = {
  /** Impression automatique du ticket après validation (Delphi « Ticket Automatique »). */
  ticketAuto: boolean;
  /** Niveau de prix appliqué (Delphi DefaultComptoirPrice). */
  niveauPrix: NiveauPrix;
  /** Panneau familles / articles tactile (Delphi AfficherTileArticle). */
  tuiles: boolean;
};

const OPTIONS_DEFAUT: OptionsComptoir = { ticketAuto: true, niveauPrix: 1, tuiles: true };

type EtatComptoir = {
  dossier: string | null;
  tickets: TicketComptoir[];
  actif: number;
  options: OptionsComptoir;
  /** Charge les tickets en attente du caissier `utilisateur` dans `dossier`. */
  charger: (dossier: string, utilisateur?: string | number | null) => void;
  setActif: (i: number) => void;
  majTicket: (f: (t: TicketComptoir) => TicketComptoir) => void;
  /** Modifie un ticket désigné (réponse asynchrone arrivée après un changement d'onglet). */
  majTicketA: (index: number, f: (t: TicketComptoir) => TicketComptoir) => void;
  viderTicket: () => void;
  /** Modifie une ligne où qu'elle soit (réponse asynchrone, ex. lot, arrivée après un changement d'onglet). */
  patchLigne: (key: number, p: Partial<LigneDoc>) => void;
  setOptions: (o: Partial<OptionsComptoir>) => void;
};

/** Clé de stockage : tickets propres au dossier ET au caissier (un caissier ne reprend pas ceux d'un autre). */
const cleTickets = (portee: string) => `gc.comptoir.tickets.${portee}`;
const portee = (dossier: string, utilisateur?: string | number | null) =>
  utilisateur != null && String(utilisateur) !== '' ? `${dossier}.u${utilisateur}` : dossier;
const CLE_OPTIONS = 'gc.comptoir.options';

function lire<T>(cle: string): T | null {
  try { const s = localStorage.getItem(cle); return s ? JSON.parse(s) as T : null; } catch { return null; }
}
function ecrire(cle: string, v: unknown) {
  try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

function ticketsInitiaux(dossier: string, utilisateur?: string | number | null): TicketComptoir[] {
  const cle = cleTickets(portee(dossier, utilisateur));
  let lus = lire<TicketComptoir[]>(cle);
  // Migration : tickets enregistrés avant le rangement par caissier (clé du seul dossier) → au premier
  // caissier qui ouvre la caisse, puis l'ancienne clé est supprimée.
  if (!Array.isArray(lus) && cle !== cleTickets(dossier)) {
    const anciens = lire<TicketComptoir[]>(cleTickets(dossier));
    if (Array.isArray(anciens)) {
      lus = anciens;
      ecrire(cle, anciens);
      try { localStorage.removeItem(cleTickets(dossier)); } catch { /* stockage indisponible */ }
    }
  }
  const base = Array.from({ length: NB_TICKETS }, ticketVide);
  if (!Array.isArray(lus)) return base;
  // Les clés de ligne sont réattribuées : le compteur en mémoire repart de 1 à chaque lancement
  return base.map((t, i) => (lus[i] && Array.isArray(lus[i].lignes)
    ? { ...t, ...lus[i], lignes: lus[i].lignes.map((l) => ({ ...l, key: nouvelleCle() })) }
    : t));
}

export const useComptoir = create<EtatComptoir>((set, get) => ({
  dossier: null,
  tickets: Array.from({ length: NB_TICKETS }, ticketVide),
  actif: 0,
  options: { ...OPTIONS_DEFAUT, ...(lire<Partial<OptionsComptoir>>(CLE_OPTIONS) ?? {}) },

  // `dossier` (état) = portée de stockage : dossier + caissier
  charger: (dossier, utilisateur) => {
    const p = portee(dossier, utilisateur);
    if (get().dossier === p) return;
    set({ dossier: p, tickets: ticketsInitiaux(dossier, utilisateur), actif: 0 });
  },
  setActif: (i) => set({ actif: Math.max(0, Math.min(NB_TICKETS - 1, i)) }),
  majTicket: (f) => get().majTicketA(get().actif, f),
  majTicketA: (index, f) => {
    const { tickets, dossier } = get();
    const next = tickets.map((t, i) => (i === index ? f(t) : t));
    set({ tickets: next });
    if (dossier) ecrire(cleTickets(dossier), next);
  },
  viderTicket: () => get().majTicket(() => ticketVide()),
  patchLigne: (key, p) => {
    const { tickets, dossier } = get();
    const next = tickets.map((t) => (t.lignes.some((l) => l.key === key)
      ? { ...t, lignes: t.lignes.map((l) => (l.key === key ? { ...l, ...p } : l)) }
      : t));
    set({ tickets: next });
    if (dossier) ecrire(cleTickets(dossier), next);
  },
  setOptions: (o) => {
    const options = { ...get().options, ...o };
    set({ options });
    ecrire(CLE_OPTIONS, options);
  },
}));
