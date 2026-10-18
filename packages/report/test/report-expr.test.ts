import { describe, expect, it } from 'vitest';
import { compiler, segmenter, validerExpression } from '../src/expr/parser';
import { evaluerExpression, resoudreTexte, Scope } from '../src/expr/eval';
import { appliquerFormat, formaterDate, formaterNombre } from '../src/format';

const NB = ' ';

function scope() {
  const s = new Scope();
  s.definir('Vente', { numero: '0012/2026', total: 1234.5, remise: 0, client: { nom: 'Ali' }, date: '2026-06-15' });
  const lignes = [{ qte: 2, prix: 100 }, { qte: 3, prix: 50 }, { qte: 1, prix: 10 }];
  s.definir('Lignes', lignes[0]).definirFenetre('Lignes', lignes);
  return s;
}
const val = (src: string) => { const r = evaluerExpression(src, scope()); if (r.erreur) throw new Error(r.erreur); return r.valeur; };

describe('formatage', () => {
  it('nombres avec motif', () => {
    expect(formaterNombre(1234.5, '#,##0.00')).toBe(`1${NB}234,50`);
    expect(formaterNombre(1234.567, '0.0')).toBe('1234,6');
    expect(formaterNombre(0.256, '0.##%')).toBe('25,6%');
    expect(formaterNombre(-5, '#,##0.00')).toBe('-5,00');
    expect(formaterNombre('abc')).toBe('');
  });
  it('dates', () => {
    expect(formaterDate('2026-06-15', 'dd/MM/yyyy')).toBe('15/06/2026');
    expect(formaterDate('2026-06-15 14:05:09', 'HH:mm:ss')).toBe('14:05:09');
    expect(formaterDate('2026-06-15', 'dddd d MMMM yyyy')).toBe('lundi 15 juin 2026');
    expect(formaterDate('1899-12-30', 'dd/MM/yyyy')).toBe(''); // date zéro Delphi
  });
  it('format d’objet', () => {
    expect(appliquerFormat(12, { kind: 'currency', currency: 'DA' })).toBe('12,00 DA');
    expect(appliquerFormat(0, { kind: 'number', hideZeros: true })).toBe('');
    expect(appliquerFormat(null, { kind: 'number', nullText: '—' })).toBe('—');
  });
});

describe('expressions', () => {
  it('arithmétique et priorités', () => {
    expect(val('1 + 2 * 3')).toBe(7);
    expect(val('(1 + 2) * 3')).toBe(9);
    expect(val('10 / 0')).toBe(0);
    expect(val('-Vente.total')).toBe(-1234.5);
  });
  it('chemins, insensibles à la casse', () => {
    expect(val('vente.NUMERO')).toBe('0012/2026');
    expect(val('Vente.client.nom')).toBe('Ali');
    expect(val('Vente.inconnu')).toBeNull();
  });
  it('texte, comparaison, ternaire', () => {
    expect(val("'N° ' & Vente.numero")).toBe('N° 0012/2026');
    expect(val("Vente.total > 1000 ? 'gros' : 'petit'")).toBe('gros');
    expect(val('Vente.remise = 0 and Vente.total > 1')).toBe(true);
    expect(val("IIF(Vente.remise > 0, 'oui', 'non')")).toBe('non');
  });
  it('fonctions', () => {
    expect(val("UPPER(Vente.client.nom)")).toBe('ALI');
    expect(val("ROUND(2.345, 2)")).toBe(2.35);
    expect(val("FORMAT(Vente.total, '#,##0.00')")).toBe(`1${NB}234,50`);
    expect(val("FORMAT(Vente.date, 'dd/MM/yyyy')")).toBe('15/06/2026');
    expect(String(val("ENLETTRES(21)")).toLowerCase()).toContain('vingt');
    expect(val("COALESCE(null, '', 'x')")).toBe('x');
    expect(val('MAX(3, 9, 4)')).toBe(9);
  });
  it('agrégats sur la fenêtre du dataset', () => {
    expect(val('SUM(Lignes.qte * Lignes.prix)')).toBe(360);
    expect(val('COUNT(Lignes)')).toBe(3);
    expect(val('AVG(Lignes.qte)')).toBe(2);
    expect(val('MAX(Lignes.prix)')).toBe(100);
    expect(val('SUMIF(Lignes.prix, Lignes.qte > 1)')).toBe(150);
  });
  it('erreurs de syntaxe', () => {
    expect(validerExpression('1 +')).toMatch(/incomplète/);
    expect(validerExpression("'abc")).toMatch(/non terminée/);
    expect(validerExpression('1 ? 2')).not.toBeNull();
    expect(validerExpression('A.b')).toBeNull();
    expect(() => compiler('')).toThrow();
  });
  it('fonction inconnue = erreur, pas d’exception', () => {
    const r = evaluerExpression('TOTO(1)', scope());
    expect(r.erreur).toMatch(/inconnue/);
  });
  it('aucun accès au code : pas d’eval', () => {
    expect(validerExpression('constructor.constructor("return 1")()')).not.toBeNull();
    const r = evaluerExpression('Vente.__proto__', scope());
    expect(r.valeur).toBeNull();
  });
});

describe('textes à segments', () => {
  it('découpe', () => {
    expect(segmenter('Total : [Vente.total] DA')).toEqual([{ lit: 'Total : ' }, { expr: 'Vente.total' }, { lit: ' DA' }]);
    expect(segmenter("[IIF(a, ']', 'b')]")).toEqual([{ expr: "IIF(a, ']', 'b')" }]);
    expect(segmenter('prix \\[HT\\]')).toEqual([{ lit: 'prix [HT]' }]);
  });
  it('une seule expression reçoit le format', () => {
    const r = resoudreTexte('[Vente.total]', scope(), { kind: 'number', pattern: '#,##0.00' });
    expect(r.texte).toBe(`1${NB}234,50`);
    expect(r.estNombre).toBe(true);
  });
  it('texte mixte', () => {
    const r = resoudreTexte('Facture [Vente.numero] du [FORMAT(Vente.date, "dd/MM/yyyy")]', scope());
    expect(r.texte).toBe('Facture 0012/2026 du 15/06/2026');
    expect(r.erreurs).toEqual([]);
  });
  it('erreur signalée dans le texte', () => {
    const r = resoudreTexte('a [1 +] b', scope());
    expect(r.texte).toBe('a #ERREUR b');
    expect(r.erreurs.length).toBe(1);
  });
});
