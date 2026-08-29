import type { Env } from '../env.js';
import { jsonResponse, normalizeText, parseShopCategoryIds, normalizeShopProductSort } from '../utils/misc.js';
import { normalizeEmailAddress } from '../utils/text.js';
import { parseCurrencyAmount } from '../utils/money.js';
import { dbListInventoryCategories, buildInventoryCategoryTree } from '../inventory/categories.js';
import { getShopRuntimeSettings } from '../system/runtime.js';
import {
  dbListShopProducts,
  dbFindShopProductByBarcode,
  dbSearchShopProductsByTitle,
  dbGetShopProductDetail,
  dbCreateNewsletterSubscriber,
} from './db.js';
import {
  isAssociateModeRequest,
} from './associate.js';
import { normalizeAnalyticsToken } from './analytics.js';

export async function handleShopCategories(env: Env): Promise<Response> {
  const records = await dbListInventoryCategories(env);
  return jsonResponse({
    records,
    tree: buildInventoryCategoryTree(records),
  });
}

export async function handleShopSettings(env: Env): Promise<Response> {
  const settings = await getShopRuntimeSettings(env);
  return jsonResponse(settings);
}

export async function handleShopProducts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const categoryIds = parseShopCategoryIds(url);
  const search = normalizeText(url.searchParams.get('search'), '').slice(0, 200);
  const brands = Array.from(new Set(url.searchParams.getAll('brand').map((brand) => normalizeText(brand, '').slice(0, 100)).filter(Boolean)));
  const sort = normalizeShopProductSort(url.searchParams.get('sort'));
  const showSold = url.searchParams.get('showSold') === '1';
  const associateMode = url.searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  const priceMin = parseCurrencyAmount(url.searchParams.get('priceMin')) ?? 0;
  const priceMax = parseCurrencyAmount(url.searchParams.get('priceMax')) ?? 0;
  const conditionInput = normalizeText(url.searchParams.get('condition'), 'All').slice(0, 50);
  const condition = conditionInput && conditionInput !== 'All' ? conditionInput : '';
  const tag = normalizeText(url.searchParams.get('tag'), '').toLowerCase().slice(0, 50);
  const randomSeed = normalizeAnalyticsToken(url.searchParams.get('randomSeed'), 120);
  const useBalancedRandom = Boolean(
    randomSeed
    && sort === 'popular'
    && categoryIds.length === 0
    && !search
    && brands.length === 0
    && priceMin === 0
    && priceMax === 0
    && !condition
    && !tag
    && !showSold
  );

  const productResult = await dbListShopProducts({
    categoryIds,
    search,
    brands,
    sort,
    randomSeed: useBalancedRandom ? randomSeed : '',
    showSold,
    associateMode,
    priceMin,
    priceMax,
    condition,
    tag,
  }, env);

  return jsonResponse({
    records: productResult.records,
    brands: productResult.brands,
    filters: {
      categoryIds,
      search,
      brands,
      sort,
      randomized: useBalancedRandom ? 1 : 0,
      showSold: showSold ? 1 : 0,
      associateMode: associateMode ? 1 : 0,
      priceMin,
      priceMax,
      condition: condition || 'All',
      tag: tag || '',
    },
  });
}

export async function handleShopProductSearch(request: Request, env: Env): Promise<Response> {
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

export async function handleShopProductDetail(id: number, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = new URL(request.url).searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  const record = await dbGetShopProductDetail({ id }, env, { includeInStoreOnly });
  if (!record) return jsonResponse({ message: 'Product not found.' }, 404);
  return jsonResponse({ record });
}

export async function handleShopProductDetailBySlug(slug: string, request: Request, env: Env): Promise<Response> {
  const trimmed = slug.trim();
  if (!trimmed) return jsonResponse({ message: 'Product not found.' }, 404);
  const includeInStoreOnly = new URL(request.url).searchParams.get('associate') === '1'
    ? await isAssociateModeRequest(request, env)
    : false;
  const record = await dbGetShopProductDetail({ slug: trimmed }, env, { includeInStoreOnly });
  if (!record) return jsonResponse({ message: 'Product not found.' }, 404);
  return jsonResponse({ record });
}

export async function handleShopNewsletterSubscribe(request: Request, env: Env): Promise<Response> {
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
