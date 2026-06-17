import type { Env } from '../env.js';
import { jsonResponse, normalizeText } from '../utils/misc.js';
import { parseCookie, signAuth, verifyAuth } from '../auth.js';

const ASSOCIATE_COOKIE_NAME = 'ccg_associate';
const ASSOCIATE_COOKIE_VALUE = 'associate';

export async function handleShopAssociateModeStatus(request: Request, env: Env): Promise<Response> {
  const associateMode = await isAssociateModeRequest(request, env);
  return jsonResponse({ associateMode });
}

export async function handleShopAssociateModeEnable(request: Request, env: Env): Promise<Response> {
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

export function handleShopAssociateModeDisable(): Response {
  return jsonResponse(
    { associateMode: false },
    200,
    {
      'Set-Cookie': clearAssociateModeCookie(),
    },
  );
}

export function isValidAssociateToken(token: string, env: Env): boolean {
  const expected = normalizeText(env.ASSOCIATE_MODE_TOKEN, '');
  return Boolean(expected && token === expected);
}

export async function isAssociateModeRequest(request: Request, env: Env): Promise<boolean> {
  const secret = normalizeText(env.AUTH_SECRET, '');
  if (!secret) return false;

  const cookies = parseCookie(request.headers.get('Cookie'));
  const rawCookie = cookies.get(ASSOCIATE_COOKIE_NAME) || '';
  const [value, signature] = rawCookie.split('.');
  if (value !== ASSOCIATE_COOKIE_VALUE || !signature) return false;

  return verifyAuth(value, secret, signature);
}

export async function buildAssociateModeCookie(env: Env): Promise<string> {
  const signature = await signAuth(ASSOCIATE_COOKIE_VALUE, env.AUTH_SECRET);
  const maxAge = 60 * 60 * 24 * 90;
  return `${ASSOCIATE_COOKIE_NAME}=${ASSOCIATE_COOKIE_VALUE}.${signature}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearAssociateModeCookie(): string {
  return `${ASSOCIATE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
