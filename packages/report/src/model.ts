/**
 * Modèle de fichier d'état (`.gcr`, JSON versionné) — équivalent d'un .fr3 de FastReport.
 *
 * Unités : millimètres partout (positions, tailles, marges), polices en points.
 * Un état = une page + des BANDES empilées ; chaque bande contient des OBJETS positionnés
 * en absolu. Les textes contiennent des expressions entre crochets : `Total : [Facture.total]`.
 */

export const GCR_FORMAT = 'gcr';
export const GCR_VERSION = 1;

// ─── Page ───────────────────────────────────────────────────────────────────

export type PageSizeName = 'A3' | 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal' | 'Ticket80' | 'Ticket58' | 'Etiquette' | 'Custom';

export const PAGE_SIZES: Record<Exclude<PageSizeName, 'Custom'>, { label: string; w: number; h: number }> = {
  A3: { label: 'A3 (297 × 420 mm)', w: 297, h: 420 },
  A4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  A5: { label: 'A5 (148 × 210 mm)', w: 148, h: 210 },
  A6: { label: 'A6 (105 × 148 mm)', w: 105, h: 148 },
  Letter: { label: 'Letter (216 × 279 mm)', w: 216, h: 279 },
  Legal: { label: 'Legal (216 × 356 mm)', w: 216, h: 356 },
  Ticket80: { label: 'Ticket 80 mm', w: 80, h: 200 },
  Ticket58: { label: 'Ticket 58 mm', w: 58, h: 160 },
  Etiquette: { label: 'Étiquette 50 × 30 mm', w: 50, h: 30 },
};

export type Marges = { top: number; right: number; bottom: number; left: number };

export type PageDef = {
  size: PageSizeName;
  /** Dimensions en portrait (mm) ; échangées si `orientation = landscape`. */
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  margins: Marges;
  /** Couleur de fond de toute la page (vide = blanc). */
  background?: string;
  /** Mode ticket : la hauteur de page s'ajuste au contenu (rouleau continu). */
  continuous?: boolean;
};

// ─── Styles et objets ───────────────────────────────────────────────────────

export type FontDef = {
  family: string;
  /** Taille en points. */
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
};

export type BorderDef = {
  top: boolean; right: boolean; bottom: boolean; left: boolean;
  color: string;
  /** Épaisseur en mm. */
  width: number;
  style: 'solid' | 'dashed' | 'dotted' | 'double';
  /** Rayon des coins en mm. */
  radius: number;
};

export type FormatKind = 'auto' | 'text' | 'number' | 'currency' | 'percent' | 'date' | 'time' | 'datetime' | 'boolean' | 'custom';

export type FormatDef = {
  kind: FormatKind;
  /** Motif (kind=custom, date, time, datetime, number) : `#,##0.00`, `dd/MM/yyyy HH:mm`. */
  pattern?: string;
  decimals?: number;
  thousands?: boolean;
  currency?: string;
  /** Texte affiché pour une valeur vide. */
  nullText?: string;
  /** Valeurs 0 masquées. */
  hideZeros?: boolean;
};

export type StyleDef = {
  name: string;
  font?: Partial<FontDef>;
  fill?: string;
  border?: Partial<BorderDef>;
  align?: 'left' | 'center' | 'right' | 'justify';
};

type ObjBase = {
  id: string;
  name: string;
  /** Position et taille dans la bande (mm). */
  x: number; y: number; w: number; h: number;
  /** Expression booléenne : l'objet n'est imprimé que si elle est vraie. */
  visible?: string;
  /** Style nommé appliqué avant les propriétés propres. */
  style?: string;
  fill?: string;
  border?: Partial<BorderDef>;
  locked?: boolean;
  /** Se décale vers le bas quand un objet au-dessus grandit. */
  shift?: boolean;
  /** Rotation (degrés, multiples de 90). */
  rotation?: 0 | 90 | 180 | 270;
};

export type TextObj = ObjBase & {
  type: 'text';
  text: string;
  font?: Partial<FontDef>;
  align?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'middle' | 'bottom';
  wordWrap?: boolean;
  /** La hauteur de l'objet (et de la bande) s'étend avec le texte. */
  canGrow?: boolean;
  canShrink?: boolean;
  padding?: number;
  lineHeight?: number;
  format?: FormatDef;
  /** N'imprime pas une valeur identique à la ligne précédente. */
  hideDuplicates?: boolean;
};

export type ImageObj = ObjBase & {
  type: 'image';
  /** URL ou data URI statique. */
  src?: string;
  /** Expression renvoyant une URL / data URI (prioritaire sur `src`). */
  expr?: string;
  fit?: 'contain' | 'cover' | 'stretch' | 'none';
  opacity?: number;
};

export type LineObj = ObjBase & {
  type: 'line';
  direction: 'h' | 'v' | 'diag' | 'antidiag';
  color?: string;
  lineWidth?: number;
  dash?: 'solid' | 'dashed' | 'dotted';
};

export type ShapeObj = ObjBase & {
  type: 'shape';
  shape: 'rect' | 'ellipse';
};

export type BarcodeSymbology = 'code128' | 'code39' | 'ean13';

export type BarcodeObj = ObjBase & {
  type: 'barcode';
  symbology: BarcodeSymbology;
  /** Texte avec expressions : `[Article.code_barre]`. */
  value: string;
  showText?: boolean;
  color?: string;
};

export type CheckboxObj = ObjBase & {
  type: 'checkbox';
  /** Expression booléenne : case cochée si vraie. */
  checked: string;
  color?: string;
};

export type ObjDef = TextObj | ImageObj | LineObj | ShapeObj | BarcodeObj | CheckboxObj;
export type ObjType = ObjDef['type'];

// ─── Bandes ─────────────────────────────────────────────────────────────────

export type BandType =
  | 'reportTitle' | 'pageHeader' | 'dataHeader' | 'groupHeader' | 'data'
  | 'groupFooter' | 'dataFooter' | 'reportSummary' | 'pageFooter' | 'overlay';

export const BAND_LABELS: Record<BandType, string> = {
  reportTitle: 'Titre du rapport',
  pageHeader: 'En-tête de page',
  dataHeader: 'En-tête de données',
  groupHeader: 'En-tête de groupe',
  data: 'Données',
  groupFooter: 'Pied de groupe',
  dataFooter: 'Pied de données',
  reportSummary: 'Synthèse du rapport',
  pageFooter: 'Pied de page',
  overlay: 'Filigrane (arrière-plan)',
};

export type SortDef = { expr: string; dir: 'asc' | 'desc' };

export type BandDef = {
  id: string;
  type: BandType;
  name: string;
  /** Hauteur (mm). */
  height: number;
  objects: ObjDef[];
  /** Jeu de données (data / en-têtes / pieds) : nom de dataset ou chemin `Facture.lignes`. */
  dataSource?: string;
  /** Bande de détail : id de la bande maître dont elle est un enfant. */
  parent?: string;
  /** Tri (data). */
  sort?: SortDef[];
  /** Filtre (data) : expression booléenne évaluée par ligne. */
  filter?: string;
  /** Expression de regroupement (groupHeader). */
  groupBy?: string;
  /** Expression de visibilité. */
  visible?: string;
  /** Colonnes de données (étiquettes) : nombre de cellules par ligne. */
  columns?: number;
  columnGap?: number;
  startNewPage?: boolean;
  newPageAfter?: boolean;
  /** Impression d'en-tête/pied selon la page. */
  printOnFirstPage?: boolean;
  printOnLastPage?: boolean;
  /** Reste solidaire de la ligne suivante (en-têtes) / précédente (pieds). */
  keepWithData?: boolean;
  /** La bande s'étend avec ses textes `canGrow`. */
  canGrow?: boolean;
  /** Ligne alternée (data) : couleur de fond des lignes paires. */
  zebra?: string;
  /** Imprimer la bande même sans donnée. */
  printIfEmpty?: boolean;
  /** Remet le compteur de pages à 1 avant cette bande. */
  resetPageNumber?: boolean;
  /** En-têtes : se répète en haut de chaque page tant que la section continue (dataHeader : oui par défaut). */
  repeatOnEveryPage?: boolean;
};

// ─── Paramètres, variables, données ─────────────────────────────────────────

export type ParamType = 'text' | 'number' | 'date' | 'boolean';
export type ParamDef = { name: string; label?: string; type: ParamType; default?: string };
export type VarDef = { name: string; expr: string };

export type ReportDef = {
  format: typeof GCR_FORMAT;
  version: number;
  id: string;
  name: string;
  /** Type de document traité (`facture`, `commande`, `etiquettes`…) — voir registre.ts. */
  kind: string;
  description?: string;
  author?: string;
  created: string;
  modified: string;
  page: PageDef;
  styles: StyleDef[];
  parameters: ParamDef[];
  variables: VarDef[];
  bands: BandDef[];
};

// ─── Données ────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'image' | 'list';
export type FieldDef = { name: string; label?: string; type: FieldType; children?: FieldDef[] };
export type DatasetDef = {
  name: string;
  label: string;
  /** `single` = une seule ligne (en-tête de document) ; `list` = plusieurs lignes. */
  mode: 'single' | 'list';
  fields: FieldDef[];
};

export type ReportData = Record<string, unknown>;

// ─── Constantes de conception ───────────────────────────────────────────────

export const DEFAULT_FONT: FontDef = {
  family: 'Arial', size: 9, bold: false, italic: false, underline: false, strike: false, color: '#000000',
};

export const DEFAULT_BORDER: BorderDef = {
  top: false, right: false, bottom: false, left: false, color: '#000000', width: 0.2, style: 'solid', radius: 0,
};

export const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Tahoma', 'Verdana', 'Segoe UI', 'Calibri', 'Times New Roman', 'Georgia',
  'Courier New', 'Consolas', 'Plus Jakarta Sans', 'JetBrains Mono',
];

// ─── Fabriques ──────────────────────────────────────────────────────────────

let compteur = 0;
export function nouvelId(prefix = 'o'): string {
  compteur += 1;
  return `${prefix}${Date.now().toString(36)}${compteur.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function dimensionsPage(p: PageDef): { w: number; h: number } {
  return p.orientation === 'landscape' ? { w: p.height, h: p.width } : { w: p.width, h: p.height };
}

export function creerPage(size: PageSizeName = 'A4', orientation: 'portrait' | 'landscape' = 'portrait'): PageDef {
  const s = size === 'Custom' ? PAGE_SIZES.A4 : PAGE_SIZES[size];
  const ticket = size === 'Ticket80' || size === 'Ticket58' || size === 'Etiquette';
  const m = ticket ? 3 : 10;
  return {
    size, width: s.w, height: s.h, orientation,
    margins: { top: m, right: m, bottom: m, left: m },
    continuous: size === 'Ticket80' || size === 'Ticket58',
  };
}

export function creerEtat(kind = 'document', name = 'Nouvel état'): ReportDef {
  const now = new Date().toISOString();
  return {
    format: GCR_FORMAT, version: GCR_VERSION, id: nouvelId('r'), name, kind,
    created: now, modified: now,
    page: creerPage('A4'),
    styles: [
      { name: 'Titre', font: { size: 16, bold: true }, align: 'left' },
      { name: 'Entête de colonne', font: { bold: true, size: 8.5 }, fill: '#EEF2F9', border: { bottom: true, color: '#9AA7BD' } },
      { name: 'Total', font: { bold: true }, align: 'right' },
    ],
    parameters: [], variables: [], bands: [],
  };
}

export function creerBande(type: BandType, over: Partial<BandDef> = {}): BandDef {
  const hauteurs: Record<BandType, number> = {
    reportTitle: 24, pageHeader: 16, dataHeader: 8, groupHeader: 8, data: 7,
    groupFooter: 8, dataFooter: 8, reportSummary: 20, pageFooter: 10, overlay: 100,
  };
  return { id: nouvelId('b'), type, name: BAND_LABELS[type], height: hauteurs[type], objects: [], ...over };
}

export function creerObjet(type: ObjType, x: number, y: number, over: Partial<ObjDef> = {}): ObjDef {
  const base = { id: nouvelId('o'), x, y, locked: false };
  switch (type) {
    case 'text':
      return { ...base, type, name: 'Texte', w: 40, h: 6, text: 'Texte', wordWrap: true, ...over } as TextObj;
    case 'image':
      return { ...base, type, name: 'Image', w: 30, h: 20, fit: 'contain', ...over } as ImageObj;
    case 'line':
      return { ...base, type, name: 'Ligne', w: 60, h: 0.5, direction: 'h', color: '#000000', lineWidth: 0.3, ...over } as LineObj;
    case 'shape':
      return { ...base, type, name: 'Forme', w: 30, h: 15, shape: 'rect', border: { top: true, right: true, bottom: true, left: true, width: 0.3, color: '#000000' }, ...over } as ShapeObj;
    case 'barcode':
      return { ...base, type, name: 'Code-barres', w: 45, h: 14, symbology: 'code128', value: '123456789', showText: true, ...over } as BarcodeObj;
    case 'checkbox':
      return { ...base, type, name: 'Case', w: 5, h: 5, checked: 'false', ...over } as CheckboxObj;
  }
}

// ─── Normalisation / validation d'un fichier lu ─────────────────────────────

export class FichierEtatInvalide extends Error {}

/** Valide et complète un objet JSON lu depuis un fichier `.gcr`. */
export function normaliserEtat(brut: unknown): ReportDef {
  if (!brut || typeof brut !== 'object') throw new FichierEtatInvalide('Fichier vide ou illisible.');
  const r = brut as Partial<ReportDef>;
  if (r.format !== GCR_FORMAT) throw new FichierEtatInvalide('Ce fichier n’est pas un modèle d’état (.gcr).');
  if (typeof r.version !== 'number' || r.version > GCR_VERSION)
    throw new FichierEtatInvalide(`Version de modèle non prise en charge (${String(r.version)}).`);
  const base = creerEtat(r.kind ?? 'document', r.name ?? 'Sans titre');
  const bandes = Array.isArray(r.bands) ? r.bands : [];
  return {
    ...base,
    ...r,
    page: { ...base.page, ...(r.page ?? {}), margins: { ...base.page.margins, ...(r.page?.margins ?? {}) } },
    styles: Array.isArray(r.styles) ? r.styles : base.styles,
    parameters: Array.isArray(r.parameters) ? r.parameters : [],
    variables: Array.isArray(r.variables) ? r.variables : [],
    bands: bandes.map((b) => ({ ...b, id: b.id || nouvelId('b'), objects: (Array.isArray(b.objects) ? b.objects : []).map((o) => ({ ...o, id: o.id || nouvelId('o') })) })),
  } as ReportDef;
}

export function cloner<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
