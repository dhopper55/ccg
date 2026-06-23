import type { Env } from '../env.js';
import { normalizeText, normalizeUrl } from '../utils/text.js';
import { jsonResponse, parseBoundedInt, normalizeInventoryDate, toBooleanInput, currentDateYmd } from '../utils/misc.js';
import { sanitizePatternLookupHtml } from '../utils/html.js';
import { normalizeInventoryImageEntries, INVENTORY_MAX_IMAGES } from '../utils/image.js';
import { dbCreateInventoryItems, dbReplaceInventoryImagesByItemIds, dbDeleteInventoryItemsByIds, dbListMarkedInventoryRowsForPackage } from './db-write.js';
import { ensureInventoryHostedImageUrls, purgeOrphanedInventoryImagesForDeletedRows } from './db-images.js';
import { dbGetInventoryItem, dbFindInventoryBySourceListingId, dbFindInventoryBySaleUrl, dbFindRecentDuplicateInventoryCreate, dbCcgNumberExists } from './db-core.js';
import { dbInventoryCategoryExists } from './categories.js';
import { normalizeInventoryQueue } from './db-core.js';
import { generateUniqueCcgNumber } from './db-write.js';
import { dbFindTopLevelPackageCategoryId } from './categories.js';
import { clonePackageImagesFromMarkedRows, getInventoryRowCostBasis, buildPackagePurchaseNotes } from './package-utils.js';
import { buildAdminInventoryItemUrl, toAbsoluteSiteUrl, insertActivityLogBestEffort } from '../admin/activity.js';
import { validateForSaleInventoryFields } from './handlers.js';

import { parseCurrencyAmount } from '../utils/money.js';
import { parseOptionalPositiveInt, normalizeRequiredInventoryBarcode } from '../utils/misc.js';

export async function handleInventoryPackageCreate(env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  const markedRows = await dbListMarkedInventoryRowsForPackage(env);
  if (markedRows.length < 2) {
    return jsonResponse({ message: 'At least 2 marked inventory items are required to create a package.' }, 400);
  }
  const invalidQuantityRows = markedRows.filter((row) => Number(row.quantity ?? 1) !== 1);
  if (invalidQuantityRows.length > 0) {
    return jsonResponse({
      message: 'Package items must have Qty 1 before they can be merged.',
      invalidQuantityCount: invalidQuantityRows.length,
    }, 400);
  }

  const packageImageUrls = await clonePackageImagesFromMarkedRows(markedRows, env);
  if (packageImageUrls.length < 1) {
    return jsonResponse({ message: 'Marked items did not contain usable images.' }, 400);
  }

  const unitPurchasePriceTotal = markedRows.reduce((sum, row) => sum + getInventoryRowCostBasis(row), 0);
  const privatePartyValueTotal = markedRows.reduce((sum, row) => sum + (Number.isFinite(row.private_party_value) ? Number(row.private_party_value) : 0), 0);
  const purchaseNotes = buildPackagePurchaseNotes(markedRows);

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
    title: 'PACKAGE DEAL - TBD',
    quantity: 1,
    category_id: packageCategoryId,
    secondary_category_id: null,
    brand: 'TBD',
    year_range: 'TBD',
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
    return jsonResponse({ message: 'Unable to create package inventory item.' }, 500);
  }
  if (!(await dbReplaceInventoryImagesByItemIds(
    [Number(inserted.firstId)],
    packageImageUrls.map((url) => ({ url, isPrivate: false })),
    env,
  ))) {
    return jsonResponse({ message: 'Package item was created, but its image records failed to save.' }, 500);
  }

  const sourceIds = markedRows.map((row) => row.id);
  const deletedCount = await dbDeleteInventoryItemsByIds(sourceIds, env);
  if (deletedCount !== sourceIds.length) {
    return jsonResponse({
      message: `Package item was created, but only ${deletedCount} of ${sourceIds.length} marked rows were deleted. Resolve manually.`,
      id: inserted.firstId,
      ccgNumber: inserted.ccgNumber,
    }, 500);
  }

  await purgeOrphanedInventoryImagesForDeletedRows(markedRows, env);

  return jsonResponse({
    ok: true,
    id: inserted.firstId,
    ccgNumber: inserted.ccgNumber,
    mergedCount: sourceIds.length,
  });
}

export async function handleInventoryCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const sourceListingId = parseOptionalPositiveInt(body.sourceListingId);
  const requestedCcgNumber = normalizeText(body.ccgNumber, '').toUpperCase();
  const imageUrl = normalizeText(body.imageUrl, '');
  const imageEntriesInput = normalizeInventoryImageEntries(imageUrl, body.images, body.imageUrls);
  const title = normalizeText(body.title, '').slice(0, 240);
  const quantity = parseBoundedInt(body.quantity ?? body.qty, 1, 0, 1_000_000);
  const categoryId = parseOptionalPositiveInt(body.categoryId);
  const secondaryCategoryId = parseOptionalPositiveInt(body.secondaryCategoryId);
  const brand = normalizeText(body.brand, '').slice(0, 120);
  const isActive = toBooleanInput(body.isActive, true);
  const isMarked = toBooleanInput(body.isMarked, false);
  const isPersonal = toBooleanInput(body.isPersonal, false);
  const isRented = toBooleanInput(body.isRented, false);
  const isCustom = toBooleanInput(body.isCustom, false);
  const isSold = toBooleanInput(body.isSold, false);
  const forSaleRaw = toBooleanInput(body.forSale, false);
  const forSale = isSold ? false : forSaleRaw;
  const onlyInStore = toBooleanInput(body.onlyInStore, false);
  const salesChannelCcg = toBooleanInput(body.salesChannelCcg, forSale);
  const salesChannelFbm = toBooleanInput(body.salesChannelFbm, false);
  const salesChannelCl = toBooleanInput(body.salesChannelCl, false);
  const salesChannelReverb = toBooleanInput(body.salesChannelReverb, false);
  const salesChannelGearExchange = toBooleanInput(body.salesChannelGearExchange, false);
  const salesChannelOfferUp = toBooleanInput(body.salesChannelOfferUp, false);
  const salesChannelEbay = toBooleanInput(body.salesChannelEbay, false);
  const salesChannelNextdoor = toBooleanInput(body.salesChannelNextdoor, false);
  const salesChannelOther = toBooleanInput(body.salesChannelOther, false);
  const queueInput = normalizeInventoryQueue(body.queue);
  const queue = queueInput || (forSale ? 'For Sale' : 'Triage');
  const yearRange = normalizeText(body.yearRange, '').slice(0, 120);
  const model = normalizeText(body.model, '').slice(0, 180);
  const finish = normalizeText(body.finish, '').slice(0, 120);
  const repairNotes = normalizeText(body.repairNotes, '').slice(0, 12000);
  const originalListingDesc = normalizeText(body.originalListingDesc, '').slice(0, 12000);
  const videoUrl = (normalizeUrl(normalizeText(body.videoUrl, '')) || '').slice(0, 200);
  const saleTitle = normalizeText(body.saleTitle, '').slice(0, 200);
  const regularPrice = parseCurrencyAmount(body.regularPrice);
  const salePrice = parseCurrencyAmount(body.salePrice) ?? 0;
  const condition = normalizeText(body.condition, '').slice(0, 50);
  const allowShipping = toBooleanInput(body.allowShipping, false);
  const salesTaxIncluded = toBooleanInput(body.salesTaxIncluded, false);
  const saleDescription = normalizeText(body.saleDescription, '').slice(0, 12000);
  const clearance = toBooleanInput(body.clearance, false);
  const bullet1Text = normalizeText(body.bullet1Text, '').slice(0, 60);
  const bullet1Danger = toBooleanInput(body.bullet1Danger, false);
  const bullet1Highlight = toBooleanInput(body.bullet1Highlight, false);
  const bullet2Text = normalizeText(body.bullet2Text, '').slice(0, 60);
  const bullet2Danger = toBooleanInput(body.bullet2Danger, false);
  const bullet2Highlight = toBooleanInput(body.bullet2Highlight, false);
  const bullet3Text = normalizeText(body.bullet3Text, '').slice(0, 60);
  const bullet3Danger = toBooleanInput(body.bullet3Danger, false);
  const bullet3Highlight = toBooleanInput(body.bullet3Highlight, false);
  const bullet4Text = normalizeText(body.bullet4Text, '').slice(0, 60);
  const bullet4Danger = toBooleanInput(body.bullet4Danger, false);
  const bullet4Highlight = toBooleanInput(body.bullet4Highlight, false);
  const bullet5Text = normalizeText(body.bullet5Text, '').slice(0, 60);
  const bullet5Danger = toBooleanInput(body.bullet5Danger, false);
  const bullet5Highlight = toBooleanInput(body.bullet5Highlight, false);
  const bullet6Text = normalizeText(body.bullet6Text, '').slice(0, 60);
  const bullet6Danger = toBooleanInput(body.bullet6Danger, false);
  const bullet6Highlight = toBooleanInput(body.bullet6Highlight, false);
  const rawBarcode = normalizeText(body.barcode, '').trim();
  const barcodeInput = rawBarcode ? normalizeRequiredInventoryBarcode(rawBarcode) : { value: '', message: null };
  const barcode = barcodeInput.value;
  const purchasedDate = normalizeInventoryDate(body.purchasedDate) || currentDateYmd();
  const unitPurchasePrice = parseCurrencyAmount(body.unitPurchasePrice);
  const mapPrice = parseCurrencyAmount(body.mapPrice);
  const privatePartyValue = parseCurrencyAmount(body.privatePartyValue) ?? 0;
  const miles = parseBoundedInt(body.miles, 0, 0, 1_000_000);
  const minutesSpent = parseBoundedInt(body.minutesSpent, 0, 0, 1_000_000);
  const shipCost = parseCurrencyAmount(body.shipCost) ?? 0;
  const purchaseNotes = normalizeText(body.purchaseNotes, '').slice(0, 4000);
  const aiAnalysisText = sanitizePatternLookupHtml(normalizeText(body.aiAnalysisText, '')).slice(0, 20000);
  const serialNumber = normalizeText(body.serialNumber, '').slice(0, 180);
  const weightLbs = normalizeText(body.weightLbs, '').slice(0, 10);
  const neckProfile = normalizeText(body.neckProfile, '').slice(0, 100);
  const neckThickness = normalizeText(body.neckThickness, '').slice(0, 100);
  const nutWidth = normalizeText(body.nutWidth, '').slice(0, 100);
  const width12Fret = normalizeText(body.width12Fret, '').slice(0, 100);
  const fretboardRadius = normalizeText(body.fretboardRadius, '').slice(0, 100);
  const twelveFretAction = normalizeText(body.twelveFretAction, '').slice(0, 100);
  const soldAmount = parseCurrencyAmount(body.soldAmount);
  const sellNotes = normalizeText(body.sellNotes, '').slice(0, 4000);
  const saleUrl = normalizeText(body.saleUrl, '').slice(0, 150);
  const saleZip = normalizeText(body.saleZip, '').slice(0, 10);
  const salesChannelFields = {
    sales_channel_ccg: salesChannelCcg ? 1 : 0,
    sales_channel_fbm: salesChannelFbm ? 1 : 0,
    sales_channel_cl: salesChannelCl ? 1 : 0,
    sales_channel_reverb: salesChannelReverb ? 1 : 0,
    sales_channel_gear_exchange: salesChannelGearExchange ? 1 : 0,
    sales_channel_offerup: salesChannelOfferUp ? 1 : 0,
    sales_channel_ebay: salesChannelEbay ? 1 : 0,
    sales_channel_nextdoor: salesChannelNextdoor ? 1 : 0,
    sales_channel_other: salesChannelOther ? 1 : 0,
  };

  let imageUrls: string[];
  try {
    imageUrls = await ensureInventoryHostedImageUrls(imageEntriesInput.map((entry) => entry.url), env);
  } catch (error) {
    return jsonResponse({
      message:
        error instanceof Error ? `Unable to import inventory image: ${error.message}` : 'Unable to import inventory image.',
    }, 400);
  }

  if (!title) return jsonResponse({ message: 'Title is required.' }, 400);
  if (categoryId == null) return jsonResponse({ message: 'Category ID is required.' }, 400);
  if (barcodeInput.message) return jsonResponse({ message: barcodeInput.message }, 400);
  if (imageUrls.length < 1) return jsonResponse({ message: 'At least one image is required.' }, 400);
  const forSaleValidationError = validateForSaleInventoryFields({
    forSale,
    saleTitle,
    salePrice,
    regularPrice,
    condition,
    saleDescription,
    bulletTexts: [bullet1Text, bullet2Text, bullet3Text, bullet4Text, bullet5Text, bullet6Text],
    saleUrl,
    saleZip,
  });
  if (forSaleValidationError) return jsonResponse({ message: forSaleValidationError }, 400);
  if (imageUrls.length > INVENTORY_MAX_IMAGES) {
    return jsonResponse({ message: `You can upload up to ${INVENTORY_MAX_IMAGES} images.` }, 400);
  }
  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category ID is invalid.' }, 400);
  }
  if (secondaryCategoryId != null && !(await dbInventoryCategoryExists(secondaryCategoryId, env))) {
    return jsonResponse({ message: 'Secondary Category ID is invalid.' }, 400);
  }
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  if (quantity > 1 && packageCategoryId != null && categoryId === packageCategoryId) {
    return jsonResponse({ message: 'Packages must have Qty 1.' }, 400);
  }

  if (sourceListingId != null) {
    const alreadyLinked = await dbFindInventoryBySourceListingId(sourceListingId, env);
    if (alreadyLinked) {
      return jsonResponse({ message: 'This listing is already in inventory.' }, 400);
    }
  }

  const duplicateSaleUrl = await dbFindInventoryBySaleUrl(saleUrl, env);
  if (duplicateSaleUrl) {
    return jsonResponse({
      message: `Sale URL Slug is already used by ${duplicateSaleUrl.ccg_number || `inventory item ${duplicateSaleUrl.id}`}.`,
    }, 400);
  }

  if (requestedCcgNumber && !/^CCG-\d{6}$/.test(requestedCcgNumber)) {
    return jsonResponse({ message: 'CCG Number must use the CCG-###### format.' }, 400);
  }
  if (requestedCcgNumber && await dbCcgNumberExists(requestedCcgNumber, env)) {
    return jsonResponse({ message: `CCG Number ${requestedCcgNumber} is already in use.` }, 400);
  }

  const ccgNumber = requestedCcgNumber || await generateUniqueCcgNumber(env);
  if (!ccgNumber) {
    return jsonResponse({ message: 'Unable to generate CCG Number. Please try again.' }, 500);
  }
  const primaryImageUrl = imageUrls[0];
  const privacyByUrl = new Map(imageEntriesInput.map((entry) => [entry.url, entry.isPrivate]));
  const imageEntries = imageUrls.map((url, index) => ({
    url,
    isPrivate: index === 0 ? false : Boolean(privacyByUrl.get(url)),
  }));
  const duplicate = await dbFindRecentDuplicateInventoryCreate({
    source_listing_id: sourceListingId,
    image_url: primaryImageUrl,
    title,
    category_id: categoryId,
    secondary_category_id: secondaryCategoryId,
    brand: brand || null,
    year_range: yearRange || null,
    model: model || null,
    finish: finish || null,
    purchased_date: purchasedDate,
    unit_purchase_price: unitPurchasePrice,
  }, env);
  if (duplicate) {
    return jsonResponse({
      ok: true,
      id: String(duplicate.id),
      ccgNumber: duplicate.ccg_number,
      duplicateSuppressed: true,
      message: 'Duplicate submit prevented.',
    });
  }

  const inserted = await dbCreateInventoryItems({
    source_listing_id: sourceListingId,
    ccg_number: ccgNumber,
    image_url: primaryImageUrl,
    image_urls: imageUrls.join('\n'),
    title,
    quantity,
    category_id: categoryId,
    secondary_category_id: secondaryCategoryId,
    brand: brand || null,
    queue,
    year_range: yearRange || null,
    model: model || null,
    finish: finish || null,
    repair_notes: repairNotes || null,
    original_listing_desc: originalListingDesc || null,
    video_url: videoUrl || null,
    sale_title: saleTitle || null,
    regular_price: regularPrice,
    sale_price: salePrice,
    condition: condition || null,
    allow_shipping: allowShipping ? 1 : 0,
    sales_tax_included: salesTaxIncluded ? 1 : 0,
    sale_description: saleDescription || null,
    clearance: clearance ? 1 : 0,
    bullet_1_text: bullet1Text || null,
    bullet_1_danger: bullet1Danger ? 1 : 0,
    bullet_1_highlight: bullet1Highlight ? 1 : 0,
    bullet_2_text: bullet2Text || null,
    bullet_2_danger: bullet2Danger ? 1 : 0,
    bullet_2_highlight: bullet2Highlight ? 1 : 0,
    bullet_3_text: bullet3Text || null,
    bullet_3_danger: bullet3Danger ? 1 : 0,
    bullet_3_highlight: bullet3Highlight ? 1 : 0,
    bullet_4_text: bullet4Text || null,
    bullet_4_danger: bullet4Danger ? 1 : 0,
    bullet_4_highlight: bullet4Highlight ? 1 : 0,
    bullet_5_text: bullet5Text || null,
    bullet_5_danger: bullet5Danger ? 1 : 0,
    bullet_5_highlight: bullet5Highlight ? 1 : 0,
    bullet_6_text: bullet6Text || null,
    bullet_6_danger: bullet6Danger ? 1 : 0,
    bullet_6_highlight: bullet6Highlight ? 1 : 0,
    barcode: barcode || null,
    purchased_date: purchasedDate,
    unit_purchase_price: unitPurchasePrice,
    map_price: mapPrice,
    private_party_value: privatePartyValue,
    miles,
    minutes_spent: minutesSpent,
    ship_cost: shipCost,
    purchase_notes: purchaseNotes || null,
    ai_analysis_text: aiAnalysisText || null,
    serial_number: serialNumber || null,
    weight_lbs: weightLbs || null,
    neck_profile: neckProfile || null,
    neck_thickness: neckThickness || null,
    nut_width: nutWidth || null,
    width_12_fret: width12Fret || null,
    fretboard_radius: fretboardRadius || null,
    twelve_fret_action: twelveFretAction || null,
    is_active: isActive ? 1 : 0,
    is_marked: isMarked ? 1 : 0,
    is_personal: isPersonal ? 1 : 0,
    is_rented: isRented ? 1 : 0,
    is_custom: isCustom ? 1 : 0,
    for_sale: forSale ? 1 : 0,
    only_in_store: onlyInStore ? 1 : 0,
    ...salesChannelFields,
    for_sale_date: forSale ? new Date().toISOString() : null,
    is_sold: isSold ? 1 : 0,
    sold_date: isSold ? new Date().toISOString() : null,
    sold_amount: soldAmount,
    sell_notes: sellNotes || null,
    sale_url: saleUrl || null,
    sale_zip: saleZip || null,
    merchant_center_cat_code: normalizeText(body.merchantCenterCatCode, '').slice(0, 50) || null,
  }, env);

  if (!inserted) {
    return jsonResponse({ message: 'Unable to create inventory item.' }, 500);
  }
  if (!(await dbReplaceInventoryImagesByItemIds([Number(inserted.firstId)], imageEntries, env))) {
    return jsonResponse({ message: 'Inventory item was created, but its image records failed to save.' }, 500);
  }

  await insertActivityLogBestEffort(env, {
    eventKey: 'inventory_added',
    eventText: `Inventory item ${title} added to system.`,
    eventUrl: buildAdminInventoryItemUrl(inserted.firstId),
    imageUrl: toAbsoluteSiteUrl(primaryImageUrl),
    entityType: 'inventory_item',
    entityId: inserted.firstId,
    metadata: {
      ccgNumber: inserted.ccgNumber,
      title,
    },
  });

  return jsonResponse({
    ok: true,
    id: inserted.firstId,
    ccgNumber: inserted.ccgNumber,
  });
}

export async function handleInventoryGet(path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const recordId = parts[2] || '';
  if (!recordId || recordId === 'inventory') {
    return jsonResponse({ message: 'Missing inventory ID.' }, 400);
  }

  const record = await dbGetInventoryItem(recordId, env);
  if (!record) {
    return jsonResponse({ message: 'Inventory item not found.' }, 404);
  }

  return jsonResponse({ record });
}
