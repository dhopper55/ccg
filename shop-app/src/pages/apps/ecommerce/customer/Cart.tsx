import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Box, Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useEcommerce } from 'providers/EcommerceProvider';
import paths from 'routes/paths';
import CartBottomBar from 'components/sections/ecommerce/customer/cart/CartBottomBar';
import CartMain from 'components/sections/ecommerce/customer/cart/CartMain';
import PageHeader from 'components/sections/ecommerce/customer/common/PageHeader';
import PaymentSummary from 'components/sections/ecommerce/customer/common/PaymentSummary';

const Cart = () => {
  const { cartItems } = useEcommerce();
  const navigate = useNavigate();

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate(paths.products, { replace: true });
    }
  }, [cartItems.length, navigate]);

  if (cartItems.length === 0) return null;

  return (
    <Grid container>
      <Grid size={12}>
        <PageHeader
          title="Cart"
          breadcrumb={[
            { label: 'Home', url: paths.ecommerceHomepage },
            { label: 'Cart', active: true },
          ]}
        />
      </Grid>
      <Grid
        size={{
          xs: 12,
          md: 8,
          xl: 9,
        }}
      >
        <CartMain />
      </Grid>
      <Grid
        size={{
          xs: 12,
          md: 4,
          xl: 3,
        }}
      >
        <Paper background={1} sx={{ height: 1 }}>
          <Box
            sx={(theme) => ({
              position: 'sticky',
              top: theme.mixins.ecommerceTopbar,
              p: { xs: 3, md: 5 },
            })}
          >
            <PaymentSummary />
          </Box>
        </Paper>
      </Grid>
      <Grid sx={{ position: 'sticky', zIndex: 999, width: 1, bottom: 0 }} size={12}>
        <CartBottomBar />
      </Grid>
    </Grid>
  );
};

export default Cart;
