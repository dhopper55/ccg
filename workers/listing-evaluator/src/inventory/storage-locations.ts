// Storage locations (table ccg_storage_locations, see d1-add-storage-locations.sql). Inventory
// items hold storage_location_id. There is no editor yet: the owner edits the table directly.
//
//   GET /api/admin-v2/storage-locations   -> { locations: [{ id, name, isActive }] }

import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';

export const STORAGE_LOCATIONS_PATH = '/api/admin-v2/storage-locations';

type LocationRow = { id: number; name: string; is_active: number };

export async function handleStorageLocationsList(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT id, name, is_active FROM ccg_storage_locations ORDER BY sort_order ASC, name ASC'
  ).all<LocationRow>();
  return jsonResponse({
    locations: (result.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      isActive: Boolean(row.is_active),
    })),
  }, 200, { 'Cache-Control': 'no-store' });
}

async function locationIdExists(env: Env, id: number): Promise<boolean> {
  const row = await env.DB.prepare('SELECT id FROM ccg_storage_locations WHERE id = ? LIMIT 1').bind(id).first();
  return Boolean(row);
}

async function locationIdByName(env: Env, name: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT id FROM ccg_storage_locations WHERE name = ? COLLATE NOCASE LIMIT 1')
    .bind(name)
    .first<{ id: number }>();
  return row ? Number(row.id) : null;
}

async function currentLocationId(env: Env, itemId: string | number): Promise<number | null> {
  const row = await env.DB.prepare('SELECT storage_location_id FROM ccg_inventory_items WHERE id = ? LIMIT 1')
    .bind(Number(itemId))
    .first<{ storage_location_id: number | null }>();
  return row?.storage_location_id ?? null;
}

// The storage_location_id to save from an add/edit request body:
//   storageLocationId  the id from the dropdown ('' or null clears it; an unknown id clears it)
//   storageLocation    the location name, from an admin app loaded before this change
//   neither            keep the item's current location (null for a new item)
export async function resolveStorageLocationId(
  env: Env,
  body: Record<string, unknown>,
  existingItemId?: string | number | null,
): Promise<number | null> {
  if ('storageLocationId' in body) {
    const raw = body.storageLocationId;
    const id = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw.trim(), 10) : NaN;
    if (!Number.isInteger(id) || id <= 0) return null;
    return (await locationIdExists(env, id)) ? id : null;
  }
  if ('storageLocation' in body) {
    const name = typeof body.storageLocation === 'string' ? body.storageLocation.trim() : '';
    return name ? locationIdByName(env, name) : null;
  }
  return existingItemId ? currentLocationId(env, existingItemId) : null;
}
