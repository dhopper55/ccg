import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

type ShopStatisticEventType = '' | 'product_view' | 'search' | 'add_to_cart' | 'checkout_start';

type ShopStatisticRecord = {
  id: number;
  eventType: string;
  inventoryItemId: number | null;
  sessionId: string;
  pagePath: string;
  referrer: string;
  userAgent: string;
  country: string;
  colo: string;
  isSuspicious: boolean;
  metadataJson: string;
  createdAt: string;
  inventoryTitle: string;
  ccgNumber: string;
};

type ShopStatisticsResponse = {
  records: ShopStatisticRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  message?: string;
};

const EVENT_TYPE_OPTIONS: Array<{ value: ShopStatisticEventType; label: string }> = [
  { value: '', label: 'All events' },
  { value: 'product_view', label: 'Product views' },
  { value: 'search', label: 'Searches' },
  { value: 'add_to_cart', label: 'Adds to cart' },
  { value: 'checkout_start', label: 'Checkout starts' },
];

function formatEventLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown';
}

function formatTimestampMountain(value: string): string {
  if (!value) return '-';
  const isoValue = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(isoValue.endsWith('Z') ? isoValue : `${isoValue}Z`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed).replace(',', '');
}

function classifySource(referrer: string): { label: string; color: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error' } {
  if (!referrer) return { label: 'Direct', color: 'default' };
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'coalcreekguitars.com') {
      if (url.pathname.startsWith('/decoders/')) return { label: 'Serial Decoders', color: 'warning' };
      if (url.pathname.startsWith('/guitars-and-gear-for-sale/')) return { label: 'Product List', color: 'info' };
      return { label: 'Our Site', color: 'secondary' };
    }
  } catch {
    // invalid referrer URL
  }
  return { label: 'Internet', color: 'success' };
}

const ShopStatistics = () => {
  const [records, setRecords] = useState<ShopStatisticRecord[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState<ShopStatisticEventType>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ShopStatisticRecord | null>(null);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  useEffect(() => {
    document.title = 'CCG Admin | Shop Statistics';
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadStatistics = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('page', String(page + 1));
        params.set('limit', String(rowsPerPage));
        params.set('sortDir', sortDir);
        if (search) params.set('q', search);
        if (eventType) params.set('eventType', eventType);
        params.set('_', String(Date.now()));

        const response = await fetch(`/api/admin-v2/shop-statistics?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });

        const data = (await response.json()) as ShopStatisticsResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load shop statistics.');
        }

        if (cancelled) return;
        setRecords(Array.isArray(data.records) ? data.records : []);
        setTotal(Number(data.total || 0));
        setPage(Math.max(0, Number(data.page || 1) - 1));
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setTotal(0);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load shop statistics.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadStatistics();

    return () => {
      cancelled = true;
    };
  }, [eventType, page, refreshKey, rowsPerPage, search, sortDir]);

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;

    setDeletingIds((current) => [...current, target.id]);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/admin-v2/shop-statistics/${target.id}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || 'Unable to delete shop statistic event.');
      }

      setDeleteTarget(null);
      setRecords((current) => current.filter((record) => record.id !== target.id));
      setTotal((current) => Math.max(0, current - 1));
      if (records.length === 1 && page > 0) {
        setPage((current) => Math.max(0, current - 1));
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete shop statistic event.');
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== target.id));
    }
  };

  const pageSummary = useMemo(() => {
    if (total === 0) return '0 events';
    const start = page * rowsPerPage + 1;
    const end = Math.min((page + 1) * rowsPerPage, total);
    return `${start}-${end} of ${total} events`;
  }, [page, rowsPerPage, total]);

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', mb: 3 }}
        >
          <Box>
            <Typography variant="h4">Shop Statistics</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {pageSummary}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
            <TextField
              size="small"
              label="Search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              sx={{ minWidth: { xs: 1, sm: 280 } }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: 1, sm: 180 } }}>
              <InputLabel id="shop-statistics-event-type-label">Event</InputLabel>
              <Select
                labelId="shop-statistics-event-type-label"
                value={eventType}
                label="Event"
                onChange={(event) => {
                  setPage(0);
                  setEventType(event.target.value as ShopStatisticEventType);
                }}
              >
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<IconifyIcon icon="material-symbols:refresh-rounded" />}
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active
                    direction={sortDir}
                    onClick={() => setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))}
                  >
                    Time
                  </TableSortLabel>
                </TableCell>
                <TableCell>Event</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Product</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
                      <CircularProgress size={28} />
                      <Typography sx={{ color: 'text.secondary' }}>Loading shop statistics...</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography sx={{ py: 4, color: 'text.secondary' }}>
                      No shop events match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const productLabel = record.inventoryTitle || record.ccgNumber || (
                    record.inventoryItemId ? `Inventory #${record.inventoryItemId}` : '-'
                  );
                  return (
                    <TableRow key={record.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {formatTimestampMountain(record.createdAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          #{record.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Chip size="small" label={formatEventLabel(record.eventType)} />
                          {record.isSuspicious ? (
                            <Tooltip title="Flagged as suspicious traffic">
                              <Box component="span" sx={{ color: 'warning.main', display: 'inline-flex' }}>
                                <IconifyIcon icon="material-symbols:warning-outline-rounded" fontSize={18} />
                              </Box>
                            </Tooltip>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontWeight={600}>
                          {productLabel}
                        </Typography>
                        {record.ccgNumber && record.inventoryTitle ? (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {record.ccgNumber}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const src = classifySource(record.referrer);
                          return (
                            <Tooltip title={record.referrer || 'No referrer'}>
                              <Chip size="small" label={src.label} color={src.color} />
                            </Tooltip>
                          );
                        })()}
                        {[record.country, record.colo].filter(Boolean).length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {[record.country, record.colo].filter(Boolean).join(' / ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Hard delete event">
                          <span>
                            <IconButton
                              color="error"
                              disabled={deletingIds.includes(record.id)}
                              onClick={() => setDeleteTarget(record)}
                            >
                              <IconifyIcon icon="material-symbols:delete-outline-rounded" />
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
        </TableContainer>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'flex-end', mt: 2 }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="shop-statistics-rows-label">Rows</InputLabel>
            <Select
              labelId="shop-statistics-rows-label"
              value={String(rowsPerPage)}
              label="Rows"
              onChange={(event) => {
                setRowsPerPage(Number.parseInt(event.target.value, 10));
                setPage(0);
              }}
            >
              {[10, 20, 50, 100].map((value) => (
                <MenuItem key={value} value={String(value)}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            {pageSummary}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
            <Button
              variant="outlined"
              size="small"
              disabled={page <= 0 || isLoading}
              startIcon={<IconifyIcon icon="material-symbols:chevron-left-rounded" />}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={(page + 1) * rowsPerPage >= total || isLoading}
              endIcon={<IconifyIcon icon="material-symbols:chevron-right-rounded" />}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Hard delete shop event?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This permanently removes event #{deleteTarget?.id} from D1. It cannot be restored from the admin screen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteTarget ? deletingIds.includes(deleteTarget.id) : false}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ShopStatistics;
