import { describe, expect, it } from 'vitest';
// @ts-expect-error — module ESM du script de contrôle (JavaScript, sans déclarations de types)
import { analyser } from '../../scripts/ui-lint.mjs';

/**
 * Garde-fou de la charte graphique v2 : aucun écart (couleur en dur, taille arbitraire, voile fait main,
 * glyphe-icône, aplat en texte) ne doit réapparaître dans l'application. Détail : `npm run lint:ui`.
 */
describe('charte graphique', () => {
  it('aucun écart à la charte dans app/src', () => {
    const ecarts = analyser() as { fichier: string; ligne: number; regle: string }[];
    expect(ecarts.map((e) => `${e.regle} src/${e.fichier}:${e.ligne}`)).toEqual([]);
  });
});
