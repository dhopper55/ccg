import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText, normalizeEmailAddress, escapeHtml } from '../utils/text.js';
import { extensionFromContentType } from '../utils/image.js';
import { verifyTurnstileToken } from '../utils/turnstile.js';
import { getBrevoRuntimeConfig } from '../system/runtime.js';
import { sendBrevoTransactionalEmail } from '../orders/email.js';

const CONTACT_MESSAGE_RECIPIENT = { email: 'info@coalcreekguitars.com', name: 'Coal Creek Guitars' };
const CONTACT_MESSAGE_MAX_LENGTH = 2000;
const CONTACT_MESSAGE_MAX_PHOTOS = 20;

export async function handleContactMessageRequest(request: Request, env: Env): Promise<Response> {
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
  const message = normalizeText(formData.get('message'), '').slice(0, CONTACT_MESSAGE_MAX_LENGTH);

  if (!name) return jsonResponse({ message: 'Name is required.' }, 400);
  if (!email) return jsonResponse({ message: 'A valid email address is required.' }, 400);
  if (!message) return jsonResponse({ message: 'Message is required.' }, 400);

  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > CONTACT_MESSAGE_MAX_PHOTOS) {
    return jsonResponse({ message: `Maximum ${CONTACT_MESSAGE_MAX_PHOTOS} photos allowed.` }, 400);
  }
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return jsonResponse({ message: 'Only image files are supported.' }, 400);
    }
  }

  let messageId: number;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO contact_message_requests (name, email, message) VALUES (?, ?, ?)`
    ).bind(name, email, message).run();
    messageId = Number(result.meta?.last_row_id || 0);
  } catch (error) {
    console.error('contact message insert failed', { error });
    return jsonResponse({ message: 'Unable to submit your message. Please try again.' }, 500);
  }

  const imageKeys: string[] = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extensionFromContentType(file.type);
      const key = `contact-message-images/${messageId}/${crypto.randomUUID()}-${i}.${ext}`;
      await env.CUSTOM_ITEMS_BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      imageKeys.push(key);
    }
    if (imageKeys.length > 0) {
      await env.DB.prepare(
        `UPDATE contact_message_requests SET image_keys = ? WHERE id = ?`
      ).bind(JSON.stringify(imageKeys), messageId).run();
    }
  } catch (error) {
    console.error('contact message image upload failed', { messageId, error });
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
        url: `${siteBaseUrl}/api/contact-message-image/${key}`,
      }));

      const htmlContent = [
        `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Message:</strong></p>`,
        `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      ].join('\n');

      await sendBrevoTransactionalEmail(config, {
        sender: { name: config.senderName, email: config.senderEmail },
        to: [CONTACT_MESSAGE_RECIPIENT],
        replyTo: { email, name },
        subject: 'Website Contact Message',
        htmlContent,
        ...(attachments.length > 0 ? { attachment: attachments } : {}),
      });
    } catch (error) {
      console.error('contact message email send failed', { messageId, error });
      // The request is safely recorded in D1 even if the email send fails.
    }

    try {
      await sendBrevoTransactionalEmail(config, {
        sender: { name: config.senderName, email: config.senderEmail },
        to: [{ email, name }],
        subject: 'We received your message',
        htmlContent: [
          `<p>Hi ${escapeHtml(name)},</p>`,
          `<p>Thanks for reaching out to Coal Creek Guitars. We received your message and will get back to you shortly.</p>`,
          `<p>&mdash; Coal Creek Guitars</p>`,
        ].join('\n'),
      });
    } catch (error) {
      console.error('contact message customer confirmation email failed', { messageId, error });
      // Non-fatal — the internal notification above is the primary channel.
    }
  } else {
    console.error('contact message email skipped — Brevo not configured', { messageId });
  }

  return jsonResponse({ ok: true });
}

export async function handleContactMessageImage(request: Request, key: string, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }

  if (!key || !key.startsWith('contact-message-images/')) {
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
