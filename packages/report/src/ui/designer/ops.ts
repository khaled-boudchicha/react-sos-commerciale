import {
  BandDef, BandType, ObjDef, ReportDef, cloner, creerBande, dimensionsPage, nouvelId,
} from '../../model';

/**
 * Opérations pures sur un modèle d'état (aucune dépendance React) : toutes renvoient un NOUVEAU
 * modèle, ce qui donne l'annuler/rétablir gratuitement et les rend testables.
 */

export type Sel = string[];

const arrondir = (n: number) => Math.round(n * 100) / 100;

export function trouverObjet(def: ReportDef, id: string): { bande: BandDef; objet: ObjDef } | null {
  for (const bande of def.bands) {
    const objet = bande.objects.find((o) => o.id === id);
    if (objet) return { bande, objet };
  }
  return null;
}

export function bandeDe(def: ReportDef, id: string): BandDef | undefined {
  return def.bands.find((b) => b.id === id);
}

export function objetsSelectionnes(def: ReportDef, sel: Sel): { bande: BandDef; objet: ObjDef }[] {
  return sel.flatMap((id) => { const r = trouverObjet(def, id); return r ? [r] : []; });
}

/** Largeur utile d'une bande (largeur de page moins marges). */
export function largeurBande(def: ReportDef): number {
  const { w } = dimensionsPage(def.page);
  return Math.max(10, w - def.page.margins.left - def.page.margins.right);
}

export function snap(v: number, pas: number): number {
  return pas > 0 ? Math.round(v / pas) * pas : v;
}

function mapObjets(def: ReportDef, ids: Set<string>, f: (o: ObjDef, b: BandDef) => ObjDef): ReportDef {
  return { ...def, bands: def.bands.map((b) => (b.objects.some((o) => ids.has(o.id)) ? { ...b, objects: b.objects.map((o) => (ids.has(o.id) ? f(o, b) : o)) } : b)) };
}

/** Applique un correctif partiel à des objets. */
export function majObjets(def: ReportDef, ids: Sel, patch: Partial<ObjDef> | ((o: ObjDef) => Partial<ObjDef>)): ReportDef {
  return mapObjets(def, new Set(ids), (o) => ({ ...o, ...(typeof patch === 'function' ? patch(o) : patch) }) as ObjDef);
}

export function majBande(def: ReportDef, id: string, patch: Partial<BandDef>): ReportDef {
  return { ...def, bands: def.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}

export function ajouterObjet(def: ReportDef, bandeId: string, objet: ObjDef): ReportDef {
  return { ...def, bands: def.bands.map((b) => (b.id === bandeId ? { ...b, objects: [...b.objects, objet] } : b)) };
}

export function supprimerObjets(def: ReportDef, sel: Sel): ReportDef {
  const ids = new Set(sel);
  return { ...def, bands: def.bands.map((b) => (b.objects.some((o) => ids.has(o.id)) ? { ...b, objects: b.objects.filter((o) => !ids.has(o.id)) } : b)) };
}

/** Déplace de (dx, dy) mm en gardant chaque objet dans sa bande (les objets verrouillés ne bougent pas). */
export function deplacerObjets(def: ReportDef, sel: Sel, dx: number, dy: number, largeur: number, pas = 0): ReportDef {
  return mapObjets(def, new Set(sel), (o, b) => {
    if (o.locked) return o;
    const x = Math.min(Math.max(snap(o.x + dx, pas), 0), Math.max(0, largeur - o.w));
    const y = Math.min(Math.max(snap(o.y + dy, pas), 0), Math.max(0, b.height - Math.min(o.h, b.height)));
    return { ...o, x: arrondir(x), y: arrondir(y) };
  });
}

/** Fait passer des objets dans une autre bande en conservant leur position visuelle relative. */
export function changerDeBande(def: ReportDef, sel: Sel, versBandeId: string, decalageY = 0): ReportDef {
  const ids = new Set(sel);
  const cible = bandeDe(def, versBandeId);
  if (!cible) return def;
  const deplaces: ObjDef[] = [];
  const bandes = def.bands.map((b) => {
    if (b.id === versBandeId) return b;
    const sortants = b.objects.filter((o) => ids.has(o.id));
    if (!sortants.length) return b;
    deplaces.push(...sortants.map((o) => ({ ...o, y: arrondir(Math.min(Math.max(o.y + decalageY, 0), Math.max(0, cible.height - o.h))) })));
    return { ...b, objects: b.objects.filter((o) => !ids.has(o.id)) };
  });
  return { ...def, bands: bandes.map((b) => (b.id === versBandeId ? { ...b, objects: [...b.objects, ...deplaces] } : b)) };
}

export function redimensionner(def: ReportDef, id: string, x: number, y: number, w: number, h: number, largeur: number): ReportDef {
  const nx = Math.min(Math.max(x, 0), largeur - 0.5);
  const nw = Math.max(0.5, Math.min(w, largeur - nx));
  return majObjets(def, [id], { x: arrondir(nx), y: arrondir(Math.max(0, y)), w: arrondir(nw), h: arrondir(Math.max(0.3, h)) });
}

// ─── Alignement ─────────────────────────────────────────────────────────────

export type Alignement = 'left' | 'right' | 'centerH' | 'top' | 'bottom' | 'middle';

export function aligner(def: ReportDef, sel: Sel, mode: Alignement): ReportDef {
  const objs = objetsSelectionnes(def, sel).map((r) => r.objet).filter((o) => !o.locked);
  if (objs.length < 2) return def;
  const minX = Math.min(...objs.map((o) => o.x)), maxX = Math.max(...objs.map((o) => o.x + o.w));
  const minY = Math.min(...objs.map((o) => o.y)), maxY = Math.max(...objs.map((o) => o.y + o.h));
  return majObjets(def, objs.map((o) => o.id), (o) => {
    switch (mode) {
      case 'left': return { x: arrondir(minX) };
      case 'right': return { x: arrondir(maxX - o.w) };
      case 'centerH': return { x: arrondir((minX + maxX) / 2 - o.w / 2) };
      case 'top': return { y: arrondir(minY) };
      case 'bottom': return { y: arrondir(maxY - o.h) };
      case 'middle': return { y: arrondir((minY + maxY) / 2 - o.h / 2) };
    }
  });
}

/** Répartit régulièrement l'espace entre au moins 3 objets. */
export function distribuer(def: ReportDef, sel: Sel, sens: 'h' | 'v'): ReportDef {
  const objs = objetsSelectionnes(def, sel).map((r) => r.objet).filter((o) => !o.locked);
  if (objs.length < 3) return def;
  const tri = [...objs].sort((a, b) => (sens === 'h' ? a.x - b.x : a.y - b.y));
  const debut = sens === 'h' ? tri[0].x : tri[0].y;
  const dernier = tri[tri.length - 1];
  const fin = sens === 'h' ? dernier.x + dernier.w : dernier.y + dernier.h;
  const total = tri.reduce((s, o) => s + (sens === 'h' ? o.w : o.h), 0);
  const ecart = (fin - debut - total) / (tri.length - 1);
  const pos = new Map<string, number>();
  let courant = debut;
  for (const o of tri) { pos.set(o.id, arrondir(courant)); courant += (sens === 'h' ? o.w : o.h) + ecart; }
  return majObjets(def, tri.map((o) => o.id), (o) => (sens === 'h' ? { x: pos.get(o.id)! } : { y: pos.get(o.id)! }));
}

/** Même largeur / hauteur que le premier objet sélectionné. */
export function memeTaille(def: ReportDef, sel: Sel, dim: 'w' | 'h'): ReportDef {
  const [ref, ...autres] = objetsSelectionnes(def, sel).map((r) => r.objet);
  if (!ref || !autres.length) return def;
  return majObjets(def, autres.filter((o) => !o.locked).map((o) => o.id), dim === 'w' ? { w: ref.w } : { h: ref.h });
}

// ─── Ordre d'empilement (z) ─────────────────────────────────────────────────

export function ordreZ(def: ReportDef, sel: Sel, mode: 'front' | 'back' | 'forward' | 'backward'): ReportDef {
  const ids = new Set(sel);
  return {
    ...def,
    bands: def.bands.map((b) => {
      if (!b.objects.some((o) => ids.has(o.id))) return b;
      const choisis = b.objects.filter((o) => ids.has(o.id));
      const autres = b.objects.filter((o) => !ids.has(o.id));
      if (mode === 'front') return { ...b, objects: [...autres, ...choisis] };
      if (mode === 'back') return { ...b, objects: [...choisis, ...autres] };
      const liste = [...b.objects];
      if (mode === 'forward') {
        for (let i = liste.length - 2; i >= 0; i--) if (ids.has(liste[i].id) && !ids.has(liste[i + 1].id)) [liste[i], liste[i + 1]] = [liste[i + 1], liste[i]];
      } else {
        for (let i = 1; i < liste.length; i++) if (ids.has(liste[i].id) && !ids.has(liste[i - 1].id)) [liste[i], liste[i - 1]] = [liste[i - 1], liste[i]];
      }
      return { ...b, objects: liste };
    }),
  };
}

// ─── Copier / coller / dupliquer ────────────────────────────────────────────

export type PressePapier = { objets: ObjDef[]; bandeId: string };

export function copier(def: ReportDef, sel: Sel): PressePapier | null {
  const r = objetsSelectionnes(def, sel);
  if (!r.length) return null;
  return { objets: cloner(r.map((x) => x.objet)), bandeId: r[0].bande.id };
}

/** Colle dans une bande (décalage de 3 mm). Renvoie le nouveau modèle et les ids créés. */
export function coller(def: ReportDef, presse: PressePapier, bandeId: string, decalage = 3): { def: ReportDef; ids: string[] } {
  const bande = bandeDe(def, bandeId) ?? bandeDe(def, presse.bandeId) ?? def.bands[0];
  if (!bande) return { def, ids: [] };
  const largeur = largeurBande(def);
  const nouveaux = presse.objets.map((o) => ({
    ...cloner(o), id: nouvelId('o'),
    x: arrondir(Math.min(o.x + decalage, Math.max(0, largeur - o.w))),
    y: arrondir(Math.min(o.y + decalage, Math.max(0, bande.height - Math.min(o.h, bande.height)))),
  }));
  return { def: { ...def, bands: def.bands.map((b) => (b.id === bande.id ? { ...b, objects: [...b.objects, ...nouveaux] } : b)) }, ids: nouveaux.map((o) => o.id) };
}

export function dupliquer(def: ReportDef, sel: Sel): { def: ReportDef; ids: string[] } {
  const p = copier(def, sel);
  return p ? coller(def, p, p.bandeId) : { def, ids: [] };
}

// ─── Bandes ─────────────────────────────────────────────────────────────────

/** Ajoute une bande après `apresId` (ou en fin). Les bandes `data` reprennent la source de la précédente. */
export function ajouterBande(def: ReportDef, type: BandType, apresId?: string, over: Partial<BandDef> = {}): { def: ReportDef; id: string } {
  const b = creerBande(type, over);
  const i = apresId ? def.bands.findIndex((x) => x.id === apresId) : -1;
  const bands = [...def.bands];
  bands.splice(i >= 0 ? i + 1 : bands.length, 0, b);
  return { def: { ...def, bands }, id: b.id };
}

/** Supprime une bande et ses bandes de détail. */
export function supprimerBande(def: ReportDef, id: string): ReportDef {
  const aSupprimer = new Set([id, ...def.bands.filter((b) => b.parent === id).map((b) => b.id)]);
  return { ...def, bands: def.bands.filter((b) => !aSupprimer.has(b.id)) };
}

export function deplacerBande(def: ReportDef, id: string, sens: -1 | 1): ReportDef {
  const i = def.bands.findIndex((b) => b.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= def.bands.length) return def;
  const bands = [...def.bands];
  [bands[i], bands[j]] = [bands[j], bands[i]];
  return { ...def, bands };
}

export function dupliquerBande(def: ReportDef, id: string): { def: ReportDef; id: string } {
  const i = def.bands.findIndex((b) => b.id === id);
  if (i < 0) return { def, id };
  const copie: BandDef = { ...cloner(def.bands[i]), id: nouvelId('b'), name: `${def.bands[i].name} (copie)`, objects: def.bands[i].objects.map((o) => ({ ...cloner(o), id: nouvelId('o') })) };
  const bands = [...def.bands];
  bands.splice(i + 1, 0, copie);
  return { def: { ...def, bands }, id: copie.id };
}

/** Bornes du rectangle englobant une sélection (coordonnées de bande). */
export function englobant(def: ReportDef, sel: Sel): { x: number; y: number; w: number; h: number } | null {
  const objs = objetsSelectionnes(def, sel).map((r) => r.objet);
  if (!objs.length) return null;
  const x = Math.min(...objs.map((o) => o.x)), y = Math.min(...objs.map((o) => o.y));
  return { x, y, w: Math.max(...objs.map((o) => o.x + o.w)) - x, h: Math.max(...objs.map((o) => o.y + o.h)) - y };
}
