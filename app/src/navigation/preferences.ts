import { create } from 'zustand';

/**
 * Préférences d'affichage de la navigation, propres au poste : disposition (barre latérale ou ruban façon
 * Office) et ruban réduit. Persistées dans electron-store (application) ou localStorage (navigateur).
 */

export type Disposition = 'lateral' | 'ruban';

type Etat = {
  disposition: Disposition;
  rubanReduit: boolean;
  charge: boolean;
  definirDisposition: (d: Disposition) => void;
  definirRubanReduit: (r: boolean) => void;
  charger: () => Promise<void>;
};

const CLE = 'navigation';

async function lire(): Promise<Partial<Pick<Etat, 'disposition' | 'rubanReduit'>>> {
  try {
    const v = await window.gc?.store.get(CLE);
    if (v && typeof v === 'object') return v as Partial<Etat>;
  } catch { /* stockage Electron indisponible */ }
  try { return JSON.parse(localStorage.getItem(`gc.${CLE}`) || '{}'); } catch { return {}; }
}

function ecrire(e: Pick<Etat, 'disposition' | 'rubanReduit'>) {
  const v = { disposition: e.disposition, rubanReduit: e.rubanReduit };
  try { void window.gc?.store.set(CLE, v); } catch { /* ignoré */ }
  try { localStorage.setItem(`gc.${CLE}`, JSON.stringify(v)); } catch { /* ignoré */ }
}

export const usePreferencesNavigation = create<Etat>((set, get) => ({
  disposition: 'lateral',
  rubanReduit: false,
  charge: false,
  definirDisposition: (disposition) => { set({ disposition }); ecrire(get()); },
  definirRubanReduit: (rubanReduit) => { set({ rubanReduit }); ecrire(get()); },
  charger: async () => {
    const v = await lire();
    set({
      disposition: v.disposition === 'ruban' ? 'ruban' : 'lateral',
      rubanReduit: !!v.rubanReduit,
      charge: true,
    });
  },
}));
