import { normalizeText, normalizeUrl } from './text.js';

export const INVENTORY_MAX_IMAGES = 20;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const ACTIVITY_BASE_URL = 'https://www.coalcreekguitars.com';

export type InventoryImageInput = {
  url: string;
  isPrivate: boolean;
};

type CloudflareImagePreset = 'thumb' | 'card' | 'detail';

const CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS: Record<CloudflareImagePreset, string> = {
  thumb: 'fit=scale-down,width=180,quality=80,format=auto,onerror=redirect',
  card: 'fit=scale-down,width=640,quality=82,format=auto,onerror=redirect',
  detail: 'fit=scale-down,width=1400,quality=85,format=auto,onerror=redirect',
};

export function detectContentTypeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
  // HEIC/HEIF: bytes 4-7 = "ftyp", then brand "heic","heix","hevc","mif1" etc.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(brand)) return 'image/heic';
  }
  return null;
}

export function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  if (normalized.includes('heic') || normalized.includes('heif')) return 'heic';
  if (normalized.includes('avif')) return 'avif';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('tiff') || normalized.includes('tif')) return 'tiff';
  return 'jpg'; // default to jpg instead of bin for image content
}

export function extensionFromFileName(fileName: string): string {
  const match = normalizeText(fileName, '').toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : '';
}

export function normalizeMfrOrderFileName(fileName: string): string {
  const normalized = normalizeText(fileName, 'mfr-order-file')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || 'mfr-order-file').slice(0, 180);
}

export function escapeHeaderFileName(fileName: string): string {
  return normalizeMfrOrderFileName(fileName).replace(/["\r\n]/g, '');
}

export function buildCustomImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listings/custom-image?${params.toString()}`;
}

export function buildListingImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listing-image?${params.toString()}`;
}

export function buildInventoryImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/inventory-image?${params.toString()}`;
}

export function normalizeInventoryImageUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (!raw.startsWith('/api/') && !/^https?:\/\//i.test(raw) && !raw.startsWith('/cdn-cgi/image/')) {
    if (raw.startsWith('listing-images/')) return buildListingImageUrl(raw);
    if (raw.startsWith('custom-items/')) return buildCustomImageUrl(raw);
    return buildInventoryImageUrl(raw);
  }
  return raw;
}

export function toCloudflareImageTransformUrl(
  imageUrl: string,
  preset: CloudflareImagePreset,
  options: { absolute?: boolean } = {},
): string {
  const normalized = imageUrl.trim();
  if (!normalized || normalized.startsWith('/cdn-cgi/image/')) return normalized;

  const transformOptions = CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS[preset];
  const baseUrl = options.absolute ? ACTIVITY_BASE_URL : '';

  if (normalized.startsWith('/api/')) {
    return `${baseUrl}/cdn-cgi/image/${transformOptions}${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    const siteOrigin = new URL(ACTIVITY_BASE_URL).origin;
    if (parsed.origin !== siteOrigin) return normalized;
    return `${parsed.origin}/cdn-cgi/image/${transformOptions}${parsed.pathname}${parsed.search}`;
  } catch {
    return normalized;
  }
}

export function toAdminImageUrl(value: unknown, preset?: CloudflareImagePreset): string {
  const imageUrl = normalizeInventoryImageUrl(value);
  if (!imageUrl || !preset) return imageUrl;
  return toCloudflareImageTransformUrl(imageUrl, preset);
}

export function toPublicShopImageUrl(value: unknown, preset?: CloudflareImagePreset): string {
  let imageUrl = normalizeInventoryImageUrl(value);
  if (imageUrl && preset) {
    imageUrl = toCloudflareImageTransformUrl(imageUrl, preset, { absolute: true });
  }
  if (imageUrl.startsWith('/api/')) {
    imageUrl = `${ACTIVITY_BASE_URL}${imageUrl}`;
  } else if (imageUrl.startsWith('/cdn-cgi/image/')) {
    imageUrl = `${ACTIVITY_BASE_URL}${imageUrl}`;
  }
  return imageUrl;
}

export function photoListFromRecord(fields: Record<string, unknown>): string[] {
  const photos = typeof fields.photos === 'string'
    ? fields.photos.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const imageUrl = typeof fields.image_url === 'string' ? fields.image_url.trim() : '';
  if (imageUrl) photos.push(imageUrl);
  return Array.from(new Set(photos));
}

export function normalizeInventoryOrExternalImageUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isInventoryImageUrl(trimmed)) return trimmed;
  return normalizeUrl(trimmed);
}

export function isInventoryImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/inventory-image?')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/api/inventory-image') return false;
    const key = parsed.searchParams.get('key') || '';
    return key.startsWith('inventory-items/');
  } catch {
    return false;
  }
}

export function extractInventoryImageKey(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = url.startsWith('/api/inventory-image?')
      ? new URL(url, 'https://www.coalcreekguitars.com')
      : new URL(url);
    if (parsed.pathname !== '/api/inventory-image') return null;
    const key = (parsed.searchParams.get('key') || '').trim();
    if (!key.startsWith('inventory-items/')) return null;
    return key;
  } catch {
    return null;
  }
}

export function parseStoredInventoryImageUrls(imageUrlsRaw: string | null, fallbackPrimary: string | null): string[] {
  const urls = typeof imageUrlsRaw === 'string'
    ? imageUrlsRaw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
    : [];
  if ((!urls || urls.length === 0) && fallbackPrimary) {
    urls.push(String(fallbackPrimary).trim());
  }
  return Array.from(new Set(urls.filter((url) => isInventoryImageUrl(url)))).slice(0, INVENTORY_MAX_IMAGES);
}

export function normalizeInventoryImageUrls(primaryImageUrl: string, rawInput: unknown): string[] {
  const fromInput: string[] = [];
  if (Array.isArray(rawInput)) {
    rawInput.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
    });
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
          });
        } else {
          trimmed.split(/\r?\n/).forEach((entry) => {
            if (entry.trim()) fromInput.push(entry.trim());
          });
        }
      } catch {
        trimmed.split(/\r?\n/).forEach((entry) => {
          if (entry.trim()) fromInput.push(entry.trim());
        });
      }
    }
  }

  const seed = primaryImageUrl ? [primaryImageUrl.trim(), ...fromInput] : [...fromInput];
  return Array.from(new Set(seed.filter((url) => isInventoryImageUrl(url)))).slice(0, INVENTORY_MAX_IMAGES);
}

export function normalizeInventoryImageCandidates(primaryImageUrl: string, rawInput: unknown): string[] {
  const fromInput: string[] = [];
  if (Array.isArray(rawInput)) {
    rawInput.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
    });
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (typeof entry === 'string' && entry.trim()) fromInput.push(entry.trim());
          });
        } else {
          trimmed.split(/\r?\n/).forEach((entry) => {
            if (entry.trim()) fromInput.push(entry.trim());
          });
        }
      } catch {
        trimmed.split(/\r?\n/).forEach((entry) => {
          if (entry.trim()) fromInput.push(entry.trim());
        });
      }
    }
  }

  const seed = primaryImageUrl ? [primaryImageUrl.trim(), ...fromInput] : [...fromInput];
  return Array.from(
    new Set(
      seed
        .map((url) => normalizeInventoryOrExternalImageUrl(url))
        .filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, INVENTORY_MAX_IMAGES);
}

export function normalizeInventoryImageEntries(
  primaryImageUrl: string,
  rawImages: unknown,
  rawInput: unknown,
): InventoryImageInput[] {
  const entries: InventoryImageInput[] = [];
  const seen = new Set<string>();

  const pushEntry = (urlValue: unknown, isPrivateValue: unknown) => {
    const normalizedUrl = normalizeInventoryOrExternalImageUrl(typeof urlValue === 'string' ? urlValue : '');
    if (!normalizedUrl || seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    entries.push({
      url: normalizedUrl,
      isPrivate: Boolean(isPrivateValue),
    });
  };

  if (Array.isArray(rawImages)) {
    rawImages.forEach((entry) => {
      if (typeof entry === 'string') {
        pushEntry(entry, false);
        return;
      }
      if (entry && typeof entry === 'object') {
        const candidate = entry as { url?: unknown; imageUrl?: unknown; isPrivate?: unknown };
        pushEntry(candidate.url ?? candidate.imageUrl, candidate.isPrivate);
      }
    });
  }

  normalizeInventoryImageCandidates(primaryImageUrl, rawInput).forEach((url) => pushEntry(url, false));

  if (entries.length > 0) {
    entries[0] = { ...entries[0], isPrivate: false };
  }

  return entries.slice(0, INVENTORY_MAX_IMAGES);
}
