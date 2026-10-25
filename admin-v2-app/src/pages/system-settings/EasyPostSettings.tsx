import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Divider, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';

// EasyPost (shipping labels): test/production toggle, whether each API key is set up
// (the keys themselves are Worker secrets, never shown here), and the ship-from address.

type ShipFrom = {
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

type EasyPostConfigResponse = {
  useTest?: boolean;
  testKeyConfigured?: boolean;
  prodKeyConfigured?: boolean;
  shipFrom?: ShipFrom;
  message?: string;
};

const EMPTY_SHIP_FROM: ShipFrom = { name: '', company: '', street1: '', street2: '', city: '', state: '', zip: '', phone: '' };

export default function EasyPostSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [useTest, setUseTest] = useState(true);
  const [testKeyConfigured, setTestKeyConfigured] = useState(false);
  const [prodKeyConfigured, setProdKeyConfigured] = useState(false);
  const [shipFrom, setShipFrom] = useState<ShipFrom>(EMPTY_SHIP_FROM);
  const [error, setError] = useState('');

  const applyConfig = (data: EasyPostConfigResponse) => {
    setUseTest(data.useTest ?? true);
    setTestKeyConfigured(Boolean(data.testKeyConfigured));
    setProdKeyConfigured(Boolean(data.prodKeyConfigured));
    setShipFrom({ ...EMPTY_SHIP_FROM, ...(data.shipFrom ?? {}) });
  };

  useEffect(() => {
    fetch('/api/admin-v2/easypost-config', { credentials: 'same-origin' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as EasyPostConfigResponse;
        if (!response.ok) throw new Error(data.message || 'Unable to load EasyPost settings.');
        applyConfig(data);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load EasyPost settings.'))
      .finally(() => setIsLoading(false));
  }, []);

  const save = async (body: Record<string, unknown>, successMessage: string) => {
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin-v2/easypost-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as EasyPostConfigResponse;
      if (!response.ok) throw new Error(data.message || 'Unable to save EasyPost settings.');
      applyConfig(data);
      enqueueSnackbar(successMessage, { variant: 'success' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save EasyPost settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const field = (key: keyof ShipFrom, label: string, size: number) => (
    <Grid size={{ xs: 12, sm: size }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={shipFrom[key]}
        disabled={isLoading || isSaving}
        onChange={(event) => setShipFrom((current) => ({ ...current, [key]: event.target.value }))}
      />
    </Grid>
  );

  const keyChip = (label: string, configured: boolean) => (
    <Chip size="small" variant="soft" color={configured ? 'success' : 'warning'} label={`${label} key ${configured ? 'set up' : 'missing'}`} />
  );

  return (
    <Stack direction="column" sx={{ gap: 2 }}>
      <Divider />
      <Typography variant="h6">EasyPost (shipping labels)</Typography>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              checked={useTest}
              disabled={isLoading || isSaving}
              onChange={(event) => void save({ useTest: event.target.checked }, 'EasyPost mode updated.')}
            />
          }
          label={useTest ? 'EasyPost test' : 'EasyPost production'}
        />
        {keyChip('Test', testKeyConfigured)}
        {keyChip('Production', prodKeyConfigured)}
      </Stack>
      {!isLoading && (!testKeyConfigured || !prodKeyConfigured) ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          API keys are Worker secrets: run <code>npx wrangler secret put EASYPOST_API_KEY_TEST</code> and{' '}
          <code>EASYPOST_API_KEY_PROD</code> in <code>workers/listing-evaluator</code>.
        </Typography>
      ) : null}

      <Typography variant="subtitle2" sx={{ mt: 1 }}>Ship-from address</Typography>
      <Grid container spacing={2}>
        {field('name', 'Name', 6)}
        {field('company', 'Company', 6)}
        {field('street1', 'Street', 8)}
        {field('street2', 'Suite / unit', 4)}
        {field('city', 'City', 5)}
        {field('state', 'State', 3)}
        {field('zip', 'ZIP', 4)}
        {field('phone', 'Phone (required by UPS / FedEx)', 6)}
      </Grid>
      <Button
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
        disabled={isLoading || isSaving}
        onClick={() => void save({ shipFrom }, 'Ship-from address saved.')}
      >
        Save ship-from address
      </Button>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
