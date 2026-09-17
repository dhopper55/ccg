import { useMemo } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from '@mui/material';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

const getStripePromise = (publishableKey: string) => {
  if (!stripePromiseCache.has(publishableKey)) {
    stripePromiseCache.set(publishableKey, loadStripe(publishableKey));
  }
  return stripePromiseCache.get(publishableKey)!;
};

interface EmbeddedCheckoutDialogProps {
  open: boolean;
  clientSecret: string | null;
  publishableKey: string | null;
  onClose: () => void;
}

const EmbeddedCheckoutDialog = ({
  open,
  clientSecret,
  publishableKey,
  onClose,
}: EmbeddedCheckoutDialogProps) => {
  const stripePromise = useMemo(
    () => (publishableKey ? getStripePromise(publishableKey) : null),
    [publishableKey],
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="body">
      <DialogTitle>Checkout</DialogTitle>
      <DialogContent sx={{ pt: 1, minHeight: 420 }}>
        {stripePromise && clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="neutral" variant="soft" onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmbeddedCheckoutDialog;
