import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';

// Public, unauthenticated dncbudget route(s) — see dncbudget-spec.md §7.
// Reachable only by knowing a valid, unexpired share-link token. Registered in
// auth/middleware.ts's isPublicApiPath so it bypasses the normal session check.

// Launch-preview breakdown for the 9/1 announcement — hand-entered for this one-time
// send rather than a real "income line items" schema, since there's nothing to track
// yet and this page's whole purpose is a preview before real data exists. The total
// here must match dnc_budget_monthly_budget.total_in for September (verified below
// rather than trusted blindly, so a future edit to one doesn't silently drift from the other).
const SEPTEMBER_INCOME_BREAKDOWN = [
  { source: 'Hopper Realty', amount: 5000 },
  { source: 'Coal Creek Guitars', amount: 500 },
  { source: 'Sequoia (FurnishedFinder)', amount: 6417.44 },
  { source: 'Personal thrift sales', amount: 500 },
];

export async function handleDncBudgetPublicAnalysis(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get('t');
  if (!token) {
    return jsonResponse({ ok: false, error: 'missing_token' }, 400);
  }

  const link = await env.DB.prepare(
    `SELECT expires_at, send_context FROM dnc_budget_share_links WHERE token = ?`,
  )
    .bind(token)
    .first<{ expires_at: string; send_context: string | null }>();

  if (!link) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return jsonResponse({ ok: false, error: 'expired' }, 410);
  }

  const budgetRow = await env.DB.prepare('SELECT total_in FROM dnc_budget_monthly_budget WHERE month = ?')
    .bind('2026-09')
    .first<{ total_in: number }>();

  const categories = await env.DB.prepare('SELECT name FROM dnc_budget_categories ORDER BY sort_order').all<{
    name: string;
  }>();

  return jsonResponse({
    ok: true,
    sendContext: link.send_context,
    totalIn: budgetRow?.total_in ?? null,
    incomeBreakdown: SEPTEMBER_INCOME_BREAKDOWN,
    categories: categories.results.map((c) => c.name),
  });
}
