import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Box } from '@mui/material';
import { useSnackbar } from 'notistack';
import AuthProvider from 'providers/AuthProvider';
import AssociateModeProvider from 'providers/AssociateModeProvider';
import EcommerceProvider from 'providers/EcommerceProvider';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import { slugifyCategory } from 'lib/utils';
import paths from 'routes/paths';

const BARCODE_MIN_LENGTH = 8;
const BARCODE_MAX_INTER_KEY_MS = 65;
const BARCODE_QUIET_MS = 140;
const ASSOCIATE_SCREENSAVER_IDLE_MS = 5_000;
const CCG_LOGO_URL = 'https://www.coalcreekguitars.com/images/coal-creek-logo.png';

type BarcodeSearchProduct = {
  id: string;
  saleUrlSlug: string;
  primaryCategoryName: string;
};

type BarcodeSearchResponse = {
  barcodeMatch?: BarcodeSearchProduct | null;
};

const ShopBarcodeScanner = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAssociateMode, isCheckingAssociateMode } = useAssociateMode();
  const scanBufferRef = useRef('');
  const scanStartedAtRef = useRef(0);
  const lastKeyAtRef = useRef(0);
  const quietTimerRef = useRef<number | null>(null);
  const lookupInFlightRef = useRef(false);

  const resetScan = useCallback(() => {
    scanBufferRef.current = '';
    scanStartedAtRef.current = 0;
    lastKeyAtRef.current = 0;
    if (quietTimerRef.current !== null) {
      window.clearTimeout(quietTimerRef.current);
      quietTimerRef.current = null;
    }
  }, []);

  const getProductUrl = useCallback((product: BarcodeSearchProduct) => {
    const categorySlug = slugifyCategory(product.primaryCategoryName);
    const productSlug = product.saleUrlSlug.trim();
    if (!categorySlug || !productSlug) return paths.products;
    return paths.productDetails(categorySlug, productSlug);
  }, []);

  const submitScan = useCallback(async () => {
    const barcode = scanBufferRef.current.trim();
    const startedAt = scanStartedAtRef.current;
    const lastKeyAt = lastKeyAtRef.current;
    resetScan();

    if (barcode.length < BARCODE_MIN_LENGTH || !startedAt || !lastKeyAt || isCheckingAssociateMode) return;
    const averageDelay = (lastKeyAt - startedAt) / Math.max(barcode.length - 1, 1);
    if (averageDelay > BARCODE_MAX_INTER_KEY_MS || lookupInFlightRef.current) return;

    lookupInFlightRef.current = true;
    try {
      const params = new URLSearchParams({ query: barcode });
      if (isAssociateMode) {
        params.set('associate', '1');
      }
      const response = await fetch(`/api/shop/product-search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Barcode lookup failed with status ${response.status}`);
      }
      const data = (await response.json()) as BarcodeSearchResponse;
      if (data.barcodeMatch) {
        navigate(getProductUrl(data.barcodeMatch));
        return;
      }
      enqueueSnackbar('Barcode not found', { variant: 'warning', autoHideDuration: 3000 });
    } catch (error) {
      console.error('Shop barcode lookup failed', error);
      enqueueSnackbar('Barcode lookup failed', { variant: 'error', autoHideDuration: 3000 });
    } finally {
      lookupInFlightRef.current = false;
    }
  }, [enqueueSnackbar, getProductUrl, isAssociateMode, isCheckingAssociateMode, navigate, resetScan]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        resetScan();
        return;
      }

      if (event.key === 'Enter') {
        if (scanBufferRef.current.length >= BARCODE_MIN_LENGTH) {
          event.preventDefault();
          void submitScan();
        } else {
          resetScan();
        }
        return;
      }

      if (event.key.length !== 1) return;

      const now = performance.now();
      if (!scanBufferRef.current || now - lastKeyAtRef.current > BARCODE_MAX_INTER_KEY_MS) {
        scanBufferRef.current = event.key;
        scanStartedAtRef.current = now;
      } else {
        scanBufferRef.current += event.key;
        if (scanBufferRef.current.length >= 3) {
          event.preventDefault();
        }
      }
      lastKeyAtRef.current = now;

      if (quietTimerRef.current !== null) {
        window.clearTimeout(quietTimerRef.current);
      }
      quietTimerRef.current = window.setTimeout(() => {
        if (scanBufferRef.current.length >= BARCODE_MIN_LENGTH) {
          void submitScan();
        } else {
          resetScan();
        }
      }, BARCODE_QUIET_MS);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      resetScan();
    };
  }, [resetScan, submitScan]);

  return null;
};

const AssociateScreensaver = () => {
  const { isAssociateMode, isCheckingAssociateMode } = useAssociateMode();
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    timerRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, ASSOCIATE_SCREENSAVER_IDLE_MS);
  }, [clearIdleTimer]);

  const handleActivity = useCallback(() => {
    setIsVisible(false);
    startIdleTimer();
  }, [startIdleTimer]);

  useEffect(() => {
    if (!isAssociateMode || isCheckingAssociateMode) {
      clearIdleTimer();
      setIsVisible(false);
      return undefined;
    }

    const events = [
      'mousemove',
      'mousedown',
      'mouseup',
      'click',
      'keydown',
      'keyup',
      'touchstart',
      'touchmove',
      'pointermove',
      'pointerdown',
      'wheel',
      'scroll',
    ] as const;

    startIdleTimer();
    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true, capture: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity, { capture: true });
      });
      clearIdleTimer();
    };
  }, [clearIdleTimer, handleActivity, isAssociateMode, isCheckingAssociateMode, startIdleTimer]);

  if (!isAssociateMode || !isVisible) return null;

  return (
    <Box
      role="presentation"
      aria-label="Coal Creek Guitars associate screensaver"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.tooltip + 1000,
        width: '100dvw',
        height: '100dvh',
        minHeight: '-webkit-fill-available',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        cursor: 'none',
        p: { xs: 3, sm: 5, md: 8 },
      }}
    >
      <Box
        component="img"
        src={CCG_LOGO_URL}
        alt="Coal Creek Guitars"
        draggable={false}
        sx={{
          display: 'block',
          width: 'min(86vw, 720px)',
          maxWidth: 1,
          maxHeight: '78dvh',
          objectFit: 'contain',
        }}
      />
    </Box>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AssociateModeProvider>
        <EcommerceProvider>
          <ShopBarcodeScanner />
          <AssociateScreensaver />
          <Outlet />
        </EcommerceProvider>
      </AssociateModeProvider>
    </AuthProvider>
  );
};

export default App;
