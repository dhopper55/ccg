import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  ChipOwnProps,
  CircularProgress,
  IconButton,
  Link,
  Paper,
  Select,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import paths from 'routes/paths';

type ListingListItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  archiveReason?: string | null;
  askingPrice?: number | string;
  imageUrl?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ListingsResponse = {
  records: ListingListItem[];
  nextOffset?: string | null;
  total?: number;
  message?: string;
};

type ListingGridRow = {
  id: string;
  title: string;
  url?: string;
  sourceLabel: string;
  sourceImageSrc: string | null;
  sourceIcon: string | null;
  statusLabel: string;
  statusColor: ChipOwnProps['color'];
  isQueued: boolean;
  canRequeue: boolean;
  askingPriceLabel: string;
  imageSrc: string | null;
};

const PAGE_SIZE = 20;
const REQUEUE_DELAY_MS = 5 * 60 * 1000;
const ARCHIVE_REASON_OPTIONS = ['Overpriced', 'Not Desirable', 'Repair Needs', 'Too Far', 'Old/Stale', 'Other'] as const;
const headerActions = [
  { label: 'Results', icon: 'material-symbols:list-alt-rounded', color: 'default' as const },
  {
    label: 'Saved Results',
    icon: 'material-symbols:bookmark-outline-rounded',
    color: 'primary' as const,
  },
  {
    label: 'Archived Results',
    icon: 'material-symbols:archive-outline-rounded',
    color: 'error' as const,
  },
  { label: 'Refresh', icon: 'material-symbols:refresh-rounded', color: 'success' as const },
];

function formatCurrencyValue(value: number | string | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  const trimmed = String(value).trim();
  if (!trimmed) return '';
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

function buildImageSrc(imageUrl?: string | null, referrer?: string): string | null {
  if (!imageUrl) return null;
  const cleaned = imageUrl.trim().split(/\s+/)[0];
  if (!cleaned) return null;

  const normalized = cleaned.toLowerCase();
  if (
    normalized.includes('fbcdn.net') ||
    normalized.includes('scontent-') ||
    normalized.includes('scontent.')
  ) {
    const params = new URLSearchParams();
    params.set('url', cleaned);
    if (referrer) params.set('ref', referrer);
    return buildCloudflareImageSrc(new URL(`/api/image?${params.toString()}`, window.location.origin).toString(), 180);
  }

  return buildCloudflareImageSrc(cleaned, 180);
}

function buildCloudflareImageSrc(imageUrl: string, width: number): string {
  const options = `fit=scale-down,width=${width},quality=80,format=auto,onerror=redirect`;
  if (imageUrl.startsWith('/cdn-cgi/image/')) return imageUrl;
  if (imageUrl.startsWith('/api/')) return `/cdn-cgi/image/${options}${imageUrl}`;

  try {
    const parsed = new URL(imageUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) return imageUrl;
    return `${parsed.origin}/cdn-cgi/image/${options}${parsed.pathname}${parsed.search}`;
  } catch {
    return imageUrl;
  }
}

function buildSourceMeta(source?: string): { label: string; imageSrc: string | null; icon: string | null } {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
    return { label: 'FBM', imageSrc: '/images/fb.png', icon: null };
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return { label: 'CL', imageSrc: '/images/cl.png', icon: null };
  }
  if (normalized === 'reverb' || normalized === 'r' || normalized.includes('reverb')) {
    return { label: 'Reverb', imageSrc: '/admin/images/reverb-icon.svg', icon: null };
  }
  if (normalized === 'custom') {
    return {
      label: 'Custom',
      imageSrc: null,
      icon: 'material-symbols:photo-camera-rounded',
    };
  }
  return { label: source?.trim() || 'Unknown', imageSrc: null, icon: null };
}

function buildStatusColor(status?: string): ChipOwnProps['color'] {
  const normalized = status?.trim().toLowerCase() || '';
  if (normalized === 'complete' || normalized === 'completed') return 'success';
  if (normalized === 'failed' || normalized === 'error') return 'error';
  if (normalized === 'queued' || normalized === 'processing') return 'warning';
  return 'neutral';
}

function buildDisplayTitle(record: ListingListItem): string {
  return record.title?.trim() || record.url?.replace(/^https?:\/\//i, '') || 'Untitled listing';
}

function buildDetailsHref(id: string): string {
  return paths.listingEvaluatorItemWithId(id);
}

function parseListingTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

function getLatestQueueTime(record: ListingListItem): number | null {
  const times = [record.updatedAt, record.submittedAt, record.createdAt]
    .map(parseListingTimestamp)
    .filter((time): time is number => time != null);
  return times.length ? Math.max(...times) : null;
}

const ListingEvaluatorResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<ListingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requeueingIds, setRequeueingIds] = useState<Set<string>>(() => new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { down } = useBreakpoints();
  const navigate = useNavigate();
  const downSm = down('sm');
  const savedView = searchParams.get('saved') === '1';
  const archivedView = !savedView && searchParams.get('archived') === '1';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const titleSearch = archivedView ? searchParams.get('titleSearch') || '' : '';
  const archiveReason = archivedView ? searchParams.get('archiveReason') || '' : '';
  const currentOffset = (page - 1) * PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currentViewLabel = archivedView
    ? 'Archived Results'
    : savedView
      ? 'Saved Results'
      : 'Listing Evaluator Results';

  useEffect(() => {
    document.title = `CCG Admin | ${currentViewLabel}`;
  }, [currentViewLabel]);

  const loadListings = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(currentOffset));
      if (savedView) params.set('showSaved', '1');
      if (archivedView) params.set('showArchived', '1');
      if (archivedView && titleSearch.trim()) params.set('titleSearch', titleSearch.trim());
      if (archivedView && archiveReason) params.set('archiveReason', archiveReason);
      const response = await fetch(`/api/listings?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as ListingsResponse;

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load listing evaluator results.');
      }

      setRecords(Array.isArray(data.records) ? data.records : []);
      setNextOffset(data.nextOffset ?? null);
      setTotal(Number(data.total || 0));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load listing evaluator results.',
      );
      setRecords([]);
      setNextOffset(null);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
  }, [archivedView, archiveReason, currentOffset, savedView, titleSearch]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const updateView = (view: 'results' | 'saved' | 'archived') => {
    const params = new URLSearchParams();
    if (view === 'saved') params.set('saved', '1');
    if (view === 'archived') params.set('archived', '1');
    setSearchParams(params);
  };

  const updatePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }
    setSearchParams(params);
  };

  const updateArchivedFilters = (nextTitleSearch: string, nextArchiveReason: string) => {
    const params = new URLSearchParams(searchParams);
    if (nextTitleSearch.trim()) {
      params.set('titleSearch', nextTitleSearch);
    } else {
      params.delete('titleSearch');
    }
    if (nextArchiveReason) {
      params.set('archiveReason', nextArchiveReason);
    } else {
      params.delete('archiveReason');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const requeueListing = async (row: ListingGridRow) => {
    if (!row.url || requeueingIds.has(row.id)) return;

    setErrorMessage('');
    setSuccessMessage('');
    setRequeueingIds((current) => new Set(current).add(row.id));

    try {
      const response = await fetch('/api/listings/reprocess', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: row.url }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Unable to re-queue listing.');
      }

      setSuccessMessage('Listing re-queued.');
      await loadListings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to re-queue listing.');
    } finally {
      setRequeueingIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  const rows = useMemo<ListingGridRow[]>(
    () =>
      records.map((record, index) => {
        const sourceMeta = buildSourceMeta(record.source);
        return {
          id: record.id || record.url || `${index}`,
          title: buildDisplayTitle(record),
          url: record.url,
          sourceLabel: sourceMeta.label,
          sourceImageSrc: sourceMeta.imageSrc,
          sourceIcon: sourceMeta.icon,
          statusLabel: record.status?.trim() || 'unknown',
          statusColor: buildStatusColor(record.status),
          isQueued: (record.status?.trim().toLowerCase() || '') === 'queued',
          canRequeue:
            (record.status?.trim().toLowerCase() || '') === 'queued' &&
            (() => {
              const latestQueueTime = getLatestQueueTime(record);
              return latestQueueTime == null || nowMs - latestQueueTime > REQUEUE_DELAY_MS;
            })(),
          askingPriceLabel: formatCurrencyValue(record.askingPrice),
          imageSrc: buildImageSrc(record.imageUrl, record.url),
        };
      }),
    [nowMs, records],
  );

  return (
    <Stack direction="column" height={1} gap={3} sx={{ minWidth: 0 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{
              gap: 2,
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h4">{currentViewLabel}</Typography>

            <Stack
              direction="row"
              sx={{
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              }}
            >
              {headerActions.map((action) => (
                <Tooltip key={action.label} title={action.label}>
                  <IconButton
                    aria-label={action.label}
                    onClick={() => {
                      if (action.label === 'Results') {
                        updateView('results');
                        return;
                      }
                      if (action.label === 'Saved Results') {
                        updateView('saved');
                        return;
                      }
                      if (action.label === 'Archived Results') {
                        updateView('archived');
                        return;
                      }
                      if (action.label === 'Refresh') {
                        void loadListings();
                      }
                    }}
                    sx={{
                      width: 40,
                      height: 40,
                      border: 1,
                      borderColor:
                        action.color === 'default' ? 'divider' : `${action.color}.main`,
                      bgcolor:
                        action.color === 'default'
                          ? 'background.elevation1'
                          : `${action.color}.main`,
                      color: action.color === 'default' ? 'text.primary' : 'common.white',
                      '&:hover': {
                        bgcolor:
                          action.color === 'default'
                            ? 'background.elevation2'
                            : `${action.color}.dark`,
                      },
                    }}
                  >
                    <IconifyIcon icon={action.icon} fontSize={20} />
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>
          </Stack>

          {archivedView ? (
            <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
              <TextField
                value={titleSearch}
                onChange={(event) => updateArchivedFilters(event.target.value, archiveReason)}
                placeholder="Search by title"
                size="small"
                fullWidth
              />
              <Select
                value={archiveReason}
                onChange={(event) => updateArchivedFilters(titleSearch, String(event.target.value))}
                size="small"
                displayEmpty
                fullWidth
                renderValue={(value) =>
                  value ? String(value) : <Box sx={{ color: 'text.disabled' }}>Archive Reason</Box>
                }
              >
                <MenuItem value="">Archive Reason</MenuItem>
                {ARCHIVE_REASON_OPTIONS.map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      {successMessage && <Alert severity="success">{successMessage}</Alert>}

      <Paper sx={{ flex: 1, p: { xs: 2, md: 5 }, minWidth: 0, overflow: 'hidden' }}>
        {downSm ? (
          <Stack direction="column" spacing={2} sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ px: 0.5 }}>
              {currentViewLabel}
            </Typography>

            {isLoading ? (
              <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
                <CircularProgress size={28} />
                <Typography sx={{ color: 'text.secondary' }}>Loading results…</Typography>
              </Stack>
            ) : rows.length === 0 ? (
              <Typography sx={{ py: 4, color: 'text.secondary' }}>
                No listing evaluator results found.
              </Typography>
            ) : (
              rows.map((row) => (
                <Paper
                  key={row.id}
                  variant="outlined"
                  onClick={() => navigate(buildDetailsHref(row.id))}
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 3,
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <Stack direction="column" spacing={2} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                      <Avatar
                        variant="rounded"
                        src={row.imageSrc || undefined}
                        alt={row.title}
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: 2.5,
                          bgcolor: 'background.elevation1',
                          flexShrink: 0,
                        }}
                      >
                        <IconifyIcon icon="material-symbols:image-outline-rounded" />
                      </Avatar>

                      <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Link
                              underline="none"
                              color="text.primary"
                              href={buildDetailsHref(row.id)}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                navigate(buildDetailsHref(row.id));
                              }}
                              sx={{
                                display: 'block',
                                fontWeight: 500,
                                lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'unset',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                          }}
                        >
                          {row.title}
                        </Link>

                        <Stack
                          direction="row"
                          sx={{
                            mt: 1,
                            gap: 0.75,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          {row.askingPriceLabel && (
                            <Chip
                              label={row.askingPriceLabel}
                              size="small"
                              color="primary"
                              variant="soft"
                            />
                          )}
                          <Chip
                            label={row.statusLabel}
                            size="small"
                            color={row.statusColor}
                            variant="soft"
                            sx={{ textTransform: 'capitalize' }}
                          />
                          {row.canRequeue && (
                            <Tooltip title="Re-queue listing">
                              <span>
                                <IconButton
                                  aria-label="Re-queue listing"
                                  size="small"
                                  disabled={requeueingIds.has(row.id)}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void requeueListing(row);
                                  }}
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    border: 1,
                                    borderColor: 'warning.main',
                                    color: 'warning.main',
                                  }}
                                >
                                  {requeueingIds.has(row.id) ? (
                                    <CircularProgress size={14} color="inherit" />
                                  ) : (
                                    <IconifyIcon icon="material-symbols:refresh-rounded" fontSize={16} />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      {row.sourceImageSrc || row.sourceIcon ? (
                        <Avatar
                          variant="rounded"
                          src={row.sourceImageSrc || undefined}
                          alt={row.sourceLabel}
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'background.elevation1',
                            '& img': { objectFit: 'contain', width: 20, height: 20 },
                          }}
                        >
                          {row.sourceImageSrc ? null : row.sourceIcon ? (
                            <IconifyIcon icon={row.sourceIcon} fontSize={18} />
                          ) : null}
                        </Avatar>
                      ) : null}
                      <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {row.sourceLabel}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '100%' }}>Title</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    Source
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
                        <CircularProgress size={28} />
                        <Typography sx={{ color: 'text.secondary' }}>Loading results…</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography sx={{ py: 4, color: 'text.secondary' }}>
                        No listing evaluator results found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => navigate(buildDetailsHref(row.id))}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Stack direction="row" sx={{ gap: 2, alignItems: 'center', minWidth: 0 }}>
                          <Avatar
                            variant="rounded"
                            src={row.imageSrc || undefined}
                            alt={row.title}
                            sx={{
                              width: 56,
                              height: 56,
                              borderRadius: 2.5,
                              bgcolor: 'background.elevation1',
                              flexShrink: 0,
                            }}
                          >
                            <IconifyIcon icon="material-symbols:image-outline-rounded" />
                          </Avatar>

                          <Box sx={{ minWidth: 0 }}>
                            <Link
                              underline="none"
                              color="text.primary"
                              href={buildDetailsHref(row.id)}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                navigate(buildDetailsHref(row.id));
                              }}
                              sx={{
                                display: 'block',
                                fontWeight: 500,
                                fontSize: 'subtitle2.fontSize',
                                lineHeight: 1.4,
                              }}
                            >
                              {row.title}
                            </Link>

                            <Stack direction="row" sx={{ mt: 0.75, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              {row.askingPriceLabel && (
                                <Chip
                                  label={row.askingPriceLabel}
                                  size="small"
                                  color="primary"
                                  variant="soft"
                                />
                              )}
                              <Chip
                                label={row.statusLabel}
                                size="small"
                                color={row.statusColor}
                                variant="soft"
                                sx={{ textTransform: 'capitalize' }}
                              />
                              {row.canRequeue && (
                                <Tooltip title="Re-queue listing">
                                  <span>
                                    <IconButton
                                      aria-label="Re-queue listing"
                                      size="small"
                                      disabled={requeueingIds.has(row.id)}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void requeueListing(row);
                                      }}
                                      sx={{
                                        width: 28,
                                        height: 28,
                                        border: 1,
                                        borderColor: 'warning.main',
                                        color: 'warning.main',
                                      }}
                                    >
                                      {requeueingIds.has(row.id) ? (
                                        <CircularProgress size={14} color="inherit" />
                                      ) : (
                                        <IconifyIcon icon="material-symbols:refresh-rounded" fontSize={16} />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {row.sourceImageSrc || row.sourceIcon ? (
                          <Avatar
                            variant="rounded"
                            src={row.sourceImageSrc || undefined}
                            alt={row.sourceLabel}
                            sx={{
                              width: 36,
                              height: 36,
                              mx: 'auto',
                              bgcolor: 'background.elevation1',
                              '& img': {
                                objectFit: 'contain',
                                width: 22,
                                height: 22,
                              },
                            }}
                          >
                            {row.sourceImageSrc ? null : row.sourceIcon ? (
                              <IconifyIcon icon={row.sourceIcon} fontSize={20} />
                            ) : null}
                          </Avatar>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {row.sourceLabel}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!isLoading && total > 0 ? (
          <Stack
            direction="row"
            sx={{
              mt: 3,
              gap: 2,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Page {Math.min(page, totalPages)} of {totalPages} • {total} total items
            </Typography>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                disabled={page <= 1}
                onClick={() => updatePage(page - 1)}
                startIcon={<IconifyIcon icon="material-symbols:chevron-left-rounded" />}
              >
                Previous
              </Button>
              <Button
                variant="contained"
                color="primary"
                disabled={!nextOffset || rows.length < PAGE_SIZE || page >= totalPages}
                onClick={() => updatePage(page + 1)}
                endIcon={<IconifyIcon icon="material-symbols:chevron-right-rounded" />}
              >
                Next
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Paper>
    </Stack>
  );
};

export default ListingEvaluatorResults;
