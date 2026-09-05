const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
// electron-is-dev is a devDependency and is NOT shipped in the packaged app,
// so require it lazily: the require throws under production resources, which
// is itself the reliable signal that we are packaged.
let isDev;
try {
  isDev = require('electron-is-dev');
} catch {
  isDev = false;
}

let mainWindow;
let playerWindow;
let backendProcess;

app.setName('GM Workbench');

// In production the backend is a PyInstaller-frozen binary shipped under
// resources/backend/. It stores campaigns and the user-supplied reference
// library under Electron's per-user data directory. In development the
// backend is still started by hand (backend/venv/bin/python -m uvicorn
// main:app --port 8000), so dev behavior is unchanged.
function startBackend() {
  const binary = process.platform === 'win32' ? 'gm-workbench-backend.exe' : 'gm-workbench-backend';
  const binaryPath = path.join(process.resourcesPath, 'backend', binary);

  const dataDir = path.join(app.getPath('userData'), 'data');
  const campaignsDir = path.join(dataDir, 'campaigns');
  const referenceDir = path.join(dataDir, 'reference_library');
  // User drops reference PDFs into reference_library/sources/<ruleset>/ and
  // imports them from the Encyclopedia page; nothing copyrighted ships here.
  fs.mkdirSync(campaignsDir, { recursive: true });
  fs.mkdirSync(path.join(referenceDir, 'sources'), { recursive: true });

  backendProcess = spawn(binaryPath, [], {
    env: {
      ...process.env,
      GM_WORKBENCH_CAMPAIGNS_DIR: campaignsDir,
      GM_WORKBENCH_REFERENCE_DIR: referenceDir,
      GM_WORKBENCH_HOST: '127.0.0.1',
      GM_WORKBENCH_PORT: '8000',
    },
  });
  backendProcess.on('error', (err) => console.error('Backend failed to start:', err));
  backendProcess.stderr.on('data', (chunk) => console.error(`backend: ${chunk}`));
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function waitForBackend(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const request = http.get('http://127.0.0.1:8000/health', (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (remaining <= 0) {
          reject(new Error('Backend did not become ready in time'));
        } else {
          setTimeout(() => attempt(remaining - 1), 200);
        }
      });
    };
    attempt(maxAttempts);
  });
}

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

app.on('ready', async () => {
  if (!isDev) {
    startBackend();
    try {
      await waitForBackend();
    } catch (error) {
      console.error(error);
    }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', stopBackend);

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
