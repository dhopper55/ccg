import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import paths from 'routes/paths';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

type ValueReportRecord = {
  id: number;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  brand: string | null;
  type: string | null;
  stripePaymentIntentId: string | null;
  fulfilled: number;
  reportCost: number | null;
};

type ValueReportsResponse = {
  records: ValueReportRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  message?: string;
};

const PAGE_SIZE = 25;

const ValueReports = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [records, setRecords] = useState<ValueReportRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ValueReportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));
        const response = await fetch(`/api/admin-v2/value-reports?${params.toString()}`, {
          credentials: 'same-origin',
        });
        const payload = (await response.json()) as ValueReportsResponse;
        if (!response.ok) throw new Error(payload.message || 'Unable to load value reports.');
        if (!cancelled) {
          setRecords(payload.records || []);
          setTotal(payload.total ?? 0);
          setTotalPages(payload.totalPages ?? 1);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load value reports.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${deleteTarget.id}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || 'Delete failed.');
      }
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setTotal((prev) => Math.max(0, prev - 1));
      enqueueSnackbar('Report deleted.', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.message ?? 'Delete failed. Please try again.', { variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          mb={3}
        >
          <Typography variant="h4">Value Reports</Typography>
        </Stack>

        {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Paid?</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Fulfilled</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cost</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Stack direction="row" justifyContent="center" py={4}>
                      <CircularProgress size={26} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : records.length < 1 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No value reports found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const fullName = [record.firstName, record.lastName].filter(Boolean).join(' ') || '—';
                  const formattedDate = record.createdAt
                    ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A')
                    : '—';
                  return (
                    <TableRow key={record.id} hover>
                      <TableCell>
                        <Link
                          component="button"
                          variant="body2"
                          underline="hover"
                          onClick={() => navigate(paths.valueReportItemWithId(record.id))}
                          sx={{ cursor: 'pointer' }}
                        >
                          {formattedDate}
                        </Link>
                      </TableCell>
                      <TableCell>{record.type || '—'}</TableCell>
                      <TableCell>{record.brand || '—'}</TableCell>
                      <TableCell>
                        {record.stripePaymentIntentId ? (
                          <IconifyIcon
                            icon="material-symbols:check-circle-rounded"
                            fontSize={20}
                            style={{ color: '#4caf50' }}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {record.fulfilled ? (
                          <IconifyIcon
                            icon="material-symbols:check-circle-rounded"
                            fontSize={20}
                            style={{ color: '#4caf50' }}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {record.reportCost != null ? `$${(Math.ceil(record.reportCost * 100) / 100).toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0 }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(record)}
                          aria-label="Delete report"
                        >
                          <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
          <Typography variant="body2" color="text.secondary">
            {total > 0 ? `Showing ${pageStart}–${pageEnd} of ${total}` : 'Showing 0 records'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Report?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the report
            {deleteTarget
              ? ` from ${dayjs(deleteTarget.createdAt).format('MMM D, YYYY h:mm A')}${deleteTarget.firstName || deleteTarget.lastName ? ` (${[deleteTarget.firstName, deleteTarget.lastName].filter(Boolean).join(' ')})` : ''}`
              : ''}
            , including all uploaded photos. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteConfirm()} disabled={deleting}>
            {deleting ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ValueReports;
