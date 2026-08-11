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

  const rawText = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';

  try {
    const parsed = JSON.parse(rawText) as SerialPatternBucketResult;
    if (parsed.bucket !== 1 && parsed.bucket !== 2) throw new Error('invalid bucket');
    return parsed;
  } catch {
    console.error('[serial-bucket] Failed to parse AI response', rawText);
    return { bucket: 2, reason: 'AI returned unparseable response.' };
  }
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

Give a definitive verdict. Do not hedge with "maybe" or "possibly" — decide valid or invalid based on what your searches actually turn up. If your searches are inconclusive, lean toward invalid and say so in your analysis.

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
      max_tokens: 2048,
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
  };

  const textBlocks = (data.content ?? []).filter(
    (b): b is { type: string; text: string } => b.type === 'text' && typeof b.text === 'string',
  );

  // Scan from the last text block backward — the final verdict is usually last,
  // but scanning defends against any interim commentary the model emits around tool calls.
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const candidate = textBlocks[i].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(candidate) as { isValid?: unknown; analysis?: unknown };
      if (typeof parsed.isValid === 'boolean' && typeof parsed.analysis === 'string' && parsed.analysis.trim()) {
        return { ok: true, isValid: parsed.isValid, analysis: parsed.analysis.trim() };
      }
    } catch {
      // Not the JSON verdict block — keep scanning earlier blocks.
    }
  }

  console.error('[serial-run-analysis] Failed to parse AI response', JSON.stringify(data.content));
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

  // Yes path: try decode first, then AI if needed
  if (evaluated && isValid === true) {
    // Persist AI analysis text immediately (best-effort — column may not exist yet)
    if (aiAnalysisText && aiAnalysisText.toLowerCase() !== 'n/a') {
      try {
        await env.DB.prepare(
          `UPDATE serial_decode_events SET g_ai_analysis = ? WHERE id = ?`
        ).bind(aiAnalysisText.slice(0, 20000), parseInt(recordId, 10)).run();
      } catch {
        // g_ai_analysis column not yet added — safe to ignore
      }
    }

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
      await env.DB.prepare(
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
      console.log('[serial-bucket] bucket 1 — pattern inserted', { pattern_key: bucketResult.pattern_key });
    } catch (error) {
      console.error('[serial-bucket] D1 insert failed', { error });
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
