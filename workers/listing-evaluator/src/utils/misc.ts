import type { Env } from '../env.js';
import type { InventoryCategoryRow } from '../types/inventory.js';
import { normalizeText } from './text.js';
export { normalizeText } from './text.js';

export function jsonResponse(body: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  let parsed: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    parsed = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const next = Number.parseInt(value.trim(), 10);
    parsed = Number.isFinite(next) ? next : null;
  }
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function htmlResponse(html: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-cache, no-store, must-revalidate',
      ...extraHeaders,
    },
  });
}

export function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function stripeTimestampToIso(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return new Date(seconds * 1000).toISOString();
}

export async function dbGetColumnNames(tableName: string, env: Env): Promise<Set<string>> {
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeTableName) return new Set();
  const rows = await env.DB.prepare(`PRAGMA table_info(${safeTableName})`).all<{ name: string | null }>();
  return new Set((rows.results ?? []).map((r) => normalizeText(r.name, '').toLowerCase()).filter(Boolean));
}

export async function dbInsertFiltered(
  tableName: string,
  allValues: Record<string, unknown>,
  existingColumns: Set<string>,
  env: Env,
): Promise<{ last_row_id?: number }> {
  const cols = Object.keys(allValues).filter((col) => existingColumns.has(col));
  const result = await env.DB.prepare(
    `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).bind(...cols.map((col) => allValues[col])).run();
  return { last_row_id: Number(result.meta?.last_row_id || 0) || undefined };
}

export function parseStringArray(input: string | null | undefined): string[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => normalizeText(value, ''))
      .filter((value) => value.length > 0)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function pickString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function currentDateYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function normalizeInventoryDate(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return value;
}

export function toBooleanInput(input: unknown, fallback: boolean): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  }
  return fallback;
}

export function isPriceLike(input: string): boolean {
  if (!input) return false;
  const normalized = input.replace(/\s+/g, '');
  if (/^\$?[\d,]+(?:\.\d{1,2})?$/.test(normalized)) {
    return true;
  }
  return false;
}

export function parseOptionalPositiveInt(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number' && Number.isFinite(input) && Number.isInteger(input) && input > 0) {
    return input;
  }
  if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    const parsed = Number.parseInt(input.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function normalizeRequiredInventoryBarcode(input: unknown): { value: string; message: string | null } {
  const value = normalizeText(input, '').trim();
  if (!value) return { value: '', message: 'Barcode is required.' };
  if (!/^\d+$/.test(value)) return { value, message: 'Barcode must be numeric only.' };
  if (value.length < 8 || value.length > 20) {
    return { value, message: 'Barcode must be 8 to 20 digits.' };
  }
  return { value, message: null };
}

export function generateRunId(): string {
  const now = new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `run-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export function parseShopCategoryIds(url: URL): number[] {
  const rawValues = [
    ...url.searchParams.getAll('categoryId'),
    ...url.searchParams.getAll('categoryIds'),
  ];
  const csv = normalizeText(url.searchParams.get('categories'), '');
  if (csv) rawValues.push(...csv.split(','));

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => String(value).split(','))
        .map((value) => parseOptionalPositiveInt(value))
        .filter((value): value is number => value != null),
    ),
  );
}

export function normalizeShopProductSort(value: string | null): string {
  switch (normalizeText(value, '').toLowerCase()) {
    case 'brand-az':
    case 'price-low-high':
    case 'price-high-low':
      return normalizeText(value, '').toLowerCase();
    case 'popular':
    case 'most-popular':
    default:
      return 'popular';
  }
}

export function expandInventoryCategoryIds(selectedIds: number[], rows: InventoryCategoryRow[]): number[] {
  if (selectedIds.length === 0) return [];

  const childrenByParent = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parent_id == null) continue;
    const siblings = childrenByParent.get(row.parent_id) ?? [];
    siblings.push(row.id);
    childrenByParent.set(row.parent_id, siblings);
  }

  const expanded = new Set<number>();
  const stack = [...selectedIds];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (currentId == null || expanded.has(currentId)) continue;
    expanded.add(currentId);
    const children = childrenByParent.get(currentId) ?? [];
    children.forEach((childId) => stack.push(childId));
  }

  return Array.from(expanded);
}
