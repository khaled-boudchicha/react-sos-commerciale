import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gc', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  platform: process.platform,
  printers: () => ipcRenderer.invoke('printers:list'),
  printSilent: (html: string, opts?: { deviceName?: string; silent?: boolean }) =>
    ipcRenderer.invoke('print:silent', html, opts ?? {}),
  version: () => ipcRenderer.invoke('app:version'),
  securite: () => ipcRenderer.invoke('securite:etat'),
  modeles: {
    dossier: () => ipcRenderer.invoke('modeles:dossier'),
    liste: () => ipcRenderer.invoke('modeles:liste'),
    lire: (file: string) => ipcRenderer.invoke('modeles:lire', file),
    ecrire: (file: string, contenu: string) => ipcRenderer.invoke('modeles:ecrire', file, contenu),
    supprimer: (file: string) => ipcRenderer.invoke('modeles:supprimer', file),
    importer: () => ipcRenderer.invoke('modeles:importer'),
    exporter: (nom: string, contenu: string) => ipcRenderer.invoke('modeles:exporter', nom, contenu),
    ouvrirDossier: () => ipcRenderer.invoke('modeles:ouvrirDossier'),
    pdf: (html: string, l: number, h: number, nom: string) => ipcRenderer.invoke('modeles:pdf', html, l, h, nom),
  },
  majEtat: () => ipcRenderer.invoke('maj:etat'),
  majVerifier: () => ipcRenderer.invoke('maj:verifier'),
  majInstaller: () => ipcRenderer.invoke('maj:installer'),
  onMaj: (cb: (etat: unknown) => void) => {
    const f = (_e: unknown, etat: unknown) => cb(etat);
    ipcRenderer.on('maj:etat', f);
    return () => { ipcRenderer.removeListener('maj:etat', f); };
  },
});
