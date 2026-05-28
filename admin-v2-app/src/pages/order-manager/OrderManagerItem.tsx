import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import useNumberFormat from 'hooks/useNumberFormat';
import { formatOrderNumber } from 'lib/utils';
import { ensureStarWebPrntGlobals } from 'lib/starWebPrntShim';
import { useSearchParams } from 'react-router';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import PageBreadcrumb from 'components/sections/common/PageBreadcrumb';

type AdminOrderItem = {
  inventoryItemId: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
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
  shippingLabel?: string;
  shippingCents?: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  cardAmountCents?: number;
  cashAmountCents?: number;
  listingsUpdated: boolean;
  settled: boolean;
  moneyAccounted: boolean;
  costBasisAdjusted: string;
  accountingFunds?: {
    usedLocalFunds: number;
    mfrWholesaleFunds: number;
  };
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

type RefundResponse = {
  message?: string;
  provider?: string;
  stripeRefundAmountCents?: number;
  stripeRetainedFeeCents?: number;
};

type OrderStatusFlagKey = 'listingsUpdated' | 'settled';

const orderStatusFlags: Array<{ key: OrderStatusFlagKey; label: string }> = [
  { key: 'listingsUpdated', label: 'Listings Updated' },
  { key: 'settled', label: 'Settled' },
];

const paymentIcon = (provider: string) =>
  provider === 'cash' ? 'material-symbols:payments-outline-rounded' : 'material-symbols:credit-card-outline';

const printerUrlStorageKey = 'ccg-star-webprnt-url';
const receiptLogoUrl = 'https://www.coalcreekguitars.com/images/ccg_bnw.bmp';
const refundReceiptTemplateCode = 'base_refund_receipt';
const maxLogoWidth = 384;
const receiptLineWidth = 32;
const fallbackRefundReceiptTemplate = `{{logo}}
{{center}}{{text bold="true" size="2"}}REFUND RECEIPT{{/text}}{{/center}}
{{center}}Coal Creek Guitars{{/center}}
{{center}}Order {{orderNumber}}{{/center}}
{{dateLine}}
{{hr}}
{{itemHeader}}
{{#items}}{{line}}
{{/items}}{{hr}}
Subtotal Refund {{subtotal}}
Sales Tax ({{salesTaxRate}}) {{salesTax}}
{{text bold="true"}}Total Refund {{total}}{{/text}}
{{paymentMethodLabel}}
{{hr}}
Inventory restored to Coal Creek Guitars.
Customer copy.`;
const defaultStarEndpoints = [
  'https://localhost:8001/StarWebPRNT/SendMessage',
  'http://localhost:8001/StarWebPRNT/SendMessage',
];

const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const parseAccountingAmount = (value: string) => {
  const normalized = value.replace(/[$,]/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
};

const buildCashDrawerKickElement = (builder: NonNullable<typeof window.StarWebPrintBuilder> extends new () => infer T ? T : never) =>
  builder.createPeripheralElement({ channel: 0, on: 200, off: 200 });

const orderHasCashComponent = (record: Pick<AdminOrderDetail, 'checkoutProvider' | 'cashAmountCents'>) =>
  record.checkoutProvider === 'cash' ||
  record.checkoutProvider.includes('cash') ||
  Math.max(0, Number(record.cashAmountCents || 0)) > 0;

const padReceiptColumns = (left: string, right: string, width = receiptLineWidth) => {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanRight = right.trim();
  const maxLeftLength = Math.max(1, width - cleanRight.length - 1);
  const visibleLeft = cleanLeft.length > maxLeftLength ? cleanLeft.slice(0, maxLeftLength) : cleanLeft;
  return `${visibleLeft}${' '.repeat(Math.max(1, width - visibleLeft.length - cleanRight.length))}${cleanRight}`;
};

const replaceTemplateVariables = (template: string, values: Record<string, string>) =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => values[key] ?? match);

const parseTextDirectiveAttributes = (value: string) => {
  const attrs: Record<string, string> = {};
  value.replace(/([a-zA-Z0-9_-]+)="([^"]*)"/g, (_, key: string, attrValue: string) => {
    attrs[key] = attrValue;
    return '';
  });
  return attrs;
};

const loadReceiptLogo = async () => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('Unable to load receipt logo image.'));
    nextImage.src = receiptLogoUrl;
  });
  const targetWidth = Math.min(maxLogoWidth, image.naturalWidth || maxLogoWidth);
  const scale = targetWidth / (image.naturalWidth || targetWidth);
  const targetHeight = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create receipt logo canvas.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return { context, width: targetWidth, height: targetHeight };
};

const OrderManagerItem = () => {
  const [searchParams] = useSearchParams();
  const { currencyFormat } = useNumberFormat();
  const { enqueueSnackbar } = useSnackbar();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);
  const [updatingFlag, setUpdatingFlag] = useState<OrderStatusFlagKey | null>(null);
  const [accountFundsOpen, setAccountFundsOpen] = useState(false);
  const [accountFundsForm, setAccountFundsForm] = useState({
    adjustedCostBasis: '0.00',
    usedLocalFunds: '0.00',
    mfrWholesaleFunds: '0.00',
  });
  const [accountFundsError, setAccountFundsError] = useState('');
  const [isAccountingFunds, setIsAccountingFunds] = useState(false);
  const orderId = searchParams.get('id') || '';

  const loadOrder = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!orderId) {
      setIsLoading(false);
      return null;
    }
    if (!options.silent) setIsLoading(true);
    try {
      const response = await fetch(`/api/admin-v2/orders/${encodeURIComponent(orderId)}`, {
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as OrderDetailResponse;
      if (!response.ok || !payload.record) throw new Error('Unable to load order.');
      setOrder(payload.record);
      return payload.record;
    } catch {
      setOrder(null);
      return null;
    } finally {
      if (!options.silent) setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    ensureStarWebPrntGlobals();
  }, []);

  const resolvePrinterUrl = () => {
    const runtimeUrl = window.__STAR_WEBPRNT_URL__;
    const storedUrl = window.localStorage.getItem(printerUrlStorageKey) || '';
    return runtimeUrl || storedUrl || defaultStarEndpoints[0];
  };

  const sendToPrinter = async (request: string) => {
    ensureStarWebPrntGlobals();
    if (!window.StarWebPrintTrader) throw new Error('Star webPRNT is not available in this browser context.');
    const initialUrl = resolvePrinterUrl();
    const candidateUrls = [initialUrl, ...defaultStarEndpoints].filter(
      (url, index, all) => url && all.indexOf(url) === index,
    );
    let lastError: Error | null = null;
    for (const url of candidateUrls) {
      try {
        await new Promise<void>((resolve, reject) => {
          const trader = new window.StarWebPrintTrader!({ url, timeout: 90000 });
          trader.onReceive = () => resolve();
          trader.onError = (response) => reject(new Error(response.responseText || 'Star webPRNT request failed.'));
          trader.sendMessage({ request });
        });
        window.localStorage.setItem(printerUrlStorageKey, url);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError || new Error('Unable to reach the Star webPRNT endpoint.');
  };

  const fetchRefundTemplate = async () => {
    const response = await fetch(`/api/shop/receipt-templates/${refundReceiptTemplateCode}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return fallbackRefundReceiptTemplate;
    const payload = (await response.json()) as { record?: { templateText?: string } };
    return payload.record?.templateText || fallbackRefundReceiptTemplate;
  };

  const renderRefundReceiptTemplate = (template: string, record: AdminOrderDetail, refund?: RefundResponse) => {
    const now = new Date();
    const receiptDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const receiptTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const retainedFeeCents = Number(refund?.stripeRetainedFeeCents || 0);
    const refundTotalCents = Number(refund?.stripeRefundAmountCents || 0) > 0
      ? Number(refund?.stripeRefundAmountCents || 0)
      : record.totalCents;
    const itemRows = record.items.map((item) => ({
      line: padReceiptColumns(
        `${item.quantity > 1 ? `${item.quantity}x ` : ''}${item.ccgNumber || `CCG-${item.inventoryItemId}`} ${item.title}`,
        `-${moneyFormat.format(item.subtotalCents / 100)}`,
      ),
    }));
    const withItems = template.replace(
      /{{#items}}([\s\S]*?){{\/items}}/g,
      (_, itemTemplate: string) => itemRows.map((item) => replaceTemplateVariables(itemTemplate, item)).join(''),
    );
    return replaceTemplateVariables(withItems, {
      dateLine: padReceiptColumns(`Date:${receiptDate}`, `Time:${receiptTime}`),
      receiptDate,
      receiptTime,
      orderNumber: record.orderNumber,
      itemHeader: padReceiptColumns('SKU / DESC', 'REFUND'),
      subtotal: `-${moneyFormat.format(record.subtotalCents / 100)}`,
      salesTax: `-${moneyFormat.format(record.taxCents / 100)}`,
      total: `-${moneyFormat.format(refundTotalCents / 100)}`,
      salesTaxRate: '8.05%',
      paymentMethodLabel: orderHasCashComponent(record)
        ? 'Refund includes cash return'
        : retainedFeeCents > 0
          ? `Refund to ${record.paymentMethodLabel}\nStripe fee retained ${moneyFormat.format(retainedFeeCents / 100)}`
          : `Refund to ${record.paymentMethodLabel}`,
    });
  };

  const buildRefundReceiptRequest = async (record: AdminOrderDetail, shouldKickCashDrawer: boolean, refund?: RefundResponse) => {
    ensureStarWebPrntGlobals();
    if (!window.StarWebPrintBuilder) throw new Error('Star webPRNT is not available in this browser context.');
    const builder = new window.StarWebPrintBuilder();
    const logo = await loadReceiptLogo();
    const renderedTemplate = renderRefundReceiptTemplate(await fetchRefundTemplate(), record, refund);
    const parts: string[] = [builder.createInitializationElement({ reset: false, print: false })];
    if (shouldKickCashDrawer) {
      parts.push(buildCashDrawerKickElement(builder));
    }
    const appendText = (data: string, options: Record<string, unknown> = {}) => {
      if (!data) return;
      parts.push(
        builder.createTextElement({
          codepage: 'utf8',
          international: 'usa',
          characterspace: 0,
          emphasis: false,
          invert: false,
          linespace: 32,
          width: 1,
          height: 1,
          font: 'font_a',
          underline: false,
          data,
          ...options,
        }),
      );
    };
    const tokenPattern = /{{logo}}|{{hr}}|{{center}}([\s\S]*?){{\/center}}|{{text\s+([^}]*)}}([\s\S]*?){{\/text}}/g;
    let cursor = 0;
    for (const match of renderedTemplate.matchAll(tokenPattern)) {
      appendText(renderedTemplate.slice(cursor, match.index));
      const token = match[0];
      if (token === '{{logo}}') {
        parts.push(
          builder.createAlignmentElement({ position: 'center' }),
          builder.createBitImageElement({ context: logo.context, x: 0, y: 0, width: logo.width, height: logo.height }),
          builder.createAlignmentElement({ position: 'left' }),
        );
      } else if (token === '{{hr}}') {
        appendText(`${'-'.repeat(receiptLineWidth)}\n`);
      } else if (token.startsWith('{{center}}')) {
        parts.push(builder.createAlignmentElement({ position: 'center' }));
        appendText(match[1] || '');
        parts.push(builder.createAlignmentElement({ position: 'left' }));
      } else {
        const attrs = parseTextDirectiveAttributes(match[2] || '');
        const size = Math.max(1, Math.min(4, Number(attrs.size || 1)));
        appendText(match[3] || '', { emphasis: attrs.bold === 'true', width: size, height: size });
      }
      cursor = (match.index || 0) + token.length;
    }
    appendText(renderedTemplate.slice(cursor));
    parts.push(builder.createFeedElement({ line: 3, unit: 0 }), builder.createCutPaperElement({ feed: true, type: 'partial' }));
    return parts.join('');
  };

  const handleConfirmRefund = async () => {
    if (!order) return;
    setIsRefunding(true);
    setConfirmOpen(false);
    try {
      const response = await fetch(`/api/admin-v2/orders/${encodeURIComponent(order.orderId)}/refund`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as RefundResponse;
      if (!response.ok) throw new Error(payload.message || 'Refund failed.');
      const refreshedOrder = await loadOrder({ silent: true });
      const recordForReceipt = refreshedOrder || { ...order, status: 'refunded' };
      const shouldKickCashDrawer = orderHasCashComponent(recordForReceipt);
      const localResults = await Promise.allSettled([
        buildRefundReceiptRequest(recordForReceipt, shouldKickCashDrawer, payload).then((request) => sendToPrinter(request)),
      ]);
      const localErrors = localResults
        .filter((nextResult): nextResult is PromiseRejectedResult => nextResult.status === 'rejected')
        .map((nextResult) => nextResult.reason instanceof Error ? nextResult.reason.message : String(nextResult.reason));
      const retainedFeeMessage = payload.stripeRetainedFeeCents
        ? ` Retained Stripe fee: ${currencyFormat(payload.stripeRetainedFeeCents / 100)}.`
        : '';
      setResult({
        severity: 'success',
        message: localErrors.length > 0
          ? `${payload.message || 'Order refunded.'}${retainedFeeMessage} Local mPOP command failed: ${localErrors.join(' ')}`
          : `${payload.message || 'Order refunded.'}${retainedFeeMessage}`,
      });
    } catch (error) {
      await loadOrder({ silent: true });
      setResult({ severity: 'error', message: error instanceof Error ? error.message : 'Refund failed.' });
    } finally {
      setIsRefunding(false);
      setResultOpen(true);
    }
  };

  const handleStatusFlagChange = async (field: OrderStatusFlagKey, checked: boolean) => {
    if (!order || updatingFlag) return;

    const previousOrder = order;
    setUpdatingFlag(field);
    setOrder({ ...order, [field]: checked });

    try {
      const response = await fetch(`/api/admin-v2/orders/${encodeURIComponent(order.orderId)}/status-flags`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: checked }),
      });
      const payload = (await response.json()) as {
        message?: string;
        record?: Pick<AdminOrderDetail, 'listingsUpdated' | 'settled' | 'moneyAccounted'>;
        listingsUpdated?: boolean;
        settled?: boolean;
        moneyAccounted?: boolean;
      };
      const updatedFlags = payload.record || (
        typeof payload.listingsUpdated === 'boolean' &&
        typeof payload.settled === 'boolean' &&
        typeof payload.moneyAccounted === 'boolean'
          ? {
              listingsUpdated: payload.listingsUpdated,
              settled: payload.settled,
              moneyAccounted: payload.moneyAccounted,
            }
          : null
      );
      if (!response.ok || !updatedFlags) throw new Error(payload.message || 'Unable to update order status.');

      setOrder((currentOrder) => (currentOrder ? { ...currentOrder, ...updatedFlags } : currentOrder));
      enqueueSnackbar('Order status updated.', { variant: 'success', autoHideDuration: 2500 });
    } catch (error) {
      setOrder(previousOrder);
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to update order status.', {
        variant: 'error',
        autoHideDuration: 3500,
      });
    } finally {
      setUpdatingFlag(null);
    }
  };

  const openAccountFundsDialog = () => {
    setAccountFundsForm({
      adjustedCostBasis: order?.costBasisAdjusted || '0.00',
      usedLocalFunds: order?.accountingFunds?.usedLocalFunds != null ? String(order.accountingFunds.usedLocalFunds.toFixed(2)) : '0.00',
      mfrWholesaleFunds: order?.accountingFunds?.mfrWholesaleFunds != null ? String(order.accountingFunds.mfrWholesaleFunds.toFixed(2)) : '0.00',
    });
    setAccountFundsError('');
    setAccountFundsOpen(true);
  };

  const closeAccountFundsDialog = () => {
    if (isAccountingFunds) return;
    setAccountFundsOpen(false);
  };

  const handleAccountFundsSave = async () => {
    if (!order || isAccountingFunds) return;

    const usedLocalFunds = parseAccountingAmount(accountFundsForm.usedLocalFunds);
    const mfrWholesaleFunds = parseAccountingAmount(accountFundsForm.mfrWholesaleFunds);
    const adjustedCostBasis = parseAccountingAmount(accountFundsForm.adjustedCostBasis);
    if (adjustedCostBasis == null || usedLocalFunds == null || mfrWholesaleFunds == null) {
      setAccountFundsError('Enter $0 or greater in each currency box.');
      return;
    }

    setIsAccountingFunds(true);
    setAccountFundsError('');
    try {
      const response = await fetch(`/api/admin-v2/orders/${encodeURIComponent(order.orderId)}/account-funds`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adjustedCostBasis, usedLocalFunds, mfrWholesaleFunds }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to account funds.');

      setAccountFundsOpen(false);
      enqueueSnackbar('Funds accounted.', { variant: 'success', autoHideDuration: 2500 });
      await loadOrder({ silent: true });
    } catch (error) {
      setAccountFundsError(error instanceof Error ? error.message : 'Unable to account funds.');
    } finally {
      setIsAccountingFunds(false);
    }
  };

  const itemCount = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    [order?.items],
  );
  const canRefund = order?.status === 'paid';

  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: 'text.secondary' }}>Loading order...</Typography>
      </Box>
    );
  }

  if (!order) {
    return (
      <Box sx={{ p: { xs: 4, md: 6 } }}>
        <Typography variant="h5">Order not found</Typography>
      </Box>
    );
  }

  const displayOrderNumber = formatOrderNumber(order.orderNumber);
  const adjustedCostBasisAmount = parseAccountingAmount(order.costBasisAdjusted || '0.00') || 0;
  const isRefundedOrder = order.status === 'refunded';

  return (
    <>
    <Grid container>
      <Grid size={{ xs: 12, md: 8, xl: 9 }}>
        <Stack direction="column">
          <Box sx={{ p: { xs: 3, md: 5 } }}>
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
                  Order <Box component="span">{displayOrderNumber}</Box>
                </Typography>
                <Stack
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: { xs: 0.5, sm: 2 },
                    mb: 2,
                  }}
                >
                  {orderStatusFlags.map((flag) => (
                    <FormControlLabel
                      key={flag.key}
                      control={
                        <Checkbox
                          checked={order[flag.key]}
                          disabled={updatingFlag !== null}
                          size="small"
                          onChange={(event) => void handleStatusFlagChange(flag.key, event.target.checked)}
                        />
                      }
                      label={flag.label}
                      sx={{
                        m: 0,
                        '& .MuiFormControlLabel-label': {
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        },
                      }}
                    />
                  ))}
                  {!isRefundedOrder && order.moneyAccounted ? (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked
                          size="small"
                          onChange={openAccountFundsDialog}
                          icon={<IconifyIcon icon="material-symbols:check-circle-rounded" sx={{ fontSize: 24, color: 'success.main' }} />}
                          checkedIcon={<IconifyIcon icon="material-symbols:check-circle-rounded" sx={{ fontSize: 24, color: 'success.main' }} />}
                        />
                      }
                      label="Money Accounted"
                      sx={{
                        m: 0,
                        '& .MuiFormControlLabel-label': {
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        },
                      }}
                    />
                  ) : !isRefundedOrder ? (
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      onClick={openAccountFundsDialog}
                      startIcon={<IconifyIcon icon="material-symbols:attach-money-rounded" />}
                      sx={{ minHeight: 34 }}
                    >
                      Account
                    </Button>
                  ) : null}
                </Stack>
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
              <Stack direction="column" sx={{ alignItems: { sm: 'flex-end' }, gap: 3 }}>
                <Stack sx={{ gap: 1 }}>
                  <Button
                    variant="soft"
                    color="error"
                    disabled={!canRefund || isRefunding}
                    onClick={() => setConfirmOpen(true)}
                    startIcon={<IconifyIcon icon="material-symbols:currency-exchange-rounded" />}
                  >
                    Cancel/Refund
                  </Button>
                </Stack>
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
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 5 } }}>
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
                    <Link
                      href={paths.inventoryItemWithId(String(item.inventoryItemId))}
                      underline="none"
                      sx={{ flexShrink: 0 }}
                    >
                      <Avatar
                        variant="rounded"
                        src={item.imageUrl || undefined}
                        alt={item.title}
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: 'background.elevation2',
                          borderRadius: 2,
                        }}
                      >
                        <IconifyIcon icon="material-symbols:inventory-2-outline-rounded" sx={{ fontSize: 24 }} />
                      </Avatar>
                    </Link>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        component={Link}
                        href={paths.inventoryItemWithId(String(item.inventoryItemId))}
                        underline="hover"
                        variant="subtitle1"
                        sx={{ fontWeight: 700, lineClamp: 1, color: 'text.primary' }}
                      >
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
          </Box>

          <Box sx={{ p: { xs: 3, md: 5 } }}>
            <Container maxWidth={false} sx={{ maxWidth: 694, px: { xs: 0 } }}>
              <Stack sx={{ alignItems: 'center', gap: 2, mb: 4 }}>
                <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'success.lighter', borderRadius: 2 }}>
                  <IconifyIcon icon="material-symbols:check-rounded" color="success.main" fontSize={20} />
                </Avatar>
                <Typography variant="h6">{order.status}</Typography>
              </Stack>
              <Stack direction="column" divider={<Divider flexItem />} sx={{ gap: 2, bgcolor: 'background.elevation1', borderRadius: 6, p: 3 }}>
                <PriceSummaryRow label="Subtotal" value={order.subtotalCents / 100} />
                <PriceSummaryRow
                  label="Shipping cost"
                  value={order.shippingLabel || currencyFormat((order.shippingCents || 0) / 100)}
                />
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
          </Box>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 4, xl: 3 }}>
        <Box sx={{ height: 1 }}>
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
        </Box>
      </Grid>
    </Grid>
    <Dialog open={confirmOpen} onClose={() => !isRefunding && setConfirmOpen(false)}>
      <DialogTitle>Cancel/refund order</DialogTitle>
      <DialogContent>
        <Stack direction="column" sx={{ gap: 1 }}>
          <Typography>Are you sure you want to cancel/refund this order?</Typography>
          {order.checkoutProvider !== 'cash' && (
            <Alert severity="warning">
              Stripe processing fees will be retained. The customer refund will be the Stripe payment amount minus the card or financing fee.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmOpen(false)} disabled={isRefunding}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={() => void handleConfirmRefund()} disabled={isRefunding}>
          Yes, refund
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={accountFundsOpen} onClose={closeAccountFundsDialog} fullWidth maxWidth="sm">
      <DialogTitle>Add funds to buckets</DialogTitle>
      <DialogContent>
        <Stack direction="column" sx={{ gap: 2, pt: 1 }}>
          {accountFundsError && <Alert severity="error">{accountFundsError}</Alert>}
          <Stack sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              Order Total
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {currencyFormat(order.totalCents / 100)}
            </Typography>
          </Stack>
          <Stack sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              Cost Basis
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {currencyFormat(adjustedCostBasisAmount)}
            </Typography>
          </Stack>
          <TextField
            fullWidth
            required
            type="number"
            label="Adjusted Cost Basis:"
            value={accountFundsForm.adjustedCostBasis}
            disabled={isAccountingFunds}
            onChange={(event) => setAccountFundsForm((current) => ({ ...current, adjustedCostBasis: event.target.value }))}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="Used/Local Funds:"
            value={accountFundsForm.usedLocalFunds}
            disabled={isAccountingFunds}
            onChange={(event) => setAccountFundsForm((current) => ({ ...current, usedLocalFunds: event.target.value }))}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="Mfr/Wholesale Funds:"
            value={accountFundsForm.mfrWholesaleFunds}
            disabled={isAccountingFunds}
            onChange={(event) => setAccountFundsForm((current) => ({ ...current, mfrWholesaleFunds: event.target.value }))}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeAccountFundsDialog} disabled={isAccountingFunds}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleAccountFundsSave()} disabled={isAccountingFunds}>
          {isAccountingFunds ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={resultOpen} onClose={() => setResultOpen(false)}>
      <DialogTitle>{result?.severity === 'success' ? 'Refund complete' : 'Refund failed'}</DialogTitle>
      <DialogContent>
        {result && <Alert severity={result.severity}>{result.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => setResultOpen(false)}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

const PriceSummaryRow = ({ label, value }: { label: string; value: number | string }) => {
  const { currencyFormat } = useNumberFormat();

  return (
    <Stack sx={{ justifyContent: 'space-between', alignItems: 'center', color: 'text.secondary' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
        {label}
      </Typography>
      <Typography variant="subtitle2">{typeof value === 'number' ? currencyFormat(value) : value}</Typography>
    </Stack>
  );
};

export default OrderManagerItem;
