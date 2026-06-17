import type { Env } from '../env.js';
import { jsonResponse, normalizeText } from '../utils/misc.js';
import { truncateText } from '../utils/text.js';
import { isAssociateModeRequest } from './associate.js';
import { SHOP_BASE_PATH } from '../constants.js';

type ShopAnalyticsEventInput = {
  eventType?: unknown;
  inventoryItemId?: unknown;
  sessionId?: unknown;
  pagePath?: unknown;
  referrer?: unknown;
  metadata?: unknown;
};

export const SHOP_ANALYTICS_EVENT_TYPES = new Set([
  'product_view',
  'search',
  'add_to_cart',
  'checkout_start',
  'value_report_initiate',
]);

export async function handleShopAnalyticsEvent(request: Request, env: Env): Promise<Response> {
  let body: ShopAnalyticsEventInput;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const eventType = normalizeText(body?.eventType, '').toLowerCase();
  if (!SHOP_ANALYTICS_EVENT_TYPES.has(eventType)) {
    return jsonResponse({ message: 'Unsupported analytics event.' }, 400);
  }

  if (await isAssociateModeRequest(request, env)) {
    return jsonResponse({ ok: true, skipped: true, reason: 'associate_mode' });
  }

  const userAgent = normalizeText(request.headers.get('user-agent'), '');
  const botUserAgent = getObviousBotUserAgent(userAgent);
  if (botUserAgent) {
    return jsonResponse({ ok: true, skipped: true, reason: 'bot_user_agent', botUserAgent });
  }

  const pagePath = normalizeAnalyticsPagePath(body?.pagePath);
  if (eventType === 'product_view' && !pagePath.startsWith(`${SHOP_BASE_PATH}/`)) {
    return jsonResponse({ message: 'Invalid product view path.' }, 400);
  }

  const inventoryItemId = toPositiveInteger(body?.inventoryItemId);
  if ((eventType === 'product_view' || eventType === 'add_to_cart') && inventoryItemId == null) {
    return jsonResponse({ message: 'Inventory item is required.' }, 400);
  }

  const sessionId = normalizeAnalyticsToken(body?.sessionId, 80);
  const referrer = truncateText(normalizeText(body?.referrer, ''), 500);
  const metadataJson = serializeAnalyticsMetadata(body?.metadata);
  const cf = (request as any).cf || {};
  const ipHash = await hashAnalyticsIp(normalizeText(request.headers.get('cf-connecting-ip'), ''), env);
  const isSuspicious = isSuspiciousAnalyticsRequest(request, pagePath);

  await env.DB.prepare(
    `INSERT INTO shop_analytics_events (
       event_type,
       inventory_item_id,
       session_id,
       page_path,
       referrer,
       user_agent,
       ip_hash,
       country,
       colo,
       is_suspicious,
       metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    eventType,
    inventoryItemId,
    sessionId,
    pagePath,
    referrer,
    truncateText(userAgent, 500),
    ipHash,
    truncateText(normalizeText(cf.country, ''), 8),
    truncateText(normalizeText(cf.colo, ''), 16),
    isSuspicious ? 1 : 0,
    metadataJson,
  ).run();

  return jsonResponse({ ok: true, skipped: false });
}

export async function dbDeleteShopAnalyticsEvent(
  recordId: string,
  env: Env,
): Promise<{ deletedCount: number } | null> {
  const id = normalizeText(recordId, '');
  if (!/^\d+$/.test(id)) return null;

  const db = env.DB.withSession('first-primary');
  const deleteResult = await db.prepare(
    `DELETE FROM shop_analytics_events
     WHERE CAST(id AS TEXT) = ?`
  ).bind(id).run();

  return {
    deletedCount: Number(deleteResult.meta.changes || 0),
  };
}

export function getObviousBotUserAgent(userAgent: string): string {
  const value = userAgent.toLowerCase();
  if (!value) return 'missing';
  const botPatterns = [
    'googlebot',
    'bingbot',
    'slurp',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'sogou',
    'exabot',
    'facebot',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'pinterestbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    'applebot',
    'ahrefsbot',
    'semrushbot',
    'mj12bot',
    'dotbot',
    'petalbot',
    'bytespider',
    'ccbot',
    'gptbot',
    'claudebot',
    'perplexitybot',
    'crawler',
    'spider',
    'bot/',
  ];
  return botPatterns.find((pattern) => value.includes(pattern)) || '';
}

export function normalizeAnalyticsPagePath(input: unknown): string {
  const value = truncateText(normalizeText(input, ''), 500);
  if (!value) return '';
  try {
    const parsed = value.startsWith('http') ? new URL(value) : null;
    if (parsed) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '';
  }
  return value.startsWith('/') ? value : '';
}

export function normalizeAnalyticsToken(input: unknown, maxLength: number): string {
  const value = truncateText(normalizeText(input, ''), maxLength);
  return /^[a-zA-Z0-9._:-]+$/.test(value) ? value : '';
}

export function toPositiveInteger(input: unknown): number | null {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export function serializeAnalyticsMetadata(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '';
  const sanitized = Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .slice(0, 25)
      .map(([key, value]) => [
        truncateText(normalizeText(key, ''), 80),
        typeof value === 'number' || typeof value === 'boolean'
          ? value
          : truncateText(normalizeText(value, ''), 500),
      ])
      .filter(([key]) => Boolean(key)),
  );
  const json = JSON.stringify(sanitized);
  return json.length > 4000 ? json.slice(0, 4000) : json;
}

export async function hashAnalyticsIp(ipAddress: string, env: Env): Promise<string> {
  const ip = normalizeText(ipAddress, '');
  const secret = normalizeText(env.AUTH_SECRET, '');
  if (!ip || !secret) return '';
  const encoded = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isSuspiciousAnalyticsRequest(request: Request, pagePath: string): boolean {
  const secFetchDest = normalizeText(request.headers.get('sec-fetch-dest'), '').toLowerCase();
  const secFetchMode = normalizeText(request.headers.get('sec-fetch-mode'), '').toLowerCase();
  const origin = normalizeText(request.headers.get('origin'), '');
  const referer = normalizeText(request.headers.get('referer'), '');
  if (!pagePath.startsWith(SHOP_BASE_PATH) && !pagePath.startsWith('/guitar-value-report-evaluation')) return true;
  if (secFetchDest && secFetchDest !== 'empty') return true;
  if (secFetchMode && !['cors', 'same-origin'].includes(secFetchMode)) return true;
  if (origin && !origin.includes('coalcreekguitars.com') && !origin.includes('ccg-2k1.pages.dev')) return true;
  if (referer && !referer.includes('coalcreekguitars.com') && !referer.includes('ccg-2k1.pages.dev')) return true;
  return false;
}

export async function dbListAdminV2ShopStatistics(input: {
  page: number;
  limit: number;
  q: string;
  eventType: string;
  sortDir: 'asc' | 'desc';
  env: Env;
}): Promise<{
  records: Array<{
    id: number;
    eventType: string;
    inventoryItemId: number | null;
    sessionId: string;
    pagePath: string;
    referrer: string;
    userAgent: string;
    country: string;
    colo: string;
    isSuspicious: boolean;
    metadataJson: string;
    createdAt: string;
    inventoryTitle: string;
    ccgNumber: string;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const where: string[] = [];
  const values: unknown[] = [];
  const db = input.env.DB.withSession('first-primary');

  if (input.eventType) {
    where.push(`e.event_type = ?`);
    values.push(input.eventType);
  }

  if (input.q) {
    const like = `%${input.q.toLowerCase()}%`;
    where.push(`(
      lower(COALESCE(e.event_type, '')) LIKE ?
      OR lower(COALESCE(e.page_path, '')) LIKE ?
      OR lower(COALESCE(e.referrer, '')) LIKE ?
      OR lower(COALESCE(e.user_agent, '')) LIKE ?
      OR lower(COALESCE(e.session_id, '')) LIKE ?
      OR lower(COALESCE(e.metadata_json, '')) LIKE ?
      OR lower(COALESCE(i.title, '')) LIKE ?
      OR lower(COALESCE(i.ccg_number, '')) LIKE ?
    )`);
    values.push(like, like, like, like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM shop_analytics_events e
     LEFT JOIN ccg_inventory_items i ON CAST(i.id AS TEXT) = CAST(e.inventory_item_id AS TEXT)
     ${whereSql}`
  ).bind(...values).first<{ total: number | null }>();

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / input.limit));
  const effectivePage = Math.min(Math.max(1, input.page), totalPages);
  const offset = (effectivePage - 1) * input.limit;
  const sortDirection = input.sortDir === 'asc' ? 'ASC' : 'DESC';

  const rows = await db.prepare(
    `SELECT
       e.id,
       e.event_type,
       e.inventory_item_id,
       e.session_id,
       e.page_path,
       e.referrer,
       e.user_agent,
       e.country,
       e.colo,
       e.is_suspicious,
       e.metadata_json,
       e.created_at,
       i.title AS inventory_title,
       i.ccg_number
     FROM shop_analytics_events e
     LEFT JOIN ccg_inventory_items i ON CAST(i.id AS TEXT) = CAST(e.inventory_item_id AS TEXT)
     ${whereSql}
     ORDER BY datetime(e.created_at) ${sortDirection}, e.id ${sortDirection}
     LIMIT ? OFFSET ?`
  ).bind(...values, input.limit, offset).all<{
    id: number | null;
    event_type: string | null;
    inventory_item_id: number | null;
    session_id: string | null;
    page_path: string | null;
    referrer: string | null;
    user_agent: string | null;
    country: string | null;
    colo: string | null;
    is_suspicious: number | null;
    metadata_json: string | null;
    created_at: string | null;
    inventory_title: string | null;
    ccg_number: string | null;
  }>();

  return {
    records: (rows.results ?? []).map((row) => ({
      id: Number(row.id || 0),
      eventType: normalizeText(row.event_type, ''),
      inventoryItemId: Number(row.inventory_item_id || 0) || null,
      sessionId: normalizeText(row.session_id, ''),
      pagePath: normalizeText(row.page_path, ''),
      referrer: normalizeText(row.referrer, ''),
      userAgent: normalizeText(row.user_agent, ''),
      country: normalizeText(row.country, ''),
      colo: normalizeText(row.colo, ''),
      isSuspicious: Number(row.is_suspicious || 0) === 1,
      metadataJson: normalizeText(row.metadata_json, ''),
      createdAt: normalizeText(row.created_at, ''),
      inventoryTitle: normalizeText(row.inventory_title, ''),
      ccgNumber: normalizeText(row.ccg_number, ''),
    })),
    page: effectivePage,
    limit: input.limit,
    total,
    totalPages,
  };
}
