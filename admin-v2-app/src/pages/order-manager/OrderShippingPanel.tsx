import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  MenuItem,
  Radio,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import CarrierLogo from 'components/common/CarrierLogo';

// Order page "Shipping" section: shipped / unshipped status with tracking, an EasyPost rate
// quote dialog (package templates, signature, ship date), and manual tracking entry for
// labels bought elsewhere. Buying labels through EasyPost comes in the next phase.

export type OrderShippingShipment = {
  id: number;
  status: string;
  carrier: string;
  service: string;
  trackingCode: string;
  trackingUrl: string | null;
  labelCostCents: number | null;
  shippedAt: string;
};

export type OrderShippingSummary = {
  needsShipping: boolean;
  shipped: boolean;
  shipment: OrderShippingShipment | null;
  labelCostCents: number;
};

export type OrderShipTo = {
  name: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type PackageTemplate = { id: number; name: string; lengthIn: number; widthIn: number; heightIn: number; weightOz: number };

type QuoteRate = {
  id: string;
  carrier: string;
  service: string;
  rateCents: number;
  deliveryDays: number | null;
  deliveryDate: string;
};

type QuoteResponse = {
  ok?: boolean;
  shipmentId?: number | null;
  message?: string;
  mode?: 'test' | 'prod';
  address?: { verified: boolean; residential: boolean | null; message: string };
  rates?: QuoteRate[];
  carrierMessages?: string[];
};

const formatCents = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// "GroundAdvantage" -> "Ground Advantage", "FEDEX_GROUND" -> "Fedex Ground"
function prettyService(service: string): string {
  if (service.includes('_')) {
    return service.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return service.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function todayLocal(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T & { message?: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

export default function OrderShippingPanel({
  orderId,
  shipping,
  shipTo,
  onChanged,
}: {
  orderId: string;
  shipping: OrderShippingSummary;
  shipTo: OrderShipTo;
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const shipment = shipping.shipment;

  const copyTracking = () => {
    if (!shipment?.trackingCode) return;
    void navigator.clipboard.writeText(shipment.trackingCode).then(() => {
      enqueueSnackbar('Tracking number copied.', { variant: 'success' });
    });
  };

  return (
    <Box sx={{ p: { xs: 3, md: 4, lg: 5 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Shipping
        </Typography>
        <Chip
          size="small"
          variant="soft"
          color={shipping.shipped ? 'success' : 'warning'}
          label={shipping.shipped ? 'Shipped' : 'UnShipped'}
        />
      </Stack>

      {shipping.shipped && shipment ? (
        <Stack direction="column" sx={{ gap: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <CarrierLogo carrier={shipment.carrier} size={26} />
            {shipment.trackingUrl ? (
              <Link href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                {shipment.trackingCode}
              </Link>
            ) : (
              <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                {shipment.trackingCode}
              </Typography>
            )}
            <Tooltip title="Copy tracking number">
              <IconButton size="small" onClick={copyTracking} aria-label="Copy tracking number">
                <IconifyIcon icon="material-symbols:content-copy-outline-rounded" fontSize={18} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {[shipment.carrier, shipment.service ? prettyService(shipment.service) : '', shipment.status === 'manual' ? 'label bought elsewhere' : '']
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          {shipment.labelCostCents != null ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Label cost {formatCents(shipment.labelCostCents)}
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<IconifyIcon icon="material-symbols:local-shipping-outline-rounded" />}
            onClick={() => setQuoteOpen(true)}
          >
            Get Quote
          </Button>
          <Button variant="outlined" size="small" onClick={() => setManualOpen(true)}>
            Enter tracking
          </Button>
        </Stack>
      )}

      <QuoteDialog
        open={quoteOpen}
        orderId={orderId}
        shipTo={shipTo}
        onClose={() => setQuoteOpen(false)}
        onBought={() => {
          setQuoteOpen(false);
          onChanged();
        }}
      />
      <ManualTrackingDialog
        open={manualOpen}
        orderId={orderId}
        onClose={() => setManualOpen(false)}
        onSaved={() => {
          setManualOpen(false);
          onChanged();
        }}
      />
    </Box>
  );
}

// ---- Get Quote -------------------------------------------------------------------------

function QuoteDialog({
  open,
  orderId,
  shipTo,
  onClose,
  onBought,
}: {
  open: boolean;
  orderId: string;
  shipTo: OrderShipTo;
  onClose: () => void;
  onBought: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [lengthIn, setLengthIn] = useState('');
  const [widthIn, setWidthIn] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [weightOz, setWeightOz] = useState('');
  const [signature, setSignature] = useState(false);
  const [shipDate, setShipDate] = useState(todayLocal());
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateName, setShowTemplateName] = useState(false);

  const [isQuoting, setIsQuoting] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTemplateId('');
    setLengthIn('');
    setWidthIn('');
    setHeightIn('');
    setWeightLb('');
    setWeightOz('');
    setSignature(false);
    setShipDate(todayLocal());
    setTemplateName('');
    setShowTemplateName(false);
    setQuote(null);
    setSelectedRateId('');
    setError('');
    setConfirmOpen(false);
    setBuyError('');
    fetch('/api/admin-v2/shipping/templates', { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((data: { records?: PackageTemplate[] }) => setTemplates(Array.isArray(data.records) ? data.records : []))
      .catch(() => setTemplates([]));
  }, [open]);

  const totalOz = (Number.parseFloat(weightLb) || 0) * 16 + (Number.parseFloat(weightOz) || 0);
  const dims = [lengthIn, widthIn, heightIn].map((value) => Number.parseFloat(value));
  const packageReady = dims.every((value) => Number.isFinite(value) && value > 0) && totalOz > 0;

  // Any change to the package means old rates no longer apply.
  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setQuote(null);
    setSelectedRateId('');
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    setQuote(null);
    setSelectedRateId('');
    const template = templates.find((item) => String(item.id) === id);
    if (!template) return;
    setLengthIn(String(template.lengthIn));
    setWidthIn(String(template.widthIn));
    setHeightIn(String(template.heightIn));
    setWeightLb(String(Math.floor(template.weightOz / 16)));
    setWeightOz(String(Math.round((template.weightOz % 16) * 10) / 10));
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !packageReady || savingTemplate) return;
    setSavingTemplate(true);
    setError('');
    try {
      const data = await postJson<{ record?: PackageTemplate }>('/api/admin-v2/shipping/templates', {
        name: templateName.trim(),
        lengthIn: dims[0],
        widthIn: dims[1],
        heightIn: dims[2],
        weightOz: totalOz,
      });
      if (data.record) {
        const record = data.record;
        setTemplates((current) => [...current, record].sort((a, b) => a.name.localeCompare(b.name)));
        setTemplateId(String(record.id));
      }
      setShowTemplateName(false);
      setTemplateName('');
      enqueueSnackbar('Template saved.', { variant: 'success' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const getRates = async () => {
    if (!packageReady || isQuoting) return;
    setIsQuoting(true);
    setError('');
    setQuote(null);
    setSelectedRateId('');
    try {
      const data = await postJson<QuoteResponse>(`/api/admin-v2/orders/${encodeURIComponent(orderId)}/shipping/quote`, {
        lengthIn: dims[0],
        widthIn: dims[1],
        heightIn: dims[2],
        weightOz: totalOz,
        signatureConfirmation: signature,
        shipDate,
        templateId: templateId ? Number(templateId) : null,
      });
      setQuote(data);
      if (data.rates?.[0]) setSelectedRateId(data.rates[0].id);
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : 'Unable to get rates.');
    } finally {
      setIsQuoting(false);
    }
  };

  const selectedRate = quote?.rates?.find((rate) => rate.id === selectedRateId) ?? null;

  const buyLabel = async () => {
    if (!selectedRate || !quote?.shipmentId || isBuying) return;
    setIsBuying(true);
    setBuyError('');
    try {
      const data = await postJson<{ trackingCode?: string; isTest?: boolean }>(
        `/api/admin-v2/orders/${encodeURIComponent(orderId)}/shipping/buy`,
        { shipmentId: quote.shipmentId, rateId: selectedRate.id },
      );
      enqueueSnackbar(`${data.isTest ? 'Test label' : 'Label'} bought. Tracking ${data.trackingCode || ''}`, { variant: 'success' });
      setConfirmOpen(false);
      onBought();
    } catch (buyFailure) {
      setBuyError(buyFailure instanceof Error ? buyFailure.message : 'Buying the label failed.');
    } finally {
      setIsBuying(false);
    }
  };

  const numberField = (label: string, value: string, setter: (value: string) => void, adornment: string) => (
    <TextField
      fullWidth
      size="small"
      type="number"
      label={label}
      value={value}
      onChange={(event) => changed(setter)(event.target.value)}
      inputProps={{ min: 0, step: 0.1 }}
      InputProps={{ endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>{adornment}</Typography> }}
    />
  );

  return (
    <Dialog open={open} onClose={() => !isQuoting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Get shipping quote</DialogTitle>
      <DialogContent dividers>
        <Stack direction="column" spacing={2.5}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Ship to
            </Typography>
            <Typography variant="body2">{shipTo.name}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {[shipTo.line1, shipTo.line2].filter(Boolean).join(', ')}
              {shipTo.city ? ` · ${shipTo.city}, ${shipTo.state} ${shipTo.postalCode}` : ''}
            </Typography>
          </Box>

          <TextField
            select
            fullWidth
            size="small"
            label="Package template"
            value={templateId}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            <MenuItem value=""><em>No template</em></MenuItem>
            {templates.map((template) => (
              <MenuItem key={template.id} value={String(template.id)}>
                {template.name}
              </MenuItem>
            ))}
          </TextField>

          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>{numberField('Length', lengthIn, setLengthIn, 'in')}</Grid>
            <Grid size={{ xs: 4 }}>{numberField('Width', widthIn, setWidthIn, 'in')}</Grid>
            <Grid size={{ xs: 4 }}>{numberField('Height', heightIn, setHeightIn, 'in')}</Grid>
            <Grid size={{ xs: 6 }}>{numberField('Pounds', weightLb, setWeightLb, 'lb')}</Grid>
            <Grid size={{ xs: 6 }}>{numberField('Ounces', weightOz, setWeightOz, 'oz')}</Grid>
          </Grid>

          {showTemplateName ? (
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                fullWidth
                autoFocus
                label="Template name"
                placeholder="Guitar box 45×18×6"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveTemplate();
                }}
              />
              <Button size="small" variant="contained" onClick={() => void saveTemplate()} disabled={!templateName.trim() || savingTemplate}>
                Save
              </Button>
              <Button size="small" onClick={() => setShowTemplateName(false)} disabled={savingTemplate}>
                Cancel
              </Button>
            </Stack>
          ) : (
            <Button
              size="small"
              sx={{ alignSelf: 'flex-start' }}
              disabled={!packageReady}
              onClick={() => setShowTemplateName(true)}
              startIcon={<IconifyIcon icon="material-symbols:bookmark-add-outline-rounded" />}
            >
              Save as template
            </Button>
          )}

          <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Checkbox checked={signature} onChange={(event) => changed(setSignature)(event.target.checked)} />}
              label="Signature confirmation"
            />
            <TextField
              size="small"
              type="date"
              label="Ship date"
              value={shipDate}
              onChange={(event) => changed(setShipDate)(event.target.value)}
              inputProps={{ min: todayLocal() }}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {quote ? (
            <>
              <Divider />
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">Rates</Typography>
                {quote.mode === 'test' ? <Chip size="small" variant="soft" color="warning" label="EasyPost test mode" /> : null}
                {quote.address?.residential != null ? (
                  <Chip size="small" variant="soft" color="neutral" label={quote.address.residential ? 'Residential' : 'Commercial'} />
                ) : null}
              </Stack>
              {quote.address && !quote.address.verified ? (
                <Alert severity="warning">Address not confirmed: {quote.address.message}</Alert>
              ) : null}
              {(quote.rates ?? []).length === 0 ? (
                <Alert severity="info">No rates came back for this package.</Alert>
              ) : (
                <Stack direction="column" sx={{ gap: 1 }}>
                  {(quote.rates ?? []).map((rate) => (
                    <Box
                      key={rate.id}
                      onClick={() => setSelectedRateId(rate.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: 1,
                        borderColor: selectedRateId === rate.id ? 'primary.main' : 'divider',
                        bgcolor: selectedRateId === rate.id ? 'background.elevation2' : 'transparent',
                      }}
                    >
                      <Radio size="small" checked={selectedRateId === rate.id} sx={{ p: 0 }} />
                      <CarrierLogo carrier={rate.carrier} size={28} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {prettyService(rate.service)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {rate.carrier}
                          {rate.deliveryDays != null ? ` · ${rate.deliveryDays} day${rate.deliveryDays === 1 ? '' : 's'}` : ''}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {formatCents(rate.rateCents)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
              {(quote.carrierMessages ?? []).length > 0 ? (
                <Alert severity="info">
                  Some carriers didn't quote: {(quote.carrierMessages ?? []).join(' · ')}
                </Alert>
              ) : null}
            </>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isQuoting}>Close</Button>
        {quote && (quote.rates ?? []).length > 0 ? (
          <Button
            variant="contained"
            disabled={!selectedRate}
            onClick={() => {
              setBuyError('');
              setConfirmOpen(true);
            }}
          >
            Buy label
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => void getRates()}
            disabled={!packageReady || isQuoting}
            startIcon={isQuoting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isQuoting ? 'Getting rates…' : 'Get rates'}
          </Button>
        )}
      </DialogActions>

      <Dialog open={confirmOpen} onClose={() => !isBuying && setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Buy this label?</DialogTitle>
        <DialogContent dividers>
          {selectedRate ? (
            <Stack direction="column" spacing={2}>
              {quote?.mode === 'test' ? (
                <Alert severity="info">EasyPost test mode: no charge, and the tracking number is not real.</Alert>
              ) : (
                <Alert severity="warning">Production: your EasyPost account will be charged {formatCents(selectedRate.rateCents)}.</Alert>
              )}
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <CarrierLogo carrier={selectedRate.carrier} size={36} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {selectedRate.carrier} {prettyService(selectedRate.service)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {selectedRate.deliveryDays != null ? `${selectedRate.deliveryDays} day${selectedRate.deliveryDays === 1 ? '' : 's'} · ` : ''}
                    Ship date {shipDate}
                  </Typography>
                </Box>
                <Typography variant="h6">{formatCents(selectedRate.rateCents)}</Typography>
              </Stack>
              <Divider />
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Package
                </Typography>
                <Typography variant="body2">
                  {lengthIn} × {widthIn} × {heightIn} in · {Math.floor(totalOz / 16)} lb {Math.round((totalOz % 16) * 10) / 10} oz
                  {signature ? ' · Signature required' : ''}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Ship to
                </Typography>
                <Typography variant="body2">{shipTo.name}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {[shipTo.line1, shipTo.line2].filter(Boolean).join(', ')}
                  {shipTo.city ? ` · ${shipTo.city}, ${shipTo.state} ${shipTo.postalCode}` : ''}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                The order will be marked shipped with the new tracking number.
              </Typography>
              {buyError ? <Alert severity="error">{buyError}</Alert> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isBuying}>Cancel</Button>
          <Button
            variant="contained"
            color={quote?.mode === 'test' ? 'primary' : 'warning'}
            onClick={() => void buyLabel()}
            disabled={isBuying || !selectedRate}
            startIcon={isBuying ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isBuying ? 'Buying…' : `Buy for ${selectedRate ? formatCents(selectedRate.rateCents) : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

// ---- Manual tracking -------------------------------------------------------------------

function ManualTrackingDialog({
  open,
  orderId,
  onClose,
  onSaved,
}: {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [carrier, setCarrier] = useState('USPS');
  const [otherCarrier, setOtherCarrier] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [labelCost, setLabelCost] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCarrier('USPS');
    setOtherCarrier('');
    setTrackingCode('');
    setLabelCost('');
    setError('');
  }, [open]);

  const save = async () => {
    if (isSaving) return;
    setError('');
    const carrierName = carrier === 'Other' ? otherCarrier.trim() : carrier;
    if (!carrierName) {
      setError('Enter the carrier name.');
      return;
    }
    if (!trackingCode.trim()) {
      setError('Enter the tracking number.');
      return;
    }
    const cost = Number.parseFloat(labelCost);
    setIsSaving(true);
    try {
      await postJson(`/api/admin-v2/orders/${encodeURIComponent(orderId)}/shipping/manual`, {
        carrier: carrierName,
        trackingCode: trackingCode.trim(),
        labelCostCents: Number.isFinite(cost) && cost >= 0 ? Math.round(cost * 100) : null,
      });
      enqueueSnackbar('Marked shipped.', { variant: 'success' });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save tracking.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !isSaving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Enter tracking</DialogTitle>
      <DialogContent dividers>
        <Stack direction="column" spacing={2}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            For a label bought outside CCG. Saving marks the order shipped.
          </Typography>
          <TextField select fullWidth size="small" label="Carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)}>
            <MenuItem value="USPS">USPS</MenuItem>
            <MenuItem value="UPS">UPS</MenuItem>
            <MenuItem value="FedEx">FedEx</MenuItem>
            <MenuItem value="Other">Other</MenuItem>
          </TextField>
          {carrier === 'Other' ? (
            <TextField fullWidth size="small" label="Carrier name" value={otherCarrier} onChange={(event) => setOtherCarrier(event.target.value)} />
          ) : null}
          <TextField
            fullWidth
            size="small"
            label="Tracking number"
            value={trackingCode}
            onChange={(event) => setTrackingCode(event.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Label cost (optional)"
            value={labelCost}
            onChange={(event) => setLabelCost(event.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            helperText="Comes off the order's net payout"
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Mark shipped'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
