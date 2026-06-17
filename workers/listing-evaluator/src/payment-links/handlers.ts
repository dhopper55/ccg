import type { Env } from '../env.js';
import type { InventoryItemRow } from '../types/inventory.js';
import { jsonResponse, normalizeText, toBooleanInput, parseOptionalPositiveInt } from '../utils/misc.js';
import { toPublicShopImageUrl } from '../utils/image.js';
import { formatCurrencyCents } from '../utils/money.js';
import { getInventoryCategoryLabel } from '../inventory/categories.js';
import { INVENTORY_CATEGORY_SELECT_SQL, INVENTORY_CATEGORY_JOIN_SQL } from '../inventory/db-core.js';
import { getStripeRuntimeConfig } from '../system/runtime.js';
import {
  listStripePaymentLinks,
  deactivateStripePaymentLink,
  createStripePaymentLinkFromInventory,
} from './stripe.js';

function getInventoryPaymentLinkTitle(row: InventoryItemRow): string {
  return normalizeText(row.sale_title || row.title, 'Untitled item') || 'Untitled item';
}

function getInventoryPaymentLinkPriceCents(row: InventoryItemRow): number {
  const price = Number(row.sale_price || row.regular_price || 0);
  return Number.isFinite(price) ? Math.round(price * 100) : 0;
}

async function dbListMarkedInventoryRowsForPaymentLinks(env: Env): Promise<InventoryItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      i.id,
      i.ccg_number,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ccg_inventory_item_images sii_exists
          WHERE sii_exists.inventory_item_id = i.id
        ) THEN COALESCE((
          SELECT sii.image_url
          FROM ccg_inventory_item_images sii
          WHERE sii.inventory_item_id = i.id
            AND COALESCE(sii.is_private, 0) = 0
          ORDER BY sii.display_order ASC, sii.id ASC
          LIMIT 1
        ), '')
        ELSE i.image_url
      END AS image_url,
      i.image_urls,
      i.title,
      i.quantity,
      ${INVENTORY_CATEGORY_SELECT_SQL},
      i.brand,
      i.model,
      i.finish,
      i.original_listing_desc,
      i.sale_title,
      i.regular_price,
      i.sale_price,
      i.sale_description,
      i.is_marked,
      i.for_sale,
      i.is_sold,
      i.created_at,
      i.updated_at
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_marked, 0) = 1
     ORDER BY i.created_at ASC, i.id ASC`
  ).all<InventoryItemRow>();
  return result.results ?? [];
}

function mapPaymentLinkMarkedInventoryRow(row: InventoryItemRow): Record<string, unknown> {
  const unitAmountCents = getInventoryPaymentLinkPriceCents(row);
  return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    title: getInventoryPaymentLinkTitle(row),
    priceCents: unitAmountCents,
    price: formatCurrencyCents(unitAmountCents),
    quantity: Math.max(1, Number(row.quantity || 1)),
    brand: normalizeText(row.brand, ''),
    category: getInventoryCategoryLabel(row),
    forSale: Boolean(row.for_sale),
    isSold: Boolean(row.is_sold),
  };
}

function parsePaymentLinkQuantitySelections(input: unknown): Map<number, number> {
  const selections = new Map<number, number>();
  if (!Array.isArray(input)) return selections;

  for (const item of input) {
    const inventoryItemId = parseOptionalPositiveInt((item as any)?.inventoryItemId);
    if (!inventoryItemId) continue;
    const rawQuantity = Number((item as any)?.quantity ?? 0);
    const quantity = Math.max(0, Math.min(1_000_000, Math.floor(Number.isFinite(rawQuantity) ? rawQuantity : 0)));
    selections.set(inventoryItemId, (selections.get(inventoryItemId) || 0) + quantity);
  }

  return selections;
}

export async function handleAdminV2PaymentLinks(request: Request, env: Env): Promise<Response> {
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe secret key is not configured.' }, 503);
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 100);

  try {
    const records = await listStripePaymentLinks(stripeConfig.secretKey, limit);
    return jsonResponse({ records });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to load Stripe payment links.',
    }, 502);
  }
}

export async function handleAdminV2PaymentLinkMarkedItems(env: Env): Promise<Response> {
  const records = await dbListMarkedInventoryRowsForPaymentLinks(env);
  return jsonResponse({
    records: records.map(mapPaymentLinkMarkedInventoryRow),
    maxItems: 20,
  });
}

export async function handleAdminV2PaymentLinkCreate(request: Request, env: Env): Promise<Response> {
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe secret key is not configured.' }, 503);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const includeSalesTax = toBooleanInput(body.includeSalesTax, true);
  const markedRows = await dbListMarkedInventoryRowsForPaymentLinks(env);
  if (markedRows.length < 1) {
    return jsonResponse({ message: 'No marked inventory items exist.' }, 400);
  }

  const quantitySelections = parsePaymentLinkQuantitySelections(body.items);
  const hasExplicitQuantitySelections = quantitySelections.size > 0 || Array.isArray(body.items);
  const selectedRows = markedRows
    .map((row) => {
      const availableQuantity = Math.max(0, Number(row.quantity ?? 1) || 0);
      const requestedQuantity = hasExplicitQuantitySelections
        ? quantitySelections.get(Number(row.id)) ?? 0
        : Math.min(1, availableQuantity);
      return {
        row,
        availableQuantity,
        requestedQuantity,
      };
    })
    .filter((selection) => selection.requestedQuantity > 0);

  if (selectedRows.length < 1) {
    return jsonResponse({ message: 'Select at least one marked inventory item.' }, 400);
  }
  if (selectedRows.length > 20) {
    return jsonResponse({ message: 'Stripe payment links support up to 20 line items. Unmark items and try again.' }, 400);
  }

  const quantityError = selectedRows.find((selection) => selection.requestedQuantity > selection.availableQuantity);
  if (quantityError) {
    return jsonResponse({
      message: `${getInventoryPaymentLinkTitle(quantityError.row)} only has ${quantityError.availableQuantity} available.`,
    }, 400);
  }

  const items = selectedRows.map(({ row, requestedQuantity }) => {
    const unitAmountCents = getInventoryPaymentLinkPriceCents(row);
    return {
      inventoryItemId: row.id,
      ccgNumber: normalizeText(row.ccg_number, ''),
      title: getInventoryPaymentLinkTitle(row),
      description: normalizeText(row.sale_description || row.original_listing_desc || '', '').slice(0, 500),
      quantity: requestedQuantity,
      unitAmountCents,
      imageUrl: toPublicShopImageUrl(row.image_url, 'thumb'),
    };
  });
  const invalidItem = items.find((item) => item.unitAmountCents < 1);
  if (invalidItem) {
    return jsonResponse({ message: `${invalidItem.title} is missing a usable sale or regular price.` }, 400);
  }

  const taxRateId = includeSalesTax ? stripeConfig.taxRateId : '';
  if (includeSalesTax && !taxRateId) {
    return jsonResponse({ message: 'Colorado sales tax rate is not configured.' }, 503);
  }

  try {
    const paymentLink = await createStripePaymentLinkFromInventory({
      stripeSecretKey: stripeConfig.secretKey,
      items,
      includeSalesTax,
      taxRateId,
    });
    const records = await listStripePaymentLinks(stripeConfig.secretKey, 100);
    return jsonResponse({
      ok: true,
      record: paymentLink,
      records,
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to create Stripe payment link.',
    }, 502);
  }
}

export async function handleAdminV2PaymentLinkDeactivate(paymentLinkId: string, env: Env): Promise<Response> {
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe secret key is not configured.' }, 503);
  }

  const id = normalizeText(paymentLinkId, '').slice(0, 100);
  if (!id) return jsonResponse({ message: 'Missing payment link id.' }, 400);

  try {
    await deactivateStripePaymentLink(stripeConfig.secretKey, id);
    const records = await listStripePaymentLinks(stripeConfig.secretKey, 100);
    return jsonResponse({ ok: true, records });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to deactivate Stripe payment link.',
    }, 502);
  }
}
