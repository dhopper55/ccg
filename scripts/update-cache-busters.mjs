import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...await walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function isExternalUrl(url) {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//') ||
    url.startsWith('data:') ||
    url.startsWith('mailto:')
  );
}

function versionFromBuffer(buffer) {
  const hex = crypto.createHash('sha256').update(buffer).digest('hex');
  const num = parseInt(hex.slice(0, 12), 16) % 1_000_000;
  return String(num).padStart(6, '0');
}

function collectFilesSync(dir, predicate, acc = []) {
  const entries = fsSync.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) && !entryPath.endsWith(path.sep + 'dist')) continue;
      collectFilesSync(entryPath, predicate, acc);
    } else if (entry.isFile() && predicate(entryPath)) {
      acc.push(entryPath);
    }
  }
  return acc;
}

async function updateAdminServiceWorkerCacheVersion() {
  const swPath = path.join(ROOT, 'admin-sw.js');
  if (!fsSync.existsSync(swPath)) return false;

  const inputs = [
    ...collectFilesSync(path.join(ROOT, 'admin'), (p) => p.endsWith('.html')),
    ...(fsSync.existsSync(path.join(ROOT, 'dist'))
      ? collectFilesSync(path.join(ROOT, 'dist'), (p) => p.endsWith('.js'))
      : []),
    path.join(ROOT, 'styles.css'),
    path.join(ROOT, 'admin.webmanifest'),
  ].filter((p) => fsSync.existsSync(p)).sort();

  const hash = crypto.createHash('sha256');
  for (const filePath of inputs) {
    hash.update(filePath.replace(ROOT, ''));
    hash.update(fsSync.readFileSync(filePath));
  }
  const digest = hash.digest('hex').slice(0, 10);
  const nextValue = `ccg-admin-${digest}`;

  const current = await fs.readFile(swPath, 'utf8');
  const updated = current.replace(
    /const CACHE_VERSION = 'ccg-admin-[^']+';/,
    `const CACHE_VERSION = '${nextValue}';`
  );
  if (updated !== current) {
    await fs.writeFile(swPath, updated, 'utf8');
    return true;
  }
  return false;
}

async function updateHtmlFile(filePath) {
  const html = await fs.readFile(filePath, 'utf8');
  let changed = false;

  const updated = html.replace(
    /(href|src)=(['"])([^'"\s>]+?\.(?:css|js)(?:\?[^'"\s>]+)?(?:#[^'"\s>]+)?)\2/g,
    (match, attr, quote, rawUrl) => {
      if (isExternalUrl(rawUrl)) return match;

      const [beforeHash, hashPart] = rawUrl.split('#');
      const [base, query] = beforeHash.split('?');

      const targetPath = base.startsWith('/')
        ? path.join(ROOT, base.slice(1))
        : path.join(path.dirname(filePath), base);

      try {
        const buffer = fsSync.readFileSync(targetPath);
        const version = versionFromBuffer(buffer);
        const params = new URLSearchParams(query || '');
        params.set('version', version);
        const newUrl = `${base}?${params.toString()}${hashPart ? `#${hashPart}` : ''}`;
        if (newUrl !== rawUrl) changed = true;
        return `${attr}=${quote}${newUrl}${quote}`;
      } catch {
        return match;
      }
    }
  );

  if (changed) {
    await fs.writeFile(filePath, updated, 'utf8');
  }

  return changed;
}

function isRelativeUrl(url) {
  return url.startsWith('./') || url.startsWith('../');
}

async function updateJsFile(filePath) {
  const js = await fs.readFile(filePath, 'utf8');
  let changed = false;

  const updated = js.replace(
    /(import\s*(?:[^'"]*?\sfrom\s*)?|\bexport\s+[^'"]*?\sfrom\s*|\bimport\s*\()\s*(['"])(\.{1,2}\/[^'"]+?\.js(?:\?[^'"]*)?(?:#[^'"]*)?)\2/g,
    (match, prefix, quote, rawUrl) => {
      if (!isRelativeUrl(rawUrl) || isExternalUrl(rawUrl)) return match;

      const [beforeHash, hashPart] = rawUrl.split('#');
      const [base, query] = beforeHash.split('?');
      const targetPath = path.join(path.dirname(filePath), base);

      try {
        const buffer = fsSync.readFileSync(targetPath);
        const version = versionFromBuffer(buffer);
        const params = new URLSearchParams(query || '');
        params.set('version', version);
        const newUrl = `${base}?${params.toString()}${hashPart ? `#${hashPart}` : ''}`;
        if (newUrl !== rawUrl) changed = true;
        return `${prefix}${quote}${newUrl}${quote}`;
      } catch {
        return match;
      }
    }
  );

  if (changed) {
    await fs.writeFile(filePath, updated, 'utf8');
  }

  return changed;
}

const htmlFiles = await walk(ROOT);
let updatedHtmlCount = 0;
for (const filePath of htmlFiles) {
  if (await updateHtmlFile(filePath)) updatedHtmlCount += 1;
}

const distDir = path.join(ROOT, 'dist');
let updatedJsCount = 0;
if (fsSync.existsSync(distDir)) {
  const entries = await fs.readdir(distDir, { withFileTypes: true });
  const distFiles = [];
  const distWalk = async (dir) => {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await distWalk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        distFiles.push(entryPath);
      }
    }
  };
  await distWalk(distDir);
  for (const filePath of distFiles) {
    if (await updateJsFile(filePath)) updatedJsCount += 1;
  }
}

const swVersionUpdated = await updateAdminServiceWorkerCacheVersion();

console.log(`Cache busters updated in ${updatedHtmlCount} HTML file(s) and ${updatedJsCount} JS file(s).${swVersionUpdated ? ' Admin SW cache version bumped.' : ''}`);
