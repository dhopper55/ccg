import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import useNumberFormat from 'hooks/useNumberFormat';
import { useSnackbar } from 'notistack';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useEcommerce } from 'providers/EcommerceProvider';

const cashOrderNumberStorageKey = 'ccg-last-cash-order-number';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CashCustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
};

type CashCustomerFormErrors = Partial<Record<keyof CashCustomerForm, string>>;

const defaultCashCustomerForm: CashCustomerForm = {
  firstName: '',
  lastName: '',
  email: '',
};

const validateCashCustomerForm = (values: CashCustomerForm) => {
  const errors: CashCustomerFormErrors = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const email = values.email.trim();

  if (!firstName) {
    errors.firstName = 'First name is required.';
  } else if (firstName.length > 80) {
    errors.firstName = 'First name must be 80 characters or fewer.';
  }

  if (!lastName) {
    errors.lastName = 'Last name is required.';
  } else if (lastName.length > 80) {
    errors.lastName = 'Last name must be 80 characters or fewer.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
};

const CartBottomBar = () => {
  const { appliedCoupon, cartItems, cartTotal, taxIncluded } = useEcommerce();
  const { isAssociateMode } = useAssociateMode();
  const { up } = useBreakpoints();
  const { currencyFormat } = useNumberFormat();
  const { enqueueSnackbar } = useSnackbar();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCashCheckingOut, setIsCashCheckingOut] = useState(false);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);
  const [cashCustomer, setCashCustomer] = useState<CashCustomerForm>(defaultCashCustomerForm);
  const [cashCustomerErrors, setCashCustomerErrors] = useState<CashCustomerFormErrors>({});
  const upSm = up('sm');
  const selectedCartItems = useMemo(() => cartItems.filter((item) => item.selected), [cartItems]);

  const setCashCustomerField = (field: keyof CashCustomerForm, value: string) => {
    setCashCustomer((current) => ({ ...current, [field]: value }));
    setCashCustomerErrors((current) => ({ ...current, [field]: undefined }));
  };

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
      const data = (await response.json()) as { url?: string; orderNumber?: string; message?: string };

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

    const errors = validateCashCustomerForm(cashCustomer);
    setCashCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
          customer: {
            firstName: cashCustomer.firstName.trim(),
            lastName: cashCustomer.lastName.trim(),
            email: cashCustomer.email.trim(),
          },
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

      if (data.orderNumber) {
        window.localStorage.setItem(cashOrderNumberStorageKey, data.orderNumber);
      }
      setCashCustomer(defaultCashCustomerForm);
      setCashCustomerErrors({});
      window.location.assign(data.url);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to record cash checkout.', {
        variant: 'error',
      });
      setIsCashCheckingOut(false);
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
    <Dialog open={cashConfirmOpen} onClose={() => !isCashCheckingOut && setCashConfirmOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Confirm cash paid in full?</DialogTitle>
      <Box component="form" onSubmit={(event) => {
        event.preventDefault();
        void handleCashCheckout();
      }}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack direction="column" sx={{ gap: 2 }}>
            <TextField
              autoFocus
              required
              fullWidth
              label="First name"
              value={cashCustomer.firstName}
              error={!!cashCustomerErrors.firstName}
              helperText={cashCustomerErrors.firstName}
              onChange={(event) => setCashCustomerField('firstName', event.target.value)}
              disabled={isCashCheckingOut}
            />
            <TextField
              required
              fullWidth
              label="Last name"
              value={cashCustomer.lastName}
              error={!!cashCustomerErrors.lastName}
              helperText={cashCustomerErrors.lastName}
              onChange={(event) => setCashCustomerField('lastName', event.target.value)}
              disabled={isCashCheckingOut}
            />
            <TextField
              required
              fullWidth
              type="email"
              label="Email"
              value={cashCustomer.email}
              error={!!cashCustomerErrors.email}
              helperText={cashCustomerErrors.email}
              onChange={(event) => setCashCustomerField('email', event.target.value)}
              disabled={isCashCheckingOut}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            variant="soft"
            onClick={() => setCashConfirmOpen(false)}
            disabled={isCashCheckingOut}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={isCashCheckingOut}>
            Confirm
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
    </>
  );
};

export default CartBottomBar;
