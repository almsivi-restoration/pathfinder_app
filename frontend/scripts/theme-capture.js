/* theme-capture.js — drive the REAL Electron main process through every
 * screen of the app under a chosen theme and write one capturePage() PNG per
 * screen. This is the verification instrument for theme work: the blueprint
 * (.github/blueprints/ui-theme-generation.md) requires rendered-pixel review
 * of every screen for every built-in before a theme change is committed.
 *
 * Screens: campaign selector (+hover), GM dashboard landing, actor-edit
 * dialog, active scene (turn 1, turn 2, row hover), Quick Roll, Name
 * Generator, Sheet Importer, The Harrowing, Chronicle, actor-view dialog,
 * Encyclopedia, Bestiary, player view (baseline, big-hit FX, heal FX).
 *
 * It seeds its own campaign/scene/templates/chronicle entries through the
 * backend API (idempotent), so point the backend at a scratch campaigns dir.
 * The theme stylesheet is injected SAME-ORIGIN from frontend/public/themes/<id>
 * (CRA serves public/), so parsed cssRules are readable and the harness can
 * prove the sheet's selectors actually landed.
 *
 * Prereqs (three terminals):
 *   cd backend && GM_WORKBENCH_CAMPAIGNS_DIR=/tmp/gmw_capture_campaigns \
 *     venv/bin/python main.py                                  (backend :8000)
 *   cd frontend && BROWSER=none PORT=3000 npm run react-start  (CRA dev :3000;
 *     plain `npm start` also spawns a stray Electron via concurrently)
 * Usage:
 *   cd frontend && node scripts/theme-capture.js <themeId|morrowind> [outPrefix]
 * Output: frontend/scripts/captures/<outPrefix>-<screen>.png (gitignored).
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { _electron: electron } = require('playwright');

const root = path.resolve(__dirname, '../..');
// Usage: node capture_theme.js <themeId|morrowind> [outPrefix]
const THEME = process.argv[2] || 'morrowind';
const outPrefix = process.argv[3] || THEME;
const themeHref = () => `/themes/${THEME}/theme.css?v=${Date.now()}`;
const outDir = path.join(__dirname, 'captures');

const CAMPAIGN = 'Hoenn League';
const SCENE = 'Route 110 Ambush';
const SEED_ACTORS = [
  { name: 'Ythlara', is_pc: true, player_name: 'Ada', color: '#f8d030', initiative_roll: 12, hp: { current: 30, max: 45 } },
  { name: 'Doran Ironfist', is_pc: true, player_name: 'Ben', color: '#3060d0', initiative_roll: 22, hp: { current: 18, max: 45 } },
  { name: 'Rift Spawn', is_pc: false, color: '#e03838', initiative_roll: 7, hp: { current: 9, max: 45 } },
  { name: 'Whisper Shade', is_pc: false, color: '#a040a0', initiative_roll: 18, hp: { current: 45, max: 45 } },
];

function api(method, route, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: 8000, path: route, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function seedScene() {
  let r = await api('POST', `/api/campaign/load?name=${encodeURIComponent(CAMPAIGN)}`);
  if (r.status === 404) {
    r = await api('POST', `/api/campaign/new?name=${encodeURIComponent(CAMPAIGN)}&ruleset=1e`);
    if (r.status !== 200) throw new Error(`campaign new: ${r.status} ${JSON.stringify(r.body)}`);
    console.log('created campaign');
  } else if (r.status !== 200) throw new Error(`campaign load: ${r.status} ${JSON.stringify(r.body)}`);
  r = await api('GET', '/api/scenes');
  let scene = (r.body.scenes || []).find((s) => s.name === SCENE);
  if (!scene) {
    r = await api('POST', `/api/scene/new?name=${encodeURIComponent(SCENE)}`);
    if (r.status !== 200) throw new Error(`scene new: ${r.status}`);
    scene = r.body;
    console.log(`seeded scene ${scene.id}`);
  }
  r = await api('POST', `/api/scene/load?scene_id=${scene.id}`);
  if (r.status !== 200) throw new Error(`scene load: ${r.status}`);
  let current = (await api('GET', '/api/scene/current')).body;
  if (!current.actors || current.actors.length < SEED_ACTORS.length) {
    for (const a of SEED_ACTORS) {
      const { hp, ...rest } = a;
      r = await api('POST', '/api/actor/add', {
        id: '', ...rest,
        sheet: { hp, defenses: { ac: 18 }, initiative: { bonus: 3 } },
      });
      if (r.status !== 200) throw new Error(`actor add ${a.name}: ${r.status} ${JSON.stringify(r.body)}`);
    }
    current = (await api('GET', '/api/scene/current')).body;
    console.log(`seeded ${SEED_ACTORS.length} actors`);
  }
  const ids = current.actors.map((a) => a.id);
  r = await api('POST', '/api/initiative/set', { actor_ids: ids });
  if (r.status !== 200) throw new Error(`initiative set: ${r.status} ${JSON.stringify(r.body)}`);
  r = await api('POST', '/api/initiative/next');
  if (r.status !== 200) throw new Error(`initiative next: ${r.status}`);
  // Persist or the next run finds no scene on disk and re-seeds a duplicate
  // (list_scenes reads the campaign dir; scene state is memory-only until
  // saved — first run of this harness created two orphan scenes this way).
  const save = await api('POST', '/api/scene/save');
  if (save.status !== 200) throw new Error(`scene save: ${save.status}`);
  // Chronicle entries for the codex capture (idempotent — seed once).
  const chr = await api('GET', '/api/campaign/chronicle');
  if ((chr.body.entries || []).length === 0) {
    const entries = [
      {
        title: 'The Bridge at Dawn',
        body: 'The party reached the shattered span at first light. The rift wind carried whispers — Ythlara named them *a debt to be collected*.\n\n## Aftermath\n\n- Doran held the line alone for three rounds\n- The spawn broke against the wards\n\n> "The bridge remembers," the shade said.',
      },
      {
        title: 'Whispers in the Rift',
        body: 'Something answered when Doran spoke the old words. We marked the stone and swore to return with the relic.\n\n**Next session:** delve the under-span.',
      },
    ];
    for (const e of entries) {
      const er = await api('POST', '/api/campaign/chronicle/add', e);
      if (er.status !== 200) throw new Error(`chronicle add: ${er.status} ${JSON.stringify(er.body)}`);
    }
    console.log(`seeded ${entries.length} chronicle entries`);
  }
  // Campaign actor templates so the dashboard landing capture shows the
  // populated list, not just the empty placeholder (idempotent — seed once).
  const tpl = await api('GET', '/api/campaign/actor-templates');
  if ((tpl.body.templates || []).length === 0) {
    for (const a of SEED_ACTORS) {
      const { hp, ...rest } = a;
      const tr = await api('POST', '/api/campaign/actor-template/add', {
        id: '', ...rest,
        sheet: { hp, defenses: { ac: 18 }, initiative: { bonus: 3 } },
      });
      if (tr.status !== 200) throw new Error(`template add ${a.name}: ${tr.status} ${JSON.stringify(tr.body)}`);
    }
    console.log(`seeded ${SEED_ACTORS.length} actor templates`);
  }
  await api('POST', '/api/campaign/save');
  console.log(`seed ready: ${ids.length} actors, round ${r.body.round}, turn ${r.body.turn_index}`);
}

async function waitForHttp(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => { res.resume(); res.statusCode < 500 ? resolve() : reject(new Error(String(res.statusCode))); })
          .on('error', reject);
      });
      return;
    } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error(`${url} never came up`);
}

async function injectTheme(page) {
  await page.evaluate(() => {
    document.querySelectorAll('link[href*="/themes/"]').forEach((l) => l.remove());
  });
  if (THEME === 'morrowind') { await page.waitForTimeout(400); return; }
  await page.evaluate((href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, themeHref());
  await page.waitForFunction(
    (t) => [...document.styleSheets].some((s) => s.href?.includes(`/themes/${t}/`)), THEME,
  );
  await page.waitForTimeout(400);
}

const expectedSelectors = ['.gm-header', '.mw-banner', '.btn-primary', '.btn-small'];

async function proveParsedRules(page) {
  if (THEME === 'morrowind') { console.log('base theme: no override sheet to prove'); return; }
  const report = await page.evaluate((wanted) => {
    const sheet = [...document.styleSheets].find((s) => s.href?.includes('/themes/'));
    const texts = [];
    const walk = (rules) => {
      for (const r of rules) {
        if (r.selectorText) texts.push(r.selectorText);
        if (r.cssRules) walk(r.cssRules);
      }
    };
    walk(sheet.cssRules);
    const present = new Set(texts.flatMap((t) => t.split(',').map((s) => s.trim())));
    return { total: texts.length, missing: wanted.filter((w) => !present.has(w)) };
  }, expectedSelectors);
  console.log(`theme sheet rules: ${report.total}`);
  if (report.missing.length) throw new Error(`selectors MISSING from parsed sheet: ${report.missing.join(' | ')}`);
  console.log('all key selectors present in parsed sheet');
}

(async () => {
  await seedScene();
  await waitForHttp('http://localhost:3000');
  console.log('CRA dev server up');

  const app = await electron.launch({
    executablePath: path.join(root, 'frontend/node_modules/electron/dist/electron'),
    // --disable-gpu: the real main process FATALs on GPU process launch in
    // this environment (bare default-app launches survive without it; the
    // app's own window creation does not). Software rendering is fine for
    // captures.
    args: ['--no-sandbox', '--disable-gpu', path.join(root, 'frontend')],
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1440, 900);
    });
    await page.locator('.campaign-selector').waitFor({ timeout: 60000 });
    await page.waitForTimeout(1200); // let the app's own theme link settle first
    await injectTheme(page);
    await proveParsedRules(page);

    fs.mkdirSync(outDir, { recursive: true });

    // Capture through the main process, matching the window by its URL
    // (main window is localhost:3000/, player window is .../?view=player).
    const snapPage = async (targetPage, name) => {
      const url = targetPage.url();
      const dataUrl = await app.evaluate(async ({ BrowserWindow }, wantUrl) => {
        const wc = BrowserWindow.getAllWindows()
          .map((w) => w.webContents)
          .find((c) => c.getURL() === wantUrl);
        if (!wc) throw new Error(`no webContents for ${wantUrl}`);
        const img = await wc.capturePage();
        return img.toDataURL();
      }, url);
      const file = path.join(outDir, `${outPrefix}-${name}.png`);
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(file);
    };

    const sendChannel = async (channel) => {
      await app.evaluate(({ BrowserWindow }, ch) => {
        BrowserWindow.getAllWindows()[0].webContents.send(ch);
      }, channel);
    };

    // ---- Campaign selector: the start menu itself (font + paradigm check) ----
    await snapPage(page, 'campaign-selector');
    await page.locator('.campaign-button', { hasText: CAMPAIGN }).hover();
    await page.waitForTimeout(300);
    await snapPage(page, 'campaign-selector-hover');
    await page.mouse.move(20, 20);

    // ---- GM dashboard: active turn carries the bar and glove ----
    await page.locator('.campaign-button', { hasText: CAMPAIGN }).click();
    await page.locator('.gm-dashboard').waitFor();
    // The selected-campaign landing screen itself (campaign actors + scene
    // library, no scene active) — the app's real second page, driven
    // through for years of captures but never snapped until now.
    await page.waitForTimeout(400);
    await snapPage(page, 'gm-dashboard');

    // The actor-edit dialog (the fifth dialog surface — only actor-view was
    // captured before), opened from a template row while still on the
    // dashboard.
    await page.locator('.template-row').first().waitFor();
    await page.locator('.template-row').first().locator('button.btn-edit').click();
    await page.locator('.actor-edit-modal').waitFor();
    await page.waitForTimeout(350);
    await snapPage(page, 'dialog-actor-edit');
    await page.locator('.actor-edit-modal .btn-close').click();
    await page.locator('.actor-edit-modal').waitFor({ state: 'detached' });
    // The store doesn't auto-open the backend's active scene — open it from
    // the library (scene-creator shows when no scene is active).
    if (await page.locator('.scene-creator').count()) {
      await page.locator('.scene-library-row', { hasText: SCENE }).getByRole('button', { name: 'Load' }).click();
    }
    await page.locator('.initiative-item').first().waitFor();
    // The seeded scene is persisted but not "active" in the store — click
    // Start Scene so the tracker enters the running state (round info, the
    // active-turn bar + glove, and Next Turn all gate on this).
    const startBtn = page.locator('.initiative-controls .btn-primary');
    if ((await startBtn.textContent())?.trim() === 'Start Scene') {
      await startBtn.click();
      await page.locator('.initiative-active').waitFor();
    }
    await page.waitForTimeout(500);
    await snapPage(page, 'gm-active');

    await page.locator('.initiative-active .btn-primary').click(); // Next Turn
    await page.waitForTimeout(400);
    await snapPage(page, 'gm-turn2');

    await page.locator('.actor-row').nth(2).hover();
    await page.waitForTimeout(300);
    await snapPage(page, 'gm-row-hover');
    await page.mouse.move(20, 400);

    // ---- Dialogs via the real menu channels ----
    const dialogs = [
      ['open-quick-roll', '.quick-roll', 'dialog-quick-roll'],
      ['open-name-generator', '.name-generator', 'dialog-name-generator'],
      ['open-sheet-importer', '.sheet-importer', 'dialog-sheet-importer'],
      ['open-harrowing', '.harrowing', 'dialog-harrowing'],
    ];
    for (const [channel, selector, name] of dialogs) {
      await sendChannel(channel);
      await page.locator(selector).waitFor();
      await page.waitForTimeout(350);
      await snapPage(page, name);
      const closeBtn = page.locator(selector).getByRole('button', { name: 'Close' });
      if (await closeBtn.count()) {
        await closeBtn.click();
      } else {
        await page.locator(`${selector}-backdrop`).click({ position: { x: 8, y: 8 } });
      }
      await page.locator(selector).waitFor({ state: 'detached' });
    }

    // ---- Chronicle (the ice codex) ----
    await sendChannel('open-chronicle');
    await page.locator('.chronicle-book').waitFor();
    await page.waitForTimeout(450);
    await snapPage(page, 'dialog-chronicle');
    await page.locator('.chronicle-book').getByRole('button', { name: 'Close' }).click();
    await page.locator('.chronicle-book').waitFor({ state: 'detached' });

    // ---- Actor view modal ----
    await page.locator('.actor-row').first().locator('button[title="View actor details"]').click();
    await page.locator('.actor-view-modal').waitFor();
    await page.waitForTimeout(350);
    await snapPage(page, 'dialog-actor-view');
    await page.locator('.actor-view-modal .btn-close').click();
    await page.locator('.actor-view-modal').waitFor({ state: 'detached' });

    // ---- Encyclopedia + Bestiary ----
    await sendChannel('open-encyclopedia');
    await page.locator('.encyclopedia').waitFor();
    await page.waitForTimeout(400);
    await snapPage(page, 'encyclopedia');
    await page.getByRole('button', { name: /Back to/ }).click();
    await page.locator('.gm-dashboard').waitFor();

    await sendChannel('open-bestiary');
    await page.locator('.bestiary-page').waitFor();
    await page.waitForTimeout(400);
    await snapPage(page, 'bestiary');
    await page.getByRole('button', { name: /Back to/ }).click();
    await page.locator('.gm-dashboard').waitFor();

    // ---- Player view (real second window) ----
    const playerPagePromise = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Open Player View' }).click();
    const playerPage = await playerPagePromise;
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('view=player'));
      if (win) win.setSize(1280, 800);
    });
    await playerPage.locator('.player-view').waitFor();
    await injectTheme(playerPage);
    await playerPage.waitForTimeout(400);
    await snapPage(playerPage, 'player-view');

    // ---- Player view HP impact FX ----
    // Big hit on Ythlara (30 -> 8 of 45 ≈ 49% ≥ 20% threshold): the player
    // window's next poll must play shake + flash + damage ghost. The fx only
    // lives ~1s, but locator waits are mutation-driven so we catch it live.
    const sceneNow = (await api('GET', '/api/scene/current')).body;
    const hitTarget = sceneNow.actors.find((a) => a.name === 'Ythlara');
    const hurt = {
      ...hitTarget,
      sheet: { ...hitTarget.sheet, hp: { ...hitTarget.sheet.hp, current: 8 } },
    };
    let fxr = await api('PUT', `/api/actor/${hitTarget.id}`, hurt);
    if (fxr.status !== 200) throw new Error(`actor hit: ${fxr.status} ${JSON.stringify(fxr.body)}`);
    await playerPage.locator('.hp-fx-hit-big').waitFor({ timeout: 8000 });
    await snapPage(playerPage, 'player-view-big-hit');
    await playerPage.locator('.hp-fx-hit-big').waitFor({ state: 'detached', timeout: 8000 });

    // Restore to full (reads as a heal glow on the player window) so the next
    // run's baseline capture starts at the seeded HP.
    fxr = await api('PUT', `/api/actor/${hitTarget.id}`, hitTarget);
    if (fxr.status !== 200) throw new Error(`actor restore: ${fxr.status} ${JSON.stringify(fxr.body)}`);
    await playerPage.locator('.hp-fx-heal').waitFor({ timeout: 8000 });
    await snapPage(playerPage, 'player-view-heal');
    await playerPage.locator('.hp-fx-heal').waitFor({ state: 'detached', timeout: 8000 });

    console.log('all captures done');
  } finally {
    await app.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
