import { gql } from '@apollo/client';

export const LOGIN_IDENTIFY = gql`
  mutation LoginIdentify($username: String!, $password: String!) {
    loginIdentify(username: $username, password: $password) {
      success
      token_temp
      message
      statut
      agents { agentId label isOnline lastDossier }
    }
  }
`;

export const LOGIN_WITH_AGENT = gql`
  mutation LoginWithAgent($input: LoginWithAgentInput!) {
    loginWithAgent(input: $input) {
      success
      access_token
      message
      statut
      user { id username role }
    }
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken {
    refreshToken { success access_token statut message }
  }
`;

export const MY_AGENTS = gql`
  query MyAgents {
    myAgents { agentId label isOnline lastDossier }
  }
`;

export const DOSSIERS = gql`
  query Dossiers { dossiers }
`;

export const DOSSIER_USERS = gql`
  query DossierUsers { dossierUsers }
`;

export const LOGIN_DOSSIER_USER = gql`
  mutation LoginDossierUser($username: String!, $password: String!) {
    loginDossierUser(username: $username, password: $password)
  }
`;

/** Connexion par code d'appairage du tray ({ u, k, a } : utilisateur, clé API, agent). */
export const LOGIN_WITH_API_KEY = gql`
  mutation LoginWithApiKey($input: LoginWithApiKeyInput!) {
    loginWithApiKey(input: $input) { success access_token message statut }
  }
`;
