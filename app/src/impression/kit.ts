import {
  creerBande, creerEtat, creerObjet, creerPage,
  type BandDef, type FontDef, type FormatDef, type HighlightRule, type ObjDef, type ReportDef, type TextObj,
} from '@softly/report';

/**
 * Kit de design des modèles livrés : thèmes, blocs (en-tête, cartes de synthèse, tiers, totaux, signatures),
 * tableaux pilotés par une spécification de colonnes et pied de page. Les modèles ne positionnent plus rien
 * « à la main » : ils assemblent des blocs, ce qui garantit une mise en page cohérente (marges, gouttières,
 * hiérarchie typographique) d'un document à l'autre.
 */

// ─── Thèmes ─────────────────────────────────────────────────────────────────

export type ThemeId = 'moderne' | 'classique' | 'prestige';

export type Theme = {
  id: ThemeId;
  nom: string;
  font: string;
  titleFont: string;
  /** Couleur d'accent (filets, titre, ligne finale des totaux). */
  accent: string;
  /** Texte posé sur une surface d'accent. */
  surAccent: string;
  /** Second accent (liseré). */
  accent2: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  zebra: string;
  /** En-tête de tableau : fond (undefined = simple filet) et texte. */
  headFill?: string;
  headInk: string;
  danger: string;
  ok: string;
  warn: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  moderne: {
    id: 'moderne', nom: 'Moderne', font: 'Segoe UI', titleFont: 'Segoe UI', accent: '#2450E0', surAccent: '#FFFFFF', accent2: '#2450E0',
    ink: '#0F1A2E', muted: '#5B6A86', line: '#D5DDEC', soft: '#EEF3FE', zebra: '#F6F8FD', headFill: '#2450E0', headInk: '#FFFFFF',
    danger: '#DC2626', ok: '#15803D', warn: '#B45309',
  },
  classique: {
    id: 'classique', nom: 'Classique', font: 'Segoe UI', titleFont: 'Georgia', accent: '#111827', surAccent: '#FFFFFF', accent2: '#111827',
    ink: '#111827', muted: '#4B5563', line: '#CBD0D8', soft: '#F3F4F6', zebra: '#FAFAFA', headFill: undefined, headInk: '#111827',
    danger: '#B91C1C', ok: '#166534', warn: '#92400E',
  },
  prestige: {
    id: 'prestige', nom: 'Prestige', font: 'Segoe UI', titleFont: 'Georgia', accent: '#0B2545', surAccent: '#FFFFFF', accent2: '#B8912F',
    ink: '#0B1320', muted: '#5A667A', line: '#D8DEE9', soft: '#EEF1F6', zebra: '#F7F8FB', headFill: '#0B2545', headInk: '#FFFFFF',
    danger: '#B91C1C', ok: '#166534', warn: '#92400E',
  },
};

// ─── Formats et fabriques ───────────────────────────────────────────────────

export const FMT: Record<string, FormatDef> = {
  money: { kind: 'number', pattern: '#,##0.00' },
  qty: { kind: 'number', pattern: '#,##0.###' },
  int: { kind: 'number', pattern: '#,##0' },
  pct: { kind: 'number', pattern: '#,##0.##' },
};

export type Ctx = { th: Theme; cw: number };

/** Valeur formatée à l'intérieur d'un texte composé (le `format` d'un objet ne s'applique qu'à un texte réduit à une seule expression). */
export const fmtExpr = (expr: string, f: keyof typeof FMT = 'money') => `FORMAT(${expr}, '${FMT[f].pattern}')`;
export type Bloc = { objs: ObjDef[]; h: number };

const font = (th: Theme, size: number, bold = false, color?: string, family?: string): Partial<FontDef> => ({
  family: family ?? th.font, size, bold, color: color ?? th.ink,
});

export type TOpts = Partial<TextObj> & { size?: number; bold?: boolean; color?: string; family?: string };

/** Objet texte avec la typographie du thème. */
export function T(ctx: Ctx, x: number, y: number, w: number, h: number, text: string, o: TOpts = {}): TextObj {
  const { size = 9, bold = false, color, family, ...reste } = o;
  return creerObjet('text', x, y, { w, h, text, padding: 0.3, font: font(ctx.th, size, bold, color, family), ...reste }) as TextObj;
}

const rect = (x: number, y: number, w: number, h: number, o: Partial<ObjDef> = {}) => creerObjet('shape', x, y, { w, h, shape: 'rect', ...o } as Partial<ObjDef>);
const trait = (x: number, y: number, w: number, color: string, lw = 0.3) => creerObjet('line', x, y, { w, h: 0.3, direction: 'h', color, lineWidth: lw });

export const decaler = (objs: ObjDef[], dy: number): ObjDef[] => objs.map((o) => ({ ...o, y: o.y + dy }));

/** Empile des blocs verticalement dans une seule bande. */
export function empiler(blocs: Bloc[], ecart = 0): { objs: ObjDef[]; h: number } {
  let y = 0;
  const objs: ObjDef[] = [];
  blocs.forEach((b, i) => { objs.push(...decaler(b.objs, y)); y += b.h + (i < blocs.length - 1 ? ecart : 0); });
  return { objs, h: y };
}

export const bandeDe = (type: Parameters<typeof creerBande>[0], nom: string, b: { objs: ObjDef[]; h: number }, plus: Partial<BandDef> = {}): BandDef =>
  creerBande(type, { name: nom, height: Math.max(b.h, 1), objects: b.objs, ...plus });

const sansLogo = 'ISEMPTY(Societe.logo)';
const avecLogo = 'NOT ISEMPTY(Societe.logo)';

// ─── En-tête de document ────────────────────────────────────────────────────

export type EnteteOpts = {
  /** Texte du titre (expressions entre crochets). */
  titre: string;
  /** Référence sous le titre : `N° [Vente.numero]`. */
  reference?: string;
  /** Ligne de date / période, sous la référence. */
  date?: string;
  /** Afficher RC / NIF / NIS / Art. sous les coordonnées. */
  fiscal?: boolean;
  /** Réduit la taille (ticket A5). */
  compact?: boolean;
};

/** Bloc société (gauche) + titre du document (droite), selon le thème. */
export function blocEntete(ctx: Ctx, o: EnteteOpts): Bloc {
  const { th, cw } = ctx;
  const k = o.compact ? 0.88 : 1;
  const sombre = th.id === 'prestige';
  const hBloc = (o.fiscal ? 33 : 25) * k;
  const objs: ObjDef[] = [];
  const nom = sombre ? '#FFFFFF' : th.ink;
  const sec = sombre ? '#C9D3E6' : th.muted;
  const px = sombre ? 4 : 0; // retrait intérieur du bandeau Prestige
  const wTitre = cw * 0.42;

  if (sombre) objs.push(rect(0, 0, cw, hBloc, { fill: th.accent, name: 'Bandeau' }));
  objs.push(creerObjet('image', px, (sombre ? 3 : 0), { w: 20 * k, h: 18 * k, expr: 'Societe.logo', fit: 'contain', visible: avecLogo, name: 'Logo' }));
  for (const [dx, vis] of [[22 * k, avecLogo], [0, sansLogo]] as const) {
    const x = px + dx, w = cw - wTitre - x - px;
    const y0 = sombre ? 3 : 0;
    objs.push(T(ctx, x, y0, w, 7 * k, '[UPPER(Societe.raison_sociale)]', { size: 14 * k, bold: true, color: nom, family: th.titleFont, visible: vis, canGrow: true, name: 'Raison sociale' }));
    objs.push(T(ctx, x, y0 + 7.4 * k, w, 4 * k, '[Societe.adresse]', { size: 8.5 * k, color: sec, visible: vis, name: 'Adresse' }));
    objs.push(T(ctx, x, y0 + 11.4 * k, w, 4 * k, "[IIF(Societe.telephone, 'Tél : ' & Societe.telephone, '')][IIF(Societe.fax, '   Fax : ' & Societe.fax, '')]", { size: 8.5 * k, color: sec, visible: vis, name: 'Téléphone' }));
    objs.push(T(ctx, x, y0 + 15.4 * k, w, 4 * k, "[IIF(Societe.email, Societe.email, '')][IIF(Societe.site_web, '   ' & Societe.site_web, '')]", { size: 8.5 * k, color: sec, visible: vis, name: 'Contact' }));
    if (o.fiscal) {
      objs.push(T(ctx, x, y0 + 19.6 * k, w, 3.6 * k, "[IIF(Societe.rc, 'RC : ' & Societe.rc & '    ', '')][IIF(Societe.nif, 'NIF : ' & Societe.nif, '')]", { size: 7.5 * k, color: sec, visible: vis, name: 'RC / NIF' }));
      objs.push(T(ctx, x, y0 + 23.2 * k, w, 3.6 * k, "[IIF(Societe.nis, 'NIS : ' & Societe.nis & '    ', '')][IIF(Societe.art, 'Art : ' & Societe.art, '')]", { size: 7.5 * k, color: sec, visible: vis, name: 'NIS / Art' }));
    }
  }
  // Titre du document (droite)
  const xt = cw - wTitre - px;
  const couleurTitre = sombre ? th.accent2 : th.accent;
  objs.push(T(ctx, xt, sombre ? 4 : 0, wTitre, 9 * k, o.titre, { size: 18 * k, bold: true, color: couleurTitre, align: 'right', family: th.titleFont, name: 'Titre du document', canGrow: true }));
  let y = (sombre ? 4 : 0) + 10 * k;
  if (o.reference) { objs.push(T(ctx, xt, y, wTitre, 5.5 * k, o.reference, { size: 11 * k, bold: true, color: nom, align: 'right', family: 'Consolas', name: 'Référence' })); y += 6 * k; }
  if (o.date) objs.push(T(ctx, xt, y, wTitre, 4.5 * k, o.date, { size: 9 * k, color: sec, align: 'right', name: 'Date' }));

  // Filet de fin d'en-tête
  if (th.id === 'moderne') objs.push(rect(0, hBloc, cw, 0.8, { fill: th.accent, name: 'Filet' }));
  else if (th.id === 'classique') { objs.push(rect(0, hBloc, cw, 0.5, { fill: th.ink, name: 'Filet' })); objs.push(rect(0, hBloc + 1.1, cw, 0.2, { fill: th.ink, name: 'Filet fin' })); }
  else objs.push(rect(0, hBloc, cw, 0.9, { fill: th.accent2, name: 'Filet doré' }));
  return { objs, h: hBloc + 2.4 };
}

/** En-tête réduit des pages suivantes (masqué sur la première page). */
export function bandeSuite(ctx: Ctx, titre: string, ref: string): BandDef {
  const { th, cw } = ctx;
  const objs: ObjDef[] = [
    T(ctx, 0, 0.5, cw * 0.55, 4.5, '[UPPER(Societe.raison_sociale)]', { size: 8.5, bold: true, color: th.muted }),
    T(ctx, cw * 0.45, 0.5, cw * 0.55, 4.5, `${titre}${ref ? '  ·  ' + ref : ''}`, { size: 8.5, bold: true, color: th.accent, align: 'right', family: th.titleFont }),
    rect(0, 6, cw, 0.3, { fill: th.line }),
  ];
  return creerBande('pageHeader', { name: 'En-tête des pages suivantes', height: 8.5, objects: objs, printOnFirstPage: false });
}

// ─── Cartes de synthèse ─────────────────────────────────────────────────────

export type Carte = { label: string; expr: string; fmt?: keyof typeof FMT | 'texte'; ton?: 'danger' | 'ok' | 'warn' | 'fort'; suffixe?: string };

/** Rangée de cartes : libellé en petites capitales, valeur en chiffres tabulaires. */
export function blocCartes(ctx: Ctx, cartes: Carte[], h = 15): Bloc {
  const { th, cw } = ctx;
  const gap = 3;
  const w = (cw - gap * (cartes.length - 1)) / cartes.length;
  // Consolas : ~0,194 mm par point et par caractère ; on prévoit 12 caractères (« 1 234 567,00 »)
  const tailleValeur = Math.max(7.5, Math.min(11.5, Math.floor(((w - 5) / (12 * 0.194)) * 2) / 2));
  const objs: ObjDef[] = [];
  cartes.forEach((c, i) => {
    const x = i * (w + gap);
    const fort = c.ton === 'fort';
    objs.push(rect(x, 0, w, h, {
      fill: fort ? th.accent : th.soft, name: `Carte ${c.label}`,
      border: { top: !fort, right: !fort, bottom: !fort, left: !fort, color: th.line, width: 0.2, radius: 1.6 },
    }));
    objs.push(T(ctx, x + 2.5, 2, w - 5, 3.6, c.label.toUpperCase(), { size: 6.8, bold: true, color: fort ? th.surAccent : th.muted }));
    const couleur = fort ? th.surAccent : c.ton === 'danger' ? th.danger : c.ton === 'ok' ? th.ok : c.ton === 'warn' ? th.warn : th.ink;
    const val = c.fmt === 'texte' ? `[${c.expr}]${c.suffixe ?? ''}` : c.suffixe ? `[${fmtExpr(c.expr, c.fmt ?? 'money')}]${c.suffixe}` : `[${c.expr}]`;
    objs.push(T(ctx, x + 2.5, 6.6, w - 5, 6, val, {
      size: tailleValeur, bold: true, color: couleur, family: 'Consolas', align: 'left', format: c.fmt === 'texte' ? undefined : FMT[c.fmt ?? 'money'], name: `Valeur ${c.label}`,
    }));
  });
  return { objs, h };
}

// ─── Tiers et informations ──────────────────────────────────────────────────

export type Info = { label: string; expr: string; fmt?: keyof typeof FMT; /** Condition d'affichage (défaut : valeur non vide). */ si?: string };

/** Colonne d'informations (libellé gris + valeur), lignes masquées si la valeur est vide. */
export function blocInfos(ctx: Ctx, infos: Info[], w: number, ligne = 5.2): Bloc {
  const { th } = ctx;
  const objs: ObjDef[] = [];
  infos.forEach((it, i) => {
    const y = i * ligne;
    const vis = it.si ?? `NOT ISEMPTY(${it.expr})`;
    objs.push(T(ctx, 0, y, w * 0.34, ligne, it.label, { size: 8.5, color: th.muted, visible: vis, padding: 0.3 }));
    objs.push(T(ctx, w * 0.34, y, w * 0.66, ligne, `[${it.expr}]`, { size: 9, bold: true, visible: vis, format: it.fmt ? FMT[it.fmt] : undefined }));
  });
  return { objs, h: infos.length * ligne };
}

/** Cadre « tiers » (client / fournisseur) : libellé, nom, adresse et identifiants. */
export function blocTiers(ctx: Ctx, o: { label: string; nom: string; lignes: string[]; w?: number }): Bloc {
  const { th, cw } = ctx;
  const w = o.w ?? Math.min(92, cw * 0.5);
  const x = cw - w;
  const n = o.lignes.length;
  const h = 11 + n * 4.1;
  const objs: ObjDef[] = [
    rect(x, 0, w, h, { fill: th.id === 'classique' ? undefined : th.soft, name: 'Cadre tiers', border: { top: true, right: true, bottom: true, left: true, color: th.line, width: 0.25, radius: th.id === 'classique' ? 0 : 1.8 } }),
    rect(x, 0, 1.2, h, { fill: th.id === 'prestige' ? th.accent2 : th.accent, name: 'Liseré' }),
    T(ctx, x + 4, 1.6, w - 6, 3.6, o.label.toUpperCase(), { size: 7, bold: true, color: th.muted }),
    T(ctx, x + 4, 5.2, w - 6, 5, o.nom, { size: 11.5, bold: true, canGrow: true, family: th.titleFont }),
    ...o.lignes.map((l, i) => T(ctx, x + 4, 10.4 + i * 4.1, w - 6, 4, l, { size: 8.5, color: th.muted })),
  ];
  return { objs, h };
}

// ─── Tableaux ───────────────────────────────────────────────────────────────

export type Col = {
  titre: string;
  expr: string;
  /** Poids relatif de la colonne (largeur = poids / somme × largeur utile). */
  w: number;
  align?: 'left' | 'right' | 'center';
  fmt?: keyof typeof FMT | 'date';
  mono?: boolean;
  bold?: boolean;
  muted?: boolean;
  grow?: boolean;
  /** Mise en forme conditionnelle. */
  si?: HighlightRule[];
  /** Colonne imprimée seulement si l'expression est vraie (ex. `Journal.vente`). */
  visible?: string;
  /** Préfixe / suffixe autour de la valeur (ex. suffixe ' %'). */
  suffixe?: string;
};

export type TableauOpts = { source: string; hLigne?: number; taille?: number; tri?: string; filtre?: string; /** Titre de section au-dessus du tableau. */ legende?: string; /** Zébrage (défaut : oui). */ zebre?: boolean };

/** Largeurs (mm) des colonnes visibles. Les colonnes conditionnelles gardent leur place (largeur réservée). */
function largeurs(cols: Col[], cw: number): number[] {
  const total = cols.reduce((s, c) => s + c.w, 0);
  return cols.map((c) => (c.w / total) * cw);
}

/** En-tête de colonnes + ligne de données (zébrée), pilotés par la spécification de colonnes. */
export function tableau(ctx: Ctx, cols: Col[], o: TableauOpts): BandDef[] {
  const { th, cw } = ctx;
  const taille = o.taille ?? 8.8;
  const hl = o.hLigne ?? 6.4;
  const ws = largeurs(cols, cw);
  const xs: number[] = [];
  ws.reduce((x, w, i) => { xs[i] = x; return x + w; }, 0);
  const enTete: ObjDef[] = [];
  const ligne: ObjDef[] = [];
  const y0 = o.legende ? 9 : 0; // légende de section au-dessus des titres de colonnes
  if (o.legende) enTete.push(T(ctx, 0, 3, cw, 5, o.legende.toUpperCase(), { size: 8, bold: true, color: th.accent, family: th.titleFont, name: 'Légende' }));
  if (th.headFill) enTete.push(rect(0, y0, cw, 7.4, { fill: th.headFill, name: 'Fond en-tête' }));
  else {
    enTete.push(rect(0, y0, cw, 0.5, { fill: th.ink, name: 'Filet haut' }));
    enTete.push(rect(0, y0 + 7.2, cw, 0.5, { fill: th.ink, name: 'Filet bas' }));
  }
  cols.forEach((c, i) => {
    const pad = 1.6;
    enTete.push(T(ctx, xs[i], y0 + 0.4, ws[i], 6.6, c.titre.includes('[') ? c.titre : c.titre.toUpperCase(), {
      size: 7.2, bold: true, color: th.headInk, align: c.align ?? 'left', valign: 'middle', padding: pad, visible: c.visible, name: `Titre ${c.titre}`,
    }));
    const fmt = c.fmt && c.fmt !== 'date' ? FMT[c.fmt] : undefined;
    const base = c.fmt === 'date' ? `FORMAT(${c.expr}, 'dd/MM/yyyy')` : c.expr;
    const texte = c.suffixe ? `[${c.fmt && c.fmt !== 'date' ? fmtExpr(base, c.fmt) : base}]${c.suffixe}` : `[${base}]`;
    ligne.push(T(ctx, xs[i], 0, ws[i], hl, texte, {
      size: taille, bold: c.bold, color: c.muted ? th.muted : th.ink, family: c.mono ? 'Consolas' : undefined,
      align: c.align ?? 'left', valign: 'top', padding: pad, canGrow: !!c.grow, format: fmt, highlight: c.si, visible: c.visible, shift: true, name: c.titre,
    }));
  });
  // Filet de séparation sous chaque ligne
  ligne.push(creerObjet('line', 0, hl, { w: cw, h: 0.2, direction: 'h', color: th.line, lineWidth: 0.2, shift: true, name: 'Séparateur' }));
  return [
    creerBande('dataHeader', { name: 'En-tête du tableau', dataSource: o.source, height: 7.8 + y0, objects: enTete, keepWithData: true }),
    creerBande('data', { name: 'Lignes', dataSource: o.source, height: hl + 0.4, objects: ligne, zebra: o.zebre === false ? undefined : th.zebra, sort: o.tri ? [{ expr: o.tri, dir: 'asc' }] : undefined, filter: o.filtre, canGrow: cols.some((c) => c.grow) }),
  ];
}

// ─── Totaux ─────────────────────────────────────────────────────────────────

export type LigneTotal = { label: string; expr: string; fmt?: keyof typeof FMT; ton?: 'danger' | 'ok'; visible?: string };

/** Bloc de totaux aligné à droite : lignes simples puis ligne finale sur fond d'accent. */
export function blocTotaux(ctx: Ctx, lignes: LigneTotal[], final: { label: string; expr: string; suffixe?: string }, o: { w?: number } = {}): Bloc {
  const { th, cw } = ctx;
  const w = o.w ?? 78;
  const x = cw - w;
  const objs: ObjDef[] = [];
  let y = 0;
  for (const l of lignes) {
    objs.push(T(ctx, x, y, w * 0.5, 5.6, l.label, { size: 9, color: th.muted, valign: 'middle', padding: 1.5, visible: l.visible }));
    objs.push(T(ctx, x + w * 0.45, y, w * 0.55, 5.6, `[${l.expr}]`, {
      size: 9.5, bold: true, family: 'Consolas', align: 'right', valign: 'middle', padding: 1.5, format: FMT[l.fmt ?? 'money'], visible: l.visible,
      color: l.ton === 'danger' ? th.danger : l.ton === 'ok' ? th.ok : th.ink,
    }));
    if (!l.visible) objs.push(creerObjet('line', x, y + 5.6, { w, h: 0.2, direction: 'h', color: th.line, lineWidth: 0.2 }));
    y += 5.6;
  }
  y += 1.2;
  objs.push(rect(x, y, w, 9.2, { fill: th.accent, name: 'Fond total', border: { top: th.id === 'prestige', right: false, bottom: th.id === 'prestige', left: false, color: th.accent2, width: 0.5, radius: th.id === 'classique' ? 0 : 1.4 } }));
  objs.push(T(ctx, x, y, w * 0.5, 9.2, final.label.toUpperCase(), { size: 8.6, bold: true, color: th.surAccent, valign: 'middle', padding: 2.5 }));
  objs.push(T(ctx, x + w * 0.4, y, w * 0.6, 9.2, final.suffixe ? `[${fmtExpr(final.expr)}]${final.suffixe}` : `[${final.expr}]`, {
    size: 12, bold: true, color: th.id === 'prestige' ? th.accent2 : th.surAccent, family: 'Consolas', align: 'right', valign: 'middle', padding: 2.5, format: FMT.money,
  }));
  return { objs, h: y + 9.2 };
}

/**
 * Totaux pilotés par une liste de données `{ libelle, montant, final?, info?, ton? }` : seules les lignes applicables
 * existent (pas de ligne « Remise » vide), la ligne finale est sur fond d'accent, les lignes `info` (réglé, reste) en retrait.
 */
export function bandeTotauxListe(ctx: Ctx, source: string, o: { w?: number; suffixeFinal?: string } = {}): BandDef {
  const { th, cw } = ctx;
  const w = o.w ?? 80;
  const x = cw - w;
  const h = 6.2;
  const objs: ObjDef[] = [
    T(ctx, x, 0, w * 0.52, h, `[${source}.libelle]`, {
      size: 9, color: th.muted, valign: 'middle', padding: 1.8, name: 'Libellé',
      highlight: [
        { when: `${source}.final`, font: { color: th.surAccent, bold: true, size: 9 }, fill: th.accent },
        { when: `${source}.info`, font: { color: th.muted, size: 8.5 } },
      ],
    }),
    T(ctx, x + w * 0.46, 0, w * 0.54, h, `[${source}.montant]`, {
      size: 9.5, bold: true, family: 'Consolas', align: 'right', valign: 'middle', padding: 1.8, format: FMT.money, name: 'Montant',
      highlight: [
        { when: `${source}.final`, font: { color: th.id === 'prestige' ? th.accent2 : th.surAccent, bold: true, size: 11.5 }, fill: th.accent },
        { when: `${source}.ton = 'danger'`, font: { color: th.danger } },
        { when: `${source}.ton = 'ok'`, font: { color: th.ok } },
        { when: `${source}.info`, font: { color: th.muted, bold: false, size: 9 } },
      ],
    }),
    creerObjet('line', x, h, { w, h: 0.2, direction: 'h', color: th.line, lineWidth: 0.2, visible: `NOT ${source}.final`, name: 'Séparateur' }),
  ];
  return creerBande('data', { name: 'Totaux', dataSource: source, height: h + 0.2, objects: objs, keepWithData: false });
}

/** Cases de signature (cachet, visa…). */
export function blocSignatures(ctx: Ctx, libelles: string[], h = 24): Bloc {
  const { th, cw } = ctx;
  const n = libelles.length;
  const gap = 8;
  const w = (cw - gap * (n - 1)) / n;
  const objs: ObjDef[] = [];
  libelles.forEach((l, i) => {
    const x = i * (w + gap);
    objs.push(T(ctx, x, 0, w, 4.2, l, { size: 8.5, bold: true, color: th.muted }));
    objs.push(rect(x, 5, w, h - 5, { name: `Cadre ${l}`, border: { top: true, right: true, bottom: true, left: true, color: th.line, width: 0.25, radius: th.id === 'classique' ? 0 : 1.4, style: 'dashed' } }));
  });
  return { objs, h };
}

/** Zone de texte encadrée (arrêté en lettres, observation, conditions de règlement). */
export function blocNote(ctx: Ctx, o: { titre: string; texte: string; w: number; h?: number; visible?: string }): Bloc {
  const { th } = ctx;
  const h = o.h ?? 16;
  return {
    h,
    objs: [
      rect(0, 0, o.w, h, { fill: th.id === 'classique' ? undefined : th.soft, name: `Note ${o.titre}`, visible: o.visible, border: { top: true, right: true, bottom: true, left: true, color: th.line, width: 0.2, radius: th.id === 'classique' ? 0 : 1.4 } }),
      T(ctx, 2.5, 1.6, o.w - 5, 3.6, o.titre.toUpperCase(), { size: 6.8, bold: true, color: th.muted, visible: o.visible }),
      T(ctx, 2.5, 5.2, o.w - 5, h - 6, o.texte, { size: 9, bold: true, canGrow: false, visible: o.visible, lineHeight: 1.25 }),
    ],
  };
}

// ─── Pied de page ───────────────────────────────────────────────────────────

/** Pied : filet, mentions légales, référence et pagination. */
export function bandePied(ctx: Ctx, o: { reference?: string; legal?: boolean } = {}): BandDef {
  const { th, cw } = ctx;
  const objs: ObjDef[] = [
    rect(0, 0, cw, th.id === 'prestige' ? 0.6 : 0.3, { fill: th.id === 'prestige' ? th.accent2 : th.line, name: 'Filet pied' }),
    T(ctx, 0, 1.6, cw * 0.72, 3.8, o.legal === false
      ? '[UPPER(Societe.raison_sociale)]'
      : "[Societe.raison_sociale][IIF(Societe.capital, ' — Capital : ' & FORMAT(Societe.capital, '#,##0') & ' DA', '')][IIF(Societe.rc, '  ·  RC ' & Societe.rc, '')][IIF(Societe.nif, '  ·  NIF ' & Societe.nif, '')]",
    { size: 7, color: th.muted, name: 'Mentions' }),
    ...(o.legal === false ? [] : [
    T(ctx, 0, 5.4, cw * 0.72, 3.8, "[IIF(Societe.nis, 'NIS ' & Societe.nis & '  ·  ', '')][IIF(Societe.art, 'Art ' & Societe.art & '  ·  ', '')][IIF(Societe.rib, 'RIB ' & Societe.rib & IIF(Societe.banque, ' (' & Societe.banque & ')', ''), '')]", { size: 7, color: th.muted, name: 'NIS / RIB' }),
    ]),
    T(ctx, cw * 0.7, 1.6, cw * 0.3, 4.4, 'Page [Page] / [TotalPages]', { size: 8, bold: true, color: th.ink, align: 'right', family: 'Consolas', name: 'Pagination' }),
    T(ctx, cw * 0.55, 5.4, cw * 0.45, 3.8, o.reference ?? '', { size: 7, color: th.muted, align: 'right', name: 'Référence pied' }),
  ];
  return creerBande('pageFooter', { name: 'Pied de page', height: 10, objects: objs });
}

// ─── Assemblage ─────────────────────────────────────────────────────────────

export type Orientation = 'portrait' | 'paysage';

/** Crée l'état de base : page, marges et largeur utile. */
export function nouvelEtat(kind: string, nom: string, description: string, o: { format?: 'A4' | 'A5' | 'Ticket80' | 'Ticket58'; orientation?: Orientation; th: Theme; marges?: number }): { def: ReportDef; ctx: Ctx } {
  const def = creerEtat(kind, nom);
  def.description = description;
  const ticket = o.format === 'Ticket80' || o.format === 'Ticket58';
  const m = o.marges ?? (ticket ? 3 : o.format === 'A5' ? 9 : 12);
  def.page = { ...creerPage(o.format ?? 'A4', o.orientation === 'paysage' ? 'landscape' : 'portrait'), margins: { top: m, right: m, bottom: ticket ? m : m - 2, left: m } };
  def.author = 'Gestion Commerciale';
  const largeurPage = o.orientation === 'paysage' ? def.page.height : def.page.width;
  return { def, ctx: { th: o.th, cw: largeurPage - 2 * m } };
}

export { creerBande };
