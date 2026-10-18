import { compiler, ErreurExpression, Node, segmenter } from './parser';
import { appliquerFormat, formaterDate, formaterNombre, versDate, versNombre } from '../format';
import type { FormatDef } from '../model';
import { enLettres } from '../lang/enLettres';
import { documenterFonction, type FonctionDoc } from '../data/functions';

/**
 * Portée d'évaluation. Chaque portée possède :
 *  - `vars`  : valeurs courantes par nom (ligne courante d'un dataset, paramètres, variables, système)
 *  - `sets`  : fenêtres d'agrégation par nom de dataset (toutes les lignes, ou celles du groupe courant)
 * et se chaîne à une portée parente.
 */
/** Variable calculée à la demande (variables d'état) : évaluée dans la portée de l'appelant. */
export class Lazy {
  constructor(readonly expr: string) {}
}

let profondeurLazy = 0;

export class Scope {
  readonly vars = new Map<string, unknown>();
  readonly sets = new Map<string, unknown[]>();
  constructor(readonly parent: Scope | null = null) {}

  enfant(): Scope { return new Scope(this); }

  lire(nom: string): { trouve: boolean; valeur?: unknown } {
    const bas = nom.toLowerCase();
    for (let s: Scope | null = this; s; s = s.parent) {
      if (s.vars.has(bas)) return { trouve: true, valeur: s.vars.get(bas) };
    }
    return { trouve: false };
  }

  fenetre(nom: string): unknown[] | null {
    const bas = nom.toLowerCase();
    for (let s: Scope | null = this; s; s = s.parent) {
      if (s.sets.has(bas)) return s.sets.get(bas)!;
    }
    return null;
  }

  definir(nom: string, v: unknown): this { this.vars.set(nom.toLowerCase(), v); return this; }
  definirFenetre(nom: string, rows: unknown[]): this { this.sets.set(nom.toLowerCase(), rows); return this; }
}

const AGREGATS = new Set(['SUM', 'SOMME', 'COUNT', 'NB', 'AVG', 'MOYENNE', 'MIN', 'MAX', 'FIRST', 'LAST', 'SUMIF', 'SOMMESI', 'COUNTIF', 'NBSI', 'DISTINCTCOUNT']);

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

function lireChemin(scope: Scope, p: string[]): unknown {
  const tete = scope.lire(p[0]);
  if (!tete.trouve) return undefined;
  let v = tete.valeur;
  if (v instanceof Lazy) {
    if (profondeurLazy > 8) return undefined; // variable qui se référence elle-même
    profondeurLazy++;
    try { v = evaluerExpression(v.expr, scope).valeur; } finally { profondeurLazy--; }
  }
  for (let i = 1; i < p.length; i++) {
    if (v == null) return undefined;
    if (Array.isArray(v)) { v = v[Number(p[i])]; continue; }
    if (!estObjet(v)) return undefined;
    const cle = Object.keys(v).find((k) => k.toLowerCase() === p[i].toLowerCase());
    v = cle === undefined ? undefined : v[cle];
  }
  return v;
}

export const estVide = (v: unknown) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));

export function vers_bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v == null || v === '') return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  return !(s === '0' || s === 'false' || s === 'faux' || s === 'non' || s === 'no');
}

function texte(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return formaterDate(v);
  return String(v);
}

function comparer(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const da = a instanceof Date ? a : null, db = b instanceof Date ? b : null;
  if (da || db) { const x = versDate(a), y = versDate(b); if (x && y) return x.getTime() - y.getTime(); }
  if (typeof a === 'number' || typeof b === 'number') {
    const x = versNombre(a), y = versNombre(b);
    if (x != null && y != null) return x - y;
  }
  return String(a).localeCompare(String(b), 'fr', { sensitivity: 'base', numeric: true });
}

export { comparer as comparerValeurs };

/** Premier chemin « dataset.champ » d'un sous-arbre (pour savoir sur quel dataset porte un agrégat). */
function premiereTete(n: Node, scope: Scope): string | null {
  switch (n.t) {
    case 'path': return scope.fenetre(n.p[0]) ? n.p[0] : null;
    case 'call': for (const a of n.a) { const r = premiereTete(a, scope); if (r) return r; } return null;
    case 'un': return premiereTete(n.x, scope);
    case 'bin': return premiereTete(n.l, scope) ?? premiereTete(n.r, scope);
    case 'cond': return premiereTete(n.c, scope) ?? premiereTete(n.a, scope) ?? premiereTete(n.b, scope);
    default: return null;
  }
}

function evalAgregat(nom: string, args: Node[], scope: Scope): unknown {
  // COUNT(Dataset) / COUNT() : nombre de lignes de la fenêtre
  let tete: string | null = null;
  for (const a of args) { tete = premiereTete(a, scope); if (tete) break; }
  if (!tete && args[0]?.t === 'path') tete = scope.fenetre(args[0].p[0]) ? args[0].p[0] : null;
  const rows = tete ? scope.fenetre(tete)! : [];
  const surLigne = (row: unknown) => scope.enfant().definir(tete!, row);
  const nombres = (n: Node) => rows.map((r) => versNombre(evaluer(n, surLigne(r)))).filter((x): x is number => x != null);

  switch (nom) {
    case 'COUNT': case 'NB':
      if (!args.length || (args.length === 1 && args[0].t === 'path' && args[0].p.length === 1)) return rows.length;
      return rows.filter((r) => !estVide(evaluer(args[0], surLigne(r)))).length;
    case 'DISTINCTCOUNT': return new Set(rows.map((r) => String(evaluer(args[0], surLigne(r))))).size;
    case 'SUM': case 'SOMME': return nombres(args[0]).reduce((s, x) => s + x, 0);
    case 'AVG': case 'MOYENNE': { const n = nombres(args[0]); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : 0; }
    case 'MIN': { const n = nombres(args[0]); return n.length ? Math.min(...n) : 0; }
    case 'MAX': { const n = nombres(args[0]); return n.length ? Math.max(...n) : 0; }
    case 'FIRST': return rows.length ? evaluer(args[0], surLigne(rows[0])) : null;
    case 'LAST': return rows.length ? evaluer(args[0], surLigne(rows[rows.length - 1])) : null;
    case 'SUMIF': case 'SOMMESI': // SUMIF(valeur, condition)
      return rows.filter((r) => vers_bool(evaluer(args[1], surLigne(r)))).reduce((s: number, r) => s + (versNombre(evaluer(args[0], surLigne(r))) ?? 0), 0);
    case 'COUNTIF': case 'NBSI':
      return rows.filter((r) => vers_bool(evaluer(args[0], surLigne(r)))).length;
  }
  return null;
}

type Fn = (a: unknown[]) => unknown;

const num = (v: unknown) => versNombre(v) ?? 0;

const FONCTIONS: Record<string, Fn> = {
  // Texte
  UPPER: (a) => texte(a[0]).toUpperCase(), MAJUSCULE: (a) => texte(a[0]).toUpperCase(),
  LOWER: (a) => texte(a[0]).toLowerCase(), MINUSCULE: (a) => texte(a[0]).toLowerCase(),
  PROPER: (a) => texte(a[0]).toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, p, c: string) => p + c.toUpperCase()),
  TRIM: (a) => texte(a[0]).trim(), SUPPRESPACE: (a) => texte(a[0]).trim(),
  LEN: (a) => texte(a[0]).length, NBCAR: (a) => texte(a[0]).length,
  LEFT: (a) => texte(a[0]).slice(0, num(a[1])), GAUCHE: (a) => texte(a[0]).slice(0, num(a[1])),
  RIGHT: (a) => { const s = texte(a[0]), n = num(a[1]); return n <= 0 ? '' : s.slice(-n); },
  DROITE: (a) => { const s = texte(a[0]), n = num(a[1]); return n <= 0 ? '' : s.slice(-n); },
  MID: (a) => texte(a[0]).substr(Math.max(0, num(a[1]) - 1), a[2] == null ? undefined : num(a[2])),
  REPLACE: (a) => texte(a[0]).split(texte(a[1])).join(texte(a[2])),
  CONTAINS: (a) => texte(a[0]).toLowerCase().includes(texte(a[1]).toLowerCase()),
  STARTSWITH: (a) => texte(a[0]).toLowerCase().startsWith(texte(a[1]).toLowerCase()),
  ENDSWITH: (a) => texte(a[0]).toLowerCase().endsWith(texte(a[1]).toLowerCase()),
  PADLEFT: (a) => texte(a[0]).padStart(num(a[1]), a[2] == null ? ' ' : texte(a[2])),
  PADRIGHT: (a) => texte(a[0]).padEnd(num(a[1]), a[2] == null ? ' ' : texte(a[2])),
  REPEAT: (a) => texte(a[0]).repeat(Math.max(0, Math.min(500, num(a[1])))),
  CONCAT: (a) => a.map(texte).join(''),
  TEXT: (a) => texte(a[0]), STR: (a) => texte(a[0]),
  VAL: (a) => versNombre(a[0]) ?? 0, NUM: (a) => versNombre(a[0]) ?? 0,
  // Logique
  IIF: (a) => (vers_bool(a[0]) ? a[1] : a[2]), IF: (a) => (vers_bool(a[0]) ? a[1] : a[2]), SI: (a) => (vers_bool(a[0]) ? a[1] : a[2]),
  ISNULL: (a) => estVide(a[0]), ISEMPTY: (a) => estVide(a[0]) || texte(a[0]).trim() === '', ESTVIDE: (a) => estVide(a[0]),
  COALESCE: (a) => a.find((x) => !estVide(x)) ?? null,
  NOT: (a) => !vers_bool(a[0]), AND: (a) => a.every(vers_bool), OR: (a) => a.some(vers_bool),
  // Maths (MIN/MAX à ≥ 2 arguments = scalaires ; à 1 argument = agrégats)
  ROUND: (a) => { const n = num(a[0]), d = a[1] == null ? 0 : num(a[1]); return Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d; },
  ARRONDI: (a) => { const n = num(a[0]), d = a[1] == null ? 0 : num(a[1]); return Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d; },
  FLOOR: (a) => Math.floor(num(a[0])), CEIL: (a) => Math.ceil(num(a[0])), INT: (a) => Math.trunc(num(a[0])),
  ABS: (a) => Math.abs(num(a[0])), SIGN: (a) => Math.sign(num(a[0])), POW: (a) => num(a[0]) ** num(a[1]),
  MOD: (a) => (num(a[1]) === 0 ? 0 : num(a[0]) % num(a[1])),
  // Dates
  TODAY: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  NOW: () => new Date(),
  YEAR: (a) => versDate(a[0])?.getFullYear() ?? null, MONTH: (a) => (versDate(a[0])?.getMonth() ?? -1) + 1 || null, DAY: (a) => versDate(a[0])?.getDate() ?? null,
  DATEADD: (a) => { const d = versDate(a[0]); if (!d) return null; const r = new Date(d); r.setDate(r.getDate() + num(a[1])); return r; },
  DATEDIFF: (a) => { const x = versDate(a[0]), y = versDate(a[1]); return x && y ? Math.round((y.getTime() - x.getTime()) / 86400000) : null; },
  FORMATDATE: (a) => formaterDate(a[0], a[1] == null ? 'dd/MM/yyyy' : texte(a[1])),
  FORMATNUM: (a) => formaterNombre(a[0], a[1] == null ? '#,##0.00' : texte(a[1])),
  // FORMAT(valeur, motif) : date si le motif contient des lettres de date et que la valeur en est une, sinon nombre
  FORMAT: (a) => {
    const motif = a[1] == null ? '' : texte(a[1]);
    if (/[yMdHhms]/.test(motif) && versDate(a[0]) && typeof a[0] !== 'number') return formaterDate(a[0], motif);
    return formaterNombre(a[0], motif || '#,##0.00');
  },
  // Montants
  ENLETTRES: (a) => enLettres(num(a[0])),
};

/**
 * Ajoute (ou remplace) une fonction du langage d'expressions : l'application hôte y déclare ses fonctions métier
 * (ex. `ARRETE`). Le nom est insensible à la casse ; `doc` la fait apparaître dans le catalogue du designer.
 */
export function enregistrerFonction(nom: string, fn: (args: unknown[]) => unknown, doc?: Omit<FonctionDoc, 'nom'>): void {
  const cle = nom.toUpperCase();
  FONCTIONS[cle] = fn;
  if (doc) documenterFonction({ ...doc, nom: cle });
}

const SCALAIRES_MIN_MAX: Record<string, Fn> = {
  MIN: (a) => Math.min(...a.map(num)),
  MAX: (a) => Math.max(...a.map(num)),
};

/** Évalue un nœud. Les erreurs d'exécution deviennent des ErreurExpression. */
export function evaluer(n: Node, scope: Scope): unknown {
  switch (n.t) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'null': return null;
    case 'path': {
      const v = lireChemin(scope, n.p);
      return v === undefined ? null : v;
    }
    case 'un': {
      const x = evaluer(n.x, scope);
      return n.op === '!' ? !vers_bool(x) : -num(x);
    }
    case 'cond': return vers_bool(evaluer(n.c, scope)) ? evaluer(n.a, scope) : evaluer(n.b, scope);
    case 'call': {
      if (AGREGATS.has(n.n) && !(SCALAIRES_MIN_MAX[n.n] && n.a.length >= 2)) return evalAgregat(n.n, n.a, scope);
      if (n.n === 'IIF' || n.n === 'IF' || n.n === 'SI') {
        if (n.a.length < 2) throw new ErreurExpression(`${n.n} attend 2 ou 3 arguments`);
        return vers_bool(evaluer(n.a[0], scope)) ? evaluer(n.a[1], scope) : n.a[2] ? evaluer(n.a[2], scope) : null;
      }
      const fn = (SCALAIRES_MIN_MAX[n.n] && n.a.length >= 2) ? SCALAIRES_MIN_MAX[n.n] : FONCTIONS[n.n];
      if (!fn) throw new ErreurExpression(`Fonction inconnue « ${n.n} »`);
      return fn(n.a.map((a) => evaluer(a, scope)));
    }
    case 'bin': {
      if (n.op === '&&') return vers_bool(evaluer(n.l, scope)) && vers_bool(evaluer(n.r, scope));
      if (n.op === '||') return vers_bool(evaluer(n.l, scope)) || vers_bool(evaluer(n.r, scope));
      const a = evaluer(n.l, scope), b = evaluer(n.r, scope);
      switch (n.op) {
        case '+': {
          const sa = typeof a === 'string', sb = typeof b === 'string';
          if (!sa && !sb) return (versNombre(a) ?? 0) + (versNombre(b) ?? 0);
          const na = versNombre(a), nb = versNombre(b);
          // texte numérique + nombre → addition ; sinon concaténation
          if ((sa && !sb && na != null && typeof b === 'number') || (sb && !sa && nb != null && typeof a === 'number')) return (na ?? 0) + (nb ?? 0);
          return texte(a) + texte(b);
        }
        case '&': return texte(a) + texte(b);
        case '-': return num(a) - num(b);
        case '*': return num(a) * num(b);
        case '/': return num(b) === 0 ? 0 : num(a) / num(b);
        case '%': return num(b) === 0 ? 0 : num(a) % num(b);
        case '=': return comparer(a, b) === 0;
        case '<>': return comparer(a, b) !== 0;
        case '<': return comparer(a, b) < 0;
        case '<=': return comparer(a, b) <= 0;
        case '>': return comparer(a, b) > 0;
        case '>=': return comparer(a, b) >= 0;
      }
      throw new ErreurExpression(`Opérateur inconnu « ${n.op} »`);
    }
  }
}

/** Compile + évalue une expression ; renvoie { valeur } ou { erreur }. */
export function evaluerExpression(src: string, scope: Scope): { valeur: unknown; erreur?: string } {
  try {
    return { valeur: evaluer(compiler(src), scope) };
  } catch (e) {
    return { valeur: null, erreur: (e as Error).message };
  }
}

/** Évalue une expression booléenne (visibilité, filtre). Vide = vrai ; erreur = vrai (on n'efface pas silencieusement). */
export function evaluerCondition(src: string | undefined, scope: Scope): boolean {
  if (!src || !src.trim()) return true;
  const r = evaluerExpression(src, scope);
  return r.erreur ? true : vers_bool(r.valeur);
}

export type ResultatTexte = { texte: string; erreurs: string[]; valeurBrute?: unknown; estNombre: boolean };

/**
 * Résout un texte à expressions `[…]`. Si le texte est UNE seule expression, la valeur typée
 * reçoit le format de l'objet (nombre, date…) ; sinon chaque segment est converti en texte.
 */
export function resoudreTexte(modele: string, scope: Scope, format?: FormatDef): ResultatTexte {
  const segs = segmenter(modele);
  const erreurs: string[] = [];
  if (segs.length === 1 && 'expr' in segs[0]) {
    const r = evaluerExpression(segs[0].expr, scope);
    if (r.erreur) { erreurs.push(r.erreur); return { texte: '#ERREUR', erreurs, estNombre: false }; }
    return { texte: appliquerFormat(r.valeur, format), erreurs, valeurBrute: r.valeur, estNombre: typeof r.valeur === 'number' };
  }
  let sortie = '';
  for (const s of segs) {
    if ('lit' in s) { sortie += s.lit; continue; }
    const r = evaluerExpression(s.expr, scope);
    if (r.erreur) { erreurs.push(r.erreur); sortie += '#ERREUR'; } else sortie += appliquerFormat(r.valeur, format?.kind === 'text' ? format : undefined);
  }
  return { texte: sortie, erreurs, estNombre: false };
}
