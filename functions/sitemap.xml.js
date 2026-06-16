const SITE_ORIGIN = 'https://www.coalcreekguitars.com';

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/decoders/guitar-serial-decoder-lookup/', changefreq: 'monthly', priority: '0.9' },
  { loc: '/decoders/gibson-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/kramer-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/bc-rich-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/fender-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/squier-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/epiphone-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/taylor-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/martin-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/ibanez-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/yamaha-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/prs-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/esp-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/schecter-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/gretsch-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/jackson-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/cort-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/takamine-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/washburn-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/dean-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/ernieball-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/guild-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/alvarez-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/godin-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/ovation-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/charvel-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/decoders/rickenbacker-guitar-serial-number-decoder/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/guitars-and-gear-for-sale', changefreq: 'daily', priority: '0.9' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.6' },
  { loc: '/guitar-repair-services-pricing', changefreq: 'monthly', priority: '0.7' },
  { loc: '/about-us.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/guitar-value-report-evaluation', changefreq: 'monthly', priority: '0.7' },
  { loc: '/how-to-list-a-guitar-for-sale.html', changefreq: 'monthly', priority: '0.7' },
  { loc: '/fender-guitar-serial-number-history.html', changefreq: 'monthly', priority: '0.7' },
  { loc: '/gibson-guitar-serial-number-history.html', changefreq: 'monthly', priority: '0.7' },
  { loc: '/ccg-englewood-broadway-gothic-theatre-history.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact-us.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy-policy.html', changefreq: 'monthly', priority: '0.3' },
  { loc: '/terms-conditions.html', changefreq: 'monthly', priority: '0.3' },
];

export async function onRequest() {
  const productUrls = await loadProductUrls();
  const urls = [...STATIC_URLS, ...productUrls];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(renderUrl),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'cache-control': 'no-store, max-age=0',
      'x-ccg-sitemap-product-count': String(productUrls.length),
    },
  });
}

async function loadProductUrls() {
  try {
    const response = await fetch(`${SITE_ORIGIN}/api/shop/sitemap-products`);
    if (!response.ok) return [];
    const data = await response.json();
    const records = Array.isArray(data.records) ? data.records : [];
    return records
      .filter((record) => record && record.urlPath)
      .map((record) => ({
        loc: record.urlPath,
        lastmod: toDateOnly(record.updatedAt),
        changefreq: record.isSold || !record.forSale ? 'monthly' : 'daily',
        priority: record.isSold || !record.forSale ? '0.5' : '0.8',
      }));
  } catch {
    return [];
  }
}

function renderUrl(entry) {
  const loc = entry.loc.startsWith('http') ? entry.loc : `${SITE_ORIGIN}${entry.loc}`;
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '',
    entry.changefreq ? `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : '',
    entry.priority ? `    <priority>${escapeXml(entry.priority)}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n');
}

function toDateOnly(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
