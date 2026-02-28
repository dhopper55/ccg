import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

type ListingListItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  imageUrl?: string | null;
  inInventory?: boolean;
};

type ListingsResponse = {
  records: ListingListItem[];
  nextOffset?: string | null;
  total?: number;
  message?: string;
};

const PAGE_SIZE = 20;

const headerActions = [
  { label: 'Back', icon: 'material-symbols:arrow-back-rounded', color: 'default' as const },
  { label: 'Saved Results', icon: 'material-symbols:bookmark-outline-rounded', color: 'primary' as const },
  { label: 'Archived Results', icon: 'material-symbols:archive-outline-rounded', color: 'error' as const },
  { label: 'Refresh', icon: 'material-symbols:refresh-rounded', color: 'success' as const },
  { label: 'Map', icon: 'material-symbols:map-outline_rounded', color: 'default' as const },
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
    return `/api/image?${params.toString()}`;
  }
  return cleaned;
}

function buildSourceMeta(source?: string): { label: string; imageSrc: string | null } {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
    return { label: 'Facebook Marketplace', imageSrc: '/images/fb.png' };
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return { label: 'Craigslist', imageSrc: '/images/cl.png' };
  }
  return { label: source?.trim() || 'Unknown', imageSrc: null };
}

function buildStatusColor(status?: string): 'success' | 'error' | 'warning' | 'neutral' {
  const normalized = status?.trim().toLowerCase() || '';
  if (normalized === 'complete' || normalized === 'completed') return 'success';
  if (normalized === 'failed' || normalized === 'error') return 'error';
  if (normalized === 'queued' || normalized === 'processing') return 'warning';
  return 'neutral';
}

const ListingEvaluatorResults = () => {
  const [records, setRecords] = useState<ListingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Listing Evaluator Results';
  }, []);

  const loadListings = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      const response = await fetch(`/api/listings?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as ListingsResponse;
      if (!response.ok) {
        throw new Error(data.message || 'Unable to load listing evaluator results.');
      }
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load listing evaluator results.',
      );
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
  }, []);

  const rows = useMemo(() => records, [records]);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}
        >
          <Box>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              Listing Evaluator Results
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Review scraped listings and queue inventory adds from the latest results.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25}>
            {headerActions.map((action) => (
              <Tooltip key={action.label} title={action.label}>
                <IconButton
                  color={action.color}
                  onClick={() => {
                    if (action.label === 'Refresh') {
                      window.location.reload();
                    }
                  }}
                  sx={{
                    width: 52,
                    height: 52,
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
                  <IconifyIcon icon={action.icon} sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Stack>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <Paper
          background={1}
          sx={{
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              px: 3,
              py: 2.5,
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Typography variant="h5">All Results</Typography>
              <Chip label={`${rows.length} rows`} size="small" color="neutral" variant="soft" />
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Latest 20 records from the existing evaluator endpoint
            </Typography>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '64%' }}>Title</TableCell>
                  <TableCell sx={{ width: '18%' }}>Source</TableCell>
                  <TableCell align="right" sx={{ width: '18%' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography sx={{ py: 6, color: 'text.secondary' }}>Loading results…</Typography>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography sx={{ py: 6, color: 'text.secondary' }}>
                        No listing evaluator results found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((record) => {
                    const title =
                      record.title?.trim() ||
                      record.url?.replace(/^https?:\/\//i, '') ||
                      'Untitled listing';
                    const imageSrc = buildImageSrc(record.imageUrl, record.url);
                    const price = formatCurrencyValue(record.askingPrice);
                    const source = buildSourceMeta(record.source);
                    const status = record.status?.trim() || 'unknown';

                    return (
                      <TableRow key={record.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Avatar
                              variant="rounded"
                              src={imageSrc || undefined}
                              alt={title}
                              sx={{
                                width: 72,
                                height: 72,
                                borderRadius: 3,
                                bgcolor: 'background.elevation1',
                                border: 1,
                                borderColor: 'divider',
                                flexShrink: 0,
                              }}
                            >
                              <IconifyIcon
                                icon="material-symbols:image-outline-rounded"
                                sx={{ fontSize: 28, color: 'text.disabled' }}
                              />
                            </Avatar>

                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700, color: 'text.primary', mb: 0.75 }}
                              >
                                {title}
                              </Typography>

                              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                {price && <Chip label={price} size="small" color="primary" variant="soft" />}
                                <Chip
                                  label={status}
                                  size="small"
                                  color={buildStatusColor(record.status)}
                                  variant="soft"
                                />
                              </Stack>
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <Avatar
                              variant="rounded"
                              src={source.imageSrc || undefined}
                              alt={source.label}
                              sx={{
                                width: 40,
                                height: 40,
                                bgcolor: 'background.elevation1',
                                border: 1,
                                borderColor: 'divider',
                                '& img': {
                                  objectFit: 'contain',
                                  width: 22,
                                  height: 22,
                                },
                              }}
                            >
                              <IconifyIcon
                                icon="material-symbols:link-rounded"
                                sx={{ fontSize: 18, color: 'text.secondary' }}
                              />
                            </Avatar>
                            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                              {source.label}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell align="right">
                          <Tooltip title="Inv. Add">
                            <IconButton
                              color="primary"
                              onClick={() => undefined}
                              sx={{
                                width: 42,
                                height: 42,
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.elevation1',
                                '&:hover': {
                                  bgcolor: 'background.elevation2',
                                },
                              }}
                            >
                              <IconifyIcon icon="material-symbols:add-rounded" sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </Box>
  );
};

export default ListingEvaluatorResults;
