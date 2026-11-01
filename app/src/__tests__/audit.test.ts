import { describe, expect, it, beforeEach } from 'vitest';
import { D, TOUS_DROITS, statsRestreintesAuxSiennes, voitMarges, type Droits } from '../lib/droits';
import { prixAffiche } from '../screens/comptoir/ChampScan';
import { useComptoir } from '../screens/comptoir/comptoirStore';
import type { Article } from '../api/types';

const vide: Droits = { admin: false, vente: [], achat: [], stock: [], tiers: [], bank: [], autre: [], dossier: [] };

describe('droits de lecture', () => {
  it('coûts et marges : droit « bénéfice » des pièces ou des statistiques', () => {
    expect(voitMarges(TOUS_DROITS)).toBe(true);
    expect(voitMarges(null)).toBe(true); // droits non chargés : comportement historique
    expect(voitMarges(vide)).toBe(false);
    expect(voitMarges({ ...vide, vente: [D.vente.benefice] })).toBe(true);
    expect(voitMarges({ ...vide, autre: [D.autre.beneficeStat] })).toBe(true);
  });
  it('statistiques restreintes à ses propres chiffres', () => {
    expect(statsRestreintesAuxSiennes(TOUS_DROITS)).toBe(false);
    expect(statsRestreintesAuxSiennes(vide)).toBe(false);
    expect(statsRestreintesAuxSiennes({ ...vide, autre: ['Statistique par utilisateur'] })).toBe(true);
    expect(statsRestreintesAuxSiennes({ ...vide, vente: ['Facture de Vente', 'Facture de Vente par utilisateur'] })).toBe(true);
    expect(statsRestreintesAuxSiennes({ ...vide, vente: '*' })).toBe(false);
  });
});

describe('comptoir : prix affiché au tarif du ticket', () => {
  const a = { id: 1, code: 'X', designation: 'X', tva: 19, prix_vente_ht: 100, prix_vente_ttc: 119, prix_vente_ht1: 90, prix_vente_ht2: 0 } as Article;
  it('tarif 1 : prix TTC de la fiche ; autres : prix du tarif + TVA', () => {
    expect(prixAffiche(a, 1)).toBe(119);
    expect(prixAffiche(a, 2)).toBe(107.1);
  });
  it('tarif sans prix : repli sur le prix de base (comme la ligne ajoutée)', () => {
    expect(prixAffiche(a, 3)).toBe(119);
  });
});

describe('comptoir : tickets en attente par caissier', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    };
  });
  const ligne = { key: 1, code_article: 'X', designation: 'X', qte: 2, prix_ht: 10, tva: 0, remise: 0 };

  it('chaque caissier retrouve ses tickets, pas ceux des autres', () => {
    const c = useComptoir.getState();
    c.charger('D1', 7);
    useComptoir.getState().majTicketA(0, (t) => ({ ...t, lignes: [ligne as never] }));
    useComptoir.getState().charger('D1', 8);
    expect(useComptoir.getState().tickets[0].lignes).toHaveLength(0);
    useComptoir.getState().charger('D1', 7);
    expect(useComptoir.getState().tickets[0].lignes).toHaveLength(1);
  });
  it('anciens tickets (rangés par dossier seulement) repris par le premier caissier, puis effacés', () => {
    mem.set('gc.comptoir.tickets.D2', JSON.stringify([{ lignes: [ligne], client: null, remisePct: 0, retour: false }]));
    useComptoir.getState().charger('D2', 3);
    expect(useComptoir.getState().tickets[0].lignes).toHaveLength(1);
    expect(mem.has('gc.comptoir.tickets.D2')).toBe(false);
    expect(mem.has('gc.comptoir.tickets.D2.u3')).toBe(true);
  });
});
