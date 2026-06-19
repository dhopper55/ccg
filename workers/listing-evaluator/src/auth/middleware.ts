import type { Env } from '../env.js';
import { SUPPORTED_ORIGINS } from '../constants.js';
import { verifyAuth, parseCookie, AUTH_COOKIE_NAME } from '../auth.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';

export function withCors(response: Response, request: Request, env: Env): Response {
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

export async function requireAuth(request: Request, env: Env, path: string): Promise<Response | null> {
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

export function isPublicSiteScopedEndpoint(request: Request, path: string): boolean {
  const method = request.method.toUpperCase();
  return (
    (path === '/api/decode' && method === 'POST')
    || (path === '/api/decode/email' && method === 'POST')
    || (path === '/api/serial-decodes' && method === 'POST')
  );
}

export function isRequestFromAllowedSitePage(request: Request, env: Env): boolean {
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

export function getAllowedSiteOrigin(env: Env): string {
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

export function isRefererFromOrigin(referer: string, expectedOrigin: string): boolean {
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function isPublicApiPath(path: string): boolean {
  return path.startsWith('/api/shop/')
    || path === '/api/youtube/videos'
    || path === '/api/inventory-image'
    || path === '/api/listing-image'
    || path === '/api/guitar-evaluation'
    || path === '/api/guitar-evaluation/payment-intent'
    || path === '/api/guitar-evaluation/confirm-payment'
    || path === '/api/guitar-evaluation/validate-coupon'
    || /^\/api\/guitar-evaluation\/\d+\/upload-images$/.test(path)
    || /^\/api\/guitar-evaluation\/\d+$/.test(path)
    || path === '/api/guitar-evaluation-image'
    || path === '/api/admin-v2/value-report-files'
    || /^\/api\/guitar-eval-report\/[0-9a-f-]+$/i.test(path);
}
