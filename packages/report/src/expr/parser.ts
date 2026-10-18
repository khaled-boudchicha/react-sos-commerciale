/**
 * Parseur d'expressions des états. Aucun eval / Function : les modèles viennent de fichiers
 * (parfois importés) et la CSP de l'application interdit l'évaluation dynamique.
 *
 * Grammaire (priorités croissantes) :
 *   ternaire  a ? b : c
 *   ou        ||  or  ou
 *   et        &&  and et
 *   égalité   =  ==  <>  !=
 *   relation  <  <=  >  >=
 *   concat    &
 *   somme     +  -
 *   produit   *  /  %
 *   unaire    -  !  not
 *   primaire  nombre  'texte'  "texte"  true  false  null  chemin.pointé  fonction(args)  (expr)
 */

export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'path'; p: string[] }
  | { t: 'call'; n: string; a: Node[] }
  | { t: 'un'; op: string; x: Node }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'cond'; c: Node; a: Node; b: Node };

export class ErreurExpression extends Error {}

type Tok = { k: 'num' | 'str' | 'id' | 'op' | 'end'; v: string; pos: number };

const OPS3 = ['==='];
const OPS2 = ['==', '<>', '!=', '<=', '>=', '&&', '||'];
const OPS1 = ['+', '-', '*', '/', '%', '(', ')', ',', '<', '>', '=', '&', '!', '?', ':'];

const estDebutId = (c: string) => /[\p{L}_$@#]/u.test(c);
const estSuiteId = (c: string) => /[\p{L}\p{N}_$@#]/u.test(c);

function lexer(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ k: 'num', v: src.slice(i, j), pos: i });
      i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) { j++; s += src[j] === 'n' ? '\n' : src[j] === 't' ? '\t' : src[j]; }
        else s += src[j];
        j++;
      }
      if (j >= src.length) throw new ErreurExpression('Chaîne non terminée');
      out.push({ k: 'str', v: s, pos: i });
      i = j + 1; continue;
    }
    if (estDebutId(c)) {
      let j = i + 1;
      while (j < src.length && estSuiteId(src[j])) j++;
      out.push({ k: 'id', v: src.slice(i, j), pos: i });
      i = j; continue;
    }
    const t3 = src.slice(i, i + 3), t2 = src.slice(i, i + 2);
    if (OPS3.includes(t3)) { out.push({ k: 'op', v: '==', pos: i }); i += 3; continue; }
    if (OPS2.includes(t2)) { out.push({ k: 'op', v: t2, pos: i }); i += 2; continue; }
    if (OPS1.includes(c)) { out.push({ k: 'op', v: c, pos: i }); i++; continue; }
    if (c === '.') { out.push({ k: 'op', v: '.', pos: i }); i++; continue; }
    throw new ErreurExpression(`Caractère inattendu « ${c} » (position ${i + 1})`);
  }
  out.push({ k: 'end', v: '', pos: src.length });
  return out;
}

class Parseur {
  private i = 0;
  constructor(private readonly toks: Tok[], private readonly src: string) {}

  private get cur() { return this.toks[this.i]; }
  private op(v: string) { return this.cur.k === 'op' && this.cur.v === v; }
  private mot(...vs: string[]) { return this.cur.k === 'id' && vs.includes(this.cur.v.toLowerCase()); }
  private eat() { return this.toks[this.i++]; }
  private attendre(v: string) {
    if (!this.op(v)) throw new ErreurExpression(`« ${v} » attendu (position ${this.cur.pos + 1})`);
    this.i++;
  }

  racine(): Node {
    const n = this.ternaire();
    if (this.cur.k !== 'end') throw new ErreurExpression(`Élément inattendu « ${this.cur.v} » (position ${this.cur.pos + 1})`);
    return n;
  }

  private ternaire(): Node {
    const c = this.ou();
    if (this.op('?')) {
      this.eat();
      const a = this.ternaire();
      this.attendre(':');
      const b = this.ternaire();
      return { t: 'cond', c, a, b };
    }
    return c;
  }

  private ou(): Node {
    let l = this.et();
    while (this.op('||') || this.mot('or', 'ou')) { this.eat(); l = { t: 'bin', op: '||', l, r: this.et() }; }
    return l;
  }

  private et(): Node {
    let l = this.egalite();
    while (this.op('&&') || this.mot('and', 'et')) { this.eat(); l = { t: 'bin', op: '&&', l, r: this.egalite() }; }
    return l;
  }

  private egalite(): Node {
    let l = this.relation();
    while (this.op('=') || this.op('==') || this.op('<>') || this.op('!=')) {
      const op = this.eat().v;
      l = { t: 'bin', op: op === '==' ? '=' : op === '!=' ? '<>' : op, l, r: this.relation() };
    }
    return l;
  }

  private relation(): Node {
    let l = this.concat();
    while (this.op('<') || this.op('<=') || this.op('>') || this.op('>=')) {
      const op = this.eat().v;
      l = { t: 'bin', op, l, r: this.concat() };
    }
    return l;
  }

  private concat(): Node {
    let l = this.somme();
    while (this.op('&')) { this.eat(); l = { t: 'bin', op: '&', l, r: this.somme() }; }
    return l;
  }

  private somme(): Node {
    let l = this.produit();
    while (this.op('+') || this.op('-')) { const op = this.eat().v; l = { t: 'bin', op, l, r: this.produit() }; }
    return l;
  }

  private produit(): Node {
    let l = this.unaire();
    while (this.op('*') || this.op('/') || this.op('%')) { const op = this.eat().v; l = { t: 'bin', op, l, r: this.unaire() }; }
    return l;
  }

  private unaire(): Node {
    if (this.op('-')) { this.eat(); return { t: 'un', op: '-', x: this.unaire() }; }
    if (this.op('+')) { this.eat(); return this.unaire(); }
    if (this.op('!') || this.mot('not', 'non')) { this.eat(); return { t: 'un', op: '!', x: this.unaire() }; }
    return this.primaire();
  }

  private primaire(): Node {
    const t = this.cur;
    if (t.k === 'num') { this.eat(); const v = Number(t.v); if (!Number.isFinite(v)) throw new ErreurExpression(`Nombre invalide « ${t.v} »`); return { t: 'num', v }; }
    if (t.k === 'str') { this.eat(); return { t: 'str', v: t.v }; }
    if (this.op('(')) { this.eat(); const n = this.ternaire(); this.attendre(')'); return n; }
    if (t.k === 'id') {
      const bas = t.v.toLowerCase();
      if (bas === 'true' || bas === 'vrai') { this.eat(); return { t: 'bool', v: true }; }
      if (bas === 'false' || bas === 'faux') { this.eat(); return { t: 'bool', v: false }; }
      if (bas === 'null' || bas === 'nul') { this.eat(); return { t: 'null' }; }
      this.eat();
      if (this.op('(')) {
        this.eat();
        const a: Node[] = [];
        if (!this.op(')')) {
          do { a.push(this.ternaire()); } while (this.op(',') && (this.eat(), true));
        }
        this.attendre(')');
        return { t: 'call', n: t.v.toUpperCase(), a };
      }
      const p = [t.v];
      while (this.op('.')) {
        this.eat();
        if (this.cur.k !== 'id' && this.cur.k !== 'num') throw new ErreurExpression(`Nom de champ attendu après « . » (position ${this.cur.pos + 1})`);
        p.push(this.eat().v);
      }
      return { t: 'path', p };
    }
    throw new ErreurExpression(this.cur.k === 'end' ? 'Expression incomplète' : `Élément inattendu « ${this.cur.v} » (position ${this.cur.pos + 1})`);
  }
}

const cache = new Map<string, Node | ErreurExpression>();

/** Compile une expression (mise en cache). Lève ErreurExpression si elle est invalide. */
export function compiler(src: string): Node {
  const k = src.trim();
  let r = cache.get(k);
  if (!r) {
    try {
      if (!k) throw new ErreurExpression('Expression vide');
      r = new Parseur(lexer(k), k).racine();
    } catch (e) {
      r = e instanceof ErreurExpression ? e : new ErreurExpression(String((e as Error)?.message ?? e));
    }
    if (cache.size > 2000) cache.clear();
    cache.set(k, r);
  }
  if (r instanceof ErreurExpression) throw r;
  return r;
}

/** Valide une expression ; renvoie le message d'erreur ou null. */
export function validerExpression(src: string): string | null {
  try { compiler(src); return null; } catch (e) { return (e as Error).message; }
}

// ─── Texte à segments : `Total : [Facture.total] DA` ──────────────────────────

export type Segment = { lit: string } | { expr: string };

/** Découpe un texte en littéraux et expressions `[…]` (crochets imbriqués et chaînes gérés ; `\[` = crochet littéral). */
export function segmenter(texte: string): Segment[] {
  const out: Segment[] = [];
  let lit = '';
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (c === '\\' && (texte[i + 1] === '[' || texte[i + 1] === ']' || texte[i + 1] === '\\')) { lit += texte[i + 1]; i += 2; continue; }
    if (c !== '[') { lit += c; i++; continue; }
    let depth = 1, j = i + 1, quote = '';
    while (j < texte.length && depth > 0) {
      const d = texte[j];
      if (quote) { if (d === '\\') j++; else if (d === quote) quote = ''; }
      else if (d === '"' || d === "'") quote = d;
      else if (d === '[') depth++;
      else if (d === ']') depth--;
      j++;
    }
    if (depth > 0) { lit += texte.slice(i); i = texte.length; break; }
    if (lit) { out.push({ lit }); lit = ''; }
    out.push({ expr: texte.slice(i + 1, j - 1) });
    i = j;
  }
  if (lit) out.push({ lit });
  return out;
}

/** Toutes les expressions d'un texte (pour valider / lister les champs utilisés). */
export function expressionsDuTexte(texte: string): string[] {
  return segmenter(texte).flatMap((s) => ('expr' in s ? [s.expr] : []));
}
