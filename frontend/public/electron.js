const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
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
// electron-updater ships as a runtime dependency; guard the require so a
// missing module can never block startup.
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch {
  autoUpdater = null;
}

let mainWindow;
let playerWindow;
let backendProcess;

// No apostrophe: electron-builder embeds productName in single-quoted shell in
// the deb maintainer scripts, and an apostrophe breaks the generated postinst.
app.setName('Game Masters Workbench');

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
      GM_WORKBENCH_VERSION: app.getVersion(),
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

// One-shot version probe of the backend already holding :8000. Used when the
// single-instance lock is denied: the running copy may be an older version,
// and silently handing it focus is how a stale backend kept serving after an
// upgrade (the v0.4.2/0.5.0 incident). Resolves with the version string, or
// null if nothing recognizable answered.
function probeRunningInstanceVersion(timeoutMs = 1500) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const request = http.get('http://127.0.0.1:8000/health', (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        try {
          finish(JSON.parse(body).version || 'unknown');
        } catch {
          finish(null);
        }
      });
    });
    request.on('error', () => finish(null));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(null);
    });
  });
}

function waitForBackend(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const request = http.get('http://127.0.0.1:8000/health', (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          // A 200 alone is not enough: a leftover backend from a previous run
          // (or anything else) may already hold the port. Only accept the
          // server if it identifies as our version.
          try {
            const health = JSON.parse(body);
            if (health.version === app.getVersion()) {
              resolve();
            } else {
              reject(new Error(`Port 8000 is held by an incompatible backend (version ${health.version || 'unknown'}, expected ${app.getVersion()})`));
            }
          } catch {
            reject(new Error('Port 8000 answered /health with an unrecognized response'));
          }
        });
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

// Only one instance: a second launch would spawn a backend that cannot bind
// the port and then attach to the first instance's server. Hand focus to the
// running instance instead.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Another instance is running. Before yielding, check whether it is an
  // older version still holding the port — if so, focus-handing would leave
  // the user on the stale copy after an upgrade. Version-blind by design in
  // dev (isDev), where a hand-started backend is expected and its version may
  // legitimately differ.
  app.whenReady().then(async () => {
    if (!isDev) {
      const runningVersion = await probeRunningInstanceVersion();
      if (runningVersion && runningVersion !== app.getVersion()) {
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Older Copy Still Running',
          message: 'Another version of Game Masters Workbench is already running.',
          detail:
            `Running version: ${runningVersion}\nThis launch: ${app.getVersion()}\n\n` +
            'An older copy is still holding the app. Quit it fully — including its player-view window and any orphaned backend — then relaunch to use the new version.',
          buttons: ['OK'],
        });
      }
    }
    app.quit();
  });
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: `Game Master's Workbench v${app.getVersion()}`,
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

// In-app auto-update. Applies to the AppImage (and NSIS on Windows); the deb
// is managed by apt and does not self-update. User data under the per-user
// data directory is never touched by an update — only the application image
// in /opt or the AppImage file is replaced.
function setupAutoUpdater() {
  // Only self-update when running as an AppImage (Linux) or NSIS (Windows);
  // a deb install is managed by apt and must not try to replace itself.
  const isAppImage = !!process.env.APPIMAGE;
  if (isDev || !autoUpdater || (process.platform !== 'win32' && !isAppImage)) {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', () => {
    const window = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!window) return;
    dialog
      .showMessageBox(window, {
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded.',
        detail: 'Restart the application to apply it. Your campaigns and reference library are not affected.',
        buttons: ['Restart Now', 'Later'],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on('error', (error) => console.error('auto-updater:', error));
  autoUpdater.checkForUpdates().catch((error) => console.error('update check failed:', error));
}

app.on('ready', async () => {
  if (!gotSingleInstanceLock) return;
  if (!isDev) {
    startBackend();
    try {
      await waitForBackend();
    } catch (error) {
      // A stale or foreign backend holding the port must not be silently used —
      // the frontend would call routes the running server does not have (the
      // v0.6.0 scene 404s). Surface it and refuse to open against it.
      console.error(error);
      await dialog.showMessageBox({
        type: 'error',
        title: 'Backend Version Mismatch',
        message: 'Cannot start: the backend on port 8000 is not this version of the app.',
        detail:
          `${error.message}\n\n` +
          'Another copy of Game Masters Workbench (or a leftover backend) is likely still running. Quit it fully — including any orphaned process — and relaunch.',
        buttons: ['Quit'],
      });
      stopBackend();
      app.quit();
      return;
    }
    setupAutoUpdater();
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

function showHelp() {
  const window = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!window) return;
  dialog.showMessageBox(window, {
    type: 'info',
    title: 'Help',
    message: "Game Master's Workbench",
    detail:
      `Version ${app.getVersion()}\n\n` +
      'Workflow: create or load a campaign, open a scene, add actors, then run initiative from the GM Dashboard. Open a second, player-safe view with View > Open Player View.\n\n' +
      'Actors: the Clone button duplicates any actor in the scene (handy for groups of identical monsters). The color swatch assigns a marker color, shown as a dot and accent border on the player view to match your physical grid. Save frequently used actors as campaign templates and reuse them in any scene.\n\n' +
      'Bestiary: GM Tools > Bestiary (Ctrl+B) searches a monster CSV you supply. Drop a file named bestiary.csv into the ruleset sources directory (alongside your reference PDFs), Import it, then view entries, create NPCs directly from them, or save them as campaign templates.\n\n' +
      'Encyclopedia: GM Tools > Encyclopedia searches rulebook PDFs you supply. Drop PDFs for a ruleset into its source directory, then Index them there.\n\n' +
      'Name Generator: GM Tools > Name Generator (Ctrl+N) generates fantasy names for characters, places, items, factions, and events.\n\n' +
      'Chronicle: GM Tools > Chronicle (Ctrl+J) is the campaign journal — markdown-formatted entries for session recaps and anything else worth recording, with a formatting guide on the right page.\n\n' +
      'Data lives under:\n' +
      path.join(app.getPath('userData'), 'data') +
      '\n\nKeyboard: Ctrl+B bestiary · Ctrl+J chronicle · Ctrl+N name generator · Ctrl+R restart · Ctrl+Q quit · Ctrl+Shift+I developer tools.',
    buttons: ['Close'],
  });
}

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
          const window = BrowserWindow.getFocusedWindow() || mainWindow;
          if (window) window.webContents.toggleDevTools();
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
          const window = BrowserWindow.getFocusedWindow() || mainWindow;
          if (window) window.webContents.send('open-encyclopedia');
        },
      },
      {
        label: 'Bestiary',
        accelerator: 'CmdOrCtrl+B',
        click: () => {
          const window = BrowserWindow.getFocusedWindow() || mainWindow;
          if (window) window.webContents.send('open-bestiary');
        },
      },
      {
        label: 'Chronicle',
        accelerator: 'CmdOrCtrl+J',
        click: () => {
          const window = BrowserWindow.getFocusedWindow() || mainWindow;
          if (window) window.webContents.send('open-chronicle');
        },
      },
      {
        label: 'Name Generator',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          const window = BrowserWindow.getFocusedWindow() || mainWindow;
          if (window) window.webContents.send('open-name-generator');
        },
      },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'How to Use',
        accelerator: 'F1',
        click: () => {
          showHelp();
        },
      },
      {
        label: `About (v${app.getVersion()})`,
        click: () => {
          const window = BrowserWindow.getFocusedWindow() || mainWindow;
          if (window) {
            dialog.showMessageBox(window, {
              type: 'info',
              title: 'About',
              message: "Game Master's Workbench",
              detail:
                `Version ${app.getVersion()}\n\n` +
                'A tabletop GM companion for Pathfinder 1e and 2e: scene and initiative tracking, reusable actor templates, a searchable rules encyclopedia, a bestiary, a name generator, and a player-safe second-screen view.\n\n' +
                'Reference PDFs and bestiary CSVs are user-supplied and are never included with the app.\n\n' +
                'Data directory:\n' +
                path.join(app.getPath('userData'), 'data'),
              buttons: ['Close'],
            });
          }
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
