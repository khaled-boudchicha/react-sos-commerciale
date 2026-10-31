import { describe, expect, it } from 'vitest';
import { resoudreSaisie } from '../components/ui/NumberEdit';
import { pctDepuisMontant } from '../screens/comptoir/RemiseDialog';
import { resultatPaiement } from '../screens/comptoir/PaiementDialog';

describe('NumberEdit — valeur validée (transmise à onEnter)', () => {
  it('parse la saisie fr (virgule, espaces des milliers)', () => {
    expect(resoudreSaisie('5', 0)).toBe(5);
    expect(resoudreSaisie('3 000', 2500)).toBe(3000);
    expect(resoudreSaisie('12,5', 0)).toBe(12.5);
  });

  it('borne et arrondit selon min / max / decimals', () => {
    expect(resoudreSaisie('150', 0, { min: 0, max: 100 })).toBe(100);
    expect(resoudreSaisie('-3', 10, { min: 0 })).toBe(0);
    expect(resoudreSaisie('1,23456', 0, { decimals: 3 })).toBe(1.235);
  });

  it('saisie vide ou invalide → valeur courante', () => {
    expect(resoudreSaisie('', 42)).toBe(42);
    expect(resoudreSaisie('abc', 42)).toBe(42);
  });
});

describe('RemiseDialog — montant → pourcentage', () => {
  it('convertit le montant saisi en pourcentage de la base TTC', () => {
    expect(pctDepuisMontant(50, 1000)).toBe(5);
    expect(pctDepuisMontant(2000, 1000)).toBe(100);
    expect(pctDepuisMontant(10, 0)).toBe(0);
  });
});

describe('PaiementDialog — résultat pour le montant saisi', () => {
  it('rend la monnaie sur le montant remis (et non le net pré-rempli)', () => {
    expect(resultatPaiement(2500, 3000, false, false, true)).toEqual({ recu: 3000, regle: 2500, rendu: 500, credit: false, imprimer: true });
  });

  it('refuse un montant insuffisant pour un client de passage', () => {
    expect(resultatPaiement(2500, 2000, false, false, false)).toBeNull();
  });

  it('accepte un paiement partiel / crédit pour un client identifié', () => {
    expect(resultatPaiement(2500, 2000, false, true, false)).toEqual({ recu: 2000, regle: 2000, rendu: 0, credit: false, imprimer: false });
    expect(resultatPaiement(2500, 3000, true, true, false)).toEqual({ recu: 0, regle: 0, rendu: 0, credit: true, imprimer: false });
  });
});
