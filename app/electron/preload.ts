import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gc', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  platform: process.platform,
});
