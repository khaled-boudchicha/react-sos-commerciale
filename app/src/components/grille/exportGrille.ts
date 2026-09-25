import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { exporterCsv } from '../../lib/export';
import { PrintDocument } from '../../print/engine/types';
import { BASE_CSS } from '../../print/templates/partials';
import { calculerResume, LIBELLES_RESUME, NoeudGroupe, texteDe, valeurDe } from './moteur';
import { ColonneGrille, Resume } from './types';

/**
 * Exports de la grille : exactement ce que l'utilisateur voit (colonnes visibles
 * dans leur ordre, lignes filtrées et triées, groupes), pas les données brutes.
 */

const nomFichier = (nom: string, ext: string) => `${nom}-${new Date().toISOString().slice(0, 10)}.${ext}`;

export function exporterGrilleCsv<T>(nom: string, colonnes: ColonneGrille<T>[], lignes: T[]) {
  exporterCsv(nom, colonnes.map((c) => ({
    header: c.titre ?? c.champ,
    numeric: c.type === 'number' || c.type === 'money',
    value: (l: T) => {
      const v = valeurDe(c, l);
      return c.type === 'number' || c.type === 'money' ? (v as number | null) : texteDe(c, v);
    },
  })), lignes);
}

/**
 * Excel (.xlsx) : nombres et dates typés (pas du texte), en-tête figé et filtré,
 * groupes en lignes de niveau (plan Excel repliable), ligne de totaux.
 * exceljs est chargé à la demande (bundle principal inchangé).
 */
export async function exporterGrilleExcel<T>(
  nom: string, colonnes: ColonneGrille<T>[], lignes: T[],
  options: { groupes?: NoeudGroupe<T>[]; resumes?: Resume<T>[]; titre?: string } = {},
) {
  const ExcelJS = (await import('exceljs')).default;
  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'Gestion Commerciale';
  const feuille = classeur.addWorksheet(nom.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { outlineLevelRow: options.groupes?.length ? 3 : 0 },
  });
  feuille.columns = colonnes.map((c) => ({
    header: c.titre ?? c.champ,
    key: c.champ,
    width: Math.max(10, Math.round((c.largeur ?? 140) / 7)),
    style: c.type === 'money' ? { numFmt: '#,##0.00' } : c.type === 'number' ? { numFmt: '#,##0.###' } : c.type === 'date' ? { numFmt: 'dd/mm/yyyy' } : {},
  }));
  const entete = feuille.getRow(1);
  entete.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

  const valeurExcel = (c: ColonneGrille<T>, l: T) => {
    const v = valeurDe(c, l);
    if (v === null || v === undefined || v === '') return null;
    if (c.type === 'number' || c.type === 'money') { const n = Number(v); return Number.isFinite(n) ? n : null; }
    if (c.type === 'date') { const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d; }
    if (c.type === 'boolean') return v ? 'Oui' : 'Non';
    return texteDe(c, v);
  };
  const ajouterLignes = (liste: T[], niveau: number) => {
    for (const l of liste) {
      const r = feuille.addRow(colonnes.map((c) => valeurExcel(c, l)));
      if (niveau) r.outlineLevel = niveau;
    }
  };
  const ajouterGroupes = (noeuds: NoeudGroupe<T>[]) => {
    for (const n of noeuds) {
      const col = colonnes.find((c) => c.champ === n.champ);
      const r = feuille.addRow([`${col?.titre ?? n.champ} : ${n.texte} (${n.lignes.length})`]);
      r.font = { bold: true };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FB' } };
      if (n.niveau) r.outlineLevel = n.niveau;
      if (n.enfants) ajouterGroupes(n.enfants);
      else ajouterLignes(n.lignes, n.niveau + 1);
    }
  };
  if (options.groupes?.length) ajouterGroupes(options.groupes); else ajouterLignes(lignes, 0);

  if (options.resumes?.length) {
    const r = feuille.addRow(colonnes.map((c) => {
      const res = options.resumes!.find((x) => (x.afficherDans ?? x.colonne) === c.champ);
      return res ? calculerResume(res, lignes, colonnes) : null;
    }));
    r.font = { bold: true };
    r.border = { top: { style: 'thin' } };
  }
  feuille.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonnes.length } };

  const tampon = await classeur.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([tampon], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier(nom, 'xlsx');
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF : document paginé (moteur d'impression Paged.js), paysage au-delà de 6 colonnes. */
export function documentPdfGrille<T>(
  titre: string, colonnes: ColonneGrille<T>[], lignes: T[], resumes?: Resume<T>[],
): PrintDocument {
  const num = (c: ColonneGrille<T>) => c.type === 'number' || c.type === 'money';
  const corps = h('div', null,
    h('div', { style: { fontSize: 16, fontWeight: 800, marginBottom: 4 } }, titre),
    h('div', { style: { fontSize: 10, color: '#6B7A90', marginBottom: 10 } }, `${lignes.length} ligne(s) — ${new Date().toLocaleDateString('fr-DZ')}`),
    h('table', { className: 'lines' },
      h('thead', null, h('tr', null, colonnes.map((c) => h('th', { key: c.champ, className: num(c) ? 'r' : undefined }, c.titre ?? c.champ)))),
      h('tbody', null,
        lignes.map((l, i) => h('tr', { key: i }, colonnes.map((c) =>
          h('td', { key: c.champ, className: num(c) ? 'mono r' : undefined }, texteDe(c, valeurDe(c, l)))))),
        resumes?.length ? h('tr', { style: { fontWeight: 800 } }, colonnes.map((c) => {
          const r = resumes.find((x) => (x.afficherDans ?? x.colonne) === c.champ);
          const v = r ? calculerResume(r, lignes, colonnes) : null;
          return h('td', { key: c.champ, className: num(c) ? 'mono r' : undefined },
            v === null ? '' : `${r?.libelle ?? LIBELLES_RESUME[r!.type]} ${typeof v === 'number' ? texteDe(c, v) : v}`);
        })) : null,
      ),
    ),
  );
  return {
    title: titre,
    html: renderToStaticMarkup(corps),
    css: colonnes.length > 6 ? `${BASE_CSS}\n@page { size: A4 landscape; }` : BASE_CSS,
  };
}
