/* demo-capture.js — scripted demo capture for the packaged Game Master's
   Workbench AppImage. Uses Playwright's Electron driver and its built-in
   video recorder; emits one MKV-compatible WebM per beat plus stills.

   Hard boundaries: only the packaged app, synthetic Demo Vault campaign, and
   the shipped built-in themes. No reference PDFs, bestiary content, OCR
   source pages, credentials, or Rip Lab/local ripped theme assets.

   Usage:
     node frontend/scripts/demo-capture.js
*/
const path = require('path');
const fs = require('fs');
const { _electron: electron } = require('playwright');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APPIMAGE = '/home/mordin/gmw_app/Game-Masters-Workbench-0.15.0-linux-x86_64.AppImage';
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'local', 'demo_capture', 'captures');
const VIDEO_TMP = path.join(REPO_ROOT, 'artifacts', 'local', 'demo_capture', 'video_tmp');
const CAMPAIGN = 'Demo Vault';
const SCENE_NAME = 'Lantern Vault - First Chamber';

const BEATS = {
  'beat-1-app-running': { targetMs: 25000 },
  'beat-4-table-filler': { targetMs: 25000 },
};

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing expected file: ${filePath}`);
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) throw new Error(`empty expected file: ${filePath}`);
  return stat.size;
}

async function launchApp(beatName) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_TMP, { recursive: true });
  const app = await electron.launch({
    executablePath: APPIMAGE,
    args: [],
    timeout: 60000,
    recordVideo: {
      dir: VIDEO_TMP,
      size: { width: 1400, height: 875 },
    },
  });
  const page = await app.firstWindow({ timeout: 60000 });
  await page.locator('.App').waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  return { app, page, beatName };
}

async function finishCapture(app, page, beatName) {
  const screenshotPath = path.join(OUT_DIR, `${beatName}.png`);
  await page.screenshot({ path: screenshotPath });
  const video = page.video();
  await app.close();
  let finalVideo = null;
  if (video) {
    const rawPath = await video.path();
    finalVideo = path.join(OUT_DIR, `${beatName}.webm`);
    fs.copyFileSync(rawPath, finalVideo);
    fs.rmSync(rawPath, { force: true });
  }
  const pngBytes = assertFileExists(screenshotPath);
  const videoBytes = finalVideo ? assertFileExists(finalVideo) : 0;
  return { beatName, screenshotPath, pngBytes, finalVideo, videoBytes };
}

async function loadDemoScene(page) {
  const campaignButton = page.locator('.campaign-button', { hasText: CAMPAIGN }).first();
  if (await campaignButton.count()) {
    await campaignButton.click();
    await page.waitForTimeout(1800);
  }
  const sceneRow = page.locator('.scene-library-row', { hasText: SCENE_NAME }).first();
  if (await sceneRow.count()) {
    await sceneRow.locator('button', { hasText: 'Load' }).click();
    await page.waitForTimeout(1800);
  }
  await page.locator('.actor-row', { hasText: 'Mira Quill' }).first().waitFor({ timeout: 10000 });
}

async function beatAppRunning() {
  const { app, page, beatName } = await launchApp('beat-1-app-running');
  await loadDemoScene(page);
  await page.waitForTimeout(2500);

  const viewButton = page.locator('.actor-row', { hasText: 'Mira Quill' }).locator('button', { hasText: 'View' }).first();
  await viewButton.click();
  await page.waitForTimeout(3500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);

  await page.locator('.initiative-tracker').scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);

  const playerWindowPromise = app.waitForEvent('window', { timeout: 8000 }).catch(() => null);
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('open-player-view');
  });
  const playerWindow = await playerWindowPromise;
  if (playerWindow) {
    await playerWindow.waitForLoadState('domcontentloaded');
    await playerWindow.waitForTimeout(4000);
    await playerWindow.close();
  }
  await page.waitForTimeout(4000);
  return finishCapture(app, page, beatName);
}

async function beatTableFiller() {
  const { app, page, beatName } = await launchApp('beat-4-table-filler');
  await loadDemoScene(page);
  await page.waitForTimeout(1500);

  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('open-name-generator');
  });
  await page.locator('.name-generator').waitFor({ timeout: 10000 });
  await page.locator('.name-generator button', { hasText: 'Generate' }).click();
  await page.waitForTimeout(4000);
  await page.keyboard.press('Escape');
  await page.locator('.name-generator-footer button', { hasText: 'Close' }).click();
  await page.waitForTimeout(1000);

  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('open-quick-roll');
  });
  await page.locator('.quick-roll').waitFor({ timeout: 10000 });
  await page.locator('.quick-roll select').first().selectOption({ label: 'Mira Quill' });
  await page.locator('.quick-roll button', { hasText: 'Roll' }).click();
  await page.waitForTimeout(5000);
  await page.locator('.quick-roll-footer button, .quick-roll button', { hasText: 'Close' }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(2500);
  return finishCapture(app, page, beatName);
}

(async () => {
  if (!fs.existsSync(APPIMAGE)) throw new Error(`AppImage not found: ${APPIMAGE}`);
  const results = [];
  results.push(await beatAppRunning());
  results.push(await beatTableFiller());
  for (const result of results) {
    console.log(`${result.beatName}: png=${result.pngBytes} bytes video=${result.videoBytes} bytes`);
  }
  fs.rmSync(VIDEO_TMP, { recursive: true, force: true });
  console.log('PASS: scripted demo capture complete');
})().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
