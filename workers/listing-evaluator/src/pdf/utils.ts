export const PDF_POINTS_PER_INCH = 72;
export const PDF_LETTER_WIDTH = 8.5 * PDF_POINTS_PER_INCH;
export const PDF_LETTER_HEIGHT = 11 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_WIDTH = 4 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_HEIGHT = 2 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_COLUMNS = 2;
export const PDF_LABEL_ROWS = 5;
export const PDF_LABELS_PER_PAGE = PDF_LABEL_COLUMNS * PDF_LABEL_ROWS;
export const PDF_UNIQUE_LABEL_ITEMS_PER_PAGE = PDF_LABEL_ROWS;
// Avery 5163: 10-up, 2" x 4" labels on US Letter.
export const PDF_LABEL_MARGIN_X = 0.1875 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_MARGIN_Y = 0.5 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_COLUMN_GAP = 0.125 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_ROW_GAP = 0;
export const PDF_LABEL_PITCH_X = PDF_LABEL_WIDTH + PDF_LABEL_COLUMN_GAP;
export const PDF_LABEL_PITCH_Y = PDF_LABEL_HEIGHT + PDF_LABEL_ROW_GAP;
// Keep internal content visually filled by scaling legacy 12-up spacing to the taller 2" label.
export const PDF_LABEL_BASE_HEIGHT = 1.75 * PDF_POINTS_PER_INCH;
export const PDF_LABEL_INTERNAL_SCALE = PDF_LABEL_HEIGHT / PDF_LABEL_BASE_HEIGHT;
export const PDF_MONO_WIDTH_EM = 0.6;
export const PDF_HELVETICA_DEFAULT_WIDTH_EM = 0.52;
export const PDF_LABEL_HORIZONTAL_PADDING = 10 * PDF_LABEL_INTERNAL_SCALE;
export const PDF_LABEL_TOP_PADDING = 10 * PDF_LABEL_INTERNAL_SCALE;
export const PDF_LABEL_BOTTOM_PADDING = 20 * PDF_LABEL_INTERNAL_SCALE;
export const PDF_LABEL_LEFT_IMAGE_WIDTH = PDF_LABEL_WIDTH * 0.25;
export const PDF_LABEL_IMAGE_PADDING_X = 6;
export const PDF_LABEL_IMAGE_PADDING_Y = 8 * PDF_LABEL_INTERNAL_SCALE;
export const PDF_LABEL_TEXT_GAP = 6;
export const PDF_LABEL_TITLE_FONT_SIZE = 16;
export const PDF_LABEL_TITLE_LINE_HEIGHT = 18;
export const PDF_LABEL_RIGHT_PADDING = 3;
export const PDF_LABEL_TITLE_SECOND_LINE_BASELINE = 22 * PDF_LABEL_INTERNAL_SCALE;
export const PDF_LABEL_TITLE_MAX_BOX_HEIGHT = 58 * PDF_LABEL_INTERNAL_SCALE;
// Printer/feed compensation:
// keep the top row where it is, and progressively nudge lower rows down to prevent upward drift.
export const PDF_LABEL_CONTENT_GLOBAL_Y_OFFSET = -1.5;
export const PDF_LABEL_CONTENT_ROW_DRIFT_COMPENSATION = -2;
export const PDF_LABEL_CONTENT_ROW_FINE_TUNE: readonly number[] = [0, 0, 0, -0.8, -2.2];
export const PDF_LABEL_IMAGE_ROW_FINE_TUNE: readonly number[] = [0, 0, 0, -1.2, -18];

export function escapePdfString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

export function formatPdfNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function fitTextToWidth(value: string, fontSize: number, maxWidth: number): string {
  let fitted = '';
  for (const char of value) {
    const candidate = `${fitted}${char}`;
    if (estimateHelveticaTextWidth(candidate, fontSize) > maxWidth) break;
    fitted = candidate;
  }
  return fitted;
}

export function truncateToWidthWithEllipsis(value: string, fontSize: number, maxWidth: number): string {
  const ellipsis = '..';
  if (estimateHelveticaTextWidth(value, fontSize) <= maxWidth) {
    if (estimateHelveticaTextWidth(`${value}${ellipsis}`, fontSize) <= maxWidth) {
      return `${value}${ellipsis}`;
    }
    return value;
  }

  let fitted = fitTextToWidth(value, fontSize, maxWidth);
  while (fitted && estimateHelveticaTextWidth(`${fitted}${ellipsis}`, fontSize) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return fitted ? `${fitted}${ellipsis}` : '.';
}

export function assemblePdf(objects: Uint8Array[]): Uint8Array {
  const encoder = new TextEncoder();
  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let length = header.length;

  objects.forEach((objectBytes, index) => {
    offsets.push(length);
    const prefix = encoder.encode(`${index + 1} 0 obj\n`);
    const suffix = encoder.encode('\nendobj\n');
    parts.push(prefix, objectBytes, suffix);
    length += prefix.length + objectBytes.length + suffix.length;
  });

  const xrefOffset = length;
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `);
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(encoder.encode(`${xrefLines.join('\n')}\n${trailer}`));

  return concatenatePdfParts(parts);
}

export function concatenatePdfParts(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    merged.set(part, offset);
    offset += part.length;
  });
  return merged;
}

export function estimateHelveticaTextWidth(value: string, fontSize: number): number {
  let emWidth = 0;
  for (const char of value) {
    if (char === ' ') {
      emWidth += 0.28;
      continue;
    }
    if (/[ilIjt'`!|:;.,()\[\]{}]/.test(char)) {
      emWidth += 0.28;
      continue;
    }
    if (/[fr]/.test(char)) {
      emWidth += 0.36;
      continue;
    }
    if (/[MW@#%&Q]/.test(char)) {
      emWidth += 0.9;
      continue;
    }
    if (/[A-Z]/.test(char)) {
      emWidth += 0.67;
      continue;
    }
    if (/[0-9]/.test(char)) {
      emWidth += 0.56;
      continue;
    }
    emWidth += PDF_HELVETICA_DEFAULT_WIDTH_EM;
  }
  return emWidth * fontSize;
}

export function estimateMonospaceTextWidth(value: string, fontSize: number): number {
  return value.length * fontSize * PDF_MONO_WIDTH_EM;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
