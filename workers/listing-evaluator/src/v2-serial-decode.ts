/**
 * V2 Serial Decode Engine
 *
 * Queries serial_patterns_v2 in D1 to decode serials via reusable templates.
 * Returns null when no D1 pattern matches — caller falls through to V1 code.
 *
 * Template types:
 *   prefix-yymm-seq  — fixed prefix + YY + MM + sequence (most common import format)
 *   prefix-yy-seq    — fixed prefix + YY + sequence (no month)
 *   numeric-yymm-seq — all-numeric, year/month at specified positions
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
  monthStart: number;
  seqStart: number;
  brand: string;
  factory: string;
  country: string;
  model?: string;
  yearCentury: number;
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
  const sequence = digits.substring(2);

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
  const mm = parseInt(serial.substring(params.monthStart, params.monthStart + 2), 10);
  if (Number.isNaN(yy) || Number.isNaN(mm)) return null;

  const month = monthName(mm);
  if (!month) return null;

  const year = (params.yearCentury + yy).toString();
  const sequence = serial.substring(params.seqStart);

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

function applyTemplate(serial: string, row: SerialPatternV2Row): DecodeResult | null {
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
    default:
      return null;
  }
}

interface Env {
  DB: D1Database;
}

const patternCache = new Map<string, { rows: SerialPatternV2Row[]; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function getPatterns(brand: string, env: Env): Promise<SerialPatternV2Row[]> {
  const cached = patternCache.get(brand);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const result = await env.DB.prepare(
    'SELECT * FROM serial_patterns_v2 WHERE brand = ? AND active = 1 ORDER BY priority ASC',
  ).bind(brand).all<SerialPatternV2Row>();

  const rows = result.results ?? [];
  patternCache.set(brand, { rows, expiresAt: Date.now() + CACHE_TTL_MS });
  return rows;
}

export async function decodeSerialV2(
  brand: string,
  serial: string,
  env: Env,
): Promise<DecodeResult | null> {
  let patterns: SerialPatternV2Row[];
  try {
    patterns = await getPatterns(brand, env);
  } catch {
    return null;
  }

  if (patterns.length === 0) return null;

  const normalized = serial.trim().toUpperCase();

  for (const row of patterns) {
    let regex: RegExp;
    try {
      regex = new RegExp(row.regex, 'i');
    } catch {
      continue;
    }
    if (!regex.test(normalized)) continue;

    const result = applyTemplate(normalized, row);
    if (result) return result;
  }

  return null;
}
