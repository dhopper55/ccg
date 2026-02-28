import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
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
  { label: 'Map', icon: 'material-symbols:map-outline-rounded', color: 'default' as const },
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

function buildDisplayTitle(record: ListingListItem): string {
  const title = record.title?.trim() || record.url?.replace(/^https?:\/\//i, '') || 'Untitled listing';
  return title.length > 110 ? `${title.slice(0, 107)}...` : title;
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
          <Typography variant="h3">Listing Evaluator Results</Typography>

          <Stack direction="row" spacing={1.25}>
            {headerActions.map((action) => (
              <Tooltip key={action.label} title={action.label}>
                <IconButton
                  aria-label={action.label}
                  onClick={() => {
                    if (action.label === 'Refresh') {
                      void loadListings();
                    }
                  }}
                  sx={{
                    width: 48,
                    height: 48,
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
              px: { xs: 2.5, md: 3 },
              py: 2.5,
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                All Results
              </Typography>
              <Chip label={`${rows.length} rows`} size="small" color="neutral" variant="soft" />
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Latest 20 records from the evaluator endpoint
            </Typography>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      bgcolor: 'background.default',
                      borderBottomColor: 'divider',
                      color: 'text.secondary',
                      fontSize: 15,
                      fontWeight: 600,
                      py: 2.25,
                    },
                  }}
                >
                  <TableCell sx={{ width: '68%' }}>Title</TableCell>
                  <TableCell align="center" sx={{ width: '14%' }}>
                    Source
                  </TableCell>
                  <TableCell align="right" sx={{ width: '18%' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ borderBottom: 0 }}>
                      <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
                        <CircularProgress size={28} />
                        <Typography sx={{ color: 'text.secondary' }}>Loading results…</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ borderBottom: 0 }}>
                      <Typography sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                        No listing evaluator results found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((record) => {
                    const title = buildDisplayTitle(record);
                    const imageSrc = buildImageSrc(record.imageUrl, record.url);
                    const sourceMeta = buildSourceMeta(record.source);
                    const askingPrice = formatCurrencyValue(record.askingPrice);
                    const statusLabel = record.status?.trim() || 'unknown';

                    return (
                      <TableRow
                        hover
                        key={record.id || record.url || record.title}
                        sx={{
                          '& td': {
                            borderBottomColor: 'divider',
                            py: 2.5,
                          },
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
                            <Avatar
                              src={imageSrc ?? undefined}
                              variant="rounded"
                              sx={{
                                width: 76,
                                height: 76,
                                bgcolor: 'background.elevation2',
                                color: 'text.secondary',
                                borderRadius: 3,
                                flexShrink: 0,
                              }}
                            >
                              <IconifyIcon icon="material-symbols:image-outline-rounded" />
                            </Avatar>

                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="h6"
                                sx={{
                                  mb: 1,
                                  fontWeight: 700,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {title}
                              </Typography>

                              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                {askingPrice && (
                                  <Chip
                                    label={askingPrice}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                )}
                                <Chip
                                  label={statusLabel}
                                  size="small"
                                  color={buildStatusColor(record.status)}
                                  variant="soft"
                                />
                              </Stack>
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell align="center">
                          {sourceMeta.imageSrc ? (
                            <Avatar
                              src={sourceMeta.imageSrc}
                              alt={sourceMeta.label}
                              variant="rounded"
                              sx={{
                                width: 42,
                                height: 42,
                                mx: 'auto',
                                bgcolor: 'background.elevation2',
                              }}
                            />
                          ) : (
                            <Chip label={sourceMeta.label} size="small" variant="outlined" />
                          )}
                        </TableCell>

                        <TableCell align="right">
                          <Tooltip title="Inv. Add">
                            <IconButton
                              aria-label="Inv. Add"
                              sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 3,
                                bgcolor: 'background.elevation1',
                                '&:hover': {
                                  bgcolor: 'background.elevation2',
                                },
                              }}
                            >
                              <IconifyIcon icon="material-symbols:playlist-add-rounded" />
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
