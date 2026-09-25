import { describe, expect, it } from 'vitest';
import {
  LigneDoc, depuisPrixTtc, depuisRemiseMontant, netHtLigne, totalTtcLigne, totauxDocument,
} from '../components/document/lignesDocument';

// Mêmes formules que l'agent (ventes/achats.service.ts) : toute divergence
// afficherait un net différent de celui enregistré.
const ligne = (p: Partial<LigneDoc>): LigneDoc =>
  ({ key: 1, code_article: 'A', designation: 'A', qte: 1, prix_ht: 100, tva: 19, remise: 0, ...p }) as LigneDoc;

describe('calculs de ligne', () => {
  it('net HT = qté × prix × (1 − remise %)', () => {
    expect(netHtLigne(ligne({ qte: 3, prix_ht: 100, remise: 10 }))).toBeCloseTo(270);
  });
  it('total TTC applique la TVA sur le net', () => {
    expect(totalTtcLigne(ligne({ qte: 2, prix_ht: 50, tva: 19 }))).toBeCloseTo(119);
  });
  it('saisie d’un P.U. TTC → P.U. HT cohérent', () => {
    const p = depuisPrixTtc(ligne({ tva: 19 }), 119);
    expect(Number(p.prix_ht)).toBeCloseTo(100);
  });
  it('saisie d’une remise en montant → remise % cohérente', () => {
    const p = depuisRemiseMontant(ligne({ qte: 2, prix_ht: 100 }), 50);
    expect(Number(p.remise)).toBeCloseTo(25);
  });
});

describe('totaux du document', () => {
  it('cas vérifié E2E : BL 3 × 100 + 1 × 50, TVA 19 %, remise globale 10 %', () => {
    const t = totauxDocument([ligne({ qte: 3, prix_ht: 100 }), ligne({ qte: 1, prix_ht: 50 })], 10);
    expect(t.ht).toBeCloseTo(350);
    expect(t.tva).toBeCloseTo(66.5);
    expect(t.net).toBeCloseTo(374.85); // = net renvoyé par updateVente (test d'intégration agent)
  });
  it('remises de ligne cumulées', () => {
    const t = totauxDocument([ligne({ qte: 2, prix_ht: 100, remise: 50 })], 0);
    expect(t.remLignes).toBeCloseTo(100);
    expect(t.net).toBeCloseTo(119);
  });
  it('document vide', () => {
    expect(totauxDocument([], 5)).toMatchObject({ ht: 0, tva: 0, net: 0 });
  });
});
