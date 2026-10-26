// Helpers for the inventory item's "AI Analysis From Pics" flow, which runs the analysis in
// Claude desktop (covered by the subscription) instead of the paid API: build the prompt to
// paste there, then read Claude's reply back into the form.

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
    'For the private party value: my Denver shop is pickup-only and the price is out-the-door (tax included, buyers can play it before buying). Price at the top of a reasonable range, leaving $20–$50 of room to negotiate.',
    '',
    'At the very end of your reply, add a ```json code block in exactly this shape, for my inventory system. This block is just bookkeeping: fill it from what you already found for the readout and do not do any extra research or searches for it. Use "" for anything you can\'t determine. model must not repeat the brand. serial_number only if it is legible in the photos. year_range: don't research the year — only if you found a serial number, try one quick decode (at most one lookup); if that doesn't settle it, leave it "". private_party_value is a whole-dollar number (0 if unknown).',
    '```json',
    '{"title":"","brand":"","model":"","finish":"","year_range":"","serial_number":"","category":"","merchant_center_category":"","private_party_value":0}',
    '```',
    `category: copy one line exactly from this list: ${categoryLines.join('; ')}`,
    `merchant_center_category: one of: ${merchantCodes.join(', ')}`,
  ].join('\n');
}

const FIELD_BLOCK_PATTERN = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

// Pull the last JSON field block out of Claude's reply; the rest of the reply is the analysis.
export function parseClaudeDesktopReply(reply: string): {
  analysisMarkdown: string;
  fields: ClaudeDesktopFields;
} {
  const matches = [...reply.matchAll(FIELD_BLOCK_PATTERN)];
  const last = matches[matches.length - 1];
  if (!last || last.index == null) {
    throw new Error(
      "Couldn't find the ```json field block at the end of Claude's reply. Make sure you copied the whole reply.",
    );
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(last[1]) as Record<string, unknown>;
  } catch {
    throw new Error("The field block in Claude's reply isn't valid JSON.");
  }
  const value = Number(String(raw.private_party_value ?? '').replace(/[$,\s]/g, ''));
  return {
    analysisMarkdown: (
      reply.slice(0, last.index) + reply.slice(last.index + last[0].length)
    ).trim(),
    fields: {
      title: asText(raw.title),
      brand: asText(raw.brand),
      model: asText(raw.model),
      finish: asText(raw.finish),
      yearRange: asText(raw.year_range),
      serialNumber: asText(raw.serial_number),
      category: asText(raw.category),
      merchantCenterCatCode: asText(raw.merchant_center_category).toUpperCase(),
      privatePartyValue: Number.isFinite(value) && value > 0 ? Math.round(value) : null,
    },
  };
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

function parseFieldObject(jsonText: string): ClaudeDesktopFields | null {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText.trim().replace(/^json\s*/i, ''));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || !('brand' in raw || 'title' in raw)) return null;
  const record = raw as Record<string, unknown>;
  const value = Number(String(record.private_party_value ?? '').replace(/[$,\s]/g, ''));
  return {
    title: asText(record.title),
    brand: asText(record.brand),
    model: asText(record.model),
    finish: asText(record.finish),
    yearRange: asText(record.year_range),
    serialNumber: asText(record.serial_number),
    category: asText(record.category),
    merchantCenterCatCode: asText(record.merchant_center_category).toUpperCase(),
    privatePartyValue: Number.isFinite(value) && value > 0 ? Math.round(value) : null,
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

// Read what was pasted from Claude desktop. Rich text (HTML) is kept as-is for AI Analysis,
// minus the JSON field block; plain text falls back to the markdown reader.
export function parseClaudeDesktopPaste(
  html: string,
  plainText: string,
): { analysisHtml: string; fields: ClaudeDesktopFields } {
  if (/<(pre|code)\b/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = Array.from(doc.body.querySelectorAll('pre, code')).filter(
      (element) => element.tagName === 'PRE' || !element.closest('pre'),
    );
    for (let index = blocks.length - 1; index >= 0; index--) {
      const fields = parseFieldObject(blocks[index].textContent || '');
      if (!fields) continue;
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
      return { analysisHtml, fields };
    }
  }
  const { analysisMarkdown, fields } = parseClaudeDesktopReply(plainText);
  return { analysisHtml: claudeMarkdownToHtml(analysisMarkdown), fields };
}
