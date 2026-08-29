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
});
