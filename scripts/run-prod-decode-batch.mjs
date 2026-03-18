import fs from 'node:fs/promises';

const SITE_ORIGIN = 'https://www.coalcreekguitars.com';
const TEST_FILE = new URL('../TEST-SERIAL-NUMBERS.md', import.meta.url);

const BRAND_SLUGS = {
  'B.C. Rich': 'bc-rich',
  PRS: 'prs',
  ESP: 'esp',
};

function slugForBrand(brand) {
  return BRAND_SLUGS[brand] || brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseTests(markdown) {
  const tests = [];
  let brand = '';

  for (const rawLine of markdown.split(/\r?\n/)) {
    const headingMatch = rawLine.match(/^##\s+(.+)$/);
    if (headingMatch) {
      brand = headingMatch[1].trim();
      continue;
    }

    if (!brand || !rawLine.startsWith('|')) continue;
    if (rawLine.includes('Serial Number')) continue;
    if (/^\|[-\s|]+\|?$/.test(rawLine)) continue;

    const parts = rawLine.split('|').map((part) => part.trim());
    const serial = parts[1];
    if (!serial) continue;

    tests.push({ brand, serial });
  }

  return tests;
}

async function main() {
  const markdown = await fs.readFile(TEST_FILE, 'utf8');
  const tests = parseTests(markdown);
  const failures = [];

  for (let index = 0; index < tests.length; index += 1) {
    const test = tests[index];
    const slug = slugForBrand(test.brand);
    const pagePath = `/decoders/${slug}-guitar-serial-number-decoder.html`;

    let response;
    let bodyText = '';
    let parsed = null;

    try {
      response = await fetch(`${SITE_ORIGIN}/api/decode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 Codex production decode batch',
        },
        body: JSON.stringify({
          brand: test.brand,
          serial: test.serial,
          pagePath,
          userAgent: 'Mozilla/5.0 Codex production decode batch',
          clientTimestamp: new Date().toString(),
        }),
      });

      bodyText = await response.text();
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = null;
      }
    } catch (error) {
      failures.push({
        brand: test.brand,
        serial: test.serial,
        status: 'network_error',
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const decodeFailed = parsed && parsed.success === false;
    if (!response.ok || decodeFailed) {
      failures.push({
        brand: test.brand,
        serial: test.serial,
        status: response.status,
        error: parsed?.error || parsed?.message || bodyText.slice(0, 300),
      });
    }

    if ((index + 1) % 25 === 0) {
      console.log(`Processed ${index + 1}/${tests.length}`);
    }
  }

  console.log(JSON.stringify({
    total: tests.length,
    failures,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
