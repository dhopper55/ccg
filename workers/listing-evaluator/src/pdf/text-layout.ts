import {
  PDF_MONO_WIDTH_EM,
  estimateHelveticaTextWidth,
  fitTextToWidth,
  truncateToWidthWithEllipsis,
} from './utils.js';

export function normalizePdfText(value: string): string {
  return value
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2026', '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateWithEllipsis(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value.length >= 2 ? `${value.slice(0, Math.max(0, maxChars - 2))}..` : '.'.repeat(maxChars);
  }
  if (maxChars <= 2) return '.'.repeat(maxChars);
  return `${value.slice(0, maxChars - 2)}..`;
}

export function wrapPdfMonospaceText(
  value: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const sanitized = normalizePdfText(value || 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * PDF_MONO_WIDTH_EM)));
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let current = '';
  let truncated = false;

  wordLoop: for (const originalWord of words) {
    let word = originalWord;
    if (!word) continue;
    while (word) {
      if (!current) {
        if (word.length <= maxChars) {
          current = word;
          word = '';
          continue;
        }

        if (lines.length === maxLines - 1) {
          lines.push(truncateWithEllipsis(word, maxChars));
          truncated = true;
          break wordLoop;
        }

        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
        continue;
      }

      const candidate = `${current} ${word}`;
      if (candidate.length <= maxChars) {
        current = candidate;
        word = '';
        continue;
      }

      lines.push(current);
      current = '';
      if (lines.length === maxLines) {
        truncated = true;
        break wordLoop;
      }
    }
  }

  if (current) {
    if (lines.length < maxLines) {
      lines.push(current);
    } else {
      truncated = true;
    }
  }

  if (truncated && lines.length > 0 && !lines[lines.length - 1].endsWith('...')) {
    lines[lines.length - 1] = truncateWithEllipsis(lines[lines.length - 1], maxChars);
  }

  return lines.slice(0, maxLines);
}

export function layoutPdfMonospaceText(
  value: string,
  maxWidth: number,
  maxHeight: number,
  maxLines: number,
): { fontSize: number; lineHeight: number; lines: string[] } {
  for (let fontSize = 20; fontSize >= 13; fontSize -= 1) {
    const lineHeight = fontSize + 2;
    if (lineHeight * maxLines > maxHeight) continue;
    const lines = wrapPdfMonospaceText(value, fontSize, maxWidth, maxLines);
    if (lines.length <= maxLines) {
      return { fontSize, lineHeight, lines };
    }
  }

  return {
    fontSize: 13,
    lineHeight: 15,
    lines: wrapPdfMonospaceText(value, 13, maxWidth, maxLines),
  };
}

export function wrapPdfProportionalText(
  value: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const sanitized = normalizePdfText(value || 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let current = '';
  let truncated = false;

  for (const word of words) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (estimateHelveticaTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = '';
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    }

    if (estimateHelveticaTextWidth(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let remaining = word;
    while (remaining) {
      const chunk = fitTextToWidth(remaining, fontSize, maxWidth);
      if (!chunk) {
        truncated = true;
        remaining = '';
        break;
      }
      lines.push(chunk);
      remaining = remaining.slice(chunk.length);
      if (lines.length === maxLines) {
        truncated = remaining.length > 0;
        break;
      }
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current && lines.length >= maxLines) {
    truncated = true;
  }

  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = truncateToWidthWithEllipsis(lines[lines.length - 1], fontSize, maxWidth);
  }

  return lines.slice(0, maxLines);
}

export function layoutPdfProportionalText(
  value: string,
  maxWidth: number,
  maxHeight: number,
  maxLines: number,
): { fontSize: number; lineHeight: number; lines: string[] } {
  for (let fontSize = 20; fontSize >= 13; fontSize -= 1) {
    const lineHeight = fontSize + 2;
    if (lineHeight * maxLines > maxHeight) continue;
    const lines = wrapPdfProportionalText(value, fontSize, maxWidth, maxLines);
    if (lines.length <= maxLines) {
      return { fontSize, lineHeight, lines };
    }
  }

  return {
    fontSize: 13,
    lineHeight: 15,
    lines: wrapPdfProportionalText(value, 13, maxWidth, maxLines),
  };
}
