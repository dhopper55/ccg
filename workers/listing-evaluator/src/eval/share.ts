// "Eval in CCG" share endpoint: an iOS Shortcut in the share sheet sends a marketplace listing
// URL here, the listing goes through the same intake as the evaluator's URL box, and it is put
// in the Claude queue. The owner never leaves the marketplace app; they say "eval" to Claude later.
//
//   POST /api/share/eval            Authorization: Bearer <SHARE_TOKEN>
//     body: JSON { "url": "...", "multi": false }, or any text that contains the URL
//     query: ?multi=1 marks it a multi-item listing
//
// Replies in plain text, because the Shortcut shows the reply as-is in its banner.
// The token is the SHARE_TOKEN secret (wrangler secret put SHARE_TOKEN), separate from the
// admin login, so the phone never holds the admin password.

import type { Env } from '../env.js';
import { submitListingUrls } from '../listings/submit.js';
import { dbEnqueue, dbQueuePosition } from './queue.js';

export const SHARE_EVAL_PATH = '/api/share/eval';

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;

function reply(message: string, status = 200): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

// Compares digests so the check takes the same time whatever the token's length.
async function tokenMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function truthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  return typeof value === 'string' && ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

// The share sheet can hand over a bare URL, a JSON body, or the title plus the URL as text.
async function readSharedUrl(request: Request, url: URL): Promise<{ url: string | null; multi: boolean }> {
  let multi = truthy(url.searchParams.get('multi'));
  const raw = await request.text().catch(() => '');
  let text = raw;
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body && typeof body === 'object') {
      text = [body.url, body.text].filter((part) => typeof part === 'string').join(' ');
      if (truthy(body.multi)) multi = true;
    }
  } catch {
    // Plain text body.
  }
  const queryUrl = url.searchParams.get('url');
  const match = (text.match(URL_PATTERN) || (queryUrl ? queryUrl.match(URL_PATTERN) : null));
  return { url: match ? match[0].replace(/[).,;]+$/, '') : null, multi };
}

export async function handleShareEval(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.SHARE_TOKEN) return reply('Sharing is not set up yet (SHARE_TOKEN secret is missing).', 503);
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await tokenMatches(token, env.SHARE_TOKEN))) {
    return reply('Not signed in: check the token in the Eval in CCG shortcut.', 401);
  }

  const { url, multi } = await readSharedUrl(request, new URL(request.url));
  if (!url) return reply('No link found in what was shared.', 400);

  const { queued, rejected } = await submitListingUrls([{ url, isMulti: multi }], env, ctx);
  const listing = queued[0];
  if (!listing?.recordId) {
    return reply(rejected[0]?.reason || 'Could not add that listing.', 422);
  }

  const { row, created } = await dbEnqueue(env, {
    kind: 'listing',
    recordId: String(listing.recordId),
    userId: env.AUTH_USER || 'owner',
    options: { build_listing: false, deep: false },
  });
  const position = await dbQueuePosition(env, row);
  const place = position > 0 ? ` (#${position} in line)` : '';
  if (!created) {
    return reply(row.status === 'in_progress' ? 'Claude is evaluating this one now.' : `Already queued for Claude${place}.`);
  }
  return reply(`${multi ? 'Multi-item listing' : 'Listing'} queued for Claude${place}.`);
}
