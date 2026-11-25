import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';

// Marketplace scout (CCG Agent): finds new Facebook Marketplace listings for the saved searches
// and adds them to the evaluator, where Claude evaluates them. Settings live in the Worker's
// agent_settings (workers/listing-evaluator/src/agent/scout.ts); searches are hard-coded there.

type ScoutSettingsValues = {
  auto: boolean;
  intervalHours: number;
  maxPerScan: number;
  maxPerDay: number;
};

type ScoutSettingsResponse = {
  settings?: ScoutSettingsValues;
  searches?: string[];
  last24h?: number;
  message?: string;
};

export default function ScoutSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [auto, setAuto] = useState(false);
  const [form, setForm] = useState({ intervalHours: '', maxPerScan: '', maxPerDay: '' });
  const [searches, setSearches] = useState<string[]>([]);
  const [last24h, setLast24h] = useState(0);
  const [error, setError] = useState('');

  const apply = (data: ScoutSettingsResponse) => {
    if (data.settings) {
      setAuto(data.settings.auto);
      setForm({
        intervalHours: String(data.settings.intervalHours),
        maxPerScan: String(data.settings.maxPerScan),
        maxPerDay: String(data.settings.maxPerDay),
      });
    }
    if (data.searches) setSearches(data.searches);
    setLast24h(data.last24h ?? 0);
  };

  useEffect(() => {
    fetch('/api/admin-v2/agent/scout-settings', { credentials: 'same-origin' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as ScoutSettingsResponse;
        if (!response.ok)
          throw new Error(data.message || 'Unable to load Marketplace scout settings.');
        apply(data);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load Marketplace scout settings.',
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const save = async (body: Record<string, unknown>, successMessage: string) => {
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin-v2/agent/scout-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as ScoutSettingsResponse;
      if (!response.ok)
        throw new Error(data.message || 'Unable to save Marketplace scout settings.');
      apply(data);
      enqueueSnackbar(successMessage, { variant: 'success' });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save Marketplace scout settings.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const numberField = (key: keyof typeof form, label: string) => (
    <TextField
      size="small"
      type="number"
      label={label}
      value={form[key]}
      disabled={isLoading || isSaving}
      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      sx={{ width: 190 }}
    />
  );

  return (
    <Stack direction="column" sx={{ gap: 2 }}>
      <Divider />
      <Typography variant="h6">Marketplace scout (CCG Agent)</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Searches Facebook Marketplace (local pickup, newest first) and adds new listings to the
        evaluator, where Claude evaluates them. Ads and listings already in CCG are skipped. Run a
        scan any time from Settings → Agent.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={auto}
            disabled={isLoading || isSaving}
            onChange={(event) =>
              void save(
                { auto: event.target.checked },
                event.target.checked ? 'Automatic scans on.' : 'Automatic scans off.',
              )
            }
          />
        }
        label={auto ? 'Automatic scans on' : 'Automatic scans off (manual only)'}
      />
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {numberField('intervalHours', 'Scan every (hours)')}
        {numberField('maxPerScan', 'New listings per scan')}
        {numberField('maxPerDay', 'New listings per 24 hours')}
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Added in the last 24 hours: {last24h}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 0.5 }}>
          Searches:
        </Typography>
        {searches.map((search) => (
          <Chip key={search} size="small" variant="outlined" label={search} />
        ))}
      </Stack>
      <Button
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
        disabled={isLoading || isSaving}
        onClick={() =>
          void save(
            {
              intervalHours: Number(form.intervalHours),
              maxPerScan: Number(form.maxPerScan),
              maxPerDay: Number(form.maxPerDay),
            },
            'Marketplace scout settings saved.',
          )
        }
      >
        Save scout settings
      </Button>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
