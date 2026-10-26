import type { ListingData } from '../types/core.js';

// Read a Craigslist listing straight from its page instead of through the Apify actor.
// Craigslist moved to www.craigslist.org/view/d/<slug>/<id> links in 2026, which the Apify
// actor can't handle; the page itself carries a schema.org Product block (description,
// price, location, photos) plus the classic #postingbody / #titletextonly markup, and this
// works for both the new and the classic link formats.

const CRAIGSLIST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Craigslist serves each photo at several sizes; ask for the largest common one.
function toLargeImageUrl(url: string): string {
  return url.replace(/_(\d+x\d+)(c?)\.jpg$/i, '_1200x900.jpg');
}

type LdNode = Record<string, unknown>;

function readJsonLd(html: string): { product: LdNode | null; breadcrumbTitle: string } {
  let product: LdNode | null = null;
  let breadcrumbTitle = '';
  for (const match of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let node: unknown;
    try {
      node = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (!node || typeof node !== 'object') continue;
    const record = node as LdNode;
    if (record['@type'] === 'Product') product = record;
    if (record['@type'] === 'BreadcrumbList' && Array.isArray(record.itemListElement)) {
      const items = record.itemListElement as Array<{ name?: unknown; position?: unknown }>;
      const last = items.reduce<{ name?: unknown; position?: unknown } | null>(
        (best, item) => (!best || Number(item.position) > Number(best.position) ? item : best),
        null,
      );
      if (typeof last?.name === 'string') breadcrumbTitle = last.name.trim();
    }
  }
  return { product, breadcrumbTitle };
}

export async function fetchCraigslistListing(url: string): Promise<ListingData | null> {
  let response: Response;
  try {
    response = await fetch(url, { headers: CRAIGSLIST_HEADERS, redirect: 'follow' });
  } catch (error) {
    console.warn('[craigslist] fetch failed', { url, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
  if (!response.ok) {
    console.warn('[craigslist] page not available', { url, status: response.status });
    return null;
  }
  const html = await response.text();
  const { product, breadcrumbTitle } = readJsonLd(html);

  const titleMatch = html.match(/id="titletextonly">([^<]*)</);
  const title = decodeEntities(titleMatch?.[1] ?? '').trim() || breadcrumbTitle;

  const bodyMatch = html.match(/<section id="postingbody">([\s\S]*?)<\/section>/);
  const bodyHtml = (bodyMatch?.[1] ?? '').replace(/<div class="print-information[\s\S]*?<\/div>\s*<\/div>/, '');
  const description =
    htmlToText(bodyHtml) || (typeof product?.description === 'string' ? product.description.trim() : '');

  const offers = (product?.offers ?? {}) as LdNode;
  const ldPrice = Number(offers.price);
  const priceMatch = html.match(/<span class="price">([^<]*)<\/span>/);
  const price = Number.isFinite(ldPrice) && ldPrice > 0 ? `$${Math.round(ldPrice)}` : decodeEntities(priceMatch?.[1] ?? '').trim();

  const address = ((offers.availableAtOrFrom as LdNode | undefined)?.address ?? {}) as LdNode;
  const location = [address.addressLocality, address.addressRegion]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(', ');

  const ldImages = Array.isArray(product?.image) ? (product.image as unknown[]).filter((img): img is string => typeof img === 'string') : [];
  const pageImages = [...html.matchAll(/https:\/\/images\.craigslist\.org\/[A-Za-z0-9_]+_\d+x\d+c?\.jpg/g)].map((m) => m[0]);
  const images = [...new Set((ldImages.length ? ldImages : pageImages).map(toLargeImageUrl))];

  if (!title && !description && images.length === 0) {
    console.warn('[craigslist] no listing data found on page', { url });
    return null;
  }
  return { title, price, location, condition: '', description, images, url };
}
