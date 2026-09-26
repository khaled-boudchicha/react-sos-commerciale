import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { useSession } from '../store/session';

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

const errorLink = onError(({ graphQLErrors }) => {
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
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
