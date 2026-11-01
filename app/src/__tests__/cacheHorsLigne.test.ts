import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ApolloLink, Observable, execute, gql, type FetchResult } from '@apollo/client';
import {
  VALIDITE_ARTICLES_MS, VALIDITE_REFERENTIELS_MS, etatCacheHorsLigne, horsLigneLink, jsonStable,
  rechercheLocale, utiliserStockageMemoire, type ArticleConnu,
} from '../api/cacheHorsLigne';
import { DelaiDepasseError } from '../api/erreurs';
import { useSession } from '../store/session';

const REFERENTIELS = gql`query Referentiels { familles modesPayement }`;
const ARTICLES = gql`query Articles($search: String, $famille: String, $limit: Int, $offset: Int) { articles(search: $search, famille: $famille, limit: $limit, offset: $offset) }`;
const PAR_CODE_BARRE = gql`query ArticleParCodeBarreComptoir($code: String!) { articleParCodeBarre(code: $code) }`;
const UPDATE_ARTICLE = gql`mutation UpdateArticle($id: Int!) { updateArticle(id: $id) }`;
const CREATE_VENTE = gql`mutation CreateVenteComptoir($input: JSON!) { createVente(input: $input) }`;

const DOLI: ArticleConnu = { id: 1, code: 'DOL500', designation: 'Doliprane 500 mg', code_bare: '3400930000001', prix_vente_ttc: 142.8 };
const AMOX: ArticleConnu = { id: 2, code: 'AMOXI1G', designation: 'Amoxicilline 1 g', code_bare: '3400930000002', prix_vente_ttc: 1006.15 };

/** Serveur simulé : répond `data`, ou échoue avec `erreur`. */
const serveur = (rep: { data?: unknown; erreur?: unknown; errors?: unknown[] }) => new ApolloLink(() => new Observable<FetchResult>((o) => {
  if (rep.erreur) { o.error(rep.erreur); return; }
  o.next({ data: rep.data as never, errors: rep.errors as never }); o.complete();
}));
const panne = () => serveur({ erreur: new TypeError('Failed to fetch') });

function lancer(lien: ApolloLink, query: typeof REFERENTIELS, variables: Record<string, unknown> = {}) {
  return new Promise<{ data?: unknown; erreur?: unknown }>((resolve) => {
    execute(ApolloLink.from([horsLigneLink, lien]), { query, variables })
      .subscribe({ next: (r) => resolve({ data: r.data }), error: (e) => resolve({ erreur: e }) });
  });
}
const attendre = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  utiliserStockageMemoire();
  useSession.setState({ token: 't', dossier: 'GC_2026', agent: { agentId: 'AG-1', label: 'Pharmacie', isOnline: true } });
});
afterEach(() => vi.useRealTimers());

describe('cache hors ligne : référentiels', () => {
  it('sert la dernière réponse quand le serveur est injoignable', async () => {
    const data = { familles: ['Antalgiques'], modesPayement: ['Espece'] };
    expect((await lancer(serveur({ data }), REFERENTIELS)).data).toEqual(data);
    await attendre();
    expect((await lancer(panne(), REFERENTIELS)).data).toEqual(data);
    expect((await lancer(serveur({ erreur: new DelaiDepasseError(35_000) }), REFERENTIELS)).data).toEqual(data);
  });
  it('ne sert jamais au-delà de la durée de validité', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T08:00:00Z'));
    await lancer(serveur({ data: { familles: [] } }), REFERENTIELS);
    await attendre();
    vi.setSystemTime(Date.now() + VALIDITE_REFERENTIELS_MS + 1);
    expect((await lancer(panne(), REFERENTIELS)).erreur).toBeInstanceOf(TypeError);
  });
  it('rien pour un autre dossier ; une erreur métier n’est jamais masquée', async () => {
    await lancer(serveur({ data: { familles: ['A'] } }), REFERENTIELS);
    await attendre();
    useSession.setState({ dossier: 'GC_2025' });
    expect((await lancer(panne(), REFERENTIELS)).erreur).toBeDefined();
    useSession.setState({ dossier: 'GC_2026' });
    const refus = Object.assign(new Error('Bad request'), { statusCode: 400 });
    expect((await lancer(serveur({ erreur: refus }), REFERENTIELS)).erreur).toBe(refus);
  });
  it('une réponse en erreur GraphQL n’est pas mémorisée', async () => {
    await lancer(serveur({ data: { familles: ['X'] }, errors: [{ message: 'droits' }] }), REFERENTIELS);
    await attendre();
    expect((await lancer(panne(), REFERENTIELS)).erreur).toBeDefined();
  });
});

describe('cache hors ligne : articles', () => {
  async function amorcer() {
    await lancer(serveur({ data: { articles: { data: [DOLI, AMOX], total: 2 } } }), ARTICLES, { search: 'o', limit: 12 });
    await attendre();
  }
  it('recherche locale sur les articles déjà consultés, datée', async () => {
    await amorcer();
    const r = await lancer(panne(), ARTICLES, { search: 'doli', limit: 12 });
    const articles = (r.data as { articles: { data: ArticleConnu[]; horsLigne: number } }).articles;
    expect(articles.data.map((a) => a.id)).toEqual([1]);
    expect(typeof articles.horsLigne).toBe('number');
  });
  it('pas de réponse approximative pour un filtre que le cache ne sait pas rejouer', async () => {
    await amorcer();
    expect((await lancer(panne(), ARTICLES, { search: 'doli', famille: 'Antalgiques' })).erreur).toBeDefined();
  });
  it('scan : code-barres connu servi, inconnu → erreur réseau d’origine', async () => {
    await amorcer();
    expect((await lancer(panne(), PAR_CODE_BARRE, { code: '3400930000002' })).data).toEqual({ articleParCodeBarre: AMOX });
    expect((await lancer(panne(), PAR_CODE_BARRE, { code: '999' })).erreur).toBeInstanceOf(TypeError);
  });
  it('articles valables 24 h seulement', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T08:00:00Z'));
    await amorcer();
    vi.setSystemTime(Date.now() + VALIDITE_ARTICLES_MS + 1);
    expect((await lancer(panne(), ARTICLES, { search: 'doli' })).erreur).toBeDefined();
  });
});

describe('cache hors ligne : invalidation', () => {
  it('une modification d’article vide le cache du dossier ; une vente non', async () => {
    await lancer(serveur({ data: { articles: { data: [DOLI], total: 1 } } }), ARTICLES, { search: 'd' });
    await attendre();
    await lancer(serveur({ data: { createVente: { id: 9 } } }), CREATE_VENTE, { input: {} });
    await attendre();
    expect((await etatCacheHorsLigne())?.articles).toBe(1);
    await lancer(serveur({ data: { updateArticle: true } }), UPDATE_ARTICLE, { id: 1 });
    await attendre();
    expect((await etatCacheHorsLigne())?.articles).toBe(0);
  });
  it('la déconnexion vide tout le cache du poste', async () => {
    await lancer(serveur({ data: { familles: ['A'] } }), REFERENTIELS);
    await attendre();
    useSession.setState({ token: null });
    await attendre();
    useSession.setState({ token: 't' });
    expect((await lancer(panne(), REFERENTIELS)).erreur).toBeDefined();
  });
});

describe('outils', () => {
  it('JSON stable : ordre des clés indifférent, undefined ignoré', () => {
    expect(jsonStable({ b: 1, a: { d: 2, c: [1, { y: 1, x: 2 }] }, z: undefined })).toBe(jsonStable({ a: { c: [1, { x: 2, y: 1 }], d: 2 }, b: 1 }));
  });
  it('recherche locale : tous les mots, sans accents, codes exacts d’abord', () => {
    const liste: ArticleConnu[] = [
      { id: 1, code: 'X1', designation: 'Crème hydratante visage' },
      { id: 2, code: 'CREME', designation: 'Zinc crème' },
      { id: 3, code: 'X3', designation: 'Crème mains' },
    ];
    expect(rechercheLocale(liste, 'creme').map((a) => a.id)).toEqual([2, 1, 3]);
    expect(rechercheLocale(liste, 'CRÈME visage').map((a) => a.id)).toEqual([1]);
    expect(rechercheLocale(liste, '  ')).toEqual([]);
  });
});
