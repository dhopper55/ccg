import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  CircularProgress,
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
  Tooltip,
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type PurchaseLotItemRecord = {
  id: number;
  ccg_number: string;
  title: string;
  unit_purchase_price: number | null;
  private_party_value: number | null;
  for_sale_amount: number;
};

type PurchaseLotItemsResponse = {
  lot?: { id: number; name: string };
  records?: PurchaseLotItemRecord[];
  message?: string;
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

const PurchasedLotItems = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotId = searchParams.get('id') || '';
  const [lotName, setLotName] = useState('');
  const [records, setRecords] = useState<PurchaseLotItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Purchased Lot Items';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      if (!lotId) {
        setErrorMessage('Missing purchase lot ID.');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetch(`/api/admin-v2/purchased-lots/${encodeURIComponent(lotId)}/items`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as PurchaseLotItemsResponse;
        if (!response.ok) throw new Error(data.message || 'Unable to load lot items.');
        if (cancelled) return;
        setLotName(data.lot?.name || '');
        setRecords(Array.isArray(data.records) ? data.records : []);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load lot items.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [lotId]);

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
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
            <Tooltip title="Back to Purchased Lots">
              <IconButton color="inherit" onClick={() => navigate(paths.purchasedLots)}>
                <IconifyIcon icon="material-symbols:arrow-back-rounded" />
              </IconButton>
            </Tooltip>
            <Typography variant="h4">{lotName || 'Purchased Lot Items'}</Typography>
          </Stack>
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
                <Typography sx={{ color: 'text.secondary' }}>Loading lot items...</Typography>
              </Stack>
            ) : records.length === 0 ? (
              <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
                <IconifyIcon icon="material-symbols:inventory-2-outline-rounded" fontSize={40} />
                <Typography sx={{ color: 'text.secondary' }}>No items linked to this lot.</Typography>
              </Stack>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>CCG Number</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Unit Cost</TableCell>
                      <TableCell align="right">Private Party</TableCell>
                      <TableCell align="right">For Sale</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} hover>
                        <TableCell>
                          <Link
                            underline="none"
                            color="text.primary"
                            href={paths.inventoryItemWithId(String(record.id))}
                            onClick={(event) => {
                              event.preventDefault();
                              navigate(paths.inventoryItemWithId(String(record.id)));
                            }}
                            sx={{ fontWeight: 600 }}
                          >
                            {record.ccg_number || '—'}
                          </Link>
                        </TableCell>
                        <TableCell>{record.title}</TableCell>
                        <TableCell align="right">{formatCurrency(record.unit_purchase_price)}</TableCell>
                        <TableCell align="right">{formatCurrency(record.private_party_value)}</TableCell>
                        <TableCell align="right">{formatCurrency(record.for_sale_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
};

export default PurchasedLotItems;
