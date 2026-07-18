/**
 * Copy the newest Playwright .webm from test-results/ to demo/exports/.
 * Invoked after `npm run test:demo` once the browser context has finalized video.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const testResults = join(root, 'test-results');
const keeper = join(root, 'demo', 'exports', 'ideamap-spine-dry-run.webm');

function findWebms(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) findWebms(path, acc);
    else if (entry.name.endsWith('.webm')) acc.push(path);
  }
  return acc;
}

const webms = findWebms(testResults).sort(
  (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
);

if (!webms[0]) {
  console.error('No .webm found under test-results/. Demo recording may have failed.');
  process.exit(1);
}

mkdirSync(join(root, 'demo', 'exports'), { recursive: true });
mkdirSync(join(root, 'demo', 'captures'), { recursive: true });
copyFileSync(webms[0], keeper);
console.log(`Keeper video: ${keeper}`);
console.log(`Source:       ${webms[0]}`);
