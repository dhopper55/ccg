import { ChangeEvent, useEffect, useState } from 'react';
import { Alert, Button, Divider, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';
import paths from 'routes/paths';
import { ensureStarWebPrntGlobals } from 'lib/starWebPrntShim';

const printerUrlStorageKey = 'ccg-star-webprnt-url';
const receiptLogoUrl = 'https://www.coalcreekguitars.com/images/ccg_bnw.bmp';
const receiptLineWidth = 32;
const itemReceiptLineWidth = 42;
const shopPhoneNumber = '(303) 376-9214';
const defaultStarEndpoints = [
  'https://localhost:8001/StarWebPRNT/SendMessage',
  'http://localhost:8001/StarWebPRNT/SendMessage',
];
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatMoney = (v: number) => moneyFormat.format(v);

const padReceiptColumns = (left: string, right: string, width = receiptLineWidth) => {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanRight = right.trim();
  const maxLeft = Math.max(1, width - cleanRight.length - 1);
  const visible = cleanLeft.length > maxLeft ? cleanLeft.slice(0, maxLeft) : cleanLeft;
  return `${visible}${' '.repeat(Math.max(1, width - visible.length - cleanRight.length))}${cleanRight}`;
};

const replaceTemplateVariables = (template: string, values: Record<string, string>) =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => values[key] ?? match);

const parseTextDirectiveAttrs = (value: string) => {
  const attrs: Record<string, string> = {};
  value.replace(/([a-zA-Z0-9_-]+)="([^"]*)"/g, (_, k: string, v: string) => { attrs[k] = v; return ''; });
  return attrs;
};

const loadReceiptLogo = async () => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load receipt logo.'));
    img.src = receiptLogoUrl;
  });
  const targetWidth = Math.min(384, image.naturalWidth || 384);
  const scale = targetWidth / (image.naturalWidth || targetWidth);
  const targetHeight = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  return { context: ctx, width: targetWidth, height: targetHeight };
};

const buildCashDrawerKick = (builder: NonNullable<typeof window.StarWebPrintBuilder> extends new () => infer T ? T : never) =>
  builder.createPeripheralElement({ channel: 0, on: 200, off: 200 });

const sampleReceiptItems = [
  { quantity: 1, sku: 'CCG-638112', description: 'Test Product XYXDEF IS Here', linePrice: 37.99 },
  { quantity: 11, sku: 'CCG-443998', description: 'Test Product 2 ABCDEF is a really cool product', linePrice: 122.89 },
  { quantity: 7, sku: 'CCG-922333', description: 'Test Product Humidifer IS Here', linePrice: 11.00 },
];

type SystemSettingsForm = {
  brevoOrderConfirmationTemplateId: string;
  brevoSenderName: string;
  brevoSenderEmail: string;
  associateScreensaverIdleSeconds: string;
  customProductBarcode: string;
  currentUsedLocalFunds: string;
  currentMfrWholesaleFunds: string;
  postStoreLaunchDate: string;
  saleDescriptionPostfix: string;
};

type SystemSettingsResponse = Partial<SystemSettingsForm> & {
  ok?: boolean;
  message?: string;
};

type StripeConfigResponse = {
  useStripeSandbox?: boolean;
  stripePublishableKeySandbox?: string;
  stripePublishableKey?: string;
  message?: string;
};

type V2DecodeConfigResponse = {
  useV2DecodeLogic?: boolean;
  ok?: boolean;
  message?: string;
};

const defaultForm: SystemSettingsForm = {
  brevoOrderConfirmationTemplateId: '',
  brevoSenderName: '',
  brevoSenderEmail: '',
  associateScreensaverIdleSeconds: '',
  customProductBarcode: '',
  currentUsedLocalFunds: '0.00',
  currentMfrWholesaleFunds: '0.00',
  postStoreLaunchDate: '2026-06-01',
  saleDescriptionPostfix: '',
};

const SystemSettings = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<SystemSettingsForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [useStripeSandbox, setUseStripeSandbox] = useState(true);
  const [stripePublishableKeySandbox, setStripePublishableKeySandbox] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [isUpdatingStripeEnv, setIsUpdatingStripeEnv] = useState(false);
  const [useV2DecodeLogic, setUseV2DecodeLogic] = useState(false);
  const [isUpdatingV2Decode, setIsUpdatingV2Decode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isKickingDrawer, setIsKickingDrawer] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [settingsResponse, stripeResponse, v2DecodeResponse] = await Promise.all([
        fetch('/api/admin-v2/system-settings', { credentials: 'same-origin' }),
        fetch('/api/admin-v2/stripe-config', { credentials: 'same-origin' }),
        fetch('/api/admin-v2/v2-decode-config', { credentials: 'same-origin' }),
      ]);
      const payload = (await settingsResponse.json()) as SystemSettingsResponse;
      const stripePayload = (await stripeResponse.json()) as StripeConfigResponse;
      const v2DecodePayload = (await v2DecodeResponse.json()) as V2DecodeConfigResponse;
      if (!settingsResponse.ok) throw new Error(payload.message || 'Unable to load system settings.');
      if (!stripeResponse.ok) throw new Error(stripePayload.message || 'Unable to load Stripe config.');
      setForm({
        brevoOrderConfirmationTemplateId: payload.brevoOrderConfirmationTemplateId || '',
        brevoSenderName: payload.brevoSenderName || '',
        brevoSenderEmail: payload.brevoSenderEmail || '',
        associateScreensaverIdleSeconds: payload.associateScreensaverIdleSeconds || '',
        customProductBarcode: payload.customProductBarcode || '',
        currentUsedLocalFunds: payload.currentUsedLocalFunds || '0.00',
        currentMfrWholesaleFunds: payload.currentMfrWholesaleFunds || '0.00',
        postStoreLaunchDate: payload.postStoreLaunchDate || '2026-06-01',
        saleDescriptionPostfix: payload.saleDescriptionPostfix || '',
      });
      setUseStripeSandbox(stripePayload.useStripeSandbox ?? true);
      setStripePublishableKeySandbox(stripePayload.stripePublishableKeySandbox ?? '');
      setStripePublishableKey(stripePayload.stripePublishableKey ?? '');
      setUseV2DecodeLogic(v2DecodePayload.useV2DecodeLogic ?? false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load system settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'CCG Admin | System Settings';
    void loadSettings();
  }, []);

  const handleChange =
    (field: keyof SystemSettingsForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      const [settingsRes, stripeRes] = await Promise.all([
        fetch('/api/admin-v2/system-settings', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brevoOrderConfirmationTemplateId: Number(form.brevoOrderConfirmationTemplateId),
            brevoSenderName: form.brevoSenderName,
            brevoSenderEmail: form.brevoSenderEmail,
            associateScreensaverIdleSeconds: Number(form.associateScreensaverIdleSeconds),
            customProductBarcode: form.customProductBarcode,
            currentUsedLocalFunds: Number(form.currentUsedLocalFunds),
            currentMfrWholesaleFunds: Number(form.currentMfrWholesaleFunds),
            postStoreLaunchDate: form.postStoreLaunchDate,
            saleDescriptionPostfix: form.saleDescriptionPostfix,
          }),
        }),
        fetch('/api/admin-v2/stripe-config', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useStripeSandbox, stripePublishableKeySandbox, stripePublishableKey }),
        }),
      ]);
      const payload = (await settingsRes.json()) as SystemSettingsResponse;
      const stripePayload = (await stripeRes.json()) as StripeConfigResponse;
      if (!settingsRes.ok) throw new Error(payload.message || 'Unable to save system settings.');
      if (!stripeRes.ok) throw new Error(stripePayload.message || 'Unable to save Stripe keys.');
      setForm({
        brevoOrderConfirmationTemplateId: payload.brevoOrderConfirmationTemplateId || form.brevoOrderConfirmationTemplateId,
        brevoSenderName: payload.brevoSenderName || form.brevoSenderName,
        brevoSenderEmail: payload.brevoSenderEmail || form.brevoSenderEmail,
        associateScreensaverIdleSeconds: payload.associateScreensaverIdleSeconds || form.associateScreensaverIdleSeconds,
        customProductBarcode: payload.customProductBarcode || form.customProductBarcode,
        currentUsedLocalFunds: payload.currentUsedLocalFunds || form.currentUsedLocalFunds,
        currentMfrWholesaleFunds: payload.currentMfrWholesaleFunds || form.currentMfrWholesaleFunds,
        postStoreLaunchDate: payload.postStoreLaunchDate || form.postStoreLaunchDate,
        saleDescriptionPostfix: payload.saleDescriptionPostfix ?? form.saleDescriptionPostfix,
      });
      setStripePublishableKeySandbox(stripePayload.stripePublishableKeySandbox ?? stripePublishableKeySandbox);
      setStripePublishableKey(stripePayload.stripePublishableKey ?? stripePublishableKey);
      enqueueSnackbar('System settings saved.', { variant: 'success' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save system settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStripeEnvToggle = async (checked: boolean) => {
    const previous = useStripeSandbox;
    setUseStripeSandbox(checked);
    setIsUpdatingStripeEnv(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/stripe-config', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useStripeSandbox: checked }),
      });
      const payload = (await response.json()) as StripeConfigResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to update Stripe environment.');
      setUseStripeSandbox(payload.useStripeSandbox ?? checked);
      enqueueSnackbar('Stripe environment updated.', { variant: 'success' });
    } catch (error) {
      setUseStripeSandbox(previous);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update Stripe environment.');
    } finally {
      setIsUpdatingStripeEnv(false);
    }
  };

  const handleV2DecodeToggle = async (checked: boolean) => {
    const previous = useV2DecodeLogic;
    setUseV2DecodeLogic(checked);
    setIsUpdatingV2Decode(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/v2-decode-config', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useV2DecodeLogic: checked }),
      });
      const payload = (await response.json()) as V2DecodeConfigResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to update V2 decode logic.');
      setUseV2DecodeLogic(payload.useV2DecodeLogic ?? checked);
      enqueueSnackbar(`V2 decode logic ${checked ? 'enabled' : 'disabled'}.`, { variant: 'success' });
    } catch (error) {
      setUseV2DecodeLogic(previous);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update V2 decode logic.');
    } finally {
      setIsUpdatingV2Decode(false);
    }
  };

  const resolvePrinterUrl = () => {
    const stored = window.localStorage.getItem(printerUrlStorageKey) || '';
    return stored || defaultStarEndpoints[0];
  };

  const sendToTrader = (url: string, request: string) =>
    new Promise<void>((resolve, reject) => {
      ensureStarWebPrntGlobals();
      if (!window.StarWebPrintTrader) { reject(new Error('Star webPRNT not available.')); return; }
      const trader = new window.StarWebPrintTrader!({ url, timeout: 90000 });
      trader.onReceive = () => { window.localStorage.setItem(printerUrlStorageKey, url); resolve(); };
      trader.onError = (r) => reject(new Error(r.responseText || 'webPRNT request failed.'));
      trader.sendMessage({ request });
    });

  const runPrinterRequest = async (request: string, successMsg: string) => {
    const initial = resolvePrinterUrl();
    const candidates = [initial, ...defaultStarEndpoints].filter((u, i, a) => u && a.indexOf(u) === i);
    let lastError: Error | null = null;
    for (const url of candidates) {
      try { await sendToTrader(url, request); enqueueSnackbar(successMsg, { variant: 'success' }); return; }
      catch (e) { lastError = e instanceof Error ? e : new Error(String(e)); }
    }
    throw lastError || new Error('Unable to reach printer.');
  };

  const buildSampleReceiptRequest = async () => {
    ensureStarWebPrntGlobals();
    if (!window.StarWebPrintBuilder) throw new Error('Star webPRNT not available.');
    const builder = new window.StarWebPrintBuilder();
    const logo = await loadReceiptLogo();

    const response = await fetch('/api/shop/receipt-templates/base_cash_receipt', { credentials: 'same-origin' });
    const payload = response.ok ? (await response.json()) as { record?: { templateText?: string } } : {};
    const template = payload.record?.templateText || '{{logo}}\n{{center}}Coal Creek Guitars{{/center}}\n{{shopPhone}}\n{{hr}}\n{{itemHeader}}\n{{#items}}{{line}}\n{{/items}}{{hr}}\nShipping   {{shipping}}\nSubtotal   {{subtotal}}\nTax ({{salesTaxRate}}) {{salesTax}}\n{{text bold="true"}}Total   {{total}}{{/text}}\n{{hr}}\nThank you!';

    const now = new Date();
    const receiptDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const receiptTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const itemRows = sampleReceiptItems.map((item) => {
      const priceStr = formatMoney(item.linePrice);
      const prefix = `${String(item.quantity)} ${item.sku} `;
      const maxDescLen = Math.max(0, itemReceiptLineWidth - prefix.length - priceStr.length - 1);
      return {
        sku: item.sku,
        description: item.description,
        quantity: String(item.quantity),
        price: priceStr,
        line: padReceiptColumns(`${prefix}${item.description.slice(0, maxDescLen)}`, priceStr, itemReceiptLineWidth),
      };
    });

    const subtotal = sampleReceiptItems.reduce((s, i) => s + i.linePrice, 0);
    const salesTax = Math.round(subtotal * 0.0805 * 100) / 100;
    const total = subtotal + salesTax;

    const withItems = template.replace(
      /{{#items}}([\s\S]*?){{\/items}}/g,
      (_, itemTemplate: string) =>
        `{{text font="font_b"}}${itemRows.map((item) => replaceTemplateVariables(itemTemplate, item)).join('')}{{/text}}`,
    );
    const rendered = replaceTemplateVariables(withItems, {
      dateLine: padReceiptColumns(`Date:${receiptDate}`, `Time:${receiptTime}`),
      receiptDate,
      receiptTime,
      orderNumber: 'SAMPLE',
      itemHeader: padReceiptColumns('QTY / SKU / DESC', 'PRICE'),
      subtotal: formatMoney(subtotal),
      salesTax: formatMoney(salesTax),
      total: formatMoney(total),
      salesTaxRate: '8.05%',
      itemCount: String(sampleReceiptItems.reduce((s, i) => s + i.quantity, 0)),
      shopPhone: shopPhoneNumber,
      shipping: formatMoney(0),
      shippingLabel: 'In-store pickup',
    });

    const parts: string[] = [builder.createInitializationElement({ reset: false, print: false })];
    const appendText = (data: string, options: Record<string, unknown> = {}) => {
      if (!data) return;
      parts.push(builder.createTextElement({ codepage: 'utf8', international: 'usa', characterspace: 0, emphasis: false, invert: false, linespace: 32, width: 1, height: 1, font: 'font_a', underline: false, data, ...options }));
    };
    const tokenPattern = /{{logo}}|{{hr}}|{{center}}([\s\S]*?){{\/center}}|{{text\s+([^}]*)}}([\s\S]*?){{\/text}}/g;
    let cursor = 0;
    for (const match of rendered.matchAll(tokenPattern)) {
      appendText(rendered.slice(cursor, match.index));
      const token = match[0];
      if (token === '{{logo}}') {
        parts.push(builder.createAlignmentElement({ position: 'center' }), builder.createBitImageElement({ context: logo.context, x: 0, y: 0, width: logo.width, height: logo.height }), builder.createAlignmentElement({ position: 'left' }));
      } else if (token === '{{hr}}') {
        appendText(`${'-'.repeat(receiptLineWidth)}\n`);
      } else if (token.startsWith('{{center}}')) {
        parts.push(builder.createAlignmentElement({ position: 'center' }));
        appendText(match[1] || '');
        parts.push(builder.createAlignmentElement({ position: 'left' }));
      } else {
        const attrs = parseTextDirectiveAttrs(match[2] || '');
        const size = Math.max(1, Math.min(4, Number(attrs.size || 1)));
        appendText(match[3] || '', { emphasis: attrs.bold === 'true', width: size, height: size, ...(attrs.font ? { font: attrs.font } : {}) });
      }
      cursor = (match.index || 0) + token.length;
    }
    appendText(rendered.slice(cursor));
    parts.push(builder.createFeedElement({ line: 3, unit: 0 }), builder.createCutPaperElement({ feed: true, type: 'partial' }));
    return parts.join('');
  };

  const handleSampleReceipt = async () => {
    setIsPrintingReceipt(true);
    try { await runPrinterRequest(await buildSampleReceiptRequest(), 'Sample receipt sent.'); }
    catch (e) { enqueueSnackbar(e instanceof Error ? e.message : 'Unable to print sample receipt.', { variant: 'error' }); }
    finally { setIsPrintingReceipt(false); }
  };

  const handleKickDrawer = async () => {
    setIsKickingDrawer(true);
    try {
      ensureStarWebPrntGlobals();
      if (!window.StarWebPrintBuilder) throw new Error('Star webPRNT not available.');
      const builder = new window.StarWebPrintBuilder();
      await runPrinterRequest(buildCashDrawerKick(builder), 'Cash drawer command sent.');
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Unable to kick drawer.', { variant: 'error' });
    } finally { setIsKickingDrawer(false); }
  };

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="System Settings"
        breadcrumb={[
          { label: 'Home', url: paths.starter },
          { label: 'System Settings', active: true },
        ]}
        actionComponent={
          <Button
            variant="contained"
            disabled={isLoading || isSaving}
            startIcon={<IconifyIcon icon="material-symbols:save" />}
            onClick={() => void handleSave()}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Stack direction="column" sx={{ gap: 3, maxWidth: 720 }}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          <FormControlLabel
            control={
              <Switch
                checked={useStripeSandbox}
                disabled={isLoading || isSaving || isUpdatingStripeEnv}
                onChange={(event) => void handleStripeEnvToggle(event.target.checked)}
              />
            }
            label={useStripeSandbox ? 'Stripe sandbox' : 'Stripe production'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={useV2DecodeLogic}
                disabled={isLoading || isSaving || isUpdatingV2Decode}
                onChange={(event) => void handleV2DecodeToggle(event.target.checked)}
              />
            }
            label={useV2DecodeLogic ? 'V2 Decode Logic (on)' : 'V2 Decode Logic (off)'}
          />
          <TextField
            fullWidth
            label="Stripe Publishable Key (Test / Sandbox)"
            placeholder="pk_test_..."
            value={stripePublishableKeySandbox}
            disabled={isLoading || isSaving}
            onChange={(e) => setStripePublishableKeySandbox(e.target.value)}
          />
          <TextField
            fullWidth
            label="Stripe Publishable Key (Live / Production)"
            placeholder="pk_live_..."
            value={stripePublishableKey}
            disabled={isLoading || isSaving}
            onChange={(e) => setStripePublishableKey(e.target.value)}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="Brevo Order Confirm Template ID"
            value={form.brevoOrderConfirmationTemplateId}
            disabled={isLoading || isSaving}
            onChange={handleChange('brevoOrderConfirmationTemplateId')}
            inputProps={{ min: 1, step: 1 }}
          />
          <TextField
            fullWidth
            label="Brevo Sender Name"
            value={form.brevoSenderName}
            disabled={isLoading || isSaving}
            onChange={handleChange('brevoSenderName')}
          />
          <TextField
            fullWidth
            type="email"
            label="Brevo Sender Email"
            value={form.brevoSenderEmail}
            disabled={isLoading || isSaving}
            onChange={handleChange('brevoSenderEmail')}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="Associate Screensaver Idle Seconds"
            value={form.associateScreensaverIdleSeconds}
            disabled={isLoading || isSaving}
            onChange={handleChange('associateScreensaverIdleSeconds')}
            inputProps={{ min: 1, step: 1 }}
          />
          <TextField
            fullWidth
            label="Custom Product Barcode"
            value={form.customProductBarcode}
            disabled={isLoading || isSaving}
            onChange={handleChange('customProductBarcode')}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="Current Used Local Funds"
            value={form.currentUsedLocalFunds}
            disabled={isLoading || isSaving}
            onChange={handleChange('currentUsedLocalFunds')}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="Current Mfr Wholesale Funds"
            value={form.currentMfrWholesaleFunds}
            disabled={isLoading || isSaving}
            onChange={handleChange('currentMfrWholesaleFunds')}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            required
            type="date"
            label="Post Store Launch Date"
            value={form.postStoreLaunchDate}
            disabled={isLoading || isSaving}
            onChange={handleChange('postStoreLaunchDate')}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            multiline
            minRows={12}
            label="Sale Description Postfix"
            value={form.saleDescriptionPostfix}
            disabled={isLoading || isSaving}
            onChange={handleChange('saleDescriptionPostfix')}
          />
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            Register / Printer
          </Typography>
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<IconifyIcon icon="material-symbols:receipt-long-rounded" />}
              loading={isPrintingReceipt}
              disabled={isKickingDrawer}
              onClick={() => void handleSampleReceipt()}
            >
              Sample Receipt
            </Button>
            <Button
              variant="outlined"
              color="neutral"
              startIcon={<IconifyIcon icon="mdi:cash-register" />}
              loading={isKickingDrawer}
              disabled={isPrintingReceipt}
              onClick={() => void handleKickDrawer()}
            >
              Kick Drawer
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default SystemSettings;
