import type { Env } from '../env.js';
import { dbListMetaStoreProducts } from './db.js';

export type MetaFeedProduct = {
  id: string;
  title: string;
  description: string;
  availability: 'in stock' | 'out of stock';
  condition: 'new' | 'used' | 'refurbished';
  price: number;
  salePrice: number;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  brand: string;
  quantity: number;
  googleProductCategory: string;
  productType: string;
};

// Added to every feed link so a product_view in shop_analytics_events can be
// traced back to the Meta Store: the query string is kept in page_path.
export const META_FEED_UTM_SOURCE = 'meta_store';
const META_FEED_MAX_ADDITIONAL_IMAGES = 20;

const META_FEED_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'brand',
  'additional_image_link',
  'quantity_to_sell_on_facebook',
  'google_product_category',
  'product_type',
] as const;

export async function handleMetaStoreFeed(env: Env): Promise<Response> {
  const records = await dbListMetaStoreProducts(env);
  return new Response(buildMetaFeedCsv(records), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-ccg-feed-source': 'meta-store',
      'x-ccg-feed-product-count': String(records.length),
    },
  });
}

export function buildMetaFeedCsv(products: MetaFeedProduct[]): string {
  const rows = products.map((product) => [
    product.id,
    product.title,
    product.description,
    product.availability,
    product.condition,
    formatMetaFeedPrice(product.price),
    product.salePrice > 0 ? formatMetaFeedPrice(product.salePrice) : '',
    product.link,
    product.imageLink,
    product.brand,
    formatAdditionalImageLinks(product.additionalImageLinks),
    String(product.quantity),
    product.googleProductCategory,
    product.productType,
  ]);
  return [[...META_FEED_COLUMNS], ...rows]
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\n') + '\n';
}

// Mirrors what checkout charges (sale_price, else regular_price; see
// buildShopCheckoutDraft), so the catalog never shows a lower price than the buyer pays.
export function getMetaFeedPricing(regularPrice: unknown, salePrice: unknown): { price: number; salePrice: number } {
  const regular = Math.max(0, Number(regularPrice) || 0);
  const sale = Math.max(0, Number(salePrice) || 0);
  const charged = sale > 0 ? sale : regular;
  return charged < regular
    ? { price: regular, salePrice: charged }
    : { price: charged, salePrice: 0 };
}

export function buildMetaFeedLink(link: string): string {
  return `${link}?utm_source=${META_FEED_UTM_SOURCE}&utm_medium=catalog`;
}

function formatMetaFeedPrice(value: number): string {
  return `${value.toFixed(2)} USD`;
}

// Meta splits this field on commas, and Cloudflare image URLs contain them.
function formatAdditionalImageLinks(links: string[]): string {
  return links
    .slice(0, META_FEED_MAX_ADDITIONAL_IMAGES)
    .map((link) => link.replace(/,/g, '%2C'))
    .join(',');
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
