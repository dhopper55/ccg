import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { ensureStarWebPrntGlobals } from 'lib/starWebPrntShim';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import { useEcommerce } from 'providers/EcommerceProvider';
import { useLocation } from 'react-router';
import paths from 'routes/paths';

const receiptLogoUrl = 'https://www.coalcreekguitars.com/images/ccg_bnw.bmp';
const receiptTemplateCode = 'base_credit_receipt';
const receiptLineWidth = 32;
const maxLogoWidth = 384;
const printerUrlStorageKey = 'ccg-star-webprnt-url';
const defaultStarEndpoints = [
  'https://localhost:8001/StarWebPRNT/SendMessage',
  'http://localhost:8001/StarWebPRNT/SendMessage',
];

type ReceiptItem = {
  ccgNumber?: string;
  title: string;
  quantity: number;
  subtotalCents: number;
};

type ReceiptRecord = {
  orderNumber: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethodLabel: string;
  items: ReceiptItem[];
};

const moneyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCents = (value: number) => moneyFormat.format((Number(value) || 0) / 100);

const padReceiptColumns = (left: string, right: string, width = receiptLineWidth) => {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanRight = right.trim();
  const maxLeftLength = Math.max(1, width - cleanRight.length - 1);
  const visibleLeft = cleanLeft.length > maxLeftLength ? cleanLeft.slice(0, maxLeftLength) : cleanLeft;
  const gap = Math.max(1, width - visibleLeft.length - cleanRight.length);
  return `${visibleLeft}${' '.repeat(gap)}${cleanRight}`;
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

const isWebPrntBrowser = () =>
  typeof window !== 'undefined' &&
  (
    Boolean(window.webkit?.messageHandlers?.sendMessageHandler) ||
    window.localStorage.getItem(printerUrlStorageKey) === defaultStarEndpoints[0] ||
    window.localStorage.getItem(printerUrlStorageKey) === defaultStarEndpoints[1] ||
    Boolean(window.__STAR_WEBPRNT_URL__)
  );

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
  if (!context) throw new Error('Unable to create canvas context for receipt logo.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return { context, width: targetWidth, height: targetHeight };
};

const fetchReceiptTemplate = async () => {
  const response = await fetch(`/api/shop/receipt-templates/${receiptTemplateCode}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to load receipt template (${response.status}): ${body.slice(0, 160)}`);
  }
  const payload = (await response.json()) as { record?: { templateText?: string } };
  if (!payload.record?.templateText) throw new Error('Receipt template is empty.');
  return payload.record.templateText;
};

const fetchReceiptRecord = async (orderId: string) => {
  const response = await fetch(`/api/shop/orders/${encodeURIComponent(orderId)}/receipt`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to load order receipt (${response.status}): ${body.slice(0, 160)}`);
  }
  const payload = (await response.json()) as { record?: ReceiptRecord };
  if (!payload.record) throw new Error('Order receipt is empty.');
  return payload.record;
};

const renderReceiptTemplate = (template: string, record: ReceiptRecord) => {
  const now = new Date();
  const receiptDate = now.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const receiptTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const itemRows = record.items.map((item) => {
    const sku = item.ccgNumber || '';
    const description = item.title || 'Item';
    const left = item.quantity > 1 ? `${sku} ${description} x${item.quantity}` : `${sku} ${description}`;
    return {
      sku,
      description,
      quantity: String(item.quantity),
      price: formatCents(item.subtotalCents),
      line: padReceiptColumns(left, formatCents(item.subtotalCents)),
    };
  });
  const withItems = template.replace(
    /{{#items}}([\s\S]*?){{\/items}}/g,
    (_, itemTemplate: string) =>
      itemRows.map((item) => replaceTemplateVariables(itemTemplate, item)).join(''),
  );
  return replaceTemplateVariables(withItems, {
    dateLine: padReceiptColumns(`Date:${receiptDate}`, `Time:${receiptTime}`),
    receiptDate,
    receiptTime,
    itemHeader: padReceiptColumns('SKU / DESC', 'PRICE'),
    subtotal: formatCents(record.subtotalCents),
    salesTax: formatCents(record.taxCents),
    total: formatCents(record.totalCents),
    salesTaxRate: '7.5%',
    paymentMethodLabel: record.paymentMethodLabel || 'Payment method: Stripe',
    orderNumber: record.orderNumber || '',
  });
};

const buildReceiptRequest = async (renderedTemplate: string) => {
  ensureStarWebPrntGlobals();
  if (!window.StarWebPrintBuilder) throw new Error('Star webPRNT is not available.');
  const builder = new window.StarWebPrintBuilder();
  const logo = await loadReceiptLogo();
  const parts: string[] = [builder.createInitializationElement({ reset: false, print: false })];
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

  const tokenPattern =
    /{{logo}}|{{hr}}|{{center}}([\s\S]*?){{\/center}}|{{text\s+([^}]*)}}([\s\S]*?){{\/text}}/g;
  let cursor = 0;
  for (const match of renderedTemplate.matchAll(tokenPattern)) {
    appendText(renderedTemplate.slice(cursor, match.index));
    const token = match[0];
    if (token === '{{logo}}') {
      parts.push(
        builder.createAlignmentElement({ position: 'center' }),
        builder.createBitImageElement({
          context: logo.context,
          x: 0,
          y: 0,
          width: logo.width,
          height: logo.height,
        }),
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
      appendText(match[3] || '', {
        emphasis: attrs.bold === 'true',
        width: size,
        height: size,
      });
    }
    cursor = (match.index || 0) + token.length;
  }
  appendText(renderedTemplate.slice(cursor));
  parts.push(
    builder.createFeedElement({ line: 3, unit: 0 }),
    builder.createCutPaperElement({ feed: true, type: 'partial' }),
  );
  return parts.join('');
};

const sendToWebPrnt = async (request: string) => {
  ensureStarWebPrntGlobals();
  if (!window.StarWebPrintTrader) throw new Error('Star webPRNT is not available.');
  const storedUrl = window.localStorage.getItem(printerUrlStorageKey) || '';
  const runtimeUrl = window.__STAR_WEBPRNT_URL__ || '';
  const candidateUrls = [runtimeUrl, storedUrl, ...defaultStarEndpoints].filter(
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

const CheckoutSuccess = () => {
  const { setCartItems } = useEcommerce();
  const { isAssociateMode, isCheckingAssociateMode } = useAssociateMode();
  const location = useLocation();
  const receiptAttemptedRef = useRef(false);
  const [receiptDebug, setReceiptDebug] = useState<string[]>([]);

  const appendReceiptDebug = (message: string) => {
    setReceiptDebug((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-12));
  };

  useEffect(() => {
    setCartItems([]);
  }, [setCartItems]);

  useEffect(() => {
    if (receiptAttemptedRef.current) return;
    if (isCheckingAssociateMode) {
      appendReceiptDebug('Waiting for associate mode check.');
      return;
    }
    if (!isAssociateMode) {
      appendReceiptDebug('Skipped: associate mode is not active.');
      return;
    }
    if (!isWebPrntBrowser()) {
      appendReceiptDebug('Skipped: WebPRNT environment not detected.');
      return;
    }
    const orderId = new URLSearchParams(location.search).get('order') || '';
    if (!orderId) {
      appendReceiptDebug('Skipped: no order query param on success URL.');
      return;
    }

    receiptAttemptedRef.current = true;
    const printReceipt = async () => {
      try {
        appendReceiptDebug(`Loading receipt for order ${orderId}.`);
        const [template, record] = await Promise.all([
          fetchReceiptTemplate(),
          fetchReceiptRecord(orderId),
        ]);
        appendReceiptDebug(`Loaded template and order ${record.orderNumber || '(no order number)'}.`);
        await sendToWebPrnt(await buildReceiptRequest(renderReceiptTemplate(template, record)));
        appendReceiptDebug('Receipt print command sent.');
      } catch (error) {
        appendReceiptDebug(`Receipt print failed: ${error instanceof Error ? error.message : String(error)}`);
        console.warn('Stripe receipt print skipped', error);
      }
    };
    void printReceipt();
  }, [isAssociateMode, isCheckingAssociateMode, location.search]);

  return (
    <Paper
      sx={{
        minHeight: '60vh',
        px: { xs: 3, md: 5 },
        py: { xs: 8, md: 12 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack
        direction="column"
        sx={{
          maxWidth: 640,
          gap: 3,
          textAlign: 'center',
          alignItems: 'center',
        }}
      >
        <Typography variant="h2">Thanks for your order.</Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          Your payment is confirmed. Pickup is at our Englewood shop.
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Bring your receipt when you come in. Call or text (303) 376-9214 with any pickup
          questions.
        </Typography>
        <Button variant="contained" href={paths.products}>
          Back to shop
        </Button>
        {isAssociateMode && receiptDebug.length > 0 && (
          <Alert severity="info" sx={{ mt: 2, textAlign: 'left', width: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Receipt debug
            </Typography>
            {receiptDebug.map((line) => (
              <Typography key={line} variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                {line}
              </Typography>
            ))}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

export default CheckoutSuccess;
