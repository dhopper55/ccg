/**
 * V2 Serial Decode Engine
 *
 * Queries serial_patterns_v2 in D1 to decode serials via reusable templates.
 * Returns null when no D1 pattern matches — caller falls through to V1 code.
 *
 * Template types:
 *   prefix-yymm-seq                    — fixed prefix + YY + MM + sequence
 *   prefix-yy-seq                      — fixed prefix + YY + sequence (no month)
 *   numeric-yymm-seq                   — all-numeric, year/month at specified positions
 *   three-letter-prefix-modelcode-yy-seq — Jackson 3-letter country/factory/brand prefix
 *   bespoke                            — regex acts as exclusion guard; always returns null (V1 handles it)
 */

import { DecodeResult, GuitarInfo } from '../../../src/types.js';

export interface SerialPatternV2Row {
  id: number;
  brand: string;
  pattern_key: string;
  pattern_label: string;
  regex: string;
  template_type: string;
  params: string;
  priority: number;
  active: number;
}

interface PrefixYYMMParams {
  prefix: string;
  prefixLen: number;
  brand: string;
  factory: string;
  country: string;
  model?: string;
  yearCentury: number;
}

interface PrefixYYParams {
  prefix: string;
  prefixLen: number;
  brand: string;
  factory: string;
  country: string;
  model?: string;
  yearCentury: number;
}

interface NumericYYMMParams {
  yearStart: number;
  monthStart?: number;
  seqStart: number;
  brand: string;
  factory: string;
  country: string;
  model?: string;
  yearCentury: number;
}

interface ThreeLetterPrefixParams {
  brand: string;
  yearCentury: number;
  indonesiaFactoryCodes: Record<string, string>;
  chinaFactoryCodes: Record<string, string>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(mm: number): string | undefined {
  if (mm < 1 || mm > 12) return undefined;
  return MONTH_NAMES[mm - 1];
}

function decodePrefixYYMM(serial: string, patternKey: string, patternLabel: string, params: PrefixYYMMParams): DecodeResult | null {
  const digits = serial.substring(params.prefixLen);
  const yy = parseInt(digits.substring(0, 2), 10);
  const mm = parseInt(digits.substring(2, 4), 10);
  const sequence = digits.substring(4);

  if (Number.isNaN(yy) || Number.isNaN(mm)) return null;

  const month = monthName(mm);
  if (!month) return null;

  const year = (params.yearCentury + yy).toString();

  const info: GuitarInfo = {
    brand: params.brand,
    serialNumber: serial,
    year,
    month,
    factory: params.factory,
    country: params.country,
    ...(params.model ? { model: params.model } : {}),
  };

  return { success: true, info, patternKey, patternLabel };
}

function decodePrefixYY(serial: string, patternKey: string, patternLabel: string, params: PrefixYYParams): DecodeResult | null {
  const digits = serial.substring(params.prefixLen);
  const yy = parseInt(digits.substring(0, 2), 10);
  if (Number.isNaN(yy)) return null;

  const year = (params.yearCentury + yy).toString();

  const info: GuitarInfo = {
    brand: params.brand,
    serialNumber: serial,
    year,
    factory: params.factory,
    country: params.country,
    ...(params.model ? { model: params.model } : {}),
  };

  return { success: true, info, patternKey, patternLabel };
}

function decodeNumericYYMM(serial: string, patternKey: string, patternLabel: string, params: NumericYYMMParams): DecodeResult | null {
  const yy = parseInt(serial.substring(params.yearStart, params.yearStart + 2), 10);
  if (Number.isNaN(yy)) return null;

  const year = (params.yearCentury + yy).toString();

  let month: string | undefined;
  if (params.monthStart !== undefined && params.monthStart >= 0) {
    const mm = parseInt(serial.substring(params.monthStart, params.monthStart + 2), 10);
    if (Number.isNaN(mm)) return null;
    month = monthName(mm);
    if (!month) return null;
  }

  const info: GuitarInfo = {
    brand: params.brand,
    serialNumber: serial,
    year,
    ...(month ? { month } : {}),
    factory: params.factory,
    country: params.country,
    ...(params.model ? { model: params.model } : {}),
  };

  return { success: true, info, patternKey, patternLabel };
}

function decodeThreeLetterPrefix(serial: string, patternKey: string, patternLabel: string, params: ThreeLetterPrefixParams): DecodeResult | null {
  const letterPrefix = serial.substring(0, 3);
  const yearDigits = serial.substring(5, 7);
  const year = params.yearCentury + parseInt(yearDigits, 10);

  if (Number.isNaN(year)) return null;

  let country = 'Unknown';
  let factory: string | undefined;

  if (letterPrefix[0] === 'I') {
    country = 'Indonesia';
    factory = params.indonesiaFactoryCodes[letterPrefix[1]] ?? `Indonesian factory (${letterPrefix[1]})`;
  } else if (letterPrefix[0] === 'C') {
    country = 'China';
    factory = params.chinaFactoryCodes[letterPrefix[1]] ?? `Chinese factory (${letterPrefix[1]})`;
  } else if (letterPrefix[0] === 'N') {
    country = 'India';
    factory = 'Jackson India';
  }

  const info: GuitarInfo = {
    brand: params.brand,
    serialNumber: serial,
    year: year.toString(),
    country,
    ...(factory ? { factory } : {}),
  };

  return { success: true, info, patternKey, patternLabel };
}

function applyTemplate(serial: string, row: SerialPatternV2Row): DecodeResult | null {
  // bespoke patterns always defer to V1
  if (row.template_type === 'bespoke') return null;

  let params: unknown;
  try {
    params = JSON.parse(row.params);
  } catch {
    return null;
  }

  switch (row.template_type) {
    case 'prefix-yymm-seq':
      return decodePrefixYYMM(serial, row.pattern_key, row.pattern_label, params as PrefixYYMMParams);
    case 'prefix-yy-seq':
      return decodePrefixYY(serial, row.pattern_key, row.pattern_label, params as PrefixYYParams);
    case 'numeric-yymm-seq':
      return decodeNumericYYMM(serial, row.pattern_key, row.pattern_label, params as NumericYYMMParams);
    case 'three-letter-prefix-modelcode-yy-seq':
      return decodeThreeLetterPrefix(serial, row.pattern_key, row.pattern_label, params as ThreeLetterPrefixParams);
    default:
      return null;
  }
}

interface Env {
  DB: D1Database;
}

interface CompiledPattern {
  row: SerialPatternV2Row;
  regex: RegExp;
}

const patternCache = new Map<string, { patterns: CompiledPattern[]; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function getPatterns(brand: string, env: Env): Promise<CompiledPattern[]> {
  const cached = patternCache.get(brand);
  if (cached && cached.expiresAt > Date.now()) return cached.patterns;

  const result = await env.DB.prepare(
    'SELECT * FROM serial_patterns_v2 WHERE brand = ? AND active = 1 ORDER BY priority ASC',
  ).bind(brand).all<SerialPatternV2Row>();

  const patterns: CompiledPattern[] = [];
  for (const row of result.results ?? []) {
    try {
      patterns.push({ row, regex: new RegExp(row.regex, 'i') });
    } catch {
      // skip rows with invalid regex
    }
  }
  patternCache.set(brand, { patterns, expiresAt: Date.now() + CACHE_TTL_MS });
  return patterns;
}

export async function decodeSerialV2(
  brand: string,
  serial: string,
  env: Env,
): Promise<DecodeResult | null> {
  let patterns: CompiledPattern[];
  try {
    patterns = await getPatterns(brand, env);
  } catch {
    return null;
  }

  if (patterns.length === 0) return null;

  const normalized = serial.trim().toUpperCase();

  for (const { row, regex } of patterns) {
    if (!regex.test(normalized)) continue;

    const result = applyTemplate(normalized, row);
    if (result) return result;
  }

  return null;
}
