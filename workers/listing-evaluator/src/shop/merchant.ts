import type { Env } from '../env.js';
import { normalizeText } from '../utils/misc.js';
import { dbListGoogleMerchantProducts } from './db.js';
import { slugifyShopCategory, isValidSaleUrlSlug } from './db.js';
import { escapeXml } from './sitemap.js';
import { SHOP_BASE_PATH } from '../constants.js';
import type { ShopProductRow } from '../types/inventory.js';

export type GoogleMerchantFeedProduct = {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  availability: 'in stock' | 'out of stock';
  price: number;
  salePrice: number;
  condition: 'new' | 'used' | 'refurbished';
  brand: string;
  gtin: string;
  identifierExists: boolean;
  productType: string;
  shippingWeight: string;
  allowShipping: boolean;
  googleProductCategory: string;
};

export const MERCHANT_CENTER_CATEGORY_MAP: Record<string, string> = {
  MUSICAL_INSTRUMENT: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments',
  STRING_INSTRUMENT: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments',
  GUITAR: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Guitars',
  BASS_GUITAR: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Bass Guitars',
  UKULELE: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Ukuleles',
  BANJO: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Banjos',
  MANDOLIN: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Mandolins',
  VIOLIN: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Violins',
  VIOLA: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Violas',
  CELLO: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Cellos',
  DOUBLE_BASS: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Double Basses',
  HARP: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Harps',
  KEYBOARD_INSTRUMENT: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments',
  PIANO: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments > Pianos',
  DIGITAL_PIANO: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments > Digital Pianos',
  SYNTHESIZER: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments > Synthesizers',
  DRUMS_AND_PERCUSSION: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Percussion',
  DRUM_SET: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Percussion > Drum Sets',
  CYMBAL: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Percussion > Cymbals',
  WIND_INSTRUMENT: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments',
  FLUTE: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Flutes',
  CLARINET: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Clarinets',
  SAXOPHONE: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Saxophones',
  TRUMPET: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Trumpets',
  TROMBONE: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Trombones',
  MUSICAL_INSTRUMENT_ACCESSORY: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories',
  STRINGS: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Strings',
  PICKS: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Plectrums',
  TUNER: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Tuners',
  METRONOME: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Metronomes',
  CAPO: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Capos',
  SLIDE: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Slides',
  STRAP: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Straps',
  CASE: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Cases',
  STAND: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Stands',
  EFFECTS_PEDAL: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Effects Pedals',
  PEDALBOARD: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Pedalboards',
  PICKUP: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Pickups',
  AMPLIFIER: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Amplifiers',
  AMPLIFIER_HEAD: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Amplifiers',
  SPEAKER_CABINET: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Amplifiers',
  MUSIC_BOOK: 'Media > Books > Music Books',
  SHEET_MUSIC: 'Media > Books > Sheet Music',
};

export async function handleGoogleMerchantFeed(env: Env): Promise<Response> {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const records = await dbListGoogleMerchantProducts(env);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    '    <title>Coal Creek Guitars Products</title>',
    `    <link>${escapeXml(`${baseUrl}${SHOP_BASE_PATH}`)}</link>`,
    '    <description>Current guitars and gear for sale from Coal Creek Guitars.</description>',
    ...records.map((record) => renderGoogleMerchantFeedItem(record)),
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'cache-control': 'no-store, max-age=0',
      'x-ccg-feed-source': 'google-merchant',
      'x-ccg-feed-product-count': String(records.length),
    },
  });
}

export async function handleShopReceiptTemplate(templateCode: string, env: Env): Promise<Response> {
  const code = normalizeText(templateCode, '').slice(0, 100);
  if (!/^[a-z0-9_-]+$/i.test(code)) {
    return new Response(JSON.stringify({ message: 'Receipt template not found.' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }

  const record = await env.DB.prepare(
    `SELECT id, template_code, template_text
     FROM receipt_templates
     WHERE template_code = ?
     LIMIT 1`
  ).bind(code).first<{
    id: number;
    template_code: string;
    template_text: string;
  }>();

  if (!record) return new Response(JSON.stringify({ message: 'Receipt template not found.' }), { status: 404, headers: { 'content-type': 'application/json' } });

  return new Response(JSON.stringify({
    record: {
      id: record.id,
      templateCode: record.template_code,
      templateText: record.template_text,
    },
  }), { headers: { 'content-type': 'application/json' } });
}

export function renderGoogleMerchantFeedItem(product: GoogleMerchantFeedProduct): string {
  const feedTitle = getGoogleMerchantFeedTitle(product);
  const item: string[] = [
    '    <item>',
    `      <g:id>${escapeXml(product.id)}</g:id>`,
    `      <g:title>${escapeXml(feedTitle)}</g:title>`,
    `      <g:description>${escapeXml(product.description)}</g:description>`,
    `      <g:link>${escapeXml(product.link)}</g:link>`,
  ];

  if (product.imageLink) item.push(`      <g:image_link>${escapeXml(product.imageLink)}</g:image_link>`);
  for (const imageLink of product.additionalImageLinks.slice(0, 10)) {
    item.push(`      <g:additional_image_link>${escapeXml(imageLink)}</g:additional_image_link>`);
  }

  item.push(
    `      <g:availability>${escapeXml(product.availability)}</g:availability>`,
    `      <g:price>${formatMerchantPrice(product.price)}</g:price>`,
  );

  if (product.salePrice > 0 && product.salePrice < product.price) {
    item.push(`      <g:sale_price>${formatMerchantPrice(product.salePrice)}</g:sale_price>`);
  }

  item.push(
    `      <g:condition>${escapeXml(product.condition)}</g:condition>`,
    `      <g:identifier_exists>${product.identifierExists ? 'yes' : 'no'}</g:identifier_exists>`,
  );

  if (product.brand) item.push(`      <g:brand>${escapeXml(product.brand)}</g:brand>`);
  if (product.gtin) item.push(`      <g:gtin>${escapeXml(product.gtin)}</g:gtin>`);
  if (product.productType) item.push(`      <g:product_type>${escapeXml(product.productType)}</g:product_type>`);
  if (product.googleProductCategory) item.push(`      <g:google_product_category>${escapeXml(product.googleProductCategory)}</g:google_product_category>`);
  if (product.shippingWeight) item.push(`      <g:shipping_weight>${escapeXml(product.shippingWeight)}</g:shipping_weight>`);

  if (product.allowShipping) {
    item.push(
      '      <g:shipping>',
      '        <g:country>US</g:country>',
      '        <g:service>Standard</g:service>',
      `        <g:price>${formatMerchantPrice(0)}</g:price>`,
      '      </g:shipping>',
      '      <g:shipping_label>ships_nationwide</g:shipping_label>',
    );
  } else {
    item.push(
      '      <g:shipping>',
      '        <g:country>US</g:country>',
      '        <g:service>In-store pickup</g:service>',
      '        <g:price>0.00 USD</g:price>',
      '      </g:shipping>',
      '      <g:pickup_method>buy</g:pickup_method>',
      '      <g:pickup_SLA>same_day</g:pickup_SLA>',
    );
  }

  item.push(
    `      <g:ads_redirect>${escapeXml(product.link)}</g:ads_redirect>`,
    '    </item>',
  );

  return item.join('\n');
}

export function getGoogleMerchantFeedTitle(product: GoogleMerchantFeedProduct): string {
  const title = normalizeText(product.title, '').trim();
  if (product.condition === 'new') return title;
  return /^used\b/i.test(title) ? title : `Used ${title}`;
}

export function formatMerchantPrice(value: number): string {
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${normalized.toFixed(2)} USD`;
}

export function normalizeGoogleMerchantCondition(input: unknown): 'new' | 'used' | 'refurbished' {
  const value = normalizeText(input, '').toLowerCase();
  if (value.includes('refurb')) return 'refurbished';
  // Check 'used' before 'new' so "Used - Like New" is correctly treated as used, not new.
  if (value.includes('used')) return 'used';
  if (value === 'new') return 'new';
  return 'used';
}

export function normalizeMerchantDescription(input: unknown, fallback: string): string {
  const text = stripHtmlTags(normalizeText(input, '')).replace(/\s+/g, ' ').trim();
  const description = text || fallback;
  return description.slice(0, 5000);
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ');
}

export function normalizeMerchantGtin(input: unknown): string {
  const value = normalizeText(input, '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(value.length)) return '';
  if (/^900000000/.test(value)) return '';
  return hasValidGtinCheckDigit(value) ? value : '';
}

function hasValidGtinCheckDigit(value: string): boolean {
  const digits = value.split('').map((digit) => Number(digit));
  if (digits.some((digit) => !Number.isInteger(digit))) return false;
  const checkDigit = digits.pop();
  if (checkDigit == null) return false;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function normalizeMerchantShippingWeight(input: unknown): string {
  const value = Number(normalizeText(input, '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${value.toFixed(2)} lb`;
}

export function buildMerchantProductLink(row: ShopProductRow, baseUrl: string): string {
  const categorySlug = slugifyShopCategory(normalizeText(row.category_name, ''));
  const productSlug = normalizeText(row.sale_url, '');
  if (!categorySlug || !isValidSaleUrlSlug(productSlug)) return '';
  return `${baseUrl}${SHOP_BASE_PATH}/${categorySlug}/${productSlug}`;
}

export function getMerchantProductId(row: ShopProductRow): string {
  return normalizeText(row.ccg_number, '') || `ccg-inventory-${row.id}`;
}
