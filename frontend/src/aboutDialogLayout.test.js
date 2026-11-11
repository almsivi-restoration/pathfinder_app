/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, 'styles', 'AboutDialog.css'), 'utf8');

test('bounds the About dialog to the viewport and scrolls only its body', () => {
  const dialog = /\.about-dialog\s*\{([^}]+)\}/.exec(css)[1];
  const body = /\.about-body\s*\{([^}]+)\}/.exec(css)[1];
  const controls = /\.about-header,\s*\.about-footer\s*\{([^}]+)\}/.exec(css)[1];
  expect(dialog).toMatch(/display:\s*flex;/);
  expect(dialog).toMatch(/flex-direction:\s*column;/);
  expect(dialog).toMatch(/max-height:\s*calc\(100vh - 32px\);/);
  expect(dialog).toMatch(/max-height:\s*calc\(100dvh - 32px\);/);
  expect(dialog).toMatch(/box-sizing:\s*border-box;/);
  expect(body).toMatch(/min-height:\s*0;/);
  expect(body).toMatch(/overflow-y:\s*auto;/);
  expect(body).toMatch(/overflow-wrap:\s*anywhere;/);
  expect(controls).toMatch(/flex:\s*0 0 auto;/);
});

test('compacts the fixed controls on short viewports so details retain scroll space', () => {
  expect(css).toMatch(/@media\s*\(max-height:\s*400px\)/);
  const compact = css.slice(css.indexOf('@media'));
  expect(compact).toMatch(/\.about-header,\s*\.about-footer\s*\{\s*padding:\s*8px;/);
  expect(compact).toMatch(/\.about-header h2\s*\{\s*font-size:\s*1rem;/);
});
