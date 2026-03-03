import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const adminV2Root = path.join(repoRoot, 'admin-v2');
const sourceHtml = path.join(adminV2Root, 'index.html');

const routeDirs = [
  'inventory-manager',
  'inventory-item',
  'marketplace-admin',
  'listing-evaluator',
  'listing-evaluator-results',
  'listing-evaluator-item',
  'logout',
  'pages/icons',
  'authentication/default/jwt/login',
  'authentication/default/jwt/sign-up',
  'authentication/default/jwt/forgot-password',
  'authentication/default/jwt/2FA',
  'authentication/default/jwt/set-password',
  'authentication/default/logged-out',
];

if (!fs.existsSync(sourceHtml)) {
  throw new Error(`Missing built admin-v2 entry: ${sourceHtml}`);
}

const html = fs.readFileSync(sourceHtml, 'utf8');

for (const routeDir of routeDirs) {
  const targetDir = path.join(adminV2Root, routeDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
}

console.log(`Synced ${routeDirs.length} admin-v2 route entries.`);
