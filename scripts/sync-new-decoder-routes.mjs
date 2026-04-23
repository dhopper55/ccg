import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const newRoot = path.join(repoRoot, 'new');
const sourceHtml = path.join(newRoot, 'index.html');

const routeDirs = [
  'decoders/ibanez-guitar-serial-number-decoder',
];

if (!fs.existsSync(sourceHtml)) {
  throw new Error(`Missing built new-app entry: ${sourceHtml}`);
}

const html = fs.readFileSync(sourceHtml, 'utf8');

for (const routeDir of routeDirs) {
  const targetDir = path.join(newRoot, routeDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
}

console.log(`Synced ${routeDirs.length} new-app decoder route entries.`);
