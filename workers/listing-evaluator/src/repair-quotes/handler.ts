import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText, normalizeEmailAddress } from '../utils/text.js';
import { extensionFromContentType } from '../utils/image.js';
import { getBrevoRuntimeConfig } from '../system/runtime.js';
import { sendBrevoTransactionalEmail } from '../orders/email.js';

const REPAIR_QUOTE_RECIPIENT = { email: 'info@coalcreekguitars.com', name: 'Coal Creek Guitars' };
const REPAIR_QUOTE_MAX_MESSAGE_LENGTH = 2000;
const REPAIR_QUOTE_MAX_PHOTOS = 20;

async function verifyTurnstileToken(token: string, secretKey: string, remoteIp: string | null): Promise<boolean> {
  if (!token || !secretKey) return false;

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await response.json<{ success?: boolean }>().catch(() => ({}));
    return data?.success === true;
  } catch (error) {
    console.error('Turnstile verification request failed', { error });
    return false;
  }
}

export async function handleRepairQuoteRequest(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return jsonResponse({ message: 'Spam protection is not configured.' }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const turnstileToken = normalizeText(formData.get('cf-turnstile-response'), '');
  const remoteIp = request.headers.get('cf-connecting-ip');
  const turnstileOk = await verifyTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, remoteIp);
  if (!turnstileOk) {
    return jsonResponse({ message: 'Spam check failed. Please reload the page and try again.' }, 400);
  }

  const name = normalizeText(formData.get('name'), '');
  const email = normalizeEmailAddress(formData.get('email'));
  const phone = normalizeText(formData.get('phone'), '');
  const message = normalizeText(formData.get('message'), '').slice(0, REPAIR_QUOTE_MAX_MESSAGE_LENGTH);

  if (!name) return jsonResponse({ message: 'Name is required.' }, 400);
  if (!email) return jsonResponse({ message: 'A valid email address is required.' }, 400);
  if (!phone) return jsonResponse({ message: 'Phone number is required.' }, 400);

  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > REPAIR_QUOTE_MAX_PHOTOS) {
    return jsonResponse({ message: `Maximum ${REPAIR_QUOTE_MAX_PHOTOS} photos allowed.` }, 400);
  }
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return jsonResponse({ message: 'Only image files are supported.' }, 400);
    }
  }

  let quoteId: number;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO repair_quote_requests (name, email, phone, message) VALUES (?, ?, ?, ?)`
    ).bind(name, email, phone, message).run();
    quoteId = Number(result.meta?.last_row_id || 0);
  } catch (error) {
    console.error('repair quote insert failed', { error });
    return jsonResponse({ message: 'Unable to submit your request. Please try again.' }, 500);
  }

  const imageKeys: string[] = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extensionFromContentType(file.type);
      const key = `repair-quote-images/${quoteId}/${crypto.randomUUID()}-${i}.${ext}`;
      await env.CUSTOM_ITEMS_BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      imageKeys.push(key);
    }
    if (imageKeys.length > 0) {
      await env.DB.prepare(
        `UPDATE repair_quote_requests SET image_keys = ? WHERE id = ?`
      ).bind(JSON.stringify(imageKeys), quoteId).run();
    }
  } catch (error) {
    console.error('repair quote image upload failed', { quoteId, error });
    // The request row is already saved — fall through and still notify by email.
  }

  const config = await getBrevoRuntimeConfig(env);
  if (config.apiKey && config.senderEmail) {
    try {
      const siteBaseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
      const attachments = imageKeys.map((key, index) => ({
        name: `photo-${index + 1}.${key.split('.').pop()}`,
        // Brevo infers the attachment's file type from the URL path itself (not the query
        // string), so the key must appear as real path segments ending in its extension.
        url: `${siteBaseUrl}/api/repair-quote-image/${key}`,
      }));

      const htmlContent = [
        `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`,
        `<p><strong>Message:</strong></p>`,
        `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      ].join('\n');

      await sendBrevoTransactionalEmail(config, {
        sender: { name: config.senderName, email: config.senderEmail },
        to: [REPAIR_QUOTE_RECIPIENT],
        replyTo: { email, name },
        subject: 'Repair Quote Request',
        htmlContent,
        ...(attachments.length > 0 ? { attachment: attachments } : {}),
      });
    } catch (error) {
      console.error('repair quote email send failed', { quoteId, error });
      // The request is safely recorded in D1 even if the email send fails.
    }

    try {
      await sendBrevoTransactionalEmail(config, {
        sender: { name: config.senderName, email: config.senderEmail },
        to: [{ email, name }],
        subject: 'We received your repair quote request',
        htmlContent: [
          `<p>Hi ${escapeHtml(name)},</p>`,
          `<p>Thanks for reaching out to Coal Creek Guitars. We received your repair quote request and will get back to you shortly with an estimate.</p>`,
          `<p>&mdash; Coal Creek Guitars</p>`,
        ].join('\n'),
      });
    } catch (error) {
      console.error('repair quote customer confirmation email failed', { quoteId, error });
      // Non-fatal — the internal notification above is the primary channel.
    }
  } else {
    console.error('repair quote email skipped — Brevo not configured', { quoteId });
  }

  return jsonResponse({ ok: true });
}

export async function handleRepairQuoteImage(request: Request, key: string, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }

  if (!key || !key.startsWith('repair-quote-images/')) {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
