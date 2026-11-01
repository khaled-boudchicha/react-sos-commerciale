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

type ErreurHttp = Error & { statusCode?: number; result?: unknown; messageOriginal?: string };

/**
 * Message lisible d'une erreur de transport brute (TypeError « Failed to fetch », ServerError HTTP,
 * ServerParseError d'une page HTML d'erreur…). null si l'erreur n'est pas une erreur de transport connue.
 */
export function messageTransport(e: ErreurHttp, enLigne = !horsLigne()): string | null {
  if (e instanceof DelaiDepasseError) return null; // déjà lisible
  const statut = e.statusCode;
  if (statut == null) {
    if (e.name === 'ServerParseError') return 'Réponse inattendue du serveur (service en maintenance ?). Réessayez dans un instant.';
    // fetch() rejeté (réseau, DNS, CORS, certificat) : TypeError ; tout autre objet n'est pas « réseau »
    if (e.name !== 'TypeError') return null;
    return enLigne ? 'Serveur injoignable : vérifiez la connexion Internet.' : 'Pas de connexion Internet sur ce poste.';
  }
  if (statut === 502 || statut === 503 || statut === 504) return `Serveur momentanément indisponible (HTTP ${statut}). Réessayez dans un instant.`;
  if (statut >= 500) return `Erreur du serveur (HTTP ${statut}). Si elle persiste, contactez SOFTLY.`;
  // 4xx : le serveur a répondu ; son propre message (erreur GraphQL) est plus utile qu'un code
  const premier = (e.result as { errors?: { message?: string }[] } | undefined)?.errors?.[0]?.message;
  if (premier) return premier;
  if (statut === 401) return 'Session expirée : reconnectez-vous.';
  if (statut === 403) return 'Accès refusé par le serveur.';
  if (statut === 413) return 'Requête trop volumineuse pour le serveur.';
  if (statut === 429) return 'Trop de requêtes : patientez quelques secondes.';
  return `Requête refusée par le serveur (HTTP ${statut}).`;
}

/**
 * Remplace, en place, le message technique d'une erreur de transport par un message lisible.
 * L'objet est conservé (statusCode, result, response… restent utilisables par les liens Apollo) ;
 * le message d'origine reste dans `messageOriginal` (journal, support).
 */
export function traduireErreurTransport<T>(e: T): T {
  if (!(e instanceof Error)) return e;
  const err = e as ErreurHttp;
  if (err.messageOriginal !== undefined) return e;
  const lisible = messageTransport(err);
  if (!lisible) return e;
  try {
    err.messageOriginal = err.message;
    Object.defineProperty(err, 'message', { value: lisible, configurable: true, writable: true });
  } catch { /* objet gelé : message d'origine conservé */ }
  return e;
}

/**
 * Message d'échec d'une CRÉATION de pièce : si la réponse s'est perdue, la pièce existe peut-être déjà ;
 * le dire évite qu'un utilisateur réenregistre aussitôt et crée un doublon.
 */
export function messageEchecCreation(e: unknown, liste: string): string {
  if (resultatIncertain(e)) {
    return `Pas de réponse du serveur : la pièce a peut-être été enregistrée. Vérifiez ${liste} avant de réenregistrer, pour éviter un doublon.`;
  }
  return messageErreur(e, 'Erreur à l’enregistrement.');
}
