import { describe, expect, it } from 'vitest';
import { creerBande, creerEtat, creerObjet, normaliserEtat, FichierEtatInvalide, ReportDef, TextObj } from '../src/model';
import { LIMITE_CONTINU_MM, rendreEtat } from '../src/engine/render';
import { CODE128_MOTIFS, cleEan13, encoderCode128, encoderCode39, encoderEan13, normaliserEan13, CODE39_MOTIFS } from '../src/engine/barcode';
import { compterLignes } from '../src/engine/measure';

// Mesureur déterministe (6 px par caractère) : les tests ne dépendent pas des polices du poste
const mesureur = { largeur: (t: string) => t.length * 6 };

const texte = (x: number, y: number, w: number, h: number, t: string, over: Partial<TextObj> = {}) =>
  creerObjet('text', x, y, { w, h, text: t, ...over }) as TextObj;

function modeleFacture(): ReportDef {
  const e = creerEtat('vente', 'Facture');
  e.bands = [
    creerBande('pageHeader', { height: 12, objects: [texte(0, 0, 100, 6, '[Societe.nom]')] }),
    creerBande('reportTitle', { height: 10, objects: [texte(0, 0, 100, 8, 'Facture [Vente.numero]')] }),
    creerBande('dataHeader', { dataSource: 'Lignes', height: 6, objects: [texte(0, 0, 60, 5, 'Désignation')] }),
    creerBande('data', { dataSource: 'Lignes', height: 6, objects: [
      texte(0, 0, 60, 5, '[Lignes.designation]'),
      texte(100, 0, 30, 5, '[Lignes.qte * Lignes.prix]', { format: { kind: 'number', pattern: '#,##0.00' } }),
    ] }),
    creerBande('dataFooter', { dataSource: 'Lignes', height: 8, objects: [texte(100, 0, 30, 6, '[SUM(Lignes.qte * Lignes.prix)]')] }),
    creerBande('pageFooter', { height: 8, objects: [texte(0, 0, 60, 5, 'Page [Page] / [TotalPages]')] }),
  ];
  return e;
}

const lignes = (n: number) => Array.from({ length: n }, (_, i) => ({ designation: `Article ${i + 1}`, qte: 1, prix: 10 }));

describe('pagination', () => {
  it('une petite facture tient sur une page', () => {
    const r = rendreEtat(modeleFacture(), { Societe: { nom: 'ACME' }, Vente: { numero: '001' }, Lignes: lignes(5) }, { mesureur });
    expect(r.pageCount).toBe(1);
    expect(r.html).toContain('ACME');
    expect(r.html).toContain('Facture 001');
    expect(r.html).toContain('Page 1 / 1');
    expect(r.lignes).toBe(5);
  });

  it('120 lignes sur plusieurs pages, en-tête et pied répétés, numérotation exacte', () => {
    const r = rendreEtat(modeleFacture(), { Societe: { nom: 'ACME' }, Vente: { numero: '001' }, Lignes: lignes(120) }, { mesureur });
    // 297 - 20 (marges) - 12 (en-tête) - 8 (pied) = 257 mm utiles ; titre 10 + en-tête colonne 6 ; lignes de 6 mm
    expect(r.pageCount).toBeGreaterThan(2);
    expect(r.pages.every((p) => p.includes('ACME'))).toBe(true);
    r.pages.forEach((p, i) => expect(p).toContain(`Page ${i + 1} / ${r.pageCount}`));
    // total : 120 × 10 = 1 200 sur la dernière page seulement
    expect(r.pages[r.pageCount - 1]).toContain('1200');
    expect(r.pages[0]).not.toContain('1200');
    expect(r.pages.join('')).toContain('Article 120');
  });

  it('l’en-tête de colonnes ne reste pas seul en bas de page', () => {
    const e = modeleFacture();
    e.bands[0].height = 0; e.bands[0].objects = [];
    // remplit presque toute la page avec le titre pour forcer l'en-tête de colonnes en bas
    e.bands[1].height = 262; // l'en-tête de colonnes (6 mm) tient encore, pas la 1re ligne
    const r = rendreEtat(e, { Societe: {}, Vente: { numero: '1' }, Lignes: lignes(3) }, { mesureur });
    expect(r.pageCount).toBe(2);
    expect(r.pages[0]).not.toContain('Désignation');
    expect(r.pages[1]).toContain('Désignation');
  });

  it('jeu de données vide : bande données absente, pas d’en-tête orphelin', () => {
    const r = rendreEtat(modeleFacture(), { Societe: { nom: 'X' }, Vente: { numero: '1' }, Lignes: [] }, { mesureur });
    expect(r.pageCount).toBe(1);
    expect(r.html).not.toContain('Désignation');
  });

  it('mode ticket continu : une seule page dont la hauteur suit le contenu', () => {
    const e = modeleFacture();
    e.page.continuous = true;
    e.page.height = 100;
    const court = rendreEtat(e, { Societe: {}, Vente: { numero: '1' }, Lignes: lignes(3) }, { mesureur });
    const long = rendreEtat(e, { Societe: {}, Vente: { numero: '1' }, Lignes: lignes(60) }, { mesureur });
    expect(court.pageCount).toBe(1);
    expect(long.pageCount).toBe(1);
    expect(long.heightMm).toBeGreaterThan(court.heightMm + 200);
  });

  it('ticket continu plus long que la limite PDF : découpé en pages de la hauteur maximale, rien de perdu', () => {
    const e = modeleFacture();
    e.page.continuous = true;
    e.page.height = 100;
    const r = rendreEtat(e, { Societe: {}, Vente: { numero: '1' }, Lignes: lignes(1000) }, { mesureur });
    expect(r.pageCount).toBeGreaterThan(1);
    expect(r.heightMm).toBe(LIMITE_CONTINU_MM);
    expect(r.warnings[0]).toMatch(/découpé/);
    const html = r.pages.join('');
    expect(html).toContain('Article 1</');
    expect(html).toContain('Article 1000');
  });

  it('garde-fou : limite de pages', () => {
    const r = rendreEtat(modeleFacture(), { Societe: {}, Vente: { numero: '1' }, Lignes: lignes(5000) }, { mesureur, maxPages: 3 });
    expect(r.pageCount).toBe(3);
    expect(r.warnings.join(' ')).toMatch(/Limite/);
  });
});

describe('groupes et maître-détail', () => {
  function modeleGroupes(): ReportDef {
    const e = creerEtat('vente', 'Groupes');
    e.bands = [
      creerBande('groupHeader', { dataSource: 'Ventes', groupBy: 'Ventes.client', height: 6, objects: [texte(0, 0, 60, 5, 'CLIENT [Ventes.client]')] }),
      creerBande('data', { dataSource: 'Ventes', height: 6, objects: [texte(0, 0, 40, 5, '[Ventes.numero]'), texte(50, 0, 30, 5, '[Ventes.total]')] }),
      creerBande('groupFooter', { dataSource: 'Ventes', height: 6, objects: [texte(0, 0, 60, 5, 'Sous-total [SUM(Ventes.total)] sur [COUNT(Ventes)]')] }),
      creerBande('reportSummary', { height: 8, objects: [texte(0, 0, 60, 5, 'TOTAL [SUM(Ventes.total)]')] }),
    ];
    return e;
  }
  const ventes = [
    { client: 'B', numero: '3', total: 30 }, { client: 'A', numero: '1', total: 10 },
    { client: 'A', numero: '2', total: 20 }, { client: 'B', numero: '4', total: 40 },
  ];

  it('regroupe, trie et totalise par groupe puis en synthèse', () => {
    const r = rendreEtat(modeleGroupes(), { Ventes: ventes }, { mesureur });
    const h = r.html;
    expect(h.indexOf('CLIENT A')).toBeLessThan(h.indexOf('CLIENT B'));
    expect(h).toContain('Sous-total 30 sur 2'); // A : 10 + 20
    expect(h).toContain('Sous-total 70 sur 2'); // B : 30 + 40
    expect(h).toContain('TOTAL 100');
  });

  it('maître-détail : lignes imbriquées sous chaque pièce', () => {
    const e = creerEtat('vente', 'MD');
    const maitre = creerBande('data', { dataSource: 'Docs', height: 6, objects: [texte(0, 0, 40, 5, 'DOC [Docs.numero]')] });
    const detail = creerBande('data', { dataSource: 'Docs.lignes', parent: maitre.id, height: 5, objects: [texte(5, 0, 40, 4, '- [lignes.nom]')] });
    e.bands = [maitre, detail];
    const r = rendreEtat(e, { Docs: [
      { numero: 'F1', lignes: [{ nom: 'a' }, { nom: 'b' }] },
      { numero: 'F2', lignes: [{ nom: 'c' }] },
    ] }, { mesureur });
    const t = r.html.replace(/<[^>]+>/g, ' ');
    expect(t.indexOf('DOC F1')).toBeLessThan(t.indexOf('- a'));
    expect(t.indexOf('- b')).toBeLessThan(t.indexOf('DOC F2'));
    expect(t).toContain('- c');
  });
});

describe('objets et mise en page', () => {
  it('colonnes de données (étiquettes) : plusieurs cellules par ligne', () => {
    const e = creerEtat('etiquettes', 'Étiquettes');
    e.bands = [creerBande('data', { dataSource: 'Articles', height: 20, columns: 3, columnGap: 2, objects: [texte(0, 0, 50, 8, '[Articles.nom]')] })];
    const r = rendreEtat(e, { Articles: Array.from({ length: 7 }, (_, i) => ({ nom: `N${i + 1}` })) }, { mesureur });
    // 7 articles / 3 colonnes = 3 lignes de bande
    expect((r.html.match(/class="rpt-b"/g) ?? []).length).toBe(3);
    expect(r.html).toContain('N7');
  });

  it('un champ canGrow agrandit la bande et décale les objets du dessous', () => {
    const e = creerEtat('vente', 'Grow');
    const long = 'mot '.repeat(60); // 240 caractères × 6 px = 1 440 px sur ~190 px de large
    e.bands = [creerBande('data', { dataSource: 'L', height: 6, objects: [
      texte(0, 0, 50, 6, '[L.t]', { canGrow: true }),
      texte(0, 6, 50, 6, 'dessous', { shift: true }),
    ] })];
    const r = rendreEtat(e, { L: [{ t: long }] }, { mesureur });
    const h = Number(/class="rpt-b"[^>]*height:([\d.]+)mm/.exec(r.html)?.[1]);
    expect(h).toBeGreaterThan(30);
    const top = Number(/top:([\d.]+)mm;width:50mm;height:6mm[^>]*>(?:(?!<div class="rpt-o").)*dessous/s.exec(r.html)?.[1]);
    expect(top).toBeGreaterThan(20);
  });

  it('HTML bien formé : aucun guillemet double dans un attribut style', () => {
    const r = rendreEtat(modeleFacture(), { Societe: { nom: 'ACME' }, Vente: { numero: '001' }, Lignes: lignes(2) }, { mesureur });
    for (const m of r.html.matchAll(/style="([^"]*)"/g)) expect(m[1]).not.toContain('"');
    expect(r.html).not.toMatch(/font-family:"/);
    // police hostile : pas d'injection d'attribut
    const e = modeleFacture();
    (e.bands[1].objects[0] as TextObj).font = { family: 'Arial" onload="x' };
    expect(rendreEtat(e, { Societe: {}, Vente: { numero: '1' }, Lignes: [] }, { mesureur }).html).not.toMatch(/onload="/);
  });

  it('visibilité conditionnelle et échappement HTML', () => {
    const e = creerEtat('vente', 'V');
    e.bands = [creerBande('reportTitle', { height: 10, objects: [
      texte(0, 0, 50, 6, '<b>[X.a]</b>'),
      texte(0, 6, 50, 4, 'caché', { visible: 'X.a = "zzz"' }),
    ] })];
    const r = rendreEtat(e, { X: { a: 'a&b' } }, { mesureur });
    expect(r.html).toContain('&lt;b&gt;a&amp;b&lt;/b&gt;');
    expect(r.html).not.toContain('caché');
  });

  it('paramètres et variables calculées', () => {
    const e = creerEtat('vente', 'P');
    e.parameters = [{ name: 'Titre', type: 'text', default: 'Défaut' }, { name: 'Taux', type: 'number', default: '19' }];
    e.variables = [{ name: 'TTC', expr: 'X.ht * (1 + Taux / 100)' }];
    e.bands = [creerBande('reportTitle', { height: 10, objects: [texte(0, 0, 80, 6, '[Titre] : [TTC]')] })];
    expect(rendreEtat(e, { X: { ht: 100 } }, { mesureur }).html).toContain('Défaut : 119');
    expect(rendreEtat(e, { X: { ht: 100 } }, { mesureur, params: { Titre: 'Perso', Taux: '0' } }).html).toContain('Perso : 100');
  });

  it('erreur d’expression : signalée sans casser l’état', () => {
    const e = creerEtat('vente', 'E');
    e.bands = [creerBande('reportTitle', { height: 10, objects: [texte(0, 0, 50, 6, '[1 +]')] })];
    const r = rendreEtat(e, {}, { mesureur });
    expect(r.html).toContain('#ERREUR');
    expect(r.warnings.length).toBe(1);
  });

  it('mesure des lignes avec retour automatique', () => {
    const f = { family: 'Arial', size: 9, bold: false, italic: false, underline: false, strike: false, color: '#000' };
    expect(compterLignes('a b c', f, 1000, true, mesureur)).toBe(1);
    expect(compterLignes('mot '.repeat(10).trim(), f, 100, true, mesureur)).toBeGreaterThan(2);
    expect(compterLignes('a\nb\nc', f, 1000, true, mesureur)).toBe(3);
    expect(compterLignes('x'.repeat(100), f, 120, true, mesureur)).toBe(5); // mot coupé : 600 px / 120
  });
});

describe('codes-barres', () => {
  it('Code 128 : table complète et motifs de 11 modules', () => {
    expect(CODE128_MOTIFS.length).toBe(107);
    CODE128_MOTIFS.slice(0, 106).forEach((m) => expect(m.split('').reduce((s, c) => s + Number(c), 0)).toBe(11));
    expect(CODE128_MOTIFS[106].split('').reduce((s, c) => s + Number(c), 0)).toBe(13);
    const m = encoderCode128('ABC-123');
    expect(m.reduce((s, c) => s + c, 0) % 11).toBe(2); // (n symboles × 11) + stop 13 = 2 mod 11
  });
  it('Code 128 : valeurs numériques paires encodées en jeu C (plus court)', () => {
    expect(encoderCode128('123456').length).toBeLessThan(encoderCode128('12345a').length);
  });
  it('Code 39 : chaque caractère a 3 éléments larges', () => {
    Object.values(CODE39_MOTIFS).forEach((p) => expect(p.split('').filter((c) => c === 'w').length).toBe(3));
    expect(encoderCode39('AB-1').length).toBeGreaterThan(0);
  });
  it('EAN-13 : clé de contrôle et 95 modules', () => {
    expect(cleEan13('400638133393')).toBe(1);
    expect(normaliserEan13('4006381333931')).toBe('4006381333931');
    expect(normaliserEan13('4006381333930')).toBe('4006381333931'); // clé corrigée
    expect(encoderEan13('4006381333931').reduce((s, c) => s + c, 0)).toBe(95);
    expect(encoderEan13('123')).toEqual([]);
  });
});

describe('fichier .gcr', () => {
  it('aller-retour JSON et normalisation', () => {
    const e = modeleFacture();
    const lu = normaliserEtat(JSON.parse(JSON.stringify(e)));
    expect(lu.bands.length).toBe(e.bands.length);
    expect(lu.page.size).toBe('A4');
  });
  it('rejette un fichier étranger ou trop récent', () => {
    expect(() => normaliserEtat({ format: 'autre' })).toThrow(FichierEtatInvalide);
    expect(() => normaliserEtat(null)).toThrow(FichierEtatInvalide);
    expect(() => normaliserEtat({ format: 'gcr', version: 99 })).toThrow(/Version/);
  });
  it('complète les propriétés manquantes', () => {
    const lu = normaliserEtat({ format: 'gcr', version: 1, bands: [{ type: 'data', objects: [{ type: 'text', x: 0, y: 0, w: 10, h: 5, text: 'a' }] }] });
    expect(lu.bands[0].id).toBeTruthy();
    expect(lu.page.margins.top).toBeGreaterThan(0);
  });
});
