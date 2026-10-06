import { app, BrowserWindow, ipcMain, safeStorage, shell, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { initialiserMisesAJour } from './updater';

// Persistance locale (session, préférences).
const store = new Store({ name: 'gestion-commerciale' });

// Seules ces clés sont accessibles depuis le renderer (pas d'accès arbitraire au store).
const STORE_KEYS = new Set(['session', 'deviceId', 'theme', 'gc.imprimanteTicket', 'gc.cachet']);
// Clés sensibles (jeton JWT) chiffrées au repos via le trousseau de l'OS (safeStorage).
const SECRET_KEYS = new Set(['session']);
type Chiffre = { __enc: string };

function estChiffre(v: unknown): v is Chiffre {
  return !!v && typeof v === 'object' && typeof (v as Chiffre).__enc === 'string';
}

function lire(key: string): unknown {
  const brut = store.get(key);
  if (!SECRET_KEYS.has(key)) return brut;
  if (estChiffre(brut)) {
    try { return JSON.parse(safeStorage.decryptString(Buffer.from(brut.__enc, 'base64'))); }
    catch { return undefined; } // trousseau changé / données corrompues → reconnexion
  }
  // Migration : ancienne valeur en clair → réécrite chiffrée
  if (brut !== undefined) ecrire(key, brut);
  return brut;
}

function ecrire(key: string, value: unknown) {
  if (SECRET_KEYS.has(key) && safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(JSON.stringify(value)).toString('base64');
    store.set(key, { __enc: enc } satisfies Chiffre);
  } else {
    store.set(key, value);
  }
}

/** N'accepte les IPC que de la fenêtre principale chargée depuis l'app (pas d'une page tierce). */
function expediteurValide(e: IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? '';
  return !!win && e.sender === win.webContents && (url.startsWith('file://') || url.startsWith('http://localhost:'));
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

app.whenReady().then(() => {
  createWindow();
  initialiserMisesAJour(() => win, expediteurValide);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
