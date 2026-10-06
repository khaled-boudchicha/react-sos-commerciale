import { describe, expect, it } from 'vitest';
import { Article } from '../api/types';
import {
  ajouterArticle, ajusterQte, calculerEncaissement, montantsRapides, qteDepuisMontant, ticketVide, totauxTicket,
} from '../screens/comptoir/comptoirCalc';

const art = (p: Partial<Article> = {}): Article => ({
  id: 1, code: 'A1', designation: 'Doliprane 1g', tva: 19,
  prix_vente_ht: 100, prix_vente_ht1: 90, prix_vente_ht2: 0, prix_vente_ht3: 0, qte_reale: 5, ...p,
});

describe('comptoir — ajout d’article', () => {
  it('crée une ligne au tarif demandé', () => {
    const r = ajouterArticle([], art(), 2);
    expect(r.nouvelle).toBe(true);
    expect(r.lignes[0].prix_ht).toBe(90);
    expect(r.lignes[0].tarif).toBe(2);
    expect(r.lignes[0].stock).toBe(5);
  });

  it('retombe sur le tarif 1 si le niveau demandé est vide', () => {
    const r = ajouterArticle([], art(), 3);
    expect(r.lignes[0].prix_ht).toBe(100);
  });

  it('incrémente la quantité si l’article est déjà sur le ticket (scan répété)', () => {
    const a = ajouterArticle([], art(), 1);
    const b = ajouterArticle(a.lignes, art(), 1);
    expect(b.nouvelle).toBe(false);
    expect(b.lignes).toHaveLength(1);
    expect(b.lignes[0].qte).toBe(2);
    expect(b.key).toBe(a.key);
  });
});

describe('comptoir — quantités', () => {
  it('+/- du pavé numérique : ne descend pas sous 1', () => {
    expect(ajusterQte(1, 1)).toBe(2);
    expect(ajusterQte(3, -1)).toBe(2);
    expect(ajusterQte(1, -1)).toBe(1);
  });

  it('montant voulu → quantité au prix TTC net', () => {
    const l = ajouterArticle([], art(), 1).lignes[0]; // 100 HT, TVA 19 % → 119 TTC
    expect(qteDepuisMontant(l, 238)).toBe(2);
  });
});

describe('comptoir — totaux et encaissement', () => {
  it('totaux TTC avec remise globale, arrondis au centime', () => {
    const t = { ...ticketVide(), lignes: ajouterArticle([], art(), 1).lignes, remisePct: 10 };
    const tot = totauxTicket(t);
    expect(tot.net).toBe(107.1); // 119 − 10 %
    expect(tot.articles).toBe(1);
  });

  it('monnaie à rendre et reste dû', () => {
    expect(calculerEncaissement(750, 1000, false)).toEqual({ regle: 750, rendu: 250, reste: 0 });
    expect(calculerEncaissement(750, 500, false)).toEqual({ regle: 500, rendu: 0, reste: 250 });
    expect(calculerEncaissement(750, 1000, true)).toEqual({ regle: 0, rendu: 0, reste: 750 });
  });

  it('montants rapides : net exact puis montants ronds supérieurs', () => {
    expect(montantsRapides(3272)).toEqual([3272, 3500, 4000, 5000]);
    expect(montantsRapides(750)).toEqual([750, 1000, 2000, 5000]);
    expect(montantsRapides(1000)).toEqual([1000, 2000, 5000]);
  });
});
