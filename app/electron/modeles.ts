import { app, BrowserWindow, dialog, ipcMain, shell, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Modèles d'impression personnalisés : fichiers `.gcr` (JSON) dans
 *   <Documents>/Gestion Commerciale/Modeles
 * L'utilisateur peut les copier, sauvegarder ou partager comme n'importe quel document.
 * Le renderer ne fournit jamais de chemin : uniquement un nom de fichier validé ici.
 */

const MAX_FICHIER = 20 * 1024 * 1024;
const MAX_FICHIERS = 1000;
const NOM_VALIDE = /^(?![.\s])[^\\/:*?"<>|\u0000-\u001f]{1,120}\.gcr$/i;

export function dossierModeles(): string {
  const d = path.join(app.getPath('documents'), 'Gestion Commerciale', 'Modeles');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function cheminSur(file: unknown): string | null {
  if (typeof file !== 'string' || !NOM_VALIDE.test(file) || path.basename(file) !== file) return null;
  return path.join(dossierModeles(), file);
}

function formatValide(contenu: string): boolean {
  try {
    const j = JSON.parse(contenu);
    return !!j && typeof j === 'object' && j.format === 'gcr' && typeof j.version === 'number';
  } catch { return false; }
}

export type EntreeModele = { file: string; name: string; kind: string; description?: string; modified: string; size: number };

export function enregistrerModeles(getWin: () => BrowserWindow | null, expediteurValide: (e: IpcMainInvokeEvent) => boolean): void {
  const garde = (e: IpcMainInvokeEvent) => expediteurValide(e);

  ipcMain.handle('modeles:dossier', (e) => (garde(e) ? dossierModeles() : ''));

  ipcMain.handle('modeles:liste', (e): EntreeModele[] => {
    if (!garde(e)) return [];
    const dir = dossierModeles();
    const sortie: EntreeModele[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => NOM_VALIDE.test(x)).slice(0, MAX_FICHIERS)) {
      try {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (!st.isFile() || st.size > MAX_FICHIER) continue;
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (j?.format !== 'gcr') continue;
        sortie.push({ file: f, name: String(j.name ?? f), kind: String(j.kind ?? 'vente'), description: j.description ? String(j.description) : undefined, modified: String(j.modified ?? st.mtime.toISOString()), size: st.size });
      } catch { /* fichier illisible : ignoré */ }
    }
    return sortie;
  });

  ipcMain.handle('modeles:lire', (e, file: string): string | null => {
    const p = garde(e) ? cheminSur(file) : null;
    if (!p || !fs.existsSync(p)) return null;
    if (fs.statSync(p).size > MAX_FICHIER) return null;
    return fs.readFileSync(p, 'utf8');
  });

  ipcMain.handle('modeles:ecrire', (e, file: string, contenu: string): { ok: boolean; raison?: string } => {
    const p = garde(e) ? cheminSur(file) : null;
    if (!p) return { ok: false, raison: 'Nom de fichier invalide.' };
    if (typeof contenu !== 'string' || contenu.length > MAX_FICHIER) return { ok: false, raison: 'Contenu trop volumineux.' };
    if (!formatValide(contenu)) return { ok: false, raison: 'Ce n’est pas un modèle d’état valide.' };
    try {
      const tmp = `${p}.tmp`;
      fs.writeFileSync(tmp, contenu, 'utf8');
      fs.renameSync(tmp, p); // écriture atomique : jamais de modèle à moitié écrit
      return { ok: true };
    } catch (err) { return { ok: false, raison: (err as Error).message }; }
  });

  ipcMain.handle('modeles:supprimer', (e, file: string): boolean => {
    const p = garde(e) ? cheminSur(file) : null;
    if (!p || !fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
  });

  ipcMain.handle('modeles:importer', async (e): Promise<{ nom: string; contenu: string }[]> => {
    const w = getWin();
    if (!garde(e) || !w) return [];
    const r = await dialog.showOpenDialog(w, { title: 'Importer des modèles', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Modèle d’état', extensions: ['gcr'] }] });
    if (r.canceled) return [];
    return r.filePaths.slice(0, 50).flatMap((p) => {
      try {
        if (fs.statSync(p).size > MAX_FICHIER) return [];
        const contenu = fs.readFileSync(p, 'utf8');
        return formatValide(contenu) ? [{ nom: path.basename(p), contenu }] : [];
      } catch { return []; }
    });
  });

  ipcMain.handle('modeles:exporter', async (e, nomSuggere: string, contenu: string): Promise<string | null> => {
    const w = getWin();
    if (!garde(e) || !w || typeof contenu !== 'string' || !formatValide(contenu)) return null;
    const nom = String(nomSuggere || 'modele.gcr').replace(/[\\/:*?"<>|]/g, '_');
    const r = await dialog.showSaveDialog(w, { title: 'Exporter le modèle', defaultPath: nom, filters: [{ name: 'Modèle d’état', extensions: ['gcr'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, contenu, 'utf8');
    return r.filePath;
  });

  ipcMain.handle('modeles:ouvrirDossier', async (e) => {
    if (!garde(e)) return;
    await shell.openPath(dossierModeles());
  });

  // Export PDF fidèle : les pages de l'état sont déjà à leur taille finale (mm), pas de marge d'impression.
  ipcMain.handle('modeles:pdf', async (e, html: string, largeurMm: number, hauteurMm: number, nomSuggere: string): Promise<string | null> => {
    const w = getWin();
    if (!garde(e) || !w || typeof html !== 'string' || html.length > 200 * 1024 * 1024) return null;
    const lMm = Math.min(Math.max(Number(largeurMm) || 210, 20), 1500), hMm = Math.min(Math.max(Number(hauteurMm) || 297, 20), 5000);
    const r = await dialog.showSaveDialog(w, { title: 'Enregistrer en PDF', defaultPath: String(nomSuggere || 'etat.pdf').replace(/[\\/:*?"<>|]/g, '_'), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return null;
    const fen = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: false } });
    try {
      await fen.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const pdf = await fen.webContents.printToPDF({
        printBackground: true, preferCSSPageSize: false,
        // pouces (et non microns : ceux-ci sont réservés à webContents.print ; ici ils produisaient un PDF tronqué à ≈349 mm de haut)
        pageSize: { width: lMm / 25.4, height: hMm / 25.4 },
        margins: { marginType: 'none' },
      });
      fs.writeFileSync(r.filePath, pdf);
      return r.filePath;
    } finally {
      if (!fen.isDestroyed()) fen.close();
    }
  });
}
