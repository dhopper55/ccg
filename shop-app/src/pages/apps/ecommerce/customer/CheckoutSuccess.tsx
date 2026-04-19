import { useEffect } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { useEcommerce } from 'providers/EcommerceProvider';
import paths from 'routes/paths';

const CheckoutSuccess = () => {
  const { setCartItems } = useEcommerce();

  useEffect(() => {
    setCartItems([]);
  }, [setCartItems]);

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
          We are confirming your payment with Stripe. Pickup is at our Englewood shop.
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Bring your receipt when you come in. Call or text (303) 376-9214 with any pickup
          questions.
        </Typography>
        <Button variant="contained" href={paths.products}>
          Back to shop
        </Button>
      </Stack>
    </Paper>
  );
};

export default CheckoutSuccess;
