/* theme-preview.js — launch the packaged GM Workbench AppImage under Playwright
   (_electron), apply a local theme, load a campaign, and open a dialog, then
   screenshot. Replaces the hand-rolled CDP harness and the "please click" loop.

   Usage:
     node scripts/theme-preview.js --theme dissidia_rip --dialog quick-roll \
       --out /tmp/gmw_preview.png

   Options:
     --theme <id>     theme id to force-apply (default: leave whatever's active)
     --dialog <name>  quick-roll | name-generator | sheet-importer | none (default none)
     --campaign <n>   campaign to load (default: first in the list; 'skip' to stay on selector)
     --out <path>     screenshot path (default /tmp/gmw_preview.png)
     --keep           leave the app running after capture
*/
const path = require('path');
const fs = require('fs');
const { _electron: electron } = require('playwright');

const APPIMAGE = '/home/mordin/gmw_app/Game-Masters-Workbench-0.15.0-linux-x86_64.AppImage';
const THEMES_DIR = '/home/mordin/.config/Game Masters Workbench/themes';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const THEME = opt('theme', null);
const DIALOG = opt('dialog', 'none');
const CAMPAIGN = opt('campaign', null); // null = first, 'skip' = stay on selector
const OUT = opt('out', '/tmp/gmw_preview.png');
const KEEP = args.includes('--keep');

const DIALOG_KEYS = {
  'quick-roll': 'Control+d',
  'name-generator': 'Control+n',
  'sheet-importer': 'Control+i',
};

(async () => {
  console.log('launching', APPIMAGE);
  const app = await electron.launch({
    executablePath: APPIMAGE,
    args: [],
    timeout: 60000,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // backend spin-up

  // Apply the requested theme exactly as theme.js does (cache-busted link).
  if (THEME) {
    const cssPath = path.join(THEMES_DIR, THEME, 'theme.css');
    if (!fs.existsSync(cssPath)) throw new Error('theme css not found: ' + cssPath);
    await page.evaluate((css) => {
      let link = document.getElementById('gmw-theme-overrides');
      if (!link) {
        link = document.createElement('link');
        link.id = 'gmw-theme-overrides';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = 'file://' + css + '?v=' + Date.now();
    }, cssPath);
    await page.waitForTimeout(1500);
    console.log('theme applied:', THEME);
  }

  // Load a campaign (to reach the dashboard where dialogs are reachable).
  if (CAMPAIGN !== 'skip') {
    const btn = page.locator('.campaign-button').first();
    if (await btn.count()) {
      const name = CAMPAIGN ? page.locator('.campaign-button', { hasText: CAMPAIGN }).first() : btn;
      await name.click();
      await page.waitForTimeout(2500);
      console.log('campaign loaded');
    } else {
      console.log('no campaign buttons (already past selector)');
    }
  }

  // Open the dialog by sending the IPC the main-process menu sends. Playwright's
  // app.evaluate runs in the MAIN process, so it can reach BrowserWindow and
  // webContents.send() directly — the renderer only listens for these channels.
  const DIALOG_CHANNELS = {
    'quick-roll': 'open-quick-roll',
    'name-generator': 'open-name-generator',
    'sheet-importer': 'open-sheet-importer',
  };
  if (DIALOG !== 'none' && DIALOG_CHANNELS[DIALOG]) {
    await app.evaluate(({ BrowserWindow }, channel) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send(channel);
    }, DIALOG_CHANNELS[DIALOG]);
    await page.waitForTimeout(1500);
    const open = await page.locator('.' + DIALOG).count();
    console.log('dialog', DIALOG, 'open:', open > 0);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT });
  console.log('screenshot:', OUT);

  if (!KEEP) await app.close();
  else console.log('keeping app running');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
