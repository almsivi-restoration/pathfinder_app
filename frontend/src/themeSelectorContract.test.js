/**
 * @jest-environment node
 */
/**
 * The skin selector contract (.github/blueprints/ui-theme-generation.md) as a
 * check. A shipped skin keeps its own silhouette only on the selectors it
 * redeclares; one it misses silently wears the base look instead (the carved
 * Morrowind frame on a Dissidia dialog, a flat token box among Pokémon text
 * boxes). Every selector listed here must own a rule in every shipped skin.
 */
import fs from 'fs';
import path from 'path';

const frontend = path.join(__dirname, '..');
const baseSheet = path.join(__dirname, 'styles', 'theme.css');
const skinSheet = (id) => path.join(frontend, 'public', 'themes', id, 'theme.css');

// Surfaces a skin must redeclare beyond the base's framed windows. Add a
// selector here in the same change that adds the surface to the app.
const HEADER_BARS = ['.gm-header', '.player-header', '.actor-header', '.mw-banner', '.venue-screen-header'];
const BARE_ON_BACKDROP = [
  '.encyclopedia-header',
  '.bestiary-header',
  '.reference-reader-header',
  '.venues-header',
  '.bestiary-source',
  '.bestiary-search-panel',
  '.bestiary-detail',
  '.venue-toolbar',
  '.venue-sidebar-section',
  '.venue-library-new',
  '.venue-status',
];
// Text that sits straight on the backdrop with no surface of its own.
const BARE_TEXT = ['.waiting', '.venue-screen-waiting'];

// Selector lists of every rule in a sheet; with `declaring`, only rules whose body sets it.
function ruleSelectors(file, declaring) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = new Set();
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (declaring && !new RegExp(`(^|[;\\s])${declaring}\\s*:`).test(body)) continue;
    head.split(',').forEach((selector) => selectors.add(selector.trim()));
  }
  return selectors;
}

function shippedSkins() {
  const main = fs.readFileSync(path.join(frontend, 'public', 'electron.js'), 'utf8');
  const [, list] = /BUILT_IN_EXTRA_THEMES = \[([\s\S]*?)\]/.exec(main);
  return [...list.matchAll(/id: '([^']+)'/g)].map(([, id]) => id);
}

// Selectors inside `@media print` blocks that are not scoped under `scope`.
function unscopedPrintSelectors(css, scope) {
  const loose = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let cursor = stripped.indexOf('@media print');
  while (cursor !== -1) {
    const open = stripped.indexOf('{', cursor);
    let depth = 1;
    let end = open + 1;
    while (depth > 0 && end < stripped.length) {
      if (stripped[end] === '{') depth += 1;
      if (stripped[end] === '}') depth -= 1;
      end += 1;
    }
    const body = stripped.slice(open + 1, end - 1);
    for (const [, head] of body.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      head.split(',').map((selector) => selector.trim()).forEach((selector) => {
        if (!selector.startsWith('@') && !selector.startsWith(scope)) loose.push(selector);
      });
    }
    cursor = stripped.indexOf('@media print', end);
  }
  return loose;
}

const framedWindows = [...ruleSelectors(baseSheet, 'border-image')];
const skins = shippedSkins();

test('the contract has something to check', () => {
  expect(skins).toEqual(expect.arrayContaining(['dissidia', 'pokemon']));
  expect(framedWindows).toEqual(expect.arrayContaining(['.mw-panel', '.actor-view-modal', '.mat-guide']));
});

describe.each(skins)('the %s skin', (id) => {
  const owned = ruleSelectors(skinSheet(id));
  const missing = (selectors) => selectors.filter((selector) => !owned.has(selector));

  test('redeclares every window the base frames', () => {
    expect(missing(framedWindows)).toEqual([]);
  });

  test('redeclares every header bar', () => {
    expect(missing(HEADER_BARS)).toEqual([]);
  });

  test('plates every surface that sits bare on the backdrop', () => {
    expect(missing(BARE_ON_BACKDROP)).toEqual([]);
  });

  test('restates text that sits bare on the backdrop', () => {
    expect(missing(BARE_TEXT)).toEqual([]);
  });
});

// The Mat Guide prints as plain ink on paper whatever the theme. The base theme sheet and
// every skin load after MatGuide.css and restyle its classes, so a bare `.mat-guide` print
// rule loses to them and the page prints with the skin's frame (it did, in review).
describe('Mat Guide print rules', () => {
  const SCOPE = 'body.mat-guide-open';

  test('the check catches a print rule a skin could override', () => {
    const css = `
      .mat-guide { border: 2px solid; }
      @media print {
        @page { margin: 0.4in; }
        ${SCOPE} .mat-guide { border: none; }
        .mat-guide-sheet, ${SCOPE} .mat-guide-key li { padding: 0; }
      }`;
    expect(unscopedPrintSelectors(css, SCOPE)).toEqual(['.mat-guide-sheet']);
  });

  test('every print rule is scoped to outrank the skins', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles', 'MatGuide.css'), 'utf8');
    expect(css).toContain('@media print');
    expect(unscopedPrintSelectors(css, SCOPE)).toEqual([]);
  });
});
