import { describe, expect, it } from 'vitest';
import { calculerTimbre, estEspeces } from '../lib/timbre';

describe('droit de timbre (LF 2025)', () => {
  it('exonéré jusqu’à 300 DA, minimum 5 DA au-delà', () => {
    expect(calculerTimbre(300)).toBe(0);
    expect(calculerTimbre(301)).toBe(5);
    expect(calculerTimbre(595)).toBe(6);
  });
  it('1 DA par tranche de 100 DA ou fraction jusqu’à 30 000 DA', () => {
    expect(calculerTimbre(1000)).toBe(10);
    expect(calculerTimbre(1001)).toBe(11);
    expect(calculerTimbre(30000)).toBe(300);
  });
  it('1,5 DA puis 2 DA par tranche (taux non marginal)', () => {
    expect(calculerTimbre(30001)).toBe(451.5);
    expect(calculerTimbre(100000)).toBe(1500);
    expect(calculerTimbre(100001)).toBe(2002);
  });
  it('reconnaît les espèces quelle que soit l’écriture', () => {
    expect(estEspeces('Espece')).toBe(true);
    expect(estEspeces('Espèces')).toBe(true);
    expect(estEspeces('Cheque')).toBe(false);
  });
});
