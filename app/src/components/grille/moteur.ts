import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { ColonneGrille, EtatGrille, FiltreColonne, Resume, TypeDonnee } from './types';

/**
 * Moteur de données de la grille — fonctions pures, testées (src/__tests__/grille.test.ts).
 * Chaîne : filtres de colonne → filtres d'en-tête → recherche → tri → groupes → totaux →
 * aplatissement (groupes repliés) → pagination.
 */

// ─── Colonnes ────────────────────────────────────────────────────────────────

/** Colonnes déclarées, ou déduites des clés de la première ligne (colonnes auto). */
export function colonnesEffectives<T>(colonnes: ColonneGrille<T>[] | undefined, donnees: T[]): ColonneGrille<T>[] {
  if (colonnes?.length) return colonnes;
  const premiere = donnees[0] as Record<string, unknown> | undefined;
  if (!premiere) return [];
  return Object.keys(premiere).map((champ) => {
    const v = premiere[champ];
    const type: TypeDonnee = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean'
      : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? 'date' : 'string';
    return { champ, titre: champ, type };
  });
}

/** Colonnes dans l'ordre de l'état, sans les masquées. */
export function colonnesVisibles<T>(colonnes: ColonneGrille<T>[], etat: Pick<EtatGrille, 'ordreColonnes' | 'masquees'>): ColonneGrille<T>[] {
  const parChamp = new Map(colonnes.map((c) => [c.champ, c]));
  const ordonnees = [
    ...etat.ordreColonnes.map((c) => parChamp.get(c)).filter(Boolean) as ColonneGrille<T>[],
    ...colonnes.filter((c) => !etat.ordreColonnes.includes(c.champ)),
  ];
  const visibles = ordonnees.filter((c) => !etat.masquees.includes(c.champ));
  // Colonnes figées : à gauche en premier, à droite en dernier
  return [
    ...visibles.filter((c) => c.figee === 'gauche'),
    ...visibles.filter((c) => !c.figee),
    ...visibles.filter((c) => c.figee === 'droite'),
  ];
}

export function valeurDe<T>(col: ColonneGrille<T>, ligne: T): unknown {
  return col.valeur ? col.valeur(ligne) : (ligne as Record<string, unknown>)[col.champ];
}

/** Texte affiché / exporté / recherché d'une valeur. */
export function texteDe<T>(col: ColonneGrille<T>, valeur: unknown): string {
  if (col.format) return col.format(valeur);
  if (valeur === null || valeur === undefined || valeur === '') return '';
  if (col.choix) {
    const c = col.choix.find((x) => x.valeur === valeur || String(x.valeur) === String(valeur));
    if (c) return c.libelle;
  }
  switch (col.type) {
    case 'money': return fmtMoney(valeur);
    case 'number': return fmtQte(valeur);
    case 'date': return fmtDate(valeur);
    case 'boolean': return valeur ? 'Oui' : 'Non';
    default: return String(valeur);
  }
}

// ─── Filtres ─────────────────────────────────────────────────────────────────

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Valeur comparable : nombre pour number/money, timestamp pour date, texte sinon. */
function comparable(type: TypeDonnee | undefined, v: unknown): number | string | null {
  if (v === null || v === undefined || v === '') return null;
  if (type === 'number' || type === 'money') { const n = Number(v); return Number.isFinite(n) ? n : null; }
  if (type === 'date') { const t = new Date(String(v)).getTime(); return Number.isFinite(t) ? new Date(new Date(t).toDateString()).getTime() : null; }
  if (type === 'boolean') return v ? 1 : 0;
  return sansAccents(String(v));
}

export function testerFiltre(type: TypeDonnee | undefined, valeur: unknown, f: FiltreColonne, texte?: string): boolean {
  const vide = valeur === null || valeur === undefined || valeur === '';
  if (f.operateur === 'vide') return vide;
  if (f.operateur === 'non_vide') return !vide;
  if (f.valeur === undefined || f.valeur === null || f.valeur === '') return true;
  const operateurTexte = ['contient', 'ne_contient_pas', 'commence', 'finit'].includes(f.operateur);
  if (operateurTexte) {
    const t = sansAccents(texte ?? String(valeur ?? ''));
    const cible = sansAccents(String(f.valeur));
    if (f.operateur === 'contient') return t.includes(cible);
    if (f.operateur === 'ne_contient_pas') return !t.includes(cible);
    if (f.operateur === 'commence') return t.startsWith(cible);
    return t.endsWith(cible);
  }
  const a = comparable(type, valeur);
  const b = comparable(type, f.valeur);
  if (a === null || b === null) return false;
  switch (f.operateur) {
    case '=': return a === b;
    case '<>': return a !== b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    case 'entre': {
      const c = comparable(type, f.valeur2);
      return c === null ? a >= b : a >= b && a <= c;
    }
  }
  return true;
}

/** Opérateur par défaut de la ligne de filtre selon le type. */
export function operateurDefaut(type: TypeDonnee | undefined): FiltreColonne['operateur'] {
  return type === 'number' || type === 'money' || type === 'date' || type === 'boolean' ? '=' : 'contient';
}

export function filtrer<T>(lignes: T[], colonnes: ColonneGrille<T>[], etat: Pick<EtatGrille, 'filtres' | 'filtresEntete' | 'recherche'>): T[] {
  const parChamp = new Map(colonnes.map((c) => [c.champ, c]));
  const filtres = Object.entries(etat.filtres).filter(([champ]) => parChamp.has(champ));
  const entetes = Object.entries(etat.filtresEntete).filter(([champ, vals]) => parChamp.has(champ) && vals.length > 0);
  const recherche = sansAccents(etat.recherche.trim());
  if (!filtres.length && !entetes.length && !recherche) return lignes;
  const cherchables = colonnes.filter((c) => c.visible !== false);
  return lignes.filter((ligne) => {
    for (const [champ, f] of filtres) {
      const col = parChamp.get(champ)!;
      const v = valeurDe(col, ligne);
      if (!testerFiltre(col.type, v, f, texteDe(col, v))) return false;
    }
    for (const [champ, vals] of entetes) {
      const col = parChamp.get(champ)!;
      if (!vals.includes(texteDe(col, valeurDe(col, ligne)))) return false;
    }
    if (recherche) {
      const trouve = cherchables.some((c) => sansAccents(texteDe(c, valeurDe(c, ligne))).includes(recherche));
      if (!trouve) return false;
    }
    return true;
  });
}

/** Valeurs distinctes (texte) d'une colonne, triées, pour le filtre d'en-tête. */
export function valeursDistinctes<T>(lignes: T[], col: ColonneGrille<T>): { texte: string; nombre: number }[] {
  const compte = new Map<string, number>();
  for (const l of lignes) {
    const t = texteDe(col, valeurDe(col, l));
    compte.set(t, (compte.get(t) ?? 0) + 1);
  }
  return [...compte.entries()]
    .map(([texte, nombre]) => ({ texte, nombre }))
    .sort((a, b) => (a.texte === '' ? 1 : b.texte === '' ? -1 : a.texte.localeCompare(b.texte, 'fr', { numeric: true })));
}

// ─── Tri ─────────────────────────────────────────────────────────────────────

/** Compare deux valeurs ; les vides sont toujours en fin, quel que soit le sens. */
export function comparer(type: TypeDonnee | undefined, a: unknown, b: unknown): number {
  const ca = comparable(type, a);
  const cb = comparable(type, b);
  if (ca === null && cb === null) return 0;
  if (ca === null) return 1;
  if (cb === null) return -1;
  if (typeof ca === 'number' && typeof cb === 'number') return ca - cb;
  return String(ca).localeCompare(String(cb), 'fr', { numeric: true });
}

export function trier<T>(lignes: T[], colonnes: ColonneGrille<T>[], tri: EtatGrille['tri']): T[] {
  if (!tri.length) return lignes;
  const parChamp = new Map(colonnes.map((c) => [c.champ, c]));
  const criteres = tri.map((t) => ({ col: parChamp.get(t.champ), sens: t.sens === 'desc' ? -1 : 1 })).filter((c) => c.col);
  return [...lignes].sort((x, y) => {
    for (const { col, sens } of criteres) {
      const a = valeurDe(col!, x);
      const b = valeurDe(col!, y);
      const videA = a === null || a === undefined || a === '';
      const videB = b === null || b === undefined || b === '';
      if (videA !== videB) return videA ? 1 : -1; // vides en fin même en décroissant
      const r = comparer(col!.type, a, b) * sens;
      if (r !== 0) return r;
    }
    return 0;
  });
}

// ─── Totaux ──────────────────────────────────────────────────────────────────

export function calculerResume<T>(resume: Resume<T>, lignes: T[], colonnes: ColonneGrille<T>[]): number | string | null {
  if (resume.type === 'custom') return resume.calculer ? resume.calculer(lignes) : null;
  if (resume.type === 'count') return lignes.length;
  const col = colonnes.find((c) => c.champ === resume.colonne);
  if (!col) return null;
  // Les vides sont ignorés (Number(null) = 0 fausserait moyenne et minimum)
  const nombres = lignes.map((l) => valeurDe(col, l))
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number).filter((n) => Number.isFinite(n));
  if (!nombres.length) return null;
  switch (resume.type) {
    case 'sum': return nombres.reduce((s, n) => s + n, 0);
    case 'avg': return nombres.reduce((s, n) => s + n, 0) / nombres.length;
    case 'min': return Math.min(...nombres);
    case 'max': return Math.max(...nombres);
  }
  return null;
}

export const LIBELLES_RESUME: Record<string, string> = { sum: 'Somme', avg: 'Moy.', min: 'Min', max: 'Max', count: 'Nombre', custom: '' };

// ─── Groupes ─────────────────────────────────────────────────────────────────

export type NoeudGroupe<T> = {
  type: 'groupe';
  cle: string;
  niveau: number;
  champ: string;
  texte: string;
  lignes: T[];
  enfants: NoeudGroupe<T>[] | null;
  /** Mode distant : effectif et totaux calculés par le serveur */
  nombre?: number;
  resumesDistants?: Record<string, number | null>;
};

/** Arbre de groupes (multi-niveaux) ; les lignes de chaque groupe gardent l'ordre trié. */
export function grouper<T>(lignes: T[], colonnes: ColonneGrille<T>[], groupes: string[], niveau = 0, prefixe = ''): NoeudGroupe<T>[] {
  const champ = groupes[niveau];
  const col = colonnes.find((c) => c.champ === champ);
  if (!col) return [];
  const paquets = new Map<string, T[]>();
  for (const l of lignes) {
    const t = texteDe(col, valeurDe(col, l)) || '(vide)';
    if (!paquets.has(t)) paquets.set(t, []);
    paquets.get(t)!.push(l);
  }
  // Groupes triés par valeur (ordre alphabétique / numérique du libellé)
  const cles = [...paquets.keys()].sort((a, b) => {
    const la = paquets.get(a)![0];
    const lb = paquets.get(b)![0];
    return comparer(col.type, valeurDe(col, la), valeurDe(col, lb));
  });
  return cles.map((texte) => {
    const cle = `${prefixe}${champ}=${texte}`;
    const contenu = paquets.get(texte)!;
    return {
      type: 'groupe', cle, niveau, champ, texte, lignes: contenu,
      enfants: niveau + 1 < groupes.length ? grouper(contenu, colonnes, groupes, niveau + 1, `${cle}|`) : null,
    };
  });
}

export type ElementAffiche<T> =
  | { type: 'groupe'; noeud: NoeudGroupe<T>; replie: boolean }
  | { type: 'ligne'; ligne: T }
  /** Mode distant : « Chargement… » ou « Afficher plus » sous un groupe */
  | { type: 'info'; cle: string; niveau: number; texte: string; action?: () => void };

export function estReplie(etat: Pick<EtatGrille, 'groupesBascules' | 'tousReplies'>, cle: string): boolean {
  const bascule = etat.groupesBascules.includes(cle);
  return etat.tousReplies ? !bascule : bascule;
}

/** Liste plate à afficher : en-têtes de groupe puis leurs lignes (si dépliés). */
export function aplatir<T>(noeuds: NoeudGroupe<T>[], etat: Pick<EtatGrille, 'groupesBascules' | 'tousReplies'>): ElementAffiche<T>[] {
  const sortie: ElementAffiche<T>[] = [];
  const parcourir = (liste: NoeudGroupe<T>[]) => {
    for (const n of liste) {
      const replie = estReplie(etat, n.cle);
      sortie.push({ type: 'groupe', noeud: n, replie });
      if (replie) continue;
      if (n.enfants) parcourir(n.enfants);
      else for (const l of n.lignes) sortie.push({ type: 'ligne', ligne: l });
    }
  };
  parcourir(noeuds);
  return sortie;
}

/** Toutes les clés de groupes (tout déplier / replier). */
export function clesGroupes<T>(noeuds: NoeudGroupe<T>[]): string[] {
  return noeuds.flatMap((n) => [n.cle, ...(n.enfants ? clesGroupes(n.enfants) : [])]);
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export function paginer<E>(elements: E[], page: number, taille: number): { elements: E[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(elements.length / Math.max(1, taille)));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { elements: elements.slice(p * taille, p * taille + taille), pages, page: p };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function valider<T>(col: ColonneGrille<T>, valeur: unknown, ligne: T): string | null {
  for (const r of col.validation ?? []) {
    const vide = valeur === null || valeur === undefined || valeur === '';
    if (r.type === 'requis' && vide) return r.message ?? `${col.titre ?? col.champ} : valeur requise.`;
    if (vide) continue;
    if (r.type === 'min' && Number(valeur) < r.valeur) return r.message ?? `Minimum : ${r.valeur}.`;
    if (r.type === 'max' && Number(valeur) > r.valeur) return r.message ?? `Maximum : ${r.valeur}.`;
    if (r.type === 'motif' && !r.motif.test(String(valeur))) return r.message ?? 'Format invalide.';
    if (r.type === 'custom' && !r.valider(valeur, ligne)) return r.message;
  }
  return null;
}
