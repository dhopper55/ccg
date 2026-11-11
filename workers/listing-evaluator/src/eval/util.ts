// Small helpers for the CCG Eval connector (no dependencies).

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(digest));
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

// Standard (not URL-safe) base64 of binary data, in chunks so large images don't overflow the
// argument list of String.fromCharCode.
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function safeJsonParse<T = unknown>(text: unknown): T | null {
  if (typeof text !== 'string' || !text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function asTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, maxLength);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function isoFromMs(ms: number | null | undefined): string | null {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// The admin's placeholder values for an unknown brand/model/year (see the listing evaluator page).
export function isKnownIdentityValue(value: unknown): boolean {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  return Boolean(text) && !/^unknown$/i.test(text) && !/NOT DEFINITIVE/i.test(text) && !/^estimated range/i.test(text);
}

// R2 keys from the image URL forms the admin stores:
//   /api/inventory-image?key=inventory-items/...   (inventory uploads)
//   /api/listing-image?key=listing-images/...       (listing photos copied to R2)
//   /api/listings/custom-image?key=custom-items/... (custom listing uploads)
//   /api/img/<key>                                  (public byte server)
const R2_KEY_PREFIXES = ['inventory-items/', 'listing-images/', 'custom-items/'];

export function extractR2Key(imageUrl: string): string | null {
  const text = imageUrl.trim();
  if (!text) return null;
  const queryMatch = text.match(/[?&]key=([^&\s#]+)/);
  if (queryMatch && /\/api\/(inventory-image|listing-image|listings\/custom-image)\b/.test(text)) {
    const key = safeDecode(queryMatch[1]);
    return key && R2_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) && !key.includes('..') ? key : null;
  }
  const pathMatch = text.match(/\/api\/img\/([^?#\s]+)/);
  if (pathMatch) {
    const key = safeDecode(pathMatch[1]);
    return key && R2_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) && !key.includes('..') ? key : null;
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
