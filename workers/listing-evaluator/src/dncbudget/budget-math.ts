import type { Env } from '../env.js';

// Implements dncbudget-spec.md §3.1 (definitions) and §5.2/5.3 (pace + status).

export type MonthStatus = 'green' | 'warning' | 'red' | null;

export interface MonthSummary {
  month: string;
  totalIn: number | null;
  committedRecurring: number;
  spentSoFar: number;
  safeToSpend: number | null;
  status: MonthStatus;
  needingReview: number;
}

function daysInMonth(month: string): number {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon, 0).getDate();
}

function daysElapsed(month: string): number {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (month === currentMonth) {
    return now.getDate();
  }
  // Past (or future) months are treated as fully elapsed — pace math only
  // makes sense for the live month; closed months just compare totals.
  return daysInMonth(month);
}

export async function computeMonthSummary(env: Env, month: string): Promise<MonthSummary> {
  const monthLike = `${month}%`;

  const budgetRow = await env.DB.prepare('SELECT total_in FROM dnc_budget_monthly_budget WHERE month = ?')
    .bind(month)
    .first<{ total_in: number }>();
  const totalIn = budgetRow?.total_in ?? null;

  const bills = await env.DB.prepare(
    'SELECT id, expected_amount FROM dnc_budget_recurring_bills WHERE active = 1 AND confirmed = 1',
  ).all<{ id: string; expected_amount: number }>();

  const postedByBill = await env.DB.prepare(
    `SELECT recurring_bill_id, SUM(amount) as total
     FROM dnc_budget_transactions
     WHERE type = 'recurring' AND recurring_bill_id IS NOT NULL AND posted_date LIKE ?
     GROUP BY recurring_bill_id`,
  )
    .bind(monthLike)
    .all<{ recurring_bill_id: string; total: number }>();

  const postedMap = new Map(postedByBill.results.map((r) => [r.recurring_bill_id, r.total]));
  const committedRecurring = bills.results.reduce(
    (sum, bill) => sum + (postedMap.get(bill.id) ?? bill.expected_amount),
    0,
  );

  const spentRow = await env.DB.prepare(
    `SELECT SUM(amount) as total FROM dnc_budget_transactions WHERE type = 'discretionary' AND posted_date LIKE ?`,
  )
    .bind(monthLike)
    .first<{ total: number | null }>();
  const spentSoFar = spentRow?.total ?? 0;

  const reviewRow = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM dnc_budget_transactions WHERE type = 'unclassified' AND posted_date LIKE ?`,
  )
    .bind(monthLike)
    .first<{ count: number }>();
  const needingReview = reviewRow?.count ?? 0;

  let safeToSpend: number | null = null;
  let status: MonthStatus = null;

  if (totalIn !== null) {
    safeToSpend = totalIn - committedRecurring - spentSoFar;

    const available = totalIn - committedRecurring;
    const elapsed = daysElapsed(month);
    const total = daysInMonth(month);
    const idealPace = available * (elapsed / total);
    const projectedTotal = elapsed > 0 ? spentSoFar * (total / elapsed) : spentSoFar;

    if (projectedTotal > available) {
      status = 'red';
    } else if (spentSoFar > idealPace) {
      status = 'warning';
    } else {
      status = 'green';
    }
  }

  return { month, totalIn, committedRecurring, spentSoFar, safeToSpend, status, needingReview };
}
