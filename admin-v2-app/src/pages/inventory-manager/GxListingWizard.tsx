import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
  Typography,
} from '@mui/material';

type GxListingWizardProps = {
  open: boolean;
  itemId: string;
  quantity: number;
  onClose: () => void;
  onListed: (message: string) => void;
};

type GxCategory = { id: number; path: string };
type GxCondition = { id: number; name: string; description: string };

type GxPreview = {
  missing: string[];
  problems: string[];
  category: { id: number | null; path: string | null; source: 'explicit' | 'ccg_default' | 'guess' | null };
  conditionId: number | null;
  payload: {
    price?: number;
    shippingAllowed?: boolean;
    shippingCost?: number;
  };
  reference: { conditions: GxCondition[] };
};

// GX's cash payout ("Hyperwallet") is fee-based; the gift card has no fee. Matches the backend's
// estimate (orders/manual.ts GX_CASH_PAYOUT_FEE_RATE) until a real payout confirms the rate.
const GX_CASH_PAYOUT_FEE_RATE = 0.075;
const SALE_PERCENTAGES = [5, 10, 15, 20, 25, 30];
const RETURN_POLICIES = [
  { value: 0, label: 'No returns' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 21, label: '21 days' },
  { value: 30, label: '30 days' },
];

const CATEGORY_SOURCE_LABEL: Record<string, string> = {
  ccg_default: 'saved default for this CCG category',
  guess: 'best guess — check it',
  explicit: 'chosen',
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function toAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// Left-handed only means something for stringed instruments.
function isStringedCategory(path: string): boolean {
  return /^(Guitars|Bass|Folk Instruments)\b/.test(path) && !/Accessories|Parts|Pickups|Cases/.test(path);
}

const GxListingWizard = ({ open, itemId, quantity, onClose, onListed }: GxListingWizardProps) => {
  const [preview, setPreview] = useState<GxPreview | null>(null);
  const [categories, setCategories] = useState<GxCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conditionId, setConditionId] = useState<number | ''>('');
  const [category, setCategory] = useState<GxCategory | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<'hyperwallet' | 'store_credit'>('hyperwallet');
  const [acceptsOffers, setAcceptsOffers] = useState(true);
  const [minOffer, setMinOffer] = useState('');
  const [optedInToSales, setOptedInToSales] = useState(false);
  const [salePercentage, setSalePercentage] = useState(10);
  const [leftHanded, setLeftHanded] = useState(false);
  const [shippingAllowed, setShippingAllowed] = useState(true);
  const [shippingCost, setShippingCost] = useState('');
  const [localPickupAllowed, setLocalPickupAllowed] = useState(true);
  const [returnPolicyDays, setReturnPolicyDays] = useState(7);
  const [autoRelist, setAutoRelist] = useState(false);
  const [publish, setPublish] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setErrorMessage(null);
    setIsSubmitting(false);
    setPayoutMethod('hyperwallet');
    setAcceptsOffers(true);
    setMinOffer('');
    setOptedInToSales(false);
    setSalePercentage(10);
    setLeftHanded(false);
    setLocalPickupAllowed(true);
    setReturnPolicyDays(7);
    setAutoRelist(quantity > 1);
    setPublish(false);

    setIsLoading(true);
    Promise.all([
      fetch(`/api/inventory/${encodeURIComponent(itemId)}/gx-preview`, { credentials: 'same-origin' })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error((data as { message?: string }).message || 'Unable to load the Gear Exchange preview.');
          return data as GxPreview;
        }),
      fetch('/api/admin-v2/gx/reference', { credentials: 'same-origin' })
        .then((response) => response.json())
        .then((data: { categories?: GxCategory[] }) => (Array.isArray(data.categories) ? data.categories : [])),
    ])
      .then(([nextPreview, nextCategories]) => {
        const sorted = [...nextCategories].sort((a, b) => a.path.localeCompare(b.path));
        setPreview(nextPreview);
        setCategories(sorted);
        setConditionId(nextPreview.conditionId ?? '');
        setCategory(sorted.find((entry) => entry.id === nextPreview.category.id) ?? null);
        setShippingAllowed(nextPreview.payload.shippingAllowed !== false);
        setShippingCost(nextPreview.payload.shippingCost != null ? String(nextPreview.payload.shippingCost) : '0');
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load the Gear Exchange preview.'))
      .finally(() => setIsLoading(false));
  }, [open, itemId, quantity]);

  const price = Number(preview?.payload.price || 0);
  const shippingAmount = shippingAllowed ? (toAmount(shippingCost) ?? 0) : 0;
  const buyerPays = price + shippingAmount;
  const cashNet = buyerPays * (1 - GX_CASH_PAYOUT_FEE_RATE);

  const missing = preview?.missing.filter((entry) => !/condition|category/i.test(entry)) ?? [];
  const problems = preview?.problems ?? [];
  const minOfferAmount = acceptsOffers ? toAmount(minOffer) : null;

  const validationError = useMemo(() => {
    if (!conditionId) return 'Choose a condition.';
    if (!category) return 'Choose a Gear Exchange category.';
    if (!shippingAllowed && !localPickupAllowed) return 'Allow shipping, local pickup, or both.';
    if (shippingAllowed && toAmount(shippingCost) == null) return 'Enter a shipping cost ($0 for free shipping).';
    if (minOfferAmount != null && price && minOfferAmount >= price) return 'Minimum offer must be below the price.';
    return null;
  }, [conditionId, category, shippingAllowed, localPickupAllowed, shippingCost, minOfferAmount, price]);

  const canSubmit = Boolean(preview) && !validationError && missing.length === 0 && problems.length === 0 && !isSubmitting;

  const handleList = async () => {
    if (!canSubmit || !category) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/inventory/${encodeURIComponent(itemId)}/gx-add`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          conditionId,
          categoryId: category.id,
          saveCategoryDefault: true,
          payoutMethod,
          acceptsOffers,
          minOffer: minOfferAmount,
          optedInToSales,
          optedInToSalesPercentage: salePercentage,
          leftHanded,
          shippingAllowed,
          shippingCost: shippingAllowed ? toAmount(shippingCost) : null,
          localPickupAllowed,
          returnPolicyDays,
          autoRelist,
          publish,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; gxListingId?: number };
      if (!response.ok) throw new Error(data.message || 'Unable to list on Gear Exchange.');
      onListed(publish
        ? `Listed on Gear Exchange (listing ${data.gxListingId}). It goes live once GX finishes the photos.`
        : `Added to Gear Exchange as a draft (listing ${data.gxListingId}). Publish it once the photos are in.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to list on Gear Exchange.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>List on Gear Exchange</DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 3, justifyContent: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Checking the item against Gear Exchange...</Typography>
          </Stack>
        ) : (
          <Stack direction="column" spacing={2.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Title, brand, description, price, year, video, and public photos come from this item.
              {quantity > 1 ? ` GX listings are one unit each; this item has ${quantity}.` : ''}
            </Typography>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {missing.length ? <Alert severity="warning">Fill these in on the item first: {missing.join(', ')}.</Alert> : null}
            {problems.map((problem) => <Alert key={problem} severity="warning">{problem}</Alert>)}

            {preview ? (
              <>
                <TextField
                  select
                  fullWidth
                  label="Condition"
                  value={conditionId}
                  onChange={(event) => setConditionId(Number(event.target.value))}
                  helperText={preview.reference.conditions.find((entry) => entry.id === conditionId)?.description}
                >
                  {preview.reference.conditions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
                  ))}
                </TextField>

                <Autocomplete
                  options={categories}
                  value={category}
                  onChange={(_event, value) => setCategory(value)}
                  getOptionLabel={(option) => option.path.replace(/ >> /g, ' › ')}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Gear Exchange category"
                      helperText={category && category.id === preview.category.id && preview.category.source
                        ? `From the ${CATEGORY_SOURCE_LABEL[preview.category.source] ?? preview.category.source}. Saved as the default for this CCG category.`
                        : 'Saved as the default for this CCG category.'}
                    />
                  )}
                />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Payout</Typography>
                  <RadioGroup value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as typeof payoutMethod)}>
                    <FormControlLabel
                      value="hyperwallet"
                      control={<Radio size="small" />}
                      label={`Cash (Hyperwallet, ~${(GX_CASH_PAYOUT_FEE_RATE * 100).toFixed(1)}% fee) — ~${money.format(cashNet)}`}
                    />
                    <FormControlLabel
                      value="store_credit"
                      control={<Radio size="small" />}
                      label={`Sweetwater gift card (no fee) — ${money.format(buyerPays)}`}
                    />
                  </RadioGroup>
                </Box>

                <Box>
                  <FormControlLabel
                    control={<Checkbox checked={acceptsOffers} onChange={(event) => setAcceptsOffers(event.target.checked)} />}
                    label="Allow offers"
                  />
                  {acceptsOffers ? (
                    <TextField
                      label="Minimum offer ($, optional)"
                      size="small"
                      type="number"
                      value={minOffer}
                      onChange={(event) => setMinOffer(event.target.value)}
                      helperText="Offers below this are declined automatically."
                      sx={{ mt: 1, width: 260 }}
                    />
                  ) : null}
                </Box>

                <Box>
                  <FormControlLabel
                    control={<Checkbox checked={optedInToSales} onChange={(event) => setOptedInToSales(event.target.checked)} />}
                    label="Include in Gear Exchange sale events"
                  />
                  {optedInToSales ? (
                    <TextField
                      select
                      size="small"
                      label="Max sale discount"
                      value={salePercentage}
                      onChange={(event) => setSalePercentage(Number(event.target.value))}
                      sx={{ mt: 1, width: 200 }}
                    >
                      {SALE_PERCENTAGES.map((percent) => <MenuItem key={percent} value={percent}>{percent}%</MenuItem>)}
                    </TextField>
                  ) : null}
                </Box>

                {category && isStringedCategory(category.path) ? (
                  <FormControlLabel
                    control={<Checkbox checked={leftHanded} onChange={(event) => setLeftHanded(event.target.checked)} />}
                    label="Left-handed"
                  />
                ) : null}

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Delivery</Typography>
                  <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControlLabel
                      control={<Checkbox checked={shippingAllowed} onChange={(event) => setShippingAllowed(event.target.checked)} />}
                      label="Shipping"
                    />
                    {shippingAllowed ? (
                      <TextField
                        label="Flat shipping ($)"
                        size="small"
                        type="number"
                        value={shippingCost}
                        onChange={(event) => setShippingCost(event.target.value)}
                        sx={{ width: 160 }}
                      />
                    ) : null}
                    <FormControlLabel
                      control={<Checkbox checked={localPickupAllowed} onChange={(event) => setLocalPickupAllowed(event.target.checked)} />}
                      label="Local pickup"
                    />
                  </Stack>
                  {shippingAllowed ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      GX charges one flat rate everywhere it ships, including Hawaii, Alaska, and US territories.
                    </Typography>
                  ) : null}
                </Box>

                <TextField
                  select
                  label="Return policy"
                  size="small"
                  value={returnPolicyDays}
                  onChange={(event) => setReturnPolicyDays(Number(event.target.value))}
                  sx={{ width: 200 }}
                >
                  {RETURN_POLICIES.map((policy) => <MenuItem key={policy.value} value={policy.value}>{policy.label}</MenuItem>)}
                </TextField>

                {quantity > 1 ? (
                  <FormControlLabel
                    control={<Checkbox checked={autoRelist} onChange={(event) => setAutoRelist(event.target.checked)} />}
                    label="Relist automatically after each sale while units remain"
                  />
                ) : null}

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>When it's created</Typography>
                  <RadioGroup row value={publish ? 'publish' : 'draft'} onChange={(event) => setPublish(event.target.value === 'publish')}>
                    <FormControlLabel value="draft" control={<Radio size="small" />} label="Save as draft" />
                    <FormControlLabel value="publish" control={<Radio size="small" />} label="Publish once photos are in" />
                  </RadioGroup>
                </Box>
              </>
            ) : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {validationError && preview ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 'auto', pl: 1 }}>{validationError}</Typography>
        ) : null}
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleList}
          disabled={!canSubmit}
          startIcon={isSubmitting ? <CircularProgress color="inherit" size={16} /> : null}
        >
          {isSubmitting ? 'Listing...' : 'List'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GxListingWizard;
