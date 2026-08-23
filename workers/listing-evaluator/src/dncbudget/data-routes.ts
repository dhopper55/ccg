import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { computeMonthSummary } from './budget-math.js';

// Permanent dncbudget data-layer routes — see dncbudget-spec.md §9.

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeMerchant(merchant: string | null): string | null {
  return merchant ? merchant.trim().toUpperCase() : null;
}

// ---- Months ----

export async function handleDncBudgetMonthsList(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT month FROM dnc_budget_monthly_budget
     UNION
     SELECT DISTINCT substr(posted_date, 1, 7) as month FROM dnc_budget_transactions
     ORDER BY month DESC`,
  ).all<{ month: string }>();

  const months = await Promise.all(rows.results.map((r) => computeMonthSummary(env, r.month)));
  return jsonResponse({ ok: true, months });
}

export async function handleDncBudgetSetTotalIn(request: Request, env: Env, month: string): Promise<Response> {
  let body: { totalIn?: number } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (typeof body.totalIn !== 'number') {
    return jsonResponse({ ok: false, error: 'totalIn (number) is required' }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO dnc_budget_monthly_budget (id, month, total_in, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(month) DO UPDATE SET total_in = excluded.total_in`,
  )
    .bind(crypto.randomUUID(), month, body.totalIn, nowIso())
    .run();

  const summary = await computeMonthSummary(env, month);
  return jsonResponse({ ok: true, summary });
}

// ---- Transactions ----

export async function handleDncBudgetTransactionsList(env: Env, month: string): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT
       t.id, t.posted_date, t.amount, t.description, t.merchant, t.type,
       t.category_id, c.name as category_name,
       t.recurring_bill_id, rb.name as recurring_bill_name,
       t.account_id, a.name as account_name, a.type as account_type
     FROM dnc_budget_transactions t
     LEFT JOIN dnc_budget_categories c ON c.id = t.category_id
     LEFT JOIN dnc_budget_recurring_bills rb ON rb.id = t.recurring_bill_id
     LEFT JOIN dnc_budget_accounts a ON a.id = t.account_id
     WHERE t.posted_date LIKE ?
     ORDER BY t.posted_date DESC`,
  )
    .bind(`${month}%`)
    .all();

  return jsonResponse({ ok: true, transactions: rows.results });
}

export async function handleDncBudgetTransactionPatch(request: Request, env: Env, id: string): Promise<Response> {
  let body: { type?: string; categoryId?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const validTypes = ['unclassified', 'recurring', 'discretionary', 'transfer', 'income', 'refund', 'other', 'ignored'];

  const txn = await env.DB.prepare('SELECT merchant, type FROM dnc_budget_transactions WHERE id = ?')
    .bind(id)
    .first<{ merchant: string | null; type: string }>();
  if (!txn) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  let nextType = body.type;
  if (!nextType && body.categoryId && txn.type === 'unclassified') {
    // Only auto-promote out of unclassified — picking a category on an already-typed
    // row (refund, income, other, discretionary) shouldn't silently reclassify it.
    const category = await env.DB.prepare('SELECT name FROM dnc_budget_categories WHERE id = ?')
      .bind(body.categoryId)
      .first<{ name: string }>();
    nextType = category?.name?.trim().toLowerCase() === 'other' ? 'other' : 'discretionary';
  }
  if (nextType && !validTypes.includes(nextType)) {
    return jsonResponse({ ok: false, error: `type must be one of ${validTypes.join(', ')}` }, 400);
  }

  await env.DB.prepare(
    `UPDATE dnc_budget_transactions
     SET type = COALESCE(?, type), category_id = COALESCE(?, category_id)
     WHERE id = ?`,
  )
    .bind(nextType ?? null, body.categoryId ?? null, id)
    .run();

  // Learn the merchant -> category mapping (§3.3) whenever a category's set manually.
  const merchantPattern = normalizeMerchant(txn.merchant);
  if (body.categoryId && merchantPattern) {
    await env.DB.prepare(
      `INSERT INTO dnc_budget_merchant_category_rules (id, merchant_pattern, category_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(merchant_pattern) DO UPDATE SET category_id = excluded.category_id`,
    )
      .bind(crypto.randomUUID(), merchantPattern, body.categoryId, nowIso())
      .run();
  }

  return jsonResponse({ ok: true });
}

export async function handleDncBudgetTransactionIgnore(env: Env, id: string): Promise<Response> {
  const result = await env.DB.prepare(
    `UPDATE dnc_budget_transactions SET type = 'ignored', category_id = NULL, recurring_bill_id = NULL WHERE id = ?`,
  )
    .bind(id)
    .run();
  if (result.meta.changes === 0) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }
  return jsonResponse({ ok: true });
}

export async function handleDncBudgetMarkExpected(request: Request, env: Env, id: string): Promise<Response> {
  let body: {
    name?: string;
    expectedAmount?: number;
    isVariable?: boolean;
    expectedDayMin?: number;
    expectedDayMax?: number;
    amountTolerance?: number;
  } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  if (
    !body.name ||
    typeof body.expectedAmount !== 'number' ||
    typeof body.expectedDayMin !== 'number' ||
    typeof body.expectedDayMax !== 'number'
  ) {
    return jsonResponse(
      { ok: false, error: 'name, expectedAmount, expectedDayMin, expectedDayMax are required' },
      400,
    );
  }

  const txn = await env.DB.prepare('SELECT id FROM dnc_budget_transactions WHERE id = ?').bind(id).first();
  if (!txn) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  const billId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO dnc_budget_recurring_bills
       (id, name, merchant_pattern, expected_amount, amount_tolerance, is_variable, expected_day_min, expected_day_max, confirmed, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
  )
    .bind(
      billId,
      body.name,
      normalizeMerchant(body.name),
      body.expectedAmount,
      body.amountTolerance ?? (body.isVariable ? 0.5 : 0.15),
      body.isVariable ? 1 : 0,
      body.expectedDayMin,
      body.expectedDayMax,
      nowIso(),
    )
    .run();

  await env.DB.prepare(
    `UPDATE dnc_budget_transactions SET type = 'recurring', recurring_bill_id = ?, category_id = NULL WHERE id = ?`,
  )
    .bind(billId, id)
    .run();

  return jsonResponse({ ok: true, recurringBillId: billId });
}

export async function handleDncBudgetLogCharge(request: Request, env: Env): Promise<Response> {
  let body: { store?: string; amount?: number; date?: string; categoryId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!body.store || typeof body.amount !== 'number' || !body.date) {
    return jsonResponse({ ok: false, error: 'store, amount, date are required' }, 400);
  }

  const storeName = body.store.trim();

  let account = await env.DB.prepare(
    `SELECT id FROM dnc_budget_accounts WHERE is_manual = 1 AND name = ? COLLATE NOCASE`,
  )
    .bind(storeName)
    .first<{ id: string }>();

  if (!account) {
    const accountId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO dnc_budget_accounts (id, name, type, is_manual, active, created_at) VALUES (?, ?, 'credit', 1, 1, ?)`,
    )
      .bind(accountId, storeName, nowIso())
      .run();
    account = { id: accountId };
  }

  const txnId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO dnc_budget_transactions
       (id, account_id, posted_date, amount, description, merchant, type, category_id, created_at)
     VALUES (?, ?, ?, ?, 'Manual entry', ?, 'discretionary', ?, ?)`,
  )
    .bind(txnId, account.id, body.date, body.amount, storeName, body.categoryId ?? null, nowIso())
    .run();

  return jsonResponse({ ok: true, transactionId: txnId });
}

// ---- Categories ----

export async function handleDncBudgetCategoriesList(env: Env): Promise<Response> {
  const rows = await env.DB.prepare('SELECT id, name, monthly_cap, sort_order FROM dnc_budget_categories ORDER BY sort_order').all();
  return jsonResponse({ ok: true, categories: rows.results });
}

export async function handleDncBudgetCategoryCreate(request: Request, env: Env): Promise<Response> {
  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body.name?.trim()) {
    return jsonResponse({ ok: false, error: 'name is required' }, 400);
  }

  const maxRow = await env.DB.prepare('SELECT MAX(sort_order) as max_sort FROM dnc_budget_categories').first<{
    max_sort: number | null;
  }>();
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO dnc_budget_categories (id, name, sort_order) VALUES (?, ?, ?)')
    .bind(id, body.name.trim(), (maxRow?.max_sort ?? 0) + 1)
    .run();

  return jsonResponse({ ok: true, id });
}
