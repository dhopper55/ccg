import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Avatar,
  IconButton,
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
  Tooltip,
  Typography,
  Link,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type InventorySortKey = 'ccgNumber' | 'title' | 'paid' | 'private' | 'soldPrice';
type InventorySortDir = 'asc' | 'desc';

type InventoryRecord = {
  id: string;
  ccgNumber: string;
  title: string;
  imageUrl?: string | null;
  category?: string;
  brand?: string;
  isMarked?: boolean;
  isPersonal?: boolean;
  forSale?: boolean;
  isSold?: boolean;
  purchasePrice?: number | null;
  privatePartyValue?: number | null;
  soldAmount?: number | null;
};

type InventoryListResponse = {
  records: InventoryRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  grouped: boolean;
  drillDownCcgNumber?: string | null;
  availableBrands?: string[];
  message?: string;
};

type InventoryFilters = {
  category: string;
  brand: string;
  sold: boolean;
  active: boolean;
  onlyMarked: boolean;
  onlyPersonal: boolean;
};

const PAGE_SIZE = 20;
const CATEGORY_OPTIONS = [
  'Accessories',
  'Acoustic Bass',
  'Acoustic Guitars',
  'Amplification',
  'Cases & Bags',
  'Effects Pedals',
  'Electric Bass',
  'Electric Guitars',
  'Keyboards & Synthesizers',
  'Packages',
  'Pro Audio',
];

const DEFAULT_FILTERS: InventoryFilters = {
  category: '',
  brand: '',
  sold: false,
  active: true,
  onlyMarked: false,
  onlyPersonal: false,
};

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const InventoryManager = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { down } = useBreakpoints();
  const downSm = down('sm');
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<InventorySortKey>('title');
  const [sortDir, setSortDir] = useState<InventorySortDir>('asc');
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingLabels, setIsDownloadingLabels] = useState(false);
  const [isUnmarkingAll, setIsUnmarkingAll] = useState(false);
  const [isMergingMarked, setIsMergingMarked] = useState(false);
  const [togglingMarkedIds, setTogglingMarkedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [labelsErrorMessage, setLabelsErrorMessage] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Inventory Manager';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInventory = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));
        params.set('sortBy', sortBy);
        params.set('sortDir', sortDir);
        params.set('sold', filters.sold ? '1' : '0');
        params.set('active', filters.active ? '1' : '0');
        params.set('onlyMarked', filters.onlyMarked ? '1' : '0');
        params.set('onlyPersonal', filters.onlyPersonal ? '1' : '0');
        if (filters.category) params.set('category', filters.category);
        if (filters.brand) params.set('brand', filters.brand);

        const response = await fetch(`/api/inventory?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as InventoryListResponse;

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load inventory.');
        }

        if (cancelled) return;

        const nextBrands = Array.isArray(data.availableBrands) ? data.availableBrands : [];
        setRecords(Array.isArray(data.records) ? data.records : []);
        setAvailableBrands(nextBrands);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        setPage(Math.max(1, Number(data.page || 1)));

        if (filters.brand && !nextBrands.includes(filters.brand)) {
          setFilters((current) => ({ ...current, brand: '' }));
        }
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setAvailableBrands([]);
        setTotal(0);
        setTotalPages(1);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load inventory.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInventory();

    return () => {
      cancelled = true;
    };
  }, [filters, page, sortBy, sortDir]);

  const handleSort = (key: InventorySortKey) => {
    setPage(1);
    if (sortBy === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir('asc');
  };

  const handleFilterChange = <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) => {
    setPage(1);
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'category') next.brand = '';
      return next;
    });
  };

  const clearFilters = () => {
    setPage(1);
    setSortBy('title');
    setSortDir('asc');
    setFilters(DEFAULT_FILTERS);
    setActionErrorMessage('');
  };

  const handleDownloadLabels = async () => {
    setIsDownloadingLabels(true);
    setLabelsErrorMessage('');

    try {
      const response = await fetch('/api/admin-v2/inventory/labels.pdf', {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        let message = 'Unable to generate labels PDF.';
        try {
          const data = (await response.json()) as { message?: string };
          if (data?.message) message = data.message;
        } catch {
          // Ignore JSON parse failures and fall back to the default message.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const match = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] || 'ccg-labels.pdf';
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setLabelsErrorMessage(
        error instanceof Error ? error.message : 'Unable to generate labels PDF.',
      );
    } finally {
      setIsDownloadingLabels(false);
    }
  };

  const handleToggleMarked = async (recordId: string, isMarked: boolean) => {
    setActionErrorMessage('');
    setTogglingMarkedIds((current) => [...current, recordId]);
    setRecords((current) =>
      current.map((record) => (record.id === recordId ? { ...record, isMarked } : record)),
    );

    try {
      const response = await fetch(`/api/admin-v2/inventory/${encodeURIComponent(recordId)}/mark`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isMarked }),
      });

      if (!response.ok) {
        let message = 'Unable to update marked state.';
        try {
          const data = (await response.json()) as { message?: string };
          if (data?.message) message = data.message;
        } catch {
          // Ignore parse failures and use fallback message.
        }
        throw new Error(message);
      }
    } catch (error) {
      setRecords((current) =>
        current.map((record) =>
          record.id === recordId ? { ...record, isMarked: !isMarked } : record,
        ),
      );
      setActionErrorMessage(
        error instanceof Error ? error.message : 'Unable to update marked state.',
      );
    } finally {
      setTogglingMarkedIds((current) => current.filter((id) => id !== recordId));
    }
  };

  const handleUnmarkAll = async () => {
    setIsUnmarkingAll(true);
    setActionErrorMessage('');

    try {
      const response = await fetch('/api/admin-v2/inventory/unmark-all', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        let message = 'Unable to unmark inventory items.';
        try {
          const data = (await response.json()) as { message?: string };
          if (data?.message) message = data.message;
        } catch {
          // Ignore parse failures and use fallback message.
        }
        throw new Error(message);
      }

      setPage(1);
      setSortBy('title');
      setSortDir('asc');
      setFilters(DEFAULT_FILTERS);
      setRecords((current) => current.map((record) => ({ ...record, isMarked: false })));
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : 'Unable to unmark inventory items.',
      );
    } finally {
      setIsUnmarkingAll(false);
    }
  };

  const handleMergeMarked = async () => {
    const isConfirmed = window.confirm("Are you sure you want to merge all 'Marked' items?");
    if (!isConfirmed) return;

    setIsMergingMarked(true);
    setActionErrorMessage('');

    try {
      const response = await fetch('/api/admin-v2/inventory/merge-marked', {
        method: 'POST',
        credentials: 'same-origin',
      });

      let message = 'Marked items were merged.';
      let mergedCount = 0;
      try {
        const data = (await response.json()) as { message?: string; mergedCount?: number };
        if (data?.message) message = data.message;
        if (typeof data?.mergedCount === 'number' && Number.isFinite(data.mergedCount)) {
          mergedCount = data.mergedCount;
        }
      } catch {
        // Ignore parse failures and use fallback message.
      }

      if (!response.ok) {
        throw new Error(message || 'Unable to merge marked inventory items.');
      }

      setPage(1);
      setSortBy('title');
      setSortDir('asc');
      setFilters(DEFAULT_FILTERS);
      setRecords([]);
      const successText = mergedCount > 0
        ? `Merged ${mergedCount} marked items.`
        : 'Marked items were merged.';
      enqueueSnackbar(successText, { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to merge marked inventory items.';
      setActionErrorMessage(text);
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsMergingMarked(false);
    }
  };

  const pageLabel = useMemo(() => {
    if (total === 0) return 'Page 1 of 1 • 0 total items';
    return `Page ${Math.min(page, totalPages)} of ${totalPages} • ${total} total items`;
  }, [page, total, totalPages]);

  const showMarkedCheckboxes = !filters.onlyMarked;

  const renderDesktopTable = () => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel
                active={sortBy === 'ccgNumber'}
                direction={sortBy === 'ccgNumber' ? sortDir : 'asc'}
                onClick={() => handleSort('ccgNumber')}
              >
                CCG #
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '100%' }}>
              <TableSortLabel
                active={sortBy === 'title'}
                direction={sortBy === 'title' ? sortDir : 'asc'}
                onClick={() => handleSort('title')}
              >
                Title
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel
                active={sortBy === 'paid'}
                direction={sortBy === 'paid' ? sortDir : 'asc'}
                onClick={() => handleSort('paid')}
              >
                Paid $
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel
                active={sortBy === 'private'}
                direction={sortBy === 'private' ? sortDir : 'asc'}
                onClick={() => handleSort('private')}
              >
                Private $
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel
                active={sortBy === 'soldPrice'}
                direction={sortBy === 'soldPrice' ? sortDir : 'asc'}
                onClick={() => handleSort('soldPrice')}
              >
                Sold $
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5}>
                <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
                  <CircularProgress size={28} />
                  <Typography sx={{ color: 'text.secondary' }}>Loading inventory…</Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography sx={{ py: 4, color: 'text.secondary' }}>
                  No inventory items match the selected filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id} hover>
                <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                    {showMarkedCheckboxes ? (
                      <Checkbox
                        size="small"
                        checked={Boolean(record.isMarked)}
                        disabled={isUnmarkingAll || togglingMarkedIds.includes(record.id)}
                        onChange={(event) => handleToggleMarked(record.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                        sx={{ p: 0.25, mr: 0.25 }}
                      />
                    ) : null}
                    <Link
                      underline="none"
                      color="text.primary"
                      href={paths.inventoryItemWithId(record.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(paths.inventoryItemWithId(record.id));
                      }}
                      sx={{ fontWeight: 600 }}
                    >
                      {record.ccgNumber || '—'}
                    </Link>
                    {record.isPersonal ? (
                      <Tooltip title="Personal item">
                        <Box component="span" sx={{ color: '#f4c542', display: 'inline-flex' }}>
                          <IconifyIcon icon="material-symbols:group-rounded" fontSize={16} />
                        </Box>
                      </Tooltip>
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ gap: 2, alignItems: 'center', minWidth: 0 }}>
                    <Avatar
                      variant="rounded"
                      src={record.imageUrl || undefined}
                      alt={record.title || 'Inventory item'}
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
                    <Link
                      underline="none"
                      color="text.primary"
                      href={paths.inventoryItemWithId(record.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(paths.inventoryItemWithId(record.id));
                      }}
                      sx={{
                        display: 'inline',
                        fontWeight: 500,
                        fontSize: 'subtitle2.fontSize',
                        lineHeight: 1.4,
                      }}
                    >
                      <Box component="span">{record.title || '—'}</Box>
                      {record.forSale && !record.isSold ? (
                        <Tooltip title="For sale">
                          <Box
                            component="span"
                            sx={{
                              color: '#3b82f6',
                              display: 'inline-flex',
                              verticalAlign: 'text-bottom',
                              ml: 0.75,
                            }}
                          >
                            <IconifyIcon icon="material-symbols:sell" fontSize={16} />
                          </Box>
                        </Tooltip>
                      ) : null}
                    </Link>
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatCurrency(record.purchasePrice)}</TableCell>
                <TableCell align="right">{formatCurrency(record.privatePartyValue)}</TableCell>
                <TableCell align="right">{formatCurrency(record.soldAmount)}</TableCell>
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
          <Typography sx={{ color: 'text.secondary' }}>Loading inventory…</Typography>
        </Stack>
      ) : records.length === 0 ? (
        <Typography sx={{ py: 4, color: 'text.secondary' }}>
          No inventory items match the selected filters.
        </Typography>
      ) : (
        records.map((record) => (
          <Paper
            key={record.id}
            variant="outlined"
            onClick={() => navigate(paths.inventoryItemWithId(record.id))}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: 'background.default',
              cursor: 'pointer',
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <Avatar
                  variant="rounded"
                  src={record.imageUrl || undefined}
                  alt={record.title || 'Inventory item'}
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
                <Box>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Typography variant="subtitle2">{record.title || '—'}</Typography>
                    {record.forSale && !record.isSold ? (
                      <Tooltip title="For sale">
                        <Box component="span" sx={{ color: '#3b82f6', display: 'inline-flex', flexShrink: 0 }}>
                          <IconifyIcon icon="material-symbols:sell" fontSize={15} />
                        </Box>
                      </Tooltip>
                    ) : null}
                  </Stack>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                    {showMarkedCheckboxes ? (
                      <Checkbox
                        size="small"
                        checked={Boolean(record.isMarked)}
                        disabled={isUnmarkingAll || togglingMarkedIds.includes(record.id)}
                        onChange={(event) => handleToggleMarked(record.id, event.target.checked)}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                        }}
                        sx={{ p: 0.25, ml: -0.5 }}
                      />
                    ) : null}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {record.ccgNumber || '—'}
                    </Typography>
                    {record.isPersonal ? (
                      <Tooltip title="Personal item">
                        <Box component="span" sx={{ color: '#f4c542', display: 'inline-flex' }}>
                          <IconifyIcon icon="material-symbols:group-rounded" fontSize={15} />
                        </Box>
                      </Tooltip>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>
              <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2">Paid: {formatCurrency(record.purchasePrice)}</Typography>
                <Typography variant="body2">
                  Private: {formatCurrency(record.privatePartyValue)}
                </Typography>
                <Typography variant="body2">Sold: {formatCurrency(record.soldAmount)}</Typography>
              </Stack>
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
          <Typography variant="h4">Inventory Manager</Typography>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {filters.onlyMarked ? (
              <Button
                variant="outlined"
                color="inherit"
                disabled={isUnmarkingAll}
                onClick={handleUnmarkAll}
                startIcon={
                  isUnmarkingAll ? (
                    <CircularProgress color="inherit" size={16} />
                  ) : (
                    <IconifyIcon icon="material-symbols:check-rounded" />
                  )
                }
              >
                {isUnmarkingAll ? 'Unmarking…' : 'Unmark All'}
              </Button>
            ) : null}

            {filters.onlyMarked ? (
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleMergeMarked}
                disabled={isMergingMarked || isUnmarkingAll || isDownloadingLabels}
                startIcon={
                  isMergingMarked ? (
                    <CircularProgress color="inherit" size={16} />
                  ) : (
                    <IconifyIcon icon="material-symbols:check-rounded" />
                  )
                }
              >
                {isMergingMarked ? 'Merging…' : 'Merge Marked'}
              </Button>
            ) : null}

            <Button
              variant="outlined"
              color="inherit"
              onClick={handleDownloadLabels}
              disabled={isDownloadingLabels || isMergingMarked}
              startIcon={
                isDownloadingLabels ? (
                  <CircularProgress color="inherit" size={16} />
                ) : (
                  <IconifyIcon icon="material-symbols:picture-as-pdf-outline-rounded" />
                )
              }
            >
              {isDownloadingLabels ? 'Generating…' : 'Labels PDF (Avery 5163)'}
            </Button>

            <Tooltip title="Add">
              <IconButton
                aria-label="Add"
                onClick={() => navigate(paths.inventoryItem)}
                color="success"
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
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {labelsErrorMessage ? <Alert severity="error">{labelsErrorMessage}</Alert> : null}
      {actionErrorMessage ? <Alert severity="error">{actionErrorMessage}</Alert> : null}

      <Box sx={{ flex: 1, p: { xs: 2, md: 5 }, minWidth: 0, overflow: 'hidden' }}>
        <Stack direction="column" spacing={3} sx={{ pt: { xs: 0, md: 1 } }}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <Select
                  displayEmpty
                  value={filters.category}
                  onChange={(event) => handleFilterChange('category', event.target.value)}
                  inputProps={{ 'aria-label': 'Category' }}
                >
                  <MenuItem value="">Category</MenuItem>
                  {CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <Select
                  displayEmpty
                  value={filters.brand}
                  onChange={(event) => handleFilterChange('brand', event.target.value)}
                  inputProps={{ 'aria-label': 'Brand' }}
                >
                  <MenuItem value="">Brand</MenuItem>
                  {availableBrands.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Stack
                direction="row"
                sx={{
                  gap: 0.5,
                  alignItems: 'center',
                  flexWrap: { xs: 'wrap', md: 'nowrap' },
                  minHeight: 56,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.sold}
                      onChange={(event) => handleFilterChange('sold', event.target.checked)}
                    />
                  }
                  sx={{ m: 0, mr: 1.25, whiteSpace: 'nowrap' }}
                  label="Sold"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.active}
                      onChange={(event) => handleFilterChange('active', event.target.checked)}
                    />
                  }
                  sx={{ m: 0, mr: 1.25, whiteSpace: 'nowrap' }}
                  label="Active"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.onlyMarked}
                      onChange={(event) => handleFilterChange('onlyMarked', event.target.checked)}
                    />
                  }
                  sx={{ m: 0, mr: 1.25, whiteSpace: 'nowrap' }}
                  label="Only Marked"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.onlyPersonal}
                      onChange={(event) => handleFilterChange('onlyPersonal', event.target.checked)}
                    />
                  }
                  sx={{ m: 0, whiteSpace: 'nowrap' }}
                  label="Only Personal"
                />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={clearFilters}
                  sx={{ minWidth: { xs: '100%', sm: 160 } }}
                >
                  Clear
                </Button>
              </Stack>
            </Grid>
          </Grid>

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

export default InventoryManager;
