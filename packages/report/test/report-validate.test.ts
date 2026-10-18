import { describe, expect, it } from 'vitest';
import { creerBande, creerEtat, creerObjet, TextObj } from '../src/model';
import { verifierModele } from '../src/validate';
import { installerExemples } from '../src/exemples';
import { listerModelesIntegres } from '../src/registre';

const texte = (t: string, over: Partial<TextObj> = {}) => creerObjet('text', 0, 0, { w: 30, h: 5, text: t, ...over }) as TextObj;

describe('vérification de modèle', () => {
  it('les modèles d’exemple n’ont aucune erreur', () => {
    installerExemples();
    for (const m of listerModelesIntegres()) {
      const erreurs = verifierModele(m.build()).filter((x) => x.niveau === 'erreur');
      expect(erreurs, m.id).toEqual([]);
    }
  });

  it('détecte expression invalide, source absente, regroupement manquant, détail orphelin', () => {
    const e = creerEtat('vente', 'X');
    e.bands = [
      creerBande('reportTitle', { objects: [texte('a [1 +] b')] }),
      creerBande('data', {}),
      creerBande('groupHeader', { dataSource: 'Lignes' }),
      creerBande('data', { dataSource: 'Inconnu', objects: [texte('')] }),
      creerBande('data', { dataSource: 'Lignes.x', parent: 'nexistepas' }),
    ];
    const m = verifierModele(e).map((x) => x.message).join('\n');
    expect(m).toMatch(/incomplète/);
    expect(m).toMatch(/aucune source de données/);
    expect(m).toMatch(/regroupement manquante/);
    expect(m).toMatch(/« Inconnu » n’existe pas/);
    expect(m).toMatch(/introuvable/);
    expect(m).toMatch(/est vide/);
  });

  it('signale un objet qui dépasse la largeur de la page', () => {
    const e = creerEtat('vente', 'X');
    e.bands = [creerBande('reportTitle', { objects: [creerObjet('text', 180, 0, { w: 50, h: 5, text: 'x' })] })];
    expect(verifierModele(e).some((x) => /dépasse la largeur/.test(x.message))).toBe(true);
  });

  it('noms de paramètres dupliqués', () => {
    const e = creerEtat('vente', 'X');
    e.parameters = [{ name: 'A', type: 'text' }];
    e.variables = [{ name: 'a', expr: '1' }];
    expect(verifierModele(e).some((x) => /plusieurs fois/.test(x.message))).toBe(true);
  });
});
