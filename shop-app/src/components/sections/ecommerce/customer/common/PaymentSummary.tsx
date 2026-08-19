import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ecomCoupons } from 'data/e-commerce/products';
import useNumberFormat from 'hooks/useNumberFormat';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import { useSnackbar } from 'notistack';
import { useEcommerce } from 'providers/EcommerceProvider';
import IconifyIcon from 'components/base/IconifyIcon';

const PaymentSummary = () => {
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState(false);
  const [taxOptionsOpen, setTaxOptionsOpen] = useState(false);
  const { isAssociateMode } = useAssociateMode();
  const {
    appliedCoupon,
    setAppliedCoupon,
    cartSubTotal,
    cartTax,
    cartTaxRate,
    cartShipping,
    cartShippingLabel,
    cartHasLocalPickupOnlyItems,
    cartTotal,
    setTaxIncluded,
    otdMode,
    setOtdMode,
    otdEligible,
  } = useEcommerce();
  const { enqueueSnackbar } = useSnackbar();
  const { currencyFormat } = useNumberFormat();
  const taxRateLabel = `${(cartTaxRate * 100).toFixed(2)}%`;

  const applyCouponCode = () => {
    const validCoupon = ecomCoupons.find(({ code }) => code === coupon);
    if (validCoupon) {
      setAppliedCoupon(validCoupon);
      setCouponError(false);
      enqueueSnackbar(`${validCoupon.code} is applied!`, { variant: 'success' });
    } else {
      setAppliedCoupon(null);
      setCouponError(true);
    }
  };

  return (
    <>
      <Box
        sx={{
          mb: 5,
        }}
      >
        <Stack
          component="form"
          direction={{ xs: 'column', sm: 'row', md: 'column' }}
          sx={{
            gap: 1,
            mb: 1,
          }}
        >
          <TextField
            variant="filled"
            fullWidth
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            label="Enter a coupon or a reward code"
          />

          <Button variant="soft" color="neutral" sx={{ minWidth: 200 }} onClick={applyCouponCode}>
            Apply
          </Button>
        </Stack>

        {appliedCoupon && (
          <>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              You have applied coupon <strong>{appliedCoupon?.code}</strong>
            </Typography>
            <br />
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              Which saves you{' '}
              <Box
                component="span"
                sx={{
                  color: 'success.main',
                }}
              >
                {currencyFormat(appliedCoupon?.discount)}
              </Box>
            </Typography>
          </>
        )}
        {couponError && (
          <>
            <Typography
              variant="caption"
              component="p"
              sx={{
                color: 'error.main',
                mb: 1,
              }}
            >
              Uh-oh! Seems like this coupon does not exist.
            </Typography>

            <Typography
              variant="caption"
              component="p"
              sx={{
                color: 'text.secondary',
              }}
            >
              Please check if all the letters and numbers are keyed correctly.
            </Typography>
          </>
        )}
      </Box>
      <div>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
          }}
        >
          Summary
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Stack
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            Subtotal
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            {currencyFormat(cartSubTotal)}
          </Typography>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Stack
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              Tax ({taxRateLabel})
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              State, city, county taxes
            </Typography>
            {isAssociateMode && (
              <Box sx={{ mt: 0.5 }}>
                {!otdMode && (
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => setTaxOptionsOpen(true)}
                    sx={{ mr: 1 }}
                  >
                    options
                  </Link>
                )}
                {otdEligible && !otdMode && (
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => setOtdMode(true)}
                  >
                    OTD
                  </Link>
                )}
                {otdMode && (
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                    <Chip label="OTD" size="small" color="success" variant="soft" />
                    <Link
                      component="button"
                      type="button"
                      variant="caption"
                      onClick={() => setOtdMode(false)}
                    >
                      off
                    </Link>
                  </Stack>
                )}
              </Box>
            )}
          </Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            {currencyFormat(cartTax)} ({taxRateLabel})
          </Typography>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <div>
          <Stack
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              Shipping cost
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: cartShippingLabel === 'FREE' ? 'success.main' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 0.5,
              }}
            >
              {cartShippingLabel === 'FREE' && (
                <IconifyIcon icon="material-symbols:check-circle-rounded" fontSize={18} />
              )}
              {cartShippingLabel === '$6.00' || cartShippingLabel === '$0.00'
                ? currencyFormat(cartShipping)
                : cartShippingLabel}
            </Typography>
          </Stack>

          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {cartShippingLabel === 'IN-STORE' ? (
              <>
                Local pickup in Englewood, CO.
                <br />
                Contact us for dropoff options.
              </>
            ) : (
              <>
                US shipping available.
                <br />
                {cartHasLocalPickupOnlyItems && (
                  <>
                    <Box
                      component="span"
                      sx={{
                        color: 'warning.main',
                        fontWeight: 700,
                      }}
                    >
                      **Some Items in Cart are Local Pickup Only
                    </Box>
                    <br />
                  </>
                )}
                Free shipping on shippable items.
              </>
            )}
          </Typography>
        </div>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ textAlign: 'right' }}>
          <Stack
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
              }}
            >
              Total
            </Typography>
            <Typography variant="h4">{currencyFormat(cartTotal)}</Typography>
          </Stack>

          <Chip
            color="success"
            variant="filled"
            label="Yay! you saved 30% in total"
            sx={{ textAlign: 'right' }}
          />
        </Box>
      </div>
      <Dialog open={taxOptionsOpen} onClose={() => setTaxOptionsOpen(false)}>
        <DialogTitle>Tax Included?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Choose whether this associate checkout should add sales tax separately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            variant="soft"
            onClick={() => {
              setTaxIncluded(false);
              setTaxOptionsOpen(false);
            }}
          >
            No
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setTaxIncluded(true);
              setTaxOptionsOpen(false);
            }}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PaymentSummary;
