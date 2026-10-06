import { describe, expect, it } from 'vitest';
import { Vente } from '../api/types';
import { buildVenteModelePrint, MODELES_VENTE } from '../print/templates/venteModeles';

const vente = {
  id: 1, numero: '122/2026', type_doc: 'Bon de Livraison', type: 2, date: '2026-01-20',
  code_cli: '131', raison: 'UMC LAB', total_ht: 1227350.01, total_ttc: 1100687.49, net_a_payer: 1100687.49,
  regler: 0, reste_a_payer: 0, remise: 0, remise_p: 0, total_taxe: 0, mode_payement: 'Espèce',
  lignes: [{
    id: 1, code_article: 'AR16', designation: 'IFLASH TOXO IGM 2*50 TEST', qte: 2, prix_ht: 29649.996,
    prix_ttc: 26590.12, total_ht: 53180.23, total_ttc: 53180.23, tva: 0, remise: 10.32,
    n_lot: '20250401', date_peremption: '2026-11-20', prix_ht_net: 26590.12, remise_montant: 6119.76,
  }, {
    id: 2, code_article: 'AR11', designation: 'IFLASH FERRETINE', qte: 8, prix_ht: 19500, prix_ttc: 17487.6,
    total_ht: 139900.8, total_ttc: 139900.8, tva: 0, remise: 10.32, n_lot: '1', date_peremption: '1899-12-30',
  }],
} as unknown as Vente;
const societe = { raison_sociale: 'EURL BNK Technologie', civilite: 'EURL', wilaya: 'Constantine', rc: '10 B 0863772 00/25', capital: 100000 };

describe('modèles d’impression des ventes', () => {
  it.each(MODELES_VENTE.map((m) => m.id))('%s : rendu sans erreur, numéro et client présents', (id) => {
    const doc = buildVenteModelePrint(vente, societe, id);
    expect(doc.html).toContain('122/2026');
    expect(doc.html).toContain('UMC LAB');
    expect(doc.css).toContain('@page');
  });

  it('arrêté en lettres du net à payer (parité desktop)', () => {
    const doc = buildVenteModelePrint(vente, societe, 'bl-lot');
    expect(doc.html).toContain('Un Million Cent Mille Six Cent Quatre-Vingt Sept Dinars Algerien et Quarante Neuf Centimes');
  });

  it('date de péremption Delphi vide (1899) non imprimée, lot et DP au format mm/aaaa', () => {
    const html = buildVenteModelePrint(vente, societe, 'bl-lot').html;
    expect(html).not.toContain('1899');
    expect(html).toContain('11/2026');
  });

  it('forme juridique non doublée', () => {
    const html = buildVenteModelePrint(vente, societe, 'bct').html;
    expect(html).not.toContain('EURL EURL');
    expect(html).toContain('au Capital de');
  });

  it('BL sans prix : aucun montant ni arrêté', () => {
    const html = buildVenteModelePrint(vente, societe, 'bl-sans-prix').html;
    expect(html).not.toContain('Dinars Algerien');
    expect(html).not.toContain('53');
  });
});

describe('pied de page CSS', () => {
  it('neutralise guillemets, antislashs et accolades, conserve les sauts de ligne', async () => {
    const { echapperCss } = await import('../print/templates/venteModeles');
    expect(echapperCss('Ali "x"; } body{display:none} \\')).toBe('Ali x;  bodydisplay:none ');
    expect(echapperCss('Utilisateur :HALIMA\nDémarcheur : ')).toBe('Utilisateur :HALIMA\\A Démarcheur : ');
  });
});
