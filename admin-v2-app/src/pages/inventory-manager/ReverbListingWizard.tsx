import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';

type ShippingMethod = 'calculated' | 'free' | 'flat';

type ReverbListingWizardProps = {
  open: boolean;
  itemId: string;
  onClose: () => void;
  onListed: (warning?: string | null) => void;
};

function toPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const ReverbListingWizard = ({ open, itemId, onClose, onListed }: ReverbListingWizardProps) => {
  const [soldAsDescribed, setSoldAsDescribed] = useState(false);
  const [dropPriceIn2Weeks, setDropPriceIn2Weeks] = useState<boolean | null>(null);
  const [allowOffers, setAllowOffers] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('calculated');
  const [flatRateAmount, setFlatRateAmount] = useState('');
  const [packageWidthIn, setPackageWidthIn] = useState('');
  const [packageHeightIn, setPackageHeightIn] = useState('');
  const [packageLengthIn, setPackageLengthIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [weightOz, setWeightOz] = useState('');
  const [safeShipping, setSafeShipping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSoldAsDescribed(false);
    setDropPriceIn2Weeks(null);
    setAllowOffers(true);
    setShippingMethod('calculated');
    setFlatRateAmount('');
    setPackageWidthIn('');
    setPackageHeightIn('');
    setPackageLengthIn('');
    setWeightLbs('');
    setWeightOz('');
    setSafeShipping(false);
    setIsSubmitting(false);
    setErrorMessage(null);
  }, [open]);

  const width = toPositiveInt(packageWidthIn);
  const height = toPositiveInt(packageHeightIn);
  const length = toPositiveInt(packageLengthIn);
  const lbs = weightLbs.trim() ? Number.parseInt(weightLbs, 10) : 0;
  const oz = weightOz.trim() ? Number.parseInt(weightOz, 10) : 0;
  const hasWeight = (Number.isFinite(lbs) && lbs > 0) || (Number.isFinite(oz) && oz > 0);
  const flatAmount = shippingMethod === 'flat' ? toPositiveInt(flatRateAmount) : null;

  const isValid = dropPriceIn2Weeks !== null
    && width != null
    && height != null
    && length != null
    && hasWeight
    && (shippingMethod !== 'flat' || flatAmount != null);

  const handleList = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/inventory/${encodeURIComponent(itemId)}/reverb-add`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          soldAsDescribed,
          dropPriceIn2Weeks,
          allowOffers,
          shippingMethod,
          flatRateAmount: flatAmount,
          packageWidthIn: width,
          packageHeightIn: height,
          packageLengthIn: length,
          weightLbs: Number.isFinite(lbs) ? lbs : 0,
          weightOz: Number.isFinite(oz) ? oz : 0,
          safeShipping,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; warning?: string | null };
      if (!response.ok) {
        throw new Error(data.message || 'Unable to list on Reverb.');
      }
      onListed(data.warning || null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to list on Reverb.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>List on Reverb</DialogTitle>
      <DialogContent dividers>
        <Stack direction="column" spacing={2.5}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Title, description, video link, price, and photos are pulled from this item automatically.
            Just answer what's below.
          </Typography>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <FormControlLabel
            control={<Checkbox checked={soldAsDescribed} onChange={(event) => setSoldAsDescribed(event.target.checked)} />}
            label="Sold As Described"
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Drop price in 2 weeks?</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={dropPriceIn2Weeks === null ? null : String(dropPriceIn2Weeks)}
              onChange={(_event, value) => {
                if (value === null) return;
                setDropPriceIn2Weeks(value === 'true');
              }}
            >
              <ToggleButton value="true">Yes</ToggleButton>
              <ToggleButton value="false">No</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <FormControlLabel
            control={<Checkbox checked={allowOffers} onChange={(event) => setAllowOffers(event.target.checked)} />}
            label="Allow offers"
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Shipping</Typography>
            <RadioGroup
              row
              value={shippingMethod}
              onChange={(event) => setShippingMethod(event.target.value as ShippingMethod)}
            >
              <FormControlLabel value="calculated" control={<Radio size="small" />} label="Reverb calc" />
              <FormControlLabel value="free" control={<Radio size="small" />} label="Free" />
              <FormControlLabel value="flat" control={<Radio size="small" />} label="Flat rate" />
            </RadioGroup>
            {shippingMethod === 'flat' ? (
              <TextField
                label="Flat rate amount ($)"
                type="number"
                size="small"
                value={flatRateAmount}
                onChange={(event) => setFlatRateAmount(event.target.value)}
                inputProps={{ min: 1, step: 1 }}
                sx={{ mt: 1, width: 200 }}
              />
            ) : null}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Package</Typography>
            <Grid container spacing={1.5}>
              <Grid size={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Width (in)"
                  type="number"
                  value={packageWidthIn}
                  onChange={(event) => setPackageWidthIn(event.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Height (in)"
                  type="number"
                  value={packageHeightIn}
                  onChange={(event) => setPackageHeightIn(event.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Length (in)"
                  type="number"
                  value={packageLengthIn}
                  onChange={(event) => setPackageLengthIn(event.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Weight - lbs"
                  type="number"
                  value={weightLbs}
                  onChange={(event) => setWeightLbs(event.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Weight - oz"
                  type="number"
                  value={weightOz}
                  onChange={(event) => setWeightOz(event.target.value)}
                  inputProps={{ min: 0, max: 15, step: 1 }}
                />
              </Grid>
            </Grid>
          </Box>

          <FormControlLabel
            control={<Checkbox checked={safeShipping} onChange={(event) => setSafeShipping(event.target.checked)} />}
            label="Reverb Safe Shipping"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleList}
          disabled={!isValid || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress color="inherit" size={16} /> : null}
        >
          {isSubmitting ? 'Listing...' : 'List'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReverbListingWizard;
