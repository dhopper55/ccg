import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
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
  if (normalized.includes('fbcdn.net') || normalized.includes('scontent-') || normalized.includes('scontent.')) {
    const params = new URLSearchParams();
    params.set('url', cleaned);
    if (referrer) params.set('ref', referrer);
    return `/api/image?${params.toString()}`;
  }
  return cleaned;
}

const headerActions = [
  { label: 'Back', icon: 'material-symbols:arrow-back-rounded', color: 'default' as const },
  { label: 'Saved Results', icon: 'material-symbols:bookmark-outline', color: 'primary' as const },
  { label: 'Archived Results', icon: 'material-symbols:archive-outline-rounded', color: 'error' as const },
  { label: 'Refresh', icon: 'material-symbols:refresh-rounded', color: 'success' as const },
  { label: 'Map', icon: 'material-symbols:map-outline-rounded', color: 'default' as const },
];

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

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {headerActions.map((action) => (
              <Tooltip key={action.label} title={action.label}>
                <span>
                  <IconButton
                    color={action.color}
                    onClick={() => {
                      if (action.label === 'Refresh') {
                        window.location.reload();
                      }
                    }}
                    sx={{
                      border: 1,
                      borderColor:
                        action.color === 'default' ? 'divider' : `${action.color}.main`,
                      bgcolor: action.color === 'default' ? 'background.paper' : `${action.color}.main`,
                      color: action.color === 'default' ? 'text.primary' : 'common.white',
                      '&:hover': {
                        bgcolor:
                          action.color === 'default'
                            ? 'background.elevation1'
                            : `${action.color}.dark`,
                      },
                    }}
                  >
                    <IconifyIcon icon={action.icon} sx={{ fontSize: 20 }} />
                  </IconButton>
                </span>
              </Tooltip>
            ))}
          </Stack>
        </Stack>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <Paper
          background={1}
          sx={{
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '70%' }}>Title</TableCell>
                <TableCell sx={{ width: '15%' }}>Source</TableCell>
                <TableCell sx={{ width: '15%' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography sx={{ py: 2, color: 'text.secondary' }}>Loading results…</Typography>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography sx={{ py: 2, color: 'text.secondary' }}>
                      No listing evaluator results found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((record) => {
                  const asking = formatCurrencyValue(record.askingPrice);
                  const displayTitle =
                    record.title?.trim() ||
                    record.url?.replace(/^https?:\/\//i, '') ||
                    'Untitled listing';
                  const imageSrc = buildImageSrc(record.imageUrl, record.url);
                  const source = buildSourceMeta(record.source);

                  return (
                    <TableRow key={record.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 72,
                              height: 72,
                              flexShrink: 0,
                              borderRadius: 2,
                              overflow: 'hidden',
                              bgcolor: 'background.elevation1',
                              border: 1,
                              borderColor: 'divider',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {imageSrc ? (
                              <Box
                                component="img"
                                src={imageSrc}
                                alt={displayTitle}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <IconifyIcon
                                icon="material-symbols:image-outline-rounded"
                                sx={{ fontSize: 28, color: 'text.disabled' }}
                              />
                            )}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                              {displayTitle}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                              {asking && <Chip label={asking} size="small" variant="soft" color="primary" />}
                              {record.status && (
                                <Chip
                                  label={record.status}
                                  size="small"
                                  variant="outlined"
                                  color={record.status.toLowerCase() === 'queued' ? 'warning' : 'default'}
                                />
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={source.label}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 2,
                              bgcolor: 'background.elevation1',
                              border: 1,
                              borderColor: 'divider',
                            }}
                          >
                            {source.imageSrc ? (
                              <Box
                                component="img"
                                src={source.imageSrc}
                                alt={source.label}
                                sx={{ width: 22, height: 22, objectFit: 'contain' }}
                              />
                            ) : (
                              <IconifyIcon
                                icon="material-symbols:link-rounded"
                                sx={{ fontSize: 18, color: 'text.secondary' }}
                              />
                            )}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Inv. Add">
                          <span>
                            <IconButton
                              color="primary"
                              onClick={() => undefined}
                              sx={{
                                border: 1,
                                borderColor: 'divider',
                              }}
                            >
                              <IconifyIcon icon="material-symbols:add-rounded" sx={{ fontSize: 20 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    </Box>
  );
};

export default ListingEvaluatorResults;
