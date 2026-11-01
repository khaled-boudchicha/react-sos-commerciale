import { ApolloLink, Observable, type FetchResult, type Operation } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { useSession } from '../store/session';
import { DelaiDepasseError, estPanneTransport } from './erreurs';

/**
 * Cache hors ligne des RÉFÉRENTIELS, sur le poste (IndexedDB).
 *
 * Quand le serveur ne répond pas (panne de transport, après les relances), certaines lectures sont
 * servies depuis la dernière réponse connue, pour continuer à préparer des tickets et à imprimer :
 * - référentiels (familles, dépôts, banques, modes de paiement, TVA, unités), coordonnées société,
 *   sous-familles, rayons : réponse complète, valable 7 jours ;
 * - articles : chaque article reçu (recherche, scan, fiche) est mémorisé ; hors ligne, la recherche,
 *   le scan par code-barres et par code se font sur ces articles connus, valables 24 h (prix, stock).
 *
 * Règles de fraîcheur :
 * - une réponse en ligne remplace toujours le cache (le cache ne sert JAMAIS quand le serveur répond) ;
 * - au-delà de sa durée de validité, une donnée n'est plus servie ;
 * - toute modification d'article, de tarif ou de référentiel faite depuis l'application vide le cache du
 *   dossier ; la déconnexion vide tout le cache du poste ;
 * - clé = agent + dossier : aucun mélange entre établissements ou exercices.
 * L'encaissement reste bloqué hors ligne : le cache ne sert qu'à la consultation et à la préparation.
 */

export const VALIDITE_REFERENTIELS_MS = 7 * 24 * 3600_000;
export const VALIDITE_ARTICLES_MS = 24 * 3600_000;

/** Lectures servies telles quelles (réponse complète) quand le serveur est injoignable. */
const REPONSES_COMPLETES = new Set(['Referentiels', 'CoordonneesSociete', 'SousFamilles', 'Rayons']);
/** Lectures d'articles : alimentent l'index local et sont rejouées dessus hors ligne. */
const RECHERCHE_ARTICLES = new Set(['Articles']);
const ARTICLE_PAR_CODE_BARRE = new Set(['ArticleParCodeBarre', 'ArticleParCodeBarreComptoir']);
const ARTICLE_PAR_CODE = new Set(['ArticleParCodeComptoir']);
const ARTICLE_SEUL = new Set(['Article']);
/** Une écriture réussie dont le nom correspond rend le cache du dossier douteux : on le vide. */
const ECRITURES_INVALIDANTES = /article|tarif|barcode|famille|depot|rayon|unite|tva|banque|mode.?pa[iy]ement|societe|coordonnees/i;

type Entree<T = unknown> = { date: number; donnees: T };
export type ArticleConnu = Record<string, unknown> & { id: number; code?: string | null; designation?: string | null; code_bare?: string | null };

/* ─── Stockage : IndexedDB, ou mémoire (tests, navigateur sans IndexedDB) ─────────────────────── */

interface Stockage {
  lire<T>(table: Table, cle: string): Promise<Entree<T> | null>;
  /** Écriture groupée (une seule transaction). */
  ecrire(table: Table, entrees: [string, Entree][]): Promise<void>;
  /** Toutes les entrées dont la clé commence par `prefixe`. */
  parPrefixe<T>(table: Table, prefixe: string): Promise<Entree<T>[]>;
  supprimerPrefixe(table: Table, prefixe: string): Promise<void>;
  compter(table: Table, prefixe: string): Promise<number>;
}
type Table = 'reponses' | 'articles';

function stockageMemoire(): Stockage {
  const tables: Record<Table, Map<string, Entree>> = { reponses: new Map(), articles: new Map() };
  const filtrer = (t: Table, p: string) => [...tables[t].entries()].filter(([k]) => k.startsWith(p));
  return {
    lire: async <T,>(t: Table, k: string) => (tables[t].get(k) as Entree<T> | undefined) ?? null,
    ecrire: async (t, entrees) => { for (const [k, v] of entrees) tables[t].set(k, v); },
    parPrefixe: async <T,>(t: Table, p: string) => filtrer(t, p).map(([, v]) => v as Entree<T>),
    supprimerPrefixe: async (t, p) => { for (const [k] of filtrer(t, p)) tables[t].delete(k); },
    compter: async (t, p) => filtrer(t, p).length,
  };
}

function stockageIndexedDB(idb: IDBFactory): Stockage {
  let base: Promise<IDBDatabase> | null = null;
  const ouvrir = () => (base ??= new Promise<IDBDatabase>((ok, ko) => {
    const r = idb.open('gc-hors-ligne', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('reponses'); r.result.createObjectStore('articles'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { base = null; ko(r.error); };
  }));
  const plage = (p: string) => IDBKeyRange.bound(p, `${p}￿`);
  const requete = <T,>(t: Table, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    ouvrir().then((db) => new Promise<T>((ok, ko) => {
      const r = fn(db.transaction(t, mode).objectStore(t));
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    }));
  return {
    lire: async <T,>(t: Table, k: string) => ((await requete(t, 'readonly', (s) => s.get(k))) as Entree<T> | undefined) ?? null,
    ecrire: (t, entrees) => ouvrir().then((db) => new Promise<void>((ok, ko) => {
      const tx = db.transaction(t, 'readwrite');
      const s = tx.objectStore(t);
      for (const [k, v] of entrees) s.put(v, k);
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
      tx.onabort = () => ko(tx.error);
    })),
    parPrefixe: async <T,>(t: Table, p: string) => (await requete(t, 'readonly', (s) => s.getAll(plage(p)))) as Entree<T>[],
    supprimerPrefixe: async (t, p) => { await requete(t, 'readwrite', (s) => s.delete(plage(p))); },
    compter: (t, p) => requete(t, 'readonly', (s) => s.count(plage(p))),
  };
}

let stockage: Stockage = typeof indexedDB !== 'undefined' ? stockageIndexedDB(indexedDB) : stockageMemoire();
/** Tests : stockage en mémoire neuf. */
export function utiliserStockageMemoire() { stockage = stockageMemoire(); }

/* ─── Clés et règles (fonctions pures, testées) ────────────────────────────────────────────────── */

/** JSON à clés triées : `{a,b}` et `{b,a}` donnent la même clé. */
export function jsonStable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(jsonStable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${jsonStable(o[k])}`).join(',')}}`;
}

/** Préfixe agent + dossier courant (null hors session : rien n'est mis en cache). */
export function prefixeDossier(dossierOverride?: string | null): string | null {
  const { agent, dossier } = useSession.getState();
  const d = dossierOverride ?? dossier;
  if (!agent?.agentId || !d) return null;
  return `${agent.agentId}|${d}|`;
}

export const estValide = (e: Entree | null, validiteMs: number, maintenant = Date.now()): boolean =>
  !!e && maintenant - e.date >= 0 && maintenant - e.date < validiteMs;

const normaliser = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Recherche locale (hors ligne) dans les articles connus : tous les mots saisis doivent apparaître dans
 * la désignation, le code ou le code-barres ; les codes exacts et les débuts de désignation d'abord.
 */
export function rechercheLocale(articles: ArticleConnu[], terme: string, limite = 12): ArticleConnu[] {
  const mots = normaliser(terme).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [];
  const t = normaliser(terme);
  const score = (a: ArticleConnu) => {
    const code = normaliser(a.code); const des = normaliser(a.designation);
    if (code === t || normaliser(a.code_bare) === t) return 0;
    if (des.startsWith(t) || code.startsWith(t)) return 1;
    return 2;
  };
  return articles
    .filter((a) => {
      const texte = `${normaliser(a.designation)} ${normaliser(a.code)} ${normaliser(a.code_bare)}`;
      return mots.every((m) => texte.includes(m));
    })
    .sort((a, b) => score(a) - score(b) || normaliser(a.designation).localeCompare(normaliser(b.designation)))
    .slice(0, limite);
}

/** Articles contenus dans une réponse (liste paginée, article seul ou null). */
export function articlesDeReponse(nomOperation: string, data: Record<string, unknown> | null | undefined): ArticleConnu[] {
  if (!data) return [];
  const estArticle = (a: unknown): a is ArticleConnu => !!a && typeof a === 'object' && Number.isFinite(Number((a as ArticleConnu).id));
  if (RECHERCHE_ARTICLES.has(nomOperation)) {
    const liste = (data.articles as { data?: unknown[] } | undefined)?.data;
    return Array.isArray(liste) ? liste.filter(estArticle) : [];
  }
  const seul = ARTICLE_PAR_CODE_BARRE.has(nomOperation) ? data.articleParCodeBarre
    : ARTICLE_PAR_CODE.has(nomOperation) ? data.articleParCode
      : ARTICLE_SEUL.has(nomOperation) ? data.article : null;
  return estArticle(seul) ? [seul] : [];
}

/* ─── Lecture / écriture ───────────────────────────────────────────────────────────────────────── */

async function memoriser(op: Operation, data: Record<string, unknown>) {
  const prefixe = prefixeDossier(op.getContext().dossierOverride);
  if (!prefixe) return;
  const nom = op.operationName;
  const date = Date.now();
  if (REPONSES_COMPLETES.has(nom)) {
    await stockage.ecrire('reponses', [[`${prefixe}${nom}|${jsonStable(op.variables)}`, { date, donnees: data }]]);
  }
  const articles = articlesDeReponse(nom, data);
  if (articles.length) await stockage.ecrire('articles', articles.map((a) => [`${prefixe}${a.id}`, { date, donnees: a }]));
}

async function articlesValides(prefixe: string): Promise<{ articles: ArticleConnu[]; plusAncien: number | null }> {
  const maintenant = Date.now();
  const entrees = (await stockage.parPrefixe<ArticleConnu>('articles', prefixe)).filter((e) => estValide(e, VALIDITE_ARTICLES_MS, maintenant));
  return {
    articles: entrees.map((e) => e.donnees),
    plusAncien: entrees.length ? Math.min(...entrees.map((e) => e.date)) : null,
  };
}

/**
 * Réponse de secours pour une lecture, ou null si le cache n'a rien de valable.
 * Les listes d'articles portent `horsLigne` (date de la donnée la plus ancienne) pour l'affichage.
 */
export async function reponseDeSecours(op: Pick<Operation, 'operationName' | 'variables' | 'getContext'>): Promise<Record<string, unknown> | null> {
  const prefixe = prefixeDossier(op.getContext().dossierOverride);
  if (!prefixe) return null;
  const nom = op.operationName;
  const v = (op.variables ?? {}) as Record<string, unknown>;

  if (REPONSES_COMPLETES.has(nom)) {
    const e = await stockage.lire<Record<string, unknown>>('reponses', `${prefixe}${nom}|${jsonStable(op.variables)}`);
    return estValide(e, VALIDITE_REFERENTIELS_MS) ? e!.donnees : null;
  }
  if (RECHERCHE_ARTICLES.has(nom)) {
    // Filtres que le cache ne sait pas reproduire (famille, alertes, grille) : pas de réponse approximative
    if (v.famille || v.stock_alerte || v.marge_negative || v.grille || Number(v.offset) > 0) return null;
    const { articles, plusAncien } = await articlesValides(prefixe);
    if (!articles.length) return null;
    const trouves = rechercheLocale(articles, String(v.search ?? ''), Number(v.limit) || 12);
    return { articles: { data: trouves, total: trouves.length, horsLigne: plusAncien } };
  }
  const code = normaliser(v.code);
  if (code && (ARTICLE_PAR_CODE_BARRE.has(nom) || ARTICLE_PAR_CODE.has(nom))) {
    const { articles } = await articlesValides(prefixe);
    const champ = ARTICLE_PAR_CODE_BARRE.has(nom) ? 'code_bare' : 'code';
    const a = articles.find((x) => normaliser(x[champ]) === code);
    // Introuvable localement : on ne conclut pas « inconnu » (l'erreur réseau d'origine est rendue)
    return a ? { [ARTICLE_PAR_CODE_BARRE.has(nom) ? 'articleParCodeBarre' : 'articleParCode']: a } : null;
  }
  if (ARTICLE_SEUL.has(nom) && Number.isFinite(Number(v.id))) {
    const e = await stockage.lire<ArticleConnu>('articles', `${prefixe}${Number(v.id)}`);
    return estValide(e, VALIDITE_ARTICLES_MS) ? { article: e!.donnees } : null;
  }
  return null;
}

/** Vide le cache d'un dossier (modification de référentiel / d'article) ou tout le poste. */
export async function viderCacheHorsLigne(prefixe = ''): Promise<void> {
  try {
    await stockage.supprimerPrefixe('reponses', prefixe);
    await stockage.supprimerPrefixe('articles', prefixe);
  } catch { /* stockage indisponible */ }
}

/** Contenu du cache pour le dossier courant (écran Diagnostic). */
export async function etatCacheHorsLigne(): Promise<{ articles: number; reponses: number; plusAncien: number | null } | null> {
  const prefixe = prefixeDossier();
  if (!prefixe) return null;
  try {
    const { articles, plusAncien } = await articlesValides(prefixe);
    return { articles: articles.length, reponses: await stockage.compter('reponses', prefixe), plusAncien };
  } catch { return null; }
}

/* ─── Lien Apollo ──────────────────────────────────────────────────────────────────────────────── */

const estLecture = (op: Operation) => {
  const d = getMainDefinition(op.query);
  return d.kind === 'OperationDefinition' && d.operation === 'query';
};
const concerne = (nom: string) => REPONSES_COMPLETES.has(nom) || RECHERCHE_ARTICLES.has(nom)
  || ARTICLE_PAR_CODE_BARRE.has(nom) || ARTICLE_PAR_CODE.has(nom) || ARTICLE_SEUL.has(nom);

/**
 * À placer EN TÊTE de la chaîne (avant l'errorLink) : la panne est d'abord comptée et journalisée,
 * puis remplacée ici par la réponse de secours si le cache en a une.
 */
export const horsLigneLink = new ApolloLink((operation, forward) => {
  const lecture = estLecture(operation);
  const nom = operation.operationName;

  if (!lecture) {
    // Écriture réussie sur un référentiel ou un article : le cache du dossier n'est plus fiable
    if (!ECRITURES_INVALIDANTES.test(nom)) return forward(operation);
    return forward(operation).map((r) => {
      const prefixe = prefixeDossier(operation.getContext().dossierOverride);
      if (!r.errors?.length && prefixe) void viderCacheHorsLigne(prefixe);
      return r;
    });
  }
  if (!concerne(nom)) return forward(operation);

  return new Observable<FetchResult>((observer) => {
    const sub = forward(operation).subscribe({
      next: (r) => {
        if (r.data && !r.errors?.length) void memoriser(operation, r.data as Record<string, unknown>).catch(() => {});
        observer.next(r);
      },
      complete: () => observer.complete(),
      error: (e) => {
        const panne = e instanceof DelaiDepasseError || estPanneTransport(e as { statusCode?: number });
        if (!panne) { observer.error(e); return; }
        reponseDeSecours(operation)
          .then((data) => {
            if (!data) { observer.error(e); return; }
            observer.next({ data });
            observer.complete();
          })
          .catch(() => observer.error(e));
      },
    });
    return () => sub.unsubscribe();
  });
});

/* La déconnexion vide le cache du poste (données de l'établissement non chiffrées sur le disque). */
useSession.subscribe((s, avant) => {
  if (avant.token && !s.token) void viderCacheHorsLigne();
});
