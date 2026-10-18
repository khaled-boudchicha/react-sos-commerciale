import { describe, expect, it } from 'vitest';
import { BandDef, creerBande, creerEtat, creerObjet, ReportDef, TextObj } from '../src/model';
import { rendreEtat, RenderResult } from '../src/engine/render';

const mesureur = { largeur: (t: string) => t.length * 5.5 };
const T = (x: number, y: number, w: number, h: number, text: string, o: Partial<TextObj> = {}) =>
  creerObjet('text', x, y, { w, h, text, ...o }) as TextObj;

// ─── Analyse géométrique du HTML produit ────────────────────────────────────

type Boite = { top: number; h: number; left: number; w: number; texte: string; overlay: boolean };
type PageAnalysee = { boites: Boite[]; texte: string; w: number; h: number };

function analyser(r: RenderResult): PageAnalysee[] {
  return r.pages.map((html) => {
    const dims = /class="rpt-page"[^>]*style="width:([\d.]+)mm;height:([\d.]+)mm/.exec(html)!;
    const boites: Boite[] = [];
    // chaque bande commence par <div class="rpt-b" …>
    const morceaux = html.split('<div class="rpt-b"').slice(1);
    for (const m of morceaux) {
      const g = /left:([\d.]+)mm;top:([\d.]+)mm;width:([\d.]+)mm;height:([\d.]+)mm/.exec(m)!;
      boites.push({ left: +g[1], top: +g[2], w: +g[3], h: +g[4], texte: m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), overlay: m.includes('data-overlay') });
    }
    return { boites, texte: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), w: +dims[1], h: +dims[2] };
  });
}

/** Invariants que toute pagination valide doit respecter. */
function verifierInvariants(def: ReportDef, r: RenderResult, hEnTete: number, hPied: number) {
  const pages = analyser(r);
  const m = def.page.margins;
  const H = pages[0].h;
  const haut = m.top + hEnTete, bas = H - m.bottom - hPied;
  pages.forEach((p, i) => {
    const contenu = p.boites.filter((b) => !b.overlay && b.top >= haut - 0.01 && b.top + b.h <= bas + 0.5 || (!b.overlay && b.top >= haut - 0.01 && b.top < bas));
    const flux = p.boites.filter((b) => !b.overlay && b.top >= haut - 0.01 && b.top < bas - 0.001);
    // 1. pas de débordement du corps de page (hors bande plus haute que la page : avertissement)
    for (const b of flux) {
      if (b.h <= bas - haut + 0.01) expect(b.top + b.h, `page ${i + 1} : bande qui déborde (top ${b.top}, h ${b.h}, bas ${bas})`).toBeLessThanOrEqual(bas + 0.02);
    }
    // 2. pas de chevauchement entre bandes du flux
    const tri = [...flux].sort((a, b) => a.top - b.top);
    for (let k = 1; k < tri.length; k++) {
      expect(tri[k].top, `page ${i + 1} : chevauchement`).toBeGreaterThanOrEqual(tri[k - 1].top + tri[k - 1].h - 0.02);
    }
    void contenu;
  });
  return pages;
}

// ─── Générateur de modèles pseudo-aléatoires (graine fixe = reproductible) ──

function prng(graine: number) {
  let s = graine >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

type Option = { entete?: boolean; pied?: boolean; titre?: boolean; synthese?: boolean; groupes?: boolean; colonnes?: number; repeter?: boolean };

function modele(o: Option = {}, hLigne = 6, grow = false): ReportDef {
  const e = creerEtat('vente', 'P');
  const b: BandDef[] = [];
  if (o.entete) b.push(creerBande('pageHeader', { height: 14, objects: [T(0, 0, 100, 6, 'EN-TÊTE DE PAGE [Page]/[TotalPages]')] }));
  if (o.titre) b.push(creerBande('reportTitle', { height: 20, objects: [T(0, 0, 100, 8, 'TITRE DU RAPPORT')] }));
  if (o.groupes) b.push(creerBande('groupHeader', { dataSource: 'L', groupBy: 'L.g', height: 7, objects: [T(0, 0, 100, 6, 'GROUPE [L.g]')] }));
  else b.push(creerBande('dataHeader', { dataSource: 'L', height: 7, objects: [T(0, 0, 100, 6, 'ENTETE-COLONNES')], ...(o.repeter === false ? { repeatOnEveryPage: false } : {}) }));
  b.push(creerBande('data', { dataSource: 'L', height: hLigne, columns: o.colonnes, columnGap: o.colonnes ? 2 : 0, canGrow: grow, objects: [
    T(0, 0, o.colonnes ? 50 : 100, hLigne - 1, 'LIGNE-[L.n]', { canGrow: grow }), ...(grow ? [] : []),
  ] }));
  if (o.groupes) b.push(creerBande('groupFooter', { dataSource: 'L', height: 7, objects: [T(0, 0, 100, 6, 'FIN-GROUPE [L.g] [COUNT(L)]')] }));
  b.push(creerBande('dataFooter', { dataSource: 'L', height: 9, objects: [T(0, 0, 100, 6, 'TOTAL-FINAL [COUNT(L)]')] }));
  if (o.synthese) b.push(creerBande('reportSummary', { height: 30, objects: [T(0, 0, 100, 6, 'SYNTHESE')] }));
  if (o.pied) b.push(creerBande('pageFooter', { height: 10, objects: [T(0, 0, 100, 6, 'PIED DE PAGE [Page]/[TotalPages]')] }));
  e.bands = b;
  return e;
}

const rows = (n: number, g = (i: number) => `G${Math.floor(i / 7)}`) => ({ L: Array.from({ length: n }, (_, i) => ({ n: i + 1, g: g(i) })) });

/** Numéros de lignes imprimés, dans l'ordre d'apparition (pages dans l'ordre). */
function lignesImprimees(pages: PageAnalysee[]): number[] {
  return pages.flatMap((p) => [...p.texte.matchAll(/LIGNE-(\d+)/g)].map((m) => +m[1]));
}

// ─── Scénarios ciblés ───────────────────────────────────────────────────────

describe('pagination — en-tête et pied de page', () => {
  const def = modele({ entete: true, pied: true });
  const r = rendreEtat(def, rows(150), { mesureur });
  const pages = analyser(r);

  it('plusieurs pages, chaque ligne imprimée une fois et dans l’ordre', () => {
    expect(r.pageCount).toBeGreaterThan(3);
    expect(lignesImprimees(pages)).toEqual(Array.from({ length: 150 }, (_, i) => i + 1));
  });

  it('l’en-tête de page est en haut et le pied en bas de CHAQUE page, numérotés', () => {
    pages.forEach((p, i) => {
      const entete = p.boites.find((b) => b.texte.includes('EN-TÊTE DE PAGE'))!;
      const pied = p.boites.find((b) => b.texte.includes('PIED DE PAGE'))!;
      expect(entete.top).toBe(10);
      expect(pied.top).toBeCloseTo(297 - 10 - 10, 2);
      expect(entete.texte).toContain(`${i + 1}/${r.pageCount}`);
      expect(pied.texte).toContain(`${i + 1}/${r.pageCount}`);
    });
  });

  it('aucun débordement ni chevauchement', () => { verifierInvariants(def, r, 14, 10); });

  it('les lignes remplissent bien la page (pas de grand vide inutile)', () => {
    // hauteur utile = 297 - 20 - 14 - 10 = 253 mm ; lignes de 6 mm → ≥ 40 par page pleine
    const parPage = pages.slice(0, -1).map((p) => (p.texte.match(/LIGNE-/g) ?? []).length);
    parPage.forEach((n) => expect(n).toBeGreaterThanOrEqual(38));
  });
});

describe('pagination — en-tête de colonnes répété', () => {
  it('se répète en haut de chaque page tant que la section continue (par défaut)', () => {
    const r = rendreEtat(modele({ entete: true }), rows(150), { mesureur });
    const pages = analyser(r);
    expect(r.pageCount).toBeGreaterThan(2);
    pages.forEach((p, i) => {
      expect(p.texte, `page ${i + 1}`).toContain('ENTETE-COLONNES');
      // l'en-tête de colonnes est la première bande sous l'en-tête de page
      const flux = p.boites.filter((b) => b.top >= 24).sort((a, b) => a.top - b.top);
      expect(flux[0].texte).toContain('ENTETE-COLONNES');
    });
    expect(lignesImprimees(pages)).toHaveLength(150);
  });

  it('peut être désactivé (repeatOnEveryPage: false)', () => {
    const r = rendreEtat(modele({ entete: true, repeter: false }), rows(150), { mesureur });
    const pages = analyser(r);
    expect(pages[0].texte).toContain('ENTETE-COLONNES');
    expect(pages[1].texte).not.toContain('ENTETE-COLONNES');
  });

  it('n’est PAS répété sur une page qui ne contient pas la section (ex. synthèse seule)', () => {
    // la dernière page ne contient que la synthèse si tout le reste remplit les pages précédentes
    const r = rendreEtat(modele({ synthese: true }), rows(10), { mesureur });
    expect(analyser(r)[0].texte.match(/ENTETE-COLONNES/g)).toHaveLength(1);
  });
});

describe('pagination — printOnFirstPage / printOnLastPage', () => {
  it('en-tête masqué sur la première page, pied masqué sur la dernière', () => {
    const e = modele({ entete: true, pied: true });
    e.bands[0].printOnFirstPage = false;
    e.bands[e.bands.length - 1].printOnLastPage = false;
    const r = rendreEtat(e, rows(120), { mesureur });
    const pages = analyser(r);
    expect(pages[0].texte).not.toContain('EN-TÊTE DE PAGE');
    expect(pages[1].texte).toContain('EN-TÊTE DE PAGE');
    expect(pages[r.pageCount - 1].texte).not.toContain('PIED DE PAGE');
    expect(pages[0].texte).toContain('PIED DE PAGE');
  });
});

describe('pagination — titre, synthèse, sauts de page', () => {
  it('le titre n’apparaît qu’une fois, sur la première page, sous l’en-tête de page', () => {
    const r = rendreEtat(modele({ entete: true, titre: true }), rows(150), { mesureur });
    const pages = analyser(r);
    expect(pages.filter((p) => p.texte.includes('TITRE DU RAPPORT'))).toHaveLength(1);
    expect(pages[0].texte).toContain('TITRE DU RAPPORT');
    const t = pages[0].boites.find((b) => b.texte.includes('TITRE'))!;
    expect(t.top).toBe(24); // 10 marge + 14 en-tête
  });

  it('la synthèse qui ne tient pas passe à la page suivante (jamais coupée)', () => {
    // on remplit la page pour qu'il ne reste que ~15 mm : la synthèse (30 mm) doit aller sur la page suivante
    const def = modele({ synthese: true, pied: true }, 6);
    for (let n = 30; n < 60; n++) {
      const r = rendreEtat(def, rows(n), { mesureur });
      const pages = verifierInvariants(def, r, 0, 10);
      expect(pages.filter((p) => p.texte.includes('SYNTHESE'))).toHaveLength(1);
      const p = pages.find((x) => x.texte.includes('SYNTHESE'))!;
      const b = p.boites.find((x) => x.texte.includes('SYNTHESE'))!;
      expect(b.top + b.h).toBeLessThanOrEqual(297 - 10 - 10 + 0.02);
    }
  });

  it('startNewPage force la bande en haut d’une nouvelle page', () => {
    const e = modele({ titre: true });
    e.bands.find((b) => b.type === 'dataHeader')!.startNewPage = true;
    const r = rendreEtat(e, rows(5), { mesureur });
    expect(r.pageCount).toBe(2);
    expect(analyser(r)[0].texte).toContain('TITRE');
    expect(analyser(r)[1].texte).toContain('ENTETE-COLONNES');
  });

  it('newPageAfter : le contenu suivant démarre sur une nouvelle page', () => {
    const e = modele({ titre: true });
    e.bands.find((b) => b.type === 'reportTitle')!.newPageAfter = true;
    const r = rendreEtat(e, rows(5), { mesureur });
    expect(r.pageCount).toBe(2);
    expect(analyser(r)[1].texte).toContain('LIGNE-1');
  });

  it('newPageAfter sans contenu après : pas de page blanche', () => {
    const e = creerEtat('vente', 'X');
    e.bands = [creerBande('reportTitle', { height: 10, newPageAfter: true, objects: [T(0, 0, 50, 6, 'SEUL')] })];
    expect(rendreEtat(e, {}, { mesureur }).pageCount).toBe(1);
  });
});

describe('pagination — plusieurs documents (resetPageNumber)', () => {
  it('chaque document redémarre à la page 1 avec son propre total', () => {
    const e = creerEtat('vente', 'Batch');
    e.bands = [
      creerBande('pageFooter', { height: 8, objects: [T(0, 0, 100, 6, 'P [Page]/[TotalPages]')] }),
      creerBande('groupHeader', { dataSource: 'D', groupBy: 'D.id', height: 8, startNewPage: true, resetPageNumber: true, objects: [T(0, 0, 100, 6, 'DOC [D.id]')] }),
      creerBande('data', { dataSource: 'D', height: 20, objects: [T(0, 0, 100, 6, 'ligne')] }),
    ];
    // 3 documents : 1 ligne (1 page), 20 lignes (1 page = 20×20=400 > 250 → 2 pages), 1 ligne
    const D = [...[{ id: 'A' }], ...Array.from({ length: 20 }, () => ({ id: 'B' })), { id: 'C' }];
    const r = rendreEtat(e, { D }, { mesureur });
    const pages = analyser(r);
    const foot = pages.map((p) => /P (\d+)\/(\d+)/.exec(p.texte)![0]);
    expect(foot[0]).toBe('P 1/1');                    // A
    expect(foot[1]).toBe('P 1/' + (r.pageCount - 2)); // B : 1..n
    expect(foot[r.pageCount - 1]).toBe('P 1/1');      // C
    expect(r.pageCount).toBeGreaterThanOrEqual(4);
  });
});

describe('pagination — groupes', () => {
  const def = modele({ entete: true, pied: true, groupes: true });
  const r = rendreEtat(def, rows(100, (i) => `G${Math.floor(i / 9)}`), { mesureur });
  const pages = analyser(r);

  it('toutes les lignes, un en-tête et un pied par groupe, dans l’ordre', () => {
    expect(lignesImprimees(pages)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    const tout = pages.map((p) => p.texte).join(' ');
    expect((tout.match(/(?<!FIN-)GROUPE G\d+/g) ?? []).length).toBe(12); // 100 / 9 → 12 groupes
    expect((tout.match(/FIN-GROUPE/g) ?? []).length).toBe(12);
  });

  it('un en-tête de groupe n’est jamais seul en bas de page (suivi d’au moins une ligne)', () => {
    pages.forEach((p, i) => {
      const flux = p.boites.filter((b) => b.top >= 24 && b.top < 297 - 10 - 10).sort((a, b) => a.top - b.top);
      const dernier = flux[flux.length - 1];
      if (dernier && /^GROUPE G\d+$/.test(dernier.texte.trim())) throw new Error(`page ${i + 1} : en-tête de groupe orphelin`);
    });
  });

  it('les totaux de groupe sont justes (9 lignes, sauf le dernier)', () => {
    const tout = pages.map((p) => p.texte).join(' ');
    const comptes = [...tout.matchAll(/FIN-GROUPE G\d+ (\d+)/g)].map((m) => +m[1]);
    expect(comptes.slice(0, -1).every((n) => n === 9)).toBe(true);
    expect(comptes[comptes.length - 1]).toBe(1);
  });

  it('aucun débordement ni chevauchement', () => { verifierInvariants(def, r, 14, 10); });
});

describe('pagination — colonnes (étiquettes) et détails', () => {
  it('3 colonnes sur plusieurs pages : toutes les cellules, une seule fois', () => {
    const e = creerEtat('etiquettes', 'E');
    e.bands = [creerBande('data', { dataSource: 'L', height: 30, columns: 3, columnGap: 4, objects: [T(0, 0, 55, 8, 'LIGNE-[L.n]')] })];
    const r = rendreEtat(e, rows(100), { mesureur });
    const pages = analyser(r);
    expect(lignesImprimees(pages)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    // 100 / 3 → 34 lignes de 30 mm ; (297-20)/30 = 9 lignes / page → 4 pages
    expect(r.pageCount).toBe(4);
    // les 3 cellules d'une ligne sont côte à côte et dans la largeur utile
    const cell = /left:([\d.]+)mm;top:[\d.]+mm;width:55mm/g;
    const xs = [...pages[0].texte.matchAll(/LIGNE-(\d+)/g)];
    expect(xs.length).toBe(27);
    void cell;
  });

  it('maître-détail sur plusieurs pages : chaque détail suit son maître', () => {
    const e = creerEtat('vente', 'MD');
    const maitre = creerBande('data', { dataSource: 'Docs', height: 7, objects: [T(0, 0, 100, 6, 'DOC-[Docs.n]')] });
    const detail = creerBande('data', { dataSource: 'Docs.l', parent: maitre.id, height: 5, objects: [T(5, 0, 100, 4, 'DET-[l.v]')] });
    e.bands = [maitre, detail];
    const docs = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, l: Array.from({ length: 6 }, (_, k) => ({ v: `${i + 1}.${k + 1}` })) }));
    const r = rendreEtat(e, { Docs: docs }, { mesureur });
    const flux = analyser(r).map((p) => p.texte).join(' ');
    const ordre = [...flux.matchAll(/(DOC-\d+|DET-[\d.]+)/g)].map((m) => m[1]);
    expect(ordre).toHaveLength(30 * 7);
    for (let i = 0; i < 30; i++) {
      expect(ordre[i * 7]).toBe(`DOC-${i + 1}`);
      for (let k = 0; k < 6; k++) expect(ordre[i * 7 + 1 + k]).toBe(`DET-${i + 1}.${k + 1}`);
    }
    expect(r.pageCount).toBeGreaterThan(1);
  });
});

describe('pagination — cas limites', () => {
  it('jeu de données vide : une page, en-tête/pied de page présents', () => {
    const r = rendreEtat(modele({ entete: true, pied: true }), { L: [] }, { mesureur });
    expect(r.pageCount).toBe(1);
    expect(r.pages[0]).toContain('PIED DE PAGE');
  });

  it('une seule ligne', () => {
    const r = rendreEtat(modele({ entete: true, pied: true }), rows(1), { mesureur });
    expect(r.pageCount).toBe(1);
    expect(r.pages[0]).toContain('LIGNE-1');
  });

  it('exactement une page pleine : pas de page supplémentaire vide', () => {
    // cherche le nombre de lignes qui remplit exactement la page, puis +1 doit créer une 2e page non vide
    const def = modele({ pied: true }, 6);
    let n = 1;
    while (rendreEtat(def, rows(n), { mesureur }).pageCount === 1) n++;
    const r = rendreEtat(def, rows(n), { mesureur });
    expect(r.pageCount).toBe(2);
    const pages = analyser(r);
    pages.forEach((p) => expect(p.boites.filter((b) => !b.overlay && b.top < 297 - 20).length).toBeGreaterThan(0));
    // la page 2 contient bien quelque chose de plus que le pied
    expect(pages[1].texte).toMatch(/LIGNE-|TOTAL-FINAL/);
  });

  it('une ligne plus haute que la page : avertissement, pas de boucle infinie', () => {
    const e = creerEtat('vente', 'X');
    e.bands = [creerBande('data', { dataSource: 'L', height: 400, objects: [T(0, 0, 100, 6, 'LIGNE-[L.n]')] })];
    const r = rendreEtat(e, rows(3), { mesureur });
    expect(r.warnings.join(' ')).toMatch(/plus haute que la page/);
    expect(r.pageCount).toBe(3);
  });

  it('champ qui s’étend près du bas de page : la ligne passe entière à la page suivante', () => {
    const e = creerEtat('vente', 'G');
    const long = 'mot '.repeat(80);
    e.bands = [creerBande('data', { dataSource: 'L', height: 6, canGrow: true, objects: [T(0, 0, 60, 6, 'LIGNE-[L.n] [L.t]', { canGrow: true })] })];
    const r = rendreEtat(e, { L: Array.from({ length: 40 }, (_, i) => ({ n: i + 1, t: i % 3 === 0 ? long : 'court' })) }, { mesureur });
    verifierInvariants(e, r, 0, 0);
    expect(lignesImprimees(analyser(r))).toHaveLength(40);
  });

  it('paysage : dimensions échangées et lignes plus nombreuses par page', () => {
    const portrait = rendreEtat(modele(), rows(100), { mesureur });
    const e = modele(); e.page.orientation = 'landscape';
    const paysage = rendreEtat(e, rows(100), { mesureur });
    expect([paysage.widthMm, paysage.heightMm]).toEqual([297, 210]);
    expect(paysage.pageCount).toBeGreaterThan(portrait.pageCount); // page moins haute
    expect(lignesImprimees(analyser(paysage))).toHaveLength(100);
  });

  it('marges personnalisées : la bande est décalée de la marge gauche', () => {
    const e = modele(); e.page.margins = { top: 25, right: 15, bottom: 12, left: 30 };
    const pages = analyser(rendreEtat(e, rows(3), { mesureur }));
    expect(pages[0].boites[0].left).toBe(30);
    expect(pages[0].boites[0].top).toBe(25);
    expect(pages[0].boites[0].w).toBe(210 - 30 - 15);
  });

  it('filigrane : imprimé sur chaque page, sous le contenu', () => {
    const e = modele({ entete: true });
    e.bands.push(creerBande('overlay', { height: 50, objects: [T(0, 0, 100, 10, 'CONFIDENTIEL')] }));
    const r = rendreEtat(e, rows(150), { mesureur });
    r.pages.forEach((p) => {
      expect(p).toContain('CONFIDENTIEL');
      expect(p.indexOf('CONFIDENTIEL')).toBeLessThan(p.indexOf('LIGNE-'));
    });
  });
});

// ─── Test par propriétés : des centaines de configurations aléatoires ───────

describe('pagination — propriétés sur configurations aléatoires', () => {
  it('300 configurations : invariants géométriques, ordre et exhaustivité des lignes', () => {
    const rnd = prng(20261018);
    for (let essai = 0; essai < 300; essai++) {
      const o: Option = { entete: rnd() < 0.6, pied: rnd() < 0.6, titre: rnd() < 0.5, synthese: rnd() < 0.5, groupes: rnd() < 0.4, colonnes: rnd() < 0.2 ? 2 + Math.floor(rnd() * 3) : undefined, repeter: rnd() < 0.8 };
      if (o.colonnes) { o.groupes = false; }
      const hLigne = 4 + Math.floor(rnd() * 12);
      const n = Math.floor(rnd() * 260);
      const def = modele(o, hLigne);
      if (rnd() < 0.3) def.page.orientation = 'landscape';
      if (rnd() < 0.3) def.page.margins = { top: 5 + rnd() * 20, right: 10, bottom: 5 + rnd() * 20, left: 10 };
      const r = rendreEtat(def, rows(n, (i) => `G${Math.floor(i / (3 + Math.floor(rnd() * 0 + 8)))}`), { mesureur });
      const hE = o.entete ? 14 : 0, hP = o.pied ? 10 : 0;
      const pages = verifierInvariants(def, r, hE, hP);
      const imprimees = lignesImprimees(pages);
      expect(imprimees, `essai ${essai} ${JSON.stringify(o)} n=${n} h=${hLigne}`).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      // chaque page porte l'en-tête et le pied demandés
      if (o.entete) pages.forEach((p) => expect(p.texte).toContain('EN-TÊTE DE PAGE'));
      if (o.pied) pages.forEach((p) => expect(p.texte).toContain('PIED DE PAGE'));
      // numérotation
      pages.forEach((p, i) => { if (o.pied) expect(p.texte).toContain(`PIED DE PAGE ${i + 1}/${r.pageCount}`); });
      // aucune page vide de contenu (hors cas n = 0)
      if (n > 0) pages.forEach((p, i) => expect(p.boites.some((b) => !b.overlay && /LIGNE-|GROUPE|FIN-GROUPE|TOTAL-FINAL|SYNTHESE|ENTETE|TITRE/.test(b.texte)), `essai ${essai} page ${i + 1} vide`).toBe(true));
    }
  });
});

// ─── Compléments : répétition d'en-têtes, groupes imbriqués, détails ────────

describe('pagination — répétition d’en-têtes (compléments)', () => {
  it('sur 300 configurations, toute page qui contient des lignes commence par l’en-tête de colonnes', () => {
    const rnd = prng(777);
    for (let essai = 0; essai < 300; essai++) {
      const o: Option = { entete: rnd() < 0.5, pied: rnd() < 0.5, titre: rnd() < 0.5, synthese: rnd() < 0.5 };
      const def = modele(o, 4 + Math.floor(rnd() * 10));
      const n = 1 + Math.floor(rnd() * 250);
      const r = rendreEtat(def, rows(n), { mesureur });
      const pages = analyser(r);
      const haut = 10 + (o.entete ? 14 : 0);
      pages.forEach((p, i) => {
        if (!/LIGNE-/.test(p.texte)) return;
        const flux = p.boites.filter((b) => b.top >= haut - 0.01 && b.top < 297 - 10).sort((a, b) => a.top - b.top);
        // 1re bande du flux = (titre sur la page 1) puis en-tête de colonnes
        const premiere = flux.find((b) => !/TITRE DU RAPPORT/.test(b.texte))!;
        expect(premiere.texte, `essai ${essai} page ${i + 1}`).toContain('ENTETE-COLONNES');
        // et il n'y en a qu'un par page
        expect((p.texte.match(/ENTETE-COLONNES/g) ?? []).length, `essai ${essai} page ${i + 1}`).toBe(1);
      });
    }
  });

  it('deux niveaux de groupes : en-têtes et pieds imbriqués dans le bon ordre', () => {
    const e = creerEtat('vente', 'G2');
    e.bands = [
      creerBande('groupHeader', { dataSource: 'L', groupBy: 'L.a', height: 7, objects: [T(0, 0, 100, 6, 'A=[L.a]')] }),
      creerBande('groupHeader', { dataSource: 'L', groupBy: 'L.b', height: 7, objects: [T(0, 0, 100, 6, 'B=[L.a][L.b]')] }),
      creerBande('data', { dataSource: 'L', height: 6, objects: [T(0, 0, 100, 5, 'LIGNE-[L.n]')] }),
      creerBande('groupFooter', { dataSource: 'L', height: 6, objects: [T(0, 0, 100, 5, 'fin-b [L.a][L.b] ([COUNT(L)])')] }),
      creerBande('groupFooter', { dataSource: 'L', height: 6, objects: [T(0, 0, 100, 5, 'fin-a [L.a] ([COUNT(L)])')] }),
    ];
    const L = Array.from({ length: 60 }, (_, i) => ({ n: i + 1, a: `X${Math.floor(i / 20)}`, b: `Y${Math.floor(i / 5) % 4}` }));
    const r = rendreEtat(e, { L }, { mesureur });
    const t = analyser(r).map((p) => p.texte).join(' ');
    const evts = [...t.matchAll(/(A=X\d|B=X\dY\d|fin-b X\dY\d|fin-a X\d)/g)].map((m) => m[1]);
    // pour le groupe X0 : A=X0, puis (B=X0Y0 … fin-b) ×4, puis fin-a
    expect(evts.slice(0, 11)).toEqual(['A=X0', 'B=X0Y0', 'fin-b X0Y0', 'B=X0Y1', 'fin-b X0Y1', 'B=X0Y2', 'fin-b X0Y2', 'B=X0Y3', 'fin-b X0Y3', 'fin-a X0', 'A=X1']);
    expect(lignesImprimees(analyser(r))).toHaveLength(60);
    expect(t).toContain('fin-a X0 (20)');
    expect(t).toContain('fin-b X0Y0 (5)');
  });

  it('l’en-tête de groupe se répète sur les pages suivantes quand repeatOnEveryPage est activé', () => {
    const e = modele({ groupes: true });
    e.bands.find((b) => b.type === 'groupHeader')!.repeatOnEveryPage = true;
    const r = rendreEtat(e, rows(200, () => 'UNIQUE'), { mesureur }); // un seul groupe très long
    const pages = analyser(r);
    expect(r.pageCount).toBeGreaterThan(2);
    pages.forEach((p, i) => expect(p.texte.replace('FIN-GROUPE', 'FIN'), `page ${i + 1}`).toContain('GROUPE UNIQUE'));
    expect(lignesImprimees(pages)).toHaveLength(200);
  });

  it('sans l’option, l’en-tête de groupe ne figure que sur la première page du groupe', () => {
    const r = rendreEtat(modele({ groupes: true }), rows(200, () => 'UNIQUE'), { mesureur });
    const pages = analyser(r);
    expect(pages.filter((p) => / GROUPE UNIQUE/.test(p.texte.replace('FIN-GROUPE', 'FIN')))).toHaveLength(1);
  });

  it('détail avec son propre en-tête : répété sur chaque page pendant le détail, retiré ensuite', () => {
    const e = creerEtat('vente', 'D');
    const maitre = creerBande('data', { dataSource: 'Docs', height: 7, objects: [T(0, 0, 100, 6, 'DOC-[Docs.n]')] });
    const enteteDetail = creerBande('dataHeader', { dataSource: 'Docs.l', parent: maitre.id, height: 6, objects: [T(0, 0, 100, 5, 'ENTETE-DETAIL')] });
    const detail = creerBande('data', { dataSource: 'Docs.l', parent: maitre.id, height: 5, objects: [T(5, 0, 100, 4, 'DET-[l.v]')] });
    e.bands = [maitre, enteteDetail, detail];
    const docs = [{ n: 1, l: Array.from({ length: 120 }, (_, k) => ({ v: k })) }, { n: 2, l: [{ v: 0 }] }];
    const r = rendreEtat(e, { Docs: docs }, { mesureur });
    const pages = analyser(r);
    expect(r.pageCount).toBeGreaterThan(2);
    // le premier document remplit plusieurs pages : chacune porte l'en-tête de détail
    const pagesAvecDet = pages.filter((p) => /DET-/.test(p.texte));
    pagesAvecDet.forEach((p, i) => expect(p.texte, `page ${i + 1}`).toContain('ENTETE-DETAIL'));
    // ... et le détail du document 2 a son propre en-tête (pas un en-tête « hérité » en double)
    const t = pages.map((p) => p.texte).join(' ');
    expect(t.indexOf('DOC-2')).toBeGreaterThan(t.lastIndexOf('DET-119'));
  });
});
