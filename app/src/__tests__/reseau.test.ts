import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApolloLink, Observable, gql, execute } from '@apollo/client';
import { SEUIL_ECHECS, etatConnexion, journaliser, useReseau } from '../store/reseau';
import { DelaiDepasseError, estPanneTransport, messageErreur, resultatIncertain } from '../api/erreurs';
import { DELAI_ECRITURE_MS, DELAI_LECTURE_MS, DELAI_LONG_MS, delaiPour, doitRelancer, delaiLink, estEcriture } from '../api/client';
import { ventesSuspectes } from '../screens/comptoir/reprise';
import type { Vente } from '../api/types';

const LECTURE = gql`query Q { a }`;
const ECRITURE = gql`mutation M { b }`;
const op = (query: typeof LECTURE, ctx: Record<string, unknown> = {}) => ({ query, getContext: () => ctx });
const agent = { agentId: 'AG-1', isOnline: true };

describe('état de la connexion', () => {
  const base = { navigateurEnLigne: true, echecsCloud: 0, agents: null };
  it('Internet absent prime sur tout', () => {
    expect(etatConnexion({ ...base, navigateurEnLigne: false, echecsCloud: 5 }, agent).cause).toBe('internet');
  });
  it('serveur injoignable seulement à partir du seuil', () => {
    expect(etatConnexion({ ...base, echecsCloud: SEUIL_ECHECS - 1 }, agent).ok).toBe(true);
    expect(etatConnexion({ ...base, echecsCloud: SEUIL_ECHECS }, agent).cause).toBe('cloud');
  });
  it('agent : la sonde prime sur l’état de connexion, sinon repli', () => {
    expect(etatConnexion({ ...base, agents: [{ agentId: 'AG-1', label: 'A', isOnline: false }] }, agent).cause).toBe('agent');
    expect(etatConnexion({ ...base, agents: [{ agentId: 'AUTRE', label: 'B', isOnline: true }] }, agent).ok).toBe(true);
    expect(etatConnexion(base, { agentId: 'AG-1', isOnline: false }).cause).toBe('agent');
  });
});

describe('store réseau', () => {
  it('compte les échecs, une réponse rétablit', () => {
    const s = useReseau.getState();
    s.reinitialiser();
    s.signalerEchec('Q', 'Serveur injoignable');
    expect(useReseau.getState().echecsCloud).toBe(1);
    s.signalerEchec('Q', 'Serveur injoignable');
    expect(etatConnexion(useReseau.getState(), agent).cause).toBe('cloud');
    s.definirNavigateur(false);
    s.signalerSucces();
    expect(useReseau.getState().echecsCloud).toBe(0);
    expect(useReseau.getState().navigateurEnLigne).toBe(true);
    s.viderJournal();
    expect(useReseau.getState().journal).toEqual([]);
  });
  it('journal : regroupe les répétitions rapprochées et borne la taille', () => {
    let j = journaliser([], 'Q', 'x', 1_000);
    j = journaliser(j, 'Q', 'x', 30_000);
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({ n: 2, debut: 1_000, fin: 30_000 });
    j = journaliser(j, 'Q', 'x', 200_000);
    expect(j).toHaveLength(2);
    for (let i = 0; i < 80; i++) j = journaliser(j, `op${i}`, 'x', 300_000 + i);
    expect(j).toHaveLength(50);
    expect(j[0].operation).toBe('op79');
  });
});

describe('classement des erreurs', () => {
  it('panne de transport : pas de statut ou passerelle indisponible', () => {
    expect(estPanneTransport({ message: 'Failed to fetch' })).toBe(true);
    expect(estPanneTransport({ statusCode: 503 })).toBe(true);
    expect(estPanneTransport({ statusCode: 400 })).toBe(false);
    expect(estPanneTransport({ statusCode: 500 })).toBe(false);
    expect(estPanneTransport(null)).toBe(false);
  });
  it('messages lisibles', () => {
    expect(messageErreur({ message: 'Failed to fetch', networkError: { message: 'Failed to fetch' } })).toMatch(/injoignable/);
    expect(messageErreur({ networkError: { statusCode: 503, message: 'x' } })).toMatch(/HTTP 503/);
    expect(messageErreur(new DelaiDepasseError(15_000))).toMatch(/15 s/);
    expect(messageErreur({ message: 'Stock insuffisant', networkError: null, graphQLErrors: [] })).toBe('Stock insuffisant');
  });
  it('résultat incertain : transport, délai, ou délai signalé par le cloud', () => {
    expect(resultatIncertain({ networkError: new DelaiDepasseError(45_000), graphQLErrors: [] })).toBe(true);
    expect(resultatIncertain({ networkError: { message: 'Failed to fetch' }, graphQLErrors: [] })).toBe(true);
    expect(resultatIncertain({ networkError: null, graphQLErrors: [{ message: 'Agent timeout after 30000ms' }] })).toBe(true);
    expect(resultatIncertain({ networkError: null, graphQLErrors: [{ message: 'x', extensions: { code: 'DEADLINE_EXCEEDED' } }] })).toBe(true);
    expect(resultatIncertain({ networkError: null, graphQLErrors: [{ message: 'Stock insuffisant' }] })).toBe(false);
    expect(resultatIncertain({ networkError: { statusCode: 400 }, graphQLErrors: [] })).toBe(false);
  });
});

describe('relances', () => {
  it('jamais une écriture', () => {
    expect(estEcriture(op(ECRITURE))).toBe(true);
    expect(doitRelancer({ message: 'Failed to fetch' }, op(ECRITURE) as never)).toBe(false);
  });
  it('lecture : sur panne franche seulement', () => {
    expect(doitRelancer({ message: 'Failed to fetch' }, op(LECTURE) as never)).toBe(true);
    expect(doitRelancer({ statusCode: 502 }, op(LECTURE) as never)).toBe(true);
    expect(doitRelancer({ statusCode: 401 }, op(LECTURE) as never)).toBe(false);
    expect(doitRelancer(new DelaiDepasseError(15_000), op(LECTURE) as never)).toBe(false);
    expect(doitRelancer({ message: 'Failed to fetch' }, op(LECTURE, { sansRelance: true }) as never)).toBe(false);
  });
});

describe('délai client', () => {
  it('au-dessus des délais du cloud, long pour les exports et les écritures', () => {
    const o = (query: typeof LECTURE, variables: Record<string, unknown> = {}, ctx: Record<string, unknown> = {}) => ({ query, variables, getContext: () => ctx });
    expect(delaiPour(o(LECTURE) as never)).toBe(DELAI_LECTURE_MS);
    expect(DELAI_LECTURE_MS).toBeGreaterThan(30_000);
    expect(delaiPour(o(LECTURE, { limit: 5000 }) as never)).toBe(DELAI_LONG_MS);
    expect(delaiPour(o(ECRITURE) as never)).toBe(DELAI_ECRITURE_MS);
    expect(DELAI_ECRITURE_MS).toBeGreaterThan(60_000);
    expect(delaiPour(o(LECTURE, {}, { delaiMs: 10_000 }) as never)).toBe(10_000);
  });

  afterEach(() => vi.useRealTimers());
  const jamais = new ApolloLink(() => new Observable(() => {}));
  const immediat = new ApolloLink(() => Observable.of({ data: { a: 1 } }));

  it('abandonne une lecture après le délai', async () => {
    vi.useFakeTimers();
    const erreur = new Promise((resolve) => {
      execute(ApolloLink.from([delaiLink, jamais]), { query: LECTURE, context: { delaiMs: 1_000 } })
        .subscribe({ error: resolve });
    });
    vi.advanceTimersByTime(1_001);
    const e = await erreur;
    expect(e).toBeInstanceOf(DelaiDepasseError);
  });
  it('laisse passer une réponse à temps', async () => {
    const r = await new Promise((resolve) => {
      execute(ApolloLink.from([delaiLink, immediat]), { query: LECTURE }).subscribe({ next: resolve });
    });
    expect(r).toEqual({ data: { a: 1 } });
  });
});

describe('reprise après réponse perdue (comptoir)', () => {
  const v = (id: number, net: number, user_name = 'caisse1') => ({ id, net_a_payer: net, user_name, numero: `BCT-${id}` }) as unknown as Vente;
  it('trouve le ticket apparu depuis, même montant, même caissier', () => {
    const t = { net: 1250, connus: [1, 2], utilisateur: 'caisse1', moment: 0 };
    const res = ventesSuspectes(t, [v(1, 1250), v(2, 300), v(3, 1250, 'autre'), v(4, 1250), v(5, 999)]);
    expect(res.map((x) => x.id)).toEqual([4]);
  });
  it('rien de suspect : encaissement normal', () => {
    expect(ventesSuspectes({ net: 10, connus: [1], utilisateur: 'c', moment: 0 }, [v(1, 10, 'c')])).toEqual([]);
  });
});
