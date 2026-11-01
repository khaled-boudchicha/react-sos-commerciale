import { ApolloClient, ApolloLink, InMemoryCache, Observable, createHttpLink, from, type Operation } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { getMainDefinition } from '@apollo/client/utilities';
import { useSession } from '../store/session';
import { useReseau } from '../store/reseau';
import { DelaiDepasseError, estPanneTransport, messageErreur } from './erreurs';

// Codes poussés par le cloud dans extensions.code (pattern errorLink du mobile)
const ACCESS_CODES = new Set(['ACCOUNT_BLOCKED', 'SUBSCRIPTION_SUSPENDED', 'SUBSCRIPTION_EXPIRED', 'AGENT_NOT_ALLOWED']);

const httpLink = createHttpLink({
  // uri lu dynamiquement : le sélecteur de serveur peut changer sans recréer le client
  uri: () => useSession.getState().cloudUrl,
});

// Token + dossier lus à CHAQUE requête (jamais en closure) → switch agent/dossier immédiat.
// `dossierOverride` (contexte par opération) permet de viser un autre dossier que
// celui de la session sans muter l'état global — ex. lister les utilisateurs du
// dossier cible avant d'y basculer.
const authLink = setContext((_op, prevContext) => {
  const { token, dossier, dossierUser } = useSession.getState();
  const dossierEffectif = prevContext?.dossierOverride ?? dossier;
  return {
    headers: {
      ...prevContext?.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(dossierEffectif ? { 'X-Druxamed-Dossier': encodeURIComponent(dossierEffectif) } : {}),
      // Identité de l'utilisateur dossier (jeton signé par l'agent, droits vérifiés côté agent)
      ...(dossierUser?.user_token ? { 'X-Druxamed-User': dossierUser.user_token } : {}),
    },
  };
});

/**
 * Délais client, calés JUSTE AU-DESSUS de ceux du cloud (30 s commandes courantes, 60 s commandes lentes) :
 * le but est de ne jamais rester bloqué indéfiniment (socket mort), pas de couper une requête que le cloud
 * aurait servie. Les lectures volumineuses (exports, `limit` ≥ 1000) ont droit au délai long.
 */
export const DELAI_LECTURE_MS = 35_000;
export const DELAI_LONG_MS = 65_000;
export const DELAI_ECRITURE_MS = 65_000;

/** Délai d'une tentative : contexte `delaiMs`, sinon selon le type d'opération. */
export function delaiPour(op: Pick<Operation, 'query' | 'variables' | 'getContext'>): number {
  const force = op.getContext().delaiMs;
  if (typeof force === 'number' && force > 0) return force;
  if (estEcriture(op)) return DELAI_ECRITURE_MS;
  return Number(op.variables?.limit) >= 1000 ? DELAI_LONG_MS : DELAI_LECTURE_MS;
}

export function estEcriture(op: Pick<Operation, 'query'>): boolean {
  const def = getMainDefinition(op.query);
  return def.kind === 'OperationDefinition' && def.operation === 'mutation';
}

/**
 * Délai maximal par tentative. Contexte `delaiMs` pour surcharger (ex. exports volumineux).
 * À l'expiration : erreur DelaiDepasseError et désabonnement (Apollo annule alors le fetch).
 */
export const delaiLink = new ApolloLink((operation, forward) => {
  const ms = delaiPour(operation);
  return new Observable((observer) => {
    let fini = false;
    const sub = forward(operation).subscribe({
      next: (v) => observer.next(v),
      error: (e) => { fini = true; clearTimeout(minuteur); observer.error(e); },
      complete: () => { fini = true; clearTimeout(minuteur); observer.complete(); },
    });
    const minuteur = setTimeout(() => {
      if (fini) return;
      sub.unsubscribe();
      observer.error(new DelaiDepasseError(ms));
    }, ms);
    return () => { clearTimeout(minuteur); sub.unsubscribe(); };
  });
});

/**
 * Relance des LECTURES uniquement (jamais d'écriture : sans idempotence côté agent, une relance peut
 * créer un doublon). Uniquement sur panne de transport franche (pas sur un délai dépassé : le serveur
 * est lent, insister l'alourdit), et pas quand le poste est hors ligne ou que l'appelant l'interdit
 * (contexte `sansRelance`, ex. la sonde périodique).
 */
export function doitRelancer(erreur: unknown, op: Pick<Operation, 'query' | 'getContext'>): boolean {
  if (estEcriture(op) || op.getContext().sansRelance) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (erreur instanceof DelaiDepasseError) return false;
  return estPanneTransport(erreur as { statusCode?: number });
}

const retryLink = new RetryLink({
  delay: { initial: 400, max: 3_000, jitter: true },
  attempts: { max: 3, retryIf: (erreur, op) => doitRelancer(erreur, op) },
});

/** Toute réponse du serveur (même une erreur GraphQL) prouve que le cloud est joignable. */
const sondeLink = new ApolloLink((operation, forward) => forward(operation).map((r) => {
  useReseau.getState().signalerSucces();
  return r;
}));

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  // Panne de transport (après relances) : compte pour l'état « serveur injoignable » et le journal
  if (networkError && estPanneTransport(networkError as { statusCode?: number })) {
    useReseau.getState().signalerEchec(operation.operationName, messageErreur({ networkError }));
  }
  for (const err of graphQLErrors ?? []) {
    const code = err.extensions?.code as string | undefined;
    if (code && ACCESS_CODES.has(code)) {
      useSession.getState().setAccessError(code);
    }
    if (code === 'UNAUTHENTICATED') {
      useSession.getState().logout();
    }
  }
});

export const apollo = new ApolloClient({
  // Ordre : erreurs (vue finale) → relance → sonde de succès → délai par tentative → en-têtes → HTTP
  link: from([errorLink, retryLink, sondeLink, delaiLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
