// Order shipping, phase 1: EasyPost rate quotes, manual tracking entry, package templates,
// and the EasyPost test/prod + ship-from settings. Buying labels comes next.
//
// EasyPost API keys are Worker secrets (EASYPOST_API_KEY_TEST / EASYPOST_API_KEY_PROD);
// sys_info.use_easypost_test picks which one is used.
import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse, numberOrZero, parseOptionalPositiveInt } from '../utils/misc.js';
import { dbRecordOrderEvent } from './db.js';
import { logOrderError, describeError } from './manual.js';
import { markReverbOrderShipped } from '../inventory/reverb-listing.js';

const EASYPOST_API = 'https://api.easypost.com/v2';
// Statuses that mean a label exists (bought here or elsewhere).
const SHIPPED_STATUSES = ['purchased', 'manual'];
const KNOWN_CARRIERS = ['USPS', 'UPS', 'FedEx'];

// EasyPost carrier account names vary ("FedExDefault", "UPSDAP", "USPS"); group them into
// the three carriers we ship with. Anything else (DHL eCommerce, Canada Post, export
// accounts) returns null and is left out of quotes.
export function carrierFamily(carrier: string): 'USPS' | 'UPS' | 'FedEx' | null {
  const value = carrier.trim().toLowerCase();
  if (value.startsWith('usps')) return 'USPS';
  if (value.startsWith('fedex')) return 'FedEx';
  if (value.startsWith('ups')) return 'UPS';
  return null;
}

type ShipFrom = {
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

type EasyPostConfig = {
  useTest: boolean;
  apiKey: string;
  testKeyConfigured: boolean;
  prodKeyConfigured: boolean;
  shipFrom: ShipFrom;
};

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return null;
  }
}

// Validation exit: the event name documents which check rejected the request.
function reject(_event: string, message: string, status: number, _data: Record<string, unknown> = {}): Response {
  return jsonResponse({ message }, status);
}

export async function getEasyPostConfig(env: Env): Promise<EasyPostConfig> {
  const row = await env.DB.prepare(
    `SELECT use_easypost_test, ship_from_name, ship_from_company, ship_from_street1, ship_from_street2,
            ship_from_city, ship_from_state, ship_from_zip, ship_from_phone
     FROM sys_info ORDER BY id LIMIT 1`
  ).first<Record<string, unknown>>().catch(() => null);
  const useTest = row ? Number(row.use_easypost_test ?? 1) !== 0 : true;
  const testKey = normalizeText(env.EASYPOST_API_KEY_TEST, '');
  const prodKey = normalizeText(env.EASYPOST_API_KEY_PROD, '');
  return {
    useTest,
    apiKey: useTest ? testKey : prodKey,
    testKeyConfigured: Boolean(testKey),
    prodKeyConfigured: Boolean(prodKey),
    shipFrom: {
      name: normalizeText(row?.ship_from_name, ''),
      company: normalizeText(row?.ship_from_company, ''),
      street1: normalizeText(row?.ship_from_street1, ''),
      street2: normalizeText(row?.ship_from_street2, ''),
      city: normalizeText(row?.ship_from_city, ''),
      state: normalizeText(row?.ship_from_state, ''),
      zip: normalizeText(row?.ship_from_zip, ''),
      phone: normalizeText(row?.ship_from_phone, ''),
    },
  };
}

async function easyPostRequest(
  config: EasyPostConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, any> } | { ok: false; status: number; message: string }> {
  const response = await fetch(`${EASYPOST_API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${config.apiKey}:`)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok) {
    const fieldErrors = Array.isArray(data?.error?.errors)
      ? data.error.errors.map((e: any) => normalizeText(e?.message ?? e?.field, '')).filter(Boolean).join('; ')
      : '';
    const message = [normalizeText(data?.error?.message, `EasyPost request failed (${response.status})`), fieldErrors]
      .filter(Boolean).join(' — ');
    logOrderError('easypost.error', { path, status: response.status, code: data?.error?.code ?? null, message });
    return { ok: false, status: response.status, message };
  }
  return { ok: true, data };
}

// ---- Order shipping state --------------------------------------------------------------

function orderNeedsShipping(order: Record<string, unknown>): boolean {
  return normalizeText(order.fulfillment_type, '') === 'ship' || Number(order.shipping_address_required || 0) === 1;
}

export function carrierTrackingUrl(carrier: string, trackingCode: string): string | null {
  const code = encodeURIComponent(trackingCode.trim());
  if (!code) return null;
  switch (carrier.toLowerCase()) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${code}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
    default:
      return null;
  }
}

function mapShipment(row: Record<string, unknown>): Record<string, unknown> {
  const carrier = normalizeText(row.carrier, '');
  const trackingCode = normalizeText(row.tracking_code, '');
  return {
    id: Number(row.id),
    status: normalizeText(row.status, ''),
    isTest: Number(row.is_test || 0) === 1,
    carrier,
    service: normalizeText(row.service, ''),
    trackingCode,
    trackingUrl: carrierTrackingUrl(carrier, trackingCode),
    labelCostCents: row.label_cost_cents == null ? null : numberOrZero(row.label_cost_cents),
    hasLabel: Boolean(normalizeText(row.label_url, '')),
    lengthIn: row.length_in == null ? null : Number(row.length_in),
    widthIn: row.width_in == null ? null : Number(row.width_in),
    heightIn: row.height_in == null ? null : Number(row.height_in),
    weightOz: row.weight_oz == null ? null : Number(row.weight_oz),
    signatureConfirmation: Number(row.signature_confirmation || 0) === 1,
    shipDate: normalizeText(row.ship_date, ''),
    shippedAt: normalizeText(row.shipped_at, ''),
    createdAt: normalizeText(row.created_at, ''),
    channelPushStatus: normalizeText(row.channel_push_status, '') || null,
    channelPushMessage: normalizeText(row.channel_push_message, ''),
    channelPushedAt: normalizeText(row.channel_pushed_at, ''),
  };
}

export async function dbGetOrderShippingSummary(
  order: Record<string, unknown>,
  env: Env,
): Promise<Record<string, unknown>> {
  const orderId = normalizeText(order.id, '');
  const needsShipping = orderNeedsShipping(order);
  if (!needsShipping) return { needsShipping: false, shipped: false, shipment: null, labelCostCents: 0 };
  const shipped = await env.DB.prepare(
    `SELECT * FROM order_shipments
     WHERE order_id = ? AND status IN ('purchased', 'manual') AND COALESCE(tracking_code, '') <> ''
     ORDER BY id DESC LIMIT 1`
  ).bind(orderId).first<Record<string, unknown>>().catch(() => null);
  const labelCosts = await dbGetOrderLabelCostTotals([orderId], env);
  const isReverb = normalizeText(order.channel, '') === 'reverb';
  return {
    needsShipping: true,
    shipped: Boolean(shipped),
    shipment: shipped ? mapShipment(shipped) : null,
    labelCostCents: labelCosts.get(orderId) ?? 0,
    // Reverb orders get marked shipped on Reverb when a label is bought / tracking entered.
    reverb: isReverb
      ? {
        orderNumber: normalizeText(order.channel_order_ref, ''),
        // Labels bought on Reverb are already known to Reverb.
        applies: !(shipped && normalizeText(shipped.notes, '').startsWith('Label bought on Reverb')),
      }
      : null,
  };
}

// Label costs (bought here or entered manually) come off each order's net payout.
export async function dbGetOrderLabelCostTotals(orderIds: string[], env: Env): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (orderIds.length === 0) return totals;
  try {
    const result = await env.DB.prepare(
      `SELECT order_id, COALESCE(SUM(label_cost_cents), 0) AS cost
       FROM order_shipments
       WHERE order_id IN (${orderIds.map(() => '?').join(', ')})
         AND status IN (${SHIPPED_STATUSES.map(() => '?').join(', ')})
       GROUP BY order_id`
    ).bind(...orderIds, ...SHIPPED_STATUSES).all<Record<string, unknown>>();
    for (const row of result.results ?? []) {
      totals.set(normalizeText(row.order_id, ''), numberOrZero(row.cost));
    }
  } catch (error) {
    logOrderError('shipping.label_cost_totals_failed', { orderCount: orderIds.length, ...describeError(error) });
  }
  return totals;
}

async function loadShippableOrder(orderId: string, env: Env): Promise<Record<string, unknown> | Response> {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizeText(orderId, '').slice(0, 100)).first<Record<string, unknown>>();
  if (!order) return reject('shipping.order', 'Order not found.', 404, { orderId });
  if (!orderNeedsShipping(order)) return reject('shipping.order', 'This order is not marked for shipping.', 400, { orderId });
  const already = await env.DB.prepare(
    `SELECT id FROM order_shipments
     WHERE order_id = ? AND status IN ('purchased', 'manual') AND COALESCE(tracking_code, '') <> '' LIMIT 1`
  ).bind(normalizeText(order.id, '')).first<{ id: number }>();
  if (already) return reject('shipping.order', 'This order is already shipped.', 409, { orderId, shipmentId: already.id });
  return order;
}

// ---- Quote -----------------------------------------------------------------------------

function parsePackage(body: Record<string, unknown>): { lengthIn: number; widthIn: number; heightIn: number; weightOz: number } | string {
  const lengthIn = Number(body.lengthIn);
  const widthIn = Number(body.widthIn);
  const heightIn = Number(body.heightIn);
  const weightOz = Number(body.weightOz);
  const dims = [lengthIn, widthIn, heightIn];
  if (dims.some((value) => !Number.isFinite(value) || value <= 0 || value > 150)) {
    return 'Length, width and height must each be between 0 and 150 inches.';
  }
  if (!Number.isFinite(weightOz) || weightOz <= 0 || weightOz > 150 * 16) {
    return 'Weight must be more than 0 and at most 150 lb.';
  }
  return {
    lengthIn: Math.round(lengthIn * 10) / 10,
    widthIn: Math.round(widthIn * 10) / 10,
    heightIn: Math.round(heightIn * 10) / 10,
    weightOz: Math.round(weightOz * 10) / 10,
  };
}

// POST /api/admin-v2/orders/:id/shipping/quote
export async function handleAdminV2OrderShippingQuote(request: Request, orderId: string, env: Env): Promise<Response> {
  try {
    const order = await loadShippableOrder(orderId, env);
    if (order instanceof Response) return order;
    const body = await readJson(request);
    if (!body) return reject('shipping.quote', 'Invalid JSON payload.', 400, { orderId });

    const pkg = parsePackage(body);
    if (typeof pkg === 'string') return reject('shipping.quote', pkg, 400, { orderId, body });
    const signature = body.signatureConfirmation === true;
    const shipDate = normalizeText(body.shipDate, '');
    if (shipDate && !/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) return reject('shipping.quote', 'Ship date must be YYYY-MM-DD.', 400, { orderId, shipDate });
    const templateId = parseOptionalPositiveInt(body.templateId);

    const config = await getEasyPostConfig(env);
    if (!config.apiKey) {
      return reject('shipping.quote', `The EasyPost ${config.useTest ? 'test' : 'production'} API key is not set up yet.`, 503, { orderId });
    }
    const from = config.shipFrom;
    if (!from.street1 || !from.city || !from.state || !from.zip || !from.phone) {
      return reject('shipping.quote', 'Set the ship-from address and phone in System Settings first.', 503, { orderId });
    }

    const toName = normalizeText(order.shipping_name, '') || normalizeText(order.customer_name, '');
    const to = {
      name: toName,
      street1: normalizeText(order.shipping_address_line1, ''),
      street2: normalizeText(order.shipping_address_line2, ''),
      city: normalizeText(order.shipping_address_city, ''),
      state: normalizeText(order.shipping_address_state, ''),
      zip: normalizeText(order.shipping_address_postal_code, ''),
      country: normalizeText(order.shipping_address_country, '') || 'US',
      // Some UPS/FedEx services require a recipient phone; fall back to the shop's.
      phone: normalizeText(order.shipping_phone, '') || normalizeText(order.customer_phone, '') || from.phone,
    };
    if (!to.name || !to.street1 || !to.city || !to.state || !to.zip) {
      return reject('shipping.quote', 'The order is missing part of its ship-to name or address.', 400, {
        orderId,
        missing: Object.entries(to).filter(([key, value]) => !value && key !== 'street2').map(([key]) => key),
      });
    }


    // Verify the destination first: catches typos and tells us residential vs commercial.
    const verified = await easyPostRequest(config, '/addresses', { address: to, verify: ['delivery'] });
    if (!verified.ok) return jsonResponse({ message: `Address check failed: ${verified.message}` }, 502);
    const delivery = verified.data?.verifications?.delivery ?? {};
    const addressVerified = delivery.success === true;
    const verificationMessage = addressVerified
      ? ''
      : (Array.isArray(delivery.errors) ? delivery.errors.map((e: any) => normalizeText(e?.message, '')).filter(Boolean).join('; ') : '')
        || 'EasyPost could not confirm this address.';
    const residential = verified.data?.residential == null ? null : Boolean(verified.data.residential);

    const options: Record<string, unknown> = { label_format: 'PDF', label_size: '4x6' };
    if (signature) options.delivery_confirmation = 'SIGNATURE';
    if (shipDate) options.label_date = `${shipDate}T18:00:00Z`;
    const created = await easyPostRequest(config, '/shipments', {
      shipment: {
        to_address: { id: verified.data.id },
        from_address: {
          name: from.name,
          company: from.company,
          street1: from.street1,
          street2: from.street2,
          city: from.city,
          state: from.state,
          zip: from.zip,
          country: 'US',
          phone: from.phone,
        },
        parcel: { length: pkg.lengthIn, width: pkg.widthIn, height: pkg.heightIn, weight: pkg.weightOz },
        options,
        reference: normalizeText(order.order_number, ''),
      },
    });
    if (!created.ok) return jsonResponse({ message: `Getting rates failed: ${created.message}` }, 502);

    const rates = (Array.isArray(created.data.rates) ? created.data.rates : [])
      .filter((rate: any) => carrierFamily(normalizeText(rate.carrier, '')) != null)
      .map((rate: any) => ({
        id: normalizeText(rate.id, ''),
        carrier: carrierFamily(normalizeText(rate.carrier, '')) as string,
        carrierAccount: normalizeText(rate.carrier, ''),
        service: normalizeText(rate.service, ''),
        rateCents: Math.round(Number(rate.rate) * 100),
        deliveryDays: rate.delivery_days == null ? null : Number(rate.delivery_days),
        deliveryDate: normalizeText(rate.delivery_date, ''),
      }))
      .filter((rate: { rateCents: number }) => Number.isFinite(rate.rateCents))
      .sort((a: { rateCents: number }, b: { rateCents: number }) => a.rateCents - b.rateCents);
    // Carrier-level problems come back as messages; only USPS / UPS / FedEx ones matter here.
    const carrierMessages = (Array.isArray(created.data.messages) ? created.data.messages : [])
      .filter((m: any) => carrierFamily(normalizeText(m?.carrier, '')) != null)
      .map((m: any) => `${carrierFamily(normalizeText(m?.carrier, ''))}: ${normalizeText(m?.message, '')}`)
      .filter(Boolean);

    const insert = await env.DB.prepare(
      `INSERT INTO order_shipments (
         order_id, status, is_test, template_id, length_in, width_in, height_in, weight_oz,
         signature_confirmation, ship_date, easypost_shipment_id, to_address_verified,
         to_address_residential, verification_message, rates_json
       ) VALUES (?, 'quoted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      normalizeText(order.id, ''),
      config.useTest ? 1 : 0,
      templateId,
      pkg.lengthIn,
      pkg.widthIn,
      pkg.heightIn,
      pkg.weightOz,
      signature ? 1 : 0,
      shipDate || null,
      normalizeText(created.data.id, ''),
      addressVerified ? 1 : 0,
      residential == null ? null : residential ? 1 : 0,
      verificationMessage || null,
      JSON.stringify({ rates, carrierMessages }),
    ).run();

    return jsonResponse({
      ok: true,
      shipmentId: Number(insert.meta?.last_row_id || 0) || null,
      mode: config.useTest ? 'test' : 'prod',
      address: { verified: addressVerified, residential, message: verificationMessage },
      rates,
      carrierMessages,
    });
  } catch (error) {
    logOrderError('shipping.quote.failed', { orderId, ...describeError(error) });
    return jsonResponse({ message: `Getting rates failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
}

// ---- Buy label -------------------------------------------------------------------------

// POST /api/admin-v2/orders/:id/shipping/buy  { shipmentId, rateId }
// Buys one of the rates from a saved quote and marks the order shipped.
export async function handleAdminV2OrderShippingBuy(request: Request, orderId: string, env: Env): Promise<Response> {
  try {
    const order = await loadShippableOrder(orderId, env);
    if (order instanceof Response) return order;
    const body = await readJson(request);
    if (!body) return reject('shipping.buy', 'Invalid JSON payload.', 400, { orderId });
    const shipmentId = parseOptionalPositiveInt(body.shipmentId);
    const rateId = normalizeText(body.rateId, '');
    if (!shipmentId || !rateId) return reject('shipping.buy', 'Pick a rate first.', 400, { orderId });

    const quote = await env.DB.prepare('SELECT * FROM order_shipments WHERE id = ? AND order_id = ? LIMIT 1')
      .bind(shipmentId, normalizeText(order.id, '')).first<Record<string, unknown>>();
    if (!quote) return reject('shipping.buy', 'That quote was not found. Get rates again.', 404, { orderId, shipmentId });
    if (normalizeText(quote.status, '') !== 'quoted') {
      return reject('shipping.buy', 'That quote has already been used. Get rates again.', 409, { orderId, shipmentId });
    }
    const easypostShipmentId = normalizeText(quote.easypost_shipment_id, '');
    let quotedRates: Array<{ id: string; carrier: string; service: string; rateCents: number }> = [];
    try {
      quotedRates = (JSON.parse(normalizeText(quote.rates_json, '{}')) as { rates?: typeof quotedRates }).rates ?? [];
    } catch {
      quotedRates = [];
    }
    const quotedRate = quotedRates.find((rate) => rate.id === rateId);
    if (!easypostShipmentId || !quotedRate) {
      return reject('shipping.buy', 'That rate is not part of this quote. Get rates again.', 400, { orderId, shipmentId, rateId });
    }

    const config = await getEasyPostConfig(env);
    const quoteIsTest = Number(quote.is_test || 0) === 1;
    if (quoteIsTest !== config.useTest) {
      return reject('shipping.buy', `This quote was made in ${quoteIsTest ? 'test' : 'production'} mode, but EasyPost is now set to ${config.useTest ? 'test' : 'production'}. Get rates again.`, 409, { orderId, shipmentId });
    }
    if (!config.apiKey) {
      return reject('shipping.buy', `The EasyPost ${config.useTest ? 'test' : 'production'} API key is not set up yet.`, 503, { orderId });
    }

    const bought = await easyPostRequest(config, `/shipments/${encodeURIComponent(easypostShipmentId)}/buy`, { rate: { id: rateId } });
    if (!bought.ok) return jsonResponse({ message: `Buying the label failed: ${bought.message}` }, 502);

    const selected = bought.data.selected_rate ?? {};
    const trackingCode = normalizeText(bought.data.tracking_code, '');
    const carrier = carrierFamily(normalizeText(selected.carrier, '')) || normalizeText(selected.carrier, '') || quotedRate.carrier;
    const service = normalizeText(selected.service, '') || quotedRate.service;
    // What EasyPost actually billed is in `fees` (postage + label + insurance). selected_rate.rate
    // can be re-rated by the carrier after purchase (seen with FedEx) and isn't the charge.
    const chargedFees = (Array.isArray(bought.data.fees) ? bought.data.fees : [])
      .filter((fee: any) => fee?.charged === true && fee?.refunded !== true);
    const feesCents = chargedFees.reduce((sum: number, fee: any) => sum + Math.round(Number(fee?.amount || 0) * 100), 0);
    const selectedRateCents = Number.isFinite(Number(selected.rate)) ? Math.round(Number(selected.rate) * 100) : null;
    const paidCents = chargedFees.length > 0 ? feesCents : selectedRateCents ?? quotedRate.rateCents;
    // Keep the carrier's post-purchase rate on record when it differs from what was charged.
    const reratedNote = selectedRateCents != null && selectedRateCents !== paidCents
      ? `Quoted $${(quotedRate.rateCents / 100).toFixed(2)}, charged $${(paidCents / 100).toFixed(2)}; carrier rate after purchase $${(selectedRateCents / 100).toFixed(2)}.`
      : '';
    const labelUrl = normalizeText(bought.data.postage_label?.label_url, '');
    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE order_shipments
       SET status = 'purchased', carrier = ?, service = ?, tracking_code = ?, label_cost_cents = ?,
           label_url = ?, notes = ?, shipped_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(carrier, service, trackingCode || null, paidCents, labelUrl || null, reratedNote || null, now, now, shipmentId).run();
    await dbRecordOrderEvent(normalizeText(order.id, ''), {
      eventType: 'shipment_purchased',
      fromStatus: normalizeText(order.status, ''),
      toStatus: normalizeText(order.status, ''),
      source: 'admin_v2',
      sourceId: easypostShipmentId,
      message: `${config.useTest ? '[TEST] ' : ''}Bought ${carrier} ${service} label for $${(paidCents / 100).toFixed(2)}, tracking ${trackingCode || '(none)'}.`,
      payloadJson: JSON.stringify({
        shipmentId,
        easypostShipmentId,
        rateId,
        carrier,
        service,
        quotedCents: quotedRate.rateCents,
        paidCents,
        selectedRateCents,
        fees: chargedFees.map((fee: any) => ({ type: fee?.type, amount: fee?.amount })),
        trackingCode,
        isTest: config.useTest,
      }),
    }, env);

    if (!trackingCode) {
      // Paid for, but no tracking number came back: keep it visible rather than silently "shipped".
      logOrderError('shipping.buy.no_tracking', { orderId, shipmentId, easypostShipmentId });
      return jsonResponse({ message: 'The label was bought, but EasyPost returned no tracking number. Check the EasyPost dashboard.' }, 502);
    }
    const reverb = config.useTest ? null : await pushShipmentToReverb(normalizeText(order.id, ''), shipmentId, env);
    return jsonResponse({
      ok: true,
      carrier,
      service,
      trackingCode,
      labelCostCents: paidCents,
      isTest: config.useTest,
      reverb: reverb && reverb.status !== 'skipped' ? reverb : null,
    });
  } catch (error) {
    logOrderError('shipping.buy.failed', { orderId, ...describeError(error) });
    return jsonResponse({ message: `Buying the label failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
}

// ---- Mark shipped on Reverb ------------------------------------------------------------

// Tells Reverb the order shipped (carrier + tracking, buyer notified). Never throws: the label
// is already paid for, so a failure is recorded on the shipment for a Retry instead.
export async function pushShipmentToReverb(
  orderId: string,
  shipmentId: number,
  env: Env,
): Promise<{ status: 'pushed' | 'failed' | 'skipped'; message: string }> {
  try {
    const order = await env.DB.prepare('SELECT id, channel, channel_order_ref, status FROM orders WHERE id = ? LIMIT 1')
      .bind(orderId).first<Record<string, unknown>>();
    if (!order || normalizeText(order.channel, '') !== 'reverb') return { status: 'skipped', message: 'Not a Reverb order.' };
    const shipment = await env.DB.prepare('SELECT * FROM order_shipments WHERE id = ? AND order_id = ? LIMIT 1')
      .bind(shipmentId, orderId).first<Record<string, unknown>>();
    if (!shipment) return { status: 'skipped', message: 'Shipment not found.' };
    if (Number(shipment.is_test || 0) === 1) return { status: 'skipped', message: 'Test labels are never sent to Reverb.' };
    if (normalizeText(shipment.notes, '').startsWith('Label bought on Reverb')) {
      return { status: 'skipped', message: 'Label was bought on Reverb.' };
    }

    const record = async (status: 'pushed' | 'failed', message: string) => {
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE order_shipments SET channel_push_status = ?, channel_push_message = ?, channel_pushed_at = ?, updated_at = ?
         WHERE id = ?`
      ).bind(status, message || null, status === 'pushed' ? now : null, now, shipmentId).run();
      await dbRecordOrderEvent(orderId, {
        eventType: status === 'pushed' ? 'reverb_marked_shipped' : 'reverb_mark_shipped_failed',
        fromStatus: normalizeText(order.status, ''),
        toStatus: normalizeText(order.status, ''),
        source: 'admin_v2',
        sourceId: normalizeText(order.channel_order_ref, ''),
        message: status === 'pushed' ? 'Marked shipped on Reverb; buyer notified.' : `Reverb not updated: ${message}`,
        payloadJson: JSON.stringify({ shipmentId, status, message }),
      }, env);
      return { status, message };
    };

    const orderNumber = normalizeText(order.channel_order_ref, '');
    if (!orderNumber) return record('failed', 'This order has no Reverb order number.');
    const trackingNumber = normalizeText(shipment.tracking_code, '');
    if (!trackingNumber) return record('failed', 'The shipment has no tracking number.');
    const provider = carrierFamily(normalizeText(shipment.carrier, '')) || normalizeText(shipment.carrier, '');

    const result = await markReverbOrderShipped(orderNumber, { provider, trackingNumber, sendNotification: true }, env);
    return result.ok ? record('pushed', '') : record('failed', result.message);
  } catch (error) {
    logOrderError('shipping.reverb_push_failed', { orderId, shipmentId, ...describeError(error) });
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

// POST /api/admin-v2/orders/:id/shipping/reverb  { channelOrderRef? }
// Retry (or first attempt) of marking the shipped order shipped on Reverb. A Reverb order #
// can be supplied for orders entered by hand without one.
export async function handleAdminV2OrderShippingReverbPush(request: Request, orderId: string, env: Env): Promise<Response> {
  const body = (await readJson(request)) ?? {};
  const order = await env.DB.prepare('SELECT id, channel, channel_order_ref FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizeText(orderId, '').slice(0, 100)).first<Record<string, unknown>>();
  if (!order) return reject('shipping.reverb_push', 'Order not found.', 404, { orderId });
  if (normalizeText(order.channel, '') !== 'reverb') return reject('shipping.reverb_push', 'This is not a Reverb order.', 400, { orderId });
  const ref = normalizeText(body.channelOrderRef, '').replace(/^#/, '').slice(0, 40);
  if (ref && ref !== normalizeText(order.channel_order_ref, '')) {
    await env.DB.prepare('UPDATE orders SET channel_order_ref = ?, updated_at = ? WHERE id = ?')
      .bind(ref, new Date().toISOString(), normalizeText(order.id, '')).run();
  }
  const shipment = await env.DB.prepare(
    `SELECT id FROM order_shipments
     WHERE order_id = ? AND status IN ('purchased', 'manual') AND COALESCE(tracking_code, '') <> ''
     ORDER BY id DESC LIMIT 1`
  ).bind(normalizeText(order.id, '')).first<{ id: number }>();
  if (!shipment) return reject('shipping.reverb_push', 'The order is not shipped yet.', 400, { orderId });
  const result = await pushShipmentToReverb(normalizeText(order.id, ''), shipment.id, env);
  if (result.status === 'pushed') return jsonResponse({ ok: true });
  return jsonResponse({ message: result.status === 'skipped' ? result.message : `Reverb not updated: ${result.message}` }, result.status === 'skipped' ? 400 : 502);
}

// ---- Label download --------------------------------------------------------------------

// GET /api/admin-v2/orders/:id/shipping/label
// Streams the shipped label's PDF back as a download. EasyPost hosts label files on S3, which
// a browser won't download (with a filename) straight from a cross-origin link.
export async function handleAdminV2OrderShippingLabel(orderId: string, env: Env): Promise<Response> {
  try {
    const shipment = await env.DB.prepare(
      `SELECT id, carrier, tracking_code, label_url FROM order_shipments
       WHERE order_id = ? AND status = 'purchased' AND COALESCE(label_url, '') <> ''
       ORDER BY id DESC LIMIT 1`
    ).bind(normalizeText(orderId, '').slice(0, 100)).first<Record<string, unknown>>();
    if (!shipment) return jsonResponse({ message: 'This order has no label to download.' }, 404);

    const labelUrl = normalizeText(shipment.label_url, '');
    const file = await fetch(labelUrl);
    if (!file.ok) {
      logOrderError('shipping.label_download_failed', { orderId, shipmentId: shipment.id, status: file.status });
      return jsonResponse({ message: `Could not fetch the label file (HTTP ${file.status}).` }, 502);
    }
    const tracking = normalizeText(shipment.tracking_code, '').replace(/[^A-Za-z0-9]/g, '') || String(shipment.id);
    const extension = (labelUrl.split('?')[0].match(/\.(pdf|png|zpl)$/i)?.[1] || 'pdf').toLowerCase();
    return new Response(file.body, {
      status: 200,
      headers: {
        'content-type': file.headers.get('content-type') || (extension === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
        'content-disposition': `attachment; filename="label-${normalizeText(shipment.carrier, 'carrier')}-${tracking}.${extension}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    logOrderError('shipping.label_download_failed', { orderId, ...describeError(error) });
    return jsonResponse({ message: `Downloading the label failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
}

// ---- Manual tracking -------------------------------------------------------------------

// POST /api/admin-v2/orders/:id/shipping/manual
export async function handleAdminV2OrderShippingManual(request: Request, orderId: string, env: Env): Promise<Response> {
  try {
    const order = await loadShippableOrder(orderId, env);
    if (order instanceof Response) return order;
    const body = await readJson(request);
    if (!body) return reject('shipping.manual', 'Invalid JSON payload.', 400, { orderId });

    const carrierInput = normalizeText(body.carrier, '');
    const carrier = KNOWN_CARRIERS.find((known) => known.toLowerCase() === carrierInput.toLowerCase()) || carrierInput.slice(0, 40);
    const trackingCode = normalizeText(body.trackingCode, '').replace(/\s+/g, '').toUpperCase().slice(0, 60);
    if (!carrier) return reject('shipping.manual', 'Choose the carrier.', 400, { orderId });
    if (!trackingCode) return reject('shipping.manual', 'Enter the tracking number.', 400, { orderId });
    const labelCostCents = body.labelCostCents == null || body.labelCostCents === '' ? null : numberOrZero(body.labelCostCents);
    const now = new Date().toISOString();

    const manualInsert = await env.DB.prepare(
      `INSERT INTO order_shipments (order_id, status, is_test, carrier, tracking_code, label_cost_cents, notes, shipped_at)
       VALUES (?, 'manual', 0, ?, ?, ?, ?, ?)`
    ).bind(
      normalizeText(order.id, ''),
      carrier,
      trackingCode,
      labelCostCents,
      normalizeText(body.notes, '').slice(0, 1000) || null,
      now,
    ).run();
    await dbRecordOrderEvent(normalizeText(order.id, ''), {
      eventType: 'shipment_manual',
      fromStatus: normalizeText(order.status, ''),
      toStatus: normalizeText(order.status, ''),
      source: 'admin_v2',
      sourceId: trackingCode,
      message: `Marked shipped via ${carrier}, tracking ${trackingCode}${labelCostCents != null ? ` (label $${(labelCostCents / 100).toFixed(2)})` : ''}.`,
      payloadJson: JSON.stringify({ carrier, trackingCode, labelCostCents }),
    }, env);
    const manualShipmentId = Number(manualInsert.meta?.last_row_id || 0);
    const reverb = manualShipmentId ? await pushShipmentToReverb(normalizeText(order.id, ''), manualShipmentId, env) : null;
    return jsonResponse({ ok: true, reverb: reverb && reverb.status !== 'skipped' ? reverb : null });
  } catch (error) {
    logOrderError('shipping.manual.failed', { orderId, ...describeError(error) });
    return jsonResponse({ message: `Saving tracking failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
}

// ---- Package templates -----------------------------------------------------------------

// GET /api/admin-v2/shipping/templates
export async function handleAdminV2ShippingTemplates(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT id, name, length_in, width_in, height_in, weight_oz FROM shipping_package_templates ORDER BY name COLLATE NOCASE'
  ).all<Record<string, unknown>>();
  return jsonResponse({
    records: (result.results ?? []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: normalizeText(row.name, ''),
      lengthIn: Number(row.length_in),
      widthIn: Number(row.width_in),
      heightIn: Number(row.height_in),
      weightOz: Number(row.weight_oz),
    })),
  });
}

// POST /api/admin-v2/shipping/templates
export async function handleAdminV2ShippingTemplateCreate(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return reject('shipping.template', 'Invalid JSON payload.', 400);
  const name = normalizeText(body.name, '').slice(0, 80);
  if (!name) return reject('shipping.template', 'Give the template a name.', 400);
  const pkg = parsePackage(body);
  if (typeof pkg === 'string') return reject('shipping.template', pkg, 400, { name });
  const existing = await env.DB.prepare('SELECT id FROM shipping_package_templates WHERE LOWER(name) = LOWER(?) LIMIT 1')
    .bind(name).first<{ id: number }>();
  if (existing) return reject('shipping.template', 'A template with that name already exists.', 409, { name });
  const insert = await env.DB.prepare(
    'INSERT INTO shipping_package_templates (name, length_in, width_in, height_in, weight_oz) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, pkg.lengthIn, pkg.widthIn, pkg.heightIn, pkg.weightOz).run();
  const id = Number(insert.meta?.last_row_id || 0);
  return jsonResponse({ ok: true, record: { id, name, ...pkg } });
}

// ---- Settings --------------------------------------------------------------------------

// GET /api/admin-v2/easypost-config
export async function handleAdminV2EasyPostConfig(env: Env): Promise<Response> {
  const config = await getEasyPostConfig(env);
  return jsonResponse({
    useTest: config.useTest,
    testKeyConfigured: config.testKeyConfigured,
    prodKeyConfigured: config.prodKeyConfigured,
    shipFrom: config.shipFrom,
  });
}

// POST /api/admin-v2/easypost-config  { useTest?, shipFrom? }
export async function handleAdminV2EasyPostConfigUpdate(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return reject('easypost.config', 'Invalid JSON payload.', 400);
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (typeof body.useTest === 'boolean') {
    sets.push('use_easypost_test = ?');
    binds.push(body.useTest ? 1 : 0);
  }
  if (body.shipFrom && typeof body.shipFrom === 'object') {
    const from = body.shipFrom as Record<string, unknown>;
    const fields: Array<[keyof ShipFrom, string, number]> = [
      ['name', 'ship_from_name', 100],
      ['company', 'ship_from_company', 100],
      ['street1', 'ship_from_street1', 120],
      ['street2', 'ship_from_street2', 120],
      ['city', 'ship_from_city', 80],
      ['state', 'ship_from_state', 2],
      ['zip', 'ship_from_zip', 10],
      ['phone', 'ship_from_phone', 20],
    ];
    for (const [key, column, max] of fields) {
      let value = normalizeText(from[key], '').slice(0, max);
      if (key === 'state') value = value.toUpperCase();
      if (key === 'phone') value = value.replace(/\D/g, '');
      sets.push(`${column} = ?`);
      binds.push(value || null);
    }
  }
  if (sets.length === 0) return reject('easypost.config', 'Nothing to update.', 400);
  await env.DB.prepare(
    `UPDATE sys_info SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM sys_info ORDER BY id LIMIT 1)`
  ).bind(...binds).run();
  return handleAdminV2EasyPostConfig(env);
}
