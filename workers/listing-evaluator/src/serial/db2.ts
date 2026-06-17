// Overflow from serial/db.ts (500-line limit split)
import { normalizeText } from '../utils/text.js';
import type { SerialPatternContextPayload } from '../types/core.js';

export function sanitizePatternContextPayload(
  payload: Partial<SerialPatternContextPayload>,
  brand: string,
  patternLabel: string,
): SerialPatternContextPayload {
  const fallbackTitle = `${brand} ${patternLabel} pattern notes`;
  return {
    title: normalizeText(payload.title, fallbackTitle).slice(0, 140),
    summary: normalizeText(payload.summary, 'Additional context available for this serial pattern.').slice(0, 1200),
    highlights: sanitizePatternContextList(payload.highlights, 10, 320),
    caveats: sanitizePatternContextList(payload.caveats, 8, 320),
    verificationTips: sanitizePatternContextList(payload.verificationTips, 8, 320),
  };
}

export function sanitizePatternContextList(input: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(input)) return [];
  const items: string[] = [];
  for (const entry of input) {
    const cleaned = normalizeText(entry, '').slice(0, maxItemLength);
    if (!cleaned) continue;
    items.push(cleaned);
    if (items.length >= maxItems) break;
  }
  return items;
}
