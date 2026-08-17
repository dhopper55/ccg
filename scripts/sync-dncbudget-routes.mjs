import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const appRoot = path.join(repoRoot, 'dncbudget');
const sourceHtml = path.join(appRoot, 'index.html');

const routeDirs = ['login', 'month'];

if (!fs.existsSync(sourceHtml)) {
  throw new Error(`Missing built dncbudget entry: ${sourceHtml}`);
}

const html = fs.readFileSync(sourceHtml, 'utf8');

for (const routeDir of routeDirs) {
  const targetDir = path.join(appRoot, routeDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
}

console.log(`Synced ${routeDirs.length} dncbudget route entries.`);
