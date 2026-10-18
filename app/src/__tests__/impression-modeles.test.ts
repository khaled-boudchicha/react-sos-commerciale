import { describe, expect, it } from 'vitest';
import {
  Scope, evaluerExpression, expressionsDuTexte, kindDe, listerModelesIntegres, listerTypes, normaliserEtat, rendreEtat, validerExpression, verifierModele,
} from '@softly/report/core';
import { initialiserImpression } from '../impression';
import { MODELES_INTEGRES } from '../impression/modelesIntegres';

initialiserImpression();

const mesureur = { largeur: (t: string) => t.length * 5.5 };

describe('branchement métier sur @softly/report', () => {
  it('déclare les 4 types de documents et les 5 modèles livrés', () => {
    expect(listerTypes().map((k) => k.id)).toEqual(['vente', 'achat', 'articles', 'etatClient']);
    expect(listerModelesIntegres().map((m) => m.id)).toEqual(MODELES_INTEGRES.map((m) => m.id));
  });
  it('la fonction métier ARRETE est disponible dans les expressions', () => {
    expect(evaluerExpression('ARRETE(1250)', new Scope()).valeur).toBe('Mille Deux Cent Cinquante Dinars Algerien et zéro Centimes');
  });
  it('les modèles livrés n’ont aucune erreur de vérification', () => {
    for (const m of MODELES_INTEGRES) expect(verifierModele(m.build()).filter((x) => x.niveau === 'erreur'), m.id).toEqual([]);
  });
});

describe('modèles intégrés', () => {
  for (const m of MODELES_INTEGRES) {
    it(`${m.id} : s'imprime avec son jeu d'exemple, sans avertissement`, () => {
      const e = m.build();
      const r = rendreEtat(e, kindDe(e.kind).sample, { mesureur });
      expect(r.warnings).toEqual([]);
      expect(r.pageCount).toBeGreaterThanOrEqual(1);
      expect(r.html.length).toBeGreaterThan(500);
    });
    it(`${m.id} : toutes les expressions sont valides et le fichier survit à un aller-retour`, () => {
      const e = m.build();
      for (const b of e.bands) {
        for (const x of [b.filter, b.visible, b.groupBy, ...(b.sort ?? []).map((s) => s.expr)]) if (x) expect(validerExpression(x)).toBeNull();
        for (const o of b.objects) {
          const textes = o.type === 'text' ? [o.text] : o.type === 'barcode' ? [o.value] : [];
          for (const t of textes) for (const ex of expressionsDuTexte(t)) expect(validerExpression(ex), `${o.name}: ${ex}`).toBeNull();
        }
      }
      expect(normaliserEtat(JSON.parse(JSON.stringify(e))).bands.length).toBe(e.bands.length);
    });
  }

  it('la facture d’exemple contient les totaux et le montant en lettres', () => {
    const e = MODELES_INTEGRES[0].build();
    const r = rendreEtat(e, kindDe('vente').sample, { mesureur });
    const t = r.html.replace(/<[^>]+>/g, ' ');
    expect(t).toContain('FACTURE N° 0012/2026');
    expect(t).toContain('NET À PAYER');
    expect(t.toLowerCase()).toContain('soixante');
  });

  it('étiquettes : 12 articles sur 3 colonnes = 4 lignes de bande', () => {
    const e = MODELES_INTEGRES.find((x) => x.id === 'integre-etiquettes-prix')!.build();
    const r = rendreEtat(e, kindDe('articles').sample, { mesureur });
    expect((r.html.match(/class="rpt-b"/g) ?? []).length).toBe(4);
    expect(r.html).toContain('<svg'); // codes-barres
  });
});
