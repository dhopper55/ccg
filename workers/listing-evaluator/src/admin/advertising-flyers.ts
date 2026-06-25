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
  to_visit: number;
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
      `SELECT id, name, address, types, google_url, photo_url, map_url, to_visit, evaluated, flyer_placed, notes
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

export async function handleAdminV2AdvertisingFlyersLookup(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ message: 'Invalid JSON body.' }, 400);
  }

  const placeId = typeof body.place_id === 'string' ? body.place_id.trim() : '';
  if (!placeId) {
    return jsonResponse({ message: 'place_id is required.' }, 400);
  }

  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return jsonResponse({ message: 'Google Places API key not configured.' }, 500);
  }

  const detailsResponse = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'displayName,formattedAddress,types,photos',
      },
    },
  );

  if (!detailsResponse.ok) {
    const errText = await detailsResponse.text();
    return jsonResponse({ message: `Places API error: ${errText}` }, 502);
  }

  const place = (await detailsResponse.json()) as {
    displayName?: { text?: string };
    formattedAddress?: string;
    types?: string[];
    photos?: Array<{ name: string }>;
  };

  if (!place.displayName?.text) {
    return jsonResponse({ message: 'Place not found.' }, 404);
  }

  let photoUrl: string | null = null;
  if (place.photos?.length) {
    try {
      const photoResponse = await fetch(
        `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=600&skipHttpRedirect=true`,
        { headers: { 'X-Goog-Api-Key': apiKey } },
      );
      if (photoResponse.ok) {
        const photoData = (await photoResponse.json()) as { photoUri?: string };
        photoUrl = photoData.photoUri ?? null;
      }
    } catch {
      // photo is optional
    }
  }

  return jsonResponse({
    name: place.displayName.text,
    address: place.formattedAddress ?? '',
    types: JSON.stringify(place.types ?? []),
    google_url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    photo_url: photoUrl,
  });
}

export async function handleAdminV2AdvertisingFlyersCreate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ message: 'Invalid JSON body.' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!name || !address) {
    return jsonResponse({ message: 'name and address are required.' }, 400);
  }

  const types = typeof body.types === 'string' ? body.types : '[]';
  const googleUrl = typeof body.google_url === 'string' ? body.google_url.trim() || null : null;
  const photoUrl = typeof body.photo_url === 'string' ? body.photo_url.trim() || null : null;

  const result = await env.DB.prepare(
    `INSERT INTO south_broadway_locations (name, address, types, google_url, photo_url)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(name, address, types, googleUrl, photoUrl)
    .run();

  return jsonResponse({ id: result.meta.last_row_id, ok: true }, 201);
}

export async function handleAdminV2AdvertisingFlyersDelete(path: string, env: Env): Promise<Response> {
  const idStr = path.split('/').filter(Boolean).pop() ?? '';
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ message: 'Invalid location ID.' }, 400);
  }
  await env.DB.prepare('DELETE FROM south_broadway_locations WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
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

  if ('to_visit' in body) {
    const toVisit = body.to_visit ? 1 : 0;
    setClauses.push('to_visit = ?');
    params.push(toVisit);
    if (toVisit === 1) {
      setClauses.push('evaluated = 1');
    }
  }

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
