// Helpers for the Claude desktop flows (the inventory item's "AI Analysis & Listing Tools" and
// the listing evaluator), which run in Claude desktop (covered by the subscription) instead of
// the paid API: build the prompt to paste there, then read Claude's reply back into the form
// from the JSON block at the end of it.

import { claudeMarkdownToHtml, escapeHtml } from '../../../shared/claude-eval-rules';

// The prompt text, pricing rule and Markdown reader live in shared/claude-eval-rules.ts so the
// CCG Eval connector (Worker) uses exactly the same rules as these paste prompts.
export {
  buildClaudeItemPrompt,
  buildClaudeListingEvalPrompt,
  claudeMarkdownToHtml,
  MERCHANT_CENTER_CATEGORY_OPTIONS,
} from '../../../shared/claude-eval-rules';

export type ClaudeDesktopFields = {
  title: string;
  brand: string;
  model: string;
  finish: string;
  yearRange: string;
  serialNumber: string;
  category: string;
  merchantCenterCatCode: string;
  privatePartyValue: number | null;
};


export type ClaudeListing = {
  saleTitle: string;
  description: string;
  bullets: string[];
};

const FIELD_BLOCK_PATTERN = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

type RecordReader<T> = (raw: Record<string, unknown>) => T | null;

// Parse a JSON object leniently: tolerate a leading "json" label and raw line breaks or
// tabs inside strings (long descriptions often come back that way).
function parseJsonObject(jsonText: string): Record<string, unknown> | null {
  const text = jsonText.trim().replace(/^json\s*/i, '');
  const attempt = (candidate: string) => {
    try {
      const raw: unknown = JSON.parse(candidate);
      return raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const parsed = attempt(text);
  if (parsed) return parsed;
  let inString = false;
  let escaped = false;
  let repaired = '';
  for (const char of text) {
    if (inString && !escaped && (char === '\n' || char === '\r' || char === '\t')) {
      repaired += char === '\n' ? '\\n' : char === '\t' ? '\\t' : '';
      continue;
    }
    if (char === '"' && !escaped) inString = !inString;
    escaped = char === '\\' && !escaped;
    repaired += char;
  }
  return attempt(repaired);
}

// Find the JSON block in Claude's reply: a ```json fenced block, or a bare {...} object
// when only the block itself was copied. The rest of the reply is the analysis.
function findJsonInReply<T>(reply: string, read: RecordReader<T>): { rest: string; value: T } {
  const outside = (start: number, end: number) => (reply.slice(0, start) + reply.slice(end)).trim();
  const readText = (text: string) => {
    const raw = parseJsonObject(text);
    return raw ? read(raw) : null;
  };

  const fenced = [...reply.matchAll(FIELD_BLOCK_PATTERN)];
  for (let index = fenced.length - 1; index >= 0; index--) {
    const match = fenced[index];
    const value = readText(match[1]);
    if (value && match.index != null) {
      return { rest: outside(match.index, match.index + match[0].length), value };
    }
  }

  const end = reply.lastIndexOf('}');
  for (
    let start = reply.lastIndexOf('{', end);
    start >= 0;
    start = reply.lastIndexOf('{', start - 1)
  ) {
    const value = readText(reply.slice(start, end + 1));
    if (value) return { rest: outside(start, end + 1), value };
    if (start === 0) break;
  }

  throw new Error(
    "Couldn't find the JSON block in what was pasted. Make sure you copied Claude's whole reply.",
  );
}

function readFieldObject(record: Record<string, unknown>): ClaudeDesktopFields | null {
  if (!('brand' in record || 'title' in record || 'model' in record)) return null;
  const value = Number(String(record.private_party_value ?? '').replace(/[$,\s]/g, ''));
  return {
    title: asText(record.title),
    brand: asText(record.brand),
    model: asText(record.model),
    finish: asText(record.finish),
    yearRange: asText(record.year_range ?? record.year),
    serialNumber: asText(record.serial_number),
    category: asText(record.category),
    merchantCenterCatCode: asText(record.merchant_center_category).toUpperCase(),
    privatePartyValue: Number.isFinite(value) && value > 0 ? Math.round(value) : null,
  };
}

// Keep a bullet within the 60-character field, cutting at a word boundary.
function fitBullet(text: string): string {
  const clean = text
    .replace(/^[•\-*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= 60) return clean;
  const cut = clean.slice(0, 60);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:–-]+$/, '');
}

function readListingObject(record: Record<string, unknown>): ClaudeListing | null {
  if (!('description' in record || 'sale_title' in record)) return null;
  const description = (typeof record.description === 'string' ? record.description : '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const bullets = Array.isArray(record.bullets) ? record.bullets.map(asText).filter(Boolean) : [];
  return {
    saleTitle: asText(record.sale_title).slice(0, 200),
    description: description.slice(0, 12000),
    bullets: bullets.slice(0, 5).map(fitBullet),
  };
}

const KEEP_TAGS: Record<string, string> = {
  p: 'p',
  br: 'br',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  h1: 'h3',
  h2: 'h3',
  h3: 'h3',
  h4: 'h4',
  h5: 'h4',
  h6: 'h4',
  blockquote: 'blockquote',
  table: 'table',
  thead: 'thead',
  tbody: 'tbody',
  tr: 'tr',
  th: 'th',
  td: 'td',
};
const DROP_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'button',
  'img',
  'meta',
  'link',
]);

// Rebuild pasted HTML with only plain formatting tags and no attributes, so Claude's
// colors and fonts don't come along — only bold, lists, headings, paragraphs and tables.
function cleanPastedHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = (node as Element).tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return '';
  const inner = Array.from(node.childNodes).map(cleanPastedHtml).join('');
  const keep = KEEP_TAGS[tag];
  if (keep === 'br') return '<br>';
  if (keep) return `<${keep}>${inner}</${keep}>`;
  if (tag !== 'div' && tag !== 'section' && tag !== 'article') return inner;
  // A wrapper div holding block content stays unwrapped; one holding loose text is a paragraph.
  return /<(?:p|ul|ol|h3|h4|table|blockquote)>/.test(inner) || !inner.trim()
    ? inner
    : `<p>${inner}</p>`;
}

// Read what was pasted from Claude desktop: the JSON block plus the rest of the reply. Rich
// text (HTML) is kept for AI Analysis, minus the JSON block; plain text falls back to the
// markdown reader.
function parsePaste<T>(
  html: string,
  plainText: string,
  read: RecordReader<T>,
): { analysisHtml: string; value: T } {
  if (/<(pre|code)\b/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = Array.from(doc.body.querySelectorAll('pre, code')).filter(
      (element) => element.tagName === 'PRE' || !element.closest('pre'),
    );
    for (let index = blocks.length - 1; index >= 0; index--) {
      const raw = parseJsonObject(blocks[index].textContent || '');
      const value = raw ? read(raw) : null;
      if (!value) continue;
      // Remove the code block along with its wrapper (Claude adds a "json" label and copy button).
      let removable: Element = blocks[index];
      while (
        removable.parentElement &&
        removable.parentElement !== doc.body &&
        (removable.parentElement.textContent || '').length - (removable.textContent || '').length <
          40
      ) {
        removable = removable.parentElement;
      }
      removable.remove();
      const analysisHtml = Array.from(doc.body.childNodes)
        .map(cleanPastedHtml)
        .join('')
        .replace(/<p>\s*(?:<br>\s*)*<\/p>/g, '')
        .trim();
      return { analysisHtml, value };
    }
  }
  const { rest, value } = findJsonInReply(plainText, read);
  return { analysisHtml: claudeMarkdownToHtml(rest), value };
}

export function parseClaudeDesktopPaste(
  html: string,
  plainText: string,
): { analysisHtml: string; fields: ClaudeDesktopFields } {
  const { analysisHtml, value } = parsePaste(html, plainText, readFieldObject);
  return { analysisHtml, fields: value };
}

// Read the reply to buildClaudeItemPrompt: the item fields, plus the listing when one was asked for.
export function parseClaudeItemPaste(
  html: string,
  plainText: string,
  wantListing: boolean,
): { analysisHtml: string; fields: ClaudeDesktopFields; listing: ClaudeListing | null } {
  const { analysisHtml, value } = parsePaste(html, plainText, (record) => {
    const fields = readFieldObject(record);
    const listing = wantListing ? readListingObject(record) : null;
    if (!fields || (wantListing && !listing)) return null;
    return { fields, listing };
  });
  if (value.listing && !value.listing.saleTitle && !value.listing.description) {
    throw new Error("The listing in Claude's reply is empty.");
  }
  return { analysisHtml, ...value };
}

// Read an evaluation saved by the CCG Eval connector (save_inventory_evaluation): its fields and
// listing are stored in the same shape as the paste flow's JSON block, so they go through the
// same readers (number parsing, bullet trimming) and the result fills the form the same way.
export function readClaudeConnectorResult(
  fieldsRaw: unknown,
  listingRaw: unknown,
): { fields: ClaudeDesktopFields; listing: ClaudeListing | null } {
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const fields = readFieldObject({ title: '', ...asRecord(fieldsRaw) }) as ClaudeDesktopFields;
  const listingRecord = asRecord(listingRaw);
  const listing = Object.keys(listingRecord).length ? readListingObject(listingRecord) : null;
  return {
    fields,
    listing: listing && (listing.saleTitle || listing.description) ? listing : null,
  };
}

// Plain-text version of the AI Analysis HTML, for including it in a prompt.
export function analysisHtmlToText(html: string): string {
  if (!html.trim()) return '';
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|h\d|li|div|tr|blockquote|ul|ol)>/gi, '\n');
  const doc = new DOMParser().parseFromString(`<html><body>${marked}</body></html>`, 'text/html');
  return (doc.body.textContent || '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Copy text to the clipboard; returns an error message, or null on success. The async
// clipboard API can refuse (e.g. "Document is not focused"), so fall back to a hidden
// textarea + execCommand, placed inside `container` (the dialog) so the dialog's focus trap
// doesn't pull focus away before the copy.
export async function copyTextToClipboard(
  text: string,
  container: HTMLElement,
): Promise<string | null> {
  try {
    await navigator.clipboard.writeText(text);
    return null;
  } catch (clipboardError) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    container.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (copied) return null;
    const reason =
      clipboardError instanceof Error ? clipboardError.message : String(clipboardError);
    return `Unable to copy the prompt to the clipboard (${reason}). Click the button again.`;
  }
}

// Rich-text box Claude desktop replies are pasted into.
export const claudePasteBoxSx = {
  minHeight: 160,
  maxHeight: 360,
  overflowY: 'auto',
  width: 1,
  borderRadius: 1.5,
  p: 1.5,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.default',
  color: 'text.primary',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  '&:focus': { outline: 'none', borderColor: 'primary.main' },
  '& p, & ul, & ol, & pre, & h1, & h2, & h3, & h4': { mt: 0, mb: 1 },
  '& pre': { whiteSpace: 'pre-wrap' },
  '&[contenteditable="true"]:empty:before': {
    content: '"Paste Claude\'s whole reply here (rich text is kept)"',
    color: 'text.disabled',
  },
} as const;
