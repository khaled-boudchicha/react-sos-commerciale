import {
  BandDef, BorderDef, DEFAULT_BORDER, DEFAULT_FONT, FontDef, ObjDef, ReportData, ReportDef, StyleDef, TextObj,
  dimensionsPage,
} from '../model';
import { Lazy, Scope, comparerValeurs, evaluerCondition, evaluerExpression, resoudreTexte } from '../expr/eval';
import { compterLignes, mesureurParDefaut, mmVersPx, Mesureur, ptVersPx } from './measure';
import { codeBarresSvg } from './barcode';
import { versNombre } from '../format';

export type RenderOptions = {
  /** Valeurs des paramètres (sinon valeurs par défaut du modèle). */
  params?: Record<string, string>;
  mesureur?: Mesureur;
  /** Garde-fou contre les boucles de pagination (défaut 2000). */
  maxPages?: number;
};

export type RenderResult = {
  /** HTML de chaque page (`<div class="rpt-page">…</div>`). */
  pages: string[];
  html: string;
  css: string;
  widthMm: number;
  heightMm: number;
  pageCount: number;
  warnings: string[];
  /** Nombre de lignes de données imprimées (diagnostic). */
  lignes: number;
};

// ─── Structures internes ────────────────────────────────────────────────────

type Resolved = {
  def: ObjDef;
  x: number; y: number; w: number; h: number;
  texte?: string;
  valeur?: string;
  coche?: boolean;
  /** Dépend de [Page] / [TotalPages] : recalculé à l'émission de chaque page. */
  dynamique: boolean;
  scope: Scope;
};

type Part = { scope: Scope; objs: Resolved[]; dx: number };
type Inst = { band: BandDef; h: number; parts: Part[]; fond?: string };
type Placed = { inst: Inst; y: number };
type PageBuild = { items: Placed[]; seg: number; /** contient autre chose que des en-têtes répétés */ reel: boolean };

const RE_DYNAMIQUE = /\b(page|totalpages|pagecount)\b/i;
const EPS = 0.01;
/** Hauteur maximale d'une page physique : limite du format PDF (200 pouces ≈ 5080 mm), prise avec marge. */
export const LIMITE_CONTINU_MM = 5000;

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const mm = (n: number) => `${Math.round(n * 1000) / 1000}mm`;

export const REPORT_CSS_BASE = `
.rpt-page{position:relative;overflow:hidden;background:#fff;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rpt-o{position:absolute;box-sizing:border-box;overflow:hidden}
.rpt-t{display:flex;flex-direction:column;width:100%;height:100%;box-sizing:border-box}
.rpt-tx{white-space:pre-wrap;overflow-wrap:anywhere;width:100%;box-sizing:border-box}
.rpt-tx.nw{white-space:pre;overflow-wrap:normal}
.rpt-o img{display:block;width:100%;height:100%}
.rpt-o svg{display:block}
`;

/** Le bloc de texte tel qu'il est imprimé (partagé par l'émission HTML et par la mesure DOM). */
function fragmentTexte(o: TextObj, police: FontDef, texte: string, align: string): string {
  const pad = o.padding ?? 0.5;
  const deco = [police.underline ? 'underline' : '', police.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  const nomPolice = police.family.replace(/['"<>&]/g, '');
  const famille = /courier|consolas|mono/i.test(police.family) ? `'${nomPolice}',monospace` : `'${nomPolice}',Arial,Helvetica,sans-serif`;
  const style = `font-family:${famille};font-size:${police.size}pt;font-weight:${police.bold ? 700 : 400};font-style:${police.italic ? 'italic' : 'normal'};color:${police.color};text-align:${align};line-height:${o.lineHeight ?? 1.2};padding:${mm(pad)};${deco ? `text-decoration:${deco};` : ''}`;
  return `<div class="rpt-tx${o.wordWrap === false ? ' nw' : ''}" style="${style}">${echapper(texte)}</div>`;
}

export function cssImpression(w: number, h: number): string {
  return `${REPORT_CSS_BASE}
@page{size:${mm(w)} ${mm(h)};margin:0}
@media print{
  html,body{margin:0;padding:0;background:#fff}
  .rpt-page{break-after:page;page-break-after:always;margin:0!important;box-shadow:none!important}
  .rpt-page:last-child{break-after:auto;page-break-after:auto}
}`;
}

// ─── Résolution des styles ──────────────────────────────────────────────────

function styleNomme(styles: StyleDef[], nom?: string): StyleDef | undefined {
  return nom ? styles.find((s) => s.name === nom) : undefined;
}

function policeDe(o: TextObj, styles: StyleDef[]): FontDef {
  return { ...DEFAULT_FONT, ...(styleNomme(styles, o.style)?.font ?? {}), ...(o.font ?? {}) };
}

function bordureDe(o: ObjDef, styles: StyleDef[]): BorderDef {
  return { ...DEFAULT_BORDER, ...(styleNomme(styles, o.style)?.border ?? {}), ...(o.border ?? {}) };
}

function fondDe(o: ObjDef, styles: StyleDef[]): string | undefined {
  return o.fill || styleNomme(styles, o.style)?.fill || undefined;
}

function alignDe(o: TextObj, styles: StyleDef[]): NonNullable<TextObj['align']> {
  return o.align ?? styleNomme(styles, o.style)?.align ?? 'left';
}

// ─── Portée racine ──────────────────────────────────────────────────────────

function porteeRacine(def: ReportDef, data: ReportData, params: Record<string, string>): Scope {
  const s = new Scope();
  const maintenant = new Date();
  s.definir('date', new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()));
  s.definir('now', maintenant);
  s.definir('time', maintenant);
  s.definir('page', 1).definir('totalpages', 1).definir('pagecount', 1);
  s.definir('reportname', def.name);
  s.definir('row', 0).definir('absrow', 0);
  for (const p of def.parameters) {
    const brut = params[p.name] ?? p.default ?? '';
    s.definir(p.name, p.type === 'number' ? (versNombre(brut) ?? 0) : p.type === 'boolean' ? /^(1|true|vrai|oui)$/i.test(brut) : brut);
  }
  for (const v of def.variables) s.definir(v.name, new Lazy(v.expr));
  for (const [nom, val] of Object.entries(data)) {
    if (Array.isArray(val)) s.definirFenetre(nom, val);
    else if (val && typeof val === 'object') s.definir(nom, val).definirFenetre(nom, [val]);
    else s.definir(nom, val);
  }
  return s;
}

/** Portée d'aperçu (designer, éditeur d'expression) : chaque jeu en liste montre sa première ligne. */
export function porteeApercu(def: ReportDef, data: ReportData, params: Record<string, string> = {}): Scope {
  const s = porteeRacine(def, data, params);
  for (const [nom, val] of Object.entries(data)) if (Array.isArray(val) && val.length) s.definir(nom, val[0]);
  return s;
}

function lireSource(scope: Scope, source: string): unknown[] {
  const [tete, ...reste] = source.split('.');
  const t = scope.lire(tete);
  let v: unknown = t.trouve ? t.valeur : scope.fenetre(tete);
  if (!t.trouve && reste.length === 0) return scope.fenetre(tete) ?? [];
  for (const k of reste) {
    if (v == null || typeof v !== 'object') return [];
    const cle = Object.keys(v as object).find((x) => x.toLowerCase() === k.toLowerCase());
    v = cle === undefined ? undefined : (v as Record<string, unknown>)[cle];
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [v];
  return [];
}

const nomSource = (source: string) => source.split('.').pop() as string;

// ─── Moteur ─────────────────────────────────────────────────────────────────

export function rendreEtat(def: ReportDef, data: ReportData, opts: RenderOptions = {}): RenderResult {
  const mesureur = opts.mesureur ?? mesureurParDefaut;
  const maxPages = opts.maxPages ?? 2000;
  const warnings: string[] = [];
  const avertir = (m: string) => { if (warnings.length < 50 && !warnings.includes(m)) warnings.push(m); };

  const { w: W, h: H0 } = dimensionsPage(def.page);
  const marges = def.page.margins;
  const contenuW = W - marges.left - marges.right;
  const continu = !!def.page.continuous;
  const styles = def.styles ?? [];
  const racine = porteeRacine(def, data, opts.params ?? {});
  let nbLignes = 0;
  const derniereValeur = new Map<string, string>();

  // ── Résolution des objets d'une bande ─────────────────────────────────────
  function resoudreObjets(b: BandDef, scope: Scope, _largeurCellule: number): { objs: Resolved[]; h: number } {
    const objs: Resolved[] = [];
    const croissance: number[] = [];
    for (const o of b.objects) {
      if (!evaluerCondition(o.visible, scope)) continue;
      const r: Resolved = { def: o, x: o.x, y: o.y, w: o.w, h: o.h, dynamique: false, scope };
      if (o.type === 'text') {
        const police = policeDe(o, styles);
        const res = resoudreTexte(o.text, scope, o.format);
        res.erreurs.forEach((e) => avertir(`${b.name} › ${o.name} : ${e}`));
        let texte = res.texte;
        if (o.hideDuplicates) {
          const cle = `${b.id}:${o.id}`;
          if (derniereValeur.get(cle) === texte) texte = ''; else derniereValeur.set(cle, texte);
        }
        r.texte = texte;
        r.dynamique = RE_DYNAMIQUE.test(o.text);
        if (o.canGrow || o.canShrink) {
          const pad = o.padding ?? 0.5;
          const lh = o.lineHeight ?? 1.2;
          const largeurPx = mmVersPx(Math.max(1, o.w - 2 * pad));
          let besoin: number;
          // Mesure dans le vrai moteur de mise en page (même CSS que l'impression) quand il est disponible
          const bord = bordureDe(o, styles);
          const bw = (actif: boolean) => (actif ? bord.width : 0);
          const hDom = mesureur.hauteurDom?.(
            fragmentTexte(o, police, texte, alignDe(o, styles)), REPORT_CSS_BASE,
            mmVersPx(Math.max(1, o.w - bw(bord.left) - bw(bord.right))),
          );
          if (hDom != null) besoin = hDom / mmVersPx(1) + bw(bord.top) + bw(bord.bottom);
          else {
            const lignes = compterLignes(texte, police, largeurPx, o.wordWrap !== false, mesureur);
            besoin = lignes * ptVersPx(police.size) * lh / mmVersPx(1) + 2 * pad * 0.5;
          }
          if (besoin > o.h + EPS && o.canGrow) r.h = besoin;
          else if (besoin < o.h - EPS && o.canShrink) r.h = Math.max(besoin, 1);
        }
      } else if (o.type === 'barcode') {
        const res = resoudreTexte(o.value, scope);
        r.valeur = res.texte;
        r.dynamique = RE_DYNAMIQUE.test(o.value);
      } else if (o.type === 'image') {
        if (o.expr) {
          const e = evaluerExpression(o.expr, scope);
          if (e.erreur) avertir(`${b.name} › ${o.name} : ${e.erreur}`);
          r.valeur = e.valeur == null ? '' : String(e.valeur);
        } else r.valeur = o.src ?? '';
      } else if (o.type === 'checkbox') {
        r.coche = evaluerCondition(o.checked, scope);
        r.dynamique = RE_DYNAMIQUE.test(o.checked);
      }
      objs.push(r);
      croissance.push(r.h - o.h);
    }
    // Décalage des objets situés sous un objet qui a grandi / rétréci
    const ordre = objs.map((_, i) => i).sort((a, c) => objs[a].def.y - objs[c].def.y);
    const dy: number[] = new Array(objs.length).fill(0);
    for (const j of ordre) {
      if (!objs[j].def.shift) continue;
      let d = 0;
      for (const i of ordre) {
        if (i === j) continue;
        const A = objs[i].def, B = objs[j].def;
        const dessus = B.y >= A.y + A.h - EPS && A.y < B.y;
        const recouvre = B.x < A.x + A.w - EPS && B.x + B.w > A.x + EPS;
        if (dessus && recouvre) d = Math.max(d, dy[i] + croissance[i]);
      }
      dy[j] = d;
    }
    objs.forEach((r, i) => { r.y = r.def.y + dy[i]; });
    let h = b.height;
    const peutGrandir = b.canGrow ?? b.objects.some((o) => o.type === 'text' && (o.canGrow || o.canShrink));
    if (peutGrandir) {
      const bas = objs.reduce((m, r) => Math.max(m, r.y + r.h), 0);
      h = Math.max(b.height, bas);
      if (objs.some((r) => r.def.type === 'text' && (r.def as TextObj).canShrink) && bas < b.height) h = Math.max(bas, 1);
    }
    return { objs, h };
  }

  function construire(b: BandDef, scope: Scope, fond?: string): Inst {
    const { objs, h } = resoudreObjets(b, scope, contenuW);
    return { band: b, h, parts: [{ scope, objs, dx: 0 }], fond };
  }

  // ── Pages ─────────────────────────────────────────────────────────────────
  const enTetes = def.bands.filter((b) => b.type === 'pageHeader' && !b.parent);
  const pieds = def.bands.filter((b) => b.type === 'pageFooter' && !b.parent);
  const filigranes = def.bands.filter((b) => b.type === 'overlay');
  const instEnTetes = enTetes.map((b) => construire(b, racine));
  const instPieds = pieds.map((b) => construire(b, racine));
  const hEnTete = instEnTetes.reduce((s, i) => s + i.h, 0);
  const hPied = instPieds.reduce((s, i) => s + i.h, 0);
  const contenuHaut = marges.top + hEnTete;
  const contenuBas = continu ? Infinity : H0 - marges.bottom - hPied;

  const pages: PageBuild[] = [];
  let seg = 0;
  let y = contenuHaut;
  let attente: Inst[] = [];
  let nouvellePage = false;

  /** En-têtes (colonnes, groupes) répétés en haut de chaque nouvelle page tant que leur section continue. */
  const actifs: Inst[] = [];
  const retirer = (inst: Inst | undefined) => { const k = inst ? actifs.indexOf(inst) : -1; if (k >= 0) actifs.splice(k, 1); };
  const repetable = (b: BandDef) => (b.type === 'dataHeader' ? b.repeatOnEveryPage !== false : b.type === 'groupHeader' ? b.repeatOnEveryPage === true : false);
  const page = () => pages[pages.length - 1];

  function pageNeuve() {
    if (pages.length >= maxPages) { avertir(`Limite de ${maxPages} pages atteinte : impression tronquée.`); return false; }
    pages.push({ items: [], seg, reel: false });
    y = contenuHaut;
    for (const a of actifs) { page().items.push({ inst: a, y }); y += a.h; }
    return true;
  }
  pageNeuve();

  function placer(inst: Inst) {
    const b = inst.band;
    const estEntete = (b.type === 'dataHeader' || b.type === 'groupHeader') && b.keepWithData !== false;
    if (estEntete) { attente.push(inst); return; }
    // Le groupe = en-têtes retenus + la bande : les options de pagination de chacun s'appliquent
    const groupe = [...attente, inst];
    attente = [];
    const total = groupe.reduce((s, i) => s + i.h, 0);
    if ((groupe.some((i) => i.band.startNewPage) || nouvellePage) && page().reel) { if (!pageNeuve()) return; }
    nouvellePage = false;
    if (!continu && y + total > contenuBas + EPS && page().reel) { if (!pageNeuve()) return; }
    if (!continu && total > contenuBas - y + EPS) avertir(`« ${b.name} » est plus haute que la page : elle sera tronquée.`);
    if (groupe.some((i) => i.band.resetPageNumber)) {
      seg += 1;
      if (!page().reel) page().seg = seg; else { if (!pageNeuve()) return; }
    }
    for (const i of groupe) { page().items.push({ inst: i, y }); y += i.h; if (repetable(i.band)) actifs.push(i); }
    page().reel = true;
    if (groupe.some((i) => i.band.newPageAfter)) nouvellePage = true;
  }

  // ── Sections de données ───────────────────────────────────────────────────
  const enfantsDe = (id: string) => def.bands.filter((b) => b.parent === id);

  function traiterNiveau(bandes: BandDef[], scope: Scope) {
    const enAttente: BandDef[] = [];
    const vider = () => { for (const h of enAttente.splice(0)) if (evaluerCondition(h.visible, scope)) placer(construire(h, scope)); };
    let i = 0;
    while (i < bandes.length) {
      const b = bandes[i];
      if (b.type === 'dataHeader' || b.type === 'groupHeader') { enAttente.push(b); i++; continue; }
      if (b.type === 'data') {
        const pieds: BandDef[] = [];
        let j = i + 1;
        while (j < bandes.length && (bandes[j].type === 'groupFooter' || bandes[j].type === 'dataFooter')) { pieds.push(bandes[j]); j++; }
        section(enAttente.splice(0), b, pieds, scope);
        i = j; continue;
      }
      vider();
      if (evaluerCondition(b.visible, scope)) placer(construire(b, scope));
      i++;
    }
    vider();
  }

  function section(entetes: BandDef[], D: BandDef, pieds: BandDef[], scope: Scope) {
    if (!D.dataSource) { avertir(`« ${D.name} » : aucune source de données.`); return; }
    const nom = nomSource(D.dataSource);
    let lignes = lireSource(scope, D.dataSource);
    const base = scope.enfant();
    if (D.filter?.trim()) lignes = lignes.filter((r) => evaluerCondition(D.filter, base.enfant().definir(nom, r)));
    const groupesEntete = entetes.filter((h) => h.type === 'groupHeader');
    const dataEntetes = entetes.filter((h) => h.type === 'dataHeader');
    const groupesPied = pieds.filter((p) => p.type === 'groupFooter');
    const dataPieds = pieds.filter((p) => p.type === 'dataFooter');
    const nGroupes = groupesEntete.length;

    // Tri : groupes d'abord, puis tri de la bande
    const cles: { expr: string; dir: 1 | -1 }[] = [
      ...groupesEntete.map((g) => ({ expr: g.groupBy ?? '', dir: 1 as const })).filter((c) => c.expr),
      ...(D.sort ?? []).filter((s) => s.expr).map((s) => ({ expr: s.expr, dir: (s.dir === 'desc' ? -1 : 1) as 1 | -1 })),
    ];
    if (cles.length) {
      const decorees = lignes.map((r, idx) => ({ r, idx, k: cles.map((c) => evaluerExpression(c.expr, base.enfant().definir(nom, r)).valeur) }));
      decorees.sort((a, b) => {
        for (let n = 0; n < cles.length; n++) { const c = comparerValeurs(a.k[n], b.k[n]); if (c) return c * cles[n].dir; }
        return a.idx - b.idx;
      });
      lignes = decorees.map((d) => d.r);
    }
    if (!lignes.length && !D.printIfEmpty) return;

    const portee = (row: unknown, fenetre: unknown[] = lignes, extra?: (s: Scope) => void) => {
      const s = base.enfant().definir(nom, row).definirFenetre(nom, fenetre);
      extra?.(s);
      return s;
    };
    const premiere = lignes[0];
    const instEntetesDonnees: Inst[] = [];
    for (const h of dataEntetes) if (evaluerCondition(h.visible, scope)) { const ih = construire(h, portee(premiere)); instEntetesDonnees.push(ih); placer(ih); }
    const instEntetesGroupes: (Inst | undefined)[] = new Array(groupesEntete.length).fill(undefined);

    // Clés de groupe par ligne et fenêtres (lignes d'un même groupe, triées donc contiguës)
    const clesGroupe = lignes.map((r) => groupesEntete.map((g) => String(evaluerExpression(g.groupBy ?? '""', base.enfant().definir(nom, r)).valeur ?? '')));
    const finGroupe = (debut: number, niveau: number) => {
      let fin = debut + 1;
      while (fin < lignes.length && clesGroupe[fin].slice(0, niveau + 1).join('\u0001') === clesGroupe[debut].slice(0, niveau + 1).join('\u0001')) fin++;
      return fin;
    };
    const debutDe: number[] = new Array(nGroupes).fill(0);

    const fermerGroupes = (jusqua: number, derniere: number) => {
      for (let g = nGroupes - 1; g >= jusqua; g--) {
        const pied = groupesPied[nGroupes - 1 - g]; // 1er pied listé = groupe le plus interne
        if (pied && evaluerCondition(pied.visible, scope)) {
          const fen = lignes.slice(debutDe[g], finGroupe(debutDe[g], g));
          placer(construire(pied, portee(lignes[derniere], fen)));
        }
        retirer(instEntetesGroupes[g]); // le groupe est terminé : son en-tête ne se répète plus
        instEntetesGroupes[g] = undefined;
      }
    };

    let cellules: { scope: Scope; row: unknown; idx: number }[] = [];
    const nCols = Math.max(1, Math.floor(D.columns ?? 1));
    const vidangeColonnes = () => {
      if (!cellules.length) return;
      const gap = D.columnGap ?? 0;
      const cw = (contenuW - gap * (nCols - 1)) / nCols;
      const parts: Part[] = [];
      let h = D.height;
      cellules.forEach((c, k) => {
        const { objs, h: hc } = resoudreObjets(D, c.scope, cw);
        h = Math.max(h, hc);
        parts.push({ scope: c.scope, objs, dx: k * (cw + gap) });
      });
      placer({ band: D, h, parts });
      cellules = [];
    };

    for (let idx = 0; idx < lignes.length; idx++) {
      const row = lignes[idx];
      let chg = -1;
      if (idx > 0) chg = clesGroupe[idx].findIndex((k, g) => k !== clesGroupe[idx - 1][g]);
      if (idx > 0 && chg >= 0) { vidangeColonnes(); fermerGroupes(chg, idx - 1); }
      if (idx === 0 || chg >= 0) {
        for (let g = idx === 0 ? 0 : chg; g < nGroupes; g++) {
          debutDe[g] = idx;
          const h = groupesEntete[g];
          if (evaluerCondition(h.visible, scope)) {
            const ig = construire(h, portee(row, lignes.slice(idx, finGroupe(idx, g))));
            instEntetesGroupes[g] = ig;
            placer(ig);
          }
        }
      }
      nbLignes++;
      const sc = portee(row, lignes, (s) => { s.definir('row', idx + 1).definir('absrow', idx + 1); });
      if (!evaluerCondition(D.visible, sc)) continue;
      if (nCols > 1) {
        cellules.push({ scope: sc, row, idx });
        if (cellules.length === nCols) vidangeColonnes();
        continue;
      }
      placer(construire(D, sc, D.zebra && idx % 2 === 1 ? D.zebra : undefined));
      const details = enfantsDe(D.id);
      if (details.length) traiterNiveau(details, sc);
    }
    vidangeColonnes();
    const derniere = lignes.length - 1;
    if (derniere >= 0) fermerGroupes(0, derniere);
    for (const p of dataPieds) if (evaluerCondition(p.visible, scope)) placer(construire(p, portee(lignes[derniere] ?? null, lignes)));
    instEntetesDonnees.forEach(retirer); // fin de section : les en-têtes de colonnes ne se répètent plus
  }

  // ── Déroulement du rapport ────────────────────────────────────────────────
  const hors = new Set(['pageHeader', 'pageFooter', 'overlay', 'reportTitle', 'reportSummary']);
  for (const t of def.bands.filter((b) => b.type === 'reportTitle' && !b.parent)) {
    if (evaluerCondition(t.visible, racine)) placer(construire(t, racine));
  }
  traiterNiveau(def.bands.filter((b) => !b.parent && !hors.has(b.type)), racine);
  for (const s of def.bands.filter((b) => b.type === 'reportSummary' && !b.parent)) {
    if (evaluerCondition(s.visible, racine)) placer(construire(s, racine));
  }
  // En-têtes orphelins restés en attente (jeu de données vide)
  for (const inst of attente.splice(0)) placer({ ...inst, band: { ...inst.band, keepWithData: false } });

  // ── Dimensions finales ────────────────────────────────────────────────────
  const dernierePage = pages[pages.length - 1];
  const hauteurUtilisee = dernierePage.items.reduce((m, p) => Math.max(m, p.y + p.inst.h), contenuHaut);
  const H = continu ? Math.max(hauteurUtilisee + hPied + marges.bottom, 20) : H0;
  if (continu && H > LIMITE_CONTINU_MM) {
    // Un PDF ne peut pas dépasser ≈ 5 m de haut : au-delà, le ticket est découpé en pages de
    // LIMITE_CONTINU_MM, avec en-têtes et pieds répétés, plutôt que tronqué.
    const r = rendreEtat({ ...def, page: { ...def.page, continuous: false, orientation: 'portrait', height: LIMITE_CONTINU_MM } }, data, opts);
    r.warnings.unshift(`Ticket de ${Math.round(H)} mm : découpé en ${r.pageCount} pages de ${LIMITE_CONTINU_MM} mm (limite d'impression).`);
    return r;
  }
  const pied0 = H - marges.bottom - hPied;

  // Numérotation par segment (resetPageNumber)
  const debutSeg = new Map<number, number>();
  const longSeg = new Map<number, number>();
  pages.forEach((p, i) => { if (!debutSeg.has(p.seg)) debutSeg.set(p.seg, i); longSeg.set(p.seg, (longSeg.get(p.seg) ?? 0) + 1); });

  // ── Émission HTML ─────────────────────────────────────────────────────────
  function htmlObjet(r: Resolved, dx: number, page: number, total: number): string {
    const o = r.def;
    let sc = r.scope;
    if (r.dynamique) sc = r.scope.enfant().definir('page', page).definir('totalpages', total).definir('pagecount', total);
    const pos = `left:${mm(r.x + dx)};top:${mm(r.y)};width:${mm(r.w)};height:${mm(r.h)}`;
    const bord = bordureDe(o, styles);
    const fond = fondDe(o, styles);
    const cote = (actif: boolean, nom: string) => (actif ? `border-${nom}:${mm(bord.width)} ${bord.style} ${bord.color};` : '');
    const cadre = `${fond ? `background:${fond};` : ''}${cote(bord.top, 'top')}${cote(bord.right, 'right')}${cote(bord.bottom, 'bottom')}${cote(bord.left, 'left')}${bord.radius ? `border-radius:${mm(bord.radius)};` : ''}`;
    const rot: number = o.rotation ?? 0;

    switch (o.type) {
      case 'text': {
        const police = policeDe(o, styles);
        const texte = r.dynamique ? resoudreTexte(o.text, sc, o.format).texte : (r.texte ?? '');
        const va = o.valign === 'middle' ? 'center' : o.valign === 'bottom' ? 'flex-end' : 'flex-start';
        const interieur = `<div class="rpt-t" style="justify-content:${va}">${fragmentTexte(o, police, texte, alignDe(o, styles))}</div>`;
        if (rot === 90 || rot === 270) {
          return `<div class="rpt-o" style="${pos};${cadre}"><div style="position:absolute;left:${mm((r.w - r.h) / 2)};top:${mm((r.h - r.w) / 2)};width:${mm(r.h)};height:${mm(r.w)};transform:rotate(${rot}deg)">${interieur}</div></div>`;
        }
        return `<div class="rpt-o" style="${pos};${cadre}${rot === 180 ? 'transform:rotate(180deg);' : ''}">${interieur}</div>`;
      }
      case 'image': {
        const src = r.valeur ?? '';
        if (!src) return `<div class="rpt-o" style="${pos};${cadre}"></div>`;
        const fit = o.fit === 'stretch' ? 'fill' : (o.fit ?? 'contain');
        return `<div class="rpt-o" style="${pos};${cadre}${o.opacity != null ? `opacity:${o.opacity};` : ''}"><img src="${echapper(src)}" alt="" style="object-fit:${fit}"></div>`;
      }
      case 'line': {
        const w = Math.max(r.w, 0.1), h = Math.max(r.h, 0.1);
        const c = o.color ?? '#000', lw = o.lineWidth ?? 0.3;
        const dash = o.dash === 'dashed' ? ' stroke-dasharray="2 1.2"' : o.dash === 'dotted' ? ' stroke-dasharray="0.4 0.8" stroke-linecap="round"' : '';
        const [x1, y1, x2, y2] = o.direction === 'v' ? [w / 2, 0, w / 2, h] : o.direction === 'diag' ? [0, 0, w, h] : o.direction === 'antidiag' ? [0, h, w, 0] : [0, h / 2, w, h / 2];
        return `<div class="rpt-o" style="${pos};overflow:visible"><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${lw}"${dash}/></svg></div>`;
      }
      case 'shape':
        return `<div class="rpt-o" style="${pos};${cadre}${o.shape === 'ellipse' ? 'border-radius:50%;' : ''}"></div>`;
      case 'barcode':
        return `<div class="rpt-o" style="${pos};${cadre}">${codeBarresSvg(o.symbology, r.dynamique ? resoudreTexte(o.value, sc).texte : (r.valeur ?? ''), r.w, r.h, { texte: o.showText !== false, couleur: o.color })}</div>`;
      case 'checkbox': {
        const coche = r.dynamique ? evaluerCondition(o.checked, sc) : !!r.coche;
        const c = o.color ?? '#000';
        return `<div class="rpt-o" style="${pos};${cadre}"><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none"><rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="${c}" stroke-width="0.6"/>${coche ? `<path d="M2.2 5.2 L4.3 7.3 L7.9 2.8" fill="none" stroke="${c}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg></div>`;
      }
    }
  }

  function htmlBande(inst: Inst, y: number, page: number, total: number): string {
    const contenu = inst.parts.map((p) => p.objs.map((r) => htmlObjet(r, p.dx, page, total)).join('')).join('');
    const fond = inst.fond ? `background:${inst.fond};` : '';
    return `<div class="rpt-b" style="position:absolute;left:${mm(marges.left)};top:${mm(y)};width:${mm(contenuW)};height:${mm(inst.h)};${fond}">${contenu}</div>`;
  }

  const sortiePages: string[] = pages.map((p, idx) => {
    const debut = debutSeg.get(p.seg) ?? 0;
    const numero = idx - debut + 1;
    const total = longSeg.get(p.seg) ?? pages.length;
    let html = '';
    // Filigranes : sous le contenu
    for (const f of filigranes) {
      const inst = construire(f, racine);
      html += htmlBande(inst, marges.top, numero, total).replace('class="rpt-b"', 'class="rpt-b" data-overlay="1"');
    }
    let yy = marges.top;
    instEnTetes.forEach((inst, k) => {
      const b = enTetes[k];
      const montrer = !(b.printOnFirstPage === false && idx === 0) && !(b.printOnLastPage === false && idx === pages.length - 1);
      if (montrer) html += htmlBande(inst, yy, numero, total);
      yy += inst.h;
    });
    for (const it of p.items) html += htmlBande(it.inst, it.y, numero, total);
    let py = pied0;
    instPieds.forEach((inst, k) => {
      const b = pieds[k];
      const montrer = !(b.printOnFirstPage === false && idx === 0) && !(b.printOnLastPage === false && idx === pages.length - 1);
      if (montrer) html += htmlBande(inst, py, numero, total);
      py += inst.h;
    });
    const fondPage = def.page.background ? `background:${def.page.background};` : '';
    return `<div class="rpt-page" data-page="${idx + 1}" style="width:${mm(W)};height:${mm(H)};${fondPage}">${html}</div>`;
  });

  return {
    pages: sortiePages,
    html: sortiePages.join(''),
    css: cssImpression(W, H),
    widthMm: W, heightMm: H,
    pageCount: pages.length,
    warnings, lignes: nbLignes,
  };
}
