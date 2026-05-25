import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import QRCode from 'qrcode';
import type { PDFDocument as PdfLibDocument, PDFForm, PDFFont } from 'pdf-lib';
import liberationSansBoldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import liberationSansRegularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type InventoryItemRecord = {
  id: string;
  sourceListingId?: string | null;
  ccgNumber: string;
  imageUrl: string;
  imageUrls?: string[];
  images?: InventoryImageRecord[];
  videoUrl?: string;
  saleTitle?: string;
  regularPrice?: number | null;
  salePrice?: number | null;
  condition?: string;
  saleDescription?: string;
  clearance?: boolean;
  bullet1Text?: string;
  bullet1Danger?: boolean;
  bullet1Highlight?: boolean;
  bullet2Text?: string;
  bullet2Danger?: boolean;
  bullet2Highlight?: boolean;
  bullet3Text?: string;
  bullet3Danger?: boolean;
  bullet3Highlight?: boolean;
  bullet4Text?: string;
  bullet4Danger?: boolean;
  bullet4Highlight?: boolean;
  bullet5Text?: string;
  bullet5Danger?: boolean;
  bullet5Highlight?: boolean;
  bullet6Text?: string;
  bullet6Danger?: boolean;
  bullet6Highlight?: boolean;
  barcode?: string;
  title: string;
  categoryId?: number | null;
  categoryName?: string;
  categoryPath?: string;
  secondaryCategoryId?: number | null;
  secondaryCategoryName?: string;
  secondaryCategoryPath?: string;
  brand?: string;
  queue?: string;
  yearRange?: string;
  model?: string;
  finish?: string;
  repairNotes?: string;
  originalListingDesc?: string;
  purchasedDate?: string;
  quantity?: number | null;
  unitPurchasePrice?: number | null;
  mapPrice?: number | null;
  privatePartyValue?: number | null;
  miles?: number | null;
  minutesSpent?: number | null;
  shipCost?: number | null;
  purchaseNotes?: string;
  aiAnalysisText?: string;
  serialNumber?: string;
  weightLbs?: string;
  neckProfile?: string;
  neckThickness?: string;
  nutWidth?: string;
  width12Fret?: string;
  fretboardRadius?: string;
  twelveFretAction?: string;
  isActive?: boolean;
  isMarked?: boolean;
  isPersonal?: boolean;
  isRented?: boolean;
  isCustom?: boolean;
  forSale?: boolean;
  onlyInStore?: boolean;
  salesChannelCcg?: boolean;
  salesChannelFbm?: boolean;
  salesChannelCl?: boolean;
  salesChannelReverb?: boolean;
  salesChannelGearExchange?: boolean;
  salesChannelOfferUp?: boolean;
  salesChannelEbay?: boolean;
  salesChannelNextdoor?: boolean;
  salesChannelOther?: boolean;
  forSaleDate?: string | null;
  isSold?: boolean;
  qtySold?: number | null;
  soldDate?: string | null;
  soldAmount?: number | null;
  sellNotes?: string;
};

type InventoryRecordResponse = {
  record?: InventoryItemRecord;
  message?: string;
};

type ListingRecordResponse = {
  id: string;
  fields?: {
    title?: string;
    category?: string;
    brand?: string;
    year?: string;
    model?: string;
    finish?: string;
    description?: string;
    ai_analysis_text?: string;
    image_url?: string;
    photos?: string;
  };
  message?: string;
};

type SaveResponse = {
  ok?: boolean;
  ccgNumber?: string;
  message?: string;
  duplicateSuppressed?: boolean;
};

type UpcLookupResponse = {
  found?: boolean;
  barcode?: string;
  source?: string;
  title?: string;
  description?: string;
  features?: string[];
  attributes?: Record<string, string>;
  images?: string[];
  item_no?: string | null;
  brand_desc?: string | null;
  brand?: string | null;
  map?: string | null;
  msrp?: string | null;
  dealer_cost?: string | null;
  clean_title?: string;
  clean_description?: string;
  clean_bullets?: string[];
  message?: string;
  raw?: unknown;
};

type NextCcgNumberResponse = {
  ccgNumber?: string;
  message?: string;
};

type FormState = {
  ccgNumber: string;
  quantity: number;
  videoUrl: string;
  saleTitle: string;
  regularPrice: string;
  salePrice: string;
  condition: string;
  saleDescription: string;
  clearance: boolean;
  bullet1Text: string;
  bullet1Danger: boolean;
  bullet1Highlight: boolean;
  bullet2Text: string;
  bullet2Danger: boolean;
  bullet2Highlight: boolean;
  bullet3Text: string;
  bullet3Danger: boolean;
  bullet3Highlight: boolean;
  bullet4Text: string;
  bullet4Danger: boolean;
  bullet4Highlight: boolean;
  bullet5Text: string;
  bullet5Danger: boolean;
  bullet5Highlight: boolean;
  bullet6Text: string;
  bullet6Danger: boolean;
  bullet6Highlight: boolean;
  barcode: string;
  title: string;
  categoryId: string;
  secondaryCategoryId: string;
  brand: string;
  queue: string;
  yearRange: string;
  model: string;
  finish: string;
  repairNotes: string;
  originalListingDesc: string;
  purchasedDate: string;
  unitPurchasePrice: string;
  mapPrice: string;
  privatePartyValue: string;
  miles: string;
  minutesSpent: string;
  shipCost: string;
  purchaseNotes: string;
  aiAnalysisText: string;
  serialNumber: string;
  weightLbs: string;
  neckProfile: string;
  neckThickness: string;
  nutWidth: string;
  width12Fret: string;
  fretboardRadius: string;
  twelveFretAction: string;
  isActive: boolean;
  isMarked: boolean;
  isPersonal: boolean;
  isRented: boolean;
  isCustom: boolean;
  forSale: boolean;
  onlyInStore: boolean;
  salesChannelCcg: boolean;
  salesChannelFbm: boolean;
  salesChannelCl: boolean;
  salesChannelReverb: boolean;
  salesChannelGearExchange: boolean;
  salesChannelOfferUp: boolean;
  salesChannelEbay: boolean;
  salesChannelNextdoor: boolean;
  salesChannelOther: boolean;
  isSold: boolean;
  qtySold: number;
  soldAmount: string;
  sellNotes: string;
  subscriptionId: string;
  saleUrl: string;
  saleZip: string;
  storageLocation: string;
  soldChannel: string;
};

const INVENTORY_MAX_IMAGES = 20;
const GUITAR_CATEGORY_NAMES = new Set([
  'Acoustic Bass',
  'Acoustic Guitars',
  'Electric Bass',
  'Electric Guitars',
]);

const SALE_CONDITION_OPTIONS = [
  '',
  'New',
  'Used - Like New',
  'Used - Good',
  'Used - Fair',
];

const INVENTORY_QUEUE_OPTIONS = [
  'Triage',
  'Repair',
  'To Sell',
  'For Sale',
  'Sold',
  'Rented',
  'Parking Lot',
] as const;

type InventoryCategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: InventoryCategoryNode[];
};

type InventoryCategoriesResponse = {
  tree?: InventoryCategoryNode[];
  message?: string;
};

type BarcodeFocusWindow = Window & {
  __ccgAdminBarcodeInputFocused?: boolean;
};

type InventoryCategoryOption = {
  id: string;
  name: string;
  parentId: number | null;
  label: string;
};

type InventoryImageRecord = {
  id?: string;
  url: string;
  isPrivate: boolean;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInventoryImageApiUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/inventory-image?${params.toString()}`;
}

function buildListingImageApiUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listing-image?${params.toString()}`;
}

function buildCustomImageApiUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listings/custom-image?${params.toString()}`;
}

function normalizeInventoryImageDisplayUrl(value: string): string {
  const raw = value.trim();
  if (!raw || raw.startsWith('/api/') || raw.startsWith('/cdn-cgi/image/') || /^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith('inventory-items/')) return buildInventoryImageApiUrl(raw);
  if (raw.startsWith('listing-images/')) return buildListingImageApiUrl(raw);
  if (raw.startsWith('custom-items/')) return buildCustomImageApiUrl(raw);
  return raw;
}

function normalizeImages(images: InventoryImageRecord[]): InventoryImageRecord[] {
  const seen = new Set<string>();
  const normalized = images
    .map((image) => ({
      id: image.id,
      url: typeof image.url === 'string' ? normalizeInventoryImageDisplayUrl(image.url) : '',
      isPrivate: Boolean(image.isPrivate),
    }))
    .filter((image) => image.url)
    .filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    })
    .slice(0, INVENTORY_MAX_IMAGES);

  if (normalized.length > 0) {
    normalized[0] = { ...normalized[0], isPrivate: false };
  }

  return normalized;
}

function getSavableCcgNumber(value: string): string {
  const normalized = value.trim().toUpperCase();
  return /^CCG-\d{6}$/.test(normalized) ? normalized : '';
}

function createDuplicateSaleUrlSlug(value: string): string {
  const slug = sanitizeSaleUrlSlug(value);
  if (!slug) return '';
  const match = slug.match(/^(.*?)-(\d+)$/);
  if (match) {
    return `${match[1]}-${Number(match[2]) + 1}`;
  }
  return `${slug}-2`;
}

const DEFAULT_FORM: FormState = {
  ccgNumber: 'Auto-generated on save',
  quantity: 1,
  videoUrl: '',
  saleTitle: '',
  regularPrice: '',
  salePrice: '0',
  condition: '',
  saleDescription: '',
  clearance: false,
  bullet1Text: '',
  bullet1Danger: false,
  bullet1Highlight: false,
  bullet2Text: '',
  bullet2Danger: false,
  bullet2Highlight: false,
  bullet3Text: '',
  bullet3Danger: false,
  bullet3Highlight: false,
  bullet4Text: '',
  bullet4Danger: false,
  bullet4Highlight: false,
  bullet5Text: '',
  bullet5Danger: false,
  bullet5Highlight: false,
  bullet6Text: '',
  bullet6Danger: false,
  bullet6Highlight: false,
  barcode: '',
  title: '',
  categoryId: '',
  secondaryCategoryId: '',
  brand: '',
  queue: 'Triage',
  yearRange: '',
  model: '',
  finish: '',
  repairNotes: '',
  originalListingDesc: '',
  purchasedDate: todayYmd(),
  unitPurchasePrice: '',
  mapPrice: '',
  privatePartyValue: '0',
  miles: '0',
  minutesSpent: '0',
  shipCost: '0',
  purchaseNotes: '',
  aiAnalysisText: '',
  serialNumber: '',
  weightLbs: '',
  neckProfile: '',
  neckThickness: '',
  nutWidth: '',
  width12Fret: '',
  fretboardRadius: '',
  twelveFretAction: '',
  isActive: true,
  isMarked: false,
  isPersonal: false,
  isRented: false,
  isCustom: false,
  forSale: false,
  onlyInStore: false,
  salesChannelCcg: false,
  salesChannelFbm: false,
  salesChannelCl: false,
  salesChannelReverb: false,
  salesChannelGearExchange: false,
  salesChannelOfferUp: false,
  salesChannelEbay: false,
  salesChannelNextdoor: false,
  salesChannelOther: false,
  isSold: false,
  qtySold: 1,
  soldAmount: '',
  sellNotes: '',
  subscriptionId: '',
  saleUrl: '',
  saleZip: '80113',
  storageLocation: '',
  soldChannel: '',
};

const notesFieldSx = {
  '& .MuiInputBase-root.MuiInputBase-multiline': {
    pt: 2.25,
    pb: 1.25,
  },
  '& .MuiInputBase-inputMultiline': {
    lineHeight: 1.5,
  },
};

function buildHtmlPreviewNode(html: string, emptyLabel: string, onClick: () => void) {
  const trimmed = html.trim();
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="Open AI Analysis editor"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        width: 1,
        minHeight: 120,
        maxHeight: 120,
        overflow: 'hidden',
        borderRadius: 3,
        p: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
        color: trimmed ? 'text.primary' : 'text.disabled',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
        },
        '&:focus-visible': {
          outline: 'none',
          borderColor: 'primary.main',
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
        },
        '& p, & ul, & ol, & blockquote, & h3, & h4': {
          mt: 0,
          mb: 1,
        },
        '& ul, & ol': {
          pl: 2.5,
        },
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        AI Analysis (click to view/edit)
      </Typography>
      {trimmed ? (
        <Box
          sx={{
            color: 'text.primary',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: trimmed }}
        />
      ) : (
        <Typography variant="body2" sx={{ color: 'text.disabled', lineHeight: 1.6 }}>
          {emptyLabel}
        </Typography>
      )}
    </Box>
  );
}

type TagTextColor = 'black' | 'red' | 'blue';

const TAG_TEMPLATE_NO_SALE = '/templates/ccg_label_large_no_sale.pdf';
const TAG_TEMPLATE_ON_SALE = '/templates/ccg_label_large_on_sale.pdf';
const GUITAR_LISTING_TEMPLATE_URL = '/templates/guitar-listing-template.txt';
const GUITAR_PACKAGE_TEMPLATE_URL = '/templates/guitar-package-template.txt';
const TAG_TITLE_MAX_WIDTH = 292;
const TAG_TITLE_FONT_SIZE = 14;
const SHOP_ORIGIN = 'https://www.coalcreekguitars.com';
const SHOP_BASE_PATH = '/guitars-and-gear-for-sale';
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

function getBarcodeValidationError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Barcode is required.';
  if (!/^\d+$/.test(trimmed)) return 'Barcode must be numeric only.';
  if (trimmed.length < 8 || trimmed.length > 20) return 'Barcode must be 8 to 20 digits.';
  return null;
}

function parseTagPrice(value: string): number | null {
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function slugifyShopCategory(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildShopProductUrl(categoryName: string, saleUrlSlug: string): string | null {
  const categorySlug = slugifyShopCategory(categoryName);
  const productSlug = saleUrlSlug.trim();
  if (!categorySlug || !productSlug) return null;
  return `${SHOP_ORIGIN}${SHOP_BASE_PATH}/${categorySlug}/${productSlug}`;
}

function sanitizeSaleUrlSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateSaleUrlSlugFromTitle(value: string): string {
  return sanitizeSaleUrlSlug(value);
}

function getForSaleValidationError(formState: FormState): string | null {
  if (!formState.forSale) return null;
  if (!formState.saleTitle.trim()) return 'Sale Details Title is required when For Sale is checked.';
  if ((parseTagPrice(formState.salePrice) ?? 0) <= 0) {
    return 'Sale Details Sale Price is required when For Sale is checked.';
  }
  if ((parseTagPrice(formState.regularPrice) ?? 0) <= 0) {
    return 'Sale Details Regular Price is required when For Sale is checked.';
  }
  if (!formState.condition.trim()) return 'Sale Details Condition is required when For Sale is checked.';
  if (!formState.saleDescription.trim()) {
    return 'Sale Details Description is required when For Sale is checked.';
  }
  const hasSaleBullet = [
    formState.bullet1Text,
    formState.bullet2Text,
    formState.bullet3Text,
    formState.bullet4Text,
    formState.bullet5Text,
    formState.bullet6Text,
  ].some((bulletText) => bulletText.trim());
  if (!hasSaleBullet) return 'At least one Sale Details bullet is required when For Sale is checked.';
  if (!formState.saleUrl.trim()) return 'Sale URL Slug is required when For Sale is checked.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formState.saleUrl.trim())) {
    return 'Sale URL Slug can only use lowercase letters, numbers, and hyphens.';
  }
  if (!formState.saleZip.trim()) return 'Sale Details ZIP is required when For Sale is checked.';
  return null;
}

function formatTagPrice(value: number | null): string {
  if (value == null) return '';
  return `$${Math.round(value).toLocaleString()}`;
}

function replaceTemplatePrice(template: string, value: string): string {
  const price = parseTagPrice(value);
  if (price == null) return template.replaceAll('$<PRICE>', '').replaceAll('<PRICE>', '');

  const numberText = Math.round(price).toLocaleString();
  return template
    .replaceAll('$<PRICE>', `$${numberText}`)
    .replaceAll('<PRICE>', `$${numberText}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeBrandFromModel(title: string, brand: string): string {
  const normalizedTitle = title.trim();
  const normalizedBrand = brand.trim();
  if (!normalizedTitle || !normalizedBrand) return normalizedTitle;
  return normalizedTitle
    .replace(new RegExp(`\\b${escapeRegExp(normalizedBrand)}\\b`, 'ig'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildUpcAttributeLines(data: UpcLookupResponse): string[] {
  const lines: string[] = [];
  const pushLine = (label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return;
    const line = `${label}: ${text}`;
    if (!lines.includes(line)) lines.push(line);
  };

  Object.entries(data.attributes || {}).forEach(([key, value]) => {
    if (!['color', 'weight', 'size'].includes(key.toLowerCase())) return;
    const label = key
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
    pushLine(label, value);
  });

  return lines;
}

function appendAttributeLines(description: string, attributeLines: string[]): string {
  const base = description.trim();
  if (attributeLines.length === 0) return base;
  return [base, ...attributeLines.map((line) => `- ${line}`)].filter(Boolean).join('\n');
}

function truncateBulletText(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57).trimEnd()}...`;
}

function parsePopulatedPrice(value: string | null | undefined): number | null {
  const parsed = parseTagPrice(value || '');
  return parsed != null && parsed > 0 ? parsed : null;
}

function replaceLinePlaceholder(template: string, placeholder: string, value: string): string {
  if (value.trim()) return template.replaceAll(placeholder, value);

  const linePattern = new RegExp(`^.*${escapeRegExp(placeholder)}.*(?:\\r?\\n|$)`, 'gm');
  return template.replace(linePattern, '');
}

function buildListingBulletText(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `• ${trimmed}` : '';
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

function splitTitleForTag(title: string, font: PDFFont): { title1: string; title2: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  let title1 = '';
  let index = 0;

  while (index < words.length) {
    const next = [title1, words[index]].filter(Boolean).join(' ');
    if (font.widthOfTextAtSize(next, TAG_TITLE_FONT_SIZE) > TAG_TITLE_MAX_WIDTH) break;
    title1 = next;
    index += 1;
  }

  if (!title1 && words[0]) {
    title1 = truncateToPdfWidth(words[0], font, TAG_TITLE_FONT_SIZE, TAG_TITLE_MAX_WIDTH);
    index = 1;
  }

  return {
    title1,
    title2: truncateToPdfWidth(words.slice(index).join(' '), font, TAG_TITLE_FONT_SIZE, TAG_TITLE_MAX_WIDTH),
  };
}

function bulletTextColor(danger: boolean, highlight: boolean): TagTextColor {
  if (danger && !highlight) return 'red';
  if (highlight && !danger) return 'blue';
  return 'black';
}

function hasAnySaleBulletText(formState: FormState): boolean {
  return [
    formState.bullet1Text,
    formState.bullet2Text,
    formState.bullet3Text,
    formState.bullet4Text,
    formState.bullet5Text,
    formState.bullet6Text,
  ].some((value) => value.trim());
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
  visible = true,
): boolean {
  try {
    const field = form.getTextField(name);
    field.setText(text);
    field.acroField.getWidgets().forEach((widget) => {
      widget.setFlagTo(2, !visible);
      widget.setFlagTo(4, visible);
    });
    const defaultAppearance = field.acroField.getDefaultAppearance() || '';
    field.acroField.setDefaultAppearance(`${defaultAppearance}\n${colorDefaultAppearance(color)}`);
    field.updateAppearances(font);
    return true;
  } catch {
    // The no-sale and on-sale templates intentionally do not have identical fields.
    return false;
  }
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load inventory tag font.');
  return response.arrayBuffer();
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

async function drawProductQrCode(
  pdfDoc: PdfLibDocument,
  pdfForm: PDFForm,
  productUrl: string | null,
): Promise<void> {
  const fieldName = 'ProductQRCode';
  const rect = getPdfFieldRectangle(pdfForm, fieldName);
  if (!rect) return;
  if (!productUrl) return;

  const qrDataUrl = await QRCode.toDataURL(productUrl, {
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
  const size = Math.min(rect.width, rect.height);
  const x = rect.x + (rect.width - size) / 2;
  const y = rect.y + (rect.height - size) / 2;

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(1, 1, 1),
  });
  page.drawImage(qrImage, { x, y, width: size, height: size });
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
  barcode: string,
): Promise<void> {
  const fieldName = 'ProductBarCode';
  const rect = getPdfFieldRectangle(pdfForm, fieldName);
  const normalizedBarcode = normalizeBarcodeValue(barcode);
  if (!rect || !normalizedBarcode) return;

  const [{ rgb }] = await Promise.all([import('pdf-lib')]);
  const page = pdfDoc.getPages()[0];
  const codes = encodeCode128B(normalizedBarcode);
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

async function buildInventoryTagPdf(formState: FormState, categoryName: string): Promise<Blob> {
  const salePrice = parseTagPrice(formState.salePrice);
  const regularPrice = parseTagPrice(formState.regularPrice);
  const isOnSale = salePrice != null && regularPrice != null && salePrice > 0 && regularPrice > salePrice;
  const templateUrl = isOnSale ? TAG_TEMPLATE_ON_SALE : TAG_TEMPLATE_NO_SALE;
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error('Unable to load inventory tag template.');

  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
  ]);
  const pdfDoc = await PDFDocument.load(await response.arrayBuffer());
  const loadedFontkit = 'default' in fontkitModule ? fontkitModule.default : fontkitModule;
  pdfDoc.registerFontkit(loadedFontkit);
  const pdfForm = pdfDoc.getForm();
  const [boldFontBytes, regularFontBytes] = await Promise.all([
    fetchArrayBuffer(liberationSansBoldUrl),
    fetchArrayBuffer(liberationSansRegularUrl),
  ]);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);
  const regularFont = await pdfDoc.embedFont(regularFontBytes);
  const title = splitTitleForTag(formState.saleTitle.trim() || formState.title.trim(), boldFont);
  const productUrl = buildShopProductUrl(categoryName, formState.saleUrl);
  const bullets = [
    [formState.bullet1Text, formState.bullet1Danger, formState.bullet1Highlight],
    [formState.bullet2Text, formState.bullet2Danger, formState.bullet2Highlight],
    [formState.bullet3Text, formState.bullet3Danger, formState.bullet3Highlight],
    [formState.bullet4Text, formState.bullet4Danger, formState.bullet4Highlight],
    [formState.bullet5Text, formState.bullet5Danger, formState.bullet5Highlight],
    [formState.bullet6Text, formState.bullet6Danger, formState.bullet6Highlight],
  ] as const;

  setPdfTextField(pdfForm, 'title_1', title.title1, boldFont);
  setPdfTextField(pdfForm, 'title_2', title.title2, boldFont);
  setPdfTextField(pdfForm, 'ccg_num', formState.ccgNumber.trim(), boldFont);
  setPdfTextField(pdfForm, 'sale_price', formatTagPrice(salePrice), boldFont);
  setPdfTextField(pdfForm, 'regular_price', formatTagPrice(regularPrice), regularFont);
  setPdfTextField(pdfForm, 'ProductQRCode', '', regularFont);
  setPdfTextField(pdfForm, 'ProductBarCode', '', regularFont);
  const clearanceFieldFilled = setPdfTextField(
    pdfForm,
    'txt_clearance',
    formState.clearance ? 'CLEARANCE' : '',
    boldFont,
    'red',
    formState.clearance,
  );
  if (formState.clearance && !clearanceFieldFilled) {
    pdfDoc.getPages()[0].drawText('CLEARANCE', {
      x: 162.692,
      y: 647.908,
      size: 14,
      font: boldFont,
      color: rgb(1, 0, 0),
    });
  }

  bullets.forEach(([text, danger, highlight], index) => {
    const trimmed = text.trim();
    setPdfTextField(
      pdfForm,
      `txt_bullet${index + 1}`,
      trimmed ? `● ${trimmed}` : '',
      boldFont,
      bulletTextColor(danger, highlight),
      Boolean(trimmed),
    );
  });

  await drawProductQrCode(pdfDoc, pdfForm, productUrl);
  await drawProductBarcode(pdfDoc, pdfForm, formState.barcode);

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
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

const InventoryItem = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const inventoryManagerHref = `${paths.inventoryManager}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saleUrlInputRef = useRef<HTMLInputElement | null>(null);
  const aiAnalysisEditorRef = useRef<HTMLDivElement | null>(null);
  const wasForSaleOnLoadRef = useRef(false);
  const saleTitleWasEmptyOnFocusRef = useRef(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saleUrlReadOnly, setSaleUrlReadOnly] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [sourceListingId, setSourceListingId] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [images, setImages] = useState<InventoryImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingTag, setIsGeneratingTag] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aiAnalysisDialogOpen, setAiAnalysisDialogOpen] = useState(false);
  const [aiAnalysisDraft, setAiAnalysisDraft] = useState('');
  const [profitTargetsOpen, setProfitTargetsOpen] = useState(false);
  const [wasSoldOnLoad, setWasSoldOnLoad] = useState(false);
  const [soldConfirmOpen, setSoldConfirmOpen] = useState(false);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [upcLookupOpen, setUpcLookupOpen] = useState(false);
  const [upcLookupBrand, setUpcLookupBrand] = useState('DUNLOP');
  const [isUpcSearching, setIsUpcSearching] = useState(false);
  const [upcLookupData, setUpcLookupData] = useState<UpcLookupResponse | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<InventoryCategoryOption[]>([]);
  const [subscriptionOptions, setSubscriptionOptions] = useState<Array<{ id: string; name: string }>>([]);

  const mode = editId ? 'edit' : 'add';
  const pageTitle = mode === 'edit' ? 'Edit Inventory Item' : 'Add Inventory Item';
  const submitLabel = mode === 'edit' ? 'Save Changes' : 'Add Inventory Item';

  useEffect(() => {
    document.title = `CCG Admin | ${pageTitle}`;
  }, [pageTitle]);

  useEffect(() => {
    if (!aiAnalysisDialogOpen || !aiAnalysisEditorRef.current) return;
    aiAnalysisEditorRef.current.innerHTML = aiAnalysisDraft || '';
  }, [aiAnalysisDialogOpen, aiAnalysisDraft]);

  const profitTargetRows = useMemo(() => {
    const paid = parseTagPrice(form.unitPurchasePrice);
    const margins = [0.2, 0.3, 0.35, 0.4];

    return margins.map((margin) => {
      const baseTarget = paid != null && paid > 0 ? paid / (1 - margin) : null;
      return {
        label: `${Math.round(margin * 100)}% profit margin`,
        value: baseTarget != null ? baseTarget * 1.03 : null,
      };
    });
  }, [form.unitPurchasePrice]);

  const setAiAnalysisEditorNode = useCallback((node: HTMLDivElement | null) => {
    aiAnalysisEditorRef.current = node;
    if (node) {
      node.innerHTML = aiAnalysisDraft || '';
    }
  }, [aiAnalysisDraft]);

  useEffect(() => {
    let cancelled = false;

    const flattenCategoryTree = (
      nodes: InventoryCategoryNode[],
      depth = 0,
    ): InventoryCategoryOption[] =>
      nodes.flatMap((node) => [
        {
          id: String(node.id),
          name: node.name,
          parentId: node.parentId,
          label: `${depth > 0 ? `${'---'.repeat(depth)} ` : ''}${node.name}`,
        },
        ...flattenCategoryTree(Array.isArray(node.children) ? node.children : [], depth + 1),
      ]);

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/admin-v2/inventory/categories', {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as InventoryCategoriesResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load inventory categories.');
        }
        if (cancelled) return;
        setCategoryOptions(flattenCategoryTree(Array.isArray(data.tree) ? data.tree : []));
      } catch (error) {
        if (cancelled) return;
        setMessage({
          severity: 'error',
          text: error instanceof Error ? error.message : 'Unable to load inventory categories.',
        });
      }
    };

    const loadSubscriptions = async () => {
      try {
        const response = await fetch('/api/admin-v2/inventory/subscriptions', {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as { records?: Array<{ id: number; name: string }> };
        if (!response.ok || cancelled) return;
        setSubscriptionOptions(
          (data.records ?? []).map((r) => ({ id: String(r.id), name: r.name })),
        );
      } catch { /* best effort */ }
    };

    void loadCategories();
    void loadSubscriptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = searchParams.get('id');
    const fromListingId = searchParams.get('fromListingId');
    const customTemplateBarcode = searchParams.get('customTemplateBarcode');

    const initialize = async () => {
      setIsLoading(true);
      setMessage(null);
      wasForSaleOnLoadRef.current = false;

      try {
        if (id) {
          const response = await fetch(`/api/inventory/${encodeURIComponent(id)}`, {
            method: 'GET',
            credentials: 'same-origin',
          });
          const data = (await response.json()) as InventoryRecordResponse;
          if (!response.ok || !data.record) {
            throw new Error(data.message || 'Unable to load inventory item.');
          }
          if (cancelled) return;

          const record = data.record;
          setEditId(record.id);
          setSourceListingId(record.sourceListingId || null);
          wasForSaleOnLoadRef.current = Boolean(record.forSale);
          setSaleUrlReadOnly(Boolean(record.saleUrl?.trim()));
          setForm({
            ccgNumber: record.ccgNumber || '',
            quantity: Math.max(0, Number(record.quantity ?? 1)),
            videoUrl: record.videoUrl || '',
            saleTitle: record.saleTitle || '',
            regularPrice: record.regularPrice != null ? String(record.regularPrice) : '',
            salePrice: record.salePrice != null ? String(record.salePrice) : '0',
            condition: record.condition || '',
            saleDescription: record.saleDescription || '',
            clearance: Boolean(record.clearance),
            bullet1Text: record.bullet1Text || '',
            bullet1Danger: Boolean(record.bullet1Danger),
            bullet1Highlight: Boolean(record.bullet1Highlight),
            bullet2Text: record.bullet2Text || '',
            bullet2Danger: Boolean(record.bullet2Danger),
            bullet2Highlight: Boolean(record.bullet2Highlight),
            bullet3Text: record.bullet3Text || '',
            bullet3Danger: Boolean(record.bullet3Danger),
            bullet3Highlight: Boolean(record.bullet3Highlight),
            bullet4Text: record.bullet4Text || '',
            bullet4Danger: Boolean(record.bullet4Danger),
            bullet4Highlight: Boolean(record.bullet4Highlight),
            bullet5Text: record.bullet5Text || '',
            bullet5Danger: Boolean(record.bullet5Danger),
            bullet5Highlight: Boolean(record.bullet5Highlight),
            bullet6Text: record.bullet6Text || '',
            bullet6Danger: Boolean(record.bullet6Danger),
            bullet6Highlight: Boolean(record.bullet6Highlight),
            barcode: record.barcode || '',
            title: record.title || '',
            categoryId: record.categoryId != null ? String(record.categoryId) : '',
            secondaryCategoryId:
              record.secondaryCategoryId != null ? String(record.secondaryCategoryId) : '',
            brand: record.brand || '',
            queue: record.queue || 'Triage',
            yearRange: record.yearRange || '',
            model: record.model || '',
            finish: record.finish || '',
            repairNotes: record.repairNotes || '',
            originalListingDesc: record.originalListingDesc || '',
            purchasedDate: record.purchasedDate || todayYmd(),
            unitPurchasePrice:
              record.unitPurchasePrice != null ? String(record.unitPurchasePrice) : '',
            mapPrice: record.mapPrice != null ? String(record.mapPrice) : '',
            privatePartyValue:
              record.privatePartyValue != null ? String(record.privatePartyValue) : '0',
            miles: record.miles != null ? String(record.miles) : '0',
            minutesSpent: record.minutesSpent != null ? String(record.minutesSpent) : '0',
            shipCost: record.shipCost != null ? String(record.shipCost) : '0',
            purchaseNotes: record.purchaseNotes || '',
            aiAnalysisText: record.aiAnalysisText || '',
            serialNumber: record.serialNumber || '',
            weightLbs: record.weightLbs || '',
            neckProfile: record.neckProfile || '',
            neckThickness: record.neckThickness || '',
            nutWidth: record.nutWidth || '',
            width12Fret: record.width12Fret || '',
            fretboardRadius: record.fretboardRadius || '',
            twelveFretAction: record.twelveFretAction || '',
            isActive: Boolean(record.isActive),
            isMarked: Boolean(record.isMarked),
            isPersonal: Boolean(record.isPersonal),
            isRented: Boolean(record.isRented),
            isCustom: Boolean(record.isCustom),
            forSale: Boolean(record.forSale),
            onlyInStore: Boolean(record.onlyInStore),
            salesChannelCcg: Boolean(record.salesChannelCcg),
            salesChannelFbm: Boolean(record.salesChannelFbm),
            salesChannelCl: Boolean(record.salesChannelCl),
            salesChannelReverb: Boolean(record.salesChannelReverb),
            salesChannelGearExchange: Boolean(record.salesChannelGearExchange),
            salesChannelOfferUp: Boolean(record.salesChannelOfferUp),
            salesChannelEbay: Boolean(record.salesChannelEbay),
            salesChannelNextdoor: Boolean(record.salesChannelNextdoor),
            salesChannelOther: Boolean(record.salesChannelOther),
            isSold: Boolean(record.isSold),
            qtySold: Math.max(1, Number(record.qtySold ?? (record.isSold ? record.quantity : 1) ?? 1)),
            soldAmount: record.soldAmount != null ? String(record.soldAmount) : '',
            sellNotes: record.sellNotes || '',
            subscriptionId: record.subscriptionId != null ? String(record.subscriptionId) : '',
            saleUrl: record.saleUrl || '',
            saleZip: record.saleZip || '',
            storageLocation: record.storageLocation || '',
            soldChannel: record.soldChannel || '',
          });
          setWasSoldOnLoad(Boolean(record.isSold));

          const existingImages = Array.isArray(record.images) && record.images.length
            ? record.images.map((image) => ({
              id: image.id,
              url: image.url,
              isPrivate: Boolean(image.isPrivate),
            }))
            : (
              Array.isArray(record.imageUrls) && record.imageUrls.length
                ? record.imageUrls
                : record.imageUrl
                  ? [record.imageUrl]
                  : []
            ).map((url) => ({ url, isPrivate: false }));
          setImages(normalizeImages(existingImages));
          return;
        }

        if (customTemplateBarcode) {
          const response = await fetch(
            `/api/admin-v2/inventory/custom-template?barcode=${encodeURIComponent(customTemplateBarcode)}`,
            {
              method: 'GET',
              credentials: 'same-origin',
            },
          );
          const data = (await response.json()) as InventoryRecordResponse;
          if (!response.ok || !data.record) {
            throw new Error(data.message || 'Unable to load custom product template.');
          }
          if (cancelled) return;

          const record = data.record;
          setEditId(null);
          setSourceListingId(null);
          wasForSaleOnLoadRef.current = false;
          setSaleUrlReadOnly(Boolean(record.saleUrl?.trim()));
          setForm({
            ccgNumber: DEFAULT_FORM.ccgNumber,
            quantity: Math.max(0, Number(record.quantity ?? 1)),
            videoUrl: record.videoUrl || '',
            saleTitle: record.saleTitle || '',
            regularPrice: record.regularPrice != null ? String(record.regularPrice) : '',
            salePrice: record.salePrice != null ? String(record.salePrice) : '0',
            condition: record.condition || '',
            saleDescription: record.saleDescription || '',
            clearance: Boolean(record.clearance),
            bullet1Text: record.bullet1Text || '',
            bullet1Danger: Boolean(record.bullet1Danger),
            bullet1Highlight: Boolean(record.bullet1Highlight),
            bullet2Text: record.bullet2Text || '',
            bullet2Danger: Boolean(record.bullet2Danger),
            bullet2Highlight: Boolean(record.bullet2Highlight),
            bullet3Text: record.bullet3Text || '',
            bullet3Danger: Boolean(record.bullet3Danger),
            bullet3Highlight: Boolean(record.bullet3Highlight),
            bullet4Text: record.bullet4Text || '',
            bullet4Danger: Boolean(record.bullet4Danger),
            bullet4Highlight: Boolean(record.bullet4Highlight),
            bullet5Text: record.bullet5Text || '',
            bullet5Danger: Boolean(record.bullet5Danger),
            bullet5Highlight: Boolean(record.bullet5Highlight),
            bullet6Text: record.bullet6Text || '',
            bullet6Danger: Boolean(record.bullet6Danger),
            bullet6Highlight: Boolean(record.bullet6Highlight),
            barcode: '',
            title: record.title || '',
            categoryId: record.categoryId != null ? String(record.categoryId) : '',
            secondaryCategoryId:
              record.secondaryCategoryId != null ? String(record.secondaryCategoryId) : '',
            brand: record.brand || '',
            queue: record.queue || 'Triage',
            yearRange: record.yearRange || '',
            model: record.model || '',
            finish: record.finish || '',
            repairNotes: record.repairNotes || '',
            originalListingDesc: record.originalListingDesc || '',
            purchasedDate: todayYmd(),
            unitPurchasePrice:
              record.unitPurchasePrice != null ? String(record.unitPurchasePrice) : '',
            mapPrice: record.mapPrice != null ? String(record.mapPrice) : '',
            privatePartyValue:
              record.privatePartyValue != null ? String(record.privatePartyValue) : '0',
            miles: record.miles != null ? String(record.miles) : '0',
            minutesSpent: record.minutesSpent != null ? String(record.minutesSpent) : '0',
            shipCost: record.shipCost != null ? String(record.shipCost) : '0',
            purchaseNotes: record.purchaseNotes || '',
            aiAnalysisText: record.aiAnalysisText || '',
            serialNumber: '',
            weightLbs: record.weightLbs || '',
            neckProfile: record.neckProfile || '',
            neckThickness: record.neckThickness || '',
            nutWidth: record.nutWidth || '',
            width12Fret: record.width12Fret || '',
            fretboardRadius: record.fretboardRadius || '',
            twelveFretAction: record.twelveFretAction || '',
            isActive: true,
            isMarked: false,
            isPersonal: Boolean(record.isPersonal),
            isRented: false,
            isCustom: true,
            forSale: Boolean(record.forSale),
            onlyInStore: Boolean(record.onlyInStore),
            salesChannelCcg: Boolean(record.forSale || record.salesChannelCcg),
            salesChannelFbm: Boolean(record.salesChannelFbm),
            salesChannelCl: Boolean(record.salesChannelCl),
            salesChannelReverb: Boolean(record.salesChannelReverb),
            salesChannelGearExchange: Boolean(record.salesChannelGearExchange),
            salesChannelOfferUp: Boolean(record.salesChannelOfferUp),
            salesChannelEbay: Boolean(record.salesChannelEbay),
            salesChannelNextdoor: Boolean(record.salesChannelNextdoor),
            salesChannelOther: Boolean(record.salesChannelOther),
            isSold: false,
            qtySold: 1,
            soldAmount: '',
            sellNotes: '',
            subscriptionId: record.subscriptionId != null ? String(record.subscriptionId) : '',
            saleUrl: record.saleUrl || '',
            saleZip: record.saleZip || DEFAULT_FORM.saleZip,
            storageLocation: record.storageLocation || '',
            soldChannel: '',
          });
          setWasSoldOnLoad(false);

          const existingImages = Array.isArray(record.images) && record.images.length
            ? record.images.map((image) => ({
              id: image.id,
              url: image.url,
              isPrivate: Boolean(image.isPrivate),
            }))
            : (
              Array.isArray(record.imageUrls) && record.imageUrls.length
                ? record.imageUrls
                : record.imageUrl
                  ? [record.imageUrl]
                  : []
            ).map((url) => ({ url, isPrivate: false }));
          setImages(normalizeImages(existingImages));
          setMessage({ severity: 'success', text: 'Custom product draft opened. Review and save when ready.' });
          return;
        }

        if (fromListingId) {
          const response = await fetch(`/api/listings/${encodeURIComponent(fromListingId)}`, {
            method: 'GET',
            credentials: 'same-origin',
          });
          const data = (await response.json()) as ListingRecordResponse;
          if (!response.ok) {
            throw new Error(data.message || 'Unable to load source listing.');
          }
          if (cancelled) return;

          const fields = data.fields || {};
          setSourceListingId(fromListingId);
          wasForSaleOnLoadRef.current = false;
          setSaleUrlReadOnly(false);
          const photoCandidates = (fields.photos || '')
            .split(/\r?\n/)
            .map((u: string) => u.trim())
            .filter(Boolean);
          const singleImage = (fields.image_url || '').trim();
          const allImages = Array.from(new Set([...photoCandidates, singleImage].filter(Boolean)));
          setSourceImageUrl(singleImage || null);
          if (allImages.length > 0) {
            setImages(normalizeImages(allImages.map((url) => ({ url, isPrivate: false }))));
          }
          const year = (fields.year || '').trim();
          const brand = (fields.brand || '').trim();
          const model = (fields.model || '').trim();
          const finish = (fields.finish || '').trim();
          const concatTitle = [year, brand, model, finish].filter(Boolean).join(' ');
          setForm((current) => ({
            ...current,
            title: concatTitle || (fields.title || '').trim(),
            categoryId: '',
            brand,
            yearRange: year,
            model,
            finish,
            originalListingDesc: (fields.description || '').trim(),
            aiAnalysisText: (fields.ai_analysis_text || '').trim(),
          }));
          if (allImages.length > 0) {
            setMessage({
              severity: 'success',
              text: `Prefilled from listing with ${allImages.length} image(s).`,
            });
          }
        }
        if (!id && !fromListingId) {
          setSaleUrlReadOnly(false);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({
            severity: 'error',
            text: error instanceof Error ? error.message : 'Unable to initialize inventory item.',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [searchParams, reloadToken]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      if (key === 'isSold' && value === true) {
        return {
          ...current,
          isSold: true,
          forSale: false,
          qtySold: Math.min(Math.max(1, current.qtySold), Math.max(1, current.quantity)),
        };
      }
      if (key === 'quantity') {
        const nextQuantity = Number(value);
        return {
          ...current,
          quantity: value as FormState['quantity'],
          qtySold: Math.min(Math.max(1, current.qtySold), Math.max(1, nextQuantity || 1)),
        };
      }
      if (key === 'categoryId') {
        return { ...current, categoryId: value as FormState['categoryId'], secondaryCategoryId: '' };
      }
      if (key === 'forSale') {
        const nextForSale = Boolean(value);
        if (!current.forSale && nextForSale) {
          if (!wasForSaleOnLoadRef.current && !hasAnySaleBulletText(current)) {
            return {
              ...current,
              forSale: true,
              salesChannelCcg: true,
              queue: 'For Sale',
              bullet6Text: 'FINANCING AVAILABLE!',
              bullet6Danger: false,
              bullet6Highlight: true,
            };
          }
          return { ...current, forSale: true, salesChannelCcg: true, queue: 'For Sale' };
        }
        if (current.forSale && !nextForSale) {
          return { ...current, forSale: false, queue: 'To Sell' };
        }
      }
      return { ...current, [key]: value };
    });
    setMessage(null);
  };

  const handleConfirmDuplicate = async () => {
    if (mode !== 'edit' || isDuplicating) return;

    setIsDuplicating(true);
    setMessage(null);
    try {
      const response = await fetch('/api/inventory/next-ccg-number', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json().catch(() => ({}))) as NextCcgNumberResponse;
      if (!response.ok || !data.ccgNumber) {
        throw new Error(data.message || 'Unable to generate CCG Number.');
      }

      setEditId(null);
      setSourceListingId(null);
      setSourceImageUrl(null);
      setWasSoldOnLoad(false);
      wasForSaleOnLoadRef.current = false;
      setSaleUrlReadOnly(Boolean(form.saleUrl.trim()));
      setForm((current) => ({
        ...current,
        ccgNumber: data.ccgNumber || DEFAULT_FORM.ccgNumber,
        saleUrl: createDuplicateSaleUrlSlug(current.saleUrl),
      }));
      setImages((current) => normalizeImages(
        current.map((image) => ({ url: image.url, isPrivate: image.isPrivate })),
      ));
      setDuplicateConfirmOpen(false);
      navigate(paths.inventoryItem, { replace: true });
      enqueueSnackbar('Duplicate draft opened. Review and save when ready.', { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to duplicate inventory item.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSaleTitleFocus = () => {
    saleTitleWasEmptyOnFocusRef.current = !form.saleTitle.trim();
  };

  const handleSaleTitleBlur = () => {
    if (!saleTitleWasEmptyOnFocusRef.current) return;
    const generatedSlug = generateSaleUrlSlugFromTitle(form.saleTitle);
    if (!generatedSlug || form.saleUrl.trim()) return;

    setForm((current) => {
      if (current.saleUrl.trim()) return current;
      return { ...current, saleUrl: generatedSlug };
    });
    setSaleUrlReadOnly(true);
    setMessage(null);
  };

  const unlockSaleUrl = () => {
    setSaleUrlReadOnly(false);
    window.setTimeout(() => {
      saleUrlInputRef.current?.focus();
      const length = saleUrlInputRef.current?.value.length ?? 0;
      saleUrlInputRef.current?.setSelectionRange(length, length);
    }, 0);
  };

  const handleSaleUrlBlur = () => {
    if (saleUrlReadOnly) return;
    const sanitizedSlug = sanitizeSaleUrlSlug(form.saleUrl);
    if (sanitizedSlug !== form.saleUrl) {
      setField('saleUrl', sanitizedSlug);
    }
  };

  const updateImages = (nextImages: InventoryImageRecord[]) => {
    setImages(normalizeImages(nextImages));
  };

  const createSavePayload = (nextImages: InventoryImageRecord[]) => ({
    sourceListingId,
    ccgNumber: getSavableCcgNumber(form.ccgNumber),
    quantity: form.quantity,
    imageUrl: nextImages[0]?.url,
    imageUrls: nextImages.map((image) => image.url),
    images: nextImages.map((image) => ({ url: image.url, isPrivate: image.isPrivate })),
    videoUrl: form.videoUrl.trim(),
    saleTitle: form.saleTitle.trim(),
    regularPrice: form.regularPrice.trim(),
    salePrice: form.salePrice.trim(),
    condition: form.condition.trim(),
    saleDescription: form.saleDescription.trim(),
    clearance: form.clearance,
    bullet1Text: form.bullet1Text.trim(),
    bullet1Danger: form.bullet1Danger,
    bullet1Highlight: form.bullet1Highlight,
    bullet2Text: form.bullet2Text.trim(),
    bullet2Danger: form.bullet2Danger,
    bullet2Highlight: form.bullet2Highlight,
    bullet3Text: form.bullet3Text.trim(),
    bullet3Danger: form.bullet3Danger,
    bullet3Highlight: form.bullet3Highlight,
    bullet4Text: form.bullet4Text.trim(),
    bullet4Danger: form.bullet4Danger,
    bullet4Highlight: form.bullet4Highlight,
    bullet5Text: form.bullet5Text.trim(),
    bullet5Danger: form.bullet5Danger,
    bullet5Highlight: form.bullet5Highlight,
    bullet6Text: form.bullet6Text.trim(),
    bullet6Danger: form.bullet6Danger,
    bullet6Highlight: form.bullet6Highlight,
    barcode: form.barcode.trim(),
    title: form.title.trim(),
    categoryId: form.categoryId,
    secondaryCategoryId: form.secondaryCategoryId || null,
    brand: form.brand.trim(),
    queue: form.queue,
    yearRange: form.yearRange.trim(),
    model: form.model.trim(),
    finish: form.finish.trim(),
    repairNotes: form.repairNotes.trim(),
    originalListingDesc: form.originalListingDesc.trim(),
    purchasedDate: form.purchasedDate.trim(),
    unitPurchasePrice: form.unitPurchasePrice.trim(),
    mapPrice: form.mapPrice.trim(),
    privatePartyValue: form.privatePartyValue.trim() || '0',
    miles: form.miles.trim() || '0',
    minutesSpent: form.minutesSpent.trim() || '0',
    shipCost: form.shipCost.trim() || '0',
    purchaseNotes: form.purchaseNotes.trim(),
    aiAnalysisText: form.aiAnalysisText.trim(),
    isActive: form.isActive,
    isMarked: form.isMarked,
    isPersonal: form.isPersonal,
    isRented: form.isRented,
    isCustom: form.isCustom,
    forSale: form.forSale,
    onlyInStore: form.onlyInStore,
    salesChannelCcg: form.salesChannelCcg,
    salesChannelFbm: form.salesChannelFbm,
    salesChannelCl: form.salesChannelCl,
    salesChannelReverb: form.salesChannelReverb,
    salesChannelGearExchange: form.salesChannelGearExchange,
    salesChannelOfferUp: form.salesChannelOfferUp,
    salesChannelEbay: form.salesChannelEbay,
    salesChannelNextdoor: form.salesChannelNextdoor,
    salesChannelOther: form.salesChannelOther,
    isSold: form.isSold,
    qtySold: form.qtySold,
    serialNumber: form.serialNumber.trim(),
    weightLbs: form.weightLbs.trim(),
    neckProfile: form.neckProfile.trim(),
    neckThickness: form.neckThickness.trim(),
    nutWidth: form.nutWidth.trim(),
    width12Fret: form.width12Fret.trim(),
    fretboardRadius: form.fretboardRadius.trim(),
    twelveFretAction: form.twelveFretAction.trim(),
    soldAmount: form.soldAmount.trim(),
    sellNotes: form.sellNotes.trim(),
    subscriptionId: form.subscriptionId || null,
    saleUrl: form.saleUrl.trim(),
    saleZip: form.saleZip.trim(),
    storageLocation: form.storageLocation || null,
    soldChannel: form.soldChannel || null,
  });

  const persistImages = async (
    nextImages: InventoryImageRecord[],
    previousImages: InventoryImageRecord[],
    _successMessage: string,
    failureMessage: string,
  ) => {
    if (!editId) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/inventory/${encodeURIComponent(editId)}/update`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createSavePayload(nextImages)),
        credentials: 'same-origin',
      });

      const data = (await response.json().catch(() => ({}))) as SaveResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.message || failureMessage);
      }
    } catch (error) {
      updateImages(previousImages);
      const text = error instanceof Error ? error.message : failureMessage;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromoteImage = async (index: number) => {
    if (index <= 0 || index >= images.length) return;

    const previousImages = [...images];
    const nextImages = [...images];
    const primaryImage = nextImages[0];
    const selectedImage = nextImages[index];
    nextImages[0] = { ...selectedImage, isPrivate: false };
    nextImages[index] = primaryImage;
    updateImages(nextImages);

    if (!editId) {
      return;
    }
    await persistImages(nextImages, previousImages, 'Primary image updated.', 'Unable to update inventory item.');
  };

  const handleMoveImage = async (index: number, direction: 'left' | 'right') => {
    if (index <= 0 || index >= images.length) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex <= 0 || targetIndex >= images.length) return;

    const previousImages = [...images];
    const nextImages = [...images];
    const selectedImage = nextImages[index];
    nextImages[index] = nextImages[targetIndex];
    nextImages[targetIndex] = selectedImage;
    updateImages(nextImages);

    if (!editId) {
      return;
    }
    await persistImages(nextImages, previousImages, 'Image order updated.', 'Unable to reorder inventory images.');
  };

  const handleToggleImagePrivate = async (index: number) => {
    if (index <= 0 || index >= images.length) return;

    const previousImages = [...images];
    const nextImages = [...images];
    nextImages[index] = {
      ...nextImages[index],
      isPrivate: !nextImages[index].isPrivate,
    };
    updateImages(nextImages);

    if (!editId) {
      return;
    }

    await persistImages(
      nextImages,
      previousImages,
      nextImages[index].isPrivate ? 'Image marked private.' : 'Image marked public.',
      'Unable to update image privacy.',
    );
  };

  const handleDeleteImage = async (index: number) => {
    if (images.length <= 1 || index < 0 || index >= images.length) return;

    const previousImages = [...images];
    const nextImages = images.filter((_, i) => i !== index);
    updateImages(nextImages);

    if (!editId) {
      return;
    }

    await persistImages(nextImages, previousImages, 'Image removed.', 'Unable to remove image.');
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.set('image', file);
    const response = await fetch('/api/inventory/upload-image', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    });
    const data = (await response.json().catch(() => ({}))) as { imageUrl?: string; message?: string };
    if (!response.ok || !data.imageUrl) {
      throw new Error(data.message || 'Unable to upload image.');
    }
    return data.imageUrl;
  };

  const importSourceImage = async (url: string): Promise<string> => {
    const response = await fetch('/api/inventory/import-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceUrl: url }),
      credentials: 'same-origin',
    });
    const data = (await response.json().catch(() => ({}))) as { imageUrl?: string; message?: string };
    if (!response.ok || !data.imageUrl) {
      throw new Error(data.message || 'Unable to import source image.');
    }
    return data.imageUrl;
  };

  const openUpcLookupDialog = () => {
    setUpcLookupData(null);
    setUpcLookupBrand('DUNLOP');
    setUpcLookupOpen(true);
    setMessage(null);
  };

  const closeUpcLookupDialog = () => {
    if (isUpcSearching || isImporting) return;
    setUpcLookupOpen(false);
  };

  const handleUpcLookupGo = async () => {
    const barcode = form.barcode.trim();
    const barcodeValidationError = getBarcodeValidationError(barcode);
    if (barcodeValidationError) {
      enqueueSnackbar(barcodeValidationError, { variant: 'error' });
      return;
    }

    setIsUpcSearching(true);
    setUpcLookupData(null);
    try {
      const params = new URLSearchParams();
      params.set('barcode', barcode);
      params.set('brand', upcLookupBrand);
      const response = await fetch(`/api/admin-v2/upc-lookup?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json().catch(() => ({}))) as UpcLookupResponse;
      if (!response.ok) {
        throw new Error(data.message || 'Unable to lookup UPC data.');
      }
      if (!data.found) {
        setUpcLookupOpen(false);
        enqueueSnackbar('UPC Data Not Found', { variant: 'warning' });
        return;
      }
      setUpcLookupData(data);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to lookup UPC data.';
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsUpcSearching(false);
    }
  };

  const handlePopulateFromUpc = async () => {
    if (!upcLookupData || isImporting) return;

    const preferredTitle = (upcLookupData.clean_title || upcLookupData.brand_desc || upcLookupData.title || '').trim();
    const brand = (upcLookupData.brand || upcLookupBrand || '').trim();
    const description = (upcLookupData.clean_description || upcLookupData.description || '').trim();
    const attributeLines = buildUpcAttributeLines(upcLookupData);
    const descriptionWithAttributes = appendAttributeLines(description, attributeLines);
    const bulletCandidates = (Array.isArray(upcLookupData.clean_bullets) ? upcLookupData.clean_bullets : [])
      .map(truncateBulletText)
      .filter(Boolean)
      .slice(0, 5);
    const msrpPrice = parsePopulatedPrice(upcLookupData.msrp);
    const mapPrice = parsePopulatedPrice(upcLookupData.map) ?? msrpPrice;
    const dealerCost = parsePopulatedPrice(upcLookupData.dealer_cost);

    setForm((current) => ({
      ...current,
      title: preferredTitle || current.title,
      saleTitle: preferredTitle || current.saleTitle,
      saleUrl: preferredTitle ? generateSaleUrlSlugFromTitle(preferredTitle) : current.saleUrl,
      originalListingDesc: descriptionWithAttributes || current.originalListingDesc,
      saleDescription: descriptionWithAttributes || current.saleDescription,
      brand: brand || current.brand,
      model: preferredTitle ? removeBrandFromModel(preferredTitle, brand) : current.model,
      bullet1Text: bulletCandidates[0] || current.bullet1Text,
      bullet2Text: bulletCandidates[1] || current.bullet2Text,
      bullet3Text: bulletCandidates[2] || current.bullet3Text,
      bullet4Text: bulletCandidates[3] || current.bullet4Text,
      bullet5Text: bulletCandidates[4] || current.bullet5Text,
      mapPrice: mapPrice != null ? String(mapPrice) : current.mapPrice,
      salePrice: mapPrice != null ? String(mapPrice) : current.salePrice,
      privatePartyValue: mapPrice != null ? String(mapPrice) : current.privatePartyValue,
      regularPrice:
        msrpPrice != null
          ? String(msrpPrice)
          : mapPrice != null
            ? String(mapPrice)
            : current.regularPrice,
      unitPurchasePrice: dealerCost != null ? String(dealerCost) : current.unitPurchasePrice,
      condition: 'New',
    }));
    if (preferredTitle) {
      setSaleUrlReadOnly(true);
    }

    const imageUrls = (upcLookupData.images || []).filter(Boolean).slice(0, INVENTORY_MAX_IMAGES - images.length);
    if (imageUrls.length > 0) {
      setIsImporting(true);
      try {
        let nextImages = [...images];
        let importedCount = 0;
        for (const url of imageUrls) {
          if (nextImages.length >= INVENTORY_MAX_IMAGES) break;
          try {
            const importedUrl = await importSourceImage(url);
            nextImages = normalizeImages([...nextImages, { url: importedUrl, isPrivate: false }]);
            importedCount += 1;
            setImages(nextImages);
          } catch {
            // Best-effort UPC image import. Some external image URLs block downloads.
          }
        }
        if (importedCount > 0) {
          enqueueSnackbar(`Imported ${importedCount} UPC image${importedCount === 1 ? '' : 's'}.`, {
            variant: 'success',
          });
        }
      } finally {
        setIsImporting(false);
      }
    }

    setUpcLookupOpen(false);
    enqueueSnackbar('UPC data populated. Review and save when ready.', { variant: 'success' });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (images.length >= INVENTORY_MAX_IMAGES) {
      const text = `You can upload up to ${INVENTORY_MAX_IMAGES} images.`;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      let nextImages = [...images];
      let uploadedCount = 0;

      for (const file of files) {
        if (nextImages.length >= INVENTORY_MAX_IMAGES) break;
        const imageUrl = await uploadImage(file);
        nextImages = normalizeImages([...nextImages, { url: imageUrl, isPrivate: false }]);
        uploadedCount += 1;
        setImages(nextImages);
      }

      const text =
        uploadedCount > 0 ? `Uploaded ${uploadedCount} image${uploadedCount === 1 ? '' : 's'}.` : 'No images were uploaded.';
      setMessage({ severity: uploadedCount > 0 ? 'success' : 'error', text });
      enqueueSnackbar(text, { variant: uploadedCount > 0 ? 'success' : 'error' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to upload image.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleImportSourceImage = async () => {
    if (!sourceImageUrl) return;
    if (images.length >= INVENTORY_MAX_IMAGES) {
      const text = `You can upload up to ${INVENTORY_MAX_IMAGES} images.`;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const importedUrl = await importSourceImage(sourceImageUrl);
      updateImages([...images, { url: importedUrl, isPrivate: false }]);
      setMessage({ severity: 'success', text: 'Source image imported.' });
      enqueueSnackbar('Source image imported.', { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to import source image.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmitWithSoldCheck = () => {
    if (isSubmitting) return;
    // If toggling sold on for the first time, confirm first
    if (form.isSold && !wasSoldOnLoad) {
      setSoldConfirmOpen(true);
      return;
    }
    void doSubmit();
  };

  const doSubmit = async () => {
    setSoldConfirmOpen(false);
    if (isSubmitting) return;
    if (!form.title.trim()) {
      setMessage({ severity: 'error', text: 'Title is required.' });
      return;
    }
    if (!form.purchasedDate.trim()) {
      setMessage({ severity: 'error', text: 'Purchased date is required.' });
      return;
    }
    if (!form.categoryId.trim()) {
      setMessage({ severity: 'error', text: 'Category is required.' });
      return;
    }
    if (!form.queue.trim()) {
      setMessage({ severity: 'error', text: 'Queue is required.' });
      return;
    }
    const barcodeValidationError = editId || form.barcode.trim()
      ? getBarcodeValidationError(form.barcode)
      : null;
    if (barcodeValidationError) {
      setMessage({ severity: 'error', text: barcodeValidationError });
      enqueueSnackbar(barcodeValidationError, { variant: 'error' });
      return;
    }
    if (images.length < 1) {
      setMessage({ severity: 'error', text: 'Please upload at least one image before saving.' });
      return;
    }
    const forSaleValidationError = getForSaleValidationError(form);
    if (forSaleValidationError) {
      setMessage({ severity: 'error', text: forSaleValidationError });
      enqueueSnackbar(forSaleValidationError, { variant: 'error' });
      return;
    }
    if (!Number.isInteger(form.quantity) || form.quantity < 0) {
      setMessage({ severity: 'error', text: 'Qty must be a whole number greater than or equal to 0.' });
      return;
    }
    if (form.isSold) {
      if (!Number.isInteger(form.qtySold) || form.qtySold < 1) {
        setMessage({ severity: 'error', text: 'Qty Sold must be at least 1.' });
        return;
      }
      if (form.qtySold > form.quantity) {
        setMessage({ severity: 'error', text: 'Qty Sold cannot be greater than Qty.' });
        return;
      }
    }
    setIsSubmitting(true);
    setMessage(null);

    try {
      const endpoint = editId
        ? `/api/inventory/${encodeURIComponent(editId)}/update`
        : '/api/inventory';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createSavePayload(images)),
        credentials: 'same-origin',
      });

      const data = (await response.json().catch(() => ({}))) as SaveResponse;
      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ||
            (editId ? 'Unable to update inventory item.' : 'Unable to create inventory item.'),
        );
      }

      const text = editId
        ? 'Item Updated'
        : data.duplicateSuppressed
          ? `Duplicate submit prevented. Using existing item ${data.ccgNumber || ''}.`
          : `Created inventory item: ${data.ccgNumber || ''}.`;
      enqueueSnackbar(text, { variant: 'success' });
      if (editId) {
        setReloadToken((current) => current + 1);
      } else {
        navigate(inventoryManagerHref);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to save inventory item.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateLargeTag = async () => {
    if (isGeneratingTag) return;
    setIsGeneratingTag(true);
    setMessage(null);

    try {
      const blob = await buildInventoryTagPdf(form, selectedCategoryName);
      const ccgNumber = form.ccgNumber.trim() || 'inventory';
      downloadBlob(blob, `${ccgNumber}-large-tag.pdf`);
      enqueueSnackbar('Large tag generated.', { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to generate inventory tag.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsGeneratingTag(false);
    }
  };

  const handleGenerateSaleDescription = async () => {
    try {
      const text = await buildSaleDescriptionFromTemplate(GUITAR_LISTING_TEMPLATE_URL, 'listing');
      setField('saleDescription', text);
      enqueueSnackbar('Sale description generated.', { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to generate sale description.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    }
  };

  const handleGeneratePackageDescription = async () => {
    try {
      const text = await buildSaleDescriptionFromTemplate(GUITAR_PACKAGE_TEMPLATE_URL, 'package');
      setField('saleDescription', text);
      enqueueSnackbar('Package description generated.', { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to generate package description.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    }
  };

  const buildSaleDescriptionFromTemplate = async (templateUrl: string, templateName: string) => {
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Unable to load guitar ${templateName} template.`);

    let text = await response.text();
    text = text.replaceAll('<ITEM_TEXT>', form.saleTitle.trim());
    text = replaceTemplatePrice(text, form.salePrice);

    [
      ['<BULLET1>', form.bullet1Text],
      ['<BULLET2>', form.bullet2Text],
      ['<BULLET3>', form.bullet3Text],
      ['<BULLET4>', form.bullet4Text],
      ['<BULLET5>', form.bullet5Text],
      ['<BULLET6>', form.bullet6Text],
    ].forEach(([placeholder, value]) => {
      text = replaceLinePlaceholder(text, placeholder, buildListingBulletText(value));
    });

    return text.trim();
  };

  const uploadButtonLabel = useMemo(() => {
    if (isUploading) return 'Uploading...';
    return images.length > 0 ? 'Add Images' : 'Upload Images';
  }, [images.length, isUploading]);

  const selectedCategoryName = useMemo(
    () => categoryOptions.find((option) => option.id === form.categoryId)?.name || '',
    [categoryOptions, form.categoryId],
  );
  const parentCategoryOptions = useMemo(
    () => categoryOptions.filter((option) => option.parentId == null),
    [categoryOptions],
  );
  const secondaryCategoryOptions = useMemo(() => {
    const parentId = Number(form.categoryId);
    if (!Number.isFinite(parentId) || parentId <= 0) return [];
    return categoryOptions.filter((option) => option.parentId === parentId);
  }, [categoryOptions, form.categoryId]);
  const secondaryCategoryDisabled = !form.categoryId || secondaryCategoryOptions.length === 0;

  useEffect(() => {
    if (!form.secondaryCategoryId || categoryOptions.length === 0) return;
    if (!form.categoryId || !secondaryCategoryOptions.some((option) => option.id === form.secondaryCategoryId)) {
      setForm((current) => (
        current.secondaryCategoryId ? { ...current, secondaryCategoryId: '' } : current
      ));
    }
  }, [categoryOptions.length, form.categoryId, form.secondaryCategoryId, secondaryCategoryOptions]);

  const openAiAnalysisDialog = () => {
    setAiAnalysisDraft(form.aiAnalysisText);
    setAiAnalysisDialogOpen(true);
    setMessage(null);
  };

  const closeAiAnalysisDialog = () => {
    setAiAnalysisDialogOpen(false);
  };

  const saveAiAnalysisDraft = () => {
    setField('aiAnalysisText', aiAnalysisDraft);
    setAiAnalysisDialogOpen(false);
  };

  return (
    <Stack direction="column" height={1} gap={3} sx={{ minWidth: 0 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            gap: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h4">{pageTitle}</Typography>

          <Tooltip title="Back">
            <IconButton
              aria-label="Back"
              onClick={() => navigate(inventoryManagerHref)}
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: 'background.elevation2',
                },
              }}
            >
              <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {message ? <Alert severity={message.severity}>{message.text}</Alert> : null}

      <Box sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
        {isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>Loading inventory item…</Typography>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {mode === 'edit' ? (
                    <Tooltip title="Duplicate">
                      <IconButton
                        aria-label="Duplicate"
                        onClick={() => setDuplicateConfirmOpen(true)}
                        disabled={isSubmitting || isDuplicating}
                        sx={{
                          width: 44,
                          height: 44,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.elevation1',
                          color: 'text.primary',
                          flexShrink: 0,
                          '&:hover': {
                            bgcolor: 'background.elevation2',
                          },
                        }}
                      >
                        <IconifyIcon icon="material-symbols:content-copy-outline-rounded" fontSize={20} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <TextField
                    fullWidth
                    label="CCG Number"
                    value={form.ccgNumber}
                    InputProps={{ readOnly: true }}
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} data-admin-barcode-field="true">
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    data-admin-barcode-field="true"
                    label="Barcode"
                    required={Boolean(editId)}
                    value={form.barcode}
                    onChange={(event) => setField('barcode', event.target.value)}
                    onFocus={() => {
                      (window as BarcodeFocusWindow).__ccgAdminBarcodeInputFocused = true;
                    }}
                    onBlur={() => {
                      (window as BarcodeFocusWindow).__ccgAdminBarcodeInputFocused = false;
                    }}
                    error={Boolean(form.barcode && getBarcodeValidationError(form.barcode))}
                    helperText={
                      form.barcode && getBarcodeValidationError(form.barcode)
                        ? getBarcodeValidationError(form.barcode)
                        : editId
                          ? 'Numeric only, 8-20 digits.'
                          : 'Scan or enter a barcode, or leave blank to auto-generate on save.'
                    }
                    inputProps={{
                      name: 'barcode',
                      id: 'barcode',
                      'aria-label': 'Barcode',
                      'data-admin-barcode-field': 'true',
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      minLength: 8,
                      maxLength: 20,
                    }}
                    slotProps={{
                      htmlInput: {
                        name: 'barcode',
                        id: 'barcode',
                        'aria-label': 'Barcode',
                        'data-admin-barcode-field': 'true',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        minLength: 8,
                        maxLength: 20,
                      },
                    }}
                  />
                  <Tooltip title="Lookup UPC data">
                    <span>
                      <IconButton
                        aria-label="Lookup UPC data"
                        color="primary"
                        disabled={!form.barcode.trim() || Boolean(getBarcodeValidationError(form.barcode))}
                        onClick={openUpcLookupDialog}
                        sx={{
                          width: 44,
                          height: 44,
                          mt: 0.75,
                          border: 1,
                          borderColor: 'primary.main',
                          bgcolor: 'background.elevation1',
                          '&:hover': {
                            bgcolor: 'background.elevation2',
                          },
                        }}
                      >
                        <IconifyIcon icon="material-symbols:search-rounded" fontSize={20} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Purchased Date"
                  type="date"
                  value={form.purchasedDate}
                  onChange={(event) => setField('purchasedDate', event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Qty"
                  type="number"
                  value={form.quantity}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setField('quantity', Number.isFinite(parsed) ? parsed : 0);
                  }}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>

              <Grid size={12}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Images</Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                </Stack>
              </Grid>

              <Grid size={12}>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { md: 'center' }, width: 1 }}
                  >
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isImporting || isSubmitting}
                      startIcon={<IconifyIcon icon="material-symbols:upload-rounded" />}
                    >
                      {uploadButtonLabel}
                    </Button>
                    {sourceImageUrl ? (
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleImportSourceImage}
                        disabled={isUploading || isImporting || isSubmitting}
                        startIcon={<IconifyIcon icon="material-symbols:download-rounded" />}
                      >
                        {isImporting ? 'Importing...' : 'Import Source Image'}
                      </Button>
                    ) : null}
                    <Chip
                      label={`${images.length}/${INVENTORY_MAX_IMAGES} images`}
                      color="primary"
                      variant="soft"
                    />
                  </Stack>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Upload 1 primary image plus up to 19 additional images.
                  </Typography>
                </Stack>
              </Grid>

              {images.length ? (
                <Grid size={12}>
                  <Grid container spacing={2}>
                    {images.map((image, index) => (
                      <Grid key={`${image.url}-${index}`} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1,
                            borderRadius: 3,
                            bgcolor: 'background.default',
                            '&:hover .inventory-image-promote': {
                              opacity: 1,
                              transform: 'translateY(0)',
                            },
                          }}
                        >
                          <Stack spacing={1}>
                            <Box
                              sx={{
                                position: 'relative',
                                width: '100%',
                                aspectRatio: '1 / 1',
                                borderRadius: 2,
                                overflow: 'hidden',
                                bgcolor: 'background.elevation1',
                                cursor: 'pointer',
                              }}
                              onClick={() => setPreviewImage(image.url)}
                            >
                              {index > 0 ? (
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  className="inventory-image-promote"
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    zIndex: 1,
                                    opacity: 0,
                                    transform: 'translateY(-4px)',
                                    transition: 'opacity 160ms ease, transform 160ms ease',
                                  }}
                                >
                                  {index > 1 ? (
                                    <Tooltip title="Move left">
                                      <IconButton
                                        size="small"
                                        aria-label="Move image left"
                                        disabled={isSubmitting}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleMoveImage(index, 'left');
                                        }}
                                        sx={{
                                          bgcolor: 'rgba(15, 23, 42, 0.78)',
                                          color: 'common.white',
                                          border: 1,
                                          borderColor: 'rgba(255,255,255,0.12)',
                                          '&:hover': {
                                            bgcolor: 'rgba(15, 23, 42, 0.92)',
                                          },
                                        }}
                                      >
                                        <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={18} />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                  {index < images.length - 1 ? (
                                    <Tooltip title="Move right">
                                      <IconButton
                                        size="small"
                                        aria-label="Move image right"
                                        disabled={isSubmitting}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleMoveImage(index, 'right');
                                        }}
                                        sx={{
                                          bgcolor: 'rgba(15, 23, 42, 0.78)',
                                          color: 'common.white',
                                          border: 1,
                                          borderColor: 'rgba(255,255,255,0.12)',
                                          '&:hover': {
                                            bgcolor: 'rgba(15, 23, 42, 0.92)',
                                          },
                                        }}
                                      >
                                        <IconifyIcon icon="material-symbols:arrow-forward-rounded" fontSize={18} />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                </Stack>
                              ) : null}
                              <Box
                                component="img"
                                src={image.url}
                                alt={`Inventory image ${index + 1}`}
                                sx={{ width: 1, height: 1, objectFit: 'cover' }}
                              />
                            </Box>

                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              {index === 0 ? (
                                <Chip label="Primary" size="small" color="warning" variant="soft" />
                              ) : (
                                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                  <Tooltip title="Make primary image">
                                    <IconButton
                                      size="small"
                                      aria-label="Make image primary"
                                      disabled={isSubmitting}
                                      onClick={() => {
                                        void handlePromoteImage(index);
                                      }}
                                      sx={{ color: 'warning.main' }}
                                    >
                                      <IconifyIcon icon="material-symbols:star-outline-rounded" fontSize={18} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={image.isPrivate ? 'Private image' : 'Public image'}>
                                    <IconButton
                                      size="small"
                                      aria-label={image.isPrivate ? 'Mark image public' : 'Mark image private'}
                                      disabled={isSubmitting}
                                      onClick={() => {
                                        void handleToggleImagePrivate(index);
                                      }}
                                      sx={{
                                        color: image.isPrivate ? 'warning.main' : 'text.secondary',
                                      }}
                                    >
                                      <IconifyIcon
                                        icon={
                                          image.isPrivate
                                            ? 'material-symbols:lock-rounded'
                                            : 'material-symbols:lock-outline-rounded'
                                        }
                                        fontSize={18}
                                      />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              )}
                              <IconButton
                                size="small"
                                aria-label="Remove image"
                                disabled={images.length <= 1 || isSubmitting}
                                onClick={() => {
                                  void handleDeleteImage(index);
                                }}
                              >
                                <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              ) : null}

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="YouTube Url"
                  value={form.videoUrl}
                  onChange={(event) => setField('videoUrl', event.target.value)}
                  inputProps={{ maxLength: 200 }}
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                  Inventory Details
                </Typography>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={form.title}
                  onChange={(event) => setField('title', event.target.value)}
                  inputProps={{ maxLength: 240 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Queue"
                  value={form.queue}
                  onChange={(event) => setField('queue', event.target.value)}
                >
                  {INVENTORY_QUEUE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={form.categoryId}
                  onChange={(event) => setField('categoryId', event.target.value)}
                >
                  {parentCategoryOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Secondary Category"
                  value={form.secondaryCategoryId}
                  onChange={(event) => setField('secondaryCategoryId', event.target.value)}
                  disabled={secondaryCategoryDisabled}
                  helperText={
                    !form.categoryId
                      ? 'Select a category first.'
                      : secondaryCategoryOptions.length === 0
                        ? 'No child categories available.'
                        : undefined
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {secondaryCategoryOptions.map((option) => (
                    <MenuItem key={`secondary-${option.id}`} value={option.id}>
                      {option.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Brand"
                  value={form.brand}
                  onChange={(event) => setField('brand', event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Year Range"
                  value={form.yearRange}
                  onChange={(event) => setField('yearRange', event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Model"
                  value={form.model}
                  onChange={(event) => setField('model', event.target.value)}
                  inputProps={{ maxLength: 180 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Finish"
                  value={form.finish}
                  onChange={(event) => setField('finish', event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Serial Number"
                  value={form.serialNumber}
                  onChange={(event) => setField('serialNumber', event.target.value)}
                  inputProps={{ maxLength: 180 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Storage Location"
                  value={form.storageLocation}
                  onChange={(event) => setField('storageLocation', event.target.value)}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="Extra Space 23225">Extra Space 23225</MenuItem>
                  <MenuItem value="Cellar">Cellar</MenuItem>
                  <MenuItem value="Garage">Garage</MenuItem>
                </TextField>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={4}
                  label="Repair/Cleaning Notes"
                  value={form.repairNotes}
                  onChange={(event) => setField('repairNotes', event.target.value)}
                  inputProps={{ maxLength: 12000 }}
                  sx={notesFieldSx}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={4}
                  label="Original Listing Desc."
                  value={form.originalListingDesc}
                  onChange={(event) => setField('originalListingDesc', event.target.value)}
                  inputProps={{ maxLength: 12000 }}
                  sx={notesFieldSx}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Unit Cost ($)"
                  type="number"
                  value={form.unitPurchasePrice}
                  onChange={(event) => setField('unitPurchasePrice', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Profit margin targets">
                          <IconButton
                            aria-label="Show profit margin targets"
                            size="small"
                            onClick={() => setProfitTargetsOpen(true)}
                            edge="end"
                            sx={{
                              width: 24,
                              height: 24,
                              mr: 0.25,
                              border: 1,
                              borderColor: 'divider',
                              bgcolor: 'background.paper',
                              color: 'success.main',
                              fontSize: 13,
                              fontWeight: 800,
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            $
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="MAP Price ($)"
                  type="number"
                  value={form.mapPrice}
                  onChange={(event) => setField('mapPrice', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Private Party Value ($)"
                  type="number"
                  value={form.privatePartyValue}
                  onChange={(event) => setField('privatePartyValue', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Miles"
                  type="number"
                  value={form.miles}
                  onChange={(event) => setField('miles', event.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Minutes Spent"
                  type="number"
                  value={form.minutesSpent}
                  onChange={(event) => setField('minutesSpent', event.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Ship Cost ($)"
                  type="number"
                  value={form.shipCost}
                  onChange={(event) => setField('shipCost', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Purchase Notes"
                  value={form.purchaseNotes}
                  onChange={(event) => setField('purchaseNotes', event.target.value)}
                  inputProps={{ maxLength: 4000 }}
                />
              </Grid>

              <Grid size={12}>
                {buildHtmlPreviewNode(
                  form.aiAnalysisText,
                  'Click to add AI analysis text.',
                  openAiAnalysisDialog,
                )}
              </Grid>

              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                  <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isActive}
                          onChange={(event) => setField('isActive', event.target.checked)}
                        />
                      }
                      label="Is Active"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isMarked}
                          onChange={(event) => setField('isMarked', event.target.checked)}
                        />
                      }
                      label="Is Marked"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isPersonal}
                          onChange={(event) => setField('isPersonal', event.target.checked)}
                        />
                      }
                      label="Is Personal"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isRented}
                          onChange={(event) => setField('isRented', event.target.checked)}
                        />
                      }
                      label="Is Rented"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isCustom}
                          onChange={(event) => setField('isCustom', event.target.checked)}
                        />
                      }
                      label="Is Custom"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.forSale}
                          onChange={(event) => setField('forSale', event.target.checked)}
                        />
                      }
                      label="For Sale"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.onlyInStore}
                          onChange={(event) => setField('onlyInStore', event.target.checked)}
                        />
                      }
                      label="Only in-store"
                    />
                  </Stack>

                  <TextField
                    select
                    label="Subscription"
                    value={form.subscriptionId}
                    onChange={(event) => setField('subscriptionId', event.target.value)}
                    size="small"
                    sx={{ mt: 2, minWidth: 250 }}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {subscriptionOptions.map((sub) => (
                      <MenuItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Paper>
              </Grid>

              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                    Active sales channels
                  </Typography>
                  <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap', mt: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelCcg}
                          onChange={(event) => setField('salesChannelCcg', event.target.checked)}
                        />
                      }
                      label="CCG"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelFbm}
                          onChange={(event) => setField('salesChannelFbm', event.target.checked)}
                        />
                      }
                      label="FBM"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelCl}
                          onChange={(event) => setField('salesChannelCl', event.target.checked)}
                        />
                      }
                      label="CL"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelReverb}
                          onChange={(event) => setField('salesChannelReverb', event.target.checked)}
                        />
                      }
                      label="Reverb"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelGearExchange}
                          onChange={(event) => setField('salesChannelGearExchange', event.target.checked)}
                        />
                      }
                      label="Gear Exch."
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelOfferUp}
                          onChange={(event) => setField('salesChannelOfferUp', event.target.checked)}
                        />
                      }
                      label="OfferUp"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelEbay}
                          onChange={(event) => setField('salesChannelEbay', event.target.checked)}
                        />
                      }
                      label="EBay"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelNextdoor}
                          onChange={(event) => setField('salesChannelNextdoor', event.target.checked)}
                        />
                      }
                      label="Nextdoor"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.salesChannelOther}
                          onChange={(event) => setField('salesChannelOther', event.target.checked)}
                        />
                      }
                      label="Other"
                    />
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                    <Grid container spacing={3}>
                      <Grid size={12}>
                        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                          Sale Details
                        </Typography>
                      </Grid>
                      <Grid size={12}>
                        <TextField
                          fullWidth
                          required
                          label="Title"
                          value={form.saleTitle}
                          onChange={(event) => setField('saleTitle', event.target.value)}
                          onFocus={handleSaleTitleFocus}
                          onBlur={handleSaleTitleBlur}
                          inputProps={{ maxLength: 200 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          required
                          label="Sale Price"
                          type="number"
                          value={form.salePrice}
                          onChange={(event) => setField('salePrice', event.target.value)}
                          onBlur={() => {
                            const num = parseFloat(form.salePrice);
                            if (num > 0 && !form.regularPrice.trim()) {
                              setField('regularPrice', String(Math.ceil(num * 1.2)));
                            }
                          }}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          required
                          label="Regular Price"
                          type="number"
                          value={form.regularPrice}
                          onChange={(event) => setField('regularPrice', event.target.value)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          select
                          fullWidth
                          required
                          label="Condition"
                          value={form.condition}
                          onChange={(event) => setField('condition', event.target.value)}
                        >
                          {SALE_CONDITION_OPTIONS.map((option) => (
                            <MenuItem key={option || 'blank'} value={option}>
                              {option || ' '}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, md: 9.6 }}>
                        <TextField
                          fullWidth
                          required
                          multiline
                          minRows={4}
                          maxRows={8}
                          label="Description"
                          value={form.saleDescription}
                          onChange={(event) => setField('saleDescription', event.target.value)}
                          inputProps={{ maxLength: 12000 }}
                          sx={notesFieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 2.4 }}>
                        <Stack sx={{ gap: 2, height: 1 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            onClick={handleGenerateSaleDescription}
                            startIcon={<IconifyIcon icon="material-symbols:sell-outline" fontSize={18} />}
                            sx={{ flex: 1, minHeight: 56 }}
                          >
                            Sale
                          </Button>
                          <Button
                            fullWidth
                            variant="contained"
                            onClick={handleGeneratePackageDescription}
                            startIcon={<IconifyIcon icon="material-symbols:attach-money-rounded" fontSize={18} />}
                            sx={{ flex: 1, minHeight: 56 }}
                          >
                            Package
                          </Button>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="Sale URL Slug"
                          inputRef={saleUrlInputRef}
                          value={form.saleUrl}
                          onChange={(event) => {
                            if (!saleUrlReadOnly) {
                              setField('saleUrl', event.target.value);
                            }
                          }}
                          onBlur={handleSaleUrlBlur}
                          InputProps={{
                            readOnly: saleUrlReadOnly,
                            endAdornment: saleUrlReadOnly ? (
                              <InputAdornment position="end">
                                <Tooltip title="Edit sale URL slug">
                                  <IconButton
                                    aria-label="Edit sale URL slug"
                                    edge="end"
                                    size="small"
                                    onClick={unlockSaleUrl}
                                  >
                                    <IconifyIcon icon="material-symbols:edit-outline-rounded" fontSize={20} />
                                  </IconButton>
                                </Tooltip>
                              </InputAdornment>
                            ) : null,
                          }}
                          inputProps={{ maxLength: 150 }}
                          helperText={
                            saleUrlReadOnly
                              ? 'URL segment is locked once populated.'
                              : 'URL segment used in the shop product URL, e.g. ovation-guitar-crate-amp-package'
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField
                          fullWidth
                          required
                          label="Sale ZIP"
                          value={form.saleZip}
                          onChange={(event) => setField('saleZip', event.target.value)}
                          inputProps={{ maxLength: 10 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.clearance}
                              onChange={(event) => setField('clearance', event.target.checked)}
                            />
                          }
                          label="Clearance"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Bullet 1 Text"
                          value={form.bullet1Text}
                          onChange={(event) => setField('bullet1Text', event.target.value)}
                          inputProps={{ maxLength: 60 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet1Danger}
                              onChange={(event) => setField('bullet1Danger', event.target.checked)}
                            />
                          }
                          label="Show in Red?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet1Highlight}
                              onChange={(event) => setField('bullet1Highlight', event.target.checked)}
                            />
                          }
                          label="Highlight Bullet?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Bullet 2 Text"
                          value={form.bullet2Text}
                          onChange={(event) => setField('bullet2Text', event.target.value)}
                          inputProps={{ maxLength: 60 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet2Danger}
                              onChange={(event) => setField('bullet2Danger', event.target.checked)}
                            />
                          }
                          label="Show in Red?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet2Highlight}
                              onChange={(event) => setField('bullet2Highlight', event.target.checked)}
                            />
                          }
                          label="Highlight Bullet?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Bullet 3 Text"
                          value={form.bullet3Text}
                          onChange={(event) => setField('bullet3Text', event.target.value)}
                          inputProps={{ maxLength: 60 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet3Danger}
                              onChange={(event) => setField('bullet3Danger', event.target.checked)}
                            />
                          }
                          label="Show in Red?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet3Highlight}
                              onChange={(event) => setField('bullet3Highlight', event.target.checked)}
                            />
                          }
                          label="Highlight Bullet?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Bullet 4 Text"
                          value={form.bullet4Text}
                          onChange={(event) => setField('bullet4Text', event.target.value)}
                          inputProps={{ maxLength: 60 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet4Danger}
                              onChange={(event) => setField('bullet4Danger', event.target.checked)}
                            />
                          }
                          label="Show in Red?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet4Highlight}
                              onChange={(event) => setField('bullet4Highlight', event.target.checked)}
                            />
                          }
                          label="Highlight Bullet?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Bullet 5 Text"
                          value={form.bullet5Text}
                          onChange={(event) => setField('bullet5Text', event.target.value)}
                          inputProps={{ maxLength: 60 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet5Danger}
                              onChange={(event) => setField('bullet5Danger', event.target.checked)}
                            />
                          }
                          label="Show in Red?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet5Highlight}
                              onChange={(event) => setField('bullet5Highlight', event.target.checked)}
                            />
                          }
                          label="Highlight Bullet?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Bullet 6 Text"
                          value={form.bullet6Text}
                          onChange={(event) => setField('bullet6Text', event.target.value)}
                          inputProps={{ maxLength: 60 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet6Danger}
                              onChange={(event) => setField('bullet6Danger', event.target.checked)}
                            />
                          }
                          label="Show in Red?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={form.bullet6Highlight}
                              onChange={(event) => setField('bullet6Highlight', event.target.checked)}
                            />
                          }
                          label="Highlight Bullet?"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={handleGenerateLargeTag}
                          disabled={isGeneratingTag}
                          startIcon={
                            isGeneratingTag ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <IconifyIcon icon="material-symbols:inventory-2-outline-rounded" fontSize={18} />
                            )
                          }
                        >
                          Gen. Large Tag
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Button fullWidth variant="contained" disabled>
                          Future Tag
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Button fullWidth variant="contained" disabled>
                          Future Tag
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Button fullWidth variant="contained" disabled>
                          Future Tag
                        </Button>
                      </Grid>
                    </Grid>
                </Paper>
              </Grid>

              {GUITAR_CATEGORY_NAMES.has(selectedCategoryName) ? (
                <>
                  <Grid size={12}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                      Guitar Specs
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Weight (lbs)"
                      value={form.weightLbs}
                      onChange={(event) => setField('weightLbs', event.target.value)}
                      inputProps={{ maxLength: 10 }}
                      placeholder='e.g. 9.5'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Neck Profile"
                      value={form.neckProfile}
                      onChange={(event) => setField('neckProfile', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder="e.g. C Shape (modern, rounded)"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Neck Thickness"
                      value={form.neckThickness}
                      onChange={(event) => setField('neckThickness', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 0.86"–0.95"+ (chunky)'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Nut Width"
                      value={form.nutWidth}
                      onChange={(event) => setField('nutWidth', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 1.69" (standard)'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Neck Width (12th Fret)"
                      value={form.width12Fret}
                      onChange={(event) => setField('width12Fret', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 2.06"'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Fretboard Radius"
                      value={form.fretboardRadius}
                      onChange={(event) => setField('fretboardRadius', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 9.5" → modern Fender'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="12th Fret Action"
                      value={form.twelveFretAction}
                      onChange={(event) => setField('twelveFretAction', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. ~4/64"–5/64"'
                    />
                  </Grid>
                </>
              ) : null}

              <Grid size={12}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                  This Unit Only
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.isSold}
                        onChange={(event) => setField('isSold', event.target.checked)}
                      />
                    }
                    label="Is Sold"
                  />
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Sold Amount"
                  type="number"
                  value={form.soldAmount}
                  onChange={(event) => setField('soldAmount', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              {form.isSold ? (
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Qty Sold"
                    type="number"
                    value={form.qtySold}
                    disabled={form.quantity <= 1}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      const nextValue = Number.isFinite(parsed)
                        ? Math.min(Math.max(1, parsed), Math.max(1, form.quantity))
                        : 1;
                      setField('qtySold', nextValue);
                    }}
                    inputProps={{ min: 1, max: Math.max(1, form.quantity), step: 1 }}
                  />
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Sold Channel"
                  value={form.soldChannel}
                  onChange={(event) => setField('soldChannel', event.target.value)}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="FBM">FBM</MenuItem>
                  <MenuItem value="CL">CL</MenuItem>
                  <MenuItem value="CCG External Web">CCG External Web</MenuItem>
                  <MenuItem value="CCG In-Store">CCG In-Store</MenuItem>
                  <MenuItem value="Reverb">Reverb</MenuItem>
                  <MenuItem value="OfferUp">OfferUp</MenuItem>
                  <MenuItem value="EBay">EBay</MenuItem>
                  <MenuItem value="Nextdoor">Nextdoor</MenuItem>
                  <MenuItem value="Sweetwater Gear Exchange">Sweetwater Gear Exchange</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Sell Notes"
                  value={form.sellNotes}
                  onChange={(event) => setField('sellNotes', event.target.value)}
                  inputProps={{ maxLength: 4000 }}
                />
              </Grid>

              <Grid size={12}>
                <Box sx={{ pt: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting || isUploading || isImporting}
                    onClick={handleSubmitWithSoldCheck}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <IconifyIcon icon="material-symbols:save-outline-rounded" />
                      )
                    }
                  >
                    {isSubmitting ? 'Saving...' : submitLabel}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        )}
      </Box>

      <Dialog open={upcLookupOpen} onClose={closeUpcLookupDialog} fullWidth maxWidth="md">
        <DialogTitle>UPC Lookup</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Barcode"
                  value={form.barcode.trim()}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Brand"
                  value={upcLookupBrand}
                  onChange={(event) => setUpcLookupBrand(event.target.value)}
                  disabled={isUpcSearching}
                >
                  <MenuItem value="DUNLOP">Dunlop</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => void handleUpcLookupGo()}
                  disabled={isUpcSearching}
                  startIcon={
                    isUpcSearching ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <IconifyIcon icon="material-symbols:search-rounded" />
                    )
                  }
                  sx={{ minHeight: 56 }}
                >
                  Go
                </Button>
              </Grid>
            </Grid>

            {isUpcSearching ? (
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 5 }} spacing={1.5}>
                <CircularProgress size={24} />
                <Typography sx={{ color: 'text.secondary' }}>Searching...</Typography>
              </Stack>
            ) : upcLookupData ? (
              <TextField
                fullWidth
                multiline
                minRows={12}
                maxRows={18}
                label="UPC JSON"
                value={JSON.stringify(upcLookupData, null, 2)}
                InputProps={{ readOnly: true }}
                sx={notesFieldSx}
              />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Select a brand and click Go to lookup UPC data.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUpcLookupDialog} disabled={isUpcSearching || isImporting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handlePopulateFromUpc()}
            disabled={!upcLookupData || isUpcSearching || isImporting}
          >
            {isImporting ? 'Importing Images...' : 'Populate'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="lg">
        <DialogContent sx={{ p: 1, bgcolor: 'background.default' }}>
          {previewImage ? (
            <Box
              component="img"
              src={previewImage}
              alt="Inventory preview"
              sx={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh' }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={profitTargetsOpen} onClose={() => setProfitTargetsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Profit Targets</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            {profitTargetRows.map((row) => (
              <Stack
                key={row.label}
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {row.label}:
                </Typography>
                <Typography variant="subtitle2">
                  {row.value != null ? formatMoney(row.value) : 'Enter paid amount'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfitTargetsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={aiAnalysisDialogOpen} onClose={closeAiAnalysisDialog} fullWidth maxWidth="md">
        <DialogTitle>AI Analysis</DialogTitle>
        <DialogContent dividers sx={{ display: 'block' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              rowGap: 2,
              width: 1,
            }}
          >
            <Box sx={{ width: 1 }}>
              <Typography variant="caption" color="text.secondary">Enter rich text content</Typography>
              <Box
                ref={setAiAnalysisEditorNode}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => {
                  const html = (event.currentTarget as HTMLDivElement).innerHTML;
                  setAiAnalysisDraft(html);
                }}
                sx={{
                  mt: 0.75,
                  minHeight: 320,
                  maxHeight: 520,
                  overflowY: 'auto',
                  width: 1,
                  borderRadius: 1.5,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  color: 'text.primary',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  '&:focus': {
                    outline: 'none',
                    borderColor: 'primary.main',
                  },
                  '& p, & ul, & ol, & blockquote, & h3, & h4': {
                    mt: 0,
                    mb: 1,
                  },
                  '&[contenteditable=\"true\"]:empty:before': {
                    content: '\"Paste formatted content here\"',
                    color: 'text.disabled',
                  },
                }}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 1, width: 1 }}>
              <Button variant="outlined" onClick={closeAiAnalysisDialog} sx={{ width: 1 }}>
                Cancel
              </Button>
              <Button variant="contained" onClick={saveAiAnalysisDraft} sx={{ width: 1 }}>
                Save
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={soldConfirmOpen} onClose={() => setSoldConfirmOpen(false)}>
        <DialogTitle>Mark as sold</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to mark this item sold. Parts of this process cannot be undone. Proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSoldConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => doSubmit()} color="error" variant="contained">
            Mark Sold & Save
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={duplicateConfirmOpen} onClose={() => !isDuplicating && setDuplicateConfirmOpen(false)}>
        <DialogTitle>Duplicate product</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to duplicate this product?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateConfirmOpen(false)} disabled={isDuplicating}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirmDuplicate()}
            variant="contained"
            disabled={isDuplicating}
          >
            {isDuplicating ? 'Duplicating...' : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default InventoryItem;
