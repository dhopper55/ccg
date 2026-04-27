import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Stack } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router';
import { ensureStarWebPrntGlobals } from 'lib/starWebPrntShim';
import { useEcommerce } from 'providers/EcommerceProvider';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
declare global { interface Window { __STAR_WEBPRNT_URL__?: string; } }

const printerUrlStorageKey = 'ccg-star-webprnt-url';
const cashOrderNumberStorageKey = 'ccg-last-cash-order-number';
const receiptLogoUrl = 'https://www.coalcreekguitars.com/images/ccg_bnw.bmp';
const receiptTemplateCode = 'base_cash_receipt';
const maxLogoWidth = 384;
const receiptLineWidth = 32;
const defaultStarEndpoints = [
  'https://localhost:8001/StarWebPRNT/SendMessage',
  'http://localhost:8001/StarWebPRNT/SendMessage',
];

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
  if (!context) {
    throw new Error('Unable to create canvas context for receipt logo.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return { context, width: targetWidth, height: targetHeight };
};

const moneyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatMoney = (value: number) => moneyFormat.format(value);

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

const CartPrinterActions = () => {
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { cartItems, cartSubTotal } = useEcommerce();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCartRoute = useMemo(() => location.pathname === paths.cart, [location.pathname]);

  useEffect(() => {
    ensureStarWebPrntGlobals();
  }, []);

  if (!isCartRoute) return null;

  const resolvePrinterUrl = () => {
    const searchUrl = new URLSearchParams(window.location.search).get('starWebPrntUrl');
    const runtimeUrl = window.__STAR_WEBPRNT_URL__;
    const storedUrl = window.localStorage.getItem(printerUrlStorageKey) || '';
    const existing = searchUrl || runtimeUrl || storedUrl || defaultStarEndpoints[0];

    if (existing) {
      if (!storedUrl && existing) {
        window.localStorage.setItem(printerUrlStorageKey, existing);
      }
      return existing;
    }
    throw new Error('No Star webPRNT endpoint URL is configured.');
  };

  const sendToTrader = async (url: string, request: string) => {
    ensureStarWebPrntGlobals();
    if (!window.StarWebPrintBuilder || !window.StarWebPrintTrader) {
      throw new Error('Star webPRNT scripts are not available in this browser context.');
    }

    await new Promise<void>((resolve, reject) => {
      const trader = new window.StarWebPrintTrader!({ url, timeout: 90000 });

      trader.onReceive = () => resolve();
      trader.onError = (response) => {
        reject(new Error(response.responseText || 'Star webPRNT request failed.'));
      };

      trader.sendMessage({ request });
    });
  };

  const runRequest = async (request: string, successMessage: string) => {
    const initialUrl = resolvePrinterUrl();
    const candidateUrls = [initialUrl, ...defaultStarEndpoints].filter(
      (url, index, all) => url && all.indexOf(url) === index,
    );

    let lastError: Error | null = null;

    for (const url of candidateUrls) {
      try {
        await sendToTrader(url, request);
        window.localStorage.setItem(printerUrlStorageKey, url);
        enqueueSnackbar(successMessage, { variant: 'success' });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError || new Error('Unable to reach the Star webPRNT endpoint.');
  };

  const fetchReceiptTemplate = async () => {
    const response = await fetch(`/api/shop/receipt-templates/${receiptTemplateCode}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Unable to load receipt template.');
    }
    const payload = (await response.json()) as { record?: { templateText?: string } };
    const templateText = payload.record?.templateText;
    if (!templateText) {
      throw new Error('Receipt template is empty.');
    }
    return templateText;
  };

  const renderReceiptTemplate = (template: string) => {
    const selectedCartItems = cartItems.filter((item) => item.selected);
    const salesTax = Math.round(cartSubTotal * 0.075 * 100) / 100;
    const total = cartSubTotal + salesTax;
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
    const itemRows = selectedCartItems.map((item) => {
      const sku = item.ccgNumber || `CCG-${item.id}`;
      const description = item.name;
      const linePrice = item.price.discounted * item.quantity;
      const left = item.quantity > 1 ? `${sku} ${description} x${item.quantity}` : `${sku} ${description}`;
      return {
        sku,
        description,
        quantity: String(item.quantity),
        price: formatMoney(linePrice),
        unitPrice: formatMoney(item.price.discounted),
        line: padReceiptColumns(left, formatMoney(linePrice)),
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
      orderNumber: window.localStorage.getItem(cashOrderNumberStorageKey) || '',
      itemHeader: padReceiptColumns('SKU / DESC', 'PRICE'),
      subtotal: formatMoney(cartSubTotal),
      salesTax: formatMoney(salesTax),
      total: formatMoney(total),
      salesTaxRate: '7.5%',
      itemCount: String(selectedCartItems.reduce((sum, item) => sum + item.quantity, 0)),
    });
  };

  const buildReceiptRequest = async () => {
    ensureStarWebPrntGlobals();
    if (!window.StarWebPrintBuilder) {
      throw new Error('Star webPRNT is not available in this browser context.');
    }
    const builder = new window.StarWebPrintBuilder();
    const logo = await loadReceiptLogo();
    const renderedTemplate = renderReceiptTemplate(await fetchReceiptTemplate());
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

  const handleOpenDrawer = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      ensureStarWebPrntGlobals();
      if (!window.StarWebPrintBuilder) {
        throw new Error('Star webPRNT is not available in this browser context.');
      }
      const builder = new window.StarWebPrintBuilder();
      const request = builder.createPeripheralElement({ channel: 1, on: 200, off: 200 });
      await runRequest(request, 'Cash drawer command sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open cash drawer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await runRequest(await buildReceiptRequest(), 'Receipt print command sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to print receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        borderTop: 1,
        borderColor: 'divider',
        px: { xs: 3, md: 5 },
        py: 3,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          disabled={isSubmitting}
          onClick={() => void handleOpenDrawer()}
          startIcon={<IconifyIcon icon="material-symbols:point-of-sale-rounded" />}
        >
          Open Drawer
        </Button>
        <Button
          variant="outlined"
          color="primary"
          disabled={isSubmitting}
          onClick={() => void handlePrintReceipt()}
          startIcon={<IconifyIcon icon="material-symbols:receipt-long-rounded" />}
        >
          Print Receipt
        </Button>
      </Stack>
      {errorMessage && (
        <Alert severity="error" sx={{ mt: 2, maxWidth: 720, mx: 'auto' }}>
          {errorMessage}
        </Alert>
      )}
    </Box>
  );
};

export default CartPrinterActions;
