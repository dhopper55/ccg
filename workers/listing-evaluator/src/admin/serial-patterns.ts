import type { Env } from '../env.js';
import { jsonResponse, parseBoundedInt } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';

type AdminV2SerialPatternLookupSortBy = 'brand' | 'pattern' | 'populated';

type AdminV2SerialPatternLookupRow = {
  id: number;
  brand: string;
  pattern: string;
  regexPattern: string;
  richText: string;
  richTextPopulated: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

import { sanitizePatternLookupHtml } from '../utils/html.js';
import { maybeParaphrasePatternLookupHtml } from '../ai/paraphrase.js';
import { deriveRegexFromPatternKey, deriveSerialPatternMeta } from '../serial/utils.js';
import { runOpenAISerialPatternContextFromScreenshots } from '../serial/ai-stubs.js';
import { dbUpsertSerialPatternContext } from '../serial/db.js';
import { decodeSerialForBackend } from '../../../../src/serial-decode-service.js';

export async function handleAdminV2SerialPatternTextList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const showAll = url.searchParams.get('showAll') === '1';
  const lookupId = parseBoundedInt(url.searchParams.get('id'), 0, 0, 1_000_000_000);
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const pattern = normalizeText(url.searchParams.get('pattern'), '').slice(0, 180);
  const sortByParam = normalizeText(url.searchParams.get('sortBy'), '').toLowerCase();
  const sortBy: AdminV2SerialPatternLookupSortBy = sortByParam === 'pattern'
    ? 'pattern'
    : sortByParam === 'populated'
      ? 'populated'
      : 'brand';
  const sortDir = normalizeText(url.searchParams.get('sortDir'), '').toLowerCase() === 'desc' ? 'desc' : 'asc';

  const data = await dbListAdminV2SerialPatternLookup(page, limit, showAll, sortBy, sortDir, lookupId, brand, pattern, env);
  return jsonResponse(data);
}

export async function handleAdminV2SerialPatternTextSave(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const brand = normalizeText(body.brand, '').slice(0, 120);
  const pattern = normalizeText(body.pattern, '').slice(0, 180);
  const richTextRaw = normalizeText(body.richText, '');

  if (!brand) return jsonResponse({ message: 'Brand is required.' }, 400);
  if (!pattern) return jsonResponse({ message: 'Pattern is required.' }, 400);

  const submittedRichText = sanitizePatternLookupHtml(richTextRaw).slice(0, 12000);
  const existingRow = await env.DB.prepare(
    `SELECT rich_text
     FROM serial_decode_pattern_lookup
     WHERE brand = ? AND pattern = ?
     LIMIT 1`
  ).bind(brand, pattern).first<{ rich_text: string | null }>();
  const existingRichText = normalizeText(existingRow?.rich_text, '');
  const isAddMode = existingRichText.length < 1;

  let richText = submittedRichText;
  let transformed = false;
  if (isAddMode && submittedRichText) {
    const transformedHtml = await maybeParaphrasePatternLookupHtml(brand, pattern, submittedRichText, env);
    if (transformedHtml) {
      richText = sanitizePatternLookupHtml(transformedHtml).slice(0, 12000);
      transformed = true;
    }
  }
  const regexPattern = deriveRegexFromPatternKey(pattern).slice(0, 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO serial_decode_pattern_lookup (brand, pattern, regex_pattern, rich_text, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(brand, pattern) DO UPDATE SET
         regex_pattern = excluded.regex_pattern,
         rich_text = excluded.rich_text,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(brand, pattern, regexPattern, richText).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/no column named regex_pattern/i.test(message) && !/has no column named regex_pattern/i.test(message)) {
      throw error;
    }
    await env.DB.prepare(
      `INSERT INTO serial_decode_pattern_lookup (brand, pattern, rich_text, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(brand, pattern) DO UPDATE SET
         rich_text = excluded.rich_text,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(brand, pattern, richText).run();
  }

  return jsonResponse({ ok: true, brand, pattern, richText, transformed, mode: isAddMode ? 'add' : 'update' });
}

export async function handleAdminV2SerialPatternContextGenerate(request: Request, env: Env): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid multipart form payload.' }, 400);
  }

  const brandInput = normalizeText(formData.get('brand'), '').slice(0, 120);
  const serialInput = normalizeText(formData.get('serial'), '').slice(0, 180);
  const titleHint = normalizeText(formData.get('titleHint'), '').slice(0, 180);

  if (!brandInput) return jsonResponse({ message: 'Brand is required.' }, 400);
  if (!serialInput) return jsonResponse({ message: 'Serial is required.' }, 400);

  const decodeResult = decodeSerialForBackend(brandInput, serialInput);
  if (!decodeResult.success || !decodeResult.info || !decodeResult.normalizedBrand) {
    return jsonResponse({ message: decodeResult.error || 'Serial must decode successfully before adding context.' }, 400);
  }

  const normalizedBrand = decodeResult.normalizedBrand;
  const decodedBrand = normalizeText(decodeResult.info.brand, brandInput).slice(0, 120);
  const decodedSerial = normalizeText(decodeResult.info.serialNumber, serialInput).slice(0, 180);
  const patternMeta = deriveSerialPatternMeta(normalizedBrand, decodedSerial);

  const screenshotFiles = formData.getAll('screenshots').filter((entry): entry is File => entry instanceof File);
  if (screenshotFiles.length < 1) {
    return jsonResponse({ message: 'Upload at least one screenshot.' }, 400);
  }
  if (screenshotFiles.length > 6) {
    return jsonResponse({ message: 'You can upload up to 6 screenshots.' }, 400);
  }

  for (const file of screenshotFiles) {
    if (!file.type.toLowerCase().startsWith('image/')) {
      return jsonResponse({ message: 'Only image uploads are supported.' }, 400);
    }
    if (file.size > 6 * 1024 * 1024) {
      return jsonResponse({ message: 'Each screenshot must be 6MB or smaller.' }, 400);
    }
  }

  const aiResult = await runOpenAISerialPatternContextFromScreenshots(
    decodedBrand,
    decodedSerial,
    patternMeta.patternLabel,
    titleHint,
    screenshotFiles,
    env,
  );

  if (!aiResult.payload) {
    return jsonResponse({ message: aiResult.error || 'Unable to generate context from screenshots.' }, 500);
  }

  const payload = aiResult.payload;
  const saved = await dbUpsertSerialPatternContext({
    brand: decodedBrand,
    normalizedBrand,
    patternKey: patternMeta.patternKey,
    patternLabel: patternMeta.patternLabel,
    title: payload.title,
    summary: payload.summary,
    highlights: payload.highlights,
    caveats: payload.caveats,
    verificationTips: payload.verificationTips,
    sourceSerial: decodedSerial,
    aiModel: aiResult.model,
    aiResponseJson: aiResult.rawResponseJson,
    published: true,
  }, env);

  return jsonResponse({
    ok: true,
    id: saved.id,
    context: saved.context,
    patternKey: patternMeta.patternKey,
    patternLabel: patternMeta.patternLabel,
  });
}

export async function dbListAdminV2SerialPatternLookup(
  page: number,
  limit: number,
  showAll: boolean,
  sortBy: AdminV2SerialPatternLookupSortBy,
  sortDir: 'asc' | 'desc',
  lookupId: number,
  brand: string,
  pattern: string,
  env: Env,
): Promise<{
  records: AdminV2SerialPatternLookupRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const db = env.DB.withSession('first-primary');
  const where: string[] = [];
  const values: unknown[] = [];

  if (!showAll) {
    where.push(`trim(COALESCE(rich_text, '')) = ''`);
  }
  if (lookupId > 0) {
    where.push(`id = ?`);
    values.push(lookupId);
  }
  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }
  if (pattern) {
    where.push(`trim(pattern) = ?`);
    values.push(pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM serial_decode_pattern_lookup
     ${whereSql}`
  ).bind(...values).first<{ total: number | null }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const effectivePage = Math.min(safePage, totalPages);
  const offset = (effectivePage - 1) * safeLimit;

  const sortExpr = sortBy === 'pattern'
    ? 'lower(trim(pattern))'
    : sortBy === 'populated'
      ? `CASE WHEN trim(COALESCE(rich_text, '')) <> '' THEN 1 ELSE 0 END`
      : 'lower(trim(brand))';
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

  const rows = await db.prepare(
    `SELECT
      l.id,
      l.brand,
      l.pattern,
      l.regex_pattern,
      l.rich_text,
      l.created_at,
      l.updated_at,
      CASE WHEN trim(COALESCE(rich_text, '')) <> '' THEN 1 ELSE 0 END AS is_populated
     FROM serial_decode_pattern_lookup l
     ${whereSql}
     ORDER BY ${sortExpr} ${dir}, lower(trim(brand)) ASC, lower(trim(pattern)) ASC
     LIMIT ? OFFSET ?`
  ).bind(...values, safeLimit, offset).all<{
    id: number | null;
    brand: string | null;
    pattern: string | null;
    regex_pattern: string | null;
    rich_text: string | null;
    created_at: string | null;
    updated_at: string | null;
    is_populated: number | null;
  }>();

  const records: AdminV2SerialPatternLookupRow[] = (rows.results ?? [])
    .map((row) => {
      const brand = normalizeText(row.brand, '');
      const pattern = normalizeText(row.pattern, '');
      const storedRegexPattern = normalizeText(row.regex_pattern, '');
      const regexPattern = !storedRegexPattern || storedRegexPattern === '^.{1,}$'
        ? deriveRegexFromPatternKey(pattern)
        : storedRegexPattern;
      return {
        id: Number(row.id || 0),
        brand,
        pattern,
        regexPattern,
        richText: normalizeText(row.rich_text, ''),
        richTextPopulated: Number(row.is_populated || 0) === 1,
        createdAt: normalizeText(row.created_at, '') || null,
        updatedAt: normalizeText(row.updated_at, '') || null,
      };
    })
    .filter((row) => row.brand.length > 0 && row.pattern.length > 0);

  return {
    records,
    page: effectivePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}
