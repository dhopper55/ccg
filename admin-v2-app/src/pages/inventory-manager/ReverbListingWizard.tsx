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
  MenuItem,
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
  ccgCondition: string;
  onClose: () => void;
  onListed: (warning?: string | null) => void;
};

function toPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Verbatim from Reverb's /docs/create-listings documentation table (account-independent).
const REVERB_CONDITION_OPTIONS = [
  { uuid: 'fbf35668-96a0-4baa-bcde-ab18d6b1b329', name: 'Non functioning' },
  { uuid: '6a9dfcad-600b-46c8-9e08-ce6e5057921e', name: 'Poor' },
  { uuid: '98777886-76d0-44c8-865e-bb40e669e934', name: 'Fair' },
  { uuid: 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6', name: 'Good' },
  { uuid: 'ae4d9114-1bd7-4ec5-a4ba-6653af5ac84d', name: 'Very Good' },
  { uuid: 'df268ad1-c462-4ba6-b6db-e007e23922ea', name: 'Excellent' },
  { uuid: 'ac5b9c1e-dc78-466d-b0b3-7cf712967a48', name: 'Mint' },
  { uuid: '6db7df88-293b-4017-a1c1-cdb5e599fa1a', name: 'Mint (with inventory)' },
  { uuid: '9225283f-60c2-4413-ad18-1f5eba7a856f', name: 'B-Stock' },
  { uuid: '7c3f45de-2ae0-4c81-8400-fdb6b1d74890', name: 'Brand New' },
];

// Best-guess starting point only — just picks a sensible default; the dropdown always lets the
// user override since CCG's 5 condition values don't line up cleanly with Reverb's 10.
const CCG_CONDITION_TO_REVERB_UUID: Record<string, string> = {
  'New': '7c3f45de-2ae0-4c81-8400-fdb6b1d74890',
  'Used - Like New': 'df268ad1-c462-4ba6-b6db-e007e23922ea',
  'Used - Good': 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6',
  'Used - Fair': '98777886-76d0-44c8-865e-bb40e669e934',
};

const ReverbListingWizard = ({ open, itemId, ccgCondition, onClose, onListed }: ReverbListingWizardProps) => {
  const [conditionUuid, setConditionUuid] = useState('');
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
    setConditionUuid(CCG_CONDITION_TO_REVERB_UUID[ccgCondition.trim()] || '');
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
  }, [open, ccgCondition]);

  const width = toPositiveInt(packageWidthIn);
  const height = toPositiveInt(packageHeightIn);
  const length = toPositiveInt(packageLengthIn);
  const lbs = weightLbs.trim() ? Number.parseInt(weightLbs, 10) : 0;
  const oz = weightOz.trim() ? Number.parseInt(weightOz, 10) : 0;
  const hasWeight = (Number.isFinite(lbs) && lbs > 0) || (Number.isFinite(oz) && oz > 0);
  const flatAmount = shippingMethod === 'flat' ? toPositiveInt(flatRateAmount) : null;

  const isValid = Boolean(conditionUuid)
    && dropPriceIn2Weeks !== null
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
          conditionUuid,
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

          <TextField
            select
            fullWidth
            label="Reverb Condition"
            value={conditionUuid}
            onChange={(event) => setConditionUuid(event.target.value)}
          >
            {REVERB_CONDITION_OPTIONS.map((option) => (
              <MenuItem key={option.uuid} value={option.uuid}>{option.name}</MenuItem>
            ))}
          </TextField>

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
