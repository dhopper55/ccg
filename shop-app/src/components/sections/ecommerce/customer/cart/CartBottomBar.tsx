import { useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import useNumberFormat from 'hooks/useNumberFormat';
import { useSnackbar } from 'notistack';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useEcommerce } from 'providers/EcommerceProvider';

const CartBottomBar = () => {
  const { appliedCoupon, cartItems, cartTotal, taxIncluded } = useEcommerce();
  const { isAssociateMode } = useAssociateMode();
  const { up } = useBreakpoints();
  const { currencyFormat } = useNumberFormat();
  const { enqueueSnackbar } = useSnackbar();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCashCheckingOut, setIsCashCheckingOut] = useState(false);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);
  const upSm = up('sm');
  const selectedCartItems = useMemo(() => cartItems.filter((item) => item.selected), [cartItems]);

  const handleStripeCheckout = async () => {
    if (selectedCartItems.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    try {
      const response = await fetch('/api/shop/orders/create-checkout-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillmentType: 'pickup',
          couponCode: appliedCoupon?.code || undefined,
          taxIncluded,
          items: selectedCartItems.map((item) => ({
            inventoryItemId: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as { url?: string; message?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.message || 'Unable to start checkout.');
      }

      window.location.assign(data.url);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to start checkout.', {
        variant: 'error',
      });
      setIsCheckingOut(false);
    }
  };

  const handleCashCheckout = async () => {
    if (selectedCartItems.length === 0 || isCashCheckingOut) return;

    setIsCashCheckingOut(true);
    try {
      const response = await fetch('/api/shop/orders/create-cash-order', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillmentType: 'pickup',
          couponCode: appliedCoupon?.code || undefined,
          taxIncluded,
          items: selectedCartItems.map((item) => ({
            inventoryItemId: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as { url?: string; message?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.message || 'Unable to record cash checkout.');
      }

      window.location.assign(data.url);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to record cash checkout.', {
        variant: 'error',
      });
      setIsCashCheckingOut(false);
      setCashConfirmOpen(false);
    }
  };

  return (
    <>
    <Paper background={2} sx={{ py: 1, px: { xs: 3, md: 5 } }}>
      <Stack
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {upSm && (
          <Typography
            variant="subtitle1"
            sx={{
              flex: 1,
            }}
          >
            {cartItems.length} item{cartItems.length > 1 ? 's' : ''} selected
          </Typography>
        )}
        <Stack
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: { xs: 1, sm: 'unset' },
            gap: { xs: 3, md: 8 },
          }}
        >
          <Stack
            sx={{
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                display: { xs: 'none', md: 'block' },
              }}
            >
              Total
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: { xs: 700 } }}>
              {currencyFormat(cartTotal)}
            </Typography>
          </Stack>
          <Stack
            sx={{
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Button
              color="primary"
              variant="contained"
              loading={isCheckingOut}
              disabled={selectedCartItems.length === 0}
              onClick={handleStripeCheckout}
              sx={{
                whiteSpace: 'nowrap',
                px: { xs: 3, sm: 6 },
              }}
            >
              Checkout
            </Button>
            {isAssociateMode && (
              <Button
                color="neutral"
                variant="soft"
                loading={isCashCheckingOut}
                disabled={selectedCartItems.length === 0}
                onClick={() => setCashConfirmOpen(true)}
                sx={{
                  whiteSpace: 'nowrap',
                  px: { xs: 3, sm: 4 },
                }}
              >
                Checkout cash
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
    <Dialog open={cashConfirmOpen} onClose={() => setCashConfirmOpen(false)}>
      <DialogTitle>Confirm cash paid in full?</DialogTitle>
      <DialogActions>
        <Button
          color="neutral"
          variant="soft"
          onClick={() => setCashConfirmOpen(false)}
          disabled={isCashCheckingOut}
        >
          Cancel
        </Button>
        <Button variant="contained" loading={isCashCheckingOut} onClick={handleCashCheckout}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default CartBottomBar;
