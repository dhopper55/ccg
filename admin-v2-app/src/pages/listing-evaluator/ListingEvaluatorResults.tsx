import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  ChipOwnProps,
  CircularProgress,
  IconButton,
  Link,
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
import { useNavigate } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import paths from 'routes/paths';

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
  message?: string;
};

type ListingGridRow = {
  id: string;
  title: string;
  url?: string;
  sourceLabel: string;
  sourceImageSrc: string | null;
  statusLabel: string;
  statusColor: ChipOwnProps['color'];
  askingPriceLabel: string;
  imageSrc: string | null;
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
    return { label: 'FBM', imageSrc: '/images/fb.png' };
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return { label: 'CL', imageSrc: '/images/cl.png' };
  }
  return { label: source?.trim() || 'Unknown', imageSrc: null };
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
  return paths.listingEvaluatorItemWithId(encodeURIComponent(id));
}

const ListingEvaluatorResults = () => {
  const [records, setRecords] = useState<ListingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const { down } = useBreakpoints();
  const navigate = useNavigate();
  const downSm = down('sm');

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
          statusLabel: record.status?.trim() || 'unknown',
          statusColor: buildStatusColor(record.status),
          askingPriceLabel: formatCurrencyValue(record.askingPrice),
          imageSrc: buildImageSrc(record.imageUrl, record.url),
        };
      }),
    [records],
  );

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
          <Typography variant="h4">Listing Evaluator Results</Typography>

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
      </Paper>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Paper sx={{ flex: 1, p: { xs: 2, md: 5 }, minWidth: 0, overflow: 'hidden' }}>
        {downSm ? (
          <Stack direction="column" spacing={2} sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ px: 0.5 }}>
              Results
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
                        </Stack>
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1.5,
                        minWidth: 0,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', minWidth: 0, flexShrink: 1 }}
                      >
                        {row.sourceImageSrc ? (
                          <Avatar
                            variant="rounded"
                            src={row.sourceImageSrc}
                            alt={row.sourceLabel}
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: 'background.elevation1',
                              '& img': {
                                objectFit: 'contain',
                                width: 20,
                                height: 20,
                              },
                            }}
                          />
                        ) : null}
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                        >
                          {row.sourceLabel}
                        </Typography>
                      </Stack>

                      <Tooltip title="Inv. Add">
                        <IconButton
                          aria-label="Inv. Add"
                          color="primary"
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 2.5,
                            bgcolor: 'background.elevation1',
                            border: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <IconifyIcon icon="material-symbols:add-rounded" fontSize={18} />
                        </IconButton>
                      </Tooltip>
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
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
                        <CircularProgress size={28} />
                        <Typography sx={{ color: 'text.secondary' }}>Loading results…</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
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
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {row.sourceImageSrc ? (
                          <Avatar
                            variant="rounded"
                            src={row.sourceImageSrc}
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
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {row.sourceLabel}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Inv. Add">
                          <IconButton
                            aria-label="Inv. Add"
                            color="primary"
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 2.5,
                              bgcolor: 'background.elevation1',
                              border: 1,
                              borderColor: 'divider',
                            }}
                          >
                            <IconifyIcon icon="material-symbols:add-rounded" fontSize={18} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
};

export default ListingEvaluatorResults;
