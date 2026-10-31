import { create } from 'zustand';
import { ACCES_RAPIDE_DEFAUT } from './commandes';

/**
 * Préférences d'affichage de la navigation, propres au poste : disposition (barre latérale ou ruban façon
 * Office), ruban réduit et barre d'accès rapide. Persistées dans electron-store (application) ou localStorage
 * (navigateur). Les préférences enregistrées avant l'ajout d'un champ restent lisibles (valeur par défaut).
 */

export type Disposition = 'lateral' | 'ruban';

type Valeurs = {
  disposition: Disposition;
  rubanReduit: boolean;
  /** Identifiants des commandes de la barre d'accès rapide (ordre d'affichage). */
  accesRapide: string[];
};

type Etat = Valeurs & {
  charge: boolean;
  definirDisposition: (d: Disposition) => void;
  definirRubanReduit: (r: boolean) => void;
  definirAccesRapide: (ids: string[]) => void;
  /** Ajoute la commande à la barre d'accès rapide, ou l'en retire si elle y est déjà. */
  basculerAccesRapide: (id: string) => void;
  retablirAccesRapide: () => void;
  charger: () => Promise<void>;
};

const CLE = 'navigation';

/** Lecture tolérante d'une liste d'identifiants enregistrée (valeur absente ou invalide → défaut). */
export function normaliserAccesRapide(v: unknown): string[] {
  if (!Array.isArray(v)) return [...ACCES_RAPIDE_DEFAUT];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))];
}

async function lire(): Promise<Partial<Valeurs>> {
  try {
    const v = await window.gc?.store.get(CLE);
    if (v && typeof v === 'object') return v as Partial<Valeurs>;
  } catch { /* stockage Electron indisponible */ }
  try { return JSON.parse(localStorage.getItem(`gc.${CLE}`) || '{}'); } catch { return {}; }
}

function ecrire(e: Valeurs) {
  const v: Valeurs = { disposition: e.disposition, rubanReduit: e.rubanReduit, accesRapide: e.accesRapide };
  try { void window.gc?.store.set(CLE, v); } catch { /* ignoré */ }
  try { localStorage.setItem(`gc.${CLE}`, JSON.stringify(v)); } catch { /* ignoré */ }
}

export const usePreferencesNavigation = create<Etat>((set, get) => ({
  disposition: 'lateral',
  rubanReduit: false,
  accesRapide: [...ACCES_RAPIDE_DEFAUT],
  charge: false,
  definirDisposition: (disposition) => { set({ disposition }); ecrire(get()); },
  definirRubanReduit: (rubanReduit) => { set({ rubanReduit }); ecrire(get()); },
  definirAccesRapide: (ids) => { set({ accesRapide: normaliserAccesRapide(ids) }); ecrire(get()); },
  basculerAccesRapide: (id) => {
    const ids = get().accesRapide;
    get().definirAccesRapide(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  },
  retablirAccesRapide: () => get().definirAccesRapide([...ACCES_RAPIDE_DEFAUT]),
  charger: async () => {
    const v = await lire();
    set({
      disposition: v.disposition === 'ruban' ? 'ruban' : 'lateral',
      rubanReduit: !!v.rubanReduit,
      accesRapide: normaliserAccesRapide(v.accesRapide),
      charge: true,
    });
  },
}));
