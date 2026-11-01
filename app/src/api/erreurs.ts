/**
 * Classement et libellés des erreurs de transport (app → cloud → agent).
 * Objectif : distinguer « le serveur n'a pas été joint » de « le serveur a refusé », et savoir
 * quand le résultat d'une écriture est INCERTAIN (requête partie, réponse jamais revenue).
 */

/** Délai client dépassé (lien `delaiLink` de client.ts). */
export class DelaiDepasseError extends Error {
  readonly ms: number;
  constructor(ms: number) {
    super(`Le serveur n’a pas répondu à temps (${Math.round(ms / 1000)} s).`);
    this.name = 'DelaiDepasseError';
    this.ms = ms;
  }
}

type ErreurReseau = { name?: string; message?: string; statusCode?: number } | null | undefined;

/** Codes / messages d'un dépassement de délai côté cloud ou agent (la commande a pu s'exécuter). */
const DELAI_SERVEUR = /timeout|timed out|deadline|d[ée]lai|DEADLINE_EXCEEDED|AGENT_TIMEOUT|UNAVAILABLE/i;

/**
 * Panne de transport : rien n'est revenu du serveur (coupure, DNS, délai client) ou la passerelle
 * est indisponible (502/503/504). Une réponse 4xx ou une erreur GraphQL prouvent au contraire que le
 * cloud répond.
 */
export function estPanneTransport(e: ErreurReseau): boolean {
  if (!e) return false;
  const statut = e.statusCode;
  if (statut == null) return true;
  return statut === 502 || statut === 503 || statut === 504;
}

/** Erreur réseau portée par une ApolloError (ou l'erreur elle-même si elle vient directement d'un lien). */
function reseauDe(e: unknown): ErreurReseau {
  if (!e || typeof e !== 'object') return null;
  const o = e as { networkError?: ErreurReseau; graphQLErrors?: unknown[] };
  if ('networkError' in o || 'graphQLErrors' in o) return o.networkError ?? null;
  return o as ErreurReseau;
}

function messagesGraphQL(e: unknown): { message?: string; code?: string }[] {
  const liste = (e as { graphQLErrors?: { message?: string; extensions?: { code?: unknown } }[] } | null)?.graphQLErrors;
  return Array.isArray(liste) ? liste.map((g) => ({ message: g?.message, code: typeof g?.extensions?.code === 'string' ? g.extensions.code : undefined })) : [];
}

const horsLigne = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Message lisible pour l'utilisateur (remplace « Failed to fetch » et consorts). */
export function messageErreur(e: unknown, defaut = 'Erreur inattendue.'): string {
  // Seules une ApolloError porteuse d'un networkError ou une erreur de délai sont « réseau »
  const reseau: ErreurReseau = e instanceof DelaiDepasseError ? e : (e as { networkError?: ErreurReseau } | null)?.networkError;
  if (reseau) {
    if (reseau.name === 'DelaiDepasseError') return reseau.message ?? 'Le serveur n’a pas répondu à temps.';
    if (horsLigne()) return 'Pas de connexion Internet sur ce poste.';
    if (reseau.statusCode && reseau.statusCode >= 500) return `Serveur momentanément indisponible (HTTP ${reseau.statusCode}). Réessayez dans un instant.`;
    if (reseau.statusCode == null) return 'Serveur injoignable : vérifiez la connexion Internet.';
  }
  const brut = (e as { message?: string } | null)?.message;
  if (brut && /failed to fetch|networkerror|load failed|network request failed/i.test(brut)) {
    return horsLigne() ? 'Pas de connexion Internet sur ce poste.' : 'Serveur injoignable : vérifiez la connexion Internet.';
  }
  return brut || defaut;
}

/**
 * Le résultat d'une ÉCRITURE est-il incertain ? Vrai quand la requête a pu atteindre l'agent sans que la
 * réponse revienne : erreur de transport, délai client, ou délai/indisponibilité signalé par le cloud.
 * Dans ce cas, NE PAS considérer l'opération comme échouée : vérifier avant de recommencer.
 */
export function resultatIncertain(e: unknown): boolean {
  const reseau = reseauDe(e);
  if (reseau && estPanneTransport(reseau)) return true;
  if (/failed to fetch|networkerror|load failed/i.test((e as { message?: string } | null)?.message ?? '')) return true;
  return messagesGraphQL(e).some((g) => DELAI_SERVEUR.test(g.code ?? '') || DELAI_SERVEUR.test(g.message ?? ''));
}
