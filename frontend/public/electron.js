const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;
let playerWindow;

app.setName('GM Workbench');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPlayerWindow() {
  if (playerWindow) {
    playerWindow.focus();
    return;
  }

  playerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  const playerUrl = isDev
    ? 'http://localhost:3000/?view=player'
    : `file://${path.join(__dirname, '../build/index.html')}?view=player`;

  playerWindow.loadURL(playerUrl);

  playerWindow.on('closed', () => {
    playerWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for player window
ipcMain.handle('open-player-window', () => {
  createPlayerWindow();
});

// Menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Restart App',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          app.relaunch();
          app.exit(0);
        },
      },
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Open Player View',
        click: () => {
          createPlayerWindow();
        },
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          if (mainWindow) mainWindow.webContents.toggleDevTools();
        },
      },
    ],
  },
  {
    label: 'GM Tools',
    submenu: [
      {
        label: 'Encyclopedia',
        click: () => {
          if (mainWindow) mainWindow.webContents.send('open-encyclopedia');
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
