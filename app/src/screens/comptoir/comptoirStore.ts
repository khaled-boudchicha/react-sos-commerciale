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
  charger: (dossier: string) => void;
  setActif: (i: number) => void;
  majTicket: (f: (t: TicketComptoir) => TicketComptoir) => void;
  /** Modifie un ticket désigné (réponse asynchrone arrivée après un changement d'onglet). */
  majTicketA: (index: number, f: (t: TicketComptoir) => TicketComptoir) => void;
  viderTicket: () => void;
  /** Modifie une ligne où qu'elle soit (réponse asynchrone, ex. lot, arrivée après un changement d'onglet). */
  patchLigne: (key: number, p: Partial<LigneDoc>) => void;
  setOptions: (o: Partial<OptionsComptoir>) => void;
};

const cleTickets = (dossier: string) => `gc.comptoir.tickets.${dossier}`;
const CLE_OPTIONS = 'gc.comptoir.options';

function lire<T>(cle: string): T | null {
  try { const s = localStorage.getItem(cle); return s ? JSON.parse(s) as T : null; } catch { return null; }
}
function ecrire(cle: string, v: unknown) {
  try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

function ticketsInitiaux(dossier: string): TicketComptoir[] {
  const lus = lire<TicketComptoir[]>(cleTickets(dossier));
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

  charger: (dossier) => {
    if (get().dossier === dossier) return;
    set({ dossier, tickets: ticketsInitiaux(dossier), actif: 0 });
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
