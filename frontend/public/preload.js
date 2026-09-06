const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  appVersion: process.env.npm_package_version || '',
  openPlayerWindow: () => ipcRenderer.invoke('open-player-window'),
  onOpenEncyclopedia: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-encyclopedia', listener);
    return () => ipcRenderer.removeListener('open-encyclopedia', listener);
  },
});
