// Keeps sitemap-lastmod.json: the date each static sitemap page's content last changed.
// The Worker sitemap (workers/listing-evaluator/src/shop/sitemap.ts) reads it as <lastmod>.
//
// Google only trusts <lastmod> when it is accurate, so a date moves only when the page's
// content does. Builds rewrite hashed asset names and ?version= cache-busters in every
// page; those are stripped before hashing. A page seen for the first time gets the date of
// the last commit that changed its content.
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'sitemap-lastmod.json');
const CONSTANTS = path.join(ROOT, 'workers/listing-evaluator/src/constants.ts');
// Shells whose content comes from the API at runtime; their HTML says nothing about freshness.
const SKIP = new Set(['/guitars-and-gear-for-sale/']);

function sitemapPaths() {
  const source = fs.readFileSync(CONSTANTS, 'utf8');
  const block = source.slice(source.indexOf('SITEMAP_STATIC_URLS'));
  const list = block.slice(0, block.indexOf('];'));
  return [...list.matchAll(/loc: '([^']+)'/g)].map((m) => m[1]).filter((loc) => !SKIP.has(loc));
}

function fileForPath(urlPath) {
  const rel = urlPath.replace(/^\//, '');
  const candidates = urlPath.endsWith('/')
    ? [path.join(rel, 'index.html')]
    : [`${rel}.html`, path.join(rel, 'index.html')];
  return candidates.find((candidate) => fs.existsSync(path.join(ROOT, candidate))) || null;
}

function contentHash(html) {
  const normalized = html
    .replace(/(\/assets\/[A-Za-z0-9_.-]+?)-[A-Za-z0-9_-]{8}\.(js|mjs|css)/g, '$1.$2')
    .replace(/\?(version|v)=[0-9a-z]+/gi, '');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const today = () => new Date().toISOString().slice(0, 10);

// Date of the newest commit whose content differs from the commit before it (or the
// working copy, when that has uncommitted content changes).
function lastContentChange(file, currentHash) {
  const commits = git(['log', '--follow', '--format=%H %cs', '--', file])
    .trim().split('\n').filter(Boolean).map((line) => line.split(' '));
  if (commits.length === 0) return today();
  let newerDate = null;
  for (const [sha, date] of commits) {
    let hashAtCommit;
    try {
      hashAtCommit = contentHash(git(['show', `${sha}:${file}`]));
    } catch {
      break;
    }
    if (hashAtCommit !== currentHash) return newerDate || today();
    newerDate = date;
  }
  return newerDate;
}

const previous = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8')) : {};
const next = {};
let changed = 0;
for (const urlPath of sitemapPaths()) {
  const file = fileForPath(urlPath);
  if (!file) continue;
  const hash = contentHash(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const known = previous[urlPath];
  if (known && known.hash === hash) {
    next[urlPath] = known;
  } else {
    next[urlPath] = { hash, lastmod: known ? today() : lastContentChange(file, hash) };
    changed += 1;
  }
}
fs.writeFileSync(OUTPUT, `${JSON.stringify(next, null, 2)}\n`);
console.log(`sitemap-lastmod.json: ${Object.keys(next).length} pages, ${changed} updated.`);
