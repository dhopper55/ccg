import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import QRCode from 'qrcode';
import type { PDFDocument as PdfLibDocument, PDFForm, PDFFont } from 'pdf-lib';
import liberationSansBoldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type MarkedRecord = {
  id: string;
  ccgNumber: string;
  title: string;
  imageUrl?: string | null;
  saleTitle?: string;
  regularPrice?: number | string | null;
  salePrice?: number | string | null;
  saleUrl?: string;
  barcode?: string;
  categoryName?: string;
  categoryPath?: string;
};

type InventoryListResponse = {
  records: MarkedRecord[];
  total: number;
  message?: string;
};

type TagTextColor = 'black' | 'red' | 'blue';

const TAG_TEMPLATE_SMALL = '/templates/template_small_tag.pdf';
const SMALL_TAG_TITLE_MAX_WIDTH = 126;
const SMALL_TAG_TITLE_FONT_SIZE = 12;
const SHOP_ORIGIN = 'https://www.coalcreekguitars.com';
const SHOP_BASE_PATH = '/guitars-and-gear-for-sale';
const SMALL_TAG_QR_RECTS: Record<1 | 2, { x: number; y: number; size: number }> = {
  1: { x: 4, y: 92, size: 76 },
  2: { x: 4, y: 6, size: 76 },
};
const CODE_128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function parseTagPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTagPrice(value: number | null): string {
  if (value == null) return '';
  const cents = Math.round(value * 100);
  const hasCents = Math.abs(cents % 100) !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

function truncateToPdfWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  const normalized = text.trim();
  if (font.widthOfTextAtSize(normalized, fontSize) <= maxWidth) return normalized;

  let output = '';
  for (const char of normalized) {
    const next = `${output}${char}`;
    if (font.widthOfTextAtSize(`${next}...`, fontSize) > maxWidth) break;
    output = next;
  }
  return output.trimEnd() ? `${output.trimEnd()}...` : '';
}

function splitTextForPdfLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): { line1: string; line2: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let line1 = '';
  let index = 0;

  while (index < words.length) {
    const next = [line1, words[index]].filter(Boolean).join(' ');
    if (font.widthOfTextAtSize(next, fontSize) > maxWidth) break;
    line1 = next;
    index += 1;
  }

  if (!line1 && words[0]) {
    line1 = truncateToPdfWidth(words[0], font, fontSize, maxWidth);
    index = 1;
  }

  return {
    line1,
    line2: truncateToPdfWidth(words.slice(index).join(' '), font, fontSize, maxWidth),
  };
}

function colorDefaultAppearance(color: TagTextColor): string {
  if (color === 'red') return '1 0 0 rg';
  if (color === 'blue') return '0 0.001 0.998 rg';
  return '0 g';
}

function setPdfTextField(
  form: PDFForm,
  name: string,
  text: string,
  font: PDFFont,
  color: TagTextColor = 'black',
): boolean {
  try {
    const field = form.getTextField(name);
    field.setText(text);
    const defaultAppearance = field.acroField.getDefaultAppearance() || '';
    field.acroField.setDefaultAppearance(`${defaultAppearance}\n${colorDefaultAppearance(color)}`);
    field.updateAppearances(font);
    return true;
  } catch {
    return false;
  }
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load small tag font.');
  return response.arrayBuffer();
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Unable to render small tag PNG.'));
    }, 'image/png');
  });
}

async function renderPdfBytesToPng(pdfBytes: Uint8Array): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 8 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create small tag PNG canvas.');

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvasToPngBlob(canvas);
}

function slugifyShopCategory(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildShopProductUrl(record: MarkedRecord): string | null {
  const categorySlug = slugifyShopCategory(record.categoryName || record.categoryPath || '');
  const productSlug = (record.saleUrl || '').trim();
  if (!categorySlug || !productSlug) return null;
  return `${SHOP_ORIGIN}${SHOP_BASE_PATH}/${categorySlug}/${productSlug}`;
}

async function drawProductQrCode(
  pdfDoc: PdfLibDocument,
  productNumber: 1 | 2,
  url: string | null,
): Promise<void> {
  if (!url) return;

  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'Q',
    margin: 1,
    width: 512,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  const qrPngBytes = await fetch(qrDataUrl).then((response) => response.arrayBuffer());
  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const [{ rgb }] = await Promise.all([import('pdf-lib')]);
  const page = pdfDoc.getPages()[0];
  const rect = SMALL_TAG_QR_RECTS[productNumber];

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.size,
    height: rect.size,
    color: rgb(1, 1, 1),
  });
  page.drawImage(qrImage, {
    x: rect.x,
    y: rect.y,
    width: rect.size,
    height: rect.size,
  });
}

function getPdfFieldRectangle(
  form: PDFForm,
  name: string,
): { x: number; y: number; width: number; height: number } | null {
  try {
    const field = form.getTextField(name);
    return field.acroField.getWidgets()[0]?.getRectangle() ?? null;
  } catch {
    return null;
  }
}

function normalizeBarcodeValue(value: string | undefined): string | null {
  const digits = (value || '').replace(/\D/g, '');
  return /^\d{8,20}$/.test(digits) ? digits : null;
}

function encodeCode128B(value: string): number[] {
  const codes = [104, ...value.split('').map((char) => char.charCodeAt(0) - 32)];
  let checksum = codes[0];
  for (let index = 1; index < codes.length; index += 1) checksum += codes[index] * index;
  codes.push(checksum % 103, 106);
  return codes;
}

async function drawProductBarcode(
  pdfDoc: PdfLibDocument,
  pdfForm: PDFForm,
  record: MarkedRecord,
  productNumber: 1 | 2,
  font: PDFFont,
): Promise<void> {
  const fieldName = `Product${productNumber}BarCode`;
  setPdfTextField(pdfForm, fieldName, '', font);
  const barcode = normalizeBarcodeValue(record.barcode);
  if (!barcode) return;

  const rect = getPdfFieldRectangle(pdfForm, fieldName);
  if (!rect) return;

  const [{ rgb }] = await Promise.all([import('pdf-lib')]);
  const page = pdfDoc.getPages()[0];
  const codes = encodeCode128B(barcode);
  const quietZoneModules = 10;
  const moduleCount = codes.reduce(
    (sum, code) => sum + CODE_128_PATTERNS[code].split('').reduce((inner, width) => inner + Number(width), 0),
    0,
  );
  const moduleWidth = rect.width / (moduleCount + quietZoneModules * 2);

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(1, 1, 1),
  });
  let cursor = rect.x + quietZoneModules * moduleWidth;
  codes.forEach((code) => {
    CODE_128_PATTERNS[code].split('').forEach((widthText, index) => {
      const width = Number(widthText) * moduleWidth;
      if (index % 2 === 0) {
        page.drawRectangle({
          x: cursor,
          y: rect.y,
          width: Math.max(width * 1.02, width + 0.03),
          height: rect.height,
          color: rgb(0, 0, 0),
        });
      }
      cursor += width;
    });
  });
}

async function setSmallTagProductFields(
  pdfDoc: PdfLibDocument,
  pdfForm: PDFForm,
  record: MarkedRecord,
  productNumber: 1 | 2,
  boldFont: PDFFont,
  skipQr = false,
): Promise<void> {
  const title = splitTextForPdfLines(
    (record.saleTitle || record.title || '').trim(),
    boldFont,
    SMALL_TAG_TITLE_FONT_SIZE,
    SMALL_TAG_TITLE_MAX_WIDTH,
  );

  setPdfTextField(pdfForm, `Product${productNumber}Name1`, title.line1, boldFont);
  setPdfTextField(pdfForm, `Product${productNumber}Name2`, title.line2, boldFont);
  setPdfTextField(pdfForm, `Product${productNumber}CCGNum`, record.ccgNumber.trim(), boldFont);
  setPdfTextField(pdfForm, `Product${productNumber}RegPrice`, formatTagPrice(parseTagPrice(record.regularPrice)), boldFont);
  setPdfTextField(pdfForm, `Product${productNumber}SalePrice`, formatTagPrice(parseTagPrice(record.salePrice)), boldFont);
  if (!skipQr) await drawProductQrCode(pdfDoc, productNumber, buildShopProductUrl(record));
  await drawProductBarcode(pdfDoc, pdfForm, record, productNumber, boldFont);
}

async function buildSmallInventoryTagsPng(records: MarkedRecord[], skipQr = false): Promise<Blob> {
  const response = await fetch(TAG_TEMPLATE_SMALL);
  if (!response.ok) throw new Error('Unable to load small inventory tag template.');

  const [{ PDFDocument }, fontkitModule] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
  ]);
  const pdfDoc = await PDFDocument.load(await response.arrayBuffer());
  const loadedFontkit = 'default' in fontkitModule ? fontkitModule.default : fontkitModule;
  pdfDoc.registerFontkit(loadedFontkit);
  const pdfForm = pdfDoc.getForm();
  const boldFontBytes = await fetchArrayBuffer(liberationSansBoldUrl);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);

  if (records[0]) await setSmallTagProductFields(pdfDoc, pdfForm, records[0], 1, boldFont, skipQr);
  if (records[1]) await setSmallTagProductFields(pdfDoc, pdfForm, records[1], 2, boldFont, skipQr);

  const bytes = await pdfDoc.save();
  return renderPdfBytesToPng(bytes);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const InventoryLabels = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<MarkedRecord[]>([]);
  const [smallTagChecked, setSmallTagChecked] = useState<Record<string, boolean>>({});
  const [printCounts, setPrintCounts] = useState<Record<string, number>>({});
  const [firstPositions, setFirstPositions] = useState<Record<string, number>>({});
  const [secondPositions, setSecondPositions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingSmallTag, setIsPrintingSmallTag] = useState(false);
  const [isPrintingSmallTagNoQr, setIsPrintingSmallTagNoQr] = useState(false);
  const [isUnmarking, setIsUnmarking] = useState(false);
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Inventory Labels';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '200');
        params.set('sortBy', 'created_at');
        params.set('sortDir', 'asc');
        params.set('onlyMarked', '1');
        params.set('active', '1');

        const response = await fetch(`/api/inventory?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as InventoryListResponse;
        if (!response.ok) throw new Error(data.message || 'Unable to load marked items.');
        if (cancelled) return;

        const items = Array.isArray(data.records) ? data.records : [];
        setRecords(items);
        const defaults: Record<string, number> = {};
        const posDefaults: Record<string, number> = {};
        const checkedDefaults: Record<string, boolean> = {};
        for (const item of items) {
          defaults[item.id] = 1;
          posDefaults[item.id] = 0;
          checkedDefaults[item.id] = true;
        }
        setPrintCounts(defaults);
        setFirstPositions(posDefaults);
        setSecondPositions({ ...posDefaults });
        setSmallTagChecked(checkedDefaults);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load marked items.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const handleCountChange = useCallback((id: string, count: number) => {
    setPrintCounts((prev) => ({ ...prev, [id]: count }));
  }, []);

  const totalLabels = useMemo(
    () => records.reduce((sum, r) => sum + (printCounts[r.id] || 1), 0),
    [records, printCounts],
  );
  const smallTagSelectedRecords = useMemo(
    () => records.filter((r) => smallTagChecked[r.id]),
    [records, smallTagChecked],
  );
  const canPrintSmallTag = smallTagSelectedRecords.length === 2;

  const handleUnmarkAll = async () => {
    setIsUnmarking(true);
    try {
      await fetch('/api/admin-v2/inventory/unmark-all', {
        method: 'POST',
        credentials: 'same-origin',
      });
      navigate(paths.inventoryManager);
    } catch {
      setErrorMessage('Unable to unmark items.');
    } finally {
      setIsUnmarking(false);
      setUnmarkConfirmOpen(false);
    }
  };

  const handlePrint = async () => {
    setErrorMessage('');

    // Collect all active position values
    const allPositions: number[] = [];
    let anyNonAuto = false;
    let anyAuto = false;

    for (const r of records) {
      const count = printCounts[r.id] || 1;
      const pos1 = firstPositions[r.id] ?? 0;
      if (pos1 === 0) anyAuto = true; else { anyNonAuto = true; allPositions.push(pos1); }
      if (count >= 2) {
        const pos2 = secondPositions[r.id] ?? 0;
        if (pos2 === 0) anyAuto = true; else { anyNonAuto = true; allPositions.push(pos2); }
      }
    }

    // Rule 1: mixed auto and non-auto
    if (anyAuto && anyNonAuto) {
      setErrorMessage('Position fields must ALL be auto, or none.');
      return;
    }

    // Rule 2: non-auto mode with more than 10 labels
    if (anyNonAuto && totalLabels > 10) {
      setErrorMessage('Position mode can only work when there are 10 or less labels.');
      return;
    }

    // Rule 3: all positions must be distinct
    if (anyNonAuto) {
      const seen = new Set<number>();
      for (const pos of allPositions) {
        if (seen.has(pos)) {
          setErrorMessage('All position values must be distinct — no duplicates allowed.');
          return;
        }
        seen.add(pos);
      }
    }

    setIsPrinting(true);

    const items = records.map((r) => {
      const count = printCounts[r.id] || 1;
      const pos1 = firstPositions[r.id] ?? 0;
      const pos2 = count >= 2 ? (secondPositions[r.id] ?? 0) : undefined;
      return {
        id: r.id,
        count,
        ...(anyNonAuto ? { position1: pos1, position2: pos2 } : {}),
      };
    });

    try {
      const response = await fetch('/api/admin-v2/inventory/labels.pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        let message = 'Unable to generate labels PDF.';
        try {
          const data = (await response.json()) as { message?: string };
          if (data?.message) message = data.message;
        } catch { /* fallback */ }
        throw new Error(message);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const match = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] || 'ccg-labels.pdf';
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      navigate(paths.inventoryManager);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate labels PDF.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintSmallTag = async () => {
    if (!canPrintSmallTag || isPrintingSmallTag) return;
    setErrorMessage('');
    setIsPrintingSmallTag(true);

    try {
      const blob = await buildSmallInventoryTagsPng(smallTagSelectedRecords.slice(0, 2));
      const suffix = smallTagSelectedRecords.map((record) => record.ccgNumber.trim()).filter(Boolean).join('-') || 'inventory';
      downloadBlob(blob, `${suffix}-small-tag.png`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate small tag PNG.');
    } finally {
      setIsPrintingSmallTag(false);
    }
  };

  const handlePrintSmallTagNoQr = async () => {
    if (!canPrintSmallTag || isPrintingSmallTagNoQr) return;
    setErrorMessage('');
    setIsPrintingSmallTagNoQr(true);

    try {
      const blob = await buildSmallInventoryTagsPng(smallTagSelectedRecords.slice(0, 2), true);
      const suffix = smallTagSelectedRecords.map((record) => record.ccgNumber.trim()).filter(Boolean).join('-') || 'inventory';
      downloadBlob(blob, `${suffix}-small-tag-noqr.png`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate small tag PNG.');
    } finally {
      setIsPrintingSmallTagNoQr(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h4">Inventory Labels</Typography>
          </Paper>
        </Grid>

        <Grid size={12}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>
          )}

          {isLoading ? (
            <Stack sx={{ alignItems: 'center', py: 8 }}>
              <CircularProgress />
            </Stack>
          ) : records.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                No marked inventory items found. Mark items in Inventory Manager first.
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              {/* Header */}
              <Stack
                direction="row"
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: 'background.elevation1',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" sx={{ width: 140, flexShrink: 0, fontWeight: 'bold' }}>
                  CCG #
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 'bold' }}>
                  Title
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 90, textAlign: 'center', fontWeight: 'bold' }}>
                  # to Print
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 90, textAlign: 'center', fontWeight: 'bold' }}>
                  1st Position
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 90, textAlign: 'center', fontWeight: 'bold' }}>
                  2nd Position
                </Typography>
              </Stack>

              {/* Rows */}
              {records.map((record) => (
                <Stack
                  key={record.id}
                  direction="row"
                  sx={{
                    px: 2,
                    py: 1,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Stack direction="row" sx={{ width: 140, flexShrink: 0, alignItems: 'center', gap: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={Boolean(smallTagChecked[record.id])}
                      onChange={(e) => setSmallTagChecked((prev) => ({ ...prev, [record.id]: e.target.checked }))}
                      sx={{ p: 0.25 }}
                    />
                    <Typography variant="body2">
                      {record.ccgNumber}
                    </Typography>
                  </Stack>
                  <Stack direction="row" sx={{ flex: 1, alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    {record.imageUrl ? (
                      <Box
                        component="img"
                        src={record.imageUrl}
                        alt={record.title}
                        sx={{
                          width: 40,
                          height: 40,
                          objectFit: 'cover',
                          borderRadius: 1,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {record.title}
                    </Typography>
                  </Stack>
                  <Box sx={{ width: 90, display: 'flex', justifyContent: 'center' }}>
                    <Select
                      size="small"
                      value={printCounts[record.id] || 1}
                      onChange={(e) => handleCountChange(record.id, Number(e.target.value))}
                      sx={{ minWidth: 60 }}
                    >
                      <MenuItem value={1}>1</MenuItem>
                      <MenuItem value={2}>2</MenuItem>
                    </Select>
                  </Box>
                  <Box sx={{ width: 90, display: 'flex', justifyContent: 'center' }}>
                    <Select
                      size="small"
                      value={firstPositions[record.id] ?? 0}
                      onChange={(e) => setFirstPositions((prev) => ({ ...prev, [record.id]: Number(e.target.value) }))}
                      sx={{ minWidth: 60 }}
                    >
                      <MenuItem value={0}>Auto</MenuItem>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <MenuItem key={n} value={n}>{n}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                  <Box sx={{ width: 90, display: 'flex', justifyContent: 'center' }}>
                    {(printCounts[record.id] || 1) >= 2 ? (
                      <Select
                        size="small"
                        value={secondPositions[record.id] ?? 0}
                        onChange={(e) => setSecondPositions((prev) => ({ ...prev, [record.id]: Number(e.target.value) }))}
                        sx={{ minWidth: 60 }}
                      >
                        <MenuItem value={0}>Auto</MenuItem>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <MenuItem key={n} value={n}>{n}</MenuItem>
                        ))}
                      </Select>
                    ) : null}
                  </Box>
                </Stack>
              ))}

              {/* Footer */}
              <Stack
                direction="row"
                sx={{
                  px: 2,
                  py: 2,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {records.length} item{records.length !== 1 ? 's' : ''} · {totalLabels} label{totalLabels !== 1 ? 's' : ''} · {Math.ceil(totalLabels / 10)} page{Math.ceil(totalLabels / 10) !== 1 ? 's' : ''}
                </Typography>
                <Stack direction="row" sx={{ gap: 1.5 }}>
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => setUnmarkConfirmOpen(true)}
                    disabled={isUnmarking || isPrinting || isPrintingSmallTag || isPrintingSmallTagNoQr || records.length === 0}
                    startIcon={
                      isUnmarking ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <IconifyIcon icon="material-symbols:bookmark-remove-outline-rounded" />
                      )
                    }
                  >
                    {isUnmarking ? 'Unmarking…' : 'Unmark All'}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handlePrint}
                    disabled={isPrinting || isUnmarking || isPrintingSmallTag || isPrintingSmallTagNoQr || records.length === 0}
                    startIcon={
                      isPrinting ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <IconifyIcon icon="material-symbols:print-outline-rounded" />
                      )
                    }
                  >
                    {isPrinting ? 'Generating…' : 'Print Labels'}
                  </Button>
                  {canPrintSmallTag ? (
                    <>
                      <Button
                        variant="contained"
                        onClick={handlePrintSmallTag}
                        disabled={isPrintingSmallTag || isPrintingSmallTagNoQr || isPrinting || isUnmarking}
                        startIcon={
                          isPrintingSmallTag ? (
                            <CircularProgress color="inherit" size={16} />
                          ) : (
                            <IconifyIcon icon="material-symbols:label-outline-rounded" />
                          )
                        }
                      >
                        {isPrintingSmallTag ? 'Generating…' : 'Print Small Tag'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handlePrintSmallTagNoQr}
                        disabled={isPrintingSmallTagNoQr || isPrintingSmallTag || isPrinting || isUnmarking}
                        startIcon={
                          isPrintingSmallTagNoQr ? (
                            <CircularProgress color="inherit" size={16} />
                          ) : (
                            <IconifyIcon icon="material-symbols:label-off-outline-rounded" />
                          )
                        }
                      >
                        {isPrintingSmallTagNoQr ? 'Generating…' : 'Print Small Tag (no QR)'}
                      </Button>
                    </>
                  ) : null}
                </Stack>
                <Dialog open={unmarkConfirmOpen} onClose={() => setUnmarkConfirmOpen(false)}>
                  <DialogTitle>Unmark all items</DialogTitle>
                  <DialogContent>
                    <DialogContentText>
                      This will unmark all {records.length} item{records.length !== 1 ? 's' : ''} and return to Inventory Manager.
                    </DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setUnmarkConfirmOpen(false)} disabled={isUnmarking}>Cancel</Button>
                    <Button onClick={handleUnmarkAll} color="warning" variant="contained" disabled={isUnmarking}>
                      {isUnmarking ? 'Unmarking…' : 'Unmark All'}
                    </Button>
                  </DialogActions>
                </Dialog>
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default InventoryLabels;
