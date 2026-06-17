import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';

import { parseCurrencyAmount } from '../utils/money.js';
import {
  parseOrderBoolean,
  dbRecordOrderEvent,
  dbApplyOrderFundsAccounting,
  dbGetOrderFundsAccountingTotals,
} from './db.js';

export async function handleAdminV2OrderAccountFunds(request: Request, orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const usedLocalFunds = parseCurrencyAmount(body.usedLocalFunds);
  const mfrWholesaleFunds = parseCurrencyAmount(body.mfrWholesaleFunds);
  const adjustedCostBasis = parseCurrencyAmount(body.adjustedCostBasis);
  if (usedLocalFunds == null || usedLocalFunds < 0) {
    return jsonResponse({ message: 'Used/Local Funds must be $0 or greater.' }, 400);
  }
  if (mfrWholesaleFunds == null || mfrWholesaleFunds < 0) {
    return jsonResponse({ message: 'Mfr/Wholesale Funds must be $0 or greater.' }, 400);
  }
  if (adjustedCostBasis == null || adjustedCostBasis < 0) {
    return jsonResponse({ message: 'Adjusted Cost Basis must be $0 or greater.' }, 400);
  }

  const order = await env.DB.prepare(
    'SELECT id, status, listings_updated, settled, money_accounted FROM orders WHERE id = ? LIMIT 1'
  ).bind(normalizedOrderId).first<Record<string, unknown>>();
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);
  const wasMoneyAccounted = parseOrderBoolean(order.money_accounted);
  const previousFunds = await dbGetOrderFundsAccountingTotals(normalizedOrderId, env);
  const usedLocalFundsDelta = Number((usedLocalFunds - previousFunds.usedLocalFunds).toFixed(2));
  const mfrWholesaleFundsDelta = Number((mfrWholesaleFunds - previousFunds.mfrWholesaleFunds).toFixed(2));

  await dbApplyOrderFundsAccounting(
    normalizedOrderId,
    usedLocalFundsDelta,
    mfrWholesaleFundsDelta,
    adjustedCostBasis,
    env,
  );

  await dbRecordOrderEvent(normalizedOrderId, {
    eventType: wasMoneyAccounted ? 'order_money_accounting_adjusted' : 'order_money_accounted',
    fromStatus: normalizeText(order.status, ''),
    toStatus: normalizeText(order.status, ''),
    source: 'admin_v2',
    sourceId: '',
    message: wasMoneyAccounted
      ? 'Order money accounting adjusted. Funds buckets updated.'
      : 'Order money accounted. Funds added to buckets.',
    payloadJson: JSON.stringify({
      usedLocalFunds: usedLocalFundsDelta,
      mfrWholesaleFunds: mfrWholesaleFundsDelta,
      totalUsedLocalFunds: Number(usedLocalFunds.toFixed(2)),
      totalMfrWholesaleFunds: Number(mfrWholesaleFunds.toFixed(2)),
      adjustedCostBasis: Number(adjustedCostBasis.toFixed(2)),
    }),
  }, env);

  return jsonResponse({
    ok: true,
    listingsUpdated: parseOrderBoolean(order.listings_updated),
    settled: parseOrderBoolean(order.settled),
    moneyAccounted: true,
    funds: {
      usedLocalFunds: Number(usedLocalFunds.toFixed(2)),
      mfrWholesaleFunds: Number(mfrWholesaleFunds.toFixed(2)),
      adjustedCostBasis: Number(adjustedCostBasis.toFixed(2)),
      usedLocalFundsDelta,
      mfrWholesaleFundsDelta,
    },
  });
}

export async function dbApplyOrderFundsAccounting(
  orderId: string,
  usedLocalFundsDelta: number,
  mfrWholesaleFundsDelta: number,
  adjustedCostBasis: number,
  env: Env,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sys_info
       SET current_used_local_funds = ROUND(COALESCE(current_used_local_funds, 0) + ?, 2),
           current_mfr_wholesale_funds = ROUND(COALESCE(current_mfr_wholesale_funds, 0) + ?, 2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM sys_info ORDER BY id LIMIT 1)`
    ).bind(Number(usedLocalFundsDelta.toFixed(2)), Number(mfrWholesaleFundsDelta.toFixed(2))),
    env.DB.prepare(
      `UPDATE orders
       SET money_accounted = 1,
           cost_basis_adjusted = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(Number(adjustedCostBasis.toFixed(2)), orderId),
  ]);
}

export async function dbReverseOrderFundsAccounting(
  orderId: string,
  env: Env,
): Promise<{ usedLocalFunds: number; mfrWholesaleFunds: number } | null> {
  const totals = await dbGetOrderFundsAccountingTotals(orderId, env);
  if (totals.usedLocalFunds <= 0 && totals.mfrWholesaleFunds <= 0) return null;

  const reversal = {
    usedLocalFunds: Number(Math.max(0, totals.usedLocalFunds).toFixed(2)),
    mfrWholesaleFunds: Number(Math.max(0, totals.mfrWholesaleFunds).toFixed(2)),
  };

  await env.DB.prepare(
    `UPDATE sys_info
     SET current_used_local_funds = ROUND(MAX(0, COALESCE(current_used_local_funds, 0) - ?), 2),
         current_mfr_wholesale_funds = ROUND(MAX(0, COALESCE(current_mfr_wholesale_funds, 0) - ?), 2),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = (SELECT id FROM sys_info ORDER BY id LIMIT 1)`
  ).bind(reversal.usedLocalFunds, reversal.mfrWholesaleFunds).run();

  await dbRecordOrderEvent(orderId, {
    eventType: 'order_money_accounting_reversed',
    fromStatus: 'paid',
    toStatus: 'refunded',
    source: 'admin_v2',
    sourceId: '',
    message: 'Order money accounting reversed. Funds removed from buckets.',
    payloadJson: JSON.stringify(reversal),
  }, env);

  return reversal;
}

export async function dbGetOrderFundsAccountingTotals(
  orderId: string,
  env: Env,
): Promise<{ usedLocalFunds: number; mfrWholesaleFunds: number }> {
  const result = await env.DB.prepare(
    `SELECT payload_json
     FROM order_events
     WHERE order_id = ?
       AND event_type IN ('order_money_accounted', 'order_money_accounting_adjusted')`
  ).bind(orderId).all<{ payload_json: string | null }>();

  let usedLocalFunds = 0;
  let mfrWholesaleFunds = 0;
  for (const row of result.results ?? []) {
    if (!row.payload_json) continue;
    try {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      usedLocalFunds += parseCurrencyAmount(payload.usedLocalFunds) ?? 0;
      mfrWholesaleFunds += parseCurrencyAmount(payload.mfrWholesaleFunds) ?? 0;
    } catch {
      // Ignore malformed historical payloads; they should not block order detail or refund.
    }
  }

  return {
    usedLocalFunds: Number(Math.max(0, usedLocalFunds).toFixed(2)),
    mfrWholesaleFunds: Number(Math.max(0, mfrWholesaleFunds).toFixed(2)),
  };
}
