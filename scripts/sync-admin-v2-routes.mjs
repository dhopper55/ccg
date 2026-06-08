import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const adminRoot = path.join(repoRoot, 'admin');
const sourceHtml = path.join(adminRoot, 'index.html');

const routeDirs = [
  'inventory-manager',
  'inventory-category-manager',
  'inventory-item',
  'inventory-labels',
  'order-manager',
  'order-manager-item',
  'mfr-orders',
  'payment-links',
  'shop-statistics',
  'system-settings',
  'listing-evaluator',
  'listing-evaluator-results',
  'listing-evaluator-item',
  'serial-decodes',
  'serial-pattern-text',
  'value-reports',
  'authentication/default/jwt/login',
  'authentication/default/jwt/sign-up',
  'authentication/default/jwt/forgot-password',
  'authentication/default/jwt/2FA',
  'authentication/default/jwt/set-password',
  'authentication/default/logged-out',
];

if (!fs.existsSync(sourceHtml)) {
  throw new Error(`Missing built admin entry: ${sourceHtml}`);
}

const html = fs.readFileSync(sourceHtml, 'utf8');

for (const routeDir of routeDirs) {
  const targetDir = path.join(adminRoot, routeDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
}

console.log(`Synced ${routeDirs.length} admin route entries.`);
