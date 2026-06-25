import type { Env } from '../env.js';
import { jsonResponse, parseBoundedInt } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';

type FlyerLocationRow = {
  id: number;
  name: string;
  address: string;
  types: string;
  google_url: string | null;
  photo_url: string | null;
  map_url: string | null;
  evaluated: number;
  flyer_placed: number;
  notes: string | null;
};

type GlobalStatsRow = {
  total: number;
  evaluated: number;
  flyer_placed: number;
};

export async function handleAdminV2AdvertisingFlyersList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 50, 1, 200);
  const search = normalizeText(url.searchParams.get('search'), '').slice(0, 200);
  const filter = normalizeText(url.searchParams.get('filter'), '').toLowerCase();

  const offset = (page - 1) * limit;
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    whereClauses.push('LOWER(name) LIKE ?');
    params.push(`%${search.toLowerCase()}%`);
  }

  if (filter === 'unevaluated') {
    whereClauses.push('evaluated = 0');
  } else if (filter === 'evaluated') {
    whereClauses.push('evaluated = 1');
  } else if (filter === 'flyer_placed') {
    whereClauses.push('flyer_placed = 1');
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countResult, statsResult, rows] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as total FROM south_broadway_locations ${whereStr}`)
      .bind(...params)
      .first<{ total: number }>(),
    env.DB.prepare(
      'SELECT COUNT(*) as total, SUM(evaluated) as evaluated, SUM(flyer_placed) as flyer_placed FROM south_broadway_locations',
    ).first<GlobalStatsRow>(),
    env.DB.prepare(
      `SELECT id, name, address, types, google_url, photo_url, map_url, evaluated, flyer_placed, notes
       FROM south_broadway_locations ${whereStr}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all<FlyerLocationRow>(),
  ]);

  const total = Number(countResult?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return jsonResponse({
    records: rows.results ?? [],
    page,
    limit,
    total,
    totalPages,
    globalStats: {
      total: Number(statsResult?.total ?? 0),
      evaluated: Number(statsResult?.evaluated ?? 0),
      flyerPlaced: Number(statsResult?.flyer_placed ?? 0),
    },
  });
}

export async function handleAdminV2AdvertisingFlyersUpdate(path: string, request: Request, env: Env): Promise<Response> {
  const idStr = path.split('/').filter(Boolean).pop() ?? '';
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ message: 'Invalid location ID.' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ message: 'Invalid JSON body.' }, 400);
  }

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if ('evaluated' in body) {
    setClauses.push('evaluated = ?');
    params.push(body.evaluated ? 1 : 0);
  }

  if ('flyer_placed' in body) {
    setClauses.push('flyer_placed = ?');
    params.push(body.flyer_placed ? 1 : 0);
  }

  if ('notes' in body) {
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    setClauses.push('notes = ?');
    params.push(notes || null);
  }

  if (setClauses.length === 0) {
    return jsonResponse({ message: 'No fields to update.' }, 400);
  }

  setClauses.push("updated_at = datetime('now')");
  params.push(id);

  await env.DB.prepare(
    `UPDATE south_broadway_locations SET ${setClauses.join(', ')} WHERE id = ?`,
  )
    .bind(...params)
    .run();

  return jsonResponse({ ok: true });
}
