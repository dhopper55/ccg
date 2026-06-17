import type { Env } from '../env.js';
import type { InventoryLabelPdfRow, PdfImageAsset, PdfPageDefinition } from './types.js';
import { fetchPdfImageAsset } from './images.js';
import { buildPdfImageObject } from './images.js';
import {
  PDF_LABELS_PER_PAGE,
  PDF_UNIQUE_LABEL_ITEMS_PER_PAGE,
  PDF_LETTER_WIDTH,
  PDF_LETTER_HEIGHT,
  PDF_LABEL_WIDTH,
  PDF_LABEL_HEIGHT,
  PDF_LABEL_COLUMNS,
  PDF_LABEL_MARGIN_X,
  PDF_LABEL_MARGIN_Y,
  PDF_LABEL_PITCH_X,
  PDF_LABEL_PITCH_Y,
  PDF_LABEL_CONTENT_GLOBAL_Y_OFFSET,
  PDF_LABEL_CONTENT_ROW_DRIFT_COMPENSATION,
  PDF_LABEL_CONTENT_ROW_FINE_TUNE,
  PDF_LABEL_IMAGE_ROW_FINE_TUNE,
  PDF_LABEL_LEFT_IMAGE_WIDTH,
  PDF_LABEL_IMAGE_PADDING_X,
  PDF_LABEL_IMAGE_PADDING_Y,
  PDF_LABEL_TEXT_GAP,
  PDF_LABEL_RIGHT_PADDING,
  PDF_LABEL_TOP_PADDING,
  PDF_LABEL_TITLE_SECOND_LINE_BASELINE,
  PDF_LABEL_TITLE_MAX_BOX_HEIGHT,
  PDF_MONO_WIDTH_EM,
  assemblePdf,
  concatenatePdfParts,
  escapePdfString,
  formatPdfNumber,
  estimateMonospaceTextWidth,
  chunkArray,
} from './utils.js';
import { normalizePdfText, layoutPdfProportionalText } from './text-layout.js';

function stripCcgPrefix(value: string): string {
  return value.replace(/^CCG-/i, '').trim();
}

export async function buildInventoryLabelsPdf(rows: InventoryLabelPdfRow[], env: Env): Promise<Uint8Array> {
  const pages = chunkArray(rows, PDF_UNIQUE_LABEL_ITEMS_PER_PAGE).map((pageRows) =>
    pageRows.flatMap((row) => [row, row]),
  );
  const pageDefinitions: PdfPageDefinition[] = [];
  let nextObjectNumber = 6;

  for (const pageRows of pages) {
    const images: PdfPageDefinition['images'] = [];
    for (let index = 0; index < pageRows.length; index += 1) {
      const asset = await fetchPdfImageAsset(pageRows[index].imageUrl, env);
      if (!asset) continue;
      images.push({
        name: `Im${index + 1}`,
        objectNumber: nextObjectNumber,
        asset,
      });
      nextObjectNumber += 1;
    }

    pageDefinitions.push({
      pageObjectNumber: nextObjectNumber,
      contentObjectNumber: nextObjectNumber + 1,
      images,
      rows: pageRows,
    });
    nextObjectNumber += 2;
  }

  const objectMap = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  objectMap.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objectMap.set(
    2,
    encoder.encode(
      `<< /Type /Pages /Count ${pageDefinitions.length} /Kids [${pageDefinitions.map((page) => `${page.pageObjectNumber} 0 R`).join(' ')}] >>`,
    ),
  );
  objectMap.set(3, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'));
  objectMap.set(4, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'));
  objectMap.set(5, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const page of pageDefinitions) {
    for (const image of page.images) {
      objectMap.set(image.objectNumber, buildPdfImageObject(image.asset));
    }

    const contentBytes = encoder.encode(buildInventoryLabelsPageContent(page.rows, page.images));
    const xObjectSection = page.images.length
      ? ` /XObject << ${page.images.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ')} >>`
      : '';

    objectMap.set(
      page.pageObjectNumber,
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LETTER_WIDTH} ${PDF_LETTER_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjectSection} >> /Contents ${page.contentObjectNumber} 0 R >>`,
      ),
    );
    objectMap.set(
      page.contentObjectNumber,
      concatenatePdfParts([
        encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  const totalObjects = Math.max(...objectMap.keys());
  const objects: Uint8Array[] = [];
  for (let index = 1; index <= totalObjects; index += 1) {
    const objectBytes = objectMap.get(index);
    if (!objectBytes) {
      throw new Error(`Missing PDF object ${index}`);
    }
    objects.push(objectBytes);
  }

  return assemblePdf(objects);
}

export async function buildInventoryLabelsPdfPositioned(slots: Array<InventoryLabelPdfRow | null>, env: Env): Promise<Uint8Array> {
  // Single page with 10 slots; null slots are blank
  const pageDefinitions: PdfPageDefinition[] = [];
  let nextObjectNumber = 6;

  const images: PdfPageDefinition['images'] = [];
  const pageRows: InventoryLabelPdfRow[] = [];

  for (let index = 0; index < PDF_LABELS_PER_PAGE; index++) {
    const slot = index < slots.length ? slots[index] : null;
    // Always push a row (blank or real) to maintain position alignment
    pageRows.push(slot ?? { ccgNumber: '', title: '', imageUrl: '' });
    if (slot && slot.imageUrl) {
      const asset = await fetchPdfImageAsset(slot.imageUrl, env);
      if (asset) {
        images.push({
          name: `Im${index + 1}`,
          objectNumber: nextObjectNumber,
          asset,
        });
        nextObjectNumber += 1;
      }
    }
  }

  pageDefinitions.push({
    pageObjectNumber: nextObjectNumber,
    contentObjectNumber: nextObjectNumber + 1,
    images,
    rows: pageRows,
  });
  nextObjectNumber += 2;

  const objectMap = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  objectMap.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objectMap.set(
    2,
    encoder.encode(
      `<< /Type /Pages /Count ${pageDefinitions.length} /Kids [${pageDefinitions.map((page) => `${page.pageObjectNumber} 0 R`).join(' ')}] >>`,
    ),
  );
  objectMap.set(3, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'));
  objectMap.set(4, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'));
  objectMap.set(5, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const page of pageDefinitions) {
    for (const image of page.images) {
      objectMap.set(image.objectNumber, buildPdfImageObject(image.asset));
    }

    const contentBytes = encoder.encode(buildInventoryLabelsPageContent(page.rows, page.images));
    const xObjectSection = page.images.length
      ? ` /XObject << ${page.images.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ')} >>`
      : '';

    objectMap.set(
      page.pageObjectNumber,
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LETTER_WIDTH} ${PDF_LETTER_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjectSection} >> /Contents ${page.contentObjectNumber} 0 R >>`,
      ),
    );
    objectMap.set(
      page.contentObjectNumber,
      concatenatePdfParts([
        encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  const totalObjects = Math.max(...objectMap.keys());
  const objects: Uint8Array[] = [];
  for (let index = 1; index <= totalObjects; index += 1) {
    const objectBytes = objectMap.get(index);
    if (!objectBytes) {
      throw new Error(`Missing PDF object ${index}`);
    }
    objects.push(objectBytes);
  }

  return assemblePdf(objects);
}

export async function buildInventoryLabelsPdfFromExpanded(rows: InventoryLabelPdfRow[], env: Env): Promise<Uint8Array> {
  const pages = chunkArray(rows, PDF_LABELS_PER_PAGE);
  const pageDefinitions: PdfPageDefinition[] = [];
  let nextObjectNumber = 6;

  for (const pageRows of pages) {
    const images: PdfPageDefinition['images'] = [];
    for (let index = 0; index < pageRows.length; index += 1) {
      const asset = await fetchPdfImageAsset(pageRows[index].imageUrl, env);
      if (!asset) continue;
      images.push({
        name: `Im${index + 1}`,
        objectNumber: nextObjectNumber,
        asset,
      });
      nextObjectNumber += 1;
    }

    pageDefinitions.push({
      pageObjectNumber: nextObjectNumber,
      contentObjectNumber: nextObjectNumber + 1,
      images,
      rows: pageRows,
    });
    nextObjectNumber += 2;
  }

  const objectMap = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  objectMap.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objectMap.set(
    2,
    encoder.encode(
      `<< /Type /Pages /Count ${pageDefinitions.length} /Kids [${pageDefinitions.map((page) => `${page.pageObjectNumber} 0 R`).join(' ')}] >>`,
    ),
  );
  objectMap.set(3, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'));
  objectMap.set(4, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'));
  objectMap.set(5, encoder.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const page of pageDefinitions) {
    for (const image of page.images) {
      objectMap.set(image.objectNumber, buildPdfImageObject(image.asset));
    }

    const contentBytes = encoder.encode(buildInventoryLabelsPageContent(page.rows, page.images));
    const xObjectSection = page.images.length
      ? ` /XObject << ${page.images.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ')} >>`
      : '';

    objectMap.set(
      page.pageObjectNumber,
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LETTER_WIDTH} ${PDF_LETTER_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjectSection} >> /Contents ${page.contentObjectNumber} 0 R >>`,
      ),
    );
    objectMap.set(
      page.contentObjectNumber,
      concatenatePdfParts([
        encoder.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  const totalObjects = Math.max(...objectMap.keys());
  const objects: Uint8Array[] = [];
  for (let index = 1; index <= totalObjects; index += 1) {
    const objectBytes = objectMap.get(index);
    if (!objectBytes) {
      throw new Error(`Missing PDF object ${index}`);
    }
    objects.push(objectBytes);
  }

  return assemblePdf(objects);
}

export function buildInventoryLabelsPageContent(
  rows: InventoryLabelPdfRow[],
  images: Array<{ name: string; objectNumber: number; asset: PdfImageAsset }>,
): string {
  const commands: string[] = ['0 0 0 RG', '0 0 0 rg', '1 J', '1 j'];
  const imageByName = new Map(images.map((image) => [image.name, image]));

  rows.forEach((row, index) => {
    // Skip blank slots (positioned mode empty positions)
    if (!row.ccgNumber) return;

    const col = index % PDF_LABEL_COLUMNS;
    const rowIndex = Math.floor(index / PDF_LABEL_COLUMNS);
    const left = PDF_LABEL_MARGIN_X + col * PDF_LABEL_PITCH_X;
    const bottom =
      PDF_LETTER_HEIGHT - PDF_LABEL_MARGIN_Y - PDF_LABEL_HEIGHT - rowIndex * PDF_LABEL_PITCH_Y;
    const contentBottom =
      bottom +
      PDF_LABEL_CONTENT_GLOBAL_Y_OFFSET +
      rowIndex * PDF_LABEL_CONTENT_ROW_DRIFT_COMPENSATION +
      (PDF_LABEL_CONTENT_ROW_FINE_TUNE[rowIndex] ?? 0);
    const imageBottom = contentBottom + (PDF_LABEL_IMAGE_ROW_FINE_TUNE[rowIndex] ?? 0);
    const imageName = `Im${index + 1}`;

    if (imageByName.has(imageName)) {
      commands.push(renderLabelImage(left, imageBottom, imageName, imageByName.get(imageName)!.asset));
    }
    commands.push(renderLabelCcgNumber(left, contentBottom, row.ccgNumber));
    commands.push(renderLabelTitle(left, contentBottom, row.title));
  });

  return commands.filter(Boolean).join('\n');
}

export function renderLabelImage(left: number, bottom: number, imageName: string, asset: PdfImageAsset): string {
  const availableWidth = PDF_LABEL_LEFT_IMAGE_WIDTH - PDF_LABEL_IMAGE_PADDING_X * 2;
  const availableHeight = PDF_LABEL_HEIGHT - PDF_LABEL_IMAGE_PADDING_Y * 2;
  const scale = Math.min(availableWidth / asset.width, availableHeight / asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  const x = left + PDF_LABEL_IMAGE_PADDING_X + (availableWidth - width) / 2;
  const y = bottom + PDF_LABEL_IMAGE_PADDING_Y + (availableHeight - height) / 2;
  return `q ${formatPdfNumber(width)} 0 0 ${formatPdfNumber(height)} ${formatPdfNumber(x)} ${formatPdfNumber(y)} cm /${imageName} Do Q`;
}

function renderLabelCcgNumber(left: number, bottom: number, ccgNumber: string): string {
  const sanitized = normalizePdfText(stripCcgPrefix(ccgNumber));
  const textStartX = left + PDF_LABEL_LEFT_IMAGE_WIDTH + PDF_LABEL_TEXT_GAP;
  const availableWidth = PDF_LABEL_WIDTH - PDF_LABEL_LEFT_IMAGE_WIDTH - PDF_LABEL_TEXT_GAP - PDF_LABEL_RIGHT_PADDING;
  const fontSizeFromWidth = availableWidth / Math.max(1, sanitized.length * PDF_MONO_WIDTH_EM);
  const fontSize = Math.max(22, Math.min(44, fontSizeFromWidth));
  const textWidth = estimateMonospaceTextWidth(sanitized, fontSize);
  const x = textStartX + (availableWidth - textWidth) / 2;
  const y = bottom + PDF_LABEL_HEIGHT - PDF_LABEL_TOP_PADDING - fontSize * 0.82;

  return renderPdfText('/F2', fontSize, x, y, sanitized);
}

function renderLabelTitle(left: number, bottom: number, title: string): string {
  const textLeft = left + PDF_LABEL_LEFT_IMAGE_WIDTH + PDF_LABEL_TEXT_GAP;
  const secondLineBaseline = bottom + PDF_LABEL_TITLE_SECOND_LINE_BASELINE;
  const availableWidth =
    PDF_LABEL_WIDTH - PDF_LABEL_LEFT_IMAGE_WIDTH - PDF_LABEL_TEXT_GAP - PDF_LABEL_RIGHT_PADDING;
  const titleLayout = layoutPdfProportionalText(title, availableWidth, PDF_LABEL_TITLE_MAX_BOX_HEIGHT, 2);

  return titleLayout.lines
    .map((line, index) =>
      renderPdfText(
        '/F3',
        titleLayout.fontSize,
        textLeft,
        secondLineBaseline + (1 - index) * titleLayout.lineHeight,
        line,
      ),
    )
    .join('\n');
}

function renderPdfText(fontName: string, fontSize: number, x: number, y: number, text: string): string {
  return `BT ${fontName} ${formatPdfNumber(fontSize)} Tf 1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(y)} Tm (${escapePdfString(text)}) Tj ET`;
}
