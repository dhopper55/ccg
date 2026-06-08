import { useEffect, useState } from 'react';
import { Box, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import IconifyIcon from 'components/base/IconifyIcon';

interface PaymentFormProps {
  onSuccess: () => void;
}

const PaymentForm = ({ onSuccess }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;

    setPaying(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
      setPaying(false);
    } else {
      onSuccess();
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      <Box sx={{ mt: 2 }}>
        <button
          type="button"
          disabled={!stripe || paying}
          onClick={() => void handlePay()}
          style={{
            width: '100%',
            padding: '12px',
            background: paying ? '#9ca3af' : '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '1rem',
            fontWeight: 600,
            cursor: paying ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {paying && <CircularProgress size={16} sx={{ color: '#fff' }} />}
          {paying ? 'Processing…' : 'Pay $2.99'}
        </button>
      </Box>
    </Box>
  );
};

const ConfirmationBubble = () => (
  <Stack direction="column" alignItems="center" spacing={2} sx={{ py: 4, textAlign: 'center' }}>
    <IconifyIcon
      icon="material-symbols:check-circle-rounded"
      sx={{ fontSize: 64, color: 'success.main' }}
    />
    <Typography variant="h5" fontWeight={700}>
      We've received your request!
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
      Your guitar evaluation report is being prepared. You'll receive it in less than 24 hours.
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mt: 1 }}>
      If you have any questions in the meantime, feel free to contact us at{' '}
      <Box
        component="a"
        href="https://www.coalcreekguitars.com/contact-us"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: 'primary.main' }}
      >
        Coal Creek Guitars
      </Box>
      .
    </Typography>
  </Stack>
);

const ConfirmationForm = ({ evaluationId }: { evaluationId: number | null; label?: string }) => {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    // Returning from a Stripe redirect (e.g. Cash App Pay): resolve via URL params.
    const params = new URLSearchParams(window.location.search);
    const redirectStatus = params.get('redirect_status');
    if (redirectStatus === 'succeeded' || redirectStatus === 'processing') {
      setPaid(true);
      return;
    }
    if (redirectStatus) {
      setLoadError('Payment was not completed. Please try again.');
      return;
    }

    if (!evaluationId) return;

    const init = async () => {
      try {
        const res = await fetch('/api/guitar-evaluation/payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evaluationId }),
        });
        if (!res.ok) {
          const err: any = await res.json().catch(() => ({}));
          throw new Error(err?.message ?? 'Failed to initialize payment.');
        }
        const data: { clientSecret: string; publishableKey: string } = await res.json();
        setStripePromise(loadStripe(data.publishableKey));
        setClientSecret(data.clientSecret);
      } catch (e: any) {
        setLoadError(e?.message ?? 'Unable to load payment. Please refresh and try again.');
      }
    };

    void init();
  }, [evaluationId]);

  return (
    <div>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Comprehensive Report Payment ($2.99)
        </Typography>
        <Typography variant="body2" fontStyle="italic" color="text.secondary">
          one-time charge — report ready in under 24 hours or it's free
        </Typography>
        <Divider sx={{ mt: 2 }} />
      </Box>

      {!paid && (
        <>
          {loadError && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {loadError}
            </Typography>
          )}

          {!clientSecret && !loadError && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={32} />
            </Stack>
          )}

          {stripePromise && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: { theme: 'night' },
              }}
            >
              <PaymentForm onSuccess={() => setPaid(true)} />
            </Elements>
          )}
        </>
      )}

      {paid && <ConfirmationBubble />}
    </div>
  );
};

export default ConfirmationForm;
