import {
  type BandDef, type DatasetDef, type FieldDef, type ObjDef, type ReportDef, type TextObj,
  creerBande, creerEtat, creerObjet, dimensionsPage,
} from './model';
import type { KindDef } from './registre';

/**
 * Modèle « standard » d'un type de document : point de départ professionnel au lieu d'une page vide.
 * - Titre : coordonnées de la société (si le type en a), titre du modèle, date d'impression ;
 * - Tableau : en-têtes de colonnes, lignes du premier jeu « liste » (désignation en colonne large, nombres alignés
 *   à droite et formatés, dates au format court), lignes alternées, nombre de lignes et total du premier montant ;
 * - Sans liste : les champs du document principal en « libellé : valeur » ;
 * - Pied de page : date d'impression et « Page n / N ».
 * Toutes les expressions sont construites à partir des champs déclarés : le modèle est valide d'emblée.
 */

const ENCRE = '#0F1A2E', DISCRET = '#5B6A86', MARQUE = '#2450E0', FILET = '#C9D2E3';
const MAX_COLONNES = 7;

const T = (x: number, y: number, w: number, h: number, text: string, o: Partial<TextObj> = {}): TextObj =>
  creerObjet('text', x, y, { w, h, text, name: o.name ?? 'Texte', ...o }) as TextObj;

const arrondir = (n: number) => Math.round(n * 10) / 10;
const libelle = (f: FieldDef) => f.label ?? f.name;
const estSociete = (d: DatasetDef) => /soci[ée]t[ée]|company|entreprise/i.test(`${d.name} ${d.label}`);
const champ = (ds: DatasetDef, nom: RegExp) => ds.fields.find((f) => nom.test(f.name) && f.type !== 'list' && f.type !== 'image');

const QUANTITE = /qte|quantit|^nb|nombre|colis|count/i;
const POURCENT = /%|taux|_p$|pourcent/i;
const MONTANT = /total|montant|net|valeur|solde|amount/i;
const LIBELLE = /designation|d[ée]signation|libell|description|intitul|raison|^nom$|name/i;

/** Champ affiché : expression + format selon le type (quantités et pourcentages sans décimales inutiles). */
function valeur(ds: string, f: FieldDef): Pick<TextObj, 'text' | 'format' | 'align'> {
  if (f.type === 'number') {
    const motif = QUANTITE.test(f.name) || POURCENT.test(`${f.name} ${f.label ?? ''}`) ? '#,##0.##' : '#,##0.00';
    return { text: `[${ds}.${f.name}]`, format: { kind: 'number', pattern: motif }, align: 'right' };
  }
  if (f.type === 'date') return { text: `[${ds}.${f.name}]`, format: { kind: 'date', pattern: 'dd/MM/yyyy' }, align: 'left' };
  if (f.type === 'boolean') return { text: `[${ds}.${f.name}]`, format: { kind: 'boolean' }, align: 'center' };
  return { text: `[${ds}.${f.name}]`, align: 'left' };
}

export function creerEtatStandard(kind: KindDef, nom = 'Nouvel état'): ReportDef {
  const e = creerEtat(kind.id, nom);
  e.description = 'Modèle standard : en-tête, tableau des lignes, total et pied de page numéroté.';
  const { w } = dimensionsPage(e.page);
  const L = w - e.page.margins.left - e.page.margins.right;
  const bandes: BandDef[] = [];

  const societe = kind.datasets.find((d) => d.mode === 'single' && estSociete(d));
  const liste = kind.datasets.find((d) => d.mode === 'list');
  const principal = kind.datasets.find((d) => d.mode === 'single' && d !== societe);

  // ── Titre du rapport ──────────────────────────────────────────────────────
  const titre: ObjDef[] = [];
  let yTitre = 0;
  if (societe) {
    const raison = champ(societe, /raison|^nom$|name|societe/i) ?? societe.fields.find((f) => f.type === 'text');
    const adresse = champ(societe, /adresse|address/i);
    const tel = champ(societe, /t[ée]l[ée]phone|^tel$|phone/i);
    if (raison) titre.push(T(0, 0, L * 0.58, 6.5, `[UPPER(${societe.name}.${raison.name})]`, { name: 'Société', font: { size: 13, bold: true, color: ENCRE } }));
    if (adresse) titre.push(T(0, 7, L * 0.58, 4.5, `[${societe.name}.${adresse.name}]`, { name: 'Adresse société', font: { size: 8.5, color: DISCRET } }));
    if (tel) titre.push(T(0, 11.5, L * 0.58, 4.5, `Tél : [${societe.name}.${tel.name}]`, { name: 'Téléphone société', font: { size: 8.5, color: DISCRET } }));
  }
  titre.push(T(L * 0.6, 0, L * 0.4, 8, nom.toUpperCase(), { name: 'Titre', align: 'right', font: { size: 16, bold: true, color: MARQUE } }));
  titre.push(T(L * 0.6, 9, L * 0.4, 4.5, "Édité le [FORMAT(TODAY(), 'dd/MM/yyyy')]", { name: 'Date d’édition', align: 'right', font: { size: 8.5, color: DISCRET } }));
  yTitre = 18;
  titre.push(creerObjet('line', 0, yTitre, { w: L, h: 0.5, direction: 'h', color: MARQUE, lineWidth: 0.5, name: 'Filet' }));
  bandes.push(creerBande('reportTitle', { name: 'En-tête du document', height: yTitre + 4, objects: titre }));

  if (liste) {
    // ── Tableau ─────────────────────────────────────────────────────────────
    const candidats = liste.fields.filter((f) => f.type !== 'list' && f.type !== 'image');
    // Montant à totaliser : premier champ numérique « total / montant / net… » (pas une quantité ni un %)
    const montant = candidats.find((f) => f.type === 'number' && MONTANT.test(f.name) && !POURCENT.test(`${f.name} ${f.label ?? ''}`));
    let colonnes = candidats.slice(0, MAX_COLONNES);
    if (montant && !colonnes.includes(montant)) colonnes = [...colonnes.slice(0, MAX_COLONNES - 1), montant];
    // Colonne large : la désignation / le libellé, sinon le premier texte
    const large = colonnes.find((f) => f.type === 'text' && LIBELLE.test(f.name)) ?? colonnes.find((f) => f.type === 'text');
    const poids = (f: FieldDef) => (f === large ? 2.8 : f.type === 'number' ? 1 : f.type === 'date' ? 1.1 : f.type === 'boolean' ? 0.7 : 1.2);
    const total = colonnes.reduce((s, f) => s + poids(f), 0);
    let x = 0;
    const entetes: ObjDef[] = [], cellules: ObjDef[] = [];
    colonnes.forEach((f, i) => {
      const cw = i === colonnes.length - 1 ? arrondir(L - x) : arrondir((L * poids(f)) / total);
      const v = valeur(liste.name, f);
      entetes.push(T(x, 0, cw, 7, libelle(f).toUpperCase(), { name: `En-tête ${libelle(f)}`, style: 'Entête de colonne', align: v.align, valign: 'middle', padding: 1 }));
      cellules.push(T(x, 0, cw, 6, v.text, { name: libelle(f), format: v.format, align: v.align, valign: 'middle', padding: 1, canGrow: f === large }));
      x = arrondir(x + cw);
    });
    bandes.push(creerBande('dataHeader', { name: 'En-tête du tableau', height: 7, dataSource: liste.name, objects: entetes }));
    bandes.push(creerBande('data', { name: liste.label || liste.name, height: 6, dataSource: liste.name, zebra: '#F5F7FB', objects: cellules }));

    const pied: ObjDef[] = [creerObjet('line', 0, 0, { w: L, h: 0.5, direction: 'h', color: FILET, lineWidth: 0.3, name: 'Filet' })];
    pied.push(T(0, 1.5, L * 0.5, 6, `[COUNT(${liste.name})] ligne(s)`, { name: 'Nombre de lignes', font: { size: 8.5, color: DISCRET }, valign: 'middle' }));
    if (montant) {
      const titreTotal = /^total/i.test(libelle(montant)) ? libelle(montant) : `Total ${libelle(montant).toLowerCase()}`;
      pied.push(T(L * 0.5, 1.5, L * 0.5, 6, `${titreTotal} : [FORMAT(SUM(${liste.name}.${montant.name}), '#,##0.00')]`, { name: 'Total', style: 'Total', valign: 'middle' }));
    }
    bandes.push(creerBande('dataFooter', { name: 'Pied du tableau', height: 9, dataSource: liste.name, objects: pied }));
  } else if (principal) {
    // ── Document sans liste : champs en « libellé : valeur » ────────────────
    const champs = principal.fields.filter((f) => f.type !== 'list' && f.type !== 'image').slice(0, 12);
    const objs: ObjDef[] = [];
    champs.forEach((f, i) => {
      const y = i * 6;
      objs.push(T(0, y, 45, 5.5, libelle(f), { name: `Libellé ${libelle(f)}`, font: { size: 9, color: DISCRET } }));
      const v = valeur(principal.name, f);
      objs.push(T(47, y, L - 47, 5.5, v.text, { name: libelle(f), format: v.format, font: { size: 9.5, bold: true } }));
    });
    bandes.push(creerBande('reportSummary', { name: principal.label || principal.name, height: Math.max(10, champs.length * 6 + 2), objects: objs }));
  }

  // ── Pied de page ──────────────────────────────────────────────────────────
  bandes.push(creerBande('pageFooter', {
    name: 'Pied de page', height: 8, objects: [
      creerObjet('line', 0, 0.5, { w: L, h: 0.5, direction: 'h', color: FILET, lineWidth: 0.3, name: 'Filet' }),
      T(0, 2, L * 0.6, 4.5, "Imprimé le [FORMAT(NOW(), 'dd/MM/yyyy HH:mm')]", { name: 'Date d’impression', font: { size: 7.5, color: DISCRET } }),
      T(L * 0.6, 2, L * 0.4, 4.5, 'Page [Page] / [TotalPages]', { name: 'Numéro de page', align: 'right', font: { size: 7.5, color: DISCRET } }),
    ],
  }));

  e.bands = bandes;
  return e;
}
