import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

// Persistance locale (session, préférences). TODO Phase 7 : chiffrer les tokens via safeStorage.
const store = new Store({ name: 'gestion-commerciale' });

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
    },
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

ipcMain.handle('store:get', (_e, key: string) => store.get(key));
ipcMain.handle('store:set', (_e, key: string, value: unknown) => { store.set(key, value); });
ipcMain.handle('store:delete', (_e, key: string) => { store.delete(key); });

// Liste des imprimantes système (pour le réglage « imprimante ticket »).
ipcMain.handle('printers:list', async () => {
  if (!win) return [];
  const list = await win.webContents.getPrintersAsync();
  return list.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault }));
});

// Impression silencieuse d'un HTML complet vers une imprimante donnée (tickets).
// Une fenêtre cachée charge le HTML puis imprime sans dialogue ni aperçu.
ipcMain.handle('print:silent', async (_e, html: string, opts: { deviceName?: string; silent?: boolean }) => {
  const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
