import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { getStripeRuntimeConfig } from '../system/runtime.js';
import { extensionFromContentType } from '../utils/image.js';

export async function dbInsertGuitarEvaluation(env: Env, data: {
  serialNumber: string | null;
  brand: string;
  brandOther: string | null;
  model: string | null;
  includesCase: string;
  colorFinish: string | null;
  location: string | null;
  note: string;
  damage: string;
  firstName: string;
  lastName: string;
  email: string;
  serialDecodeId: number | null;
}): Promise<number | null> {
  const result = await env.DB.prepare(`
    INSERT INTO guitar_evaluations (
      serial_number, brand, brand_other, model, includes_case, color_finish,
      location, note, damage, first_name, last_name, email, serial_decode_event_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.serialNumber,
    data.brand,
    data.brandOther,
    data.model,
    data.includesCase,
    data.colorFinish,
    data.location,
    data.note,
    data.damage,
    data.firstName,
    data.lastName,
    data.email,
    data.serialDecodeId,
    new Date().toISOString(),
  ).run();
  return (result.meta?.last_row_id as number) ?? null;
}

export async function handleGuitarEvaluationPaymentIntent(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }

  const evaluationId = body?.evaluationId;
  if (!evaluationId) {
    return jsonResponse({ message: 'evaluationId is required.' }, 400);
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Payment processing is not configured.' }, 503);
  }

  const params = new URLSearchParams({
    amount: '199',
    currency: 'usd',
    'metadata[evaluation_id]': String(evaluationId),
    'metadata[source]': 'guitar_evaluation',
    description: 'Comprehensive Guitar Evaluation Report',
  });
  params.append('payment_method_types[]', 'card');
  params.append('payment_method_types[]', 'cashapp');
  params.append('payment_method_types[]', 'us_bank_account');

  const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err: any = await stripeRes.json().catch(() => ({}));
    return jsonResponse({ message: err?.error?.message ?? 'Failed to create payment intent.' }, 502);
  }

  const intent: any = await stripeRes.json();
  return jsonResponse({ clientSecret: intent.client_secret, publishableKey: stripeConfig.publishableKey });
}

export async function handleGuitarEvaluationConfirmPayment(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }

  const evaluationId = body?.evaluationId;
  const paymentIntentId = normalizeText(body?.paymentIntentId, '');
  if (!evaluationId || !paymentIntentId) {
    return jsonResponse({ message: 'evaluationId and paymentIntentId are required.' }, 400);
  }

  await env.DB.prepare(
    `UPDATE guitar_evaluations SET stripe_payment_intent_id = ? WHERE id = ?`
  ).bind(paymentIntentId, evaluationId).run();

  return jsonResponse({ ok: true });
}

export async function handleGuitarEvaluationValidateCoupon(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }

  const evaluationId = body?.evaluationId;
  const couponCode = normalizeText(body?.couponCode, '');
  if (!evaluationId || !couponCode) {
    return jsonResponse({ message: 'evaluationId and couponCode are required.' }, 400);
  }

  if (couponCode.toUpperCase() === 'CCG_WORKER') {
    await env.DB.prepare(
      `UPDATE guitar_evaluations SET stripe_payment_intent_id = ? WHERE id = ?`
    ).bind(couponCode, evaluationId).run();
    return jsonResponse({ valid: true });
  }

  return jsonResponse({ valid: false });
}


export async function handleGuitarEvaluationSubmit(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }

  const { serialNumber, brand, brandOther, model, includesCase, colorFinish, location, note, damage, firstName, lastName, email, serialDecodeId } = body ?? {};

  if (!brand || !includesCase || !note || !damage) {
    return jsonResponse({ message: 'Missing required fields.' }, 400);
  }

  const id = await dbInsertGuitarEvaluation(env, {
    serialNumber: serialNumber ?? null,
    brand,
    brandOther: brandOther ?? null,
    model: model ?? null,
    includesCase,
    colorFinish: colorFinish ?? null,
    location: location ?? null,
    note,
    damage,
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    email: email ?? '',
    serialDecodeId: Number.isInteger(serialDecodeId) && serialDecodeId > 0 ? serialDecodeId : null,
  });

  if (!id) {
    return jsonResponse({ message: 'Failed to save evaluation. Please try again.' }, 500);
  }

  return jsonResponse({ id, message: 'Evaluation submitted successfully.' });
}

export async function handleGuitarEvaluationUpdate(request: Request, evaluationId: string, env: Env): Promise<Response> {
  const id = parseInt(evaluationId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonResponse({ message: 'Invalid evaluation ID.' }, 400);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }

  const row = await env.DB.prepare('SELECT id FROM guitar_evaluations WHERE id = ?').bind(id).first<{ id: number }>();
  if (!row) return jsonResponse({ message: 'Evaluation not found.' }, 404);

  const fieldMap: Record<string, string> = {
    serialNumber: 'serial_number',
    brand: 'brand',
    brandOther: 'brand_other',
    model: 'model',
    includesCase: 'includes_case',
    colorFinish: 'color_finish',
    location: 'location',
    note: 'note',
    damage: 'damage',
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    serialDecodeId: 'serial_decode_event_id',
  };

  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (jsKey in body) {
      setClauses.push(`${dbCol} = ?`);
      values.push(body[jsKey] ?? null);
    }
  }

  if (setClauses.length === 0) {
    return jsonResponse({ message: 'No fields to update.' }, 400);
  }

  values.push(id);
  await env.DB.prepare(`UPDATE guitar_evaluations SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return jsonResponse({ ok: true });
}

export async function handleGuitarEvaluationUploadImages(request: Request, evaluationId: string, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }

  const row = await env.DB.prepare(
    `SELECT id FROM guitar_evaluations WHERE id = ?`
  ).bind(evaluationId).first<{ id: number }>();
  if (!row) return jsonResponse({ message: 'Evaluation not found.' }, 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) return jsonResponse({ ok: true, keys: [] });
  if (files.length > 11) return jsonResponse({ message: 'Maximum 11 photos allowed.' }, 400);

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return jsonResponse({ message: 'Only image files are supported.' }, 400);
    }
  }

  const keys: string[] = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extensionFromContentType(file.type);
      const key = `guitar-eval-images/${evaluationId}/${crypto.randomUUID()}-${i}.${ext}`;
      await env.CUSTOM_ITEMS_BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      keys.push(key);
    }

    await env.DB.prepare(
      `UPDATE guitar_evaluations SET image_keys = ? WHERE id = ?`
    ).bind(JSON.stringify(keys), evaluationId).run();
  } catch (error) {
    console.error('guitar eval image upload failed', { evaluationId, error });
    return jsonResponse({ message: 'Image upload failed.', detail: String(error) }, 500);
  }

  // Kick off report generation now that photos are uploaded; email with attached report is sent when generation completes
  if (env.REPORT_QUEUE) {
    try {
      await env.REPORT_QUEUE.send({ evaluationId: Number(evaluationId) });
    } catch (err) {
      console.error('Failed to enqueue report generation after photo upload:', err);
    }
  } else {
    console.warn('REPORT_QUEUE not configured — report generation not triggered after photo upload');
  }

  return jsonResponse({ ok: true, keys });
}

export async function handleGuitarEvaluationImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }

  const key = new URL(request.url).searchParams.get('key');
  if (!key || !key.startsWith('guitar-eval-images/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return jsonResponse({ message: 'Image not found.' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(object.body, { headers });
}
