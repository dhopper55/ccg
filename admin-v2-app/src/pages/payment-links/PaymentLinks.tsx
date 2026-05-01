import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  ChipOwnProps,
  InputAdornment,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import DataGridPagination from 'components/pagination/DataGridPagination';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';
import StyledTextField from 'components/styled/StyledTextField';

type StripePaymentLink = {
  id: string;
  name: string;
  price: string;
  created: number;
  createdLabel: string;
  status: 'Active' | 'Deactivated';
  automaticTax: boolean;
  url: string;
};

type PaymentLinksResponse = {
  records?: StripePaymentLink[];
  message?: string;
};

const getStatusBadgeColor = (value: StripePaymentLink['status']): ChipOwnProps['color'] =>
  value === 'Active' ? 'success' : 'neutral';

const PaymentLinks = () => {
  const [paymentLinks, setPaymentLinks] = useState<StripePaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadPaymentLinks = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin-v2/payment-links', { credentials: 'same-origin' });
        const payload = (await response.json()) as PaymentLinksResponse;
        if (!response.ok) throw new Error(payload.message || 'Unable to load payment links.');
        if (!cancelled) setPaymentLinks(payload.records || []);
      } catch (loadError) {
        if (!cancelled) {
          setPaymentLinks([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load payment links.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadPaymentLinks();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPaymentLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return paymentLinks;
    return paymentLinks.filter((paymentLink) =>
      [
        paymentLink.name,
        paymentLink.price,
        paymentLink.status,
        paymentLink.createdLabel,
        paymentLink.url,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [paymentLinks, search]);

  const columns: GridColDef<StripePaymentLink>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        minWidth: 420,
        flex: 1,
        renderCell: (params) => (
          <Stack sx={{ minWidth: 0, justifyContent: 'center' }}>
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', minWidth: 0 }}>
              <Link
                href={params.row.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="subtitle2"
                sx={{ fontWeight: 700, lineHeight: 1.25 }}
              >
                {params.row.name || params.row.id}
              </Link>
              <Chip
                label={params.row.status}
                variant="soft"
                color={getStatusBadgeColor(params.row.status)}
                size="small"
              />
            </Stack>
          </Stack>
        ),
      },
      {
        field: 'price',
        headerName: 'Price',
        minWidth: 220,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.row.price || '—'}
          </Typography>
        ),
      },
      {
        field: 'created',
        headerName: 'Created',
        minWidth: 180,
        valueFormatter: (value) => (value ? dayjs.unix(Number(value)).format('MMM D, h:mm A') : '—'),
      },
    ],
    [],
  );

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="Payment Links"
        breadcrumb={[
          { label: 'Home', url: paths.starter },
          { label: 'Order Manager', url: paths.orderManager },
          { label: 'Payment Links', active: true },
        ]}
        actionComponent={
          <Button
            variant="contained"
            disabled
            startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
          >
            Create payment link
          </Button>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Stack direction="column" sx={{ gap: 4 }}>
          <Stack
            sx={{
              gap: 2,
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { md: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <StyledTextField
              id="payment-link-search-box"
              type="search"
              size="medium"
              placeholder="Search payment links"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconifyIcon icon="material-symbols:search-rounded" sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ maxWidth: { sm: 360 } }}
            />
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {['Created', 'Status', 'Automatic tax'].map((label) => (
                <Chip
                  key={label}
                  label={label}
                  variant="outlined"
                  icon={<IconifyIcon icon="material-symbols:add-circle-outline-rounded" />}
                  sx={{ borderStyle: 'dashed' }}
                />
              ))}
            </Stack>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ width: 1 }}>
            <DataGrid
              rowHeight={68}
              rows={filteredPaymentLinks}
              columns={columns}
              loading={isLoading}
              pageSizeOptions={[10]}
              initialState={{
                pagination: {
                  paginationModel: {
                    pageSize: 10,
                  },
                },
              }}
              slots={{
                basePagination: (props) => <DataGridPagination showFullPagination {...props} />,
              }}
            />
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default PaymentLinks;
