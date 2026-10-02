const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Per-window session zoom: Ctrl+scroll scales this window like a browser.
// The factor lives only for the life of the window — nothing is persisted.
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

window.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const current = webFrame.getZoomFactor();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current + direction * ZOOM_STEP));
    webFrame.setZoomFactor(Number(next.toFixed(2)));
  },
  { passive: false }
);

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
  onOpenHarrowing: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-harrowing', listener);
    return () => ipcRenderer.removeListener('open-harrowing', listener);
  },
});
