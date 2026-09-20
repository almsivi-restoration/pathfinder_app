/* theme-inspect.js — Playwright _electron harness that reports the COMPUTED
   reality of a dialog surface instead of relying on a screenshot: the exact
   background-image layers, their sizes/positions, the element's box, and a
   sampled pixel grid read from an offscreen canvas. This is the self-describing
   channel that bypasses view_image entirely.

   Usage: node scripts/theme-inspect.js --theme dissidia_rip --dialog quick-roll
*/
const path = require('path');
const fs = require('fs');
const { _electron: electron } = require('playwright');

const APPIMAGE = '/home/mordin/gmw_app/Game-Masters-Workbench-0.15.0-linux-x86_64.AppImage';
const THEMES_DIR = '/home/mordin/.config/Game Masters Workbench/themes';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const THEME = opt('theme', 'dissidia_rip');
const DIALOG = opt('dialog', 'quick-roll');
const CHANNELS = { 'quick-roll': 'open-quick-roll', 'name-generator': 'open-name-generator', 'sheet-importer': 'open-sheet-importer' };

(async () => {
  const app = await electron.launch({ executablePath: APPIMAGE, timeout: 60000 });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (THEME) {
    const css = path.join(THEMES_DIR, THEME, 'theme.css');
    await page.evaluate((c) => {
      let l = document.getElementById('gmw-theme-overrides');
      if (!l) { l = document.createElement('link'); l.id = 'gmw-theme-overrides'; l.rel = 'stylesheet'; document.head.appendChild(l); }
      l.href = 'file://' + c + '?v=' + Date.now();
    }, css);
    await page.waitForTimeout(1500);
  }

  const btn = page.locator('.campaign-button').first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(2500); }

  await app.evaluate(({ BrowserWindow }, ch) => { const w = BrowserWindow.getAllWindows()[0]; if (w) w.webContents.send(ch); }, CHANNELS[DIALOG]);
  await page.waitForTimeout(1200);

  // The self-describing report: computed background layers + box + sampled grid.
  const report = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'no element ' + sel };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      selector: sel,
      box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      backgroundRepeat: cs.backgroundRepeat,
    };
  }, '.' + DIALOG);

  console.log('=== COMPUTED', DIALOG, '===');
  console.log('box:', JSON.stringify(report.box));
  console.log('backgroundImage layers:');
  (report.backgroundImage || '').split(/,(?=linear-gradient|url|radial)/).forEach((l, i) => console.log('  [' + i + ']', l.trim().slice(0, 120)));
  console.log('backgroundSize:', report.backgroundSize);
  console.log('backgroundPosition:', report.backgroundPosition);
  console.log('backgroundRepeat:', report.backgroundRepeat);

  // Sample the modal-window.jpg asset itself: dimensions + a coarse luminance map
  // so we can see WHERE the bright/dark/ornament regions actually are.
  const assetReport = await page.evaluate(async () => {
    const url = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
      .map((r) => (r.style && r.style.backgroundImage) || '')
      .join(' ');
    const m = url.match(/url\("([^"]*modal-window[^"]*)"\)/);
    if (!m) return { error: 'modal-window not referenced' };
    const imgUrl = m[1];
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('load fail')); img.src = imgUrl; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const GW = 16, GH = 18;
    const cw = c.width / GW, ch = c.height / GH;
    const grid = [];
    for (let gy = 0; gy < GH; gy++) {
      let row = '';
      for (let gx = 0; gx < GW; gx++) {
        const d = ctx.getImageData(gx * cw, gy * ch, Math.max(1, cw), Math.max(1, ch)).data;
        let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 7) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
        const lum = s / n;
        row += ' .:-=+*#%@'[Math.min(9, Math.floor(lum / 25.6))];
      }
      grid.push(row);
    }
    return { url: imgUrl.slice(-40), natural: img.naturalWidth + 'x' + img.naturalHeight, grid };
  }).catch((e) => ({ error: e.message }));

  console.log('=== modal-window.jpg asset map (natural ' + (assetReport.natural || '?') + ') ===');
  if (assetReport.grid) assetReport.grid.forEach((r) => console.log('  ' + r));
  else console.log('  ', JSON.stringify(assetReport));

  await app.close();
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
