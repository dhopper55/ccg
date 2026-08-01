import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText, normalizeEmailAddress } from '../utils/text.js';
import { getBrevoRuntimeConfig } from '../system/runtime.js';
import { sendGuitarEvalReportReadyEmail } from './report.js';
import { generateGuitarEvalReportPdf } from './pdf.js';

export async function handleAdminV2ValueReportItem(id: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, created_at, first_name, last_name, email, brand, brand_other, model,
            serial_number, includes_case, color_finish, location, note, damage, type, curiosity_reason,
            authenticity_report_data,
            stripe_payment_intent_id, fulfilled, image_keys, report_guid, report_r2_key, report_error, report_cost
     FROM guitar_evaluations WHERE id = ?`
  ).bind(id).first<{
    id: number;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    brand: string | null;
    brand_other: string | null;
    model: string | null;
    serial_number: string | null;
    includes_case: string | null;
    color_finish: string | null;
    location: string | null;
    note: string | null;
    damage: string | null;
    type: string | null;
    curiosity_reason: string | null;
    authenticity_report_data: string | null;
    stripe_payment_intent_id: string | null;
    fulfilled: number;
    image_keys: string | null;
    report_guid: string | null;
    report_r2_key: string | null;
    report_error: string | null;
    report_cost: number | null;
  }>();

  if (!row) return jsonResponse({ message: 'Value report not found.' }, 404);

  let imageUrls: string[] = [];
  if (row.image_keys) {
    try {
      const keys: string[] = JSON.parse(row.image_keys);
      imageUrls = keys.map((key) => `/api/guitar-evaluation-image?key=${encodeURIComponent(key)}`);
    } catch { /* ignore malformed */ }
  }

  let authenticityReportData: unknown = null;
  if (row.authenticity_report_data) {
    try {
      authenticityReportData = JSON.parse(row.authenticity_report_data);
    } catch { /* ignore malformed */ }
  }

  return jsonResponse({
    record: {
      id: row.id,
      createdAt: row.created_at,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      brand: row.brand,
      brandOther: row.brand_other,
      model: row.model,
      serialNumber: row.serial_number,
      includesCase: row.includes_case,
      colorFinish: row.color_finish,
      location: row.location,
      note: row.note,
      damage: row.damage,
      type: row.type,
      curiosityReason: row.curiosity_reason,
      authenticityReportData,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      fulfilled: row.fulfilled,
      imageUrls,
      reportGuid: row.report_guid,
      reportR2Key: row.report_r2_key,
      reportError: row.report_error,
      reportCost: row.report_cost,
    },
  });
}

export async function handleAdminV2ValueReportFulfilledUpdate(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ fulfilled: boolean }>();
  const fulfilled = body.fulfilled ? 1 : 0;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE guitar_evaluations
     SET fulfilled = ?, fulfilment_date = CASE WHEN ? = 1 THEN ? ELSE fulfilment_date END
     WHERE id = ?`
  ).bind(fulfilled, fulfilled, now, id).run();
  return jsonResponse({ ok: true });
}

export async function handleAdminV2ValueReportDelete(evaluationId: string, env: Env): Promise<Response> {
  const id = parseInt(evaluationId, 10);
  if (isNaN(id)) return jsonResponse({ message: 'Invalid evaluation ID.' }, 400);

  if (!env.CUSTOM_ITEMS_BUCKET) return jsonResponse({ message: 'File storage is not configured.' }, 500);

  // Load image_keys (from customer-uploaded photos via upload-images endpoint)
  const evalRow = await env.DB.prepare(
    `SELECT id, image_keys FROM guitar_evaluations WHERE id = ?`
  ).bind(id).first<{ id: number; image_keys: string | null }>();
  if (!evalRow) return jsonResponse({ message: 'Evaluation not found.' }, 404);

  // Delete customer-uploaded images from R2
  if (evalRow.image_keys) {
    let keys: string[] = [];
    try { keys = JSON.parse(evalRow.image_keys); } catch { /* ignore */ }
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith('guitar-eval-images/')) {
        await env.CUSTOM_ITEMS_BUCKET.delete(key);
      }
    }
  }

  // Delete admin-attached files from R2 + DB
  const fileRows = await env.DB.prepare(
    `SELECT id, r2_key FROM guitar_evaluation_files WHERE evaluation_id = ?`
  ).bind(id).all<{ id: number; r2_key: string }>();
  for (const file of fileRows.results ?? []) {
    if (file.r2_key?.startsWith('guitar-eval-files/')) {
      await env.CUSTOM_ITEMS_BUCKET.delete(file.r2_key);
    }
  }
  await env.DB.prepare(`DELETE FROM guitar_evaluation_files WHERE evaluation_id = ?`).bind(id).run();

  // Delete the evaluation record
  await env.DB.prepare(`DELETE FROM guitar_evaluations WHERE id = ?`).bind(id).run();

  return jsonResponse({ ok: true });
}

export async function handlePublicGuitarEvalReport(guid: string, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return new Response('Storage not configured.', { status: 500 });
  }
  const key = `guitar-eval-reports/${guid}.html`;
  const obj = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!obj) return new Response('Report not found.', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function handleAdminV2GenerateReport(
  id: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ message: 'Anthropic API key not configured.' }, 500);
  }
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Storage bucket not configured.' }, 500);
  }
  if (!env.REPORT_QUEUE) {
    return jsonResponse({ message: 'Report queue not configured.' }, 500);
  }
  const row = await env.DB.prepare(
    'SELECT id, type FROM guitar_evaluations WHERE id = ?',
  ).bind(id).first<{ id: number; type: string | null }>();
  if (!row) return jsonResponse({ message: 'Value report not found.' }, 404);
  if (row.type === 'AUTHENTICITY') {
    return jsonResponse({ message: 'AI report generation is not available for authenticity reports.' }, 400);
  }

  await env.DB.prepare(
    'UPDATE guitar_evaluations SET report_guid = NULL, report_r2_key = NULL, report_error = NULL WHERE id = ?',
  ).bind(id).run();

  await env.REPORT_QUEUE.send({ evaluationId: Number(id) });
  return jsonResponse({ generating: true });
}

export async function handleAdminV2ValueReportSendAltEmail(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  const email = normalizeEmailAddress(body.email);
  if (!email) return jsonResponse({ message: 'A valid email address is required.' }, 400);

  const row = await env.DB.prepare(
    `SELECT first_name, report_guid FROM guitar_evaluations WHERE id = ?`,
  ).bind(id).first<{ first_name: string | null; report_guid: string | null }>();
  if (!row) return jsonResponse({ message: 'Value report not found.' }, 404);
  if (!row.report_guid) return jsonResponse({ message: 'Report has not been generated yet.' }, 400);

  const config = await getBrevoRuntimeConfig(env);
  if (!config.apiKey || !config.senderEmail) {
    return jsonResponse({ message: 'Brevo is not configured.' }, 503);
  }

  const siteBase = (env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/$/, '');
  const reportUrl = `${siteBase}/api/guitar-eval-report/${row.report_guid}`;
  const resolvedFirstName = normalizeText(row.first_name, '') || 'there';

  try {
    await sendGuitarEvalReportReadyEmail(config, { email, firstName: resolvedFirstName, reportUrl });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to send email.',
    }, 502);
  }
}

export async function handleAdminV2ValueReportGeneratePdf(id: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT report_guid FROM guitar_evaluations WHERE id = ?`,
  ).bind(id).first<{ report_guid: string | null }>();
  if (!row) return jsonResponse({ message: 'Value report not found.' }, 404);
  if (!row.report_guid) return jsonResponse({ message: 'Report has not been generated yet.' }, 400);

  const siteBase = (env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/$/, '');
  const reportUrl = `${siteBase}/api/guitar-eval-report/${row.report_guid}`;

  try {
    const pdf = await generateGuitarEvalReportPdf(reportUrl, env);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="value-report-${id}.pdf"`,
      },
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to generate PDF.',
    }, 502);
  }
}

export async function handleAdminV2ValueReports(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM guitar_evaluations`
  ).first<{ total: number }>();
  const total = countResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows = await env.DB.prepare(
    `SELECT id, created_at, first_name, last_name, brand, type, stripe_payment_intent_id, fulfilled, report_cost
     FROM guitar_evaluations
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all<{
    id: number;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    brand: string | null;
    type: string | null;
    stripe_payment_intent_id: string | null;
    fulfilled: number;
    report_cost: number | null;
  }>();

  const records = (rows.results ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    brand: row.brand,
    type: row.type,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    fulfilled: row.fulfilled,
    reportCost: row.report_cost,
  }));

  return jsonResponse({ records, page, limit, total, totalPages });
}
