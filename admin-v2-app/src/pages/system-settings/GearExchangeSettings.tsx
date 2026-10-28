import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';

type GxWebhookEvent = {
  id: number;
  eventType: string | null;
  status: string | null;
  gxListingId: number | null;
  gxOrderId: number | null;
  result: string | null;
  resultMessage: string | null;
  receivedAt: string;
};

type GxStatus = {
  apiTokenConfigured: boolean;
  webhookTokenConfigured: boolean;
  webhookUrl: string;
  listedCount: number;
  publishedCount: number;
  lastEventAt: string | null;
  events: GxWebhookEvent[];
};

const RESULT_COLOR: Record<string, 'success' | 'default' | 'error'> = {
  processed: 'success',
  ignored: 'default',
  failed: 'error',
};

// Sweetwater Gear Exchange connection status, webhook registration, and the recent webhook log.
const GearExchangeSettings = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<GxStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin-v2/gx/status', { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { message?: string }).message || 'Unable to load Gear Exchange status.');
      setStatus(data as GxStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Gear Exchange status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const registerWebhook = async () => {
    setIsRegistering(true);
    try {
      const response = await fetch('/api/admin-v2/gx/webhook-config', { method: 'POST', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({})) as { message?: string; url?: string };
      if (!response.ok) throw new Error(data.message || 'Unable to register the webhook.');
      enqueueSnackbar(`Webhook registered with Gear Exchange: ${data.url}`, { variant: 'success' });
      void load();
    } catch (registerError) {
      enqueueSnackbar(registerError instanceof Error ? registerError.message : 'Unable to register the webhook.', { variant: 'error' });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Stack direction="column" sx={{ gap: 1.5 }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box component="img" src="/images/gx-icon.svg" alt="" sx={{ width: 18, height: 18 }} />
        <Typography variant="subtitle1">Gear Exchange</Typography>
        {status ? (
          <>
            <Chip size="small" color={status.apiTokenConfigured ? 'success' : 'error'} variant="outlined" label={status.apiTokenConfigured ? 'API token set' : 'No API token'} />
            <Chip size="small" color={status.webhookTokenConfigured ? 'success' : 'error'} variant="outlined" label={status.webhookTokenConfigured ? 'Webhook token set' : 'No webhook token'} />
            <Chip size="small" variant="outlined" label={`${status.publishedCount} live / ${status.listedCount} listed`} />
          </>
        ) : null}
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {status ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Webhook URL {status.webhookUrl}
          {status.lastEventAt ? ` · last event ${status.lastEventAt} UTC` : ' · no events yet'}
        </Typography>
      ) : null}
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<IconifyIcon icon="material-symbols:webhook-rounded" />}
          loading={isRegistering}
          disabled={!status?.apiTokenConfigured || !status?.webhookTokenConfigured}
          onClick={() => void registerWebhook()}
        >
          Register Webhook
        </Button>
        <Button
          variant="outlined"
          color="neutral"
          startIcon={<IconifyIcon icon="material-symbols:refresh-rounded" />}
          loading={isLoading}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      </Stack>
      {status?.events.length ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Received (UTC)</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Listing / Order</TableCell>
                <TableCell>Result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status.events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{event.receivedAt}</TableCell>
                  <TableCell>{event.status || event.eventType || '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {[event.gxListingId ? `L ${event.gxListingId}` : null, event.gxOrderId ? `O ${event.gxOrderId}` : null].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="column" sx={{ gap: 0.25 }}>
                      <Chip size="small" sx={{ alignSelf: 'flex-start' }} color={RESULT_COLOR[event.result || ''] ?? 'default'} label={event.result || 'pending'} />
                      {event.resultMessage ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{event.resultMessage}</Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}
    </Stack>
  );
};

export default GearExchangeSettings;
