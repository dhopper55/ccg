import type { Env } from '../env.js';
import { signAuth, buildAuthCookie, clearAuthCookie, parseCookie, AUTH_COOKIE_NAME, verifyAuth } from '../auth.js';
import { jsonResponse } from '../utils/misc.js';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
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

export async function handleSession(request: Request, env: Env): Promise<Response> {
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

export async function handleLogout(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': clearAuthCookie(),
    },
  });
}
