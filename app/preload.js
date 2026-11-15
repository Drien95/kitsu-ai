// Pont entre le panneau (page http://127.0.0.1:47123) et l'application : mise a jour uniquement.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kitsuApp', {
  version: () => ipcRenderer.invoke('app:version'),
  demarrage: on => ipcRenderer.invoke('app:demarrage', on),
  etat: () => ipcRenderer.invoke('maj:etat'),
  verifier: () => ipcRenderer.invoke('maj:verifier'),
  telecharger: () => ipcRenderer.invoke('maj:telecharger'),
  installer: () => ipcRenderer.invoke('maj:installer'),
  surMaj: cb => ipcRenderer.on('maj', (_e, s) => cb(s)),
});
