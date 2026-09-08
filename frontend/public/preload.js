const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  appVersion: process.env.npm_package_version || '',
  openPlayerWindow: () => ipcRenderer.invoke('open-player-window'),
  onOpenEncyclopedia: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-encyclopedia', listener);
    return () => ipcRenderer.removeListener('open-encyclopedia', listener);
  },
  onOpenNameGenerator: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-name-generator', listener);
    return () => ipcRenderer.removeListener('open-name-generator', listener);
  },
  onOpenBestiary: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-bestiary', listener);
    return () => ipcRenderer.removeListener('open-bestiary', listener);
  },
  onOpenChronicle: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-chronicle', listener);
    return () => ipcRenderer.removeListener('open-chronicle', listener);
  },
});
