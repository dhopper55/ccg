import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
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
type AssociateStripeFlow = 'checkout' | 'split';
type TerminalPaymentStatus = 'idle' | 'waiting' | 'cancelling' | 'succeeded' | 'failed';

type TerminalPaymentState = {
  open: boolean;
  status: TerminalPaymentStatus;
  orderId: string;
  orderNumber: string;
  successUrl: string;
  message: string;
};

const defaultCashCustomerForm: CashCustomerForm = {
  firstName: '',
  lastName: '',
  email: '',
};

const defaultTerminalPaymentState: TerminalPaymentState = {
  open: false,
  status: 'idle',
  orderId: '',
  orderNumber: '',
  successUrl: '',
  message: '',
};

const parseCurrencyToCents = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, '');
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const formatCurrencyInput = (cents: number) => (Math.max(0, cents) / 100).toFixed(2);

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
  const { appliedCoupon, cartItems, cartTotal, taxIncluded, otdMode } = useEcommerce();
  const { isAssociateMode, stripeSandbox } = useAssociateMode();
  const { up } = useBreakpoints();
  const { currencyFormat } = useNumberFormat();
  const { enqueueSnackbar } = useSnackbar();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCashCheckingOut, setIsCashCheckingOut] = useState(false);
  const [splitTenderOpen, setSplitTenderOpen] = useState(false);
  const [splitCardAmount, setSplitCardAmount] = useState('0.00');
  const [associateStripeFlow, setAssociateStripeFlow] = useState<AssociateStripeFlow | null>(null);
  const [paymentRouteOpen, setPaymentRouteOpen] = useState(false);
  const [refundPolicyOpen, setRefundPolicyOpen] = useState(false);
  const [terminalPayment, setTerminalPayment] = useState<TerminalPaymentState>(defaultTerminalPaymentState);
  const [isCancelingTerminalPayment, setIsCancelingTerminalPayment] = useState(false);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);
  const [terminalCustomerOpen, setTerminalCustomerOpen] = useState(false);
  const [cashCustomer, setCashCustomer] = useState<CashCustomerForm>(defaultCashCustomerForm);
  const [cashCustomerErrors, setCashCustomerErrors] = useState<CashCustomerFormErrors>({});
  const [terminalCustomer, setTerminalCustomer] = useState<CashCustomerForm>(defaultCashCustomerForm);
  const [terminalCustomerErrors, setTerminalCustomerErrors] = useState<CashCustomerFormErrors>({});
  const [terminalCancelUnlocked, setTerminalCancelUnlocked] = useState(false);
  const terminalPollCancelledRef = useRef(false);
  const upSm = up('sm');
  const selectedCartItems = useMemo(() => cartItems.filter((item) => item.selected), [cartItems]);
  const cartTotalCents = Math.max(0, Math.round(cartTotal * 100));
  const splitCardAmountCents = parseCurrencyToCents(splitCardAmount);
  const splitCashAmountCents = Math.max(0, cartTotalCents - splitCardAmountCents);
  const splitCardAmountError = splitCardAmountCents > 0 && splitCardAmountCents < 100
    ? 'Card amount must be at least $1.00.'
    : splitCardAmountCents > cartTotalCents
      ? 'Card amount cannot exceed the order total.'
      : '';
  const canSubmitSplitTender =
    selectedCartItems.length > 0 &&
    splitCardAmountCents >= 100 &&
    splitCardAmountCents <= cartTotalCents &&
    !isCheckingOut;

  const setCashCustomerField = (field: keyof CashCustomerForm, value: string) => {
    setCashCustomer((current) => ({ ...current, [field]: value }));
    setCashCustomerErrors((current) => ({ ...current, [field]: undefined }));
  };

  const setTerminalCustomerField = (field: keyof CashCustomerForm, value: string) => {
    setTerminalCustomer((current) => ({ ...current, [field]: value }));
    setTerminalCustomerErrors((current) => ({ ...current, [field]: undefined }));
  };

  const buildCheckoutPayload = (
    splitTender?: { cardAmountCents: number },
  ) => ({
    fulfillmentType: 'pickup',
    couponCode: appliedCoupon?.code || undefined,
    taxIncluded,
    otdMode,
    splitTender,
    items: selectedCartItems.map((item) => ({
      inventoryItemId: item.id,
      quantity: item.quantity,
    })),
  });

  const openAssociateStripeRoute = (flow: AssociateStripeFlow) => {
    setAssociateStripeFlow(flow);
    setPaymentRouteOpen(true);
  };

  const openRefundPolicyDialog = () => {
    setRefundPolicyOpen(true);
  };

  const handleRefundPolicyAgree = () => {
    setRefundPolicyOpen(false);
    void handleStripeCheckout();
  };

  const handleStripeCheckout = async () => {
    if (selectedCartItems.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    try {
      const response = await fetch('/api/shop/orders/create-checkout-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCheckoutPayload()),
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

  const openSplitTenderDialog = () => {
    setSplitCardAmount('0.00');
    setSplitTenderOpen(true);
  };

  const handleSplitTenderCheckout = async () => {
    if (!canSubmitSplitTender) return;

    setIsCheckingOut(true);
    try {
      const response = await fetch('/api/shop/orders/create-checkout-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCheckoutPayload({ cardAmountCents: splitCardAmountCents })),
      });
      const data = (await response.json()) as { url?: string; orderNumber?: string; message?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.message || 'Unable to start card + cash checkout.');
      }

      window.location.assign(data.url);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to start card + cash checkout.', {
        variant: 'error',
      });
      setIsCheckingOut(false);
    }
  };

  const handleTerminalCheckout = async (customer: CashCustomerForm) => {
    if (selectedCartItems.length === 0 || isCheckingOut || !associateStripeFlow) return;

    setTerminalCustomerOpen(false);
    setIsCheckingOut(true);
    try {
      const splitTender = associateStripeFlow === 'split'
        ? { cardAmountCents: splitCardAmountCents }
        : undefined;
      const response = await fetch('/api/shop/orders/create-terminal-payment', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildCheckoutPayload(splitTender),
          customer: {
            firstName: customer.firstName.trim(),
            lastName: customer.lastName.trim(),
            email: customer.email.trim(),
          },
        }),
      });
      const data = (await response.json()) as {
        orderId?: string;
        orderNumber?: string;
        successUrl?: string;
        message?: string;
      };

      if (!response.ok || !data.orderId) {
        throw new Error(data.message || 'Unable to start terminal payment.');
      }

      terminalPollCancelledRef.current = false;
      setTerminalPayment({
        open: true,
        status: 'waiting',
        orderId: data.orderId,
        orderNumber: data.orderNumber || '',
        successUrl: data.successUrl || '',
        message: 'Complete the card payment on the WisePOS E.',
      });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to start terminal payment.', {
        variant: 'error',
      });
      setIsCheckingOut(false);
    }
  };

  const handleAssociateWebCheckout = () => {
    setPaymentRouteOpen(false);
    if (associateStripeFlow === 'split') {
      void handleSplitTenderCheckout();
      return;
    }
    void handleStripeCheckout();
  };

  const handleTerminalCancel = async () => {
    if (!terminalPayment.orderId || isCancelingTerminalPayment) return;

    terminalPollCancelledRef.current = true;
    setIsCancelingTerminalPayment(true);
    setTerminalPayment((current) => ({ ...current, status: 'cancelling' }));
    try {
      const response = await fetch(`/api/shop/orders/${encodeURIComponent(terminalPayment.orderId)}/terminal-payment/cancel`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || 'Unable to cancel terminal payment.');
      }
      setTerminalPayment(defaultTerminalPaymentState);
      setIsCheckingOut(false);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to cancel terminal payment.', {
        variant: 'error',
      });
    } finally {
      setIsCancelingTerminalPayment(false);
    }
  };

  useEffect(() => {
    if (!terminalPayment.open || terminalPayment.status !== 'waiting' || !terminalPayment.orderId) return undefined;

    let effectCancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/shop/orders/${encodeURIComponent(terminalPayment.orderId)}/terminal-payment`, {
          credentials: 'same-origin',
        });
        const data = (await response.json()) as {
          status?: TerminalPaymentStatus;
          successUrl?: string;
          message?: string;
        };
        if (effectCancelled || terminalPollCancelledRef.current) return;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to check terminal payment.');
        }
        if (data.status === 'succeeded') {
          window.location.assign(data.successUrl || terminalPayment.successUrl);
          return;
        }
        if (data.status === 'failed') {
          setTerminalPayment((current) => ({
            ...current,
            status: 'failed',
            message: data.message || 'Terminal payment failed.',
          }));
          setIsCheckingOut(false);
        }
      } catch (error) {
        if (effectCancelled || terminalPollCancelledRef.current) return;
        setTerminalPayment((current) => ({
          ...current,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unable to check terminal payment.',
        }));
        setIsCheckingOut(false);
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, 2500);
    void poll();

    return () => {
      effectCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [terminalPayment.open, terminalPayment.orderId, terminalPayment.status, terminalPayment.successUrl]);

  useEffect(() => {
    if (!terminalPayment.open || terminalPayment.status !== 'waiting') {
      setTerminalCancelUnlocked(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setTerminalCancelUnlocked(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [terminalPayment.open, terminalPayment.status]);

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
          otdMode,
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
      const data = (await response.json()) as { url?: string; orderNumber?: string; message?: string };

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
        {isAssociateMode && stripeSandbox && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              color: 'warning.dark',
              bgcolor: 'warning.light',
              px: 2,
              py: 0.5,
              borderRadius: 1,
              letterSpacing: 2,
              flexShrink: 0,
            }}
          >
            SANDBOX
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
              onClick={() => {
                if (isAssociateMode) {
                  openAssociateStripeRoute('checkout');
                  return;
                }
                openRefundPolicyDialog();
              }}
              sx={{
                whiteSpace: 'nowrap',
                px: { xs: 3, sm: 6 },
              }}
            >
              Checkout
            </Button>
            {isAssociateMode && (
              <>
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
                <Button
                  color="neutral"
                  variant="outlined"
                  disabled={selectedCartItems.length === 0}
                  onClick={openSplitTenderDialog}
                  sx={{
                    whiteSpace: 'nowrap',
                    px: { xs: 3, sm: 4 },
                  }}
                >
                  Checkout Card + Cash
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
    <Dialog
      open={refundPolicyOpen}
      onClose={() => !isCheckingOut && setRefundPolicyOpen(false)}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Refund policy acknowledgement</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack direction="column" sx={{ gap: 2 }}>
          <Typography variant="body1">
            Eligible items may be refunded within 7 days of product pickup.
          </Typography>
          <Typography variant="body1">
            Online checkout is available by card and other standard Stripe payment methods. Financing is available only for eligible in-store purchases.
          </Typography>
          <Typography variant="body1">
            Returned items must come back in the same condition. Shipping and local delivery charges are not refundable, and customers are responsible for insured return shipping unless we made a mistake with the order.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          color="neutral"
          variant="soft"
          onClick={() => setRefundPolicyOpen(false)}
          disabled={isCheckingOut}
        >
          Cancel
        </Button>
        <Button variant="contained" onClick={handleRefundPolicyAgree} loading={isCheckingOut}>
          Agree & Proceed
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog
      open={splitTenderOpen}
      onClose={() => !isCheckingOut && setSplitTenderOpen(false)}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Card Amount?</DialogTitle>
      <Box component="form" onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmitSplitTender) return;
        setSplitTenderOpen(false);
        openAssociateStripeRoute('split');
      }}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack direction="column" sx={{ gap: 2 }}>
            <TextField
              autoFocus
              required
              fullWidth
              label="Card Amount"
              value={splitCardAmount}
              error={!!splitCardAmountError}
              helperText={splitCardAmountError || `${currencyFormat(splitCashAmountCents / 100)} must be collected via cash.`}
              onChange={(event) => setSplitCardAmount(event.target.value)}
              onBlur={() => setSplitCardAmount(formatCurrencyInput(splitCardAmountCents))}
              disabled={isCheckingOut}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputMode: 'decimal',
                },
              }}
            />
            <TextField
              fullWidth
              label="Cash Amount"
              value={currencyFormat(splitCashAmountCents / 100)}
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            variant="soft"
            onClick={() => setSplitTenderOpen(false)}
            disabled={isCheckingOut}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={isCheckingOut} disabled={!canSubmitSplitTender}>
            Submit
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
    <Dialog
      open={paymentRouteOpen}
      onClose={() => !isCheckingOut && setPaymentRouteOpen(false)}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Choose card checkout</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1">
          Send the card payment to the WisePOS E terminal or continue with Stripe hosted checkout.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="neutral"
          variant="soft"
          onClick={() => setPaymentRouteOpen(false)}
          disabled={isCheckingOut}
        >
          Cancel
        </Button>
        <Button
          color="neutral"
          variant="outlined"
          onClick={handleAssociateWebCheckout}
          loading={isCheckingOut}
        >
          Web
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setPaymentRouteOpen(false);
            setTerminalCustomerErrors({});
            setTerminalCustomerOpen(true);
          }}
          loading={isCheckingOut}
        >
          Terminal
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog
      open={terminalPayment.open}
      onClose={() => {
        if (terminalPayment.status !== 'waiting' && terminalPayment.status !== 'cancelling' && !isCancelingTerminalPayment) {
          setTerminalPayment(defaultTerminalPaymentState);
        }
      }}
      disableEscapeKeyDown={terminalPayment.status === 'waiting' || terminalPayment.status === 'cancelling'}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>
        {terminalPayment.status === 'failed' ? 'Terminal payment failed'
          : terminalPayment.status === 'cancelling' ? 'Cancelling terminal payment…'
          : 'Waiting for terminal payment'}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack direction="column" sx={{ gap: 1 }}>
          {terminalPayment.orderNumber && (
            <Typography variant="subtitle2">{terminalPayment.orderNumber}</Typography>
          )}
          <Typography variant="body1">{terminalPayment.message}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        {terminalPayment.status === 'waiting' ? (
          <Button
            color="neutral"
            variant="soft"
            onClick={handleTerminalCancel}
            disabled={!terminalCancelUnlocked}
          >
            Cancel terminal payment
          </Button>
        ) : terminalPayment.status === 'cancelling' ? (
          <Button color="neutral" variant="soft" loading disabled>
            Cancelling…
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => setTerminalPayment(defaultTerminalPaymentState)}
          >
            OK
          </Button>
        )}
      </DialogActions>
    </Dialog>
    <Dialog open={terminalCustomerOpen} onClose={() => !isCheckingOut && setTerminalCustomerOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Customer info</DialogTitle>
      <Box component="form" onSubmit={(event) => {
        event.preventDefault();
        const errors = validateCashCustomerForm(terminalCustomer);
        setTerminalCustomerErrors(errors);
        if (Object.keys(errors).length > 0) return;
        void handleTerminalCheckout(terminalCustomer);
      }}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack direction="column" sx={{ gap: 2 }}>
            <TextField
              autoFocus
              required
              fullWidth
              label="First name"
              value={terminalCustomer.firstName}
              error={!!terminalCustomerErrors.firstName}
              helperText={terminalCustomerErrors.firstName}
              onChange={(event) => setTerminalCustomerField('firstName', event.target.value)}
              disabled={isCheckingOut}
            />
            <TextField
              required
              fullWidth
              label="Last name"
              value={terminalCustomer.lastName}
              error={!!terminalCustomerErrors.lastName}
              helperText={terminalCustomerErrors.lastName}
              onChange={(event) => setTerminalCustomerField('lastName', event.target.value)}
              disabled={isCheckingOut}
            />
            <TextField
              required
              fullWidth
              type="email"
              label="Email"
              value={terminalCustomer.email}
              error={!!terminalCustomerErrors.email}
              helperText={terminalCustomerErrors.email}
              onChange={(event) => setTerminalCustomerField('email', event.target.value)}
              disabled={isCheckingOut}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            variant="soft"
            onClick={() => setTerminalCustomerOpen(false)}
            disabled={isCheckingOut}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={isCheckingOut}>
            Charge terminal
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
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
