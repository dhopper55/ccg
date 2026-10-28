import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { gxBaseUrl, gxRequest, isGxConfigured } from './api.js';

// GET /api/admin-v2/gx/probe — Phase 1 discovery for the GX integration. Calls GX read-only
// endpoints whose response shapes aren't documented and returns the raw responses, so the
// listing/order code can be written against what GX actually sends. GET requests only: it
// never creates, changes, or deletes anything on GX.
const GX_PROBES: Array<{ name: string; path: string; pii?: boolean }> = [
  { name: 'health', path: '/health' },
  { name: 'categories', path: '/categories' },
  { name: 'conditions', path: '/conditions' },
  { name: 'payout-options', path: '/payout-options' },
  { name: 'return-policies', path: '/return-policies' },
  { name: 'shipping-providers', path: '/shipping/providers' },
  { name: 'listings-total-count', path: '/listings/total-count' },
  { name: 'listings-page1', path: '/listings?page=1&resultsPerPage=5' },
  // Does GX filter listings by our productId? (Open question for GX support.)
  { name: 'listings-by-productId', path: '/listings?page=1&resultsPerPage=5&productId=ccg-probe-nonexistent' },
  { name: 'orders-page1', path: '/orders?page=1&resultsPerPage=5', pii: true },
  // Max resultsPerPage for orders isn't documented.
  { name: 'orders-big-page', path: '/orders?page=1&resultsPerPage=500', pii: true },
  // How multiple status values are encoded isn't documented — try each form.
  { name: 'orders-status-plain', path: '/orders?page=1&resultsPerPage=5&status=Delivered', pii: true },
  { name: 'orders-status-brackets', path: '/orders?page=1&resultsPerPage=5&status[]=Delivered&status[]=Payout%20Complete', pii: true },
  { name: 'orders-status-comma', path: '/orders?page=1&resultsPerPage=5&status=Delivered,Payout%20Complete', pii: true },
];

// GX API terms limit buyer personal data to order fulfillment, so it's blanked before returning.
const GX_PII_KEYS = new Set([
  'ship_to_address', 'buyer_first_name', 'buyer_last_name',
  'firstName', 'lastName', 'addressLineOne', 'addressLineTwo', 'postalCode',
]);

function redactGxPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactGxPii);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, GX_PII_KEYS.has(key) ? '[redacted]' : redactGxPii(entry)]),
    );
  }
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handleAdminV2GxProbe(_request: Request, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) {
    return jsonResponse({ message: 'GX_API_TOKEN is not configured. Run `npx wrangler secret put GX_API_TOKEN`.' }, 400);
  }

  const results = [];
  for (const [index, probe] of GX_PROBES.entries()) {
    // GX rate limits are unpublished; stay around 1 request/second.
    if (index > 0) await sleep(1000);
    const startedAt = Date.now();
    let entry: Record<string, unknown>;
    try {
      const result = await gxRequest(env, 'GET', probe.path);
      entry = {
        status: result.status,
        ok: result.ok,
        message: result.ok ? undefined : result.message,
        rateLimitHeaders: Object.fromEntries(
          Object.entries(result.headers).filter(([name]) => /rate|limit|retry/i.test(name)),
        ),
        headers: result.headers,
        body: probe.pii ? redactGxPii(result.data) : result.data,
      };
    } catch (error) {
      entry = { status: 0, ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    results.push({ name: probe.name, path: probe.path, durationMs: Date.now() - startedAt, ...entry });
    // A bad token or missing scope will fail every call the same way — stop early.
    if (entry.status === 401) break;
  }

  return jsonResponse({ baseUrl: gxBaseUrl(env), probedAt: new Date().toISOString(), results });
}

// POST /api/admin-v2/gx/raw  { method: 'GET' | 'PUT', path: '/listings/123', body?: {...} }
// Debugging aid for trying undocumented GX request shapes against a real listing (e.g. per-region
// shipping). Deliberately narrow: GET or PUT on /listings/... only — nothing that deletes,
// publishes, or touches orders. Returns GX's status and body as-is.
export async function handleAdminV2GxRaw(request: Request, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return jsonResponse({ message: 'GX_API_TOKEN is not configured.' }, 400);
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }
  const method = String(input.method || 'GET').toUpperCase();
  const path = String(input.path || '');
  if (method !== 'GET' && method !== 'PUT') return jsonResponse({ message: 'Only GET and PUT are allowed.' }, 400);
  if (!/^\/listings\/\d+(\/images)?$/.test(path)) return jsonResponse({ message: 'Path must be /listings/{id} or /listings/{id}/images.' }, 400);
  if (method === 'PUT' && (!input.body || typeof input.body !== 'object')) return jsonResponse({ message: 'PUT needs a body object.' }, 400);

  const result = await gxRequest(env, method, path, method === 'PUT' ? input.body as Record<string, unknown> : undefined);
  return jsonResponse({
    status: result.status,
    ok: result.ok,
    message: result.ok ? undefined : result.message,
    body: result.data,
  });
}
