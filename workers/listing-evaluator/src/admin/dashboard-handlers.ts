import type { Env } from '../env.js';
import { jsonResponse, parseBoundedInt } from '../utils/misc.js';
import {
  dbGetAdminV2DashboardSummary,
  dbGetAdminV2ProfitTrend,
  dbGetAdminV2InventoryAging,
  dbGetAdminV2InventoryByCategory,
  dbGetAdminV2RecentSales,
  dbGetAdminV2OldestInventory,
} from './dashboard-db.js';

function currentDateYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function handleAdminV2DashboardSummary(env: Env): Promise<Response> {
  const summary = await dbGetAdminV2DashboardSummary(env);
  return jsonResponse({
    asOf: currentDateYmd(),
    kpis: summary,
  });
}

export async function handleAdminV2DashboardProfitTrend(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const months = parseBoundedInt(url.searchParams.get('months'), 12, 3, 24);
  const points = await dbGetAdminV2ProfitTrend(months, env);
  return jsonResponse({
    months,
    points,
  });
}

export async function handleAdminV2DashboardInventoryAging(env: Env): Promise<Response> {
  const buckets = await dbGetAdminV2InventoryAging(env);
  return jsonResponse({
    asOf: currentDateYmd(),
    buckets,
  });
}

export async function handleAdminV2DashboardInventoryByCategory(env: Env): Promise<Response> {
  const buckets = await dbGetAdminV2InventoryByCategory(env);
  return jsonResponse({
    asOf: currentDateYmd(),
    buckets,
  });
}

export async function handleAdminV2DashboardRecentSales(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 10, 1, 25);
  const records = await dbGetAdminV2RecentSales(limit, env);
  return jsonResponse({
    records,
  });
}

export async function handleAdminV2DashboardOldestInventory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 10, 1, 25);
  const records = await dbGetAdminV2OldestInventory(limit, env);
  return jsonResponse({
    records,
  });
}
