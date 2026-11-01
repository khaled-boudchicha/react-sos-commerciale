import { app, BrowserWindow, ipcMain, safeStorage, shell, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { initialiserMisesAJour } from './updater';
import { enregistrerModeles } from './modeles';

// Persistance locale (session, préférences).
const store = new Store({ name: 'gestion-commerciale' });

// Seules ces clés sont accessibles depuis le renderer (pas d'accès arbitraire au store).
// Préférences du poste : session, appareil, thème, palette, disposition des menus, impression
const STORE_KEYS = new Set(['session', 'deviceId', 'theme', 'palette', 'navigation', 'gc.imprimanteTicket', 'gc.cachet']);
// Clés sensibles (jeton JWT) chiffrées au repos via le trousseau de l'OS (safeStorage).
const SECRET_KEYS = new Set(['session']);
type Chiffre = { __enc: string };

function estChiffre(v: unknown): v is Chiffre {
  return !!v && typeof v === 'object' && typeof (v as Chiffre).__enc === 'string';
}

/**
 * Chiffrement au repos disponible ? Sous Linux, le moteur « basic_text » (pas de trousseau du bureau)
 * utilise une clé fixe : il ne protège rien, on le considère comme indisponible.
 */
function chiffrementFiable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform === 'linux') {
    try { return safeStorage.getSelectedStorageBackend() !== 'basic_text'; } catch { return false; }
  }
  return true;
}

function lire(key: string): unknown {
  const brut = store.get(key);
  if (!SECRET_KEYS.has(key)) return brut;
  if (estChiffre(brut)) {
    try { return JSON.parse(safeStorage.decryptString(Buffer.from(brut.__enc, 'base64'))); }
    catch { return undefined; } // trousseau changé / données corrompues → reconnexion
  }
  // Ancienne valeur en clair : réécrite chiffrée si possible, sinon effacée du disque
  // (elle reste utilisable pour cette session seulement, en mémoire).
  if (brut !== undefined) ecrire(key, brut);
  return brut;
}

function ecrire(key: string, value: unknown) {
  if (!SECRET_KEYS.has(key)) { store.set(key, value); return; }
  if (chiffrementFiable()) {
    const enc = safeStorage.encryptString(JSON.stringify(value)).toString('base64');
    store.set(key, { __enc: enc } satisfies Chiffre);
  } else {
    // Jamais de jeton en clair sur le disque : la session n'est pas mémorisée (reconnexion au prochain lancement)
    store.delete(key);
  }
}

/** N'accepte les IPC que de la fenêtre principale chargée depuis l'app (pas d'une page tierce). */
function expediteurValide(e: IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? '';
  const dev = process.env.NODE_ENV === 'development';
  return !!win && e.sender === win.webContents && (url.startsWith('file://') || (dev && url.startsWith('http://localhost:')));
}

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: 'Gestion Commerciale',
    backgroundColor: '#F6F8FC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Barre de menus native masquée (Windows / Linux) : l'application a sa propre navigation (barre latérale ou ruban).
  // Sans masquage automatique, Alt reste disponible pour les touches d'accès du ruban ; les raccourcis du menu restent actifs.
  if (process.platform !== 'darwin') win.setMenuBarVisibility(false);

  // Aucune navigation hors de l'app ; les liens externes s'ouvrent dans le navigateur système.
  win.webContents.on('will-navigate', (e, url) => {
    const interne = url.startsWith('file://') || (process.env.NODE_ENV === 'development' && url.startsWith('http://localhost:'));
    if (!interne) { e.preventDefault(); if (/^https?:\/\//.test(url)) void shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.VITE_PORT || '5174';
    win.loadURL(`http://localhost:${port}`);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('closed', () => { win = null; });
}

ipcMain.handle('store:get', (e, key: string) => {
  if (!expediteurValide(e) || !STORE_KEYS.has(key)) return undefined;
  return lire(key);
});
ipcMain.handle('store:set', (e, key: string, value: unknown) => {
  if (!expediteurValide(e) || !STORE_KEYS.has(key)) return;
  ecrire(key, value);
});
ipcMain.handle('store:delete', (e, key: string) => {
  if (!expediteurValide(e) || !STORE_KEYS.has(key)) return;
  store.delete(key);
});

// État de la protection locale de la session (écran Diagnostic).
ipcMain.handle('securite:etat', (e) => {
  if (!expediteurValide(e)) return null;
  let moteur: string | undefined;
  if (process.platform === 'linux') { try { moteur = safeStorage.getSelectedStorageBackend(); } catch { /* ignoré */ } }
  return { chiffrement: chiffrementFiable(), plateforme: process.platform, moteur };
});

// Liste des imprimantes système (pour le réglage « imprimante ticket »).
ipcMain.handle('printers:list', async (e) => {
  if (!win || !expediteurValide(e)) return [];
  const list = await win.webContents.getPrintersAsync();
  return list.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault }));
});

// Impression silencieuse d'un HTML complet vers une imprimante donnée (tickets).
// Une fenêtre cachée charge le HTML puis imprime sans dialogue ni aperçu.
ipcMain.handle('print:silent', async (e, html: string, opts: { deviceName?: string; silent?: boolean }) => {
  if (!expediteurValide(e) || typeof html !== 'string') return { success: false, reason: 'refusé' };
  // Fenêtre d'impression isolée : pas de preload, sandbox, JS désactivé (le ticket est du HTML/CSS statique).
  const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: false } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const result = await new Promise<{ success: boolean; reason?: string }>((resolve) => {
      w.webContents.print(
        { silent: opts?.silent !== false, printBackground: true, deviceName: opts?.deviceName || undefined, margins: { marginType: 'none' } },
        (success, reason) => resolve({ success, reason }),
      );
    });
    return result;
  } catch (e) {
    return { success: false, reason: (e as Error)?.message ?? 'print error' };
  } finally {
    if (!w.isDestroyed()) w.close();
  }
});

// Une seule instance : deux fenêtres sur le même poste se partageraient la session et les tickets
// en attente (écritures concurrentes dans le même stockage). La seconde ouverture ramène la première.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  initialiserMisesAJour(() => win, expediteurValide);
  enregistrerModeles(() => win, expediteurValide);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
