import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';

// Throwaway Stage 1 smoke-test endpoints for the dncbudget scaffold — see
// dncbudget-spec.md. These exist to confirm the live Plaid and Textbelt paths
// actually work post-deploy, before any real D1 schema or sync pipeline is
// built. Not part of the real app; safe to delete once Stage 2 lands.

const PLAID_ENV_BASE_URL = 'https://production.plaid.com';

export async function handleDncBudgetTestPlaidTransactions(env: Env): Promise<Response> {
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET || !env.PLAID_ACCESS_TOKEN_TEST) {
    return jsonResponse(
      { ok: false, error: 'Missing PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ACCESS_TOKEN_TEST secret(s).' },
      200,
    );
  }

  try {
    const response = await fetch(`${PLAID_ENV_BASE_URL}/transactions/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: env.PLAID_CLIENT_ID,
        secret: env.PLAID_SECRET,
        access_token: env.PLAID_ACCESS_TOKEN_TEST,
        count: 5,
      }),
    });

    const data = (await response.json()) as {
      added?: { date: string; name: string; amount: number }[];
      error_message?: string;
    };

    if (!response.ok) {
      return jsonResponse({ ok: false, error: data.error_message || `Plaid returned ${response.status}` }, 200);
    }

    const transactions = (data.added ?? []).slice(0, 5).map((t) => ({
      date: t.date,
      name: t.name,
      amount: t.amount,
    }));

    return jsonResponse({ ok: true, count: transactions.length, transactions });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Plaid request failed' }, 200);
  }
}

export async function handleDncBudgetTestSendSms(request: Request, env: Env): Promise<Response> {
  if (!env.TEXTBELT_KEY) {
    return jsonResponse({ ok: false, error: 'Missing TEXTBELT_KEY secret.' }, 200);
  }

  let body: { phone?: string; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 200);
  }

  const phone = body.phone?.trim();
  const message = body.message?.trim();
  if (!phone || !message) {
    return jsonResponse({ ok: false, error: 'phone and message are required' }, 200);
  }

  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ phone, message, key: env.TEXTBELT_KEY }),
    });

    const data = (await response.json()) as { success?: boolean; textId?: string; quotaRemaining?: number; error?: string };

    if (!data.success) {
      return jsonResponse({ ok: false, error: data.error || 'Textbelt reported failure' }, 200);
    }

    return jsonResponse({ ok: true, textId: data.textId, quotaRemaining: data.quotaRemaining });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Textbelt request failed' }, 200);
  }
}
