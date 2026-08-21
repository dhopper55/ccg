import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';

type PurchaseLotRecord = {
  id: number;
  name: string;
  description: string | null;
  total_spent: number | null;
  resale_amount: number;
  created_at: string | null;
};

type PurchaseLotsResponse = {
  records?: PurchaseLotRecord[];
  message?: string;
};

type LotFormState = {
  id: number | null;
  name: string;
  description: string;
  totalSpent: string;
};

const DEFAULT_FORM: LotFormState = {
  id: null,
  name: '',
  description: '',
  totalSpent: '',
};

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getResaleColor(resaleAmount: number, totalSpent: number | null): string {
  const spent = totalSpent ?? 0;
  return resaleAmount >= spent ? 'success.main' : 'error.main';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US');
}

const PurchasedLots = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [records, setRecords] = useState<PurchaseLotRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LotFormState>(DEFAULT_FORM);

  useEffect(() => {
    document.title = 'CCG Admin | Purchased Lots';
  }, []);

  const loadPurchaseLots = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/purchased-lots', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as PurchaseLotsResponse;
      if (!response.ok) throw new Error(data.message || 'Unable to load purchased lots.');
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load purchased lots.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPurchaseLots();
  }, []);

  const openCreateDialog = () => {
    setForm(DEFAULT_FORM);
    setFormOpen(true);
  };

  const openEditDialog = (record: PurchaseLotRecord) => {
    setForm({
      id: record.id,
      name: record.name,
      description: record.description || '',
      totalSpent: record.total_spent != null ? String(record.total_spent) : '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      setErrorMessage('Lot name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const endpoint = form.id
        ? `/api/admin-v2/purchased-lots/${encodeURIComponent(String(form.id))}/update`
        : '/api/admin-v2/purchased-lots';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name,
          description: form.description.trim() || null,
          totalSpent: form.totalSpent.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to save purchase lot.');
      enqueueSnackbar(form.id ? 'Purchase lot updated.' : 'Purchase lot added.', { variant: 'success' });
      setFormOpen(false);
      setForm(DEFAULT_FORM);
      await loadPurchaseLots();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to save purchase lot.';
      setErrorMessage(text);
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

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
          <Typography variant="h4">Purchased Lots</Typography>
          <Tooltip title="Add">
            <IconButton
              aria-label="Add"
              onClick={openCreateDialog}
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
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
            {isLoading ? (
              <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
                <CircularProgress size={28} />
                <Typography sx={{ color: 'text.secondary' }}>Loading purchased lots...</Typography>
              </Stack>
            ) : records.length === 0 ? (
              <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
                <IconifyIcon icon="material-symbols:receipt-long-outline-rounded" fontSize={40} />
                <Typography sx={{ color: 'text.secondary' }}>No purchased lots yet.</Typography>
                <Button variant="contained" onClick={openCreateDialog}>
                  Add Purchased Lot
                </Button>
              </Stack>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Total Spent</TableCell>
                      <TableCell align="right">Resale $</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{record.name}</Typography>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(record.total_spent)}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, color: getResaleColor(record.resale_amount, record.total_spent) }}
                          >
                            {formatCurrency(record.resale_amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(record.created_at)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton color="inherit" onClick={() => openEditDialog(record)}>
                              <IconifyIcon icon="material-symbols:edit-outline-rounded" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? 'Edit Purchased Lot' : 'Add Purchased Lot'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                inputProps={{ maxLength: 120 }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                inputProps={{ maxLength: 4000 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Total Spent"
                type="number"
                value={form.totalSpent}
                onChange={(event) => setForm((current) => ({ ...current, totalSpent: event.target.value }))}
                inputProps={{ step: '0.01', min: 0 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setFormOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default PurchasedLots;
