import { creerBande, creerEtat, creerObjet, creerPage, type ObjDef, type ReportDef } from '@softly/report';
import { THEMES, T, type Ctx } from './kit';

/** Étiquettes de rayon (prix + code-barres) sur planche A4 : cellules répétées en colonnes. */

const th = THEMES.moderne;
const ctx = (cw: number): Ctx => ({ th, cw });

function planche(nom: string, description: string, o: { colonnes: number; w: number; h: number; gap: number; marge: number; grand: boolean }): ReportDef {
  const e = creerEtat('articles', nom);
  e.description = description;
  e.page = { ...creerPage('A4'), margins: { top: o.marge, right: o.marge, bottom: o.marge, left: o.marge } };
  const c = ctx(o.w);
  const k = o.grand ? 1 : 0.78;
  const hCode = o.h * 0.3; // hauteur du code-barres
  const yCode = o.h - hCode - 1.2;
  const cellule: ObjDef[] = [
    creerObjet('shape', 0, 0, { w: o.w, h: o.h, shape: 'rect', name: 'Cadre', border: { top: true, right: true, bottom: true, left: true, color: '#B7C1D4', width: 0.2, style: 'dashed', radius: 1.2 } }),
    creerObjet('shape', 0, 0, { w: o.w, h: 2.2 * k, shape: 'rect', fill: th.accent, name: 'Bandeau', border: { top: false, right: false, bottom: false, left: false, color: th.accent, width: 0.1, radius: 1.2 } }),
    T(c, 2, 3.2 * k, o.w - 4, 7.5 * k, '[Articles.designation]', { size: 9 * k, bold: true, valign: 'top', canGrow: false, lineHeight: 1.15 }),
    T(c, 2, 10.6 * k, o.w - 4, 3.4 * k, '[Articles.famille]', { size: 7 * k, color: th.muted }),
    T(c, 2, yCode - 10.5 * k, o.w - 4, 9.5 * k, "[FORMAT(Articles.prix_vente_ttc, '#,##0.00')] DA", { size: 17 * k, bold: true, color: th.accent, align: 'right', valign: 'middle', family: 'Consolas' }),
    creerObjet('barcode', 3, yCode, { w: o.w - 6, h: hCode, symbology: 'code128', value: '[Articles.code_bare]', showText: true, name: 'Code-barres' }),
  ];
  e.bands = [creerBande('data', { name: 'Étiquette', dataSource: 'Articles', height: o.h, columns: o.colonnes, columnGap: o.gap, objects: cellule, filter: 'NOT ISEMPTY(Articles.code_bare)' })];
  return e;
}

export const MODELES_ETIQUETTES: { id: string; build: () => ReportDef }[] = [
  { id: 'integre-etiquettes-prix', build: () => planche('Étiquettes de prix — 3 colonnes', 'Étiquettes de rayon (désignation, famille, prix TTC, code-barres), 3 par ligne sur A4.', { colonnes: 3, w: 61, h: 36, gap: 5.5, marge: 8, grand: true }) },
  { id: 'integre-etiquettes-prix-2', build: () => planche('Étiquettes de prix — 2 colonnes (grand format)', 'Grandes étiquettes de gondole, 2 par ligne sur A4.', { colonnes: 2, w: 92, h: 50, gap: 6, marge: 8, grand: true }) },
  { id: 'integre-etiquettes-prix-4', build: () => planche('Étiquettes de prix — 4 colonnes (compact)', 'Petites étiquettes, 4 par ligne sur A4.', { colonnes: 4, w: 45, h: 28, gap: 4, marge: 8, grand: false }) },
];
