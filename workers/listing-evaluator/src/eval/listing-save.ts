import type { Env } from '../env.js';
import { stripTrailingJsonBlock } from '../../../../shared/claude-eval-rules.js';
import { renderAnalysisHtml } from './render.js';
import { dbFindRecentDuplicate, dbGetEvaluation, dbInsertEvaluation, dbSetEvaluationStatus } from './db.js';
import { dbMarkQueueDoneStatement } from './queue.js';
import { INVENTORY_EVAL_COLUMNS } from './inventory-save.js';
import { safeJsonParse, sha256Hex } from './util.js';

// The listing columns an evaluation may write (and Undo may restore).
const LISTING_EVAL_COLUMNS = ['ai_analysis_text', 'brand', 'model', 'year', 'price_private_party'] as const;
type ListingEvalColumn = (typeof LISTING_EVAL_COLUMNS)[number];
type ListingEvalValues = Partial<Record<ListingEvalColumn, string | number | null>>;

type ListingRow = {
  id: number;
  title: string | null;
  is_multi: number | null;
} & Record<ListingEvalColumn, string | number | null>;

async function loadListingRow(env: Env, listingId: string): Promise<ListingRow | null> {
  const idValue = Number.parseInt(listingId, 10);
  if (!Number.isFinite(idValue) || String(idValue) !== listingId.trim()) return null;
  return env.DB.prepare(
    'SELECT id, title, is_multi, ai_analysis_text, brand, model, year, price_private_party FROM listings WHERE id = ? LIMIT 1'
  ).bind(idValue).first<ListingRow>();
}

function pickPrevious(row: ListingRow): ListingEvalValues {
  const previous: ListingEvalValues = {};
  for (const column of LISTING_EVAL_COLUMNS) previous[column] = row[column] ?? null;
  return previous;
}

function updateStatement(env: Env, listingId: number, values: ListingEvalValues): D1PreparedStatement | null {
  const columns = Object.keys(values) as ListingEvalColumn[];
  if (!columns.length) return null;
  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  return env.DB.prepare(`UPDATE listings SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...columns.map((column) => values[column] ?? null), listingId);
}

export { renderAnalysisHtml } from './render.js';

export type ListingSaveInput = {
  listingId: string;
  userId: string;
  analysisMarkdown: string;
  brand?: string;
  model?: string;
  year?: string;
  privatePartyValue?: number | null;
  queueId?: string | null;
};

export type ListingSaveResult =
  | {
      ok: true;
      evaluationId: string;
      listingId: string;
      title: string;
      fieldsWritten: string[];
      fieldsSkipped: string[];
      deduplicated: boolean;
      savedAt: string;
    }
  | { ok: false; error: string };

// Save a connector evaluation to a listing. Always overwrites (owner's choice): the AI Analysis,
// and brand, model, year and private party value whenever Claude returned a value; multi-item
// lots get "Various" for brand and model and no year. The history row (with the previous values,
// for Undo), the listing update and the queue entry go in one D1 batch.
export async function saveListingEvaluation(env: Env, input: ListingSaveInput): Promise<ListingSaveResult> {
  const row = await loadListingRow(env, input.listingId);
  if (!row) return { ok: false, error: `No listing with id "${input.listingId}". Call get_current_item again to get the right id.` };

  const markdown = stripTrailingJsonBlock(input.analysisMarkdown.trim());
  if (!markdown) return { ok: false, error: 'analysis_markdown is empty. Pass the full readout you showed the owner.' };
  if (markdown.length > 60000) return { ok: false, error: 'analysis_markdown is longer than 60,000 characters. Shorten the readout and save again.' };

  const contentHash = await sha256Hex(
    JSON.stringify([markdown, input.brand, input.model, input.year, input.privatePartyValue])
  );
  const listingId = String(row.id);
  const duplicate = await dbFindRecentDuplicate(env, { kind: 'listing', recordId: listingId, draftKey: null }, contentHash);
  if (duplicate) {
    if (input.queueId) await dbMarkQueueDoneStatement(env, input.queueId, duplicate.id).run();
    const written = safeJsonParse<ListingEvalValues>(duplicate.fields_written_json) || {};
    return {
      ok: true,
      evaluationId: duplicate.id,
      listingId,
      title: row.title || '',
      fieldsWritten: Object.keys(written),
      fieldsSkipped: [],
      deduplicated: true,
      savedAt: new Date(duplicate.created_at).toISOString(),
    };
  }

  const isMulti = Boolean(row.is_multi);
  const values: ListingEvalValues = {};
  const skipped: string[] = [];
  const analysisHtml = renderAnalysisHtml(markdown);
  values.ai_analysis_text = analysisHtml;

  const candidates: Array<['brand' | 'model' | 'year', string]> = [
    ['brand', isMulti ? 'Various' : (input.brand || '').trim().slice(0, 120)],
    ['model', isMulti ? 'Various' : (input.model || '').trim().slice(0, 180)],
    ['year', isMulti ? '' : (input.year || '').trim().slice(0, 120)],
  ];
  for (const [column, candidate] of candidates) {
    if (candidate) values[column] = candidate;
  }

  const ppv = input.privatePartyValue;
  if (typeof ppv === 'number' && Number.isFinite(ppv) && ppv > 0) {
    values.price_private_party = Math.round(ppv);
  }

  const now = Date.now();
  const evaluationId = crypto.randomUUID();
  const insert = dbInsertEvaluation(env, {
    id: evaluationId,
    kind: 'listing',
    record_id: listingId,
    draft_key: null,
    user_id: input.userId,
    analysis_md: markdown,
    analysis_html: analysisHtml,
    fields_json: JSON.stringify({
      brand: input.brand ?? '',
      model: input.model ?? '',
      year: input.year ?? '',
      private_party_value: ppv ?? null,
    }),
    listing_json: null,
    options_json: null,
    previous_values_json: JSON.stringify(pickPrevious(row)),
    fields_written_json: JSON.stringify(values),
    status: 'saved',
    content_hash: contentHash,
    source: 'claude-connector',
    created_at: now,
    applied_at: now,
    undone_at: null,
  });
  const update = updateStatement(env, row.id, values);
  const statements = update ? [insert, update] : [insert];
  if (input.queueId) statements.push(dbMarkQueueDoneStatement(env, input.queueId, evaluationId));
  await env.DB.batch(statements);

  return {
    ok: true,
    evaluationId,
    listingId,
    title: row.title || '',
    fieldsWritten: Object.keys(values),
    fieldsSkipped: skipped,
    deduplicated: false,
    savedAt: new Date(now).toISOString(),
  };
}

// The existing paste save (Claude eval dialog on the listing page) writes the listing itself;
// this records a history row for it so Undo works for pasted evaluations too. Call it with the
// listing row as it was before the paste save, and the values the paste save wrote.
export async function recordListingPasteHistory(
  env: Env,
  listingId: string,
  before: ListingEvalValues,
  written: ListingEvalValues,
  userId: string,
): Promise<void> {
  try {
    const now = Date.now();
    await dbInsertEvaluation(env, {
      id: crypto.randomUUID(),
      kind: 'listing',
      record_id: listingId,
      draft_key: null,
      user_id: userId,
      analysis_md: '',
      analysis_html: typeof written.ai_analysis_text === 'string' ? written.ai_analysis_text : '',
      fields_json: null,
      listing_json: null,
      options_json: null,
      previous_values_json: JSON.stringify(before),
      fields_written_json: JSON.stringify(written),
      status: 'saved',
      content_hash: null,
      source: 'paste',
      created_at: now,
      applied_at: now,
      undone_at: null,
    }).run();
  } catch (error) {
    // History is a convenience: never fail the paste save because of it.
    console.error('evaluations paste history insert failed', error);
  }
}

export async function snapshotListingEvalValues(env: Env, listingId: string): Promise<ListingEvalValues | null> {
  const row = await loadListingRow(env, listingId);
  return row ? pickPrevious(row) : null;
}

// Undo a connector or paste evaluation (listing or inventory): restore the previous value of
// each field it wrote, but only where the field still holds what the evaluation wrote (a later
// manual edit is never reverted).
export async function undoEvaluation(
  env: Env,
  evaluationId: string,
): Promise<{ ok: true; kind: string; recordId: string; restored: string[] } | { ok: false; status: number; message: string }> {
  const evaluation = await dbGetEvaluation(env, evaluationId);
  if (!evaluation || !evaluation.record_id || (evaluation.status !== 'saved' && evaluation.status !== 'undone')) {
    return { ok: false, status: 404, message: 'Evaluation not found.' };
  }
  if (evaluation.status === 'undone') return { ok: false, status: 409, message: 'This evaluation was already undone.' };

  const isListing = evaluation.kind === 'listing';
  const table = isListing ? 'listings' : 'ccg_inventory_items';
  const allowed: readonly string[] = isListing ? LISTING_EVAL_COLUMNS : INVENTORY_EVAL_COLUMNS;
  const idValue = Number.parseInt(evaluation.record_id, 10);
  const row = await env.DB.prepare(`SELECT id, ${allowed.join(', ')} FROM ${table} WHERE id = ? LIMIT 1`)
    .bind(idValue)
    .first<Record<string, unknown>>();
  if (!row) return { ok: false, status: 404, message: isListing ? 'Listing not found.' : 'Inventory item not found.' };

  const previous = safeJsonParse<Record<string, unknown>>(evaluation.previous_values_json) || {};
  const written = safeJsonParse<Record<string, unknown>>(evaluation.fields_written_json) || {};
  const restore: Record<string, unknown> = {};
  for (const column of Object.keys(written)) {
    if (!allowed.includes(column)) continue;
    if (String(row[column] ?? '') === String(written[column] ?? '')) restore[column] = previous[column] ?? null;
  }
  const columns = Object.keys(restore);
  if (columns.length) {
    await env.DB.prepare(
      `UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(...columns.map((column) => restore[column] ?? null), idValue).run();
  }
  await dbSetEvaluationStatus(env, evaluationId, 'undone');
  return { ok: true, kind: evaluation.kind, recordId: evaluation.record_id, restored: columns };
}
