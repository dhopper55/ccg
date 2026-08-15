import type { Env } from '../env.js';
import { jsonResponse, parseBoundedInt } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { buildBrandActivityContext, insertActivityLogBestEffort } from './activity.js';
import {
  dbListAdminV2SerialDecodes,
  dbGetAdminV2SerialDecodeBrandResponses,
  dbGetAdminV2SerialDecodeLookupVolume,
  dbGetAdminV2SerialDecodeDailyVolume,
} from './serial-decodes-db.js';

import { hasMeaningfulServerDecodeInfo } from '../serial/utils.js';
import { dbSetSerialDecodeEvaluated, dbDeleteSerialDecodeRecord } from '../serial/db.js';
import { toBooleanInput } from '../utils/misc.js';
import { decodeSerialForBackend, normalizeBrandKey } from '../../../../src/serial-decode-service.js';

/**
 * Extracts a JSON object from model output that may (a) contain narrative prose before
 * the JSON — Claude frequently narrates its research instead of returning bare JSON
 * despite being told not to — and (b) contain raw, unescaped control characters (usually
 * literal newlines) inside string values, which is invalid per the JSON spec but a common
 * model habit. Scans backward from the last '{' so any preceding prose is ignored, and
 * escapes stray control characters before each parse attempt.
 */
function extractTrailingJsonObject(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  let searchFrom = cleaned.length;
  while (true) {
    const start = cleaned.lastIndexOf('{', searchFrom - 1);
    if (start === -1) break;
    const candidate = cleaned.slice(start).trim();
    const sanitized = candidate.replace(/[\x00-\x1f]/g, (ch) => {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '\\r';
      if (ch === '\t') return '\\t';
      return '';
    });
    try {
      return JSON.parse(sanitized);
    } catch {
      // This '{' wasn't the start of valid JSON — keep scanning further back.
    }
    // lastIndexOf clamps a negative fromIndex to 0, which would re-find the same
    // '{' forever once start reaches 0 — stop explicitly instead of looping.
    if (start === 0) break;
    searchFrom = start;
  }
  return null;
}

type SerialPatternBucketResult =
  | {
      bucket: 1;
      pattern_key: string;
      pattern_label: string;
      regex: string;
      template_type: 'prefix-yymm-seq' | 'prefix-yy-seq' | 'numeric-yymm-seq';
      params: Record<string, unknown>;
    }
  | { bucket: 2; reason: string };

async function callAnthropicForSerialPatternBucket(
  brand: string,
  serial: string,
  aiAnalysisText: string,
  env: Env,
): Promise<SerialPatternBucketResult> {
  if (!env.ANTHROPIC_API_KEY) {
    return { bucket: 2, reason: 'Anthropic API key not configured.' };
  }

  const systemPrompt = `You are a guitar serial number expert. Your job is to analyze a failed serial decode and decide if it can be handled by one of these V2 template types, or requires code (Bucket 2).

## V2 Template Types

### prefix-yymm-seq
Format: [fixed letter prefix][YY 2-digit year][MM 2-digit month][sequence digits]
Requirements: fixed yearCentury (1900 or 2000, never dynamic/threshold-based), prefix is 1+ uppercase letters.
Params: {"prefix":string,"prefixLen":number,"brand":string,"factory":string,"country":string,"model"?:string,"yearCentury":number}

### prefix-yy-seq
Format: [fixed letter prefix][YY 2-digit year][sequence digits] — no month encoded
Requirements: same as prefix-yymm-seq but serial has no month field.
Params: {"prefix":string,"prefixLen":number,"brand":string,"factory":string,"country":string,"model"?:string,"yearCentury":number}

### numeric-yymm-seq
Format: all-numeric serial, year and optional month extracted from character positions.
Requirements: fixed yearCentury. monthStart is optional (omit if no month).
Params: {"yearStart":number,"monthStart"?:number,"seqStart":number,"brand":string,"factory":string,"country":string,"model"?:string,"yearCentury":number}

## What makes it Bucket 2 (needs code — do NOT attempt a template):
- Dynamic/threshold century: yy >= 70 → 1900+yy, else 2000+yy (or any variant)
- Factory map lookup: prefix maps to different factory names per variant character
- Week-based year: YYWW not YYMM
- Letter-code year: year encoded as a letter (A=2000, B=2001, etc.)
- Month encoded as a single digit or a letter
- Interleaved year digits (e.g. Y-D-D-D-Y-R-R-R)
- Sequential range lookups (year determined by looking up serial number in a range table)
- Any other logic beyond a simple fixed prefix + fixed-century year + optional month + sequence

## Output

Return ONLY valid JSON — no markdown, no explanation, nothing else.

Bucket 1:
{"bucket":1,"pattern_key":"<brand>-<descriptive-kebab-case-key>","pattern_label":"<Human Readable Label>","regex":"<JS-compatible regex string>","template_type":"prefix-yymm-seq"|"prefix-yy-seq"|"numeric-yymm-seq","params":{...}}

Bucket 2:
{"bucket":2,"reason":"<one sentence explanation>"}

Rules for pattern_key: lowercase kebab-case, unique, descriptive. Example: "epiphone-qi-china-yymm-sequence".
Rules for regex: JavaScript RegExp compatible (no lookbehind unless ES2018+). Anchor with ^ and $.
Use priority 999 (already handled externally — do not include in output).`;

  const userMessage = `Brand: ${brand}
Serial: ${serial}

AI Analysis:
${aiAnalysisText}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error('[serial-bucket] Anthropic API error', response.status, err);
    return { bucket: 2, reason: `AI classification unavailable (${response.status}).` };
  }

  const data = await response.json() as {
    content?: Array<{ type: string; text?: string }>;
  };

  const textBlocks = (data.content ?? []).filter(
    (b): b is { type: string; text: string } => b.type === 'text' && typeof b.text === 'string',
  );

  // Claude often narrates its reasoning in prose before the JSON, and/or wraps it in
  // ```json fences, despite being told not to — extractTrailingJsonObject strips both
  // and tolerates raw control characters inside string values.
  const combinedText = textBlocks.map((b) => b.text).join('\n');
  const parsed = extractTrailingJsonObject(combinedText) as Partial<SerialPatternBucketResult> | null;

  if (parsed?.bucket === 1) {
    if (parsed.pattern_key && parsed.pattern_label && parsed.regex && parsed.template_type && parsed.params) {
      return parsed as SerialPatternBucketResult;
    }
  } else if (parsed?.bucket === 2 && typeof parsed.reason === 'string') {
    return parsed as SerialPatternBucketResult;
  }

  console.error('[serial-bucket] Failed to parse AI response', JSON.stringify(data.content));
  return { bucket: 2, reason: 'AI returned unparseable response.' };
}

type SerialResearchResult =
  | { ok: true; isValid: boolean; analysis: string }
  | { ok: false; message: string };

async function callAnthropicForSerialResearch(
  brand: string,
  serial: string,
  env: Env,
): Promise<SerialResearchResult> {
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, message: 'Anthropic API key not configured.' };
  }

  const systemPrompt = `You are a guitar serial number authenticator. You will be given a brand and a serial number that failed to decode automatically. Use the web_search tool (at most 2 searches) to research whether this is a genuine serial number ever used by that guitar brand — check brand serial number lookup databases, official brand documentation, and guitar forum discussions with sourced answers.

Make your first search specific to the exact prefix/format of this serial (e.g. include the letter prefix or code pattern, not just the brand name) — a generic brand-only search tends to surface only the most common documented formats and miss less-common but still valid variants. Use the second search to follow up on anything the first search left unclear.

Give a definitive verdict when your searches support one. If your searches are genuinely inconclusive — you found no documentation either confirming or ruling out this format — do not default to invalid just because you lack confirmation. Say plainly in your analysis that this is a low-confidence call and what specifically remains uncertain, so a human reviewer knows to double-check it.

After you finish researching, respond with ONLY a JSON object as your final message — no markdown code fences, no text before or after it:
{"isValid": true|false, "analysis": "<2-4 sentence explanation citing what you found, written the way a human researcher would summarize their findings>"}`;

  const userMessage = `Brand: ${brand}
Serial: ${serial}

Is "${serial}" a fully valid serial number for a ${brand} guitar?`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 6000,
      system: systemPrompt,
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error('[serial-run-analysis] Anthropic API error', response.status, err);
    return { ok: false, message: `AI research unavailable (${response.status}).` };
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
    usage?: { output_tokens?: number };
  };

  const textBlocks = (data.content ?? []).filter(
    (b): b is { type: string; text: string } => b.type === 'text' && typeof b.text === 'string',
  );

  // Claude frequently narrates its research in prose before the JSON verdict instead of
  // returning bare JSON as instructed — extractTrailingJsonObject locates the JSON
  // regardless of what precedes it, and tolerates raw control characters inside strings.
  const combinedText = textBlocks.map((b) => b.text).join('\n');
  const parsed = extractTrailingJsonObject(combinedText) as { isValid?: unknown; analysis?: unknown } | null;
  if (parsed && typeof parsed.isValid === 'boolean' && typeof parsed.analysis === 'string' && parsed.analysis.trim()) {
    return { ok: true, isValid: parsed.isValid, analysis: parsed.analysis.trim() };
  }

  // Last resort: the response was cut off (max_tokens or the server-side tool loop's
  // iteration cap) before the JSON object closed. The short `isValid` boolean sits at
  // the very start of the object and almost always completes before the long-form
  // `analysis` text runs out of budget — recover it directly via regex so the row still
  // resolves instead of being retried forever at ongoing API cost.
  const isValidMatch = combinedText.match(/"isValid"\s*:\s*(true|false)/);
  if (isValidMatch) {
    const partialAnalysisMatch = combinedText.match(/"analysis"\s*:\s*"([^]*)/);
    const partialAnalysis = (partialAnalysisMatch?.[1] ?? '').replace(/[\x00-\x1f]/g, ' ').trim();
    console.warn('[serial-run-analysis] Recovered isValid from a truncated/malformed response', {
      stop_reason: data.stop_reason,
      output_tokens: data.usage?.output_tokens,
    });
    return {
      ok: true,
      isValid: isValidMatch[1] === 'true',
      analysis: partialAnalysis
        ? `${partialAnalysis} [Note: AI response was truncated; analysis may be incomplete.]`
        : 'AI verdict recovered from a truncated response; no analysis text was available.',
    };
  }

  console.error('[serial-run-analysis] Failed to parse AI response', {
    stop_reason: data.stop_reason,
    output_tokens: data.usage?.output_tokens,
    content: JSON.stringify(data.content),
  });
  return { ok: false, message: 'AI research returned an unparseable response.' };
}

export async function handleAdminV2SerialDecodeRunAnalysis(path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const runAnalysisIndex = parts.indexOf('run-analysis');
  const recordId = runAnalysisIndex > 0 ? parts[runAnalysisIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing serial decode ID.' }, 400);

  const keyRow = await env.DB.prepare(
    `SELECT brand, serial FROM serial_decode_events WHERE id = ?`
  ).bind(parseInt(recordId, 10)).first<{ brand: string | null; serial: string | null }>();

  if (!keyRow || !keyRow.brand || !keyRow.serial) {
    return jsonResponse({ message: 'Serial decode record not found.' }, 404);
  }

  const result = await callAnthropicForSerialResearch(keyRow.brand, keyRow.serial, env);
  if (!result.ok) {
    return jsonResponse({ message: result.message }, 502);
  }

  return jsonResponse({ isValid: result.isValid, analysisText: result.analysis });
}

export async function handleAdminV2SerialDecodes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const onlyErrors = url.searchParams.get('onlyErrors') === '1';
  const unevaluated = url.searchParams.get('unevaluated') === '1';
  const sortDir = normalizeText(url.searchParams.get('sortDir'), '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const data = await dbListAdminV2SerialDecodes(page, limit, brand, onlyErrors, unevaluated, sortDir, env);
  return jsonResponse(data);
}

export async function handleAdminV2SerialDecodeBrandResponses(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const records = await dbGetAdminV2SerialDecodeBrandResponses(brand, env);
  return jsonResponse({ records });
}

export async function handleAdminV2SerialDecodeLookupVolume(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const view = normalizeText(url.searchParams.get('view'), '').toLowerCase() === 'month' ? 'month' : 'day';
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const data = await dbGetAdminV2SerialDecodeLookupVolume(view, brand, env);
  return jsonResponse(data);
}

export async function handleAdminV2SerialDecodeDailyVolume(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const dateParam = normalizeText(url.searchParams.get('date'), '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return jsonResponse({ message: 'Invalid date parameter. Use YYYY-MM-DD.' }, 400);
  }
  const buckets = await dbGetAdminV2SerialDecodeDailyVolume(dateParam, env);
  return jsonResponse({ date: dateParam, buckets });
}

export async function handleAdminV2SerialDecodeDevHandoff(env: Env): Promise<Response> {
  let rows: { results?: Array<{ brand: string | null; serial: string | null; g_ai_analysis: string | null }> };
  try {
    rows = await env.DB.prepare(
      `SELECT brand, serial, g_ai_analysis
       FROM serial_decode_events
       WHERE COALESCE(success, 0) = 0
         AND COALESCE(evaluated, 0) = 0
         AND COALESCE(g_ai_analysis, '') <> ''
       ORDER BY lower(trim(brand)) ASC, serial ASC`
    ).all<{ brand: string | null; serial: string | null; g_ai_analysis: string | null }>();
  } catch {
    return jsonResponse({ message: 'Failed to query serial decode events.' }, 500);
  }

  const records = (rows.results ?? []).filter((r) => r.brand && r.serial && r.g_ai_analysis);

  if (records.length === 0) {
    return jsonResponse({ text: '', count: 0 });
  }

  const DELIM = '———————';
  const preamble =
    `We have some serial numbers that customers attempted to decode, but our system did not recognize and marked them as failures.   In these cases, they are valid serial numbers.   The following is a list of these cases.  Each one starts with the brand, followed by the serial number on the next line, then followed by some AI analysis on the next line describing WHY this is a valid serial number.    After the AI text, we do a hard return and then: ${DELIM} followed by another hard return.  This delimits the serial numbers we are working with here.`;

  const entries = records
    .map((r) => `${r.brand}\n${r.serial}\n${r.g_ai_analysis}\n${DELIM}`)
    .join('\n');

  const text = `${preamble}\n\n${entries}`;

  return jsonResponse({ text, count: records.length });
}

export async function handleAdminV2SerialDecodeEvaluatedUpdate(
  request: Request,
  path: string,
  env: Env,
): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const evaluatedIndex = parts.indexOf('evaluated');
  const recordId = evaluatedIndex > 0 ? parts[evaluatedIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing serial decode ID.' }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const evaluated = toBooleanInput(body.evaluated, false);
  const isValid = body.isValid === true ? true : body.isValid === false ? false : undefined;
  const aiAnalysisText = typeof body.aiAnalysisText === 'string' ? body.aiAnalysisText.trim() : '';

  // Persist AI analysis text immediately, regardless of the valid/invalid verdict — an
  // "invalid" call's reasoning is exactly what you'd want to spot-check later for a
  // false negative, so it can't be dropped just because isValid ended up false.
  // Best-effort: column may not exist yet.
  if (evaluated && aiAnalysisText && aiAnalysisText.toLowerCase() !== 'n/a') {
    try {
      await env.DB.prepare(
        `UPDATE serial_decode_events SET g_ai_analysis = ? WHERE id = ?`
      ).bind(aiAnalysisText.slice(0, 20000), parseInt(recordId, 10)).run();
    } catch {
      // g_ai_analysis column not yet added — safe to ignore
    }
  }

  // Yes path: try decode first, then AI if needed
  if (evaluated && isValid === true) {
    const keyRow = await env.DB.prepare(
      `SELECT brand, serial, normalized_brand FROM serial_decode_events WHERE id = ?`
    ).bind(parseInt(recordId, 10)).first<{ brand: string | null; serial: string | null; normalized_brand: string | null }>();

    if (!keyRow || !keyRow.brand || !keyRow.serial) {
      return jsonResponse({ message: 'Serial decode record not found.' }, 404);
    }

    const brand = keyRow.brand;
    const serial = keyRow.serial;
    const normalizedBrand = keyRow.normalized_brand || normalizeBrandKey(brand);

    // Try decode with V1 backend — if it works now, mark valid without needing AI text
    const decodeCheck = decodeSerialForBackend(brand, serial);
    if (decodeCheck.success && decodeCheck.info && hasMeaningfulServerDecodeInfo(decodeCheck.info)) {
      const autoResult = await dbSetSerialDecodeEvaluated(recordId, true, env, true);
      if (!autoResult) return jsonResponse({ message: 'Unable to update evaluated state.' }, 500);
      if (autoResult.activityCandidate && !autoResult.activityCandidate.wasEvaluated && !autoResult.activityCandidate.success) {
        const brandCtx = buildBrandActivityContext(autoResult.activityCandidate.brand, autoResult.activityCandidate.normalizedBrand);
        await insertActivityLogBestEffort(env, {
          eventKey: 'failed_serial_evaluated',
          eventText: `Failed ${brandCtx.brandLabel} Serial Number ${autoResult.activityCandidate.serial} evaluated by an admin.`,
          eventUrl: brandCtx.decoderUrl,
          imageUrl: brandCtx.imageUrl,
          entityType: 'serial_decode',
          entityId: recordId,
          metadata: { brand: brandCtx.brandLabel, serial: autoResult.activityCandidate.serial },
        });
      }
      return jsonResponse({ ok: true, evaluated: autoResult.evaluated, updatedCount: autoResult.updatedCount });
    }

    // Decode still failed — require meaningful AI text (not empty and not the N/A default)
    const isNaOrEmpty = !aiAnalysisText || aiAnalysisText.trim().toLowerCase() === 'n/a';
    if (isNaOrEmpty) {
      return jsonResponse({ message: 'This serial still did not decode. Paste AI analysis text to continue.', decodeFailed: true }, 422);
    }

    // AI bucket classification
    const bucketResult = await callAnthropicForSerialPatternBucket(brand, serial, aiAnalysisText, env);

    if (bucketResult.bucket === 2) {
      console.log('[serial-bucket] bucket 2 — needs developer', { brand, serial, reason: bucketResult.reason });
      return jsonResponse({ needsDeveloper: true, reason: bucketResult.reason });
    }

    // Bucket 1: insert the pattern row into D1
    try {
      const insertResult = await env.DB.prepare(
        `INSERT OR IGNORE INTO serial_patterns_v2
           (brand, pattern_key, pattern_label, regex, template_type, params, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        normalizedBrand,
        bucketResult.pattern_key,
        bucketResult.pattern_label,
        bucketResult.regex,
        bucketResult.template_type,
        JSON.stringify(bucketResult.params),
        999,
      ).run();
      // INSERT OR IGNORE does not throw on a pattern_key collision — it just no-ops.
      // Without checking `changes`, a colliding key looks identical to a real insert in the logs.
      if (insertResult.meta.changes > 0) {
        console.log('[serial-bucket] bucket 1 — pattern inserted', { pattern_key: bucketResult.pattern_key });
      } else {
        console.warn('[serial-bucket] bucket 1 — pattern_key already existed, insert was a no-op', {
          pattern_key: bucketResult.pattern_key,
          brand: normalizedBrand,
        });
      }
    } catch (error) {
      console.error('[serial-bucket] D1 insert failed', {
        error: error instanceof Error ? error.message : String(error),
        pattern_key: bucketResult.pattern_key,
        brand: normalizedBrand,
      });
    }
  }

  const updateResult = await dbSetSerialDecodeEvaluated(recordId, evaluated, env, isValid);
  if (!updateResult) return jsonResponse({ message: 'Unable to update evaluated state.' }, 500);

  if (
    evaluated &&
    updateResult.activityCandidate &&
    !updateResult.activityCandidate.wasEvaluated &&
    !updateResult.activityCandidate.success
  ) {
    const brandContext = buildBrandActivityContext(
      updateResult.activityCandidate.brand,
      updateResult.activityCandidate.normalizedBrand,
    );
    await insertActivityLogBestEffort(env, {
      eventKey: 'failed_serial_evaluated',
      eventText: `Failed ${brandContext.brandLabel} Serial Number ${updateResult.activityCandidate.serial} evaluated by an admin.`,
      eventUrl: brandContext.decoderUrl,
      imageUrl: brandContext.imageUrl,
      entityType: 'serial_decode',
      entityId: recordId,
      metadata: {
        brand: brandContext.brandLabel,
        serial: updateResult.activityCandidate.serial,
      },
    });
  }

  return jsonResponse({
    ok: true,
    evaluated: updateResult.evaluated,
    updatedCount: updateResult.updatedCount,
  });
}

export async function handleAdminV2SerialDecodeDelete(path: string, env: Env): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const deleteIndex = parts.indexOf('delete');
  const recordId = deleteIndex > 0 ? parts[deleteIndex - 1] : '';
  if (!recordId) return jsonResponse({ message: 'Missing serial decode ID.' }, 400);

  const deleteResult = await dbDeleteSerialDecodeRecord(recordId, env);
  if (!deleteResult) return jsonResponse({ message: 'Unable to delete serial decode record.' }, 500);
  if (deleteResult.deletedCount < 1) {
    return jsonResponse({ message: 'Serial decode record not found.' }, 404);
  }

  return jsonResponse({
    ok: true,
    deletedCount: deleteResult.deletedCount,
  });
}
