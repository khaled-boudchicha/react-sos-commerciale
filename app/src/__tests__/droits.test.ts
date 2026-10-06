import { describe, expect, it } from 'vitest';
import { aDroit, aModule, comptesAutorises, Droits, restreintAuxSiennes, TOUS_DROITS, DROITS_DOC_VENTE } from '../lib/droits';

const vide: Droits = { admin: false, vente: [], achat: [], stock: [], tiers: [], bank: [], autre: [], dossier: [] };
// Profil réel (utilisateur YAHIA de la base de référence, extrait)
const yahia: Droits = {
  ...vide,
  vente: ['Bon de Livraison', 'Nouveau Bon de Livraison', 'Bon de Livraison par utilisateur'],
  tiers: ['Clients'],
  bank: ['Caisse Magasin'],
};

describe('aDroit', () => {
  it('admin et module « * » ont tout', () => {
    expect(aDroit(TOUS_DROITS, 'autre', 'Trésorie')).toBe(true);
    expect(aDroit({ ...vide, stock: '*' }, 'stock', 'Accés Article')).toBe(true);
  });
  it('liste : libellé exact requis (fautes Delphi comprises)', () => {
    expect(aDroit(yahia, 'vente', 'Nouveau Bon de Livraison')).toBe(true);
    expect(aDroit(yahia, 'vente', 'Nouvelle Facture de Vente')).toBe(false);
    expect(aDroit(yahia, 'vente', 'nouveau bon de livraison')).toBe(false);
  });
  it('droits absents (agent ancien) → pas de blocage', () => {
    expect(aDroit(undefined, 'autre', 'Paramètres')).toBe(true);
  });
  it('aModule : visible si au moins un droit', () => {
    expect(aModule(yahia, 'vente')).toBe(true);
    expect(aModule(yahia, 'achat')).toBe(false);
  });
});

describe('libellés des documents', () => {
  it('suivent le format du desktop', () => {
    expect(DROITS_DOC_VENTE.FA.creer).toBe('Nouvelle Facture de Vente');
    expect(DROITS_DOC_VENTE.BL.modifier).toBe('Modification Bon de Livraison');
    expect(DROITS_DOC_VENTE.FAV.creer).toBe('Nouvel avoir client');
  });
});

describe('restreintAuxSiennes (« … par utilisateur »)', () => {
  it('ne s’applique que si coché explicitement', () => {
    expect(restreintAuxSiennes(yahia, 'vente', 'BL')).toBe(true);
    expect(restreintAuxSiennes(yahia, 'vente', 'FA')).toBe(false);
    expect(restreintAuxSiennes(TOUS_DROITS, 'vente', 'BL')).toBe(false);
    expect(restreintAuxSiennes({ ...yahia, vente: '*' }, 'vente', 'BL')).toBe(false);
  });
});

describe('comptesAutorises (PrevilegeBank)', () => {
  const comptes = [{ compte: 'Caisse Magasin' }, { compte: 'CPA' }];
  it('filtre par nom (casse et espaces ignorés)', () => {
    expect(comptesAutorises({ ...yahia, bank: [' caisse magasin '] }, comptes, (c) => c.compte)).toEqual([{ compte: 'Caisse Magasin' }]);
  });
  it('liste vide → aucun compte (comme Main.pas)', () => {
    expect(comptesAutorises(vide, comptes, (c) => c.compte)).toHaveLength(0);
  });
  it('« * » (seul ou dans la liste) ou admin → pas de filtre', () => {
    expect(comptesAutorises({ ...vide, bank: '*' }, comptes, (c) => c.compte)).toHaveLength(2);
    expect(comptesAutorises({ ...vide, bank: ['CPA', '*'] }, comptes, (c) => c.compte)).toHaveLength(2);
    expect(comptesAutorises(TOUS_DROITS, comptes, (c) => c.compte)).toHaveLength(2);
  });
});
