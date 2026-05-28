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
  IconButton,
  InputAdornment,
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

const parseCurrencyToCents = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, '');
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const formatCurrencyInput = (value: number) => Math.max(0, value).toFixed(2);

const PaymentSummary = () => {
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState(false);
  const [taxOptionsOpen, setTaxOptionsOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState('0.00');
  const { isAssociateMode } = useAssociateMode();
  const {
    appliedCoupon,
    setAppliedCoupon,
    associateDiscount,
    setAssociateDiscount,
    cartSubTotal,
    cartTax,
    cartTaxRate,
    cartShipping,
    cartShippingLabel,
    cartHasLocalPickupOnlyItems,
    cartTotal,
    setTaxIncluded,
  } = useEcommerce();
  const { enqueueSnackbar } = useSnackbar();
  const { currencyFormat } = useNumberFormat();
  const appliedDiscount = associateDiscount > 0 ? associateDiscount : appliedCoupon?.appliedDiscount || 0;
  const discountAmount = parseCurrencyToCents(discountAmountInput) / 100;
  const taxRateLabel = `${(cartTaxRate * 100).toFixed(2)}%`;
  const discountError = discountAmount > cartSubTotal
    ? `Discount cannot exceed ${currencyFormat(cartSubTotal)}.`
    : '';

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

  const openDiscountDialog = () => {
    setDiscountAmountInput(formatCurrencyInput(associateDiscount));
    setDiscountDialogOpen(true);
  };

  const submitAssociateDiscount = () => {
    if (discountError) return;
    const nextDiscount = Math.min(Math.max(0, discountAmount), cartSubTotal);
    setAssociateDiscount(Math.round(nextDiscount * 100) / 100);
    setDiscountDialogOpen(false);
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
              <Box>
                <Link
                  component="button"
                  type="button"
                  variant="caption"
                  onClick={() => setTaxOptionsOpen(true)}
                  sx={{ mt: 0.5 }}
                >
                  options
                </Link>
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
                $6 flat rate under $75, free shipping at $75+.
              </>
            )}
          </Typography>
        </div>

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
            Discount
          </Typography>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              {currencyFormat(appliedDiscount > 0 ? -appliedDiscount : appliedDiscount)}
            </Typography>
            {isAssociateMode && (
              <IconButton
                size="small"
                color="primary"
                aria-label="Edit discount"
                onClick={openDiscountDialog}
              >
                <IconifyIcon icon="material-symbols:edit-outline-rounded" fontSize={18} />
              </IconButton>
            )}
          </Stack>
        </Stack>

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
      <Dialog open={discountDialogOpen} onClose={() => setDiscountDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit discount</DialogTitle>
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          submitAssociateDiscount();
        }}>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Discount amount"
              value={discountAmountInput}
              error={!!discountError}
              helperText={discountError || `Available discount: ${currencyFormat(cartSubTotal)}`}
              onChange={(event) => setDiscountAmountInput(event.target.value)}
              onBlur={() => setDiscountAmountInput(formatCurrencyInput(discountAmount))}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  inputMode: 'decimal',
                },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button color="neutral" variant="soft" onClick={() => setDiscountDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={!!discountError}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
};

export default PaymentSummary;
