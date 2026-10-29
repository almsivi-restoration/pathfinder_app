/**
 * Tripwire for the mid-session freeze. electron.js cannot be imported under
 * jsdom (it requires electron), so this reads its source: the backend must be
 * spawned with stdout discarded, never an unread pipe. See startBackend().
 */
import fs from 'fs';
import path from 'path';

test('the backend is spawned with stdout discarded, not an unread pipe', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'electron.js'), 'utf8');
  const spawnCall = source.slice(source.indexOf('backendProcess = spawn('));
  const options = spawnCall.slice(0, spawnCall.indexOf('});'));

  expect(options).toMatch(/stdio:\s*\[\s*'ignore',\s*'ignore',\s*'pipe'\s*\]/);
  expect(source).toMatch(/backendProcess\.stderr\.on\('data'/);
});
