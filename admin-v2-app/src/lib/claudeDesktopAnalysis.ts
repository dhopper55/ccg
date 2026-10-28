// Helpers for the inventory item's Claude desktop flows ("Refresh AI Analysis From Pics" and
// "Re-Eval and Build Listing"), which run in Claude desktop (covered by the subscription)
// instead of the paid API: build the prompt to paste there, then read Claude's reply back
// into the form from the JSON block at the end of it.

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

// How every prompt here should value an item: like Guitar Center would price it (store
// open-box/used prices, normal negotiating room), not as a private sale, and with no tax,
// fee or shipping adjustments.
const SHOP_PRICING_RULE = [
  'How to price for my shop (this applies to the private party value and the quick flip buy price):',
  '- Price it like Guitar Center would. I am a retail music shop in the Denver area, not a private seller: buyers can come in, see the item and try it before they buy, just like at Guitar Center, so my price should match what Guitar Center (or Sam Ash / Sweetwater) charges for the same item in the same condition.',
  '- When I say "private party value in Denver metro", I mean the price I should list it at in my shop: the Guitar Center-style price.',
  "- New or sealed items: price like a store open-box item, just under new retail/MAP. Used items: price like Guitar Center's used price for that item and condition. Reverb and marketplace sold prices are a floor, not the target.",
  '- Negotiation works like it does at Guitar Center: I negotiate and so do they. List at the store price with the normal $20–$50 of room to come down on most items; do not pre-discount to a private-sale price.',
  '- Do not factor in sales tax, marketplace fees or shipping.',
  '- For a project item (needs repair, incomplete, disassembled), estimate the working store price, then discount fairly for the work and risk.',
  '- Quick flip buy price: no more than 70% of that shop price (a 30% margin), with no tax or fee adjustments.',
].join('\n');

export function buildClaudeDesktopPrompt(
  title: string,
  notes: string,
  categoryLines: string[],
  merchantCodes: string[],
): string {
  const titleLine = title
    ? `The listing title is "${title}".`
    : 'There is no listing title yet — identify the item from the pictures.';
  return [
    `${titleLine} Do your own evaluation on this item based on the pictures. Give me a concise readout of the following: Reverb sold range, realistic private party value in Denver metro, quick flip buy price (for 30% margin or more), and lastly, is this gear desirable - meaning do listings for this sit for a long time and are there a lot of them, or are they more rare and desirable?`,
    ...(notes.trim() ? ['', `Additional details: ${notes.trim()}`] : []),
    '',
    SHOP_PRICING_RULE,
    '',
    'At the very end of your reply, add a ```json code block in exactly this shape, for my inventory system. This block is just bookkeeping: fill it from what you already found for the readout and do not do any extra research or searches for it. Use "" for anything you can\'t determine. model must not repeat the brand. serial_number only if it is legible in the photos. year_range: do not research the year — only if you found a serial number, try one quick decode (at most one lookup); if that does not settle it, leave it "". private_party_value is a whole-dollar number (0 if unknown).',
    '```json',
    '{"title":"","brand":"","model":"","finish":"","year_range":"","serial_number":"","category":"","merchant_center_category":"","private_party_value":0}',
    '```',
    `category: copy one line exactly from this list: ${categoryLines.join('; ')}`,
    `merchant_center_category: one of: ${merchantCodes.join(', ')}`,
  ].join('\n');
}

export type ClaudeListing = {
  saleTitle: string;
  description: string;
  bullets: string[];
};

const EVAL_QUESTIONS =
  'Reverb sold range, realistic private party value in Denver metro, quick flip buy price (for 30% margin or more), and lastly, is this gear desirable - meaning do listings for this sit for a long time and are there a lot of them, or are they more rare and desirable?';

export function buildClaudeListingPrompt(
  title: string,
  notes: string,
  previousAnalysis: string,
): string {
  const titleLine = title
    ? `The item title is "${title}".`
    : 'There is no item title yet — identify the item from the pictures.';
  const evalStep = previousAnalysis
    ? `1. Re-evaluate the item. My previous analysis (from earlier, rougher photos) is below — use it as your starting point and only research again where the new photos change the picture (condition, details, authenticity, value). Give me a concise readout: ${EVAL_QUESTIONS} Note what changed from the previous analysis.`
    : `1. Evaluate the item (there is no previous analysis, so do a full evaluation). Give me a concise readout: ${EVAL_QUESTIONS}`;
  return [
    `${titleLine} I've taken new, high-quality listing photos of it (attached). Please do two things:`,
    '',
    evalStep,
    '',
    '2. Build a listing for the item:',
    '- Do NOT mention price.',
    '- Do NOT mention my shop, shipping, local pickup, payment or trying it out — that is added separately. The listing is only about the item itself.',
    '- Target Facebook Marketplace for length and tone.',
    '- sale_title: a concise product title, no price, under 80 characters.',
    '- description: plain text, at least a couple of paragraphs about the item (what it is, features, sound/use, and condition from the photos and my notes), followed by a bulleted spec list if you have the specs. Separate paragraphs with a blank line and start each spec line with "• ". No markdown (no **, # or tables). A few emoji are fine but optional.',
    '- bullets: exactly 5 short selling points, each under 60 characters, separate from the description.',
    ...(notes.trim() ? ['', `Additional details: ${notes.trim()}`] : []),
    '',
    SHOP_PRICING_RULE,
    '',
    'Write the evaluation in your reply as normal, but put the listing ONLY in the JSON block — do not also write it out. At the very end of your reply, add a ```json code block in exactly this shape (use \\n for line breaks inside strings):',
    '```json',
    '{"sale_title":"","description":"","bullets":["","","","",""]}',
    '```',
    ...(previousAnalysis ? ['', 'Previous analysis:', previousAnalysis] : []),
  ].join('\n');
}

// Prompt for evaluating a marketplace listing on the listing evaluator page. The asking
// price is deliberately left out (it is only there if the seller wrote it in the text).
export function buildClaudeListingEvalPrompt(options: {
  title: string;
  description: string;
  notes: string;
  deep: boolean;
  isMulti: boolean;
}): string {
  const { title, description, notes, deep, isMulti } = options;
  const titleLine = title
    ? `The listing title is "${title}".`
    : 'There is no listing title — identify the item from the pictures.';
  return [
    titleLine,
    ...(description.trim()
      ? [
          '',
          "Seller's listing description (these are the seller's claims — check them against the photos):",
          '"""',
          description.trim().slice(0, 4000),
          '"""',
        ]
      : []),
    '',
    `Do your own evaluation on this item based on the pictures. Give me a concise readout of the following: ${EVAL_QUESTIONS}`,
    ...(isMulti
      ? [
          '',
          'This listing has multiple items — cover each item briefly, then give totals for the whole lot.',
        ]
      : []),
    ...(notes.trim() ? ['', `Additional details: ${notes.trim()}`] : []),
    '',
    deep
      ? 'Take a deeper look at this one: take more time, check comps thoroughly, and look closely at authenticity, condition and anything in the photos that changes the value.'
      : 'Keep this quick: a few comps is enough — do not grind on research.',
    '',
    SHOP_PRICING_RULE,
    '',
    'At the very end of your reply, add a ```json code block in exactly this shape. This block is just bookkeeping: fill it from what you already found and do not do any extra research for it. Use "" for anything you can\'t determine. model must not repeat the brand. year: only if you found a serial number, try one quick decode; otherwise leave it "".',
    '```json',
    '{"brand":"","model":"","year":""}',
    '```',
  ].join('\n');
}

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1');
}

// Convert the markdown Claude desktop copies into the simple HTML the AI Analysis box uses.
export function claudeMarkdownToHtml(markdown: string): string {
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.join('<br>')}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  const openList = (type: 'ul' | 'ol') => {
    flushParagraph();
    if (list !== type) {
      closeList();
      html.push(`<${type}>`);
      list = type;
    }
  };

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line) || /^\|?\s*:?-{2,}/.test(line)) {
      flushParagraph();
      closeList();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const tag = heading[1].length <= 2 ? 'h3' : 'h4';
      html.push(`<${tag}>${inlineMarkdown(heading[2])}</${tag}>`);
      return;
    }
    const bullet = line.match(/^(?:[-*+•])\s+(.*)$/);
    if (bullet) {
      openList('ul');
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      return;
    }
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      openList('ol');
      html.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      return;
    }
    closeList();
    if (line.startsWith('|')) {
      const cells = line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => inlineMarkdown(cell.trim()));
      paragraph.push(cells.join(' — '));
      return;
    }
    paragraph.push(inlineMarkdown(line));
  });
  flushParagraph();
  closeList();
  return html.join('');
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

export function parseClaudeListingPaste(html: string, plainText: string): ClaudeListing {
  const listing = parsePaste(html, plainText, readListingObject).value;
  if (!listing.saleTitle && !listing.description) {
    throw new Error("The listing in Claude's reply is empty.");
  }
  return listing;
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
