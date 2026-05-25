import { ChangeEvent, useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, TextField } from '@mui/material';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';
import paths from 'routes/paths';

type SystemSettingsForm = {
  brevoOrderConfirmationTemplateId: string;
  brevoSenderName: string;
  brevoSenderEmail: string;
};

type SystemSettingsResponse = Partial<SystemSettingsForm> & {
  ok?: boolean;
  message?: string;
};

const defaultForm: SystemSettingsForm = {
  brevoOrderConfirmationTemplateId: '',
  brevoSenderName: '',
  brevoSenderEmail: '',
};

const SystemSettings = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<SystemSettingsForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/system-settings', { credentials: 'same-origin' });
      const payload = (await response.json()) as SystemSettingsResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to load system settings.');
      setForm({
        brevoOrderConfirmationTemplateId: payload.brevoOrderConfirmationTemplateId || '',
        brevoSenderName: payload.brevoSenderName || '',
        brevoSenderEmail: payload.brevoSenderEmail || '',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load system settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'CCG Admin | System Settings';
    void loadSettings();
  }, []);

  const handleChange =
    (field: keyof SystemSettingsForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/system-settings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brevoOrderConfirmationTemplateId: Number(form.brevoOrderConfirmationTemplateId),
          brevoSenderName: form.brevoSenderName,
          brevoSenderEmail: form.brevoSenderEmail,
        }),
      });
      const payload = (await response.json()) as SystemSettingsResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to save system settings.');
      setForm({
        brevoOrderConfirmationTemplateId: payload.brevoOrderConfirmationTemplateId || form.brevoOrderConfirmationTemplateId,
        brevoSenderName: payload.brevoSenderName || form.brevoSenderName,
        brevoSenderEmail: payload.brevoSenderEmail || form.brevoSenderEmail,
      });
      enqueueSnackbar('System settings saved.', { variant: 'success' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save system settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="System Settings"
        breadcrumb={[
          { label: 'Home', url: paths.starter },
          { label: 'System Settings', active: true },
        ]}
        actionComponent={
          <Button
            variant="contained"
            disabled={isLoading || isSaving}
            startIcon={<IconifyIcon icon="material-symbols:save" />}
            onClick={() => void handleSave()}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Stack direction="column" sx={{ gap: 3, maxWidth: 720 }}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          <TextField
            fullWidth
            required
            type="number"
            label="Brevo Order Confirm Template ID"
            value={form.brevoOrderConfirmationTemplateId}
            disabled={isLoading || isSaving}
            onChange={handleChange('brevoOrderConfirmationTemplateId')}
            inputProps={{ min: 1, step: 1 }}
          />
          <TextField
            fullWidth
            label="Brevo Sender Name"
            value={form.brevoSenderName}
            disabled={isLoading || isSaving}
            onChange={handleChange('brevoSenderName')}
          />
          <TextField
            fullWidth
            type="email"
            label="Brevo Sender Email"
            value={form.brevoSenderEmail}
            disabled={isLoading || isSaving}
            onChange={handleChange('brevoSenderEmail')}
          />
        </Stack>
      </Paper>
    </Stack>
  );
};

export default SystemSettings;
