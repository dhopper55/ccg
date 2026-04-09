import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  CircularProgress,
  FormControl,
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

type InventorySortKey = 'ccgNumber' | 'title' | 'paid' | 'private' | 'addDate';
type InventorySortDir = 'asc' | 'desc';

type InventoryRecord = {
  id: string;
  ccgNumber: string;
  title: string;
  imageUrl?: string | null;
  categoryId?: number | null;
  categoryName?: string;
  categoryPath?: string;
  brand?: string;
  repairNotes?: string;
  isMarked?: boolean;
  isPersonal?: boolean;
  needsRepair?: boolean;
  forSale?: boolean;
  isSold?: boolean;
  purchasePrice?: number | null;
  privatePartyValue?: number | null;
  soldAmount?: number | null;
  createdAt?: string | null;
  qtyAvailable?: number | null;
  groupCount?: number | null;
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
  categoryId: string;
  brand: string;
  sold: 'all' | 'yes' | 'no';
  active: 'all' | 'yes' | 'no';
  marked: 'all' | 'yes' | 'no';
  personal: 'all' | 'yes' | 'no';
  repair: 'all' | 'yes' | 'no';
};

type InventoryCategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: InventoryCategoryNode[];
};

type InventoryCategoriesResponse = {
  tree?: InventoryCategoryNode[];
  message?: string;
};

type InventoryCategoryOption = {
  id: string;
  label: string;
};

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: InventoryFilters = {
  categoryId: '',
  brand: '',
  sold: 'no',
  active: 'yes',
  marked: 'all',
  personal: 'all',
  repair: 'all',
};

function formatAddDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  return formatter.format(parsed);
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const FILTER_CONTROL_WIDTH = 260;

const FILTER_CONTROL_SX = {
  width: { xs: '100%', md: FILTER_CONTROL_WIDTH },
  minWidth: 0,
  '& .MuiSelect-select': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
} as const;

const InventoryManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { down } = useBreakpoints();
  const downSm = down('sm');
  const [filters, setFilters] = useState<InventoryFilters>(() => ({
    categoryId: searchParams.get('categoryId') || '',
    brand: searchParams.get('brand') || '',
    sold: searchParams.get('sold') === 'yes' || searchParams.get('sold') === '1' || searchParams.get('sold') === 'true'
      ? 'yes'
      : searchParams.get('sold') === 'all'
        ? 'all'
        : 'no',
    active: searchParams.get('active') === 'all'
      ? 'all'
      : searchParams.get('active') === 'no' || searchParams.get('active') === '0' || searchParams.get('active') === 'false'
        ? 'no'
        : 'yes',
    marked: searchParams.get('marked') === 'yes' || searchParams.get('onlyMarked') === '1'
      ? 'yes'
      : searchParams.get('marked') === 'no'
        ? 'no'
        : 'all',
    personal: searchParams.get('personal') === 'yes' || searchParams.get('onlyPersonal') === '1'
      ? 'yes'
      : searchParams.get('personal') === 'no'
        ? 'no'
        : 'all',
    repair: searchParams.get('repair') === 'yes' || searchParams.get('onlyRepair') === '1'
      ? 'yes'
      : searchParams.get('repair') === 'no'
        ? 'no'
        : 'all',
  }));
  const [page, setPage] = useState(() => {
    const parsed = Number.parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [sortBy, setSortBy] = useState<InventorySortKey>(() => {
    const value = searchParams.get('sortBy');
    return value === 'ccgNumber' || value === 'title' || value === 'paid' || value === 'private' || value === 'addDate'
      ? value
      : 'addDate';
  });
  const [sortDir, setSortDir] = useState<InventorySortDir>(() => (
    searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  ));
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<InventoryCategoryOption[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    return Boolean(
      searchParams.get('categoryId')
      || searchParams.get('brand')
      || (searchParams.get('sold') && searchParams.get('sold') !== 'no')
      || (searchParams.get('active') && searchParams.get('active') !== 'yes')
      || searchParams.get('marked')
      || searchParams.get('onlyMarked') === '1'
      || searchParams.get('personal')
      || searchParams.get('onlyPersonal') === '1'
      || searchParams.get('repair')
      || searchParams.get('onlyRepair') === '1',
    );
  });
  const [isUnmarkingAll, setIsUnmarkingAll] = useState(false);
  const [isMergingMarked, setIsMergingMarked] = useState(false);
  const [togglingMarkedIds, setTogglingMarkedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Inventory Manager';
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (page > 1) nextParams.set('page', String(page));
    if (sortBy !== 'addDate') nextParams.set('sortBy', sortBy);
    if (sortDir !== 'desc') nextParams.set('sortDir', sortDir);
    if (filters.categoryId) nextParams.set('categoryId', filters.categoryId);
    if (filters.brand) nextParams.set('brand', filters.brand);
    if (filters.sold !== 'no') nextParams.set('sold', filters.sold);
    if (filters.active !== 'yes') nextParams.set('active', filters.active);
    if (filters.marked !== 'all') nextParams.set('marked', filters.marked);
    if (filters.personal !== 'all') nextParams.set('personal', filters.personal);
    if (filters.repair !== 'all') nextParams.set('repair', filters.repair);

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [filters, page, sortBy, sortDir, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    const flattenCategoryTree = (
      nodes: InventoryCategoryNode[],
      depth = 0,
    ): InventoryCategoryOption[] =>
      nodes.flatMap((node) => [
        {
          id: String(node.id),
          label: `${depth > 0 ? `${'---'.repeat(depth)} ` : ''}${node.name}`,
        },
        ...flattenCategoryTree(Array.isArray(node.children) ? node.children : [], depth + 1),
      ]);

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/admin-v2/inventory/categories', {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as InventoryCategoriesResponse;

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load inventory categories.');
        }

        if (cancelled) return;
        const tree = Array.isArray(data.tree) ? data.tree : [];
        setCategoryOptions(flattenCategoryTree(tree));
      } catch (error) {
        if (cancelled) return;
        setCategoryOptions([]);
        setErrorMessage((current) =>
          current || (error instanceof Error ? error.message : 'Unable to load inventory categories.'),
        );
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
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
        params.set('sold', filters.sold);
        params.set('active', filters.active);
        params.set('marked', filters.marked);
        params.set('personal', filters.personal);
        params.set('repair', filters.repair);
        if (filters.categoryId) params.set('categoryId', filters.categoryId);
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
      if (key === 'categoryId') next.brand = '';
      return next;
    });
  };

  const clearFilters = () => {
    setPage(1);
    setSortBy('addDate');
    setSortDir('desc');
    setFilters(DEFAULT_FILTERS);
    setActionErrorMessage('');
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

  const inventoryItemHref = (recordId: string) =>
    `${paths.inventoryItemWithId(recordId)}${location.search || ''}`;

  const showMarkedCheckboxes = filters.marked !== 'yes';

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
                active={sortBy === 'addDate'}
                direction={sortBy === 'addDate' ? sortDir : 'asc'}
                onClick={() => handleSort('addDate')}
              >
                Add Date
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
                      href={inventoryItemHref(record.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(inventoryItemHref(record.id));
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
                      href={inventoryItemHref(record.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(inventoryItemHref(record.id));
                      }}
                      sx={{
                        display: 'inline',
                        fontWeight: 500,
                        fontSize: 'subtitle2.fontSize',
                        lineHeight: 1.4,
                      }}
                    >
                      <Box component="span">{record.title || '—'}</Box>
                      {Number(record.qtyAvailable || record.groupCount || 0) > 1 ? (
                        <Box
                          component="span"
                          sx={{
                            ml: 1,
                            px: 0.75,
                            py: 0.125,
                            borderRadius: 999,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: 0.2,
                            color: 'primary.dark',
                            bgcolor: 'primary.lighter',
                            border: 1,
                            borderColor: 'primary.light',
                            verticalAlign: 'middle',
                            display: 'inline-flex',
                            alignItems: 'center',
                            lineHeight: 1.2,
                          }}
                        >
                          Qty {Number(record.qtyAvailable || record.groupCount || 0)}
                        </Box>
                      ) : null}
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
                      {record.needsRepair ? (
                        <Tooltip title={record.repairNotes?.trim() || 'Needs repair'}>
                          <Box
                            component="span"
                            sx={{
                              color: 'error.main',
                              display: 'inline-flex',
                              verticalAlign: 'text-bottom',
                              ml: 0.75,
                            }}
                          >
                            <IconifyIcon icon="material-symbols:construction-rounded" fontSize={16} />
                          </Box>
                        </Tooltip>
                      ) : null}
                    </Link>
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatCurrency(record.purchasePrice)}</TableCell>
                <TableCell align="right">{formatCurrency(record.privatePartyValue)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatAddDate(record.createdAt)}</TableCell>
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
            onClick={() => navigate(inventoryItemHref(record.id))}
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
                    {Number(record.qtyAvailable || record.groupCount || 0) > 1 ? (
                      <Box
                        component="span"
                        sx={{
                          ml: 0.25,
                          px: 0.75,
                          py: 0.125,
                          borderRadius: 999,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'primary.dark',
                          bgcolor: 'primary.lighter',
                          border: 1,
                          borderColor: 'primary.light',
                          display: 'inline-flex',
                          alignItems: 'center',
                          lineHeight: 1.2,
                        }}
                      >
                        Qty {Number(record.qtyAvailable || record.groupCount || 0)}
                      </Box>
                    ) : null}
                    {record.forSale && !record.isSold ? (
                      <Tooltip title="For sale">
                        <Box component="span" sx={{ color: '#3b82f6', display: 'inline-flex', flexShrink: 0 }}>
                          <IconifyIcon icon="material-symbols:sell" fontSize={15} />
                        </Box>
                      </Tooltip>
                    ) : null}
                    {record.needsRepair ? (
                      <Tooltip title={record.repairNotes?.trim() || 'Needs repair'}>
                        <Box component="span" sx={{ color: 'error.main', display: 'inline-flex', flexShrink: 0 }}>
                          <IconifyIcon icon="material-symbols:construction-rounded" fontSize={15} />
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
                <Typography variant="body2">Added: {formatAddDate(record.createdAt)}</Typography>
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
            {filters.marked === 'yes' ? (
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

            {filters.marked === 'yes' ? (
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleMergeMarked}
                disabled={isMergingMarked || isUnmarkingAll}
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
      {actionErrorMessage ? <Alert severity="error">{actionErrorMessage}</Alert> : null}

      <Box
        sx={{
          flex: 1,
          px: { xs: 2, md: 5 },
          pb: { xs: 2, md: 5 },
          pt: { xs: 1, md: 1.5 },
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Stack direction="column" spacing={3}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                sx={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  variant={filtersOpen ? 'contained' : 'outlined'}
                  color="inherit"
                  onClick={() => setFiltersOpen((current) => !current)}
                  startIcon={<IconifyIcon icon="material-symbols:filter-list-rounded" />}
                  endIcon={
                    <IconifyIcon
                      icon={filtersOpen ? 'material-symbols:expand-less-rounded' : 'material-symbols:expand-more-rounded'}
                    />
                  }
                  sx={{
                    minWidth: 132,
                    justifyContent: 'space-between',
                    px: 1.75,
                  }}
                >
                  Filters
                </Button>

                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  {filters.categoryId || filters.brand || filters.sold !== 'no' || filters.active !== 'yes' || filters.marked !== 'all' || filters.personal !== 'all' || filters.repair !== 'all' ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Filters active
                    </Typography>
                  ) : null}
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={clearFilters}
                    sx={{ minWidth: 110 }}
                  >
                    Clear
                  </Button>
                </Stack>
              </Stack>

              <Collapse in={filtersOpen} timeout="auto" unmountOnExit>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={2}
                  sx={{ alignItems: 'flex-start', pt: 0.5 }}
                >
                  <Stack spacing={2} sx={{ width: { xs: '100%', md: FILTER_CONTROL_WIDTH }, flexShrink: 0 }}>
                      <FormControl fullWidth sx={FILTER_CONTROL_SX}>
                        <Select
                          displayEmpty
                          value={filters.categoryId}
                          onChange={(event) => handleFilterChange('categoryId', event.target.value)}
                          inputProps={{ 'aria-label': 'Category' }}
                        >
                          <MenuItem value="">Category</MenuItem>
                          {categoryOptions.map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl fullWidth sx={FILTER_CONTROL_SX}>
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
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={2}
                    useFlexGap
                    sx={{ flexWrap: 'wrap', minWidth: 0, flex: 1, alignItems: 'flex-start' }}
                  >
                    <Box sx={{ width: { xs: '100%', md: FILTER_CONTROL_WIDTH }, flexShrink: 0 }}>
                        <FormControl fullWidth sx={FILTER_CONTROL_SX}>
                          <Select
                            value={filters.sold}
                            onChange={(event) => handleFilterChange('sold', event.target.value as InventoryFilters['sold'])}
                            inputProps={{ 'aria-label': 'Sold filter' }}
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Sold</MenuItem>
                            <MenuItem value="no">UnSold</MenuItem>
                          </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ width: { xs: '100%', md: FILTER_CONTROL_WIDTH }, flexShrink: 0 }}>
                        <FormControl fullWidth sx={FILTER_CONTROL_SX}>
                          <Select
                            value={filters.active}
                            onChange={(event) => handleFilterChange('active', event.target.value as InventoryFilters['active'])}
                            inputProps={{ 'aria-label': 'Active filter' }}
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Active</MenuItem>
                            <MenuItem value="no">In-Active</MenuItem>
                          </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ width: { xs: '100%', md: FILTER_CONTROL_WIDTH }, flexShrink: 0 }}>
                        <FormControl fullWidth sx={FILTER_CONTROL_SX}>
                          <Select
                            value={filters.marked}
                            onChange={(event) => handleFilterChange('marked', event.target.value as InventoryFilters['marked'])}
                            inputProps={{ 'aria-label': 'Marked filter' }}
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Marked</MenuItem>
                            <MenuItem value="no">UnMarked</MenuItem>
                          </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ width: { xs: '100%', md: FILTER_CONTROL_WIDTH }, flexShrink: 0 }}>
                        <FormControl fullWidth sx={FILTER_CONTROL_SX}>
                          <Select
                            value={filters.personal}
                            onChange={(event) => handleFilterChange('personal', event.target.value as InventoryFilters['personal'])}
                            inputProps={{ 'aria-label': 'Personal filter' }}
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Personal</MenuItem>
                            <MenuItem value="no">Not Personal</MenuItem>
                          </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ width: { xs: '100%', md: FILTER_CONTROL_WIDTH }, flexShrink: 0 }}>
                        <FormControl fullWidth sx={FILTER_CONTROL_SX}>
                          <Select
                            value={filters.repair}
                            onChange={(event) => handleFilterChange('repair', event.target.value as InventoryFilters['repair'])}
                            inputProps={{ 'aria-label': 'Repair filter' }}
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="yes">Needs Repair</MenuItem>
                            <MenuItem value="no">No Repair</MenuItem>
                          </Select>
                        </FormControl>
                    </Box>
                  </Stack>
                </Stack>
              </Collapse>
            </Stack>
          </Paper>

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
