import type { Env } from '../env.js';
import type { InventoryCategoryRow } from '../types/inventory.js';
import { jsonResponse, normalizeText } from '../utils/misc.js';
import { escapeHtmlText, escapeHtmlAttribute } from '../utils/html.js';
import { dbListInventoryCategories } from '../inventory/categories.js';
import { dbListShopSitemapProducts, slugifyShopCategory, isValidSaleUrlSlug } from './db.js';
import { isAssociateModeRequest } from './associate.js';
import { dbGetShopProductDetail } from './db.js';
import { SHOP_BASE_PATH, SHOP_STATIC_ORIGIN, SITEMAP_STATIC_URLS } from '../constants.js';

// Slugs that are reserved by the shop router and must not be treated as category pages.
export const RESERVED_SHOP_SLUGS = new Set(['cart', 'checkout', 'assets']);

export async function handleShopSitemapProducts(env: Env): Promise<Response> {
  const records = await dbListShopSitemapProducts(env);
  return jsonResponse({ records });
}

export async function handleSitemap(env: Env): Promise<Response> {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const [productRecords, categoryRows] = await Promise.all([
    dbListShopSitemapProducts(env),
    dbListInventoryCategories(env),
  ]);
  const productUrls = productRecords.map((record) => ({
    loc: normalizeText(record.urlPath, ''),
    lastmod: toSitemapDate(record.updatedAt),
    changefreq: record.isSold || !record.forSale ? 'monthly' : 'daily',
    priority: record.isSold || !record.forSale ? '0.5' : '0.8',
  }));
  const categoryUrls = categoryRows
    .map((row) => {
      const slug = slugifyShopCategory(row.name);
      if (!slug) return null;
      return { loc: `${SHOP_BASE_PATH}/${slug}`, changefreq: 'daily', priority: '0.7' };
    })
    .filter((entry): entry is { loc: string; changefreq: string; priority: string } => Boolean(entry));
  const urls = [...SITEMAP_STATIC_URLS, ...categoryUrls, ...productUrls];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((entry) => renderSitemapUrl(entry, baseUrl)),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'cache-control': 'no-store, max-age=0',
      'x-ccg-sitemap-source': 'worker',
      'x-ccg-sitemap-product-count': String(productUrls.length),
    },
  });
}

export function handleRobotsTxt(): Response {
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/',
      'Disallow: /cdn-cgi/',
      'Disallow: /transformer-lot.html',
      'Disallow: /amp_chassis_lot.html',
      `Disallow: ${SHOP_BASE_PATH}/cart`,
      `Disallow: ${SHOP_BASE_PATH}/?`,
      '',
      'Sitemap: https://www.coalcreekguitars.com/sitemap.xml',
      '',
    ].join('\n'),
    {
      headers: {
        'content-type': 'text/plain; charset=UTF-8',
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}

export async function handleShopPageRequest(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith(`${SHOP_BASE_PATH}/assets/`)) {
    return fetchShopStaticAsset(request);
  }

  // Redirect legacy ?category= query-param URLs to clean slug paths before
  // touching the app shell fetch — saves a round-trip on every redirect.
  if (path === SHOP_BASE_PATH && requestUrl.searchParams.has('category')) {
    return handleShopCategoryParamRedirect(requestUrl, env);
  }

  const appResponse = await fetchShopAppShell(request);
  if (!appResponse.ok) return appResponse;

  if (path === SHOP_BASE_PATH) {
    return appResponse;
  }

  if (path === `${SHOP_BASE_PATH}/cart`) {
    const html = await appResponse.text();
    return htmlResponse(injectShopCartSeo(html, env), {
      'x-robots-tag': 'noindex, nofollow',
    });
  }

  const remainder = path.slice(SHOP_BASE_PATH.length).replace(/^\/+|\/+$/g, '');
  const parts = remainder.split('/').filter(Boolean);

  if (parts.length >= 1 && RESERVED_SHOP_SLUGS.has(parts[0])) {
    return appResponse;
  }

  if (parts.length === 1) {
    // Single segment → category page
    const categorySlug = decodeURIComponent(parts[0]);
    const categoryRows = await dbListInventoryCategories(env);
    const matchedRow = categoryRows.find((row) => slugifyShopCategory(row.name) === categorySlug);
    if (matchedRow) {
      const html = await appResponse.text();
      return htmlResponse(injectShopCategorySeo(html, matchedRow, categorySlug, env));
    }
    // Unknown slug — let the React app render (will hit the 404 route)
    return appResponse;
  }

  if (parts.length >= 2) {
    // Two segments → product page
    const productSlug = decodeURIComponent(parts[parts.length - 1]);
    const product = await dbGetShopProductDetail(
      { slug: productSlug },
      env,
      { includeInStoreOnly: await isAssociateModeRequest(request, env) },
    );
    if (!product) {
      // Product not found or no longer active — redirect to shop root so
      // Google drops the stale URL instead of indexing a generic-title page.
      const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
      return new Response(null, { status: 301, headers: { Location: `${baseUrl}${SHOP_BASE_PATH}` } });
    }
    const html = await appResponse.text();
    return htmlResponse(injectShopProductSeo(html, product, env, requestUrl));
  }

  return appResponse;
}

export async function handleShopCategoryParamRedirect(requestUrl: URL, env: Env): Promise<Response> {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const shopRoot = `${baseUrl}${SHOP_BASE_PATH}`;
  const categoryParam = (requestUrl.searchParams.get('category') ?? '').trim();

  if (!categoryParam) {
    return new Response(null, { status: 301, headers: { Location: shopRoot } });
  }

  const rows = await dbListInventoryCategories(env);
  const normalized = categoryParam.toLowerCase();

  // Match by full name, or by the leaf of a "Parent > Child" path string.
  let matched = rows.find((row) => row.name.toLowerCase() === normalized);
  if (!matched) {
    const leaf = normalized.split('>').pop()?.trim() ?? '';
    if (leaf) matched = rows.find((row) => row.name.toLowerCase() === leaf);
  }

  const target = matched
    ? `${shopRoot}/${slugifyShopCategory(matched.name)}`
    : shopRoot;

  return new Response(null, { status: 301, headers: { Location: target } });
}

export function fetchShopStaticAsset(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const assetUrl = new URL(requestUrl.pathname + requestUrl.search, SHOP_STATIC_ORIGIN);
  return fetch(new Request(assetUrl.toString(), { method: request.method }));
}

export function fetchShopAppShell(request: Request): Promise<Response> {
  const shellUrl = new URL(`${SHOP_BASE_PATH}/`, SHOP_STATIC_ORIGIN);
  return fetch(new Request(shellUrl.toString(), { method: request.method }));
}

export function getShopProductSlug(pathname: string): string {
  const remainder = pathname.slice(SHOP_BASE_PATH.length).replace(/^\/+|\/+$/g, '');
  const parts = remainder.split('/').filter(Boolean);
  return parts.length >= 2 ? decodeURIComponent(parts[parts.length - 1]) : '';
}

export function injectShopCartSeo(html: string, env: Env): string {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const title = 'Cart | Coal Creek Guitars';
  const canonicalUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;
  const description = 'Review selected guitars and gear from Coal Creek Guitars before checkout.';
  const imageUrl = `${baseUrl}/images/coal-creek-logo.png`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Coal Creek Guitars',
      url: baseUrl,
    },
  };

  return injectShopSeoTags(html, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    ogType: 'website',
    jsonLd,
    robots: 'noindex, nofollow',
  });
}

export function injectShopCategorySeo(
  html: string,
  category: InventoryCategoryRow,
  categorySlug: string,
  env: Env,
): string {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const categoryName = normalizeText(category.name, '');
  const title = `${categoryName} | Coal Creek Guitars`;
  const canonicalUrl = `${baseUrl}${SHOP_BASE_PATH}/${categorySlug}`;
  const description = `Browse ${categoryName} from Coal Creek Guitars in Englewood, Colorado. Quality used and new instruments and gear at fair prices.`;
  const imageUrl = `${baseUrl}/images/coal-creek-logo.png`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guitars and Gear for Sale', item: `${baseUrl}${SHOP_BASE_PATH}` },
        { '@type': 'ListItem', position: 2, name: categoryName, item: canonicalUrl },
      ],
    },
    isPartOf: { '@type': 'WebSite', name: 'Coal Creek Guitars', url: baseUrl },
  };

  return injectShopSeoTags(html, { title, description, canonicalUrl, imageUrl, ogType: 'website', jsonLd });
}

export function injectShopProductSeo(
  html: string,
  product: Record<string, unknown>,
  env: Env,
  requestUrl: URL,
): string {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const title = `${normalizeText(product.saleTitle, 'Guitars and Gear for Sale')} | Coal Creek Guitars`;
  const categorySlug = slugifyShopCategory(normalizeText(product.primaryCategoryName, ''));
  const productSlug = normalizeText(product.saleUrlSlug, '');
  const canonicalPath = categorySlug && productSlug
    ? `${SHOP_BASE_PATH}/${categorySlug}/${productSlug}`
    : requestUrl.pathname;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;
  const productImages = Array.isArray(product.images) ? product.images.map((image) => normalizeText(image, '')) : [];
  const imageUrl =
    absolutizeShopUrl(normalizeText(product.mainImage, '') || productImages[0] || '', baseUrl) ||
    `${baseUrl}/images/coal-creek-logo.png`;
  const description = buildShopProductDescription(product);
  const price = Number(product.salePrice || product.regularPrice || 0);
  const isUnavailable = Boolean(product.isSold || !product.forSale);
  const jsonLd = buildShopProductJsonLd(product, {
    canonicalUrl,
    imageUrl,
    description,
    price,
    isUnavailable,
    baseUrl,
  });

  const productMeta = [
    price > 0 ? metaTag('property', 'product:price:amount', price.toFixed(2)) : '',
    price > 0 ? metaTag('property', 'product:price:currency', 'USD') : '',
  ].filter(Boolean).join('\n    ');

  const output = injectShopSeoTags(html, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    ogType: 'product',
    jsonLd,
  });

  return productMeta ? output.replace('</head>', `    ${productMeta}\n  </head>`) : output;
}

export function injectShopSeoTags(
  html: string,
  data: {
    title: string;
    description: string;
    canonicalUrl: string;
    imageUrl: string;
    ogType: string;
    jsonLd: Record<string, unknown>;
    robots?: string;
  },
): string {
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlText(data.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?>/i, metaTag('name', 'description', data.description))
    .replace(/<link\s+rel="canonical"[\s\S]*?>/i, `<link rel="canonical" href="${escapeHtmlAttribute(data.canonicalUrl)}" />`)
    .replace(/<meta\s+property="og:type"[\s\S]*?>/i, metaTag('property', 'og:type', data.ogType))
    .replace(/<meta\s+property="og:url"[\s\S]*?>/i, metaTag('property', 'og:url', data.canonicalUrl))
    .replace(/<meta\s+property="og:title"[\s\S]*?>/i, metaTag('property', 'og:title', data.title))
    .replace(/<meta\s+property="og:description"[\s\S]*?>/i, metaTag('property', 'og:description', data.description))
    .replace(/<meta\s+property="og:image"[\s\S]*?>/i, metaTag('property', 'og:image', data.imageUrl))
    .replace(/<meta\s+name="twitter:url"[\s\S]*?>/i, metaTag('name', 'twitter:url', data.canonicalUrl))
    .replace(/<meta\s+name="twitter:title"[\s\S]*?>/i, metaTag('name', 'twitter:title', data.title))
    .replace(/<meta\s+name="twitter:description"[\s\S]*?>/i, metaTag('name', 'twitter:description', data.description))
    .replace(/<meta\s+name="twitter:image"[\s\S]*?>/i, metaTag('name', 'twitter:image', data.imageUrl));

  if (data.robots) {
    output = output.replace('</head>', `    ${metaTag('name', 'robots', data.robots)}\n  </head>`);
  }

  return output.replace(
    '</head>',
    `    <script type="application/ld+json">${escapeJsonScript(JSON.stringify(data.jsonLd))}</script>\n  </head>`,
  );
}

export function buildShopProductDescription(product: Record<string, unknown>): string {
  const highlights = Array.isArray(product.highlights)
    ? product.highlights
        .map((item) => normalizeText((item as Record<string, unknown>)?.text, ''))
        .filter(Boolean)
    : [];
  const parts = [
    normalizeText(product.saleTitle, ''),
    ...highlights,
    normalizeText(product.saleDescription, ''),
  ].filter(Boolean);
  const text = parts.join('. ').replace(/\s+/g, ' ').trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).replace(/\s+\S*$/, '')}...`;
}

function htmlResponse(html: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
      ...extraHeaders,
    },
  });
}

function metaTag(attributeName: string, key: string, content: string): string {
  return `<meta ${attributeName}="${escapeHtmlAttribute(key)}" content="${escapeHtmlAttribute(content)}" />`;
}

function escapeJsonScript(value: string): string {
  return String(value || '').replace(/</g, '\\u003c');
}

function renderSitemapUrl(
  entry: { loc: string; lastmod?: string; changefreq?: string; priority?: string },
  baseUrl: string,
): string {
  const loc = entry.loc.startsWith('http') ? entry.loc : `${baseUrl}${entry.loc}`;
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '',
    entry.changefreq ? `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : '',
    entry.priority ? `    <priority>${escapeXml(entry.priority)}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n');
}

function toSitemapDate(value: unknown): string {
  const text = normalizeText(value, '');
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildShopProductJsonLd(
  product: Record<string, unknown>,
  context: {
    canonicalUrl: string;
    imageUrl: string;
    description: string;
    price: number;
    isUnavailable: boolean;
    baseUrl: string;
  },
): Record<string, unknown> {
  const highlights = Array.isArray(product.highlights)
    ? product.highlights
        .map((item) => normalizeText((item as Record<string, unknown>)?.text, ''))
        .filter(Boolean)
    : [];
  const productImages = Array.isArray(product.images)
    ? product.images.map((image) => absolutizeShopUrl(normalizeText(image, ''), context.baseUrl))
    : [];
  const images = Array.from(new Set([context.imageUrl, ...productImages].filter(Boolean)));

  return removeUndefined({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: normalizeText(product.saleTitle, 'Guitars and Gear for Sale'),
    image: images,
    description: context.description,
    category: product.category || product.primaryCategoryName || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    model: product.model || undefined,
    offers: {
      '@type': 'Offer',
      url: context.canonicalUrl,
      priceCurrency: 'USD',
      price: context.price > 0 ? context.price.toFixed(2) : undefined,
      availability: context.isUnavailable ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
    },
    positiveNotes: highlights.length > 0 ? {
      '@type': 'ItemList',
      itemListElement: highlights.map((text, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: text,
      })),
    } : undefined,
  });
}

function removeUndefined(value: unknown): Record<string, unknown> | unknown[] | unknown {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined && entryValue !== '')
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)]),
    );
  }
  return value;
}

export function absolutizeShopUrl(value: string, origin: string): string {
  const text = normalizeText(value, '');
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `${origin}${text.startsWith('/') ? text : `/${text}`}`;
}
