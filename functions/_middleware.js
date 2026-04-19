export async function onRequest(context) {
  const url = new URL(context.request.url);
  const shopBase = '/guitars-and-gear-for-sale';
  const siteOrigin = 'https://www.coalcreekguitars.com';

  if (
    url.pathname.startsWith(`${shopBase}/`) &&
    !url.pathname.startsWith(`${shopBase}/assets/`) &&
    url.pathname !== `${shopBase}/`
  ) {
    const assetUrl = new URL(context.request.url);
    assetUrl.pathname = `${shopBase}/`;
    const assetResponse = await context.env.ASSETS.fetch(new Request(assetUrl, context.request));
    if (url.pathname === `${shopBase}/cart`) {
      if (!assetResponse.ok) return assetResponse;
      const html = await assetResponse.text();
      return new Response(injectShopCartSeo(html, url, siteOrigin), {
        status: assetResponse.status,
        headers: {
          ...Object.fromEntries(assetResponse.headers.entries()),
          'content-type': 'text/html; charset=UTF-8',
        },
      });
    }

    const productSlug = getShopProductSlug(url.pathname, shopBase);
    if (!productSlug || !assetResponse.ok) return assetResponse;

    try {
      const productResponse = await fetch(new URL(`/api/shop/products/by-slug/${encodeURIComponent(productSlug)}`, siteOrigin));
      if (!productResponse.ok) return assetResponse;
      const productData = await productResponse.json();
      const product = productData && productData.record;
      if (!product) return assetResponse;

      const html = await assetResponse.text();
      return new Response(injectShopProductSeo(html, product, url, siteOrigin), {
        status: assetResponse.status,
        headers: {
          ...Object.fromEntries(assetResponse.headers.entries()),
          'content-type': 'text/html; charset=UTF-8',
        },
      });
    } catch {
      return assetResponse;
    }
  }

  return context.next();
}

function injectShopCartSeo(html, requestUrl, siteOrigin) {
  const title = 'Cart | Coal Creek Guitars';
  const canonicalUrl = `${siteOrigin}/guitars-and-gear-for-sale/cart`;
  const description = 'Review selected guitars and gear from Coal Creek Guitars before checkout.';
  const imageUrl = 'https://www.coalcreekguitars.com/images/coal-creek-logo.png';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Coal Creek Guitars',
      url: siteOrigin,
    },
  };

  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?>/i, meta('name', 'description', description))
    .replace(/<link\s+rel="canonical"[\s\S]*?>/i, `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`)
    .replace(/<meta\s+property="og:type"[\s\S]*?>/i, meta('property', 'og:type', 'website'))
    .replace(/<meta\s+property="og:url"[\s\S]*?>/i, meta('property', 'og:url', canonicalUrl))
    .replace(/<meta\s+property="og:title"[\s\S]*?>/i, meta('property', 'og:title', title))
    .replace(/<meta\s+property="og:description"[\s\S]*?>/i, meta('property', 'og:description', description))
    .replace(/<meta\s+property="og:image"[\s\S]*?>/i, meta('property', 'og:image', imageUrl))
    .replace(/<meta\s+name="twitter:url"[\s\S]*?>/i, meta('name', 'twitter:url', canonicalUrl))
    .replace(/<meta\s+name="twitter:title"[\s\S]*?>/i, meta('name', 'twitter:title', title))
    .replace(/<meta\s+name="twitter:description"[\s\S]*?>/i, meta('name', 'twitter:description', description))
    .replace(/<meta\s+name="twitter:image"[\s\S]*?>/i, meta('name', 'twitter:image', imageUrl));

  return output.replace(
    '</head>',
    `    <script type="application/ld+json">${escapeJsonScript(JSON.stringify(jsonLd))}</script>\n  </head>`,
  );
}

function getShopProductSlug(pathname, shopBase) {
  const remainder = pathname.slice(shopBase.length).replace(/^\/+|\/+$/g, '');
  const parts = remainder.split('/').filter(Boolean);
  return parts.length >= 2 ? decodeURIComponent(parts[parts.length - 1]) : '';
}

function injectShopProductSeo(html, product, requestUrl, siteOrigin) {
  const title = `${product.saleTitle || 'Guitars and Gear for Sale'} | Coal Creek Guitars`;
  const categorySlug = slugifyCategory(product.primaryCategoryName || '');
  const productSlug = String(product.saleUrlSlug || '').trim();
  const canonicalPath = categorySlug && productSlug
    ? `/guitars-and-gear-for-sale/${categorySlug}/${productSlug}`
    : requestUrl.pathname;
  const canonicalUrl = `${siteOrigin}${canonicalPath}`;
  const imageUrl = absolutizeUrl((product.mainImage || (product.images || [])[0] || ''), siteOrigin)
    || 'https://www.coalcreekguitars.com/images/coal-creek-logo.png';
  const description = buildProductDescription(product);
  const price = Number(product.salePrice || product.regularPrice || 0);
  const isUnavailable = Boolean(product.isSold || !product.forSale);
  const jsonLd = buildProductJsonLd(product, {
    canonicalUrl,
    imageUrl,
    description,
    price,
    isUnavailable,
  });

  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?>/i, meta('name', 'description', description))
    .replace(/<link\s+rel="canonical"[\s\S]*?>/i, `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`)
    .replace(/<meta\s+property="og:type"[\s\S]*?>/i, meta('property', 'og:type', 'product'))
    .replace(/<meta\s+property="og:url"[\s\S]*?>/i, meta('property', 'og:url', canonicalUrl))
    .replace(/<meta\s+property="og:title"[\s\S]*?>/i, meta('property', 'og:title', title))
    .replace(/<meta\s+property="og:description"[\s\S]*?>/i, meta('property', 'og:description', description))
    .replace(/<meta\s+property="og:image"[\s\S]*?>/i, meta('property', 'og:image', imageUrl))
    .replace(/<meta\s+name="twitter:url"[\s\S]*?>/i, meta('name', 'twitter:url', canonicalUrl))
    .replace(/<meta\s+name="twitter:title"[\s\S]*?>/i, meta('name', 'twitter:title', title))
    .replace(/<meta\s+name="twitter:description"[\s\S]*?>/i, meta('name', 'twitter:description', description))
    .replace(/<meta\s+name="twitter:image"[\s\S]*?>/i, meta('name', 'twitter:image', imageUrl));

  const productMeta = [
    price > 0 ? meta('property', 'product:price:amount', price.toFixed(2)) : '',
    price > 0 ? meta('property', 'product:price:currency', 'USD') : '',
    `<script type="application/ld+json">${escapeJsonScript(JSON.stringify(jsonLd))}</script>`,
  ].filter(Boolean).join('\n    ');

  return output.replace('</head>', `    ${productMeta}\n  </head>`);
}

function buildProductDescription(product) {
  const highlights = Array.isArray(product.highlights)
    ? product.highlights.map((item) => stripText(item && item.text)).filter(Boolean)
    : [];
  const parts = [
    stripText(product.saleTitle),
    ...highlights,
    stripText(product.saleDescription),
  ].filter(Boolean);
  const text = parts.join('. ').replace(/\s+/g, ' ').trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).replace(/\s+\S*$/, '')}...`;
}

function buildProductJsonLd(product, context) {
  const highlights = Array.isArray(product.highlights)
    ? product.highlights.map((item) => stripText(item && item.text)).filter(Boolean)
    : [];
  const images = Array.from(new Set([
    context.imageUrl,
    ...(Array.isArray(product.images) ? product.images : []).map((image) => absolutizeUrl(image, 'https://www.coalcreekguitars.com')),
  ].filter(Boolean)));
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.saleTitle || 'Guitars and Gear for Sale',
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
  };
  return removeUndefined(data);
}

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined && entryValue !== '')
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)])
    );
  }
  return value;
}

function slugifyCategory(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutizeUrl(value, origin) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `${origin}${text.startsWith('/') ? text : `/${text}`}`;
}

function meta(attributeName, key, content) {
  return `<meta ${attributeName}="${escapeAttr(key)}" content="${escapeAttr(content)}" />`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeJsonScript(value) {
  return String(value || '').replace(/</g, '\\u003c');
}
