import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { toAdminImageUrl } from '../utils/image.js';

export async function handleAdminV2Search(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = normalizeText(url.searchParams.get('q'), '').slice(0, 200);
  if (q.length < 3) return jsonResponse({ results: [] });

  const like = `%${q}%`;
  const normalizedCcgQuery = q.toUpperCase().replace(/^CCG-?/, '').replace(/\D/g, '');
  const ccgLike = normalizedCcgQuery ? `%${normalizedCcgQuery}%` : like;

  const invRows = await env.DB.prepare(
    `SELECT id, ccg_number, title, brand, model, image_url
     FROM ccg_inventory_items
     WHERE (
       (
         COALESCE(is_active, 0) = 1
         AND (
           title LIKE ?
           OR (COALESCE(brand,'') || ' ' || COALESCE(model,'')) LIKE ?
           OR UPPER(COALESCE(ccg_number, '')) LIKE UPPER(?)
           OR REPLACE(UPPER(COALESCE(ccg_number, '')), 'CCG-', '') LIKE ?
         )
       )
       OR (
         ? <> ''
         AND REPLACE(UPPER(COALESCE(ccg_number, '')), 'CCG-', '') = ?
       )
     )
     LIMIT 5`
  ).bind(like, like, like, ccgLike, normalizedCcgQuery, normalizedCcgQuery).all<{
    id: number;
    ccg_number: string | null;
    title: string;
    brand: string | null;
    model: string | null;
    image_url: string | null;
  }>();

  const listingRows = await env.DB.prepare(
    `SELECT id, title, brand, model, photos
     FROM listings
     WHERE archived = 0 AND (title LIKE ? OR (COALESCE(brand,'') || ' ' || COALESCE(model,'')) LIKE ?)
     LIMIT 5`
  ).bind(like, like).all<{ id: number; title: string | null; brand: string | null; model: string | null; photos: string | null }>();

  const results = [
    ...(invRows.results || []).map((r) => ({
      type: 'inventory' as const,
      id: String(r.id),
      title: normalizeText(r.title, 'Untitled'),
      subtitle: [normalizeText(r.ccg_number, ''), r.brand, r.model].filter(Boolean).join(' • ') || null,
      imageUrl: toAdminImageUrl(r.image_url, 'thumb') || null,
    })),
    ...(listingRows.results || []).map((r) => {
      const firstPhoto = normalizeText(r.photos, '').split('\n').map((s) => s.trim()).find((s) => s.length > 0) || null;
      return {
        type: 'listing' as const,
        id: String(r.id),
        title: normalizeText(r.title, 'Untitled'),
        subtitle: [r.brand, r.model].filter(Boolean).join(' ') || null,
        imageUrl: firstPhoto,
      };
    }),
  ].slice(0, 10);

  return jsonResponse({ results });
}
