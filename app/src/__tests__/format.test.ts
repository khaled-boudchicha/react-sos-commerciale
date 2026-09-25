import { describe, expect, it } from 'vitest';
import { isoDate } from '../lib/format';

describe('isoDate', () => {
  it('garde une date simple telle quelle', () => {
    expect(isoDate('2026-09-25')).toBe('2026-09-25');
  });
  it('convertit un DATETIME sérialisé en UTC vers la date locale', () => {
    // Minuit local sérialisé en UTC : couper la chaîne donnerait la veille
    const minuitLocal = new Date(2026, 8, 25, 0, 0, 0);
    expect(isoDate(minuitLocal.toISOString())).toBe('2026-09-25');
  });
  it('valeurs vides', () => {
    expect(isoDate(null)).toBe('');
    expect(isoDate('')).toBe('');
  });
});
