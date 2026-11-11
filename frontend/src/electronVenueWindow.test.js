/**
 * @jest-environment node
 */
/**
 * The Venue Screen window, exercised through the real main process with a fake
 * `electron` module. The packaged case only calls the IPC handler: the `ready`
 * handler would spawn the backend, so it is never run there.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';

const mainPath = path.join(__dirname, '..', 'public', 'electron.js');
let userData;

function loadMain({ dev }) {
  const state = { windows: [], ipc: {}, appHandlers: {}, menu: null, focused: null };

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.focusCount = 0;
      this.closed = false;
      this.sent = [];
      this.deliveries = [];
      this.webContents = { send: (channel, ...args) => {
        this.sent.push(channel);
        this.deliveries.push({ channel, args });
      } };
      state.windows.push(this);
    }

    loadURL(url) {
      this.url = url;
    }

    on(event, handler) {
      this.handlers[event] = handler;
    }

    focus() {
      this.focusCount += 1;
    }

    close() {
      this.closed = true;
      if (this.handlers.closed) this.handlers.closed();
    }

    static getAllWindows() {
      return state.windows.filter((window) => !window.closed);
    }

    static getFocusedWindow() {
      return state.focused;
    }
  }

  const app = new Proxy(
    {
      getPath: () => userData,
      getVersion: () => '0.0.0-test',
      requestSingleInstanceLock: () => true,
      on: (event, handler) => {
        state.appHandlers[event] = handler;
      },
      whenReady: () => Promise.resolve(),
    },
    { get: (target, key) => (key in target ? target[key] : () => {}) },
  );

  jest.isolateModules(() => {
    jest.doMock('electron', () => ({
      app,
      BrowserWindow: FakeBrowserWindow,
      Menu: {
        buildFromTemplate: (template) => {
          state.menu = template;
          return template;
        },
        setApplicationMenu: () => {},
      },
      dialog: { showMessageBox: async () => ({}) },
      ipcMain: {
        handle: (channel, handler) => {
          state.ipc[channel] = handler;
        },
      },
      shell: { openPath: () => {} },
    }));
    jest.doMock('electron-is-dev', () => dev);
    jest.doMock('electron-updater', () => ({ autoUpdater: null }));
    require(mainPath);
  });

  return state;
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'gmw-electron-test-'));
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
  jest.resetModules();
});

test('View > Open Venue Screen opens one player-safe ?view=venue window', async () => {
  const state = loadMain({ dev: true });
  await state.appHandlers.ready();

  const viewMenu = state.menu.find((entry) => entry.label === 'View');
  const labels = viewMenu.submenu.map((item) => item.label).filter(Boolean);
  expect(labels.slice(0, 2)).toEqual(['Open Player View', 'Open Venue Screen']);

  const before = state.windows.length;
  viewMenu.submenu.find((item) => item.label === 'Open Venue Screen').click();

  expect(state.windows).toHaveLength(before + 1);
  const venueWindow = state.windows[state.windows.length - 1];
  expect(venueWindow.url).toBe('http://localhost:3000/?view=venue');
  expect(venueWindow.options.webPreferences.nodeIntegration).toBe(false);
  expect(venueWindow.options.webPreferences.preload).toBe(
    path.join(path.dirname(mainPath), 'preload.js'),
  );
});

test('the open-venue-window IPC reuses an open screen and reopens a closed one', async () => {
  const state = loadMain({ dev: true });

  await state.ipc['open-venue-window']();
  expect(state.windows).toHaveLength(1);
  const first = state.windows[0];

  await state.ipc['open-venue-window']();
  expect(state.windows).toHaveLength(1);
  expect(first.focusCount).toBe(1);

  first.close();
  await state.ipc['open-venue-window']();
  expect(state.windows).toHaveLength(2);
  expect(state.windows[1].url).toBe('http://localhost:3000/?view=venue');
});

test('the packaged venue window loads the built app with ?view=venue', async () => {
  // Electron-only global, read when the packaged build resolves theme paths.
  process.resourcesPath = userData;
  try {
    const state = loadMain({ dev: false });

    await state.ipc['open-venue-window']();

    expect(state.windows[0].url).toBe(
      `file://${path.join(path.dirname(mainPath), '..', 'build', 'index.html')}?view=venue`,
    );
  } finally {
    delete process.resourcesPath;
  }
});

test('the preload bridge exposes openVenueWindow over the same channel', () => {
  const preload = fs.readFileSync(path.join(path.dirname(mainPath), 'preload.js'), 'utf8');

  expect(preload).toMatch(/openVenueWindow:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('open-venue-window'\)/);
});

// The Venue Screen and Player View are player-facing: a GM tool opened from the menu while
// one of them has focus must land on the GM window, never on the screen the table can see.
test('GM Tools always open on the GM window, whichever window has focus', async () => {
  const state = loadMain({ dev: true });
  await state.appHandlers.ready();
  const gmWindow = state.windows[0];
  await state.ipc['open-venue-window']();
  const venueWindow = state.windows[state.windows.length - 1];
  state.focused = venueWindow;

  const tools = state.menu.find((entry) => entry.label === 'GM Tools').submenu;
  tools.forEach((item) => item.click());

  expect(venueWindow.sent).toEqual([]);
  expect(gmWindow.sent).toEqual([
    'open-encyclopedia',
    'open-bestiary',
    'open-venues',
    'open-chronicle',
    'open-name-generator',
    'open-quick-roll',
    'open-sheet-importer',
    'open-harrowing',
  ]);
  expect(gmWindow.focusCount).toBe(tools.length);
});

test('About opens on the GM window with the actual app version and complete content', async () => {
  const state = loadMain({ dev: true });
  await state.appHandlers.ready();
  const gmWindow = state.windows[0];
  await state.ipc['open-venue-window']();
  const venueWindow = state.windows[state.windows.length - 1];
  state.focused = venueWindow;

  const help = state.menu.find((entry) => entry.label === 'Help').submenu;
  help.find((entry) => entry.label.startsWith('About')).click();

  expect(venueWindow.sent).toEqual([]);
  expect(gmWindow.focusCount).toBe(1);
  expect(gmWindow.deliveries).toEqual([{
    channel: 'open-about',
    args: [{
      version: '0.0.0-test',
      description: expect.stringContaining('A tabletop GM companion'),
      dataDirectory: path.join(userData, 'data'),
    }],
  }]);
  expect(gmWindow.deliveries[0].args[0].description).toContain('Reference PDFs and bestiary CSVs are user-supplied');
});

test('the About preload subscription forwards details and removes its listener', () => {
  let bridge;
  const ipcRenderer = { on: jest.fn(), removeListener: jest.fn() };
  vm.runInNewContext(fs.readFileSync(path.join(path.dirname(mainPath), 'preload.js'), 'utf8'), {
    require: () => ({
      contextBridge: { exposeInMainWorld: (_name, exposed) => { bridge = exposed; } },
      ipcRenderer,
    }),
    window: { addEventListener: jest.fn() },
    process: { env: {} },
  });
  const callback = jest.fn();
  const unsubscribe = bridge.onOpenAbout(callback);
  const [channel, listener] = ipcRenderer.on.mock.calls[0];
  const details = { version: '0.0.0-test', description: 'About', dataDirectory: '/data' };
  expect(channel).toBe('open-about');
  listener({}, details);
  expect(callback).toHaveBeenCalledWith(details);
  unsubscribe();
  expect(ipcRenderer.removeListener).toHaveBeenCalledWith(channel, listener);
});
