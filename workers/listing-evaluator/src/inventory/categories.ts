import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';
import type { InventoryItemRow, InventoryCategoryRow, InventoryCategoryNode } from '../types/inventory.js';

function parseOptionalPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  let parsed: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    parsed = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const next = Number.parseInt(value.trim(), 10);
    parsed = Number.isFinite(next) ? next : null;
  }
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getInventoryCategoryLabel(row: Pick<InventoryItemRow, 'category_path' | 'category_name'>): string {
  return normalizeText(row.category_path, '') || normalizeText(row.category_name, '');
}

export function buildInventoryCategoryTree(rows: InventoryCategoryRow[]): InventoryCategoryNode[] {
  const byId = new Map<number, InventoryCategoryNode>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      order: Number(row.order || 0),
      depth: 1,
      path: row.name,
      children: [],
    });
  }

  const roots: InventoryCategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const assignDepth = (node: InventoryCategoryNode, parentPath: string, depth: number): void => {
    node.depth = depth;
    node.path = parentPath ? `${parentPath} > ${node.name}` : node.name;
    for (const child of node.children) {
      assignDepth(child, node.path, depth + 1);
    }
  };

  const sortNodes = (a: InventoryCategoryNode, b: InventoryCategoryNode): number =>
    a.order - b.order || a.name.localeCompare(b.name) || a.id - b.id;

  for (const node of byId.values()) {
    node.children.sort(sortNodes);
  }
  roots.sort(sortNodes);
  for (const root of roots) {
    assignDepth(root, '', 1);
  }
  return roots;
}

export function parseAdminV2InventoryCategoryId(path: string): number | null {
  const parts = path.split('/').filter(Boolean);
  const categoriesIndex = parts.indexOf('categories');
  const rawId = categoriesIndex >= 0 ? parts[categoriesIndex + 1] : '';
  return parseOptionalPositiveInt(rawId);
}

export async function dbInventoryCategoryExists(categoryId: number, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_categories WHERE id = ? LIMIT 1'
  ).bind(categoryId).first<{ id: number }>();
  return Boolean(row?.id);
}

export async function dbCreateInventoryCategory(
  fields: { name: string; parent_id: number | null; order: number },
  env: Env,
): Promise<InventoryCategoryRow | null> {
  try {
    const result = await env.DB.prepare(
      'INSERT INTO ccg_inventory_categories (name, parent_id, "order") VALUES (?, ?, ?)'
    ).bind(fields.name, fields.parent_id, fields.order).run();
    const id = Number(result.meta?.last_row_id || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id, name: fields.name, parent_id: fields.parent_id, order: fields.order };
  } catch (error) {
    console.error('Inventory category create failed', { error });
    return null;
  }
}

export async function dbUpdateInventoryCategory(
  categoryId: number,
  fields: { name: string; parent_id: number | null; order: number },
  env: Env,
): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      'UPDATE ccg_inventory_categories SET name = ?, parent_id = ?, "order" = ? WHERE id = ?'
    ).bind(fields.name, fields.parent_id, fields.order, categoryId).run();
    return Number(result.meta?.changes || 0) > 0;
  } catch (error) {
    console.error('Inventory category update failed', { error });
    return false;
  }
}

export async function dbDeleteInventoryCategory(categoryId: number, env: Env): Promise<number> {
  try {
    const result = await env.DB.prepare(
      'DELETE FROM ccg_inventory_categories WHERE id = ?'
    ).bind(categoryId).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory category delete failed', { error });
    return 0;
  }
}

export async function dbCountInventoryCategoryChildren(categoryId: number, env: Env): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM ccg_inventory_categories WHERE parent_id = ?'
  ).bind(categoryId).first<{ total: number | null }>();
  return Number(row?.total || 0);
}

export async function dbCountInventoryItemsForCategory(categoryId: number, env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM ccg_inventory_items
     WHERE category_id = ? OR secondary_category_id = ?`
  ).bind(categoryId, categoryId).first<{ total: number | null }>();
  return Number(row?.total || 0);
}

export async function dbInventoryCategoryParentWouldCreateCycle(
  categoryId: number,
  parentId: number,
  env: Env,
): Promise<boolean> {
  let currentParentId: number | null = parentId;
  const seen = new Set<number>();
  while (currentParentId != null) {
    if (currentParentId === categoryId) return true;
    if (seen.has(currentParentId)) return true;
    seen.add(currentParentId);
    const row = await env.DB.prepare(
      'SELECT parent_id FROM ccg_inventory_categories WHERE id = ? LIMIT 1'
    ).bind(currentParentId).first<{ parent_id: number | null }>();
    currentParentId = row?.parent_id ?? null;
  }
  return false;
}

export async function dbFindTopLevelPackageCategoryId(env: Env): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT id
     FROM ccg_inventory_categories
     WHERE parent_id IS NULL
       AND LOWER(name) LIKE ?
     ORDER BY "order" ASC, LOWER(name) ASC, id ASC
     LIMIT 1`
  ).bind('%package%').first<{ id: number }>();
  return row?.id ?? null;
}

export async function dbListInventoryCategories(env: Env): Promise<InventoryCategoryRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, name, parent_id, "order"
     FROM ccg_inventory_categories
     ORDER BY
       CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END ASC,
       COALESCE(parent_id, id) ASC,
       "order" ASC,
       LOWER(name) ASC,
       id ASC`
  ).all<InventoryCategoryRow>();
  return result.results ?? [];
}

export async function handleAdminV2InventoryCategories(env: Env): Promise<Response> {
  const records = await dbListInventoryCategories(env);
  return jsonResponse({
    records,
    tree: buildInventoryCategoryTree(records),
  });
}

export async function handleAdminV2InventoryCategoryCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const name = normalizeText(body.name, '').slice(0, 120);
  const parentId = parseOptionalPositiveInt(body.parentId);
  const orderValue = parseBoundedInt(body.order, 0, -100000, 100000);

  if (!name) return jsonResponse({ message: 'Category name is required.' }, 400);
  if (parentId != null && !(await dbInventoryCategoryExists(parentId, env))) {
    return jsonResponse({ message: 'Parent category does not exist.' }, 400);
  }

  const created = await dbCreateInventoryCategory({ name, parent_id: parentId, order: orderValue }, env);
  if (!created) return jsonResponse({ message: 'Unable to create category.' }, 500);
  return jsonResponse({ ok: true, record: created });
}

export async function handleAdminV2InventoryCategoryUpdate(request: Request, path: string, env: Env): Promise<Response> {
  const categoryId = parseAdminV2InventoryCategoryId(path);
  if (categoryId == null) return jsonResponse({ message: 'Missing category ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const name = normalizeText(body.name, '').slice(0, 120);
  const parentId = parseOptionalPositiveInt(body.parentId);
  const orderValue = parseBoundedInt(body.order, 0, -100000, 100000);

  if (!name) return jsonResponse({ message: 'Category name is required.' }, 400);
  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category not found.' }, 404);
  }
  if (parentId === categoryId) {
    return jsonResponse({ message: 'A category cannot be its own parent.' }, 400);
  }
  if (parentId != null) {
    if (!(await dbInventoryCategoryExists(parentId, env))) {
      return jsonResponse({ message: 'Parent category does not exist.' }, 400);
    }
    if (await dbInventoryCategoryParentWouldCreateCycle(categoryId, parentId, env)) {
      return jsonResponse({ message: 'Parent category cannot be one of this category’s descendants.' }, 400);
    }
  }

  const updated = await dbUpdateInventoryCategory(categoryId, { name, parent_id: parentId, order: orderValue }, env);
  if (!updated) return jsonResponse({ message: 'Unable to update category.' }, 500);
  return jsonResponse({ ok: true });
}

export async function handleAdminV2InventoryCategoryDelete(path: string, env: Env): Promise<Response> {
  const categoryId = parseAdminV2InventoryCategoryId(path);
  if (categoryId == null) return jsonResponse({ message: 'Missing category ID.' }, 400);

  if (!(await dbInventoryCategoryExists(categoryId, env))) {
    return jsonResponse({ message: 'Category not found.' }, 404);
  }

  const childCount = await dbCountInventoryCategoryChildren(categoryId, env);
  if (childCount > 0) {
    return jsonResponse({
      message: `Cannot delete this category because ${childCount} child categor${childCount === 1 ? 'y uses' : 'ies use'} it. Delete or move children first.`,
      childCount,
    }, 400);
  }

  const itemCount = await dbCountInventoryItemsForCategory(categoryId, env);
  if (itemCount > 0) {
    return jsonResponse({
      message: `Cannot delete this category because ${itemCount} inventory item${itemCount === 1 ? ' uses' : 's use'} it. Move those items first.`,
      itemCount,
    }, 400);
  }

  const deleted = await dbDeleteInventoryCategory(categoryId, env);
  if (deleted < 1) return jsonResponse({ message: 'Category not found.' }, 404);
  return jsonResponse({ ok: true, deletedCount: deleted });
}
