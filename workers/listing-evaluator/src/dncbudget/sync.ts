import type { Env } from '../env.js';
import { normalizeMerchant } from './data-routes.js';

// Sync + matching pipeline — dncbudget-spec.md §5, steps 1-6 (Plaid sync through
// merchant-rule categorization). Instant alerts, status/pace recompute, and digests
// (§5 steps 7-9) are a later phase — not implemented here.
//
// Triggered manually from the System panel for now (no Cron Trigger wired up yet).

const PLAID_ENV_BASE_URL = 'https://production.plaid.com';

// A transfer only gets matched within this many days of its counterpart leg, and
// only above this floor — small coincidental same-amount transactions shouldn't pair.
const TRANSFER_MATCH_WINDOW_DAYS = 3;
const TRANSFER_MATCH_MIN_AMOUNT = 10;
const TRANSFER_MATCH_TOLERANCE = 0.01; // 1%

// Seed-pass window — David's manually reviewing this batch to teach the merchant-rule
// and recurring-bill tables, so we're deliberately not pulling Plaid's full available
// history yet. Widen or remove once the real Phase 2 backfill (§8) happens.
const SYNC_HISTORY_START_DATE = '2026-07-01';

interface PlaidItemRow {
  id: string;
  label: string;
  access_token: string;
  sync_cursor: string | null;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
}

interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
}

interface RecurringBillRow {
  id: string;
  merchant_pattern: string | null;
  expected_amount: number;
  amount_tolerance: number;
  expected_day_min: number;
  expected_day_max: number;
}

interface MerchantRuleRow {
  merchant_pattern: string;
  category_id: string;
}

export interface SyncItemResult {
  item: string;
  accountsSynced: number;
  transactionsAdded: number;
  error?: string;
}

export interface SyncResult {
  items: SyncItemResult[];
  recurringMatched: number;
  transfersDetected: number;
  categorized: number;
  unclassified: number;
}

async function plaidPost<T>(env: Env, path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${PLAID_ENV_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, ...body }),
  });
  const data = (await response.json()) as T & { error_message?: string };
  if (!response.ok) {
    throw new Error((data as { error_message?: string }).error_message || `Plaid ${path} returned ${response.status}`);
  }
  return data;
}

async function syncAccounts(env: Env, item: PlaidItemRow): Promise<number> {
  const data = await plaidPost<{ accounts: PlaidAccount[] }>(env, '/accounts/get', {
    access_token: item.access_token,
  });

  for (const account of data.accounts) {
    await env.DB.prepare(
      `INSERT INTO dnc_budget_accounts (id, plaid_item_id, plaid_account_id, name, type, last_four, is_manual, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)
       ON CONFLICT(plaid_account_id) WHERE plaid_account_id IS NOT NULL
       DO UPDATE SET name = excluded.name, type = excluded.type, last_four = excluded.last_four`,
    )
      .bind(
        crypto.randomUUID(),
        item.id,
        account.account_id,
        account.official_name || account.name,
        // dnc_budget_accounts.type is CHECK-constrained to 'checking'/'credit' only (§2 scope
        // is Chase checking + credit cards) — map Plaid's richer type/subtype taxonomy onto that.
        account.type === 'credit' ? 'credit' : 'checking',
        account.mask,
        new Date().toISOString(),
      )
      .run();
  }

  return data.accounts.length;
}

async function syncTransactions(env: Env, item: PlaidItemRow): Promise<number> {
  let cursor = item.sync_cursor || undefined;
  let added: PlaidTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const data = await plaidPost<{
      added: PlaidTransaction[];
      next_cursor: string;
      has_more: boolean;
    }>(env, '/transactions/sync', { access_token: item.access_token, cursor, count: 500 });

    added = added.concat(data.added);
    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await env.DB.prepare('UPDATE dnc_budget_plaid_items SET sync_cursor = ? WHERE id = ?').bind(cursor, item.id).run();

  let insertedCount = 0;
  for (const txn of added) {
    if (txn.pending) continue; // only posted transactions, per spec convention throughout
    if (txn.date < SYNC_HISTORY_START_DATE) continue;

    const account = await env.DB.prepare('SELECT id FROM dnc_budget_accounts WHERE plaid_account_id = ?')
      .bind(txn.account_id)
      .first<{ id: string }>();
    if (!account) continue; // shouldn't happen — accounts are synced immediately before this

    const result = await env.DB.prepare(
      `INSERT INTO dnc_budget_transactions
         (id, plaid_transaction_id, account_id, posted_date, amount, description, merchant, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unclassified', ?)
       ON CONFLICT(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL DO NOTHING`,
    )
      .bind(
        crypto.randomUUID(),
        txn.transaction_id,
        account.id,
        txn.date,
        txn.amount,
        txn.name,
        txn.merchant_name || txn.name,
        new Date().toISOString(),
      )
      .run();

    if (result.meta.changes > 0) insertedCount++;
  }

  return insertedCount;
}

async function matchRecurringBills(env: Env): Promise<number> {
  const { results: bills } = await env.DB.prepare(
    `SELECT id, merchant_pattern, expected_amount, amount_tolerance, expected_day_min, expected_day_max
     FROM dnc_budget_recurring_bills WHERE active = 1 AND confirmed = 1 AND merchant_pattern IS NOT NULL`,
  ).all<RecurringBillRow>();

  const { results: candidates } = await env.DB.prepare(
    `SELECT id, posted_date, amount, merchant FROM dnc_budget_transactions WHERE type = 'unclassified' AND amount > 0`,
  ).all<{ id: string; posted_date: string; amount: number; merchant: string | null }>();

  let matched = 0;
  for (const txn of candidates) {
    const merchant = normalizeMerchant(txn.merchant);
    if (!merchant) continue;

    const day = Number(txn.posted_date.slice(8, 10));
    const bill = bills.find((b) => {
      if (b.merchant_pattern !== merchant) return false;
      if (day < b.expected_day_min || day > b.expected_day_max) return false;
      const tolerance = b.expected_amount * b.amount_tolerance;
      return Math.abs(txn.amount - b.expected_amount) <= tolerance;
    });

    if (bill) {
      await env.DB.prepare(`UPDATE dnc_budget_transactions SET type = 'recurring', recurring_bill_id = ? WHERE id = ?`)
        .bind(bill.id, txn.id)
        .run();
      matched++;
    }
  }

  return matched;
}

async function detectTransferPairs(env: Env): Promise<number> {
  const { results: candidates } = await env.DB.prepare(
    `SELECT id, account_id, posted_date, amount FROM dnc_budget_transactions
     WHERE type = 'unclassified' AND ABS(amount) >= ?
     ORDER BY posted_date`,
  )
    .bind(TRANSFER_MATCH_MIN_AMOUNT)
    .all<{ id: string; account_id: string; posted_date: string; amount: number }>();

  const claimed = new Set<string>();
  let pairs = 0;

  for (const a of candidates) {
    if (claimed.has(a.id) || a.amount <= 0) continue; // only start from the debit (positive) leg

    const match = candidates.find((b) => {
      if (claimed.has(b.id) || b.id === a.id) return false;
      if (b.account_id === a.account_id) return false; // must span different accounts
      if (b.amount >= 0) return false; // opposite sign — the credit leg
      const tolerance = Math.abs(a.amount) * TRANSFER_MATCH_TOLERANCE;
      if (Math.abs(Math.abs(b.amount) - a.amount) > tolerance) return false;
      const daysApart = Math.abs(
        (Date.parse(a.posted_date) - Date.parse(b.posted_date)) / (1000 * 60 * 60 * 24),
      );
      return daysApart <= TRANSFER_MATCH_WINDOW_DAYS;
    });

    if (match) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE dnc_budget_transactions SET type = 'transfer' WHERE id = ?`).bind(a.id),
        env.DB.prepare(`UPDATE dnc_budget_transactions SET type = 'transfer' WHERE id = ?`).bind(match.id),
        env.DB.prepare(
          `INSERT INTO dnc_budget_transfer_pairs (id, from_transaction_id, to_transaction_id, detected_at) VALUES (?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), a.id, match.id, new Date().toISOString()),
      ]);
      claimed.add(a.id);
      claimed.add(match.id);
      pairs++;
    }
  }

  return pairs;
}

async function applyMerchantRules(env: Env): Promise<{ categorized: number; remaining: number }> {
  const { results: rules } = await env.DB.prepare(
    'SELECT merchant_pattern, category_id FROM dnc_budget_merchant_category_rules',
  ).all<MerchantRuleRow>();
  const ruleMap = new Map(rules.map((r) => [r.merchant_pattern, r.category_id]));

  const { results: candidates } = await env.DB.prepare(
    `SELECT id, merchant, amount FROM dnc_budget_transactions WHERE type = 'unclassified'`,
  ).all<{ id: string; merchant: string | null; amount: number }>();

  let categorized = 0;
  let remaining = 0;
  for (const txn of candidates) {
    if (txn.amount < 0) {
      // Negative-amount transactions that reach here weren't part of a transfer — some
      // kind of credit. Left unclassified deliberately rather than guessed: recognized
      // income (paycheck) and refunds (Amazon returns) are excluded/included from the
      // budget math oppositely, and only a human can tell those apart reliably.
      remaining++;
      continue;
    }

    const merchant = normalizeMerchant(txn.merchant);
    const categoryId = merchant ? ruleMap.get(merchant) : undefined;
    if (categoryId) {
      await env.DB.prepare(`UPDATE dnc_budget_transactions SET type = 'discretionary', category_id = ? WHERE id = ?`)
        .bind(categoryId, txn.id)
        .run();
      categorized++;
    } else {
      remaining++;
    }
  }

  return { categorized, remaining };
}

export async function runDncBudgetSync(env: Env): Promise<SyncResult> {
  const { results: items } = await env.DB.prepare(
    'SELECT id, label, access_token, sync_cursor FROM dnc_budget_plaid_items',
  ).all<PlaidItemRow>();

  const itemResults: SyncItemResult[] = [];
  for (const item of items) {
    try {
      const accountsSynced = await syncAccounts(env, item);
      const transactionsAdded = await syncTransactions(env, item);
      itemResults.push({ item: item.label, accountsSynced, transactionsAdded });
    } catch (err) {
      itemResults.push({
        item: item.label,
        accountsSynced: 0,
        transactionsAdded: 0,
        error: err instanceof Error ? err.message : 'sync failed',
      });
    }
  }

  const recurringMatched = await matchRecurringBills(env);
  const transfersDetected = await detectTransferPairs(env);
  const { categorized, remaining } = await applyMerchantRules(env);

  return {
    items: itemResults,
    recurringMatched,
    transfersDetected,
    categorized,
    unclassified: remaining,
  };
}
