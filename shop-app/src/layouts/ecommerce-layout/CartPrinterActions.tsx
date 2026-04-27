import { useMemo, useState } from 'react';
import { Alert, Box, Button, Stack } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router';
import { ensureStarWebPrntGlobals } from 'lib/starWebPrntShim';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
declare global { interface Window { __STAR_WEBPRNT_URL__?: string; } }

const printerUrlStorageKey = 'ccg-star-webprnt-url';
const receiptLogoUrl = 'https://www.coalcreekguitars.com/images/ccg_bnw.png';
const maxLogoWidth = 384;

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

const CartPrinterActions = () => {
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCartRoute = useMemo(() => location.pathname === paths.cart, [location.pathname]);

  if (!isCartRoute) return null;

  const resolvePrinterUrl = () => {
    const searchUrl = new URLSearchParams(window.location.search).get('starWebPrntUrl');
    const runtimeUrl = window.__STAR_WEBPRNT_URL__;
    const storedUrl = window.localStorage.getItem(printerUrlStorageKey) || '';
    const existing = searchUrl || runtimeUrl || storedUrl;

    if (existing) {
      if (!storedUrl && existing) {
        window.localStorage.setItem(printerUrlStorageKey, existing);
      }
      return existing;
    }

    const entered = window.prompt('Enter the Star webPRNT endpoint URL for this printer:');
    const nextUrl = entered?.trim() || '';
    if (!nextUrl) {
      throw new Error('A Star webPRNT endpoint URL is required.');
    }

    window.localStorage.setItem(printerUrlStorageKey, nextUrl);
    return nextUrl;
  };

  const runRequest = async (request: string, successMessage: string) => {
    ensureStarWebPrntGlobals();
    if (!window.StarWebPrintBuilder || !window.StarWebPrintTrader) {
      throw new Error('Star webPRNT scripts are not available in this browser context.');
    }

    const url = resolvePrinterUrl();

    await new Promise<void>((resolve, reject) => {
      const trader = new window.StarWebPrintTrader!({ url, timeout: 90000 });

      trader.onReceive = () => resolve();
      trader.onError = (response) => {
        reject(new Error(response.responseText || 'Star webPRNT request failed.'));
      };

      trader.sendMessage({ request });
    });

    enqueueSnackbar(successMessage, { variant: 'success' });
  };

  const handleOpenDrawer = async () => {
    if (!window.StarWebPrintBuilder) {
      setErrorMessage('Star webPRNT is not available in this browser context.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const builder = new window.StarWebPrintBuilder();
      const request = `<root>${builder.createPeripheralElement({ channel: 1, on: 200, off: 200 })}</root>`;
      await runRequest(request, 'Cash drawer command sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open cash drawer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!window.StarWebPrintBuilder) {
      setErrorMessage('Star webPRNT is not available in this browser context.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const builder = new window.StarWebPrintBuilder();
      const logo = await loadReceiptLogo();
      const request = `<root>${
        builder.createInitializationElement({ reset: false, print: false }) +
        builder.createAlignmentElement({ position: 'center' }) +
        builder.createBitImageElement({
          context: logo.context,
          x: 0,
          y: 0,
          width: logo.width,
          height: logo.height,
        }) +
        builder.createFeedElement({ line: 1, unit: 0 }) +
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
          data: 'Hello World\nLine 2\n',
        }) +
        builder.createFeedElement({ line: 3, unit: 0 }) +
        builder.createCutPaperElement({ feed: true, type: 'partial' })
      }</root>`;

      await runRequest(request, 'Receipt print command sent.');
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
