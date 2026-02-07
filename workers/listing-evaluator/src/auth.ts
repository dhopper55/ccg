export const AUTH_COOKIE_NAME = 'auth';

export async function signAuth(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyAuth(value: string, secret: string, signature: string) {
  const expected = await signAuth(value, secret);
  return timingSafeEqual(expected, signature);
}

export function parseCookie(cookieHeader: string | null) {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        if (eq === -1) return [part, ''];
        return [part.slice(0, eq), part.slice(eq + 1)];
      })
  );
}

export function buildAuthCookie(value: string) {
  const maxAge = 60 * 60 * 24 * 90;
  return `${AUTH_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
