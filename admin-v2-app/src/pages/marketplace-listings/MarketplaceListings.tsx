import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
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
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useNavigate } from 'react-router';
import paths from 'routes/paths';

type MarketplaceRecord = {
  id: string;
  source: string;
  title: string;
  priceDollars: number;
  currency: string;
  imageUrl: string;
  listingUrl: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type MarketplaceListResponse = {
  records?: MarketplaceRecord[];
  message?: string;
};

const PAGE_SIZE = 20;

function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

const MarketplaceListings = () => {
  const navigate = useNavigate();
  const { down } = useBreakpoints();
  const downSm = down('sm');
  const [records, setRecords] = useState<MarketplaceRecord[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Current Marketplace Listings';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch('/api/marketplace-listings', {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as MarketplaceListResponse;

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load marketplace listings.');
        }

        if (cancelled) return;

        const nextRecords = Array.isArray(data.records) ? data.records : [];
        setRecords(nextRecords);
        setPage((current) => {
          const totalPages = Math.max(1, Math.ceil(nextRecords.length / PAGE_SIZE));
          return Math.min(current, totalPages);
        });
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setPage(1);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load marketplace listings.',
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(records.length / PAGE_SIZE)), [records]);

  const visibleRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [page, records]);

  const pageLabel = useMemo(() => {
    if (records.length === 0) return 'Page 1 of 1 • 0 total listings';
    return `Page ${Math.min(page, totalPages)} of ${totalPages} • ${records.length} total listings`;
  }, [page, records.length, totalPages]);

  const renderActionButtons = (record: MarketplaceRecord) => (
    <Stack direction="row" spacing={0.5}>
      <Tooltip title="Edit">
        <IconButton
          size="small"
          aria-label="Edit listing"
          sx={{ color: 'text.secondary' }}
          onClick={() => navigate(paths.marketplaceListingItemWithId(record.id))}
        >
          <IconifyIcon icon="material-symbols:edit-outline-rounded" fontSize={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete coming soon">
        <span>
          <IconButton
            size="small"
            disabled
            aria-label="Delete listing"
            sx={{ color: 'text.secondary' }}
          >
            <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  const renderDesktopTable = () => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '100%' }}>Title</TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              Price
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
                  <Typography sx={{ color: 'text.secondary' }}>
                    Loading marketplace listings…
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : visibleRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3}>
                <Typography sx={{ py: 4, color: 'text.secondary' }}>
                  No marketplace listings found.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            visibleRecords.map((record) => (
              <TableRow key={record.id} hover>
                <TableCell>
                  <Stack direction="row" sx={{ gap: 2, alignItems: 'center', minWidth: 0 }}>
                    <Avatar
                      variant="rounded"
                      src={record.imageUrl || undefined}
                      alt={record.title || 'Marketplace listing'}
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
                    <Typography
                      sx={{
                        display: 'block',
                        fontWeight: 500,
                        fontSize: 'subtitle2.fontSize',
                        lineHeight: 1.4,
                      }}
                    >
                      {record.title || '—'}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(record.priceDollars, record.currency)}
                </TableCell>
                <TableCell align="right">{renderActionButtons(record)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderMobileCards = () => (
    <Stack direction="column" spacing={2}>
      {isLoading ? (
        <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
          <CircularProgress size={28} />
          <Typography sx={{ color: 'text.secondary' }}>Loading marketplace listings…</Typography>
        </Stack>
      ) : visibleRecords.length === 0 ? (
        <Typography sx={{ py: 4, color: 'text.secondary' }}>
          No marketplace listings found.
        </Typography>
      ) : (
        visibleRecords.map((record) => (
          <Paper
            key={record.id}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: 'background.default',
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <Avatar
                  variant="rounded"
                  src={record.imageUrl || undefined}
                  alt={record.title || 'Marketplace listing'}
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
                  <Typography variant="subtitle2">{record.title || '—'}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {formatCurrency(record.priceDollars, record.currency)}
                  </Typography>
                </Box>
              </Stack>
              <Box>{renderActionButtons(record)}</Box>
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
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
          <Typography variant="h4">Current Marketplace Listings</Typography>

          <Tooltip title="Add coming soon">
            <IconButton
              aria-label="Add"
              color="success"
              onClick={() => navigate(paths.marketplaceListingItem)}
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'success.main',
                bgcolor: 'success.main',
                color: 'common.white',
                '&:hover': {
                  bgcolor: 'success.dark',
                },
              }}
            >
              <IconifyIcon icon="material-symbols:add-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Box sx={{ flex: 1, p: { xs: 2, md: 5 }, minWidth: 0, overflow: 'hidden' }}>
        <Stack direction="column" spacing={3}>
          {downSm ? renderMobileCards() : renderDesktopTable()}

          {!isLoading ? (
            <Stack
              direction="row"
              sx={{
                gap: 2,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {pageLabel}
              </Typography>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  startIcon={<IconifyIcon icon="material-symbols:chevron-left-rounded" />}
                >
                  Previous
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  endIcon={<IconifyIcon icon="material-symbols:chevron-right-rounded" />}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
};

export default MarketplaceListings;
