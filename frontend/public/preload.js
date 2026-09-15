const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  appVersion: process.env.npm_package_version || '',
  openPlayerWindow: () => ipcRenderer.invoke('open-player-window'),
  getThemeState: () => ipcRenderer.invoke('get-theme-state'),
  setTheme: (themeId) => ipcRenderer.invoke('set-theme', themeId),
  reloadThemes: () => ipcRenderer.invoke('reload-themes'),
  openThemesFolder: () => ipcRenderer.invoke('open-themes-folder'),
  onThemeStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('theme-state-changed', listener);
    return () => ipcRenderer.removeListener('theme-state-changed', listener);
  },
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
  onOpenQuickRoll: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-quick-roll', listener);
    return () => ipcRenderer.removeListener('open-quick-roll', listener);
  },
  onOpenSheetImporter: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-sheet-importer', listener);
    return () => ipcRenderer.removeListener('open-sheet-importer', listener);
  },
});
