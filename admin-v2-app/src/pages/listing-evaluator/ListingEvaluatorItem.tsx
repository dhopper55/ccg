import { Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type ListingRecordResponse = {
  id: string;
  fields: Record<string, unknown>;
  normalizedLists?: Record<string, string[]>;
  message?: string;
};

type MessageState = {
  severity: 'success' | 'error';
  text: string;
};

type DetailItem = {
  label: string;
  value: ReactNode;
};

type FieldConfig = {
  key: string;
  label: string;
  currency?: boolean;
};

const SINGLE_FIELDS: FieldConfig[] = [
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'finish', label: 'Finish' },
  { key: 'year', label: 'Year' },
  { key: 'condition', label: 'Condition' },
  { key: 'serial', label: 'Serial' },
  { key: 'serial_brand', label: 'Serial Brand' },
  { key: 'serial_year', label: 'Serial Year' },
  { key: 'serial_model', label: 'Serial Model' },
  { key: 'value_private_party_low', label: 'Private Party Low', currency: true },
  { key: 'value_private_party_medium', label: 'Private Party Medium', currency: true },
  { key: 'value_private_party_high', label: 'Private Party High', currency: true },
  { key: 'pricing_confidence', label: 'Pricing Confidence' },
  { key: 'value_pawn_shop_notes', label: 'Pawn Shop Notes' },
  { key: 'known_weak_points', label: 'Known Weak Points' },
  { key: 'typical_repair_needs', label: 'Typical Repair Needs' },
  { key: 'buyers_worry', label: 'Buyer Worries' },
  { key: 'og_specs_pickups', label: 'Original Pickups' },
  { key: 'og_specs_tuners', label: 'Original Tuners' },
  { key: 'og_specs_common_mods', label: 'Common Mods' },
  { key: 'buyer_what_to_check', label: 'Buyer: What to Check' },
  { key: 'buyer_common_misrepresent', label: 'Buyer: Common Misrepresentation' },
  { key: 'seller_how_to_price_realistic', label: 'Seller: Price Realistically' },
  { key: 'seller_fixes_add_value_or_waste', label: 'Seller: Fixes That Add Value or Waste' },
  { key: 'seller_as_is_notes', label: 'Seller: As-Is Notes' },
];

const INLINE_DETAIL_KEYS = new Set(['category', 'brand', 'model', 'finish', 'year', 'condition']);

function normalizeValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '—';
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function formatCurrencyValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (trimmed.includes('$')) return trimmed;
    const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(numeric);
    }
    return trimmed;
  }
  return String(value);
}

function formatMountainTimestamp(date: Date): string {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const datePart = dateFormatter.format(date);
  const timeParts = timeFormatter.formatToParts(date);
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '';
  const dayPeriod = timeParts.find((part) => part.type === 'dayPeriod')?.value ?? '';
  const timePart =
    hour && minute && dayPeriod
      ? `${hour}:${minute}${dayPeriod}`
      : timeFormatter.format(date).replace(' ', '');
  return `${datePart} ${timePart} MST`;
}

function formatSubmittedAt(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (!trimmed.includes('T') && /\b(MST|MDT|MT)\b/i.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return formatMountainTimestamp(parsed);
    return trimmed;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatMountainTimestamp(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatMountainTimestamp(new Date(value));
  }
  return String(value);
}

function formatSourceLabel(value: unknown): string {
  const raw = normalizeValue(value);
  if (raw === '—') return raw;
  const normalized = raw.toLowerCase();
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
    return 'FBM';
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return 'CG';
  }
  if (normalized === 'reverb' || normalized === 'r' || normalized.includes('reverb')) {
    return 'Reverb';
  }
  return raw;
}

function buildSourceImage(source?: string): string | null {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
    return '/images/fb.png';
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return '/images/cl.png';
  }
  if (normalized === 'reverb' || normalized === 'r' || normalized.includes('reverb')) {
    return '/admin/images/reverb-icon.svg';
  }
  return null;
}

function buildSourceGlyph(source?: string): string | null {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized === 'custom') {
    return 'material-symbols:photo-camera-rounded';
  }
  return null;
}

function buildImageSrc(imageUrl: string, referrer?: string): string {
  const cleaned = imageUrl.trim().split(/\s+/)[0];
  const normalized = cleaned.toLowerCase();
  if (
    normalized.includes('fbcdn.net') ||
    normalized.includes('scontent-') ||
    normalized.includes('scontent.')
  ) {
    const params = new URLSearchParams();
    params.set('url', cleaned);
    if (referrer) params.set('ref', referrer);
    return new URL(`/api/image?${params.toString()}`, window.location.origin).toString();
  }
  return cleaned;
}

function extractPhotoCandidates(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function getImageCandidates(fields: Record<string, unknown>): string[] {
  const photos = extractPhotoCandidates(fields.photos);
  const singleImage = typeof fields.image_url === 'string' ? fields.image_url.trim() : '';
  return Array.from(new Set([...photos, singleImage].filter(Boolean)));
}

function cleanSearchToken(value: unknown): string {
  const raw = normalizeValue(value);
  if (raw === '—') return '';
  let cleaned = raw.replace(/\(NOT DEFINITIVE\)/gi, '');
  cleaned = cleaned.replace(/\bEstimated\s+range\s*:?\s*/gi, '');
  cleaned = cleaned.replace(/\bGuess:\s*/gi, '');
  cleaned = cleaned.replace(/\bUnknown\b/gi, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

function formatYearRangeToken(value: string): string {
  if (!value) return value;
  const match = value.match(/(\d{4})s?\s*(?:[-–—]|to)\s*(\d{4})s?/i);
  if (!match) return value;
  return `${match[1]}-${match[2]}'s`;
}

function toAbsolutePublicUrl(url: string): string {
  // Convert R2-backed listing image URLs to the public R2 domain (bypasses Cloudflare bot protection)
  const listingImageMatch = url.match(/\/api\/listing-image\?key=(.+)/);
  if (listingImageMatch) {
    return `https://images.coalcreekguitars.com/${decodeURIComponent(listingImageMatch[1])}`;
  }
  if (url.startsWith('/api/')) {
    return `https://www.coalcreekguitars.com${url}`;
  }
  return url;
}

function buildAiQueryTexts(fields: Record<string, unknown>, imageUrls: string[]): string[] {
  if (imageUrls.length === 0) return [];

  const publicUrls = imageUrls.slice(0, 9).map(toAbsolutePublicUrl);
  const chunks: string[][] = [];
  for (let i = 0; i < publicUrls.length; i += 3) {
    chunks.push(publicUrls.slice(i, i + 3));
  }

  const rawBrand = typeof fields.brand === 'string' ? fields.brand.trim() : '';
  const rawModel = typeof fields.model === 'string' ? fields.model.trim() : '';

  const isDefinitiveBrand =
    rawBrand !== '' &&
    !/\(NOT DEFINITIVE\)/i.test(rawBrand) &&
    !/^Unknown$/i.test(rawBrand) &&
    !/^Guess:/i.test(rawBrand);
  const isDefinitiveModel =
    rawModel !== '' &&
    !/\(NOT DEFINITIVE\)/i.test(rawModel) &&
    !/^Unknown$/i.test(rawModel) &&
    !/^Guess:/i.test(rawModel);

  let brandSuffix = '';
  if (isDefinitiveBrand && isDefinitiveModel) {
    const brand = rawBrand.replace(/\s+/g, ' ').trim();
    const model = rawModel.replace(/\s+/g, ' ').trim();
    brandSuffix = ` I think it is a ${brand} ${model}, but I could be wrong.`;
  }

  const texts: string[] = [];
  texts.push(`What is this and what's it worth? ${chunks[0].join(', ')}.${brandSuffix}`);
  for (let i = 1; i < chunks.length; i++) {
    texts.push(`Here are some additional images: ${chunks[i].join(', ')}.`);
  }
  return texts;
}

function buildDoubleCheckQuery(
  fields: Record<string, unknown>,
  options: { includeGuitar?: boolean } = {},
): string {
  const year = formatYearRangeToken(cleanSearchToken(fields.year));
  const brand = cleanSearchToken(fields.brand);
  const model = cleanSearchToken(fields.model);
  const finish = cleanSearchToken(fields.finish);
  const parts = [year, brand, model, finish].filter(Boolean);
  const suffix = options.includeGuitar ? 'guitar used value' : 'used value';
  return `${parts.join(' ')} ${suffix}`.trim();
}

function buildStatusColor(status?: string): 'success' | 'error' | 'warning' | 'neutral' {
  const normalized = status?.trim().toLowerCase() || '';
  if (normalized === 'complete' || normalized === 'completed') return 'success';
  if (normalized === 'failed' || normalized === 'error') return 'error';
  if (normalized === 'queued' || normalized === 'processing') return 'warning';
  return 'neutral';
}

function parseMoneyValue(input: unknown): number | null {
  const normalized = normalizeValue(input);
  if (normalized === '—') return null;
  const cleaned = normalized.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatPrivateRange(fields: Record<string, unknown>): string {
  const lowValue = parseMoneyValue(fields.value_private_party_low);
  const highValue = parseMoneyValue(fields.value_private_party_high);
  if (lowValue != null && highValue != null) {
    return `${formatCurrencyValue(lowValue)} - ${formatCurrencyValue(highValue)}`;
  }
  return normalizeValue(fields.price_private_party);
}

function formatIdealPrice(fields: Record<string, unknown>): string {
  const direct = formatCurrencyValue(fields.price_ideal);
  if (direct !== '—') return direct;
  const lowValue = parseMoneyValue(fields.value_private_party_low);
  return lowValue != null ? formatCurrencyValue(Math.round(lowValue * 0.8)) : '—';
}

function formatTextParts(value: unknown): string[] {
  const normalized = normalizeValue(value);
  if (normalized === '—') return [];

  const cleaned = normalized
    .replace(/\bGeneral:\s*/gi, '')
    .replace(/[\u061B\uFF1B\uFE54\u037E]/g, ';')
    .trim();

  const hasBulletMarkers = /[•●▪◦]/.test(cleaned) || /(?:^|\n)\s*[-*]\s+/.test(cleaned);

  if (hasBulletMarkers) {
    return cleaned
      .replace(/[•●▪◦]\s*/g, '\n• ')
      .replace(/(?:^|\n)\s*[-*]\s+/g, '\n• ')
      .split(/\r?\n/)
      .map((part) => part.replace(/^[-–—•*]+\s*/g, '').trim())
      .filter(Boolean)
      .filter((part) => !/^unknown\.?$/i.test(part));
  }

  return cleaned
    .split(/\s*;\s*|\r?\n/g)
    .map((part) => part.replace(/^[-–—•*]+\s*/g, '').trim())
    .filter(Boolean)
    .filter((part) => !/^unknown\.?$/i.test(part));
}

function buildTextNode(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    const parts = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length === 0) return '—';
    if (parts.length === 1) return parts[0];

    return (
      <Stack spacing={1} sx={{ minWidth: 0, width: 1 }}>
        {parts.map((part) => (
          <Typography
            key={part}
            variant="body2"
            sx={{
              color: 'text.secondary',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              width: 1,
            }}
          >
            {`• ${part}`}
          </Typography>
        ))}
      </Stack>
    );
  }

  const parts = formatTextParts(value);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0];

  return (
    <Stack spacing={1} sx={{ minWidth: 0, width: 1 }}>
      {parts.map((part) => (
        <Typography
          key={part}
          variant="body2"
          sx={{
            color: 'text.secondary',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            width: 1,
          }}
        >
          {`• ${part}`}
        </Typography>
      ))}
    </Stack>
  );
}

function buildSummaryNode(text: string): ReactNode {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '—';

  return (
    <Stack spacing={1.25}>
      {lines.map((line, index) => {
        const bulletText = line.replace(/^[-•*–]\s+/, '');
        const isBullet = bulletText !== line;
        return (
          <Typography
            key={`${index}-${bulletText}`}
            variant="body2"
            sx={{
              color: 'text.secondary',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {isBullet ? `• ${bulletText}` : bulletText}
          </Typography>
        );
      })}
    </Stack>
  );
}

const DetailRow = ({ label, value }: DetailItem) => (
  <Stack
    direction="row"
    spacing={1}
    sx={{ alignItems: 'flex-start', minWidth: 0, width: 1 }}
  >
    <Typography
      variant="body2"
      sx={{
        fontWeight: 'bold',
        width: { xs: 156, md: 170 },
        flexShrink: 0,
        wordBreak: 'break-word',
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        fontWeight: 'bold',
        color: 'text.secondary',
        px: 0.5,
        flexShrink: 0,
        display: { xs: 'none', md: 'block' },
      }}
    >
      :
    </Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      {typeof value === 'string' ? (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Typography>
      ) : (
        value
      )}
    </Box>
  </Stack>
);

const DetailSection = ({ title, items }: { title: string; items: DetailItem[] }) => {
  if (items.length === 0) return null;

  return (
    <Stack direction="column" gap={3}>
      <Typography variant="h6">{title}</Typography>
      <Grid container columnSpacing={1} rowSpacing={1}>
        {items.map((item) => (
          <Grid key={item.label} size={12}>
            <DetailRow label={item.label} value={item.value} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};

const StackedDetailSection = ({ items }: { items: DetailItem[] }) => {
  const visibleItems = items.filter((item) => item.value !== '—');

  if (visibleItems.length === 0) return null;

  return (
    <Stack direction="column" gap={3}>
      {visibleItems.map((item) => (
        <Stack key={item.label} direction="column" gap={1.25} sx={{ minWidth: 0, width: 1 }}>
          <Typography variant="h6">{item.label}</Typography>
          <Box sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            {typeof item.value === 'string' ? (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {item.value}
              </Typography>
            ) : (
              item.value
            )}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

const InlineDetailSection = ({ items }: { items: DetailItem[] }) => {
  const visibleItems = items.filter((item) => item.value !== '—');

  if (visibleItems.length === 0) return null;

  return (
    <Stack direction="column" gap={2}>
      {visibleItems.map((item) => (
        <Stack
          key={item.label}
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: { xs: 0.75, sm: 3 }, alignItems: { sm: 'baseline' }, minWidth: 0 }}
        >
          <Typography
            variant="h6"
            sx={{ minWidth: { sm: 180 }, flexShrink: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {item.label}
          </Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {typeof item.value === 'string' ? (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {item.value}
              </Typography>
            ) : (
              item.value
            )}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

const ListingEvaluatorItem = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const recordId = routeId || searchParams.get('id') || '';
  const [record, setRecord] = useState<ListingRecordResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  useEffect(() => {
    document.title = 'CCG Admin | Listing Detail';
  }, []);

  useEffect(() => {
    if (!recordId) {
      setIsLoading(false);
      setMessage({
        severity: 'error',
        text: 'Missing listing ID. Return to the results page and select a listing.',
      });
      return;
    }

    let isActive = true;

    const loadRecord = async () => {
      setIsLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/admin-v2/listings/${encodeURIComponent(recordId)}`, {
          credentials: 'same-origin',
        });
        const data = (await response.json()) as ListingRecordResponse;

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load listing.');
        }

        if (!isActive) return;
        setRecord(data);
      } catch (error) {
        if (!isActive) return;
        setRecord(null);
        setMessage({
          severity: 'error',
          text: error instanceof Error ? error.message : 'Unable to load listing.',
        });
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadRecord();

    return () => {
      isActive = false;
    };
  }, [recordId]);

  const fields = record?.fields || {};
  const title = normalizeValue(fields.title) === '—' ? 'Listing Detail' : normalizeValue(fields.title);
  const sourceLabel = formatSourceLabel(fields.source);
  const sourceImage = buildSourceImage(typeof fields.source === 'string' ? fields.source : '');
  const sourceGlyph = buildSourceGlyph(typeof fields.source === 'string' ? fields.source : '');
  const statusLabel = normalizeValue(fields.status);
  const statusColor = buildStatusColor(typeof fields.status === 'string' ? fields.status : '');
  const askingPrice = formatCurrencyValue(fields.price_asking);
  const privateRange = formatPrivateRange(fields);
  const idealPrice = formatIdealPrice(fields);
  const listingUrl =
    typeof fields.url === 'string' &&
    fields.url.trim() &&
    !fields.url.startsWith('custom-item://') &&
    !fields.url.startsWith('custom-listing://') &&
    String(fields.source || '').trim().toLowerCase() !== 'custom'
      ? fields.url.trim()
      : '';
  const imageCandidates = useMemo(() => getImageCandidates(fields), [fields]);
  const saved = isTruthyFlag(fields.saved);
  const archived = isTruthyFlag(fields.archived);
  const isMulti = isTruthyFlag(fields.IsMulti);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentImageUrl = imageCandidates.length > 0 ? buildImageSrc(imageCandidates[currentImageIndex] || imageCandidates[0], listingUrl) : '';
  const hasMultipleImages = imageCandidates.length > 1;
  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : imageCandidates.length - 1));
  }, [imageCandidates.length]);
  const handleNextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev < imageCandidates.length - 1 ? prev + 1 : 0));
  }, [imageCandidates.length]);

  const aiQueryTexts = useMemo(() => buildAiQueryTexts(fields, imageCandidates), [fields, imageCandidates]);
  const [aiCopiedIndex, setAiCopiedIndex] = useState<number | null>(null);
  const handleAiQueryCopy = useCallback((index: number) => {
    const text = aiQueryTexts[index];
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setAiCopiedIndex(index);
      setTimeout(() => setAiCopiedIndex(null), 2000);
    });
  }, [aiQueryTexts]);

  const googleQuery = buildDoubleCheckQuery(fields);
  const googleGuitarQuery = buildDoubleCheckQuery(fields, { includeGuitar: true });
  const normalizedLists = record?.normalizedLists || {};
  const getV2FieldValue = (fieldKey: string): unknown => normalizedLists[fieldKey] ?? fields[fieldKey];

  const aiSummary = useMemo(() => {
    const parts: string[] = [];
    for (let index = 1; index <= 10; index += 1) {
      const key = index === 1 ? 'ai_summary' : `ai_summary${index}`;
      const value = fields[key];
      if (typeof value === 'string' && value.trim()) parts.push(value.trim());
    }
    return parts.join('\n\n');
  }, [fields]);

  useEffect(() => {
    if (record) {
      document.title = `CCG Admin | ${title}`;
    }
  }, [record, title]);

  const overviewItems = useMemo<DetailItem[]>(
    () => [
      {
        label: 'Source',
        value: sourceImage || sourceGlyph ? (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            {sourceImage ? (
              <Box
                component="img"
                src={sourceImage}
                alt={sourceLabel}
                sx={{ width: 22, height: 22, objectFit: 'contain' }}
              />
            ) : sourceGlyph ? (
              <IconifyIcon icon={sourceGlyph} fontSize={20} />
            ) : null}
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {sourceLabel}
            </Typography>
          </Stack>
        ) : (
          sourceLabel
        ),
      },
      { label: 'Status', value: statusLabel },
      { label: 'Submitted', value: formatSubmittedAt(fields.submitted_at) },
      { label: 'Location', value: normalizeValue(fields.location) },
    ],
    [fields.location, fields.submitted_at, sourceGlyph, sourceImage, sourceLabel, statusLabel],
  );

  const marketItems = useMemo<DetailItem[]>(
    () => [
      { label: 'Asking Price', value: askingPrice },
      { label: 'Private Party Range', value: privateRange },
      { label: 'Ideal Price', value: idealPrice },
      { label: 'Pricing Source', value: normalizeValue(fields.pricing_source) },
      { label: 'Pricing Confidence', value: normalizeValue(fields.pricing_confidence) },
      { label: 'Pricing Comp Count', value: normalizeValue(fields.pricing_comp_count) },
      ...aiQueryTexts.map((_, index) => ({
        label: index === 0 ? 'AI Query Copy' : `AI Query Copy ${index + 1}`,
        value: (
          <Tooltip title={aiCopiedIndex === index ? 'Copied!' : 'Copy AI query to clipboard'}>
            <IconButton size="small" onClick={() => handleAiQueryCopy(index)} sx={{ ml: -1 }}>
              <IconifyIcon
                icon={aiCopiedIndex === index ? 'material-symbols:check-rounded' : 'material-symbols:content-copy-outline-rounded'}
                sx={{ fontSize: 18, color: aiCopiedIndex === index ? 'success.main' : 'text.secondary' }}
              />
            </IconButton>
          </Tooltip>
        ),
      })),
    ],
    [aiCopiedIndex, aiQueryTexts, askingPrice, fields.pricing_comp_count, fields.pricing_confidence, fields.pricing_source, handleAiQueryCopy, idealPrice, privateRange],
  );

  const singleDetailItems = useMemo<DetailItem[]>(() => {
    if (isMulti) return [];

    return SINGLE_FIELDS.filter((field) => {
      if (
        normalizeValue(fields.serial) === '—' &&
        ['serial', 'serial_brand', 'serial_year', 'serial_model'].includes(field.key)
      ) {
        return false;
      }
      return normalizeValue(getV2FieldValue(field.key)) !== '—';
    }).map((field) => ({
      label: field.label,
      value: field.currency
        ? formatCurrencyValue(fields[field.key])
        : buildTextNode(getV2FieldValue(field.key)),
    }));
  }, [fields, isMulti, normalizedLists]);

  const singleDetailItemsByKey = useMemo(() => {
    const map = new Map<string, DetailItem>();
    for (const field of SINGLE_FIELDS) {
      const item = singleDetailItems.find((entry) => entry.label === field.label);
      if (item) map.set(field.key, item);
    }
    return map;
  }, [singleDetailItems]);

  const orderedInlineItems = useMemo<DetailItem[]>(
    () =>
      ['category', 'brand', 'model', 'finish', 'year', 'condition']
        .map((key) => singleDetailItemsByKey.get(key))
        .filter((item): item is DetailItem => Boolean(item)),
    [singleDetailItemsByKey],
  );

  const orderedBlockItems = useMemo<DetailItem[]>(
    () =>
      [
        {
          label: 'Listing Text',
          value:
            normalizeValue(fields.description) === '—'
              ? 'No description available.'
              : normalizeValue(fields.description),
        },
        {
          label: 'Summary',
          value: aiSummary ? buildSummaryNode(aiSummary) : 'No AI summary available yet.',
        },
        {
          label: 'Pricing Notes',
          value: buildTextNode(getV2FieldValue('pricing_notes')),
        },
        {
          label: 'Value Online Notes',
          value: buildTextNode(getV2FieldValue('value_online_notes')),
        },
        {
          label: 'Pawn Shop Notes',
          value: buildTextNode(getV2FieldValue('value_pawn_shop_notes')),
        },
        ...[
          'known_weak_points',
          'typical_repair_needs',
          'buyers_worry',
          'og_specs_pickups',
          'og_specs_tuners',
          'og_specs_common_mods',
          'buyer_what_to_check',
          'buyer_common_misrepresent',
          'seller_how_to_price_realistic',
          'seller_fixes_add_value_or_waste',
          'seller_as_is_notes',
        ]
          .map((key) => singleDetailItemsByKey.get(key))
          .filter((item): item is DetailItem => Boolean(item)),
      ].filter((item, index, array): item is DetailItem => {
        if (!item) return false;
        return array.findIndex((candidate) => candidate?.label === item.label) === index;
      }),
    [aiSummary, fields.description, normalizedLists, singleDetailItemsByKey],
  );

  const openExternal = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  };

  const toggleSave = async () => {
    if (!recordId || !record || isSaving) return;
    setIsSaving(true);
    setMessage(null);

    const nextSaved = !saved;

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(recordId)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ saved: nextSaved }),
      });
      const data = (await response.json()) as ListingRecordResponse;

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update saved state.');
      }

      setRecord({
        ...record,
        fields: {
          ...record.fields,
          saved: nextSaved,
        },
      });
      navigate(paths.listingEvaluatorResults);
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Unable to update saved state.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!recordId || !record || isArchiving) return;
    setIsArchiving(true);
    setMessage(null);

    const nextArchived = !archived;

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(recordId)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ archived: nextArchived }),
      });
      const data = (await response.json()) as ListingRecordResponse;

      if (!response.ok) {
        throw new Error(data.message || 'Unable to archive listing.');
      }

      navigate(paths.listingEvaluatorResults);
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Unable to archive listing.',
      });
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: { xs: 4, md: 6 } }}>
        <Stack spacing={2} sx={{ alignItems: 'center', py: 8 }}>
          <CircularProgress size={32} />
          <Typography sx={{ color: 'text.secondary' }}>Loading listing details...</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Grid container>
      <Grid size={12}>
        <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
          <Stack
            sx={{
              gap: 2,
              flexDirection: { xs: 'column', xl: 'row' },
              alignItems: { xl: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Stack spacing={1}>
              <Typography
                variant="h4"
                sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              >
                {title}
              </Typography>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {askingPrice !== '—' && <Chip color="primary" variant="soft" label={askingPrice} />}
                {statusLabel !== '—' && (
                  <Chip
                    color={statusColor}
                    variant="soft"
                    label={statusLabel}
                    sx={{ textTransform: 'capitalize' }}
                  />
                )}
                {saved && <Chip color="info" variant="soft" label="Saved" />}
                {archived && <Chip color="error" variant="soft" label="Archived" />}
              </Stack>
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="soft"
                color="neutral"
                disabled={!listingUrl}
                startIcon={<IconifyIcon icon="material-symbols:open-in-new-rounded" />}
                onClick={() => openExternal(listingUrl)}
              >
                Listing
              </Button>
              <Button
                variant="soft"
                color="neutral"
                disabled={!googleQuery}
                startIcon={<IconifyIcon icon="material-symbols:search-rounded" />}
                onClick={() =>
                  openExternal(`https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`)
                }
              >
                Google
              </Button>
              <Button
                variant="soft"
                color="neutral"
                disabled={!googleGuitarQuery}
                startIcon={<IconifyIcon icon="material-symbols:search-rounded" />}
                onClick={() =>
                  openExternal(
                    `https://www.google.com/search?q=${encodeURIComponent(googleGuitarQuery)}`,
                  )
                }
              >
                Google Guitar
              </Button>
              <Button
                variant="contained"
                color="primary"
                disabled={isSaving}
                onClick={() => void toggleSave()}
                sx={{ minWidth: 44, px: 1.5 }}
              >
                <IconifyIcon
                  icon={
                    saved
                      ? 'material-symbols:bookmark-rounded'
                      : 'material-symbols:bookmark-outline-rounded'
                  }
                />
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={isArchiving}
                onClick={() => void toggleArchive()}
                sx={{ minWidth: 44, px: 1.5 }}
              >
                <IconifyIcon icon="material-symbols:delete-outline-rounded" />
              </Button>
              <Button
                variant="contained"
                color="warning"
                disabled={!recordId}
                onClick={() => navigate(paths.inventoryItemFromListing(recordId))}
                sx={{ minWidth: 44, px: 1.5 }}
              >
                <IconifyIcon icon="material-symbols:sell" />
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Grid>

      <Grid size={12}>
        <Container
          maxWidth={false}
          sx={{ width: 1, maxWidth: 1120, px: { xs: 2, md: 4 }, py: 3, mx: 0 }}
        >
          <Paper
            background={1}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 6,
              outline: 'none',
            }}
          >
            <Stack direction="column" sx={{ gap: 4 }}>
              {message && <Alert severity={message.severity}>{message.text}</Alert>}

              {!record ? (
                <Alert severity="error">Unable to load listing.</Alert>
              ) : (
                <Fragment>
                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    sx={{ gap: 2, alignItems: { lg: 'flex-start' }, minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: { xs: '100%', lg: 'auto' },
                        flexShrink: 0,
                      }}
                    >
                      <Paper
                        variant="outlined"
                        sx={{
                          borderRadius: 5,
                          bgcolor: 'background.default',
                          display: 'inline-block',
                          lineHeight: 0,
                        }}
                      >
                        {currentImageUrl ? (
                          <Box sx={{ position: 'relative' }}>
                            <Link
                              href={currentImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              underline="none"
                              sx={{ display: 'block', lineHeight: 0 }}
                            >
                              <Box
                                component="img"
                                src={currentImageUrl}
                                alt={title}
                                sx={{
                                  display: 'block',
                                  width: { xs: '100%', lg: 270 },
                                  maxWidth: '100%',
                                  height: 'auto',
                                }}
                              />
                            </Link>
                            {hasMultipleImages && (
                              <Stack
                                direction="row"
                                sx={{
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  gap: 1,
                                  mt: 1,
                                }}
                              >
                                <IconButton size="small" onClick={handlePrevImage}>
                                  <IconifyIcon icon="material-symbols:chevron-left-rounded" sx={{ fontSize: 20 }} />
                                </IconButton>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {currentImageIndex + 1} / {imageCandidates.length}
                                </Typography>
                                <IconButton size="small" onClick={handleNextImage}>
                                  <IconifyIcon icon="material-symbols:chevron-right-rounded" sx={{ fontSize: 20 }} />
                                </IconButton>
                              </Stack>
                            )}
                          </Box>
                        ) : (
                          <Stack
                            spacing={1.5}
                            sx={{ alignItems: 'center', justifyContent: 'center', height: 280, p: 3 }}
                          >
                            <IconifyIcon
                              icon="material-symbols:image-outline-rounded"
                              sx={{ fontSize: 48, color: 'text.disabled' }}
                            />
                            <Typography sx={{ color: 'text.secondary' }}>
                              No listing image available
                            </Typography>
                          </Stack>
                        )}
                      </Paper>
                    </Box>

                    <Stack direction="column" sx={{ gap: 2.5, flex: 1, minWidth: 0 }}>
                      <DetailSection title="Listing overview" items={overviewItems} />
                      <DetailSection title="Market snapshot" items={marketItems} />
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack direction="column" sx={{ gap: 3 }}>
                    <StackedDetailSection items={orderedBlockItems.slice(0, 1)} />
                    <InlineDetailSection items={orderedInlineItems} />
                    <StackedDetailSection items={orderedBlockItems.slice(1)} />
                  </Stack>
                </Fragment>
              )}
            </Stack>
          </Paper>
        </Container>
      </Grid>
    </Grid>
  );
};

export default ListingEvaluatorItem;
