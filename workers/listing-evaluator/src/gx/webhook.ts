import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';
import { dbRecordOrderEvent } from '../orders/db.js';
import { dbFindGxOrder } from '../orders/manual.js';
import { gxErrorStatus, isGxConfigured, listGxOrdersUpdatedSince, setGxWebhookConfig } from './api.js';
import {
  dbDeleteGxLink,
  dbFinishGxWebhookEvent,
  dbGetGxLinkByListingId,
  dbInsertGxWebhookEvent,
  dbListGxLinks,
  dbListGxWebhookEvents,
  dbUpdateGxLink,
} from './db.js';
import { processGxSale, type GxSaleResult } from './sales.js';

// POST /api/gx/webhook — public route; GX authenticates with the bearer token we registered
// (GX_WEBHOOK_TOKEN). Envelope: { listingId, productId, eventType, data: { status, ... } }.
// GX retries a non-2xx 8 times over ~47 minutes, so only failures worth retrying get a 500;
// every event is logged in gx_webhook_events with what was done about it.

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

function optionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const GX_REVERSED_ORDER_STATUSES = new Set(['Canceled', 'Refund Completed']);

async function handleOrderStatusChange(
  gxOrderId: number,
  status: string,
  data: Record<string, unknown>,
  env: Env,
): Promise<GxSaleResult> {
  const ccgOrder = await dbFindGxOrder(gxOrderId, env);
  if (!ccgOrder) {
    // No CCG order yet: a missed Sold event. Record the sale now (unless it was reversed).
    if (GX_REVERSED_ORDER_STATUSES.has(status)) {
      return { result: 'ignored', message: `GX order ${gxOrderId} is ${status} and was never recorded in CCG.` };
    }
    return processGxSale(env, { gxOrderId });
  }
  const needsPerson = status === 'Canceled' || status === 'Refund Completed' || status === 'Problem Reported'
    || status.startsWith('Return');
  await dbRecordOrderEvent(ccgOrder.id, {
    eventType: 'gx_order_status',
    fromStatus: null,
    toStatus: 'paid',
    source: 'gx_webhook',
    sourceId: String(gxOrderId),
    message: `Gear Exchange order status: ${status}.${needsPerson ? ' Needs review (restock / refund / payout) in CCG.' : ''}`,
    payloadJson: JSON.stringify(data),
  }, env);
  return { result: 'processed', message: `Recorded "${status}" on CCG order ${ccgOrder.order_number}.`, orderNumber: ccgOrder.order_number };
}

async function dispatchGxEvent(
  eventType: string,
  status: string,
  gxListingId: number | null,
  gxOrderId: number | null,
  data: Record<string, unknown>,
  env: Env,
): Promise<GxSaleResult> {
  if (eventType === 'ListingStatusChange') {
    const link = gxListingId ? await dbGetGxLinkByListingId(gxListingId, env) : null;
    switch (status) {
      case 'Sold':
        if (!gxOrderId) return { result: 'failed', message: 'Sold event has no orderId.' };
        return processGxSale(env, { gxOrderId });
      case 'Published':
        if (!link) return { result: 'ignored', message: `GX listing ${gxListingId} isn't linked to a CCG item.` };
        await dbUpdateGxLink(link.inventory_item_id, { gxStatus: 'published', imagesPending: false, lastError: null }, env);
        return { result: 'processed', message: `Item ${link.inventory_item_id} is live on GX.` };
      case 'Deleted':
        if (!link) return { result: 'ignored', message: `GX listing ${gxListingId} wasn't linked (already removed).` };
        await dbDeleteGxLink(link.inventory_item_id, env);
        return { result: 'processed', message: `GX deleted listing ${gxListingId}; unlinked item ${link.inventory_item_id}.` };
      case 'Category Updated': {
        if (!link) return { result: 'ignored', message: `GX listing ${gxListingId} isn't linked to a CCG item.` };
        const categoryId = optionalNumber(data.categoryId);
        await dbUpdateGxLink(link.inventory_item_id, { gxCategoryId: categoryId }, env);
        return { result: 'processed', message: `GX moved item ${link.inventory_item_id} to category ${categoryId}.` };
      }
      default:
        return { result: 'ignored', message: `Unhandled listing status "${status}".` };
    }
  }
  if (eventType === 'OrderStatusChange') {
    if (!gxOrderId) return { result: 'failed', message: 'Order event has no orderId.' };
    return handleOrderStatusChange(gxOrderId, status, data, env);
  }
  return { result: 'ignored', message: `Unhandled event type "${eventType}".` };
}

export async function handleGxWebhook(request: Request, env: Env): Promise<Response> {
  const expected = normalizeText(env.GX_WEBHOOK_TOKEN, '');
  if (!expected) return jsonResponse({ message: 'Webhook not configured.' }, 503);
  const authorization = request.headers.get('authorization') || '';
  const presented = authorization.replace(/^Bearer\s+/i, '');
  if (!presented || !timingSafeEqual(presented, expected)) return jsonResponse({ message: 'Unauthorized.' }, 401);

  const raw = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }
  const data = (payload.data && typeof payload.data === 'object' ? payload.data : {}) as Record<string, unknown>;
  const eventType = normalizeText(payload.eventType, '');
  const status = normalizeText(data.status, '');
  const gxListingId = optionalNumber(payload.listingId);
  const gxOrderId = optionalNumber(data.orderId);

  const eventId = await dbInsertGxWebhookEvent({
    eventType,
    status,
    gxListingId,
    gxOrderId,
    productId: normalizeText(payload.productId, '') || null,
    payloadJson: raw.slice(0, 20000),
  }, env);

  const outcome = await dispatchGxEvent(eventType, status, gxListingId, gxOrderId, data, env);
  await dbFinishGxWebhookEvent(eventId, outcome.result, outcome.message, env);
  if (outcome.result === 'failed') {
    console.error(JSON.stringify({ tag: 'ccg-gx', event: 'gx.webhook_failed', eventType, status, gxListingId, gxOrderId, message: outcome.message }));
  }
  if (outcome.result === 'failed' && outcome.retryable) return jsonResponse({ message: outcome.message }, 500);
  return jsonResponse({ ok: true, result: outcome.result });
}

// ---- Admin endpoints -------------------------------------------------------------------

// POST /api/admin-v2/gx/webhook-config — registers this Worker's webhook URL and token with GX
// (needs a token with the write_user scope).
export async function handleAdminV2GxWebhookConfig(_request: Request, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return jsonResponse({ message: 'Gear Exchange is not configured (GX_API_TOKEN).' }, 503);
  const token = normalizeText(env.GX_WEBHOOK_TOKEN, '');
  if (!token) return jsonResponse({ message: 'Set GX_WEBHOOK_TOKEN first (npx wrangler secret put GX_WEBHOOK_TOKEN).' }, 400);
  const siteBaseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const url = `${siteBaseUrl}/api/gx/webhook`;
  const result = await setGxWebhookConfig(env, url, token);
  if (!result.ok) return jsonResponse({ message: `GX rejected the webhook config: ${result.message}`, response: result.data }, gxErrorStatus(result));
  // The response shape isn't documented — returned as-is.
  return jsonResponse({ ok: true, url, response: result.data });
}

// GET /api/admin-v2/gx/webhook-events?limit=50 — the most recent webhooks and their outcome.
export async function handleAdminV2GxWebhookEvents(request: Request, env: Env): Promise<Response> {
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 50));
  const events = await dbListGxWebhookEvents(limit, env);
  return jsonResponse({ events });
}

// POST /api/admin-v2/gx/sync-sold  { dryRun?: boolean, days?: number }
// Safety net for missed webhooks (like the Reverb sold sync): looks at GX orders updated in the
// last `days` (default 30) and records any sale of a CCG-linked listing not already in CCG.
export async function handleAdminV2GxSyncSold(request: Request, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return jsonResponse({ message: 'Gear Exchange is not configured (GX_API_TOKEN).' }, 503);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dryRun = body.dryRun !== false;
  const days = Math.min(365, Math.max(1, Number(body.days) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

  const ordersResult = await listGxOrdersUpdatedSince(env, since);
  if (!ordersResult.ok) {
    return jsonResponse({ message: `Unable to fetch Gear Exchange orders: ${ordersResult.message}` }, gxErrorStatus(ordersResult));
  }
  const linksByListingId = new Map((await dbListGxLinks(env)).map((link) => [link.gx_listing_id, link]));

  const results: Array<Record<string, unknown>> = [];
  for (const order of ordersResult.orders) {
    const base = { gxOrderId: order.orderId, gxListingId: order.listingId, gxStatus: order.status, soldPrice: order.soldPrice };
    if (GX_REVERSED_ORDER_STATUSES.has(order.status)) continue;
    const existing = await dbFindGxOrder(order.orderId, env);
    if (existing) continue;
    const link = linksByListingId.get(order.listingId);
    if (!link && !/^\d+$/.test(normalizeText(order.productId, ''))) {
      results.push({ ...base, action: 'skipped', message: 'Not a CCG-linked listing.' });
      continue;
    }
    if (dryRun) {
      results.push({ ...base, action: 'would_record', inventoryItemId: link?.inventory_item_id ?? order.productId });
      continue;
    }
    const outcome = await processGxSale(env, { gxOrderId: order.orderId, order });
    results.push({ ...base, action: outcome.result, message: outcome.message, inventoryItemId: outcome.inventoryItemId ?? null, orderNumber: outcome.orderNumber ?? null });
  }

  return jsonResponse({ ok: true, dryRun, since, ordersFetched: ordersResult.orders.length, results });
}
