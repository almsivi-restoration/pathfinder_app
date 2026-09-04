const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openPlayerWindow: () => ipcRenderer.invoke('open-player-window'),
});
