import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import type { InventoryItemRow } from '../types/inventory.js';
import { getInventoryCategoryLabel } from './categories.js';
import { parseStoredInventoryImageUrls } from './db-images.js';
import { cloneInventoryImageKeyToNewPackageImageUrl } from './db-images.js';

export const INVENTORY_MAX_IMAGES = 20;

export function formatDateForPackageNotes(value: string | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

export function formatOptionalMoneyForPackageNotes(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function getInventoryRowCostBasis(row: Pick<InventoryItemRow, 'unit_purchase_price' | 'quantity' | 'is_sold'>): number {
  const unitCost = Number(row.unit_purchase_price);
  if (!Number.isFinite(unitCost)) return 0;
  const quantity = Number(row.quantity);
  const costQuantity = Number.isFinite(quantity) && quantity > 0
    ? quantity
    : Number(row.is_sold || 0) === 1
      ? 1
      : 0;
  return unitCost * costQuantity;
}

export function buildPackagePurchaseNotes(rows: InventoryItemRow[]): string {
  const separator = '------------------------';
  const sections: string[] = [];

  for (const row of rows) {
    const lines: string[] = [];
    const title = normalizeText(row.title, '');
    if (title) lines.push(title);

    const detailsLine = [
      getInventoryCategoryLabel(row),
      normalizeText(row.brand, ''),
      normalizeText(row.year_range, ''),
      normalizeText(row.model, ''),
      normalizeText(row.finish, ''),
      normalizeText(row.serial_number, '') ? `SERIAL# ${normalizeText(row.serial_number, '')}` : '',
    ].filter(Boolean).join(' - ');
    if (detailsLine) lines.push(detailsLine);

    const valuesLine = [
      formatDateForPackageNotes(row.purchased_date),
      formatOptionalMoneyForPackageNotes(row.unit_purchase_price),
      formatOptionalMoneyForPackageNotes(row.private_party_value),
    ].filter(Boolean).join(' - ');
    if (valuesLine) lines.push(valuesLine);

    const purchaseNotes = normalizeText(row.purchase_notes, '');
    if (purchaseNotes) lines.push(purchaseNotes);

    if (lines.length > 0) {
      sections.push(lines.join('\n'));
    }
  }

  return sections.join(`\n${separator}\n`);
}

export function selectMergePackageImageUrls(rows: InventoryItemRow[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  const perRowImageUrls = rows.map((row) => parseStoredInventoryImageUrls(row.image_urls, row.image_url));

  // First pass: first image from each merged item.
  for (const imageUrls of perRowImageUrls) {
    const firstUrl = imageUrls[0];
    if (!firstUrl || seen.has(firstUrl)) continue;
    selected.push(firstUrl);
    seen.add(firstUrl);
    if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
  }

  // Second pass: fill remaining slots from the rest of each item's image set.
  for (const imageUrls of perRowImageUrls) {
    for (let i = 1; i < imageUrls.length; i += 1) {
      const imageUrl = imageUrls[i];
      if (!imageUrl || seen.has(imageUrl)) continue;
      selected.push(imageUrl);
      seen.add(imageUrl);
      if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
    }
  }

  return selected;
}

export function selectMergePackageImageEntries(
  rows: InventoryItemRow[],
  imagesMap: Map<number, Array<{ url: string; isPrivate: boolean }>>,
): Array<{ url: string; isPrivate: boolean }> {
  const selected: Array<{ url: string; isPrivate: boolean }> = [];
  const seen = new Set<string>();

  const perRowImages = rows.map((row) => {
    const stored = imagesMap.get(row.id);
    if (stored && stored.length > 0) {
      return stored.map((img) => ({ url: img.url, isPrivate: img.isPrivate }));
    }
    return parseStoredInventoryImageUrls(row.image_urls, row.image_url)
      .map((url) => ({ url, isPrivate: false }));
  });

  // First pass: first image from each merged item
  for (const images of perRowImages) {
    const first = images[0];
    if (!first || seen.has(first.url)) continue;
    selected.push(first);
    seen.add(first.url);
    if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
  }

  // Second pass: remaining images
  for (const images of perRowImages) {
    for (let i = 1; i < images.length; i++) {
      const img = images[i];
      if (!img || seen.has(img.url)) continue;
      selected.push(img);
      seen.add(img.url);
      if (selected.length >= INVENTORY_MAX_IMAGES) return selected;
    }
  }

  return selected;
}

export function buildMergedPackagePurchaseNotes(rows: InventoryItemRow[]): string {
  return rows.map((row, index) => {
    const unitCost = formatOptionalMoneyForPackageNotes(row.unit_purchase_price) || '$0';
    const privateParty = formatOptionalMoneyForPackageNotes(row.private_party_value) || '$0';
    const itemLines = [
      `${index + 1}. ${normalizeText(row.ccg_number, 'N/A')} | ${normalizeText(row.title, 'Untitled')}`,
      `Category: ${getInventoryCategoryLabel(row) || 'N/A'}`,
      `Brand: ${normalizeText(row.brand, '') || 'N/A'}`,
      `Year: ${normalizeText(row.year_range, '') || 'N/A'}`,
      `Model: ${normalizeText(row.model, '') || 'N/A'}`,
      `Finish: ${normalizeText(row.finish, '') || 'N/A'}`,
      `Unit Cost: ${unitCost}`,
      `Private Party Value: ${privateParty}`,
      `Serial Number: ${normalizeText(row.serial_number, '') || 'N/A'}`,
      `Repair Notes: ${normalizeText(row.repair_notes, '') || 'N/A'}`,
    ];
    return itemLines.join('\n');
  }).join('\n\n');
}

export async function clonePackageImagesFromMarkedRows(rows: InventoryItemRow[], env: Env): Promise<string[]> {
  const output: string[] = [];
  const seenSourceKeys = new Set<string>();

  for (const row of rows) {
    const imageUrls = parseStoredInventoryImageUrls(row.image_urls, row.image_url);
    for (const imageUrl of imageUrls) {
      const key = extractInventoryImageKey(imageUrl);
      if (!key || seenSourceKeys.has(key)) continue;
      seenSourceKeys.add(key);
      try {
        const clonedUrl = await cloneInventoryImageKeyToNewPackageImageUrl(key, env);
        output.push(clonedUrl);
        if (output.length >= INVENTORY_MAX_IMAGES) return output;
      } catch (error) {
        console.warn('Failed to clone package image', { error, key });
      }
    }
    if (output.length >= INVENTORY_MAX_IMAGES) break;
  }

  return output;
}

function extractInventoryImageKey(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const key = parsed.searchParams.get('key') || '';
    if (key && key.startsWith('inventory-items/')) return key;
    const path = parsed.pathname.replace(/^\//, '');
    if (path.startsWith('inventory-items/')) return path;
  } catch {
    if (url.startsWith('inventory-items/')) return url;
  }
  return null;
}
