import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  ChipOwnProps,
  Link,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import useNumberFormat from 'hooks/useNumberFormat';
import { formatOrderNumber } from 'lib/utils';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import DataGridPagination from 'components/pagination/DataGridPagination';
import PageBreadcrumb from 'components/sections/common/PageBreadcrumb';
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
  listingsUpdated: boolean;
  settled: boolean;
  moneyAccounted: boolean;
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
    case 'refunded':
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
  const [listingsUpdatedFilter, setListingsUpdatedFilter] = useState('');
  const [settledFilter, setSettledFilter] = useState('');
  const [moneyAccountedFilter, setMoneyAccountedFilter] = useState('');

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin-v2/orders', { credentials: 'same-origin' });
      const payload = (await response.json()) as OrdersResponse;
      if (!response.ok) throw new Error('Unable to load orders.');
      setOrders(payload.records || []);
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const matchesFilter = (value: boolean, filter: string) => {
      if (!filter) return true;
      return filter === 'yes' ? value : !value;
    };

    return orders.filter((order) =>
      matchesFilter(order.listingsUpdated, listingsUpdatedFilter) &&
      matchesFilter(order.settled, settledFilter) &&
      matchesFilter(order.moneyAccounted, moneyAccountedFilter),
    );
  }, [listingsUpdatedFilter, moneyAccountedFilter, orders, settledFilter]);

  const columns: GridColDef<AdminOrderSummary>[] = useMemo(
    () => [
      {
        field: 'orderNumber',
        headerName: 'Order',
        width: 150,
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
        width: 120,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => {
          const tooltipLines = [
            params.row.customerName,
            params.row.customerEmail,
          ].filter(Boolean);
          return (
            <Tooltip title={tooltipLines.join('\n')}>
              <Avatar sx={{ width: 32, height: 32, mx: 'auto' }}>
                {params.row.customerName.charAt(0)}
              </Avatar>
            </Tooltip>
          );
        },
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
        field: 'totalCents',
        headerName: 'Total',
        minWidth: 132,
        renderCell: (params) => <strong>{currencyFormat(params.row.totalCents / 100)}</strong>,
      },
    ],
    [currencyFormat],
  );

  return (
    <Stack direction="column" height={1} sx={{ gap: 4 }}>
      <Stack
        sx={{
          gap: 2,
          alignItems: { md: 'flex-end' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        <Stack direction="column" sx={{ gap: 1 }}>
        <PageBreadcrumb
          items={[
          { label: 'Home', url: paths.starter },
          { label: 'Order Manager', active: true },
        ]}
        />
        <Typography variant="h4">Order Manager</Typography>
        </Stack>
        <Stack sx={{ gap: 1.5, flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}>
          <OrderStatusFilter
            label="Listings Updated"
            value={listingsUpdatedFilter}
            onChange={setListingsUpdatedFilter}
          />
          <OrderStatusFilter
            label="Settled"
            value={settledFilter}
            onChange={setSettledFilter}
          />
          <OrderStatusFilter
            label="Money Accounted"
            value={moneyAccountedFilter}
            onChange={setMoneyAccountedFilter}
          />
        </Stack>
      </Stack>
      <Stack direction="column" sx={{ gap: 4, flex: 1 }}>
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
    </Stack>
  );
};

const OrderStatusFilter = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <StyledTextField
    select
    size="small"
    label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    sx={{
      minWidth: 154,
      '& .MuiInputBase-input': {
        fontSize: 13,
      },
      '& .MuiInputLabel-root': {
        fontSize: 13,
      },
    }}
  >
    <MenuItem value="">Any</MenuItem>
    <MenuItem value="yes">Yes</MenuItem>
    <MenuItem value="no">No</MenuItem>
  </StyledTextField>
);

export default OrderManager;
