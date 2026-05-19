import { decodeSerialForBackend, normalizeBrandKey } from '../../../src/serial-decode-service.js';
import {
  buildMultiPricingPrompt,
  buildMainUserPrompt,
  buildSinglePricingPrompt,
  buildSystemPrompt,
} from './prompts.js';
import {
  AUTH_COOKIE_NAME,
  buildAuthCookie,
  clearAuthCookie,
  parseCookie,
  signAuth,
  verifyAuth,
} from './auth.js';

interface Env {
  DB: D1Database;
  CUSTOM_ITEMS_BUCKET?: R2Bucket;
  REVERB_API_TOKEN?: string;
  OPENAI_API_KEY: string;
  APIFY_TOKEN: string;
  APIFY_FACEBOOK_ACTOR: string;
  APIFY_CRAIGSLIST_ACTOR: string;
  SITE_BASE_URL: string;
  MAX_IMAGES: string;
  AUTH_USER: string;
  AUTH_PASS: string;
  AUTH_SECRET: string;
  ASSOCIATE_MODE_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CO_SALES_TAX_RATE_ID?: string;
  STRIPE_TERMINAL_READER_ID?: string;
  STRIPE_TERMINAL_READER_ID_SANDBOX?: string;
  WEBHOOK_SECRET?: string;
  LISTING_JOBS: KVNamespace;
  GOOGLE_MAPS_API_KEY?: string;
}

const SITEMAP_STATIC_URLS = [
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
  { loc: '/how-to-value-a-used-guitar.html', changefreq: 'monthly', priority: '0.7' },
  { loc: '/how-to-list-a-guitar-for-sale.html', changefreq: 'monthly', priority: '0.7' },
  { loc: '/new-guitarist-practice-resources', changefreq: 'monthly', priority: '0.7' },
  { loc: '/contact-us.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy-policy.html', changefreq: 'monthly', priority: '0.3' },
  { loc: '/terms-conditions.html', changefreq: 'monthly', priority: '0.3' },
  { loc: '/guitar-repair-demo-lesson-videos.html', priority: '0.6' },
];
const SHOP_BASE_PATH = '/guitars-and-gear-for-sale';
const SHOP_STATIC_ORIGIN = 'https://ccg-2k1.pages.dev';
const ASSOCIATE_COOKIE_NAME = 'ccg_associate';
const ASSOCIATE_COOKIE_VALUE = 'associate';
const SHOP_SALES_TAX_RATE = 0.0805;
const CCG_YOUTUBE_CHANNEL_ID = 'UCV-kDQjH_cWcsxwg0GZKX3g';
const DEFAULT_CO_SALES_TAX_RATE_ID = 'txr_1TSEdADCplz62P7p4H6E7YJK';
const SHOP_COUPONS = new Map<string, { amountOffCents: number }>([
  ['TAKE100', { amountOffCents: 10000 }],
]);

interface SubmitPayload {
  urls: Array<string | { url: string; isMulti?: boolean }>;
}

interface QueueResult {
  url: string;
  source?: string;
  runId?: string;
  row?: number;
  recordId?: string;
  unarchived?: boolean;
  unsaved?: boolean;
  existing?: boolean;
  requeued?: boolean;
  resubmitted?: boolean;
  isMulti?: boolean;
}

interface RejectResult {
  url: string;
  reason: string;
}

const ALLOWED_ARCHIVE_REASONS = new Set([
  'Overpriced',
  'Not Desirable',
  'Repair Needs',
  'Too Far',
  'Old/Stale',
  'I bought it',
  'It sold',
  'Unresponsive',
  'Other',
]);

interface SerialDecodeEventPayload {
  brand?: unknown;
  serial?: unknown;
  success?: unknown;
  year?: unknown;
  factory?: unknown;
  country?: unknown;
  error?: unknown;
  pagePath?: unknown;
  userAgent?: unknown;
  clientTimestamp?: unknown;
}

interface DecodeRequestPayload {
  brand?: unknown;
  serial?: unknown;
  pagePath?: unknown;
  userAgent?: unknown;
  clientTimestamp?: unknown;
}

interface ShopCheckoutRequestPayload {
  fulfillmentType?: unknown;
  couponCode?: unknown;
  discountCents?: unknown;
  taxIncluded?: unknown;
  splitTender?: {
    cardAmountCents?: unknown;
  };
  customer?: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
  };
  readerId?: unknown;
  items?: Array<{
    inventoryItemId?: unknown;
    quantity?: unknown;
  }>;
}

type ShopCheckoutLineItem = {
  inventoryItemId: number;
  quantity: number;
  row: ShopCheckoutInventoryRow;
  title: string;
  unitAmountCents: number;
  imageUrl: string;
};

type ShopCheckoutDraft = {
  items: ShopCheckoutLineItem[];
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  taxIncluded: boolean;
  taxCents: number;
  totalCents: number;
};

interface ShopCheckoutInventoryRow {
  id: number;
  title: string | null;
  sale_title: string | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  image_url: string | null;
  regular_price: number | null;
  sale_price: number | null;
  quantity: number | null;
  for_sale: number | null;
  only_in_store: number | null;
  is_sold: number | null;
  is_active: number | null;
  is_rented: number | null;
  availability_status: string | null;
  active_order_id: string | null;
  reserved_until: string | null;
}

interface AiSerialDecodeParsed {
  success: boolean;
  year: string | null;
  month: string | null;
  factory: string | null;
  country: string | null;
  model: string | null;
  notes: string | null;
  error: string | null;
}

interface AiSerialDecodeCacheRow {
  success: number | null;
  brand: string | null;
  serial: string | null;
  year: string | null;
  month: string | null;
  factory: string | null;
  country: string | null;
  model: string | null;
  notes: string | null;
  error: string | null;
  ai_model: string | null;
  ai_response_json: string | null;
}

interface SerialPatternContextPayload {
  title: string;
  summary: string;
  highlights: string[];
  caveats: string[];
  verificationTips: string[];
}

interface SerialPatternContextRow {
  id: number | null;
  brand: string | null;
  normalized_brand: string | null;
  pattern_key: string | null;
  pattern_label: string | null;
  title: string | null;
  summary: string | null;
  highlights_json: string | null;
  caveats_json: string | null;
  verification_json: string | null;
  source_serial: string | null;
  ai_model: string | null;
  ai_response_json: string | null;
  published: number | null;
}

const MAX_URLS = 20;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const CUSTOM_MAX_PHOTOS = 10;
const CUSTOM_MAX_TEXT_LENGTH = 5000;
const REVERB_SEARCH_API_URL = 'https://api.reverb.com/api/listings';
const REVERB_API_TOKEN_FALLBACK = '91712608fefe08e6915c2d781519411af3bdd750818a8edc94d94e14a3d7c491';
const REVERB_PRICING_SEARCH_LIMIT = 12;
const CCG_NUMBER_MIN = 100000;
const CCG_NUMBER_MAX = 999999;
const CCG_NUMBER_ATTEMPTS = 25;
const INVENTORY_MAX_IMAGES = 20;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SERIAL_DECODE_HOURLY_LIMIT = 60;
const SERIAL_DECODE_DUPLICATE_WINDOW_HOURS = 24;
const SERIAL_AI_HOURLY_LIMIT = 20;
const ACTIVITY_BASE_URL = 'https://www.coalcreekguitars.com';

type ActivityEventKey =
  | 'decode_success'
  | 'decode_failure'
  | 'listing_eval_completed'
  | 'inventory_marked_sold'
  | 'inventory_updated'
  | 'inventory_added'
  | 'failed_serial_evaluated';

const ACTIVITY_EVENT_TYPE_SEEDS: Array<{ key: ActivityEventKey; templateText: string; iconKey: string }> = [
  { key: 'decode_success', templateText: 'User decoded serial #{{serial}} in the {{brand}} decoder', iconKey: 'check-circle' },
  { key: 'decode_failure', templateText: 'User attempted to decode serial #{{serial}} in {{brand}} decoder', iconKey: 'x-circle' },
  { key: 'listing_eval_completed', templateText: 'Listing Eval completed for {{title}}', iconKey: 'sale' },
  { key: 'inventory_marked_sold', templateText: 'Inventory item {{title}} marked sold', iconKey: 'inventory' },
  { key: 'inventory_updated', templateText: 'Inventory item {{title}} updated', iconKey: 'inventory' },
  { key: 'inventory_added', templateText: 'Inventory item {{title}} added to system.', iconKey: 'inventory' },
  { key: 'failed_serial_evaluated', templateText: 'Failed {{brand}} Serial Number {{serial}} evaluated by an admin.', iconKey: 'check-circle' },
];

const BRAND_ACTIVITY_META: Record<string, { label: string; decoderSlug: string; logoFile: string }> = {
  gibson: { label: 'Gibson', decoderSlug: 'gibson', logoFile: 'Gibson-logo.png' },
  epiphone: { label: 'Epiphone', decoderSlug: 'epiphone', logoFile: 'Epiphone-Logo.png' },
  fender: { label: 'Fender', decoderSlug: 'fender', logoFile: 'Fender-logo.jpg' },
  taylor: { label: 'Taylor', decoderSlug: 'taylor', logoFile: 'Taylor_guitar_logo.png' },
  martin: { label: 'Martin', decoderSlug: 'martin', logoFile: 'Martin_guitar_logo.png' },
  ibanez: { label: 'Ibanez', decoderSlug: 'ibanez', logoFile: 'Ibanez_guitars_logo.webp' },
  yamaha: { label: 'Yamaha', decoderSlug: 'yamaha', logoFile: 'yamaha-logo.jpg' },
  prs: { label: 'PRS', decoderSlug: 'prs', logoFile: 'Prs_guitars_logo.png' },
  esp: { label: 'ESP', decoderSlug: 'esp', logoFile: 'esp-logo.png' },
  schecter: { label: 'Schecter', decoderSlug: 'schecter', logoFile: 'Schecter_Guitar_Research_logo.svg' },
  gretsch: { label: 'Gretsch', decoderSlug: 'gretsch', logoFile: 'gretsch-guitars-logo.png' },
  jackson: { label: 'Jackson', decoderSlug: 'jackson', logoFile: 'Jackson_guitars_logo.png' },
  squier: { label: 'Squier', decoderSlug: 'squier', logoFile: 'Squier_guitars_logo.png' },
  cort: { label: 'Cort', decoderSlug: 'cort', logoFile: 'Cort_Logo.png' },
  takamine: { label: 'Takamine', decoderSlug: 'takamine', logoFile: 'Takamine_guitar_logo.png' },
  washburn: { label: 'Washburn', decoderSlug: 'washburn', logoFile: 'Washburn_Guitars_logo.png' },
  dean: { label: 'Dean', decoderSlug: 'dean', logoFile: 'Dean_Guitars_logo.png' },
  ernieball: { label: 'Ernie Ball Music Man', decoderSlug: 'ernieball', logoFile: 'Ernie_ball_music_man_logo.png' },
  ernieballmusicman: { label: 'Ernie Ball Music Man', decoderSlug: 'ernieball', logoFile: 'Ernie_ball_music_man_logo.png' },
  musicman: { label: 'Ernie Ball Music Man', decoderSlug: 'ernieball', logoFile: 'Ernie_ball_music_man_logo.png' },
  guild: { label: 'Guild', decoderSlug: 'guild', logoFile: 'Guild-logo.png' },
  alvarez: { label: 'Alvarez', decoderSlug: 'alvarez', logoFile: 'alvarez.png' },
  godin: { label: 'Godin', decoderSlug: 'godin', logoFile: 'Godin_guitars_logo.png' },
  ovation: { label: 'Ovation', decoderSlug: 'ovation', logoFile: 'Ovation_Logo.png' },
  charvel: { label: 'Charvel', decoderSlug: 'charvel', logoFile: 'Charvel-Logo.jpg' },
  rickenbacker: { label: 'Rickenbacker', decoderSlug: 'rickenbacker', logoFile: 'Rickenbacker-logo.png' },
  kramer: { label: 'Kramer', decoderSlug: 'kramer', logoFile: 'Kramer_guitars_logo.png' },
  bcrich: { label: 'B.C. Rich', decoderSlug: 'bc-rich', logoFile: 'bc-rich.jpg' },
};

const SUPPORTED_ORIGINS = [
  'https://www.coalcreekguitars.com',
  'http://localhost:3000',
  'http://localhost:8080',
];

const CATEGORY_OPTIONS = [
  'Accessories',
  'Acoustic Bass',
  'Acoustic Guitars',
  'Amps',
  'Band and Orchestra',
  'Bass Guitars',
  'Cases & Bags',
  'DJ and Lighting Gear',
  'Drums and Percussion',
  'Effects and Pedals',
  'Electric Guitars',
  'Folk Instruments',
  'Home Audio',
  'Keyboards and Synths',
  'Other',
  'Packages',
  'Parts',
  'Pro Audio',
];

const CONDITION_OPTIONS = [
  'Mint',
  'Excellent',
  'Very Good',
  'Good',
  'Fair',
  'Poor',
  'Non Functioning',
];

const SINGLE_FIELD_KEYS = [
  'category',
  'brand',
  'model',
  'finish',
  'year',
  'serial',
  'serial_brand',
  'serial_year',
  'serial_model',
  'value_private_party_low',
  'value_private_party_low_notes',
  'value_private_party_medium',
  'value_private_party_medium_notes',
  'value_private_party_high',
  'value_private_party_high_notes',
  'pricing_source',
  'pricing_confidence',
  'pricing_comp_count',
  'pricing_notes',
  'value_pawn_shop_notes',
  'value_online_notes',
  'known_weak_points',
  'typical_repair_needs',
  'buyers_worry',
  'og_specs_pickups',
  'og_specs_tuners',
  'og_specs_common_mods',
  'buyer_what_to_check',
  'buyer_common_misrepresent',
  'seller_how_to_price_realistic',
  'seller_fixes_add_value_or_waste',
  'seller_as_is_notes',
];

const DEFAULT_TEXT = {
  known_weak_points: 'Potential issues with electronics or hardware over time.',
  typical_repair_needs: 'Possible need for setup adjustments or electronics cleaning.',
  buyers_worry: 'Check for neck straightness and electronics functionality.',
  og_specs_common_mods: 'Common mods vary; verify originality and parts.',
  buyer_what_to_check: 'Inspect electronics, neck relief, fret wear, and hardware function.',
  buyer_common_misrepresent: 'Watch for misrepresented year, model, or replaced parts.',
  seller_how_to_price_realistic: 'Price realistically by comparing recent sales in similar condition.',
  seller_fixes_add_value_or_waste: 'Minor setup and cleaning can help; major repairs may not pay off.',
  seller_as_is_notes: 'Sell as-is if repair costs exceed value gains.',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/sitemap.xml' && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleSitemap(env);
    }

    if (path === '/robots.txt' && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleRobotsTxt();
    }

    if (
      (path === SHOP_BASE_PATH || path.startsWith(`${SHOP_BASE_PATH}/`)) &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      return handleShopPageRequest(request, env);
    }

    if (path === '/api/login' && request.method === 'POST') {
      const response = await handleLogin(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/session' && request.method === 'GET') {
      const response = await handleSession(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/logout' && request.method === 'POST') {
      const response = await handleLogout();
      return withCors(response, request, env);
    }

    if (path === '/api/stripe/webhook' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    if (path.startsWith('/api/') && !isPublicApiPath(path)) {
      const authResponse = await requireAuth(request, env, path);
      if (authResponse) {
        return withCors(authResponse, request, env);
      }
    }

    // Public shop endpoints
    if (path === '/api/shop/associate-mode' && request.method === 'GET') {
      const response = await handleShopAssociateModeStatus(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/associate-mode' && request.method === 'POST') {
      const response = await handleShopAssociateModeEnable(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/associate-mode' && request.method === 'DELETE') {
      const response = handleShopAssociateModeDisable();
      return withCors(response, request, env);
    }

    if (path === '/api/shop/categories' && request.method === 'GET') {
      const response = await handleShopCategories(env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/products' && request.method === 'GET') {
      const response = await handleShopProducts(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/product-search' && request.method === 'GET') {
      const response = await handleShopProductSearch(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/sitemap-products' && request.method === 'GET') {
      const response = await handleShopSitemapProducts(env);
      return withCors(response, request, env);
    }

    const shopReceiptTemplateMatch = path.match(/^\/api\/shop\/receipt-templates\/([^/]+)$/);
    if (shopReceiptTemplateMatch && request.method === 'GET') {
      const templateCode = decodeURIComponent(shopReceiptTemplateMatch[1]);
      const response = await handleShopReceiptTemplate(templateCode, env);
      return withCors(response, request, env);
    }

    const shopProductBySlugMatch = path.match(/^\/api\/shop\/products\/by-slug\/([^/]+)$/);
    if (shopProductBySlugMatch && request.method === 'GET') {
      const slug = decodeURIComponent(shopProductBySlugMatch[1]);
      const response = await handleShopProductDetailBySlug(slug, request, env);
      return withCors(response, request, env);
    }

    const shopProductDetailMatch = path.match(/^\/api\/shop\/products\/(\d+)$/);
    if (shopProductDetailMatch && request.method === 'GET') {
      const response = await handleShopProductDetail(Number(shopProductDetailMatch[1]), request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/newsletter' && request.method === 'POST') {
      const response = await handleShopNewsletterSubscribe(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/youtube/videos' && request.method === 'GET') {
      const response = await handleYoutubeVideos();
      return withCors(response, request, env);
    }

    if (path === '/api/shop/orders/create-checkout-session' && request.method === 'POST') {
      const response = await handleShopCreateCheckoutSession(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/orders/create-terminal-payment' && request.method === 'POST') {
      const response = await handleShopCreateTerminalPayment(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/orders/create-cash-order' && request.method === 'POST') {
      const response = await handleShopCreateCashOrder(request, env);
      return withCors(response, request, env);
    }

    const shopTerminalPaymentCancelMatch = path.match(/^\/api\/shop\/orders\/([^/]+)\/terminal-payment\/cancel$/);
    if (shopTerminalPaymentCancelMatch && request.method === 'POST') {
      const orderId = decodeURIComponent(shopTerminalPaymentCancelMatch[1]);
      const response = await handleShopTerminalPaymentCancel(orderId, request, env);
      return withCors(response, request, env);
    }

    const shopTerminalPaymentMatch = path.match(/^\/api\/shop\/orders\/([^/]+)\/terminal-payment$/);
    if (shopTerminalPaymentMatch && request.method === 'GET') {
      const orderId = decodeURIComponent(shopTerminalPaymentMatch[1]);
      const response = await handleShopTerminalPaymentStatus(orderId, request, env);
      return withCors(response, request, env);
    }

    const shopOrderReceiptMatch = path.match(/^\/api\/shop\/orders\/([^/]+)\/receipt$/);
    if (shopOrderReceiptMatch && request.method === 'GET') {
      const orderId = decodeURIComponent(shopOrderReceiptMatch[1]);
      const response = await handleShopOrderReceipt(orderId, request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/submit' && request.method === 'POST') {
      const response = await handleSubmit(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/custom' && request.method === 'POST') {
      const response = await handleCustomListingSubmit(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/custom-image' && request.method === 'GET') {
      const response = await handleCustomImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/serial-decodes' && request.method === 'POST') {
      const response = await handleSerialDecodeEvent(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/decode' && request.method === 'POST') {
      const response = await handleDecodeRequest(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/webhook' && request.method === 'POST') {
      const response = await handleWebhook(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings' && request.method === 'GET') {
      const response = await handleList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/map' && request.method === 'GET') {
      const response = await handleMapListings(env);
      return withCors(response, request, env);
    }

    if (path === '/api/maps-config' && request.method === 'GET') {
      const response = await handleMapsConfig(env);
      return withCors(response, request, env);
    }

    if (path === '/api/image' && request.method === 'GET') {
      const response = await handleImageProxy(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/archive') && path.startsWith('/api/listings/') && request.method === 'POST') {
      const response = await handleArchiveListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path.endsWith('/save') && path.startsWith('/api/listings/') && request.method === 'POST') {
      const response = await handleSaveListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/listings/') && path.endsWith('/debug') && request.method === 'GET') {
      const response = await handleGetListingDebug(request, env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/reprocess' && request.method === 'POST') {
      const response = await handleReprocessListing(request, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/listings/') && request.method === 'GET') {
      const response = await handleGetListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory' && request.method === 'GET') {
      const response = await handleInventoryList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory' && request.method === 'POST') {
      const response = await handleInventoryCreate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/summary' && request.method === 'GET') {
      const response = await handleInventorySummary(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/summary' && request.method === 'GET') {
      const response = await handleAdminV2DashboardSummary(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/profit-trend' && request.method === 'GET') {
      const response = await handleAdminV2DashboardProfitTrend(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/inventory-aging' && request.method === 'GET') {
      const response = await handleAdminV2DashboardInventoryAging(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/inventory-by-category' && request.method === 'GET') {
      const response = await handleAdminV2DashboardInventoryByCategory(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/recent-sales' && request.method === 'GET') {
      const response = await handleAdminV2DashboardRecentSales(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/oldest-inventory' && request.method === 'GET') {
      const response = await handleAdminV2DashboardOldestInventory(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodes(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes/brand-responses' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodeBrandResponses(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes/lookup-volume' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodeLookupVolume(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-pattern-text' && request.method === 'GET') {
      const response = await handleAdminV2SerialPatternTextList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-pattern-text' && request.method === 'POST') {
      const response = await handleAdminV2SerialPatternTextSave(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/search' && request.method === 'GET') {
      const response = await handleAdminV2Search(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-contexts/generate' && request.method === 'POST') {
      const response = await handleAdminV2SerialPatternContextGenerate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/activity-log' && request.method === 'GET') {
      const response = await handleAdminV2ActivityLog(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/orders' && request.method === 'GET') {
      const response = await handleAdminV2Orders(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/payment-links' && request.method === 'GET') {
      const response = await handleAdminV2PaymentLinks(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/stripe-config' && request.method === 'GET') {
      const response = await handleAdminV2StripeConfig(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/stripe-config' && request.method === 'POST') {
      const response = await handleAdminV2StripeConfigUpdate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/order-confirmation-email/test' && request.method === 'POST') {
      const response = await handleAdminV2OrderConfirmationEmailTest(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/payment-links/marked-items' && request.method === 'GET') {
      const response = await handleAdminV2PaymentLinkMarkedItems(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/payment-links' && request.method === 'POST') {
      const response = await handleAdminV2PaymentLinkCreate(request, env);
      return withCors(response, request, env);
    }

    const adminV2PaymentLinkDeactivateMatch = path.match(/^\/api\/admin-v2\/payment-links\/([^/]+)\/deactivate$/);
    if (adminV2PaymentLinkDeactivateMatch && request.method === 'POST') {
      const response = await handleAdminV2PaymentLinkDeactivate(decodeURIComponent(adminV2PaymentLinkDeactivateMatch[1]), env);
      return withCors(response, request, env);
    }

    const adminV2OrderMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)$/);
    if (adminV2OrderMatch && request.method === 'GET') {
      const response = await handleAdminV2OrderDetail(decodeURIComponent(adminV2OrderMatch[1]), env);
      return withCors(response, request, env);
    }

    const adminV2OrderRefundMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)\/refund$/);
    if (adminV2OrderRefundMatch && request.method === 'POST') {
      const response = await handleAdminV2OrderRefund(decodeURIComponent(adminV2OrderRefundMatch[1]), env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/evaluated') && path.startsWith('/api/admin-v2/serial-decodes/') && request.method === 'POST') {
      const response = await handleAdminV2SerialDecodeEvaluatedUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/admin-v2/serial-decodes/') && request.method === 'POST') {
      const response = await handleAdminV2SerialDecodeDelete(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/labels.pdf' && request.method === 'GET') {
      const response = await handleAdminV2InventoryLabelsPdf(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/labels.pdf' && request.method === 'POST') {
      const response = await handleAdminV2InventoryLabelsPdfPost(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/categories' && request.method === 'GET') {
      const response = await handleAdminV2InventoryCategories(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/categories' && request.method === 'POST') {
      const response = await handleAdminV2InventoryCategoryCreate(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/update') && path.startsWith('/api/admin-v2/inventory/categories/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryCategoryUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/admin-v2/inventory/categories/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryCategoryDelete(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/subscriptions' && request.method === 'GET') {
      const response = await handleAdminV2InventorySubscriptions(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/unmark-all' && request.method === 'POST') {
      const response = await handleAdminV2InventoryUnmarkAll(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/merge-marked' && request.method === 'POST') {
      const response = await handleAdminV2InventoryMergeMarked(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/backfill-barcodes' && request.method === 'POST') {
      const response = await handleAdminV2InventoryBackfillBarcodes(env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/mark') && path.startsWith('/api/admin-v2/inventory/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryMarkUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/listings/purge-old' && request.method === 'POST') {
      const response = await handlePurgeOldListings(env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/ai-analysis') && path.startsWith('/api/admin-v2/listings/') && request.method === 'POST') {
      const response = await handleAdminV2ListingAiAnalysisSave(request, env, path);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/admin-v2/listings/') && request.method === 'GET') {
      const response = await handleAdminV2GetListing(env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/package-create' && request.method === 'POST') {
      const response = await handleInventoryPackageCreate(env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory-image' && request.method === 'GET') {
      const response = await handleInventoryImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listing-image' && request.method === 'GET') {
      const response = await handleListingImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/upload-image' && request.method === 'POST') {
      const response = await handleInventoryImageUpload(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/import-image' && request.method === 'POST') {
      const response = await handleInventoryImageImport(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/update') && path.startsWith('/api/inventory/') && request.method === 'POST') {
      const response = await handleInventoryUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/inventory/') && request.method === 'POST') {
      const response = await handleInventoryDelete(request, path, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/inventory/') && request.method === 'GET') {
      const response = await handleInventoryGet(path, env);
      return withCors(response, request, env);
    }

    return withCors(new Response('Not found', { status: 404 }), request, env);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    return;
  },
};

function withCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  const headers = new Headers(response.headers);

  if (origin && (SUPPORTED_ORIGINS.includes(origin) || origin === env.SITE_BASE_URL)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.set('Access-Control-Allow-Origin', env.SITE_BASE_URL || SUPPORTED_ORIGINS[0]);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  if (path.startsWith('/api/admin-v2/serial-decodes') || path.startsWith('/api/admin-v2/serial-pattern-text')) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function requireAuth(request: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/decode' && request.method === 'POST') {
    return null;
  }

  if (isPublicSiteScopedEndpoint(request, path)) {
    if (!isRequestFromAllowedSitePage(request, env)) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }
    return null;
  }
  if (path === '/api/listings/webhook' && request.method === 'POST') {
    return null;
  }
  const cookies = parseCookie(request.headers.get('cookie'));
  const token = cookies.get(AUTH_COOKIE_NAME);
  if (!token) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const [user, sig] = token.split('.');
  if (!user || !sig) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const validUser = user === env.AUTH_USER;
  const validSig = await verifyAuth(user, env.AUTH_SECRET, sig);
  if (!validUser || !validSig) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  return null;
}

function isPublicSiteScopedEndpoint(request: Request, path: string): boolean {
  const method = request.method.toUpperCase();
  return (
    (path === '/api/decode' && method === 'POST')
    || (path === '/api/serial-decodes' && method === 'POST')
  );
}

function isRequestFromAllowedSitePage(request: Request, env: Env): boolean {
  const allowedOrigin = getAllowedSiteOrigin(env);
  if (!allowedOrigin) return false;

  const originHeader = normalizeText(request.headers.get('origin'), '');
  const refererHeader = normalizeText(request.headers.get('referer'), '');

  const originMatches = originHeader === allowedOrigin;
  const refererMatches = isRefererFromOrigin(refererHeader, allowedOrigin);

  // Accept:
  // 1) origin is exact allowed origin; referer may be absent.
  // 2) origin absent (common for some same-origin GETs), but referer matches.
  if (originMatches) return true;
  if (!originHeader && refererMatches) return true;

  return false;
}

function getAllowedSiteOrigin(env: Env): string {
  const configured = normalizeText(env.SITE_BASE_URL, '');
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Continue to fallback origin list.
    }
  }

  for (const origin of SUPPORTED_ORIGINS) {
    if (!origin) continue;
    try {
      return new URL(origin).origin;
    } catch {
      // Skip invalid entry.
    }
  }
  return '';
}

function isRefererFromOrigin(referer: string, expectedOrigin: string): boolean {
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

async function handleSerialDecodeEvent(request: Request, env: Env): Promise<Response> {
  let body: SerialDecodeEventPayload = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const brand = normalizeText(body.brand, '').slice(0, 120);
  const serial = normalizeText(body.serial, '').slice(0, 180);
  const year = normalizeText(body.year, '').slice(0, 120);
  const factory = normalizeText(body.factory, '').slice(0, 180);
  const country = normalizeText(body.country, '').slice(0, 120);
  const error = normalizeText(body.error, '').slice(0, 1200);
  const pagePath = normalizeText(body.pagePath, '').slice(0, 300);
  const userAgent = normalizeText(body.userAgent, '').slice(0, 500);
  const clientTimestamp = normalizeText(body.clientTimestamp, '').slice(0, 120);
  const success = Boolean(body.success);
  const normalizedBrand = normalizeBrandKey(brand);
  let pattern = '';
  let patternLookupId: number | null = null;

  if (!brand) return jsonResponse({ message: 'Brand is required.' }, 400);
  if (!serial) return jsonResponse({ message: 'Serial is required.' }, 400);

  if (success && normalizedBrand) {
    const decodeResult = decodeSerialForBackend(brand, serial);
    if (decodeResult.success && decodeResult.info) {
      pattern = deriveSerialPatternMeta(normalizedBrand, decodeResult.info.serialNumber || serial).patternKey;
      patternLookupId = await ensureSerialDecodePatternLookup(normalizedBrand, pattern, env);
    }
  }

  const cf = (request as Request & { cf?: Record<string, unknown> }).cf || {};
  const countryCode = normalizeText(cf.country, '').slice(0, 8);
  const colo = normalizeText(cf.colo, '').slice(0, 32);
  const ipAddress = normalizeText(request.headers.get('CF-Connecting-IP'), '').slice(0, 64);

  if (await isSerialDecodeRateLimited(env, ipAddress)) {
    return jsonResponse({ message: 'Too many decode requests. Please try again later.' }, 429);
  }

  const duplicateId = await findRecentSerialDecodeDuplicateId(
    env,
    normalizedBrand,
    normalizeSerialKey(serial).slice(0, 180),
    ipAddress,
  );
  if (duplicateId) {
    await touchSerialDecodeEventTimestamp(env, duplicateId, {
      pagePath,
      userAgent,
      clientTimestamp,
      countryCode,
      colo,
    });
    return jsonResponse({ ok: true, duplicateSuppressed: true });
  }

  await insertSerialDecodeEvent(env, {
    brand,
    serial,
    pattern: pattern || null,
    patternLookupId,
    success,
    year,
    factory,
    country,
    error,
    pagePath,
    userAgent,
    clientTimestamp,
    ipAddress,
    countryCode,
    colo,
  });

  return jsonResponse({ ok: true });
}

async function handleDecodeRequest(request: Request, env: Env): Promise<Response> {
  let body: DecodeRequestPayload = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const brand = normalizeText(body.brand, '').slice(0, 120);
  const serial = normalizeText(body.serial, '').slice(0, 180);
  const pagePath = normalizeText(body.pagePath, '').slice(0, 300);
  const userAgent = normalizeText(body.userAgent, '').slice(0, 500);
  const clientTimestamp = normalizeText(body.clientTimestamp, '').slice(0, 120);
  const normalizedBrand = normalizeBrandKey(brand);
  const normalizedSerial = normalizeSerialKey(serial).slice(0, 180);

  let result = decodeSerialForBackend(brand, serial);
  if (result.success && result.info && !hasMeaningfulServerDecodeInfo(result.info)) {
    result = {
      success: false,
      error: 'Unable to decode this serial number.',
      normalizedBrand,
    };
  }

  const cf = (request as Request & { cf?: Record<string, unknown> }).cf || {};
  const countryCode = normalizeText(cf.country, '').slice(0, 8);
  const colo = normalizeText(cf.colo, '').slice(0, 32);
  const ipAddress = normalizeText(request.headers.get('CF-Connecting-IP'), '').slice(0, 64);

  let usedAi = false;
  let aiCacheHit = false;
  let aiModel = '';
  let aiResponseJson = '';
  let aiAttemptedAt = '';
  let aiLogText = normalizeText(result.error, '').slice(0, 1200);

  // AI serial decode fallback is intentionally disabled.
  // We want rule-based failures to remain visible so decoder support can be
  // added explicitly instead of masking gaps with an AI-assisted guess.

  let patternKey = '';
  let patternLabel = '';
  let needsAdditionalContext = false;
  let additionalContext: SerialPatternContextPayload | null = null;
  let additionalContextRichText = '';
  let patternLookupId: number | null = null;

  if (result.success && result.info && normalizedBrand) {
    const decodedSerial = normalizeText(result.info.serialNumber, serial).slice(0, 180);
    const decoderPatternKey = normalizeText(result.patternKey, '').slice(0, 180);
    const decoderPatternLabel = normalizeText(result.patternLabel, '').slice(0, 180);
    const patternMeta = decoderPatternKey
      ? {
          patternKey: decoderPatternKey,
          patternLabel: decoderPatternLabel || decoderPatternKey,
        }
      : deriveSerialPatternMeta(normalizedBrand, decodedSerial);
    patternKey = patternMeta.patternKey;
    patternLabel = patternMeta.patternLabel;
    if (result.additionalContext) {
      additionalContext = result.additionalContext;
    } else {
      const contextRow = await dbGetPublishedSerialPatternContext(normalizedBrand, patternMeta.patternKey, env);
      if (contextRow) {
        additionalContext = contextRow;
      } else {
        needsAdditionalContext = true;
      }
    }
    additionalContextRichText = normalizeText(result.additionalContextRichText, '').slice(0, 12000);
  }

  if (patternKey) {
    patternLookupId = await ensureSerialDecodePatternLookup(normalizedBrand, patternKey, env);
    if (!additionalContextRichText) {
      additionalContextRichText = await getSerialDecodePatternRichText(normalizedBrand, patternKey, env);
    }
  }

  const eventPayload: SerialDecodeEventInsert = {
    brand: (result.info?.brand || brand).slice(0, 120),
    serial: (result.info?.serialNumber || serial).slice(0, 180),
    pattern: patternKey || null,
    patternKey: patternKey || null,
    patternLabel: patternLabel || null,
    patternLookupId,
    normalizedBrand: normalizedBrand.slice(0, 120),
    normalizedSerial,
    success: result.success,
    needsContext: needsAdditionalContext,
    year: normalizeText(result.info?.year, '').slice(0, 120),
    month: normalizeText(result.info?.month, '').slice(0, 120),
    factory: normalizeText(result.info?.factory, '').slice(0, 180),
    country: normalizeText(result.info?.country, '').slice(0, 120),
    model: normalizeText(result.info?.model, '').slice(0, 180),
    notes: normalizeText(result.info?.notes, '').slice(0, 4000),
    error: (usedAi ? aiLogText : normalizeText(result.error, '')).slice(0, 1200),
    usedAi,
    aiCacheHit,
    aiModel,
    aiResponseJson,
    aiAttemptedAt,
    pagePath,
    userAgent,
    clientTimestamp,
    ipAddress,
    countryCode,
    colo,
  };

  const duplicateId = await findRecentSerialDecodeDuplicateId(
    env,
    normalizedBrand.slice(0, 120),
    normalizedSerial,
    ipAddress,
  );

  if (duplicateId) {
    try {
      await touchSerialDecodeEventTimestamp(env, duplicateId, eventPayload);
    } catch (error) {
      console.error('serial decode event duplicate touch failed', { error, duplicateId });
    }
  } else {
    try {
      await insertSerialDecodeEvent(env, eventPayload);
    } catch (error) {
      console.error('serial decode event insert failed', { error });
    }
  }

  const decodeBrand = normalizeText(result.info?.brand || brand, '').slice(0, 120);
  const decodeSerial = normalizeText(result.info?.serialNumber || serial, '').slice(0, 180);
  const decodeBrandContext = buildBrandActivityContext(decodeBrand, normalizedBrand);
  const decodeEventText = result.success
    ? `User decoded serial #${decodeSerial} in the ${decodeBrandContext.brandLabel} decoder`
    : `User attempted to decode serial #${decodeSerial} in ${decodeBrandContext.brandLabel} decoder`;
  if (!duplicateId) {
    await insertActivityLogBestEffort(env, {
      eventKey: result.success ? 'decode_success' : 'decode_failure',
      eventText: decodeEventText,
      eventUrl: decodeBrandContext.decoderUrl,
      imageUrl: decodeBrandContext.imageUrl,
      entityType: 'serial_decode',
      metadata: {
        brand: decodeBrandContext.brandLabel,
        serial: decodeSerial,
        success: result.success,
      },
    });
  }

  return jsonResponse({
    ...result,
    patternKey: patternKey || undefined,
    patternLabel: patternLabel || undefined,
    needsAdditionalContext,
    additionalContext,
    additionalContextRichText: additionalContextRichText || undefined,
  });
}

interface SerialDecodeEventInsert {
  brand: string;
  serial: string;
  pattern?: string | null;
  patternKey?: string | null;
  patternLabel?: string | null;
  patternLookupId?: number | null;
  normalizedBrand?: string;
  normalizedSerial?: string;
  success: boolean;
  needsContext?: boolean;
  year?: string;
  month?: string;
  factory?: string;
  country?: string;
  model?: string;
  notes?: string;
  error?: string;
  usedAi?: boolean;
  aiCacheHit?: boolean;
  aiModel?: string;
  aiResponseJson?: string;
  aiAttemptedAt?: string;
  pagePath?: string;
  userAgent?: string;
  clientTimestamp?: string;
  ipAddress?: string;
  countryCode?: string;
  colo?: string;
}

interface ActivityLogInsert {
  eventKey: ActivityEventKey;
  eventText: string;
  eventUrl?: string | null;
  imageUrl?: string | null;
  eventTimeUtc?: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

function buildSerialDecodeRateLimitKey(ipAddress: string, now = new Date()): string {
  return `serial-decode-rate:${ipAddress}:${now.toISOString().slice(0, 13)}`;
}

async function incrementSerialDecodeRequestCount(env: Env, ipAddress: string): Promise<number> {
  if (!ipAddress || !env.LISTING_JOBS) return 0;

  const key = buildSerialDecodeRateLimitKey(ipAddress);

  try {
    const currentRaw = await env.LISTING_JOBS.get(key);
    const nextCount = Math.max(0, Number(currentRaw || 0)) + 1;
    await env.LISTING_JOBS.put(key, String(nextCount), { expirationTtl: 7200 });
    return nextCount;
  } catch (error) {
    console.error('serial decode rate counter update failed', { error, ipAddress });
    return 0;
  }
}

async function isSerialDecodeRateLimited(env: Env, ipAddress: string): Promise<boolean> {
  if (!ipAddress) return false;
  const count = await incrementSerialDecodeRequestCount(env, ipAddress);
  return count > SERIAL_DECODE_HOURLY_LIMIT;
}

let serialDecodeEventColumnCache: Set<string> | null = null;

function buildBrandActivityContext(brandInput: string, normalizedBrandInput = ''): {
  brandLabel: string;
  decoderUrl: string | null;
  imageUrl: string | null;
} {
  const normalized = normalizeBrandKey(normalizedBrandInput || brandInput);
  const meta = BRAND_ACTIVITY_META[normalized];
  const brandLabel = meta?.label || normalizeText(brandInput, '') || 'Unknown';
  const decoderUrl = meta
    ? `${ACTIVITY_BASE_URL}/decoders/${meta.decoderSlug}-guitar-serial-number-decoder.html`
    : null;
  const imageUrl = meta
    ? `${ACTIVITY_BASE_URL}/images/brand-logos/${meta.logoFile}`
    : null;
  return { brandLabel, decoderUrl, imageUrl };
}

function buildAdminInventoryItemUrl(recordId: string): string {
  return `${ACTIVITY_BASE_URL}/admin/inventory-item?id=${encodeURIComponent(recordId)}`;
}

function buildAdminListingEvaluatorItemUrl(recordId: string): string {
  return `${ACTIVITY_BASE_URL}/admin/listing-evaluator-item?id=${encodeURIComponent(recordId)}`;
}

function toAbsoluteSiteUrl(input: string): string | null {
  const trimmed = normalizeText(input, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    try {
      return new URL(trimmed, ACTIVITY_BASE_URL).toString();
    } catch {
      return null;
    }
  }
  return normalizeUrl(trimmed);
}

async function ensureActivityEventTypeId(eventKey: ActivityEventKey, env: Env): Promise<number | null> {
  const db = env.DB.withSession('first-primary');
  let row = await db.prepare(
    `SELECT id
     FROM activity_event_type
     WHERE event_key = ?
     LIMIT 1`
  ).bind(eventKey).first<{ id: number | null }>();

  if (row?.id != null) return Number(row.id);

  const seed = ACTIVITY_EVENT_TYPE_SEEDS.find((entry) => entry.key === eventKey);
  if (!seed) return null;

  await db.prepare(
    `INSERT OR IGNORE INTO activity_event_type (event_key, template_text, icon_key)
     VALUES (?, ?, ?)`
  ).bind(seed.key, seed.templateText, seed.iconKey).run();

  row = await db.prepare(
    `SELECT id
     FROM activity_event_type
     WHERE event_key = ?
     LIMIT 1`
  ).bind(eventKey).first<{ id: number | null }>();

  if (row?.id == null) return null;
  return Number(row.id);
}

async function insertActivityLogBestEffort(env: Env, payload: ActivityLogInsert): Promise<void> {
  try {
    const eventTypeId = await ensureActivityEventTypeId(payload.eventKey, env);
    if (eventTypeId == null) {
      console.warn('Activity log event type missing', { eventKey: payload.eventKey });
      return;
    }

    const metadataJson = payload.metadata ? JSON.stringify(payload.metadata) : null;
    await env.DB.prepare(
      `INSERT INTO activity_log (
        event_time_utc,
        event_type_id,
        event_url,
        event_text,
        image_url,
        entity_type,
        entity_id,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.eventTimeUtc || new Date().toISOString(),
      eventTypeId,
      payload.eventUrl || null,
      payload.eventText,
      payload.imageUrl || null,
      payload.entityType || null,
      payload.entityId || null,
      metadataJson,
    ).run();
  } catch (error) {
    console.error('Activity log insert failed', {
      eventKey: payload.eventKey,
      error,
    });
  }
}

async function getSerialDecodeEventColumns(env: Env): Promise<Set<string>> {
  if (serialDecodeEventColumnCache) return serialDecodeEventColumnCache;
  const rows = await env.DB.withSession('first-primary').prepare(
    `PRAGMA table_info(serial_decode_events)`
  ).all<{ name: string | null }>();

  serialDecodeEventColumnCache = new Set(
    (rows.results ?? [])
      .map((row) => normalizeText(row.name, '').toLowerCase())
      .filter(Boolean),
  );
  return serialDecodeEventColumnCache;
}

async function insertSerialDecodeEventWithColumns(
  env: Env,
  payload: SerialDecodeEventInsert,
  columnSet: Set<string>,
): Promise<void> {
  const valuesByColumn: Record<string, unknown> = {
    event_time_utc: new Date().toISOString(),
    brand: payload.brand,
    serial: payload.serial,
    pattern: payload.pattern || null,
    pattern_key: payload.patternKey || null,
    pattern_label: payload.patternLabel || null,
    pattern_lookup_id: payload.patternLookupId ?? null,
    normalized_brand: payload.normalizedBrand || normalizeBrandKey(payload.brand),
    normalized_serial: payload.normalizedSerial || normalizeSerialKey(payload.serial),
    success: payload.success ? 1 : 0,
    evaluated: 0,
    needs_context: payload.needsContext ? 1 : 0,
    used_ai: payload.usedAi ? 1 : 0,
    is_listing_eval: 0,
    year: payload.year || null,
    month: payload.month || null,
    factory: payload.factory || null,
    country: payload.country || null,
    model: payload.model || null,
    notes: payload.notes || null,
    error: payload.error || null,
    ai_cache_hit: payload.aiCacheHit ? 1 : 0,
    ai_model: payload.aiModel || null,
    ai_response_json: payload.aiResponseJson || null,
    ai_attempted_at: payload.aiAttemptedAt || null,
    page_path: payload.pagePath || null,
    user_agent: payload.userAgent || null,
    client_timestamp: payload.clientTimestamp || null,
    ip_address: payload.ipAddress || null,
    cf_country: payload.countryCode || null,
    cf_colo: payload.colo || null,
  };

  const preferredOrder = [
    'event_time_utc',
    'brand',
    'serial',
    'pattern',
    'pattern_key',
    'pattern_label',
    'pattern_lookup_id',
    'normalized_brand',
    'normalized_serial',
    'success',
    'evaluated',
    'needs_context',
    'used_ai',
    'is_listing_eval',
    'year',
    'month',
    'factory',
    'country',
    'model',
    'notes',
    'error',
    'ai_cache_hit',
    'ai_model',
    'ai_response_json',
    'ai_attempted_at',
    'page_path',
    'user_agent',
    'client_timestamp',
    'ip_address',
    'cf_country',
    'cf_colo',
  ];

  const columns = preferredOrder.filter((column) => columnSet.has(column));
  if (!columns.includes('brand') || !columns.includes('serial') || !columns.includes('success')) {
    throw new Error('serial_decode_events is missing required columns (brand, serial, success).');
  }

  const placeholders = columns.map(() => '?').join(', ');
  const bindValues = columns.map((column) => valuesByColumn[column] ?? null);
  const sql = `INSERT INTO serial_decode_events (${columns.join(', ')}) VALUES (${placeholders})`;
  await env.DB.prepare(sql).bind(...bindValues).run();
}

async function insertSerialDecodeEvent(env: Env, payload: SerialDecodeEventInsert): Promise<void> {
  const columns = await getSerialDecodeEventColumns(env);
  try {
    await insertSerialDecodeEventWithColumns(env, payload, columns);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (/no column named/i.test(message) || /has no column named/i.test(message)) {
      serialDecodeEventColumnCache = null;
      const refreshedColumns = await getSerialDecodeEventColumns(env);
      await insertSerialDecodeEventWithColumns(env, payload, refreshedColumns);
      return;
    }
    throw error;
  }
}

async function findRecentSerialDecodeDuplicateId(
  env: Env,
  normalizedBrand: string,
  normalizedSerial: string,
  ipAddress: string,
): Promise<number | null> {
  if (!normalizedBrand || !normalizedSerial || !ipAddress) return null;

  const columns = await getSerialDecodeEventColumns(env);
  if (!columns.has('normalized_brand') || !columns.has('normalized_serial') || !columns.has('ip_address')) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT id
     FROM serial_decode_events
     WHERE normalized_brand = ?
       AND normalized_serial = ?
       AND ip_address = ?
       AND is_listing_eval = 0
       AND datetime(COALESCE(event_time_utc, created_at)) >= datetime('now', ?)
     ORDER BY datetime(COALESCE(event_time_utc, created_at)) DESC, id DESC
     LIMIT 1`
  ).bind(
    normalizedBrand,
    normalizedSerial,
    ipAddress,
    `-${SERIAL_DECODE_DUPLICATE_WINDOW_HOURS} hours`,
  ).first<{ id: number | null }>();

  if (row?.id == null) return null;
  return Number(row.id);
}

async function touchSerialDecodeEventTimestamp(
  env: Env,
  id: number,
  payload: Pick<SerialDecodeEventInsert, 'pagePath' | 'userAgent' | 'clientTimestamp' | 'countryCode' | 'colo'>,
): Promise<void> {
  if (!(id > 0)) return;

  const columns = await getSerialDecodeEventColumns(env);
  const assignments: string[] = [];
  const bindValues: unknown[] = [];

  if (columns.has('event_time_utc')) {
    assignments.push('event_time_utc = ?');
    bindValues.push(new Date().toISOString());
  }
  if (columns.has('page_path')) {
    assignments.push('page_path = ?');
    bindValues.push(payload.pagePath || null);
  }
  if (columns.has('user_agent')) {
    assignments.push('user_agent = ?');
    bindValues.push(payload.userAgent || null);
  }
  if (columns.has('client_timestamp')) {
    assignments.push('client_timestamp = ?');
    bindValues.push(payload.clientTimestamp || null);
  }
  if (columns.has('cf_country')) {
    assignments.push('cf_country = ?');
    bindValues.push(payload.countryCode || null);
  }
  if (columns.has('cf_colo')) {
    assignments.push('cf_colo = ?');
    bindValues.push(payload.colo || null);
  }

  if (!assignments.length) return;

  bindValues.push(id);
  await env.DB.prepare(
    `UPDATE serial_decode_events
     SET ${assignments.join(', ')}
     WHERE id = ?`
  ).bind(...bindValues).run();
}

async function ensureSerialDecodePatternLookup(brand: string, pattern: string, env: Env): Promise<number | null> {
  const brandKey = normalizeText(brand, '').slice(0, 120);
  const cleaned = normalizeText(pattern, '').slice(0, 180);
  if (!brandKey || !cleaned) return null;
  const regexPattern = deriveRegexFromPatternKey(cleaned).slice(0, 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO serial_decode_pattern_lookup (brand, pattern, regex_pattern, rich_text)
       VALUES (?, ?, ?, '')
       ON CONFLICT(brand, pattern) DO UPDATE SET
         regex_pattern = CASE
           WHEN trim(COALESCE(serial_decode_pattern_lookup.regex_pattern, '')) = ''
             OR trim(COALESCE(serial_decode_pattern_lookup.regex_pattern, '')) = '^.{1,}$'
             THEN excluded.regex_pattern
           ELSE serial_decode_pattern_lookup.regex_pattern
         END`
    ).bind(brandKey, cleaned, regexPattern).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/no column named regex_pattern/i.test(message) && !/has no column named regex_pattern/i.test(message)) {
      throw error;
    }
    await env.DB.prepare(
      `INSERT OR IGNORE INTO serial_decode_pattern_lookup (brand, pattern, rich_text)
       VALUES (?, ?, '')`
    ).bind(brandKey, cleaned).run();
  }
  try {
    const row = await env.DB.prepare(
      `SELECT id
       FROM serial_decode_pattern_lookup
       WHERE brand = ?
         AND pattern = ?
       LIMIT 1`
    ).bind(brandKey, cleaned).first<{ id: number | null }>();
    if (row?.id == null) return null;
    return Number(row.id);
  } catch {
    return null;
  }
}

async function getSerialDecodePatternRichText(brand: string, pattern: string, env: Env): Promise<string> {
  const brandKey = normalizeText(brand, '').slice(0, 120);
  const cleaned = normalizeText(pattern, '').slice(0, 180);
  if (!brandKey || !cleaned) return '';
  const row = await env.DB.prepare(
    `SELECT rich_text
     FROM serial_decode_pattern_lookup
     WHERE brand = ?
       AND pattern = ?
     LIMIT 1`
  ).bind(brandKey, cleaned).first<{ rich_text: string | null }>();
  return normalizeText(row?.rich_text, '').slice(0, 12000);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let body: { username?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const username = body.username?.trim() ?? '';
  const password = body.password ?? '';
  if (username !== env.AUTH_USER || password !== env.AUTH_PASS) {
    return jsonResponse({ error: 'invalid_credentials' }, 401);
  }

  const sig = await signAuth(username, env.AUTH_SECRET);
  const token = `${username}.${sig}`;
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': buildAuthCookie(token),
    },
  });
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookie(request.headers.get('cookie'));
  const token = cookies.get(AUTH_COOKIE_NAME);
  if (!token) {
    return jsonResponse({ ok: false }, 401);
  }

  const [user, sig] = token.split('.');
  if (!user || !sig) {
    return jsonResponse({ ok: false }, 401);
  }

  const validUser = user === env.AUTH_USER;
  const validSig = await verifyAuth(user, env.AUTH_SECRET, sig);
  if (!validUser || !validSig) {
    return jsonResponse({ ok: false }, 401);
  }

  return new Response(JSON.stringify({ ok: true, user }), {
    headers: { 'content-type': 'application/json' },
  });
}

async function handleLogout(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': clearAuthCookie(),
    },
  });
}

async function handleSubmit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let payload: SubmitPayload;
  try {
    payload = (await request.json()) as SubmitPayload;
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawUrls = Array.isArray(payload.urls) ? payload.urls : [];
  if (rawUrls.length === 0) {
    return jsonResponse({ message: 'No URLs provided.' }, 400);
  }

  const normalizedItems = rawUrls.map((entry) => {
    if (typeof entry === 'string') return { url: entry, isMulti: false };
    if (entry && typeof entry.url === 'string') {
      return { url: entry.url, isMulti: Boolean(entry.isMulti) };
    }
    return null;
  }).filter(Boolean) as Array<{ url: string; isMulti: boolean }>;

  const urls = normalizedItems
    .map((item) => ({ ...item, url: normalizeUrl(item.url) }))
    .filter((item) => item.url) as Array<{ url: string; isMulti: boolean }>;

  const seen = new Set<string>();
  const uniqueUrls = urls.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, MAX_URLS);

  const accepted: QueueResult[] = [];
  const rejected: RejectResult[] = [];

  for (const item of uniqueUrls) {
    const resolvedUrl = await resolveFacebookShareUrl(item.url);
    const normalizedResolvedUrl = normalizeQueuedListingUrl(resolvedUrl);
    if (!normalizedResolvedUrl || !isSupportedListingUrl(normalizedResolvedUrl)) {
      rejected.push({ url: item.url, reason: 'Unsupported URL. Use a Facebook Marketplace item URL, Craigslist listing URL, or single Reverb item URL.' });
      continue;
    }

    const source = detectSource(normalizedResolvedUrl);
    if (!source) {
      rejected.push({ url: item.url, reason: 'Unsupported URL. Use Craigslist, Facebook Marketplace, or Reverb.' });
      continue;
    }

    if (source === 'reverb' && item.isMulti) {
      rejected.push({ url: item.url, reason: 'Reverb URLs are supported only in single-item mode.' });
      continue;
    }

    accepted.push({ url: normalizedResolvedUrl, source, isMulti: item.isMulti });
  }

  const results: QueueResult[] = [];

  for (const item of accepted) {
    const existing = await dbFindListingByUrl(item.url, env);
    if (existing) {
      const archived = isArchivedValue(existing.fields?.archived);
      const saved = isArchivedValue(existing.fields?.saved);
      const existingStatus = normalizeText(existing.fields?.status, '').toLowerCase();

      if (archived || saved) {
        await dbUpdateListing(existing.id, { archived: false, archive_reason: null, saved: false }, env);
      }

      if (!archived && !saved && item.source !== 'reverb' && (existingStatus === 'queued' || existingStatus === 'failed')) {
        const runId = await startApifyRun(item.url, item.source as ListingSource, env, existing.id);
        if (runId) {
          await env.LISTING_JOBS.put(runId, existing.id);
          await dbUpdateListing(existing.id, { status: 'queued' }, env);
          ctx.waitUntil(processApifyRunWhenReady(runId, env, existing.id));
          results.push({
            ...item,
            runId,
            recordId: existing.id,
            existing: true,
            requeued: true,
          });
          continue;
        }
      }

      results.push({
        ...item,
        recordId: existing.id,
        existing: true,
        unarchived: archived,
        unsaved: saved,
      });
      continue;
    }

    if (item.source === 'reverb') {
      try {
        const { runId, recordId, listing } = await queueAndProcessReverbListing(item.url, item.isMulti ?? false, env);
        ctx.waitUntil((async () => {
          try {
            await processDirectListing(recordId, runId, listing, env, { isMulti: item.isMulti });
          } catch (error) {
            console.error('Reverb queued processing failed', { url: item.url, recordId, error });
          }
        })());
        results.push({ ...item, runId, recordId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load Reverb listing from API.';
        rejected.push({ url: item.url, reason: message });
      }
      continue;
    }

    const recordId = await insertQueuedRow(item.url, item.source as ListingSource, null, item.isMulti ?? false, env);
    if (!recordId) {
      rejected.push({ url: item.url, reason: 'Unable to queue listing.' });
      continue;
    }

    const runId = await startApifyRun(item.url, item.source as ListingSource, env, recordId);
    if (!runId) {
      await dbUpdateListing(recordId, { status: 'failed', ai_summary: 'Unable to start scraper run.' }, env);
      rejected.push({ url: item.url, reason: 'Unable to start scraper run.' });
      continue;
    }

    await env.LISTING_JOBS.put(runId, recordId);
    ctx.waitUntil(processApifyRunWhenReady(runId, env, recordId));
    results.push({ ...item, runId, recordId: recordId || undefined });
  }

  return jsonResponse({
    accepted: results.length,
    queued: results,
    rejected,
  });
}

function toAbsoluteImageUrl(url: string, baseUrl: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function cleanCustomTitleToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/\(NOT DEFINITIVE\)/gi, ' ')
    .replace(/\bEstimated\s+range:\s*/gi, '')
    .replace(/^Guess:\s*/i, '')
    .replace(/\bUnknown\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

function buildCustomAiTitle(
  aiData: SingleAiResult | undefined,
  overrides?: { year?: string; brand?: string; model?: string; finish?: string }
): string {
  if (!aiData) return 'Custom Item';
  const parts = [
    cleanCustomTitleToken(overrides?.year || aiData.year),
    cleanCustomTitleToken(overrides?.brand || aiData.brand),
    cleanCustomTitleToken(overrides?.model || aiData.model),
    cleanCustomTitleToken(overrides?.finish || aiData.finish),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Custom Item';
}

function normalizeCustomText(raw: unknown, maxLength = CUSTOM_MAX_TEXT_LENGTH): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

function buildCustomListingTitle(input: { brand?: string; model?: string }): string {
  const parts = [input.brand, input.model].map((value) => normalizeCustomText(value, 180)).filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ').slice(0, 120);
  }
  return 'Custom Item';
}

function buildCustomListingDescription(input: {
  brand?: string;
  model?: string;
  condition?: string;
  notes?: string;
}): string {
  const lines = ['Custom in-person item for evaluation.'];
  const brand = normalizeCustomText(input.brand, 180);
  const model = normalizeCustomText(input.model, 180);
  const condition = normalizeCustomText(input.condition, 180);
  const notes = normalizeCustomText(input.notes);

  if (brand) lines.push(`Brand: ${brand}`);
  if (model) lines.push(`Model: ${model}`);
  if (condition) lines.push(`Observed condition: ${condition}`);
  if (notes) lines.push(`Notes: ${notes}`);

  return lines.join('\n');
}

function detectContentTypeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
  // HEIC/HEIF: bytes 4-7 = "ftyp", then brand "heic","heix","hevc","mif1" etc.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(brand)) return 'image/heic';
  }
  return null;
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  if (normalized.includes('heic') || normalized.includes('heif')) return 'heic';
  if (normalized.includes('avif')) return 'avif';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('tiff') || normalized.includes('tif')) return 'tiff';
  return 'jpg'; // default to jpg instead of bin for image content
}

function buildCustomImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listings/custom-image?${params.toString()}`;
}

function buildListingImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listing-image?${params.toString()}`;
}

function buildInventoryImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/inventory-image?${params.toString()}`;
}

type CloudflareImagePreset = 'thumb' | 'card' | 'detail';

const CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS: Record<CloudflareImagePreset, string> = {
  thumb: 'fit=scale-down,width=180,quality=80,format=auto,onerror=redirect',
  card: 'fit=scale-down,width=640,quality=82,format=auto,onerror=redirect',
  detail: 'fit=scale-down,width=1400,quality=85,format=auto,onerror=redirect',
};

function normalizeInventoryImageUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (!raw.startsWith('/api/') && !/^https?:\/\//i.test(raw) && !raw.startsWith('/cdn-cgi/image/')) {
    if (raw.startsWith('listing-images/')) return buildListingImageUrl(raw);
    if (raw.startsWith('custom-items/')) return buildCustomImageUrl(raw);
    return buildInventoryImageUrl(raw);
  }
  return raw;
}

function toCloudflareImageTransformUrl(
  imageUrl: string,
  preset: CloudflareImagePreset,
  options: { absolute?: boolean } = {},
): string {
  const normalized = imageUrl.trim();
  if (!normalized || normalized.startsWith('/cdn-cgi/image/')) return normalized;

  const transformOptions = CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS[preset];
  const baseUrl = options.absolute ? ACTIVITY_BASE_URL : '';

  if (normalized.startsWith('/api/')) {
    return `${baseUrl}/cdn-cgi/image/${transformOptions}${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    const siteOrigin = new URL(ACTIVITY_BASE_URL).origin;
    if (parsed.origin !== siteOrigin) return normalized;
    return `${parsed.origin}/cdn-cgi/image/${transformOptions}${parsed.pathname}${parsed.search}`;
  } catch {
    return normalized;
  }
}

function toAdminImageUrl(value: unknown, preset?: CloudflareImagePreset): string {
  const imageUrl = normalizeInventoryImageUrl(value);
  if (!imageUrl || !preset) return imageUrl;
  return toCloudflareImageTransformUrl(imageUrl, preset);
}

function toPublicShopImageUrl(value: unknown, preset?: CloudflareImagePreset): string {
  let imageUrl = normalizeInventoryImageUrl(value);
  if (imageUrl && preset) {
    imageUrl = toCloudflareImageTransformUrl(imageUrl, preset, { absolute: true });
  }
  if (imageUrl.startsWith('/api/')) {
    imageUrl = `${ACTIVITY_BASE_URL}${imageUrl}`;
  } else if (imageUrl.startsWith('/cdn-cgi/image/')) {
    imageUrl = `${ACTIVITY_BASE_URL}${imageUrl}`;
  }
  return imageUrl;
}

function photoListFromRecord(fields: Record<string, unknown>): string[] {
  const photos = typeof fields.photos === 'string'
    ? fields.photos.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const imageUrl = typeof fields.image_url === 'string' ? fields.image_url.trim() : '';
  if (imageUrl) photos.push(imageUrl);
  return Array.from(new Set(photos));
}

function buildCustomListingFromRecordFields(fields: Record<string, unknown>): ListingData | null {
  const photos = photoListFromRecord(fields);
  if (photos.length === 0) return null;

  const priceValue = fields.price_asking;
  const price = typeof priceValue === 'number'
    ? String(priceValue)
    : normalizeCustomText(priceValue, 120);

  return {
    title: normalizeCustomText(fields.title, 120) || 'Custom Item',
    price,
    location: normalizeCustomText(fields.location, 180),
    condition: normalizeCustomText(fields.condition, 180),
    description: normalizeCustomText(fields.description),
    images: photos,
    notes: normalizeCustomText(fields.notes),
    brandHint: normalizeCustomText(fields.brand, 180),
    modelHint: normalizeCustomText(fields.model, 180),
  };
}

async function processCustomListing(
  recordId: string,
  listing: ListingData,
  env: Env
): Promise<void> {
  const runId = `custom-${recordId}-${Date.now()}`;
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const aiImages = listing.images.map((imageUrl) => toAbsoluteImageUrl(imageUrl, baseUrl));
  try {
    const aiResult = await runOpenAI({ ...listing, images: aiImages }, env, { isMulti: false });
    let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;
    if (aiData) {
      aiData = clearPrivatePartyPricingFields(aiData);
      const pricing = await getRealisticPrivatePartyPricing(aiData, env);
      if (pricing) {
        aiData = { ...aiData, ...pricing };
      }
    }
    const serialCandidate = typeof aiData?.serial === 'string' ? aiData.serial.trim() : '';
    const serialBrandCandidate = typeof aiData?.serial_brand === 'string' ? aiData.serial_brand.trim() : '';
    const decoded = serialCandidate
      ? decodeSerial(serialBrandCandidate || aiData?.brand || '', serialCandidate)
      : null;
    const aiTitle = buildCustomAiTitle(aiData, {
      year: decoded?.info?.year || aiData?.serial_year || aiData?.year,
      brand: decoded?.info?.brand || aiData?.serial_brand || aiData?.brand,
      model: decoded?.info?.model || aiData?.serial_model || aiData?.model,
    });

    await updateRowByRunId(runId, {
      runId,
      status: 'complete',
      title: aiTitle,
      price: listing.price,
      location: listing.location,
      condition: listing.condition,
      description: listing.description,
      photos: listing.images.join('\n'),
      image_url: listing.images[0] ?? '',
      aiSummary: '',
      aiData,
      notes: listing.notes,
    }, env, { recordId, isMulti: false });
  } catch (error) {
    console.error('Custom listing processing failed', { recordId, error });
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
    }, env, { recordId, isMulti: false });
  }
}

async function processDirectListing(
  recordId: string,
  runId: string,
  listing: ListingData,
  env: Env,
  options?: { isMulti?: boolean }
): Promise<void> {
  const isMulti = Boolean(options?.isMulti);
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const aiImages = listing.images.map((imageUrl) => toAbsoluteImageUrl(imageUrl, baseUrl));

  try {
    await dbUpdateListing(recordId, { status: 'processing' }, env);
    const aiResult = await runOpenAI({ ...listing, images: aiImages }, env, { isMulti });
    let aiSummary = aiResult.kind === 'multi' ? ensureMultiTotals(aiResult.summary) : '';
    let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;

    if (aiResult.kind === 'single' && aiData) {
      aiData = clearPrivatePartyPricingFields(aiData);
      const pricing = await getRealisticPrivatePartyPricing(aiData, env);
      if (pricing) {
        aiData = { ...aiData, ...pricing };
      }
    }

    if (aiResult.kind === 'multi') {
      const pricing = await runOpenAIMultiRangePricing(listing, aiSummary, env);
      if (pricing) {
        aiSummary = applyMultiRangeToSummary(aiSummary, pricing.low, pricing.high);
      }
    }

    await updateRowByRunId(runId, {
      runId,
      status: 'complete',
      title: listing.title,
      price: listing.price,
      location: listing.location,
      condition: listing.condition,
      description: listing.description,
      photos: listing.images.join('\n'),
      image_url: listing.images[0] ?? '',
      aiSummary,
      aiData,
      notes: listing.notes,
    }, env, { recordId, isMulti });
  } catch (error) {
    console.error('Direct listing processing failed', { recordId, runId, error });
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      title: listing.title,
      price: listing.price,
      location: listing.location,
      condition: listing.condition,
      description: listing.description,
      photos: listing.images.join('\n'),
      image_url: listing.images[0] ?? '',
      notes: listing.notes,
    }, env, { recordId, isMulti });
    throw error;
  }
}

async function handleCustomListingSubmit(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Custom item uploads are not configured.' }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length < 1) {
    return jsonResponse({ message: 'At least one photo is required.' }, 400);
  }
  if (files.length > CUSTOM_MAX_PHOTOS) {
    return jsonResponse({ message: `You can upload up to ${CUSTOM_MAX_PHOTOS} photos.` }, 400);
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return jsonResponse({ message: 'Only image uploads are supported.' }, 400);
    }
  }

  const now = new Date();
  const datePrefix = now.toISOString().slice(0, 10);
  const imageUrls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const ext = extensionFromContentType(file.type);
    const key = `custom-items/${datePrefix}/${crypto.randomUUID()}-${index + 1}.${ext}`;
    const body = await file.arrayBuffer();
    await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });
    imageUrls.push(buildCustomImageUrl(key));
  }

  const brand = normalizeCustomText(formData.get('brand'), 180);
  const model = normalizeCustomText(formData.get('model'), 180);
  const condition = normalizeCustomText(formData.get('condition'), 180);
  const notes = normalizeCustomText(formData.get('notes'));
  const title = buildCustomListingTitle({ brand, model });
  const description = buildCustomListingDescription({ brand, model, condition, notes });
  const syntheticUrl = `custom-listing://${crypto.randomUUID()}`;
  const fields: Record<string, unknown> = {
    submitted_at: now.toISOString(),
    source: 'Custom',
    url: syntheticUrl,
    status: 'queued',
    title,
    description,
    brand: brand || null,
    model: model || null,
    condition: condition || null,
    notes: notes || null,
    photos: imageUrls.join('\n'),
    image_url: imageUrls[0] ?? null,
    IsMulti: false,
    archived: false,
  };

  const recordId = await dbCreateListing(fields, env);
  if (!recordId) {
    return jsonResponse({ message: 'Unable to queue custom item.' }, 500);
  }

  const listing: ListingData = {
    title,
    price: '',
    location: '',
    condition,
    description,
    images: imageUrls,
    notes,
    brandHint: brand,
    modelHint: model,
  };

  ctx.waitUntil((async () => {
    try {
      await dbUpdateListing(recordId, { status: 'processing' }, env);
      await processCustomListing(recordId, listing, env);
    } catch (error) {
      console.error('Custom listing background processing failed', { recordId, error });
      await dbUpdateListing(recordId, { status: 'failed' }, env);
    }
  })());

  return jsonResponse({ ok: true, recordId, status: 'queued' });
}

async function handleCustomImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Custom item uploads are not configured.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !key.startsWith('custom-items/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return jsonResponse({ message: 'Image not found.' }, 404);
  }

  const body = await object.arrayBuffer();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  const ct = headers.get('content-type') || '';
  if (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const detected = detectContentTypeFromBytes(new Uint8Array(body));
    headers.set('content-type', detected || 'application/octet-stream');
  }
  return new Response(body, { headers });
}

async function handleListingImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !key.startsWith('listing-images/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return jsonResponse({ message: 'Image not found.' }, 404);
  }

  const body = await object.arrayBuffer();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  const ct = headers.get('content-type') || '';
  if (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const detected = detectContentTypeFromBytes(new Uint8Array(body));
    headers.set('content-type', detected || 'application/octet-stream');
  }
  return new Response(body, { headers });
}

async function handleInventoryImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !key.startsWith('inventory-items/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return jsonResponse({ message: 'Image not found.' }, 404);
  }

  const body = await object.arrayBuffer();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  const ct = headers.get('content-type') || '';
  if (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const detected = detectContentTypeFromBytes(new Uint8Array(body));
    headers.set('content-type', detected || 'application/octet-stream');
  }
  return new Response(body, { headers });
}

async function dbIsInventoryImagePublic(imageUrl: string, env: Env): Promise<boolean> {
  try {
    const normalized = normalizeText(imageUrl, '');
    if (!normalized) return false;

    const result = await env.DB.prepare(
      `SELECT
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM ccg_inventory_item_images
             WHERE image_url = ?
           ) THEN CASE
             WHEN EXISTS (
               SELECT 1
               FROM ccg_inventory_item_images
               WHERE image_url = ?
                 AND COALESCE(is_private, 0) = 0
             ) THEN 1
             ELSE 0
           END
           WHEN EXISTS (
             SELECT 1
             FROM ccg_inventory_items
             WHERE image_url = ?
           ) THEN 1
           ELSE 0
         END AS is_public`
    ).bind(normalized, normalized, normalized).first<{ is_public?: number }>();

    return Number(result?.is_public || 0) === 1;
  } catch (error) {
    console.error('Inventory image visibility lookup failed', { error, imageUrl });
    return false;
  }
}

type ApifyRunResult = {
  runId?: string;
  items: any[];
};

async function startApifySearchRun(actorId: string, input: Record<string, unknown>, env: Env): Promise<string | null> {
  const actorPath = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  const response = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${env.APIFY_TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apify search run start failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  const run = data?.data || data;
  return run?.id || null;
}

async function runApifySearch(actorId: string, input: Record<string, unknown>, env: Env): Promise<ApifyRunResult> {
  const actorPath = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  const response = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${env.APIFY_TOKEN}&waitForFinish=120`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apify search run start failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return { items: [] };
  }

  const data = await response.json();
  const run = data?.data || data;
  if (!run?.id) return { items: [] };
  if (run?.status && run.status !== 'SUCCEEDED') {
    const completed = await waitForApifyRun(run.id, env, 3);
    if (completed?.status && completed.status !== 'SUCCEEDED') {
      console.warn('Apify search run not complete', { runId: run.id, status: completed.status });
    }
  }

  const runDetails = await fetchApifyRun(run.id, env);
  const datasetId = runDetails?.defaultDatasetId || run?.defaultDatasetId;
  if (!datasetId) return { runId: run.id, items: [] };
  const items = await fetchApifyDataset(datasetId, env);
  return { runId: run.id, items };
}

async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (env.WEBHOOK_SECRET) {
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid webhook payload.' }, 400);
  }

  const resource = payload.resource || payload.data || payload;
  const runId = resource?.id || payload.runId || payload.runId;
  const eventType = payload.eventType || payload.event || payload.eventType;
  const recordId = normalizeText(url.searchParams.get('recordId'), '');

  if (!runId) {
    return jsonResponse({ message: 'Missing run ID.' }, 400);
  }

  if (recordId) {
    await env.LISTING_JOBS.put(runId, recordId);
  }

  await processRun(runId, resource, eventType, env);
  return jsonResponse({ ok: true });
}

type ListingListItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  score?: number | string;
  saved?: boolean;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inInventory?: boolean;
};

type ListingMapItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  saved?: boolean;
  location?: string;
};

type ReverbItemResponse = {
  id?: number | string;
  title?: string;
  description?: string;
  condition?: { display_name?: string } | string;
  price?: {
    amount?: string | number;
    currency?: string;
    symbol?: string;
  };
  shipping?: {
    amount?: string | number;
  };
  photos?: Array<{
    _links?: {
      large_crop?: { href?: string };
      small_crop?: { href?: string };
      full?: { href?: string };
    };
  }>;
  _links?: {
    web?: { href?: string };
  };
  shop?: {
    location?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country_code?: string;
  } | string;
};

type ReverbSearchListing = ReverbItemResponse;

type ReverbComp = {
  title: string;
  price: number;
  condition: string;
  url: string;
};

type ReverbPricingContext = {
  comps: ReverbComp[];
  baseComps: ReverbComp[];
};

type StripeRuntimeConfig = {
  secretKey: string;
  taxRateId: string;
  useSandbox: boolean;
};

type BrevoRuntimeConfig = {
  apiKey: string;
  templateId: number;
  senderName: string;
  senderEmail: string;
};

type InventoryItemRow = {
  id: number;
  source_listing_id: number | null;
  ccg_number: string;
  image_url: string;
  image_urls: string | null;
  title: string;
  quantity: number | null;
  category_id: number | null;
  category_name: string | null;
  category_path: string | null;
  secondary_category_id: number | null;
  secondary_category_name: string | null;
  secondary_category_path: string | null;
  brand: string | null;
  queue: string | null;
  year_range: string | null;
  model: string | null;
  finish: string | null;
  repair_notes: string | null;
  original_listing_desc: string | null;
  video_url: string | null;
  sale_title: string | null;
  regular_price: number | null;
  sale_price: number | null;
  condition: string | null;
  sale_description: string | null;
  clearance: number | null;
  bullet_1_text: string | null;
  bullet_1_danger: number | null;
  bullet_1_highlight: number | null;
  bullet_2_text: string | null;
  bullet_2_danger: number | null;
  bullet_2_highlight: number | null;
  bullet_3_text: string | null;
  bullet_3_danger: number | null;
  bullet_3_highlight: number | null;
  bullet_4_text: string | null;
  bullet_4_danger: number | null;
  bullet_4_highlight: number | null;
  bullet_5_text: string | null;
  bullet_5_danger: number | null;
  bullet_5_highlight: number | null;
  bullet_6_text: string | null;
  bullet_6_danger: number | null;
  bullet_6_highlight: number | null;
  barcode: string | null;
  purchased_date: string | null;
  purchase_price: number | null;
  private_party_value: number | null;
  miles: number | null;
  minutes_spent: number | null;
  ship_cost: number | null;
  purchase_notes: string | null;
  ai_analysis_text: string | null;
  serial_number: string | null;
  is_active: number | null;
  is_marked: number | null;
  is_personal: number | null;
  is_rented: number | null;
  for_sale: number | null;
  only_in_store: number | null;
  for_sale_date: string | null;
  is_sold: number | null;
  sold_date: string | null;
  sold_amount: number | null;
  sell_notes: string | null;
  subscription_id: number | null;
  package_id: number | null;
  sale_url: string | null;
  sale_zip: string | null;
  storage_location: string | null;
  sold_channel: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type InventorySummaryTotals = {
  totalListed: number;
  totalSold: number;
  totalPurchased: number;
  ccgPaidUnsold: number;
  ccgPrivatePartyUnsold: number;
  ccgSoldPaid: number;
  ccgSoldPrivateParty: number;
  ccgSoldProfitMarginPercent: number;
  ccgActiveItems: number;
  ccgNotForSaleItems: number;
  ccgForSaleItems: number;
  ccgSoldItems: number;
};

type AdminV2DashboardSummary = {
  inventoryCostBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
  realizedProfitMTD: number;
  soldMargin30DayPercent: number;
  soldMargin60DayPercent: number;
  soldMargin90DayPercent: number;
  postStoreLaunchMarginPercent: number;
  forSaleItems: number;
  avgDaysToSell: number;
  activeItems: number;
  notForSaleItems: number;
  soldItems: number;
  allTimeSoldMarginPercent: number;
};

type AdminV2ProfitTrendPoint = {
  month: string;
  label: string;
  soldCount: number;
  revenue: number;
  cost: number;
  profit: number;
};

type AdminV2InventoryAgingBucket = {
  key: string;
  label: string;
  itemCount: number;
  costBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
};

type AdminV2InventoryCategoryBucket = {
  category: string;
  itemCount: number;
};

type AdminV2RecentSaleRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  category: string | null;
  brand: string | null;
  soldDate: string | null;
  purchasePrice: number;
  soldAmount: number;
  profitAmount: number;
  daysHeld: number | null;
};

type AdminV2OldestInventoryRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  category: string | null;
  brand: string | null;
  purchasedDate: string | null;
  daysHeld: number | null;
  purchasePrice: number;
  privatePartyValue: number;
  currentAskingValue: number;
  forSale: boolean;
  source: string | null;
};

type InventoryCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
};

type InventoryCategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: InventoryCategoryNode[];
};

type ShopProductRow = {
  id: number;
  ccg_number?: string | null;
  image_url: string | null;
  image_urls?: string | null;
  title: string | null;
  sale_title: string | null;
  sale_url: string | null;
  sale_zip?: string | null;
  brand?: string | null;
  model?: string | null;
  finish?: string | null;
  regular_price: number | null;
  sale_price: number | null;
  clearance?: number | null;
  condition: string | null;
  sale_description?: string | null;
  bullet_1_text?: string | null;
  bullet_1_danger?: number | null;
  bullet_1_highlight?: number | null;
  bullet_2_text?: string | null;
  bullet_2_danger?: number | null;
  bullet_2_highlight?: number | null;
  bullet_3_text?: string | null;
  bullet_3_danger?: number | null;
  bullet_3_highlight?: number | null;
  bullet_4_text?: string | null;
  bullet_4_danger?: number | null;
  bullet_4_highlight?: number | null;
  bullet_5_text?: string | null;
  bullet_5_danger?: number | null;
  bullet_5_highlight?: number | null;
  bullet_6_text?: string | null;
  bullet_6_danger?: number | null;
  bullet_6_highlight?: number | null;
  barcode?: string | null;
  category_id: number | null;
  category_name: string | null;
  category_path: string | null;
  secondary_category_id: number | null;
  secondary_category_name: string | null;
  secondary_category_path: string | null;
  weight_lbs?: string | null;
  neck_profile?: string | null;
  neck_thickness?: string | null;
  nut_width?: string | null;
  width_12_fret?: string | null;
  fretboard_radius?: string | null;
  twelve_fret_action?: string | null;
  for_sale?: number | null;
  only_in_store?: number | null;
  is_sold: number | null;
};

type InventoryItemImageRow = {
  id: number;
  inventory_item_id: number;
  image_url: string;
  display_order: number;
  is_private: number;
};

type InventoryImageInput = {
  url: string;
  isPrivate: boolean;
};

type AdminV2SerialDecodeRow = {
  id: number;
  eventTimeUtc: string | null;
  clientTimestamp: string | null;
  brand: string;
  serial: string;
  patternLookupId: number | null;
  success: boolean;
  evaluated: boolean;
  year: string | null;
  factory: string | null;
  country: string | null;
  error: string | null;
};

type AdminV2SerialDecodeBrandResponseRow = {
  brand: string;
  responseCount: number;
};

type AdminV2SerialLookupVolumeView = 'day' | 'month';

type AdminV2SerialLookupVolumeBucket = {
  key: string;
  label: string;
  responseCount: number;
};

type AdminV2SerialPatternLookupSortBy = 'brand' | 'pattern' | 'populated';

type AdminV2SerialPatternLookupRow = {
  id: number;
  brand: string;
  pattern: string;
  regexPattern: string;
  richText: string;
  richTextPopulated: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset') || undefined;
  const showSaved = url.searchParams.get('showSaved') === '1';
  const showArchived = url.searchParams.get('showArchived') === '1';
  const titleSearch = normalizeText(url.searchParams.get('titleSearch'), '').trim();
  const archiveReason = normalizeText(url.searchParams.get('archiveReason'), '').trim();

  let limit = DEFAULT_PAGE_SIZE;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_PAGE_SIZE);
    }
  }

  const mode: 'default' | 'saved' | 'archived' = showSaved ? 'saved' : (showArchived ? 'archived' : 'default');
  const data = await dbListListings(limit, offset, mode, titleSearch, archiveReason, env);
  if (!data) {
    return jsonResponse({ message: 'Unable to fetch listings.' }, 500);
  }

  return jsonResponse(data);
}

async function handleMapListings(env: Env): Promise<Response> {
  const data = await dbListListingsForMap(env);
  if (!data) {
    return jsonResponse({ message: 'Unable to fetch map listings.' }, 500);
  }
  return jsonResponse(data);
}

async function handleMapsConfig(env: Env): Promise<Response> {
  const apiKey = typeof env.GOOGLE_MAPS_API_KEY === 'string'
    ? env.GOOGLE_MAPS_API_KEY.trim()
    : '';
  return jsonResponse({
    hasApiKey: Boolean(apiKey),
    apiKey: apiKey || null,
  });
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parseOptionalPositiveInt(value);
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleInventoryList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const categoryId = parseOptionalPositiveInt(url.searchParams.get('categoryId'));
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const queue = normalizeInventoryQueue(url.searchParams.get('queue'));
  const sold = parseInventoryTriState(url.searchParams.get('sold'), 'no');
  const active = parseInventoryTriState(url.searchParams.get('active'), 'yes');
  const marked = parseInventoryTriState(url.searchParams.get('marked') ?? url.searchParams.get('onlyMarked'), 'all');
  const personal = parseInventoryTriState(url.searchParams.get('personal') ?? url.searchParams.get('onlyPersonal'), 'all');
  const sortBy = parseInventorySortKey(url.searchParams.get('sortBy'));
  const sortDir = parseInventorySortDir(url.searchParams.get('sortDir'));

  const availableBrands = await dbListInventoryBrands({ categoryId, sold, active, marked, personal, queue }, env);

  const result = await dbListInventoryItems({
    categoryId,
    brand,
    queue,
    sold,
    active,
    marked,
    personal,
    page,
    limit,
    sortBy,
    sortDir,
  }, env);

  return jsonResponse({
    records: result.records,
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    availableBrands,
  });
}

async function handleInventorySummary(env: Env): Promise<Response> {
  const totals = await dbGetInventorySummary(env);
  return jsonResponse(totals);
}

async function handleAdminV2InventoryCategories(env: Env): Promise<Response> {
  const records = await dbListInventoryCategories(env);
  return jsonResponse({
    records,
    tree: buildInventoryCategoryTree(records),
  });
}

async function handleAdminV2InventoryCategoryCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const name = normalizeText(body.name, '').slice(0, 120);
  const parentId = parseOptionalPositiveInt(body.parentId);
  const orderValue = parseBoundedInt(body.order, 0, -100000, 100000);

  if (!name) return jsonResponse({ message: 'Category name is required.' }, 400);
  if (parentId != null && !(await dbInventoryCategoryExists(parentId, env))) {
    return jsonResponse({ message: 'Parent category does not exist.' }, 400);
  }

  const created = await dbCreateInventoryCategory({ name, parent_id: parentId, order: orderValue }, env);
  if (!created) return jsonResponse({ message: 'Unable to create category.' }, 500);
  return jsonResponse({ ok: true, record: created });
}

async function handleAdminV2InventoryCategoryUpdate(request: Request, path: string, env: Env): Promise<Response> {
  const categoryId = parseAdminV2InventoryCategoryId(path);
  if (categoryId == null) return jsonResponse({ message: 'Missing category ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const name = normalizeText(body.name, '').slice(0, 120);
  const parentId = parseOptionalPositiveInt(body.parentId);
  const orderValue = parseBoundedInt(body.order, 0, -100000, 100000);

  if (!name) return jsonResponse({ message: 'Category name is required.' }, 400);
  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category not found.' }, 404);
  }
  if (parentId === categoryId) {
    return jsonResponse({ message: 'A category cannot be its own parent.' }, 400);
  }
  if (parentId != null) {
    if (!(await dbInventoryCategoryExists(parentId, env))) {
      return jsonResponse({ message: 'Parent category does not exist.' }, 400);
    }
    if (await dbInventoryCategoryParentWouldCreateCycle(categoryId, parentId, env)) {
      return jsonResponse({ message: 'Parent category cannot be one of this category’s descendants.' }, 400);
    }
  }

  const updated = await dbUpdateInventoryCategory(categoryId, { name, parent_id: parentId, order: orderValue }, env);
  if (!updated) return jsonResponse({ message: 'Unable to update category.' }, 500);
  return jsonResponse({ ok: true });
}

async function handleAdminV2InventoryCategoryDelete(path: string, env: Env): Promise<Response> {
  const categoryId = parseAdminV2InventoryCategoryId(path);
  if (categoryId == null) return jsonResponse({ message: 'Missing category ID.' }, 400);

  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category not found.' }, 404);
  }

  const childCount = await dbCountInventoryCategoryChildren(categoryId, env);
  if (childCount > 0) {
    return jsonResponse({
      message: `Cannot delete this category because ${childCount} child categor${childCount === 1 ? 'y uses' : 'ies use'} it. Delete or move children first.`,
      childCount,
    }, 400);
  }

  const itemCount = await dbCountInventoryItemsForCategory(categoryId, env);
  if (itemCount > 0) {
    return jsonResponse({
      message: `Cannot delete this category because ${itemCount} inventory item${itemCount === 1 ? ' uses' : 's use'} it. Move those items first.`,
      itemCount,
    }, 400);
  }

  const deleted = await dbDeleteInventoryCategory(categoryId, env);
  if (deleted < 1) return jsonResponse({ message: 'Category not found.' }, 404);
  return jsonResponse({ ok: true, deletedCount: deleted });
}

async function handleAdminV2InventorySubscriptions(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, name, email, date_subscribed, date_cancelled
     FROM ccg_inventory_subscriptions
     ORDER BY date_subscribed DESC`
  ).all<{ id: number; name: string; email: string; date_subscribed: string | null; date_cancelled: string | null }>();
  const records = (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    dateSubscribed: row.date_subscribed,
    dateCancelled: row.date_cancelled,
  }));
  return jsonResponse({ records });
}

async function handleAdminV2Orders(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const orderColumns = await dbGetTableColumns('orders', env);
  const orderColumnNames = new Set(orderColumns.map((column) => column.name));
  if (!orderColumnNames.has('id')) return jsonResponse({ records: [] });

  const dateColumn = ['paid_at', 'checkout_started_at', 'created_at']
    .find((columnName) => orderColumnNames.has(columnName)) || 'id';
  const result = await env.DB.prepare(
    `SELECT *
     FROM orders
     ORDER BY ${dateColumn} DESC
     LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>();

  const records = result.results ?? [];
  const itemCounts = await dbCountOrderItems(records.map((row) => normalizeText(row.id, '')).filter(Boolean), env);
  const enriched = await Promise.all(records.map(async (row) => {
    const stripeCustomer = await resolveOrderStripeCustomer(row, env);
    const orderId = normalizeText(row.id, '');
    return mapAdminOrderSummary(row, itemCounts.get(orderId) || 0, stripeCustomer);
  }));

  return jsonResponse({ records: enriched });
}

async function handleAdminV2PaymentLinks(request: Request, env: Env): Promise<Response> {
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe secret key is not configured.' }, 503);
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 100);

  try {
    const records = await listStripePaymentLinks(stripeConfig.secretKey, limit);
    return jsonResponse({ records });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to load Stripe payment links.',
    }, 502);
  }
}

async function handleAdminV2StripeConfig(env: Env): Promise<Response> {
  const config = await getStripeRuntimeConfig(env);
  return jsonResponse({
    useStripeSandbox: config.useSandbox,
    hasSecretKey: Boolean(config.secretKey),
    hasTaxRateId: Boolean(config.taxRateId),
  });
}

async function handleAdminV2StripeConfigUpdate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const useStripeSandbox = toBooleanInput(body.useStripeSandbox, true);
  try {
    await dbSetStripeSandboxMode(useStripeSandbox, env);
    const config = await getStripeRuntimeConfig(env);
    return jsonResponse({
      ok: true,
      useStripeSandbox: config.useSandbox,
      hasSecretKey: Boolean(config.secretKey),
      hasTaxRateId: Boolean(config.taxRateId),
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to update Stripe environment.',
    }, 500);
  }
}

async function handleAdminV2OrderConfirmationEmailTest(env: Env): Promise<Response> {
  const config = await getBrevoRuntimeConfig(env);
  if (!config.apiKey) {
    return jsonResponse({ message: 'Brevo API key is not configured in sys_info.' }, 503);
  }
  if (!config.senderEmail) {
    return jsonResponse({ message: 'Brevo sender email is not configured in sys_info.' }, 503);
  }

  try {
    const result = await sendBrevoOrderConfirmationTestEmail(config);
    return jsonResponse({
      ok: true,
      message: 'Brevo test order confirmation email sent.',
      result,
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to send Brevo test email.',
    }, 502);
  }
}

async function handleAdminV2PaymentLinkMarkedItems(env: Env): Promise<Response> {
  const records = await dbListMarkedInventoryRowsForPaymentLinks(env);
  return jsonResponse({
    records: records.map(mapPaymentLinkMarkedInventoryRow),
    maxItems: 20,
  });
}

async function handleAdminV2PaymentLinkCreate(request: Request, env: Env): Promise<Response> {
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe secret key is not configured.' }, 503);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const includeSalesTax = toBooleanInput(body.includeSalesTax, true);
  const markedRows = await dbListMarkedInventoryRowsForPaymentLinks(env);
  if (markedRows.length < 1) {
    return jsonResponse({ message: 'No marked inventory items exist.' }, 400);
  }

  const quantitySelections = parsePaymentLinkQuantitySelections(body.items);
  const hasExplicitQuantitySelections = quantitySelections.size > 0 || Array.isArray(body.items);
  const selectedRows = markedRows
    .map((row) => {
      const availableQuantity = Math.max(0, Number(row.quantity ?? 1) || 0);
      const requestedQuantity = hasExplicitQuantitySelections
        ? quantitySelections.get(Number(row.id)) ?? 0
        : Math.min(1, availableQuantity);
      return {
        row,
        availableQuantity,
        requestedQuantity,
      };
    })
    .filter((selection) => selection.requestedQuantity > 0);

  if (selectedRows.length < 1) {
    return jsonResponse({ message: 'Select at least one marked inventory item.' }, 400);
  }
  if (selectedRows.length > 20) {
    return jsonResponse({ message: 'Stripe payment links support up to 20 line items. Unmark items and try again.' }, 400);
  }

  const quantityError = selectedRows.find((selection) => selection.requestedQuantity > selection.availableQuantity);
  if (quantityError) {
    return jsonResponse({
      message: `${getInventoryPaymentLinkTitle(quantityError.row)} only has ${quantityError.availableQuantity} available.`,
    }, 400);
  }

  const items = selectedRows.map(({ row, requestedQuantity }) => {
    const unitAmountCents = getInventoryPaymentLinkPriceCents(row);
    return {
      inventoryItemId: row.id,
      ccgNumber: normalizeText(row.ccg_number, ''),
      title: getInventoryPaymentLinkTitle(row),
      description: normalizeText(row.sale_description || row.original_listing_desc || '', '').slice(0, 500),
      quantity: requestedQuantity,
      unitAmountCents,
      imageUrl: toPublicShopImageUrl(row.image_url, 'thumb'),
    };
  });
  const invalidItem = items.find((item) => item.unitAmountCents < 1);
  if (invalidItem) {
    return jsonResponse({ message: `${invalidItem.title} is missing a usable sale or regular price.` }, 400);
  }

  const taxRateId = includeSalesTax ? stripeConfig.taxRateId : '';
  if (includeSalesTax && !taxRateId) {
    return jsonResponse({ message: 'Colorado sales tax rate is not configured.' }, 503);
  }

  try {
    const paymentLink = await createStripePaymentLinkFromInventory({
      stripeSecretKey: stripeConfig.secretKey,
      items,
      includeSalesTax,
      taxRateId,
    });
    const records = await listStripePaymentLinks(stripeConfig.secretKey, 100);
    return jsonResponse({
      ok: true,
      record: paymentLink,
      records,
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to create Stripe payment link.',
    }, 502);
  }
}

async function handleAdminV2PaymentLinkDeactivate(paymentLinkId: string, env: Env): Promise<Response> {
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe secret key is not configured.' }, 503);
  }

  const id = normalizeText(paymentLinkId, '').slice(0, 100);
  if (!id) return jsonResponse({ message: 'Missing payment link id.' }, 400);

  try {
    await deactivateStripePaymentLink(stripeConfig.secretKey, id);
    const records = await listStripePaymentLinks(stripeConfig.secretKey, 100);
    return jsonResponse({ ok: true, records });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to deactivate Stripe payment link.',
    }, 502);
  }
}

async function handleAdminV2OrderDetail(orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await dbGetOrderReceipt(normalizedOrderId, env);
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const rawOrder = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
  const stripeCustomer = rawOrder ? await resolveOrderStripeCustomer(rawOrder, env) : null;
  const events = await dbListOrderEvents(normalizedOrderId, env);
  const provider = normalizeText(order.checkoutProvider, '') || (normalizeText(rawOrder?.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const paymentMethodLabel = provider === 'cash'
    ? 'Cash'
    : await resolveStripePaymentMethodLabel(normalizeText(order.stripePaymentIntentId, ''), env);

  return jsonResponse({
    record: {
      ...order,
      paymentMethodLabel,
      customer: buildAdminOrderCustomer(rawOrder || {}, stripeCustomer),
      events,
    },
  });
}

async function handleAdminV2OrderRefund(orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const status = normalizeText(order.status, '');
  if (status !== 'paid') {
    return jsonResponse({ message: 'Only paid orders can be refunded.' }, 409);
  }

  const provider = normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const totalCents = Number(order.total_cents ?? 0) || 0;
  const now = new Date().toISOString();
  let stripeRefundId = '';

  if (provider !== 'cash') {
    const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
    if (!paymentIntentId) {
      return jsonResponse({ message: 'Stripe payment intent is missing for this order.' }, 400);
    }
    const stripeRefund = await createStripeFullRefund(paymentIntentId, normalizedOrderId, env);
    if (!stripeRefund.ok) {
      await dbRecordOrderEvent(normalizedOrderId, {
        eventType: 'refund_failed',
        fromStatus: 'paid',
        toStatus: 'paid',
        source: 'admin_v2',
        sourceId: paymentIntentId,
        message: stripeRefund.message,
        payloadJson: JSON.stringify({ provider, paymentIntentId, status: stripeRefund.status }),
      }, env);
      return jsonResponse({ message: stripeRefund.message }, stripeRefund.status || 502);
    }
    stripeRefundId = stripeRefund.refundId;
  }

  await dbUnwindRefundedOrderInventory(normalizedOrderId, order, env);

  await dbUpdateTableById('orders', normalizedOrderId, {
    status: 'refunded',
    refunded_at: now,
    cancelled_at: now,
    stripe_payment_status: provider === 'cash' ? 'not_applicable' : 'refunded',
    stripe_refund_id: stripeRefundId,
    updated_at: now,
  }, env);

  await dbRecordOrderEvent(normalizedOrderId, {
    eventType: 'refund_succeeded',
    fromStatus: 'paid',
    toStatus: 'refunded',
    source: 'admin_v2',
    sourceId: stripeRefundId || provider,
    message: provider === 'cash'
      ? 'Cash order refunded. Inventory was restored.'
      : 'Stripe order refunded. Inventory was restored.',
    payloadJson: JSON.stringify({ provider, totalCents, stripeRefundId }),
  }, env);

  return jsonResponse({
    message: provider === 'cash' ? 'Cash order refunded.' : 'Stripe order refunded.',
    provider,
    stripeRefundId,
  });
}

async function createStripeFullRefund(
  paymentIntentId: string,
  orderId: string,
  env: Env,
): Promise<{ ok: true; refundId: string } | { ok: false; message: string; status: number }> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) return { ok: false, message: 'Stripe secret key is not configured.', status: 500 };

  try {
    const body = new URLSearchParams({ payment_intent: paymentIntentId });
    const response = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ccg-order-refund-${orderId}`,
      },
      body,
    });
    const data = await response.json<any>();
    if (!response.ok) {
      return {
        ok: false,
        message: normalizeText(data?.error?.message, 'Stripe refund failed.'),
        status: response.status || 502,
      };
    }
    return { ok: true, refundId: normalizeText(data?.id, '') };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Stripe refund failed.',
      status: 502,
    };
  }
}

async function getStripeRuntimeConfig(env: Env): Promise<StripeRuntimeConfig> {
  const fallback: StripeRuntimeConfig = {
    secretKey: normalizeText(env.STRIPE_SECRET_KEY, ''),
    taxRateId: normalizeText(env.STRIPE_CO_SALES_TAX_RATE_ID, DEFAULT_CO_SALES_TAX_RATE_ID),
    useSandbox: true,
  };

  try {
    const columns = await dbGetTableColumns('sys_info', env);
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has('use_stripe_sandbox')) return fallback;

    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return fallback;

    const useSandbox = parseSysInfoBoolean(row.use_stripe_sandbox, fallback.useSandbox);
    const secretKey = useSandbox
      ? normalizeText(row.stripe_secret_key_sandbox, fallback.secretKey)
      : normalizeText(row.stripe_secret_key, fallback.secretKey);
    const taxRateId = useSandbox
      ? normalizeText(row.string_tax_id_sandbox, fallback.taxRateId)
      : normalizeText(row.stripe_tax_id, fallback.taxRateId);

    return {
      secretKey,
      taxRateId,
      useSandbox,
    };
  } catch (error) {
    console.warn('Stripe sys_info lookup failed; using environment fallback.', { error });
    return fallback;
  }
}

async function getBrevoRuntimeConfig(env: Env): Promise<BrevoRuntimeConfig> {
  const fallback: BrevoRuntimeConfig = {
    apiKey: '',
    templateId: 3,
    senderName: 'Coal Creek Guitars',
    senderEmail: '',
  };

  try {
    const columns = await dbGetTableColumns('sys_info', env);
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has('brevo_api_key')) return fallback;

    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return fallback;

    const templateId = Number(row.brevo_order_confirmation_template_id ?? fallback.templateId);
    return {
      apiKey: normalizeText(row.brevo_api_key, ''),
      templateId: Number.isFinite(templateId) && templateId > 0 ? Math.floor(templateId) : fallback.templateId,
      senderName: normalizeText(row.brevo_sender_name, fallback.senderName),
      senderEmail: normalizeEmailAddress(row.brevo_sender_email),
    };
  } catch (error) {
    console.warn('Brevo sys_info lookup failed.', { error });
    return fallback;
  }
}

async function sendBrevoOrderConfirmationTestEmail(
  config: BrevoRuntimeConfig,
): Promise<Record<string, unknown>> {
  const payload = {
    sender: {
      name: config.senderName,
      email: config.senderEmail,
    },
    to: [
      {
        email: 'davidhopper55@gmail.com',
        name: 'John Doe',
      },
    ],
    templateId: config.templateId,
    contact: {
      ORDER_NUMBER: 'CCG-TEST-1001',
      ORDER_DATE: '2026-05-06',
      FIRST_NAME: 'John',
    },
    params: {
      ORDER_DATE: '2026-05-01',
      ORDER_NUMBER: 'CCG-TEST-1001',
      FIRSTNAME: 'John',
      FIRST_NAME: 'John',
      discount: '$20.00',
      subtotal: '$249.99',
      tax: '$18.75',
      total: '$248.74',
      items: [
        {
          name: 'Acoustic Guitar',
          category: 'Musical Instruments',
          sku: 'GTR-001',
          price: '199.99',
          quantity: 1,
          image: 'https://example.com/images/guitar.jpg',
        },
        {
          name: 'Guitar Strings Pack',
          category: 'Accessories',
          sku: 'STR-123',
          price: '9.99',
          quantity: 2,
          image: 'https://example.com/images/strings.jpg',
        },
      ],
    },
    headers: {
      'X-Mailin-custom': 'order-confirmation',
    },
  };

  return sendBrevoTransactionalEmail(config, payload);
}

async function sendBrevoTransactionalEmail(
  config: BrevoRuntimeConfig,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json<Record<string, unknown>>().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeText(
      (data as any)?.message ?? (data as any)?.error ?? '',
      `Brevo rejected the email request with status ${response.status}.`,
    ));
  }
  return data;
}

async function sendBrevoOrderConfirmationEmailForOrder(orderId: string, env: Env): Promise<void> {
  try {
    const config = await getBrevoRuntimeConfig(env);
    if (!config.apiKey || !config.senderEmail) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'order_confirmation_email_skipped',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Order confirmation email skipped because Brevo is not configured.',
        payloadJson: JSON.stringify({
          hasApiKey: Boolean(config.apiKey),
          hasSenderEmail: Boolean(config.senderEmail),
        }),
      }, env);
      return;
    }

    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
      .bind(orderId)
      .first<Record<string, unknown>>();
    const receipt = await dbGetOrderReceipt(orderId, env);
    if (!order || !receipt) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'order_confirmation_email_skipped',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Order confirmation email skipped because order data was not found.',
        payloadJson: '{}',
      }, env);
      return;
    }

    const customerEmail = normalizeEmailAddress(
      order.customer_email ?? order.stripe_customer_email ?? order.email,
    );
    if (!customerEmail) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'order_confirmation_email_skipped',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Order confirmation email skipped because customer email is missing.',
        payloadJson: '{}',
      }, env);
      return;
    }

    const customerName = normalizeText(
      order.customer_name ?? order.stripe_customer_name ?? order.billing_name ?? '',
      '',
    );
    const firstName = customerName.split(/\s+/).filter(Boolean)[0] || 'there';
    const orderNumber = normalizeText(receipt.orderNumber, normalizeText(order.order_number, orderId));
    const orderDate = formatBrevoOrderDate(
      normalizeText(receipt.paidAt, '') ||
      normalizeText(order.paid_at ?? order.updated_at ?? order.created_at, ''),
    );
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const payload = {
      sender: {
        name: config.senderName,
        email: config.senderEmail,
      },
      to: [
        {
          email: customerEmail,
          name: customerName || customerEmail,
        },
      ],
      templateId: config.templateId,
      params: {
        ORDER_NUMBER: orderNumber,
        ORDER_DATE: orderDate,
        FIRSTNAME: firstName,
        FIRST_NAME: firstName,
        discount: formatCurrencyCents(numberOrZero(receipt.discountCents)),
        subtotal: formatCurrencyCents(numberOrZero(receipt.subtotalCents)),
        tax: formatCurrencyCents(numberOrZero(receipt.taxCents)),
        total: formatCurrencyCents(numberOrZero(receipt.totalCents)),
        items: items.map((item: any) => {
          const quantity = Math.max(1, Number(item.quantity || 1));
          const lineSubtotalCents = numberOrZero(item.subtotalCents);
          const unitAmountCents = quantity > 0 ? Math.round(lineSubtotalCents / quantity) : lineSubtotalCents;
          return {
            name: normalizeText(item.title, 'Item'),
            category: 'Musical Instruments',
            sku: normalizeText(item.ccgNumber, ''),
            price: formatPlainDollarAmount(unitAmountCents),
            quantity,
            image: normalizeText(item.imageUrl, ''),
          };
        }),
      },
      headers: {
        'X-Mailin-custom': `order-confirmation|order:${orderNumber}`,
      },
    };

    const result = await sendBrevoTransactionalEmail(config, payload);
    await dbRecordOrderEvent(orderId, {
      eventType: 'order_confirmation_email_sent',
      fromStatus: null,
      toStatus: 'paid',
      source: 'brevo',
      sourceId: normalizeText((result as any)?.messageId, ''),
      message: 'Order confirmation email sent to customer.',
      payloadJson: JSON.stringify({
        customerEmail,
        orderNumber,
        result,
      }),
    }, env);
  } catch (error) {
    console.warn('Order confirmation email failed', { orderId, error });
    await dbRecordOrderEvent(orderId, {
      eventType: 'order_confirmation_email_failed',
      fromStatus: null,
      toStatus: 'paid',
      source: 'brevo',
      sourceId: '',
      message: error instanceof Error ? error.message : 'Unable to send order confirmation email.',
      payloadJson: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    }, env);
  }
}

function formatBrevoOrderDate(value: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || new Date().toISOString().slice(0, 10);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Denver',
  });
}

function formatPlainDollarAmount(cents: number): string {
  return (numberOrZero(cents) / 100).toFixed(2);
}

async function getStripeRuntimeConfigForLivemode(
  livemode: boolean,
  env: Env,
): Promise<StripeRuntimeConfig> {
  const fallback = await getStripeRuntimeConfig(env);
  const useSandbox = !livemode;

  try {
    const columns = await dbGetTableColumns('sys_info', env);
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has('use_stripe_sandbox')) return { ...fallback, useSandbox };

    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return { ...fallback, useSandbox };

    const secretKey = useSandbox
      ? normalizeText(row.stripe_secret_key_sandbox, fallback.secretKey)
      : normalizeText(row.stripe_secret_key, fallback.secretKey);
    const taxRateId = useSandbox
      ? normalizeText(row.string_tax_id_sandbox, fallback.taxRateId)
      : normalizeText(row.stripe_tax_id, fallback.taxRateId);

    return {
      secretKey,
      taxRateId,
      useSandbox,
    };
  } catch (error) {
    console.warn('Stripe sys_info livemode lookup failed; using current Stripe fallback.', { livemode, error });
    return { ...fallback, useSandbox };
  }
}

function parseSysInfoBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeText(value, '').toLowerCase();
  if (['1', 'true', 'yes', 'y', 'sandbox'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'prod', 'production'].includes(normalized)) return false;
  return fallback;
}

async function dbSetStripeSandboxMode(useSandbox: boolean, env: Env): Promise<void> {
  const columns = await dbGetTableColumns('sys_info', env);
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has('use_stripe_sandbox')) {
    throw new Error('D1 table sys_info is missing use_stripe_sandbox.');
  }

  await env.DB.prepare(
    `INSERT INTO sys_info (id, use_stripe_sandbox)
     VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET
       use_stripe_sandbox = excluded.use_stripe_sandbox,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(useSandbox ? 1 : 0).run();
}

async function listStripePaymentLinks(
  stripeSecretKey: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  const response = await fetch(`https://api.stripe.com/v1/payment_links?${params.toString()}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the payment links request.'));
  }

  const paymentLinks = Array.isArray(data?.data) ? data.data : [];
  return Promise.all(paymentLinks.map(async (paymentLink) => {
    const lineItems = await listStripePaymentLinkLineItems(stripeSecretKey, normalizeText(paymentLink?.id, ''));
    return mapStripePaymentLink(paymentLink, lineItems);
  }));
}

async function listStripePaymentLinkLineItems(
  stripeSecretKey: string,
  paymentLinkId: string,
): Promise<any[]> {
  if (!paymentLinkId) return [];
  const params = new URLSearchParams();
  params.set('limit', '100');
  params.append('expand[]', 'data.price.product');
  const response = await fetch(
    `https://api.stripe.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}/line_items?${params.toString()}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );
  const data = await response.json<any>();
  if (!response.ok) {
    console.warn('Stripe payment link line items lookup failed', {
      paymentLinkId,
      message: normalizeText(data?.error?.message, ''),
    });
    return [];
  }
  return Array.isArray(data?.data) ? data.data : [];
}

async function deactivateStripePaymentLink(stripeSecretKey: string, paymentLinkId: string): Promise<void> {
  const form = new URLSearchParams();
  form.set('active', 'false');
  const response = await fetch(`https://api.stripe.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the deactivate request.'));
  }
}

async function createStripePaymentLinkFromInventory(input: {
  stripeSecretKey: string;
  items: Array<{
    inventoryItemId: number;
    ccgNumber: string;
    title: string;
    description: string;
    quantity: number;
    unitAmountCents: number;
    imageUrl: string;
  }>;
  includeSalesTax: boolean;
  taxRateId: string;
}): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  form.set('metadata[source]', 'admin_v2_marked_inventory');
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[include_sales_tax]', input.includeSalesTax ? '1' : '0');
  if (input.taxRateId) form.set('metadata[tax_rate_id]', input.taxRateId);

  const priceIds: string[] = [];
  for (const item of input.items) {
    priceIds.push(await createStripeProductPriceForInventoryItem(input.stripeSecretKey, item));
  }

  input.items.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    form.set(`${prefix}[quantity]`, String(item.quantity));
    form.set(`${prefix}[price]`, priceIds[index]);
    if (input.includeSalesTax && input.taxRateId) {
      form.set(`${prefix}[tax_rates][0]`, input.taxRateId);
    }
  });

  const response = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    const message = normalizeText(data?.error?.message, 'Stripe rejected the payment link request.');
    if (input.includeSalesTax && /tax_rates/i.test(message) && /unknown parameter/i.test(message)) {
      return createStripePaymentLinkWithTaxLineItem(input, priceIds);
    }
    throw new Error(message);
  }
  return mapStripePaymentLink(data, []);
}

async function createStripePaymentLinkWithTaxLineItem(
  input: {
    stripeSecretKey: string;
    items: Array<{
      inventoryItemId: number;
      ccgNumber: string;
      title: string;
      description: string;
      quantity: number;
      unitAmountCents: number;
      imageUrl: string;
    }>;
    includeSalesTax: boolean;
    taxRateId: string;
  },
  priceIds: string[],
): Promise<Record<string, unknown>> {
  const subtotalCents = input.items.reduce(
    (sum, item) => sum + item.unitAmountCents * Math.max(1, item.quantity),
    0,
  );
  const taxCents = Math.round(subtotalCents * 0.0805);
  const taxPriceId = taxCents > 0
    ? await createStripeProductPriceForInventoryItem(input.stripeSecretKey, {
      inventoryItemId: 0,
      ccgNumber: '',
      title: 'CO Sales Tax (8.05%)',
      description: `8.05% Colorado sales tax for marked inventory payment link. Tax rate id: ${input.taxRateId}`,
      unitAmountCents: taxCents,
      imageUrl: '',
    })
    : '';

  const form = new URLSearchParams();
  form.set('metadata[source]', 'admin_v2_marked_inventory');
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[include_sales_tax]', '1');
  form.set('metadata[tax_rate_id]', input.taxRateId);
  form.set('metadata[tax_fallback]', 'line_item');

  input.items.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    form.set(`${prefix}[quantity]`, String(item.quantity));
    form.set(`${prefix}[price]`, priceIds[index]);
  });

  if (taxPriceId) {
    const prefix = `line_items[${input.items.length}]`;
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price]`, taxPriceId);
  }

  const response = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the payment link request.'));
  }
  return mapStripePaymentLink(data, []);
}

async function createStripeProductPriceForInventoryItem(
  stripeSecretKey: string,
  item: {
    inventoryItemId: number;
    ccgNumber: string;
    title: string;
    description: string;
    unitAmountCents: number;
    imageUrl: string;
  },
): Promise<string> {
  const productForm = new URLSearchParams();
  productForm.set('name', item.title);
  productForm.set('metadata[inventory_item_id]', String(item.inventoryItemId));
  productForm.set('metadata[source]', 'admin_v2_payment_link');
  if (item.ccgNumber) productForm.set('metadata[ccg_number]', item.ccgNumber);
  if (item.description) productForm.set('description', item.description);
  if (item.imageUrl) productForm.set('images[0]', item.imageUrl);

  const productResponse = await fetch('https://api.stripe.com/v1/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: productForm,
  });
  const productData = await productResponse.json<any>();
  if (!productResponse.ok) {
    throw new Error(normalizeText(productData?.error?.message, 'Stripe rejected the product request.'));
  }
  const productId = normalizeText(productData?.id, '');
  if (!productId) throw new Error('Stripe did not return a product id.');

  const priceForm = new URLSearchParams();
  priceForm.set('currency', 'usd');
  priceForm.set('unit_amount', String(item.unitAmountCents));
  priceForm.set('product', productId);
  priceForm.set('tax_behavior', 'exclusive');
  priceForm.set('metadata[inventory_item_id]', String(item.inventoryItemId));
  priceForm.set('metadata[source]', 'admin_v2_payment_link');
  if (item.ccgNumber) priceForm.set('metadata[ccg_number]', item.ccgNumber);

  const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: priceForm,
  });
  const priceData = await priceResponse.json<any>();
  if (!priceResponse.ok) {
    throw new Error(normalizeText(priceData?.error?.message, 'Stripe rejected the price request.'));
  }
  const priceId = normalizeText(priceData?.id, '');
  if (!priceId) throw new Error('Stripe did not return a price id.');
  return priceId;
}

function mapStripePaymentLink(paymentLink: any, lineItems: any[]): Record<string, unknown> {
  const firstLineItem = lineItems[0] || {};
  const firstProduct = firstLineItem?.price?.product;
  const firstPrice = firstLineItem?.price;
  const name = normalizeText(
    firstLineItem.description
      ?? paymentLink?.metadata?.name
      ?? (typeof firstProduct === 'object' ? firstProduct?.name : '')
      ?? paymentLink?.id,
    '',
  );
  const created = Number(
    paymentLink?.created
      ?? paymentLink?.metadata?.created
      ?? paymentLink?.metadata?.created_at
      ?? firstPrice?.created
      ?? (typeof firstProduct === 'object' ? firstProduct?.created : null)
      ?? 0,
  );
  const createdDate = created ? new Date(created * 1000) : null;
  return {
    id: normalizeText(paymentLink?.id, ''),
    name,
    price: formatStripePaymentLinkPrice(lineItems, paymentLink?.currency),
    created,
    createdLabel: createdDate ? createdDate.toISOString() : '',
    createdDisplay: createdDate ? formatStripeCreatedDisplay(createdDate) : '',
    status: paymentLink?.active === false ? 'Deactivated' : 'Active',
    automaticTax: Boolean(paymentLink?.automatic_tax?.enabled),
    url: normalizeText(paymentLink?.url, ''),
  };
}

function formatStripeCreatedDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatStripePaymentLinkPrice(lineItems: any[], fallbackCurrency: unknown): string {
  if (lineItems.length === 0) return '';
  const currency = normalizeText(lineItems[0]?.currency ?? lineItems[0]?.price?.currency ?? fallbackCurrency, 'usd').toUpperCase();
  const totalCents = lineItems.reduce((sum, lineItem) => {
    const quantity = Number(lineItem?.quantity || 1) || 1;
    const amount = parseStripeAmountCents(lineItem?.amount_total)
      ?? parseStripeAmountCents(lineItem?.price?.unit_amount)
      ?? parseStripeAmountCents(lineItem?.price?.unit_amount_decimal);
    return sum + (amount == null ? 0 : amount * (lineItem?.amount_total == null ? quantity : 1));
  }, 0);
  const interval = normalizeText(lineItems[0]?.price?.recurring?.interval, '');
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(totalCents / 100);
  return `${amount} ${currency}${interval ? ` / ${interval}` : ''}`;
}

function parseStripeAmountCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function dbCountOrderItems(orderIds: string[], env: Env): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (orderIds.length === 0) return counts;
  try {
    const placeholders = orderIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `SELECT order_id, COUNT(*) AS item_count
       FROM order_items
       WHERE order_id IN (${placeholders})
       GROUP BY order_id`
    ).bind(...orderIds).all<{ order_id: string | null; item_count: number | null }>();
    for (const row of result.results ?? []) {
      const id = normalizeText(row.order_id, '');
      if (id) counts.set(id, Number(row.item_count || 0));
    }
  } catch (error) {
    console.warn('Order item count lookup failed', { error });
  }
  return counts;
}

async function dbListOrderEvents(orderId: string, env: Env): Promise<Array<Record<string, unknown>>> {
  try {
    const columns = await dbGetTableColumns('order_events', env);
    if (!columns.some((column) => column.name === 'order_id')) return [];
    const result = await env.DB.prepare(
      `SELECT *
       FROM order_events
       WHERE order_id = ?
       ORDER BY COALESCE(created_at, '') DESC`
    ).bind(orderId).all<Record<string, unknown>>();
    return (result.results ?? []).map((row, index) => ({
      id: normalizeText(row.id, '') || index + 1,
      eventType: normalizeText(row.event_type, ''),
      fromStatus: normalizeText(row.from_status, ''),
      toStatus: normalizeText(row.to_status, ''),
      message: normalizeText(row.message, ''),
      createdAt: normalizeText(row.created_at, ''),
    }));
  } catch (error) {
    console.warn('Order events lookup failed', { orderId, error });
    return [];
  }
}

function mapAdminOrderSummary(
  row: Record<string, unknown>,
  itemCount: number,
  stripeCustomer: { name: string; email: string; phone: string } | null,
): Record<string, unknown> {
  const id = normalizeText(row.id, '');
  const orderNumber = normalizeText(row.order_number, id);
  const provider = normalizeText(row.checkout_provider, '') || (normalizeText(row.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const status = normalizeText(row.status, 'checkout_open');
  const totalCents = Number(row.total_cents ?? 0) || 0;
  const customer = buildAdminOrderCustomer(row, stripeCustomer);
  return {
    id,
    orderNumber,
    date: normalizeText(row.paid_at ?? row.checkout_started_at ?? row.created_at, ''),
    customerName: customer.name,
    customerEmail: customer.email,
    itemTitle: normalizeText(row.item_title_snapshot, ''),
    itemCount,
    totalCents,
    paymentStatus: status,
    fulfillmentStatus: normalizeText(row.fulfillment_status ?? row.fulfillment_type, 'pickup'),
    checkoutProvider: provider,
    checkoutType: normalizeText(row.checkout_type, provider),
    checkoutMode: normalizeText(row.checkout_mode, ''),
    paymentMethodLabel: provider === 'cash' ? 'Cash' : 'Stripe',
  };
}

function buildAdminOrderCustomer(
  row: Record<string, unknown>,
  stripeCustomer: { name: string; email: string; phone: string } | null,
): { name: string; email: string; phone: string } {
  const name = normalizeText(
    row.customer_name ?? row.stripe_customer_name ?? row.billing_name ?? row.shipping_name,
    '',
  ) || stripeCustomer?.name || 'Customer';
  const email = normalizeText(
    row.customer_email ?? row.stripe_customer_email ?? row.billing_email ?? row.email,
    '',
  ) || stripeCustomer?.email || '';
  const phone = normalizeText(
    row.customer_phone ?? row.stripe_customer_phone ?? row.billing_phone ?? row.phone,
    '',
  ) || stripeCustomer?.phone || '';
  return { name, email, phone };
}

async function resolveOrderStripeCustomer(
  row: Record<string, unknown>,
  env: Env,
): Promise<{ name: string; email: string; phone: string } | null> {
  const localCustomer = buildAdminOrderCustomer(row, null);
  if (localCustomer.email || localCustomer.name !== 'Customer') return localCustomer;

  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  const sessionId = normalizeText(row.stripe_checkout_session_id, '');
  if (!stripeSecretKey || !sessionId) return null;

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    });
    const data = await response.json<any>();
    if (!response.ok) return null;
    return {
      name: normalizeText(data?.customer_details?.name, ''),
      email: normalizeText(data?.customer_details?.email, ''),
      phone: normalizeText(data?.customer_details?.phone, ''),
    };
  } catch (error) {
    console.warn('Stripe checkout customer lookup failed', { sessionId, error });
    return null;
  }
}

async function handleShopCategories(env: Env): Promise<Response> {
  const records = await dbListInventoryCategories(env);
  return jsonResponse({
    records,
    tree: buildInventoryCategoryTree(records),
  });
}

async function handleShopAssociateModeStatus(request: Request, env: Env): Promise<Response> {
  const associateMode = await isAssociateModeRequest(request, env);
  return jsonResponse({ associateMode });
}

async function handleShopAssociateModeEnable(request: Request, env: Env): Promise<Response> {
  let token = '';
  try {
    const body = await request.json<Record<string, unknown>>();
    token = normalizeText(body?.token, '');
  } catch {
    token = '';
  }

  if (!isValidAssociateToken(token, env)) {
    return jsonResponse({ associateMode: false, message: 'Associate mode token is invalid.' }, 401);
  }

  const cookie = await buildAssociateModeCookie(env);
  return jsonResponse(
    { associateMode: true },
    200,
    {
      'Set-Cookie': cookie,
    },
  );
}

function handleShopAssociateModeDisable(): Response {
  return jsonResponse(
    { associateMode: false },
    200,
    {
      'Set-Cookie': clearAssociateModeCookie(),
    },
  );
}

async function handleShopProducts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const categoryIds = parseShopCategoryIds(url);
  const search = normalizeText(url.searchParams.get('search'), '').slice(0, 200);
  const showSold = url.searchParams.get('showSold') === '1';
  const associateMode = url.searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  const priceMin = parseCurrencyAmount(url.searchParams.get('priceMin')) ?? 0;
  const priceMax = parseCurrencyAmount(url.searchParams.get('priceMax')) ?? 0;
  const conditionInput = normalizeText(url.searchParams.get('condition'), 'All').slice(0, 50);
  const condition = conditionInput && conditionInput !== 'All' ? conditionInput : '';

  const records = await dbListShopProducts({
    categoryIds,
    search,
    showSold,
    associateMode,
    priceMin,
    priceMax,
    condition,
  }, env);

  return jsonResponse({
    records,
    filters: {
      categoryIds,
      search,
      showSold: showSold ? 1 : 0,
      associateMode: associateMode ? 1 : 0,
      priceMin,
      priceMax,
      condition: condition || 'All',
    },
  });
}

async function handleShopProductSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = normalizeText(url.searchParams.get('query'), '').slice(0, 200);
  const associateMode = url.searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  if (!query) {
    return jsonResponse({ records: [] });
  }

  const barcodeMatch = await dbFindShopProductByBarcode(query, env, { associateMode });
  const records = await dbSearchShopProductsByTitle(query, env, { associateMode });
  return jsonResponse({ records, barcodeMatch, query, associateMode: associateMode ? 1 : 0 });
}

async function handleShopSitemapProducts(env: Env): Promise<Response> {
  const records = await dbListShopSitemapProducts(env);
  return jsonResponse({ records });
}

async function handleShopReceiptTemplate(templateCode: string, env: Env): Promise<Response> {
  const code = normalizeText(templateCode, '').slice(0, 100);
  if (!/^[a-z0-9_-]+$/i.test(code)) {
    return jsonResponse({ message: 'Receipt template not found.' }, 404);
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

  if (!record) return jsonResponse({ message: 'Receipt template not found.' }, 404);

  return jsonResponse({
    record: {
      id: record.id,
      templateCode: record.template_code,
      templateText: record.template_text,
    },
  });
}

async function handleSitemap(env: Env): Promise<Response> {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const productRecords = await dbListShopSitemapProducts(env);
  const productUrls = productRecords.map((record) => ({
    loc: normalizeText(record.urlPath, ''),
    lastmod: toSitemapDate(record.updatedAt),
    changefreq: record.isSold || !record.forSale ? 'monthly' : 'daily',
    priority: record.isSold || !record.forSale ? '0.5' : '0.8',
  }));
  const urls = [...SITEMAP_STATIC_URLS, ...productUrls];
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

function handleRobotsTxt(): Response {
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /cdn-cgi/l/email-protection',
      `Disallow: ${SHOP_BASE_PATH}/cart`,
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

async function handleShopPageRequest(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith(`${SHOP_BASE_PATH}/assets/`)) {
    return fetchShopStaticAsset(request);
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

  const slug = getShopProductSlug(path);
  if (!slug) return appResponse;

  const product = await dbGetShopProductDetail(
    { slug },
    env,
    { includeInStoreOnly: await isAssociateModeRequest(request, env) },
  );
  if (!product) return appResponse;

  const html = await appResponse.text();
  return htmlResponse(injectShopProductSeo(html, product, env, requestUrl));
}

function fetchShopStaticAsset(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const assetUrl = new URL(requestUrl.pathname + requestUrl.search, SHOP_STATIC_ORIGIN);
  return fetch(new Request(assetUrl.toString(), { method: request.method }));
}

function fetchShopAppShell(request: Request): Promise<Response> {
  const shellUrl = new URL(`${SHOP_BASE_PATH}/`, SHOP_STATIC_ORIGIN);
  return fetch(new Request(shellUrl.toString(), { method: request.method }));
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

function getShopProductSlug(pathname: string): string {
  const remainder = pathname.slice(SHOP_BASE_PATH.length).replace(/^\/+|\/+$/g, '');
  const parts = remainder.split('/').filter(Boolean);
  return parts.length >= 2 ? decodeURIComponent(parts[parts.length - 1]) : '';
}

function injectShopCartSeo(html: string, env: Env): string {
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

function injectShopProductSeo(
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

function injectShopSeoTags(
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

function buildShopProductDescription(product: Record<string, unknown>): string {
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

function buildShopProductJsonLd(
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

function absolutizeShopUrl(value: string, origin: string): string {
  const text = normalizeText(value, '');
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `${origin}${text.startsWith('/') ? text : `/${text}`}`;
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

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function handleShopProductDetail(id: number, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = new URL(request.url).searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  const record = await dbGetShopProductDetail({ id }, env, { includeInStoreOnly });
  if (!record) return jsonResponse({ message: 'Product not found.' }, 404);
  return jsonResponse({ record });
}

async function handleShopProductDetailBySlug(slug: string, request: Request, env: Env): Promise<Response> {
  const trimmed = slug.trim();
  if (!trimmed) return jsonResponse({ message: 'Product not found.' }, 404);
  const includeInStoreOnly = new URL(request.url).searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  const record = await dbGetShopProductDetail({ slug: trimmed }, env, { includeInStoreOnly });
  if (!record) return jsonResponse({ message: 'Product not found.' }, 404);
  return jsonResponse({ record });
}

async function handleShopNewsletterSubscribe(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const email = normalizeEmailAddress(body?.email);
  if (!email) {
    return jsonResponse({ message: 'Enter a valid email address.' }, 400);
  }

  const inserted = await dbCreateNewsletterSubscriber(email, env);
  return jsonResponse({
    ok: true,
    duplicate: !inserted,
    message: inserted ? 'You are subscribed.' : 'You are already subscribed.',
  });
}

async function handleYoutubeVideos(): Promise<Response> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CCG_YOUTUBE_CHANNEL_ID)}`;
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Coal Creek Guitars video feed fetcher',
      'Accept': 'application/atom+xml, application/xml, text/xml',
    },
    cf: {
      cacheTtl: 900,
      cacheEverything: true,
    },
  } as RequestInit);

  if (!response.ok) {
    return jsonResponse({ message: 'Unable to load YouTube videos.' }, 502);
  }

  const xml = await response.text();
  const records = parseYoutubeVideoFeed(xml).slice(0, 12);

  return jsonResponse(
    { records },
    200,
    { 'Cache-Control': 'public, max-age=900' },
  );
}

function parseYoutubeVideoFeed(xml: string): Array<{
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  videoUrl: string;
}> {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/g) || [];

  return entries
    .map((entry) => {
      const id = decodeXmlEntity(extractXmlText(entry, 'yt:videoId'));
      const title = decodeXmlEntity(extractXmlText(entry, 'title'));
      const publishedAt = decodeXmlEntity(extractXmlText(entry, 'published'));
      const link = extractXmlAttribute(entry, 'link', 'href') || (id ? `https://www.youtube.com/watch?v=${id}` : '');
      const thumbnail = extractXmlAttribute(entry, 'media:thumbnail', 'url') || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

      return {
        id,
        title,
        thumbnail,
        publishedAt,
        videoUrl: link,
      };
    })
    .filter((video) => video.id && video.title && video.videoUrl);
}

function extractXmlText(xml: string, tagName: string): string {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escapedTagName}[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractXmlAttribute(xml: string, tagName: string, attributeName: string): string {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagMatch = xml.match(new RegExp(`<${escapedTagName}\\b[^>]*>`, 'i'));
  if (!tagMatch) return '';
  const attributeMatch = tagMatch[0].match(new RegExp(`${escapedAttributeName}="([^"]*)"`, 'i'));
  return attributeMatch ? decodeXmlEntity(attributeMatch[1]) : '';
}

function decodeXmlEntity(value: string): string {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function handleShopCreateCheckoutSession(request: Request, env: Env): Promise<Response> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe checkout is not configured.' }, 503);
  }

  let body: ShopCheckoutRequestPayload;
  try {
    body = await request.json<ShopCheckoutRequestPayload>();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const fulfillmentType = normalizeText(body?.fulfillmentType, 'pickup') === 'pickup'
    ? 'pickup'
    : 'pickup';
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  const draftResult = await buildShopCheckoutDraft(body, {
    includeInStoreOnly,
    allowTaxIncluded: includeInStoreOnly,
    allowManualDiscount: includeInStoreOnly,
  }, env);
  if (draftResult instanceof Response) {
    return draftResult;
  }
  const draft = draftResult;
  const requestedCardAmountCents = numberOrZero(body?.splitTender?.cardAmountCents);
  const isSplitTender = includeInStoreOnly && requestedCardAmountCents > 0;
  const cardAmountCents = isSplitTender ? requestedCardAmountCents : draft.totalCents;
  const cashAmountCents = isSplitTender ? Math.max(0, draft.totalCents - cardAmountCents) : 0;
  if (body?.splitTender && !includeInStoreOnly) {
    return jsonResponse({ message: 'Card + cash checkout is only available in associate mode.' }, 403);
  }
  if (isSplitTender && cardAmountCents < 100) {
    return jsonResponse({ message: 'Card amount must be at least $1.00.' }, 400);
  }
  if (isSplitTender && cardAmountCents > draft.totalCents) {
    return jsonResponse({ message: 'Card amount cannot exceed the order total.' }, 400);
  }

  const nowIso = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;
  const channel = includeInStoreOnly ? 'in_store' : 'online';

  try {
    await dbCreateCheckoutOrder({
      orderId,
      orderNumber,
      status: 'checkout_open',
      channel,
      fulfillmentType,
      checkoutType: 'stripe',
      checkoutProvider: isSplitTender ? 'stripe_cash' : 'stripe',
      checkoutMode: 'hosted_checkout',
      subtotalCents: draft.subtotalCents,
      discountCents: draft.discountCents,
      couponCode: draft.couponCode,
      taxCents: draft.taxCents,
      totalCents: draft.totalCents,
      cardAmountCents: isSplitTender ? cardAmountCents : null,
      cashAmountCents: isSplitTender ? cashAmountCents : null,
      successUrl,
      cancelUrl,
      createdAt: nowIso,
      items: draft.items,
    }, env);

    const stripeSession = await createStripeCheckoutSession({
      stripeSecretKey,
      orderId,
      orderNumber,
      successUrl,
      cancelUrl,
      items: draft.items,
      couponCode: draft.couponCode,
      discountCents: draft.discountCents,
      taxCents: draft.taxCents,
      splitTender: isSplitTender
        ? {
          cardAmountCents,
          cashAmountCents,
          totalCents: draft.totalCents,
        }
        : undefined,
    });

    if (isSplitTender) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'split_tender_created',
        fromStatus: null,
        toStatus: 'checkout_open',
        source: 'associate_checkout',
        sourceId: 'stripe_cash',
        message: 'Card + cash checkout started from cart.',
        payloadJson: JSON.stringify({
          cardAmountCents,
          cashAmountCents,
          totalCents: draft.totalCents,
        }),
      }, env);
    }

    await dbAttachStripeCheckoutSession(orderId, stripeSession.id, env);

    return jsonResponse({
      orderId,
      orderNumber,
      url: stripeSession.url,
    });
  } catch (error) {
    console.error('Stripe checkout session creation failed', { error });
    await dbCancelFailedCheckoutOrder(orderId, env);
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to start checkout.',
    }, 500);
  }
}

async function handleShopCreateTerminalPayment(request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Terminal checkout is only available in associate mode.' }, 403);
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  const stripeSecretKey = stripeConfig.secretKey;
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe Terminal is not configured.' }, 503);
  }

  let body: ShopCheckoutRequestPayload;
  try {
    body = await request.json<ShopCheckoutRequestPayload>();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const fulfillmentType = normalizeText(body?.fulfillmentType, 'pickup') === 'pickup'
    ? 'pickup'
    : 'pickup';
  const draftResult = await buildShopCheckoutDraft(body, {
    includeInStoreOnly,
    allowTaxIncluded: true,
    allowManualDiscount: true,
  }, env);
  if (draftResult instanceof Response) {
    return draftResult;
  }
  const draft = draftResult;
  const requestedCardAmountCents = numberOrZero(body?.splitTender?.cardAmountCents);
  const isSplitTender = requestedCardAmountCents > 0;
  const cardAmountCents = isSplitTender ? requestedCardAmountCents : draft.totalCents;
  const cashAmountCents = isSplitTender ? Math.max(0, draft.totalCents - cardAmountCents) : 0;
  if (isSplitTender && cardAmountCents < 100) {
    return jsonResponse({ message: 'Card amount must be at least $1.00.' }, 400);
  }
  if (isSplitTender && cardAmountCents > draft.totalCents) {
    return jsonResponse({ message: 'Card amount cannot exceed the order total.' }, 400);
  }

  const readerResult = await resolveStripeTerminalReader({
    stripeSecretKey,
    requestedReaderId: normalizeText(body?.readerId, ''),
    useSandbox: stripeConfig.useSandbox,
    env,
  });
  if (!readerResult.ok) {
    return jsonResponse({ message: readerResult.message }, readerResult.status);
  }

  const nowIso = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;
  const checkoutProvider = isSplitTender ? 'stripe_terminal_cash' : 'stripe_terminal';

  try {
    await dbCreateCheckoutOrder({
      orderId,
      orderNumber,
      status: 'checkout_open',
      channel: 'in_store',
      fulfillmentType,
      checkoutType: 'stripe',
      checkoutProvider,
      checkoutMode: 'terminal_reader',
      subtotalCents: draft.subtotalCents,
      discountCents: draft.discountCents,
      couponCode: draft.couponCode,
      taxCents: draft.taxCents,
      totalCents: draft.totalCents,
      cardAmountCents: isSplitTender ? cardAmountCents : null,
      cashAmountCents: isSplitTender ? cashAmountCents : null,
      successUrl,
      cancelUrl,
      createdAt: nowIso,
      items: draft.items,
    }, env);

    const paymentIntent = await createStripeTerminalPaymentIntent({
      stripeSecretKey,
      orderId,
      orderNumber,
      amountCents: cardAmountCents,
      totalCents: draft.totalCents,
      cardAmountCents,
      cashAmountCents,
      discountCents: draft.discountCents,
      taxCents: draft.taxCents,
      checkoutProvider,
      items: draft.items,
    });

    await dbUpdateTableById('orders', orderId, {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_payment_status: normalizeText(paymentIntent.status, 'requires_payment_method'),
      updated_at: new Date().toISOString(),
    }, env);

    const readerAction = await processStripeTerminalPaymentIntent({
      stripeSecretKey,
      readerId: readerResult.reader.id,
      paymentIntentId: paymentIntent.id,
      orderId,
    });

    await dbRecordOrderEvent(orderId, {
      eventType: 'terminal_payment_started',
      fromStatus: null,
      toStatus: 'checkout_open',
      source: 'associate_checkout',
      sourceId: readerResult.reader.id,
      message: 'Stripe Terminal payment sent to reader.',
      payloadJson: JSON.stringify({
        readerId: readerResult.reader.id,
        readerLabel: readerResult.reader.label,
        paymentIntentId: paymentIntent.id,
        readerAction,
        cardAmountCents,
        cashAmountCents,
        totalCents: draft.totalCents,
      }),
    }, env);

    return jsonResponse({
      orderId,
      orderNumber,
      successUrl,
      paymentIntentId: paymentIntent.id,
      readerId: readerResult.reader.id,
      readerLabel: readerResult.reader.label,
      status: 'waiting',
    });
  } catch (error) {
    console.error('Stripe Terminal payment start failed', { error });
    await dbCancelFailedCheckoutOrder(orderId, env);
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to start terminal payment.',
    }, 500);
  }
}

async function handleShopCreateCashOrder(request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Cash checkout is only available in associate mode.' }, 403);
  }

  let body: ShopCheckoutRequestPayload;
  try {
    body = await request.json<ShopCheckoutRequestPayload>();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const fulfillmentType = normalizeText(body?.fulfillmentType, 'pickup') === 'pickup'
    ? 'pickup'
    : 'pickup';
  const customerFirstName = normalizeText(body?.customer?.firstName, '');
  const customerLastName = normalizeText(body?.customer?.lastName, '');
  const customerEmail = normalizeEmailAddress(body?.customer?.email);
  if (!customerFirstName) {
    return jsonResponse({ message: 'Customer first name is required.' }, 400);
  }
  if (customerFirstName.length > 80) {
    return jsonResponse({ message: 'Customer first name must be 80 characters or fewer.' }, 400);
  }
  if (!customerLastName) {
    return jsonResponse({ message: 'Customer last name is required.' }, 400);
  }
  if (customerLastName.length > 80) {
    return jsonResponse({ message: 'Customer last name must be 80 characters or fewer.' }, 400);
  }
  if (!customerEmail) {
    return jsonResponse({ message: 'A valid customer email is required.' }, 400);
  }
  const draftResult = await buildShopCheckoutDraft(body, {
    includeInStoreOnly,
    allowTaxIncluded: true,
    allowManualDiscount: true,
  }, env);
  if (draftResult instanceof Response) {
    return draftResult;
  }
  const draft = draftResult;

  const nowIso = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;

  try {
    await dbCreateCheckoutOrder({
      orderId,
      orderNumber,
      status: 'checkout_open',
      channel: 'in_store',
      fulfillmentType,
      checkoutType: 'cash',
      checkoutProvider: 'cash',
      checkoutMode: 'associate_checkout',
      subtotalCents: draft.subtotalCents,
      discountCents: draft.discountCents,
      couponCode: draft.couponCode,
      taxCents: draft.taxCents,
      totalCents: draft.totalCents,
      successUrl,
      cancelUrl,
      createdAt: nowIso,
      customerName: `${customerFirstName} ${customerLastName}`,
      customerEmail,
      items: draft.items,
    }, env);

    await dbMarkManualCheckoutOrderPaid(orderId, {
      provider: 'cash',
      paidAt: nowIso,
      taxIncluded: draft.taxIncluded,
      items: draft.items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        subtotalCents: item.unitAmountCents * item.quantity,
      })),
    }, env);

    return jsonResponse({
      orderId,
      orderNumber,
      url: successUrl,
    });
  } catch (error) {
    console.error('Cash checkout order creation failed', { error });
    await dbCancelFailedCheckoutOrder(orderId, env);
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to record cash checkout.',
    }, 500);
  }
}

async function handleShopTerminalPaymentStatus(orderId: string, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Terminal checkout is only available in associate mode.' }, 403);
  }

  const normalizedOrderId = normalizeText(orderId, '');
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await dbGetOrderById(normalizedOrderId, env);
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const successUrl = normalizeText(order.success_url, `${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(normalizedOrderId)}`);
  const currentStatus = normalizeText(order.status, '');
  if (currentStatus === 'paid') {
    return jsonResponse({ status: 'succeeded', successUrl });
  }
  if (currentStatus === 'cancelled' || currentStatus === 'canceled') {
    return jsonResponse({ status: 'failed', message: 'Terminal payment was cancelled.', successUrl });
  }

  const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
  if (!paymentIntentId) {
    return jsonResponse({ status: 'failed', message: 'Order is missing a terminal payment intent.' }, 409);
  }

  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe Terminal is not configured.' }, 503);
  }

  const paymentIntent = await retrieveStripePaymentIntent(stripeSecretKey, paymentIntentId);
  const paymentStatus = normalizeText(paymentIntent?.status, '');
  await dbUpdateTableById('orders', normalizedOrderId, {
    stripe_payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }, env);

  if (paymentStatus === 'succeeded') {
    await dbMarkTerminalCheckoutOrderPaid(normalizedOrderId, paymentIntent, env);
    return jsonResponse({ status: 'succeeded', successUrl });
  }

  if (paymentStatus === 'canceled') {
    await dbCancelFailedCheckoutOrder(normalizedOrderId, env);
    return jsonResponse({
      status: 'failed',
      message: 'Terminal payment was cancelled.',
      successUrl,
    });
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  const readerResult = stripeConfig.secretKey
    ? await resolveStripeTerminalReader({
      stripeSecretKey: stripeConfig.secretKey,
      requestedReaderId: '',
      useSandbox: stripeConfig.useSandbox,
      env,
    })
    : null;
  const readerAction = readerResult?.ok ? readerResult.reader.action : null;
  const actionPaymentIntent = normalizeText(
    readerAction?.process_payment_intent?.payment_intent ?? readerAction?.payment_intent,
    '',
  );
  const actionStatus = normalizeText(readerAction?.status, '');
  if ((!actionPaymentIntent || actionPaymentIntent === paymentIntentId) && actionStatus === 'failed') {
    await dbCancelFailedCheckoutOrder(normalizedOrderId, env);
    return jsonResponse({
      status: 'failed',
      message: normalizeText(readerAction?.failure_message, 'Terminal payment failed.'),
      successUrl,
    });
  }

  return jsonResponse({
    status: 'waiting',
    paymentStatus,
    readerActionStatus: actionStatus,
    successUrl,
  });
}

async function handleShopTerminalPaymentCancel(orderId: string, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Terminal checkout is only available in associate mode.' }, 403);
  }

  const normalizedOrderId = normalizeText(orderId, '');
  const order = normalizedOrderId ? await dbGetOrderById(normalizedOrderId, env) : null;
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const currentStatus = normalizeText(order.status, '');
  if (currentStatus === 'paid') {
    return jsonResponse({ message: 'This order is already paid.' }, 409);
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe Terminal is not configured.' }, 503);
  }

  const readerResult = await resolveStripeTerminalReader({
    stripeSecretKey: stripeConfig.secretKey,
    requestedReaderId: '',
    useSandbox: stripeConfig.useSandbox,
    env,
  });
  if (readerResult.ok) {
    await cancelStripeTerminalReaderAction(stripeConfig.secretKey, readerResult.reader.id);
  }

  const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
  if (paymentIntentId) {
    await cancelStripePaymentIntent(stripeConfig.secretKey, paymentIntentId);
  }

  await dbCancelFailedCheckoutOrder(normalizedOrderId, env);
  await dbRecordOrderEvent(normalizedOrderId, {
    eventType: 'terminal_payment_cancelled',
    fromStatus: currentStatus || null,
    toStatus: 'cancelled',
    source: 'associate_checkout',
    sourceId: readerResult.ok ? readerResult.reader.id : '',
    message: 'Stripe Terminal payment cancelled from cart.',
    payloadJson: JSON.stringify({ paymentIntentId }),
  }, env);

  return jsonResponse({ ok: true });
}

async function handleShopOrderReceipt(orderId: string, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Order receipt is only available in associate mode.' }, 403);
  }

  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await dbGetOrderReceipt(normalizedOrderId, env);
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const checkoutProvider = normalizeText(order.checkoutProvider, '');
  const paymentMethodLabel = checkoutProvider === 'stripe_cash'
    ? 'Card + cash'
    : checkoutProvider === 'stripe'
      ? await resolveStripePaymentMethodLabel(normalizeText(order.stripePaymentIntentId, ''), env)
      : checkoutProvider === 'cash'
        ? 'Paid by cash'
        : `Payment method: ${toDisplayPaymentMethodName(checkoutProvider || 'Stripe')}`;

  return jsonResponse({
    record: {
      ...order,
      paymentMethodLabel,
    },
  });
}

async function buildShopCheckoutDraft(
  body: ShopCheckoutRequestPayload,
  options: { includeInStoreOnly: boolean; allowTaxIncluded: boolean; allowManualDiscount: boolean },
  env: Env,
): Promise<ShopCheckoutDraft | Response> {
  const requestedItems = normalizeCheckoutItems(body?.items);
  if (requestedItems.length === 0) {
    return jsonResponse({ message: 'Your cart is empty.' }, 400);
  }

  const inventoryRows = await dbListCheckoutInventoryItems(
    requestedItems.map((item) => item.inventoryItemId),
    env,
  );
  const byId = new Map(inventoryRows.map((row) => [row.id, row]));

  const checkoutItems: ShopCheckoutLineItem[] = [];
  for (const requestedItem of requestedItems) {
    const row = byId.get(requestedItem.inventoryItemId);
    if (!row) {
      return jsonResponse({ message: 'One of the cart items is no longer available.' }, 400);
    }
    const unavailableReason = getCheckoutInventoryUnavailableReason(row, {
      includeInStoreOnly: options.includeInStoreOnly,
      requestedQuantity: requestedItem.quantity,
    });
    if (unavailableReason) {
      return jsonResponse({ message: unavailableReason }, 409);
    }
    const price = Number(row.sale_price || row.regular_price || 0);
    const unitAmountCents = Math.round(price * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return jsonResponse({ message: `${getCheckoutItemTitle(row)} is missing a checkout price.` }, 409);
    }
    checkoutItems.push({
      inventoryItemId: requestedItem.inventoryItemId,
      quantity: requestedItem.quantity,
      row,
      title: getCheckoutItemTitle(row),
      unitAmountCents,
      imageUrl: toPublicShopImageUrl(row.image_url, 'thumb'),
    });
  }

  const subtotalCents = checkoutItems.reduce(
    (sum, item) => sum + item.unitAmountCents * item.quantity,
    0,
  );
  const couponCode = normalizeText(body?.couponCode, '').toUpperCase();
  const coupon = couponCode ? SHOP_COUPONS.get(couponCode) : null;
  if (couponCode && !coupon) {
    return jsonResponse({ message: 'Coupon is no longer valid.' }, 400);
  }
  const manualDiscountCents = options.allowManualDiscount ? numberOrZero(body?.discountCents) : 0;
  if (!options.allowManualDiscount && numberOrZero(body?.discountCents) > 0) {
    return jsonResponse({ message: 'Manual discounts are only available in associate mode.' }, 403);
  }
  if (manualDiscountCents > subtotalCents) {
    return jsonResponse({ message: 'Discount cannot exceed the order subtotal.' }, 400);
  }
  const couponDiscountCents = coupon ? Math.min(coupon.amountOffCents, subtotalCents) : 0;
  const discountCents = manualDiscountCents > 0
    ? manualDiscountCents
    : couponDiscountCents;
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const taxIncluded = options.allowTaxIncluded && body?.taxIncluded === true;
  const taxCents = taxIncluded ? 0 : Math.round(taxableCents * SHOP_SALES_TAX_RATE);
  const totalCents = taxableCents + taxCents;

  return {
    items: checkoutItems,
    subtotalCents,
    discountCents,
    couponCode: manualDiscountCents > 0 ? null : coupon ? couponCode : null,
    taxIncluded,
    taxCents,
    totalCents,
  };
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const webhookSecret = normalizeText(env.STRIPE_WEBHOOK_SECRET, '');
  if (!webhookSecret) {
    return jsonResponse({ message: 'Stripe webhook is not configured.' }, 503);
  }

  const signature = normalizeText(request.headers.get('Stripe-Signature'), '');
  const payload = await request.text();
  const verified = await verifyStripeWebhookSignature(payload, signature, webhookSecret);
  if (!verified) {
    return jsonResponse({ message: 'Invalid Stripe webhook signature.' }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ message: 'Invalid Stripe webhook payload.' }, 400);
  }

  const eventType = normalizeText(event?.type, '');
  const session = event?.data?.object;
  const orderId = normalizeText(session?.metadata?.order_id, '') || normalizeText(session?.client_reference_id, '');

  if (orderId && eventType === 'checkout.session.completed') {
    if (normalizeText(session?.payment_status, '') === 'paid') {
      await dbMarkStripeCheckoutOrderPaid(orderId, session, env);
    } else {
      await dbUpdateStripeOrderStatus(orderId, 'payment_processing', session, env);
    }
  } else if (orderId && eventType === 'checkout.session.async_payment_succeeded') {
    await dbMarkStripeCheckoutOrderPaid(orderId, session, env);
  } else if (orderId && eventType === 'checkout.session.async_payment_failed') {
    await dbReleaseStripeCheckoutOrder(orderId, 'payment_failed', session, env);
  } else if (orderId && eventType === 'checkout.session.expired') {
    await dbReleaseStripeCheckoutOrder(orderId, 'expired', session, env);
  } else if (isAdminPaymentLinkCheckoutSession(session)) {
    if (
      (eventType === 'checkout.session.completed' && normalizeText(session?.payment_status, '') === 'paid')
      || eventType === 'checkout.session.async_payment_succeeded'
    ) {
      const paymentLinkOrderId = await dbEnsurePaymentLinkCheckoutOrder(session, event, env);
      await dbMarkStripeCheckoutOrderPaid(paymentLinkOrderId, session, env);
      return jsonResponse({ received: true, orderId: paymentLinkOrderId });
    }
  } else if (!orderId) {
    return jsonResponse({ received: true, ignored: true, message: 'No order_id metadata.' });
  }

  return jsonResponse({ received: true });
}

function isAdminPaymentLinkCheckoutSession(session: any): boolean {
  return Boolean(
    normalizeText(session?.payment_link, '')
    || normalizeText(session?.metadata?.source, '') === 'admin_v2_marked_inventory'
    || normalizeText(session?.metadata?.inventory_item_ids, ''),
  );
}

async function handleAdminV2DashboardSummary(env: Env): Promise<Response> {
  const summary = await dbGetAdminV2DashboardSummary(env);
  return jsonResponse({
    asOf: currentDateYmd(),
    kpis: summary,
  });
}

async function handleAdminV2DashboardProfitTrend(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const months = parseBoundedInt(url.searchParams.get('months'), 12, 3, 24);
  const points = await dbGetAdminV2ProfitTrend(months, env);
  return jsonResponse({
    months,
    points,
  });
}

async function handleAdminV2DashboardInventoryAging(env: Env): Promise<Response> {
  const buckets = await dbGetAdminV2InventoryAging(env);
  return jsonResponse({
    asOf: currentDateYmd(),
    buckets,
  });
}

async function handleAdminV2DashboardInventoryByCategory(env: Env): Promise<Response> {
  const buckets = await dbGetAdminV2InventoryByCategory(env);
  return jsonResponse({
    asOf: currentDateYmd(),
    buckets,
  });
}

async function handleAdminV2DashboardRecentSales(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 10, 1, 25);
  const records = await dbGetAdminV2RecentSales(limit, env);
  return jsonResponse({
    records,
  });
}

async function handleAdminV2DashboardOldestInventory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 10, 1, 25);
  const records = await dbGetAdminV2OldestInventory(limit, env);
  return jsonResponse({
    records,
  });
}

async function handleAdminV2SerialDecodes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const onlyErrors = url.searchParams.get('onlyErrors') === '1';
  const unevaluated = url.searchParams.get('unevaluated') === '1';
  const sortDir = normalizeText(url.searchParams.get('sortDir'), '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const data = await dbListAdminV2SerialDecodes(page, limit, brand, onlyErrors, unevaluated, sortDir, env);
  return jsonResponse(data);
}

async function handleAdminV2SerialDecodeBrandResponses(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const records = await dbGetAdminV2SerialDecodeBrandResponses(brand, env);
  return jsonResponse({ records });
}

async function handleAdminV2SerialDecodeLookupVolume(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const view = normalizeText(url.searchParams.get('view'), '').toLowerCase() === 'month' ? 'month' : 'day';
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const data = await dbGetAdminV2SerialDecodeLookupVolume(view, brand, env);
  return jsonResponse(data);
}

async function handleAdminV2Search(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = normalizeText(url.searchParams.get('q'), '').slice(0, 200);
  if (q.length < 3) return jsonResponse({ results: [] });

  const like = `%${q}%`;

  const invRows = await env.DB.prepare(
    `SELECT id, title, brand, model, image_url
     FROM ccg_inventory_items
     WHERE title LIKE ? OR (COALESCE(brand,'') || ' ' || COALESCE(model,'')) LIKE ?
     LIMIT 5`
  ).bind(like, like).all<{ id: number; title: string; brand: string | null; model: string | null; image_url: string | null }>();

  const listingRows = await env.DB.prepare(
    `SELECT id, title, brand, model, photos
     FROM listings
     WHERE archived = 0 AND (title LIKE ? OR (COALESCE(brand,'') || ' ' || COALESCE(model,'')) LIKE ?)
     LIMIT 5`
  ).bind(like, like).all<{ id: number; title: string | null; brand: string | null; model: string | null; photos: string | null }>();

  const results = [
    ...(invRows.results || []).map((r) => ({
      type: 'inventory' as const,
      id: String(r.id),
      title: normalizeText(r.title, 'Untitled'),
      subtitle: [r.brand, r.model].filter(Boolean).join(' ') || null,
      imageUrl: toAdminImageUrl(r.image_url, 'thumb') || null,
    })),
    ...(listingRows.results || []).map((r) => {
      const firstPhoto = normalizeText(r.photos, '').split('\n').map((s) => s.trim()).find((s) => s.length > 0) || null;
      return {
        type: 'listing' as const,
        id: String(r.id),
        title: normalizeText(r.title, 'Untitled'),
        subtitle: [r.brand, r.model].filter(Boolean).join(' ') || null,
        imageUrl: firstPhoto,
      };
    }),
  ].slice(0, 10);

  return jsonResponse({ results });
}

async function handleAdminV2SerialPatternTextList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const showAll = url.searchParams.get('showAll') === '1';
  const lookupId = parseBoundedInt(url.searchParams.get('id'), 0, 0, 1_000_000_000);
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const pattern = normalizeText(url.searchParams.get('pattern'), '').slice(0, 180);
  const sortByParam = normalizeText(url.searchParams.get('sortBy'), '').toLowerCase();
  const sortBy: AdminV2SerialPatternLookupSortBy = sortByParam === 'pattern'
    ? 'pattern'
    : sortByParam === 'populated'
      ? 'populated'
      : 'brand';
  const sortDir = normalizeText(url.searchParams.get('sortDir'), '').toLowerCase() === 'desc' ? 'desc' : 'asc';

  const data = await dbListAdminV2SerialPatternLookup(page, limit, showAll, sortBy, sortDir, lookupId, brand, pattern, env);
  return jsonResponse(data);
}

async function handleAdminV2SerialPatternTextSave(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const brand = normalizeText(body.brand, '').slice(0, 120);
  const pattern = normalizeText(body.pattern, '').slice(0, 180);
  const richTextRaw = normalizeText(body.richText, '');

  if (!brand) return jsonResponse({ message: 'Brand is required.' }, 400);
  if (!pattern) return jsonResponse({ message: 'Pattern is required.' }, 400);

  const submittedRichText = sanitizePatternLookupHtml(richTextRaw).slice(0, 12000);
  const existingRow = await env.DB.prepare(
    `SELECT rich_text
     FROM serial_decode_pattern_lookup
     WHERE brand = ? AND pattern = ?
     LIMIT 1`
  ).bind(brand, pattern).first<{ rich_text: string | null }>();
  const existingRichText = normalizeText(existingRow?.rich_text, '');
  const isAddMode = existingRichText.length < 1;

  let richText = submittedRichText;
  let transformed = false;
  if (isAddMode && submittedRichText) {
    const transformedHtml = await maybeParaphrasePatternLookupHtml(brand, pattern, submittedRichText, env);
    if (transformedHtml) {
      richText = sanitizePatternLookupHtml(transformedHtml).slice(0, 12000);
      transformed = true;
    }
  }
  const regexPattern = deriveRegexFromPatternKey(pattern).slice(0, 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO serial_decode_pattern_lookup (brand, pattern, regex_pattern, rich_text, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(brand, pattern) DO UPDATE SET
         regex_pattern = excluded.regex_pattern,
         rich_text = excluded.rich_text,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(brand, pattern, regexPattern, richText).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/no column named regex_pattern/i.test(message) && !/has no column named regex_pattern/i.test(message)) {
      throw error;
    }
    await env.DB.prepare(
      `INSERT INTO serial_decode_pattern_lookup (brand, pattern, rich_text, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(brand, pattern) DO UPDATE SET
         rich_text = excluded.rich_text,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(brand, pattern, richText).run();
  }

  return jsonResponse({ ok: true, brand, pattern, richText, transformed, mode: isAddMode ? 'add' : 'update' });
}

async function handleAdminV2SerialPatternContextGenerate(request: Request, env: Env): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid multipart form payload.' }, 400);
  }

  const brandInput = normalizeText(formData.get('brand'), '').slice(0, 120);
  const serialInput = normalizeText(formData.get('serial'), '').slice(0, 180);
  const titleHint = normalizeText(formData.get('titleHint'), '').slice(0, 180);

  if (!brandInput) return jsonResponse({ message: 'Brand is required.' }, 400);
  if (!serialInput) return jsonResponse({ message: 'Serial is required.' }, 400);

  const decodeResult = decodeSerialForBackend(brandInput, serialInput);
  if (!decodeResult.success || !decodeResult.info || !decodeResult.normalizedBrand) {
    return jsonResponse({ message: decodeResult.error || 'Serial must decode successfully before adding context.' }, 400);
  }

  const normalizedBrand = decodeResult.normalizedBrand;
  const decodedBrand = normalizeText(decodeResult.info.brand, brandInput).slice(0, 120);
  const decodedSerial = normalizeText(decodeResult.info.serialNumber, serialInput).slice(0, 180);
  const patternMeta = deriveSerialPatternMeta(normalizedBrand, decodedSerial);

  const screenshotFiles = formData.getAll('screenshots').filter((entry): entry is File => entry instanceof File);
  if (screenshotFiles.length < 1) {
    return jsonResponse({ message: 'Upload at least one screenshot.' }, 400);
  }
  if (screenshotFiles.length > 6) {
    return jsonResponse({ message: 'You can upload up to 6 screenshots.' }, 400);
  }

  for (const file of screenshotFiles) {
    if (!file.type.toLowerCase().startsWith('image/')) {
      return jsonResponse({ message: 'Only image uploads are supported.' }, 400);
    }
    if (file.size > 6 * 1024 * 1024) {
      return jsonResponse({ message: 'Each screenshot must be 6MB or smaller.' }, 400);
    }
  }

  const aiResult = await runOpenAISerialPatternContextFromScreenshots(
    decodedBrand,
    decodedSerial,
    patternMeta.patternLabel,
    titleHint,
    screenshotFiles,
    env,
  );

  if (!aiResult.payload) {
    return jsonResponse({ message: aiResult.error || 'Unable to generate context from screenshots.' }, 500);
  }

  const payload = aiResult.payload;
  const saved = await dbUpsertSerialPatternContext({
    brand: decodedBrand,
    normalizedBrand,
    patternKey: patternMeta.patternKey,
    patternLabel: patternMeta.patternLabel,
    title: payload.title,
    summary: payload.summary,
    highlights: payload.highlights,
    caveats: payload.caveats,
    verificationTips: payload.verificationTips,
    sourceSerial: decodedSerial,
    aiModel: aiResult.model,
    aiResponseJson: aiResult.rawResponseJson,
    published: true,
  }, env);

  return jsonResponse({
    ok: true,
    id: saved.id,
    context: saved.context,
    patternKey: patternMeta.patternKey,
    patternLabel: patternMeta.patternLabel,
  });
}

async function handleAdminV2ActivityLog(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 8, 1, 25);
  const data = await dbListAdminV2ActivityLog(page, limit, env);
  return jsonResponse(data);
}

async function handleAdminV2SerialDecodeEvaluatedUpdate(
  request: Request,
  path: string,
  env: Env,
): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const evaluatedIndex = parts.indexOf('evaluated');
  const recordId = evaluatedIndex > 0 ? parts[evaluatedIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing serial decode ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const evaluated = toBooleanInput(body.evaluated, false);
  const updateResult = await dbSetSerialDecodeEvaluated(recordId, evaluated, env);
  if (!updateResult) return jsonResponse({ message: 'Unable to update evaluated state.' }, 500);

  if (
    evaluated &&
    updateResult.activityCandidate &&
    !updateResult.activityCandidate.wasEvaluated &&
    !updateResult.activityCandidate.success
  ) {
    const brandContext = buildBrandActivityContext(
      updateResult.activityCandidate.brand,
      updateResult.activityCandidate.normalizedBrand,
    );
    await insertActivityLogBestEffort(env, {
      eventKey: 'failed_serial_evaluated',
      eventText: `Failed ${brandContext.brandLabel} Serial Number ${updateResult.activityCandidate.serial} evaluated by an admin.`,
      eventUrl: brandContext.decoderUrl,
      imageUrl: brandContext.imageUrl,
      entityType: 'serial_decode',
      entityId: recordId,
      metadata: {
        brand: brandContext.brandLabel,
        serial: updateResult.activityCandidate.serial,
      },
    });
  }

  return jsonResponse({
    ok: true,
    evaluated: updateResult.evaluated,
    updatedCount: updateResult.updatedCount,
  });
}

async function handleAdminV2SerialDecodeDelete(path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const deleteIndex = parts.indexOf('delete');
  const recordId = deleteIndex > 0 ? parts[deleteIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing serial decode ID.' }, 400);

  const deleteResult = await dbDeleteSerialDecodeRecord(recordId, env);
  if (!deleteResult) return jsonResponse({ message: 'Unable to delete serial decode record.' }, 500);
  if (deleteResult.deletedCount < 1) {
    return jsonResponse({ message: 'Serial decode record not found.' }, 404);
  }

  return jsonResponse({
    ok: true,
    deletedCount: deleteResult.deletedCount,
  });
}

async function handleAdminV2InventoryLabelsPdf(env: Env): Promise<Response> {
  const rows = await dbListMarkedInventoryLabelRows(env);
  const labels = rows
    .map((row) => ({
      ccgNumber: normalizeText(row.ccg_number, ''),
      title: normalizeText(row.title, 'Untitled') || 'Untitled',
      imageUrl: normalizeText(row.image_url, ''),
    }))
    .filter((row) => row.ccgNumber);

  if (labels.length < 1) {
    return jsonResponse({ message: 'No marked inventory items with a CCG number were found.' }, 400);
  }

  const pdfBytes = await buildInventoryLabelsPdf(labels, env);
  const unmarkedCount = await dbUnmarkAllInventoryItems(env);
  if (unmarkedCount < 1) {
    return jsonResponse({ message: 'Labels were generated, but marked items could not be cleared.' }, 500);
  }

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ccg-labels-${currentDateYmd()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function handleAdminV2InventoryLabelsPdfPost(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return jsonResponse({ message: 'No items provided.' }, 400);
  }

  type RawItem = { id?: unknown; count?: unknown; position1?: unknown; position2?: unknown };
  const itemEntries: Array<{ id: string; count: number; position1: number; position2: number }> = [];
  let hasPositions = false;

  for (const item of rawItems) {
    const raw = item as RawItem;
    const id = raw.id != null ? String(raw.id) : '';
    const count = Number(raw.count) || 1;
    const pos1 = Number(raw.position1) || 0;
    const pos2 = count >= 2 ? (Number(raw.position2) || 0) : 0;
    if (id && count > 0 && count <= 2) {
      itemEntries.push({ id, count, position1: pos1, position2: pos2 });
      if (pos1 > 0 || pos2 > 0) hasPositions = true;
    }
  }

  if (itemEntries.length === 0) {
    return jsonResponse({ message: 'No valid items provided.' }, 400);
  }

  const ids = itemEntries.map((e) => e.id);
  const placeholders = ids.map(() => '?').join(', ');
  const dbResult = await env.DB.prepare(
    `SELECT id, ccg_number, title, image_url
     FROM ccg_inventory_items
     WHERE id IN (${placeholders})
     ORDER BY created_at ASC, id ASC`
  ).bind(...ids.map(Number)).all<{
    id: number;
    ccg_number: string | null;
    title: string | null;
    image_url: string | null;
  }>();

  const dbRowMap = new Map<string, { ccgNumber: string; title: string; imageUrl: string }>();
  for (const row of dbResult.results ?? []) {
    const ccgNumber = normalizeText(row.ccg_number, '');
    if (!ccgNumber) continue;
    dbRowMap.set(String(row.id), {
      ccgNumber,
      title: normalizeText(row.title, 'Untitled') || 'Untitled',
      imageUrl: normalizeText(row.image_url, ''),
    });
  }

  if (dbRowMap.size < 1) {
    return jsonResponse({ message: 'No valid inventory items with a CCG number were found.' }, 400);
  }

  let pdfBytes: Uint8Array;

  if (hasPositions) {
    // Position mode: build a 10-slot page with labels at specific positions
    const slots: Array<InventoryLabelPdfRow | null> = Array.from({ length: 10 }, () => null);
    for (const entry of itemEntries) {
      const dbRow = dbRowMap.get(entry.id);
      if (!dbRow) continue;
      const label: InventoryLabelPdfRow = { ccgNumber: dbRow.ccgNumber, title: dbRow.title, imageUrl: dbRow.imageUrl };
      if (entry.position1 >= 1 && entry.position1 <= 10) {
        slots[entry.position1 - 1] = label;
      }
      if (entry.count >= 2 && entry.position2 >= 1 && entry.position2 <= 10) {
        slots[entry.position2 - 1] = label;
      }
    }
    pdfBytes = await buildInventoryLabelsPdfPositioned(slots, env);
  } else {
    // Auto mode: expand rows by their print counts (grouped)
    const expandedRows: InventoryLabelPdfRow[] = [];
    for (const entry of itemEntries) {
      const dbRow = dbRowMap.get(entry.id);
      if (!dbRow) continue;
      for (let i = 0; i < entry.count; i++) {
        expandedRows.push({ ccgNumber: dbRow.ccgNumber, title: dbRow.title, imageUrl: dbRow.imageUrl });
      }
    }
    pdfBytes = await buildInventoryLabelsPdfFromExpanded(expandedRows, env);
  }

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ccg-labels-${currentDateYmd()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function handleAdminV2InventoryMarkUpdate(
  request: Request,
  path: string,
  env: Env,
): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const markIndex = parts.indexOf('mark');
  const recordId = markIndex > 0 ? parts[markIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const isMarked = toBooleanInput(body.isMarked, false);
  const updated = await dbSetInventoryMarked(recordId, isMarked, env);
  if (!updated) return jsonResponse({ message: 'Unable to update marked state.' }, 500);
  return jsonResponse({ ok: true, isMarked });
}

async function handleAdminV2InventoryUnmarkAll(env: Env): Promise<Response> {
  const count = await dbUnmarkAllInventoryItems(env);
  return jsonResponse({ ok: true, count });
}

async function handleAdminV2InventoryBackfillBarcodes(env: Env): Promise<Response> {
  const rowsResult = await env.DB.prepare(
    `SELECT id, barcode
     FROM ccg_inventory_items
     ORDER BY id ASC`
  ).all<{ id: number; barcode: string | null }>();
  const rows = rowsResult.results ?? [];
  const used = new Set(
    rows
      .map((row) => normalizeText(row.barcode, '').trim())
      .filter((barcode) => /^\d{8,20}$/.test(barcode)),
  );
  const missingRows = rows.filter((row) => !normalizeText(row.barcode, '').trim());
  let updated = 0;
  const assigned: Array<{ id: number; barcode: string }> = [];

  for (const row of missingRows) {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    let barcode = '';
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const candidate = String(900000000000 + id + attempt);
      if (!used.has(candidate)) {
        barcode = candidate;
        break;
      }
    }
    if (!barcode) {
      return jsonResponse({ message: `Unable to generate unique barcode for inventory item ${id}.` }, 500);
    }

    await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET barcode = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (barcode IS NULL OR TRIM(barcode) = '')`
    ).bind(barcode, id).run();
    used.add(barcode);
    updated += 1;
    assigned.push({ id, barcode });
  }

  return jsonResponse({
    ok: true,
    scanned: rows.length,
    missing: missingRows.length,
    updated,
    assigned,
  });
}

async function handleAdminV2InventoryMergeMarked(env: Env): Promise<Response> {
  const markedRows = await dbListMarkedInventoryRowsForPackage(env);

  const soldMarkedRows = markedRows.filter((row) => Number(row.is_sold || 0) === 1);
  if (soldMarkedRows.length > 0) {
    return jsonResponse({
      message: `Merge canceled. ${soldMarkedRows.length} marked item${soldMarkedRows.length === 1 ? ' is' : 's are'} sold. Unmark sold items and try again.`,
      soldMarkedCount: soldMarkedRows.length,
    }, 400);
  }

  const activeUnsoldMarkedRows = markedRows.filter(
    (row) => Number(row.is_active || 0) === 1 && Number(row.is_sold || 0) === 0,
  );
  if (activeUnsoldMarkedRows.length < 2) {
    return jsonResponse({
      message: 'At least 2 active unsold marked inventory items are required to merge.',
    }, 400);
  }
  const invalidQuantityRows = activeUnsoldMarkedRows.filter((row) => Number(row.quantity ?? 1) !== 1);
  if (invalidQuantityRows.length > 0) {
    return jsonResponse({
      message: 'Package items must have Qty 1 before they can be merged.',
      invalidQuantityCount: invalidQuantityRows.length,
    }, 400);
  }

  const sourceItemIds = activeUnsoldMarkedRows.map((row) => row.id);
  const sourceImagesMap = await dbListInventoryImagesForItemIds(sourceItemIds, env);
  const packageImageEntries = selectMergePackageImageEntries(activeUnsoldMarkedRows, sourceImagesMap);
  const packageImageUrls = packageImageEntries.map((e) => e.url);
  if (packageImageUrls.length < 1) {
    return jsonResponse({ message: 'Marked items did not contain usable images.' }, 400);
  }

  const purchasePriceTotal = activeUnsoldMarkedRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.purchase_price) ? Number(row.purchase_price) : 0),
    0,
  );
  const privatePartyValueTotal = activeUnsoldMarkedRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.private_party_value) ? Number(row.private_party_value) : 0),
    0,
  );
  const purchaseNotes = buildMergedPackagePurchaseNotes(activeUnsoldMarkedRows);

  const ccgNumber = await generateUniqueCcgNumber(env);
  if (!ccgNumber) {
    return jsonResponse({ message: 'Unable to generate CCG Number. Please try again.' }, 500);
  }
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  if (packageCategoryId == null) {
    return jsonResponse({ message: 'No top-level package category was found.' }, 400);
  }

  const inserted = await dbCreateInventoryItems({
    source_listing_id: null,
    ccg_number: ccgNumber,
    image_url: packageImageUrls[0],
    image_urls: packageImageUrls.join('\n'),
    title: 'New Package (needs edit)',
    quantity: 1,
    category_id: packageCategoryId,
    secondary_category_id: null,
    brand: 'CCG',
    year_range: String(new Date().getFullYear()),
    model: 'TBD',
    finish: 'TBD',
    repair_notes: null,
    original_listing_desc: null,
    video_url: null,
    sale_title: null,
    regular_price: null,
    sale_price: 0,
    condition: null,
    sale_description: null,
    clearance: 0,
    bullet_1_text: null,
    bullet_1_danger: 0,
    bullet_1_highlight: 0,
    bullet_2_text: null,
    bullet_2_danger: 0,
    bullet_2_highlight: 0,
    bullet_3_text: null,
    bullet_3_danger: 0,
    bullet_3_highlight: 0,
    bullet_4_text: null,
    bullet_4_danger: 0,
    bullet_4_highlight: 0,
    bullet_5_text: null,
    bullet_5_danger: 0,
    bullet_5_highlight: 0,
    bullet_6_text: null,
    bullet_6_danger: 0,
    bullet_6_highlight: 0,
    barcode: null,
    purchased_date: currentDateYmd(),
    purchase_price: purchasePriceTotal,
    private_party_value: privatePartyValueTotal,
    miles: 0,
    minutes_spent: 0,
    ship_cost: 0,
    purchase_notes: purchaseNotes || null,
    ai_analysis_text: null,
    serial_number: null,
    weight_lbs: null,
    neck_profile: null,
    neck_thickness: null,
    nut_width: null,
    width_12_fret: null,
    fretboard_radius: null,
    twelve_fret_action: null,
    is_active: 1,
    is_marked: 0,
    is_personal: 0,
    is_rented: 0,
    for_sale: 0,
    only_in_store: 0,
    for_sale_date: null,
    is_sold: 0,
    sold_date: null,
    sold_amount: 0,
    sell_notes: '',
  }, env);

  if (!inserted?.firstId) {
    return jsonResponse({ message: 'Unable to create merged inventory item.' }, 500);
  }
  if (!(await dbReplaceInventoryImagesByItemIds(
    [Number(inserted.firstId)],
    packageImageEntries,
    env,
  ))) {
    return jsonResponse({ message: 'Merged inventory item was created, but its image records failed to save.' }, 500);
  }

  const sourceIds = sourceItemIds;

  // Set package_id on source items and unmark them
  const packageId = inserted.firstId;
  try {
    const placeholders = sourceIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `UPDATE ccg_inventory_items SET package_id = ?, is_marked = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`
    ).bind(packageId, ...sourceIds).run();
  } catch (error) {
    console.error('Failed to set package_id on source items', { error });
    return jsonResponse({
      message: 'Merged item was created, but source items could not be linked. Resolve manually.',
      id: inserted.firstId,
      ccgNumber: inserted.ccgNumber,
    }, 500);
  }

  return jsonResponse({
    ok: true,
    id: inserted.firstId,
    ccgNumber: inserted.ccgNumber,
    mergedCount: sourceIds.length,
  });
}

async function handleInventoryPackageCreate(env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  const markedRows = await dbListMarkedInventoryRowsForPackage(env);
  if (markedRows.length < 2) {
    return jsonResponse({ message: 'At least 2 marked inventory items are required to create a package.' }, 400);
  }
  const invalidQuantityRows = markedRows.filter((row) => Number(row.quantity ?? 1) !== 1);
  if (invalidQuantityRows.length > 0) {
    return jsonResponse({
      message: 'Package items must have Qty 1 before they can be merged.',
      invalidQuantityCount: invalidQuantityRows.length,
    }, 400);
  }

  const packageImageUrls = await clonePackageImagesFromMarkedRows(markedRows, env);
  if (packageImageUrls.length < 1) {
    return jsonResponse({ message: 'Marked items did not contain usable images.' }, 400);
  }

  const purchasePriceTotal = markedRows.reduce((sum, row) => sum + (Number.isFinite(row.purchase_price) ? Number(row.purchase_price) : 0), 0);
  const privatePartyValueTotal = markedRows.reduce((sum, row) => sum + (Number.isFinite(row.private_party_value) ? Number(row.private_party_value) : 0), 0);
  const purchaseNotes = buildPackagePurchaseNotes(markedRows);

  const ccgNumber = await generateUniqueCcgNumber(env);
  if (!ccgNumber) {
    return jsonResponse({ message: 'Unable to generate CCG Number. Please try again.' }, 500);
  }
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  if (packageCategoryId == null) {
    return jsonResponse({ message: 'No top-level package category was found.' }, 400);
  }

  const inserted = await dbCreateInventoryItems({
    source_listing_id: null,
    ccg_number: ccgNumber,
    image_url: packageImageUrls[0],
    image_urls: packageImageUrls.join('\n'),
    title: 'PACKAGE DEAL - TBD',
    quantity: 1,
    category_id: packageCategoryId,
    secondary_category_id: null,
    brand: 'TBD',
    year_range: 'TBD',
    model: 'TBD',
    finish: 'TBD',
    repair_notes: null,
    original_listing_desc: null,
    video_url: null,
    sale_title: null,
    regular_price: null,
    sale_price: 0,
    condition: null,
    sale_description: null,
    clearance: 0,
    bullet_1_text: null,
    bullet_1_danger: 0,
    bullet_1_highlight: 0,
    bullet_2_text: null,
    bullet_2_danger: 0,
    bullet_2_highlight: 0,
    bullet_3_text: null,
    bullet_3_danger: 0,
    bullet_3_highlight: 0,
    bullet_4_text: null,
    bullet_4_danger: 0,
    bullet_4_highlight: 0,
    bullet_5_text: null,
    bullet_5_danger: 0,
    bullet_5_highlight: 0,
    bullet_6_text: null,
    bullet_6_danger: 0,
    bullet_6_highlight: 0,
    barcode: null,
    purchased_date: currentDateYmd(),
    purchase_price: purchasePriceTotal,
    private_party_value: privatePartyValueTotal,
    miles: 0,
    minutes_spent: 0,
    ship_cost: 0,
    purchase_notes: purchaseNotes || null,
    ai_analysis_text: null,
    serial_number: null,
    weight_lbs: null,
    neck_profile: null,
    neck_thickness: null,
    nut_width: null,
    width_12_fret: null,
    fretboard_radius: null,
    twelve_fret_action: null,
    is_active: 1,
    is_marked: 0,
    is_personal: 0,
    is_rented: 0,
    for_sale: 0,
    only_in_store: 0,
    for_sale_date: null,
    is_sold: 0,
    sold_date: null,
    sold_amount: 0,
    sell_notes: '',
  }, env);

  if (!inserted?.firstId) {
    return jsonResponse({ message: 'Unable to create package inventory item.' }, 500);
  }
  if (!(await dbReplaceInventoryImagesByItemIds(
    [Number(inserted.firstId)],
    packageImageUrls.map((url) => ({ url, isPrivate: false })),
    env,
  ))) {
    return jsonResponse({ message: 'Package item was created, but its image records failed to save.' }, 500);
  }

  const sourceIds = markedRows.map((row) => row.id);
  const deletedCount = await dbDeleteInventoryItemsByIds(sourceIds, env);
  if (deletedCount !== sourceIds.length) {
    return jsonResponse({
      message: `Package item was created, but only ${deletedCount} of ${sourceIds.length} marked rows were deleted. Resolve manually.`,
      id: inserted.firstId,
      ccgNumber: inserted.ccgNumber,
    }, 500);
  }

  await purgeOrphanedInventoryImagesForDeletedRows(markedRows, env);

  return jsonResponse({
    ok: true,
    id: inserted.firstId,
    ccgNumber: inserted.ccgNumber,
    mergedCount: sourceIds.length,
  });
}

async function handleInventoryCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const sourceListingId = parseOptionalPositiveInt(body.sourceListingId);
  const imageUrl = normalizeText(body.imageUrl, '');
  const imageEntriesInput = normalizeInventoryImageEntries(imageUrl, body.images, body.imageUrls);
  const title = normalizeText(body.title, '').slice(0, 240);
  const quantity = parseBoundedInt(body.quantity ?? body.qty, 1, 0, 1_000_000);
  const categoryId = parseOptionalPositiveInt(body.categoryId);
  const secondaryCategoryId = parseOptionalPositiveInt(body.secondaryCategoryId);
  const brand = normalizeText(body.brand, '').slice(0, 120);
  const isActive = toBooleanInput(body.isActive, true);
  const isMarked = toBooleanInput(body.isMarked, false);
  const isPersonal = toBooleanInput(body.isPersonal, false);
  const isRented = toBooleanInput(body.isRented, false);
  const isSold = toBooleanInput(body.isSold, false);
  const forSaleRaw = toBooleanInput(body.forSale, false);
  const forSale = isSold ? false : forSaleRaw;
  const onlyInStore = toBooleanInput(body.onlyInStore, false);
  const queueInput = normalizeInventoryQueue(body.queue);
  const queue = queueInput || (forSale ? 'For Sale' : 'Triage');
  const yearRange = normalizeText(body.yearRange, '').slice(0, 120);
  const model = normalizeText(body.model, '').slice(0, 180);
  const finish = normalizeText(body.finish, '').slice(0, 120);
  const repairNotes = normalizeText(body.repairNotes, '').slice(0, 12000);
  const originalListingDesc = normalizeText(body.originalListingDesc, '').slice(0, 12000);
  const videoUrl = (normalizeUrl(normalizeText(body.videoUrl, '')) || '').slice(0, 200);
  const saleTitle = normalizeText(body.saleTitle, '').slice(0, 200);
  const regularPrice = parseCurrencyAmount(body.regularPrice);
  const salePrice = parseCurrencyAmount(body.salePrice) ?? 0;
  const condition = normalizeText(body.condition, '').slice(0, 50);
  const saleDescription = normalizeText(body.saleDescription, '').slice(0, 12000);
  const clearance = toBooleanInput(body.clearance, false);
  const bullet1Text = normalizeText(body.bullet1Text, '').slice(0, 60);
  const bullet1Danger = toBooleanInput(body.bullet1Danger, false);
  const bullet1Highlight = toBooleanInput(body.bullet1Highlight, false);
  const bullet2Text = normalizeText(body.bullet2Text, '').slice(0, 60);
  const bullet2Danger = toBooleanInput(body.bullet2Danger, false);
  const bullet2Highlight = toBooleanInput(body.bullet2Highlight, false);
  const bullet3Text = normalizeText(body.bullet3Text, '').slice(0, 60);
  const bullet3Danger = toBooleanInput(body.bullet3Danger, false);
  const bullet3Highlight = toBooleanInput(body.bullet3Highlight, false);
  const bullet4Text = normalizeText(body.bullet4Text, '').slice(0, 60);
  const bullet4Danger = toBooleanInput(body.bullet4Danger, false);
  const bullet4Highlight = toBooleanInput(body.bullet4Highlight, false);
  const bullet5Text = normalizeText(body.bullet5Text, '').slice(0, 60);
  const bullet5Danger = toBooleanInput(body.bullet5Danger, false);
  const bullet5Highlight = toBooleanInput(body.bullet5Highlight, false);
  const bullet6Text = normalizeText(body.bullet6Text, '').slice(0, 60);
  const bullet6Danger = toBooleanInput(body.bullet6Danger, false);
  const bullet6Highlight = toBooleanInput(body.bullet6Highlight, false);
  const rawBarcode = normalizeText(body.barcode, '').trim();
  const barcodeInput = rawBarcode ? normalizeRequiredInventoryBarcode(rawBarcode) : { value: '', message: null };
  let barcode = barcodeInput.value;
  const purchasedDate = normalizeInventoryDate(body.purchasedDate) || currentDateYmd();
  const purchasePrice = parseCurrencyAmount(body.purchasePrice);
  const privatePartyValue = parseCurrencyAmount(body.privatePartyValue) ?? 0;
  const miles = parseBoundedInt(body.miles, 0, 0, 1_000_000);
  const minutesSpent = parseBoundedInt(body.minutesSpent, 0, 0, 1_000_000);
  const shipCost = parseCurrencyAmount(body.shipCost) ?? 0;
  const purchaseNotes = normalizeText(body.purchaseNotes, '').slice(0, 4000);
  const aiAnalysisText = sanitizePatternLookupHtml(normalizeText(body.aiAnalysisText, '')).slice(0, 20000);
  const serialNumber = normalizeText(body.serialNumber, '').slice(0, 180);
  const weightLbs = normalizeText(body.weightLbs, '').slice(0, 10);
  const neckProfile = normalizeText(body.neckProfile, '').slice(0, 100);
  const neckThickness = normalizeText(body.neckThickness, '').slice(0, 100);
  const nutWidth = normalizeText(body.nutWidth, '').slice(0, 100);
  const width12Fret = normalizeText(body.width12Fret, '').slice(0, 100);
  const fretboardRadius = normalizeText(body.fretboardRadius, '').slice(0, 100);
  const twelveFretAction = normalizeText(body.twelveFretAction, '').slice(0, 100);
  const soldAmount = parseCurrencyAmount(body.soldAmount);
  const sellNotes = normalizeText(body.sellNotes, '').slice(0, 4000);
  const saleUrl = normalizeText(body.saleUrl, '').slice(0, 150);
  const saleZip = normalizeText(body.saleZip, '').slice(0, 10);

  let imageUrls: string[];
  try {
    imageUrls = await ensureInventoryHostedImageUrls(imageEntriesInput.map((entry) => entry.url), env);
  } catch (error) {
    return jsonResponse({
      message:
        error instanceof Error ? `Unable to import inventory image: ${error.message}` : 'Unable to import inventory image.',
    }, 400);
  }

  if (!title) return jsonResponse({ message: 'Title is required.' }, 400);
  if (categoryId == null) return jsonResponse({ message: 'Category ID is required.' }, 400);
  if (barcodeInput.message) return jsonResponse({ message: barcodeInput.message }, 400);
  if (imageUrls.length < 1) return jsonResponse({ message: 'At least one image is required.' }, 400);
  const forSaleValidationError = validateForSaleInventoryFields({
    forSale,
    saleTitle,
    salePrice,
    regularPrice,
    condition,
    saleDescription,
    bulletTexts: [bullet1Text, bullet2Text, bullet3Text, bullet4Text, bullet5Text, bullet6Text],
    saleUrl,
    saleZip,
  });
  if (forSaleValidationError) return jsonResponse({ message: forSaleValidationError }, 400);
  if (imageUrls.length > INVENTORY_MAX_IMAGES) {
    return jsonResponse({ message: `You can upload up to ${INVENTORY_MAX_IMAGES} images.` }, 400);
  }
  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category ID is invalid.' }, 400);
  }
  if (secondaryCategoryId != null && !(await dbInventoryCategoryExists(secondaryCategoryId, env))) {
    return jsonResponse({ message: 'Secondary Category ID is invalid.' }, 400);
  }
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  if (quantity > 1 && packageCategoryId != null && categoryId === packageCategoryId) {
    return jsonResponse({ message: 'Packages must have Qty 1.' }, 400);
  }

  if (sourceListingId != null) {
    const alreadyLinked = await dbFindInventoryBySourceListingId(sourceListingId, env);
    if (alreadyLinked) {
      return jsonResponse({ message: 'This listing is already in inventory.' }, 400);
    }
  }

  const duplicateSaleUrl = await dbFindInventoryBySaleUrl(saleUrl, env);
  if (duplicateSaleUrl) {
    return jsonResponse({
      message: `Sale URL Slug is already used by ${duplicateSaleUrl.ccg_number || `inventory item ${duplicateSaleUrl.id}`}.`,
    }, 400);
  }

  const ccgNumber = await generateUniqueCcgNumber(env);
  if (!ccgNumber) {
    return jsonResponse({ message: 'Unable to generate CCG Number. Please try again.' }, 500);
  }
  const primaryImageUrl = imageUrls[0];
  const privacyByUrl = new Map(imageEntriesInput.map((entry) => [entry.url, entry.isPrivate]));
  const imageEntries = imageUrls.map((url, index) => ({
    url,
    isPrivate: index === 0 ? false : Boolean(privacyByUrl.get(url)),
  }));
  const duplicate = await dbFindRecentDuplicateInventoryCreate({
    source_listing_id: sourceListingId,
    image_url: primaryImageUrl,
    title,
    category_id: categoryId,
    secondary_category_id: secondaryCategoryId,
    brand: brand || null,
    year_range: yearRange || null,
    model: model || null,
    finish: finish || null,
    purchased_date: purchasedDate,
    purchase_price: purchasePrice,
  }, env);
  if (duplicate) {
    return jsonResponse({
      ok: true,
      id: String(duplicate.id),
      ccgNumber: duplicate.ccg_number,
      duplicateSuppressed: true,
      message: 'Duplicate submit prevented.',
    });
  }

  if (!barcode) {
    barcode = await generateUniqueInventoryBarcode(env);
    if (!barcode) return jsonResponse({ message: 'Unable to generate inventory barcode. Please try again.' }, 500);
  }

  const inserted = await dbCreateInventoryItems({
    source_listing_id: sourceListingId,
    ccg_number: ccgNumber,
    image_url: primaryImageUrl,
    image_urls: imageUrls.join('\n'),
    title,
    quantity,
    category_id: categoryId,
    secondary_category_id: secondaryCategoryId,
    brand: brand || null,
    queue,
    year_range: yearRange || null,
    model: model || null,
    finish: finish || null,
    repair_notes: repairNotes || null,
    original_listing_desc: originalListingDesc || null,
    video_url: videoUrl || null,
    sale_title: saleTitle || null,
    regular_price: regularPrice,
    sale_price: salePrice,
    condition: condition || null,
    sale_description: saleDescription || null,
    clearance: clearance ? 1 : 0,
    bullet_1_text: bullet1Text || null,
    bullet_1_danger: bullet1Danger ? 1 : 0,
    bullet_1_highlight: bullet1Highlight ? 1 : 0,
    bullet_2_text: bullet2Text || null,
    bullet_2_danger: bullet2Danger ? 1 : 0,
    bullet_2_highlight: bullet2Highlight ? 1 : 0,
    bullet_3_text: bullet3Text || null,
    bullet_3_danger: bullet3Danger ? 1 : 0,
    bullet_3_highlight: bullet3Highlight ? 1 : 0,
    bullet_4_text: bullet4Text || null,
    bullet_4_danger: bullet4Danger ? 1 : 0,
    bullet_4_highlight: bullet4Highlight ? 1 : 0,
    bullet_5_text: bullet5Text || null,
    bullet_5_danger: bullet5Danger ? 1 : 0,
    bullet_5_highlight: bullet5Highlight ? 1 : 0,
    bullet_6_text: bullet6Text || null,
    bullet_6_danger: bullet6Danger ? 1 : 0,
    bullet_6_highlight: bullet6Highlight ? 1 : 0,
    barcode: barcode || null,
    purchased_date: purchasedDate,
    purchase_price: purchasePrice,
    private_party_value: privatePartyValue,
    miles,
    minutes_spent: minutesSpent,
    ship_cost: shipCost,
    purchase_notes: purchaseNotes || null,
    ai_analysis_text: aiAnalysisText || null,
    serial_number: serialNumber || null,
    weight_lbs: weightLbs || null,
    neck_profile: neckProfile || null,
    neck_thickness: neckThickness || null,
    nut_width: nutWidth || null,
    width_12_fret: width12Fret || null,
    fretboard_radius: fretboardRadius || null,
    twelve_fret_action: twelveFretAction || null,
    is_active: isActive ? 1 : 0,
    is_marked: isMarked ? 1 : 0,
    is_personal: isPersonal ? 1 : 0,
    is_rented: isRented ? 1 : 0,
    for_sale: forSale ? 1 : 0,
    only_in_store: onlyInStore ? 1 : 0,
    for_sale_date: forSale ? new Date().toISOString() : null,
    is_sold: isSold ? 1 : 0,
    sold_date: isSold ? new Date().toISOString() : null,
    sold_amount: soldAmount,
    sell_notes: sellNotes || null,
    sale_url: saleUrl || null,
    sale_zip: saleZip || null,
  }, env);

  if (!inserted) {
    return jsonResponse({ message: 'Unable to create inventory item.' }, 500);
  }
  if (!(await dbReplaceInventoryImagesByItemIds([Number(inserted.firstId)], imageEntries, env))) {
    return jsonResponse({ message: 'Inventory item was created, but its image records failed to save.' }, 500);
  }

  await insertActivityLogBestEffort(env, {
    eventKey: 'inventory_added',
    eventText: `Inventory item ${title} added to system.`,
    eventUrl: buildAdminInventoryItemUrl(inserted.firstId),
    imageUrl: toAbsoluteSiteUrl(primaryImageUrl),
    entityType: 'inventory_item',
    entityId: inserted.firstId,
    metadata: {
      ccgNumber: inserted.ccgNumber,
      title,
    },
  });

  return jsonResponse({
    ok: true,
    id: inserted.firstId,
    ccgNumber: inserted.ccgNumber,
  });
}

async function handleInventoryImageUpload(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const file = formData.get('image');
  if (!(file instanceof File) || file.size <= 0) {
    return jsonResponse({ message: 'Image file is required.' }, 400);
  }
  if (!file.type.startsWith('image/')) {
    return jsonResponse({ message: 'Only image uploads are supported.' }, 400);
  }

  const body = await file.arrayBuffer();
  const detectedType = detectContentTypeFromBytes(new Uint8Array(body)) || file.type;
  if (!ALLOWED_IMAGE_TYPES.includes(detectedType)) {
    return jsonResponse({ message: `Unsupported image format (${detectedType}). Please upload JPEG, PNG, WebP, or GIF.` }, 400);
  }

  const ext = extensionFromContentType(detectedType);
  const key = `inventory-items/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: detectedType,
    },
  });

  return jsonResponse({ ok: true, imageUrl: buildInventoryImageUrl(key) });
}

async function handleInventoryImageImport(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const sourceUrl = normalizeUrl(normalizeText(body.sourceUrl, ''));
  if (!sourceUrl) {
    return jsonResponse({ message: 'Source image URL is required.' }, 400);
  }

  try {
    const imageUrl = await importExternalImageToInventory(sourceUrl, env);
    return jsonResponse({ ok: true, imageUrl });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to import source image.',
    }, 400);
  }
}

async function handleInventoryGet(path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const recordId = parts[2] || '';
  if (!recordId || recordId === 'inventory') {
    return jsonResponse({ message: 'Missing inventory ID.' }, 400);
  }

  const record = await dbGetInventoryItem(recordId, env);
  if (!record) {
    return jsonResponse({ message: 'Inventory item not found.' }, 404);
  }

  return jsonResponse({ record });
}

async function handleInventoryUpdate(request: Request, path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const updateIndex = parts.indexOf('update');
  const recordId = updateIndex > 0 ? parts[updateIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const sourceListingId = parseOptionalPositiveInt(body.sourceListingId);
  const imageUrl = normalizeText(body.imageUrl, '');
  const imageEntriesInput = normalizeInventoryImageEntries(imageUrl, body.images, body.imageUrls);
  const title = normalizeText(body.title, '').slice(0, 240);
  const quantity = parseBoundedInt(body.quantity ?? body.qty, 1, 0, 1_000_000);
  const categoryId = parseOptionalPositiveInt(body.categoryId);
  const secondaryCategoryId = parseOptionalPositiveInt(body.secondaryCategoryId);
  const brand = normalizeText(body.brand, '').slice(0, 120);
  const queueInput = normalizeInventoryQueue(body.queue);
  const yearRange = normalizeText(body.yearRange, '').slice(0, 120);
  const model = normalizeText(body.model, '').slice(0, 180);
  const finish = normalizeText(body.finish, '').slice(0, 120);
  const repairNotes = normalizeText(body.repairNotes, '').slice(0, 12000);
  const originalListingDesc = normalizeText(body.originalListingDesc, '').slice(0, 12000);
  const videoUrl = (normalizeUrl(normalizeText(body.videoUrl, '')) || '').slice(0, 200);
  const saleTitle = normalizeText(body.saleTitle, '').slice(0, 200);
  const regularPrice = parseCurrencyAmount(body.regularPrice);
  const salePrice = parseCurrencyAmount(body.salePrice) ?? 0;
  const condition = normalizeText(body.condition, '').slice(0, 50);
  const saleDescription = normalizeText(body.saleDescription, '').slice(0, 12000);
  const clearance = toBooleanInput(body.clearance, false);
  const bullet1Text = normalizeText(body.bullet1Text, '').slice(0, 60);
  const bullet1Danger = toBooleanInput(body.bullet1Danger, false);
  const bullet1Highlight = toBooleanInput(body.bullet1Highlight, false);
  const bullet2Text = normalizeText(body.bullet2Text, '').slice(0, 60);
  const bullet2Danger = toBooleanInput(body.bullet2Danger, false);
  const bullet2Highlight = toBooleanInput(body.bullet2Highlight, false);
  const bullet3Text = normalizeText(body.bullet3Text, '').slice(0, 60);
  const bullet3Danger = toBooleanInput(body.bullet3Danger, false);
  const bullet3Highlight = toBooleanInput(body.bullet3Highlight, false);
  const bullet4Text = normalizeText(body.bullet4Text, '').slice(0, 60);
  const bullet4Danger = toBooleanInput(body.bullet4Danger, false);
  const bullet4Highlight = toBooleanInput(body.bullet4Highlight, false);
  const bullet5Text = normalizeText(body.bullet5Text, '').slice(0, 60);
  const bullet5Danger = toBooleanInput(body.bullet5Danger, false);
  const bullet5Highlight = toBooleanInput(body.bullet5Highlight, false);
  const bullet6Text = normalizeText(body.bullet6Text, '').slice(0, 60);
  const bullet6Danger = toBooleanInput(body.bullet6Danger, false);
  const bullet6Highlight = toBooleanInput(body.bullet6Highlight, false);
  const barcodeInput = normalizeRequiredInventoryBarcode(body.barcode);
  const barcode = barcodeInput.value;
  const purchasedDate = normalizeInventoryDate(body.purchasedDate);
  const purchasePrice = parseCurrencyAmount(body.purchasePrice);
  const privatePartyValue = parseCurrencyAmount(body.privatePartyValue) ?? 0;
  const miles = parseBoundedInt(body.miles, 0, 0, 1_000_000);
  const minutesSpent = parseBoundedInt(body.minutesSpent, 0, 0, 1_000_000);
  const shipCost = parseCurrencyAmount(body.shipCost) ?? 0;
  const purchaseNotes = normalizeText(body.purchaseNotes, '').slice(0, 4000);
  const aiAnalysisText = sanitizePatternLookupHtml(normalizeText(body.aiAnalysisText, '')).slice(0, 20000);
  const serialNumber = normalizeText(body.serialNumber, '').slice(0, 180);
  const weightLbs = normalizeText(body.weightLbs, '').slice(0, 10);
  const neckProfile = normalizeText(body.neckProfile, '').slice(0, 100);
  const neckThickness = normalizeText(body.neckThickness, '').slice(0, 100);
  const nutWidth = normalizeText(body.nutWidth, '').slice(0, 100);
  const width12Fret = normalizeText(body.width12Fret, '').slice(0, 100);
  const fretboardRadius = normalizeText(body.fretboardRadius, '').slice(0, 100);
  const twelveFretAction = normalizeText(body.twelveFretAction, '').slice(0, 100);
  const isActive = toBooleanInput(body.isActive, true);
  const isMarked = toBooleanInput(body.isMarked, false);
  const isPersonal = toBooleanInput(body.isPersonal, false);
  const isRented = toBooleanInput(body.isRented, false);
  const isSold = toBooleanInput(body.isSold, false);
  const forSaleRaw = toBooleanInput(body.forSale, false);
  const forSale = isSold ? false : forSaleRaw;
  const onlyInStore = toBooleanInput(body.onlyInStore, false);
  const soldAmount = parseCurrencyAmount(body.soldAmount);
  const qtySold = parseBoundedInt(body.qtySold, 1, 1, 1_000_000);
  const sellNotes = normalizeText(body.sellNotes, '').slice(0, 4000);
  const subscriptionId = parseOptionalPositiveInt(body.subscriptionId);
  const saleUrl = normalizeText(body.saleUrl, '').slice(0, 150);
  const saleZip = normalizeText(body.saleZip, '').slice(0, 10);
  const storageLocation = normalizeText(body.storageLocation, '').slice(0, 100);
  const soldChannel = normalizeText(body.soldChannel, '').slice(0, 100);

  let imageUrls: string[];
  try {
    imageUrls = await ensureInventoryHostedImageUrls(imageEntriesInput.map((entry) => entry.url), env);
  } catch (error) {
    return jsonResponse({
      message:
        error instanceof Error ? `Unable to import inventory image: ${error.message}` : 'Unable to import inventory image.',
    }, 400);
  }

  if (!title) return jsonResponse({ message: 'Title is required.' }, 400);
  if (categoryId == null) return jsonResponse({ message: 'Category ID is required.' }, 400);
  if (barcodeInput.message) return jsonResponse({ message: barcodeInput.message }, 400);
  if (!purchasedDate) return jsonResponse({ message: 'Purchased date is required.' }, 400);
  if (isSold && quantity < 1) return jsonResponse({ message: 'Qty must be at least 1 when marking an item sold.' }, 400);
  if (isSold && qtySold > quantity) return jsonResponse({ message: 'Qty Sold cannot be greater than Qty.' }, 400);
  if (imageUrls.length < 1) return jsonResponse({ message: 'At least one image is required.' }, 400);
  const forSaleValidationError = validateForSaleInventoryFields({
    forSale,
    saleTitle,
    salePrice,
    regularPrice,
    condition,
    saleDescription,
    bulletTexts: [bullet1Text, bullet2Text, bullet3Text, bullet4Text, bullet5Text, bullet6Text],
    saleUrl,
    saleZip,
  });
  if (forSaleValidationError) return jsonResponse({ message: forSaleValidationError }, 400);
  if (imageUrls.length > INVENTORY_MAX_IMAGES) {
    return jsonResponse({ message: `You can upload up to ${INVENTORY_MAX_IMAGES} images.` }, 400);
  }
  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category ID is invalid.' }, 400);
  }
  if (secondaryCategoryId != null && !(await dbInventoryCategoryExists(secondaryCategoryId, env))) {
    return jsonResponse({ message: 'Secondary Category ID is invalid.' }, 400);
  }

  const current = await dbGetInventoryItem(recordId, env);
  if (!current) return jsonResponse({ message: 'Inventory item not found.' }, 404);

  if (sourceListingId != null) {
    const alreadyLinked = await dbFindInventoryBySourceListingId(sourceListingId, env);
    if (alreadyLinked && String(alreadyLinked.id) !== recordId) {
      return jsonResponse({ message: 'This listing is already in inventory.' }, 400);
    }
  }

  const currentSaleUrl = normalizeText((current as { saleUrl?: unknown }).saleUrl, '');
  const saleUrlChanged = currentSaleUrl.trim().toLowerCase() !== saleUrl.trim().toLowerCase();
  if (saleUrlChanged) {
    const duplicateSaleUrl = await dbFindInventoryBySaleUrl(saleUrl, env, recordId);
    if (duplicateSaleUrl) {
      return jsonResponse({
        message: `Sale URL Slug is already used by ${duplicateSaleUrl.ccg_number || `inventory item ${duplicateSaleUrl.id}`}.`,
      }, 400);
    }
  }

  const primaryImageUrl = imageUrls[0];
  const privacyByUrl = new Map(imageEntriesInput.map((entry) => [entry.url, entry.isPrivate]));
  const imageEntries = imageUrls.map((url, index) => ({
    url,
    isPrivate: index === 0 ? false : Boolean(privacyByUrl.get(url)),
  }));
  const previousForSale = Boolean((current as { forSale?: boolean }).forSale);
  const previousQueue = normalizeInventoryQueue((current as { queue?: unknown }).queue) || 'Triage';
  const previousForSaleDate = typeof (current as { forSaleDate?: unknown }).forSaleDate === 'string'
    ? ((current as { forSaleDate?: string }).forSaleDate || null)
    : null;
  const previousIsSold = Boolean((current as { isSold?: boolean }).isSold);
  const previousSoldDate = typeof (current as { soldDate?: unknown }).soldDate === 'string'
    ? ((current as { soldDate?: string }).soldDate || null)
    : null;
  const becameSold = !previousIsSold && isSold;
  const recordIdNum = Number.parseInt(recordId, 10);
  const currentPackageId = (current as { packageId?: number | null })?.packageId ?? null;
  const hasPackageChildren = await dbInventoryItemHasPackageChildren(recordIdNum, env);
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  const isPackageRow = packageCategoryId != null && categoryId === packageCategoryId;
  if (quantity > 1 && (currentPackageId != null || hasPackageChildren || isPackageRow)) {
    return jsonResponse({ message: 'Packages and package items must have Qty 1.' }, 400);
  }
  const queue = !previousForSale && forSale
    ? 'For Sale'
    : previousForSale && !forSale
      ? 'To Sell'
      : (queueInput || previousQueue);

  if (becameSold && qtySold < quantity) {
    if (currentPackageId != null || hasPackageChildren) {
      return jsonResponse({ message: 'Package inventory cannot be partially sold by quantity.' }, 400);
    }
    const remainingQuantity = quantity - qtySold;
    const remainingForSaleDate = resolveToggleTimestamp({
      previousOn: previousForSale,
      nextOn: true,
      previousTimestamp: previousForSaleDate,
    });
    const remainingUpdateOk = await dbUpdateInventoryById(recordId, {
      image_url: primaryImageUrl,
      image_urls: imageUrls.join('\n'),
      title,
      quantity: remainingQuantity,
      category_id: categoryId,
      secondary_category_id: secondaryCategoryId,
      brand: brand || null,
      queue: 'For Sale',
      year_range: yearRange || null,
      model: model || null,
      finish: finish || null,
      repair_notes: repairNotes || null,
      original_listing_desc: originalListingDesc || null,
      purchased_date: purchasedDate,
      purchase_price: purchasePrice,
      private_party_value: privatePartyValue,
      miles,
      minutes_spent: minutesSpent,
      ship_cost: shipCost,
      purchase_notes: purchaseNotes || null,
      ai_analysis_text: aiAnalysisText || null,
      serial_number: serialNumber || null,
      weight_lbs: weightLbs || null,
      neck_profile: neckProfile || null,
      neck_thickness: neckThickness || null,
      nut_width: nutWidth || null,
      width_12_fret: width12Fret || null,
      fretboard_radius: fretboardRadius || null,
      twelve_fret_action: twelveFretAction || null,
      storage_location: storageLocation || null,
      is_active: isActive ? 1 : 0,
      is_marked: isMarked ? 1 : 0,
      is_personal: isPersonal ? 1 : 0,
      is_rented: isRented ? 1 : 0,
      for_sale: 1,
      only_in_store: onlyInStore ? 1 : 0,
      for_sale_date: remainingForSaleDate,
      source_listing_id: sourceListingId,
      video_url: videoUrl || null,
      sale_title: saleTitle || null,
      regular_price: regularPrice,
      sale_price: salePrice,
      condition: condition || null,
      sale_description: saleDescription || null,
      clearance: clearance ? 1 : 0,
      bullet_1_text: bullet1Text || null,
      bullet_1_danger: bullet1Danger ? 1 : 0,
      bullet_1_highlight: bullet1Highlight ? 1 : 0,
      bullet_2_text: bullet2Text || null,
      bullet_2_danger: bullet2Danger ? 1 : 0,
      bullet_2_highlight: bullet2Highlight ? 1 : 0,
      bullet_3_text: bullet3Text || null,
      bullet_3_danger: bullet3Danger ? 1 : 0,
      bullet_3_highlight: bullet3Highlight ? 1 : 0,
      bullet_4_text: bullet4Text || null,
      bullet_4_danger: bullet4Danger ? 1 : 0,
      bullet_4_highlight: bullet4Highlight ? 1 : 0,
      bullet_5_text: bullet5Text || null,
      bullet_5_danger: bullet5Danger ? 1 : 0,
      bullet_5_highlight: bullet5Highlight ? 1 : 0,
      bullet_6_text: bullet6Text || null,
      bullet_6_danger: bullet6Danger ? 1 : 0,
      bullet_6_highlight: bullet6Highlight ? 1 : 0,
      barcode: barcode || null,
      is_sold: 0,
      sold_date: null,
      sold_amount: null,
      sell_notes: null,
      subscription_id: subscriptionId ?? null,
      sale_url: saleUrl || null,
      sale_zip: saleZip || null,
      sold_channel: null,
    }, env);
    if (!remainingUpdateOk) return jsonResponse({ message: 'Unable to update remaining inventory item.' }, 500);
    if (!(await dbReplaceInventoryImagesByItemIds([recordIdNum], imageEntries, env))) {
      return jsonResponse({ message: 'Unable to update remaining inventory item images.' }, 500);
    }

    const soldCcgNumber = await generateUniqueCcgNumber(env);
    if (!soldCcgNumber) return jsonResponse({ message: 'Unable to generate sold item CCG Number. Please try again.' }, 500);
    const soldDate = new Date().toISOString();
    const soldInsert = await dbCreateInventoryItems({
      source_listing_id: null,
      ccg_number: soldCcgNumber,
      image_url: primaryImageUrl,
      image_urls: imageUrls.join('\n'),
      title,
      quantity: qtySold,
      category_id: categoryId,
      secondary_category_id: secondaryCategoryId,
      brand: brand || null,
      queue,
      year_range: yearRange || null,
      model: model || null,
      finish: finish || null,
      repair_notes: repairNotes || null,
      original_listing_desc: originalListingDesc || null,
      video_url: videoUrl || null,
      sale_title: saleTitle || null,
      regular_price: regularPrice,
      sale_price: salePrice,
      condition: condition || null,
      sale_description: saleDescription || null,
      clearance: clearance ? 1 : 0,
      bullet_1_text: bullet1Text || null,
      bullet_1_danger: bullet1Danger ? 1 : 0,
      bullet_1_highlight: bullet1Highlight ? 1 : 0,
      bullet_2_text: bullet2Text || null,
      bullet_2_danger: bullet2Danger ? 1 : 0,
      bullet_2_highlight: bullet2Highlight ? 1 : 0,
      bullet_3_text: bullet3Text || null,
      bullet_3_danger: bullet3Danger ? 1 : 0,
      bullet_3_highlight: bullet3Highlight ? 1 : 0,
      bullet_4_text: bullet4Text || null,
      bullet_4_danger: bullet4Danger ? 1 : 0,
      bullet_4_highlight: bullet4Highlight ? 1 : 0,
      bullet_5_text: bullet5Text || null,
      bullet_5_danger: bullet5Danger ? 1 : 0,
      bullet_5_highlight: bullet5Highlight ? 1 : 0,
      bullet_6_text: bullet6Text || null,
      bullet_6_danger: bullet6Danger ? 1 : 0,
      bullet_6_highlight: bullet6Highlight ? 1 : 0,
      barcode: barcode || null,
      purchased_date: purchasedDate,
      purchase_price: purchasePrice,
      private_party_value: privatePartyValue,
      miles,
      minutes_spent: minutesSpent,
      ship_cost: shipCost,
      purchase_notes: purchaseNotes || null,
      ai_analysis_text: aiAnalysisText || null,
      serial_number: serialNumber || null,
      weight_lbs: weightLbs || null,
      neck_profile: neckProfile || null,
      neck_thickness: neckThickness || null,
      nut_width: nutWidth || null,
      width_12_fret: width12Fret || null,
      fretboard_radius: fretboardRadius || null,
      twelve_fret_action: twelveFretAction || null,
      is_active: isActive ? 1 : 0,
      is_marked: 0,
      is_personal: isPersonal ? 1 : 0,
      is_rented: isRented ? 1 : 0,
      for_sale: 0,
      only_in_store: onlyInStore ? 1 : 0,
      for_sale_date: null,
      is_sold: 1,
      sold_date: soldDate,
      sold_amount: soldAmount,
      sell_notes: sellNotes || null,
    }, env);
    if (!soldInsert?.firstId) return jsonResponse({ message: 'Unable to create sold inventory item.' }, 500);
    const soldCloneOk = await dbUpdateInventoryById(soldInsert.firstId, {
      image_url: primaryImageUrl,
      image_urls: imageUrls.join('\n'),
      title,
      quantity: qtySold,
      category_id: categoryId,
      secondary_category_id: secondaryCategoryId,
      brand: brand || null,
      queue,
      year_range: yearRange || null,
      model: model || null,
      finish: finish || null,
      repair_notes: repairNotes || null,
      original_listing_desc: originalListingDesc || null,
      purchased_date: purchasedDate,
      purchase_price: purchasePrice,
      private_party_value: privatePartyValue,
      miles,
      minutes_spent: minutesSpent,
      ship_cost: shipCost,
      purchase_notes: purchaseNotes || null,
      ai_analysis_text: aiAnalysisText || null,
      serial_number: serialNumber || null,
      weight_lbs: weightLbs || null,
      neck_profile: neckProfile || null,
      neck_thickness: neckThickness || null,
      nut_width: nutWidth || null,
      width_12_fret: width12Fret || null,
      fretboard_radius: fretboardRadius || null,
      twelve_fret_action: twelveFretAction || null,
      storage_location: storageLocation || null,
      is_active: isActive ? 1 : 0,
      is_marked: 0,
      is_personal: isPersonal ? 1 : 0,
      is_rented: isRented ? 1 : 0,
      for_sale: 0,
      only_in_store: onlyInStore ? 1 : 0,
      for_sale_date: null,
      source_listing_id: null,
      video_url: videoUrl || null,
      sale_title: saleTitle || null,
      regular_price: regularPrice,
      sale_price: salePrice,
      condition: condition || null,
      sale_description: saleDescription || null,
      clearance: clearance ? 1 : 0,
      bullet_1_text: bullet1Text || null,
      bullet_1_danger: bullet1Danger ? 1 : 0,
      bullet_1_highlight: bullet1Highlight ? 1 : 0,
      bullet_2_text: bullet2Text || null,
      bullet_2_danger: bullet2Danger ? 1 : 0,
      bullet_2_highlight: bullet2Highlight ? 1 : 0,
      bullet_3_text: bullet3Text || null,
      bullet_3_danger: bullet3Danger ? 1 : 0,
      bullet_3_highlight: bullet3Highlight ? 1 : 0,
      bullet_4_text: bullet4Text || null,
      bullet_4_danger: bullet4Danger ? 1 : 0,
      bullet_4_highlight: bullet4Highlight ? 1 : 0,
      bullet_5_text: bullet5Text || null,
      bullet_5_danger: bullet5Danger ? 1 : 0,
      bullet_5_highlight: bullet5Highlight ? 1 : 0,
      bullet_6_text: bullet6Text || null,
      bullet_6_danger: bullet6Danger ? 1 : 0,
      bullet_6_highlight: bullet6Highlight ? 1 : 0,
      barcode: barcode || null,
      is_sold: 1,
      sold_date: soldDate,
      sold_amount: soldAmount,
      sell_notes: sellNotes || null,
      subscription_id: subscriptionId ?? null,
      sale_url: saleUrl || null,
      sale_zip: saleZip || null,
      sold_channel: soldChannel || null,
    }, env);
    if (!soldCloneOk) return jsonResponse({ message: 'Unable to update sold inventory item.' }, 500);
    if (!(await dbReplaceInventoryImagesByItemIds([Number(soldInsert.firstId)], imageEntries, env))) {
      return jsonResponse({ message: 'Sold inventory item was created, but its image records failed to save.' }, 500);
    }

    await insertActivityLogBestEffort(env, {
      eventKey: 'inventory_marked_sold',
      eventText: `Inventory item ${title} partially sold`,
      eventUrl: buildAdminInventoryItemUrl(soldInsert.firstId),
      imageUrl: toAbsoluteSiteUrl(primaryImageUrl),
      entityType: 'inventory_item',
      entityId: soldInsert.firstId,
      metadata: {
        title,
        sourceInventoryId: recordId,
        quantitySold: qtySold,
        quantityRemaining: remainingQuantity,
        soldCcgNumber,
      },
    });

    return jsonResponse({
      ok: true,
      splitSale: true,
      soldId: soldInsert.firstId,
      soldCcgNumber,
      quantitySold: qtySold,
      quantityRemaining: remainingQuantity,
    });
  }

  const updateOk = await dbUpdateInventoryById(recordId, {
    image_url: primaryImageUrl,
    image_urls: imageUrls.join('\n'),
    title,
    quantity,
    category_id: categoryId,
    secondary_category_id: secondaryCategoryId,
    brand: brand || null,
    queue,
    year_range: yearRange || null,
    model: model || null,
    finish: finish || null,
    repair_notes: repairNotes || null,
    original_listing_desc: originalListingDesc || null,
    purchased_date: purchasedDate,
    purchase_price: purchasePrice,
    private_party_value: privatePartyValue,
    miles,
    minutes_spent: minutesSpent,
    ship_cost: shipCost,
    purchase_notes: purchaseNotes || null,
    ai_analysis_text: aiAnalysisText || null,
    serial_number: serialNumber || null,
    weight_lbs: weightLbs || null,
    neck_profile: neckProfile || null,
    neck_thickness: neckThickness || null,
    nut_width: nutWidth || null,
    width_12_fret: width12Fret || null,
    fretboard_radius: fretboardRadius || null,
    twelve_fret_action: twelveFretAction || null,
    storage_location: storageLocation || null,
    is_active: isActive ? 1 : 0,
    is_marked: isMarked ? 1 : 0,
    is_personal: isPersonal ? 1 : 0,
    is_rented: isRented ? 1 : 0,
    for_sale: forSale ? 1 : 0,
    only_in_store: onlyInStore ? 1 : 0,
    for_sale_date: resolveToggleTimestamp({
      previousOn: previousForSale,
      nextOn: forSale,
      previousTimestamp: previousForSaleDate,
    }),
    source_listing_id: sourceListingId,
    video_url: videoUrl || null,
    sale_title: saleTitle || null,
    regular_price: regularPrice,
    sale_price: salePrice,
    condition: condition || null,
    sale_description: saleDescription || null,
    clearance: clearance ? 1 : 0,
    bullet_1_text: bullet1Text || null,
    bullet_1_danger: bullet1Danger ? 1 : 0,
    bullet_1_highlight: bullet1Highlight ? 1 : 0,
    bullet_2_text: bullet2Text || null,
    bullet_2_danger: bullet2Danger ? 1 : 0,
    bullet_2_highlight: bullet2Highlight ? 1 : 0,
    bullet_3_text: bullet3Text || null,
    bullet_3_danger: bullet3Danger ? 1 : 0,
    bullet_3_highlight: bullet3Highlight ? 1 : 0,
    bullet_4_text: bullet4Text || null,
    bullet_4_danger: bullet4Danger ? 1 : 0,
    bullet_4_highlight: bullet4Highlight ? 1 : 0,
    bullet_5_text: bullet5Text || null,
    bullet_5_danger: bullet5Danger ? 1 : 0,
    bullet_5_highlight: bullet5Highlight ? 1 : 0,
    bullet_6_text: bullet6Text || null,
    bullet_6_danger: bullet6Danger ? 1 : 0,
    bullet_6_highlight: bullet6Highlight ? 1 : 0,
    barcode: barcode || null,
    is_sold: isSold ? 1 : 0,
    sold_date: resolveToggleTimestamp({
      previousOn: previousIsSold,
      nextOn: isSold,
      previousTimestamp: previousSoldDate,
    }),
    sold_amount: soldAmount,
    sell_notes: sellNotes || null,
    subscription_id: subscriptionId ?? null,
    sale_url: saleUrl || null,
    sale_zip: saleZip || null,
    sold_channel: soldChannel || null,
  }, env);
  if (!updateOk) return jsonResponse({ message: 'Unable to update inventory item.' }, 500);
  if (!(await dbReplaceInventoryImagesByItemIds([Number.parseInt(recordId, 10)], imageEntries, env))) {
    return jsonResponse({ message: 'Unable to update inventory item images.' }, 500);
  }

  // Sold cascade logic
  if (becameSold) {
    const recordIdNum = Number.parseInt(recordId, 10);
    const currentRecord = await dbGetInventoryItem(recordId, env);
    const currentPackageId = (currentRecord as { packageId?: number | null })?.packageId ?? null;

    // Case 1: This item is a package — deactivate children
    try {
      await env.DB.prepare(
        `UPDATE ccg_inventory_items SET is_active = 0, for_sale = 0, updated_at = CURRENT_TIMESTAMP WHERE package_id = ?`
      ).bind(recordIdNum).run();
    } catch (error) {
      console.error('Failed to deactivate package children on sold', { error });
    }

    // Case 2: This item belongs to a package — handle package and siblings
    if (currentPackageId != null) {
      // Mark the package as sold and not for sale (but keep active)
      try {
        await env.DB.prepare(
          `UPDATE ccg_inventory_items SET is_sold = 1, for_sale = 0, sold_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(is_sold, 0) = 0`
        ).bind(currentPackageId).run();
      } catch (error) {
        console.error('Failed to mark parent package as sold', { error });
      }

      // Null out package_id for siblings still for sale, keep them active
      try {
        await env.DB.prepare(
          `UPDATE ccg_inventory_items SET package_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE package_id = ? AND id != ? AND COALESCE(for_sale, 0) = 1`
        ).bind(currentPackageId, recordIdNum).run();
      } catch (error) {
        console.error('Failed to unlink siblings from package', { error });
      }
    }
  }

  await insertActivityLogBestEffort(env, {
    eventKey: becameSold ? 'inventory_marked_sold' : 'inventory_updated',
    eventText: becameSold
      ? `Inventory item ${title} marked sold`
      : `Inventory item ${title} updated`,
    eventUrl: buildAdminInventoryItemUrl(recordId),
    imageUrl: toAbsoluteSiteUrl(primaryImageUrl),
    entityType: 'inventory_item',
    entityId: recordId,
    metadata: {
      title,
      soldBefore: previousIsSold,
      soldAfter: isSold,
    },
  });

  return jsonResponse({ ok: true });
}

async function handleInventoryDelete(_request: Request, path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const deleteIndex = parts.indexOf('delete');
  const recordId = deleteIndex > 0 ? parts[deleteIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);

  const updatedCount = await dbDeactivateInventoryItemById(recordId, env);
  if (updatedCount < 1) return jsonResponse({ message: 'Inventory item not found.' }, 404);
  return jsonResponse({ ok: true, updatedCount });
}

function pickReverbImageUrls(listing: {
  photos?: Array<{
    _links?: {
      large_crop?: { href?: string };
      small_crop?: { href?: string };
      full?: { href?: string };
    };
  }>;
}): string[] {
  const images = (listing.photos || []).flatMap((photo) => ([
    normalizeText(photo?._links?.large_crop?.href, ''),
    normalizeText(photo?._links?.full?.href, ''),
    normalizeText(photo?._links?.small_crop?.href, ''),
  ]));

  return Array.from(new Set(images.filter(Boolean)));
}

function normalizeReverbListingData(listing: ReverbItemResponse): ListingData {
  const images = pickReverbImageUrls(listing);
  const location = typeof listing.location === 'string'
    ? normalizeText(listing.location, '')
    : [
        normalizeText(listing.location?.city, ''),
        normalizeText(listing.location?.region, ''),
        normalizeText(listing.location?.country_code, ''),
      ].filter(Boolean).join(', ');

  return {
    title: normalizeText(listing.title, 'Untitled listing'),
    price: normalizeText(listing.price?.amount, ''),
    location: normalizeText(listing.shop?.location, '') || location,
    condition: normalizeReverbCondition(listing),
    description: normalizeText(listing.description, ''),
    images,
    url: normalizeText(listing._links?.web?.href, ''),
  };
}

async function fetchReverbListingById(listingId: string, env: Env): Promise<ListingData | null> {
  const response = await fetch(`${REVERB_SEARCH_API_URL}/${encodeURIComponent(listingId)}`, {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Reverb listing fetch failed', { listingId, status: response.status, body: body.slice(0, 500) });
    return null;
  }

  const data = await response.json() as ReverbItemResponse;
  const normalized = normalizeReverbListingData(data);
  if (!normalized.title.trim() || normalized.images.length === 0) {
    return null;
  }
  return normalized;
}

async function queueAndProcessReverbListing(
  url: string,
  isMulti: boolean,
  env: Env,
): Promise<{ runId: string; recordId: string; listing: ListingData }> {
  const listingId = extractReverbListingId(url);
  if (!listingId) {
    throw new Error('Unsupported Reverb URL. Use a direct Reverb item URL.');
  }

  const listing = await fetchReverbListingById(listingId, env);
  if (!listing) {
    throw new Error('Unable to load Reverb listing from API.');
  }

  const runId = generateRunId();
  const recordId = await insertQueuedRow(url, 'reverb', runId, isMulti, env);
  if (!recordId) {
    throw new Error('Unable to queue Reverb listing.');
  }

  return { runId, recordId, listing };
}

function isAllowedImageHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized.endsWith('fbcdn.net')) return true;
  if (normalized.startsWith('scontent-') && normalized.includes('.fbcdn.net')) return true;
  if (normalized === 'scontent.xx.fbcdn.net') return true;
  if (normalized.endsWith('.fbcdn.net')) return true;
  if (normalized.endsWith('scontent.xx.fbcdn.net')) return true;
  if (normalized === 'images.craigslist.org') return true;
  return false;
}

async function handleImageProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');
  const referrer = url.searchParams.get('ref') || '';

  if (!imageUrl) {
    return jsonResponse({ message: 'Missing image URL.' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return jsonResponse({ message: 'Invalid image URL.' }, 400);
  }

  if (parsed.protocol !== 'https:' || !isAllowedImageHost(parsed.hostname)) {
    return jsonResponse({ message: 'Image host not allowed.' }, 400);
  }

  const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  });
  if (referrer) {
    headers.set('Referer', referrer);
  }

  const response = await fetch(parsed.toString(), {
    headers,
    cf: { cacheTtl: 86400, cacheEverything: true },
  });

  if (!response.ok || !response.body) {
    return jsonResponse({ message: 'Unable to fetch image.' }, 404);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=86400',
    },
  });
}

async function handleGetListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

  if (!id || id === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await dbGetListing(id, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse(record);
}

const ADMIN_V2_LIST_FIELD_KEYS = [
  'pricing_notes',
  'value_pawn_shop_notes',
  'value_online_notes',
  'known_weak_points',
  'typical_repair_needs',
  'buyers_worry',
  'og_specs_pickups',
  'og_specs_tuners',
  'og_specs_common_mods',
  'buyer_what_to_check',
  'buyer_common_misrepresent',
  'seller_how_to_price_realistic',
  'seller_fixes_add_value_or_waste',
  'seller_as_is_notes',
];

function normalizeAdminV2ListField(value: unknown): string[] {
  if (typeof value !== 'string') return [];

  const cleaned = value
    .replace(/\bGeneral:\s*/gi, '')
    .replace(/[\u061B\uFF1B\uFE54\u037E]/g, ';')
    .trim();

  if (!cleaned) return [];

  const hasBulletMarkers = /[•●▪◦]/.test(cleaned) || /(?:^|\n)\s*[-*]\s+/.test(cleaned);
  const segments = hasBulletMarkers
    ? cleaned
        .replace(/[•●▪◦]\s*/g, '\n• ')
        .replace(/(?:^|\n)\s*[-*]\s+/g, '\n• ')
        .split(/\r?\n/)
    : cleaned.split(/\r?\n/);

  return segments
    .map((part) => part.replace(/^[-–—•*]+\s*/g, '').trim())
    .filter(Boolean)
    .filter((part) => !/^unknown\.?$/i.test(part));
}

function buildAdminV2ListingRecord(record: { id: string; fields: Record<string, unknown> }) {
  const normalizedLists: Record<string, string[]> = {};

  for (const key of ADMIN_V2_LIST_FIELD_KEYS) {
    const items = normalizeAdminV2ListField(record.fields[key]);
    if (items.length > 0) {
      normalizedLists[key] = items;
    }
  }

  return {
    ...record,
    normalizedLists,
  };
}

function extractR2KeyFromImageUrl(imageUrl: string): { key: string; prefix: string } | null {
  try {
    const listingMatch = imageUrl.match(/\/api\/listing-image\?key=(listing-images\/[^\s&]+)/);
    if (listingMatch) return { key: decodeURIComponent(listingMatch[1]), prefix: 'listing-images' };
    const customMatch = imageUrl.match(/\/api\/listings\/custom-image\?key=(custom-items\/[^\s&]+)/);
    if (customMatch) return { key: decodeURIComponent(customMatch[1]), prefix: 'custom-items' };
    return null;
  } catch {
    return null;
  }
}

async function deleteR2ImagesForListing(
  listingId: string,
  photos: string,
  imageUrl: string,
  env: Env,
): Promise<number> {
  if (!env.CUSTOM_ITEMS_BUCKET) return 0;
  let deleted = 0;

  // Delete by known photo URLs in DB
  const allUrls = [
    ...photos.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    imageUrl.trim(),
  ].filter(Boolean);

  const keysToDelete = new Set<string>();
  for (const url of allUrls) {
    const parsed = extractR2KeyFromImageUrl(url);
    if (parsed) keysToDelete.add(parsed.key);
  }

  // Also list all objects under the listing-images/{id}/ prefix to catch stragglers
  try {
    let cursor: string | undefined;
    do {
      const listed = await env.CUSTOM_ITEMS_BUCKET.list({
        prefix: `listing-images/${listingId}/`,
        cursor,
      });
      for (const obj of listed.objects) {
        keysToDelete.add(obj.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch { /* best effort */ }

  for (const key of keysToDelete) {
    try {
      await env.CUSTOM_ITEMS_BUCKET.delete(key);
      deleted++;
    } catch { /* best effort */ }
  }
  return deleted;
}

async function handlePurgeOldListings(env: Env): Promise<Response> {
  const FOUR_WEEKS_AGO_SQL = "datetime('now', '-28 days')";

  // Get IDs of archived listings referenced by inventory (to exclude)
  const inventoryRefResult = await env.DB.prepare(
    `SELECT DISTINCT source_listing_id FROM ccg_inventory_items WHERE source_listing_id IS NOT NULL`
  ).all<{ source_listing_id: number }>();
  const inventoryRefs = new Set((inventoryRefResult.results ?? []).map((r) => r.source_listing_id));

  // Delete in batches directly — avoids loading all candidates into memory
  let totalDeleted = 0;
  let totalImagesDeleted = 0;
  let skippedInventory = 0;
  const deleteBatchSize = 50;

  // Loop until no more candidates
  for (let pass = 0; pass < 20; pass++) {
    const candidates = await env.DB.prepare(
      `SELECT id, photos, image_url FROM listings
       WHERE archived = 1 AND COALESCE(submitted_at, created_at) <= ${FOUR_WEEKS_AGO_SQL}
       LIMIT ${deleteBatchSize}`
    ).all<{ id: number; photos: string | null; image_url: string | null }>();

    const rows = candidates.results ?? [];
    if (rows.length === 0) break;

    const toPurge = rows.filter((r) => !inventoryRefs.has(r.id));
    skippedInventory += rows.length - toPurge.length;

    if (toPurge.length === 0) break; // remaining are all inventory-linked, stop

    // Delete R2 images only for listings that have R2-backed URLs
    for (const row of toPurge) {
      const photos = typeof row.photos === 'string' ? row.photos : '';
      const imageUrl = typeof row.image_url === 'string' ? row.image_url : '';
      if (photos.includes('/api/listing-image') || photos.includes('/api/listings/custom-image') || imageUrl.includes('/api/listing-image') || imageUrl.includes('/api/listings/custom-image')) {
        totalImagesDeleted += await deleteR2ImagesForListing(String(row.id), photos, imageUrl, env);
      }
    }

    // Delete DB rows
    const deleted = await dbDeleteListingsByIds(toPurge.map((r) => r.id), env);
    totalDeleted += deleted;
  }

  return jsonResponse({ ok: true, deleted: totalDeleted, imagesDeleted: totalImagesDeleted, skippedInventory });
}

async function handleAdminV2GetListing(env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

  if (!id || id === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await dbGetListing(id, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse(buildAdminV2ListingRecord(record));
}

async function handleAdminV2ListingAiAnalysisSave(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const aiAnalysisIndex = parts.indexOf('ai-analysis');
  const recordId = aiAnalysisIndex > 0 ? parts[aiAnalysisIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const aiAnalysisText = sanitizePatternLookupHtml(normalizeText(body.aiAnalysisText, '')).slice(0, 20000);

  try {
    await dbUpdateListing(recordId, { ai_analysis_text: aiAnalysisText || null }, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (/no such column: ai_analysis_text/i.test(message) || /no column named ai_analysis_text/i.test(message)) {
      return jsonResponse(
        { message: 'The listings.ai_analysis_text column does not exist yet. Run the one-off D1 ALTER TABLE command first.' },
        400,
      );
    }
    throw error;
  }

  return jsonResponse({ ok: true, aiAnalysisText });
}

async function handleGetListingDebug(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const debugIndex = parts.indexOf('debug');
  const recordId = debugIndex > 0 ? parts[debugIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await dbGetListing(recordId, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse({
    ok: true,
    record,
    isMulti: isMultiValue(record.fields?.IsMulti),
    singleFieldKeys: SINGLE_FIELD_KEYS,
  });
}

async function handleReprocessListing(request: Request, env: Env): Promise<Response> {
  if (env.WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawUrl = typeof body?.url === 'string' ? body.url : '';
  const recordId = typeof body?.id === 'string'
    ? body.id
    : (typeof body?.id === 'number' && Number.isFinite(body.id) ? String(body.id) : '');

  if (!rawUrl && !recordId) return jsonResponse({ message: 'Missing url or id.' }, 400);

  if (recordId) {
    const record = await dbGetListing(recordId, env);
    if (!record) return jsonResponse({ message: 'Listing not found.' }, 404);
    const source = typeof record.fields?.source === 'string' ? record.fields.source.trim().toLowerCase() : '';
    if (source !== 'custom') {
      return jsonResponse({ message: 'ID reprocess is only supported for custom listings.' }, 400);
    }

    const listing = buildCustomListingFromRecordFields(record.fields);
    if (!listing) {
      return jsonResponse({ message: 'Custom listing has no photos to process.' }, 400);
    }
    await dbUpdateListing(recordId, { status: 'queued' }, env);
    await processCustomListing(recordId, listing, env);
    return jsonResponse({ ok: true, recordId });
  }

  const resolvedUrl = await resolveFacebookShareUrl(rawUrl);
  const normalizedUrl = normalizeQueuedListingUrl(resolvedUrl);
  if (!normalizedUrl) return jsonResponse({ message: 'Invalid url.' }, 400);
  if (!isSupportedListingUrl(normalizedUrl)) {
    return jsonResponse({ message: 'Unsupported URL. Use a Facebook Marketplace item URL, Craigslist listing URL, or single Reverb item URL.' }, 400);
  }

  const existing = await dbFindListingByUrl(normalizedUrl, env);
  if (!existing?.id) return jsonResponse({ message: 'Listing not found.' }, 404);

  const source = detectSource(normalizedUrl);
  if (!source) return jsonResponse({ message: 'Unsupported URL source.' }, 400);

  if (source === 'reverb') {
    const listingId = extractReverbListingId(normalizedUrl);
    if (!listingId) return jsonResponse({ message: 'Unsupported Reverb URL. Use a direct Reverb item URL.' }, 400);
    const listing = await fetchReverbListingById(listingId, env);
    if (!listing) return jsonResponse({ message: 'Unable to load Reverb listing from API.' }, 500);

    const runId = generateRunId();
    await env.LISTING_JOBS.put(runId, existing.id);
    await dbUpdateListing(existing.id, { status: 'queued' }, env);
    try {
      await processDirectListing(existing.id, runId, listing, env, { isMulti: false });
      return jsonResponse({ ok: true, runId, recordId: existing.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process Reverb listing.';
      return jsonResponse({ ok: false, runId, recordId: existing.id, error: message }, 500);
    }
  }

  const runId = await startApifyRun(normalizedUrl, source as ListingSource, env);
  if (!runId) return jsonResponse({ message: 'Unable to start scraper run.' }, 500);

  await env.LISTING_JOBS.put(runId, existing.id);
  const runDetails = await waitForApifyRun(runId, env, 20);
  try {
    await processRun(runId, runDetails, runDetails?.status, env);
    return jsonResponse({ ok: true, runId, recordId: existing.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, runId, recordId: existing.id, error: message }, 500);
  }
}

async function handleArchiveListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const archiveIndex = parts.indexOf('archive');
  const recordId = archiveIndex > 0 ? parts[archiveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let archivedValue = true;
  let archiveReason: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.archived === 'boolean') {
      archivedValue = body.archived;
    }
    if (typeof body?.archiveReason === 'string') {
      const trimmedReason = body.archiveReason.trim();
      archiveReason = trimmedReason || null;
    }
  } catch {
    archivedValue = true;
  }

  if (archivedValue) {
    if (!archiveReason || !ALLOWED_ARCHIVE_REASONS.has(archiveReason)) {
      return jsonResponse({ message: 'Missing or invalid archive reason.' }, 400);
    }
  } else {
    archiveReason = null;
  }

  const updated = await dbSetListingArchived(recordId, archivedValue, archiveReason, env);
  if (!updated) {
    return jsonResponse({ message: 'Unable to archive listing.' }, 500);
  }

  return jsonResponse({ ok: true, archived: archivedValue, archiveReason });
}

async function handleSaveListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const saveIndex = parts.indexOf('save');
  const recordId = saveIndex > 0 ? parts[saveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const savedValue = typeof body?.saved === 'boolean' ? body.saved : null;
  if (savedValue === null) {
    return jsonResponse({ message: 'Missing saved state.' }, 400);
  }

  await dbUpdateListing(recordId, { saved: savedValue }, env);
  return jsonResponse({ ok: true, saved: savedValue });
}

async function processRun(runId: string, resource: any, eventType: string | undefined, env: Env): Promise<void> {
  if (eventType && eventType.includes('FAILED')) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Apify run failed.',
    }, env);
    return;
  }

  const runDetails = await fetchApifyRun(runId, env);
  const datasetId = resource?.defaultDatasetId || runDetails?.defaultDatasetId;

  if (!datasetId) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'No dataset returned from scraper.',
    }, env);
    return;
  }

  const items = await fetchApifyDataset(datasetId, env);
  if (!items || items.length === 0) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Scraper returned no listing data.',
    }, env);
    return;
  }

  const listing = normalizeListing(items[0]);
  let recordId = await env.LISTING_JOBS.get(runId);
  if (!recordId && listing.url) {
    const found = await dbFindListingByUrl(listing.url, env);
    if (found?.id) {
      recordId = found.id;
      await env.LISTING_JOBS.put(runId, recordId);
    }
  }
  if (!listing.title.trim() && listing.images.length === 0) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Scraper returned incomplete listing metadata (missing title and image). Check URL format; Facebook share links may not resolve.',
    }, env, { recordId });
    return;
  }
  const isMulti = recordId ? await getIsMultiFromRecord(recordId, env) : false;
  const canonicalListingUrl = normalizeQueuedListingUrl(listing.url || '') || '';
  const aiResult = await runOpenAI(listing, env, { isMulti });
  let aiSummary = aiResult.kind === 'multi' ? ensureMultiTotals(aiResult.summary) : '';
  let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;

  let finalImages = listing.images;
  if (recordId && env.CUSTOM_ITEMS_BUCKET && listing.images.length > 0) {
    finalImages = await persistListingImagesToR2(recordId, listing.images, env);
  }

  await updateRowByRunId(runId, {
    runId,
    status: 'complete',
    title: listing.title,
    price: listing.price,
    location: listing.location,
    condition: listing.condition,
    description: listing.description,
    photos: finalImages.join('\n'),
    image_url: finalImages[0] ?? '',
    aiSummary,
    aiData,
    notes: listing.notes,
  }, env, { recordId, isMulti });

  if (recordId && canonicalListingUrl) {
    const currentRecord = await dbGetListing(recordId, env);
    const currentUrl = normalizeText(currentRecord?.fields?.url, '');
    if (currentUrl && currentUrl !== canonicalListingUrl) {
      const existingCanonical = await dbFindListingByUrl(canonicalListingUrl, env);
      if (!existingCanonical || existingCanonical.id === recordId) {
        await dbUpdateListing(recordId, { url: canonicalListingUrl }, env);
      }
    }
  }

  const listingTitle = normalizeText(listing.title, '').slice(0, 300) || 'Untitled listing';
  const listingUrl = toAbsoluteSiteUrl(listing.url || '');
  const listingImageUrl = toAbsoluteSiteUrl(listing.images[0] || '');
  await insertActivityLogBestEffort(env, {
    eventKey: 'listing_eval_completed',
    eventText: `Listing Eval completed for ${listingTitle}`,
    eventUrl: recordId ? buildAdminListingEvaluatorItemUrl(recordId) : listingUrl,
    imageUrl: listingImageUrl,
    entityType: 'listing_eval',
    entityId: recordId || null,
    metadata: {
      runId,
      listingId: recordId || null,
      title: listingTitle,
      sourceUrl: listingUrl,
    },
  });
}

async function persistListingImagesToR2(
  listingId: string,
  imageUrls: string[],
  env: Env,
): Promise<string[]> {
  if (!env.CUSTOM_ITEMS_BUCKET || imageUrls.length === 0) return imageUrls;

  const results: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const sourceUrl = imageUrls[i];
    try {
      const response = await fetch(sourceUrl, { redirect: 'follow' });
      if (!response.ok || !response.body) {
        results.push(sourceUrl);
        continue;
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = extensionFromContentType(contentType);
      const key = `listing-images/${listingId}/${i}.${ext}`;
      const body = await response.arrayBuffer();
      await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
        httpMetadata: { contentType },
      });
      results.push(buildListingImageUrl(key));
    } catch {
      results.push(sourceUrl);
    }
  }
  return results;
}

function hasOwnField(fields: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key);
}

function toDbBoolean(value: unknown): number | null {
  if (value == null) return null;
  return isArchivedValue(value) ? 1 : 0;
}

function toDbMulti(value: unknown): number | null {
  if (value == null) return null;
  return isMultiValue(value) ? 1 : 0;
}

function listingFieldsToColumns(fields: Record<string, unknown>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  const assign = (fieldKey: string, columnKey = fieldKey, transform?: (value: unknown) => unknown) => {
    if (!hasOwnField(fields, fieldKey)) return;
    const raw = fields[fieldKey];
    columns[columnKey] = transform ? transform(raw) : raw;
  };

  assign('submitted_at');
  assign('source');
  assign('url');
  assign('status');
  assign('title');
  assign('price_asking');
  assign('location');
  assign('description');
  assign('photos');
  assign('image_url');
  assign('ai_summary');
  assign('ai_summary2');
  assign('ai_summary3');
  assign('ai_summary4');
  assign('ai_summary5');
  assign('ai_summary6');
  assign('ai_summary7');
  assign('ai_summary8');
  assign('ai_summary9');
  assign('ai_summary10');
  assign('ai_analysis_text');
  assign('price_private_party');
  assign('price_ideal');
  assign('score');
  assign('category');
  assign('brand');
  assign('model');
  assign('finish');
  assign('year');
  assign('condition');
  assign('serial');
  assign('serial_brand');
  assign('serial_year');
  assign('serial_model');
  assign('value_private_party_low');
  assign('value_private_party_low_notes');
  assign('value_private_party_medium');
  assign('value_private_party_medium_notes');
  assign('value_private_party_high');
  assign('value_private_party_high_notes');
  assign('pricing_source');
  assign('pricing_confidence');
  assign('pricing_comp_count');
  assign('pricing_notes');
  assign('value_pawn_shop_notes');
  assign('value_online_notes');
  assign('known_weak_points');
  assign('typical_repair_needs');
  assign('buyers_worry');
  assign('og_specs_pickups');
  assign('og_specs_tuners');
  assign('og_specs_common_mods');
  assign('buyer_what_to_check');
  assign('buyer_common_misrepresent');
  assign('seller_how_to_price_realistic');
  assign('seller_fixes_add_value_or_waste');
  assign('seller_as_is_notes');
  assign('archived', 'archived', toDbBoolean);
  assign('archive_reason');
  assign('saved', 'saved', toDbBoolean);
  assign('IsMulti', 'is_multi', toDbMulti);

  return columns;
}

function buildInsertStatement(table: string, columns: Record<string, unknown>): { sql: string; values: unknown[] } | null {
  const keys = Object.keys(columns);
  if (keys.length === 0) return null;
  const placeholders = keys.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values: keys.map((key) => columns[key]),
  };
}

function buildUpdateStatement(table: string, columns: Record<string, unknown>, whereKey: string): { sql: string; values: unknown[] } | null {
  const keys = Object.keys(columns);
  if (keys.length === 0) return null;
  const assignments = keys.map((key) => `${key} = ?`).join(', ');
  return {
    sql: `UPDATE ${table} SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE ${whereKey} = ?`,
    values: keys.map((key) => columns[key]),
  };
}

function listingRowToRecord(row: Record<string, any>): { id: string; fields: Record<string, unknown> } {
  return {
    id: String(row.id),
    fields: {
      submitted_at: row.submitted_at ?? null,
      source: row.source ?? null,
      url: row.url ?? null,
      status: row.status ?? null,
      title: row.title ?? null,
      price_asking: row.price_asking ?? null,
      location: row.location ?? null,
      description: row.description ?? null,
      photos: row.photos ?? null,
      image_url: row.image_url ?? null,
      ai_summary: row.ai_summary ?? null,
      ai_summary2: row.ai_summary2 ?? null,
      ai_summary3: row.ai_summary3 ?? null,
      ai_summary4: row.ai_summary4 ?? null,
      ai_summary5: row.ai_summary5 ?? null,
      ai_summary6: row.ai_summary6 ?? null,
      ai_summary7: row.ai_summary7 ?? null,
      ai_summary8: row.ai_summary8 ?? null,
      ai_summary9: row.ai_summary9 ?? null,
      ai_summary10: row.ai_summary10 ?? null,
      ai_analysis_text: row.ai_analysis_text ?? null,
      price_private_party: row.price_private_party ?? null,
      price_ideal: row.price_ideal ?? null,
      score: row.score ?? null,
      archived: row.archived ? true : false,
      archive_reason: row.archive_reason ?? null,
      saved: row.saved ? true : false,
      IsMulti: row.is_multi ? true : false,
      category: row.category ?? null,
      brand: row.brand ?? null,
      model: row.model ?? null,
      finish: row.finish ?? null,
      year: row.year ?? null,
      condition: row.condition ?? null,
      serial: row.serial ?? null,
      serial_brand: row.serial_brand ?? null,
      serial_year: row.serial_year ?? null,
      serial_model: row.serial_model ?? null,
      value_private_party_low: row.value_private_party_low ?? null,
      value_private_party_low_notes: row.value_private_party_low_notes ?? null,
      value_private_party_medium: row.value_private_party_medium ?? null,
      value_private_party_medium_notes: row.value_private_party_medium_notes ?? null,
      value_private_party_high: row.value_private_party_high ?? null,
      value_private_party_high_notes: row.value_private_party_high_notes ?? null,
      pricing_source: row.pricing_source ?? null,
      pricing_confidence: row.pricing_confidence ?? null,
      pricing_comp_count: row.pricing_comp_count ?? null,
      pricing_notes: row.pricing_notes ?? null,
      value_pawn_shop_notes: row.value_pawn_shop_notes ?? null,
      value_online_notes: row.value_online_notes ?? null,
      known_weak_points: row.known_weak_points ?? null,
      typical_repair_needs: row.typical_repair_needs ?? null,
      buyers_worry: row.buyers_worry ?? null,
      og_specs_pickups: row.og_specs_pickups ?? null,
      og_specs_tuners: row.og_specs_tuners ?? null,
      og_specs_common_mods: row.og_specs_common_mods ?? null,
      buyer_what_to_check: row.buyer_what_to_check ?? null,
      buyer_common_misrepresent: row.buyer_common_misrepresent ?? null,
      seller_how_to_price_realistic: row.seller_how_to_price_realistic ?? null,
      seller_fixes_add_value_or_waste: row.seller_fixes_add_value_or_waste ?? null,
      seller_as_is_notes: row.seller_as_is_notes ?? null,
    },
  };
}

async function dbListListings(
  limit: number,
  offset: string | undefined,
  mode: 'default' | 'saved' | 'archived',
  titleSearch: string,
  archiveReason: string,
  env: Env
): Promise<{ records: ListingListItem[]; nextOffset?: string | null; total?: number } | null> {
  const offsetValue = offset ? Math.max(0, Number.parseInt(offset, 10) || 0) : 0;
  const whereParts = ['(l.archived IS NULL OR l.archived = 0)', '(l.saved IS NULL OR l.saved = 0)'];
  if (mode === 'saved') {
    whereParts.length = 0;
    whereParts.push('(l.archived IS NULL OR l.archived = 0)', 'l.saved = 1');
  } else if (mode === 'archived') {
    whereParts.length = 0;
    whereParts.push('l.archived = 1');
  }

  const queryBindings: unknown[] = [];
  if (titleSearch) {
    whereParts.push('LOWER(COALESCE(l.title, \'\')) LIKE ?');
    queryBindings.push(`%${titleSearch.toLowerCase()}%`);
  }
  if (mode === 'archived' && archiveReason) {
    whereParts.push('l.archive_reason = ?');
    queryBindings.push(archiveReason);
  }
  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
  const totalResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM listings l ${whereClause}`
  ).bind(...queryBindings).first<{ total: number }>();
  const total = typeof totalResult?.total === 'number' ? totalResult.total : 0;
  const result = await env.DB.prepare(
    `SELECT
       l.id,
       l.url,
       l.source,
       l.status,
       l.title,
       l.archive_reason,
       l.price_asking,
       l.score,
       l.saved,
       l.image_url,
       l.submitted_at,
       l.created_at,
       l.updated_at,
       CASE WHEN i.id IS NULL THEN 0 ELSE 1 END AS in_inventory
     FROM listings l
     LEFT JOIN ccg_inventory_items i
       ON i.source_listing_id = l.id
     ${whereClause}
     ORDER BY
       CASE WHEN l.status = 'queued' THEN 1 ELSE 0 END ASC,
       COALESCE(l.submitted_at, l.created_at) DESC,
       l.id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...queryBindings, limit, offsetValue)
    .all<{
      id: number;
      url: string | null;
      source: string | null;
      status: string | null;
      title: string | null;
      archive_reason: string | null;
      price_asking: number | string | null;
      score: number | string | null;
      saved: number | null;
      image_url: string | null;
      submitted_at: string | null;
      created_at: string | null;
      updated_at: string | null;
      in_inventory: number | null;
    }>();

  const records = (result.results ?? []).map((row) => ({
    id: String(row.id),
    url: row.url ?? '',
    source: row.source ?? '',
    status: row.status ?? '',
    title: row.title ?? '',
    archiveReason: row.archive_reason ?? null,
    askingPrice: row.price_asking ?? null,
    score: row.score ?? null,
    saved: row.saved ? true : false,
    imageUrl: toAdminImageUrl(row.image_url ? String(row.image_url).trim().split(/\s+/)[0] : null, 'thumb') || null,
    submittedAt: row.submitted_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    inInventory: Boolean(row.in_inventory),
  }));

  const nextOffset = records.length === limit ? String(offsetValue + limit) : null;
  return { records, nextOffset, total };
}

async function dbListListingsForMap(
  env: Env
): Promise<{ records: ListingMapItem[] } | null> {
  const result = await env.DB.prepare(
    `SELECT
       l.id,
       l.url,
       l.source,
       l.status,
       l.title,
       l.price_asking,
       l.saved,
       l.location
     FROM listings l
     WHERE (l.archived IS NULL OR l.archived = 0)
     ORDER BY
       CASE WHEN l.status = 'queued' THEN 1 ELSE 0 END ASC,
       COALESCE(l.submitted_at, l.created_at) DESC,
       l.id DESC
     LIMIT 2000`
  ).all<{
    id: number;
    url: string | null;
    source: string | null;
    status: string | null;
    title: string | null;
    price_asking: number | string | null;
    saved: number | null;
    location: string | null;
  }>();

  const records = (result.results ?? []).map((row) => ({
    id: String(row.id),
    url: row.url ?? '',
    source: row.source ?? '',
    status: row.status ?? '',
    title: row.title ?? '',
    askingPrice: row.price_asking ?? null,
    saved: row.saved ? true : false,
    location: row.location ?? '',
  }));

  return { records };
}

async function dbGetListing(recordId: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return null;
  const row = await env.DB.prepare('SELECT * FROM listings WHERE id = ?')
    .bind(idValue)
    .first<Record<string, any>>();
  return row ? listingRowToRecord(row) : null;
}

async function dbFindListingByUrl(url: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const row = await env.DB.prepare('SELECT * FROM listings WHERE url = ? LIMIT 1')
    .bind(url)
    .first<Record<string, any>>();
  return row ? listingRowToRecord(row) : null;
}

async function dbCreateListing(fields: Record<string, unknown>, env: Env): Promise<string | null> {
  const columns = listingFieldsToColumns(fields);
  const insert = buildInsertStatement('listings', columns);
  if (!insert) return null;
  const result = await env.DB.prepare(insert.sql).bind(...insert.values).run();
  return result.meta?.last_row_id ? String(result.meta.last_row_id) : null;
}

async function dbUpdateListing(recordId: string, fields: Record<string, unknown>, env: Env): Promise<void> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return;
  const columns = listingFieldsToColumns(fields);
  const update = buildUpdateStatement('listings', columns, 'id');
  if (!update) return;
  await env.DB.prepare(update.sql).bind(...update.values, idValue).run();
}

async function dbSetListingArchived(
  recordId: string,
  archived: boolean,
  archiveReason: string | null,
  env: Env,
): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  await env.DB.prepare(
    'UPDATE listings SET archived = ?, archive_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(archived ? 1 : 0, archiveReason, idValue)
    .run();
  return true;
}

function mapInventoryRow(
  row: InventoryItemRow & { source_listing_price_asking?: number | null },
): Record<string, unknown> {
  return {
    id: String(row.id),
    sourceListingId: row.source_listing_id != null ? String(row.source_listing_id) : null,
    ccgNumber: row.ccg_number,
    imageUrl: toAdminImageUrl(row.image_url, 'thumb'),
    imageUrls: parseStoredInventoryImageUrls(row.image_urls, row.image_url),
    title: row.title,
    quantity: Number(row.quantity ?? 1),
    categoryId: row.category_id,
    categoryName: row.category_name || '',
    categoryPath: row.category_path || row.category_name || '',
    secondaryCategoryId: row.secondary_category_id,
    secondaryCategoryName: row.secondary_category_name || '',
    secondaryCategoryPath: row.secondary_category_path || row.secondary_category_name || '',
    brand: row.brand || '',
    queue: row.queue || 'Triage',
    yearRange: row.year_range || '',
    model: row.model || '',
    finish: row.finish || '',
    repairNotes: row.repair_notes || '',
    originalListingDesc: row.original_listing_desc || '',
    videoUrl: row.video_url || '',
    saleTitle: row.sale_title || '',
    regularPrice: row.regular_price ?? null,
    salePrice: row.sale_price ?? 0,
    condition: row.condition || '',
    saleDescription: row.sale_description || '',
    barcode: row.barcode || '',
    purchasedDate: row.purchased_date || '',
    purchasePrice: row.purchase_price,
    privatePartyValue: row.private_party_value,
    miles: Number(row.miles || 0),
    minutesSpent: Number(row.minutes_spent || 0),
    shipCost: Number(row.ship_cost || 0),
    purchaseNotes: row.purchase_notes || '',
    aiAnalysisText: row.ai_analysis_text || '',
    serialNumber: row.serial_number || '',
    isActive: Boolean(row.is_active),
    isMarked: Boolean(row.is_marked),
    isPersonal: Boolean(row.is_personal),
    isRented: Boolean(row.is_rented),
    forSale: Boolean(row.for_sale),
    onlyInStore: Boolean(row.only_in_store),
    forSaleDate: row.for_sale_date || null,
    isSold: Boolean(row.is_sold),
    soldDate: row.sold_date || null,
    soldAmount: row.sold_amount,
    sellNotes: row.sell_notes || '',
    saleUrl: row.sale_url || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    sourceListingPriceAsking: row.source_listing_price_asking ?? null,
  };
}

type InventoryListFilters = {
  categoryId: number | null;
  brand: string;
  queue: string;
  sold: 'all' | 'yes' | 'no';
  active: 'all' | 'yes' | 'no';
  marked: 'all' | 'yes' | 'no';
  personal: 'all' | 'yes' | 'no';
  page: number;
  limit: number;
  sortBy: InventorySortKey;
  sortDir: InventorySortDir;
};

type InventoryTriState = 'all' | 'yes' | 'no';

type InventorySortKey = 'ccgNumber' | 'title' | 'paid' | 'private' | 'soldPrice' | 'addDate';
type InventorySortDir = 'asc' | 'desc';

function parseInventorySortKey(input: string | null): InventorySortKey {
  switch ((input || '').trim()) {
    case 'ccgNumber':
      return 'ccgNumber';
    case 'paid':
      return 'paid';
    case 'private':
      return 'private';
    case 'soldPrice':
      return 'soldPrice';
    case 'addDate':
      return 'addDate';
    case 'title':
    default:
      return 'title';
  }
}

function parseInventorySortDir(input: string | null): InventorySortDir {
  return (input || '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function parseInventoryTriState(input: string | null, defaultValue: InventoryTriState): InventoryTriState {
  const normalized = (input || '').trim().toLowerCase();
  if (normalized === 'yes' || normalized === '1' || normalized === 'true') return 'yes';
  if (normalized === 'no' || normalized === '0' || normalized === 'false') return 'no';
  if (normalized === 'all') return 'all';
  return defaultValue;
}

const INVENTORY_QUEUE_OPTIONS = new Set([
  'Triage',
  'Repair',
  'To Sell',
  'For Sale',
  'Sold',
  'Rented',
  'Parking Lot',
]);

function normalizeInventoryQueue(input: unknown): string {
  const normalized = normalizeText(input, '').slice(0, 25);
  return INVENTORY_QUEUE_OPTIONS.has(normalized) ? normalized : '';
}

function slugifyShopCategory(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidSaleUrlSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

function parseAdminV2InventoryCategoryId(path: string): number | null {
  const parts = path.split('/').filter(Boolean);
  const categoriesIndex = parts.indexOf('categories');
  const rawId = categoriesIndex >= 0 ? parts[categoriesIndex + 1] : '';
  return parseOptionalPositiveInt(rawId);
}

const INVENTORY_CATEGORY_SELECT_SQL = `i.category_id,
       c.name AS category_name,
       CASE
         WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
         WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
         ELSE c.name
       END AS category_path,
       i.secondary_category_id,
       sc.name AS secondary_category_name,
       CASE
         WHEN sgp.id IS NOT NULL THEN sgp.name || ' > ' || sp.name || ' > ' || sc.name
         WHEN sp.id IS NOT NULL THEN sp.name || ' > ' || sc.name
         ELSE sc.name
       END AS secondary_category_path`;

const INVENTORY_CATEGORY_JOIN_SQL = `INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     LEFT JOIN ccg_inventory_categories sc ON sc.id = i.secondary_category_id
     LEFT JOIN ccg_inventory_categories sp ON sp.id = sc.parent_id
     LEFT JOIN ccg_inventory_categories sgp ON sgp.id = sp.parent_id`;

function inventoryOrderBySql(sortBy: InventorySortKey, sortDir: InventorySortDir): string {
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
  switch (sortBy) {
    case 'ccgNumber':
      return `LOWER(i.ccg_number) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'paid':
      return `CASE WHEN i.purchase_price IS NULL THEN 1 ELSE 0 END ASC, COALESCE(i.purchase_price, 0) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'private':
      return `CASE WHEN i.private_party_value IS NULL THEN 1 ELSE 0 END ASC, COALESCE(i.private_party_value, 0) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'soldPrice':
      return `COALESCE(i.sold_amount, 0) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'addDate':
      return `COALESCE(i.created_at, '') ${dir}, i.id ${dir}`;
    case 'title':
    default:
      return `LOWER(i.title) ${dir}, LOWER(i.ccg_number) ASC, i.id DESC`;
  }
}

function inventoryFilterClause(filters: Pick<InventoryListFilters, 'categoryId' | 'brand' | 'queue' | 'sold' | 'active' | 'marked' | 'personal'>): { sql: string; binds: unknown[] } {
  const clauses: string[] = ['1 = 1'];
  const binds: unknown[] = [];

  if (filters.sold !== 'all') {
    clauses.push('COALESCE(i.is_sold, 0) = ?');
    binds.push(filters.sold === 'yes' ? 1 : 0);
  }

  if (filters.active !== 'all') {
    clauses.push('COALESCE(i.is_active, 0) = ?');
    binds.push(filters.active === 'yes' ? 1 : 0);
  }

  if (filters.categoryId != null) {
    clauses.push('i.category_id = ?');
    binds.push(filters.categoryId);
  }
  if (filters.brand) {
    clauses.push('LOWER(COALESCE(i.brand, \'\')) = LOWER(?)');
    binds.push(filters.brand);
  }
  if (filters.queue) {
    clauses.push('COALESCE(i.queue, ?) = ?');
    binds.push('Triage', filters.queue);
  }
  if (filters.marked !== 'all') {
    clauses.push('COALESCE(i.is_marked, 0) = ?');
    binds.push(filters.marked === 'yes' ? 1 : 0);
  }
  if (filters.personal !== 'all') {
    clauses.push('COALESCE(i.is_personal, 0) = ?');
    binds.push(filters.personal === 'yes' ? 1 : 0);
  }
  return {
    sql: clauses.join(' AND '),
    binds,
  };
}

async function dbListInventoryItems(
  filters: InventoryListFilters,
  env: Env,
): Promise<{ records: Array<Record<string, unknown>>; total: number; page: number; limit: number; totalPages: number }> {
  const clause = inventoryFilterClause(filters);
  const orderBy = inventoryOrderBySql(filters.sortBy, filters.sortDir);

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM ccg_inventory_items i
     WHERE ${clause.sql}`
  ).bind(...clause.binds).first<{ total: number | null }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const safePage = Math.min(filters.page, totalPages);
  const safeOffset = (safePage - 1) * filters.limit;

  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.source_listing_id,
       i.ccg_number,
       i.image_url,
       i.image_urls,
       i.title,
       i.quantity,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.brand,
       i.queue,
       i.year_range,
       i.model,
       i.finish,
       i.repair_notes,
       i.original_listing_desc,
       i.video_url,
       i.sale_title,
       i.regular_price,
       i.sale_price,
       i.condition,
       i.sale_description,
       i.barcode,
       i.purchased_date,
       i.purchase_price,
       i.private_party_value,
       i.miles,
       i.minutes_spent,
       i.ship_cost,
       i.purchase_notes,
       i.ai_analysis_text,
       i.serial_number,
       i.is_active,
       i.is_marked,
       i.is_personal,
       i.is_rented,
       i.for_sale,
       i.only_in_store,
       i.for_sale_date,
       i.is_sold,
       i.sold_date,
       i.sold_amount,
       i.sell_notes,
       i.sale_url,
       i.created_at,
       i.updated_at,
       l.price_asking AS source_listing_price_asking
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     LEFT JOIN listings l ON l.id = i.source_listing_id
     WHERE ${clause.sql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`
  ).bind(...clause.binds, filters.limit, safeOffset).all<InventoryItemRow & {
    source_listing_price_asking: number | null;
  }>();

  return {
    records: (result.results ?? []).map((row) => mapInventoryRow(row)),
    total,
    page: safePage,
    limit: filters.limit,
    totalPages,
  };
}

async function dbListInventoryBrands(
  filters: Pick<InventoryListFilters, 'categoryId' | 'sold' | 'active' | 'marked' | 'personal' | 'queue'>,
  env: Env,
): Promise<string[]> {
  const clause = inventoryFilterClause({ ...filters, brand: '' });
  const result = await env.DB.prepare(
    `SELECT DISTINCT TRIM(COALESCE(i.brand, '')) AS brand
     FROM ccg_inventory_items i
     WHERE ${clause.sql}
       AND TRIM(COALESCE(i.brand, '')) <> ''
     ORDER BY LOWER(TRIM(COALESCE(i.brand, ''))) ASC`
  ).bind(...clause.binds).all<{ brand: string | null }>();
  return (result.results ?? [])
    .map((row) => String(row.brand || '').trim())
    .filter(Boolean);
}

async function dbGetInventoryItem(recordId: string, env: Env): Promise<Record<string, unknown> | null> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return null;
  const row = await env.DB.prepare(
    `SELECT
      i.id,
      i.source_listing_id,
      i.ccg_number,
      i.image_url,
      i.image_urls,
      i.title,
      i.quantity,
      ${INVENTORY_CATEGORY_SELECT_SQL},
      i.brand,
      i.queue,
      i.year_range,
      i.model,
      i.finish,
      i.repair_notes,
      i.original_listing_desc,
      i.video_url,
      i.sale_title,
      i.regular_price,
      i.sale_price,
      i."condition",
      i.sale_description,
      i.clearance,
      i.bullet_1_text,
      i.bullet_1_danger,
      i.bullet_1_highlight,
      i.bullet_2_text,
      i.bullet_2_danger,
      i.bullet_2_highlight,
      i.bullet_3_text,
      i.bullet_3_danger,
      i.bullet_3_highlight,
      i.bullet_4_text,
      i.bullet_4_danger,
      i.bullet_4_highlight,
      i.bullet_5_text,
      i.bullet_5_danger,
      i.bullet_5_highlight,
      i.bullet_6_text,
      i.bullet_6_danger,
      i.bullet_6_highlight,
      i.barcode,
      i.purchased_date,
      i.purchase_price,
      i.private_party_value,
      i.miles,
      i.minutes_spent,
      i.ship_cost,
      i.purchase_notes,
      i.ai_analysis_text,
      i.serial_number,
      i.weight_lbs,
      i.neck_profile,
      i.neck_thickness,
      i.nut_width,
      i.width_12_fret,
      i.fretboard_radius,
      i.twelve_fret_action,
      i.is_active,
      i.is_marked,
      i.is_personal,
      i.is_rented,
      i.for_sale,
      i.only_in_store,
      i.for_sale_date,
      i.is_sold,
      i.sold_date,
      i.sold_amount,
      i.sell_notes,
      i.subscription_id,
      i.package_id,
      i.sale_url,
      i.sale_zip,
      i.storage_location,
      i.sold_channel,
      i.created_at,
      i.updated_at
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE i.id = ?`
  ).bind(idValue).first<InventoryItemRow>();
  if (!row) return null;
  const storedImages = await dbListInventoryImagesForItemIds([row.id], env);
  const imageDetails = storedImages.get(row.id) ?? [];
  const imageUrls = imageDetails.length > 0
    ? imageDetails.map((image) => image.url)
    : parseStoredInventoryImageUrls(row.image_urls, row.image_url);
  return {
    id: String(row.id),
    sourceListingId: row.source_listing_id != null ? String(row.source_listing_id) : null,
    ccgNumber: row.ccg_number,
    imageUrl: imageUrls[0] ?? row.image_url,
    imageUrls,
    images: imageDetails,
    title: row.title,
    quantity: Number(row.quantity ?? 1),
    categoryId: row.category_id,
    categoryName: row.category_name || '',
    categoryPath: row.category_path || row.category_name || '',
    secondaryCategoryId: row.secondary_category_id,
    secondaryCategoryName: row.secondary_category_name || '',
    secondaryCategoryPath: row.secondary_category_path || row.secondary_category_name || '',
    brand: row.brand || '',
    queue: row.queue || 'Triage',
    yearRange: row.year_range || '',
    model: row.model || '',
    finish: row.finish || '',
    repairNotes: row.repair_notes || '',
    originalListingDesc: row.original_listing_desc || '',
    videoUrl: row.video_url || '',
    saleTitle: row.sale_title || '',
    regularPrice: row.regular_price ?? null,
    salePrice: row.sale_price ?? 0,
    condition: row.condition || '',
    saleDescription: row.sale_description || '',
    clearance: Boolean(row.clearance),
    bullet1Text: row.bullet_1_text || '',
    bullet1Danger: Boolean(row.bullet_1_danger),
    bullet1Highlight: Boolean(row.bullet_1_highlight),
    bullet2Text: row.bullet_2_text || '',
    bullet2Danger: Boolean(row.bullet_2_danger),
    bullet2Highlight: Boolean(row.bullet_2_highlight),
    bullet3Text: row.bullet_3_text || '',
    bullet3Danger: Boolean(row.bullet_3_danger),
    bullet3Highlight: Boolean(row.bullet_3_highlight),
    bullet4Text: row.bullet_4_text || '',
    bullet4Danger: Boolean(row.bullet_4_danger),
    bullet4Highlight: Boolean(row.bullet_4_highlight),
    bullet5Text: row.bullet_5_text || '',
    bullet5Danger: Boolean(row.bullet_5_danger),
    bullet5Highlight: Boolean(row.bullet_5_highlight),
    bullet6Text: row.bullet_6_text || '',
    bullet6Danger: Boolean(row.bullet_6_danger),
    bullet6Highlight: Boolean(row.bullet_6_highlight),
    barcode: row.barcode || '',
    purchasedDate: row.purchased_date || '',
    purchasePrice: row.purchase_price,
    privatePartyValue: row.private_party_value,
    miles: Number(row.miles || 0),
    minutesSpent: Number(row.minutes_spent || 0),
    shipCost: Number(row.ship_cost || 0),
    purchaseNotes: row.purchase_notes || '',
    aiAnalysisText: row.ai_analysis_text || '',
    serialNumber: row.serial_number || '',
    weightLbs: row.weight_lbs || '',
    neckProfile: row.neck_profile || '',
    neckThickness: row.neck_thickness || '',
    nutWidth: row.nut_width || '',
    width12Fret: row.width_12_fret || '',
    fretboardRadius: row.fretboard_radius || '',
    twelveFretAction: row.twelve_fret_action || '',
    isActive: Boolean(row.is_active),
    isMarked: Boolean(row.is_marked),
    isPersonal: Boolean(row.is_personal),
    isRented: Boolean(row.is_rented),
    forSale: Boolean(row.for_sale),
    onlyInStore: Boolean(row.only_in_store),
    forSaleDate: row.for_sale_date || null,
    isSold: Boolean(row.is_sold),
    soldDate: row.sold_date || null,
    soldAmount: row.sold_amount,
    sellNotes: row.sell_notes || '',
    subscriptionId: row.subscription_id ?? null,
    packageId: row.package_id ?? null,
    saleUrl: row.sale_url || '',
    saleZip: row.sale_zip || '',
    storageLocation: row.storage_location || '',
    soldChannel: row.sold_channel || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

async function dbFindInventoryBySourceListingId(sourceListingId: number, env: Env): Promise<{ id: number } | null> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE source_listing_id = ? LIMIT 1'
  ).bind(sourceListingId).first<{ id: number }>();
  return row || null;
}

async function dbFindInventoryBySaleUrl(
  saleUrl: string,
  env: Env,
  excludeId?: string,
): Promise<{ id: number; ccg_number: string | null; title: string | null } | null> {
  const normalizedSaleUrl = saleUrl.trim();
  if (!normalizedSaleUrl) return null;

  const excludeRecordId = Number(excludeId || 0);
  if (Number.isFinite(excludeRecordId) && excludeRecordId > 0) {
    const row = await env.DB.prepare(
      `SELECT id, ccg_number, title
       FROM ccg_inventory_items
       WHERE LOWER(sale_url) = LOWER(?)
         AND id != ?
       LIMIT 1`
    ).bind(normalizedSaleUrl, excludeRecordId).first<{ id: number; ccg_number: string | null; title: string | null }>();
    return row || null;
  }

  const row = await env.DB.prepare(
    `SELECT id, ccg_number, title
     FROM ccg_inventory_items
     WHERE LOWER(sale_url) = LOWER(?)
     LIMIT 1`
  ).bind(normalizedSaleUrl).first<{ id: number; ccg_number: string | null; title: string | null }>();
  return row || null;
}

async function dbFindRecentDuplicateInventoryCreate(
  fields: {
    source_listing_id: number | null;
    image_url: string;
    title: string;
    category_id: number;
    secondary_category_id: number | null;
    brand: string | null;
    year_range: string | null;
    model: string | null;
    finish: string | null;
    purchased_date: string;
    purchase_price: number | null;
  },
  env: Env
): Promise<{ id: number; ccg_number: string } | null> {
  if (fields.source_listing_id != null) {
    const row = await env.DB.prepare(
      'SELECT id, ccg_number FROM ccg_inventory_items WHERE source_listing_id = ? LIMIT 1'
    ).bind(fields.source_listing_id).first<{ id: number; ccg_number: string }>();
    return row || null;
  }

  const row = await env.DB.prepare(
    `SELECT id, ccg_number
     FROM ccg_inventory_items
     WHERE source_listing_id IS NULL
       AND title = ?
       AND image_url = ?
       AND category_id = ?
       AND ((secondary_category_id IS NULL AND ? IS NULL) OR secondary_category_id = ?)
       AND IFNULL(brand, '') = ?
       AND IFNULL(year_range, '') = ?
       AND IFNULL(model, '') = ?
       AND IFNULL(finish, '') = ?
       AND purchased_date = ?
       AND ((purchase_price IS NULL AND ? IS NULL) OR purchase_price = ?)
       AND created_at >= datetime('now', '-2 minutes')
     ORDER BY id DESC
     LIMIT 1`
  ).bind(
    fields.title,
    fields.image_url,
    fields.category_id,
    fields.secondary_category_id,
    fields.secondary_category_id,
    fields.brand || '',
    fields.year_range || '',
    fields.model || '',
    fields.finish || '',
    fields.purchased_date,
    fields.purchase_price,
    fields.purchase_price,
  ).first<{ id: number; ccg_number: string }>();
  return row || null;
}

async function dbCcgNumberExists(ccgNumber: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE ccg_number = ? LIMIT 1'
  ).bind(ccgNumber).first<{ id: number }>();
  return Boolean(row?.id);
}

async function dbInventoryBarcodeExists(barcode: string, env: Env): Promise<boolean> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) return false;
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE barcode = ? LIMIT 1'
  ).bind(normalizedBarcode).first<{ id: number }>();
  return Boolean(row?.id);
}

async function dbInventoryItemHasPackageChildren(recordId: number, env: Env): Promise<boolean> {
  if (!Number.isFinite(recordId) || recordId <= 0) return false;
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE package_id = ? LIMIT 1'
  ).bind(recordId).first<{ id: number }>();
  return Boolean(row?.id);
}

async function dbInventoryCategoryExists(categoryId: number, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_categories WHERE id = ? LIMIT 1'
  ).bind(categoryId).first<{ id: number }>();
  return Boolean(row?.id);
}

async function dbCreateInventoryCategory(
  fields: { name: string; parent_id: number | null; order: number },
  env: Env,
): Promise<InventoryCategoryRow | null> {
  try {
    const result = await env.DB.prepare(
      'INSERT INTO ccg_inventory_categories (name, parent_id, "order") VALUES (?, ?, ?)'
    ).bind(fields.name, fields.parent_id, fields.order).run();
    const id = Number(result.meta?.last_row_id || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id, name: fields.name, parent_id: fields.parent_id, order: fields.order };
  } catch (error) {
    console.error('Inventory category create failed', { error });
    return null;
  }
}

async function dbUpdateInventoryCategory(
  categoryId: number,
  fields: { name: string; parent_id: number | null; order: number },
  env: Env,
): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      'UPDATE ccg_inventory_categories SET name = ?, parent_id = ?, "order" = ? WHERE id = ?'
    ).bind(fields.name, fields.parent_id, fields.order, categoryId).run();
    return Number(result.meta?.changes || 0) > 0;
  } catch (error) {
    console.error('Inventory category update failed', { error });
    return false;
  }
}

async function dbDeleteInventoryCategory(categoryId: number, env: Env): Promise<number> {
  try {
    const result = await env.DB.prepare(
      'DELETE FROM ccg_inventory_categories WHERE id = ?'
    ).bind(categoryId).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory category delete failed', { error });
    return 0;
  }
}

async function dbCountInventoryCategoryChildren(categoryId: number, env: Env): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM ccg_inventory_categories WHERE parent_id = ?'
  ).bind(categoryId).first<{ total: number | null }>();
  return Number(row?.total || 0);
}

async function dbCountInventoryItemsForCategory(categoryId: number, env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM ccg_inventory_items
     WHERE category_id = ? OR secondary_category_id = ?`
  ).bind(categoryId, categoryId).first<{ total: number | null }>();
  return Number(row?.total || 0);
}

async function dbInventoryCategoryParentWouldCreateCycle(
  categoryId: number,
  parentId: number,
  env: Env,
): Promise<boolean> {
  let currentParentId: number | null = parentId;
  const seen = new Set<number>();
  while (currentParentId != null) {
    if (currentParentId === categoryId) return true;
    if (seen.has(currentParentId)) return true;
    seen.add(currentParentId);
    const row = await env.DB.prepare(
      'SELECT parent_id FROM ccg_inventory_categories WHERE id = ? LIMIT 1'
    ).bind(currentParentId).first<{ parent_id: number | null }>();
    currentParentId = row?.parent_id ?? null;
  }
  return false;
}

async function dbFindTopLevelPackageCategoryId(env: Env): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT id
     FROM ccg_inventory_categories
     WHERE parent_id IS NULL
       AND LOWER(name) LIKE ?
     ORDER BY "order" ASC, LOWER(name) ASC, id ASC
     LIMIT 1`
  ).bind('%package%').first<{ id: number }>();
  return row?.id ?? null;
}

async function dbListInventoryCategories(env: Env): Promise<InventoryCategoryRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, name, parent_id, "order"
     FROM ccg_inventory_categories
     ORDER BY
       CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END ASC,
       COALESCE(parent_id, id) ASC,
       "order" ASC,
       LOWER(name) ASC,
       id ASC`
  ).all<InventoryCategoryRow>();
  return result.results ?? [];
}

async function dbListShopProducts(
  filters: {
    categoryIds: number[];
    search: string;
    showSold: boolean;
    associateMode: boolean;
    priceMin: number;
    priceMax: number;
    condition: string;
  },
  env: Env,
): Promise<Array<Record<string, unknown>>> {
  const categoryRows = await dbListInventoryCategories(env);
  const allowedCategoryIds = expandInventoryCategoryIds(filters.categoryIds, categoryRows);

  const clauses: string[] = [
    'COALESCE(i.is_active, 0) = 1',
    filters.showSold ? 'COALESCE(i.is_sold, 0) = 1' : 'COALESCE(i.is_sold, 0) = 0',
  ];
  const binds: unknown[] = [];

  if (!filters.showSold) {
    clauses.push('COALESCE(i.for_sale, 0) = 1');
  }
  if (!filters.associateMode) {
    clauses.push('COALESCE(i.only_in_store, 0) = 0');
  }
  clauses.push('COALESCE(i.is_rented, 0) = 0');

  if (allowedCategoryIds.length > 0) {
    const placeholders = allowedCategoryIds.map(() => '?').join(', ');
    clauses.push(`(
      i.category_id IN (${placeholders})
      OR COALESCE(i.secondary_category_id, 0) IN (${placeholders})
    )`);
    binds.push(...allowedCategoryIds, ...allowedCategoryIds);
  }

  if (filters.search) {
    clauses.push(`(
      LOWER(COALESCE(i.sale_title, '')) LIKE ?
      OR LOWER(COALESCE(i.title, '')) LIKE ?
    )`);
    const term = `%${filters.search.toLowerCase()}%`;
    binds.push(term, term);
  }

  if (filters.condition) {
    clauses.push('LOWER(COALESCE(i."condition", \'\')) = LOWER(?)');
    binds.push(filters.condition);
  }

  if (!(filters.priceMin === 0 && filters.priceMax === 0)) {
    clauses.push(`(
      CASE
        WHEN COALESCE(i.sale_price, 0) > 0 THEN COALESCE(i.sale_price, 0)
        ELSE COALESCE(i.regular_price, 0)
      END
    ) >= ? AND (
      CASE
        WHEN COALESCE(i.sale_price, 0) > 0 THEN COALESCE(i.sale_price, 0)
        ELSE COALESCE(i.regular_price, 0)
      END
    ) <= ?`);
    binds.push(filters.priceMin, filters.priceMax > 0 ? filters.priceMax : Number.MAX_SAFE_INTEGER);
  }

  const whereSql = clauses.join(' AND ');
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       i.title,
       i.sale_title,
       i.sale_url,
       i.regular_price,
       i.sale_price,
       i.clearance,
       i.only_in_store,
       i."condition",
       i.sale_description,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE ${whereSql}
     ORDER BY
       c."order" ASC,
       LOWER(COALESCE(i.sale_title, i.title, '')) ASC,
       i.id DESC`
  ).bind(...binds).all<ShopProductRow>();

  return (result.results ?? []).map((row) => {
    const mainImage = toPublicShopImageUrl(row.image_url, 'card');
    return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    mainImage,
    saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
    saleUrlSlug: normalizeText(row.sale_url, ''),
    saleCondition: row.condition || '',
    saleDescription: row.sale_description || '',
    regularPrice: row.regular_price,
    salePrice: row.sale_price ?? 0,
    clearance: Boolean(row.clearance),
    category: getInventoryCategoryLabel(row),
    primaryCategoryName: normalizeText(row.category_name, ''),
    secondaryCategory: normalizeText(row.secondary_category_name, ''),
    onlyInStore: Boolean(row.only_in_store),
    isSold: Boolean(row.is_sold),
    };
  });
}

async function dbSearchShopProductsByTitle(
  query: string,
  env: Env,
  options: { associateMode: boolean },
): Promise<Array<Record<string, unknown>>> {
  const term = `%${query.toLowerCase()}%`;
  const onlyInStoreClause = options.associateMode ? '' : '       AND COALESCE(i.only_in_store, 0) = 0\n';
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       i.title,
       i.sale_title,
       i.sale_url,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.for_sale, 0) = 1
       AND COALESCE(i.is_sold, 0) = 0
${onlyInStoreClause}       AND COALESCE(i.is_rented, 0) = 0
       AND LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) LIKE ?
     ORDER BY
       LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) ASC,
       i.id DESC
     LIMIT 10`
  ).bind(term).all<ShopProductRow>();

  return (result.results ?? []).map((row) => {
    const mainImage = toPublicShopImageUrl(row.image_url, 'thumb');

    return {
      id: String(row.id),
      ccgNumber: normalizeText(row.ccg_number, ''),
      mainImage,
      saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
      saleUrlSlug: normalizeText(row.sale_url, ''),
      primaryCategoryName: normalizeText(row.category_name, ''),
      isSold: Boolean(row.is_sold),
    };
  });
}

async function dbFindShopProductByBarcode(
  barcode: string,
  env: Env,
  options: { associateMode: boolean },
): Promise<Record<string, unknown> | null> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) return null;

  const onlyInStoreClause = options.associateMode ? '' : '       AND COALESCE(i.only_in_store, 0) = 0\n';
  const row = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       i.title,
       i.sale_title,
       i.sale_url,
       i.barcode,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.for_sale, 0) = 1
       AND COALESCE(i.is_sold, 0) = 0
${onlyInStoreClause}       AND COALESCE(i.is_rented, 0) = 0
       AND TRIM(COALESCE(i.barcode, '')) = ?
     ORDER BY i.id DESC
     LIMIT 1`
  ).bind(normalizedBarcode).first<ShopProductRow>();

  if (!row) return null;

  const mainImage = toPublicShopImageUrl(row.image_url, 'thumb');

  return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    mainImage,
    saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
    saleUrlSlug: normalizeText(row.sale_url, ''),
    primaryCategoryName: normalizeText(row.category_name, ''),
    isSold: Boolean(row.is_sold),
  };
}

async function dbListShopSitemapProducts(env: Env): Promise<Array<Record<string, unknown>>> {
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.sale_url,
       i.updated_at,
       i.for_sale,
       i.is_sold,
       ${INVENTORY_CATEGORY_SELECT_SQL}
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.only_in_store, 0) = 0
       AND COALESCE(i.is_rented, 0) = 0
       AND TRIM(COALESCE(i.sale_url, '')) != ''
     ORDER BY
       c."order" ASC,
       LOWER(COALESCE(i.sale_title, i.title, '')) ASC,
       i.id DESC`
  ).all<ShopProductRow & { updated_at: string | null }>();

  return (result.results ?? []).map((row) => {
    const categorySlug = slugifyShopCategory(normalizeText(row.category_name, ''));
    const productSlug = normalizeText(row.sale_url, '');
    if (!isValidSaleUrlSlug(productSlug)) return null;
    return {
      id: String(row.id),
      urlPath: categorySlug && productSlug
        ? `/guitars-and-gear-for-sale/${categorySlug}/${productSlug}`
        : '',
      updatedAt: normalizeText(row.updated_at, ''),
      forSale: Boolean(row.for_sale),
      isSold: Boolean(row.is_sold),
    };
  }).filter((record): record is Record<string, unknown> => Boolean(record?.urlPath));
}

async function dbCreateNewsletterSubscriber(email: string, env: Env): Promise<boolean> {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO email_newsletter (email)
     VALUES (?)`
  ).bind(email).run();
  return Number((result as any)?.meta?.changes || 0) > 0;
}

async function dbGetShopProductDetail(
  lookup: { id: number } | { slug: string },
  env: Env,
  options: { includeInStoreOnly?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const lookupClause = 'id' in lookup ? 'i.id = ?' : 'LOWER(i.sale_url) = LOWER(?)';
  const lookupValue = 'id' in lookup ? lookup.id : lookup.slug;
  const row = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       i.image_url,
       i.image_urls,
       i.title,
       i.quantity,
       i.sale_title,
       i.sale_url,
       i.sale_zip,
       i.brand,
       i.model,
       i.finish,
       i.video_url,
       i.weight_lbs,
       i.neck_profile,
       i.neck_thickness,
       i.nut_width,
       i.width_12_fret,
       i.fretboard_radius,
       i.twelve_fret_action,
       i.regular_price,
       i.sale_price,
       i.clearance,
       i.only_in_store,
       i."condition",
       i.sale_description,
       i.bullet_1_text,
       i.bullet_1_danger,
       i.bullet_1_highlight,
       i.bullet_2_text,
       i.bullet_2_danger,
       i.bullet_2_highlight,
       i.bullet_3_text,
       i.bullet_3_danger,
       i.bullet_3_highlight,
       i.bullet_4_text,
       i.bullet_4_danger,
       i.bullet_4_highlight,
       i.bullet_5_text,
       i.bullet_5_danger,
       i.bullet_5_highlight,
       i.bullet_6_text,
       i.bullet_6_danger,
       i.bullet_6_highlight,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.for_sale,
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE ${lookupClause}
       AND COALESCE(i.is_active, 0) = 1
       ${options.includeInStoreOnly ? '' : 'AND COALESCE(i.only_in_store, 0) = 0'}
       AND COALESCE(i.is_rented, 0) = 0
     LIMIT 1`
  ).bind(lookupValue).first<ShopProductRow>();

  if (!row) return null;

  const imageRows = await env.DB.prepare(
    `SELECT image_url, is_private
     FROM ccg_inventory_item_images
     WHERE inventory_item_id = ?
     ORDER BY display_order ASC, id ASC`
  ).bind(row.id).all<{ image_url: string | null; is_private: number | null }>();

  const storedImageRows = imageRows.results ?? [];
  const sourceImages = storedImageRows.length > 0
    ? storedImageRows
      .filter((imageRow) => !imageRow.is_private)
      .map((imageRow) => imageRow.image_url)
    : parseStoredInventoryImageUrls(row.image_urls || null, row.image_url || null);
  const images = Array.from(new Set(sourceImages.map((imageUrl) => toPublicShopImageUrl(imageUrl, 'detail')).filter(Boolean)));

  const mainImage = images[0] || '';
  const highlights = [
    { text: normalizeText(row.bullet_1_text, ''), danger: Boolean(row.bullet_1_danger), highlight: Boolean(row.bullet_1_highlight) },
    { text: normalizeText(row.bullet_2_text, ''), danger: Boolean(row.bullet_2_danger), highlight: Boolean(row.bullet_2_highlight) },
    { text: normalizeText(row.bullet_3_text, ''), danger: Boolean(row.bullet_3_danger), highlight: Boolean(row.bullet_3_highlight) },
    { text: normalizeText(row.bullet_4_text, ''), danger: Boolean(row.bullet_4_danger), highlight: Boolean(row.bullet_4_highlight) },
    { text: normalizeText(row.bullet_5_text, ''), danger: Boolean(row.bullet_5_danger), highlight: Boolean(row.bullet_5_highlight) },
    { text: normalizeText(row.bullet_6_text, ''), danger: Boolean(row.bullet_6_danger), highlight: Boolean(row.bullet_6_highlight) },
  ].filter((item) => item.text);

  return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    mainImage,
    images,
    saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
    quantity: Number(row.quantity ?? 1),
    saleUrlSlug: normalizeText(row.sale_url, ''),
    saleZip: normalizeText(row.sale_zip, ''),
    saleCondition: row.condition || '',
    saleDescription: row.sale_description || '',
    highlights,
    brand: normalizeText(row.brand, ''),
    model: normalizeText(row.model, ''),
    finish: normalizeText(row.finish, ''),
    youtubeUrl: normalizeText(row.video_url, ''),
    regularPrice: row.regular_price,
    salePrice: row.sale_price ?? 0,
    clearance: Boolean(row.clearance),
    onlyInStore: Boolean(row.only_in_store),
    category: getInventoryCategoryLabel(row),
    primaryCategoryName: normalizeText(row.category_name, ''),
    secondaryCategory: normalizeText(row.secondary_category_name, ''),
    forSale: Boolean(row.for_sale),
    guitarSpecs: [
      { label: 'Weight (lbs)', value: normalizeText(row.weight_lbs, '') },
      { label: 'Neck Profile', value: normalizeText(row.neck_profile, '') },
      { label: 'Neck Thickness', value: normalizeText(row.neck_thickness, '') },
      { label: 'Nut Width', value: normalizeText(row.nut_width, '') },
      { label: 'Neck Width (12th Fret)', value: normalizeText(row.width_12_fret, '') },
      { label: 'Fretboard Radius', value: normalizeText(row.fretboard_radius, '') },
      { label: '12th Fret Action', value: normalizeText(row.twelve_fret_action, '') },
    ].filter((item) => item.value && item.value.toLowerCase() !== 'unknown'),
    isSold: Boolean(row.is_sold),
  };
}

async function dbListCheckoutInventoryItems(
  itemIds: number[],
  env: Env,
): Promise<ShopCheckoutInventoryRow[]> {
  const uniqueIds = Array.from(new Set(itemIds)).filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT
       id,
       title,
       sale_title,
       brand,
       model,
       "condition",
       image_url,
       regular_price,
       sale_price,
       quantity,
       for_sale,
       only_in_store,
       is_sold,
       is_active,
       is_rented,
       availability_status,
       active_order_id,
       reserved_until
     FROM ccg_inventory_items
     WHERE id IN (${placeholders})`
  ).bind(...uniqueIds).all<ShopCheckoutInventoryRow>();
  return result.results ?? [];
}

async function buildPaymentLinkCheckoutOrderItems(
  session: any,
  event: any,
  env: Env,
): Promise<ShopCheckoutLineItem[]> {
  const sessionId = normalizeText(session?.id, '');
  const fallbackIds = parseStripeInventoryItemIds(session);
  const stripeLineItems = sessionId
    ? await listStripeCheckoutSessionLineItems(sessionId, event?.livemode === true, env)
    : [];
  const byInventoryId = new Map<number, {
    quantity: number;
    subtotalCents: number;
    title: string;
  }>();

  for (const lineItem of stripeLineItems) {
    const inventoryItemId = getStripeLineItemInventoryItemId(lineItem);
    if (!inventoryItemId) continue;
    const quantity = parseOptionalPositiveInt(lineItem?.quantity) ?? 1;
    const subtotalCents = numberOrZero(lineItem?.amount_subtotal)
      || numberOrZero(lineItem?.amount_total);
    const existing = byInventoryId.get(inventoryItemId);
    byInventoryId.set(inventoryItemId, {
      quantity: (existing?.quantity ?? 0) + quantity,
      subtotalCents: (existing?.subtotalCents ?? 0) + subtotalCents,
      title: existing?.title || getStripeLineItemTitle(lineItem),
    });
  }

  for (const inventoryItemId of fallbackIds) {
    if (!byInventoryId.has(inventoryItemId)) {
      byInventoryId.set(inventoryItemId, {
        quantity: 1,
        subtotalCents: 0,
        title: '',
      });
    }
  }

  const inventoryItemIds = Array.from(byInventoryId.keys());
  if (inventoryItemIds.length === 0) return [];

  const rows = await dbListCheckoutInventoryItems(inventoryItemIds, env);
  const rowsById = new Map(rows.map((row) => [Number(row.id), row]));

  return inventoryItemIds.map((inventoryItemId) => {
    const line = byInventoryId.get(inventoryItemId);
    const row = rowsById.get(inventoryItemId) || buildMissingPaymentLinkInventoryRow(inventoryItemId, line?.title || 'Item');
    const quantity = Math.max(1, line?.quantity ?? 1);
    const lineSubtotalCents = Math.max(0, line?.subtotalCents ?? 0);
    const currentPriceCents = Math.round(Number(row.sale_price || row.regular_price || 0) * 100);
    const unitAmountCents = lineSubtotalCents > 0
      ? Math.round(lineSubtotalCents / quantity)
      : Number.isFinite(currentPriceCents) && currentPriceCents > 0
        ? currentPriceCents
        : 0;
    return {
      inventoryItemId,
      quantity,
      row,
      title: line?.title || getCheckoutItemTitle(row),
      unitAmountCents,
      imageUrl: toPublicShopImageUrl(row.image_url, 'thumb'),
    };
  });
}

async function listStripeCheckoutSessionLineItems(
  checkoutSessionId: string,
  livemode: boolean,
  env: Env,
): Promise<any[]> {
  const { secretKey } = await getStripeRuntimeConfigForLivemode(livemode, env);
  if (!secretKey || !checkoutSessionId) return [];

  const params = new URLSearchParams();
  params.set('limit', '100');
  params.append('expand[]', 'data.price.product');

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}/line_items?${params.toString()}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const data = await response.json<any>();
    if (!response.ok) {
      console.warn('Stripe checkout session line items lookup failed', {
        checkoutSessionId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
      return [];
    }
    return Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    console.warn('Stripe checkout session line items lookup failed', { checkoutSessionId, error });
    return [];
  }
}

function getStripeLineItemInventoryItemId(lineItem: any): number | null {
  const product = lineItem?.price?.product;
  return parseOptionalPositiveInt(lineItem?.metadata?.inventory_item_id)
    ?? parseOptionalPositiveInt(lineItem?.price?.metadata?.inventory_item_id)
    ?? parseOptionalPositiveInt(typeof product === 'object' ? product?.metadata?.inventory_item_id : null);
}

function getStripeLineItemTitle(lineItem: any): string {
  const product = lineItem?.price?.product;
  return normalizeText(
    lineItem?.description
      ?? (typeof product === 'object' ? product?.name : '')
      ?? lineItem?.price?.nickname,
    'Item',
  );
}

function buildMissingPaymentLinkInventoryRow(
  inventoryItemId: number,
  title: string,
): ShopCheckoutInventoryRow {
  return {
    id: inventoryItemId,
    title,
    sale_title: title,
    brand: '',
    model: '',
    condition: '',
    image_url: '',
    regular_price: 0,
    sale_price: 0,
    quantity: 1,
    for_sale: 0,
    only_in_store: 0,
    is_sold: 0,
    is_active: 0,
    is_rented: 0,
    availability_status: '',
    active_order_id: null,
    reserved_until: null,
  };
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function stripeTimestampToIso(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return new Date(seconds * 1000).toISOString();
}

async function dbGetTableColumns(
  tableName: string,
  env: Env,
): Promise<Array<{ name: string; type: string | null; notnull: number | null; dflt_value: string | null; pk: number | null }>> {
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeTableName) return [];
  const result = await env.DB.prepare(`PRAGMA table_info(${safeTableName})`).all<{
    name: string;
    type: string | null;
    notnull: number | null;
    dflt_value: string | null;
    pk: number | null;
  }>();
  return result.results ?? [];
}

async function dbCreateCheckoutOrder(
  input: {
    orderId: string;
    orderNumber: string;
    status: string;
    channel: string;
    fulfillmentType: string;
    checkoutType: string;
    checkoutProvider: string;
    checkoutMode: string;
    subtotalCents: number;
    discountCents: number;
    couponCode: string | null;
    taxCents: number;
    totalCents: number;
    cardAmountCents?: number | null;
    cashAmountCents?: number | null;
    successUrl: string;
    cancelUrl: string;
    createdAt: string;
    customerName?: string;
    customerEmail?: string;
    items: Array<{
      inventoryItemId: number;
      quantity: number;
      row: ShopCheckoutInventoryRow;
      title: string;
      unitAmountCents: number;
      imageUrl: string;
    }>;
  },
  env: Env,
): Promise<void> {
  const orderColumns = await dbGetTableColumns('orders', env);
  const firstItem = input.items[0];
  const orderTitleSnapshot = input.items.length === 1
    ? firstItem.title
    : `${firstItem.title} + ${input.items.length - 1} more`;
  const orderValueByColumn = new Map<string, unknown>([
    ['id', input.orderId],
    ['order_number', input.orderNumber],
    ['inventory_item_id', firstItem.inventoryItemId],
    ['status', input.status],
    ['channel', input.channel],
    ['checkout_type', input.checkoutType],
    ['checkout_provider', input.checkoutProvider],
    ['checkout_mode', input.checkoutMode],
    ['fulfillment_type', input.fulfillmentType],
    ['item_title_snapshot', orderTitleSnapshot],
    ['item_brand_snapshot', firstItem.row.brand || ''],
    ['item_model_snapshot', firstItem.row.model || ''],
    ['item_condition_snapshot', firstItem.row.condition || ''],
    ['item_image_url_snapshot', firstItem.imageUrl],
    ['subtotal_cents', input.subtotalCents],
    ['tax_cents', input.taxCents],
    ['shipping_cents', 0],
    ['discount_cents', input.discountCents],
    ['coupon_code', input.couponCode],
    ['total_cents', input.totalCents],
    ['card_amount_cents', input.cardAmountCents],
    ['cash_amount_cents', input.cashAmountCents],
    ['cash_due_cents', input.cashAmountCents],
    ['currency', 'usd'],
    ['reserve_expires_at', null],
    ['checkout_started_at', input.createdAt],
    ['success_url', input.successUrl],
    ['cancel_url', input.cancelUrl],
    ['customer_name', normalizeText(input.customerName, '')],
    ['customer_email', normalizeEmailAddress(input.customerEmail)],
    ['created_at', input.createdAt],
    ['updated_at', input.createdAt],
  ]);
  const insertColumns = orderColumns
    .filter((column) =>
      (orderValueByColumn.has(column.name) && !isAutoIntegerPrimaryKey(column))
      || isRequiredInsertColumn(column)
    )
    .map((column) => column.name);
  const insertValues = insertColumns.map((columnName) =>
    orderValueByColumn.has(columnName)
      ? orderValueByColumn.get(columnName)
      : getRequiredOrderFallback(columnName, firstItem, input.createdAt)
  );
  const placeholders = insertColumns.map(() => '?').join(', ');

  await env.DB.prepare(
    `INSERT INTO orders (${insertColumns.join(', ')}) VALUES (${placeholders})`
  ).bind(...insertValues).run();

  const orderItemColumns = await dbGetTableColumns('order_items', env);
  for (const item of input.items) {
    const orderItemValueByColumn = new Map<string, unknown>([
      ['id', crypto.randomUUID()],
      ['order_id', input.orderId],
      ['inventory_item_id', item.inventoryItemId],
      ['quantity', item.quantity],
      ['item_title_snapshot', item.title],
      ['title_snapshot', item.title],
      ['item_title', item.title],
      ['title', item.title],
      ['item_brand_snapshot', item.row.brand || ''],
      ['brand_snapshot', item.row.brand || ''],
      ['brand', item.row.brand || ''],
      ['item_model_snapshot', item.row.model || ''],
      ['model_snapshot', item.row.model || ''],
      ['model', item.row.model || ''],
      ['item_condition_snapshot', item.row.condition || ''],
      ['condition_snapshot', item.row.condition || ''],
      ['condition', item.row.condition || ''],
      ['item_image_url_snapshot', item.imageUrl],
      ['image_url_snapshot', item.imageUrl],
      ['image_url', item.imageUrl],
      ['unit_price_cents', item.unitAmountCents],
      ['price_cents', item.unitAmountCents],
      ['unit_amount_cents', item.unitAmountCents],
      ['subtotal_cents', item.unitAmountCents * item.quantity],
      ['total_cents', item.unitAmountCents * item.quantity],
      ['created_at', input.createdAt],
      ['updated_at', input.createdAt],
    ]);
    const orderItemInsertColumns = orderItemColumns
      .filter((column) =>
        (orderItemValueByColumn.has(column.name) && !isAutoIntegerPrimaryKey(column))
        || isRequiredInsertColumn(column)
      )
      .map((column) => column.name);
    const orderItemInsertValues = orderItemInsertColumns.map((columnName) =>
      orderItemValueByColumn.has(columnName)
        ? orderItemValueByColumn.get(columnName)
        : getRequiredOrderItemFallback(columnName, item, input.createdAt)
    );
    const orderItemPlaceholders = orderItemInsertColumns.map(() => '?').join(', ');

    await env.DB.prepare(
      `INSERT INTO order_items (${orderItemInsertColumns.join(', ')}) VALUES (${orderItemPlaceholders})`
    ).bind(...orderItemInsertValues).run();
  }

  await env.DB.prepare(
    `INSERT INTO order_events (
       order_id,
       event_type,
       from_status,
       to_status,
       source,
       source_id,
       message,
       created_at
     ) VALUES (?, 'checkout_created', NULL, 'checkout_open', 'public_site', NULL, ?, ?)`
  ).bind(
    input.orderId,
    input.checkoutMode === 'payment_link'
      ? 'Stripe Payment Link checkout created from webhook.'
      : `${input.checkoutProvider === 'cash' ? 'Cash checkout' : 'Stripe Checkout'} started from cart.`,
    input.createdAt,
  ).run();
}

async function dbEnsurePaymentLinkCheckoutOrder(session: any, event: any, env: Env): Promise<string> {
  const sessionId = normalizeText(session?.id, '');
  if (!sessionId) throw new Error('Stripe payment link webhook did not include a checkout session id.');

  const existingOrderId = await dbGetOrderIdByStripeCheckoutSessionId(sessionId, env);
  if (existingOrderId) return existingOrderId;

  const items = await buildPaymentLinkCheckoutOrderItems(session, event, env);
  if (items.length === 0) {
    throw new Error('Stripe payment link webhook did not include recognizable inventory items.');
  }

  const createdAt = stripeTimestampToIso(session?.created) || new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const itemSubtotalCents = items.reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0);
  const discountCents = numberOrZero(session?.total_details?.amount_discount);
  const totalCents = numberOrZero(session?.amount_total)
    || Math.max(0, itemSubtotalCents - discountCents + numberOrZero(session?.total_details?.amount_tax));
  const taxCents = numberOrZero(session?.total_details?.amount_tax)
    || Math.max(0, totalCents - itemSubtotalCents + discountCents);
  const subtotalCents = itemSubtotalCents || Math.max(0, numberOrZero(session?.amount_subtotal) - taxCents);
  const normalizedTotalCents = totalCents
    || Math.max(0, subtotalCents - discountCents + taxCents);
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const customerName = normalizeText(session?.customer_details?.name, '');
  const customerEmail = normalizeEmailAddress(session?.customer_details?.email);

  await dbCreateCheckoutOrder({
    orderId,
    orderNumber,
    status: 'checkout_open',
    channel: 'online',
    fulfillmentType: 'pickup',
    checkoutType: 'stripe',
    checkoutProvider: 'stripe',
    checkoutMode: 'payment_link',
    subtotalCents,
    discountCents,
    couponCode: null,
    taxCents,
    totalCents: normalizedTotalCents,
    successUrl,
    cancelUrl: '',
    createdAt,
    customerName,
    customerEmail,
    items,
  }, env);

  await dbAttachStripeCheckoutSession(orderId, sessionId, env);
  await dbUpdateTableById('orders', orderId, {
    stripe_payment_intent_id: normalizeText(session?.payment_intent, ''),
    stripe_customer_id: normalizeText(session?.customer, ''),
    stripe_customer_name: customerName,
    stripe_customer_email: customerEmail,
    stripe_customer_phone: normalizeText(session?.customer_details?.phone, ''),
    stripe_payment_status: normalizeText(session?.payment_status, ''),
    updated_at: new Date().toISOString(),
  }, env);

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_link_order_created',
    fromStatus: null,
    toStatus: 'checkout_open',
    source: 'stripe_webhook',
    sourceId: sessionId,
    message: 'Order created from Stripe Payment Link payment.',
    payloadJson: JSON.stringify({
      checkoutSessionId: sessionId,
      paymentLinkId: normalizeText(session?.payment_link, ''),
      livemode: event?.livemode === true,
      inventoryItemIds: items.map((item) => item.inventoryItemId),
    }),
  }, env);

  return orderId;
}

async function dbGetOrderIdByStripeCheckoutSessionId(
  checkoutSessionId: string,
  env: Env,
): Promise<string | null> {
  const id = normalizeText(checkoutSessionId, '');
  if (!id) return null;
  const columns = await dbGetTableColumns('orders', env);
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has('stripe_checkout_session_id')) return null;
  const row = await env.DB.prepare(
    'SELECT id FROM orders WHERE stripe_checkout_session_id = ? LIMIT 1'
  ).bind(id).first<{ id: string | null }>();
  return normalizeText(row?.id, '') || null;
}

async function dbAttachStripeCheckoutSession(
  orderId: string,
  checkoutSessionId: string,
  env: Env,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE orders
     SET stripe_checkout_session_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(checkoutSessionId, orderId).run();
}

async function dbCancelFailedCheckoutOrder(orderId: string, env: Env): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE orders
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND status != 'paid'`
    ).bind(orderId).run();
  } catch (error) {
    console.error('Failed to cancel checkout order after Stripe error', { orderId, error });
  }
}

async function dbMarkStripeCheckoutOrderPaid(orderId: string, session: any, env: Env): Promise<void> {
  const currentStatus = await dbGetOrderStatus(orderId, env);
  if (currentStatus === 'paid') return;
  const splitTenderPayload = {
    cardAmountCents: numberOrZero(session?.metadata?.card_amount_cents),
    cashAmountCents: numberOrZero(session?.metadata?.cash_amount_cents),
    totalCents: numberOrZero(session?.metadata?.total_cents),
  };

  const inventoryItemIds = parseStripeInventoryItemIds(session);
  await dbApplyPaidOrderInventoryAdjustments(orderId, inventoryItemIds, session, env);

  await dbUpdateStripeOrderStatus(orderId, 'paid', session, env, {
    paid_at: new Date().toISOString(),
  });

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_succeeded',
    fromStatus: null,
    toStatus: 'paid',
    source: 'stripe_webhook',
    sourceId: normalizeText(session?.id, ''),
    message: 'Stripe Checkout payment succeeded.',
    payloadJson: JSON.stringify({
      checkoutSessionId: normalizeText(session?.id, ''),
      paymentIntentId: normalizeText(session?.payment_intent, ''),
      paymentStatus: normalizeText(session?.payment_status, ''),
      ...splitTenderPayload,
    }),
  }, env);

  await sendBrevoOrderConfirmationEmailForOrder(orderId, env);
}

async function dbMarkManualCheckoutOrderPaid(
  orderId: string,
  input: {
    provider: string;
    paidAt: string;
    taxIncluded: boolean;
    items: Array<{ inventoryItemId: number; quantity: number; subtotalCents: number }>;
  },
  env: Env,
): Promise<void> {
  const currentStatus = await dbGetOrderStatus(orderId, env);
  if (currentStatus === 'paid') return;

  const session = {
    manual_provider: input.provider,
    payment_status: 'paid',
    id: `${input.provider}:${orderId}`,
  };
  await dbApplyPaidInventoryItems(orderId, input.items, session, env);

  await dbUpdateTableById('orders', orderId, {
    status: 'paid',
    paid_at: input.paidAt,
    stripe_payment_status: 'not_applicable',
    tax_included: input.taxIncluded ? 1 : 0,
    updated_at: input.paidAt,
  }, env);

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_succeeded',
    fromStatus: null,
    toStatus: 'paid',
    source: 'associate_checkout',
    sourceId: input.provider,
    message: 'Cash payment confirmed paid in full.',
    payloadJson: JSON.stringify({
      provider: input.provider,
      taxIncluded: input.taxIncluded,
    }),
  }, env);

  await sendBrevoOrderConfirmationEmailForOrder(orderId, env);
}

async function dbReleaseStripeCheckoutOrder(
  orderId: string,
  status: string,
  session: any,
  env: Env,
): Promise<void> {
  await dbUpdateStripeOrderStatus(orderId, status, session, env, {
    cancelled_at: new Date().toISOString(),
  });

  await dbRecordOrderEvent(orderId, {
    eventType: status,
    fromStatus: null,
    toStatus: status,
    source: 'stripe_webhook',
    sourceId: normalizeText(session?.id, ''),
    message: `Stripe Checkout ${status}.`,
    payloadJson: JSON.stringify({
      checkoutSessionId: normalizeText(session?.id, ''),
      paymentIntentId: normalizeText(session?.payment_intent, ''),
      paymentStatus: normalizeText(session?.payment_status, ''),
    }),
  }, env);
}

async function dbUpdateStripeOrderStatus(
  orderId: string,
  status: string,
  session: any,
  env: Env,
  extraValues: Record<string, unknown> = {},
): Promise<void> {
  await dbUpdateTableById('orders', orderId, {
    status,
    stripe_checkout_session_id: normalizeText(session?.id, ''),
    stripe_payment_intent_id: normalizeText(session?.payment_intent, ''),
    stripe_customer_id: normalizeText(session?.customer, ''),
    customer_name: normalizeText(session?.customer_details?.name, ''),
    customer_email: normalizeText(session?.customer_details?.email, ''),
    customer_phone: normalizeText(session?.customer_details?.phone, ''),
    stripe_customer_name: normalizeText(session?.customer_details?.name, ''),
    stripe_customer_email: normalizeText(session?.customer_details?.email, ''),
    stripe_customer_phone: normalizeText(session?.customer_details?.phone, ''),
    stripe_payment_status: normalizeText(session?.payment_status, ''),
    card_amount_cents: numberOrZero(session?.metadata?.card_amount_cents),
    cash_amount_cents: numberOrZero(session?.metadata?.cash_amount_cents),
    cash_due_cents: numberOrZero(session?.metadata?.cash_amount_cents),
    updated_at: new Date().toISOString(),
    ...extraValues,
  }, env);
}

async function dbGetOrderStatus(orderId: string, env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT status FROM orders WHERE id = ? LIMIT 1'
  ).bind(orderId).first<{ status: string | null }>();
  return normalizeText(row?.status, '') || null;
}

async function dbGetOrderById(orderId: string, env: Env): Promise<Record<string, unknown> | null> {
  const normalizedOrderId = normalizeText(orderId, '');
  if (!normalizedOrderId) return null;
  return env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
}

async function dbMarkTerminalCheckoutOrderPaid(orderId: string, paymentIntent: any, env: Env): Promise<void> {
  const currentStatus = await dbGetOrderStatus(orderId, env);
  if (currentStatus === 'paid') return;

  const paidAt = new Date().toISOString();
  const session = {
    id: normalizeText(paymentIntent?.id, ''),
    payment_intent: normalizeText(paymentIntent?.id, ''),
    payment_status: normalizeText(paymentIntent?.status, 'succeeded'),
    manual_provider: 'stripe_terminal',
  };
  const items = await dbListOrderInventoryQuantities(orderId, env);
  await dbApplyPaidInventoryItems(orderId, items, session, env);

  await dbUpdateTableById('orders', orderId, {
    status: 'paid',
    paid_at: paidAt,
    stripe_payment_intent_id: normalizeText(paymentIntent?.id, ''),
    stripe_payment_status: normalizeText(paymentIntent?.status, 'succeeded'),
    updated_at: paidAt,
  }, env);

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_succeeded',
    fromStatus: null,
    toStatus: 'paid',
    source: 'stripe_terminal',
    sourceId: normalizeText(paymentIntent?.id, ''),
    message: 'Stripe Terminal payment succeeded.',
    payloadJson: JSON.stringify({
      paymentIntentId: normalizeText(paymentIntent?.id, ''),
      paymentStatus: normalizeText(paymentIntent?.status, ''),
      cardAmountCents: numberOrZero(paymentIntent?.metadata?.card_amount_cents),
      cashAmountCents: numberOrZero(paymentIntent?.metadata?.cash_amount_cents),
      totalCents: numberOrZero(paymentIntent?.metadata?.total_cents),
    }),
  }, env);

  await sendBrevoOrderConfirmationEmailForOrder(orderId, env);
}

async function dbGetOrderReceipt(orderId: string, env: Env): Promise<Record<string, unknown> | null> {
  const order = await env.DB.prepare(
    'SELECT * FROM orders WHERE id = ? LIMIT 1'
  ).bind(orderId).first<Record<string, unknown>>();
  if (!order) return null;
  const splitTender = await dbGetOrderSplitTender(orderId, order, env);

  const itemRows = await env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  ).bind(orderId).all<Record<string, unknown>>();

  const inventoryItemIds = Array.from(new Set(
    (itemRows.results ?? [])
      .map((row) => parseOptionalPositiveInt(row.inventory_item_id ?? row.item_id ?? row.inventory_id))
      .filter((value): value is number => value != null),
  ));
  const inventoryById = new Map<number, {
    ccg_number: string | null;
    title: string | null;
    sale_title: string | null;
    image_url: string | null;
  }>();
  if (inventoryItemIds.length > 0) {
    const placeholders = inventoryItemIds.map(() => '?').join(', ');
    const inventoryRows = await env.DB.prepare(
      `SELECT
         i.id,
         i.ccg_number,
         i.title,
         i.sale_title,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM ccg_inventory_item_images sii_exists
             WHERE sii_exists.inventory_item_id = i.id
           ) THEN COALESCE((
             SELECT sii.image_url
             FROM ccg_inventory_item_images sii
             WHERE sii.inventory_item_id = i.id
               AND COALESCE(sii.is_private, 0) = 0
             ORDER BY sii.display_order ASC, sii.id ASC
             LIMIT 1
           ), '')
           ELSE i.image_url
         END AS image_url
       FROM ccg_inventory_items i
       WHERE i.id IN (${placeholders})`
    ).bind(...inventoryItemIds).all<{
      id: number;
      ccg_number: string | null;
      title: string | null;
      sale_title: string | null;
      image_url: string | null;
    }>();
    for (const row of inventoryRows.results ?? []) {
      inventoryById.set(Number(row.id), row);
    }
  }

  const items = (itemRows.results ?? []).map((row) => {
    const inventoryItemId = parseOptionalPositiveInt(row.inventory_item_id ?? row.item_id ?? row.inventory_id) ?? 0;
    const inventory = inventoryById.get(inventoryItemId);
    const quantity = parseOptionalPositiveInt(row.quantity ?? row.qty) ?? 1;
    const unitAmountCents = Number(row.unit_amount_cents ?? row.unit_price_cents ?? row.price_cents ?? 0);
    const subtotalCents = Number(row.subtotal_cents ?? row.total_cents ?? (Number.isFinite(unitAmountCents) ? unitAmountCents * quantity : 0));
    return {
      inventoryItemId,
      ccgNumber: normalizeText(inventory?.ccg_number, '') || (inventoryItemId ? `CCG-${inventoryItemId}` : ''),
      title: normalizeText(
        row.item_title_snapshot ?? row.title_snapshot ?? row.item_title ?? row.title ?? inventory?.sale_title ?? inventory?.title,
        'Item',
      ),
      imageUrl: toPublicShopImageUrl(row.image_url_snapshot ?? row.item_image_url_snapshot ?? row.image_url ?? inventory?.image_url, 'thumb'),
      quantity,
      unitAmountCents: Number.isFinite(unitAmountCents) ? unitAmountCents : 0,
      subtotalCents: Number.isFinite(subtotalCents) ? subtotalCents : 0,
    };
  });

  return {
    orderId: normalizeText(order.id, orderId),
    orderNumber: normalizeText(order.order_number, ''),
    status: normalizeText(order.status, ''),
    checkoutProvider: normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : ''),
    stripePaymentIntentId: normalizeText(order.stripe_payment_intent_id, ''),
    subtotalCents: Number(order.subtotal_cents ?? 0) || 0,
    taxCents: Number(order.tax_cents ?? 0) || 0,
    discountCents: Number(order.discount_cents ?? 0) || 0,
    totalCents: Number(order.total_cents ?? 0) || 0,
    cardAmountCents: splitTender.cardAmountCents,
    cashAmountCents: splitTender.cashAmountCents,
    createdAt: normalizeText(order.created_at ?? order.checkout_started_at, ''),
    paidAt: normalizeText(order.paid_at, ''),
    items,
  };
}

async function dbGetOrderSplitTender(
  orderId: string,
  order: Record<string, unknown>,
  env: Env,
): Promise<{ cardAmountCents: number; cashAmountCents: number }> {
  const cardAmountCents = numberOrZero(order.card_amount_cents);
  const cashAmountCents = numberOrZero(order.cash_amount_cents ?? order.cash_due_cents);
  if (cardAmountCents > 0 || cashAmountCents > 0) {
    return { cardAmountCents, cashAmountCents };
  }

  try {
    const columns = await dbGetTableColumns('order_events', env);
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has('order_id') || !columnNames.has('payload_json')) {
      return { cardAmountCents: 0, cashAmountCents: 0 };
    }
    const result = await env.DB.prepare(
      `SELECT payload_json
       FROM order_events
       WHERE order_id = ?
         AND event_type IN ('split_tender_created', 'payment_succeeded')
       ORDER BY COALESCE(created_at, '') DESC
       LIMIT 5`
    ).bind(orderId).all<{ payload_json: string | null }>();
    for (const row of result.results ?? []) {
      const payload = JSON.parse(normalizeText(row?.payload_json, '{}')) as {
        cardAmountCents?: unknown;
        cashAmountCents?: unknown;
      };
      const parsed = {
        cardAmountCents: numberOrZero(payload.cardAmountCents),
        cashAmountCents: numberOrZero(payload.cashAmountCents),
      };
      if (parsed.cardAmountCents > 0 || parsed.cashAmountCents > 0) return parsed;
    }
    return { cardAmountCents: 0, cashAmountCents: 0 };
  } catch (error) {
    console.warn('Split tender lookup failed', { orderId, error });
    return { cardAmountCents: 0, cashAmountCents: 0 };
  }
}

async function resolveStripePaymentMethodLabel(paymentIntentId: string, env: Env): Promise<string> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  const id = normalizeText(paymentIntentId, '');
  if (!stripeSecretKey || !id) return 'Payment method: Stripe';

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );
    const data = await response.json<any>();
    if (!response.ok) {
      console.warn('Stripe payment method lookup failed', { paymentIntentId: id, status: response.status });
      return 'Payment method: Stripe';
    }

    const details = data?.latest_charge?.payment_method_details;
    const type = normalizeText(details?.type, normalizeText(data?.payment_method_types?.[0], 'stripe'));
    if (type === 'card') {
      const brand = toDisplayPaymentMethodName(details?.card?.brand || 'Card');
      const last4 = normalizeText(details?.card?.last4, '');
      return last4 ? `${brand} XXXX XXXX XXXX ${last4}` : brand;
    }
    return `Payment method: ${toDisplayPaymentMethodName(type)}`;
  } catch (error) {
    console.warn('Stripe payment method lookup failed', { paymentIntentId: id, error });
    return 'Payment method: Stripe';
  }
}

function toDisplayPaymentMethodName(input: unknown): string {
  const normalized = normalizeText(input, '').replace(/_/g, ' ').trim();
  if (!normalized) return 'Stripe';
  const lower = normalized.toLowerCase();
  if (lower === 'amex') return 'American Express';
  if (lower === 'afterpay clearpay') return 'Afterpay/Clearpay';
  return lower.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function dbApplyPaidOrderInventoryAdjustments(
  orderId: string,
  fallbackInventoryItemIds: number[],
  session: any,
  env: Env,
): Promise<void> {
  const orderItems = await dbListOrderInventoryQuantities(orderId, env);
  const items = orderItems.length > 0
    ? orderItems
    : fallbackInventoryItemIds.map((inventoryItemId) => ({
      inventoryItemId,
      quantity: 1,
      subtotalCents: 0,
    }));

  await dbApplyPaidInventoryItems(orderId, items, session, env);
}

async function dbApplyPaidInventoryItems(
  orderId: string,
  items: Array<{ inventoryItemId: number; quantity: number; subtotalCents: number }>,
  session: any,
  env: Env,
): Promise<void> {
  for (const item of items) {
    await dbApplyPaidInventoryItemAdjustment(orderId, item, session, env);
  }
}

async function dbListOrderInventoryQuantities(
  orderId: string,
  env: Env,
): Promise<Array<{ inventoryItemId: number; quantity: number; subtotalCents: number }>> {
  const columns = await dbGetTableColumns('order_items', env);
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('order_id')) return [];

  const result = await env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  ).bind(orderId).all<Record<string, unknown>>();

  return (result.results ?? [])
    .map((row) => {
      const inventoryItemId = parseOptionalPositiveInt(
        row.inventory_item_id ?? row.item_id ?? row.inventory_id,
      );
      if (!inventoryItemId) return null;
      const quantity = parseOptionalPositiveInt(row.quantity ?? row.qty) ?? 1;
      const subtotalCents = Number(row.subtotal_cents ?? row.total_cents ?? 0);
      return {
        inventoryItemId,
        quantity,
        subtotalCents: Number.isFinite(subtotalCents) ? subtotalCents : 0,
      };
    })
    .filter((item): item is { inventoryItemId: number; quantity: number; subtotalCents: number } => item != null);
}

async function dbUnwindRefundedOrderInventory(
  orderId: string,
  order: Record<string, unknown>,
  env: Env,
): Promise<void> {
  const items = await dbListOrderInventoryQuantities(orderId, env);
  const provider = normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const paidAt = normalizeText(order.paid_at ?? order.updated_at ?? order.created_at, '');
  const checkoutSessionId = normalizeText(order.stripe_checkout_session_id, '');

  for (const item of items) {
    const row = await env.DB.prepare(
      'SELECT * FROM ccg_inventory_items WHERE id = ? LIMIT 1'
    ).bind(item.inventoryItemId).first<Record<string, unknown>>();
    if (!row) continue;

    const purchasedQuantity = Math.max(1, item.quantity);
    const currentQuantity = Math.max(0, Number(row.quantity ?? 0));
    const wasPartialSale = Number(row.is_sold || 0) === 0 && currentQuantity > 0;
    const restoredQuantity = currentQuantity + purchasedQuantity;
    const columns = await dbGetTableColumns('ccg_inventory_items', env);
    const columnNames = new Set(columns.map((column) => column.name));
    const values = new Map<string, unknown>([
      ['quantity', restoredQuantity],
      ['is_sold', 0],
      ['for_sale', 1],
      ['availability_status', 'available'],
      ['active_order_id', null],
      ['reserved_until', null],
      ['sold_date', null],
      ['sold_amount', null],
      ['sell_notes', null],
      ['sold_channel', null],
      ['updated_at', new Date().toISOString()],
    ]);
    await dbUpdateInventoryColumns(item.inventoryItemId, orderId, values, columnNames, env);

    if (wasPartialSale) {
      await dbDeactivateRefundedPartialSaleClone({
        sourceRow: row,
        item,
        provider,
        paidAt,
        checkoutSessionId,
        orderId,
        env,
      });
    }
  }
}

async function dbDeactivateRefundedPartialSaleClone(input: {
  sourceRow: Record<string, unknown>;
  item: { inventoryItemId: number; quantity: number; subtotalCents: number };
  provider: string;
  paidAt: string;
  checkoutSessionId: string;
  orderId: string;
  env: Env;
}): Promise<void> {
  const sourceId = Number(input.sourceRow.id);
  const title = normalizeText(input.sourceRow.sale_title ?? input.sourceRow.title, '');
  const soldAmount = input.item.subtotalCents > 0
    ? input.item.subtotalCents / 100
    : Number(input.sourceRow.sale_price || input.sourceRow.regular_price || 0) * Math.max(1, input.item.quantity);
  const sellNote = input.provider === 'cash'
    ? 'Cash checkout'
    : `Stripe checkout ${input.checkoutSessionId}`.trim();
  if (!sourceId || !title) return;

  const clone = await input.env.DB.prepare(
    `SELECT id
     FROM ccg_inventory_items
     WHERE id != ?
       AND COALESCE(is_sold, 0) = 1
       AND COALESCE(sold_channel, '') = ?
       AND COALESCE(sold_amount, 0) = ?
       AND (COALESCE(sale_title, '') = ? OR COALESCE(title, '') = ?)
       AND (
         COALESCE(sell_notes, '') = ?
         OR (? = 'Cash checkout' AND ABS((julianday(COALESCE(sold_date, created_at, updated_at)) - julianday(?)) * 86400) <= 300)
       )
     ORDER BY COALESCE(sold_date, created_at, updated_at) DESC, id DESC
     LIMIT 1`
  ).bind(sourceId, input.provider, soldAmount, title, title, sellNote, sellNote, input.paidAt).first<{ id: number | null }>();
  const cloneId = Number(clone?.id || 0);
  if (!Number.isFinite(cloneId) || cloneId <= 0) return;

  const columns = await dbGetTableColumns('ccg_inventory_items', input.env);
  const columnNames = new Set(columns.map((column) => column.name));
  await dbUpdateInventoryColumns(cloneId, input.orderId, new Map<string, unknown>([
    ['quantity', 0],
    ['is_active', 0],
    ['is_sold', 0],
    ['for_sale', 0],
    ['availability_status', 'refunded'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', null],
    ['sold_amount', null],
    ['sell_notes', `Refunded order ${normalizeText(input.orderId, '')}`],
    ['updated_at', new Date().toISOString()],
  ]), columnNames, input.env);
}

async function dbApplyPaidInventoryItemAdjustment(
  orderId: string,
  item: { inventoryItemId: number; quantity: number; subtotalCents: number },
  session: any,
  env: Env,
): Promise<void> {
  const row = await env.DB.prepare(
    'SELECT * FROM ccg_inventory_items WHERE id = ? LIMIT 1'
  ).bind(item.inventoryItemId).first<Record<string, unknown>>();
  if (!row) return;

  const purchasedQuantity = Math.max(1, item.quantity);
  const currentQuantity = Math.max(0, Number(row.quantity ?? 1));
  const remainingQuantity = Math.max(0, currentQuantity - purchasedQuantity);
  const soldDate = new Date().toISOString();
  const soldAmount = item.subtotalCents > 0
    ? item.subtotalCents / 100
    : Number(row.sale_price || row.regular_price || 0) * purchasedQuantity;

  if (remainingQuantity > 0) {
    await dbUpdateOriginalInventoryAfterPartialSale(
      item.inventoryItemId,
      remainingQuantity,
      orderId,
      env,
    );
    await dbCreateSoldInventoryCloneFromSource({
      sourceRow: row,
      soldQuantity: purchasedQuantity,
      soldAmount,
      soldDate,
      orderId,
      session,
      env,
    });
    return;
  }

  await dbUpdateOriginalInventoryAfterFullSale(
    item.inventoryItemId,
    orderId,
    soldAmount,
    soldDate,
    session,
    env,
  );
}

async function dbUpdateOriginalInventoryAfterPartialSale(
  inventoryItemId: number,
  remainingQuantity: number,
  orderId: string,
  env: Env,
): Promise<void> {
  const columns = await dbGetTableColumns('ccg_inventory_items', env);
  const columnNames = new Set(columns.map((column) => column.name));
  const values = new Map<string, unknown>([
    ['quantity', remainingQuantity],
    ['is_sold', 0],
    ['for_sale', 1],
    ['availability_status', 'available'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', null],
    ['sold_amount', null],
    ['sell_notes', null],
    ['updated_at', new Date().toISOString()],
  ]);
  await dbUpdateInventoryColumns(inventoryItemId, orderId, values, columnNames, env);
}

async function dbUpdateOriginalInventoryAfterFullSale(
  inventoryItemId: number,
  orderId: string,
  soldAmount: number,
  soldDate: string,
  session: any,
  env: Env,
): Promise<void> {
  const columns = await dbGetTableColumns('ccg_inventory_items', env);
  const columnNames = new Set(columns.map((column) => column.name));
  const paidChannel = getPaidInventoryChannel(session);
  const paidNote = getPaidInventorySellNote(session);
  const values = new Map<string, unknown>([
    ['quantity', 0],
    ['is_sold', 1],
    ['for_sale', 0],
    ['availability_status', 'sold'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', soldDate],
    ['sold_amount', soldAmount],
    ['sell_notes', paidNote],
    ['sold_channel', paidChannel],
    ['updated_at', new Date().toISOString()],
  ]);
  await dbUpdateInventoryColumns(inventoryItemId, orderId, values, columnNames, env);
}

async function dbUpdateInventoryColumns(
  inventoryItemId: number,
  orderId: string,
  values: Map<string, unknown>,
  columnNames: Set<string>,
  env: Env,
): Promise<void> {
  const setColumns = Array.from(values.keys()).filter((columnName) => columnNames.has(columnName));
  if (setColumns.length === 0) return;
  const bindValues = setColumns.map((columnName) => values.get(columnName));
  bindValues.push(inventoryItemId);
  await env.DB.prepare(
    `UPDATE ccg_inventory_items
     SET ${setColumns.map((columnName) => `${columnName} = ?`).join(', ')}
     WHERE id = ?`
  ).bind(...bindValues).run();
}

async function dbCreateSoldInventoryCloneFromSource(input: {
  sourceRow: Record<string, unknown>;
  soldQuantity: number;
  soldAmount: number;
  soldDate: string;
  orderId: string;
  session: any;
  env: Env;
}): Promise<number | null> {
  const sourceId = Number(input.sourceRow.id);
  if (!Number.isFinite(sourceId) || sourceId <= 0) return null;

  const ccgNumber = await generateUniqueCcgNumber(input.env);
  if (!ccgNumber) return null;

  const columns = await dbGetTableColumns('ccg_inventory_items', input.env);
  const sourceValues = new Map(Object.entries(input.sourceRow));
  const paidChannel = getPaidInventoryChannel(input.session);
  const paidNote = getPaidInventorySellNote(input.session);
  const overrideValues = new Map<string, unknown>([
    ['ccg_number', ccgNumber],
    ['quantity', input.soldQuantity],
    ['is_sold', 1],
    ['for_sale', 0],
    ['availability_status', 'sold'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', input.soldDate],
    ['sold_amount', input.soldAmount],
    ['sell_notes', paidNote],
    ['sold_channel', paidChannel],
    ['is_marked', 0],
    ['source_listing_id', null],
    ['sale_url_slug', null],
    ['for_sale_date', null],
    ['created_at', input.soldDate],
    ['updated_at', input.soldDate],
  ]);
  const insertColumns = columns
    .filter((column) => !isAutoIntegerPrimaryKey(column))
    .map((column) => column.name)
    .filter((columnName) => overrideValues.has(columnName) || sourceValues.has(columnName));
  const insertValues = insertColumns.map((columnName) =>
    overrideValues.has(columnName) ? overrideValues.get(columnName) : sourceValues.get(columnName)
  );

  const result = await input.env.DB.prepare(
    `INSERT INTO ccg_inventory_items (${insertColumns.join(', ')})
     VALUES (${insertColumns.map(() => '?').join(', ')})`
  ).bind(...insertValues).run();
  const cloneId = Number(result.meta?.last_row_id || 0);
  if (!Number.isFinite(cloneId) || cloneId <= 0) return null;

  await dbCopyInventoryImages(sourceId, cloneId, input.env);
  return cloneId;
}

function getPaidInventoryChannel(session: any): string {
  const manualProvider = normalizeText(session?.manual_provider, '');
  return manualProvider || 'stripe';
}

function getPaidInventorySellNote(session: any): string {
  const manualProvider = normalizeText(session?.manual_provider, '');
  if (manualProvider === 'cash') return 'Cash checkout';
  return `Stripe checkout ${normalizeText(session?.id, '')}`.trim();
}

async function dbCopyInventoryImages(
  sourceInventoryItemId: number,
  targetInventoryItemId: number,
  env: Env,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO ccg_inventory_item_images (inventory_item_id, image_url, display_order, is_private)
       SELECT ?, image_url, display_order, is_private
       FROM ccg_inventory_item_images
       WHERE inventory_item_id = ?
       ORDER BY display_order ASC, id ASC`
    ).bind(targetInventoryItemId, sourceInventoryItemId).run();
  } catch (error) {
    console.warn('Sold clone image copy skipped', { sourceInventoryItemId, targetInventoryItemId, error });
  }
}

async function dbUpdateTableById(
  tableName: string,
  id: string,
  values: Record<string, unknown>,
  env: Env,
): Promise<void> {
  const columns = await dbGetTableColumns(tableName, env);
  const columnNames = new Set(columns.map((column) => column.name));
  const setColumns = Object.keys(values).filter((columnName) => columnNames.has(columnName));
  if (setColumns.length === 0 || !columnNames.has('id')) return;
  await env.DB.prepare(
    `UPDATE ${tableName}
     SET ${setColumns.map((columnName) => `${columnName} = ?`).join(', ')}
     WHERE id = ?`
  ).bind(...setColumns.map((columnName) => values[columnName]), id).run();
}

async function dbRecordOrderEvent(
  orderId: string,
  event: {
    eventType: string;
    fromStatus: string | null;
    toStatus: string;
    source: string;
    sourceId: string;
    message: string;
    payloadJson: string;
  },
  env: Env,
): Promise<void> {
  try {
    const columns = await dbGetTableColumns('order_events', env);
    const values = new Map<string, unknown>([
      ['order_id', orderId],
      ['event_type', event.eventType],
      ['from_status', event.fromStatus],
      ['to_status', event.toStatus],
      ['source', event.source],
      ['source_id', event.sourceId],
      ['message', event.message],
      ['payload_json', event.payloadJson],
      ['created_at', new Date().toISOString()],
    ]);
    const insertColumns = columns
      .filter((column) => values.has(column.name) && !isAutoIntegerPrimaryKey(column))
      .map((column) => column.name);
    if (insertColumns.length === 0) return;
    await env.DB.prepare(
      `INSERT INTO order_events (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`
    ).bind(...insertColumns.map((columnName) => values.get(columnName))).run();
  } catch (error) {
    console.error('Failed to record order event', { orderId, error });
  }
}

function isRequiredInsertColumn(column: {
  name: string;
  notnull: number | null;
  dflt_value: string | null;
  pk: number | null;
}): boolean {
  return Number(column.notnull || 0) === 1
    && Number(column.pk || 0) === 0
    && column.dflt_value == null;
}

function isAutoIntegerPrimaryKey(column: {
  name: string;
  type: string | null;
  pk: number | null;
}): boolean {
  return Number(column.pk || 0) > 0 && /int/i.test(String(column.type || ''));
}

function getRequiredOrderFallback(
  columnName: string,
  item: {
    inventoryItemId: number;
    quantity: number;
    row: ShopCheckoutInventoryRow;
    title: string;
    unitAmountCents: number;
    imageUrl: string;
  },
  createdAt: string,
): unknown {
  const name = columnName.toLowerCase();
  if (name.includes('inventory') && name.includes('id')) return item.inventoryItemId;
  if (name.includes('quantity')) return item.quantity;
  if (name.includes('title') || name.includes('name')) return item.title;
  if (name.includes('brand')) return item.row.brand || '';
  if (name.includes('model')) return item.row.model || '';
  if (name.includes('condition')) return item.row.condition || '';
  if (name.includes('image')) return item.imageUrl;
  if (name.includes('checkout') || name.includes('provider') || name.includes('type')) return 'stripe';
  if (name.includes('mode')) return 'hosted_checkout';
  if (name.includes('fulfillment')) return 'pickup';
  if (name.includes('channel')) return 'online';
  if (name.includes('status')) return 'checkout_open';
  if (name.includes('currency')) return 'usd';
  if (name.includes('price') || name.includes('amount')) return item.unitAmountCents;
  if (name.includes('subtotal') || name.includes('total')) return item.unitAmountCents * item.quantity;
  if (name.includes('tax') || name.includes('shipping') || name.includes('discount')) return 0;
  if (name.includes('date') || name.includes('time') || name.endsWith('_at')) return createdAt;
  return '';
}

function getRequiredOrderItemFallback(
  columnName: string,
  item: {
    inventoryItemId: number;
    quantity: number;
    row: ShopCheckoutInventoryRow;
    title: string;
    unitAmountCents: number;
    imageUrl: string;
  },
  createdAt: string,
): unknown {
  return getRequiredOrderFallback(columnName, item, createdAt);
}

async function generateUniqueCcgNumber(env: Env): Promise<string | null> {
  for (let attempt = 0; attempt < CCG_NUMBER_ATTEMPTS; attempt += 1) {
    const value = randomIntInRange(CCG_NUMBER_MIN, CCG_NUMBER_MAX);
    const ccgNumber = `CCG-${value}`;
    const exists = await dbCcgNumberExists(ccgNumber, env);
    if (!exists) return ccgNumber;
  }
  return null;
}

async function generateUniqueInventoryBarcode(env: Env): Promise<string | null> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const barcode = String(randomIntInRange(100000000000, 999999999999));
    const exists = await dbInventoryBarcodeExists(barcode, env);
    if (!exists) return barcode;
  }
  return null;
}

async function dbCreateInventoryItems(
  fields: {
    source_listing_id: number | null;
    ccg_number: string;
    image_url: string;
    image_urls: string;
    title: string;
    quantity: number;
    category_id: number;
    secondary_category_id: number | null;
    brand: string | null;
    queue: string;
    year_range: string | null;
    model: string | null;
    finish: string | null;
    repair_notes: string | null;
    original_listing_desc: string | null;
    video_url: string | null;
    sale_title: string | null;
    regular_price: number | null;
    sale_price: number | null;
    condition: string | null;
    sale_description: string | null;
    clearance: number;
    bullet_1_text: string | null;
    bullet_1_danger: number;
    bullet_1_highlight: number;
    bullet_2_text: string | null;
    bullet_2_danger: number;
    bullet_2_highlight: number;
    bullet_3_text: string | null;
    bullet_3_danger: number;
    bullet_3_highlight: number;
    bullet_4_text: string | null;
    bullet_4_danger: number;
    bullet_4_highlight: number;
    bullet_5_text: string | null;
    bullet_5_danger: number;
    bullet_5_highlight: number;
    bullet_6_text: string | null;
    bullet_6_danger: number;
    bullet_6_highlight: number;
    barcode: string | null;
    purchased_date: string;
    purchase_price: number | null;
    private_party_value: number;
    miles: number;
    minutes_spent: number;
    ship_cost: number;
    purchase_notes: string | null;
    ai_analysis_text: string | null;
    serial_number: string | null;
    weight_lbs: string | null;
    neck_profile: string | null;
    neck_thickness: string | null;
    nut_width: string | null;
    width_12_fret: string | null;
    fretboard_radius: string | null;
    twelve_fret_action: string | null;
    is_active: number;
    is_marked: number;
    is_personal: number;
    is_rented: number;
    for_sale: number;
    only_in_store: number;
    for_sale_date: string | null;
    is_sold: number;
    sold_date: string | null;
    sold_amount: number | null;
    sell_notes: string | null;
    sale_url: string | null;
    sale_zip: string | null;
  },
  env: Env
): Promise<{ firstId: string; ccgNumber: string } | null> {
  try {
    const statement = `INSERT INTO ccg_inventory_items
      (
        source_listing_id, ccg_number, image_url, title, quantity, category_id, brand, queue, year_range, model, finish,
        secondary_category_id,
        image_urls,
        repair_notes, original_listing_desc, video_url, sale_title, regular_price, sale_price, "condition", sale_description, clearance,
        bullet_1_text, bullet_1_danger, bullet_1_highlight,
        bullet_2_text, bullet_2_danger, bullet_2_highlight,
        bullet_3_text, bullet_3_danger, bullet_3_highlight,
        bullet_4_text, bullet_4_danger, bullet_4_highlight,
        bullet_5_text, bullet_5_danger, bullet_5_highlight,
        bullet_6_text, bullet_6_danger, bullet_6_highlight,
        barcode,
        purchased_date, purchase_price, private_party_value, miles, minutes_spent, ship_cost, purchase_notes, ai_analysis_text, serial_number,
        weight_lbs, neck_profile, neck_thickness, nut_width, width_12_fret, fretboard_radius, twelve_fret_action,
        is_active, is_marked, is_personal, is_rented, for_sale, only_in_store, for_sale_date,
        is_sold, sold_date, sold_amount, sell_notes, sale_url, sale_zip
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const result = await env.DB.prepare(statement).bind(
      fields.source_listing_id,
      fields.ccg_number,
      fields.image_url,
      fields.title,
      fields.quantity,
      fields.category_id,
      fields.brand,
      fields.queue,
      fields.year_range,
      fields.model,
      fields.finish,
      fields.secondary_category_id,
      fields.image_urls,
      fields.repair_notes,
      fields.original_listing_desc,
      fields.video_url,
      fields.sale_title,
      fields.regular_price,
      fields.sale_price,
      fields.condition,
      fields.sale_description,
      fields.clearance,
      fields.bullet_1_text,
      fields.bullet_1_danger,
      fields.bullet_1_highlight,
      fields.bullet_2_text,
      fields.bullet_2_danger,
      fields.bullet_2_highlight,
      fields.bullet_3_text,
      fields.bullet_3_danger,
      fields.bullet_3_highlight,
      fields.bullet_4_text,
      fields.bullet_4_danger,
      fields.bullet_4_highlight,
      fields.bullet_5_text,
      fields.bullet_5_danger,
      fields.bullet_5_highlight,
      fields.bullet_6_text,
      fields.bullet_6_danger,
      fields.bullet_6_highlight,
      fields.barcode,
      fields.purchased_date,
      fields.purchase_price,
      fields.private_party_value,
      fields.miles,
      fields.minutes_spent,
      fields.ship_cost,
      fields.purchase_notes,
      fields.ai_analysis_text,
      fields.serial_number,
      fields.weight_lbs,
      fields.neck_profile,
      fields.neck_thickness,
      fields.nut_width,
      fields.width_12_fret,
      fields.fretboard_radius,
      fields.twelve_fret_action,
      fields.is_active,
      fields.is_marked,
      fields.is_personal,
      fields.is_rented,
      fields.for_sale,
      fields.only_in_store,
      fields.for_sale_date,
      fields.is_sold,
      fields.sold_date,
      fields.sold_amount,
      fields.sell_notes,
      fields.sale_url,
      fields.sale_zip,
    ).run();
    const firstId = result.meta?.last_row_id ? String(result.meta.last_row_id) : null;
    if (!firstId) return null;
    return { firstId, ccgNumber: fields.ccg_number };
  } catch (error) {
    console.error('Inventory insert failed', { error });
    return null;
  }
}

async function dbUpdateInventoryById(
  recordId: string,
  fields: {
    image_url: string;
    image_urls: string;
    title: string;
    quantity: number;
    category_id: number;
    secondary_category_id: number | null;
    brand: string | null;
    queue: string;
    year_range: string | null;
    model: string | null;
    finish: string | null;
    repair_notes: string | null;
    original_listing_desc: string | null;
    purchased_date: string;
    purchase_price: number | null;
    private_party_value: number;
    miles: number;
    minutes_spent: number;
    ship_cost: number;
    purchase_notes: string | null;
    ai_analysis_text: string | null;
    serial_number: string | null;
    weight_lbs: string | null;
    neck_profile: string | null;
    neck_thickness: string | null;
    nut_width: string | null;
    width_12_fret: string | null;
    fretboard_radius: string | null;
    twelve_fret_action: string | null;
    storage_location: string | null;
    is_active: number;
    is_marked: number;
    is_personal: number;
    is_rented: number;
    for_sale: number;
    only_in_store: number;
    for_sale_date: string | null;
    source_listing_id: number | null;
    video_url: string | null;
    sale_title: string | null;
    regular_price: number | null;
    sale_price: number | null;
    condition: string | null;
    sale_description: string | null;
    clearance: number;
    bullet_1_text: string | null;
    bullet_1_danger: number;
    bullet_1_highlight: number;
    bullet_2_text: string | null;
    bullet_2_danger: number;
    bullet_2_highlight: number;
    bullet_3_text: string | null;
    bullet_3_danger: number;
    bullet_3_highlight: number;
    bullet_4_text: string | null;
    bullet_4_danger: number;
    bullet_4_highlight: number;
    bullet_5_text: string | null;
    bullet_5_danger: number;
    bullet_5_highlight: number;
    bullet_6_text: string | null;
    bullet_6_danger: number;
    bullet_6_highlight: number;
    barcode: string | null;
    is_sold: number;
    sold_date: string | null;
    sold_amount: number | null;
    sell_notes: string | null;
    subscription_id: number | null;
    sale_url: string | null;
    sale_zip: string | null;
    sold_channel: string | null;
  },
  env: Env,
): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  try {
    await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET
         image_url = ?, image_urls = ?, title = ?, quantity = ?, category_id = ?, secondary_category_id = ?,
         brand = ?, queue = ?, year_range = ?, model = ?, finish = ?,
         repair_notes = ?, original_listing_desc = ?, purchased_date = ?, purchase_price = ?,
         private_party_value = ?, miles = ?, minutes_spent = ?, ship_cost = ?, purchase_notes = ?, ai_analysis_text = ?, serial_number = ?,
         weight_lbs = ?, neck_profile = ?, neck_thickness = ?, nut_width = ?, width_12_fret = ?,
         fretboard_radius = ?, twelve_fret_action = ?, storage_location = ?,
         is_active = ?, is_marked = ?, is_personal = ?, is_rented = ?, for_sale = ?, only_in_store = ?, for_sale_date = ?,
         source_listing_id = ?, video_url = ?, sale_title = ?, regular_price = ?, sale_price = ?, "condition" = ?, sale_description = ?,
         clearance = ?,
         bullet_1_text = ?, bullet_1_danger = ?, bullet_1_highlight = ?,
         bullet_2_text = ?, bullet_2_danger = ?, bullet_2_highlight = ?,
         bullet_3_text = ?, bullet_3_danger = ?, bullet_3_highlight = ?,
         bullet_4_text = ?, bullet_4_danger = ?, bullet_4_highlight = ?,
         bullet_5_text = ?, bullet_5_danger = ?, bullet_5_highlight = ?,
         bullet_6_text = ?, bullet_6_danger = ?, bullet_6_highlight = ?,
         barcode = ?,
         is_sold = ?, sold_date = ?, sold_amount = ?, sell_notes = ?, subscription_id = ?,
         sale_url = ?, sale_zip = ?, sold_channel = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      fields.image_url,
      fields.image_urls,
      fields.title,
      fields.quantity,
      fields.category_id,
      fields.secondary_category_id,
      fields.brand,
      fields.queue,
      fields.year_range,
      fields.model,
      fields.finish,
      fields.repair_notes,
      fields.original_listing_desc,
      fields.purchased_date,
      fields.purchase_price,
      fields.private_party_value,
      fields.miles,
      fields.minutes_spent,
      fields.ship_cost,
      fields.purchase_notes,
      fields.ai_analysis_text,
      fields.serial_number,
      fields.weight_lbs,
      fields.neck_profile,
      fields.neck_thickness,
      fields.nut_width,
      fields.width_12_fret,
      fields.fretboard_radius,
      fields.twelve_fret_action,
      fields.storage_location,
      fields.is_active,
      fields.is_marked,
      fields.is_personal,
      fields.is_rented,
      fields.for_sale,
      fields.only_in_store,
      fields.for_sale_date,
      fields.source_listing_id,
      fields.video_url,
      fields.sale_title,
      fields.regular_price,
      fields.sale_price,
      fields.condition,
      fields.sale_description,
      fields.clearance,
      fields.bullet_1_text,
      fields.bullet_1_danger,
      fields.bullet_1_highlight,
      fields.bullet_2_text,
      fields.bullet_2_danger,
      fields.bullet_2_highlight,
      fields.bullet_3_text,
      fields.bullet_3_danger,
      fields.bullet_3_highlight,
      fields.bullet_4_text,
      fields.bullet_4_danger,
      fields.bullet_4_highlight,
      fields.bullet_5_text,
      fields.bullet_5_danger,
      fields.bullet_5_highlight,
      fields.bullet_6_text,
      fields.bullet_6_danger,
      fields.bullet_6_highlight,
      fields.barcode,
      fields.is_sold,
      fields.sold_date,
      fields.sold_amount,
      fields.sell_notes,
      fields.subscription_id,
      fields.sale_url,
      fields.sale_zip,
      fields.sold_channel,
      idValue,
    ).run();
    return true;
  } catch (error) {
    console.error('Inventory row update failed', { error });
    return false;
  }
}

async function dbSetInventoryMarked(recordId: string, isMarked: boolean, env: Env): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  try {
    const result = await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET is_marked = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(isMarked ? 1 : 0, idValue).run();
    return Number(result.meta?.changes || 0) > 0;
  } catch (error) {
    console.error('Inventory mark update failed', { error });
    return false;
  }
}

async function dbDeactivateInventoryItemById(recordId: string, env: Env): Promise<number> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return 0;
  try {
    const result = await env.DB.prepare(
      'UPDATE ccg_inventory_items SET is_active = 0, for_sale = 0, is_marked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(idValue).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory deactivate failed', { error });
    return 0;
  }
}

async function dbDeleteInventoryItemsByIds(ids: number[], env: Env): Promise<number> {
  const normalizedIds = ids.filter((id) => Number.isFinite(id) && id > 0);
  if (normalizedIds.length === 0) return 0;
  try {
    await dbDeleteInventoryImagesByItemIds(normalizedIds, env);
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `DELETE FROM ccg_inventory_items WHERE id IN (${placeholders})`
    ).bind(...normalizedIds).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory bulk delete failed', { error });
    return 0;
  }
}

async function dbDeleteListingsByIds(ids: number[], env: Env): Promise<number> {
  const normalizedIds = ids.filter((id) => Number.isFinite(id) && id > 0);
  if (normalizedIds.length === 0) return 0;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `DELETE FROM listings WHERE id IN (${placeholders})`
    ).bind(...normalizedIds).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Listing cleanup delete failed', { error });
    return 0;
  }
}

async function dbListMarkedInventoryRowsForPackage(env: Env): Promise<InventoryItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      i.id,
      i.source_listing_id,
      i.ccg_number,
      i.image_url,
      i.image_urls,
      i.title,
      i.quantity,
      ${INVENTORY_CATEGORY_SELECT_SQL},
      i.brand,
      i.year_range,
      i.model,
      i.finish,
      i.original_listing_desc,
      i.purchased_date,
      i.purchase_price,
      i.private_party_value,
      i.purchase_notes,
      i.serial_number,
      i.is_active,
      i.is_marked,
      i.is_personal,
      i.for_sale,
      i.for_sale_date,
      i.is_sold,
      i.sold_date,
      i.sold_amount,
      i.sell_notes,
      i.created_at,
      i.updated_at
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_marked, 0) = 1
     ORDER BY i.created_at ASC, i.id ASC`
  ).all<InventoryItemRow>();
  return result.results ?? [];
}

async function dbListMarkedInventoryRowsForPaymentLinks(env: Env): Promise<InventoryItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      i.id,
      i.ccg_number,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ccg_inventory_item_images sii_exists
          WHERE sii_exists.inventory_item_id = i.id
        ) THEN COALESCE((
          SELECT sii.image_url
          FROM ccg_inventory_item_images sii
          WHERE sii.inventory_item_id = i.id
            AND COALESCE(sii.is_private, 0) = 0
          ORDER BY sii.display_order ASC, sii.id ASC
          LIMIT 1
        ), '')
        ELSE i.image_url
      END AS image_url,
      i.image_urls,
      i.title,
      i.quantity,
      ${INVENTORY_CATEGORY_SELECT_SQL},
      i.brand,
      i.model,
      i.finish,
      i.original_listing_desc,
      i.sale_title,
      i.regular_price,
      i.sale_price,
      i.sale_description,
      i.is_marked,
      i.for_sale,
      i.is_sold,
      i.created_at,
      i.updated_at
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_marked, 0) = 1
     ORDER BY i.created_at ASC, i.id ASC`
  ).all<InventoryItemRow>();
  return result.results ?? [];
}

function mapPaymentLinkMarkedInventoryRow(row: InventoryItemRow): Record<string, unknown> {
  const unitAmountCents = getInventoryPaymentLinkPriceCents(row);
  return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    title: getInventoryPaymentLinkTitle(row),
    priceCents: unitAmountCents,
    price: formatCurrencyCents(unitAmountCents),
    quantity: Math.max(1, Number(row.quantity || 1)),
    brand: normalizeText(row.brand, ''),
    category: getInventoryCategoryLabel(row),
    forSale: Boolean(row.for_sale),
    isSold: Boolean(row.is_sold),
  };
}

function getInventoryPaymentLinkTitle(row: InventoryItemRow): string {
  return normalizeText(row.sale_title || row.title, 'Untitled item') || 'Untitled item';
}

function getInventoryPaymentLinkPriceCents(row: InventoryItemRow): number {
  const price = Number(row.sale_price || row.regular_price || 0);
  return Number.isFinite(price) ? Math.round(price * 100) : 0;
}

function formatCurrencyCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

async function dbUnmarkAllInventoryItems(env: Env): Promise<number> {
  try {
    const result = await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET is_marked = 0, updated_at = CURRENT_TIMESTAMP
       WHERE COALESCE(is_marked, 0) = 1`
    ).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory unmark all failed', { error });
    return 0;
  }
}

async function dbListMarkedInventoryLabelRows(
  env: Env,
): Promise<Array<{ ccg_number: string | null; title: string | null; image_url: string | null }>> {
  const result = await env.DB.prepare(
    `SELECT
      i.ccg_number,
      i.title,
      i.image_url
     FROM ccg_inventory_items i
     WHERE COALESCE(i.is_marked, 0) = 1
     ORDER BY i.created_at ASC, i.id ASC`
  ).all<{ ccg_number: string | null; title: string | null; image_url: string | null }>();
  return result.results ?? [];
}

async function dbListAllInventoryImageRefs(env: Env): Promise<Array<{ image_url: string | null; image_urls: string | null }>> {
  const [legacyResult, childResult] = await Promise.all([
    env.DB.prepare('SELECT image_url, image_urls FROM ccg_inventory_items')
      .all<{ image_url: string | null; image_urls: string | null }>(),
    env.DB.prepare(
      `SELECT NULL AS image_url, GROUP_CONCAT(image_url, char(10)) AS image_urls
       FROM (
         SELECT inventory_item_id, image_url
         FROM ccg_inventory_item_images
         ORDER BY inventory_item_id ASC, display_order ASC, id ASC
       )
       GROUP BY inventory_item_id`
    ).all<{ image_url: string | null; image_urls: string | null }>(),
  ]);
  return [...(legacyResult.results ?? []), ...(childResult.results ?? [])];
}

async function dbListInventoryImagesForItemIds(
  itemIds: number[],
  env: Env,
): Promise<Map<number, Array<{ id: string; url: string; order: number; isPrivate: boolean }>>> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  const output = new Map<number, Array<{ id: string; url: string; order: number; isPrivate: boolean }>>();
  if (normalizedIds.length === 0) return output;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `SELECT id, inventory_item_id, image_url, display_order, is_private
       FROM ccg_inventory_item_images
       WHERE inventory_item_id IN (${placeholders})
       ORDER BY inventory_item_id ASC, display_order ASC, id ASC`
    ).bind(...normalizedIds).all<InventoryItemImageRow>();
    for (const row of result.results ?? []) {
      const key = Number(row.inventory_item_id);
      if (!output.has(key)) output.set(key, []);
      output.get(key)?.push({
        id: String(row.id),
        url: normalizeText(row.image_url, ''),
        order: Number(row.display_order || 0),
        isPrivate: Boolean(row.is_private),
      });
    }
  } catch (error) {
    console.warn('Inventory image child lookup failed; falling back to legacy image columns.', { error });
  }
  return output;
}

async function dbReplaceInventoryImagesByItemIds(
  itemIds: number[],
  images: InventoryImageInput[],
  env: Env,
): Promise<boolean> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (normalizedIds.length === 0) return true;
  try {
    await dbDeleteInventoryImagesByItemIds(normalizedIds, env);
    if (images.length === 0) return true;
    const statements = normalizedIds.flatMap((inventoryItemId) =>
      images.map((image, index) =>
        env.DB.prepare(
          `INSERT INTO ccg_inventory_item_images (inventory_item_id, image_url, display_order, is_private)
           VALUES (?, ?, ?, ?)`
        ).bind(inventoryItemId, image.url, index + 1, image.isPrivate ? 1 : 0),
      ),
    );
    await env.DB.batch(statements);
    return true;
  } catch (error) {
    console.error('Inventory image child replace failed', { error });
    return false;
  }
}

async function dbDeleteInventoryImagesByItemIds(itemIds: number[], env: Env): Promise<void> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (normalizedIds.length === 0) return;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `DELETE FROM ccg_inventory_item_images WHERE inventory_item_id IN (${placeholders})`
    ).bind(...normalizedIds).run();
  } catch (error) {
    console.warn('Inventory image child delete skipped', { error });
  }
}

async function dbGetInventorySummary(env: Env): Promise<InventorySummaryTotals> {
  const row = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN i.is_active = 1 THEN l.price_asking ELSE 0 END), 0) AS total_listed,
      COALESCE(SUM(CASE WHEN i.is_sold = 1 THEN i.sold_amount ELSE 0 END), 0) AS total_sold,
      COALESCE(SUM(i.purchase_price), 0) AS total_purchased,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 0 THEN COALESCE(i.purchase_price, 0) ELSE 0 END), 0) AS ccg_paid_unsold,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 0 THEN COALESCE(i.private_party_value, 0) ELSE 0 END), 0) AS ccg_private_party_unsold,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.purchase_price, 0) ELSE 0 END), 0) AS ccg_sold_paid,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.private_party_value, 0) ELSE 0 END), 0) AS ccg_sold_private_party,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN (COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)) ELSE 0 END), 0) AS ccg_sold_profit_amount,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.sold_amount, 0) ELSE 0 END), 0) AS ccg_sold_amount_total,
      COALESCE(SUM(CASE WHEN i.is_active = 1 THEN 1 ELSE 0 END), 0) AS ccg_active_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.for_sale, 0) = 0 THEN 1 ELSE 0 END), 0) AS ccg_not_for_sale_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.for_sale, 0) = 1 THEN 1 ELSE 0 END), 0) AS ccg_for_sale_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.is_sold, 0) = 1 THEN 1 ELSE 0 END), 0) AS ccg_sold_items
     FROM ccg_inventory_items i
     LEFT JOIN listings l ON l.id = i.source_listing_id`
  ).first<{
    total_listed: number | null;
    total_sold: number | null;
    total_purchased: number | null;
    ccg_paid_unsold: number | null;
    ccg_private_party_unsold: number | null;
    ccg_sold_paid: number | null;
    ccg_sold_private_party: number | null;
    ccg_sold_profit_amount: number | null;
    ccg_sold_amount_total: number | null;
    ccg_active_items: number | null;
    ccg_not_for_sale_items: number | null;
    ccg_for_sale_items: number | null;
    ccg_sold_items: number | null;
  }>();

  const soldProfitAmount = Number(row?.ccg_sold_profit_amount || 0);
  const soldAmountTotal = Number(row?.ccg_sold_amount_total || 0);
  const soldProfitMarginPercent = soldAmountTotal > 0
    ? (soldProfitAmount / soldAmountTotal) * 100
    : 0;

  return {
    totalListed: Number(row?.total_listed || 0),
    totalSold: Number(row?.total_sold || 0),
    totalPurchased: Number(row?.total_purchased || 0),
    ccgPaidUnsold: Number(row?.ccg_paid_unsold || 0),
    ccgPrivatePartyUnsold: Number(row?.ccg_private_party_unsold || 0),
    ccgSoldPaid: Number(row?.ccg_sold_paid || 0),
    ccgSoldPrivateParty: Number(row?.ccg_sold_private_party || 0),
    ccgSoldProfitMarginPercent: soldProfitMarginPercent,
    ccgActiveItems: Number(row?.ccg_active_items || 0),
    ccgNotForSaleItems: Number(row?.ccg_not_for_sale_items || 0),
    ccgForSaleItems: Number(row?.ccg_for_sale_items || 0),
    ccgSoldItems: Number(row?.ccg_sold_items || 0),
  };
}

async function dbGetAdminV2DashboardSummary(env: Env): Promise<AdminV2DashboardSummary> {
  const summary = await dbGetInventorySummary(env);
  const row = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(
        CASE
          WHEN i.is_active = 1 AND COALESCE(i.is_sold, 0) = 0 AND COALESCE(i.for_sale, 0) = 1
            THEN COALESCE(l.price_asking, i.private_party_value, i.purchase_price, 0)
          ELSE 0
        END
      ), 0) AS current_asking_value,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', 'start of month')
            THEN COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)
          ELSE 0
        END
      ), 0) AS realized_profit_mtd,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-30 days')
            THEN COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)
          ELSE 0
        END
      ), 0) AS sold_profit_30d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-30 days')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS sold_revenue_30d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-60 days')
            THEN COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)
          ELSE 0
        END
      ), 0) AS sold_profit_60d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-60 days')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS sold_revenue_60d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-90 days')
            THEN COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)
          ELSE 0
        END
      ), 0) AS sold_profit_90d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-90 days')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS sold_revenue_90d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('2026-06-01')
            THEN COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)
          ELSE 0
        END
      ), 0) AS post_store_launch_profit,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('2026-06-01')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS post_store_launch_revenue,
      COALESCE(AVG(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.purchased_date IS NOT NULL
            AND i.sold_date IS NOT NULL
            THEN julianday(i.sold_date) - julianday(i.purchased_date)
          ELSE NULL
        END
      ), 0) AS avg_days_to_sell
     FROM ccg_inventory_items i
     LEFT JOIN listings l ON l.id = i.source_listing_id`
  ).first<{
    current_asking_value: number | null;
    realized_profit_mtd: number | null;
    sold_profit_30d: number | null;
    sold_revenue_30d: number | null;
    sold_profit_60d: number | null;
    sold_revenue_60d: number | null;
    sold_profit_90d: number | null;
    sold_revenue_90d: number | null;
    post_store_launch_profit: number | null;
    post_store_launch_revenue: number | null;
    avg_days_to_sell: number | null;
  }>();

  const soldRevenue30Day = Number(row?.sold_revenue_30d || 0);
  const soldRevenue60Day = Number(row?.sold_revenue_60d || 0);
  const soldRevenue90Day = Number(row?.sold_revenue_90d || 0);
  const postStoreLaunchRevenue = Number(row?.post_store_launch_revenue || 0);

  return {
    inventoryCostBasis: summary.ccgPaidUnsold,
    privatePartyValue: summary.ccgPrivatePartyUnsold,
    currentAskingValue: Number(row?.current_asking_value || 0),
    realizedProfitMTD: Number(row?.realized_profit_mtd || 0),
    soldMargin30DayPercent: soldRevenue30Day > 0 ? (Number(row?.sold_profit_30d || 0) / soldRevenue30Day) * 100 : 0,
    soldMargin60DayPercent: soldRevenue60Day > 0 ? (Number(row?.sold_profit_60d || 0) / soldRevenue60Day) * 100 : 0,
    soldMargin90DayPercent: soldRevenue90Day > 0 ? (Number(row?.sold_profit_90d || 0) / soldRevenue90Day) * 100 : 0,
    postStoreLaunchMarginPercent: postStoreLaunchRevenue > 0
      ? (Number(row?.post_store_launch_profit || 0) / postStoreLaunchRevenue) * 100
      : 0,
    forSaleItems: summary.ccgForSaleItems,
    avgDaysToSell: Number(row?.avg_days_to_sell || 0),
    activeItems: summary.ccgActiveItems,
    notForSaleItems: summary.ccgNotForSaleItems,
    soldItems: summary.ccgSoldItems,
    allTimeSoldMarginPercent: summary.ccgSoldProfitMarginPercent,
  };
}

async function dbGetAdminV2ProfitTrend(months: number, env: Env): Promise<AdminV2ProfitTrendPoint[]> {
  const rows = await env.DB.prepare(
    `SELECT
      strftime('%Y-%m', i.sold_date) AS month_key,
      COUNT(*) AS sold_count,
      COALESCE(SUM(i.sold_amount), 0) AS revenue,
      COALESCE(SUM(i.purchase_price), 0) AS cost,
      COALESCE(SUM(COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)), 0) AS profit
     FROM ccg_inventory_items i
     WHERE COALESCE(i.is_sold, 0) = 1
       AND COALESCE(i.is_personal, 0) = 0
       AND i.sold_date IS NOT NULL
       AND i.sold_date >= date('now', 'start of month', ?)
     GROUP BY month_key
     ORDER BY month_key ASC`
  ).bind(`-${Math.max(0, months - 1)} months`).all<{
    month_key: string | null;
    sold_count: number | null;
    revenue: number | null;
    cost: number | null;
    profit: number | null;
  }>();

  const byMonth = new Map<string, {
    soldCount: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();
  for (const row of rows.results ?? []) {
    const key = typeof row.month_key === 'string' ? row.month_key : '';
    if (!key) continue;
    byMonth.set(key, {
      soldCount: Number(row.sold_count || 0),
      revenue: Number(row.revenue || 0),
      cost: Number(row.cost || 0),
      profit: Number(row.profit || 0),
    });
  }

  const points: AdminV2ProfitTrendPoint[] = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() - (months - 1));

  for (let index = 0; index < months; index += 1) {
    const month = cursor.toISOString().slice(0, 7);
    const row = byMonth.get(month);
    points.push({
      month,
      label: formatMonthLabel(month),
      soldCount: row?.soldCount ?? 0,
      revenue: row?.revenue ?? 0,
      cost: row?.cost ?? 0,
      profit: row?.profit ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return points;
}

async function dbGetAdminV2InventoryAging(env: Env): Promise<AdminV2InventoryAgingBucket[]> {
  const rows = await env.DB.prepare(
    `SELECT
      CASE
        WHEN i.purchased_date IS NULL THEN 'unknown'
        WHEN julianday('now') - julianday(i.purchased_date) <= 30 THEN '0-30'
        WHEN julianday('now') - julianday(i.purchased_date) <= 60 THEN '31-60'
        WHEN julianday('now') - julianday(i.purchased_date) <= 90 THEN '61-90'
        ELSE '90+'
      END AS bucket_key,
      COUNT(*) AS item_count,
      COALESCE(SUM(COALESCE(i.purchase_price, 0)), 0) AS cost_basis,
      COALESCE(SUM(COALESCE(i.private_party_value, 0)), 0) AS private_party_value,
      COALESCE(SUM(COALESCE(l.price_asking, i.private_party_value, i.purchase_price, 0)), 0) AS current_asking_value
     FROM ccg_inventory_items i
     LEFT JOIN listings l ON l.id = i.source_listing_id
     WHERE i.is_active = 1
       AND COALESCE(i.is_sold, 0) = 0
       AND COALESCE(i.is_personal, 0) = 0
     GROUP BY bucket_key`
  ).all<{
    bucket_key: string | null;
    item_count: number | null;
    cost_basis: number | null;
    private_party_value: number | null;
    current_asking_value: number | null;
  }>();

  const labels: Record<string, string> = {
    '0-30': '0-30 days',
    '31-60': '31-60 days',
    '61-90': '61-90 days',
    '90+': '90+ days',
    unknown: 'Unknown purchase date',
  };

  const defaults = ['0-30', '31-60', '61-90', '90+', 'unknown'];
  const byKey = new Map<string, AdminV2InventoryAgingBucket>();

  for (const row of rows.results ?? []) {
    const key = typeof row.bucket_key === 'string' ? row.bucket_key : 'unknown';
    byKey.set(key, {
      key,
      label: labels[key] || key,
      itemCount: Number(row.item_count || 0),
      costBasis: Number(row.cost_basis || 0),
      privatePartyValue: Number(row.private_party_value || 0),
      currentAskingValue: Number(row.current_asking_value || 0),
    });
  }

  return defaults.map((key) => byKey.get(key) || {
    key,
    label: labels[key] || key,
    itemCount: 0,
    costBasis: 0,
    privatePartyValue: 0,
    currentAskingValue: 0,
  });
}

async function dbGetAdminV2InventoryByCategory(env: Env): Promise<AdminV2InventoryCategoryBucket[]> {
  const rows = await env.DB.prepare(
    `SELECT
      CASE
        WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
        WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
        ELSE c.name
      END AS category,
      COUNT(*) AS item_count
     FROM ccg_inventory_items i
     INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     WHERE COALESCE(i.is_active, 0) = 1
     GROUP BY i.category_id
     ORDER BY item_count DESC, category ASC`
  ).all<{
    category: string | null;
    item_count: number | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    category: row.category || 'Uncategorized',
    itemCount: Number(row.item_count || 0),
  }));
}

async function dbGetAdminV2RecentSales(limit: number, env: Env): Promise<AdminV2RecentSaleRow[]> {
  const rows = await env.DB.prepare(
    `SELECT
      i.id,
      i.ccg_number,
      i.title,
      i.image_url,
      CASE
        WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
        WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
        ELSE c.name
      END AS category,
      i.brand,
      i.sold_date,
      i.purchase_price,
      i.sold_amount,
      (COALESCE(i.sold_amount, 0) - COALESCE(i.purchase_price, 0)) AS profit_amount,
      CASE
        WHEN i.purchased_date IS NOT NULL AND i.sold_date IS NOT NULL
          THEN CAST(julianday(i.sold_date) - julianday(i.purchased_date) AS INTEGER)
        ELSE NULL
      END AS days_held
     FROM ccg_inventory_items i
     INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     WHERE COALESCE(i.is_sold, 0) = 1
     ORDER BY COALESCE(i.sold_date, i.updated_at, i.created_at) DESC, i.id DESC
     LIMIT ?`
  ).bind(limit).all<{
    id: number;
    ccg_number: string;
    title: string;
    image_url: string | null;
    category: string | null;
    brand: string | null;
    sold_date: string | null;
    purchase_price: number | null;
    sold_amount: number | null;
    profit_amount: number | null;
    days_held: number | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    id: Number(row.id),
    ccgNumber: row.ccg_number,
    title: row.title,
    imageUrl: toAdminImageUrl(row.image_url, 'thumb'),
    category: row.category,
    brand: row.brand,
    soldDate: row.sold_date,
    purchasePrice: Number(row.purchase_price || 0),
    soldAmount: Number(row.sold_amount || 0),
    profitAmount: Number(row.profit_amount || 0),
    daysHeld: row.days_held == null ? null : Number(row.days_held),
  }));
}

async function dbGetAdminV2OldestInventory(limit: number, env: Env): Promise<AdminV2OldestInventoryRow[]> {
  const rows = await env.DB.prepare(
    `SELECT
      i.id,
      i.ccg_number,
      i.title,
      i.image_url,
      CASE
        WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
        WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
        ELSE c.name
      END AS category,
      i.brand,
      i.purchased_date,
      CASE
        WHEN i.purchased_date IS NOT NULL
          THEN CAST(julianday('now') - julianday(i.purchased_date) AS INTEGER)
        ELSE NULL
      END AS days_held,
      i.purchase_price,
      i.private_party_value,
      COALESCE(l.price_asking, i.private_party_value, i.purchase_price, 0) AS current_asking_value,
      COALESCE(i.for_sale, 0) AS for_sale,
      l.source AS source
     FROM ccg_inventory_items i
     INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     LEFT JOIN listings l ON l.id = i.source_listing_id
     WHERE i.is_active = 1
       AND COALESCE(i.is_sold, 0) = 0
     ORDER BY
       CASE WHEN i.purchased_date IS NULL THEN 1 ELSE 0 END ASC,
       i.purchased_date ASC,
       i.id ASC
     LIMIT ?`
  ).bind(limit).all<{
    id: number;
    ccg_number: string;
    title: string;
    image_url: string | null;
    category: string | null;
    brand: string | null;
    purchased_date: string | null;
    days_held: number | null;
    purchase_price: number | null;
    private_party_value: number | null;
    current_asking_value: number | null;
    for_sale: number | null;
    source: string | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    id: Number(row.id),
    ccgNumber: row.ccg_number,
    title: row.title,
    imageUrl: toAdminImageUrl(row.image_url, 'thumb'),
    category: row.category,
    brand: row.brand,
    purchasedDate: row.purchased_date,
    daysHeld: row.days_held == null ? null : Number(row.days_held),
    purchasePrice: Number(row.purchase_price || 0),
    privatePartyValue: Number(row.private_party_value || 0),
    currentAskingValue: Number(row.current_asking_value || 0),
    forSale: Number(row.for_sale || 0) === 1,
    source: row.source,
  }));
}

async function dbListAdminV2ActivityLog(
  page: number,
  limit: number,
  env: Env,
): Promise<{
  records: Array<{
    id: number;
    eventTimeUtc: string;
    eventKey: string;
    iconKey: string;
    eventText: string;
    eventUrl: string | null;
    imageUrl: string | null;
    entityType: string | null;
    entityId: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(25, limit));
  const offset = (safePage - 1) * safeLimit;

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM activity_log`
  ).first<{ total: number | null }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const result = await env.DB.prepare(
    `SELECT
      l.id,
      l.event_time_utc,
      l.event_text,
      l.event_url,
      l.image_url,
      l.entity_type,
      l.entity_id,
      t.event_key,
      t.icon_key
     FROM activity_log l
     INNER JOIN activity_event_type t
       ON t.id = l.event_type_id
     ORDER BY l.event_time_utc DESC, l.id DESC
     LIMIT ? OFFSET ?`
  ).bind(safeLimit, offset).all<{
    id: number;
    event_time_utc: string | null;
    event_text: string | null;
    event_url: string | null;
    image_url: string | null;
    entity_type: string | null;
    entity_id: string | null;
    event_key: string | null;
    icon_key: string | null;
  }>();

  const records = (result.results ?? []).map((row) => ({
    id: Number(row.id),
    eventTimeUtc: normalizeText(row.event_time_utc, ''),
    eventKey: normalizeText(row.event_key, ''),
    iconKey: normalizeText(row.icon_key, ''),
    eventText: normalizeText(row.event_text, ''),
    eventUrl: normalizeText(row.entity_type, '') === 'listing_eval' && normalizeText(row.entity_id, '')
      ? buildAdminListingEvaluatorItemUrl(normalizeText(row.entity_id, ''))
      : normalizeUrl(normalizeText(row.event_url, '')),
    imageUrl: normalizeUrl(normalizeText(row.image_url, '')),
    entityType: normalizeText(row.entity_type, '') || null,
    entityId: normalizeText(row.entity_id, '') || null,
  }));

  return {
    records,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasMore: safePage * safeLimit < total,
  };
}

async function dbListAdminV2SerialDecodes(
  page: number,
  limit: number,
  brand: string,
  onlyErrors: boolean,
  unevaluated: boolean,
  sortDir: 'asc' | 'desc',
  env: Env,
): Promise<{
  records: AdminV2SerialDecodeRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  availableBrands: string[];
}> {
  const where: string[] = [];
  const values: unknown[] = [];
  const db = env.DB.withSession('first-primary');

  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }
  if (onlyErrors) {
    where.push(`COALESCE(success, 0) = 0`);
  }
  if (unevaluated) {
    where.push(`COALESCE(evaluated, 0) = 0`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS total FROM serial_decode_events ${whereSql}`
  ).bind(...values).first<{ total: number | null }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(Math.max(1, page), totalPages);
  const offset = (effectivePage - 1) * limit;

  const brandRows = await db.prepare(
    `SELECT MIN(trim(brand)) AS brand
     FROM serial_decode_events
     WHERE trim(COALESCE(brand, '')) <> ''
     GROUP BY lower(trim(brand))
     ORDER BY lower(trim(brand)) ASC`
  ).all<{ brand: string | null }>();
  const availableBrands = (brandRows.results ?? [])
    .map((row) => normalizeText(row.brand, ''))
    .filter(Boolean);

  let rows;
  try {
    rows = await db.prepare(
      `SELECT
        e.id,
        e.event_time_utc,
        e.client_timestamp,
        e.brand,
        e.serial,
        e.pattern_lookup_id,
        e.success,
        e.evaluated,
        e.year,
        e.factory,
        e.country,
        e.error,
        COALESCE(
          datetime(e.client_timestamp),
          datetime(e.event_time_utc),
          datetime(e.created_at)
        ) AS sort_ts
       FROM serial_decode_events e
       ${whereSql}
       ORDER BY sort_ts ${sortDir.toUpperCase()}, id ${sortDir.toUpperCase()}
       LIMIT ? OFFSET ?`
    ).bind(...values, limit, offset).all<{
      id: number | null;
      event_time_utc: string | null;
      client_timestamp: string | null;
      brand: string | null;
      serial: string | null;
      pattern_lookup_id: number | null;
      success: number | null;
      evaluated: number | null;
      year: string | null;
      factory: string | null;
      country: string | null;
      error: string | null;
    }>();
  } catch (error) {
    console.warn('Serial decode list query fell back to legacy schema', { error });
    rows = await db.prepare(
      `SELECT
        e.id,
        e.event_time_utc,
        e.client_timestamp,
        e.brand,
        e.serial,
        e.success,
        e.evaluated,
        e.year,
        e.factory,
        e.country,
        e.error,
        COALESCE(
          datetime(e.client_timestamp),
          datetime(e.event_time_utc),
          datetime(e.created_at)
        ) AS sort_ts
       FROM serial_decode_events e
       ${whereSql}
       ORDER BY sort_ts ${sortDir.toUpperCase()}, id ${sortDir.toUpperCase()}
       LIMIT ? OFFSET ?`
    ).bind(...values, limit, offset).all<{
      id: number | null;
      event_time_utc: string | null;
      client_timestamp: string | null;
      brand: string | null;
      serial: string | null;
      success: number | null;
      evaluated: number | null;
      year: string | null;
      factory: string | null;
      country: string | null;
      error: string | null;
    }>();
  }

  const records = (rows.results ?? []).map((row) => ({
    id: Number(row.id || 0),
    eventTimeUtc: typeof row.event_time_utc === 'string' ? row.event_time_utc : null,
    clientTimestamp: typeof row.client_timestamp === 'string' ? row.client_timestamp : null,
    brand: normalizeText(row.brand, ''),
    serial: normalizeText(row.serial, ''),
    patternLookupId: Number((row as { pattern_lookup_id?: number | null }).pattern_lookup_id || 0) || null,
    success: Number(row.success || 0) === 1,
    evaluated: Number(row.evaluated || 0) === 1,
    year: normalizeText(row.year, '') || null,
    factory: normalizeText(row.factory, '') || null,
    country: normalizeText(row.country, '') || null,
    error: normalizeText(row.error, '') || null,
  }));

  return {
    records,
    page: effectivePage,
    limit,
    total,
    totalPages,
    availableBrands,
  };
}

async function dbGetAdminV2SerialDecodeBrandResponses(
  brand: string,
  env: Env,
): Promise<AdminV2SerialDecodeBrandResponseRow[]> {
  const where: string[] = [`trim(COALESCE(brand, '')) <> ''`];
  const values: unknown[] = [];

  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT
      trim(brand) AS brand,
      COUNT(*) AS response_count
     FROM serial_decode_events
     ${whereSql}
     GROUP BY lower(trim(brand))
     ORDER BY response_count DESC, lower(trim(brand)) ASC`
  ).bind(...values).all<{
    brand: string | null;
    response_count: number | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    brand: normalizeText(row.brand, ''),
    responseCount: Number(row.response_count || 0),
  }));
}

async function dbGetAdminV2SerialDecodeLookupVolume(
  view: AdminV2SerialLookupVolumeView,
  brand: string,
  env: Env,
): Promise<{
  view: AdminV2SerialLookupVolumeView;
  records: AdminV2SerialLookupVolumeBucket[];
  availableBrands: string[];
}> {
  const db = env.DB.withSession('first-primary');
  const where: string[] = [`trim(COALESCE(client_timestamp, '')) <> ''`];
  const values: unknown[] = [];

  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [eventRows, brandRows] = await Promise.all([
    db.prepare(
      `SELECT
        client_timestamp AS lookup_ts
       FROM serial_decode_events
       ${whereSql}`,
    ).bind(...values).all<{ lookup_ts: string | null }>(),
    db.prepare(
      `SELECT MIN(trim(brand)) AS brand
       FROM serial_decode_events
       WHERE trim(COALESCE(brand, '')) <> ''
       GROUP BY lower(trim(brand))
       ORDER BY lower(trim(brand)) ASC`,
    ).all<{ brand: string | null }>(),
  ]);

  const availableBrands = (brandRows.results ?? [])
    .map((row) => normalizeText(row.brand, ''))
    .filter(Boolean);

  const records = buildSerialLookupVolumeBuckets(view, eventRows.results ?? []);
  return {
    view,
    records,
    availableBrands,
  };
}

async function dbListAdminV2SerialPatternLookup(
  page: number,
  limit: number,
  showAll: boolean,
  sortBy: AdminV2SerialPatternLookupSortBy,
  sortDir: 'asc' | 'desc',
  lookupId: number,
  brand: string,
  pattern: string,
  env: Env,
): Promise<{
  records: AdminV2SerialPatternLookupRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const db = env.DB.withSession('first-primary');
  const where: string[] = [];
  const values: unknown[] = [];

  if (!showAll) {
    where.push(`trim(COALESCE(rich_text, '')) = ''`);
  }
  if (lookupId > 0) {
    where.push(`id = ?`);
    values.push(lookupId);
  }
  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }
  if (pattern) {
    where.push(`trim(pattern) = ?`);
    values.push(pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM serial_decode_pattern_lookup
     ${whereSql}`
  ).bind(...values).first<{ total: number | null }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const effectivePage = Math.min(safePage, totalPages);
  const offset = (effectivePage - 1) * safeLimit;

  const sortExpr = sortBy === 'pattern'
    ? 'lower(trim(pattern))'
    : sortBy === 'populated'
      ? `CASE WHEN trim(COALESCE(rich_text, '')) <> '' THEN 1 ELSE 0 END`
      : 'lower(trim(brand))';
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

  const rows = await db.prepare(
    `SELECT
      l.id,
      l.brand,
      l.pattern,
      l.regex_pattern,
      l.rich_text,
      l.created_at,
      l.updated_at,
      CASE WHEN trim(COALESCE(rich_text, '')) <> '' THEN 1 ELSE 0 END AS is_populated
     FROM serial_decode_pattern_lookup l
     ${whereSql}
     ORDER BY ${sortExpr} ${dir}, lower(trim(brand)) ASC, lower(trim(pattern)) ASC
     LIMIT ? OFFSET ?`
  ).bind(...values, safeLimit, offset).all<{
    id: number | null;
    brand: string | null;
    pattern: string | null;
    regex_pattern: string | null;
    rich_text: string | null;
    created_at: string | null;
    updated_at: string | null;
    is_populated: number | null;
  }>();

  const records: AdminV2SerialPatternLookupRow[] = (rows.results ?? [])
    .map((row) => {
      const brand = normalizeText(row.brand, '');
      const pattern = normalizeText(row.pattern, '');
      const storedRegexPattern = normalizeText(row.regex_pattern, '');
      const regexPattern = !storedRegexPattern || storedRegexPattern === '^.{1,}$'
        ? deriveRegexFromPatternKey(pattern)
        : storedRegexPattern;
      return {
        id: Number(row.id || 0),
        brand,
        pattern,
        regexPattern,
        richText: normalizeText(row.rich_text, ''),
        richTextPopulated: Number(row.is_populated || 0) === 1,
        createdAt: normalizeText(row.created_at, '') || null,
        updatedAt: normalizeText(row.updated_at, '') || null,
      };
    })
    .filter((row) => row.brand.length > 0 && row.pattern.length > 0);

  return {
    records,
    page: effectivePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}

function buildSerialLookupVolumeBuckets(
  view: AdminV2SerialLookupVolumeView,
  rows: Array<{ lookup_ts: string | null }>,
): AdminV2SerialLookupVolumeBucket[] {
  const bucketCount = 30;
  const bucketDates = getRecentDenverBucketDates(view, bucketCount);
  const counts = new Map<string, number>();
  for (const bucketDate of bucketDates) {
    counts.set(getDenverBucketKey(view, bucketDate), 0);
  }

  for (const row of rows) {
    const eventDate = parseSerialLookupTimestamp(row.lookup_ts);
    if (!eventDate) continue;
    const key = getDenverBucketKey(view, eventDate);
    if (!counts.has(key)) continue;
    counts.set(key, Number(counts.get(key) || 0) + 1);
  }

  return bucketDates.map((bucketDate) => {
    const key = getDenverBucketKey(view, bucketDate);
    return {
      key,
      label: formatDenverBucketLabel(view, bucketDate),
      responseCount: Number(counts.get(key) || 0),
    };
  });
}

function getRecentDenverBucketDates(view: AdminV2SerialLookupVolumeView, count: number): Date[] {
  const now = new Date();
  const denverNowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const denverYear = Number(denverNowParts.find((part) => part.type === 'year')?.value || now.getUTCFullYear());
  const denverMonth = Number(denverNowParts.find((part) => part.type === 'month')?.value || now.getUTCMonth() + 1);
  const denverDay = Number(denverNowParts.find((part) => part.type === 'day')?.value || now.getUTCDate());

  const anchor = view === 'month'
    ? new Date(Date.UTC(denverYear, denverMonth - 1, 1, 12, 0, 0))
    : new Date(Date.UTC(denverYear, denverMonth - 1, denverDay, 12, 0, 0));

  const dates: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const cursor = new Date(anchor.getTime());
    if (view === 'month') {
      cursor.setUTCMonth(cursor.getUTCMonth() - index);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() - index);
    }
    dates.push(cursor);
  }
  return dates;
}

function getDenverBucketKey(view: AdminV2SerialLookupVolumeView, date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  if (view === 'month') {
    return `${year}-${month}`;
  }
  return `${year}-${month}-${day}`;
}

function formatDenverBucketLabel(view: AdminV2SerialLookupVolumeView, date: Date): string {
  if (view === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      month: 'short',
      year: 'numeric',
    }).format(date).replace(/\s+/g, '-');
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function parseSerialLookupTimestamp(input: string | null): Date | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const usDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!usDate) return null;

  const month = Number.parseInt(usDate[1], 10) - 1;
  const day = Number.parseInt(usDate[2], 10);
  const year = Number.parseInt(usDate[3], 10);
  const hour = Number.parseInt(usDate[4] || '0', 10);
  const minute = Number.parseInt(usDate[5] || '0', 10);
  const second = Number.parseInt(usDate[6] || '0', 10);
  const parsed = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function dbGetPublishedSerialPatternContext(
  normalizedBrand: string,
  patternKey: string,
  env: Env,
): Promise<SerialPatternContextPayload | null> {
  if (!normalizedBrand || !patternKey) return null;
  const row = await env.DB.prepare(
    `SELECT
      title,
      summary,
      highlights_json,
      caveats_json,
      verification_json
     FROM serial_pattern_contexts
     WHERE normalized_brand = ?
       AND pattern_key = ?
       AND published = 1
     LIMIT 1`
  ).bind(normalizedBrand, patternKey).first<SerialPatternContextRow>();

  if (!row) return null;
  return {
    title: normalizeText(row.title, ''),
    summary: normalizeText(row.summary, ''),
    highlights: parseStringArray(row.highlights_json),
    caveats: parseStringArray(row.caveats_json),
    verificationTips: parseStringArray(row.verification_json),
  };
}

async function dbUpsertSerialPatternContext(
  payload: {
    brand: string;
    normalizedBrand: string;
    patternKey: string;
    patternLabel: string;
    title: string;
    summary: string;
    highlights: string[];
    caveats: string[];
    verificationTips: string[];
    sourceSerial?: string;
    aiModel?: string;
    aiResponseJson?: string;
    published?: boolean;
  },
  env: Env,
): Promise<{ id: number; context: SerialPatternContextPayload }> {
  const db = env.DB.withSession('first-primary');
  await db.prepare(
    `INSERT INTO serial_pattern_contexts (
      brand,
      normalized_brand,
      pattern_key,
      pattern_label,
      title,
      summary,
      highlights_json,
      caveats_json,
      verification_json,
      source_serial,
      ai_model,
      ai_response_json,
      published,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(normalized_brand, pattern_key)
    DO UPDATE SET
      brand = excluded.brand,
      pattern_label = excluded.pattern_label,
      title = excluded.title,
      summary = excluded.summary,
      highlights_json = excluded.highlights_json,
      caveats_json = excluded.caveats_json,
      verification_json = excluded.verification_json,
      source_serial = excluded.source_serial,
      ai_model = excluded.ai_model,
      ai_response_json = excluded.ai_response_json,
      published = excluded.published,
      updated_at = CURRENT_TIMESTAMP`
  ).bind(
    payload.brand,
    payload.normalizedBrand,
    payload.patternKey,
    payload.patternLabel,
    payload.title,
    payload.summary,
    JSON.stringify(payload.highlights || []),
    JSON.stringify(payload.caveats || []),
    JSON.stringify(payload.verificationTips || []),
    payload.sourceSerial || null,
    payload.aiModel || null,
    payload.aiResponseJson || null,
    payload.published === false ? 0 : 1,
  ).run();

  const row = await db.prepare(
    `SELECT id
     FROM serial_pattern_contexts
     WHERE normalized_brand = ? AND pattern_key = ?
     LIMIT 1`
  ).bind(payload.normalizedBrand, payload.patternKey).first<{ id: number | null }>();

  return {
    id: Number(row?.id || 0),
    context: {
      title: payload.title,
      summary: payload.summary,
      highlights: payload.highlights || [],
      caveats: payload.caveats || [],
      verificationTips: payload.verificationTips || [],
    },
  };
}

function parseStringArray(input: string | null | undefined): string[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => normalizeText(value, ''))
      .filter((value) => value.length > 0)
      .slice(0, 12);
  } catch {
    return [];
  }
}

async function dbSetSerialDecodeEvaluated(
  recordId: string,
  evaluated: boolean,
  env: Env,
): Promise<{
  evaluated: boolean;
  updatedCount: number;
  activityCandidate?: {
    brand: string;
    serial: string;
    normalizedBrand: string;
    success: boolean;
    wasEvaluated: boolean;
  };
} | null> {
  const id = normalizeText(recordId, '');
  if (!/^\d+$/.test(id)) return null;
  const db = env.DB.withSession('first-primary');

  if (evaluated) {
    const keyRow = await db.prepare(
      `SELECT brand, serial, normalized_brand, success, evaluated
       FROM serial_decode_events
       WHERE CAST(id AS TEXT) = ?`
    ).bind(id).first<{
      brand: string | null;
      serial: string | null;
      normalized_brand: string | null;
      success: number | null;
      evaluated: number | null;
    }>();
    if (!keyRow) return null;

    const brand = normalizeText(keyRow.brand, '');
    const serial = normalizeText(keyRow.serial, '');
    if (!brand || !serial) return null;
    const normalizedBrand = normalizeText(keyRow.normalized_brand, '') || normalizeBrandKey(brand);
    const success = Number(keyRow.success || 0) === 1;
    const wasEvaluated = Number(keyRow.evaluated || 0) === 1;

    const updateResult = await db.prepare(
      `UPDATE serial_decode_events
       SET evaluated = 1
       WHERE lower(trim(brand)) = lower(trim(?))
         AND lower(trim(serial)) = lower(trim(?))`
    ).bind(brand, serial).run();

    return {
      evaluated: true,
      updatedCount: Number(updateResult.meta.changes || 0),
      activityCandidate: {
        brand,
        serial,
        normalizedBrand,
        success,
        wasEvaluated,
      },
    };
  }

  const updateResult = await db.prepare(
    `UPDATE serial_decode_events
     SET evaluated = 0
     WHERE CAST(id AS TEXT) = ?`
  ).bind(id).run();

  const row = await db.prepare(
    `SELECT evaluated
     FROM serial_decode_events
     WHERE CAST(id AS TEXT) = ?`
  ).bind(id).first<{ evaluated: number | null }>();

  if (!row) return null;
  return {
    evaluated: Number(row.evaluated || 0) === 1,
    updatedCount: Number(updateResult.meta.changes || 0),
  };
}

async function dbDeleteSerialDecodeRecord(
  recordId: string,
  env: Env,
): Promise<{ deletedCount: number } | null> {
  const id = normalizeText(recordId, '');
  if (!/^\d+$/.test(id)) return null;

  const db = env.DB.withSession('first-primary');
  const deleteResult = await db.prepare(
    `DELETE FROM serial_decode_events
     WHERE CAST(id AS TEXT) = ?`
  ).bind(id).run();

  return {
    deletedCount: Number(deleteResult.meta.changes || 0),
  };
}

async function getIsMultiFromRecord(recordId: string, env: Env): Promise<boolean> {
  const record = await dbGetListing(recordId, env);
  return isMultiValue(record?.fields?.IsMulti);
}

type ListingSource = 'facebook' | 'craigslist' | 'reverb';

type ListingData = {
  title: string;
  price: string;
  location: string;
  condition: string;
  description: string;
  images: string[];
  url?: string;
  notes?: string;
  brandHint?: string;
  modelHint?: string;
};

type SingleAiResult = {
  category: string;
  brand: string;
  model: string;
  finish: string;
  year: string;
  condition: string;
  serial: string;
  serial_brand: string;
  serial_year: string;
  serial_model: string;
  value_private_party_low: number | string | null;
  value_private_party_low_notes: string;
  value_private_party_medium: number | string | null;
  value_private_party_medium_notes: string;
  value_private_party_high: number | string | null;
  value_private_party_high_notes: string;
  value_pawn_shop_notes: string;
  value_online_notes: string;
  known_weak_points: string;
  typical_repair_needs: string;
  buyers_worry: string;
  og_specs_pickups: string;
  og_specs_tuners: string;
  og_specs_common_mods: string;
  buyer_what_to_check: string;
  buyer_common_misrepresent: string;
  seller_how_to_price_realistic: string;
  seller_fixes_add_value_or_waste: string;
  seller_as_is_notes: string;
  asking_price: number | string | null;
  pricing_source?: string;
  pricing_confidence?: string;
  pricing_comp_count?: number | string | null;
  pricing_notes?: string;
};

type AiResult = { kind: 'multi'; summary: string } | { kind: 'single'; data: SingleAiResult };

function normalizeListing(item: any): ListingData {
  const title = pickString(
    item.listingTitle,
    item.title?.text,
    item.title,
    item.name?.text,
    item.name,
    item.heading,
    item.marketplaceListingTitle,
    item.marketplace_listing_title,
    item.custom_title,
    item.listing_title,
    item.listing?.title,
    item.listing?.marketplaceListingTitle
  );
  const description = pickString(
    item.description?.text,
    item.post,
    item.description,
    item.details,
    item.body,
    item.text,
    item.postingBody,
    item.posting_body,
    item.desc,
    item.summary
  );
  const price = pickString(
    item.listing_price?.formatted_amount,
    item.listing_price?.amount,
    item.listing_price?.amount_with_offset_in_currency,
    item.listingPrice?.formatted_amount_zeros_stripped,
    item.listingPrice?.amount,
    item.price,
    item.priceFormatted,
    item.priceText,
    item.priceAmount,
    item.priceRange
  );
  const location = pickLocation(
    item.location?.reverse_geocode?.city,
    item.location?.reverse_geocode?.city_page?.display_name,
    item.locationText?.text,
    item.location,
    item.locationText,
    item.where,
    item.city,
    item.region,
    item.address?.city,
    item.address?.region
  );
  const condition = pickString(item.condition, item.itemCondition, item.conditionText);

  const images = pickImages(item);

  return {
    title,
    description,
    price,
    location,
    condition,
    images,
    url: pickString(
      item.url,
      item.itemUrl,
      item.item_url,
      item.listingUrl,
      item.listingURL,
      item.listingUrl,
      item.facebookUrl,
      item.itemUrl,
      item.itemURL,
      item.canonicalUrl,
      item.canonicalURL,
      item.shareUrl,
      item.shareURL,
      item.marketplaceListingUrl,
      item.marketplaceListingURL
    ),
  };
}

function pickImages(item: any): string[] {
  const images: string[] = [];

  const candidates = [
    item.images,
    item.imageUrls,
    item.photos,
    item.photosSmall,
    item.imageUrl,
    item.image,
    item.pics,
    item.picUrls,
    item.listingPhotos,
    item.primary_listing_photo,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        if (typeof entry === 'string') images.push(entry);
        if (entry?.url) images.push(entry.url);
        if (entry?.imageUrl) images.push(entry.imageUrl);
        if (entry?.image?.uri) images.push(entry.image.uri);
      });
    } else if (typeof candidate === 'string') {
      images.push(candidate);
    } else if (candidate?.photo_image_url) {
      images.push(candidate.photo_image_url);
    }
  }

  const unique = Array.from(new Set(images.filter(Boolean)));
  return unique;
}

function pickString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

function normalizeText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function normalizeEmailAddress(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  if (email.length > 254) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function sanitizePatternLookupHtml(input: string): string {
  const raw = normalizeText(input, '').replace(/\u0000/g, '');
  if (!raw) return '';

  let html = raw
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select|meta|link|base)\b[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select|meta|link|base)\b[^>]*\/?>/gi, '')
    .replace(/<\s*\/?\s*span\b[^>]*>/gi, '')
    .replace(/<\s*\/?\s*font\b[^>]*>/gi, '')
    .replace(/<\s*b\b[^>]*>/gi, '<strong>')
    .replace(/<\s*\/\s*b\s*>/gi, '</strong>')
    .replace(/<\s*i\b[^>]*>/gi, '<em>')
    .replace(/<\s*\/\s*i\s*>/gi, '</em>')
    .replace(/<\s*div\b[^>]*>/gi, '<p>')
    .replace(/<\s*\/\s*div\s*>/gi, '</p>');

  const allowedTags = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'h3', 'h4', 'blockquote']);

  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tagNameRaw: string, attrsRaw: string) => {
    const tagName = String(tagNameRaw || '').toLowerCase();
    if (!allowedTags.has(tagName)) return '';

    const isClosing = /^<\s*\//.test(full);
    if (isClosing) return `</${tagName}>`;
    if (tagName === 'br') return '<br>';
    if (tagName === 'a') {
      const hrefMatch = String(attrsRaw || '').match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const hrefCandidate = hrefMatch ? (hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '') : '';
      const href = sanitizeHrefAttribute(hrefCandidate);
      return `<a href="${escapeHtmlAttribute(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
    }
    return `<${tagName}>`;
  });

  html = html
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<li>\s*<\/li>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return plainTextToSafeHtml(html);
  }

  return html;
}

function sanitizeHrefAttribute(value: string): string {
  const href = normalizeText(value, '');
  if (!href) return '#';
  const lower = href.toLowerCase();
  if (
    lower.startsWith('http://')
    || lower.startsWith('https://')
    || lower.startsWith('mailto:')
    || lower.startsWith('tel:')
    || lower.startsWith('/')
    || lower.startsWith('#')
  ) {
    return href;
  }
  return '#';
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function plainTextToSafeHtml(input: string): string {
  const normalized = normalizeText(input, '');
  if (!normalized) return '';

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return '';

  let inList = false;
  const out: string[] = [];
  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }

    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeSerialKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function deriveRegexFromPatternKey(patternKey: string): string {
  try {
  const cleaned = normalizeText(patternKey, '');
  if (!cleaned) return '^.{1,}$';

  const explicitRegex = deriveExplicitRegexFromKnownPatternKey(cleaned);
  if (explicitRegex) return explicitRegex;

  const parts = cleaned.split(':');
  const prefixPart = parts.find((part) => part.startsWith('prefix-')) || '';
  const lengthPart = parts.find((part) => part.startsWith('len-')) || '';
  const maskPart = parts.length > 0 ? parts[parts.length - 1] : '';
  const lengthValue = Number.parseInt(lengthPart.replace(/^len-/i, ''), 10);
  const prefixRaw = prefixPart.replace(/^prefix-/i, '');
  const prefix = prefixRaw && prefixRaw !== 'none' ? prefixRaw.toUpperCase() : '';
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const maskRuns = parsePatternMaskRuns(maskPart, Number.isFinite(lengthValue) && lengthValue > 0 ? lengthValue : null);
  const runLength = maskRuns.reduce((sum, run) => sum + run.count, 0);

  if (maskRuns.length > 0) {
    const pieces: string[] = [];
    let prefixRemaining = escapedPrefix;
    let consumedPrefix = false;

    for (const run of maskRuns) {
      if (!consumedPrefix && prefixRemaining && run.type === 'A') {
        const consumeCount = Math.min(prefixRemaining.length, run.count);
        if (consumeCount > 0) {
          pieces.push(prefixRemaining.slice(0, consumeCount));
          prefixRemaining = prefixRemaining.slice(consumeCount);
        }
        const alphaRemainder = run.count - consumeCount;
        if (alphaRemainder > 0) pieces.push(`[A-Z]{${alphaRemainder}}`);
        if (!prefixRemaining) consumedPrefix = true;
      } else {
        pieces.push(run.type === 'A' ? `[A-Z]{${run.count}}` : `\\d{${run.count}}`);
      }
    }

    if (prefixRemaining) {
      pieces.unshift(escapedPrefix);
    }
    return `^${pieces.join('')}$`;
  }

  if (Number.isFinite(lengthValue) && lengthValue > 0) {
    if (escapedPrefix) {
      const remaining = Math.max(0, lengthValue - escapedPrefix.length);
      return `^${escapedPrefix}[A-Z0-9]{${remaining}}$`;
    }
    return `^[A-Z0-9]{${lengthValue}}$`;
  }

  if (escapedPrefix) return `^${escapedPrefix}[A-Z0-9]*$`;
  return '^.{1,}$';
  } catch {
    return '^.{1,}$';
  }
}

function deriveExplicitRegexFromKnownPatternKey(patternKey: string): string | null {
  const knownPatterns: Record<string, string> = {
    'bcrich-b-prefix-month-code-import': '^B[ACEFGHJKLMNP]\\d{8}$',
    'bcrich-7-digit-numeric-import-yy-sequence': '^\\d{7}$',
    'bcrich-class-axe-b-prefix-import': '^B\\d{3,6}$',
    'bcrich-f-prefix-six-digit-import': '^F\\d{6}$',
    'bcrich-hanser-era-8-digit-import': '^\\d{8}$',
    'bcrich-hanser-two-letter-month-plant-import': '^[ACEFGHJKLMNP][A-Z]\\d{7}$',
    'bcrich-short-modern-month-code-import': '^[ACEFGHJKLMNP]\\d{7}$',
    'bcrich-short-numeric-import-y-filler-quarter-sequence': '^\\d{6}$',
    'cort-1980s-korea-7-digit-yy-sequence': '^8\\d{6}$',
    'cort-ai-indonesia-yymm-sequence': '^AI\\d{9}$',
    'cort-icse-indonesia-yy-sequence': '^ICSE\\d{8}$',
    'cort-late-1990s-8-digit-yymm-sequence': '^9\\d{7}$',
    'cort-modern-8-digit-year-batch-sequence': '^\\d{2}00\\d{4}$',
    'cort-modern-9-digit-yymm-sequence': '^\\d{9}$',
    'cort-modern-12-digit-year-tracking-sequence': '^\\d{12}$',
    'cort-r-prefix-yy-sequence': '^R\\d{7}$',
    'cort-year-sequence-7-digit': '^00\\d{5}$',
    'epiphone-korea-single-letter-factory-yymm-sequence': '^[A-Z]\\d{7,}$',
    'ibanez-china-gaoqing-grand-star-g-yymm-sequence': '^G\\d{8}$',
    'ibanez-gs-mixed-contractor-yy-plant-mm-sequence': '^GS\\d{2}[A-Z]\\d{6}$',
    'schecter-ca-yymm-sequence': '^CA\\d{8}$',
    'schecter-h-yymm-sequence': '^H\\d{7,9}$',
    'schecter-im-indonesia-yymm-sequence': '^IM\\d{8}$',
    'schecter-korea-legacy-6-digit': '^\\d{6}$',
    'schecter-rn-yymm-sequence': '^RN\\d{8}$',
    'schecter-ro-indonesia-yy-sequence': '^RO\\d{8}$',
    'schecter-st-yymm-sequence': '^ST\\d{8}$',
    'taylor-legacy-9-digit-year-code': '^\\d{9}$',
    'taylor-modern-extended-11': '^[12]\\d{10}$',
    'taylor-modern-short-9': '^[12]\\d{8}$',
  };

  return knownPatterns[patternKey] || null;
}

function parsePatternMaskRuns(maskPart: string, expectedLength: number | null): Array<{ type: 'A' | '9'; count: number }> {
  const mask = normalizeText(maskPart, '');
  if (!mask || !/^[A9]/.test(mask)) return [];

  const memo = new Map<string, Array<{ type: 'A' | '9'; count: number }> | null>();

  const solve = (idx: number, remaining: number | null): Array<{ type: 'A' | '9'; count: number }> | null => {
    const key = `${idx}:${remaining == null ? 'n' : remaining}`;
    if (memo.has(key)) return memo.get(key) || null;

    if (idx >= mask.length) {
      const done = remaining == null || remaining === 0 ? [] : null;
      memo.set(key, done);
      return done;
    }

    const marker = mask[idx];
    if (marker !== 'A' && marker !== '9') {
      memo.set(key, null);
      return null;
    }

    let best: Array<{ type: 'A' | '9'; count: number }> | null = null;
    for (let end = idx + 2; end <= mask.length; end += 1) {
      const countText = mask.slice(idx + 1, end);
      if (!/^\d+$/.test(countText)) continue;
      const count = Number.parseInt(countText, 10);
      if (!Number.isFinite(count) || count <= 0) continue;
      if (remaining != null && count > remaining) continue;

      const nextRemaining = remaining == null ? null : remaining - count;
      const next = solve(end, nextRemaining);
      if (!next) continue;

      const candidate = [{ type: marker as 'A' | '9', count }, ...next];
      best = candidate;
      break;
    }

    memo.set(key, best);
    return best;
  };

  const exact = solve(0, expectedLength);
  if (exact) return exact;

  const fallback = solve(0, null);
  return fallback || [];
}

function generateSampleSerialFromPatternKey(patternKey: string): string {
  const fallback = 'A1234567';
  const parts = normalizeText(patternKey, '').split(':');
  if (parts.length < 3) return fallback;

  const prefixPart = parts.find((part) => part.startsWith('prefix-')) || '';
  const lenPart = parts.find((part) => part.startsWith('len-')) || '';
  const prefixRaw = prefixPart.replace(/^prefix-/i, '');
  const prefix = prefixRaw && prefixRaw !== 'none' ? prefixRaw.toUpperCase() : '';
  const targetLen = Number.parseInt(lenPart.replace(/^len-/i, ''), 10);

  let sample = '';
  if (prefix) sample = prefix;

  if (Number.isFinite(targetLen) && targetLen > 0) {
    if (sample.length >= targetLen) {
      sample = sample.slice(0, targetLen);
    } else {
      sample = `${sample}${'1'.repeat(targetLen - sample.length)}`;
    }
  } else if (!sample) {
    sample = fallback;
  }

  return sample || fallback;
}

function deriveSerialPatternMeta(normalizedBrand: string, serialInput: string): { patternKey: string; patternLabel: string } {
  const serial = normalizeSerialKey(serialInput).slice(0, 180);
  if (!serial) {
    return {
      patternKey: `${normalizedBrand}:unknown`,
      patternLabel: 'Unknown format',
    };
  }

  const alphaPrefix = (serial.match(/^[A-Z]+/)?.[0] || '').slice(0, 6);
  const masked = serial.replace(/[A-Z]/g, 'A').replace(/\d/g, '9');
  const compactMask = compressMask(masked).slice(0, 80);
  const prefixPart = alphaPrefix ? `prefix-${alphaPrefix.toLowerCase()}` : 'prefix-none';
  const lengthPart = `len-${serial.length}`;
  const maskPart = compactMask || 'mask-none';

  return {
    patternKey: `${prefixPart}:${lengthPart}:${maskPart}`,
    patternLabel: [
      alphaPrefix ? `Prefix ${alphaPrefix}` : 'No prefix',
      `${serial.length} chars`,
      compactMask,
    ].filter(Boolean).join(' | '),
  };
}

function compressMask(mask: string): string {
  if (!mask) return '';
  let out = '';
  let current = mask[0];
  let count = 1;
  for (let i = 1; i < mask.length; i += 1) {
    const ch = mask[i];
    if (ch === current) {
      count += 1;
      continue;
    }
    out += `${current}${count}`;
    current = ch;
    count = 1;
  }
  out += `${current}${count}`;
  return out;
}

function shouldAttemptAiFallback(result: { success: boolean; error?: string }): boolean {
  if (result.success) return false;
  const error = normalizeText(result.error, '');
  if (!error) return true;
  return ![
    'Please select a brand.',
    'Unknown brand selected.',
    'Please enter a serial number.',
  ].includes(error);
}

function hasMeaningfulServerDecodeInfo(info: {
  year?: string;
  month?: string;
  factory?: string;
  country?: string;
  model?: string;
}): boolean {
  return (
    isMeaningfulServerYear(info.year) ||
    isMeaningfulServerMonth(info.month) ||
    isMeaningfulServerDescriptor(info.factory, 'factory') ||
    isMeaningfulServerDescriptor(info.country, 'country') ||
    isMeaningfulServerDescriptor(info.model, 'model')
  );
}

function isMeaningfulServerYear(value: string | undefined): boolean {
  const text = normalizeText(value, '');
  if (!text) return false;
  if (/\b(possibly|likely|maybe|check|unknown|contact)\b/i.test(text)) return false;
  if (/\s+or\s+/i.test(text)) return false;
  return /\d{4}/.test(text);
}

function isMeaningfulServerMonth(value: string | undefined): boolean {
  const text = normalizeText(value, '');
  if (!text) return false;
  return /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(text);
}

function isMeaningfulServerDescriptor(
  value: string | undefined,
  kind: 'factory' | 'country' | 'model',
): boolean {
  const text = normalizeText(value, '');
  if (!text) return false;
  if (/\b(unknown|unspecified|check|contact|n\/a|not available)\b/i.test(text)) return false;
  if (/\s+or\s+/i.test(text)) return false;
  if (kind === 'country' && /\bimport\b/i.test(text)) return false;
  if (kind === 'factory' && /\blikely\b/i.test(text)) return false;
  return true;
}

function hasMeaningfulDecodedFields(payload: AiSerialDecodeParsed): boolean {
  return [payload.year, payload.month, payload.factory, payload.country, payload.model]
    .some((value) => normalizeText(value, '').length > 0 && !/^unknown$/i.test(normalizeText(value, '')));
}

function mapAiParsedToDecodeResult(
  payload: AiSerialDecodeParsed,
  brandInput: string,
  serialInput: string,
  normalizedBrand: string,
): ReturnType<typeof decodeSerialForBackend> {
  if (!payload.success || !hasMeaningfulDecodedFields(payload)) {
    return {
      success: false,
      error: 'Unable to decode this serial number.',
      normalizedBrand,
    };
  }

  return {
    success: true,
    normalizedBrand,
    info: {
      brand: normalizeText(brandInput, 'Unknown'),
      serialNumber: normalizeText(serialInput, ''),
      year: normalizeNullableDecodedField(payload.year),
      month: normalizeNullableDecodedField(payload.month),
      factory: normalizeNullableDecodedField(payload.factory),
      country: normalizeNullableDecodedField(payload.country),
      model: normalizeNullableDecodedField(payload.model),
      notes: normalizeNullableDecodedField(payload.notes)
        || 'AI-assisted fallback decode. Verify with factory markings and model features.',
    },
  };
}

function mapCachedAiRowToDecodeResult(
  row: AiSerialDecodeCacheRow,
  normalizedBrand: string,
): ReturnType<typeof decodeSerialForBackend> {
  const success = Number(row.success || 0) === 1;
  if (!success) {
    return {
      success: false,
      error: normalizeText(row.error, 'Unable to decode this serial number.'),
      normalizedBrand,
    };
  }

  return {
    success: true,
    normalizedBrand,
    info: {
      brand: normalizeText(row.brand, 'Unknown'),
      serialNumber: normalizeText(row.serial, ''),
      year: normalizeNullableDecodedField(row.year),
      month: normalizeNullableDecodedField(row.month),
      factory: normalizeNullableDecodedField(row.factory),
      country: normalizeNullableDecodedField(row.country),
      model: normalizeNullableDecodedField(row.model),
      notes: normalizeNullableDecodedField(row.notes)
        || 'AI-assisted fallback decode (cached). Verify with factory markings and model features.',
    },
  };
}

function normalizeNullableDecodedField(value: unknown): string | undefined {
  const text = normalizeText(value, '');
  if (!text) return undefined;
  if (/^(unknown|n\/a|not sure)$/i.test(text)) return undefined;
  return text;
}

async function getAiSerialDecodeCache(
  env: Env,
  normalizedBrand: string,
  normalizedSerial: string,
): Promise<AiSerialDecodeCacheRow | null> {
  return await env.DB.prepare(
    `SELECT
      success,
      brand,
      serial,
      year,
      month,
      factory,
      country,
      model,
      notes,
      error,
      ai_model,
      ai_response_json
     FROM serial_decode_events
     WHERE normalized_brand = ?
       AND normalized_serial = ?
       AND used_ai = 1
       AND is_listing_eval = 0
     ORDER BY created_at DESC, id DESC
     LIMIT 1`
  ).bind(normalizedBrand, normalizedSerial).first<AiSerialDecodeCacheRow>();
}

async function isAiSerialDecodeRateLimited(env: Env, ipAddress: string): Promise<boolean> {
  if (!ipAddress) return false;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM serial_decode_events
     WHERE used_ai = 1
       AND is_listing_eval = 0
       AND ip_address = ?
       AND datetime(created_at) >= datetime('now', '-1 hour')`
  ).bind(ipAddress).first<{ total: number | null }>();
  const total = Number(row?.total || 0);
  return total >= SERIAL_AI_HOURLY_LIMIT;
}

async function runOpenAISerialDecodeFallback(
  brand: string,
  serial: string,
  env: Env,
): Promise<{ payload: AiSerialDecodeParsed; model: string; rawResponseJson: string; logText: string }> {
  if (!env.OPENAI_API_KEY) {
    return {
      payload: {
        success: false,
        year: null,
        month: null,
        factory: null,
        country: null,
        model: null,
        notes: null,
        error: 'AI fallback unavailable: missing OPENAI_API_KEY.',
      },
      model: 'gpt-4o',
      rawResponseJson: '',
      logText: 'AI fallback unavailable: missing OPENAI_API_KEY.',
    };
  }

  const userPrompt = [
    `I have a ${brand} guitar with serial number "${serial}".`,
    'Decode this serial number.',
    'Return year, month (if available), factory, country, model (if inferable), and useful notes.',
    'If the serial cannot be decoded reliably, set success=false and explain why in error and notes.',
    'Also include concise information that could help decode similar serials in the future.',
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content: [{ type: 'input_text', text: userPrompt }] }],
      temperature: 0.1,
      max_output_tokens: 700,
      text: {
        format: {
          type: 'json_schema',
          name: 'serial_decode_fallback',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              success: { type: 'boolean' },
              year: { type: ['string', 'null'] },
              month: { type: ['string', 'null'] },
              factory: { type: ['string', 'null'] },
              country: { type: ['string', 'null'] },
              model: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              error: { type: ['string', 'null'] },
            },
            required: ['success', 'year', 'month', 'factory', 'country', 'model', 'notes', 'error'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    return {
      payload: {
        success: false,
        year: null,
        month: null,
        factory: null,
        country: null,
        model: null,
        notes: null,
        error: `AI fallback request failed (${response.status}).`,
      },
      model: 'gpt-4o',
      rawResponseJson: '',
      logText: `AI fallback request failed (${response.status}).`,
    };
  }

  const data = await response.json();
  const rawResponseJson = JSON.stringify(data);
  const text = extractOpenAIText(data);

  try {
    const parsed = JSON.parse(text) as AiSerialDecodeParsed;
    const logText = normalizeText(parsed.error, '') || normalizeText(parsed.notes, '') || 'AI fallback attempted.';
    return {
      payload: parsed,
      model: 'gpt-4o',
      rawResponseJson,
      logText,
    };
  } catch {
    return {
      payload: {
        success: false,
        year: null,
        month: null,
        factory: null,
        country: null,
        model: null,
        notes: null,
        error: 'AI fallback returned invalid JSON.',
      },
      model: 'gpt-4o',
      rawResponseJson,
      logText: 'AI fallback returned invalid JSON.',
    };
  }
}

async function runOpenAISerialPatternContextFromScreenshots(
  brand: string,
  serial: string,
  patternLabel: string,
  titleHint: string,
  screenshots: File[],
  env: Env,
): Promise<{ payload: SerialPatternContextPayload | null; model: string; rawResponseJson: string; error?: string }> {
  if (!env.OPENAI_API_KEY) {
    return {
      payload: null,
      model: 'gpt-4o',
      rawResponseJson: '',
      error: 'OPENAI_API_KEY is not configured.',
    };
  }

  const prompt = [
    `You are helping build reusable serial-decoder context for ${brand}.`,
    `Serial sample: ${serial}`,
    `Detected pattern: ${patternLabel}`,
    'Use only the uploaded screenshots as source material.',
    'Paraphrase and consolidate; do not quote long passages.',
    'If data conflicts across screenshots, mention that as a caveat.',
    'Keep output concise and useful for end-users doing a lookup.',
    titleHint ? `Optional editor hint: ${titleHint}` : '',
  ].filter(Boolean).join('\n');

  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }];
  for (const shot of screenshots.slice(0, 6)) {
    const bytes = new Uint8Array(await shot.arrayBuffer());
    const mime = normalizeText(shot.type, '').toLowerCase().startsWith('image/')
      ? shot.type
      : 'image/jpeg';
    const b64 = toBase64(bytes);
    content.push({
      type: 'input_image',
      image_url: `data:${mime};base64,${b64}`,
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content }],
      temperature: 0.2,
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'serial_pattern_context',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' },
              highlights: { type: 'array', items: { type: 'string' } },
              caveats: { type: 'array', items: { type: 'string' } },
              verificationTips: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'summary', 'highlights', 'caveats', 'verificationTips'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    return {
      payload: null,
      model: 'gpt-4o',
      rawResponseJson: '',
      error: `OpenAI request failed (${response.status}).`,
    };
  }

  const data = await response.json();
  const rawResponseJson = JSON.stringify(data);
  const text = extractOpenAIText(data);

  try {
    const parsed = JSON.parse(text) as Partial<SerialPatternContextPayload>;
    return {
      payload: sanitizePatternContextPayload(parsed, brand, patternLabel),
      model: 'gpt-4o',
      rawResponseJson,
    };
  } catch {
    return {
      payload: null,
      model: 'gpt-4o',
      rawResponseJson,
      error: 'OpenAI returned invalid JSON.',
    };
  }
}

async function maybeParaphrasePatternLookupHtml(
  brand: string,
  pattern: string,
  richHtml: string,
  env: Env,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;
  const rawSourceText = htmlToPromptText(richHtml);
  // Strip the boilerplate "Based on the provided regex ..." opener that AI tools often prepend
  const sourceText = rawSourceText.replace(/^Based on the provided regex\b[^.]*\.\s*/i, '').slice(0, 9000);
  if (!sourceText) return null;

  const regexPattern = deriveRegexFromPatternKey(pattern);
  const prompt = [
    `You are writing standardized serial-pattern guidance for Coal Creek Guitars.`,
    `Brand: ${brand}`,
    `Pattern key: ${pattern}`,
    `Regex pattern: ${regexPattern || '-'}`,
    '',
    'Rewrite the source material into original wording. Do not quote source text verbatim.',
    'Output concise, practical content for buyers decoding serial numbers.',
    'No dates or "as of" timestamps.',
    '',
    'Use this structure:',
    '1) overview paragraph',
    '2) serialStructure paragraph (how this pattern is typically read)',
    '3) keyIndicators bullet list',
    '4) caveats bullet list',
    '5) additionalInfo bullet list (use for overflow/extra details)',
    '6) one short Coal Creek Guitars note based on hands-on experience language',
    '',
    'Source text:',
    sourceText,
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
        temperature: 0.2,
        max_output_tokens: 1000,
        text: {
          format: {
            type: 'json_schema',
            name: 'serial_pattern_rich_text',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                overview: { type: 'string' },
                serialStructure: { type: 'string' },
                keyIndicators: { type: 'array', items: { type: 'string' } },
                caveats: { type: 'array', items: { type: 'string' } },
                additionalInfo: { type: 'array', items: { type: 'string' } },
                coalCreekNote: { type: 'string' },
              },
              required: ['overview', 'serialStructure', 'keyIndicators', 'caveats', 'additionalInfo', 'coalCreekNote'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.warn('Pattern rich-text paraphrase failed', { status: response.status, body: bodyText.slice(0, 600) });
      return null;
    }

    const data = await response.json();
    const output = extractOpenAIText(data);
    const parsed = JSON.parse(output) as {
      overview?: string;
      serialStructure?: string;
      keyIndicators?: unknown;
      caveats?: unknown;
      additionalInfo?: unknown;
      coalCreekNote?: string;
    };

    const overview = normalizeText(parsed.overview, '').slice(0, 1200);
    const serialStructure = normalizeText(parsed.serialStructure, '').slice(0, 1400);
    const coalCreekNote = normalizeText(parsed.coalCreekNote, '').slice(0, 600);
    const keyIndicators = sanitizePatternContextList(parsed.keyIndicators, 12, 320);
    const caveats = sanitizePatternContextList(parsed.caveats, 10, 320);
    const additionalInfo = sanitizePatternContextList(parsed.additionalInfo, 16, 320);

    return buildStandardPatternLookupHtml({
      brand,
      overview,
      serialStructure,
      keyIndicators,
      caveats,
      additionalInfo,
      coalCreekNote,
    });
  } catch (error) {
    console.warn('Pattern rich-text paraphrase error', { error });
    return null;
  }
}

function htmlToPromptText(input: string): string {
  const normalized = normalizeText(input, '').replace(/\u0000/g, '');
  if (!normalized) return '';
  return normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol|blockquote|h3|h4|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, '\'')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function buildStandardPatternLookupHtml(input: {
  brand: string;
  overview: string;
  serialStructure: string;
  keyIndicators: string[];
  caveats: string[];
  additionalInfo: string[];
  coalCreekNote: string;
}): string {
  const out: string[] = [];
  if (input.overview) out.push(`<h3>Overview</h3><p>${escapeHtmlText(input.overview)}</p>`);
  if (input.serialStructure) out.push(`<h3>How This Pattern Is Typically Read</h3><p>${escapeHtmlText(input.serialStructure)}</p>`);
  if (input.keyIndicators.length > 0) {
    out.push('<h3>Key Indicators</h3>');
    out.push('<ul>');
    for (const item of input.keyIndicators) out.push(`<li>${escapeHtmlText(item)}</li>`);
    out.push('</ul>');
  }
  if (input.caveats.length > 0) {
    out.push('<h3>What To Verify</h3>');
    out.push('<ul>');
    for (const item of input.caveats) out.push(`<li>${escapeHtmlText(item)}</li>`);
    out.push('</ul>');
  }
  if (input.additionalInfo.length > 0) {
    out.push('<h3>Additional Info</h3>');
    out.push('<ul>');
    for (const item of input.additionalInfo) out.push(`<li>${escapeHtmlText(item)}</li>`);
    out.push('</ul>');
  }
  const fallbackNote = `Coal Creek Guitars uses this as practical guidance and recommends confirming with in-hand markings, hardware, and construction details before final conclusions.`;
  out.push(`<h3>Coal Creek Guitars Note</h3><p>${escapeHtmlText(input.coalCreekNote || fallbackNote)}</p>`);

  return out.join('');
}

function escapeHtmlText(value: string): string {
  return normalizeText(value, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePatternContextPayload(
  payload: Partial<SerialPatternContextPayload>,
  brand: string,
  patternLabel: string,
): SerialPatternContextPayload {
  const fallbackTitle = `${brand} ${patternLabel} pattern notes`;
  return {
    title: normalizeText(payload.title, fallbackTitle).slice(0, 140),
    summary: normalizeText(payload.summary, 'Additional context available for this serial pattern.').slice(0, 1200),
    highlights: sanitizePatternContextList(payload.highlights, 10, 320),
    caveats: sanitizePatternContextList(payload.caveats, 8, 320),
    verificationTips: sanitizePatternContextList(payload.verificationTips, 8, 320),
  };
}

function sanitizePatternContextList(input: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(input)) return [];
  const items: string[] = [];
  for (const entry of input) {
    const cleaned = normalizeText(entry, '').slice(0, maxItemLength);
    if (!cleaned) continue;
    items.push(cleaned);
    if (items.length >= maxItems) break;
  }
  return items;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeCategory(value: unknown): string {
  const raw = normalizeText(value, 'Other');
  if (!raw) return 'Other';
  const match = CATEGORY_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match || 'Other';
}

function normalizeFinish(value: unknown): string {
  const raw = normalizeText(value, 'Unknown');
  if (!raw) return 'Unknown';
  return raw;
}

function normalizeYear(value: unknown): string {
  const raw = normalizeText(value, '');
  if (!raw || /^unknown$/i.test(raw)) {
    return 'Estimated range: 2000s–2010s (NOT DEFINITIVE)';
  }
  return raw;
}

function normalizeCondition(value: unknown): string {
  const raw = normalizeText(value, 'Good');
  if (!raw) return 'Good';
  const match = CONDITION_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match || 'Good';
}

function normalizeMoneyValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseMoney(value);
    return parsed != null ? parsed : null;
  }
  return null;
}

function ensureDefaultSuffix(value: unknown, fallback: string): string {
  const text = normalizeText(value, '');
  if (!text) return `General: ${fallback}`;
  if (text.includes(fallback)) return text;
  return `${text} General: ${fallback}`;
}

function isMostlyGeneric(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('general:')) return true;
  if (normalized.length < 30) return true;
  const genericPhrases = [
    'electronics',
    'hardware',
    'setup',
    'cleaning',
    'neck straightness',
    'fret wear',
    'general',
  ];
  const hitCount = genericPhrases.filter((phrase) => normalized.includes(phrase)).length;
  return hitCount >= 3;
}

function isUnknownish(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'unknown') return true;
  if (normalized === 'other') return true;
  return false;
}

function needsModelDisambiguation(aiData: SingleAiResult | undefined): boolean {
  if (!aiData) return false;
  const brand = normalizeText(aiData.brand, '');
  const model = normalizeText(aiData.model, '');
  if (!brand || isUnknownish(brand)) return false;
  if (isUnknownish(model)) return true;
  if (model.trim().length < 3) return true;
  return false;
}

function mergeModelDisambiguation(base: SingleAiResult, patch: Partial<SingleAiResult>): SingleAiResult {
  const pickBetter = (current: string, next: string): string => {
    const currentClean = normalizeText(current, '');
    const nextClean = normalizeText(next, '');
    if (!nextClean) return current;
    if (isUnknownish(currentClean) && !isUnknownish(nextClean)) return nextClean;
    if (!isUnknownish(nextClean) && nextClean.length > currentClean.length + 2) return nextClean;
    return current;
  };

  return {
    ...base,
    brand: pickBetter(base.brand, normalizeText(patch.brand, '')),
    model: pickBetter(base.model, normalizeText(patch.model, '')),
    year: pickBetter(base.year, normalizeText(patch.year, '')),
    finish: pickBetter(base.finish, normalizeText(patch.finish, '')),
    condition: pickBetter(base.condition, normalizeText(patch.condition, '')),
    serial_model: pickBetter(base.serial_model, normalizeText(patch.serial_model, '')),
  };
}

function decodeSerial(brandInput: string, serial: string): { success: boolean; info?: { brand?: string; serialNumber?: string; year?: string; model?: string } } | null {
  const result = decodeSerialForBackend(brandInput, serial);
  if (!result.normalizedBrand) return null;
  return {
    success: result.success,
    info: result.info,
  };
}

function pickLocation(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      const trimmed = value.trim();
      if (isPriceLike(trimmed)) continue;
      return trimmed;
    }
  }
  return '';
}

function isPriceLike(input: string): boolean {
  if (!input) return false;
  const normalized = input.replace(/\s+/g, '');
  if (/^\$?[\d,]+(?:\.\d{1,2})?$/.test(normalized)) {
    return true;
  }
  return false;
}

function normalizeUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (!/^https?:\/\//i.test(trimmed)) {
      return new URL(`https://${trimmed}`).toString();
    }
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function normalizeInventoryOrExternalImageUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isInventoryImageUrl(trimmed)) return trimmed;
  return normalizeUrl(trimmed);
}

function detectSource(url: string): ListingSource | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('craigslist.org')) return 'craigslist';
    if (parsed.hostname.includes('facebook.com')) return 'facebook';
    if (parsed.hostname === 'reverb.com' || parsed.hostname.endsWith('.reverb.com')) return 'reverb';
    return null;
  } catch {
    return null;
  }
}

function extractReverbListingId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host === 'reverb.com' || host.endsWith('.reverb.com'))) return null;
    const match = parsed.pathname.match(/^\/item\/(\d+)(?:[-/]|$)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function isSupportedListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('facebook.com')) {
      return /\/marketplace\/item\/\d+/.test(path) || path.startsWith('/share/');
    }

    if (host.endsWith('craigslist.org')) {
      return path.includes('/d/') || path.startsWith('/msg/');
    }

    if (host === 'reverb.com' || host.endsWith('.reverb.com')) {
      return /^\/item\/\d+(?:[-/]|$)/.test(path);
    }

    return false;
  } catch {
    return false;
  }
}

function isFacebookShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) return false;
    return parsed.pathname.startsWith('/share/');
  } catch {
    return false;
  }
}

function extractFacebookRedirectTarget(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) return null;
    if (!parsed.pathname.startsWith('/l.php')) return null;
    const target = parsed.searchParams.get('u');
    if (!target) return null;
    return decodeURIComponent(target);
  } catch {
    return null;
  }
}

async function fetchFacebookShare(
  url: string,
  redirect: RequestRedirect
): Promise<Response> {
  return fetch(url, {
    redirect,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

async function resolveFromResponse(response: Response, fallbackUrl: string): Promise<string> {
  const resolvedUrl = response.url || fallbackUrl;
  const redirectTarget = extractFacebookRedirectTarget(resolvedUrl);
  if (redirectTarget) return redirectTarget;

  if (!isFacebookShareUrl(resolvedUrl)) {
    return resolvedUrl;
  }

  const html = await response.text();
  const ogUrlMatch = html.match(/property=\"og:url\" content=\"([^\"]+)\"/i);
  if (ogUrlMatch?.[1]) {
    return ogUrlMatch[1];
  }

  return resolvedUrl;
}

async function resolveFacebookShareUrl(url: string): Promise<string> {
  if (!isFacebookShareUrl(url)) return url;

  try {
    const manualResponse = await fetchFacebookShare(url, 'manual');
    if (manualResponse.status >= 300 && manualResponse.status < 400) {
      const location = manualResponse.headers.get('Location');
      if (location) {
        const resolvedLocation = new URL(location, url).toString();
        const redirectTarget = extractFacebookRedirectTarget(resolvedLocation);
        if (redirectTarget) return redirectTarget;
        if (!isFacebookShareUrl(resolvedLocation)) {
          return resolvedLocation;
        }
      }
    }

    const response = await fetchFacebookShare(url, 'follow');
    const resolved = await resolveFromResponse(response, url);
    if (!resolved.includes('unsupportedbrowser')) {
      return resolved;
    }

    const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
    const mobileResponse = await fetchFacebookShare(mobileUrl, 'follow');
    return await resolveFromResponse(mobileResponse, mobileUrl);
  } catch (error) {
    console.warn('Unable to resolve Facebook share URL', { url, error });
  }

  return url;
}

function buildFacebookApifyInput(url: string): Record<string, unknown> {
  return {
    startUrls: [{ url }],
    resultsLimit: 1,
    includeListingDetails: true,
  };
}

function normalizeFacebookItemUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('facebook.com')) return null;

    if (parsed.pathname.startsWith('/l.php')) {
      const target = parsed.searchParams.get('u');
      if (!target) return parsed.toString();
      const decoded = decodeURIComponent(target);
      return normalizeFacebookItemUrl(decoded) ?? decoded;
    }

    const itemMatch = parsed.pathname.match(/\/marketplace\/item\/(\d+)/);
    if (itemMatch?.[1]) {
      return `https://www.facebook.com/marketplace/item/${itemMatch[1]}/`;
    }

    if (parsed.pathname.startsWith('/share/')) {
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeQueuedListingUrl(url: string): string | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const source = detectSource(normalized);
  if (source === 'facebook') {
    return normalizeFacebookItemUrl(normalized);
  }
  if (source === 'reverb') {
    const listingId = extractReverbListingId(normalized);
    return listingId ? `https://reverb.com/item/${listingId}` : normalized;
  }
  return normalized;
}

async function startApifyRun(url: string, source: ListingSource, env: Env, recordId?: string | null): Promise<string | null> {
  if (source === 'reverb') return null;
  const actorId = source === 'facebook' ? env.APIFY_FACEBOOK_ACTOR : env.APIFY_CRAIGSLIST_ACTOR;
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const webhookUrl = new URL('/api/listings/webhook', baseUrl);
  if (env.WEBHOOK_SECRET) {
    webhookUrl.searchParams.set('key', env.WEBHOOK_SECRET);
  }
  if (recordId) {
    webhookUrl.searchParams.set('recordId', recordId);
  }

  const webhookPayload = [{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
    requestUrl: webhookUrl.toString(),
    payloadTemplate: '{"resource":{{resource}},"eventType":"{{eventType}}"}',
  }];

  const webhooksParam = btoa(JSON.stringify(webhookPayload));

  const input = source === 'facebook'
    ? buildFacebookApifyInput(url)
    : {
        urls: [{ url }],
        maxAge: 15,
        maxConcurrency: 4,
        proxyConfiguration: {
          useApifyProxy: true,
        },
      };

  const actorPath = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  const response = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${env.APIFY_TOKEN}&webhooks=${encodeURIComponent(webhooksParam)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apify run start failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  return data?.data?.id || data?.id || null;
}

async function fetchApifyRun(runId: string, env: Env): Promise<any | null> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${env.APIFY_TOKEN}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data?.data || data;
}

async function abortApifyRun(runId: string, env: Env): Promise<void> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${env.APIFY_TOKEN}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.warn('Apify abort failed', {
      runId,
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
  }
}

async function waitForApifyRun(runId: string, env: Env, attempts: number): Promise<any | null> {
  let current = await fetchApifyRun(runId, env);
  let remaining = attempts;
  while (remaining > 0 && current && current.status && current.status !== 'SUCCEEDED' && current.status !== 'FAILED') {
    await delay(2000);
    remaining -= 1;
    current = await fetchApifyRun(runId, env);
  }
  return current;
}

async function processApifyRunWhenReady(runId: string, env: Env, recordId: string): Promise<void> {
  try {
    await env.LISTING_JOBS.put(runId, recordId);
    const runDetails = await waitForApifyRun(runId, env, 20);
    const status = normalizeText(runDetails?.status, '');
    if (status !== 'SUCCEEDED' && status !== 'FAILED') {
      console.warn('Apify run not finished during submit fallback', { runId, recordId, status });
      return;
    }
    await processRun(runId, runDetails, status, env);
  } catch (error) {
    console.error('Apify submit fallback processing failed', { runId, recordId, error });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchApifyDataset(datasetId: string, env: Env): Promise<any[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${env.APIFY_TOKEN}&clean=true&format=json`);
  if (!response.ok) return [];
  return await response.json();
}

async function insertQueuedRow(url: string, source: ListingSource, runId: string | null, isMulti: boolean, env: Env): Promise<string | null> {
  const timestamp = new Date().toISOString();
  const fields = {
    submitted_at: timestamp,
    source: formatSourceLabel(source),
    url,
    status: 'queued',
    IsMulti: isMulti,
  };

  try {
    const recordId = await dbCreateListing(fields, env);
    if (recordId && runId) {
      await env.LISTING_JOBS.put(runId, recordId);
    }
    return recordId;
  } catch (error) {
    console.error('D1 create failed', { error });
  }
  return null;
}

async function updateRowByRunId(runId: string, updates: {
  runId?: string;
  status?: string;
  title?: string;
  price?: string;
  location?: string;
  condition?: string;
  description?: string;
  photos?: string;
  image_url?: string;
  aiSummary?: string;
  aiData?: SingleAiResult;
  notes?: string;
}, env: Env, options?: { recordId?: string | null; isMulti?: boolean | null }): Promise<void> {
  try {
    const recordId = options?.recordId ?? await env.LISTING_JOBS.get(runId);
    if (!recordId) {
      console.error('D1 update failed: record not found for run_id', { runId });
      return;
    }

    const existingRecord = await dbGetListing(recordId, env);
    const existingFields = existingRecord?.fields || {};
    const isCustomSource = normalizeText(existingFields.source, '').toLowerCase() === 'custom';
    const isMulti = options?.isMulti ?? await getIsMultiFromRecord(recordId, env);
    const aiAskingData = normalizeMoneyValue(updates.aiData?.asking_price);
    const listedPrice = updates.price ? parseMoney(updates.price) : null;
    const listedPriceOrAi = listedPrice ?? aiAskingData;
    const aiAsking = updates.aiSummary
      ? (isMulti ? extractMultiAskingTotal(updates.aiSummary) : extractAskingFromSummary(updates.aiSummary))
      : null;
    const asking = chooseAskingPrice(listedPriceOrAi, aiAsking, updates.description ?? '', updates.aiSummary ?? '', isMulti);
    const singleAiSummary = !isMulti ? buildSingleAiSummary(updates.aiData, { ideal: null, privateParty: null }) : '';
    const fullSummary = updates.aiSummary ?? singleAiSummary;
    const summaryChunks = splitAiSummary(fullSummary || null);
    if (fullSummary) {
      console.info('AI summary split', { length: fullSummary.length, chunks: summaryChunks.length });
    }

    const normalizedCondition = normalizeCondition(updates.aiData?.condition ?? updates.condition ?? '');
    const serialCandidate = typeof updates.aiData?.serial === 'string' ? updates.aiData.serial.trim() : '';
    const serialBrandCandidate = typeof updates.aiData?.serial_brand === 'string' ? updates.aiData.serial_brand.trim() : '';
    const decoded = serialCandidate
      ? decodeSerial(serialBrandCandidate || updates.aiData?.brand || '', serialCandidate)
      : null;
    const decodedBrand = decoded?.info?.brand || '';
    const decodedYear = decoded?.info?.year || '';
    const decodedModel = decoded?.info?.model || '';
    const serialShouldUse = decoded?.info?.serialNumber || serialCandidate;
    const serialBrand = decodedBrand || serialBrandCandidate || updates.aiData?.brand || '';
    const serialYear = decodedYear || updates.aiData?.serial_year || '';
    const serialModel = decodedModel || updates.aiData?.serial_model || '';
    const definitiveBrand = serialShouldUse ? normalizeText(serialBrand, '') : '';
    const definitiveYear = serialShouldUse ? normalizeText(serialYear, '') : '';
    const definitiveModel = serialShouldUse ? normalizeText(serialModel, '') : '';

    const aiFields = updates.aiData
      ? {
          category: normalizeCategory(updates.aiData.category),
          brand: isCustomSource
            ? chooseBestStructuredText(definitiveBrand || updates.aiData.brand, existingFields.brand)
            : definitiveBrand || normalizeText(updates.aiData.brand, 'Unknown'),
          model: isCustomSource
            ? chooseBestStructuredText(definitiveModel || updates.aiData.model, existingFields.model)
            : definitiveModel || normalizeText(updates.aiData.model, 'Unknown'),
          finish: normalizeFinish(updates.aiData.finish),
          year: definitiveYear || normalizeYear(updates.aiData.year),
          condition: isCustomSource
            ? chooseBestStructuredText(normalizedCondition, existingFields.condition)
            : normalizedCondition,
          serial: serialShouldUse || '',
          serial_brand: serialShouldUse ? normalizeText(serialBrand, '') : '',
          serial_year: serialShouldUse ? normalizeText(serialYear, '') : '',
          serial_model: serialShouldUse ? normalizeText(serialModel, '') : '',
          value_private_party_low: normalizeMoneyValue(updates.aiData.value_private_party_low),
          value_private_party_low_notes: normalizeText(updates.aiData.value_private_party_low_notes, ''),
          value_private_party_medium: normalizeMoneyValue(updates.aiData.value_private_party_medium),
          value_private_party_medium_notes: normalizeText(updates.aiData.value_private_party_medium_notes, ''),
          value_private_party_high: normalizeMoneyValue(updates.aiData.value_private_party_high),
          value_private_party_high_notes: normalizeText(updates.aiData.value_private_party_high_notes, ''),
          pricing_source: normalizeText(updates.aiData.pricing_source, ''),
          pricing_confidence: normalizeText(updates.aiData.pricing_confidence, ''),
          pricing_comp_count: normalizeMoneyValue(updates.aiData.pricing_comp_count),
          pricing_notes: normalizeText(updates.aiData.pricing_notes, ''),
          value_pawn_shop_notes: normalizeText(updates.aiData.value_pawn_shop_notes, ''),
          value_online_notes: normalizeText(updates.aiData.value_online_notes, ''),
          known_weak_points: ensureDefaultSuffix(updates.aiData.known_weak_points, DEFAULT_TEXT.known_weak_points),
          typical_repair_needs: ensureDefaultSuffix(updates.aiData.typical_repair_needs, DEFAULT_TEXT.typical_repair_needs),
          buyers_worry: ensureDefaultSuffix(updates.aiData.buyers_worry, DEFAULT_TEXT.buyers_worry),
          og_specs_pickups: normalizeText(updates.aiData.og_specs_pickups, 'Unknown'),
          og_specs_tuners: normalizeText(updates.aiData.og_specs_tuners, 'Unknown'),
          og_specs_common_mods: ensureDefaultSuffix(updates.aiData.og_specs_common_mods, DEFAULT_TEXT.og_specs_common_mods),
          buyer_what_to_check: ensureDefaultSuffix(updates.aiData.buyer_what_to_check, DEFAULT_TEXT.buyer_what_to_check),
          buyer_common_misrepresent: ensureDefaultSuffix(updates.aiData.buyer_common_misrepresent, DEFAULT_TEXT.buyer_common_misrepresent),
          seller_how_to_price_realistic: ensureDefaultSuffix(updates.aiData.seller_how_to_price_realistic, DEFAULT_TEXT.seller_how_to_price_realistic),
          seller_fixes_add_value_or_waste: ensureDefaultSuffix(updates.aiData.seller_fixes_add_value_or_waste, DEFAULT_TEXT.seller_fixes_add_value_or_waste),
          seller_as_is_notes: ensureDefaultSuffix(updates.aiData.seller_as_is_notes, DEFAULT_TEXT.seller_as_is_notes),
        }
      : null;
    const fields: Record<string, unknown> = {
      status: updates.status ?? null,
      title: updates.title ?? null,
      price_asking: asking ?? null,
      location: updates.location ?? null,
      description: updates.description ?? null,
      photos: updates.photos ?? null,
      image_url: updates.image_url ?? null,
      ai_summary: summaryChunks[0] ?? null,
      ai_summary2: isMulti ? summaryChunks[1] ?? null : null,
      ai_summary3: isMulti ? summaryChunks[2] ?? null : null,
      ai_summary4: isMulti ? summaryChunks[3] ?? null : null,
      ai_summary5: isMulti ? summaryChunks[4] ?? null : null,
      ai_summary6: isMulti ? summaryChunks[5] ?? null : null,
      ai_summary7: isMulti ? summaryChunks[6] ?? null : null,
      ai_summary8: isMulti ? summaryChunks[7] ?? null : null,
      ai_summary9: isMulti ? summaryChunks[8] ?? null : null,
      ai_summary10: isMulti ? summaryChunks[9] ?? null : null,
    };
    await dbUpdateListing(recordId, fields, env);
    if (aiFields && !isMulti) {
      await dbUpdateListing(recordId, aiFields, env);
    }
  } catch (error) {
    console.error('D1 update failed', { error });
    throw error;
  }
}


function isArchivedValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function isMultiValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function extractPrivatePartyRange(aiSummary: string): { low: number; high: number } | null {
  const rangeMatch = aiSummary.match(/Typical private[-\s]party value:\s*\$?([\d,]+)\s*(?:–|-|to)\s*\$?([\d,]+)/i);
  if (rangeMatch) {
    const low = parseMoney(rangeMatch[1]);
    const high = parseMoney(rangeMatch[2]);
    if (low != null && high != null) {
      return { low, high };
    }
  }

  const singleMatch = aiSummary.match(/Typical private[-\s]party value:\s*\$?([\d,]+)/i);
  if (singleMatch) {
    const value = parseMoney(singleMatch[1]);
    if (value != null) {
      return { low: value, high: value };
    }
  }

  return null;
}

function extractMultiPrivatePartyRange(aiSummary: string): { low: number; high: number } | null {
  const rangeMatch = aiSummary.match(/Used market range for all:\s*\$?([\d,]+)\s*(?:–|-|to)\s*\$?([\d,]+)/i);
  if (rangeMatch) {
    const low = parseMoney(rangeMatch[1]);
    const high = parseMoney(rangeMatch[2]);
    if (low != null && high != null) {
      return { low, high };
    }
  }

  const singleMatch = aiSummary.match(/Used market range for all:\s*\$?([\d,]+)/i);
  if (singleMatch) {
    const value = parseMoney(singleMatch[1]);
    if (value != null) {
      return { low: value, high: value };
    }
  }

  return null;
}

function extractAskingFromSummary(aiSummary: string): number | null {
  const match = aiSummary.match(/Asking price \(from listing text\):\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

function extractMultiAskingTotal(aiSummary: string): number | null {
  const match = aiSummary.match(/Total listing asking price:\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

function extractScoreFromSummary(aiSummary: string): number | null {
  const match = aiSummary.match(/Score:\s*([0-9]+)\s*\/\s*10/i);
  if (!match) return null;
  const score = Number.parseInt(match[1], 10);
  if (!Number.isFinite(score)) return null;
  return Math.max(1, Math.min(10, score));
}

function extractMultiIdealTotal(aiSummary: string): number | null {
  const match = aiSummary.match(/Ideal price for all:\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

function ensureMultiTotals(aiSummary: string): string {
  if (!aiSummary || /(^|\n)Totals\s*:?\s*$/im.test(aiSummary)) return aiSummary;

  const recapIndex = aiSummary.search(/(^|\n)Itemized recap\s*:?\s*$/im);
  if (recapIndex === -1) {
    const fallbackTotals = [
      '',
      'Totals',
      '- Total listing asking price: Unknown',
      '- Used market range for all: Unknown',
      '- Ideal price for all: Unknown',
      '',
    ].join('\n');
    return `${aiSummary.trim()}\n${fallbackTotals}`.trim();
  }

  const lines = aiSummary.slice(recapIndex).split(/\r?\n/);
  const itemLinePattern = /-\s+.+?\s+-\s+\$?([\d,]+)\s+asking,\s+used range\s+\$?([\d,]+)\s+to\s+\$?([\d,]+),\s+\$?([\d,]+)\s+ideal/i;

  let askingTotal = 0;
  let usedLowTotal = 0;
  let usedHighTotal = 0;
  let idealTotal = 0;
  let found = 0;

  for (const line of lines) {
    if (/^Totals\s*:?\s*$/i.test(line.trim())) break;
    const match = line.match(itemLinePattern);
    if (!match) continue;
    const asking = parseMoney(match[1]);
    const usedLow = parseMoney(match[2]);
    const usedHigh = parseMoney(match[3]);
    const ideal = parseMoney(match[4]);
    if (asking == null || usedLow == null || usedHigh == null || ideal == null) continue;
    askingTotal += asking;
    usedLowTotal += usedLow;
    usedHighTotal += usedHigh;
    idealTotal += ideal;
    found += 1;
  }

  if (found === 0) {
    const fallbackTotals = [
      '',
      'Totals',
      '- Total listing asking price: Unknown',
      '- Used market range for all: Unknown',
      '- Ideal price for all: Unknown',
      '',
    ].join('\n');
    return `${aiSummary.trim()}\n${fallbackTotals}`.trim();
  }

  const totalsSection = [
    '',
    'Totals',
    `- Total listing asking price: ${formatCurrency(askingTotal)}`,
    `- Used market range for all: ${formatCurrency(usedLowTotal)} to ${formatCurrency(usedHighTotal)}`,
    `- Ideal price for all: ${formatCurrency(idealTotal)}`,
    '',
  ].join('\n');

  return `${aiSummary.trim()}\n${totalsSection}`.trim();
}

function splitAiSummary(aiSummary: string | null): string[] {
  if (!aiSummary) return [];
  const maxChunkSize = 2000;
  const chunks: string[] = [];
  let remaining = aiSummary;
  while (remaining.length > 0 && chunks.length < 10) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = remaining.lastIndexOf('\n\n', maxChunkSize);
    if (splitIndex < maxChunkSize * 0.6) {
      splitIndex = remaining.lastIndexOf('\n', maxChunkSize);
    }
    if (splitIndex < maxChunkSize * 0.4) {
      splitIndex = maxChunkSize;
    }
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }
  if (remaining.length > 0 && chunks.length === 10) {
    console.warn('AI summary truncated after 10 chunks', { remainingLength: remaining.length });
  }
  return chunks;
}

function chooseAskingPrice(
  listed: number | null,
  aiAsking: number | null,
  description: string,
  aiSummary: string,
  isMulti: boolean
): number | null {
  if (listed == null && aiAsking == null) return null;
  if (listed == null) return aiAsking;

  if (isMulti) {
    return aiAsking ?? listed;
  }

  const hasMultiplePrices = countMoneyTokens(description) >= 2;
  const summaryMentionsMultiple = /multiple items|bundle|lot|each pedal|per item/i.test(aiSummary);
  const suspicious = isSuspiciousListedPrice(listed, hasMultiplePrices);

  if (aiAsking != null && (suspicious || summaryMentionsMultiple)) {
    return aiAsking;
  }

  return listed;
}

function isSuspiciousListedPrice(listed: number, hasMultiplePrices: boolean): boolean {
  if (listed <= 5) return true;
  if (listed === 1234) return true;
  if (listed >= 1000 && hasMultiplePrices) return true;
  return false;
}

function countMoneyTokens(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\$\\s*[\\d,]+/g);
  return matches ? matches.length : 0;
}

function parseMoney(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseOptionalPositiveInt(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number' && Number.isFinite(input) && Number.isInteger(input) && input > 0) {
    return input;
  }
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const parsed = Number.parseInt(input.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function getInventoryCategoryLabel(row: Pick<InventoryItemRow, 'category_path' | 'category_name'>): string {
  return normalizeText(row.category_path, '') || normalizeText(row.category_name, '');
}

function buildInventoryCategoryTree(rows: InventoryCategoryRow[]): InventoryCategoryNode[] {
  const byId = new Map<number, InventoryCategoryNode>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      order: Number(row.order || 0),
      depth: 1,
      path: row.name,
      children: [],
    });
  }

  const roots: InventoryCategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const assignDepth = (node: InventoryCategoryNode, parentPath: string, depth: number): void => {
    node.depth = depth;
    node.path = parentPath ? `${parentPath} > ${node.name}` : node.name;
    for (const child of node.children) {
      assignDepth(child, node.path, depth + 1);
    }
  };

  const sortNodes = (a: InventoryCategoryNode, b: InventoryCategoryNode): number =>
    a.order - b.order || a.name.localeCompare(b.name) || a.id - b.id;

  for (const node of byId.values()) {
    node.children.sort(sortNodes);
  }
  roots.sort(sortNodes);
  for (const root of roots) {
    assignDepth(root, '', 1);
  }
  return roots;
}

function parseShopCategoryIds(url: URL): number[] {
  const rawValues = [
    ...url.searchParams.getAll('categoryId'),
    ...url.searchParams.getAll('categoryIds'),
  ];
  const csv = normalizeText(url.searchParams.get('categories'), '');
  if (csv) rawValues.push(...csv.split(','));

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => String(value).split(','))
        .map((value) => parseOptionalPositiveInt(value))
        .filter((value): value is number => value != null),
    ),
  );
}

function expandInventoryCategoryIds(selectedIds: number[], rows: InventoryCategoryRow[]): number[] {
  if (selectedIds.length === 0) return [];

  const childrenByParent = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parent_id == null) continue;
    const siblings = childrenByParent.get(row.parent_id) ?? [];
    siblings.push(row.id);
    childrenByParent.set(row.parent_id, siblings);
  }

  const expanded = new Set<number>();
  const stack = [...selectedIds];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (currentId == null || expanded.has(currentId)) continue;
    expanded.add(currentId);
    const children = childrenByParent.get(currentId) ?? [];
    children.forEach((childId) => stack.push(childId));
  }

  return Array.from(expanded);
}

function parseCurrencyAmount(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = parseMoney(input);
    return parsed != null ? parsed : null;
  }
  return null;
}

function normalizeRequiredInventoryBarcode(input: unknown): { value: string; message: string | null } {
  const value = normalizeText(input, '').trim();
  if (!value) return { value: '', message: 'Barcode is required.' };
  if (!/^\d+$/.test(value)) return { value, message: 'Barcode must be numeric only.' };
  if (value.length < 8 || value.length > 20) {
    return { value, message: 'Barcode must be 8 to 20 digits.' };
  }
  return { value, message: null };
}

function normalizeCheckoutItems(input: unknown): Array<{ inventoryItemId: number; quantity: number }> {
  if (!Array.isArray(input)) return [];

  const byInventoryItemId = new Map<number, number>();
  for (const item of input) {
    const inventoryItemId = parseOptionalPositiveInt((item as any)?.inventoryItemId);
    if (!inventoryItemId) continue;
    const quantityValue = Number((item as any)?.quantity ?? 1);
    const quantity = Math.max(1, Math.min(99, Math.floor(Number.isFinite(quantityValue) ? quantityValue : 1)));
    byInventoryItemId.set(inventoryItemId, (byInventoryItemId.get(inventoryItemId) || 0) + quantity);
  }

  return Array.from(byInventoryItemId.entries()).map(([inventoryItemId, quantity]) => ({
    inventoryItemId,
    quantity,
  }));
}

function parsePaymentLinkQuantitySelections(input: unknown): Map<number, number> {
  const selections = new Map<number, number>();
  if (!Array.isArray(input)) return selections;

  for (const item of input) {
    const inventoryItemId = parseOptionalPositiveInt((item as any)?.inventoryItemId);
    if (!inventoryItemId) continue;
    const rawQuantity = Number((item as any)?.quantity ?? 0);
    const quantity = Math.max(0, Math.min(1_000_000, Math.floor(Number.isFinite(rawQuantity) ? rawQuantity : 0)));
    selections.set(inventoryItemId, (selections.get(inventoryItemId) || 0) + quantity);
  }

  return selections;
}

function getCheckoutItemTitle(row: ShopCheckoutInventoryRow): string {
  return normalizeText(row.sale_title, '') || normalizeText(row.title, '') || `Inventory item ${row.id}`;
}

function getCheckoutInventoryUnavailableReason(
  row: ShopCheckoutInventoryRow,
  input: { includeInStoreOnly: boolean; requestedQuantity: number },
): string | null {
  const title = getCheckoutItemTitle(row);
  if (Number(row.is_active || 0) !== 1) return `${title} is no longer available.`;
  if (Number(row.is_sold || 0) === 1) return `${title} has already sold.`;
  if (Number(row.is_rented || 0) === 1) return `${title} is not available for checkout.`;
  if (Number(row.for_sale || 0) !== 1) return `${title} is not available for checkout.`;
  if (Number(row.only_in_store || 0) === 1 && !input.includeInStoreOnly) {
    return `${title} is only available in store.`;
  }
  const availableQuantity = Math.max(1, Number(row.quantity || 1));
  if (input.requestedQuantity > availableQuantity) {
    return `${title} has only ${availableQuantity} available.`;
  }
  if (normalizeText(row.availability_status, 'available') === 'sold') return `${title} has already sold.`;
  return null;
}

function buildOrderNumber(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CCG-${stamp}-${suffix}`;
}

async function createStripeCheckoutSession(input: {
  stripeSecretKey: string;
  orderId: string;
  orderNumber: string;
  successUrl: string;
  cancelUrl: string;
  couponCode: string | null;
  discountCents: number;
  taxCents: number;
  splitTender?: {
    cardAmountCents: number;
    cashAmountCents: number;
    totalCents: number;
  };
  items: Array<{
    inventoryItemId: number;
    quantity: number;
    title: string;
    unitAmountCents: number;
    imageUrl: string;
  }>;
}): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', input.successUrl);
  form.set('cancel_url', input.cancelUrl);
  form.set('client_reference_id', input.orderId);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[order_number]', input.orderNumber);
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[discount_cents]', String(input.discountCents));
  form.set('metadata[tax_cents]', String(input.taxCents));
  if (input.splitTender) {
    form.set('metadata[checkout_provider]', 'stripe_cash');
    form.set('metadata[card_amount_cents]', String(input.splitTender.cardAmountCents));
    form.set('metadata[cash_amount_cents]', String(input.splitTender.cashAmountCents));
    form.set('metadata[total_cents]', String(input.splitTender.totalCents));
  }

  if (!input.splitTender && input.discountCents > 0) {
    const couponId = await createStripeAmountOffCoupon({
      stripeSecretKey: input.stripeSecretKey,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      couponCode: input.couponCode,
      amountOffCents: input.discountCents,
    });
    form.set('discounts[0][coupon]', couponId);
  }

  if (input.splitTender) {
    const prefix = 'line_items[0]';
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price_data][currency]`, 'usd');
    form.set(`${prefix}[price_data][unit_amount]`, String(input.splitTender.cardAmountCents));
    form.set(`${prefix}[price_data][product_data][name]`, `Card payment for ${input.orderNumber}`);
    form.set(`${prefix}[price_data][product_data][description]`, 'Partial card payment for an in-store card + cash checkout.');
  } else {
    input.items.forEach((item, index) => {
      const prefix = `line_items[${index}]`;
      form.set(`${prefix}[quantity]`, String(item.quantity));
      form.set(`${prefix}[price_data][currency]`, 'usd');
      form.set(`${prefix}[price_data][unit_amount]`, String(item.unitAmountCents));
      form.set(`${prefix}[price_data][product_data][name]`, item.title);
      form.set(`${prefix}[price_data][product_data][metadata][inventory_item_id]`, String(item.inventoryItemId));
      if (item.imageUrl) {
        form.set(`${prefix}[price_data][product_data][images][0]`, item.imageUrl);
      }
    });
  }

  if (!input.splitTender && input.taxCents > 0) {
    const prefix = `line_items[${input.items.length}]`;
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price_data][currency]`, 'usd');
    form.set(`${prefix}[price_data][unit_amount]`, String(input.taxCents));
    form.set(`${prefix}[price_data][product_data][name]`, 'Sales tax');
    form.set(`${prefix}[price_data][product_data][description]`, 'State, city, county taxes');
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the checkout request.'));
  }
  const id = normalizeText(data?.id, '');
  const url = normalizeText(data?.url, '');
  if (!id || !url) throw new Error('Stripe did not return a checkout URL.');
  return { id, url };
}

async function createStripeTerminalPaymentIntent(input: {
  stripeSecretKey: string;
  orderId: string;
  orderNumber: string;
  amountCents: number;
  totalCents: number;
  cardAmountCents: number;
  cashAmountCents: number;
  discountCents: number;
  taxCents: number;
  checkoutProvider: string;
  items: Array<{
    inventoryItemId: number;
    quantity: number;
    title: string;
  }>;
}): Promise<{ id: string; status: string }> {
  const form = new URLSearchParams();
  form.set('amount', String(input.amountCents));
  form.set('currency', 'usd');
  form.append('payment_method_types[]', 'card_present');
  form.set('capture_method', 'automatic');
  form.set('description', `Coal Creek Guitars ${input.orderNumber}`);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[order_number]', input.orderNumber);
  form.set('metadata[checkout_provider]', input.checkoutProvider);
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[card_amount_cents]', String(input.cardAmountCents));
  form.set('metadata[cash_amount_cents]', String(input.cashAmountCents));
  form.set('metadata[total_cents]', String(input.totalCents));
  form.set('metadata[discount_cents]', String(input.discountCents));
  form.set('metadata[tax_cents]', String(input.taxCents));

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `ccg-terminal-pi-${input.orderId}`,
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the Terminal payment request.'));
  }
  const id = normalizeText(data?.id, '');
  if (!id) throw new Error('Stripe did not return a PaymentIntent ID.');
  return { id, status: normalizeText(data?.status, '') };
}

async function processStripeTerminalPaymentIntent(input: {
  stripeSecretKey: string;
  readerId: string;
  paymentIntentId: string;
  orderId: string;
}): Promise<any> {
  const form = new URLSearchParams();
  form.set('payment_intent', input.paymentIntentId);

  const response = await fetch(
    `https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(input.readerId)}/process_payment_intent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ccg-terminal-process-${input.orderId}`,
      },
      body: form,
    },
  );
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe could not send the payment to the Terminal reader.'));
  }
  return data?.action ?? null;
}

async function retrieveStripePaymentIntent(stripeSecretKey: string, paymentIntentId: string): Promise<any> {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe payment lookup failed.'));
  }
  return data;
}

async function cancelStripePaymentIntent(stripeSecretKey: string, paymentIntentId: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    if (!response.ok) {
      const data = await response.json<any>();
      console.warn('Stripe PaymentIntent cancel failed', {
        paymentIntentId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
    }
  } catch (error) {
    console.warn('Stripe PaymentIntent cancel failed', { paymentIntentId, error });
  }
}

async function cancelStripeTerminalReaderAction(stripeSecretKey: string, readerId: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(readerId)}/cancel_action`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    if (!response.ok) {
      const data = await response.json<any>();
      console.warn('Stripe Terminal reader action cancel failed', {
        readerId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
    }
  } catch (error) {
    console.warn('Stripe Terminal reader action cancel failed', { readerId, error });
  }
}

async function resolveStripeTerminalReader(input: {
  stripeSecretKey: string;
  requestedReaderId: string;
  useSandbox: boolean;
  env: Env;
}): Promise<
  | { ok: true; reader: { id: string; label: string; status: string; action?: any } }
  | { ok: false; message: string; status: number }
> {
  const configuredReaderId = input.requestedReaderId || await getConfiguredStripeTerminalReaderId(input.env, input.useSandbox);
  if (configuredReaderId) {
    const reader = await retrieveStripeTerminalReader(input.stripeSecretKey, configuredReaderId);
    if (!reader.id) {
      return { ok: false, message: 'Configured Stripe Terminal reader was not found.', status: 503 };
    }
    if (reader.status !== 'online') {
      return { ok: false, message: `Stripe Terminal reader ${reader.label || reader.id} is ${reader.status || 'offline'}.`, status: 409 };
    }
    return { ok: true, reader };
  }

  const readers = await listStripeTerminalReaders(input.stripeSecretKey);
  const onlineReaders = readers.filter((reader) => reader.status === 'online');
  if (onlineReaders.length === 1) {
    return { ok: true, reader: onlineReaders[0] };
  }
  if (onlineReaders.length === 0) {
    return { ok: false, message: 'No online Stripe Terminal readers were found in the active Stripe mode.', status: 503 };
  }
  return {
    ok: false,
    message: 'Multiple online Stripe Terminal readers were found. Configure a default reader before using Terminal checkout.',
    status: 409,
  };
}

async function getConfiguredStripeTerminalReaderId(env: Env, useSandbox: boolean): Promise<string> {
  const envReaderId = useSandbox
    ? normalizeText(env.STRIPE_TERMINAL_READER_ID_SANDBOX, '')
    : normalizeText(env.STRIPE_TERMINAL_READER_ID, '');
  if (envReaderId) return envReaderId;

  try {
    const columns = await dbGetTableColumns('sys_info', env);
    const columnNames = new Set(columns.map((column) => column.name));
    const columnName = useSandbox ? 'stripe_terminal_reader_id_sandbox' : 'stripe_terminal_reader_id';
    if (!columnNames.has(columnName)) return '';
    const row = await env.DB.prepare(`SELECT ${columnName} AS reader_id FROM sys_info LIMIT 1`)
      .first<{ reader_id: string | null }>();
    return normalizeText(row?.reader_id, '');
  } catch (error) {
    console.warn('Stripe Terminal reader config lookup failed', { useSandbox, error });
    return '';
  }
}

async function retrieveStripeTerminalReader(
  stripeSecretKey: string,
  readerId: string,
): Promise<{ id: string; label: string; status: string; action?: any }> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(readerId)}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    const data = await response.json<any>();
    if (!response.ok) {
      console.warn('Stripe Terminal reader lookup failed', {
        readerId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
      return { id: '', label: '', status: '' };
    }
    return {
      id: normalizeText(data?.id, ''),
      label: normalizeText(data?.label, ''),
      status: normalizeText(data?.status, ''),
      action: data?.action ?? null,
    };
  } catch (error) {
    console.warn('Stripe Terminal reader lookup failed', { readerId, error });
    return { id: '', label: '', status: '' };
  }
}

async function listStripeTerminalReaders(
  stripeSecretKey: string,
): Promise<Array<{ id: string; label: string; status: string }>> {
  const params = new URLSearchParams({ limit: '100' });
  const response = await fetch(`https://api.stripe.com/v1/terminal/readers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe Terminal reader lookup failed.'));
  }
  return (Array.isArray(data?.data) ? data.data : [])
    .map((reader) => ({
      id: normalizeText(reader?.id, ''),
      label: normalizeText(reader?.label, ''),
      status: normalizeText(reader?.status, ''),
    }))
    .filter((reader) => reader.id);
}

async function createStripeAmountOffCoupon(input: {
  stripeSecretKey: string;
  orderId: string;
  orderNumber: string;
  couponCode: string | null;
  amountOffCents: number;
}): Promise<string> {
  const form = new URLSearchParams();
  form.set('amount_off', String(input.amountOffCents));
  form.set('currency', 'usd');
  form.set('duration', 'once');
  form.set('name', input.couponCode || `Discount for ${input.orderNumber}`);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[order_number]', input.orderNumber);
  if (input.couponCode) {
    form.set('metadata[coupon_code]', input.couponCode);
  }

  const response = await fetch('https://api.stripe.com/v1/coupons', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the discount request.'));
  }
  const id = normalizeText(data?.id, '');
  if (!id) throw new Error('Stripe did not return a discount coupon.');
  return id;
}

function parseStripeInventoryItemIds(session: any): number[] {
  const raw = normalizeText(session?.metadata?.inventory_item_ids, '');
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => parseOptionalPositiveInt(value.trim()))
        .filter((value): value is number => value != null),
    ),
  );
}

async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);
  if (!timestamp || signatures.length === 0) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const expected = bytesToHex(new Uint8Array(digest));
  return signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function validateForSaleInventoryFields(input: {
  forSale: boolean;
  saleTitle: string;
  salePrice: number | null;
  regularPrice: number | null;
  condition: string;
  saleDescription: string;
  bulletTexts: string[];
  saleUrl: string;
  saleZip: string;
}): string | null {
  if (!input.forSale) return null;
  if (!input.saleTitle.trim()) return 'Sale Details Title is required when For Sale is checked.';
  if ((input.salePrice ?? 0) <= 0) return 'Sale Details Sale Price is required when For Sale is checked.';
  if ((input.regularPrice ?? 0) <= 0) {
    return 'Sale Details Regular Price is required when For Sale is checked.';
  }
  if (!input.condition.trim()) return 'Sale Details Condition is required when For Sale is checked.';
  if (!input.saleDescription.trim()) {
    return 'Sale Details Description is required when For Sale is checked.';
  }
  if (!input.bulletTexts.some((bulletText) => bulletText.trim())) {
    return 'At least one Sale Details bullet is required when For Sale is checked.';
  }
  if (!input.saleUrl.trim()) return 'Sale Details URL is required when For Sale is checked.';
  if (!isValidSaleUrlSlug(input.saleUrl)) {
    return 'Sale Details URL must use only lowercase letters, numbers, and hyphens.';
  }
  if (!input.saleZip.trim()) return 'Sale Details ZIP is required when For Sale is checked.';
  return null;
}

function isValidAssociateToken(token: string, env: Env): boolean {
  const expected = normalizeText(env.ASSOCIATE_MODE_TOKEN, '');
  return Boolean(expected && token === expected);
}

async function isAssociateModeRequest(request: Request, env: Env): Promise<boolean> {
  const secret = normalizeText(env.AUTH_SECRET, '');
  if (!secret) return false;

  const cookies = parseCookie(request.headers.get('Cookie'));
  const rawCookie = cookies.get(ASSOCIATE_COOKIE_NAME) || '';
  const [value, signature] = rawCookie.split('.');
  if (value !== ASSOCIATE_COOKIE_VALUE || !signature) return false;

  return verifyAuth(value, secret, signature);
}

async function buildAssociateModeCookie(env: Env): Promise<string> {
  const signature = await signAuth(ASSOCIATE_COOKIE_VALUE, env.AUTH_SECRET);
  const maxAge = 60 * 60 * 24 * 90;
  return `${ASSOCIATE_COOKIE_NAME}=${ASSOCIATE_COOKIE_VALUE}.${signature}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearAssociateModeCookie(): string {
  return `${ASSOCIATE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function currentDateYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPublicApiPath(path: string): boolean {
  return path.startsWith('/api/shop/')
    || path === '/api/youtube/videos'
    || path === '/api/inventory-image'
    || path === '/api/listing-image';
}

function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function normalizeInventoryDate(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return value;
}

function resolveToggleTimestamp(args: {
  previousOn: boolean;
  nextOn: boolean;
  previousTimestamp: string | null;
}): string | null {
  if (!args.nextOn) return null;
  if (args.previousOn && args.previousTimestamp) return args.previousTimestamp;
  return new Date().toISOString();
}

function toBooleanInput(input: unknown, fallback: boolean): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  }
  return fallback;
}

function isInventoryImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/inventory-image?')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/api/inventory-image') return false;
    const key = parsed.searchParams.get('key') || '';
    return key.startsWith('inventory-items/');
  } catch {
    return false;
  }
}

function extractInventoryImageKey(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = url.startsWith('/api/inventory-image?')
      ? new URL(url, 'https://www.coalcreekguitars.com')
      : new URL(url);
    if (parsed.pathname !== '/api/inventory-image') return null;
    const key = (parsed.searchParams.get('key') || '').trim();
    if (!key.startsWith('inventory-items/')) return null;
    return key;
  } catch {
    return null;
  }
}

function parseStoredInventoryImageUrls(imageUrlsRaw: string | null, fallbackPrimary: string | null): string[] {
  const urls = typeof imageUrlsRaw === 'string'
    ? imageUrlsRaw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
    : [];
  if ((!urls || urls.length === 0) && fallbackPrimary) {
    urls.push(String(fallbackPrimary).trim());
  }
  return Array.from(new Set(urls.filter((url) => isInventoryImageUrl(url)))).slice(0, INVENTORY_MAX_IMAGES);
}

function normalizeInventoryImageUrls(primaryImageUrl: string, rawInput: unknown): string[] {
  const fromInput: string[] = [];
  if (Array.isArray(rawInput)) {
    rawInput.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
    });
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
          });
        } else {
          trimmed.split(/\r?\n/).forEach((entry) => {
            if (entry.trim()) fromInput.push(entry.trim());
          });
        }
      } catch {
        trimmed.split(/\r?\n/).forEach((entry) => {
          if (entry.trim()) fromInput.push(entry.trim());
        });
      }
    }
  }

  const seed = primaryImageUrl ? [primaryImageUrl.trim(), ...fromInput] : [...fromInput];
  return Array.from(new Set(seed.filter((url) => isInventoryImageUrl(url)))).slice(0, INVENTORY_MAX_IMAGES);
}

function normalizeInventoryImageCandidates(primaryImageUrl: string, rawInput: unknown): string[] {
  const fromInput: string[] = [];
  if (Array.isArray(rawInput)) {
    rawInput.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
    });
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
          });
        } else {
          trimmed.split(/\r?\n/).forEach((entry) => {
            if (entry.trim()) fromInput.push(entry.trim());
          });
        }
      } catch {
        trimmed.split(/\r?\n/).forEach((entry) => {
          if (entry.trim()) fromInput.push(entry.trim());
        });
      }
    }
  }

  const seed = primaryImageUrl ? [primaryImageUrl.trim(), ...fromInput] : [...fromInput];
  return Array.from(
    new Set(
      seed
        .map((url) => normalizeInventoryOrExternalImageUrl(url))
        .filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, INVENTORY_MAX_IMAGES);
}

function normalizeInventoryImageEntries(
  primaryImageUrl: string,
  rawImages: unknown,
  rawInput: unknown,
): InventoryImageInput[] {
  const entries: InventoryImageInput[] = [];
  const seen = new Set<string>();

  const pushEntry = (urlValue: unknown, isPrivateValue: unknown) => {
    const normalizedUrl = normalizeInventoryOrExternalImageUrl(typeof urlValue === 'string' ? urlValue : '');
    if (!normalizedUrl || seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    entries.push({
      url: normalizedUrl,
      isPrivate: Boolean(isPrivateValue),
    });
  };

  if (Array.isArray(rawImages)) {
    rawImages.forEach((entry) => {
      if (typeof entry === 'string') {
        pushEntry(entry, false);
        return;
      }
      if (entry && typeof entry === 'object') {
        const candidate = entry as { url?: unknown; imageUrl?: unknown; isPrivate?: unknown };
        pushEntry(candidate.url ?? candidate.imageUrl, candidate.isPrivate);
      }
    });
  }

  normalizeInventoryImageCandidates(primaryImageUrl, rawInput).forEach((url) => pushEntry(url, false));

  if (entries.length > 0) {
    entries[0] = { ...entries[0], isPrivate: false };
  }

  return entries.slice(0, INVENTORY_MAX_IMAGES);
}

async function ensureInventoryHostedImageUrls(urls: string[], env: Env): Promise<string[]> {
  const normalized = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean))).slice(
    0,
    INVENTORY_MAX_IMAGES,
  );
  const hostedUrls: string[] = [];
  for (const url of normalized) {
    if (isInventoryImageUrl(url)) {
      hostedUrls.push(url);
      continue;
    }
    hostedUrls.push(await importExternalImageToInventory(url, env));
  }
  return Array.from(new Set(hostedUrls)).slice(0, INVENTORY_MAX_IMAGES);
}

async function importExternalImageToInventory(sourceUrl: string, env: Env): Promise<string> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    throw new Error('Inventory image uploads are not configured.');
  }

  let sourceResponse: Response;
  try {
    sourceResponse = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'CCG Inventory Import/1.0' },
      redirect: 'follow',
    });
  } catch {
    throw new Error('Unable to fetch source image.');
  }

  if (!sourceResponse.ok) {
    throw new Error('Unable to fetch source image.');
  }

  const bodyBytes = await sourceResponse.arrayBuffer();
  let contentType = sourceResponse.headers.get('content-type') || '';

  // Use magic-byte detection to override unreliable content-type headers
  const detected = detectContentTypeFromBytes(new Uint8Array(bodyBytes));
  if (detected) {
    contentType = detected;
  } else if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Source URL did not return an image.');
  }

  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Unsupported image format (${contentType}). Please use JPEG, PNG, WebP, or GIF.`);
  }

  const extension = extensionFromContentType(contentType);
  const key = `inventory-items/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  await env.CUSTOM_ITEMS_BUCKET.put(key, bodyBytes, {
    httpMetadata: {
      contentType,
    },
  });

  return buildInventoryImageUrl(key);
}

function formatDateForPackageNotes(value: string | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function formatOptionalMoneyForPackageNotes(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function buildPackagePurchaseNotes(rows: InventoryItemRow[]): string {
  const separator = '------------------------';
  const sections: string[] = [];

  for (const row of rows) {
    const lines: string[] = [];
    const title = normalizeText(row.title, '');
    if (title) lines.push(title);

    const detailsLine = [
      getInventoryCategoryLabel(row),
      normalizeText(row.brand, ''),
      normalizeText(row.year_range, ''),
      normalizeText(row.model, ''),
      normalizeText(row.finish, ''),
      normalizeText(row.serial_number, '') ? `SERIAL# ${normalizeText(row.serial_number, '')}` : '',
    ].filter(Boolean).join(' - ');
    if (detailsLine) lines.push(detailsLine);

    const valuesLine = [
      formatDateForPackageNotes(row.purchased_date),
      formatOptionalMoneyForPackageNotes(row.purchase_price),
      formatOptionalMoneyForPackageNotes(row.private_party_value),
    ].filter(Boolean).join(' - ');
    if (valuesLine) lines.push(valuesLine);

    const purchaseNotes = normalizeText(row.purchase_notes, '');
    if (purchaseNotes) lines.push(purchaseNotes);

    if (lines.length > 0) {
      sections.push(lines.join('\n'));
    }
  }

  return sections.join(`\n${separator}\n`);
}

function selectMergePackageImageUrls(rows: InventoryItemRow[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  const perRowImageUrls = rows.map((row) => parseStoredInventoryImageUrls(row.image_urls, row.image_url));

  // First pass: first image from each merged item.
  for (const imageUrls of perRowImageUrls) {
    const firstUrl = imageUrls[0];
    if (!firstUrl || seen.has(firstUrl)) continue;
    selected.push(firstUrl);
    seen.add(firstUrl);
    if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
  }

  // Second pass: fill remaining slots from the rest of each item's image set.
  for (const imageUrls of perRowImageUrls) {
    for (let i = 1; i < imageUrls.length; i += 1) {
      const imageUrl = imageUrls[i];
      if (!imageUrl || seen.has(imageUrl)) continue;
      selected.push(imageUrl);
      seen.add(imageUrl);
      if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
    }
  }

  return selected;
}

function selectMergePackageImageEntries(
  rows: InventoryItemRow[],
  imagesMap: Map<number, Array<{ url: string; isPrivate: boolean }>>,
): Array<{ url: string; isPrivate: boolean }> {
  const selected: Array<{ url: string; isPrivate: boolean }> = [];
  const seen = new Set<string>();

  const perRowImages = rows.map((row) => {
    const stored = imagesMap.get(row.id);
    if (stored && stored.length > 0) {
      return stored.map((img) => ({ url: img.url, isPrivate: img.isPrivate }));
    }
    return parseStoredInventoryImageUrls(row.image_urls, row.image_url)
      .map((url) => ({ url, isPrivate: false }));
  });

  // First pass: first image from each merged item
  for (const images of perRowImages) {
    const first = images[0];
    if (!first || seen.has(first.url)) continue;
    selected.push(first);
    seen.add(first.url);
    if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
  }

  // Second pass: remaining images
  for (const images of perRowImages) {
    for (let i = 1; i < images.length; i++) {
      const img = images[i];
      if (!img || seen.has(img.url)) continue;
      selected.push(img);
      seen.add(img.url);
      if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
    }
  }

  return selected;
}

function buildMergedPackagePurchaseNotes(rows: InventoryItemRow[]): string {
  return rows.map((row, index) => {
    const paid = formatOptionalMoneyForPackageNotes(row.purchase_price) || '$0';
    const privateParty = formatOptionalMoneyForPackageNotes(row.private_party_value) || '$0';
    const itemLines = [
      `${index + 1}. ${normalizeText(row.ccg_number, 'N/A')} | ${normalizeText(row.title, 'Untitled')}`,
      `Category: ${getInventoryCategoryLabel(row) || 'N/A'}`,
      `Brand: ${normalizeText(row.brand, '') || 'N/A'}`,
      `Year: ${normalizeText(row.year_range, '') || 'N/A'}`,
      `Model: ${normalizeText(row.model, '') || 'N/A'}`,
      `Finish: ${normalizeText(row.finish, '') || 'N/A'}`,
      `How Much Paid: ${paid}`,
      `Private Party Value: ${privateParty}`,
      `Serial Number: ${normalizeText(row.serial_number, '') || 'N/A'}`,
      `Repair Notes: ${normalizeText(row.repair_notes, '') || 'N/A'}`,
    ];
    return itemLines.join('\n');
  }).join('\n\n');
}

async function cloneInventoryImageKeyToNewPackageImageUrl(sourceKey: string, env: Env): Promise<string> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    throw new Error('Inventory image uploads are not configured.');
  }
  const object = await env.CUSTOM_ITEMS_BUCKET.get(sourceKey);
  if (!object || !object.body) {
    throw new Error(`Source image not found for package creation: ${sourceKey}`);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const contentType = headers.get('content-type') || 'application/octet-stream';
  const ext = extensionFromContentType(contentType);
  const key = `inventory-items/packages/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const body = await object.arrayBuffer();
  await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
    httpMetadata: {
      contentType,
    },
  });
  return buildInventoryImageUrl(key);
}

async function clonePackageImagesFromMarkedRows(rows: InventoryItemRow[], env: Env): Promise<string[]> {
  const output: string[] = [];
  const seenSourceKeys = new Set<string>();

  for (const row of rows) {
    const imageUrls = parseStoredInventoryImageUrls(row.image_urls, row.image_url);
    for (const imageUrl of imageUrls) {
      const key = extractInventoryImageKey(imageUrl);
      if (!key || seenSourceKeys.has(key)) continue;
      seenSourceKeys.add(key);
      const clonedUrl = await cloneInventoryImageKeyToNewPackageImageUrl(key, env);
      output.push(clonedUrl);
      if (output.length >= INVENTORY_MAX_IMAGES) {
        return output;
      }
    }
  }

  return output;
}

async function purgeOrphanedInventoryImagesForDeletedRows(rows: InventoryItemRow[], env: Env): Promise<void> {
  if (!env.CUSTOM_ITEMS_BUCKET) return;

  const candidateKeys = new Set<string>();
  for (const row of rows) {
    const imageUrls = parseStoredInventoryImageUrls(row.image_urls, row.image_url);
    imageUrls.forEach((url) => {
      const key = extractInventoryImageKey(url);
      if (key) candidateKeys.add(key);
    });
  }
  if (candidateKeys.size === 0) return;

  const refs = await dbListAllInventoryImageRefs(env);
  const stillReferenced = new Set<string>();
  for (const ref of refs) {
    const urls = parseStoredInventoryImageUrls(ref.image_urls, ref.image_url);
    urls.forEach((url) => {
      const key = extractInventoryImageKey(url);
      if (key) stillReferenced.add(key);
    });
  }

  for (const key of candidateKeys) {
    if (stillReferenced.has(key)) continue;
    try {
      await env.CUSTOM_ITEMS_BUCKET.delete(key);
    } catch (error) {
      console.warn('Failed to purge orphaned inventory image', { key, error });
    }
  }
}

function randomIntInRange(min: number, max: number): number {
  const range = max - min + 1;
  const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return min + Math.floor(random * range);
}

function formatRange(low: number, high: number): string {
  if (low === high) return formatCurrency(low);
  return `${formatCurrency(low)} - ${formatCurrency(high)}`;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function isWeakAiText(value: unknown): boolean {
  const text = normalizeText(value, '');
  if (!text) return true;
  return /^(unknown|other|n\/a|na)$/i.test(text.trim());
}

function chooseBestStructuredText(primary: unknown, fallback: unknown, maxLength = 180): string {
  const primaryText = normalizeText(primary, '').slice(0, maxLength);
  if (!isWeakAiText(primaryText)) return primaryText;
  return normalizeText(fallback, '').slice(0, maxLength);
}

function buildSingleAiSummary(
  aiData: SingleAiResult | undefined,
  options?: { ideal?: number | null; privateParty?: { low: number; high: number } | null }
): string {
  if (!aiData) return '';

  const name = [
    normalizeText(aiData.year, ''),
    normalizeText(aiData.brand, ''),
    normalizeText(aiData.model, ''),
    normalizeText(aiData.finish, ''),
  ].filter(Boolean).join(' ').trim();

  const lines: string[] = [];
  lines.push('What it appears to be');
  lines.push(`- ${name || 'Unknown item'}`);
  lines.push(`- Condition: ${normalizeText(aiData.condition, 'Unknown')}`);

  const low = normalizeMoneyValue(aiData.value_private_party_low);
  const medium = normalizeMoneyValue(aiData.value_private_party_medium);
  const high = normalizeMoneyValue(aiData.value_private_party_high);
  const asking = normalizeMoneyValue(aiData.asking_price);

  if (low != null || medium != null || high != null || options?.ideal != null || asking != null) {
    lines.push('');
    lines.push('Prices');
    if (low != null && high != null) {
      lines.push(`- Typical private-party value: ${formatRange(low, high)}`);
    }
    if (medium != null) {
      lines.push(`- Midpoint estimate: ${formatCurrency(medium)}`);
    }
    if (options?.ideal != null) {
      lines.push(`- Ideal buy price: ${formatCurrency(options.ideal)}`);
    }
    if (asking != null) {
      lines.push(`- Asking price used: ${formatCurrency(asking)}`);
    }
  }

  const pricingNotes = normalizeText(aiData.pricing_notes, '');
  if (pricingNotes) {
    lines.push('');
    lines.push('Pricing notes');
    lines.push(`- ${pricingNotes}`);
  }

  return lines.join('\n').trim();
}

function clampScore(value: number): number {
  const rounded = Math.round(value);
  return Math.max(1, Math.min(10, rounded));
}

function formatSourceLabel(source: ListingSource): string {
  if (source === 'facebook') return 'FBM';
  if (source === 'craigslist') return 'CG';
  return 'R';
}

function generateRunId(): string {
  const now = new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `run-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

function isSponsoredListing(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const directFlags = [
    item.isSponsored,
    item.isSponsoredListing,
    item.isPromoted,
    item.isPaid,
    item.isAd,
    item.isAdvertisement,
  ];
  if (directFlags.some(Boolean)) return true;

  const typeFields = [
    item.type,
    item.listingType,
    item.listing_type,
    item.adType,
    item.ad_type,
  ].filter((value) => typeof value === 'string') as string[];
  if (typeFields.some((value) => /sponsored|promoted|ad/i.test(value))) return true;

  const labels = [
    item.label,
    item.badge,
    item.badgeText,
    item.displayName,
    item.title,
  ].filter((value) => typeof value === 'string') as string[];
  return labels.some((value) => /sponsored|promoted|ad/i.test(value));
}

async function runOpenAI(listing: ListingData, env: Env, options?: { isMulti?: boolean }): Promise<AiResult> {
  const maxImages = Number.parseInt(env.MAX_IMAGES || '3', 10);
  const images = listing.images.slice(0, Number.isFinite(maxImages) ? maxImages : 3);
  const isMulti = options?.isMulti ?? false;

  const systemPrompt = buildSystemPrompt(isMulti);
  const userPrompt = buildMainUserPrompt(listing, isMulti, CATEGORY_OPTIONS, CONDITION_OPTIONS);

  if (!env.OPENAI_API_KEY) {
    console.error('OpenAI API key missing');
    return 'AI analysis failed.';
  }

  const content: any[] = [{ type: 'input_text', text: userPrompt }];

  for (const imageUrl of images) {
    content.push({ type: 'input_image', image_url: imageUrl });
  }

  console.info('OpenAI request', {
    images: images.length,
    title: listing.title?.slice(0, 80) || 'unknown',
  });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content,
        },
      ],
      temperature: 0.4,
      max_output_tokens: 2000,
      text: isMulti
        ? undefined
        : {
            format: {
              type: 'json_schema',
              name: 'single_listing',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  category: { type: 'string' },
                  brand: { type: 'string' },
                  model: { type: 'string' },
                  finish: { type: 'string' },
                  year: { type: 'string' },
                  condition: { type: 'string' },
                  serial: { type: 'string' },
                  serial_brand: { type: 'string' },
                  serial_year: { type: 'string' },
                  serial_model: { type: 'string' },
                  value_private_party_low: { type: ['number', 'string', 'null'] },
                  value_private_party_low_notes: { type: 'string' },
                  value_private_party_medium: { type: ['number', 'string', 'null'] },
                  value_private_party_medium_notes: { type: 'string' },
                  value_private_party_high: { type: ['number', 'string', 'null'] },
                  value_private_party_high_notes: { type: 'string' },
                  value_pawn_shop_notes: { type: 'string' },
                  value_online_notes: { type: 'string' },
                  known_weak_points: { type: 'string' },
                  typical_repair_needs: { type: 'string' },
                  buyers_worry: { type: 'string' },
                  og_specs_pickups: { type: 'string' },
                  og_specs_tuners: { type: 'string' },
                  og_specs_common_mods: { type: 'string' },
                  buyer_what_to_check: { type: 'string' },
                  buyer_common_misrepresent: { type: 'string' },
                  seller_how_to_price_realistic: { type: 'string' },
                  seller_fixes_add_value_or_waste: { type: 'string' },
                  seller_as_is_notes: { type: 'string' },
                  asking_price: { type: ['number', 'string', 'null'] },
                },
                required: [
                  'category',
                  'brand',
                  'model',
                  'finish',
                  'year',
                  'condition',
                  'serial',
                  'serial_brand',
                  'serial_year',
                  'serial_model',
                  'value_private_party_low',
                  'value_private_party_low_notes',
                  'value_private_party_medium',
                  'value_private_party_medium_notes',
                  'value_private_party_high',
                  'value_private_party_high_notes',
                  'value_pawn_shop_notes',
                  'value_online_notes',
                  'known_weak_points',
                  'typical_repair_needs',
                  'buyers_worry',
                  'og_specs_pickups',
                  'og_specs_tuners',
                  'og_specs_common_mods',
                  'buyer_what_to_check',
                  'buyer_common_misrepresent',
                  'seller_how_to_price_realistic',
                  'seller_fixes_add_value_or_waste',
                  'seller_as_is_notes',
                  'asking_price',
                ],
              },
            },
          },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI response failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    if (isMulti) {
      return { kind: 'multi', summary: 'AI analysis failed.' };
    }
    return {
      kind: 'single',
      data: {
        category: 'Other',
        brand: 'Unknown',
        model: 'Unknown',
        finish: 'Unknown',
        year: 'Unknown',
        condition: 'Good',
        serial: '',
        serial_brand: '',
        serial_year: '',
        serial_model: '',
        value_private_party_low: null,
        value_private_party_low_notes: '',
        value_private_party_medium: null,
        value_private_party_medium_notes: '',
        value_private_party_high: null,
        value_private_party_high_notes: '',
        value_pawn_shop_notes: '',
        value_online_notes: '',
        known_weak_points: '',
        typical_repair_needs: '',
        buyers_worry: '',
        og_specs_pickups: '',
        og_specs_tuners: '',
        og_specs_common_mods: '',
        buyer_what_to_check: '',
        buyer_common_misrepresent: '',
        seller_how_to_price_realistic: '',
        seller_fixes_add_value_or_waste: '',
        seller_as_is_notes: '',
        asking_price: null,
      },
    };
  }

  const data = await response.json();
  if (isMulti) {
    return { kind: 'multi', summary: extractOpenAIText(data) || 'AI analysis returned no text.' };
  }

  const text = extractOpenAIText(data);
  try {
    let parsed = JSON.parse(text) as SingleAiResult;
    if (needsModelDisambiguation(parsed)) {
      parsed = await runOpenAIModelDisambiguation(listing, parsed, env);
    }
    return { kind: 'single', data: parsed };
  } catch (error) {
    console.error('OpenAI JSON parse failed', { error, text: text?.slice(0, 200) });
    const fallback: SingleAiResult = {
      category: 'Other',
      brand: 'Unknown',
      model: 'Unknown',
      finish: 'Unknown',
      year: 'Unknown',
      condition: 'Good',
      serial: '',
      serial_brand: '',
      serial_year: '',
      serial_model: '',
      value_private_party_low: null,
      value_private_party_low_notes: '',
      value_private_party_medium: null,
      value_private_party_medium_notes: '',
      value_private_party_high: null,
      value_private_party_high_notes: '',
      value_pawn_shop_notes: '',
      value_online_notes: '',
      known_weak_points: '',
      typical_repair_needs: '',
      buyers_worry: '',
      og_specs_pickups: '',
      og_specs_tuners: '',
      og_specs_common_mods: '',
      buyer_what_to_check: '',
      buyer_common_misrepresent: '',
      seller_how_to_price_realistic: '',
      seller_fixes_add_value_or_waste: '',
      seller_as_is_notes: '',
      asking_price: null,
    };
    return { kind: 'single', data: fallback };
  }
}

async function runOpenAIModelDisambiguation(
  listing: ListingData,
  base: SingleAiResult,
  env: Env
): Promise<SingleAiResult> {
  if (!env.OPENAI_API_KEY) return base;
  const maxImages = Number.parseInt(env.MAX_IMAGES || '3', 10);
  const images = listing.images.slice(0, Number.isFinite(maxImages) ? maxImages : 3);
  const prompt = [
    'Identify the most likely exact guitar model/variant from this listing text and images.',
    'Prefer specific model names (example: "Les Paul Studio"), but only if you are sure.  If you are not sure, use base model (example: "Les Paul").',
    'If uncertain, provide your best guess and include "(NOT DEFINITIVE)" in model text.',
    'Do not return "Unknown" when brand and images are provided; return the most likely model guess.',
    '',
    `Listing title: ${listing.title || 'Unknown'}`,
    `Listing description: ${listing.description || 'Not provided'}`,
    `User-provided brand hint: ${listing.brandHint || 'Not provided'}`,
    `User-provided model hint: ${listing.modelHint || 'Not provided'}`,
    `Known brand: ${base.brand || 'Unknown'}`,
    `Current model: ${base.model || 'Unknown'}`,
    `Known serial: ${base.serial || 'Unknown'}`,
    `Known serial brand: ${base.serial_brand || 'Unknown'}`,
    `Known serial model: ${base.serial_model || 'Unknown'}`,
    '',
    'Return JSON only with keys: brand, model, year, finish, condition, serial_model',
  ].join('\n');

  const content: any[] = [{ type: 'input_text', text: prompt }];
  for (const imageUrl of images) {
    content.push({ type: 'input_image', image_url: imageUrl });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content }],
      temperature: 0.1,
      max_output_tokens: 600,
      text: {
        format: {
          type: 'json_schema',
          name: 'model_disambiguation',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              brand: { type: 'string' },
              model: { type: 'string' },
              year: { type: 'string' },
              finish: { type: 'string' },
              condition: { type: 'string' },
              serial_model: { type: 'string' },
            },
            required: ['brand', 'model', 'year', 'finish', 'condition', 'serial_model'],
          },
        },
      },
    }),
  });

  if (!response.ok) return base;
  const data = await response.json();
  const text = extractOpenAIText(data);
  try {
    const patch = JSON.parse(text) as Partial<SingleAiResult>;
    return mergeModelDisambiguation(base, patch);
  } catch {
    return base;
  }
}

function stripEmptyFallback(fallback: Partial<SingleAiResult>): Partial<SingleAiResult> {
  const cleaned: Partial<SingleAiResult> = {};
  for (const [key, value] of Object.entries(fallback)) {
    if (value == null) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    (cleaned as Record<string, unknown>)[key] = value;
  }
  return cleaned;
}

function normalizePrivatePartyPricing(parsed: Partial<SingleAiResult>): Partial<SingleAiResult> | null {
  const low = normalizeMoneyValue(parsed.value_private_party_low);
  const medium = normalizeMoneyValue(parsed.value_private_party_medium);
  const high = normalizeMoneyValue(parsed.value_private_party_high);
  if (low == null && medium == null && high == null) return null;

  const fallback = low ?? medium ?? high;
  if (fallback == null) return null;

  const resolvedLow = low ?? medium ?? fallback;
  const resolvedHigh = high ?? medium ?? fallback;
  const rangeLow = Math.min(resolvedLow, resolvedHigh);
  const rangeHigh = Math.max(resolvedLow, resolvedHigh);
  const clampedMedium = Math.min(rangeHigh, Math.max(rangeLow, medium ?? Math.round((rangeLow + rangeHigh) / 2)));

  return {
    value_private_party_low: rangeLow,
    value_private_party_low_notes: normalizeText(parsed.value_private_party_low_notes, ''),
    value_private_party_medium: clampedMedium,
    value_private_party_medium_notes: normalizeText(parsed.value_private_party_medium_notes, ''),
    value_private_party_high: rangeHigh,
    value_private_party_high_notes: normalizeText(parsed.value_private_party_high_notes, ''),
    pricing_source: normalizeText(parsed.pricing_source, ''),
    pricing_confidence: normalizeText(parsed.pricing_confidence, ''),
    pricing_comp_count: normalizeMoneyValue(parsed.pricing_comp_count),
    pricing_notes: normalizeText(parsed.pricing_notes, ''),
  };
}

function pricingSubjectTokens(base: SingleAiResult): string[] {
  const brand = normalizeText(base.brand, '').toLowerCase();
  const model = normalizeText(base.model, '').toLowerCase()
    .replace(/\(not definitive\)/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ');
  return Array.from(new Set([brand, ...model.split(/\s+/)].filter((token) => token && token.length >= 3)));
}

function normalizePricingModelText(base: SingleAiResult): string {
  return normalizeText(base.model, '')
    .replace(/\(NOT DEFINITIVE\)/gi, '')
    .replace(/\bwith\s+roland\b.*$/i, '')
    .replace(/\bwith\s+midi\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNicheElectronicsListing(base: SingleAiResult): boolean {
  const text = [
    normalizeText(base.model, ''),
    normalizeText(base.og_specs_pickups, ''),
    normalizeText(base.known_weak_points, ''),
    normalizeText(base.buyer_what_to_check, ''),
  ].join(' ').toLowerCase();
  return /roland|midi|gk|13-?pin|synth/.test(text);
}

function buildReverbPricingQueries(base: SingleAiResult): Array<{ label: string; query: string }> {
  const brand = normalizeText(base.brand, '').replace(/\(NOT DEFINITIVE\)/gi, '').trim();
  const model = normalizeText(base.model, '').replace(/\(NOT DEFINITIVE\)/gi, '').trim();
  const baseModel = normalizePricingModelText(base);
  const finish = normalizeText(base.finish, '').replace(/^Guess:\s*/i, '').trim();
  const year = normalizeText(base.year, '').replace(/\(NOT DEFINITIVE\)/gi, '').trim();
  const condition = normalizeText(base.condition, '').trim();
  const modelLower = model.toLowerCase();
  const hasRoland = /roland|midi|gk/.test(modelLower)
    || /roland|midi|gk/.test(normalizeText(base.og_specs_pickups, '').toLowerCase());
  const hasStrat = /stratocaster|strat/.test(modelLower) || /stratocaster|strat/.test(baseModel.toLowerCase());
  const mentionsMexico = /mexico|mim/.test([model, baseModel, normalizeText(base.serial_brand, ''), normalizeText(base.year, '')].join(' ').toLowerCase());

  const exactish = [
    year && !/unknown/i.test(year) ? year : '',
    brand,
    model,
    finish && !/unknown/i.test(finish) ? finish : '',
    condition && !/unknown/i.test(condition) ? condition : '',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const relaxed = [
    brand,
    hasRoland ? 'Roland Ready' : '',
    hasStrat ? 'Stratocaster' : baseModel,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const feature = [
    brand,
    hasStrat ? 'Strat' : baseModel,
    hasRoland ? 'Roland GK MIDI' : 'MIDI',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const baseFloor = [
    brand,
    hasStrat ? 'Stratocaster' : baseModel,
    mentionsMexico ? 'MIM' : '',
    !mentionsMexico && /mexico/i.test([model, normalizeText(base.serial_brand, '')].join(' ')) ? 'Made in Mexico' : '',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const queries = [
    { label: 'exact', query: exactish || `${brand} ${model}`.trim() || 'guitar' },
    { label: 'relaxed', query: relaxed || `${brand} ${baseModel}`.trim() || 'guitar' },
    ...(hasRoland ? [{ label: 'feature', query: feature || `${brand} Roland Strat`.trim() }] : []),
    { label: 'base-floor', query: baseFloor || `${brand} ${baseModel}`.trim() || 'guitar' },
  ];

  const seen = new Set<string>();
  return queries.filter((entry) => {
    const key = entry.query.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildReverbPricingQuery(base: SingleAiResult): string {
  return buildReverbPricingQueries(base)[0]?.query || 'guitar';
}

function reverbRequestHeaders(env: Env): HeadersInit {
  const token = env.REVERB_API_TOKEN || REVERB_API_TOKEN_FALLBACK;
  return {
    'Content-Type': 'application/hal+json',
    'Accept': 'application/hal+json',
    'Accept-Version': '3.0',
    'Authorization': `Bearer ${token}`,
  };
}

function parseReverbListingPrice(listing: ReverbSearchListing): number | null {
  const base = parseCurrencyAmount(listing.price?.amount);
  if (base == null || base <= 0) return null;
  const shipping = parseCurrencyAmount(listing.shipping?.amount) || 0;
  return Math.round(base + shipping);
}

function normalizeReverbCondition(listing: ReverbSearchListing): string {
  if (typeof listing.condition === 'string') return normalizeText(listing.condition, '');
  return normalizeText(listing.condition?.display_name, '');
}

function normalizeReverbComp(listing: ReverbSearchListing): ReverbComp | null {
  const price = parseReverbListingPrice(listing);
  const title = normalizeText(listing.title, '');
  const url = normalizeText(listing._links?.web?.href, '');
  if (!price || !title) return null;
  return {
    title,
    price,
    condition: normalizeReverbCondition(listing),
    url,
  };
}

function scoreReverbCompMatch(comp: ReverbComp, base: SingleAiResult): number {
  const text = `${comp.title} ${comp.condition}`.toLowerCase();
  const tokens = pricingSubjectTokens(base);
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) score += 1;
  }
  if (/roland|gk|midi/.test(normalizeText(base.model, '').toLowerCase())) {
    if (/roland|gk|midi/.test(text)) score += 3;
    else score -= 2;
  }
  return score;
}

function pickReverbComps(raw: ReverbSearchListing[], base: SingleAiResult, minScore = 1): ReverbComp[] {
  return scoredReverbComps(raw, base)
    .filter((entry) => entry.score >= minScore)
    .slice(0, REVERB_PRICING_SEARCH_LIMIT)
    .map((entry) => entry.comp);
}

function scoredReverbComps(raw: ReverbSearchListing[], base: SingleAiResult): Array<{ comp: ReverbComp; score: number }> {
  return raw
    .map((listing) => normalizeReverbComp(listing))
    .filter((comp): comp is ReverbComp => Boolean(comp))
    .map((comp) => ({ comp, score: scoreReverbCompMatch(comp, base) }))
    .sort((a, b) => b.score - a.score || a.comp.price - b.comp.price);
}

function dedupeReverbComps(comps: ReverbComp[]): ReverbComp[] {
  const seen = new Set<string>();
  const out: ReverbComp[] = [];
  for (const comp of comps) {
    const key = `${comp.url}|${comp.title.toLowerCase()}|${comp.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(comp);
  }
  return out;
}

function summarizeReverbMatchesInline(comps: ReverbComp[], limit = 3): string {
  if (!comps.length) return 'No matched Reverb titles.';
  return comps.slice(0, limit).map((comp) => `"${comp.title}" ($${comp.price})`).join('; ');
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

function rangeFromReverbComps(comps: ReverbComp[], base: SingleAiResult): { low: number; medium: number; high: number; confidence: string; notes: string } | null {
  if (comps.length === 0) return null;
  const sorted = comps.map((c) => c.price).sort((a, b) => a - b);
  let low = percentile(sorted, 0.2);
  let medium = percentile(sorted, 0.5);
  let high = percentile(sorted, 0.8);

  // Convert Reverb online asking context to more realistic local private-party numbers.
  const onlineToPrivateFactor = comps.length >= 4 ? 0.82 : 0.78;
  low = Math.round(low * (onlineToPrivateFactor - 0.03));
  medium = Math.round(medium * onlineToPrivateFactor);
  high = Math.round(high * (onlineToPrivateFactor + 0.02));

  const modelText = normalizeText(base.model, '').toLowerCase();
  const serialKnown = Boolean(normalizeText(base.serial, ''));

  // Niche electronics/feature penalty unless verified by listing context (not currently available here).
  if (/roland|midi|gk/.test(modelText)) {
    low = Math.round(low * 0.9);
    medium = Math.round(medium * 0.9);
    high = Math.round(high * 0.88);
  }

  // Uncertainty penalty when serial is missing.
  if (!serialKnown) {
    low = Math.round(low * 0.96);
    medium = Math.round(medium * 0.95);
    high = Math.round(high * 0.93);
  }

  low = Math.max(50, low);
  high = Math.max(low, high);
  medium = Math.min(high, Math.max(low, medium));

  const confidence = comps.length >= 5 ? 'High' : comps.length >= 3 ? 'Medium' : 'Low';
  const notes = `Reverb listings context (${comps.length} matches). Converted to local private-party with conservative online-to-local discount and uncertainty penalties.`;
  return { low, medium, high, confidence, notes };
}

function summarizeReverbComps(comps: ReverbComp[]): string {
  if (!comps.length) return 'No Reverb matches found.';
  return comps
    .slice(0, 6)
    .map((comp, index) => `${index + 1}. ${comp.title} - $${comp.price}${comp.condition ? ` (${comp.condition})` : ''}`)
    .join('\n');
}

function clampRangeToCap(
  range: { low: number; medium: number; high: number },
  cap: { low: number; medium: number; high: number }
): { low: number; medium: number; high: number } {
  const low = Math.min(range.low, cap.low);
  const medium = Math.min(range.medium, cap.medium);
  const high = Math.min(range.high, cap.high);
  const normalizedLow = Math.min(low, high);
  const normalizedHigh = Math.max(low, high);
  const normalizedMedium = Math.min(normalizedHigh, Math.max(normalizedLow, medium));
  return { low: normalizedLow, medium: normalizedMedium, high: normalizedHigh };
}

function clampFallbackPricingForWeakReverb(
  fallback: Partial<SingleAiResult>,
  base: SingleAiResult,
  reverb: ReverbPricingContext
): Partial<SingleAiResult> {
  const normalized = normalizePrivatePartyPricing(fallback);
  if (!normalized) return fallback;
  if (!isNicheElectronicsListing(base)) return normalized;

  const baseFloorRange = (reverb.baseComps && reverb.baseComps.length)
    ? rangeFromReverbComps(reverb.baseComps, {
        ...base,
        model: normalizePricingModelText(base) || base.model,
        og_specs_pickups: '',
      })
    : null;

  let clamped = {
    low: normalizeMoneyValue(normalized.value_private_party_low) || 0,
    medium: normalizeMoneyValue(normalized.value_private_party_medium) || 0,
    high: normalizeMoneyValue(normalized.value_private_party_high) || 0,
  };

  if (baseFloorRange) {
    const cap = {
      low: Math.round(baseFloorRange.low * 1.02),
      medium: Math.round(baseFloorRange.medium * 1.06),
      high: Math.round(baseFloorRange.high * 1.12),
    };
    clamped = clampRangeToCap(clamped, cap);
  } else {
    clamped = {
      low: Math.round(clamped.low * 0.82),
      medium: Math.round(clamped.medium * 0.8),
      high: Math.round(clamped.high * 0.76),
    };
    clamped.high = Math.min(clamped.high, Math.round(Math.max(clamped.medium, clamped.low) * 1.12));
    clamped.medium = Math.min(clamped.medium, clamped.high);
    clamped.low = Math.min(clamped.low, clamped.medium);
  }

  return {
    ...normalized,
    value_private_party_low: clamped.low,
    value_private_party_medium: clamped.medium,
    value_private_party_high: clamped.high,
    value_private_party_low_notes: `${normalizeText(normalized.value_private_party_low_notes, '')} ${baseFloorRange ? 'Capped near base-model Reverb floor due unverified niche electronics feature.' : 'Reduced aggressively due unverified niche electronics feature and weak Reverb matches.'}`.trim(),
    value_private_party_medium_notes: `${normalizeText(normalized.value_private_party_medium_notes, '')} Conservative clamp applied for weak Reverb support on Roland/MIDI-style premium.`.trim(),
    value_private_party_high_notes: `${normalizeText(normalized.value_private_party_high_notes, '')} High-end premium capped without verified functionality.`.trim(),
  };
}

function clearPrivatePartyPricingFields(base: SingleAiResult): SingleAiResult {
  return {
    ...base,
    value_private_party_low: null,
    value_private_party_low_notes: '',
    value_private_party_medium: null,
    value_private_party_medium_notes: '',
    value_private_party_high: null,
    value_private_party_high_notes: '',
    pricing_source: '',
    pricing_confidence: '',
    pricing_comp_count: null,
    pricing_notes: '',
  };
}

async function fetchReverbPricingListings(query: string, env: Env): Promise<ReverbSearchListing[]> {
  const url = new URL(REVERB_SEARCH_API_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(REVERB_PRICING_SEARCH_LIMIT));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Reverb pricing search failed', { query, status: response.status, body: body.slice(0, 500) });
    return [];
  }

  const data = await response.json() as { listings?: ReverbSearchListing[] };
  return Array.isArray(data.listings) ? data.listings : [];
}

async function getSinglePricingFromOpenAI(base: SingleAiResult, env: Env): Promise<Partial<SingleAiResult> | null> {
  if (!env.OPENAI_API_KEY) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: buildSinglePricingPrompt(base) }],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'single_pricing',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              value_private_party_low: { type: ['number', 'string', 'null'] },
              value_private_party_low_notes: { type: 'string' },
              value_private_party_medium: { type: ['number', 'string', 'null'] },
              value_private_party_medium_notes: { type: 'string' },
              value_private_party_high: { type: ['number', 'string', 'null'] },
              value_private_party_high_notes: { type: 'string' },
              pricing_source: { type: 'string' },
              pricing_confidence: { type: 'string' },
              pricing_comp_count: { type: ['number', 'string', 'null'] },
              pricing_notes: { type: 'string' },
            },
            required: [
              'value_private_party_low',
              'value_private_party_low_notes',
              'value_private_party_medium',
              'value_private_party_medium_notes',
              'value_private_party_high',
              'value_private_party_high_notes',
              'pricing_source',
              'pricing_confidence',
              'pricing_comp_count',
              'pricing_notes',
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('OpenAI pricing response failed', { status: response.status, statusText: response.statusText, body });
    return null;
  }

  const data = await response.json();
  const text = extractOpenAIText(data);
  try {
    return JSON.parse(text) as Partial<SingleAiResult>;
  } catch (error) {
    console.error('OpenAI pricing JSON parse failed', { error, text: text?.slice(0, 200) });
    return null;
  }
}

async function getRealisticPrivatePartyPricing(base: SingleAiResult, env: Env): Promise<Partial<SingleAiResult> | null> {
  try {
    const queries = buildReverbPricingQueries(base);
    const rawByQuery = await Promise.all(queries.map((entry) => fetchReverbPricingListings(entry.query, env)));
    const comps = dedupeReverbComps(rawByQuery.flatMap((raw) => pickReverbComps(raw, base, 1)));
    const baseFloorEntry = queries.find((entry) => entry.label === 'base-floor') ?? queries[0];
    const baseRaw = baseFloorEntry ? await fetchReverbPricingListings(baseFloorEntry.query, env) : [];
    const baseComps = dedupeReverbComps(pickReverbComps(baseRaw, {
      ...base,
      model: normalizePricingModelText(base) || base.model,
      og_specs_pickups: '',
    }, 0));
    const reverbContext: ReverbPricingContext = { comps, baseComps };
    const range = rangeFromReverbComps(comps, base);

    if (range) {
      const notes = [
        range.notes,
        summarizeReverbMatchesInline(comps),
      ].filter(Boolean).join(' ');
      return {
        value_private_party_low: range.low,
        value_private_party_low_notes: notes,
        value_private_party_medium: range.medium,
        value_private_party_medium_notes: notes,
        value_private_party_high: range.high,
        value_private_party_high_notes: notes,
        pricing_source: 'Reverb active listings',
        pricing_confidence: range.confidence,
        pricing_comp_count: comps.length,
        pricing_notes: summarizeReverbComps(comps),
      };
    }

    const aiFallback = await getSinglePricingFromOpenAI(base, env);
    if (!aiFallback) return null;
    return clampFallbackPricingForWeakReverb(aiFallback, base, reverbContext);
  } catch (error) {
    console.error('Private-party pricing failed', { error });
    return null;
  }
}

async function runOpenAIMultiRangePricing(
  listing: ListingData,
  aiSummary: string,
  env: Env
): Promise<{ low: number; high: number } | null> {
  if (!env.OPENAI_API_KEY) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: buildMultiPricingPrompt(listing, aiSummary) }],
          },
        ],
        temperature: 0.2,
        max_output_tokens: 500,
        text: {
          format: {
            type: 'json_schema',
            name: 'multi_pricing',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                low: { type: ['number', 'string', 'null'] },
                high: { type: ['number', 'string', 'null'] },
              },
              required: ['low', 'high'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('OpenAI multi pricing response failed', { status: response.status, statusText: response.statusText, body });
      return null;
    }

    const data = await response.json();
    const parsed = JSON.parse(extractOpenAIText(data)) as { low?: unknown; high?: unknown };
    const low = normalizeMoneyValue(parsed.low);
    const high = normalizeMoneyValue(parsed.high);
    if (low == null || high == null) return null;
    return { low: Math.min(low, high), high: Math.max(low, high) };
  } catch (error) {
    console.error('OpenAI multi pricing failed', { error });
    return null;
  }
}

function applyMultiRangeToSummary(aiSummary: string, low: number, high: number): string {
  const rangeText = formatRange(low, high);
  if (/Used market range for all:\s*[^\n]+/i.test(aiSummary)) {
    return aiSummary.replace(/Used market range for all:\s*[^\n]+/i, `Used market range for all: ${rangeText}`);
  }
  return `${aiSummary.trim()}\n\nTotals\n- Used market range for all: ${rangeText}`.trim();
}

function redactPriceSignals(input: string): string {
  if (!input) return input;

  let output = input;

  // Remove explicit currency symbols with numbers.
  output = output.replace(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g, '[price]');

  // Remove common price tags.
  output = output.replace(/\b(?:usd|dollars?)\s*\d[\d,]*(?:\.\d{1,2})?\b/gi, '[price]');
  output = output.replace(/\b\d[\d,]*(?:\.\d{1,2})?\s*(?:usd|dollars?)\b/gi, '[price]');

  // Remove numbers when clearly tied to price terms.
  output = output.replace(
    /\b(?:price|asking|ask|obo|or best offer|firm)\b[^.\n]*?\b(\d{2,5})\b/gi,
    (match) => match.replace(/\b\d{2,5}\b/g, '[price]')
  );
  output = output.replace(
    /\b(\d{2,5})\b[^.\n]*?\b(?:price|asking|ask|obo|or best offer|firm)\b/gi,
    (match) => match.replace(/\b\d{2,5}\b/g, '[price]')
  );

  // Remove "X OBO" / "X firm" style patterns.
  output = output.replace(/\b\d{2,5}\b\s*(?:obo|firm|negotiable)\b/gi, '[price]');

  return output;
}

function redactPricingInput(input: string): string {
  if (!input) return input;
  let output = redactPriceSignals(input);

  // Remove any remaining standalone 2-5 digit numbers to avoid price leakage.
  output = output.replace(/\b\d{2,5}\b/g, '[num]');

  return output;
}

function extractOpenAIText(response: any): string {
  const output = response?.output || [];
  for (const item of output) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      const textPart = item.content.find((part: any) => part.type === 'output_text');
      if (textPart?.text) return textPart.text;
    }
  }
  return '';
}

function jsonResponse(body: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

type InventoryLabelPdfRow = {
  ccgNumber: string;
  title: string;
  imageUrl: string;
};

type PdfImageAsset = {
  width: number;
  height: number;
  colorSpace: '/DeviceGray' | '/DeviceRGB' | '/DeviceCMYK';
  bitsPerComponent: number;
  filter: '/DCTDecode' | '/FlateDecode';
  data: Uint8Array;
  decodeParms?: string;
};

type PdfPageDefinition = {
  pageObjectNumber: number;
  contentObjectNumber: number;
  images: Array<{ name: string; objectNumber: number; asset: PdfImageAsset }>;
  rows: InventoryLabelPdfRow[];
};

const PDF_POINTS_PER_INCH = 72;
const PDF_LETTER_WIDTH = 8.5 * PDF_POINTS_PER_INCH;
const PDF_LETTER_HEIGHT = 11 * PDF_POINTS_PER_INCH;
const PDF_LABEL_WIDTH = 4 * PDF_POINTS_PER_INCH;
const PDF_LABEL_HEIGHT = 2 * PDF_POINTS_PER_INCH;
const PDF_LABEL_COLUMNS = 2;
const PDF_LABEL_ROWS = 5;
const PDF_LABELS_PER_PAGE = PDF_LABEL_COLUMNS * PDF_LABEL_ROWS;
const PDF_UNIQUE_LABEL_ITEMS_PER_PAGE = PDF_LABEL_ROWS;
// Avery 5163: 10-up, 2" x 4" labels on US Letter.
const PDF_LABEL_MARGIN_X = 0.1875 * PDF_POINTS_PER_INCH;
const PDF_LABEL_MARGIN_Y = 0.5 * PDF_POINTS_PER_INCH;
const PDF_LABEL_COLUMN_GAP = 0.125 * PDF_POINTS_PER_INCH;
const PDF_LABEL_ROW_GAP = 0;
const PDF_LABEL_PITCH_X = PDF_LABEL_WIDTH + PDF_LABEL_COLUMN_GAP;
const PDF_LABEL_PITCH_Y = PDF_LABEL_HEIGHT + PDF_LABEL_ROW_GAP;
// Keep internal content visually filled by scaling legacy 12-up spacing to the taller 2" label.
const PDF_LABEL_BASE_HEIGHT = 1.75 * PDF_POINTS_PER_INCH;
const PDF_LABEL_INTERNAL_SCALE = PDF_LABEL_HEIGHT / PDF_LABEL_BASE_HEIGHT;
const PDF_MONO_WIDTH_EM = 0.6;
const PDF_HELVETICA_DEFAULT_WIDTH_EM = 0.52;
const PDF_LABEL_HORIZONTAL_PADDING = 10 * PDF_LABEL_INTERNAL_SCALE;
const PDF_LABEL_TOP_PADDING = 10 * PDF_LABEL_INTERNAL_SCALE;
const PDF_LABEL_BOTTOM_PADDING = 20 * PDF_LABEL_INTERNAL_SCALE;
const PDF_LABEL_LEFT_IMAGE_WIDTH = PDF_LABEL_WIDTH * 0.25;
const PDF_LABEL_IMAGE_PADDING_X = 6;
const PDF_LABEL_IMAGE_PADDING_Y = 8 * PDF_LABEL_INTERNAL_SCALE;
const PDF_LABEL_TEXT_GAP = 6;
const PDF_LABEL_TITLE_FONT_SIZE = 16;
const PDF_LABEL_TITLE_LINE_HEIGHT = 18;
const PDF_LABEL_RIGHT_PADDING = 3;
const PDF_LABEL_TITLE_SECOND_LINE_BASELINE = 22 * PDF_LABEL_INTERNAL_SCALE;
const PDF_LABEL_TITLE_MAX_BOX_HEIGHT = 58 * PDF_LABEL_INTERNAL_SCALE;
// Printer/feed compensation:
// keep the top row where it is, and progressively nudge lower rows down to prevent upward drift.
const PDF_LABEL_CONTENT_GLOBAL_Y_OFFSET = -1.5;
const PDF_LABEL_CONTENT_ROW_DRIFT_COMPENSATION = -2;
const PDF_LABEL_CONTENT_ROW_FINE_TUNE: readonly number[] = [0, 0, 0, -0.8, -2.2];
const PDF_LABEL_IMAGE_ROW_FINE_TUNE: readonly number[] = [0, 0, 0, -1.2, -18];

async function buildInventoryLabelsPdf(rows: InventoryLabelPdfRow[], env: Env): Promise<Uint8Array> {
  const pages = chunkArray(rows, PDF_UNIQUE_LABEL_ITEMS_PER_PAGE).map((pageRows) =>
    pageRows.flatMap((row) => [row, row]),
  );
  const pageDefinitions: PdfPageDefinition[] = [];
  let nextObjectNumber = 6;

  for (const pageRows of pages) {
    const images: PdfPageDefinition['images'] = [];
    for (let index = 0; index < pageRows.length; index += 1) {
      const asset = await fetchPdfImageAsset(pageRows[index].imageUrl, env);
      if (!asset) continue;
      images.push({
        name: `Im${index + 1}`,
        objectNumber: nextObjectNumber,
        asset,
      });
      nextObjectNumber += 1;
    }

    pageDefinitions.push({
      pageObjectNumber: nextObjectNumber,
      contentObjectNumber: nextObjectNumber + 1,
      images,
      rows: pageRows,
    });
    nextObjectNumber += 2;
  }

  const objectMap = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  objectMap.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objectMap.set(
    2,
    encoder.encode(
      `<< /Type /Pages /Count ${pageDefinitions.length} /Kids [${pageDefinitions.map((page) => `${page.pageObjectNumber} 0 R`).join(' ')}] >>`,
    ),
  );
  objectMap.set(3, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'));
  objectMap.set(4, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'));
  objectMap.set(5, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const page of pageDefinitions) {
    for (const image of page.images) {
      objectMap.set(image.objectNumber, buildPdfImageObject(image.asset));
    }

    const contentBytes = encoder.encode(buildInventoryLabelsPageContent(page.rows, page.images));
    const xObjectSection = page.images.length
      ? ` /XObject << ${page.images.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ')} >>`
      : '';

    objectMap.set(
      page.pageObjectNumber,
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LETTER_WIDTH} ${PDF_LETTER_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjectSection} >> /Contents ${page.contentObjectNumber} 0 R >>`,
      ),
    );
    objectMap.set(
      page.contentObjectNumber,
      concatenatePdfParts([
        encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  const totalObjects = Math.max(...objectMap.keys());
  const objects: Uint8Array[] = [];
  for (let index = 1; index <= totalObjects; index += 1) {
    const objectBytes = objectMap.get(index);
    if (!objectBytes) {
      throw new Error(`Missing PDF object ${index}`);
    }
    objects.push(objectBytes);
  }

  return assemblePdf(objects);
}

async function buildInventoryLabelsPdfPositioned(slots: Array<InventoryLabelPdfRow | null>, env: Env): Promise<Uint8Array> {
  // Single page with 10 slots; null slots are blank
  const pageDefinitions: PdfPageDefinition[] = [];
  let nextObjectNumber = 6;

  const images: PdfPageDefinition['images'] = [];
  const pageRows: InventoryLabelPdfRow[] = [];

  for (let index = 0; index < PDF_LABELS_PER_PAGE; index++) {
    const slot = index < slots.length ? slots[index] : null;
    // Always push a row (blank or real) to maintain position alignment
    pageRows.push(slot ?? { ccgNumber: '', title: '', imageUrl: '' });
    if (slot && slot.imageUrl) {
      const asset = await fetchPdfImageAsset(slot.imageUrl, env);
      if (asset) {
        images.push({
          name: `Im${index + 1}`,
          objectNumber: nextObjectNumber,
          asset,
        });
        nextObjectNumber += 1;
      }
    }
  }

  pageDefinitions.push({
    pageObjectNumber: nextObjectNumber,
    contentObjectNumber: nextObjectNumber + 1,
    images,
    rows: pageRows,
  });
  nextObjectNumber += 2;

  const objectMap = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  objectMap.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objectMap.set(
    2,
    encoder.encode(
      `<< /Type /Pages /Count ${pageDefinitions.length} /Kids [${pageDefinitions.map((page) => `${page.pageObjectNumber} 0 R`).join(' ')}] >>`,
    ),
  );
  objectMap.set(3, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'));
  objectMap.set(4, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'));
  objectMap.set(5, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const page of pageDefinitions) {
    for (const image of page.images) {
      objectMap.set(image.objectNumber, buildPdfImageObject(image.asset));
    }

    const contentBytes = encoder.encode(buildInventoryLabelsPageContent(page.rows, page.images));
    const xObjectSection = page.images.length
      ? ` /XObject << ${page.images.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ')} >>`
      : '';

    objectMap.set(
      page.pageObjectNumber,
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LETTER_WIDTH} ${PDF_LETTER_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjectSection} >> /Contents ${page.contentObjectNumber} 0 R >>`,
      ),
    );
    objectMap.set(
      page.contentObjectNumber,
      concatenatePdfParts([
        encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  const totalObjects = Math.max(...objectMap.keys());
  const objects: Uint8Array[] = [];
  for (let index = 1; index <= totalObjects; index += 1) {
    const objectBytes = objectMap.get(index);
    if (!objectBytes) {
      throw new Error(`Missing PDF object ${index}`);
    }
    objects.push(objectBytes);
  }

  return assemblePdf(objects);
}

async function buildInventoryLabelsPdfFromExpanded(rows: InventoryLabelPdfRow[], env: Env): Promise<Uint8Array> {
  const pages = chunkArray(rows, PDF_LABELS_PER_PAGE);
  const pageDefinitions: PdfPageDefinition[] = [];
  let nextObjectNumber = 6;

  for (const pageRows of pages) {
    const images: PdfPageDefinition['images'] = [];
    for (let index = 0; index < pageRows.length; index += 1) {
      const asset = await fetchPdfImageAsset(pageRows[index].imageUrl, env);
      if (!asset) continue;
      images.push({
        name: `Im${index + 1}`,
        objectNumber: nextObjectNumber,
        asset,
      });
      nextObjectNumber += 1;
    }

    pageDefinitions.push({
      pageObjectNumber: nextObjectNumber,
      contentObjectNumber: nextObjectNumber + 1,
      images,
      rows: pageRows,
    });
    nextObjectNumber += 2;
  }

  const objectMap = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  objectMap.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objectMap.set(
    2,
    encoder.encode(
      `<< /Type /Pages /Count ${pageDefinitions.length} /Kids [${pageDefinitions.map((page) => `${page.pageObjectNumber} 0 R`).join(' ')}] >>`,
    ),
  );
  objectMap.set(3, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'));
  objectMap.set(4, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'));
  objectMap.set(5, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const page of pageDefinitions) {
    for (const image of page.images) {
      objectMap.set(image.objectNumber, buildPdfImageObject(image.asset));
    }

    const contentBytes = encoder.encode(buildInventoryLabelsPageContent(page.rows, page.images));
    const xObjectSection = page.images.length
      ? ` /XObject << ${page.images.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ')} >>`
      : '';

    objectMap.set(
      page.pageObjectNumber,
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LETTER_WIDTH} ${PDF_LETTER_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjectSection} >> /Contents ${page.contentObjectNumber} 0 R >>`,
      ),
    );
    objectMap.set(
      page.contentObjectNumber,
      concatenatePdfParts([
        encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  const totalObjects = Math.max(...objectMap.keys());
  const objects: Uint8Array[] = [];
  for (let index = 1; index <= totalObjects; index += 1) {
    const objectBytes = objectMap.get(index);
    if (!objectBytes) {
      throw new Error(`Missing PDF object ${index}`);
    }
    objects.push(objectBytes);
  }

  return assemblePdf(objects);
}

function buildInventoryLabelsPageContent(
  rows: InventoryLabelPdfRow[],
  images: Array<{ name: string; objectNumber: number; asset: PdfImageAsset }>,
): string {
  const commands: string[] = ['0 0 0 RG', '0 0 0 rg', '1 J', '1 j'];
  const imageByName = new Map(images.map((image) => [image.name, image]));

  rows.forEach((row, index) => {
    // Skip blank slots (positioned mode empty positions)
    if (!row.ccgNumber) return;

    const col = index % PDF_LABEL_COLUMNS;
    const rowIndex = Math.floor(index / PDF_LABEL_COLUMNS);
    const left = PDF_LABEL_MARGIN_X + col * PDF_LABEL_PITCH_X;
    const bottom =
      PDF_LETTER_HEIGHT - PDF_LABEL_MARGIN_Y - PDF_LABEL_HEIGHT - rowIndex * PDF_LABEL_PITCH_Y;
    const contentBottom =
      bottom +
      PDF_LABEL_CONTENT_GLOBAL_Y_OFFSET +
      rowIndex * PDF_LABEL_CONTENT_ROW_DRIFT_COMPENSATION +
      (PDF_LABEL_CONTENT_ROW_FINE_TUNE[rowIndex] ?? 0);
    const imageBottom = contentBottom + (PDF_LABEL_IMAGE_ROW_FINE_TUNE[rowIndex] ?? 0);
    const imageName = `Im${index + 1}`;

    if (imageByName.has(imageName)) {
      commands.push(renderLabelImage(left, imageBottom, imageName, imageByName.get(imageName)!.asset));
    }
    commands.push(renderLabelCcgNumber(left, contentBottom, row.ccgNumber));
    commands.push(renderLabelTitle(left, contentBottom, row.title));
  });

  return commands.filter(Boolean).join('\n');
}

function renderLabelImage(left: number, bottom: number, imageName: string, asset: PdfImageAsset): string {
  const availableWidth = PDF_LABEL_LEFT_IMAGE_WIDTH - PDF_LABEL_IMAGE_PADDING_X * 2;
  const availableHeight = PDF_LABEL_HEIGHT - PDF_LABEL_IMAGE_PADDING_Y * 2;
  const scale = Math.min(availableWidth / asset.width, availableHeight / asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  const x = left + PDF_LABEL_IMAGE_PADDING_X + (availableWidth - width) / 2;
  const y = bottom + PDF_LABEL_IMAGE_PADDING_Y + (availableHeight - height) / 2;
  return `q ${formatPdfNumber(width)} 0 0 ${formatPdfNumber(height)} ${formatPdfNumber(x)} ${formatPdfNumber(y)} cm /${imageName} Do Q`;
}

function renderLabelCcgNumber(left: number, bottom: number, ccgNumber: string): string {
  const sanitized = normalizePdfText(stripCcgPrefix(ccgNumber));
  const textStartX = left + PDF_LABEL_LEFT_IMAGE_WIDTH + PDF_LABEL_TEXT_GAP;
  const availableWidth = PDF_LABEL_WIDTH - PDF_LABEL_LEFT_IMAGE_WIDTH - PDF_LABEL_TEXT_GAP - PDF_LABEL_RIGHT_PADDING;
  const fontSizeFromWidth = availableWidth / Math.max(1, sanitized.length * PDF_MONO_WIDTH_EM);
  const fontSize = Math.max(22, Math.min(44, fontSizeFromWidth));
  const textWidth = estimateMonospaceTextWidth(sanitized, fontSize);
  const x = textStartX + (availableWidth - textWidth) / 2;
  const y = bottom + PDF_LABEL_HEIGHT - PDF_LABEL_TOP_PADDING - fontSize * 0.82;

  return renderPdfText('/F2', fontSize, x, y, sanitized);
}

function renderLabelTitle(left: number, bottom: number, title: string): string {
  const textLeft = left + PDF_LABEL_LEFT_IMAGE_WIDTH + PDF_LABEL_TEXT_GAP;
  const secondLineBaseline = bottom + PDF_LABEL_TITLE_SECOND_LINE_BASELINE;
  const availableWidth =
    PDF_LABEL_WIDTH - PDF_LABEL_LEFT_IMAGE_WIDTH - PDF_LABEL_TEXT_GAP - PDF_LABEL_RIGHT_PADDING;
  const titleLayout = layoutPdfProportionalText(title, availableWidth, PDF_LABEL_TITLE_MAX_BOX_HEIGHT, 2);

  return titleLayout.lines
    .map((line, index) =>
      renderPdfText(
        '/F3',
        titleLayout.fontSize,
        textLeft,
        secondLineBaseline + (1 - index) * titleLayout.lineHeight,
        line,
      ),
    )
    .join('\n');
}

function renderPdfText(fontName: string, fontSize: number, x: number, y: number, text: string): string {
  return `BT ${fontName} ${formatPdfNumber(fontSize)} Tf 1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(y)} Tm (${escapePdfString(text)}) Tj ET`;
}

function wrapPdfMonospaceText(
  value: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const sanitized = normalizePdfText(value || 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * PDF_MONO_WIDTH_EM)));
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let current = '';
  let truncated = false;

  wordLoop: for (const originalWord of words) {
    let word = originalWord;
    if (!word) continue;
    while (word) {
      if (!current) {
        if (word.length <= maxChars) {
          current = word;
          word = '';
          continue;
        }

        if (lines.length === maxLines - 1) {
          lines.push(truncateWithEllipsis(word, maxChars));
          truncated = true;
          break wordLoop;
        }

        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
        continue;
      }

      const candidate = `${current} ${word}`;
      if (candidate.length <= maxChars) {
        current = candidate;
        word = '';
        continue;
      }

      lines.push(current);
      current = '';
      if (lines.length === maxLines) {
        truncated = true;
        break wordLoop;
      }
    }
  }

  if (current) {
    if (lines.length < maxLines) {
      lines.push(current);
    } else {
      truncated = true;
    }
  }

  if (truncated && lines.length > 0 && !lines[lines.length - 1].endsWith('...')) {
    lines[lines.length - 1] = truncateWithEllipsis(lines[lines.length - 1], maxChars);
  }

  return lines.slice(0, maxLines);
}

function layoutPdfMonospaceText(
  value: string,
  maxWidth: number,
  maxHeight: number,
  maxLines: number,
): { fontSize: number; lineHeight: number; lines: string[] } {
  for (let fontSize = 20; fontSize >= 13; fontSize -= 1) {
    const lineHeight = fontSize + 2;
    if (lineHeight * maxLines > maxHeight) continue;
    const lines = wrapPdfMonospaceText(value, fontSize, maxWidth, maxLines);
    if (lines.length <= maxLines) {
      return { fontSize, lineHeight, lines };
    }
  }

  return {
    fontSize: 13,
    lineHeight: 15,
    lines: wrapPdfMonospaceText(value, 13, maxWidth, maxLines),
  };
}

function wrapPdfProportionalText(
  value: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const sanitized = normalizePdfText(value || 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let current = '';
  let truncated = false;

  for (const word of words) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (estimateHelveticaTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = '';
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    }

    if (estimateHelveticaTextWidth(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let remaining = word;
    while (remaining) {
      const chunk = fitTextToWidth(remaining, fontSize, maxWidth);
      if (!chunk) {
        truncated = true;
        remaining = '';
        break;
      }
      lines.push(chunk);
      remaining = remaining.slice(chunk.length);
      if (lines.length === maxLines) {
        truncated = remaining.length > 0;
        break;
      }
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current && lines.length >= maxLines) {
    truncated = true;
  }

  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = truncateToWidthWithEllipsis(lines[lines.length - 1], fontSize, maxWidth);
  }

  return lines.slice(0, maxLines);
}

function layoutPdfProportionalText(
  value: string,
  maxWidth: number,
  maxHeight: number,
  maxLines: number,
): { fontSize: number; lineHeight: number; lines: string[] } {
  for (let fontSize = 20; fontSize >= 13; fontSize -= 1) {
    const lineHeight = fontSize + 2;
    if (lineHeight * maxLines > maxHeight) continue;
    const lines = wrapPdfProportionalText(value, fontSize, maxWidth, maxLines);
    if (lines.length <= maxLines) {
      return { fontSize, lineHeight, lines };
    }
  }

  return {
    fontSize: 13,
    lineHeight: 15,
    lines: wrapPdfProportionalText(value, 13, maxWidth, maxLines),
  };
}

function truncateWithEllipsis(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value.length >= 2 ? `${value.slice(0, Math.max(0, maxChars - 2))}..` : '.'.repeat(maxChars);
  }
  if (maxChars <= 2) return '.'.repeat(maxChars);
  return `${value.slice(0, maxChars - 2)}..`;
}

function normalizePdfText(value: string): string {
  return value
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .replaceAll('\u201C', '"')
    .replaceAll('\u201D', '"')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2026', '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateMonospaceTextWidth(value: string, fontSize: number): number {
  return value.length * fontSize * PDF_MONO_WIDTH_EM;
}

function estimateHelveticaTextWidth(value: string, fontSize: number): number {
  let emWidth = 0;
  for (const char of value) {
    if (char === ' ') {
      emWidth += 0.28;
      continue;
    }
    if (/[ilIjt'`!|:;.,()\[\]{}]/.test(char)) {
      emWidth += 0.28;
      continue;
    }
    if (/[fr]/.test(char)) {
      emWidth += 0.36;
      continue;
    }
    if (/[MW@#%&Q]/.test(char)) {
      emWidth += 0.9;
      continue;
    }
    if (/[A-Z]/.test(char)) {
      emWidth += 0.67;
      continue;
    }
    if (/[0-9]/.test(char)) {
      emWidth += 0.56;
      continue;
    }
    emWidth += PDF_HELVETICA_DEFAULT_WIDTH_EM;
  }
  return emWidth * fontSize;
}

function fitTextToWidth(value: string, fontSize: number, maxWidth: number): string {
  let fitted = '';
  for (const char of value) {
    const candidate = `${fitted}${char}`;
    if (estimateHelveticaTextWidth(candidate, fontSize) > maxWidth) break;
    fitted = candidate;
  }
  return fitted;
}

function truncateToWidthWithEllipsis(value: string, fontSize: number, maxWidth: number): string {
  const ellipsis = '..';
  if (estimateHelveticaTextWidth(value, fontSize) <= maxWidth) {
    if (estimateHelveticaTextWidth(`${value}${ellipsis}`, fontSize) <= maxWidth) {
      return `${value}${ellipsis}`;
    }
    return value;
  }

  let fitted = fitTextToWidth(value, fontSize, maxWidth);
  while (fitted && estimateHelveticaTextWidth(`${fitted}${ellipsis}`, fontSize) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return fitted ? `${fitted}${ellipsis}` : '.';
}

function escapePdfString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function formatPdfNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function stripCcgPrefix(value: string): string {
  return value.replace(/^CCG-/i, '').trim();
}

async function fetchPdfImageAsset(imageUrl: string, env: Env): Promise<PdfImageAsset | null> {
  try {
    const directAsset = await fetchPdfImageAssetFromBucket(imageUrl, env);
    if (directAsset) return directAsset;

    const absoluteUrl = resolvePdfImageUrl(imageUrl, env);
    if (!absoluteUrl) return null;

    const response = await fetch(absoluteUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    const parsedAsset = parsePdfImageAsset(bytes, contentType);
    if (parsedAsset) {
      return parsedAsset;
    }
  } catch (error) {
    console.warn('Unable to fetch label image asset', { imageUrl, error });
  }

  return null;
}

async function fetchPdfImageAssetFromBucket(imageUrl: string, env: Env): Promise<PdfImageAsset | null> {
  if (!env.CUSTOM_ITEMS_BUCKET) return null;
  const key = extractInventoryImageKey(imageUrl);
  if (!key) return null;

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object?.body) return null;

  const bytes = new Uint8Array(await object.arrayBuffer());
  const contentType = (object.httpMetadata?.contentType || '').toLowerCase();
  return parsePdfImageAsset(bytes, contentType);
}

function parsePdfImageAsset(bytes: Uint8Array, contentType: string): PdfImageAsset | null {
  if (contentType.includes('jpeg') || contentType.includes('jpg') || isJpegBytes(bytes)) {
    return parseJpegPdfAsset(bytes);
  }
  if (contentType.includes('png') || isPngBytes(bytes)) {
    return parsePngPdfAsset(bytes);
  }
  return null;
}

function resolvePdfImageUrl(imageUrl: string, env: Env): string | null {
  const normalized = normalizeText(imageUrl, '');
  if (!normalized) return null;
  try {
    return new URL(normalized, env.SITE_BASE_URL).toString();
  } catch {
    return null;
  }
}

function buildPdfImageObject(asset: PdfImageAsset): Uint8Array {
  const encoder = new TextEncoder();
  const decodeParms = asset.decodeParms ? ` /DecodeParms ${asset.decodeParms}` : '';
  return concatenatePdfParts([
    encoder.encode(
      `<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace ${asset.colorSpace} /BitsPerComponent ${asset.bitsPerComponent} /Filter ${asset.filter}${decodeParms} /Length ${asset.data.length} >>\nstream\n`,
    ),
    asset.data,
    encoder.encode('\nendstream'),
  ]);
}

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

function isPngBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function parseJpegPdfAsset(bytes: Uint8Array): PdfImageAsset | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;

    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      const bitsPerComponent = bytes[offset + 2];
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const components = bytes[offset + 7];
      const colorSpace =
        components === 1 ? '/DeviceGray' : components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      return {
        width,
        height,
        colorSpace,
        bitsPerComponent,
        filter: '/DCTDecode',
        data: bytes,
      };
    }

    offset += length;
  }

  return null;
}

function parsePngPdfAsset(bytes: Uint8Array): PdfImageAsset | null {
  if (!isPngBytes(bytes)) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compression = 0;
  let filter = 0;
  let interlace = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = readUint32Be(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null;

    if (type === 'IHDR') {
      width = readUint32Be(bytes, dataStart);
      height = readUint32Be(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      compression = bytes[dataStart + 10];
      filter = bytes[dataStart + 11];
      interlace = bytes[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(bytes.slice(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || idatChunks.length < 1) return null;
  if (compression !== 0 || filter !== 0 || interlace !== 0 || bitDepth !== 8) return null;

  if (colorType === 0) {
    return {
      width,
      height,
      colorSpace: '/DeviceGray',
      bitsPerComponent: 8,
      filter: '/FlateDecode',
      decodeParms: `<< /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ${width} >>`,
      data: concatenatePdfParts(idatChunks),
    };
  }

  if (colorType === 2) {
    return {
      width,
      height,
      colorSpace: '/DeviceRGB',
      bitsPerComponent: 8,
      filter: '/FlateDecode',
      decodeParms: `<< /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${width} >>`,
      data: concatenatePdfParts(idatChunks),
    };
  }

  return null;
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function assemblePdf(objects: Uint8Array[]): Uint8Array {
  const encoder = new TextEncoder();
  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let length = header.length;

  objects.forEach((objectBytes, index) => {
    offsets.push(length);
    const prefix = encoder.encode(`${index + 1} 0 obj\n`);
    const suffix = encoder.encode('\nendobj\n');
    parts.push(prefix, objectBytes, suffix);
    length += prefix.length + objectBytes.length + suffix.length;
  });

  const xrefOffset = length;
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `);
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(encoder.encode(`${xrefLines.join('\n')}\n${trailer}`));

  return concatenatePdfParts(parts);
}

function concatenatePdfParts(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    merged.set(part, offset);
    offset += part.length;
  });
  return merged;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
