import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
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

type SerialDecodeRecord = {
  id: number;
  eventTimeUtc: string | null;
  clientTimestamp: string | null;
  brand: string;
  serial: string;
  success: boolean;
  year: string | null;
  factory: string | null;
  country: string | null;
  error: string | null;
};

type SerialDecodesResponse = {
  records: SerialDecodeRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  message?: string;
};

const PAGE_SIZE = 20;

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const usDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!usDate) return null;

  const month = Number.parseInt(usDate[1], 10) - 1;
  const day = Number.parseInt(usDate[2], 10);
  const year = Number.parseInt(usDate[3], 10);
  const hour = Number.parseInt(usDate[4] || '0', 10);
  const minute = Number.parseInt(usDate[5] || '0', 10);
  const second = Number.parseInt(usDate[6] || '0', 10);
  const parsed = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatTimestampMountain(clientTimestamp: string | null, eventTimeUtc: string | null): string {
  const parsed = parseTimestamp(clientTimestamp) || parseTimestamp(eventTimeUtc);
  if (!parsed) return '-';

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);

  return formatted.replace(',', '');
}

const SerialDecodes = () => {
  const [records, setRecords] = useState<SerialDecodeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<SerialDecodeRecord | null>(null);

  useEffect(() => {
    document.title = 'CCG Admin | Serial Decodes';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSerialDecodes = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));

        const response = await fetch(`/api/admin-v2/serial-decodes?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });

        const data = (await response.json()) as SerialDecodesResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load serial decode records.');
        }

        if (cancelled) return;
        setRecords(Array.isArray(data.records) ? data.records : []);
        setPage(Math.max(1, Number(data.page || 1)));
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setTotal(0);
        setTotalPages(1);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load serial decode records.',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadSerialDecodes();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const pageStart = useMemo(() => (page - 1) * PAGE_SIZE + 1, [page]);
  const pageEnd = useMemo(() => Math.min(page * PAGE_SIZE, total), [page, total]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={1} mb={3}>
          <Typography variant="h4">Serial Decodes</Typography>
          <Typography variant="body2" color="text.secondary">
            Recent decoder events. Additional charts and trend visualizations will be added here in a later step.
          </Typography>
        </Stack>

        {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Serial</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Success</TableCell>
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
                      No serial decode records found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const successColor = record.success ? 'success.light' : 'error.light';
                  return (
                    <TableRow
                      key={record.id}
                      hover
                      onClick={() => setSelectedRecord(record)}
                      sx={{
                        cursor: 'pointer',
                        '& td': { color: successColor },
                      }}
                    >
                      <TableCell>{formatTimestampMountain(record.clientTimestamp, record.eventTimeUtc)}</TableCell>
                      <TableCell>{record.brand || '-'}</TableCell>
                      <TableCell>{record.serial || '-'}</TableCell>
                      <TableCell>{record.success ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
          <Typography variant="body2" color="text.secondary">
            {total > 0 ? `Showing ${pageStart}-${pageEnd} of ${total}` : 'Showing 0 records'}
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

      <Dialog open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} fullWidth maxWidth="sm">
        <DialogTitle>Serial Decode Details</DialogTitle>
        <DialogContent dividers>
          {selectedRecord ? (
            <Stack spacing={1.25}>
              <Box>
                <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                <Typography variant="body2">
                  {formatTimestampMountain(selectedRecord.clientTimestamp, selectedRecord.eventTimeUtc)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Brand</Typography>
                <Typography variant="body2">{selectedRecord.brand || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Serial</Typography>
                <Typography variant="body2">{selectedRecord.serial || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Success</Typography>
                <Typography variant="body2">{selectedRecord.success ? 'Yes' : 'No'}</Typography>
              </Box>

              {selectedRecord.success ? (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Year</Typography>
                    <Typography variant="body2">{selectedRecord.year || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Factory</Typography>
                    <Typography variant="body2">{selectedRecord.factory || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Country</Typography>
                    <Typography variant="body2">{selectedRecord.country || '-'}</Typography>
                  </Box>
                </>
              ) : (
                <Box>
                  <Typography variant="caption" color="text.secondary">Error</Typography>
                  <Typography variant="body2" color="error.light">
                    {selectedRecord.error || 'Unknown decode error'}
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default SerialDecodes;
