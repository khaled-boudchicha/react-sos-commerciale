// Harnais des tests d'interface : build de production servi par `vite preview`, Chromium piloté par
// Playwright, serveur GraphQL SIMULÉ (aucune donnée réelle, aucun agent nécessaire).
// Le build réel est testé tel qu'il sera livré, CSP comprise (d'où une URL cloud en https).
import { spawn } from 'node:child_process';
import { setTimeout as attendre } from 'node:timers/promises';
import { chromium } from 'playwright';

export const URL_CLOUD = 'https://api.test/graphql';
export const PORT = Number(process.env.GC_UI_PORT ?? 4317);
export const BASE = `http://localhost:${PORT}/`;

export const SESSION = {
  cloudUrl: URL_CLOUD, token: 'jeton-test',
  agent: { agentId: 'AG-01', label: 'Pharmacie Centrale', isOnline: true },
  dossier: 'GC_TEST', dossierUser: { id: 1, username: 'caisse1', name: 'Caisse 1', user_token: 'u', compte_id: 4, compte: 'CAISSE 1' },
};

/** Démarre `vite preview` sur dist/ et attend qu'il réponde. */
export async function demarrerServeur() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE); if (r.ok) return () => proc.kill(); } catch { /* pas encore prêt */ }
    await attendre(250);
  }
  proc.kill();
  throw new Error(`vite preview ne répond pas sur ${BASE} (dist/ construit ? « npm run test:ui » le fait)`);
}

export const lancerNavigateur = () => chromium.launch();

/**
 * Ouvre l'app sur `route` avec une session en place (stockage Electron simulé) et un serveur GraphQL
 * simulé : `gql(operationName, variables)` renvoie `data`, ou `{ panne: true }` (connexion refusée),
 * ou `{ http: 503 }`, ou `{ erreurs: [...] }`.
 */
export async function ouvrir(navigateur, { route = '/', session = SESSION, droits, gql = () => null, viewport = { width: 1366, height: 800 } } = {}) {
  const contexte = await navigateur.newContext({ viewport });
  const page = await contexte.newPage();
  page.erreurs = [];
  page.on('pageerror', (e) => page.erreurs.push(e.message));
  page.appels = [];
  // Toute requête GraphQL (URL de test de la session, ou URL officielle à l'écran de connexion)
  await page.route(/\/graphql(\?|$)/, async (r) => {
    let corps = {};
    try { corps = JSON.parse(r.request().postData() || '{}'); } catch { /* corps illisible */ }
    page.appels.push(corps);
    const rep = await gql(corps.operationName ?? '', corps.variables ?? {});
    if (rep?.panne) return r.abort('connectionrefused');
    if (rep?.http) return r.fulfill({ status: rep.http, body: 'Service Unavailable' });
    if (rep?.erreurs) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null, errors: rep.erreurs }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rep ?? null }) });
  });
  const s = session ? { ...session, dossierUser: { ...session.dossierUser, ...(droits ? { droits } : {}) } } : undefined;
  await page.addInitScript((sess) => {
    const store = { session: sess, theme: 'light', navigation: { disposition: 'lateral' } };
    window.gc = { platform: 'linux', store: { get: async (k) => store[k], set: async () => {}, delete: async () => {} } };
  }, s);
  await page.goto(`${BASE}#${route}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
  return page;
}

/** Droits d'un profil limité (aucun droit sauf ceux donnés). */
export const droitsLimites = (extra = {}) => ({ admin: false, vente: [], achat: [], stock: [], tiers: [], bank: [], autre: [], dossier: [], ...extra });
