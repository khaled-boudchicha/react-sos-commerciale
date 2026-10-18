import { describe, expect, it } from 'vitest';
import {
  FONCTIONS_DOC, categoriesFonctions, creerEtat, declarerModeleIntegre, declarerType, enregistrerFonction, evaluerExpression,
  installerExemples, kindDe, listerModelesIntegres, listerTypes, modeleIntegre, rendreEtat, resoudreTexte, Scope,
} from '../src/core';

const mesureur = { largeur: (t: string) => t.length * 5.5 };

describe('exemples livrés avec le paquet', () => {
  installerExemples();
  for (const m of listerModelesIntegres()) {
    it(`${m.id} : s'imprime avec le jeu d'exemple, sans avertissement`, () => {
      const e = m.build();
      const r = rendreEtat(e, kindDe(e.kind).sample, { mesureur });
      expect(r.warnings).toEqual([]);
      expect(r.pageCount).toBeGreaterThanOrEqual(1);
      expect(r.html).toContain('ACME');
    });
  }
  it('le ticket d’exemple suit la hauteur de son contenu', () => {
    const e = modeleIntegre('exemple-ticket-80')!;
    const court = rendreEtat(e, kindDe('facture').sample, { mesureur });
    const data = JSON.parse(JSON.stringify(kindDe('facture').sample));
    data.Lignes = Array.from({ length: 40 }, (_, i) => ({ ...data.Lignes[i % 3] }));
    const long = rendreEtat(e, data, { mesureur });
    expect(long.heightMm).toBeGreaterThan(court.heightMm + 150);
  });
});

describe('registres de l’hôte', () => {
  it('un type inconnu retombe sur le premier type déclaré, puis sur un type vide', () => {
    expect(kindDe('nimporte-quoi').id).toBe(listerTypes()[0].id);
  });
  it('déclarer un type ou un modèle livré le rend disponible (et remplace à l’identique)', () => {
    declarerType({ id: 'commande', label: 'Commande', datasets: [], sample: { X: { a: 1 } } });
    expect(listerTypes().some((k) => k.id === 'commande')).toBe(true);
    declarerModeleIntegre({ id: 'm-test', build: () => creerEtat('commande', 'Test') });
    const e = modeleIntegre('m-test')!;
    expect(e.id).toBe('m-test');
    expect(e.kind).toBe('commande');
    expect(modeleIntegre('absent')).toBeNull();
  });
});

describe('fonctions métier injectées', () => {
  it('enregistrerFonction ajoute une fonction utilisable dans les expressions et le catalogue du designer', () => {
    expect(evaluerExpression('ARRETE(5)', new Scope()).erreur).toBeTruthy();
    enregistrerFonction('arrete', (a) => `Arrêté : ${a[0]} euros`, { categorie: 'Métier', signature: 'ARRETE(Facture.total)', description: 'Phrase d’arrêté' });
    expect(evaluerExpression('ARRETE(5)', new Scope()).valeur).toBe('Arrêté : 5 euros');
    expect(resoudreTexte('[arrete(12)]', new Scope()).texte).toBe('Arrêté : 12 euros');
    expect(FONCTIONS_DOC.some((f) => f.nom === 'ARRETE')).toBe(true);
    expect(categoriesFonctions()).toContain('Métier');
  });
  it('ENLETTRES est fourni par le paquet', () => {
    expect(evaluerExpression('ENLETTRES(1250)', new Scope()).valeur).toBe('Mille Deux Cent Cinquante');
  });
});
