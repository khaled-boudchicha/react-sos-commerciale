import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';

/**
 * Mises à jour automatiques (electron-updater, fournisseur « generic »).
 *
 * Le flux n'est actif que si le build a été publié avec une URL de mise à jour
 * (`-c.publish.url=…` dans la CI) : electron-builder écrit alors
 * `resources/app-update.yml`. Sans ce fichier (build local, dev) : désactivé.
 *
 * Téléchargement en arrière-plan, installation à la fermeture de l'app : un
 * poste de caisse n'est jamais redémarré au milieu d'une vente.
 */
export type EtatMaj =
  | { etat: 'desactive' }
  | { etat: 'verification' }
  | { etat: 'a_jour'; version: string }
  | { etat: 'disponible'; version: string }
  | { etat: 'telechargee'; version: string }
  | { etat: 'erreur'; message: string };

let etat: EtatMaj = { etat: 'desactive' };

function configure(): boolean {
  return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
}

function diffuser(win: BrowserWindow | null, e: EtatMaj) {
  etat = e;
  if (win && !win.isDestroyed()) win.webContents.send('maj:etat', e);
}

export function initialiserMisesAJour(getWin: () => BrowserWindow | null, estExpediteurValide: (e: Electron.IpcMainInvokeEvent) => boolean) {
  ipcMain.handle('app:version', (e) => (estExpediteurValide(e) ? app.getVersion() : null));
  ipcMain.handle('maj:etat', (e) => (estExpediteurValide(e) ? etat : null));
  ipcMain.handle('maj:verifier', async (e) => {
    if (!estExpediteurValide(e) || !configure()) return etat;
    try { await autoUpdater.checkForUpdates(); } catch (err) { diffuser(getWin(), { etat: 'erreur', message: (err as Error).message }); }
    return etat;
  });
  ipcMain.handle('maj:installer', (e) => {
    if (!estExpediteurValide(e) || etat.etat !== 'telechargee') return false;
    setImmediate(() => autoUpdater.quitAndInstall());
    return true;
  });

  if (!configure()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => diffuser(getWin(), { etat: 'verification' }));
  autoUpdater.on('update-not-available', (i) => diffuser(getWin(), { etat: 'a_jour', version: i.version }));
  autoUpdater.on('update-available', (i) => diffuser(getWin(), { etat: 'disponible', version: i.version }));
  autoUpdater.on('update-downloaded', (i) => diffuser(getWin(), { etat: 'telechargee', version: i.version }));
  autoUpdater.on('error', (err) => diffuser(getWin(), { etat: 'erreur', message: err?.message ?? String(err) }));

  // Vérification au démarrage puis toutes les 6 h
  const verifier = () => autoUpdater.checkForUpdates().catch(() => undefined);
  setTimeout(verifier, 15_000);
  setInterval(verifier, 6 * 60 * 60 * 1000);
}
