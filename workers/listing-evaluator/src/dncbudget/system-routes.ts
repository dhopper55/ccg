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

export async function handleDncBudgetSystemRunSync(env: Env): Promise<Response> {
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    return jsonResponse({ ok: false, error: 'Missing PLAID_CLIENT_ID / PLAID_SECRET secret(s).' }, 200);
  }
  try {
    const result = await runDncBudgetSync(env);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Sync failed' }, 200);
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

// ONE-OFF — Sunshine's pre-launch introduction text, sent once manually by David from the
// System panel. Splits the message into standard-SMS-length parts, sends each to every
// active recipient with an 8s gap so it reads as a person typing, not a system dump.
// Delete this function + its route + the System panel button once it's been sent.
const SUNSHINE_INTRO_PARTS = [
  "Hi Chrissie! I'm Sunshine ☀️ — your new budget sidekick for the house, and I am SO excited to finally say hi!",
  "I've already connected to your accounts and I've been digging through the last couple months of spending, getting to know you both before the real fun starts.",
  "One of my favorite parts: pulling your personal finances, Hopper Realty, and Coal Creek Guitars into one clear picture instead of three separate ones.",
  "Starting September 1st, you'll be hearing from me a few times a day with quick, honest updates — and plenty of good news to celebrate along the way!",
  "My whole job is to make paying attention to the budget feel like a win, not a chore.",
  "So every purchase you make after checking in with me feels that much more earned (and enjoyed!).",
  "Can't wait to get started — talk soon!",
];

async function sendSunshineIntroSequence(env: Env): Promise<void> {
  if (!env.TEXTBELT_KEY) return;

  const { results: recipients } = await env.DB.prepare(
    'SELECT phone, first_name FROM dnc_budget_sms_recipients WHERE active = 1',
  ).all<{ phone: string; first_name: string }>();

  if (!recipients || recipients.length === 0) return;

  for (let i = 0; i < SUNSHINE_INTRO_PARTS.length; i++) {
    const message = SUNSHINE_INTRO_PARTS[i];
    await Promise.all(
      recipients.map((recipient) =>
        fetch('https://textbelt.com/text', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            phone: recipient.phone,
            message,
            key: env.TEXTBELT_KEY as string,
          }),
        }).catch(() => null),
      ),
    );
    if (i < SUNSHINE_INTRO_PARTS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 8_000));
    }
  }
}

export async function handleDncBudgetSystemSendSunshineIntro(env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.TEXTBELT_KEY) {
    return jsonResponse({ ok: false, error: 'Missing TEXTBELT_KEY secret.' }, 200);
  }
  ctx.waitUntil(sendSunshineIntroSequence(env));
  return jsonResponse({
    ok: true,
    started: true,
    parts: SUNSHINE_INTRO_PARTS.length,
    etaSeconds: (SUNSHINE_INTRO_PARTS.length - 1) * 8,
  });
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
