import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
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
import useNumberFormat from 'hooks/useNumberFormat';
import { formatOrderNumber } from 'lib/utils';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import DataGridPagination from 'components/pagination/DataGridPagination';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';
import StyledTextField from 'components/styled/StyledTextField';

type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  itemTitle: string;
  itemCount: number;
  totalCents: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  checkoutProvider: string;
  paymentMethodLabel: string;
};

type OrdersResponse = {
  records?: AdminOrderSummary[];
};

const getPaymentStatusBadgeColor = (value: string): ChipOwnProps['color'] => {
  switch (value) {
    case 'paid':
      return 'success';
    case 'cancelled':
    case 'expired':
      return 'error';
    case 'checkout_open':
      return 'warning';
    default:
      return 'neutral';
  }
};

const paymentIcon = (provider: string) =>
  provider === 'cash' ? 'material-symbols:payments-outline-rounded' : 'material-symbols:credit-card-outline';

const OrderManager = () => {
  const { currencyFormat } = useNumberFormat();
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadOrders = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin-v2/orders', { credentials: 'same-origin' });
        const payload = (await response.json()) as OrdersResponse;
        if (!response.ok) throw new Error('Unable to load orders.');
        if (!cancelled) setOrders(payload.records || []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      [
        order.orderNumber,
        formatOrderNumber(order.orderNumber),
        order.customerName,
        order.customerEmail,
        order.itemTitle,
        order.paymentStatus,
        order.checkoutProvider,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [orders, search]);

  const columns: GridColDef<AdminOrderSummary>[] = useMemo(
    () => [
      {
        field: 'orderNumber',
        headerName: 'Order',
        minWidth: 220,
        renderCell: (params) => (
          <Link
            variant="subtitle2"
            href={paths.orderManagerItemWithId(params.row.id)}
            sx={{ fontWeight: 600 }}
          >
            {formatOrderNumber(params.row.orderNumber)}
          </Link>
        ),
      },
      {
        field: 'date',
        headerName: 'Date',
        minWidth: 180,
        valueFormatter: (value) => (value ? dayjs(value).format('MMM D, YYYY h:mm A') : '—'),
      },
      {
        field: 'customerName',
        headerName: 'Customer',
        minWidth: 280,
        flex: 1,
        renderCell: (params) => (
          <Stack sx={{ gap: 1.5, alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32 }}>{params.row.customerName.charAt(0)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {params.row.customerName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {params.row.customerEmail || 'No email'}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'checkoutProvider',
        headerName: 'Payment',
        minWidth: 132,
        renderCell: (params) => (
          <Stack sx={{ alignItems: 'center', gap: 1 }}>
            <IconifyIcon icon={paymentIcon(params.row.checkoutProvider)} sx={{ fontSize: 22 }} />
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
              {params.row.checkoutProvider || 'stripe'}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'paymentStatus',
        headerName: 'Payment status',
        minWidth: 160,
        renderCell: (params) => (
          <Chip
            label={params.row.paymentStatus.replace(/_/g, ' ')}
            variant="soft"
            color={getPaymentStatusBadgeColor(params.row.paymentStatus)}
            sx={{ textTransform: 'capitalize' }}
          />
        ),
      },
      {
        field: 'itemCount',
        headerName: 'Items',
        minWidth: 104,
        renderCell: (params) => (
          <Typography variant="body2">
            {params.row.itemCount || 1} ({currencyFormat(params.row.totalCents / 100)})
          </Typography>
        ),
      },
      {
        field: 'totalCents',
        headerName: 'Total',
        minWidth: 132,
        renderCell: (params) => <strong>{currencyFormat(params.row.totalCents / 100)}</strong>,
      },
    ],
    [currencyFormat],
  );

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="Order Manager"
        breadcrumb={[
          { label: 'Home', url: paths.starter },
          { label: 'Order Manager', active: true },
        ]}
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Stack direction="column" sx={{ gap: 4 }}>
          <StyledTextField
            id="order-search-box"
            type="search"
            size="medium"
            placeholder="Search orders"
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
            sx={{ maxWidth: { sm: 320 } }}
          />
          <Box sx={{ width: 1 }}>
            <DataGrid
              rowHeight={64}
              rows={filteredOrders}
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

export default OrderManager;
