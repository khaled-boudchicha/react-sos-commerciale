import { describe, expect, it } from 'vitest';
import { arreteLaSomme, enLettres } from '../lib/enLettres';

// Sorties de référence : simulation fidèle de Tdata.EnLettres / ArreteLaSomme (DataModule.pas)
describe('montant en lettres — parité desktop', () => {
  it.each([
    [0, 'zéro'],
    [1, 'Un'],
    [17, 'Dix Sept'],
    [21, 'Vingt et Un'],
    [71, 'Soixante et Onze'],
    [80, 'Quatre-Vingts'],
    [81, 'Quatre-Vingt Un'],
    [99, 'Quatre-Vingt Dix Neuf'],
    [100, 'Cent'],
    [200, 'Deux Cents'],
    [1000, 'Mille'],
    [1234, 'Mille Deux Cent Trente Quatre'],
    [200000, 'Deux Cent Mille'],
    [1000000, 'Un Million'],
    [2000000, 'Deux Millions'],
    [-5, 'Moins Cinq'],
  ])('%i → %s', (n, attendu) => {
    expect(enLettres(n)).toBe(attendu);
  });

  it('arrêté avec centimes', () => {
    expect(arreteLaSomme(1234.5)).toBe('Mille Deux Cent Trente Quatre Dinars Algerien et Cinquante Centimes');
    expect(arreteLaSomme(15750.25)).toBe('Quinze Mille Sept Cent Cinquante Dinars Algerien et Vingt Cinq Centimes');
  });

  it('arrêté sans centimes', () => {
    expect(arreteLaSomme(3272)).toBe('Trois Mille Deux Cent Soixante Douze Dinars Algerien et zéro Centimes');
  });
});
