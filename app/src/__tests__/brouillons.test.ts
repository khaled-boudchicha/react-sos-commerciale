import { beforeEach, describe, expect, it } from 'vitest';
import { DUREE_BROUILLON_MS, cleBrouillon, ecrireBrouillon, effacerBrouillon, lireBrouillon } from '../lib/brouillons';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };
});

describe('brouillons de pièces', () => {
  it('clé par sens, dossier et utilisateur ; aucune sans dossier', () => {
    expect(cleBrouillon('vente', 'GC_2026', 7)).toBe('gc.brouillon.vente.GC_2026.7');
    expect(cleBrouillon('achat', 'GC_2026', 7)).not.toBe(cleBrouillon('vente', 'GC_2026', 7));
    expect(cleBrouillon('vente', null, 7)).toBeNull();
  });
  it('écrit, relit, efface', () => {
    const cle = cleBrouillon('vente', 'D', 1);
    ecrireBrouillon(cle, { lignes: [1, 2] }, 1_000);
    expect(lireBrouillon<{ lignes: number[] }>(cle, 2_000)).toEqual({ date: 1_000, donnees: { lignes: [1, 2] } });
    effacerBrouillon(cle);
    expect(lireBrouillon(cle, 2_000)).toBeNull();
  });
  it('expire au bout de 7 jours', () => {
    const cle = cleBrouillon('achat', 'D', 1);
    ecrireBrouillon(cle, { x: 1 }, 0);
    expect(lireBrouillon(cle, DUREE_BROUILLON_MS - 1)).not.toBeNull();
    expect(lireBrouillon(cle, DUREE_BROUILLON_MS + 1)).toBeNull();
  });
  it('contenu illisible : ignoré', () => {
    mem.set('gc.brouillon.vente.D.1', '{pas du json');
    expect(lireBrouillon('gc.brouillon.vente.D.1')).toBeNull();
  });
});
