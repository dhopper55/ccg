import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse, parseOptionalPositiveInt } from '../utils/misc.js';
import type { PurchaseLotRow, PurchaseLotItemRow } from '../types/inventory.js';

export function parseAdminV2PurchaseLotId(path: string): number | null {
  const parts = path.split('/').filter(Boolean);
  const lotsIndex = parts.indexOf('purchased-lots');
  const rawId = lotsIndex >= 0 ? parts[lotsIndex + 1] : '';
  return parseOptionalPositiveInt(rawId);
}

export async function dbPurchaseLotExists(lotId: number, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_purchase_lots WHERE id = ? LIMIT 1'
  ).bind(lotId).first<{ id: number }>();
  return Boolean(row?.id);
}

export async function dbListPurchaseLotItems(lotId: number, env: Env): Promise<PurchaseLotItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT
       id, ccg_number, title, unit_purchase_price, private_party_value,
       CASE WHEN for_sale = 1 THEN sale_price ELSE 0 END AS for_sale_amount
     FROM ccg_inventory_items
     WHERE purchase_lot_id = ?
     ORDER BY created_at DESC`
  ).bind(lotId).all<PurchaseLotItemRow>();
  return result.results ?? [];
}

export async function dbListPurchaseLots(env: Env): Promise<PurchaseLotRow[]> {
  const result = await env.DB.prepare(
    `SELECT
       l.id, l.name, l.description, l.created_at,
       COALESCE(SUM(CASE WHEN i.is_sold = 1 AND i.is_active = 1 THEN i.sold_amount ELSE 0 END), 0) AS resale_amount,
       COALESCE(SUM(CASE WHEN i.is_active = 1 THEN i.unit_purchase_price ELSE 0 END), 0) AS total_spent_calc,
       COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.for_sale = 1 AND COALESCE(i.is_sold, 0) = 0 THEN i.sale_price ELSE 0 END), 0) AS for_sale_amount,
       COALESCE(SUM(CASE WHEN i.is_active = 1 THEN i.private_party_value ELSE 0 END), 0) AS private_party_amount
     FROM ccg_purchase_lots l
     LEFT JOIN ccg_inventory_items i ON i.purchase_lot_id = l.id
     GROUP BY l.id, l.name, l.description, l.created_at
     ORDER BY l.created_at DESC, l.id DESC`
  ).all<PurchaseLotRow>();
  return result.results ?? [];
}

export async function dbCreatePurchaseLot(
  fields: { name: string; description: string | null },
  env: Env,
): Promise<PurchaseLotRow | null> {
  try {
    const result = await env.DB.prepare(
      'INSERT INTO ccg_purchase_lots (name, description) VALUES (?, ?)'
    ).bind(fields.name, fields.description).run();
    const id = Number(result.meta?.last_row_id || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    const created = await env.DB.prepare(
      'SELECT id, name, description, created_at FROM ccg_purchase_lots WHERE id = ? LIMIT 1'
    ).bind(id).first<Omit<PurchaseLotRow, 'resale_amount' | 'total_spent_calc' | 'for_sale_amount' | 'private_party_amount'>>();
    if (!created) return null;
    return { ...created, resale_amount: 0, total_spent_calc: 0, for_sale_amount: 0, private_party_amount: 0 };
  } catch (error) {
    console.error('Purchase lot create failed', { error });
    return null;
  }
}

export async function dbUpdatePurchaseLot(
  lotId: number,
  fields: { name: string; description: string | null },
  env: Env,
): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      'UPDATE ccg_purchase_lots SET name = ?, description = ? WHERE id = ?'
    ).bind(fields.name, fields.description, lotId).run();
    return Number(result.meta?.changes || 0) > 0;
  } catch (error) {
    console.error('Purchase lot update failed', { error });
    return false;
  }
}

export async function handleAdminV2PurchaseLots(env: Env): Promise<Response> {
  const records = await dbListPurchaseLots(env);
  return jsonResponse({ records });
}

export async function handleAdminV2PurchaseLotItems(path: string, env: Env): Promise<Response> {
  const lotId = parseAdminV2PurchaseLotId(path);
  if (lotId == null) return jsonResponse({ message: 'Missing purchase lot ID.' }, 400);

  const lot = await env.DB.prepare(
    'SELECT id, name FROM ccg_purchase_lots WHERE id = ? LIMIT 1'
  ).bind(lotId).first<{ id: number; name: string }>();
  if (!lot) return jsonResponse({ message: 'Purchase lot not found.' }, 404);

  const records = await dbListPurchaseLotItems(lotId, env);
  return jsonResponse({ lot, records });
}

export async function handleAdminV2PurchaseLotCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const name = normalizeText(body.name, '').slice(0, 120);
  const description = normalizeText(body.description, '').slice(0, 4000) || null;

  if (!name) return jsonResponse({ message: 'Lot name is required.' }, 400);

  const created = await dbCreatePurchaseLot({ name, description }, env);
  if (!created) return jsonResponse({ message: 'Unable to create purchase lot.' }, 500);
  return jsonResponse({ ok: true, record: created });
}

export async function handleAdminV2PurchaseLotUpdate(request: Request, path: string, env: Env): Promise<Response> {
  const lotId = parseAdminV2PurchaseLotId(path);
  if (lotId == null) return jsonResponse({ message: 'Missing purchase lot ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const name = normalizeText(body.name, '').slice(0, 120);
  const description = normalizeText(body.description, '').slice(0, 4000) || null;

  if (!name) return jsonResponse({ message: 'Lot name is required.' }, 400);
  if (!(await dbPurchaseLotExists(lotId, env))) {
    return jsonResponse({ message: 'Purchase lot not found.' }, 404);
  }

  const updated = await dbUpdatePurchaseLot(lotId, { name, description }, env);
  if (!updated) return jsonResponse({ message: 'Unable to update purchase lot.' }, 500);
  return jsonResponse({ ok: true });
}
