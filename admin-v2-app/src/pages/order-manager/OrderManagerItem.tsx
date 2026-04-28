import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import dayjs from 'dayjs';
import useNumberFormat from 'hooks/useNumberFormat';
import { useSearchParams } from 'react-router';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import PageBreadcrumb from 'components/sections/common/PageBreadcrumb';

type AdminOrderItem = {
  inventoryItemId: number;
  ccgNumber: string;
  title: string;
  quantity: number;
  unitAmountCents: number;
  subtotalCents: number;
};

type AdminOrderDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  checkoutProvider: string;
  checkoutMode: string;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: string;
  paidAt: string;
  paymentMethodLabel: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: AdminOrderItem[];
  events: Array<{
    id: string | number;
    message: string;
    createdAt: string;
  }>;
};

type OrderDetailResponse = {
  record?: AdminOrderDetail;
};

const paymentIcon = (provider: string) =>
  provider === 'cash' ? 'material-symbols:payments-outline-rounded' : 'material-symbols:credit-card-outline';

const OrderManagerItem = () => {
  const [searchParams] = useSearchParams();
  const { currencyFormat } = useNumberFormat();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const orderId = searchParams.get('id') || '';

  useEffect(() => {
    let cancelled = false;
    const loadOrder = async () => {
      if (!orderId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin-v2/orders/${encodeURIComponent(orderId)}`, {
          credentials: 'same-origin',
        });
        const payload = (await response.json()) as OrderDetailResponse;
        if (!response.ok || !payload.record) throw new Error('Unable to load order.');
        if (!cancelled) setOrder(payload.record);
      } catch {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const itemCount = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    [order?.items],
  );

  if (isLoading) {
    return (
      <Paper sx={{ p: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: 'text.secondary' }}>Loading order...</Typography>
      </Paper>
    );
  }

  if (!order) {
    return (
      <Paper sx={{ p: { xs: 4, md: 6 } }}>
        <Typography variant="h5">Order not found</Typography>
      </Paper>
    );
  }

  return (
    <Grid container>
      <Grid size={{ xs: 12, md: 8, xl: 9 }}>
        <Stack direction="column">
          <Paper sx={{ height: 1, p: { xs: 3, md: 5 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, justifyContent: 'space-between' }}>
              <Box sx={{ width: 'fit-content' }}>
                <PageBreadcrumb
                  items={[
                    { label: 'Order Manager', url: paths.orderManager },
                    { label: 'Order', active: true },
                  ]}
                  sx={{ mb: 1, flexWrap: 'nowrap' }}
                />
                <Typography variant="h4" sx={{ mb: 2 }}>
                  Order <Box component="span">{order.orderNumber}</Box>
                </Typography>
                <Stack sx={{ gap: 1, alignItems: 'center' }}>
                  <IconifyIcon icon={paymentIcon(order.checkoutProvider)} sx={{ fontSize: 22 }} />
                  <Chip
                    variant="soft"
                    color={order.status === 'paid' ? 'success' : 'warning'}
                    label={order.status.replace(/_/g, ' ')}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Stack>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: { sm: 'end' }, mt: 'auto' }}>
                <Box component="span" whiteSpace="nowrap">
                  Placed on <strong>{dayjs(order.createdAt || order.paidAt).format('MMM D, YYYY')}</strong>
                </Box>
                <br />
                <Box component="span" whiteSpace="nowrap">
                  at <strong>{dayjs(order.createdAt || order.paidAt).format('h:mm A')},</strong>{' '}
                  <strong>
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                  </strong>{' '}
                  in total
                </Box>
              </Typography>
            </Stack>
          </Paper>

          <Paper sx={{ height: 1, p: { xs: 3, md: 5 } }}>
            <Container maxWidth={false} sx={{ maxWidth: 694, px: { xs: 0 } }}>
              <Box sx={{ bgcolor: 'background.elevation1', borderRadius: 2, p: 2, mb: 4 }}>
                <Stack sx={{ gap: 2, justifyContent: 'space-between', textTransform: 'capitalize' }}>
                  <Chip variant="filled" color="success" label={`${itemCount} item${itemCount === 1 ? '' : 's'}`} />
                  <Divider flexItem orientation="vertical" sx={{ ml: 'auto' }} />
                  <Chip variant="filled" color={order.status === 'paid' ? 'success' : 'warning'} label={order.status.replace(/_/g, ' ')} />
                </Stack>
              </Box>

              <Stack direction="column" sx={{ gap: 5 }}>
                {order.items.map((item) => (
                  <Stack key={`${item.inventoryItemId}-${item.ccgNumber}`} sx={{ gap: 2, alignItems: 'center' }}>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 56,
                        height: 56,
                        bgcolor: 'background.elevation2',
                        borderRadius: 2,
                      }}
                    >
                      <IconifyIcon icon="material-symbols:inventory-2-outline-rounded" sx={{ fontSize: 24 }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineClamp: 1 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.ccgNumber}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.quantity} x {currencyFormat(item.unitAmountCents / 100)}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {currencyFormat(item.subtotalCents / 100)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Container>
          </Paper>

          <Paper sx={{ height: 1, p: { xs: 3, md: 5 } }}>
            <Container maxWidth={false} sx={{ maxWidth: 694, px: { xs: 0 } }}>
              <Stack sx={{ alignItems: 'center', gap: 2, mb: 4 }}>
                <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'success.lighter', borderRadius: 2 }}>
                  <IconifyIcon icon="material-symbols:check-rounded" color="success.main" fontSize={20} />
                </Avatar>
                <Typography variant="h6">{order.status}</Typography>
              </Stack>
              <Stack direction="column" divider={<Divider flexItem />} sx={{ gap: 2, bgcolor: 'background.elevation1', borderRadius: 6, p: 3 }}>
                <PriceSummaryRow label="Subtotal" value={order.subtotalCents / 100} />
                <PriceSummaryRow label="Shipping cost" value={0} />
                <PriceSummaryRow label="Discount" value={order.discountCents / 100} />
                <PriceSummaryRow label="Sales tax" value={order.taxCents / 100} />
                <Stack sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Total
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {currencyFormat(order.totalCents / 100)}
                  </Typography>
                </Stack>
              </Stack>
            </Container>
          </Paper>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 4, xl: 3 }}>
        <Paper background={1} sx={{ height: 1 }}>
          <Stack direction="column" divider={<Divider flexItem orientation="horizontal" />}>
            <Box sx={{ p: { xs: 3, md: 4, lg: 5 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Customer
              </Typography>
              <Avatar sx={{ width: 54, height: 54, mb: 1 }}>{order.customer.name.charAt(0)}</Avatar>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {order.customer.name}
              </Typography>
              {order.customer.email && (
                <Link href={`mailto:${order.customer.email}`} variant="body2">
                  {order.customer.email}
                </Link>
              )}
            </Box>
            <Box sx={{ p: { xs: 3, md: 4, lg: 5 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Payment
              </Typography>
              <Stack sx={{ gap: 1, alignItems: 'center', mb: 1 }}>
                <IconifyIcon icon={paymentIcon(order.checkoutProvider)} sx={{ fontSize: 22 }} />
                <Typography variant="body2">{order.paymentMethodLabel}</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                {order.checkoutProvider} / {order.checkoutMode || 'checkout'}
              </Typography>
            </Box>
            <Box sx={{ p: { xs: 3, md: 4, lg: 5 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Timeline
              </Typography>
              <Stack direction="column" sx={{ gap: 2 }}>
                {order.events.length > 0 ? (
                  order.events.map((event) => (
                    <Box key={event.id}>
                      <Typography variant="body2">{event.message}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {event.createdAt ? dayjs(event.createdAt).format('MMM D, YYYY h:mm A') : ''}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No timeline events.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
};

const PriceSummaryRow = ({ label, value }: { label: string; value: number }) => {
  const { currencyFormat } = useNumberFormat();

  return (
    <Stack sx={{ justifyContent: 'space-between', alignItems: 'center', color: 'text.secondary' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
        {label}
      </Typography>
      <Typography variant="subtitle2">{currencyFormat(value)}</Typography>
    </Stack>
  );
};

export default OrderManagerItem;
