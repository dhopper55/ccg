// OAuth 2.1 authorization server for the CCG Eval connector, as Claude's custom connectors
// expect it: protected-resource and authorization-server metadata, dynamic client registration,
// an authorization-code flow with PKCE (S256), and refresh-token rotation. The "login" is a
// single owner password (MCP_OWNER_PASSWORD secret), separate from the admin password.
// Codes and tokens are stored only as SHA-256 hashes in D1.

import type { Env } from '../env.js';
import { dbCountRecentByTool, dbLogToolCall } from './db.js';
import { randomToken, safeJsonParse, sha256Base64Url, sha256Hex, timingSafeEqualString } from './util.js';

const ACCESS_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const CODE_TTL_MS = 10 * 60 * 1000;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 10;
const SCOPE = 'ccg-eval';

type ClientRow = {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string | null;
  redirect_uris_json: string;
  created_at: number;
};

export type AccessTokenInfo = { userId: string; clientId: string; tokenId: string };

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache', ...extra },
  });
}

function oauthError(error: string, description: string, status = 400): Response {
  return json({ error, error_description: description }, status);
}

export function resourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource`;
}

// ---------------------------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------------------------

export function handleProtectedResourceMetadata(origin: string): Response {
  return json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: [SCOPE],
    resource_name: 'CCG Eval',
  }, 200, { 'Cache-Control': 'public, max-age=3600' });
}

export function handleAuthorizationServerMetadata(origin: string): Response {
  return json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [SCOPE],
  }, 200, { 'Cache-Control': 'public, max-age=3600' });
}

// ---------------------------------------------------------------------------------------------
// Dynamic client registration (RFC 7591)
// ---------------------------------------------------------------------------------------------

function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    // Local tools such as the MCP Inspector.
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  if (await dbCountRecentByTool(env, 'oauth_register', 60 * 60 * 1000) >= 30) {
    return oauthError('invalid_request', 'Too many client registrations. Try again later.', 429);
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return oauthError('invalid_client_metadata', 'Body must be JSON.');
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirectUri)) {
    return oauthError('invalid_redirect_uri', 'redirect_uris must be 1-10 https URLs (or http://localhost).');
  }
  const requestedMethod = typeof body.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : 'none';
  const method = ['client_secret_post', 'client_secret_basic'].includes(requestedMethod) ? requestedMethod : 'none';
  const clientId = `ccg-${randomToken(16)}`;
  const clientSecret = method === 'none' ? null : randomToken(32);
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : null;
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO mcp_oauth_clients (client_id, client_secret_hash, client_name, redirect_uris_json, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(clientId, clientSecret ? await sha256Hex(clientSecret) : null, clientName, JSON.stringify(redirectUris), now).run();
  await dbLogToolCall(env, { tool: 'oauth_register', ok: true });

  return json({
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(now / 1000),
    client_name: clientName ?? undefined,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: method,
    scope: SCOPE,
  }, 201);
}

async function getClient(env: Env, clientId: string): Promise<ClientRow | null> {
  if (!clientId || clientId.length > 100) return null;
  return env.DB.prepare('SELECT * FROM mcp_oauth_clients WHERE client_id = ? LIMIT 1').bind(clientId).first<ClientRow>();
}

function clientRedirectUris(client: ClientRow): string[] {
  const uris = safeJsonParse<unknown[]>(client.redirect_uris_json);
  return Array.isArray(uris) ? uris.filter((uri): uri is string => typeof uri === 'string') : [];
}

// ---------------------------------------------------------------------------------------------
// Authorization endpoint: the owner-password page
// ---------------------------------------------------------------------------------------------

type AuthorizeParams = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
  resource: string;
};

const AUTHORIZE_KEYS: Array<keyof AuthorizeParams> = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'scope',
  'resource',
];

function readAuthorizeParams(source: URLSearchParams | FormData): AuthorizeParams {
  const params = {} as AuthorizeParams;
  for (const key of AUTHORIZE_KEYS) {
    const value = source.get(key);
    params[key] = typeof value === 'string' ? value.slice(0, 2000) : '';
  }
  return params;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPage(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CCG Eval</title>
<style>
:root{color-scheme:light dark;--bg:#f6f5f2;--card:#fff;--ink:#1d1d1b;--muted:#6b6a66;--line:#d9d7d0;--accent:#8a3b12;--danger:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--card:#21201d;--ink:#f1efe9;--muted:#a3a19a;--line:#3a3934;--accent:#e08a5a;--danger:#f97066}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px}
main{width:100%;max-width:380px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:24px}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 16px;color:var(--muted)}label{display:block;font-weight:600;margin-bottom:6px}
input[type=password]{width:100%;font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink)}
button{margin-top:16px;width:100%;font-size:16px;font-weight:600;padding:12px;border:0;border-radius:8px;background:var(--accent);color:#fff}
.error{color:var(--danger);font-weight:600}
</style></head><body><main>${body}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}

function redirectWithError(redirectUri: string, state: string, error: string, description: string): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return Response.redirect(url.toString(), 302);
}

// Validate the client and redirect URI first: if either is wrong, show an error page and never
// redirect (the redirect target can't be trusted). Other problems go back to the client.
async function validateAuthorize(
  env: Env,
  params: AuthorizeParams,
): Promise<{ ok: true; client: ClientRow } | { ok: false; response: Response }> {
  const client = await getClient(env, params.client_id);
  if (!client) {
    return { ok: false, response: htmlPage('<h1>Unknown app</h1><p>This sign-in link is not valid. Remove the connector in Claude and add it again.</p>', 400) };
  }
  if (!clientRedirectUris(client).includes(params.redirect_uri)) {
    return { ok: false, response: htmlPage('<h1>Invalid redirect</h1><p>This sign-in link is not valid. Remove the connector in Claude and add it again.</p>', 400) };
  }
  if (params.response_type !== 'code') {
    return { ok: false, response: redirectWithError(params.redirect_uri, params.state, 'unsupported_response_type', 'Only response_type=code is supported.') };
  }
  if (!params.code_challenge || params.code_challenge_method !== 'S256') {
    return { ok: false, response: redirectWithError(params.redirect_uri, params.state, 'invalid_request', 'PKCE with S256 is required.') };
  }
  return { ok: true, client };
}

function authorizeForm(params: AuthorizeParams, client: ClientRow, error = ''): Response {
  const hidden = AUTHORIZE_KEYS.map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(params[key])}">`).join('');
  const appName = escapeHtml(client.client_name || 'Claude');
  return htmlPage(
    `<h1>Connect CCG Eval</h1>
<p>${appName} wants to read listing evaluator results and inventory items, save listing evaluations, and send inventory evaluations to the item form.</p>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/authorize">${hidden}
<label for="password">Connector password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Allow</button>
</form>`,
    error ? 401 : 200,
  );
}

export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const ownerPassword = env.MCP_OWNER_PASSWORD || '';
  if (ownerPassword.length < 12) {
    return htmlPage('<h1>Not set up</h1><p>The connector password is not configured. Set the MCP_OWNER_PASSWORD secret (at least 12 characters) and try again.</p>', 503);
  }

  if (request.method === 'GET') {
    const params = readAuthorizeParams(new URL(request.url).searchParams);
    const checked = await validateAuthorize(env, params);
    if (!checked.ok) return checked.response;
    return authorizeForm(params, checked.client);
  }

  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return htmlPage('<h1>Invalid request</h1>', 400);
  }
  const params = readAuthorizeParams(form);
  const checked = await validateAuthorize(env, params);
  if (!checked.ok) return checked.response;

  if (await dbCountRecentByTool(env, 'oauth_login_failed', LOGIN_FAILURE_WINDOW_MS) >= LOGIN_FAILURE_LIMIT) {
    return authorizeForm(params, checked.client, 'Too many wrong passwords. Wait 15 minutes and try again.');
  }
  const password = typeof form.get('password') === 'string' ? String(form.get('password')) : '';
  if (!timingSafeEqualString(password, ownerPassword)) {
    await dbLogToolCall(env, { tool: 'oauth_login_failed', ok: false });
    return authorizeForm(params, checked.client, 'Wrong password.');
  }

  const code = randomToken(32);
  await env.DB.prepare(
    `INSERT INTO mcp_oauth_codes (code_hash, client_id, redirect_uri, code_challenge, user_id, scope, resource, expires_at, used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).bind(
    await sha256Hex(code),
    params.client_id,
    params.redirect_uri,
    params.code_challenge,
    env.AUTH_USER || 'owner',
    SCOPE,
    params.resource || null,
    Date.now() + CODE_TTL_MS,
  ).run();
  await dbLogToolCall(env, { tool: 'oauth_login', ok: true, userId: env.AUTH_USER || 'owner' });

  const redirect = new URL(params.redirect_uri);
  redirect.searchParams.set('code', code);
  if (params.state) redirect.searchParams.set('state', params.state);
  return Response.redirect(redirect.toString(), 302);
}

// ---------------------------------------------------------------------------------------------
// Token endpoint
// ---------------------------------------------------------------------------------------------

async function readTokenRequest(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';
  const out: Record<string, string> = {};
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) if (typeof value === 'string') out[key] = value;
    return out;
  }
  const text = await request.text();
  for (const [key, value] of new URLSearchParams(text)) out[key] = value;
  return out;
}

function readBasicAuth(request: Request): { clientId: string; clientSecret: string } | null {
  const header = request.headers.get('authorization') || '';
  if (!/^basic\s+/i.test(header)) return null;
  try {
    const decoded = atob(header.replace(/^basic\s+/i, ''));
    const index = decoded.indexOf(':');
    if (index < 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, index)),
      clientSecret: decodeURIComponent(decoded.slice(index + 1)),
    };
  } catch {
    return null;
  }
}

async function issueTokens(env: Env, clientId: string, userId: string, familyId: string): Promise<Response> {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  const now = Date.now();
  const insert = `INSERT INTO mcp_oauth_tokens (token_hash, token_type, client_id, user_id, scope, family_id, expires_at, revoked, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`;
  await env.DB.batch([
    env.DB.prepare(insert).bind(await sha256Hex(accessToken), 'access', clientId, userId, SCOPE, familyId, now + ACCESS_TOKEN_TTL_MS, now),
    env.DB.prepare(insert).bind(await sha256Hex(refreshToken), 'refresh', clientId, userId, SCOPE, familyId, now + REFRESH_TOKEN_TTL_MS, now),
  ]);
  return json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: SCOPE,
  });
}

export async function handleToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return oauthError('invalid_request', 'Use POST.', 405);
  const body = await readTokenRequest(request);
  const basic = readBasicAuth(request);
  const clientId = basic?.clientId || body.client_id || '';
  const clientSecret = basic?.clientSecret || body.client_secret || '';

  const client = await getClient(env, clientId);
  if (!client) return oauthError('invalid_client', 'Unknown client.', 401);
  if (client.client_secret_hash) {
    if (!clientSecret || !timingSafeEqualString(await sha256Hex(clientSecret), client.client_secret_hash)) {
      return oauthError('invalid_client', 'Client authentication failed.', 401);
    }
  }

  if (body.grant_type === 'authorization_code') {
    const code = body.code || '';
    const verifier = body.code_verifier || '';
    if (!code || !verifier) return oauthError('invalid_request', 'code and code_verifier are required.');
    const codeHash = await sha256Hex(code);
    const row = await env.DB.prepare('SELECT * FROM mcp_oauth_codes WHERE code_hash = ? LIMIT 1')
      .bind(codeHash)
      .first<{ client_id: string; redirect_uri: string; code_challenge: string; user_id: string; expires_at: number; used: number }>();
    if (!row || row.client_id !== client.client_id) return oauthError('invalid_grant', 'Invalid authorization code.');
    if (row.expires_at < Date.now()) return oauthError('invalid_grant', 'Authorization code expired.');
    if (body.redirect_uri && body.redirect_uri !== row.redirect_uri) return oauthError('invalid_grant', 'redirect_uri does not match.');
    if ((await sha256Base64Url(verifier)) !== row.code_challenge) return oauthError('invalid_grant', 'PKCE verification failed.');
    // Single use, race-safe.
    const claimed = await env.DB.prepare('UPDATE mcp_oauth_codes SET used = 1 WHERE code_hash = ? AND used = 0').bind(codeHash).run();
    if (Number(claimed.meta?.changes || 0) !== 1) return oauthError('invalid_grant', 'Authorization code already used.');
    return issueTokens(env, client.client_id, row.user_id, crypto.randomUUID());
  }

  if (body.grant_type === 'refresh_token') {
    const refreshToken = body.refresh_token || '';
    if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required.');
    const tokenHash = await sha256Hex(refreshToken);
    const row = await env.DB.prepare("SELECT * FROM mcp_oauth_tokens WHERE token_hash = ? AND token_type = 'refresh' LIMIT 1")
      .bind(tokenHash)
      .first<{ client_id: string; user_id: string; family_id: string; expires_at: number; revoked: number }>();
    if (!row || row.client_id !== client.client_id) return oauthError('invalid_grant', 'Invalid refresh token.');
    if (row.revoked) {
      // A rotated refresh token was used again: assume it leaked and end the whole sign-in.
      await env.DB.prepare('UPDATE mcp_oauth_tokens SET revoked = 1 WHERE family_id = ?').bind(row.family_id).run();
      return oauthError('invalid_grant', 'Refresh token was already used. Sign in again.');
    }
    if (row.expires_at < Date.now()) return oauthError('invalid_grant', 'Refresh token expired. Sign in again.');
    const rotated = await env.DB.prepare('UPDATE mcp_oauth_tokens SET revoked = 1 WHERE token_hash = ? AND revoked = 0').bind(tokenHash).run();
    if (Number(rotated.meta?.changes || 0) !== 1) return oauthError('invalid_grant', 'Refresh token was already used.');
    return issueTokens(env, client.client_id, row.user_id, row.family_id);
  }

  return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

// ---------------------------------------------------------------------------------------------
// Bearer token check for /mcp
// ---------------------------------------------------------------------------------------------

export async function verifyAccessToken(request: Request, env: Env): Promise<AccessTokenInfo | null> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^bearer\s+([A-Za-z0-9_-]{20,200})$/i);
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(
    "SELECT client_id, user_id, expires_at, revoked FROM mcp_oauth_tokens WHERE token_hash = ? AND token_type = 'access' LIMIT 1"
  ).bind(tokenHash).first<{ client_id: string; user_id: string; expires_at: number; revoked: number }>();
  if (!row || row.revoked || row.expires_at < Date.now()) return null;
  return { userId: row.user_id, clientId: row.client_id, tokenId: tokenHash.slice(0, 16) };
}
