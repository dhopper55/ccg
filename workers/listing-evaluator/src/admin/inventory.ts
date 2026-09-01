import type { Env } from '../env.js';
import { jsonResponse, currentDateYmd, toBooleanInput } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { reframeSaleTitleAndDescription } from '../ai/reframe.js';
import { dbGetInventoryItem } from '../inventory/db-core.js';
import {
  dbSetInventoryMarked,
  dbClearInventoryTagReprint,
  dbListMarkedInventoryRowsForPackage,
  dbListInventoryImagesForItemIds,
  dbReplaceInventoryImagesByItemIds,
  generateUniqueCcgNumber,
  dbCreateInventoryItems,
  dbUnmarkAllInventoryItems,
  dbListMarkedInventoryLabelRows,
} from '../inventory/db-write.js';
import {
  getInventoryRowCostBasis,
  selectMergePackageImageEntries,
  buildMergedPackagePurchaseNotes,
} from '../inventory/package-utils.js';
import { dbFindTopLevelPackageCategoryId } from '../inventory/categories.js';
import type { InventoryLabelPdfRow } from '../pdf/types.js';
import {
  buildInventoryLabelsPdf,
  buildInventoryLabelsPdfPositioned,
  buildInventoryLabelsPdfFromExpanded,
} from '../pdf/labels.js';

export async function handleAdminV2InventorySubscriptions(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, name, email, date_subscribed, date_cancelled
     FROM ccg_inventory_subscriptions
     ORDER BY date_subscribed DESC`
  ).all<{ id: number; name: string; email: string; date_subscribed: string | null; date_cancelled: string | null }>();
  const records = (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    dateSubscribed: row.date_subscribed,
    dateCancelled: row.date_cancelled,
  }));
  return jsonResponse({ records });
}

export async function handleAdminV2InventoryCustomTemplate(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const barcode = normalizeText(url.searchParams.get('barcode'), '').trim().slice(0, 80);
  if (!barcode) return jsonResponse({ message: 'Barcode is required.' }, 400);

  const row = await env.DB.prepare(
    `SELECT id
     FROM ccg_inventory_items
     WHERE TRIM(COALESCE(barcode, '')) = ?
       AND COALESCE(is_active, 0) = 1
     ORDER BY id ASC
     LIMIT 1`,
  ).bind(barcode).first<{ id: number }>();
  if (!row?.id) return jsonResponse({ message: 'Custom product template not found.' }, 404);

  const record = await dbGetInventoryItem(String(row.id), env);
  if (!record) return jsonResponse({ message: 'Custom product template not found.' }, 404);
  return jsonResponse({ record });
}

export async function handleAdminV2InventoryReframe(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const title = normalizeText(body.title, '').slice(0, 200);
  const description = normalizeText(body.description, '').slice(0, 12000);

  if (!title) return jsonResponse({ message: 'Title is required.' }, 400);
  if (!description) return jsonResponse({ message: 'Description is required.' }, 400);
  if (!env.ANTHROPIC_API_KEY) return jsonResponse({ message: 'AI reframe is not configured.' }, 500);

  const result = await reframeSaleTitleAndDescription(title, description, env);
  if (!result) return jsonResponse({ message: 'Unable to reframe title and description right now.' }, 502);

  return jsonResponse(result);
}

export async function handleAdminV2InventoryUnmarkAll(env: Env): Promise<Response> {
  const count = await dbUnmarkAllInventoryItems(env);
  return jsonResponse({ ok: true, count });
}

export async function handleAdminV2InventoryBackfillBarcodes(_env: Env): Promise<Response> {
  return jsonResponse({
    message: 'Barcode backfill is disabled. Barcodes are now only saved when explicitly entered.',
  }, 410);
}

export async function handleAdminV2InventoryMergeMarked(env: Env): Promise<Response> {
  const markedRows = await dbListMarkedInventoryRowsForPackage(env);

  const soldMarkedRows = markedRows.filter((row) => Number(row.is_sold || 0) === 1);
  if (soldMarkedRows.length > 0) {
    return jsonResponse({
      message: `Merge canceled. ${soldMarkedRows.length} marked item${soldMarkedRows.length === 1 ? ' is' : 's are'} sold. Unmark sold items and try again.`,
      soldMarkedCount: soldMarkedRows.length,
    }, 400);
  }

  const activeUnsoldMarkedRows = markedRows.filter(
    (row) => Number(row.is_active || 0) === 1 && Number(row.is_sold || 0) === 0,
  );
  if (activeUnsoldMarkedRows.length < 2) {
    return jsonResponse({
      message: 'At least 2 active unsold marked inventory items are required to merge.',
    }, 400);
  }
  const invalidQuantityRows = activeUnsoldMarkedRows.filter((row) => Number(row.quantity ?? 1) !== 1);
  if (invalidQuantityRows.length > 0) {
    return jsonResponse({
      message: 'Package items must have Qty 1 before they can be merged.',
      invalidQuantityCount: invalidQuantityRows.length,
    }, 400);
  }

  const sourceItemIds = activeUnsoldMarkedRows.map((row) => row.id);
  const sourceImagesMap = await dbListInventoryImagesForItemIds(sourceItemIds, env);
  const packageImageEntries = selectMergePackageImageEntries(activeUnsoldMarkedRows, sourceImagesMap);
  const packageImageUrls = packageImageEntries.map((e) => e.url);
  if (packageImageUrls.length < 1) {
    return jsonResponse({ message: 'Marked items did not contain usable images.' }, 400);
  }

  const unitPurchasePriceTotal = activeUnsoldMarkedRows.reduce(
    (sum, row) => sum + getInventoryRowCostBasis(row),
    0,
  );
  const privatePartyValueTotal = activeUnsoldMarkedRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.private_party_value) ? Number(row.private_party_value) : 0),
    0,
  );
  const purchaseNotes = buildMergedPackagePurchaseNotes(activeUnsoldMarkedRows);

  const ccgNumber = await generateUniqueCcgNumber(env);
  if (!ccgNumber) {
    return jsonResponse({ message: 'Unable to generate CCG Number. Please try again.' }, 500);
  }
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  if (packageCategoryId == null) {
    return jsonResponse({ message: 'No top-level package category was found.' }, 400);
  }

  const inserted = await dbCreateInventoryItems({
    source_listing_id: null,
    ccg_number: ccgNumber,
    image_url: packageImageUrls[0],
    image_urls: packageImageUrls.join('\n'),
    title: 'New Package (needs edit)',
    quantity: 1,
    category_id: packageCategoryId,
    secondary_category_id: null,
    brand: 'CCG',
    year_range: String(new Date().getFullYear()),
    model: 'TBD',
    finish: 'TBD',
    repair_notes: null,
    original_listing_desc: null,
    video_url: null,
    sale_title: null,
    regular_price: null,
    sale_price: 0,
    condition: null,
    sale_description: null,
    clearance: 0,
    bullet_1_text: null,
    bullet_1_danger: 0,
    bullet_1_highlight: 0,
    bullet_2_text: null,
    bullet_2_danger: 0,
    bullet_2_highlight: 0,
    bullet_3_text: null,
    bullet_3_danger: 0,
    bullet_3_highlight: 0,
    bullet_4_text: null,
    bullet_4_danger: 0,
    bullet_4_highlight: 0,
    bullet_5_text: null,
    bullet_5_danger: 0,
    bullet_5_highlight: 0,
    bullet_6_text: null,
    bullet_6_danger: 0,
    bullet_6_highlight: 0,
    barcode: null,
    purchased_date: currentDateYmd(),
    unit_purchase_price: unitPurchasePriceTotal,
    map_price: null,
    private_party_value: privatePartyValueTotal,
    miles: 0,
    minutes_spent: 0,
    ship_cost: 0,
    purchase_notes: purchaseNotes || null,
    ai_analysis_text: null,
    serial_number: null,
    weight_lbs: null,
    neck_profile: null,
    neck_thickness: null,
    nut_width: null,
    width_12_fret: null,
    fretboard_radius: null,
    twelve_fret_action: null,
    is_active: 1,
    is_marked: 0,
    is_personal: 0,
    is_consignment: 0,
    is_rented: 0,
    for_sale: 0,
    only_in_store: 0,
    for_sale_date: null,
    is_sold: 0,
    sold_date: null,
    sold_amount: 0,
    sell_notes: '',
  }, env);

  if (!inserted?.firstId) {
    return jsonResponse({ message: 'Unable to create merged inventory item.' }, 500);
  }
  if (!(await dbReplaceInventoryImagesByItemIds(
    [Number(inserted.firstId)],
    packageImageEntries,
    env,
  ))) {
    return jsonResponse({ message: 'Merged inventory item was created, but its image records failed to save.' }, 500);
  }

  const sourceIds = sourceItemIds;

  // Set package_id on source items and unmark them
  const packageId = inserted.firstId;
  try {
    const placeholders = sourceIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `UPDATE ccg_inventory_items SET package_id = ?, is_marked = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`
    ).bind(packageId, ...sourceIds).run();
  } catch (error) {
    console.error('Failed to set package_id on source items', { error });
    return jsonResponse({
      message: 'Merged item was created, but source items could not be linked. Resolve manually.',
      id: inserted.firstId,
      ccgNumber: inserted.ccgNumber,
    }, 500);
  }

  return jsonResponse({
    ok: true,
    id: inserted.firstId,
    ccgNumber: inserted.ccgNumber,
    mergedCount: sourceIds.length,
  });
}

export async function handleAdminV2InventoryMarkUpdate(
  request: Request,
  path: string,
  env: Env,
): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const markIndex = parts.indexOf('mark');
  const recordId = markIndex > 0 ? parts[markIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const isMarked = toBooleanInput(body.isMarked, false);
  const updated = await dbSetInventoryMarked(recordId, isMarked, env);
  if (!updated) return jsonResponse({ message: 'Unable to update marked state.' }, 500);
  return jsonResponse({ ok: true, isMarked });
}

export async function handleAdminV2InventoryClearTagReprint(
  path: string,
  env: Env,
): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const clearIndex = parts.indexOf('clear-tag-reprint');
  const recordId = clearIndex > 0 ? parts[clearIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);
  const ok = await dbClearInventoryTagReprint(recordId, env);
  if (!ok) return jsonResponse({ message: 'Unable to clear tag reprint flag.' }, 500);
  return jsonResponse({ ok: true });
}

export async function handleAdminV2InventoryLabelsPdf(env: Env): Promise<Response> {
  const rows = await dbListMarkedInventoryLabelRows(env);
  const labels = rows
    .map((row) => ({
      ccgNumber: normalizeText(row.ccg_number, ''),
      title: normalizeText(row.title, 'Untitled') || 'Untitled',
      imageUrl: normalizeText(row.image_url, ''),
    }))
    .filter((row) => row.ccgNumber);

  if (labels.length < 1) {
    return jsonResponse({ message: 'No marked inventory items with a CCG number were found.' }, 400);
  }

  const pdfBytes = await buildInventoryLabelsPdf(labels, env);
  const unmarkedCount = await dbUnmarkAllInventoryItems(env);
  if (unmarkedCount < 1) {
    return jsonResponse({ message: 'Labels were generated, but marked items could not be cleared.' }, 500);
  }

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ccg-labels-${currentDateYmd()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function handleAdminV2InventoryLabelsPdfPost(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return jsonResponse({ message: 'No items provided.' }, 400);
  }

  type RawItem = { id?: unknown; count?: unknown; position1?: unknown; position2?: unknown };
  const itemEntries: Array<{ id: string; count: number; position1: number; position2: number }> = [];
  let hasPositions = false;

  for (const item of rawItems) {
    const raw = item as RawItem;
    const id = raw.id != null ? String(raw.id) : '';
    const count = Number(raw.count) || 1;
    const pos1 = Number(raw.position1) || 0;
    const pos2 = count >= 2 ? (Number(raw.position2) || 0) : 0;
    if (id && count > 0 && count <= 2) {
      itemEntries.push({ id, count, position1: pos1, position2: pos2 });
      if (pos1 > 0 || pos2 > 0) hasPositions = true;
    }
  }

  if (itemEntries.length === 0) {
    return jsonResponse({ message: 'No valid items provided.' }, 400);
  }

  const ids = itemEntries.map((e) => e.id);
  const placeholders = ids.map(() => '?').join(', ');
  const dbResult = await env.DB.prepare(
    `SELECT id, ccg_number, title, image_url
     FROM ccg_inventory_items
     WHERE id IN (${placeholders})
     ORDER BY created_at ASC, id ASC`
  ).bind(...ids.map(Number)).all<{
    id: number;
    ccg_number: string | null;
    title: string | null;
    image_url: string | null;
  }>();

  const dbRowMap = new Map<string, { ccgNumber: string; title: string; imageUrl: string }>();
  for (const row of dbResult.results ?? []) {
    const ccgNumber = normalizeText(row.ccg_number, '');
    if (!ccgNumber) continue;
    dbRowMap.set(String(row.id), {
      ccgNumber,
      title: normalizeText(row.title, 'Untitled') || 'Untitled',
      imageUrl: normalizeText(row.image_url, ''),
    });
  }

  if (dbRowMap.size < 1) {
    return jsonResponse({ message: 'No valid inventory items with a CCG number were found.' }, 400);
  }

  let pdfBytes: Uint8Array;

  if (hasPositions) {
    // Position mode: build a 10-slot page with labels at specific positions
    const slots: Array<InventoryLabelPdfRow | null> = Array.from({ length: 10 }, () => null);
    for (const entry of itemEntries) {
      const dbRow = dbRowMap.get(entry.id);
      if (!dbRow) continue;
      const label: InventoryLabelPdfRow = { ccgNumber: dbRow.ccgNumber, title: dbRow.title, imageUrl: dbRow.imageUrl };
      if (entry.position1 >= 1 && entry.position1 <= 10) {
        slots[entry.position1 - 1] = label;
      }
      if (entry.count >= 2 && entry.position2 >= 1 && entry.position2 <= 10) {
        slots[entry.position2 - 1] = label;
      }
    }
    pdfBytes = await buildInventoryLabelsPdfPositioned(slots, env);
  } else {
    // Auto mode: expand rows by their print counts (grouped)
    const expandedRows: InventoryLabelPdfRow[] = [];
    for (const entry of itemEntries) {
      const dbRow = dbRowMap.get(entry.id);
      if (!dbRow) continue;
      for (let i = 0; i < entry.count; i++) {
        expandedRows.push({ ccgNumber: dbRow.ccgNumber, title: dbRow.title, imageUrl: dbRow.imageUrl });
      }
    }
    pdfBytes = await buildInventoryLabelsPdfFromExpanded(expandedRows, env);
  }

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ccg-labels-${currentDateYmd()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
