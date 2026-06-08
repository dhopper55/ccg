import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import dayjs from 'dayjs';

type ValueReportRecord = {
  id: number;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  brand: string | null;
  location: string | null;
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
  const [records, setRecords] = useState<ValueReportRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Stack direction="row" justifyContent="center" py={4}>
                      <CircularProgress size={26} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : records.length < 1 ? (
                <TableRow>
                  <TableCell colSpan={4}>
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
                          onClick={() => {/* detail view — coming later */}}
                          sx={{ cursor: 'pointer' }}
                        >
                          {formattedDate}
                        </Link>
                      </TableCell>
                      <TableCell>{fullName}</TableCell>
                      <TableCell>{record.brand || '—'}</TableCell>
                      <TableCell>{record.location || '—'}</TableCell>
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
    </Stack>
  );
};

export default ValueReports;
