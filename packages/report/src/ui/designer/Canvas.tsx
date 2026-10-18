import { CSSProperties, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BAND_LABELS, BandDef, BandType, DEFAULT_BORDER, DEFAULT_FONT, ObjDef, ObjType, ReportDef, StyleDef, TextObj,
  creerObjet, dimensionsPage,
} from '../../model';
import { segmenter } from '../../expr/parser';
import { Scope, resoudreTexte } from '../../expr/eval';
import { codeBarresSvg } from '../../engine/barcode';
import { PX_PAR_MM, ptVersPx } from '../../engine/measure';
import { Ic } from '../icons';
import type { DesignerApi } from './useDesigner';
import {
  ajouterObjet, changerDeBande, deplacerObjets, englobant, largeurBande, majBande, redimensionner, supprimerBande,
  deplacerBande, dupliquerBande, trouverObjet,
} from './ops';

export const COULEUR_BANDE: Record<BandType, string> = {
  reportTitle: '#0D9488', reportSummary: '#0D9488', pageHeader: '#7C3AED', pageFooter: '#7C3AED',
  dataHeader: '#3B82F6', dataFooter: '#3B82F6', groupHeader: '#D97706', groupFooter: '#D97706', data: '#2450E0', overlay: '#64748B',
};

export type Grille = { afficher: boolean; pas: number; magnetisme: boolean };
export type ChampDepose = { texte: string; type: string; nom: string };

type Poignee = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const POIGNEES: { id: Poignee; x: number; y: number; curseur: string }[] = [
  { id: 'nw', x: 0, y: 0, curseur: 'nwse-resize' }, { id: 'n', x: 0.5, y: 0, curseur: 'ns-resize' }, { id: 'ne', x: 1, y: 0, curseur: 'nesw-resize' },
  { id: 'e', x: 1, y: 0.5, curseur: 'ew-resize' }, { id: 'se', x: 1, y: 1, curseur: 'nwse-resize' }, { id: 's', x: 0.5, y: 1, curseur: 'ns-resize' },
  { id: 'sw', x: 0, y: 1, curseur: 'nesw-resize' }, { id: 'w', x: 0, y: 0.5, curseur: 'ew-resize' },
];

type Geste =
  | { t: 'deplacer'; ids: string[]; depart: { x: number; y: number }; origine: ReportDef; bandeId: string; grab: number; bouge: boolean }
  | { t: 'redim'; id: string; poignee: Poignee; depart: { x: number; y: number }; origine: ReportDef; rect: { x: number; y: number; w: number; h: number }; bandeId: string }
  | { t: 'bande'; id: string; departY: number; hauteur: number; origine: ReportDef }
  | { t: 'dessin'; bandeId: string; type: ObjType; x0: number; y0: number }
  | { t: 'rect'; bandeId: string; x0: number; y0: number; ajout: boolean };

type Rect = { x: number; y: number; w: number; h: number };

const SEUIL_PX = 6;

export default function Canvas({ D, pxMm, grille, valeurs, onPointeur, onDeposer, onEditionTexte }: {
  D: DesignerApi;
  /** Portée d'aperçu : affiche les valeurs d'exemple à la place des expressions (null = expressions brutes). */
  valeurs?: Scope | null;
  /** Pixels écran par millimètre (zoom inclus). */
  pxMm: number;
  grille: Grille;
  onPointeur?: (p: { x: number; y: number; bande: string } | null) => void;
  onDeposer: (bandeId: string, x: number, y: number, champ: ChampDepose) => void;
  /** Ouvre l'éditeur d'expression d'un objet (double-clic sur un objet non texte). */
  onEditionTexte?: (id: string) => void;
}) {
  const { def } = D;
  const { w: pageW, h: pageH } = dimensionsPage(def.page);
  const m = def.page.margins;
  const largeur = largeurBande(def);
  const zoom = pxMm / PX_PAR_MM;

  const corps = useRef(new Map<string, HTMLDivElement>());
  const geste = useRef<Geste | null>(null);
  const defRef = useRef(def); defRef.current = def;
  const dRef = useRef(D); dRef.current = D;
  const [guides, setGuides] = useState<{ x: number[]; y: number[]; bande: string } | null>(null);
  const [rectVisible, setRectVisible] = useState<{ bande: string; r: Rect; dessin?: boolean } | null>(null);
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);

  const pas = grille.magnetisme ? grille.pas : 0;

  /** Position souris → mm dans le corps d'une bande. */
  const versBande = useCallback((bandeId: string, cx: number, cy: number) => {
    const el = corps.current.get(bandeId);
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: (cx - r.left) / pxMm, y: (cy - r.top) / pxMm };
  }, [pxMm]);

  const bandeSousPointeur = useCallback((cx: number, cy: number): string | null => {
    for (const [id, el] of corps.current) {
      const r = el.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top - 12 && cy <= r.bottom + 12) return id;
    }
    return null;
  }, []);

  // ── Aimantation : objets voisins puis grille ──────────────────────────────
  const aimanter = useCallback((bandeId: string, exclus: Set<string>, box: Rect, axes: { gx: boolean; gy: boolean }): { dx: number; dy: number; gx: number[]; gy: number[] } => {
    if (!grille.magnetisme) return { dx: 0, dy: 0, gx: [], gy: [] }; // magnétisme désactivé : ni grille ni objets voisins
    const bande = defRef.current.bands.find((b) => b.id === bandeId);
    const seuil = SEUIL_PX / pxMm;
    const xs = [0, largeur / 2, largeur], ys = [0, (bande?.height ?? 0) / 2, bande?.height ?? 0];
    bande?.objects.forEach((o) => { if (!exclus.has(o.id)) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); } });
    const meilleur = (valeurs: number[], cibles: number[]) => {
      let best: { d: number; ligne: number } | null = null;
      for (const v of valeurs) for (const c of cibles) { const d = c - v; if (Math.abs(d) <= seuil && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, ligne: c }; }
      return best;
    };
    const sx = axes.gx ? meilleur([box.x, box.x + box.w / 2, box.x + box.w], xs) : null;
    const sy = axes.gy ? meilleur([box.y, box.y + box.h / 2, box.y + box.h], ys) : null;
    let dx = sx?.d ?? 0, dy = sy?.d ?? 0;
    if (!sx && pas && axes.gx) dx = Math.round(box.x / pas) * pas - box.x;
    if (!sy && pas && axes.gy) dy = Math.round(box.y / pas) * pas - box.y;
    return { dx, dy, gx: sx ? [sx.ligne] : [], gy: sy ? [sy.ligne] : [] };
  }, [grille.magnetisme, largeur, pas, pxMm]);

  // ── Gestes : écouteurs globaux tant que la souris est enfoncée ────────────
  useEffect(() => {
    function bouger(e: PointerEvent) {
      const g = geste.current;
      if (!g) return;
      const d = dRef.current;
      if (g.t === 'deplacer') {
        const dxPx = e.clientX - g.depart.x, dyPx = e.clientY - g.depart.y;
        if (!g.bouge && Math.hypot(dxPx, dyPx) < 3) return;
        g.bouge = true;
        const dx = dxPx / pxMm, dy = dyPx / pxMm;
        const brut = deplacerObjets(g.origine, g.ids, dx, dy, largeur, 0);
        const box = englobant(brut, g.ids);
        let snapDx = 0, snapDy = 0;
        if (box) {
          const s = aimanter(g.bandeId, new Set(g.ids), box, { gx: true, gy: true });
          snapDx = s.dx; snapDy = s.dy;
          setGuides(s.gx.length || s.gy.length ? { x: s.gx, y: s.gy, bande: g.bandeId } : null);
        }
        d.brouillon(deplacerObjets(g.origine, g.ids, dx + snapDx, dy + snapDy, largeur, 0));
      } else if (g.t === 'redim') {
        const dx = (e.clientX - g.depart.x) / pxMm, dy = (e.clientY - g.depart.y) / pxMm;
        let { x, y, w, h } = g.rect;
        const p = g.poignee;
        if (p.includes('e')) w += dx;
        if (p.includes('w')) { x += dx; w -= dx; }
        if (p.includes('s')) h += dy;
        if (p.includes('n')) { y += dy; h -= dy; }
        // aimante le(s) bord(s) déplacé(s)
        const bx = { x, y, w, h };
        const gauche = p.includes('w'), droite = p.includes('e'), haut = p.includes('n'), bas = p.includes('s');
        const s = aimanter(g.bandeId, new Set([g.id]), bx, { gx: gauche || droite, gy: haut || bas });
        const bande = defRef.current.bands.find((b) => b.id === g.bandeId);
        const objs = bande?.objects.filter((o) => o.id !== g.id) ?? [];
        // l'aimantation d'un seul bord : recalcule avec le bord concerné
        const seuil = SEUIL_PX / pxMm;
        const accroche = (v: number, cibles: number[]) => (!grille.magnetisme ? null : cibles.reduce<number | null>((b, c) => (Math.abs(c - v) <= seuil && (b === null || Math.abs(c - v) < Math.abs(b - v)) ? c : b), null));
        const cx = [0, largeur, ...objs.flatMap((o) => [o.x, o.x + o.w])], cy = [0, bande?.height ?? 0, ...objs.flatMap((o) => [o.y, o.y + o.h])];
        const lignesX: number[] = [], lignesY: number[] = [];
        if (gauche) { const a = accroche(x, cx) ?? (pas ? Math.round(x / pas) * pas : x); w += x - a; x = a; lignesX.push(a); }
        if (droite) { const a = accroche(x + w, cx) ?? (pas ? Math.round((x + w) / pas) * pas : x + w); w = a - x; lignesX.push(a); }
        if (haut) { const a = accroche(y, cy) ?? (pas ? Math.round(y / pas) * pas : y); h += y - a; y = a; lignesY.push(a); }
        if (bas) { const a = accroche(y + h, cy) ?? (pas ? Math.round((y + h) / pas) * pas : y + h); h = a - y; lignesY.push(a); }
        void s;
        setGuides({ x: lignesX, y: lignesY, bande: g.bandeId });
        d.brouillon(redimensionner(g.origine, g.id, x, y, w, h, largeur));
      } else if (g.t === 'bande') {
        const dy = (e.clientY - g.departY) / pxMm;
        const h = Math.max(2, Math.round((g.hauteur + dy) / (pas || 0.5)) * (pas || 0.5));
        d.brouillon(majBande(g.origine, g.id, { height: Math.round(h * 100) / 100 }));
      } else if (g.t === 'dessin' || g.t === 'rect') {
        const p = versBande(g.bandeId, e.clientX, e.clientY);
        const bande = defRef.current.bands.find((b) => b.id === g.bandeId);
        const cl = (v: number, max: number) => Math.min(Math.max(v, 0), max);
        const x1 = cl(p.x, largeur), y1 = cl(p.y, bande?.height ?? 0);
        const sn = (v: number) => (pas ? Math.round(v / pas) * pas : v);
        const r = { x: Math.min(g.x0, sn(x1)), y: Math.min(g.y0, sn(y1)), w: Math.abs(sn(x1) - g.x0), h: Math.abs(sn(y1) - g.y0) };
        setRectVisible({ bande: g.bandeId, r, dessin: g.t === 'dessin' });
      }
    }

    function relacher(e: PointerEvent) {
      const g = geste.current;
      geste.current = null;
      setGuides(null);
      if (!g) return;
      const d = dRef.current;
      if (g.t === 'deplacer') {
        if (g.bouge) {
          const cible = bandeSousPointeur(e.clientX, e.clientY);
          const memeBande = !cible || cible === g.bandeId;
          const objs = g.ids.map((id) => trouverObjet(g.origine, id)).filter(Boolean);
          const toutesLaMemeBande = objs.every((o) => o!.bande.id === g.bandeId);
          if (!memeBande && toutesLaMemeBande && objs[0]) {
            // dépose dans une autre bande : conserve la prise de l'objet sous le pointeur
            const p = versBande(cible!, e.clientX, e.clientY);
            const ref = objs[0]!.objet;
            const dx = (e.clientX - g.depart.x) / pxMm;
            const desire = Math.max(0, p.y - g.grab);
            const deplace = deplacerObjets(g.origine, g.ids, dx, 0, largeur, pas);
            d.brouillon(changerDeBande(deplace, g.ids, cible!, desire - ref.y));
          }
        }
        d.finGeste();
      } else if (g.t === 'redim' || g.t === 'bande') {
        d.finGeste();
      } else if (g.t === 'dessin') {
        const p = versBande(g.bandeId, e.clientX, e.clientY);
        const bande = defRef.current.bands.find((b) => b.id === g.bandeId);
        const sn = (v: number) => (pas ? Math.round(v / pas) * pas : v);
        const x1 = Math.min(Math.max(sn(p.x), 0), largeur), y1 = Math.min(Math.max(sn(p.y), 0), bande?.height ?? 0);
        let r = { x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) };
        const tiny = r.w < 2 && r.h < 2;
        const defauts = creerObjet(g.type, 0, 0);
        if (tiny) r = { x: g.x0, y: g.y0, w: defauts.w, h: defauts.h };
        r.w = Math.min(Math.max(r.w, 1), largeur - r.x); if (g.type !== 'line') r.h = Math.max(r.h, 2);
        const patch: Partial<ObjDef> = { w: r.w, h: g.type === 'line' ? Math.max(r.h, 0.5) : r.h };
        if (g.type === 'line') {
          // trait plat : horizontal si le geste est plutôt horizontal, vertical sinon
          const vertical = !tiny && r.h > r.w;
          (patch as { direction?: string }).direction = vertical ? 'v' : 'h';
          if (vertical) { patch.w = 0.5; patch.h = r.h; } else { patch.h = 0.5; }
        }
        const o = creerObjet(g.type, r.x, r.y, patch);
        d.set(ajouterObjet(defRef.current, g.bandeId, o), [o.id]);
        if (!e.shiftKey) d.setOutil(null);
      } else if (g.t === 'rect') {
        const p = versBande(g.bandeId, e.clientX, e.clientY);
        const r = { x: Math.min(g.x0, p.x), y: Math.min(g.y0, p.y), w: Math.abs(p.x - g.x0), h: Math.abs(p.y - g.y0) };
        if (r.w > 1 || r.h > 1) {
          const bande = defRef.current.bands.find((b) => b.id === g.bandeId);
          const dans = (bande?.objects ?? []).filter((o) => o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y).map((o) => o.id);
          d.select(g.ajout ? [...new Set([...d.sel, ...dans])] : dans);
        }
      }
      setRectVisible(null);
    }
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', relacher);
    return () => { window.removeEventListener('pointermove', bouger); window.removeEventListener('pointerup', relacher); };
  }, [aimanter, bandeSousPointeur, grille.magnetisme, largeur, pas, pxMm, versBande]);

  // ── Début de gestes ───────────────────────────────────────────────────────
  function debutObjet(e: React.PointerEvent, o: ObjDef, b: BandDef) {
    if (e.button !== 0 || D.outil) return;
    e.stopPropagation();
    if (edition) return;
    const additif = e.shiftKey || e.ctrlKey || e.metaKey;
    let ids = D.sel;
    if (additif) ids = D.sel.includes(o.id) ? D.sel.filter((x) => x !== o.id) : [...D.sel, o.id];
    else if (!D.sel.includes(o.id)) ids = [o.id];
    D.select(ids);
    if (!ids.includes(o.id) || o.locked) return;
    const p = versBande(b.id, e.clientX, e.clientY);
    D.debutGeste();
    geste.current = { t: 'deplacer', ids, depart: { x: e.clientX, y: e.clientY }, origine: def, bandeId: b.id, grab: p.y - o.y, bouge: false };
  }

  function debutPoignee(e: React.PointerEvent, o: ObjDef, b: BandDef, poignee: Poignee) {
    if (e.button !== 0) return;
    e.stopPropagation();
    D.debutGeste();
    geste.current = { t: 'redim', id: o.id, poignee, depart: { x: e.clientX, y: e.clientY }, origine: def, rect: { x: o.x, y: o.y, w: o.w, h: o.h }, bandeId: b.id };
  }

  function debutCorps(e: React.PointerEvent, b: BandDef) {
    if (e.button !== 0) return;
    const p = versBande(b.id, e.clientX, e.clientY);
    const sn = (v: number) => (pas ? Math.round(v / pas) * pas : v);
    if (D.outil) {
      geste.current = { t: 'dessin', bandeId: b.id, type: D.outil, x0: sn(p.x), y0: sn(p.y) };
      setRectVisible({ bande: b.id, r: { x: sn(p.x), y: sn(p.y), w: 0, h: 0 }, dessin: true });
      return;
    }
    const additif = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!additif) D.selectBande(b.id);
    geste.current = { t: 'rect', bandeId: b.id, x0: p.x, y0: p.y, ajout: additif };
  }

  function debutRedimBande(e: React.PointerEvent, b: BandDef) {
    if (e.button !== 0) return;
    e.stopPropagation();
    D.debutGeste();
    geste.current = { t: 'bande', id: b.id, departY: e.clientY, hauteur: b.height, origine: def };
  }

  // ── Glisser-déposer de champs depuis l'arbre de données ───────────────────
  function surDepot(e: React.DragEvent, b: BandDef) {
    const brut = e.dataTransfer.getData('application/x-gcr-champ');
    if (!brut) return;
    e.preventDefault();
    const p = versBande(b.id, e.clientX, e.clientY);
    try { onDeposer(b.id, Math.max(0, p.x), Math.max(0, p.y), JSON.parse(brut) as ChampDepose); } catch { /* charge utile invalide */ }
  }

  // ── Édition de texte en place ─────────────────────────────────────────────
  function validerEdition() {
    if (!edition) return;
    const t = trouverObjet(def, edition.id);
    if (t && t.objet.type === 'text' && t.objet.text !== edition.texte) {
      D.set({ ...def, bands: def.bands.map((b) => ({ ...b, objects: b.objects.map((o) => (o.id === edition.id ? ({ ...o, text: edition.texte } as TextObj) : o)) })) });
    }
    setEdition(null);
  }

  const styles = def.styles;
  const bandes = def.bands;
  const quadrillage = useMemo(() => (grille.afficher && grille.pas * pxMm >= 4
    ? { backgroundImage: 'radial-gradient(circle, rgb(100 116 139 / .45) 0.7px, transparent 0.8px)', backgroundSize: `${grille.pas * pxMm}px ${grille.pas * pxMm}px` }
    : {}), [grille.afficher, grille.pas, pxMm]);

  return (
    <div className="relative select-none" style={{ width: pageW * pxMm, minHeight: 200 }}
         onPointerDown={(e) => { if (e.target === e.currentTarget && !D.outil) { D.selectBande(null); } }}>
      {/* Feuille */}
      <div style={{ position: 'relative', width: pageW * pxMm, background: def.page.background || '#fff', boxShadow: '0 4px 18px rgb(10 18 34 / .22)', paddingTop: m.top * pxMm, paddingBottom: m.bottom * pxMm, paddingLeft: m.left * pxMm, boxSizing: 'border-box', minHeight: Math.min(pageH, 60) * pxMm }}>
        {/* Marges */}
        <div aria-hidden style={{ position: 'absolute', left: m.left * pxMm, right: m.right * pxMm, top: m.top * pxMm, bottom: m.bottom * pxMm, border: '1px dashed rgb(36 80 224 / .28)', pointerEvents: 'none' }} />

        {bandes.map((b, idx) => {
          const accent = COULEUR_BANDE[b.type];
          const selectionnee = D.bandeSel === b.id && D.sel.length === 0;
          const retrait = b.parent ? 14 : 0;
          return (
            <Fragment key={b.id}>
              <div style={{ marginLeft: retrait * 0, width: largeur * pxMm, position: 'relative' }}>
                {/* Bandeau de bande */}
                <div onPointerDown={(e) => { if (e.button === 0 && !D.outil) { e.stopPropagation(); D.selectBande(b.id); } }}
                     className="flex items-center gap-1.5 px-2 text-[10.5px] font-bold"
                     style={{ height: 18, background: selectionnee ? accent : `${accent}22`, color: selectionnee ? '#fff' : accent, borderLeft: `3px solid ${accent}`, marginLeft: retrait * pxMm * 0, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {b.parent && <span title="Bande de détail">↳</span>}
                  <span>{BAND_LABELS[b.type]}</span>
                  <span style={{ opacity: .75, fontWeight: 600 }}>{b.name !== BAND_LABELS[b.type] ? `· ${b.name}` : ''}{b.dataSource ? ` · ${b.dataSource}` : ''}{b.groupBy ? ` · par ${b.groupBy}` : ''}{b.columns && b.columns > 1 ? ` · ${b.columns} col.` : ''}</span>
                  {selectionnee && (
                    <span className="ml-auto flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
                      <button title="Monter" onClick={() => D.set(deplacerBande(def, b.id, -1))} className="p-0.5 rounded hover:bg-white/25"><Ic n="chevU" size={13} /></button>
                      <button title="Descendre" onClick={() => D.set(deplacerBande(def, b.id, 1))} className="p-0.5 rounded hover:bg-white/25"><Ic n="chevD" size={13} /></button>
                      <button title="Dupliquer la bande" onClick={() => { const r = dupliquerBande(def, b.id); D.set(r.def); D.selectBande(r.id); }} className="p-0.5 rounded hover:bg-white/25"><Ic n="copy" size={13} /></button>
                      <button title="Supprimer la bande" onClick={() => { D.set(supprimerBande(def, b.id)); D.selectBande(null); }} className="p-0.5 rounded hover:bg-white/25"><Ic n="trash" size={13} /></button>
                    </span>
                  )}
                </div>

                {/* Corps de bande */}
                <div ref={(el) => { if (el) corps.current.set(b.id, el); else corps.current.delete(b.id); }}
                     onPointerDown={(e) => debutCorps(e, b)}
                     onPointerMove={(e) => { const p = versBande(b.id, e.clientX, e.clientY); onPointeur?.({ x: p.x, y: p.y, bande: b.name }); }}
                     onPointerLeave={() => onPointeur?.(null)}
                     onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-gcr-champ')) e.preventDefault(); }}
                     onDrop={(e) => surDepot(e, b)}
                     style={{ position: 'relative', height: b.height * pxMm, width: largeur * pxMm, backgroundColor: '#fff', outline: selectionnee ? `1.5px solid ${accent}` : '1px solid rgb(148 163 184 / .5)', cursor: D.outil ? 'crosshair' : 'default', ...quadrillage }}>
                  {b.objects.map((o) => (
                    <ObjetVisuel key={o.id} o={o} styles={styles} pxMm={pxMm} zoom={zoom} valeurs={valeurs ?? null}
                                 selectionne={D.sel.includes(o.id)}
                                 onPointerDown={(e) => debutObjet(e, o, b)}
                                 onDoubleClick={() => {
                                   if (o.locked) return;
                                   if (o.type === 'text') setEdition({ id: o.id, texte: o.text });
                                   else onEditionTexte?.(o.id);
                                 }} />
                  ))}

                  {/* Guides d'aimantation */}
                  {guides && guides.bande === b.id && (
                    <>
                      {guides.x.map((x, i) => <div key={`gx${i}`} style={{ position: 'absolute', left: x * pxMm, top: 0, bottom: 0, width: 0, borderLeft: '1px solid #E11D74', pointerEvents: 'none' }} />)}
                      {guides.y.map((y, i) => <div key={`gy${i}`} style={{ position: 'absolute', top: y * pxMm, left: 0, right: 0, height: 0, borderTop: '1px solid #E11D74', pointerEvents: 'none' }} />)}
                    </>
                  )}

                  {/* Rectangle de sélection / tracé */}
                  {rectVisible && rectVisible.bande === b.id && (
                    <div style={{ position: 'absolute', left: rectVisible.r.x * pxMm, top: rectVisible.r.y * pxMm, width: rectVisible.r.w * pxMm, height: rectVisible.r.h * pxMm,
                      border: `1px ${rectVisible.dessin ? 'dashed' : 'solid'} #2450E0`, background: rectVisible.dessin ? 'rgb(36 80 224 / .06)' : 'rgb(36 80 224 / .10)', pointerEvents: 'none' }} />
                  )}

                  {/* Poignées (sélection unique) */}
                  {D.sel.length === 1 && b.objects.filter((o) => o.id === D.sel[0] && !o.locked).map((o) => (
                    <Fragment key={`p${o.id}`}>
                      {POIGNEES.map((h) => (
                        <div key={h.id} onPointerDown={(e) => debutPoignee(e, o, b, h.id)}
                             style={{ position: 'absolute', left: (o.x + o.w * h.x) * pxMm - 4, top: (o.y + o.h * h.y) * pxMm - 4, width: 8, height: 8, background: '#fff', border: '1.5px solid #2450E0', borderRadius: 2, cursor: h.curseur, zIndex: 5 }} />
                      ))}
                    </Fragment>
                  ))}

                  {/* Édition en place */}
                  {edition && b.objects.some((o) => o.id === edition.id) && (() => {
                    const o = b.objects.find((x) => x.id === edition.id)! as TextObj;
                    return (
                      <textarea autoFocus value={edition.texte} spellCheck={false}
                                onChange={(e) => setEdition({ id: edition.id, texte: e.target.value })}
                                onBlur={validerEdition}
                                onPointerDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Escape') setEdition(null);
                                  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) validerEdition();
                                }}
                                style={{ position: 'absolute', left: o.x * pxMm, top: o.y * pxMm, width: Math.max(o.w * pxMm, 120), height: Math.max(o.h * pxMm, 28), zIndex: 10, resize: 'both',
                                  font: `${(o.font?.bold ? 'bold ' : '')}${ptVersPx(o.font?.size ?? DEFAULT_FONT.size) * zoom}px ${o.font?.family ?? DEFAULT_FONT.family}`, border: '2px solid #2450E0', background: '#fff', color: '#000', padding: 2, boxShadow: '0 4px 14px rgb(0 0 0 / .25)' }} />
                    );
                  })()}
                </div>

                {/* Poignée de hauteur de bande */}
                <div onPointerDown={(e) => debutRedimBande(e, b)} title="Glisser pour changer la hauteur de la bande"
                     style={{ height: 6, cursor: 'ns-resize', background: selectionnee ? `${accent}55` : 'transparent', marginBottom: idx === bandes.length - 1 ? 0 : 4 }}
                     className="hover:bg-[rgb(36_80_224_/_.25)]" />
              </div>
            </Fragment>
          );
        })}

        {bandes.length === 0 && (
          <div className="text-center text-[13px] py-16" style={{ color: '#94A3B8', width: largeur * pxMm }}>
            Aucune bande. Ajoutez-en depuis le menu « Bandes » pour commencer à composer l’état.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rendu d'un objet en mode conception ────────────────────────────────────

function cadreCss(o: ObjDef, styles: StyleDef[], pxMm: number): CSSProperties {
  const st = styles.find((s) => s.name === o.style);
  const b = { ...DEFAULT_BORDER, ...(st?.border ?? {}), ...(o.border ?? {}) };
  const fond = o.fill || st?.fill;
  const cote = (actif: boolean) => (actif ? `${Math.max(1, b.width * pxMm)}px ${b.style} ${b.color}` : undefined);
  return {
    background: fond, borderTop: cote(b.top), borderRight: cote(b.right), borderBottom: cote(b.bottom), borderLeft: cote(b.left),
    borderRadius: b.radius ? b.radius * pxMm : undefined,
  };
}

function ObjetVisuel({ o, styles, pxMm, zoom, valeurs, selectionne, onPointerDown, onDoubleClick }: {
  o: ObjDef; styles: StyleDef[]; pxMm: number; zoom: number; valeurs: Scope | null; selectionne: boolean;
  onPointerDown: (e: React.PointerEvent) => void; onDoubleClick: () => void;
}) {
  const boite: CSSProperties = {
    position: 'absolute', left: o.x * pxMm, top: o.y * pxMm, width: o.w * pxMm, height: o.h * pxMm, boxSizing: 'border-box',
    outline: selectionne ? '1.5px solid #2450E0' : '1px dashed rgb(100 116 139 / .0)', cursor: o.locked ? 'not-allowed' : 'move', overflow: 'hidden',
    ...cadreCss(o, styles, pxMm),
  };
  const survol = 'hover:outline hover:outline-1 hover:outline-[rgb(36_80_224_/_.45)]';

  switch (o.type) {
    case 'text': {
      const st = styles.find((s) => s.name === o.style);
      const f = { ...DEFAULT_FONT, ...(st?.font ?? {}), ...(o.font ?? {}) };
      const pad = (o.padding ?? 0.5) * pxMm;
      const va = o.valign === 'middle' ? 'center' : o.valign === 'bottom' ? 'flex-end' : 'flex-start';
      const segs = segmenter(o.text);
      const resolu = valeurs ? resoudreTexte(o.text, valeurs, o.format) : null;
      return (
        <div onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} className={survol} style={{ ...boite, display: 'flex', flexDirection: 'column', justifyContent: va }}>
          <div style={{
            fontFamily: `'${f.family}', Arial, sans-serif`, fontSize: ptVersPx(f.size) * zoom, fontWeight: f.bold ? 700 : 400, fontStyle: f.italic ? 'italic' : 'normal',
            color: f.color, textAlign: o.align ?? st?.align ?? 'left', lineHeight: o.lineHeight ?? 1.2, padding: pad,
            textDecoration: [f.underline ? 'underline' : '', f.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
            whiteSpace: o.wordWrap === false ? 'pre' : 'pre-wrap', overflowWrap: 'anywhere', width: '100%', boxSizing: 'border-box',
          }}>
            {resolu ? (resolu.texte || <span style={{ opacity: .3 }}>∅</span>) : segs.length === 0 ? <span style={{ opacity: .35 }}>(vide)</span> : segs.map((s, i) => ('lit' in s
              ? <span key={i}>{s.lit}</span>
              : <span key={i} style={{ background: 'rgb(36 80 224 / .12)', color: '#1D3FB8', borderRadius: 2, padding: '0 1px' }}>[{s.expr}]</span>))}
          </div>
          {o.locked && <span style={{ position: 'absolute', right: 1, top: 1, color: '#64748B' }}><Ic n="lock" size={10} /></span>}
        </div>
      );
    }
    case 'image':
      return (
        <div onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} className={survol} style={{ ...boite, background: o.fill ?? '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
          {o.src && !o.expr
            ? <img src={o.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: o.fit === 'stretch' ? 'fill' : o.fit ?? 'contain', opacity: o.opacity ?? 1, pointerEvents: 'none' }} />
            : <div className="flex flex-col items-center text-[10px] gap-0.5 px-1 text-center"><Ic n="image" size={Math.min(24, o.w * pxMm * 0.5)} />{o.expr ? `[${o.expr}]` : 'Image'}</div>}
        </div>
      );
    case 'line': {
      const w = Math.max(o.w, 0.1), h = Math.max(o.h, 0.1);
      const [x1, y1, x2, y2] = o.direction === 'v' ? [w / 2, 0, w / 2, h] : o.direction === 'diag' ? [0, 0, w, h] : o.direction === 'antidiag' ? [0, h, w, 0] : [0, h / 2, w, h / 2];
      return (
        <div onPointerDown={onPointerDown} className={survol} style={{ ...boite, overflow: 'visible', minWidth: 6, minHeight: 6 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={o.color ?? '#000'} strokeWidth={o.lineWidth ?? 0.3}
                  strokeDasharray={o.dash === 'dashed' ? '2 1.2' : o.dash === 'dotted' ? '0.4 0.8' : undefined} />
          </svg>
          <div style={{ position: 'absolute', inset: -3 }} />
        </div>
      );
    }
    case 'shape':
      return <div onPointerDown={onPointerDown} className={survol} style={{ ...boite, borderRadius: o.shape === 'ellipse' ? '50%' : boite.borderRadius }} />;
    case 'barcode': {
      const valeur = valeurs ? resoudreTexte(o.value, valeurs).texte : o.value.includes('[') ? '123456789012' : o.value;
      return (
        <div onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} className={survol} style={{ ...boite, background: o.fill ?? '#fff' }}>
          <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
               dangerouslySetInnerHTML={{ __html: codeBarresSvg(o.symbology, valeur, o.w, o.h, { texte: o.showText !== false, couleur: o.color }) }} />
          {!valeurs && o.value.includes('[') && <span style={{ position: 'absolute', left: 2, top: 1, fontSize: 9, background: 'rgb(255 255 255 / .85)', color: '#1D3FB8', padding: '0 2px', borderRadius: 2 }}>{o.value}</span>}
        </div>
      );
    }
    case 'checkbox':
      return (
        <div onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} className={survol} style={boite}>
          <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
            <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke={o.color ?? '#000'} strokeWidth="0.6" />
            <path d="M2.2 5.2 L4.3 7.3 L7.9 2.8" fill="none" stroke={o.color ?? '#000'} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
          </svg>
        </div>
      );
  }
}
