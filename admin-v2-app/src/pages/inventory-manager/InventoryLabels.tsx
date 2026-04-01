import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type MarkedRecord = {
  id: string;
  ccgNumber: string;
  title: string;
  imageUrl?: string | null;
};

type InventoryListResponse = {
  records: MarkedRecord[];
  total: number;
  message?: string;
};

const InventoryLabels = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<MarkedRecord[]>([]);
  const [printCounts, setPrintCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Inventory Labels';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '200');
        params.set('sortBy', 'created_at');
        params.set('sortDir', 'asc');
        params.set('onlyMarked', '1');
        params.set('active', '1');

        const response = await fetch(`/api/inventory?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as InventoryListResponse;
        if (!response.ok) throw new Error(data.message || 'Unable to load marked items.');
        if (cancelled) return;

        const items = Array.isArray(data.records) ? data.records : [];
        setRecords(items);
        const defaults: Record<string, number> = {};
        for (const item of items) {
          defaults[item.id] = 1;
        }
        setPrintCounts(defaults);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load marked items.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const handleCountChange = useCallback((id: string, count: number) => {
    setPrintCounts((prev) => ({ ...prev, [id]: count }));
  }, []);

  const totalLabels = useMemo(
    () => records.reduce((sum, r) => sum + (printCounts[r.id] || 1), 0),
    [records, printCounts],
  );

  const handlePrint = async () => {
    setIsPrinting(true);
    setErrorMessage('');

    const items = records.map((r) => ({
      id: r.id,
      count: printCounts[r.id] || 1,
    }));

    try {
      const response = await fetch('/api/admin-v2/inventory/labels.pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        let message = 'Unable to generate labels PDF.';
        try {
          const data = (await response.json()) as { message?: string };
          if (data?.message) message = data.message;
        } catch { /* fallback */ }
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

      navigate(paths.inventoryManager);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate labels PDF.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h4">Inventory Labels</Typography>
          </Paper>
        </Grid>

        <Grid size={12}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>
          )}

          {isLoading ? (
            <Stack sx={{ alignItems: 'center', py: 8 }}>
              <CircularProgress />
            </Stack>
          ) : records.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                No marked inventory items found. Mark items in Inventory Manager first.
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              {/* Header */}
              <Stack
                direction="row"
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: 'background.elevation1',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" sx={{ width: 160, flexShrink: 0, fontWeight: 'bold' }}>
                  CCG #
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 'bold' }}>
                  Title
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 100, textAlign: 'center', fontWeight: 'bold' }}>
                  # to Print
                </Typography>
              </Stack>

              {/* Rows */}
              {records.map((record) => (
                <Stack
                  key={record.id}
                  direction="row"
                  sx={{
                    px: 2,
                    py: 1,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Typography variant="body2" sx={{ width: 160, flexShrink: 0 }}>
                    {record.ccgNumber}
                  </Typography>
                  <Stack direction="row" sx={{ flex: 1, alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    {record.imageUrl ? (
                      <Box
                        component="img"
                        src={record.imageUrl}
                        alt={record.title}
                        sx={{
                          width: 40,
                          height: 40,
                          objectFit: 'cover',
                          borderRadius: 1,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {record.title}
                    </Typography>
                  </Stack>
                  <Box sx={{ width: 100, display: 'flex', justifyContent: 'center' }}>
                    <Select
                      size="small"
                      value={printCounts[record.id] || 1}
                      onChange={(e) => handleCountChange(record.id, Number(e.target.value))}
                      sx={{ minWidth: 70 }}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <MenuItem key={n} value={n}>{n}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                </Stack>
              ))}

              {/* Footer */}
              <Stack
                direction="row"
                sx={{
                  px: 2,
                  py: 2,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {records.length} item{records.length !== 1 ? 's' : ''} · {totalLabels} label{totalLabels !== 1 ? 's' : ''} · {Math.ceil(totalLabels / 10)} page{Math.ceil(totalLabels / 10) !== 1 ? 's' : ''}
                </Typography>
                <Button
                  variant="contained"
                  onClick={handlePrint}
                  disabled={isPrinting || records.length === 0}
                  startIcon={
                    isPrinting ? (
                      <CircularProgress color="inherit" size={16} />
                    ) : (
                      <IconifyIcon icon="material-symbols:print-outline-rounded" />
                    )
                  }
                >
                  {isPrinting ? 'Generating…' : 'Print Labels'}
                </Button>
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default InventoryLabels;
