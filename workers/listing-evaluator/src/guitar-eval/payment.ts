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
  type: 'VALUE' | 'AUTHENTICITY';
  curiosityReason: string;
}): Promise<number | null> {
  const result = await env.DB.prepare(`
    INSERT INTO guitar_evaluations (
      serial_number, brand, brand_other, model, includes_case, color_finish,
      location, note, damage, first_name, last_name, email, serial_decode_event_id, type, curiosity_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.type,
    data.curiosityReason,
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

  const evalRow = await env.DB.prepare(
    'SELECT email, type FROM guitar_evaluations WHERE id = ?'
  ).bind(evaluationId).first<{ email: string | null; type: string | null }>();

  const isAuthenticity = evalRow?.type === 'AUTHENTICITY';
  const params = new URLSearchParams({
    amount: isAuthenticity ? '1200' : '800',
    currency: 'usd',
    'metadata[evaluation_id]': String(evaluationId),
    'metadata[source]': 'guitar_evaluation',
    description: isAuthenticity ? 'Comprehensive Guitar Authenticity Report' : 'Comprehensive Guitar Evaluation Report',
  });
  if (evalRow?.email) params.set('receipt_email', evalRow.email);
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

  // Verify payment status with Stripe before recording or triggering report generation
  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Payment processing is not configured.' }, 503);
  }

  const stripeRes = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    headers: { Authorization: `Bearer ${stripeConfig.secretKey}` },
  });
  if (!stripeRes.ok) {
    return jsonResponse({ message: 'Failed to verify payment with Stripe.' }, 502);
  }
  const intent: any = await stripeRes.json();
  const status: string = intent?.status ?? '';

  if (status !== 'succeeded' && status !== 'processing') {
    return jsonResponse({ message: `Payment not completed (status: ${status}).`, status }, 402);
  }

  await env.DB.prepare(
    `UPDATE guitar_evaluations SET stripe_payment_intent_id = ? WHERE id = ?`
  ).bind(paymentIntentId, evaluationId).run();

  const evalTypeRow = await env.DB.prepare(
    'SELECT type FROM guitar_evaluations WHERE id = ?'
  ).bind(evaluationId).first<{ type: string | null }>();

  if (env.REPORT_QUEUE && evalTypeRow?.type !== 'AUTHENTICITY') {
    try {
      await env.REPORT_QUEUE.send({ evaluationId: Number(evaluationId) });
    } catch (err) {
      console.error('Failed to enqueue report generation after payment confirmation:', err);
    }
  }

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
    const evalTypeRow = await env.DB.prepare(
      'SELECT type FROM guitar_evaluations WHERE id = ?'
    ).bind(evaluationId).first<{ type: string | null }>();
    if (env.REPORT_QUEUE && evalTypeRow?.type !== 'AUTHENTICITY') {
      try {
        await env.REPORT_QUEUE.send({ evaluationId: Number(evaluationId) });
      } catch (err) {
        console.error('Failed to enqueue report generation after coupon:', err);
      }
    }
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

  const { serialNumber, brand, brandOther, model, includesCase, colorFinish, location, note, damage, firstName, lastName, email, serialDecodeId, type: rawType, curiosityReason } = body ?? {};

  if (!brand || !includesCase || !note) {
    return jsonResponse({ message: 'Missing required fields.' }, 400);
  }

  const type: 'VALUE' | 'AUTHENTICITY' = rawType === 'AUTHENTICITY' ? 'AUTHENTICITY' : 'VALUE';

  let finalDamage: string;
  let finalCuriosityReason: string;
  if (type === 'AUTHENTICITY') {
    const trimmedReason = typeof curiosityReason === 'string' ? curiosityReason.trim() : '';
    if (!trimmedReason) {
      return jsonResponse({ message: 'Missing required fields.' }, 400);
    }
    finalDamage = 'N/A';
    finalCuriosityReason = trimmedReason;
  } else {
    if (!damage) {
      return jsonResponse({ message: 'Missing required fields.' }, 400);
    }
    finalDamage = damage;
    finalCuriosityReason = 'N/A';
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
    damage: finalDamage,
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    email: email ?? '',
    serialDecodeId: Number.isInteger(serialDecodeId) && serialDecodeId > 0 ? serialDecodeId : null,
    type,
    curiosityReason: finalCuriosityReason,
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
    curiosityReason: 'curiosity_reason',
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
  if (files.length > 20) return jsonResponse({ message: 'Maximum 20 photos allowed.' }, 400);

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
