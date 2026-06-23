import type { Env } from '../env.js';
import { normalizeText, normalizeUrl } from '../utils/text.js';
import { jsonResponse, parseBoundedInt, normalizeInventoryDate, toBooleanInput } from '../utils/misc.js';
import { sanitizePatternLookupHtml } from '../utils/html.js';
import { normalizeInventoryImageEntries, INVENTORY_MAX_IMAGES } from '../utils/image.js';
import { dbCreateInventoryItems, dbUpdateInventoryById, dbReplaceInventoryImagesByItemIds, dbSetInventorySoldAvailability, dbDeactivateInventoryItemById, generateUniqueCcgNumber } from './db-write.js';
import { ensureInventoryHostedImageUrls } from './db-images.js';
import { dbGetInventoryItem, dbFindInventoryBySourceListingId, dbFindInventoryBySaleUrl, dbInventoryItemHasPackageChildren } from './db-core.js';
import { dbInventoryCategoryExists } from './categories.js';
import { normalizeInventoryQueue } from './db-core.js';
import { dbFindTopLevelPackageCategoryId } from './categories.js';
import { buildAdminInventoryItemUrl, toAbsoluteSiteUrl, insertActivityLogBestEffort } from '../admin/activity.js';
import { validateForSaleInventoryFields, resolveToggleTimestamp } from './handlers.js';

import { parseCurrencyAmount } from '../utils/money.js';
import { parseOptionalPositiveInt, normalizeRequiredInventoryBarcode } from '../utils/misc.js';

export async function handleInventoryUpdate(request: Request, path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const updateIndex = parts.indexOf('update');
  const recordId = updateIndex > 0 ? parts[updateIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const sourceListingId = parseOptionalPositiveInt(body.sourceListingId);
  const imageUrl = normalizeText(body.imageUrl, '');
  const imageEntriesInput = normalizeInventoryImageEntries(imageUrl, body.images, body.imageUrls);
  const title = normalizeText(body.title, '').slice(0, 240);
  const quantity = parseBoundedInt(body.quantity ?? body.qty, 1, 0, 1_000_000);
  const categoryId = parseOptionalPositiveInt(body.categoryId);
  const secondaryCategoryId = parseOptionalPositiveInt(body.secondaryCategoryId);
  const brand = normalizeText(body.brand, '').slice(0, 120);
  const queueInput = normalizeInventoryQueue(body.queue);
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
  const purchasedDate = normalizeInventoryDate(body.purchasedDate);
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
  const soldAmount = parseCurrencyAmount(body.soldAmount);
  const qtySold = parseBoundedInt(body.qtySold, 1, 1, 1_000_000);
  const sellNotes = normalizeText(body.sellNotes, '').slice(0, 4000);
  const subscriptionId = parseOptionalPositiveInt(body.subscriptionId);
  const saleUrl = normalizeText(body.saleUrl, '').slice(0, 150);
  const saleZip = normalizeText(body.saleZip, '').slice(0, 10);
  const storageLocation = normalizeText(body.storageLocation, '').slice(0, 100);
  const soldChannel = normalizeText(body.soldChannel, '').slice(0, 100);
  const merchantCenterCatCode = normalizeText(body.merchantCenterCatCode, '').slice(0, 50) || null;
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
  if (!purchasedDate) return jsonResponse({ message: 'Purchased date is required.' }, 400);
  if (isSold && quantity < 1) return jsonResponse({ message: 'Qty must be at least 1 when marking an item sold.' }, 400);
  if (isSold && qtySold > quantity) return jsonResponse({ message: 'Qty Sold cannot be greater than Qty.' }, 400);
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

  const current = await dbGetInventoryItem(recordId, env);
  if (!current) return jsonResponse({ message: 'Inventory item not found.' }, 404);

  if (sourceListingId != null) {
    const alreadyLinked = await dbFindInventoryBySourceListingId(sourceListingId, env);
    if (alreadyLinked && String(alreadyLinked.id) !== recordId) {
      return jsonResponse({ message: 'This listing is already in inventory.' }, 400);
    }
  }

  const currentSaleUrl = normalizeText((current as { saleUrl?: unknown }).saleUrl, '');
  const saleUrlChanged = currentSaleUrl.trim().toLowerCase() !== saleUrl.trim().toLowerCase();
  if (saleUrlChanged) {
    const duplicateSaleUrl = await dbFindInventoryBySaleUrl(saleUrl, env, recordId);
    if (duplicateSaleUrl) {
      return jsonResponse({
        message: `Sale URL Slug is already used by ${duplicateSaleUrl.ccg_number || `inventory item ${duplicateSaleUrl.id}`}.`,
      }, 400);
    }
  }

  const primaryImageUrl = imageUrls[0];
  const privacyByUrl = new Map(imageEntriesInput.map((entry) => [entry.url, entry.isPrivate]));
  const imageEntries = imageUrls.map((url, index) => ({
    url,
    isPrivate: index === 0 ? false : Boolean(privacyByUrl.get(url)),
  }));
  const previousForSale = Boolean((current as { forSale?: boolean }).forSale);
  const previousQueue = normalizeInventoryQueue((current as { queue?: unknown }).queue) || 'Triage';
  const previousForSaleDate = typeof (current as { forSaleDate?: unknown }).forSaleDate === 'string'
    ? ((current as { forSaleDate?: string }).forSaleDate || null)
    : null;
  const previousIsSold = Boolean((current as { isSold?: boolean }).isSold);
  const previousSoldDate = typeof (current as { soldDate?: unknown }).soldDate === 'string'
    ? ((current as { soldDate?: string }).soldDate || null)
    : null;
  const becameSold = !previousIsSold && isSold;
  const recordIdNum = Number.parseInt(recordId, 10);
  const currentPackageId = (current as { packageId?: number | null })?.packageId ?? null;
  const hasPackageChildren = await dbInventoryItemHasPackageChildren(recordIdNum, env);
  const packageCategoryId = await dbFindTopLevelPackageCategoryId(env);
  const isPackageRow = packageCategoryId != null && categoryId === packageCategoryId;
  if (quantity > 1 && (currentPackageId != null || hasPackageChildren || isPackageRow)) {
    return jsonResponse({ message: 'Packages and package items must have Qty 1.' }, 400);
  }
  const queue = !previousForSale && forSale
    ? 'For Sale'
    : previousForSale && !forSale
      ? 'To Sell'
      : (queueInput || previousQueue);

  if (becameSold && qtySold < quantity) {
    if (currentPackageId != null || hasPackageChildren) {
      return jsonResponse({ message: 'Package inventory cannot be partially sold by quantity.' }, 400);
    }
    const remainingQuantity = quantity - qtySold;
    const remainingForSaleDate = resolveToggleTimestamp({
      previousOn: previousForSale,
      nextOn: true,
      previousTimestamp: previousForSaleDate,
    });
    const remainingUpdateOk = await dbUpdateInventoryById(recordId, {
      image_url: primaryImageUrl,
      image_urls: imageUrls.join('\n'),
      title,
      quantity: remainingQuantity,
      category_id: categoryId,
      secondary_category_id: secondaryCategoryId,
      brand: brand || null,
      queue: 'For Sale',
      year_range: yearRange || null,
      model: model || null,
      finish: finish || null,
      repair_notes: repairNotes || null,
      original_listing_desc: originalListingDesc || null,
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
      storage_location: storageLocation || null,
      is_active: isActive ? 1 : 0,
      is_marked: isMarked ? 1 : 0,
      is_personal: isPersonal ? 1 : 0,
      is_rented: isRented ? 1 : 0,
      is_custom: isCustom ? 1 : 0,
      for_sale: 1,
      only_in_store: onlyInStore ? 1 : 0,
      ...salesChannelFields,
      for_sale_date: remainingForSaleDate,
      source_listing_id: sourceListingId,
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
      is_sold: 0,
      sold_date: null,
      sold_amount: null,
      sell_notes: null,
      subscription_id: subscriptionId ?? null,
      sale_url: saleUrl || null,
      sale_zip: saleZip || null,
      sold_channel: null,
      merchant_center_cat_code: merchantCenterCatCode,
    }, env);
    if (!remainingUpdateOk) return jsonResponse({ message: 'Unable to update remaining inventory item.' }, 500);
    await dbSetInventorySoldAvailability(recordId, false, env);
    if (!(await dbReplaceInventoryImagesByItemIds([recordIdNum], imageEntries, env))) {
      return jsonResponse({ message: 'Unable to update remaining inventory item images.' }, 500);
    }

    const soldCcgNumber = await generateUniqueCcgNumber(env);
    if (!soldCcgNumber) return jsonResponse({ message: 'Unable to generate sold item CCG Number. Please try again.' }, 500);
    const soldDate = new Date().toISOString();
    const soldInsert = await dbCreateInventoryItems({
      source_listing_id: null,
      ccg_number: soldCcgNumber,
      image_url: primaryImageUrl,
      image_urls: imageUrls.join('\n'),
      title,
      quantity: qtySold,
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
      is_marked: 0,
      is_personal: isPersonal ? 1 : 0,
      is_rented: isRented ? 1 : 0,
      is_custom: isCustom ? 1 : 0,
      for_sale: 0,
      only_in_store: onlyInStore ? 1 : 0,
      ...salesChannelFields,
      for_sale_date: null,
      is_sold: 1,
      sold_date: soldDate,
      sold_amount: soldAmount,
      sell_notes: sellNotes || null,
    }, env);
    if (!soldInsert?.firstId) return jsonResponse({ message: 'Unable to create sold inventory item.' }, 500);
    const soldCloneOk = await dbUpdateInventoryById(soldInsert.firstId, {
      image_url: primaryImageUrl,
      image_urls: imageUrls.join('\n'),
      title,
      quantity: qtySold,
      category_id: categoryId,
      secondary_category_id: secondaryCategoryId,
      brand: brand || null,
      queue,
      year_range: yearRange || null,
      model: model || null,
      finish: finish || null,
      repair_notes: repairNotes || null,
      original_listing_desc: originalListingDesc || null,
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
      storage_location: storageLocation || null,
      is_active: isActive ? 1 : 0,
      is_marked: 0,
      is_personal: isPersonal ? 1 : 0,
      is_rented: isRented ? 1 : 0,
      for_sale: 0,
      only_in_store: onlyInStore ? 1 : 0,
      ...salesChannelFields,
      for_sale_date: null,
      source_listing_id: null,
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
      is_sold: 1,
      sold_date: soldDate,
      sold_amount: soldAmount,
      sell_notes: sellNotes || null,
      subscription_id: subscriptionId ?? null,
      sale_url: saleUrl || null,
      sale_zip: saleZip || null,
      sold_channel: soldChannel || null,
      merchant_center_cat_code: merchantCenterCatCode,
    }, env);
    if (!soldCloneOk) return jsonResponse({ message: 'Unable to update sold inventory item.' }, 500);
    await dbSetInventorySoldAvailability(soldInsert.firstId, true, env);
    if (!(await dbReplaceInventoryImagesByItemIds([Number(soldInsert.firstId)], imageEntries, env))) {
      return jsonResponse({ message: 'Sold inventory item was created, but its image records failed to save.' }, 500);
    }

    await insertActivityLogBestEffort(env, {
      eventKey: 'inventory_marked_sold',
      eventText: `Inventory item ${title} partially sold`,
      eventUrl: buildAdminInventoryItemUrl(soldInsert.firstId),
      imageUrl: toAbsoluteSiteUrl(primaryImageUrl),
      entityType: 'inventory_item',
      entityId: soldInsert.firstId,
      metadata: {
        title,
        sourceInventoryId: recordId,
        quantitySold: qtySold,
        quantityRemaining: remainingQuantity,
        soldCcgNumber,
      },
    });

    return jsonResponse({
      ok: true,
      splitSale: true,
      soldId: soldInsert.firstId,
      soldCcgNumber,
      quantitySold: qtySold,
      quantityRemaining: remainingQuantity,
    });
  }

  const updateOk = await dbUpdateInventoryById(recordId, {
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
    storage_location: storageLocation || null,
    is_active: isActive ? 1 : 0,
    is_marked: isMarked ? 1 : 0,
    is_personal: isPersonal ? 1 : 0,
    is_rented: isRented ? 1 : 0,
    is_custom: isCustom ? 1 : 0,
    for_sale: forSale ? 1 : 0,
    only_in_store: onlyInStore ? 1 : 0,
    ...salesChannelFields,
    for_sale_date: resolveToggleTimestamp({
      previousOn: previousForSale,
      nextOn: forSale,
      previousTimestamp: previousForSaleDate,
    }),
    source_listing_id: sourceListingId,
    video_url: videoUrl || null,
    sale_title: saleTitle || null,
    regular_price: regularPrice,
    sale_price: salePrice,
    condition: condition || null,
    allow_shipping: allowShipping ? 1 : 0,
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
    is_sold: isSold ? 1 : 0,
    sold_date: resolveToggleTimestamp({
      previousOn: previousIsSold,
      nextOn: isSold,
      previousTimestamp: previousSoldDate,
    }),
    sold_amount: soldAmount,
    sell_notes: sellNotes || null,
    subscription_id: subscriptionId ?? null,
    sale_url: saleUrl || null,
    sale_zip: saleZip || null,
    sold_channel: soldChannel || null,
    merchant_center_cat_code: merchantCenterCatCode,
  }, env);
  if (!updateOk) return jsonResponse({ message: 'Unable to update inventory item.' }, 500);
  await dbSetInventorySoldAvailability(recordId, isSold, env);
  if (!(await dbReplaceInventoryImagesByItemIds([Number.parseInt(recordId, 10)], imageEntries, env))) {
    return jsonResponse({ message: 'Unable to update inventory item images.' }, 500);
  }

  // Sold cascade logic
  if (becameSold) {
    const recordIdNum = Number.parseInt(recordId, 10);
    const currentRecord = await dbGetInventoryItem(recordId, env);
    const currentPackageId = (currentRecord as { packageId?: number | null })?.packageId ?? null;

    // Case 1: This item is a package — deactivate children
    try {
      await env.DB.prepare(
        `UPDATE ccg_inventory_items SET is_active = 0, for_sale = 0, updated_at = CURRENT_TIMESTAMP WHERE package_id = ?`
      ).bind(recordIdNum).run();
    } catch (error) {
      console.error('Failed to deactivate package children on sold', { error });
    }

    // Case 2: This item belongs to a package — handle package and siblings
    if (currentPackageId != null) {
      // Mark the package as sold and not for sale (but keep active)
      try {
        await env.DB.prepare(
          `UPDATE ccg_inventory_items SET is_sold = 1, for_sale = 0, sold_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(is_sold, 0) = 0`
        ).bind(currentPackageId).run();
      } catch (error) {
        console.error('Failed to mark parent package as sold', { error });
      }

      // Null out package_id for siblings still for sale, keep them active
      try {
        await env.DB.prepare(
          `UPDATE ccg_inventory_items SET package_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE package_id = ? AND id != ? AND COALESCE(for_sale, 0) = 1`
        ).bind(currentPackageId, recordIdNum).run();
      } catch (error) {
        console.error('Failed to unlink siblings from package', { error });
      }
    }
  }

  await insertActivityLogBestEffort(env, {
    eventKey: becameSold ? 'inventory_marked_sold' : 'inventory_updated',
    eventText: becameSold
      ? `Inventory item ${title} marked sold`
      : `Inventory item ${title} updated`,
    eventUrl: buildAdminInventoryItemUrl(recordId),
    imageUrl: toAbsoluteSiteUrl(primaryImageUrl),
    entityType: 'inventory_item',
    entityId: recordId,
    metadata: {
      title,
      soldBefore: previousIsSold,
      soldAfter: isSold,
    },
  });

  return jsonResponse({ ok: true });
}

export async function handleInventoryDelete(_request: Request, path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const deleteIndex = parts.indexOf('delete');
  const recordId = deleteIndex > 0 ? parts[deleteIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);

  const updatedCount = await dbDeactivateInventoryItemById(recordId, env);
  if (updatedCount < 1) return jsonResponse({ message: 'Inventory item not found.' }, 404);
  return jsonResponse({ ok: true, updatedCount });
}
