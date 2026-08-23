import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { runDncBudgetSync } from './sync.js';

// Permanent dncbudget "System" panel routes — see dncbudget-spec.md §9.
// Replaces the Stage 1 throwaway test-routes.ts.

const PLAID_ENV_BASE_URL = 'https://production.plaid.com';

type PlaidAccountId = 'personal' | 'business';

async function getPlaidAccessToken(env: Env, account: PlaidAccountId): Promise<string | null> {
  const row = await env.DB.prepare('SELECT access_token FROM dnc_budget_plaid_items WHERE id = ?')
    .bind(account)
    .first<{ access_token: string }>();
  if (row?.access_token) return row.access_token;
  // Personal falls back to the Stage 1 secret until a real D1 row exists for it.
  if (account === 'personal' && env.PLAID_ACCESS_TOKEN_TEST) return env.PLAID_ACCESS_TOKEN_TEST;
  return null;
}

export async function handleDncBudgetSystemPlaidTransactions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const account = (url.searchParams.get('account') || 'personal') as PlaidAccountId;
  if (account !== 'personal' && account !== 'business') {
    return jsonResponse({ ok: false, error: 'account must be "personal" or "business"' }, 200);
  }

  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    return jsonResponse({ ok: false, error: 'Missing PLAID_CLIENT_ID / PLAID_SECRET secret(s).' }, 200);
  }

  const accessToken = await getPlaidAccessToken(env, account);
  if (!accessToken) {
    return jsonResponse({ ok: false, error: `No Plaid connection stored for "${account}" yet.` }, 200);
  }

  try {
    const response = await fetch(`${PLAID_ENV_BASE_URL}/transactions/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: env.PLAID_CLIENT_ID,
        secret: env.PLAID_SECRET,
        access_token: accessToken,
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

    return jsonResponse({ ok: true, account, count: transactions.length, transactions });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Plaid request failed' }, 200);
  }
}

// Prevents two overlapping syncs (e.g. a double-click before the button's disabled state
// lands) from both starting a fresh Plaid cursor and double-inserting every transaction.
// A single-row D1 UPDATE...WHERE is genuinely atomic (unlike a KV get-then-put, which is
// only eventually consistent and let a real double-click race through once already).
const SYNC_LOCK_TTL_SECONDS = 120;

async function acquireSyncLock(env: Env): Promise<boolean> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - SYNC_LOCK_TTL_SECONDS * 1000).toISOString();
  const result = await env.DB.prepare(
    `UPDATE dnc_budget_sync_lock SET locked_at = ? WHERE id = 1 AND (locked_at IS NULL OR locked_at < ?)`,
  )
    .bind(now.toISOString(), staleCutoff)
    .run();
  return result.meta.changes > 0;
}

async function releaseSyncLock(env: Env): Promise<void> {
  await env.DB.prepare(`UPDATE dnc_budget_sync_lock SET locked_at = NULL WHERE id = 1`).run();
}

export async function handleDncBudgetSystemRunSync(env: Env): Promise<Response> {
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    return jsonResponse({ ok: false, error: 'Missing PLAID_CLIENT_ID / PLAID_SECRET secret(s).' }, 200);
  }

  if (!(await acquireSyncLock(env))) {
    return jsonResponse({ ok: false, error: 'A sync is already in progress — wait a moment and try again.' }, 200);
  }

  try {
    const result = await runDncBudgetSync(env);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Sync failed' }, 200);
  } finally {
    await releaseSyncLock(env);
  }
}

export async function handleDncBudgetSystemSmsQuota(env: Env): Promise<Response> {
  if (!env.TEXTBELT_KEY) {
    return jsonResponse({ ok: false, error: 'Missing TEXTBELT_KEY secret.' }, 200);
  }

  try {
    const response = await fetch(`https://textbelt.com/quota/${env.TEXTBELT_KEY}`);
    const data = (await response.json()) as { success?: boolean; quotaRemaining?: number };
    if (!data.success) {
      return jsonResponse({ ok: false, error: 'Textbelt reported failure' }, 200);
    }
    return jsonResponse({ ok: true, quotaRemaining: data.quotaRemaining });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Textbelt request failed' }, 200);
  }
}

export async function handleDncBudgetSystemSendTestSms(env: Env): Promise<Response> {
  if (!env.TEXTBELT_KEY) {
    return jsonResponse({ ok: false, error: 'Missing TEXTBELT_KEY secret.' }, 200);
  }

  const recipient = await env.DB.prepare(
    'SELECT phone, first_name FROM dnc_budget_sms_recipients WHERE is_default = 1 AND active = 1 LIMIT 1',
  ).first<{ phone: string; first_name: string }>();

  if (!recipient) {
    return jsonResponse({ ok: false, error: 'No default recipient set in dnc_budget_sms_recipients.' }, 200);
  }

  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        phone: recipient.phone,
        message: `Hopper Budget system test — if you got this, ${recipient.first_name}, the SMS path works.`,
        key: env.TEXTBELT_KEY,
      }),
    });

    const data = (await response.json()) as { success?: boolean; textId?: string; quotaRemaining?: number; error?: string };

    if (!data.success) {
      return jsonResponse({ ok: false, error: data.error || 'Textbelt reported failure' }, 200);
    }

    return jsonResponse({
      ok: true,
      sentTo: recipient.first_name,
      textId: data.textId,
      quotaRemaining: data.quotaRemaining,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Textbelt request failed' }, 200);
  }
}
