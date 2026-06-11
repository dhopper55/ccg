import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FILES = [
  { html: 'fender-guitar-serial-number-history.html', prefix: 'fender-history' },
  { html: 'gibson-guitar-serial-number-history.html', prefix: 'gibson-history' },
];

const OUT_DIR = join(ROOT, 'images', 'serial-history');
mkdirSync(OUT_DIR, { recursive: true });

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

for (const { html, prefix } of FILES) {
  const htmlPath = join(ROOT, html);
  let content = readFileSync(htmlPath, 'utf8');
  let count = 0;
  let replaced = 0;

  content = content.replace(/src="(data:([^;]+);base64,([^"]+))"/g, (match, full, mime, b64) => {
    const ext = MIME_TO_EXT[mime] ?? 'bin';
    count++;
    const filename = `${prefix}-${String(count).padStart(2, '0')}.${ext}`;
    const outPath = join(OUT_DIR, filename);
    writeFileSync(outPath, Buffer.from(b64, 'base64'));
    replaced++;
    const webPath = `images/serial-history/${filename}`;
    console.log(`  ${html}: extracted ${filename} (${mime}, ${Math.round(b64.length * 0.75 / 1024)}KB)`);
    return `src="${webPath}"`;
  });

  writeFileSync(htmlPath, content, 'utf8');
  console.log(`${html}: replaced ${replaced} base64 image(s)\n`);
}

console.log('Done. Images saved to images/serial-history/');
