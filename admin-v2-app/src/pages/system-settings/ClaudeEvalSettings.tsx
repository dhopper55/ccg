import { useEffect, useState } from 'react';
import { Alert, Button, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';

// Claude eval (CCG Agent): which Claude model the agent's automatic evals use, and how many
// items it may evaluate per run and per 24 hours. Stored by the Worker in agent_settings; the
// model list is hard-coded there (workers/listing-evaluator/src/agent/eval.ts).

type EvalSettings = {
  modelRegular: string;
  modelDeep: string;
  maxPerRun: number;
  maxPerDay: number;
};

type EvalSettingsResponse = {
  settings?: EvalSettings;
  models?: Array<{ id: string; label: string }>;
  last24h?: number;
  timeoutMinutes?: number;
  message?: string;
};

export default function ClaudeEvalSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; label: string }>>([]);
  const [form, setForm] = useState<{
    modelRegular: string;
    modelDeep: string;
    maxPerRun: string;
    maxPerDay: string;
  }>({
    modelRegular: '',
    modelDeep: '',
    maxPerRun: '',
    maxPerDay: '',
  });
  const [last24h, setLast24h] = useState(0);
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [error, setError] = useState('');

  const apply = (data: EvalSettingsResponse) => {
    if (data.models) setModels(data.models);
    if (data.settings) {
      setForm({
        modelRegular: data.settings.modelRegular,
        modelDeep: data.settings.modelDeep,
        maxPerRun: String(data.settings.maxPerRun),
        maxPerDay: String(data.settings.maxPerDay),
      });
    }
    setLast24h(data.last24h ?? 0);
    setTimeoutMinutes(data.timeoutMinutes ?? 30);
  };

  useEffect(() => {
    fetch('/api/admin-v2/agent/eval-settings', { credentials: 'same-origin' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as EvalSettingsResponse;
        if (!response.ok) throw new Error(data.message || 'Unable to load Claude eval settings.');
        apply(data);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load Claude eval settings.',
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const save = async () => {
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin-v2/agent/eval-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          modelRegular: form.modelRegular,
          modelDeep: form.modelDeep,
          maxPerRun: Number(form.maxPerRun),
          maxPerDay: Number(form.maxPerDay),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as EvalSettingsResponse;
      if (!response.ok) throw new Error(data.message || 'Unable to save Claude eval settings.');
      apply(data);
      enqueueSnackbar('Claude eval settings saved.', { variant: 'success' });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Unable to save Claude eval settings.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const modelSelect = (key: 'modelRegular' | 'modelDeep', label: string) => (
    <TextField
      select
      size="small"
      label={label}
      value={models.some((model) => model.id === form[key]) ? form[key] : ''}
      disabled={isLoading || isSaving}
      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      sx={{ minWidth: 220 }}
    >
      {models.map((model) => (
        <MenuItem key={model.id} value={model.id}>
          {model.label}
        </MenuItem>
      ))}
    </TextField>
  );

  const numberField = (key: 'maxPerRun' | 'maxPerDay', label: string) => (
    <TextField
      size="small"
      type="number"
      label={label}
      value={form[key]}
      disabled={isLoading || isSaving}
      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      sx={{ width: 180 }}
    />
  );

  return (
    <Stack direction="column" sx={{ gap: 2 }}>
      <Divider />
      <Typography variant="h6">Claude eval (CCG Agent)</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        The active CCG Agent evaluates items queued with "Queue for Claude" by running Claude Code
        on the Claude subscription. Deep evals run one at a time with the deep model. Each run stops
        after {timeoutMinutes} minutes.
      </Typography>
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {modelSelect('modelRegular', 'Model (regular evals)')}
        {modelSelect('modelDeep', 'Model (deep evals)')}
      </Stack>
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {numberField('maxPerRun', 'Max items per run')}
        {numberField('maxPerDay', 'Max items per 24 hours')}
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Agent evals in the last 24 hours: {last24h}
        </Typography>
      </Stack>
      <Button
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
        disabled={isLoading || isSaving}
        onClick={() => void save()}
      >
        Save Claude eval settings
      </Button>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
