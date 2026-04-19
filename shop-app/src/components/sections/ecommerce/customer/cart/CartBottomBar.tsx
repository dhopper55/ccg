import { useMemo, useState } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import useNumberFormat from 'hooks/useNumberFormat';
import { useSnackbar } from 'notistack';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useEcommerce } from 'providers/EcommerceProvider';

const CartBottomBar = () => {
  const { cartItems, cartTotal } = useEcommerce();
  const { up } = useBreakpoints();
  const { currencyFormat } = useNumberFormat();
  const { enqueueSnackbar } = useSnackbar();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
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

  return (
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
            <Button
              color="neutral"
              variant="soft"
              disabled
              sx={{
                whiteSpace: 'nowrap',
                px: { xs: 3, sm: 4 },
              }}
            >
              Checkout cash
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default CartBottomBar;
