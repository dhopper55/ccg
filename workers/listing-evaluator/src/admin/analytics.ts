import type { Env } from '../env.js';
import { jsonResponse, parseBoundedInt } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { dbDeleteShopAnalyticsEvent, dbListAdminV2ShopStatistics, SHOP_ANALYTICS_EVENT_TYPES } from '../shop/analytics.js';
import { dbListAdminV2ActivityLog } from './activity.js';

export async function handleAdminV2ActivityLog(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 8, 1, 25);
  const data = await dbListAdminV2ActivityLog(page, limit, env);
  return jsonResponse(data);
}

export async function handleAdminV2ShopStatistics(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const q = normalizeText(url.searchParams.get('q'), '').slice(0, 200);
  const eventType = normalizeText(url.searchParams.get('eventType'), '').toLowerCase();
  const sortDir = normalizeText(url.searchParams.get('sortDir'), '').toLowerCase() === 'asc' ? 'asc' : 'desc';

  const data = await dbListAdminV2ShopStatistics({
    page,
    limit,
    q,
    eventType: SHOP_ANALYTICS_EVENT_TYPES.has(eventType) ? eventType : '',
    sortDir,
    env,
  });
  return jsonResponse(data);
}

export async function handleAdminV2ShopStatisticDelete(path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const deleteIndex = parts.indexOf('delete');
  const recordId = deleteIndex > 0 ? parts[deleteIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing shop statistic event ID.' }, 400);

  const deleteResult = await dbDeleteShopAnalyticsEvent(recordId, env);
  if (!deleteResult) return jsonResponse({ message: 'Unable to delete shop statistic event.' }, 500);
  if (deleteResult.deletedCount < 1) {
    return jsonResponse({ message: 'Shop statistic event not found.' }, 404);
  }

  return jsonResponse({
    ok: true,
    deletedCount: deleteResult.deletedCount,
  });
}

