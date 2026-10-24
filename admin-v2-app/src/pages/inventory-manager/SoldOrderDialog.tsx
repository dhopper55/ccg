import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import { ORDER_CHANNEL_OPTIONS, PAYMENT_METHOD_OPTIONS, orderChannelLabel } from 'lib/orderLabels';

// Shown after an item is marked sold (or from the "Create / attach order" button):
// put the sale on a new order, or add it to an existing one, along with how it was paid.

type PickerOrder = {
  id: string;
  orderNumber: string;
  channel: string;
  customerName: string;
  itemTitle: string;
  itemCount: number;
  date: string;
};

export type SoldOrderDialogItem = {
  id: string;
  ccgNumber: string;
  title: string;
  soldAmount: string;
  soldChannel: string;
};

type Props = {
  open: boolean;
  item: SoldOrderDialogItem | null;
  onClose: () => void;
  onDone: (order: { orderId: string; orderNumber: string }) => void;
};

const SOLD_CHANNEL_TO_ORDER_CHANNEL: Record<string, string> = {
  FBM: 'fbm',
  CL: 'cl',
  'CCG External Web': 'ccg_web',
  'CCG In-Store': 'in_store',
  Reverb: 'reverb',
  OfferUp: 'offerup',
  EBay: 'ebay',
  Nextdoor: 'nextdoor',
  'Sweetwater Gear Exchange': 'gear_exchange',
  Other: 'other',
};

const DEFAULT_METHOD_BY_CHANNEL: Record<string, string> = {
  fbm: 'fbm',
  reverb: 'reverb',
  ebay: 'ebay',
  in_store: 'cash',
  ccg_web: 'stripe_checkout',
};

// Typical fees, in cents, on what the buyer paid. Pre-filled as an estimate; editable.
function estimateFeeCents(method: string, grossCents: number): number {
  if (grossCents <= 0) return 0;
  switch (method) {
    case 'reverb':
      return Math.round(grossCents * (0.05 + 0.0319)) + 49;
    case 'fbm':
      return Math.max(80, Math.round(grossCents * 0.1));
    case 'ebay':
      return Math.round(grossCents * 0.1325) + 30;
    case 'stripe_link':
    case 'stripe_checkout':
      return Math.round(grossCents * 0.029) + 30;
    case 'stripe_terminal':
      return Math.round(grossCents * 0.027) + 5;
    case 'paypal':
      return Math.round(grossCents * 0.0349) + 49;
    case 'venmo':
      return Math.round(grossCents * 0.019) + 10;
    default:
      return 0;
  }
}

function toCents(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPickerDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

type PaymentDraft = {
  method: string;
  amount: string;
  shipping: string;
  tax: string;
  fee: string;
  feeTouched: boolean;
  externalRef: string;
};

function buildPaymentDraft(item: SoldOrderDialogItem | null, method: string): PaymentDraft {
  return {
    method,
    amount: item?.soldAmount || '',
    shipping: '',
    tax: '',
    fee: '',
    feeTouched: false,
    externalRef: '',
  };
}

export default function SoldOrderDialog({ open, item, onClose, onDone }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const initialChannel = SOLD_CHANNEL_TO_ORDER_CHANNEL[item?.soldChannel || ''] || 'other';

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [channel, setChannel] = useState(initialChannel);
  const [channelOrderRef, setChannelOrderRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'ship'>('pickup');
  const [shipping, setShipping] = useState({ line1: '', line2: '', city: '', state: '', postalCode: '' });
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentDraft>(() => buildPaymentDraft(item, DEFAULT_METHOD_BY_CHANNEL[initialChannel] || 'cash'));
  const [paymentChoice, setPaymentChoice] = useState<'new' | 'covered'>('new');

  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOptions, setPickerOptions] = useState<PickerOrder[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PickerOrder | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset whenever the dialog opens for an item.
  useEffect(() => {
    if (!open) return;
    const nextChannel = SOLD_CHANNEL_TO_ORDER_CHANNEL[item?.soldChannel || ''] || 'other';
    setMode('new');
    setChannel(nextChannel);
    setChannelOrderRef('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setFulfillmentType('pickup');
    setShipping({ line1: '', line2: '', city: '', state: '', postalCode: '' });
    setNotes('');
    setPayment(buildPaymentDraft(item, DEFAULT_METHOD_BY_CHANNEL[nextChannel] || 'cash'));
    setPaymentChoice('new');
    setPickerQuery('');
    setSelectedOrder(null);
    setError('');
  }, [open, item]);

  // Order picker: last 30 days, or a search across all paid orders.
  useEffect(() => {
    if (!open || mode !== 'existing') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPickerLoading(true);
      try {
        const params = new URLSearchParams();
        if (pickerQuery.trim()) params.set('q', pickerQuery.trim());
        const response = await fetch(`/api/admin-v2/orders/picker?${params.toString()}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as { records?: PickerOrder[] };
        setPickerOptions(Array.isArray(data.records) ? data.records : []);
      } catch {
        // aborted or offline; keep the previous options
      } finally {
        setPickerLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, mode, pickerQuery]);

  const amountCents = toCents(payment.amount);
  const shippingCents = toCents(payment.shipping);
  const taxCents = toCents(payment.tax);
  const grossCents = amountCents + shippingCents + taxCents;
  const estimatedFeeCents = estimateFeeCents(payment.method, grossCents);
  const feeCents = payment.feeTouched ? toCents(payment.fee) : estimatedFeeCents;
  const netCents = grossCents - taxCents - feeCents;
  const needsPayment = mode === 'new' || paymentChoice === 'new';

  const updatePayment = (patch: Partial<PaymentDraft>) => setPayment((current) => ({ ...current, ...patch }));

  const handleChannelChange = (next: string) => {
    setChannel(next);
    updatePayment({ method: DEFAULT_METHOD_BY_CHANNEL[next] || payment.method, feeTouched: false });
  };

  const paymentPayload = useMemo(() => ({
    method: payment.method,
    grossCents,
    shippingChargedCents: shippingCents,
    taxCents,
    feeCents,
    feeIsEstimate: !payment.feeTouched,
    externalRef: payment.externalRef.trim(),
  }), [payment, grossCents, shippingCents, taxCents, feeCents]);

  const handleSave = async () => {
    if (!item || isSaving) return;
    setError('');
    if (needsPayment && grossCents <= 0) {
      setError('Enter what the buyer paid.');
      return;
    }
    if (needsPayment && netCents < 0) {
      setError('Fees and tax are more than the payment.');
      return;
    }
    if (mode === 'existing' && !selectedOrder) {
      setError('Pick the order to add this item to.');
      return;
    }
    if (mode === 'new' && fulfillmentType === 'ship'
      && (!customerName.trim() || !shipping.line1.trim() || !shipping.city.trim() || !shipping.state.trim() || !shipping.postalCode.trim())) {
      setError('Shipping orders need a name, street, city, state and ZIP.');
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = mode === 'new'
        ? '/api/admin-v2/orders/manual'
        : `/api/admin-v2/orders/${encodeURIComponent(selectedOrder!.id)}/items`;
      const body = mode === 'new'
        ? {
          inventoryItemId: item.id,
          channel,
          channelOrderRef: channelOrderRef.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          fulfillmentType,
          shipping: fulfillmentType === 'ship' ? { ...shipping, name: customerName.trim(), country: 'US' } : undefined,
          notes: notes.trim(),
          payment: paymentPayload,
        }
        : {
          inventoryItemId: item.id,
          payment: paymentChoice === 'new' ? paymentPayload : undefined,
        };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; orderId?: string; orderNumber?: string; message?: string };
      if (!response.ok || !data.ok || !data.orderId) {
        throw new Error(data.message || 'Unable to save the order.');
      }
      enqueueSnackbar(
        mode === 'new' ? `Created order ${data.orderNumber || ''}` : `Added to order ${data.orderNumber || ''}`,
        { variant: 'success' },
      );
      onDone({ orderId: data.orderId, orderNumber: data.orderNumber || '' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the order.');
    } finally {
      setIsSaving(false);
    }
  };

  const paymentSection = (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Paid via"
            value={payment.method}
            onChange={(event) => updatePayment({ method: event.target.value, feeTouched: false })}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="Payment reference (optional)"
            placeholder="Stripe receipt, Reverb order #…"
            value={payment.externalRef}
            onChange={(event) => updatePayment({ externalRef: event.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Item price"
            value={payment.amount}
            onChange={(event) => updatePayment({ amount: event.target.value })}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Shipping charged"
            value={payment.shipping}
            onChange={(event) => updatePayment({ shipping: event.target.value })}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Tax we collected"
            value={payment.tax}
            onChange={(event) => updatePayment({ tax: event.target.value })}
            inputProps={{ min: 0, step: 0.01 }}
            helperText={['fbm', 'reverb', 'ebay'].includes(payment.method) ? 'Marketplace remits tax' : ' '}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Fees"
            value={payment.feeTouched ? payment.fee : (estimatedFeeCents / 100).toFixed(2)}
            onChange={(event) => updatePayment({ fee: event.target.value, feeTouched: true })}
            inputProps={{ min: 0, step: 0.01 }}
            helperText={payment.feeTouched ? 'Entered' : 'Estimated'}
          />
        </Grid>
      </Grid>
      <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap', color: 'text.secondary' }}>
        <Typography variant="body2">Buyer paid: <strong>{formatCents(grossCents)}</strong></Typography>
        <Typography variant="body2">Net to us: <strong>{formatCents(netCents)}</strong></Typography>
      </Stack>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={() => !isSaving && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Create an order for this sale?</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {item ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {item.ccgNumber ? `${item.ccgNumber} · ` : ''}{item.title}
            </Typography>
          ) : null}

          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_event, next) => next && setMode(next)}
          >
            <ToggleButton value="new">New order</ToggleButton>
            <ToggleButton value="existing">Add to existing order</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'new' ? (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Channel"
                    value={channel}
                    onChange={(event) => handleChannelChange(event.target.value)}
                  >
                    {ORDER_CHANNEL_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Marketplace order # (optional)"
                    value={channelOrderRef}
                    onChange={(event) => setChannelOrderRef(event.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Email" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
                </Grid>
              </Grid>

              <ToggleButtonGroup
                exclusive
                size="small"
                value={fulfillmentType}
                onChange={(_event, next) => next && setFulfillmentType(next)}
              >
                <ToggleButton value="pickup">Pickup / in person</ToggleButton>
                <ToggleButton value="ship">Ship</ToggleButton>
              </ToggleButtonGroup>

              {fulfillmentType === 'ship' ? (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField fullWidth size="small" label="Street" value={shipping.line1} onChange={(event) => setShipping((s) => ({ ...s, line1: event.target.value }))} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth size="small" label="Apt / suite" value={shipping.line2} onChange={(event) => setShipping((s) => ({ ...s, line2: event.target.value }))} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 5 }}>
                    <TextField fullWidth size="small" label="City" value={shipping.city} onChange={(event) => setShipping((s) => ({ ...s, city: event.target.value }))} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField fullWidth size="small" label="State" value={shipping.state} onChange={(event) => setShipping((s) => ({ ...s, state: event.target.value }))} inputProps={{ maxLength: 2 }} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <TextField fullWidth size="small" label="ZIP" value={shipping.postalCode} onChange={(event) => setShipping((s) => ({ ...s, postalCode: event.target.value }))} />
                  </Grid>
                </Grid>
              ) : null}

              <Divider />
              <Typography variant="subtitle2">Payment</Typography>
              {paymentSection}

              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="Notes (optional)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </>
          ) : (
            <>
              <Autocomplete
                options={pickerOptions}
                value={selectedOrder}
                loading={pickerLoading}
                filterOptions={(options) => options}
                onChange={(_event, next) => setSelectedOrder(next)}
                onInputChange={(_event, next, reason) => {
                  if (reason === 'input' || reason === 'clear') setPickerQuery(next);
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(option) => `${option.orderNumber} · ${option.customerName || 'Customer'}`}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.id}>
                    <Stack>
                      <Typography variant="body2">
                        {formatPickerDate(option.date)} · {option.customerName || 'Customer'} · {orderChannelLabel(option.channel)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {option.orderNumber} · {option.itemTitle}{option.itemCount > 1 ? ` (${option.itemCount} items)` : ''}
                      </Typography>
                    </Stack>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Order"
                    placeholder="Last 30 days — type to search older orders"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {pickerLoading ? <CircularProgress size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <RadioGroup value={paymentChoice} onChange={(event) => setPaymentChoice(event.target.value as 'new' | 'covered')}>
                <FormControlLabel value="new" control={<Radio size="small" />} label="Paid separately — record a new payment" />
                <FormControlLabel value="covered" control={<Radio size="small" />} label="Already covered by a payment on this order" />
              </RadioGroup>

              {paymentChoice === 'new' ? paymentSection : null}
            </>
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Skip</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || !item}>
          {isSaving ? 'Saving…' : mode === 'new' ? 'Create order' : 'Add to order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
