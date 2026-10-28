import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { REVERB_SEARCH_API_URL } from '../constants.js';
import { reverbRequestHeaders } from '../pricing/reverb.js';
import { dbGetInventoryItem } from './db-core.js';
import { channelCategoryFor } from './channel-category.js';
import { fetchReverbCategories } from './reverb-listing.js';
import { resolveReverbCategoryForItem } from './reverb-categories.js';
import { fetchGxCategories } from '../gx/api.js';
import { dbGetCcgCategoryGxDefault, dbListGxLinks } from '../gx/db.js';

// GET /api/admin-v2/channel-category-audit — read-only check of every live Reverb and Gear
// Exchange listing's category against what the CCG subcategory maps to. Nothing is changed.
//
// verdict:
//   match     the channel has exactly the mapped category
//   variant   same family, different sub-type (e.g. Hollowbody vs Solidbody) — often deliberate
//   mismatch  a different family (e.g. an electric filed under acoustic) — almost always wrong
//   unknown   no current category could be read, or nothing to compare against
// titleHint flags a title that contradicts the CCG subcategory itself (e.g. "Telecaster" filed
// under Acoustic Guitars), which would make the mapped category wrong too.

type Verdict = 'match' | 'variant' | 'mismatch' | 'unknown';

// Family = the path minus its last level when it has three, else the whole path, so
// "Guitars >> Electric Guitars >> Solidbody" and "... >> Hollowbody" share a family, while
// two pedal types ("Effects & Pedals >> Fuzz" vs ">> Chorus") don't.
function familyOf(path: string, separator: string): string {
  const parts = path.split(separator).map((part) => part.trim()).filter(Boolean);
  return (parts.length > 2 ? parts.slice(0, -1) : parts).join(separator).toLowerCase();
}

function verdictFor(current: string | null, proposed: string | null, separator: string): Verdict {
  if (!current || !proposed) return 'unknown';
  if (current.toLowerCase() === proposed.toLowerCase()) return 'match';
  // Reverb paths are two levels ("Electric Guitars / Solid Body"): compare the top level there.
  const currentFamily = separator === ' / ' ? current.split(' / ')[0].toLowerCase() : familyOf(current, separator);
  const proposedFamily = separator === ' / ' ? proposed.split(' / ')[0].toLowerCase() : familyOf(proposed, separator);
  return currentFamily === proposedFamily ? 'variant' : 'mismatch';
}

const ACOUSTIC_WORDS = /\b(acoustic|dreadnought|classical|nylon|jumbo|parlou?r|concert|auditorium|00{1,2}|triple-0)\b/i;
const ELECTRIC_WORDS = /\b(strat|stratocaster|tele|telecaster|les paul|sg|lp-style|humbuckers?|p-?90s?|hss|hh|solid ?body|semi-hollow|hollow ?body|jazzmaster|jaguar|mustang|explorer|flying v|bigsby|streamliner|electric guitar)\b/i;
const ACOUSTIC_ELECTRIC = /\bacoustic[- ]electric\b/i;

function titleHintFor(title: string, ccgPath: string): string | null {
  const path = ccgPath.toLowerCase();
  if (path.includes('acoustic guitars') && !ACOUSTIC_ELECTRIC.test(title) && ELECTRIC_WORDS.test(title) && !ACOUSTIC_WORDS.test(title)) {
    return 'Title reads like an electric guitar, but CCG has it under Acoustic Guitars.';
  }
  if (path.includes('electric guitars') && (ACOUSTIC_WORDS.test(title) || ACOUSTIC_ELECTRIC.test(title)) && !ELECTRIC_WORDS.test(title)) {
    return 'Title reads like an acoustic guitar, but CCG has it under Electric Guitars.';
  }
  if (path.startsWith('guitar') && /\bbass\b/i.test(title)) return 'Title mentions bass, but CCG has it under Guitar.';
  return null;
}

async function fetchReverbListingCategory(
  listingId: string,
  env: Env,
): Promise<{ uuids: string[]; state: string | null; error: string | null }> {
  try {
    const response = await fetch(`${REVERB_SEARCH_API_URL}/${encodeURIComponent(listingId)}`, {
      method: 'GET',
      headers: reverbRequestHeaders(env),
    });
    if (!response.ok) return { uuids: [], state: null, error: `Reverb returned ${response.status}` };
    const data = await response.json() as Record<string, unknown>;
    const listing = (data.listing && typeof data.listing === 'object' ? data.listing : data) as Record<string, unknown>;
    const categories = Array.isArray(listing.categories) ? listing.categories as Array<{ uuid?: unknown }> : [];
    const state = listing.state && typeof listing.state === 'object'
      ? normalizeText((listing.state as { slug?: unknown }).slug, '') || null
      : normalizeText(listing.state, '') || null;
    return { uuids: categories.map((category) => normalizeText(category.uuid, '')).filter(Boolean), state, error: null };
  } catch (error) {
    return { uuids: [], state: null, error: error instanceof Error ? error.message : String(error) };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handleAdminV2ChannelCategoryAudit(_request: Request, env: Env): Promise<Response> {
  const [reverbCategories, gxCategories, gxLinks] = await Promise.all([
    fetchReverbCategories(env),
    fetchGxCategories(env),
    dbListGxLinks(env),
  ]);
  const reverbNameByUuid = new Map(reverbCategories.map((category) => [category.uuid, category.full_name]));
  const gxPathById = new Map(gxCategories.map((category) => [category.id, category.path]));

  const reverbItems = await env.DB.prepare(
    `SELECT id, reverb_listing_id FROM ccg_inventory_items
     WHERE COALESCE(is_sold, 0) = 0 AND TRIM(COALESCE(reverb_listing_id, '')) <> ''
     ORDER BY sale_price DESC`
  ).all<{ id: number; reverb_listing_id: string }>();

  const reverb: Array<Record<string, unknown>> = [];
  for (const row of reverbItems.results ?? []) {
    const record = await dbGetInventoryItem(String(row.id), env);
    if (!record) continue;
    const ccg = channelCategoryFor(record as Record<string, unknown>);
    const title = normalizeText(record.saleTitle, '') || normalizeText(record.title, '');
    const [current, proposed] = await Promise.all([
      fetchReverbListingCategory(row.reverb_listing_id, env),
      resolveReverbCategoryForItem(record as Record<string, unknown>, null, env),
    ]);
    const currentName = current.uuids.map((uuid) => reverbNameByUuid.get(uuid) || uuid).join(', ') || null;
    // A listing can carry more than one category; it matches if any of them is the mapped one.
    const currentForVerdict = proposed && current.uuids.includes(proposed.uuid) ? proposed.name : (current.uuids[0] ? reverbNameByUuid.get(current.uuids[0]) ?? null : null);
    reverb.push({
      inventoryId: row.id,
      ccgNumber: record.ccgNumber,
      title: title.slice(0, 70),
      ccgCategory: ccg.path,
      reverbListingId: row.reverb_listing_id,
      reverbState: current.state,
      current: currentName,
      currentUuids: current.uuids,
      proposed: proposed?.name ?? null,
      proposedUuid: proposed?.uuid ?? null,
      proposedSource: proposed?.source ?? null,
      verdict: current.error ? 'unknown' : verdictFor(currentForVerdict, proposed?.name ?? null, ' / '),
      error: current.error,
      titleHint: titleHintFor(title, ccg.path),
    });
    // Stay gentle with Reverb's API across ~80 listings.
    await sleep(150);
  }

  const gx: Array<Record<string, unknown>> = [];
  for (const link of gxLinks) {
    const record = await dbGetInventoryItem(String(link.inventory_item_id), env);
    if (!record) continue;
    const ccg = channelCategoryFor(record as Record<string, unknown>);
    const title = normalizeText(record.saleTitle, '') || normalizeText(record.title, '');
    const proposedId = ccg.ccgCategoryId ? await dbGetCcgCategoryGxDefault(ccg.ccgCategoryId, env) : null;
    // CCG's copy of the GX category is kept current by gx-add and GX's Category Updated webhook.
    const currentPath = link.gx_category_id ? gxPathById.get(link.gx_category_id) ?? null : null;
    const proposedPath = proposedId ? gxPathById.get(proposedId) ?? null : null;
    gx.push({
      inventoryId: link.inventory_item_id,
      ccgNumber: record.ccgNumber,
      title: title.slice(0, 70),
      ccgCategory: ccg.path,
      gxListingId: link.gx_listing_id,
      gxStatus: link.gx_status,
      current: currentPath,
      currentId: link.gx_category_id,
      proposed: proposedPath,
      proposedId,
      verdict: verdictFor(currentPath, proposedPath, ' >> '),
      titleHint: titleHintFor(title, ccg.path),
    });
  }

  const tally = (rows: Array<Record<string, unknown>>) => rows.reduce<Record<string, number>>((counts, row) => {
    const verdict = String(row.verdict);
    counts[verdict] = (counts[verdict] || 0) + 1;
    return counts;
  }, {});

  return jsonResponse({
    checkedAt: new Date().toISOString(),
    summary: {
      reverb: { listings: reverb.length, ...tally(reverb), titleHints: reverb.filter((row) => row.titleHint).length },
      gx: { listings: gx.length, ...tally(gx), titleHints: gx.filter((row) => row.titleHint).length },
    },
    reverb,
    gx,
  });
}
