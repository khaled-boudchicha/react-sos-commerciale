import { describe, expect, it } from 'vitest';
import { creerEtatStandard } from '../src/standard';
import { TYPE_FACTURE } from '../src/exemples';
import { verifierModele } from '../src/validate';
import { rendreEtat } from '../src/engine/render';
import { familleCss } from '../src/engine/render';
import type { KindDef } from '../src/registre';

const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| | /g, ' ').replace(/\s+/g, ' ');

describe('modèle standard (point de départ d’un nouveau modèle)', () => {
  it('type avec liste : en-tête, tableau, total, pied de page — sans erreur et rendu avec les données d’exemple', () => {
    const def = creerEtatStandard(TYPE_FACTURE, 'Ma facture');
    expect(def.bands.map((b) => b.type)).toEqual(['reportTitle', 'dataHeader', 'data', 'dataFooter', 'pageFooter']);
    expect(verifierModele(def).filter((p) => p.niveau === 'erreur')).toEqual([]);
    const r = rendreEtat(def, TYPE_FACTURE.sample);
    const t = texte(r.pages.join(''));
    expect(t).toContain('MA FACTURE');
    expect(t).toContain('ACME SARL');                 // société (UPPER)
    expect(t).toContain('Prestation de conseil');     // une ligne
    expect(t).toContain('3 ligne(s)');
    expect(t).toMatch(/Total : 1 ?250,00/);           // somme de la dernière colonne numérique
    expect(t).toContain('Page 1 / 1');
  });

  it('les colonnes du tableau couvrent exactement la largeur utile', () => {
    const def = creerEtatStandard(TYPE_FACTURE);
    const data = def.bands.find((b) => b.type === 'data')!;
    const fin = Math.max(...data.objects.map((o) => o.x + o.w));
    expect(Math.abs(fin - 190)).toBeLessThan(0.11);
    expect(data.objects.find((o) => o.name === 'Prix unitaire')).toMatchObject({ align: 'right' });
    // la désignation prend la colonne large ; les quantités n'affichent pas de décimales inutiles
    const plusLarge = [...data.objects].sort((a, b) => b.w - a.w)[0];
    expect(plusLarge.name).toBe('Désignation');
    expect(data.objects.find((o) => o.name === 'Quantité')).toMatchObject({ format: { kind: 'number', pattern: '#,##0.##' } });
  });

  it('total : premier montant de la liste (jamais une remise ou un pourcentage), même hors des 7 premières colonnes', () => {
    const kind: KindDef = {
      id: 'piece', label: 'Pièce', datasets: [{ name: 'Lignes', label: 'Lignes', mode: 'list', fields: [
        { name: 'code', type: 'text' }, { name: 'designation', type: 'text' }, { name: 'qte', type: 'number' }, { name: 'unite', type: 'text' },
        { name: 'prix_ht', type: 'number' }, { name: 'prix_ttc', type: 'number' }, { name: 'remise', label: 'Remise %', type: 'number' },
        { name: 'tva', label: 'TVA %', type: 'number' }, { name: 'total_ht', label: 'Total HT', type: 'number' },
      ] }],
      sample: { Lignes: [{ code: 'A', designation: 'X', qte: 2, prix_ht: 10, total_ht: 20, remise: 5 }, { code: 'B', designation: 'Y', qte: 1, prix_ht: 30, total_ht: 30, remise: 0 }] },
    };
    const def = creerEtatStandard(kind);
    const data = def.bands.find((b) => b.type === 'data')!;
    expect(data.objects.length).toBe(7);
    expect(data.objects.at(-1)!.text).toBe('[Lignes.total_ht]');
    const t = texte(rendreEtat(def, kind.sample).pages.join(''));
    expect(t).toContain('Total HT : 50,00');
  });

  it('type sans liste : champs du document en « libellé : valeur »', () => {
    const kind: KindDef = {
      id: 'fiche', label: 'Fiche', datasets: [{ name: 'Client', label: 'Client', mode: 'single', fields: [{ name: 'nom', label: 'Nom', type: 'text' }, { name: 'solde', label: 'Solde', type: 'number' }] }],
      sample: { Client: { nom: 'Durand', solde: 1500 } },
    };
    const def = creerEtatStandard(kind, 'Fiche client');
    expect(def.bands.map((b) => b.type)).toEqual(['reportTitle', 'reportSummary', 'pageFooter']);
    expect(verifierModele(def).filter((p) => p.niveau === 'erreur')).toEqual([]);
    const t = texte(rendreEtat(def, kind.sample).pages.join(''));
    expect(t).toContain('Durand');
    expect(t).toMatch(/1 ?500,00/);
  });
});

describe('polices : même pile à l’impression et dans le designer', () => {
  it('chasse fixe → monospace, sinon Arial', () => {
    expect(familleCss('Consolas')).toBe("'Consolas',monospace");
    expect(familleCss('JetBrains Mono')).toBe("'JetBrains Mono',monospace");
    expect(familleCss('Segoe UI')).toBe("'Segoe UI',Arial,Helvetica,sans-serif");
    expect(familleCss('A"b<c')).toBe("'Abc',Arial,Helvetica,sans-serif");
  });
});
