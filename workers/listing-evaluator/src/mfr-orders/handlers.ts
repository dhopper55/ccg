import type { Env } from '../env.js';
import { jsonResponse, normalizeText, normalizeInventoryDate, currentDateYmd } from '../utils/misc.js';
import { parseCurrencyAmount } from '../utils/money.js';
import { normalizeMfrOrderFileName, extensionFromFileName, extensionFromContentType, escapeHeaderFileName } from '../utils/image.js';
import { ALLOWED_MFR_CODES } from '../constants.js';

export async function handleAdminV2MfrOrders(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT
       o.id,
       o.po_number,
       o.mfr_code,
       o.order_date,
       o.notes,
       o.line_items_total,
       o.shipping_cost,
       o.other_cost,
       o.sales_tax,
       o.total,
       o.created_at,
       o.updated_at,
       COUNT(f.id) AS file_count
     FROM mfr_order o
     LEFT JOIN mfr_order_file f ON f.mfr_order_id = o.id
     GROUP BY o.id
     ORDER BY o.order_date DESC, o.id DESC`
  ).all<Record<string, unknown>>();

  return jsonResponse({
    records: (result.results ?? []).map(mapMfrOrderRow),
  });
}

export async function handleAdminV2MfrOrderCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const poNumber = normalizeText(body.poNumber, '').slice(0, 50);
  const mfrCode = normalizeText(body.mfrCode, '').slice(0, 50);
  const orderDate = normalizeInventoryDate(normalizeText(body.orderDate, '')) || currentDateYmd();
  const notes = normalizeText(body.notes, '').slice(0, 12000);
  const lineItemsTotal = parseCurrencyAmount(body.lineItemsTotal) ?? 0;
  const shippingCost = parseCurrencyAmount(body.shippingCost) ?? 0;
  const otherCost = parseCurrencyAmount(body.otherCost) ?? 0;
  const salesTax = parseCurrencyAmount(body.salesTax) ?? 0;
  const submittedTotal = parseCurrencyAmount(body.total);
  const calculatedTotal = lineItemsTotal + shippingCost + otherCost + salesTax;
  const total = submittedTotal ?? calculatedTotal;

  if (!poNumber) return jsonResponse({ message: 'PO Number is required.' }, 400);
  if (!mfrCode) return jsonResponse({ message: 'MFR Code is required.' }, 400);
  if (!ALLOWED_MFR_CODES.has(mfrCode)) return jsonResponse({ message: 'MFR Code is invalid.' }, 400);
  if ([lineItemsTotal, shippingCost, otherCost, salesTax, total].some((value) => value < 0)) {
    return jsonResponse({ message: 'Amounts cannot be negative.' }, 400);
  }

  const nowIso = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO mfr_order (
       po_number,
       mfr_code,
       order_date,
       notes,
       line_items_total,
       shipping_cost,
       other_cost,
       sales_tax,
       total,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    poNumber,
    mfrCode,
    orderDate,
    notes || null,
    lineItemsTotal,
    shippingCost,
    otherCost,
    salesTax,
    total,
    nowIso,
    nowIso,
  ).run();

  return jsonResponse({
    ok: true,
    id: Number(result.meta?.last_row_id || 0),
  });
}

export async function handleAdminV2MfrOrderFiles(orderId: number, env: Env): Promise<Response> {
  if (!(await dbMfrOrderExists(orderId, env))) {
    return jsonResponse({ message: 'Manufacturer order not found.' }, 404);
  }
  const files = await dbListMfrOrderFiles(orderId, env);
  return jsonResponse({ records: files.map(mapMfrOrderFileRow) });
}

export async function handleAdminV2MfrOrderFileUpload(request: Request, orderId: number, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'File uploads are not configured.' }, 500);
  }
  if (!(await dbMfrOrderExists(orderId, env))) {
    return jsonResponse({ message: 'Manufacturer order not found.' }, 404);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return jsonResponse({ message: 'File is required.' }, 400);
  }
  if (file.size > 25 * 1024 * 1024) {
    return jsonResponse({ message: 'Files must be 25MB or smaller.' }, 400);
  }

  const originalFileName = normalizeMfrOrderFileName(file.name);
  const contentType = normalizeText(file.type, 'application/octet-stream') || 'application/octet-stream';
  const ext = extensionFromFileName(originalFileName) || extensionFromContentType(contentType);
  const fileId = crypto.randomUUID();
  const key = `mfr-orders/${orderId}/${new Date().toISOString().slice(0, 10)}/${fileId}.${ext}`;
  const body = await file.arrayBuffer();
  await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      fileName: originalFileName,
      orderId: String(orderId),
    },
  });

  const nowIso = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO mfr_order_file (
       id,
       mfr_order_id,
       r2_key,
       file_name,
       content_type,
       file_size,
       uploaded_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(fileId, orderId, key, originalFileName, contentType, file.size, nowIso).run();

  return jsonResponse({ ok: true, file: mapMfrOrderFileRow({
    id: fileId,
    mfr_order_id: orderId,
    r2_key: key,
    file_name: originalFileName,
    content_type: contentType,
    file_size: file.size,
    uploaded_at: nowIso,
  }) });
}

export async function handleAdminV2MfrOrderFileOpen(fileId: string, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'File storage is not configured.' }, 500);
  }
  const row = await dbGetMfrOrderFile(fileId, env);
  if (!row) return jsonResponse({ message: 'File not found.' }, 404);
  const key = normalizeText(row.r2_key, '');
  if (!key.startsWith('mfr-orders/')) return jsonResponse({ message: 'Invalid file key.' }, 400);

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) return jsonResponse({ message: 'File not found.' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=300');
  headers.set('content-type', normalizeText(row.content_type, '') || headers.get('content-type') || 'application/octet-stream');
  headers.set('content-disposition', `inline; filename="${escapeHeaderFileName(normalizeText(row.file_name, 'mfr-order-file'))}"`);
  return new Response(object.body, { headers });
}

export async function handleAdminV2MfrOrderFileDelete(fileId: string, env: Env): Promise<Response> {
  const row = await dbGetMfrOrderFile(fileId, env);
  if (!row) return jsonResponse({ message: 'File not found.' }, 404);
  const key = normalizeText(row.r2_key, '');
  if (env.CUSTOM_ITEMS_BUCKET && key.startsWith('mfr-orders/')) {
    await env.CUSTOM_ITEMS_BUCKET.delete(key);
  }
  await env.DB.prepare('DELETE FROM mfr_order_file WHERE id = ?').bind(fileId).run();
  return jsonResponse({ ok: true });
}

export function mapMfrOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    poNumber: normalizeText(row.po_number, ''),
    mfrCode: normalizeText(row.mfr_code, ''),
    orderDate: normalizeText(row.order_date, ''),
    notes: normalizeText(row.notes, ''),
    lineItemsTotal: Number(row.line_items_total || 0),
    shippingCost: Number(row.shipping_cost || 0),
    otherCost: Number(row.other_cost || 0),
    salesTax: Number(row.sales_tax || 0),
    total: Number(row.total || 0),
    fileCount: Number(row.file_count || 0),
    createdAt: normalizeText(row.created_at, ''),
    updatedAt: normalizeText(row.updated_at, ''),
  };
}

export function mapMfrOrderFileRow(row: Record<string, unknown>): Record<string, unknown> {
  const id = normalizeText(row.id, '');
  return {
    id,
    orderId: Number(row.mfr_order_id || 0),
    fileName: normalizeText(row.file_name, 'File'),
    contentType: normalizeText(row.content_type, 'application/octet-stream'),
    fileSize: Number(row.file_size || 0),
    uploadedAt: normalizeText(row.uploaded_at, ''),
    url: `/api/admin-v2/mfr-orders/files/${encodeURIComponent(id)}`,
  };
}

export async function dbMfrOrderExists(orderId: number, env: Env): Promise<boolean> {
  if (!Number.isFinite(orderId) || orderId <= 0) return false;
  const row = await env.DB.prepare('SELECT id FROM mfr_order WHERE id = ? LIMIT 1')
    .bind(orderId)
    .first<{ id: number | null }>();
  return Boolean(row?.id);
}

export async function dbListMfrOrderFiles(orderId: number, env: Env): Promise<Record<string, unknown>[]> {
  const result = await env.DB.prepare(
    `SELECT *
     FROM mfr_order_file
     WHERE mfr_order_id = ?
     ORDER BY uploaded_at DESC, file_name ASC`
  ).bind(orderId).all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function dbGetMfrOrderFile(fileId: string, env: Env): Promise<Record<string, unknown> | null> {
  const id = normalizeText(fileId, '');
  if (!id) return null;
  const row = await env.DB.prepare('SELECT * FROM mfr_order_file WHERE id = ? LIMIT 1')
    .bind(id)
    .first<Record<string, unknown>>();
  return row || null;
}
