import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
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
import { useBreakpoints } from 'providers/BreakpointsProvider';
import IconifyIcon from 'components/base/IconifyIcon';

type FlyerFilter = 'all' | 'unevaluated' | 'evaluated' | 'flyer_placed';

type FlyerLocation = {
  id: number;
  name: string;
  address: string;
  types: string;
  google_url: string | null;
  photo_url: string | null;
  map_url: string | null;
  to_visit: number;
  evaluated: number;
  flyer_placed: number;
  notes: string | null;
};

type GlobalStats = {
  total: number;
  evaluated: number;
  flyerPlaced: number;
};

type FlyerListResponse = {
  records: FlyerLocation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  globalStats?: GlobalStats;
  message?: string;
};

const PAGE_SIZE = 100;

const FILTER_OPTIONS: { value: FlyerFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unevaluated', label: 'Not Evaluated' },
  { value: 'evaluated', label: 'Evaluated' },
  { value: 'flyer_placed', label: 'Flyer Placed' },
];

function parseTypes(types: string): string {
  try {
    const arr = JSON.parse(types);
    if (Array.isArray(arr)) return arr.join(', ');
  } catch {
    // fall through
  }
  return types;
}

const AdvertisingFlyers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { down } = useBreakpoints();
  const downSm = down('sm');

  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [filter, setFilter] = useState<FlyerFilter>(() => {
    const f = searchParams.get('filter');
    return f === 'all' || f === 'evaluated' || f === 'flyer_placed' ? f : 'unevaluated';
  });
  const [page, setPage] = useState(() => {
    const p = Number.parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });

  const [records, setRecords] = useState<FlyerLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const [fetchKey, setFetchKey] = useState(0);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addStep, setAddStep] = useState<'input' | 'review'>('input');
  const [addGoogleUrl, setAddGoogleUrl] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [addForm, setAddForm] = useState<{
    name: string;
    address: string;
    types: string;
    google_url: string;
    photo_url: string | null;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesRecord, setNotesRecord] = useState<FlyerLocation | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = 'CCG Admin | Advertising Flyers';
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) next.set('page', String(page));
    if (search) next.set('search', search);
    if (filter !== 'unevaluated') next.set('filter', filter);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [page, search, filter, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));
        if (search) params.set('search', search);
        if (filter !== 'all') params.set('filter', filter);

        const response = await fetch(`/api/admin-v2/advertising-flyers?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as FlyerListResponse;

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load advertising flyer locations.');
        }

        if (cancelled) return;
        setRecords(Array.isArray(data.records) ? data.records : []);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        setPage(Math.max(1, Number(data.page || 1)));
        if (data.globalStats) setGlobalStats(data.globalStats);
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setTotal(0);
        setTotalPages(1);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load advertising flyer locations.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [page, search, filter, fetchKey]);

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(value);
    }, 300);
  };

  const handleToggle = async (id: number, field: 'to_visit' | 'evaluated' | 'flyer_placed', value: boolean) => {
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value ? 1 : 0 };
        if (field === 'to_visit' && value) updated.evaluated = 1;
        return updated;
      }),
    );

    try {
      const response = await fetch(`/api/admin-v2/advertising-flyers/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) {
        let message = field === 'evaluated' ? 'Unable to update evaluated status.' : 'Unable to update flyer placed status.';
        try {
          const d = (await response.json()) as { message?: string };
          if (d?.message) message = d.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      if (globalStats) {
        setGlobalStats((prev) => {
          if (!prev) return prev;
          const delta = value ? 1 : -1;
          return field === 'evaluated'
            ? { ...prev, evaluated: prev.evaluated + delta }
            : { ...prev, flyerPlaced: prev.flyerPlaced + delta };
        });
      }
    } catch (error) {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const rolled = { ...r, [field]: value ? 0 : 1 };
          if (field === 'to_visit' && value) rolled.evaluated = r.evaluated;
          return rolled;
        }),
      );
      enqueueSnackbar(error instanceof Error ? error.message : 'Update failed.', { variant: 'error' });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openAddDialog = () => {
    setAddGoogleUrl('');
    setAddStep('input');
    setLookupError('');
    setAddForm(null);
    setAddDialogOpen(true);
  };

  const handleLookup = async () => {
    setIsLookingUp(true);
    setLookupError('');
    try {
      const response = await fetch('/api/admin-v2/advertising-flyers/lookup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_url: addGoogleUrl }),
      });
      const data = (await response.json()) as {
        name?: string;
        address?: string;
        types?: string;
        google_url?: string;
        photo_url?: string | null;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message || 'Lookup failed.');
      setAddForm({
        name: data.name ?? '',
        address: data.address ?? '',
        types: data.types ?? '[]',
        google_url: data.google_url ?? addGoogleUrl,
        photo_url: data.photo_url ?? null,
      });
      setAddStep('review');
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Lookup failed.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCreate = async () => {
    if (!addForm) return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin-v2/advertising-flyers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Failed to add location.');
      setAddDialogOpen(false);
      enqueueSnackbar('Location added.', { variant: 'success' });
      setPage(1);
      setFetchKey((k) => k + 1);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to add location.', { variant: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    setIsDeletingId(id);
    try {
      const response = await fetch(`/api/admin-v2/advertising-flyers/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const d = (await response.json()) as { message?: string };
        throw new Error(d.message || 'Delete failed.');
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setGlobalStats((prev) => {
        if (!prev) return prev;
        const wasEvaluated = records.find((r) => r.id === id)?.evaluated ?? 0;
        const wasFlyerPlaced = records.find((r) => r.id === id)?.flyer_placed ?? 0;
        return {
          total: Math.max(0, prev.total - 1),
          evaluated: Math.max(0, prev.evaluated - (wasEvaluated ? 1 : 0)),
          flyerPlaced: Math.max(0, prev.flyerPlaced - (wasFlyerPlaced ? 1 : 0)),
        };
      });
      enqueueSnackbar(`${name} deleted.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Delete failed.', { variant: 'error' });
    } finally {
      setIsDeletingId(null);
    }
  };

  const openNotesModal = (record: FlyerLocation) => {
    setNotesRecord(record);
    setNotesDraft(record.notes || '');
    setNotesModalOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!notesRecord) return;
    setIsSavingNotes(true);

    try {
      const response = await fetch(`/api/admin-v2/advertising-flyers/${notesRecord.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!response.ok) {
        let message = 'Unable to save notes.';
        try {
          const d = (await response.json()) as { message?: string };
          if (d?.message) message = d.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const savedNotes = notesDraft.trim() || null;
      setRecords((prev) =>
        prev.map((r) => (r.id === notesRecord.id ? { ...r, notes: savedNotes } : r)),
      );
      setNotesModalOpen(false);
      enqueueSnackbar('Notes saved.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to save notes.', { variant: 'error' });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const pageLabel = useMemo(() => {
    if (total === 0) return 'Page 1 of 1 • 0 locations';
    return `Page ${Math.min(page, totalPages)} of ${totalPages} • ${total} locations`;
  }, [page, total, totalPages]);

  const renderMapButton = (record: FlyerLocation) =>
    record.google_url ? (
      <Tooltip title="Open in Google Maps">
        <IconButton
          size="small"
          component="a"
          href={record.google_url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: 'error.main' }}
        >
          <IconifyIcon icon="material-symbols:location-on-rounded" fontSize={20} />
        </IconButton>
      </Tooltip>
    ) : (
      <IconButton size="small" disabled>
        <IconifyIcon icon="material-symbols:location-on-outline-rounded" fontSize={20} />
      </IconButton>
    );

  const renderDesktopTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 64, pl: 2 }}>Photo</TableCell>
            <TableCell sx={{ width: '100%' }}>Business</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 180 }}>Types</TableCell>
            <TableCell align="center" sx={{ width: 52 }}>Map</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: 90 }}>To Visit</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: 100 }}>Evaluated</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: 120 }}>Flyer Placed</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', width: 120 }}>Notes</TableCell>
            <TableCell sx={{ width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9}>
                <Stack sx={{ alignItems: 'center', py: 6 }} spacing={2}>
                  <CircularProgress size={28} />
                  <Typography sx={{ color: 'text.secondary' }}>Loading locations…</Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9}>
                <Typography sx={{ py: 4, color: 'text.secondary' }}>
                  No locations match the selected filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id} hover>
                <TableCell sx={{ pl: 2 }}>
                  <Avatar
                    variant="rounded"
                    src={record.photo_url || undefined}
                    alt={record.name}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: 'background.elevation1',
                      flexShrink: 0,
                    }}
                  >
                    <IconifyIcon icon="material-symbols:storefront-outline-rounded" fontSize={20} />
                  </Avatar>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                    {record.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                    {record.address}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', fontSize: '0.75rem', maxWidth: 240 }}
                  >
                    {parseTypes(record.types)}
                  </Typography>
                </TableCell>
                <TableCell align="center">{renderMapButton(record)}</TableCell>
                <TableCell align="center">
                  <Checkbox
                    size="small"
                    checked={Boolean(record.to_visit)}
                    disabled={updatingIds.has(record.id)}
                    onChange={(e) => handleToggle(record.id, 'to_visit', e.target.checked)}
                    color="warning"
                  />
                </TableCell>
                <TableCell align="center">
                  <Checkbox
                    size="small"
                    checked={Boolean(record.evaluated)}
                    disabled={updatingIds.has(record.id)}
                    onChange={(e) => handleToggle(record.id, 'evaluated', e.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="center">
                  <Checkbox
                    size="small"
                    checked={Boolean(record.flyer_placed)}
                    disabled={updatingIds.has(record.id)}
                    onChange={(e) => handleToggle(record.id, 'flyer_placed', e.target.checked)}
                    color="success"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    color={record.notes ? 'primary' : 'inherit'}
                    onClick={() => openNotesModal(record)}
                    sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', minWidth: 96 }}
                  >
                    {record.notes ? 'Edit Notes' : 'Add Notes'}
                  </Button>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Delete">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={isDeletingId === record.id}
                        onClick={() => setDeleteTarget({ id: record.id, name: record.name })}
                      >
                        {isDeletingId === record.id
                          ? <CircularProgress size={16} color="error" />
                          : <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
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
          <Typography sx={{ color: 'text.secondary' }}>Loading locations…</Typography>
        </Stack>
      ) : records.length === 0 ? (
        <Typography sx={{ py: 4, color: 'text.secondary' }}>
          No locations match the selected filters.
        </Typography>
      ) : (
        records.map((record) => (
          <Paper
            key={record.id}
            variant="outlined"
            sx={{ p: 2, borderRadius: 3, bgcolor: 'background.default' }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Avatar
                  variant="rounded"
                  src={record.photo_url || undefined}
                  alt={record.name}
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2.5,
                    bgcolor: 'background.elevation1',
                    flexShrink: 0,
                  }}
                >
                  <IconifyIcon icon="material-symbols:storefront-outline-rounded" fontSize={22} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                      {record.name}
                    </Typography>
                    {renderMapButton(record)}
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                    {record.address}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.73rem', mt: 0.25 }}>
                    {parseTypes(record.types)}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                  <Checkbox
                    size="small"
                    checked={Boolean(record.to_visit)}
                    disabled={updatingIds.has(record.id)}
                    onChange={(e) => handleToggle(record.id, 'to_visit', e.target.checked)}
                    color="warning"
                    sx={{ p: 0.5 }}
                  />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>To Visit</Typography>
                </Stack>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                  <Checkbox
                    size="small"
                    checked={Boolean(record.evaluated)}
                    disabled={updatingIds.has(record.id)}
                    onChange={(e) => handleToggle(record.id, 'evaluated', e.target.checked)}
                    color="primary"
                    sx={{ p: 0.5 }}
                  />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Evaluated</Typography>
                </Stack>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                  <Checkbox
                    size="small"
                    checked={Boolean(record.flyer_placed)}
                    disabled={updatingIds.has(record.id)}
                    onChange={(e) => handleToggle(record.id, 'flyer_placed', e.target.checked)}
                    color="success"
                    sx={{ p: 0.5 }}
                  />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Flyer Placed</Typography>
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  color={record.notes ? 'primary' : 'inherit'}
                  onClick={() => openNotesModal(record)}
                  sx={{ fontSize: '0.75rem', ml: 'auto' }}
                >
                  {record.notes ? 'Edit Notes' : 'Add Notes'}
                </Button>
                <IconButton
                  size="small"
                  color="error"
                  disabled={isDeletingId === record.id}
                  onClick={() => setDeleteTarget({ id: record.id, name: record.name })}
                >
                  {isDeletingId === record.id
                    ? <CircularProgress size={16} color="error" />
                    : <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />}
                </IconButton>
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
          sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="h4">Advertising Flyers</Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={openAddDialog}
            >
              Add
            </Button>
          </Stack>
          {globalStats ? (
            <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {globalStats.total}
                </Box>{' '}
                total
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {globalStats.evaluated}
                </Box>{' '}
                evaluated
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 600, color: 'success.main' }}>
                  {globalStats.flyerPlaced}
                </Box>{' '}
                flyers placed
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

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
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
            >
              <TextField
                size="small"
                placeholder="Search by name…"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                sx={{ width: { xs: '100%', sm: 260 } }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconifyIcon icon="material-symbols:search-rounded" fontSize={18} />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearchInput('');
                            setSearch('');
                            setPage(1);
                          }}
                        >
                          <IconifyIcon icon="material-symbols:close-rounded" fontSize={16} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
              />
              <ButtonGroup size="small" color="inherit">
                {FILTER_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={filter === opt.value ? 'contained' : 'outlined'}
                    color={filter === opt.value ? 'primary' : 'inherit'}
                    onClick={() => {
                      setFilter(opt.value);
                      setPage(1);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>
          </Paper>

          {downSm ? renderMobileCards() : renderDesktopTable()}

          {!isLoading ? (
            <Stack
              direction="row"
              sx={{ gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {pageLabel}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  startIcon={<IconifyIcon icon="material-symbols:chevron-left-rounded" />}
                >
                  Previous
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  endIcon={<IconifyIcon icon="material-symbols:chevron-right-rounded" />}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Box>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete location?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 600 }}>{deleteTarget?.name}</Box> will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" color="inherit" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={addDialogOpen}
        onClose={() => { if (!isLookingUp && !isCreating) setAddDialogOpen(false); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          Add Location
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
            {addStep === 'input' ? 'Paste a Google Maps URL to look up the business.' : 'Review and confirm the details below.'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {addStep === 'input' ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Google Maps URL"
                placeholder="https://www.google.com/maps/place/..."
                value={addGoogleUrl}
                onChange={(e) => { setAddGoogleUrl(e.target.value); setLookupError(''); }}
                disabled={isLookingUp}
                error={Boolean(lookupError)}
                helperText={lookupError || ''}
                autoFocus
              />
            </Stack>
          ) : addForm ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {addForm.photo_url && (
                <Avatar
                  variant="rounded"
                  src={addForm.photo_url}
                  alt={addForm.name}
                  sx={{ width: 80, height: 80, borderRadius: 2 }}
                />
              )}
              <TextField
                fullWidth
                label="Business Name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => f ? { ...f, name: e.target.value } : f)}
              />
              <TextField
                fullWidth
                label="Address"
                value={addForm.address}
                onChange={(e) => setAddForm((f) => f ? { ...f, address: e.target.value } : f)}
              />
              <TextField
                fullWidth
                label="Types"
                value={parseTypes(addForm.types)}
                slotProps={{ input: { readOnly: true } }}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" color="inherit" onClick={() => setAddDialogOpen(false)} disabled={isLookingUp || isCreating}>
            Cancel
          </Button>
          {addStep === 'review' && (
            <Button variant="outlined" color="inherit" onClick={() => setAddStep('input')} disabled={isCreating}>
              Back
            </Button>
          )}
          {addStep === 'input' ? (
            <Button
              variant="contained"
              color="primary"
              onClick={handleLookup}
              disabled={!addGoogleUrl.trim() || isLookingUp}
              startIcon={isLookingUp ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {isLookingUp ? 'Looking up…' : 'Look Up'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreate}
              disabled={!addForm?.name.trim() || !addForm?.address.trim() || isCreating}
              startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {isCreating ? 'Adding…' : 'Add Location'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={notesModalOpen}
        onClose={() => {
          if (!isSavingNotes) setNotesModalOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          {notesRecord?.notes ? 'Edit Notes' : 'Add Notes'}
          {notesRecord ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
              {notesRecord.name}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={5}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add notes about this location…"
            disabled={isSavingNotes}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setNotesModalOpen(false)}
            disabled={isSavingNotes}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            startIcon={isSavingNotes ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSavingNotes ? 'Saving…' : 'Save Notes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default AdvertisingFlyers;
