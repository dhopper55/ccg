import type { Env } from '../env.js';
import { sanitizePatternLookupHtml } from '../utils/html.js';
import { claudeMarkdownToHtml, stripTrailingJsonBlock } from '../../../../shared/claude-eval-rules.js';
import { dbFindRecentDuplicate, dbGetEvaluation, dbInsertEvaluation, dbSetEvaluationStatus } from './db.js';
import { isKnownIdentityValue, safeJsonParse, sha256Hex } from './util.js';

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

export function renderAnalysisHtml(markdown: string): string {
  return sanitizePatternLookupHtml(claudeMarkdownToHtml(stripTrailingJsonBlock(markdown))).slice(0, 20000);
}

export type ListingSaveInput = {
  listingId: string;
  userId: string;
  analysisMarkdown: string;
  brand?: string;
  model?: string;
  year?: string;
  privatePartyValue?: number | null;
  overwrite?: boolean;
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

// Save a connector evaluation to a listing: the AI Analysis is replaced; brand, model, year and
// private party value are filled only when blank (or a placeholder) unless overwrite is set;
// multi-item lots get "Various" for brand and model and no year. The history row (with the
// previous values, for Undo) and the listing update go in one D1 batch.
export async function saveListingEvaluation(env: Env, input: ListingSaveInput): Promise<ListingSaveResult> {
  const row = await loadListingRow(env, input.listingId);
  if (!row) return { ok: false, error: `No listing with id "${input.listingId}". Call get_current_item again to get the right id.` };

  const markdown = stripTrailingJsonBlock(input.analysisMarkdown.trim());
  if (!markdown) return { ok: false, error: 'analysis_markdown is empty. Pass the full readout you showed the owner.' };
  if (markdown.length > 60000) return { ok: false, error: 'analysis_markdown is longer than 60,000 characters. Shorten the readout and save again.' };

  const contentHash = await sha256Hex(
    JSON.stringify([markdown, input.brand, input.model, input.year, input.privatePartyValue, Boolean(input.overwrite)])
  );
  const listingId = String(row.id);
  const duplicate = await dbFindRecentDuplicate(env, { kind: 'listing', recordId: listingId, draftKey: null }, contentHash);
  if (duplicate) {
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
  const overwrite = Boolean(input.overwrite);
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
    if (!candidate) continue;
    if (candidate === row[column]) continue;
    if (overwrite || !isKnownIdentityValue(row[column])) values[column] = candidate;
    else skipped.push(column);
  }

  const ppv = input.privatePartyValue;
  if (typeof ppv === 'number' && Number.isFinite(ppv) && ppv > 0) {
    const rounded = Math.round(ppv);
    const current = Number(row.price_private_party || 0);
    if (rounded !== current) {
      if (overwrite || !current) values.price_private_party = rounded;
      else skipped.push('price_private_party');
    }
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
    options_json: JSON.stringify({ overwrite }),
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
  await env.DB.batch(update ? [insert, update] : [insert]);

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

// Undo a listing evaluation: restore the previous value of each field it wrote, but only where
// the field still holds what the evaluation wrote (a later manual edit is never reverted).
export async function undoListingEvaluation(
  env: Env,
  evaluationId: string,
): Promise<{ ok: true; restored: string[] } | { ok: false; status: number; message: string }> {
  const evaluation = await dbGetEvaluation(env, evaluationId);
  if (!evaluation || evaluation.kind !== 'listing' || !evaluation.record_id) {
    return { ok: false, status: 404, message: 'Evaluation not found.' };
  }
  if (evaluation.status === 'undone') return { ok: false, status: 409, message: 'This evaluation was already undone.' };

  const row = await loadListingRow(env, evaluation.record_id);
  if (!row) return { ok: false, status: 404, message: 'Listing not found.' };

  const previous = safeJsonParse<ListingEvalValues>(evaluation.previous_values_json) || {};
  const written = safeJsonParse<ListingEvalValues>(evaluation.fields_written_json) || {};
  const restore: ListingEvalValues = {};
  for (const column of Object.keys(written) as ListingEvalColumn[]) {
    if (!LISTING_EVAL_COLUMNS.includes(column)) continue;
    const current = row[column] ?? null;
    const wrote = written[column] ?? null;
    if (String(current ?? '') === String(wrote ?? '')) restore[column] = previous[column] ?? null;
  }
  const update = updateStatement(env, row.id, restore);
  if (update) await update.run();
  await dbSetEvaluationStatus(env, evaluationId, 'undone');
  return { ok: true, restored: Object.keys(restore) };
}
