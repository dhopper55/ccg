import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { dbGetInventoryItem } from './db-core.js';
import { channelCategoryFor } from './channel-category.js';
import { fetchReverbCategories, resolveReverbCategoryUuid } from './reverb-listing.js';

// Reverb category choice for the listing wizard: the saved default for the item's CCG
// subcategory (or category), else a keyword guess from that path. The wizard lets the user pick
// any Reverb category; the pick is saved as that CCG (sub)category's default for next time.

export async function dbGetCcgCategoryReverbDefault(ccgCategoryId: number, env: Env): Promise<string | null> {
  if (!Number.isFinite(ccgCategoryId)) return null;
  const row = await env.DB.prepare(
    'SELECT reverb_category_uuid FROM ccg_inventory_categories WHERE id = ? LIMIT 1'
  ).bind(ccgCategoryId).first<{ reverb_category_uuid: string | null }>();
  return row?.reverb_category_uuid || null;
}

export async function dbSetCcgCategoryReverbDefault(ccgCategoryId: number, categoryUuid: string, env: Env): Promise<void> {
  if (!Number.isFinite(ccgCategoryId)) return;
  try {
    await env.DB.prepare('UPDATE ccg_inventory_categories SET reverb_category_uuid = ? WHERE id = ?')
      .bind(categoryUuid, ccgCategoryId).run();
  } catch (error) {
    console.error('Reverb category default update failed', { error, ccgCategoryId });
  }
}

export type ReverbCategoryChoice = { uuid: string; name: string; source: 'explicit' | 'ccg_default' | 'guess' };

// explicitUuid (from the wizard) wins when it's a real Reverb category.
export async function resolveReverbCategoryForItem(
  record: Record<string, unknown>,
  explicitUuid: string | null,
  env: Env,
): Promise<ReverbCategoryChoice | null> {
  const categories = await fetchReverbCategories(env);
  const byUuid = new Map(categories.map((category) => [category.uuid, category.full_name]));
  if (explicitUuid && byUuid.has(explicitUuid)) {
    return { uuid: explicitUuid, name: byUuid.get(explicitUuid) as string, source: 'explicit' };
  }
  const ccgCategory = channelCategoryFor(record);
  if (ccgCategory.ccgCategoryId) {
    const saved = await dbGetCcgCategoryReverbDefault(ccgCategory.ccgCategoryId, env);
    if (saved && byUuid.has(saved)) return { uuid: saved, name: byUuid.get(saved) as string, source: 'ccg_default' };
  }
  const guess = ccgCategory.path ? await resolveReverbCategoryUuid(ccgCategory.path, env) : null;
  return guess ? { uuid: guess.uuid, name: guess.matchedName, source: 'guess' } : null;
}

// GET /api/inventory/:id/reverb-preview — the suggested Reverb category and the full list.
export async function handleInventoryReverbPreview(_request: Request, path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const actionIndex = parts.indexOf('reverb-preview');
  const recordId = actionIndex > 0 ? parts[actionIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);
  const record = await dbGetInventoryItem(recordId, env);
  if (!record) return jsonResponse({ message: 'Inventory item not found.' }, 404);

  const [suggested, categories] = await Promise.all([
    resolveReverbCategoryForItem(record as Record<string, unknown>, null, env),
    fetchReverbCategories(env),
  ]);
  return jsonResponse({
    ccgCategory: channelCategoryFor(record as Record<string, unknown>).path,
    suggested,
    categories: categories
      .map((category) => ({ uuid: category.uuid, name: category.full_name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
