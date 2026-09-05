const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openPlayerWindow: () => ipcRenderer.invoke('open-player-window'),
  onOpenEncyclopedia: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-encyclopedia', listener);
    return () => ipcRenderer.removeListener('open-encyclopedia', listener);
  },
});
