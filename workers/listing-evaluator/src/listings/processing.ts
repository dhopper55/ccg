import { normalizeText } from '../utils/text.js';
import { parseMoney, formatCurrency, normalizeMoneyValue } from '../utils/money.js';
import { CATEGORY_OPTIONS, CONDITION_OPTIONS } from '../constants.js';
import type { ListingSource, SingleAiResult } from '../types/core.js';

export { parseMoney, formatCurrency };

export function formatSourceLabel(source: ListingSource): string {
  if (source === 'facebook') return 'FBM';
  if (source === 'craigslist') return 'CG';
  return 'R';
}

export function extractAskingFromSummary(aiSummary: string): number | null {
  const match = aiSummary.match(/Asking price \(from listing text\):\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

export function extractMultiAskingTotal(aiSummary: string): number | null {
  const match = aiSummary.match(/Total listing asking price:\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

export function splitAiSummary(aiSummary: string | null): string[] {
  if (!aiSummary) return [];
  const maxChunkSize = 2000;
  const chunks: string[] = [];
  let remaining = aiSummary;
  while (remaining.length > 0 && chunks.length < 10) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = remaining.lastIndexOf('\n\n', maxChunkSize);
    if (splitIndex < maxChunkSize * 0.6) {
      splitIndex = remaining.lastIndexOf('\n', maxChunkSize);
    }
    if (splitIndex < maxChunkSize * 0.4) {
      splitIndex = maxChunkSize;
    }
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }
  if (remaining.length > 0 && chunks.length === 10) {
    console.warn('AI summary truncated after 10 chunks', { remainingLength: remaining.length });
  }
  return chunks;
}

export function normalizeCondition(value: unknown): string {
  const raw = normalizeText(value, 'Good');
  if (!raw) return 'Good';
  const match = CONDITION_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match || 'Good';
}

export function normalizeCategory(value: unknown): string {
  const raw = normalizeText(value, 'Other');
  if (!raw) return 'Other';
  const match = CATEGORY_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match || 'Other';
}

export function normalizeFinish(value: unknown): string {
  const raw = normalizeText(value, 'Unknown');
  if (!raw) return 'Unknown';
  return raw;
}

export function normalizeYear(value: unknown): string {
  const raw = normalizeText(value, '');
  if (!raw || /^unknown$/i.test(raw)) {
    return 'Estimated range: 2000s–2010s (NOT DEFINITIVE)';
  }
  return raw;
}

export function ensureDefaultSuffix(value: unknown, fallback: string): string {
  const text = normalizeText(value, '');
  if (!text) return `General: ${fallback}`;
  if (text.includes(fallback)) return text;
  return `${text} General: ${fallback}`;
}

function countMoneyTokens(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\$\\s*[\\d,]+/g);
  return matches ? matches.length : 0;
}

function isSuspiciousListedPrice(listed: number, hasMultiplePrices: boolean): boolean {
  if (listed <= 5) return true;
  if (listed === 1234) return true;
  if (listed >= 1000 && hasMultiplePrices) return true;
  return false;
}

export function chooseAskingPrice(
  listed: number | null,
  aiAsking: number | null,
  description: string,
  aiSummary: string,
  isMulti: boolean
): number | null {
  if (listed == null && aiAsking == null) return null;
  if (listed == null) return aiAsking;

  if (isMulti) {
    return aiAsking ?? listed;
  }

  const hasMultiplePrices = countMoneyTokens(description) >= 2;
  const summaryMentionsMultiple = /multiple items|bundle|lot|each pedal|per item/i.test(aiSummary);
  const suspicious = isSuspiciousListedPrice(listed, hasMultiplePrices);

  if (aiAsking != null && (suspicious || summaryMentionsMultiple)) {
    return aiAsking;
  }

  return listed;
}

function formatRange(low: number, high: number): string {
  if (low === high) return formatCurrency(low);
  return `${formatCurrency(low)} - ${formatCurrency(high)}`;
}

function isWeakAiText(value: unknown): boolean {
  const text = normalizeText(value, '');
  if (!text) return true;
  return /^(unknown|other|n\/a|na)$/i.test(text.trim());
}

export function chooseBestStructuredText(primary: unknown, fallback: unknown, maxLength = 180): string {
  const primaryText = normalizeText(primary, '').slice(0, maxLength);
  if (!isWeakAiText(primaryText)) return primaryText;
  return normalizeText(fallback, '').slice(0, maxLength);
}

export function buildSingleAiSummary(
  aiData: SingleAiResult | undefined,
  options?: { ideal?: number | null; privateParty?: { low: number; high: number } | null }
): string {
  if (!aiData) return '';

  const name = [
    normalizeText(aiData.year, ''),
    normalizeText(aiData.brand, ''),
    normalizeText(aiData.model, ''),
    normalizeText(aiData.finish, ''),
  ].filter(Boolean).join(' ').trim();

  const lines: string[] = [];
  lines.push('What it appears to be');
  lines.push(`- ${name || 'Unknown item'}`);
  lines.push(`- Condition: ${normalizeText(aiData.condition, 'Unknown')}`);

  const low = normalizeMoneyValue(aiData.value_private_party_low);
  const medium = normalizeMoneyValue(aiData.value_private_party_medium);
  const high = normalizeMoneyValue(aiData.value_private_party_high);
  const asking = normalizeMoneyValue(aiData.asking_price);

  if (low != null || medium != null || high != null || options?.ideal != null || asking != null) {
    lines.push('');
    lines.push('Prices');
    if (low != null && high != null) {
      lines.push(`- Typical private-party value: ${formatRange(low, high)}`);
    }
    if (medium != null) {
      lines.push(`- Midpoint estimate: ${formatCurrency(medium)}`);
    }
    if (options?.ideal != null) {
      lines.push(`- Ideal buy price: ${formatCurrency(options.ideal)}`);
    }
    if (asking != null) {
      lines.push(`- Asking price used: ${formatCurrency(asking)}`);
    }
  }

  const pricingNotes = normalizeText(aiData.pricing_notes, '');
  if (pricingNotes) {
    lines.push('');
    lines.push('Pricing notes');
    lines.push(`- ${pricingNotes}`);
  }

  return lines.join('\n').trim();
}
