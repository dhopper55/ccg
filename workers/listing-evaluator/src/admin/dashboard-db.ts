import type { Env } from '../env.js';
import { toAdminImageUrl } from '../utils/image.js';

export type AdminV2DashboardSummary = {
  inventoryCostBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
  realizedProfitMTD: number;
  soldMargin30DayPercent: number;
  soldMargin60DayPercent: number;
  soldMargin90DayPercent: number;
  postStoreLaunchMarginPercent: number;
  postStoreLaunchDate: string;
  forSaleItems: number;
  avgDaysToSell: number;
  activeItems: number;
  notForSaleItems: number;
  soldItems: number;
  allTimeSoldMarginPercent: number;
};

export type AdminV2ProfitTrendPoint = {
  month: string;
  label: string;
  soldCount: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type AdminV2InventoryAgingBucket = {
  key: string;
  label: string;
  itemCount: number;
  costBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
};

export type AdminV2InventoryCategoryBucket = {
  category: string;
  itemCount: number;
};

export type AdminV2RecentSaleRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  category: string | null;
  brand: string | null;
  soldDate: string | null;
  unitPurchasePrice: number;
  soldAmount: number;
  profitAmount: number;
  daysHeld: number | null;
};

export type AdminV2OldestInventoryRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  category: string | null;
  brand: string | null;
  purchasedDate: string | null;
  daysHeld: number | null;
  unitPurchasePrice: number;
  privatePartyValue: number;
  currentAskingValue: number;
  forSale: boolean;
  source: string | null;
};

// Matches the SQL constant in index.ts
const INVENTORY_UNIT_COST_BASIS_SQL = `COALESCE(i.unit_purchase_price, 0) *
        CASE
          WHEN COALESCE(i.quantity, 1) > 1 THEN COALESCE(i.quantity, 1)
          ELSE 1
        END`;

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-');
  const date = new Date(Number(year), Number(mon) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

async function dbGetInventorySummary(env: Env): Promise<{
  ccgPaidUnsold: number;
  ccgPrivatePartyUnsold: number;
  ccgForSaleItems: number;
  ccgActiveItems: number;
  ccgNotForSaleItems: number;
  ccgSoldItems: number;
  ccgSoldProfitMarginPercent: number;
}> {
  const row = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 0 AND COALESCE(i.is_personal, 0) = 0 THEN ${INVENTORY_UNIT_COST_BASIS_SQL} ELSE 0 END), 0) AS ccg_paid_unsold,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 0 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.private_party_value, 0) ELSE 0 END), 0) AS ccg_private_party_unsold,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.is_sold, 0) = 0 AND COALESCE(i.for_sale, 0) = 1 AND COALESCE(i.is_personal, 0) = 0 THEN 1 ELSE 0 END), 0) AS ccg_for_sale_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.is_personal, 0) = 0 THEN 1 ELSE 0 END), 0) AS ccg_active_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.is_sold, 0) = 0 AND COALESCE(i.for_sale, 0) = 0 AND COALESCE(i.is_personal, 0) = 0 THEN 1 ELSE 0 END), 0) AS ccg_not_for_sale_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN 1 ELSE 0 END), 0) AS ccg_sold_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.sold_amount, 0) ELSE 0 END), 0) AS ccg_sold_revenue,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN (COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})) ELSE 0 END), 0) AS ccg_sold_profit_amount
     FROM ccg_inventory_items i`
  ).first<{
    ccg_paid_unsold: number | null;
    ccg_private_party_unsold: number | null;
    ccg_for_sale_items: number | null;
    ccg_active_items: number | null;
    ccg_not_for_sale_items: number | null;
    ccg_sold_items: number | null;
    ccg_sold_revenue: number | null;
    ccg_sold_profit_amount: number | null;
  }>();

  const soldRevenue = Number(row?.ccg_sold_revenue || 0);
  const soldProfit = Number(row?.ccg_sold_profit_amount || 0);
  return {
    ccgPaidUnsold: Number(row?.ccg_paid_unsold || 0),
    ccgPrivatePartyUnsold: Number(row?.ccg_private_party_unsold || 0),
    ccgForSaleItems: Number(row?.ccg_for_sale_items || 0),
    ccgActiveItems: Number(row?.ccg_active_items || 0),
    ccgNotForSaleItems: Number(row?.ccg_not_for_sale_items || 0),
    ccgSoldItems: Number(row?.ccg_sold_items || 0),
    ccgSoldProfitMarginPercent: soldRevenue > 0 ? (soldProfit / soldRevenue) * 100 : 0,
  };
}

async function dbGetSystemSettings(env: Env): Promise<{ postStoreLaunchDate: string }> {
  const row = await env.DB.prepare(
    `SELECT value FROM system_settings WHERE key = 'post_store_launch_date' LIMIT 1`
  ).first<{ value: string | null }>();
  return { postStoreLaunchDate: row?.value || '2000-01-01' };
}

export async function dbGetAdminV2DashboardSummary(env: Env): Promise<AdminV2DashboardSummary> {
  const summary = await dbGetInventorySummary(env);
  const { postStoreLaunchDate } = await dbGetSystemSettings(env);
  const row = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(
        CASE
          WHEN i.is_active = 1 AND COALESCE(i.is_sold, 0) = 0 AND COALESCE(i.for_sale, 0) = 1
            THEN COALESCE(l.price_asking, i.private_party_value, (${INVENTORY_UNIT_COST_BASIS_SQL}), 0)
          ELSE 0
        END
      ), 0) AS current_asking_value,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', 'start of month')
            THEN COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})
          ELSE 0
        END
      ), 0) AS realized_profit_mtd,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-30 days')
            THEN COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})
          ELSE 0
        END
      ), 0) AS sold_profit_30d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-30 days')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS sold_revenue_30d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-60 days')
            THEN COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})
          ELSE 0
        END
      ), 0) AS sold_profit_60d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-60 days')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS sold_revenue_60d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-90 days')
            THEN COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})
          ELSE 0
        END
      ), 0) AS sold_profit_90d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date('now', '-90 days')
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS sold_revenue_90d,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date(?)
            THEN COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})
          ELSE 0
        END
      ), 0) AS post_store_launch_profit,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND COALESCE(i.is_personal, 0) = 0
            AND i.sold_date IS NOT NULL
            AND i.sold_date >= date(?)
            THEN COALESCE(i.sold_amount, 0)
          ELSE 0
        END
      ), 0) AS post_store_launch_revenue,
      COALESCE(AVG(
        CASE
          WHEN COALESCE(i.is_sold, 0) = 1
            AND i.purchased_date IS NOT NULL
            AND i.sold_date IS NOT NULL
            THEN julianday(i.sold_date) - julianday(i.purchased_date)
          ELSE NULL
        END
      ), 0) AS avg_days_to_sell
     FROM ccg_inventory_items i
     LEFT JOIN listings l ON l.id = i.source_listing_id`
  ).bind(postStoreLaunchDate, postStoreLaunchDate).first<{
    current_asking_value: number | null;
    realized_profit_mtd: number | null;
    sold_profit_30d: number | null;
    sold_revenue_30d: number | null;
    sold_profit_60d: number | null;
    sold_revenue_60d: number | null;
    sold_profit_90d: number | null;
    sold_revenue_90d: number | null;
    post_store_launch_profit: number | null;
    post_store_launch_revenue: number | null;
    avg_days_to_sell: number | null;
  }>();

  const soldRevenue30Day = Number(row?.sold_revenue_30d || 0);
  const soldRevenue60Day = Number(row?.sold_revenue_60d || 0);
  const soldRevenue90Day = Number(row?.sold_revenue_90d || 0);
  const postStoreLaunchRevenue = Number(row?.post_store_launch_revenue || 0);

  return {
    inventoryCostBasis: summary.ccgPaidUnsold,
    privatePartyValue: summary.ccgPrivatePartyUnsold,
    currentAskingValue: Number(row?.current_asking_value || 0),
    realizedProfitMTD: Number(row?.realized_profit_mtd || 0),
    soldMargin30DayPercent: soldRevenue30Day > 0 ? (Number(row?.sold_profit_30d || 0) / soldRevenue30Day) * 100 : 0,
    soldMargin60DayPercent: soldRevenue60Day > 0 ? (Number(row?.sold_profit_60d || 0) / soldRevenue60Day) * 100 : 0,
    soldMargin90DayPercent: soldRevenue90Day > 0 ? (Number(row?.sold_profit_90d || 0) / soldRevenue90Day) * 100 : 0,
    postStoreLaunchMarginPercent: postStoreLaunchRevenue > 0
      ? (Number(row?.post_store_launch_profit || 0) / postStoreLaunchRevenue) * 100
      : 0,
    postStoreLaunchDate,
    forSaleItems: summary.ccgForSaleItems,
    avgDaysToSell: Number(row?.avg_days_to_sell || 0),
    activeItems: summary.ccgActiveItems,
    notForSaleItems: summary.ccgNotForSaleItems,
    soldItems: summary.ccgSoldItems,
    allTimeSoldMarginPercent: summary.ccgSoldProfitMarginPercent,
  };
}

export async function dbGetAdminV2ProfitTrend(months: number, env: Env): Promise<AdminV2ProfitTrendPoint[]> {
  const rows = await env.DB.prepare(
    `SELECT
      strftime('%Y-%m', i.sold_date) AS month_key,
      COUNT(*) AS sold_count,
      COALESCE(SUM(i.sold_amount), 0) AS revenue,
      COALESCE(SUM(${INVENTORY_UNIT_COST_BASIS_SQL}), 0) AS cost,
      COALESCE(SUM(COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})), 0) AS profit
     FROM ccg_inventory_items i
     WHERE COALESCE(i.is_sold, 0) = 1
       AND COALESCE(i.is_personal, 0) = 0
       AND i.sold_date IS NOT NULL
       AND i.sold_date >= date('now', 'start of month', ?)
     GROUP BY month_key
     ORDER BY month_key ASC`
  ).bind(`-${Math.max(0, months - 1)} months`).all<{
    month_key: string | null;
    sold_count: number | null;
    revenue: number | null;
    cost: number | null;
    profit: number | null;
  }>();

  const byMonth = new Map<string, {
    soldCount: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();
  for (const row of rows.results ?? []) {
    const key = typeof row.month_key === 'string' ? row.month_key : '';
    if (!key) continue;
    byMonth.set(key, {
      soldCount: Number(row.sold_count || 0),
      revenue: Number(row.revenue || 0),
      cost: Number(row.cost || 0),
      profit: Number(row.profit || 0),
    });
  }

  const points: AdminV2ProfitTrendPoint[] = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() - (months - 1));

  for (let index = 0; index < months; index += 1) {
    const month = cursor.toISOString().slice(0, 7);
    const row = byMonth.get(month);
    points.push({
      month,
      label: formatMonthLabel(month),
      soldCount: row?.soldCount ?? 0,
      revenue: row?.revenue ?? 0,
      cost: row?.cost ?? 0,
      profit: row?.profit ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return points;
}

export async function dbGetAdminV2InventoryAging(env: Env): Promise<AdminV2InventoryAgingBucket[]> {
  const rows = await env.DB.prepare(
    `SELECT
      CASE
        WHEN i.purchased_date IS NULL THEN 'unknown'
        WHEN julianday('now') - julianday(i.purchased_date) <= 30 THEN '0-30'
        WHEN julianday('now') - julianday(i.purchased_date) <= 60 THEN '31-60'
        WHEN julianday('now') - julianday(i.purchased_date) <= 90 THEN '61-90'
        ELSE '90+'
      END AS bucket_key,
      COUNT(*) AS item_count,
      COALESCE(SUM(${INVENTORY_UNIT_COST_BASIS_SQL}), 0) AS cost_basis,
      COALESCE(SUM(COALESCE(i.private_party_value, 0)), 0) AS private_party_value,
      COALESCE(SUM(COALESCE(l.price_asking, i.private_party_value, (${INVENTORY_UNIT_COST_BASIS_SQL}), 0)), 0) AS current_asking_value
     FROM ccg_inventory_items i
     LEFT JOIN listings l ON l.id = i.source_listing_id
     WHERE i.is_active = 1
       AND COALESCE(i.is_sold, 0) = 0
       AND COALESCE(i.is_personal, 0) = 0
     GROUP BY bucket_key`
  ).all<{
    bucket_key: string | null;
    item_count: number | null;
    cost_basis: number | null;
    private_party_value: number | null;
    current_asking_value: number | null;
  }>();

  const labels: Record<string, string> = {
    '0-30': '0-30 days',
    '31-60': '31-60 days',
    '61-90': '61-90 days',
    '90+': '90+ days',
    unknown: 'Unknown purchase date',
  };

  const defaults = ['0-30', '31-60', '61-90', '90+', 'unknown'];
  const byKey = new Map<string, AdminV2InventoryAgingBucket>();

  for (const row of rows.results ?? []) {
    const key = typeof row.bucket_key === 'string' ? row.bucket_key : 'unknown';
    byKey.set(key, {
      key,
      label: labels[key] || key,
      itemCount: Number(row.item_count || 0),
      costBasis: Number(row.cost_basis || 0),
      privatePartyValue: Number(row.private_party_value || 0),
      currentAskingValue: Number(row.current_asking_value || 0),
    });
  }

  return defaults.map((key) => byKey.get(key) || {
    key,
    label: labels[key] || key,
    itemCount: 0,
    costBasis: 0,
    privatePartyValue: 0,
    currentAskingValue: 0,
  });
}

export async function dbGetAdminV2InventoryByCategory(env: Env): Promise<AdminV2InventoryCategoryBucket[]> {
  const rows = await env.DB.prepare(
    `SELECT
      CASE
        WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
        WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
        ELSE c.name
      END AS category,
      COUNT(*) AS item_count
     FROM ccg_inventory_items i
     INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     WHERE COALESCE(i.is_active, 0) = 1
     GROUP BY i.category_id
     ORDER BY item_count DESC, category ASC`
  ).all<{
    category: string | null;
    item_count: number | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    category: row.category || 'Uncategorized',
    itemCount: Number(row.item_count || 0),
  }));
}

export async function dbGetAdminV2RecentSales(limit: number, env: Env): Promise<AdminV2RecentSaleRow[]> {
  const rows = await env.DB.prepare(
    `SELECT
      i.id,
      i.ccg_number,
      i.title,
      i.image_url,
      CASE
        WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
        WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
        ELSE c.name
      END AS category,
      i.brand,
      i.sold_date,
      i.unit_purchase_price,
      i.sold_amount,
      (COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})) AS profit_amount,
      CASE
        WHEN i.purchased_date IS NOT NULL AND i.sold_date IS NOT NULL
          THEN CAST(julianday(i.sold_date) - julianday(i.purchased_date) AS INTEGER)
        ELSE NULL
      END AS days_held
     FROM ccg_inventory_items i
     INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     WHERE COALESCE(i.is_sold, 0) = 1
     ORDER BY COALESCE(i.sold_date, i.updated_at, i.created_at) DESC, i.id DESC
     LIMIT ?`
  ).bind(limit).all<{
    id: number;
    ccg_number: string;
    title: string;
    image_url: string | null;
    category: string | null;
    brand: string | null;
    sold_date: string | null;
    unit_purchase_price: number | null;
    sold_amount: number | null;
    profit_amount: number | null;
    days_held: number | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    id: Number(row.id),
    ccgNumber: row.ccg_number,
    title: row.title,
    imageUrl: toAdminImageUrl(row.image_url, 'thumb'),
    category: row.category,
    brand: row.brand,
    soldDate: row.sold_date,
    unitPurchasePrice: Number(row.unit_purchase_price || 0),
    soldAmount: Number(row.sold_amount || 0),
    profitAmount: Number(row.profit_amount || 0),
    daysHeld: row.days_held == null ? null : Number(row.days_held),
  }));
}

export async function dbGetAdminV2OldestInventory(limit: number, env: Env): Promise<AdminV2OldestInventoryRow[]> {
  const rows = await env.DB.prepare(
    `SELECT
      i.id,
      i.ccg_number,
      i.title,
      i.image_url,
      CASE
        WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
        WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
        ELSE c.name
      END AS category,
      i.brand,
      i.purchased_date,
      CASE
        WHEN i.purchased_date IS NOT NULL
          THEN CAST(julianday('now') - julianday(i.purchased_date) AS INTEGER)
        ELSE NULL
      END AS days_held,
      i.unit_purchase_price,
      i.private_party_value,
      COALESCE(l.price_asking, i.private_party_value, (${INVENTORY_UNIT_COST_BASIS_SQL}), 0) AS current_asking_value,
      COALESCE(i.for_sale, 0) AS for_sale,
      l.source AS source
     FROM ccg_inventory_items i
     INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     LEFT JOIN listings l ON l.id = i.source_listing_id
     WHERE i.is_active = 1
       AND COALESCE(i.is_sold, 0) = 0
     ORDER BY
       CASE WHEN i.purchased_date IS NULL THEN 1 ELSE 0 END ASC,
       i.purchased_date ASC,
       i.id ASC
     LIMIT ?`
  ).bind(limit).all<{
    id: number;
    ccg_number: string;
    title: string;
    image_url: string | null;
    category: string | null;
    brand: string | null;
    purchased_date: string | null;
    days_held: number | null;
    unit_purchase_price: number | null;
    private_party_value: number | null;
    current_asking_value: number | null;
    for_sale: number | null;
    source: string | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    id: Number(row.id),
    ccgNumber: row.ccg_number,
    title: row.title,
    imageUrl: toAdminImageUrl(row.image_url, 'thumb'),
    category: row.category,
    brand: row.brand,
    purchasedDate: row.purchased_date,
    daysHeld: row.days_held == null ? null : Number(row.days_held),
    unitPurchasePrice: Number(row.unit_purchase_price || 0),
    privatePartyValue: Number(row.private_party_value || 0),
    currentAskingValue: Number(row.current_asking_value || 0),
    forSale: Number(row.for_sale || 0) === 1,
    source: row.source,
  }));
}
