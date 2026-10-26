import { Fragment, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';
import { downloadImagesAsZip } from 'lib/imageZip';
import {
  buildClaudeListingEvalPrompt,
  claudePasteBoxSx,
  copyTextToClipboard,
  parseClaudeDesktopPaste,
} from 'lib/claudeDesktopAnalysis';

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

type ArchiveReason =
  | 'Overpriced'
  | 'Not Desirable'
  | 'Repair Needs'
  | 'Too Far'
  | 'Old/Stale'
  | 'I bought it'
  | 'It sold'
  | 'Unresponsive'
  | 'Other';

type DetailItem = {
  label: string;
  value: ReactNode;
};

const ARCHIVE_REASONS: ArchiveReason[] = [
  'Overpriced',
  'Not Desirable',
  'Repair Needs',
  'Too Far',
  'Old/Stale',
  'I bought it',
  'It sold',
  'Unresponsive',
  'Other',
];

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
    return buildCloudflareImageSrc(new URL(`/api/image?${params.toString()}`, window.location.origin).toString(), 1000);
  }
  // Ensure /api/ paths are absolute to avoid SPA base path prefixing
  if (cleaned.startsWith('/api/')) {
    return buildCloudflareImageSrc(new URL(cleaned, window.location.origin).toString(), 1000);
  }
  return buildCloudflareImageSrc(cleaned, 1000);
}

function buildCloudflareImageSrc(imageUrl: string, width: number): string {
  const options = `fit=scale-down,width=${width},quality=85,format=auto,onerror=redirect`;
  if (imageUrl.startsWith('/cdn-cgi/image/')) return imageUrl;

  try {
    const parsed = new URL(imageUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) return imageUrl;
    return `${parsed.origin}/cdn-cgi/image/${options}${parsed.pathname}${parsed.search}`;
  } catch {
    return imageUrl;
  }
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

// Brand/model/year on older listings can hold placeholders from the retired AI step
// ("Unknown", "... (NOT DEFINITIVE)", "Estimated range: ..."); treat those as blank.
function isKnownIdentityValue(value: unknown): boolean {
  const text = typeof value === 'string' ? value.trim() : '';
  return Boolean(text) && !/^unknown$/i.test(text) && !/NOT DEFINITIVE/i.test(text) && !/^estimated range/i.test(text);
}

function buildHtmlPreviewNode(html: string, emptyLabel: string, onClick: () => void): ReactNode {
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
        borderRadius: 1.5,
        p: 1.5,
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
        '& a': {
          color: 'primary.main',
        },
      }}
    >
      {trimmed ? (
        <Box
          sx={{
            color: 'text.secondary',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: trimmed }}
        />
      ) : (
        <Typography
          variant="body2"
          sx={{
            color: 'text.disabled',
            lineHeight: 1.6,
          }}
        >
          {emptyLabel}
        </Typography>
      )}
    </Box>
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

const ListingEvaluatorItem = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const recordId = routeId || searchParams.get('id') || '';
  const [record, setRecord] = useState<ListingRecordResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isAiAnalysisSaving, setIsAiAnalysisSaving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [isAiAnalysisDialogOpen, setIsAiAnalysisDialogOpen] = useState(false);
  const [aiAnalysisDraft, setAiAnalysisDraft] = useState('');
  const aiAnalysisEditorRef = useRef<HTMLDivElement | null>(null);

  const setAiAnalysisEditorNode = useCallback((node: HTMLDivElement | null) => {
    aiAnalysisEditorRef.current = node;
    if (node) {
      node.innerHTML = aiAnalysisDraft || '';
    }
  }, [aiAnalysisDraft]);

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
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentImageUrl = imageCandidates.length > 0 ? buildImageSrc(imageCandidates[currentImageIndex] || imageCandidates[0], listingUrl) : '';
  const hasMultipleImages = imageCandidates.length > 1;
  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : imageCandidates.length - 1));
  }, [imageCandidates.length]);
  const handleNextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev < imageCandidates.length - 1 ? prev + 1 : 0));
  }, [imageCandidates.length]);

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  // Name the ZIP after the title (when given) so it is easy to spot in Downloads.
  const handleDownloadZip = useCallback(async (zipTitle?: string) => {
    if (imageCandidates.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const titleSlug = (zipTitle || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
      await downloadImagesAsZip(
        imageCandidates.map((candidate) => buildImageSrc(candidate, listingUrl)),
        titleSlug ? `${titleSlug}-images.zip` : `listing-images-${record?.id || 'unknown'}.zip`,
      );
    } finally {
      setIsDownloadingZip(false);
    }
  }, [imageCandidates, listingUrl, record]);

  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [evalTitle, setEvalTitle] = useState('');
  const [evalNotes, setEvalNotes] = useState('');
  const [evalDeep, setEvalDeep] = useState(false);
  const [evalOverwrite, setEvalOverwrite] = useState(false);
  const [evalPromptCopied, setEvalPromptCopied] = useState(false);
  const [evalReply, setEvalReply] = useState('');
  const [evalError, setEvalError] = useState('');
  const [isEvalSaving, setIsEvalSaving] = useState(false);
  const evalReplyRef = useRef<HTMLDivElement | null>(null);

  const openEvalDialog = () => {
    setEvalTitle(normalizeValue(fields.title) === '—' ? '' : normalizeValue(fields.title));
    setEvalReply('');
    setEvalPromptCopied(false);
    setEvalError('');
    setEvalDialogOpen(true);
    setMessage(null);
  };

  const copyEvalPrompt = async (event: MouseEvent<HTMLButtonElement>) => {
    setEvalError('');
    const container = event.currentTarget.parentElement || document.body;
    const prompt = buildClaudeListingEvalPrompt({
      title: evalTitle.trim(),
      description: typeof fields.description === 'string' ? fields.description : '',
      notes: evalNotes,
      deep: evalDeep,
      isMulti,
    });
    const copyError = await copyTextToClipboard(prompt, container);
    if (copyError) {
      setEvalError(copyError);
      return;
    }
    setEvalPromptCopied(true);
    await handleDownloadZip(evalTitle.trim());
  };

  // Save Claude's reply to the listing: AI Analysis is replaced when the reply has one, and
  // brand/model/year are filled when blank (or placeholders) unless overwrite is on. Lots
  // with several items get "Various" for brand and model.
  const fillEvalFromClaudeReply = async () => {
    if (!recordId || !record || isEvalSaving) return;
    setEvalError('');
    let parsed: ReturnType<typeof parseClaudeDesktopPaste>;
    try {
      parsed = parseClaudeDesktopPaste(evalReplyRef.current?.innerHTML || '', evalReplyRef.current?.innerText || '');
    } catch (error) {
      setEvalError(error instanceof Error ? error.message : "Unable to read Claude's reply.");
      return;
    }
    const { analysisHtml, fields: replyFields } = parsed;
    const candidates: Record<'brand' | 'model' | 'year', string> = {
      brand: isMulti ? 'Various' : replyFields.brand,
      model: isMulti ? 'Various' : replyFields.model,
      year: isMulti ? '' : replyFields.yearRange,
    };
    const identity: Record<string, string> = {};
    (Object.keys(candidates) as Array<keyof typeof candidates>).forEach((key) => {
      if (candidates[key] && (evalOverwrite || !isKnownIdentityValue(fields[key]))) identity[key] = candidates[key];
    });

    setIsEvalSaving(true);
    try {
      const response = await fetch(`/api/admin-v2/listings/${encodeURIComponent(recordId)}/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ aiAnalysisText: analysisHtml.trim() ? analysisHtml : aiAnalysisText, ...identity }),
      });
      const data = (await response.json()) as { aiAnalysisText?: string; message?: string };
      if (!response.ok) throw new Error(data.message || 'Unable to save the AI analysis.');
      setRecord({
        ...record,
        fields: {
          ...record.fields,
          ...identity,
          ai_analysis_text: typeof data.aiAnalysisText === 'string' ? data.aiAnalysisText : aiAnalysisText,
        },
      });
      const filled = [
        ...(analysisHtml.trim() ? ['AI Analysis'] : []),
        ...Object.keys(identity).map((key) => key[0].toUpperCase() + key.slice(1)),
      ];
      setEvalDialogOpen(false);
      setMessage({
        severity: 'success',
        text: filled.length ? `Saved from Claude: ${filled.join(', ')}.` : 'Nothing new to save from that reply.',
      });
    } catch (error) {
      setEvalError(error instanceof Error ? error.message : 'Unable to save the AI analysis.');
    } finally {
      setIsEvalSaving(false);
    }
  };

  const googleQuery = buildDoubleCheckQuery(fields);
  const googleGuitarQuery = buildDoubleCheckQuery(fields, { includeGuitar: true });
  const aiAnalysisText = useMemo(
    () => (typeof fields.ai_analysis_text === 'string' ? fields.ai_analysis_text.trim() : ''),
    [fields.ai_analysis_text],
  );

  useEffect(() => {
    if (!isAiAnalysisDialogOpen || !aiAnalysisEditorRef.current) return;
    aiAnalysisEditorRef.current.innerHTML = aiAnalysisDraft || '';
  }, [aiAnalysisDraft, isAiAnalysisDialogOpen]);

  useEffect(() => {
    if (record) {
      document.title = `CCG Admin | ${title}`;
    }
  }, [record, title]);

  const openAiAnalysisDialog = useCallback(() => {
    setAiAnalysisDraft(aiAnalysisText);
    setIsAiAnalysisDialogOpen(true);
    setMessage(null);
  }, [aiAnalysisText]);

  const closeAiAnalysisDialog = useCallback(() => {
    if (isAiAnalysisSaving) return;
    setIsAiAnalysisDialogOpen(false);
    setAiAnalysisDraft(aiAnalysisText);
  }, [aiAnalysisText, isAiAnalysisSaving]);

  const saveAiAnalysis = useCallback(async () => {
    if (!recordId || !record || isAiAnalysisSaving) return;
    setIsAiAnalysisSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin-v2/listings/${encodeURIComponent(recordId)}/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ aiAnalysisText: aiAnalysisDraft }),
      });
      const data = (await response.json()) as { aiAnalysisText?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message || 'Unable to save AI analysis.');
      }

      const nextValue = typeof data.aiAnalysisText === 'string' ? data.aiAnalysisText : aiAnalysisDraft;
      setRecord({
        ...record,
        fields: {
          ...record.fields,
          ai_analysis_text: nextValue,
        },
      });
      setAiAnalysisDraft(nextValue);
      setIsAiAnalysisDialogOpen(false);
      setMessage({
        severity: 'success',
        text: 'AI analysis saved.',
      });
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Unable to save AI analysis.',
      });
    } finally {
      setIsAiAnalysisSaving(false);
    }
  }, [aiAnalysisDraft, isAiAnalysisSaving, record, recordId]);

  const overviewItems = useMemo<DetailItem[]>(() => {
    const items: DetailItem[] = [];
    const archiveReason = normalizeValue(fields.archive_reason);

    if (archived && archiveReason !== '—') {
      items.push({ label: 'Archive Reason', value: archiveReason });
    }

    items.push(
      {
        label: 'Source',
        value: sourceImage || sourceGlyph ? (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            {sourceImage ? (
              <Box
                component="img"
                src={sourceImage}
                alt={sourceLabel}
                loading="lazy"
                decoding="async"
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
      { label: 'Asking Price', value: askingPrice },
      ...(isKnownIdentityValue(fields.brand) ? [{ label: 'Brand', value: normalizeValue(fields.brand) }] : []),
      ...(isKnownIdentityValue(fields.model) ? [{ label: 'Model', value: normalizeValue(fields.model) }] : []),
      {
        label: 'AI Analysis',
        value: buildHtmlPreviewNode(
          aiAnalysisText,
          'Click to add AI analysis text.',
          openAiAnalysisDialog,
        ),
      },
    );

    return items;
  }, [
    aiAnalysisText,
    archived,
    askingPrice,
    fields.archive_reason,
    fields.brand,
    fields.location,
    fields.model,
    fields.submitted_at,
    openAiAnalysisDialog,
    sourceGlyph,
    sourceImage,
    sourceLabel,
    statusLabel,
  ]);

  const listingTextItems = useMemo<DetailItem[]>(
    () => [
      {
        label: 'Listing Text',
        value:
          normalizeValue(fields.description) === '—'
            ? 'No description available.'
            : normalizeValue(fields.description),
      },
    ],
    [fields.description],
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

  const submitArchive = async (nextArchived: boolean, archiveReason?: ArchiveReason) => {
    if (!recordId || !record || isArchiving) return;
    setIsArchiving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(recordId)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          archived: nextArchived,
          archiveReason: nextArchived ? archiveReason : null,
        }),
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

  const toggleArchive = async () => {
    if (!recordId || !record || isArchiving) return;

    if (!archived) {
      setArchiveDialogOpen(true);
      return;
    }

    await submitArchive(false);
  };

  const handleArchiveReasonSelect = async (reason: ArchiveReason) => {
    setArchiveDialogOpen(false);
    await submitArchive(true, reason);
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
                variant="soft"
                color="neutral"
                startIcon={<IconifyIcon icon="material-symbols:imagesmode-rounded" />}
                onClick={openEvalDialog}
                disabled={imageCandidates.length === 0}
              >
                AI Analysis From Pics
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
                                loading="lazy"
                                decoding="async"
                                sx={{
                                  display: 'block',
                                  width: { xs: '100%', lg: 270 },
                                  maxWidth: '100%',
                                  height: 'auto',
                                }}
                              />
                            </Link>
                            <Stack
                              direction="row"
                              sx={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                gap: 0.5,
                              }}
                            >
                              <Tooltip title={isDownloadingZip ? 'Downloading…' : 'Download all images as ZIP'}>
                                <IconButton
                                  size="small"
                                  onClick={() => void handleDownloadZip(normalizeValue(fields.title) === '—' ? '' : normalizeValue(fields.title))}
                                  disabled={isDownloadingZip}
                                  sx={{
                                    bgcolor: 'rgba(0,0,0,0.55)',
                                    color: 'common.white',
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                                  }}
                                >
                                  <IconifyIcon
                                    icon={isDownloadingZip ? 'material-symbols:hourglass-top-rounded' : 'material-symbols:folder-zip-outline-rounded'}
                                    sx={{ fontSize: 18 }}
                                  />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                            <Stack
                              direction="row"
                              sx={{
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 1,
                                mt: 1,
                              }}
                            >
                              {hasMultipleImages ? (
                                <>
                                  <IconButton size="small" onClick={handlePrevImage}>
                                    <IconifyIcon icon="material-symbols:chevron-left-rounded" sx={{ fontSize: 20 }} />
                                  </IconButton>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {currentImageIndex + 1} / {imageCandidates.length}
                                  </Typography>
                                  <IconButton size="small" onClick={handleNextImage}>
                                    <IconifyIcon icon="material-symbols:chevron-right-rounded" sx={{ fontSize: 20 }} />
                                  </IconButton>
                                </>
                              ) : (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  1
                                </Typography>
                              )}
                            </Stack>
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
                      <DetailSection title="Listing Data" items={overviewItems} />
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack direction="column" sx={{ gap: 3 }}>
                    <StackedDetailSection items={listingTextItems} />
                  </Stack>
                </Fragment>
              )}
            </Stack>
          </Paper>
        </Container>
      </Grid>

      <Dialog open={evalDialogOpen} onClose={() => !isEvalSaving && setEvalDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>AI Analysis From Pics</DialogTitle>
        <DialogContent dividers sx={{ display: 'block' }}>
          <Stack direction="column" spacing={2} sx={{ width: 1, pt: 1 }}>
            <Typography variant="subtitle2">1. Copy the prompt and download the pics</Typography>
            <TextField
              fullWidth
              autoFocus
              label="Title"
              value={evalTitle}
              onChange={(event) => setEvalTitle(event.target.value)}
              inputProps={{ maxLength: 240 }}
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Additional details (optional)"
              placeholder="e.g. Seller says it buzzes on the low E."
              value={evalNotes}
              onChange={(event) => setEvalNotes(event.target.value)}
              inputProps={{ maxLength: 4000 }}
            />
            <FormControlLabel
              control={<Checkbox checked={evalDeep} onChange={(event) => setEvalDeep(event.target.checked)} />}
              label="Deep Analysis (Claude takes more time on this one)"
            />
            <Button
              variant="outlined"
              onClick={copyEvalPrompt}
              disabled={isDownloadingZip || imageCandidates.length === 0}
              startIcon={
                <IconifyIcon
                  icon={isDownloadingZip ? 'material-symbols:hourglass-top-rounded' : 'material-symbols:content-copy-outline-rounded'}
                />
              }
              sx={{ alignSelf: 'flex-start' }}
            >
              {isDownloadingZip ? 'Downloading pics…' : 'Copy Prompt & Download Pics'}
            </Button>
            {evalPromptCopied ? (
              <Alert severity="success">
                Prompt copied. In Claude desktop, attach the ZIP ({imageCandidates.length} pic
                {imageCandidates.length === 1 ? '' : 's'}), paste the prompt and send. When it finishes, copy the reply
                and paste it below.
              </Alert>
            ) : null}

            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              2. Paste Claude&apos;s response
            </Typography>
            <Box
              ref={evalReplyRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => setEvalReply((event.currentTarget as HTMLDivElement).innerText)}
              sx={claudePasteBoxSx}
            />
            <FormControlLabel
              control={<Checkbox checked={evalOverwrite} onChange={(event) => setEvalOverwrite(event.target.checked)} />}
              label="Overwrite fields that already have values"
            />
            {evalError ? <Alert severity="error">{evalError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setEvalDialogOpen(false)} disabled={isEvalSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void fillEvalFromClaudeReply()}
            disabled={!evalReply.trim() || isEvalSaving}
            startIcon={isEvalSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Fill Fields
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isAiAnalysisDialogOpen}
        onClose={closeAiAnalysisDialog}
        fullWidth
        maxWidth="md"
      >
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
              <Button variant="outlined" disabled={isAiAnalysisSaving} onClick={closeAiAnalysisDialog} sx={{ width: 1 }}>
                Cancel
              </Button>
              <Button variant="contained" disabled={isAiAnalysisSaving} onClick={() => void saveAiAnalysis()} sx={{ width: 1 }}>
                Save
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog
        open={archiveDialogOpen}
        onClose={() => {
          if (!isArchiving) setArchiveDialogOpen(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Archive Reason</DialogTitle>
        <DialogContent>
          <RadioGroup name="archive-reason" value="">
            {ARCHIVE_REASONS.map((reason) => (
              <FormControlLabel
                key={reason}
                value={reason}
                control={<Radio />}
                label={reason}
                disabled={isArchiving}
                onChange={() => {
                  void handleArchiveReasonSelect(reason);
                }}
              />
            ))}
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            color="inherit"
            disabled={isArchiving}
            onClick={() => setArchiveDialogOpen(false)}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default ListingEvaluatorItem;
