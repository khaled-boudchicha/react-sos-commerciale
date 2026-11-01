// Tests de l'application de BUREAU (Electron réel, build de production) : ce que les parcours
// d'interface (Chromium) ne peuvent pas vérifier — processus principal, IPC, stockage local, CSP du
// fichier livré, fenêtre.
// Lancer : npm run test:electron   (Linux sans écran : xvfb-run -a npm run test:electron)
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from 'playwright';

const RACINE = new URL('../..', import.meta.url).pathname;

/** Profil isolé (XDG_CONFIG_HOME) : aucun effet sur le poste, relance possible sur le même profil. */
const profil = mkdtempSync(join(tmpdir(), 'gc-electron-'));

async function lancer() {
  const app = await electron.launch({
    args: ['.', '--no-sandbox'], cwd: RACINE,
    env: { ...process.env, NODE_ENV: 'production', XDG_CONFIG_HOME: profil, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('text=Connexion à votre compte').waitFor({ timeout: 15000 });
  return { app, page };
}

const fichierStore = async (app) => {
  const dossier = await app.evaluate(({ app: a }) => a.getPath('userData'));
  return join(dossier, 'gestion-commerciale.json');
};

describe('application de bureau', () => {
  let app, page;
  before(async () => { ({ app, page } = await lancer()); });
  after(async () => { await app?.close(); });

  test('démarre sur l’écran de connexion, depuis le fichier livré (file://)', async () => {
    assert.match(page.url(), /^file:\/\/.*dist\/index\.html/);
    assert.equal(await page.title(), 'Gestion Commerciale');
  });

  test('pont sécurisé : API exposée limitée, pas d’accès Node dans l’écran', async () => {
    const cles = await page.evaluate(() => Object.keys(window.gc ?? {}).sort());
    for (const c of ['store', 'platform', 'securite', 'version']) assert.ok(cles.includes(c), `window.gc.${c}`);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  });

  test('stockage : seules les clés autorisées sont lisibles / écrivables', async () => {
    await page.evaluate(() => window.gc.store.set('pirate', { x: 1 }));
    assert.equal(await page.evaluate(() => window.gc.store.get('pirate')), undefined);
    await page.evaluate(() => window.gc.store.set('theme', 'dark'));
    assert.equal(await page.evaluate(() => window.gc.store.get('theme')), 'dark');
  });

  test('session : jamais écrite en clair sur le disque', async () => {
    const etat = await page.evaluate(() => window.gc.securite());
    await page.evaluate(() => window.gc.store.set('session', { token: 'JETON-SECRET-TEST', agent: { agentId: 'A' } }));
    const fichier = await fichierStore(app);
    const contenu = existsSync(fichier) ? readFileSync(fichier, 'utf8') : '';
    assert.ok(!contenu.includes('JETON-SECRET-TEST'), 'jeton lisible dans le fichier du poste');
    const relu = await page.evaluate(() => window.gc.store.get('session'));
    if (etat.chiffrement) assert.equal(relu?.token, 'JETON-SECRET-TEST'); // chiffré puis relu
    else assert.equal(relu, undefined);                                    // sans coffre : non mémorisé
    await page.evaluate(() => window.gc.store.delete('session'));
  });

  test('CSP de production : aucune requête http (seulement https)', async () => {
    const r = await page.evaluate(() => fetch('http://example.invalid/graphql').then(() => 'envoyée', (e) => `bloquée : ${e.message}`));
    assert.match(r, /^bloquée/);
  });

  test('navigation : un lien externe s’ouvre dans le navigateur du système, jamais dans l’application', async () => {
    // Ouverture externe interceptée (aucun navigateur lancé pendant les tests) et mémorisée
    await app.evaluate(({ shell }) => {
      globalThis.__ouvertures = [];
      shell.openExternal = async (url) => { globalThis.__ouvertures.push(url); };
    });
    await page.evaluate(() => { window.location.href = 'https://example.invalid/'; });
    await page.waitForTimeout(800);
    assert.match(page.url(), /^file:\/\//);
    assert.deepEqual(await app.evaluate(() => globalThis.__ouvertures), ['https://example.invalid/']);
  });

  test('écran planté : rechargement automatique', async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());
    // Le processus principal recharge l'écran : la fenêtre redevient utilisable
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      await new Promise((r) => setTimeout(r, 250));
      ok = await app.evaluate(({ BrowserWindow }) => {
        const wc = BrowserWindow.getAllWindows()[0]?.webContents;
        return !!wc && !wc.isCrashed() && !wc.isLoading() && wc.getURL().startsWith('file://');
      });
    }
    assert.ok(ok, 'la fenêtre n’a pas été rechargée après le plantage');
  });
});

describe('fenêtre', () => {
  test('taille et position retrouvées au lancement suivant', async () => {
    const premier = await lancer();
    await premier.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 30, width: 1300, height: 820 }));
    await premier.page.waitForTimeout(300);
    await premier.app.close();
    const second = await lancer();
    const b = await second.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getNormalBounds());
    await second.app.close();
    assert.equal(b.width, 1300);
    assert.equal(b.height, 820);
  });
});
