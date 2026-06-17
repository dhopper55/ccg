import { normalizeText } from '../utils/text.js';
import { deriveExplicitRegexFromKnownPatternKey } from '../serial-pattern-registry.js';
import { decodeSerialForBackend, normalizeBrandKey } from '../../../../src/serial-decode-service.js';
import { decodeSerialV2 } from '../v2-serial-decode.js';

export function normalizeSerialKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function deriveRegexFromPatternKey(patternKey: string): string {
  try {
  const cleaned = normalizeText(patternKey, '');
  if (!cleaned) return '';

  const explicitRegex = deriveExplicitRegexFromKnownPatternKey(cleaned);
  if (explicitRegex) return explicitRegex;

  const parts = cleaned.split(':');
  const prefixPart = parts.find((part) => part.startsWith('prefix-')) || '';
  const lengthPart = parts.find((part) => part.startsWith('len-')) || '';
  const maskPart = parts.length > 0 ? parts[parts.length - 1] : '';
  const lengthValue = Number.parseInt(lengthPart.replace(/^len-/i, ''), 10);
  const prefixRaw = prefixPart.replace(/^prefix-/i, '');
  const prefix = prefixRaw && prefixRaw !== 'none' ? prefixRaw.toUpperCase() : '';
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const maskRuns = parsePatternMaskRuns(maskPart, Number.isFinite(lengthValue) && lengthValue > 0 ? lengthValue : null);
  const runLength = maskRuns.reduce((sum, run) => sum + run.count, 0);

  if (maskRuns.length > 0) {
    const pieces: string[] = [];
    let prefixRemaining = escapedPrefix;
    let consumedPrefix = false;

    for (const run of maskRuns) {
      if (!consumedPrefix && prefixRemaining && run.type === 'A') {
        const consumeCount = Math.min(prefixRemaining.length, run.count);
        if (consumeCount > 0) {
          pieces.push(prefixRemaining.slice(0, consumeCount));
          prefixRemaining = prefixRemaining.slice(consumeCount);
        }
        const alphaRemainder = run.count - consumeCount;
        if (alphaRemainder > 0) pieces.push(`[A-Z]{${alphaRemainder}}`);
        if (!prefixRemaining) consumedPrefix = true;
      } else {
        pieces.push(run.type === 'A' ? `[A-Z]{${run.count}}` : `\\d{${run.count}}`);
      }
    }

    if (prefixRemaining) {
      pieces.unshift(escapedPrefix);
    }
    return `^${pieces.join('')}$`;
  }

  if (Number.isFinite(lengthValue) && lengthValue > 0) {
    if (escapedPrefix) {
      const remaining = Math.max(0, lengthValue - escapedPrefix.length);
      return `^${escapedPrefix}[A-Z0-9]{${remaining}}$`;
    }
    return `^[A-Z0-9]{${lengthValue}}$`;
  }

  if (escapedPrefix) return `^${escapedPrefix}[A-Z0-9]*$`;
  return '';
  } catch {
    return '';
  }
}

export function isCatchAllSerialRegex(regexPattern: string): boolean {
  const normalized = normalizeText(regexPattern, '');
  return normalized === '^.{1,}$' || normalized === '^.+$' || normalized === '^.*$';
}

export function parsePatternMaskRuns(maskPart: string, expectedLength: number | null): Array<{ type: 'A' | '9'; count: number }> {
  const mask = normalizeText(maskPart, '');
  if (!mask || !/^[A9]/.test(mask)) return [];

  const memo = new Map<string, Array<{ type: 'A' | '9'; count: number }> | null>();

  const solve = (idx: number, remaining: number | null): Array<{ type: 'A' | '9'; count: number }> | null => {
    const key = `${idx}:${remaining == null ? 'n' : remaining}`;
    if (memo.has(key)) return memo.get(key) || null;

    if (idx >= mask.length) {
      const done = remaining == null || remaining === 0 ? [] : null;
      memo.set(key, done);
      return done;
    }

    const marker = mask[idx];
    if (marker !== 'A' && marker !== '9') {
      memo.set(key, null);
      return null;
    }

    let best: Array<{ type: 'A' | '9'; count: number }> | null = null;
    for (let end = idx + 2; end <= mask.length; end += 1) {
      const countText = mask.slice(idx + 1, end);
      if (!/^\d+$/.test(countText)) continue;
      const count = Number.parseInt(countText, 10);
      if (!Number.isFinite(count) || count <= 0) continue;
      if (remaining != null && count > remaining) continue;

      const nextRemaining = remaining == null ? null : remaining - count;
      const next = solve(end, nextRemaining);
      if (!next) continue;

      const candidate = [{ type: marker as 'A' | '9', count }, ...next];
      best = candidate;
      break;
    }

    memo.set(key, best);
    return best;
  };

  const exact = solve(0, expectedLength);
  if (exact) return exact;

  const fallback = solve(0, null);
  return fallback || [];
}

export function generateSampleSerialFromPatternKey(patternKey: string): string {
  const fallback = 'A1234567';
  const parts = normalizeText(patternKey, '').split(':');
  if (parts.length < 3) return fallback;

  const prefixPart = parts.find((part) => part.startsWith('prefix-')) || '';
  const lenPart = parts.find((part) => part.startsWith('len-')) || '';
  const prefixRaw = prefixPart.replace(/^prefix-/i, '');
  const prefix = prefixRaw && prefixRaw !== 'none' ? prefixRaw.toUpperCase() : '';
  const targetLen = Number.parseInt(lenPart.replace(/^len-/i, ''), 10);

  let sample = '';
  if (prefix) sample = prefix;

  if (Number.isFinite(targetLen) && targetLen > 0) {
    if (sample.length >= targetLen) {
      sample = sample.slice(0, targetLen);
    } else {
      sample = `${sample}${'1'.repeat(targetLen - sample.length)}`;
    }
  } else if (!sample) {
    sample = fallback;
  }

  return sample || fallback;
}

export function deriveSerialPatternMeta(normalizedBrand: string, serialInput: string): { patternKey: string; patternLabel: string } {
  const serial = normalizeSerialKey(serialInput).slice(0, 180);
  if (!serial) {
    return {
      patternKey: `${normalizedBrand}:unknown`,
      patternLabel: 'Unknown format',
    };
  }

  const alphaPrefix = (serial.match(/^[A-Z]+/)?.[0] || '').slice(0, 6);
  const masked = serial.replace(/[A-Z]/g, 'A').replace(/\d/g, '9');
  const compactMask = compressMask(masked).slice(0, 80);
  const prefixPart = alphaPrefix ? `prefix-${alphaPrefix.toLowerCase()}` : 'prefix-none';
  const lengthPart = `len-${serial.length}`;
  const maskPart = compactMask || 'mask-none';

  return {
    patternKey: `${prefixPart}:${lengthPart}:${maskPart}`,
    patternLabel: [
      alphaPrefix ? `Prefix ${alphaPrefix}` : 'No prefix',
      `${serial.length} chars`,
      compactMask,
    ].filter(Boolean).join(' | '),
  };
}

export function compressMask(mask: string): string {
  if (!mask) return '';
  let out = '';
  let current = mask[0];
  let count = 1;
  for (let i = 1; i < mask.length; i += 1) {
    const ch = mask[i];
    if (ch === current) {
      count += 1;
      continue;
    }
    out += `${current}${count}`;
    current = ch;
    count = 1;
  }
  out += `${current}${count}`;
  return out;
}

export function shouldAttemptAiFallback(result: { success: boolean; error?: string }): boolean {
  if (result.success) return false;
  const error = normalizeText(result.error, '');
  if (!error) return true;
  return ![
    'Please select a brand.',
    'Unknown brand selected.',
    'Please enter a serial number.',
  ].includes(error);
}

export function hasMeaningfulServerDecodeInfo(info: {
  year?: string;
  month?: string;
  factory?: string;
  country?: string;
  model?: string;
}): boolean {
  return (
    isMeaningfulServerYear(info.year) ||
    isMeaningfulServerMonth(info.month) ||
    isMeaningfulServerDescriptor(info.factory, 'factory') ||
    isMeaningfulServerDescriptor(info.country, 'country') ||
    isMeaningfulServerDescriptor(info.model, 'model')
  );
}

export function isMeaningfulServerYear(value: string | undefined): boolean {
  const text = normalizeText(value, '');
  if (!text) return false;
  if (/\b(possibly|likely|maybe|check|unknown|contact)\b/i.test(text)) return false;
  if (/\s+or\s+/i.test(text)) return false;
  return /\d{4}/.test(text);
}

export function isMeaningfulServerMonth(value: string | undefined): boolean {
  const text = normalizeText(value, '');
  if (!text) return false;
  return /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(text);
}

export function isMeaningfulServerDescriptor(
  value: string | undefined,
  kind: 'factory' | 'country' | 'model',
): boolean {
  const text = normalizeText(value, '');
  if (!text) return false;
  if (/\b(unknown|unspecified|check|contact|n\/a|not available)\b/i.test(text)) return false;
  if (/\s+or\s+/i.test(text)) return false;
  if (kind === 'country' && /\bimport\b/i.test(text)) return false;
  if (kind === 'factory' && /\blikely\b/i.test(text)) return false;
  return true;
}

export function getDenverDayUtcBounds(dateStr: string): { startUtc: string; endUtc: string } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (const offsetHours of [6, 7]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
    const parts = fmt.formatToParts(candidate);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '99', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '99', 10);
    if (h === 0 && m === 0) {
      const end = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      return { startUtc: candidate.toISOString(), endUtc: end.toISOString() };
    }
  }

  // Fallback: assume MST (UTC-7)
  const start = new Date(Date.UTC(year, month - 1, day, 7, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export function getDenverHalfHourBucketIndex(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return Math.floor((hour * 60 + minute) / 30);
}

export function decodeSerial(brandInput: string, serial: string): { success: boolean; info?: { brand?: string; serialNumber?: string; year?: string; model?: string } } | null {
  const result = decodeSerialForBackend(brandInput, serial);
  if (!result.normalizedBrand) return null;
  return {
    success: result.success,
    info: result.info,
  };
}

