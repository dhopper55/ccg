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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import type { PDFForm, PDFFont } from 'pdf-lib';
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
  purchasePrice?: number | null;
  privatePartyValue?: number | null;
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
  forSale?: boolean;
  onlyInStore?: boolean;
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
  purchasePrice: string;
  privatePartyValue: string;
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
  forSale: boolean;
  onlyInStore: boolean;
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

function normalizeImages(images: InventoryImageRecord[]): InventoryImageRecord[] {
  const seen = new Set<string>();
  const normalized = images
    .map((image) => ({
      id: image.id,
      url: typeof image.url === 'string' ? image.url.trim() : '',
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
  purchasePrice: '',
  privatePartyValue: '0',
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
  forSale: false,
  onlyInStore: false,
  isSold: false,
  qtySold: 1,
  soldAmount: '',
  sellNotes: '',
  subscriptionId: '',
  saleUrl: '',
  saleZip: '',
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

function parseTagPrice(value: string): number | null {
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeSaleUrlSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
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

async function buildInventoryTagPdf(formState: FormState): Promise<Blob> {
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
  const aiAnalysisEditorRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
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
  const [wasSoldOnLoad, setWasSoldOnLoad] = useState(false);
  const [soldConfirmOpen, setSoldConfirmOpen] = useState(false);
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

    const initialize = async () => {
      setIsLoading(true);
      setMessage(null);

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
            purchasePrice:
              record.purchasePrice != null ? String(record.purchasePrice) : '',
            privatePartyValue:
              record.privatePartyValue != null ? String(record.privatePartyValue) : '0',
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
            forSale: Boolean(record.forSale),
            onlyInStore: Boolean(record.onlyInStore),
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
          return { ...current, forSale: true, queue: 'For Sale' };
        }
        if (current.forSale && !nextForSale) {
          return { ...current, forSale: false, queue: 'To Sell' };
        }
      }
      return { ...current, [key]: value };
    });
    setMessage(null);
  };

  const updateImages = (nextImages: InventoryImageRecord[]) => {
    setImages(normalizeImages(nextImages));
  };

  const createSavePayload = (nextImages: InventoryImageRecord[]) => ({
    sourceListingId,
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
    purchasePrice: form.purchasePrice.trim(),
    privatePartyValue: form.privatePartyValue.trim() || '0',
    purchaseNotes: form.purchaseNotes.trim(),
    aiAnalysisText: form.aiAnalysisText.trim(),
    isActive: form.isActive,
    isMarked: form.isMarked,
    isPersonal: form.isPersonal,
    isRented: form.isRented,
    forSale: form.forSale,
    onlyInStore: form.onlyInStore,
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
      const blob = await buildInventoryTagPdf(form);
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
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="CCG Number"
                  value={form.ccgNumber}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  label="Purchased Date"
                  type="date"
                  value={form.purchasedDate}
                  onChange={(event) => setField('purchasedDate', event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="How Much Paid? ($)"
                  type="number"
                  value={form.purchasePrice}
                  onChange={(event) => setField('purchasePrice', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Private Party Value ($)"
                  type="number"
                  value={form.privatePartyValue}
                  onChange={(event) => setField('privatePartyValue', event.target.value)}
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
                          value={form.saleUrl}
                          onChange={(event) => setField('saleUrl', sanitizeSaleUrlSlug(event.target.value))}
                          inputProps={{ maxLength: 150 }}
                          helperText="URL segment used in the shop product URL, e.g. ovation-guitar-crate-amp-package"
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
                  <MenuItem value="CCG">CCG</MenuItem>
                  <MenuItem value="Reverb">Reverb</MenuItem>
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
    </Stack>
  );
};

export default InventoryItem;
