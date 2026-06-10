import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Grid from '@mui/material/Grid';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type ValueReportRecord = {
  id: number;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  brand: string | null;
  brandOther: string | null;
  model: string | null;
  serialNumber: string | null;
  includesCase: string | null;
  location: string | null;
  note: string | null;
  damage: string | null;
  stripePaymentIntentId: string | null;
  fulfilled: number;
  imageUrls: string[];
};

type ValueReportItemResponse = {
  record?: ValueReportRecord;
  message?: string;
};

const ro = { readOnly: true };

const ValueReportItem = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [record, setRecord] = useState<ValueReportRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [fulfilled, setFulfilled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!id) {
      setErrorMessage('No record ID provided.');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}`, {
          credentials: 'same-origin',
        });
        const payload = (await response.json()) as ValueReportItemResponse;
        if (!response.ok) throw new Error(payload.message || 'Unable to load value report.');
        if (!cancelled) {
          setRecord(payload.record ?? null);
          setFulfilled(Boolean(payload.record?.fulfilled));
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load value report.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/fulfilled`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfilled }),
      });
      if (!res.ok) throw new Error('Save failed.');
      setSaveMessage({ type: 'success', text: 'Saved.' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save.' });
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = record?.createdAt
    ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A')
    : 'Value Report';

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h4">{formattedDate}</Typography>
          <Tooltip title="Back to Value Reports">
            <IconButton
              aria-label="Back"
              onClick={() => navigate(paths.valueReports)}
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                color: 'text.primary',
                '&:hover': { bgcolor: 'background.elevation2' },
              }}
            >
              <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Box sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
        {isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>Loading value report…</Typography>
          </Stack>
        ) : record ? (
          <Grid container spacing={3}>

            {/* Photos */}
            {record.imageUrls.length > 0 ? (
              <>
                <Grid size={12}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                    Photos
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <Stack direction="row" flexWrap="wrap" gap={1.5}>
                    {record.imageUrls.map((url, index) => (
                      <Box
                        key={index}
                        component="img"
                        src={url}
                        alt={`Photo ${index + 1}`}
                        onClick={() => setLightboxUrl(url)}
                        sx={{
                          width: 120,
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: 1,
                          borderColor: 'divider',
                          '&:hover': { opacity: 0.85 },
                          transition: 'opacity 0.15s',
                        }}
                      />
                    ))}
                  </Stack>
                </Grid>
              </>
            ) : null}

            {/* Contact */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Contact
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="First Name" value={record.firstName || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Last Name" value={record.lastName || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Email" value={record.email || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Location" value={record.location || '—'} InputProps={ro} />
            </Grid>

            {/* Guitar */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Guitar
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Brand" value={record.brand || '—'} InputProps={ro} />
            </Grid>
            {record.brandOther ? (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField fullWidth label="Brand (Other)" value={record.brandOther} InputProps={ro} />
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Model" value={record.model || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Serial Number" value={record.serialNumber || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Includes Case?" value={record.includesCase || '—'} InputProps={ro} />
            </Grid>

            {/* Condition */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Condition
              </Typography>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline minRows={3} label="Notes" value={record.note || '—'} InputProps={ro} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline minRows={3} label="Damage / Wear" value={record.damage || '—'} InputProps={ro} />
            </Grid>

            {/* Status */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Status
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Paid" value={record.stripePaymentIntentId ? 'Yes' : 'No'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={fulfilled}
                    onChange={(e) => setFulfilled(e.target.checked)}
                  />
                }
                label="Fulfilled"
              />
            </Grid>
            {record.stripePaymentIntentId ? (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Stripe Payment Intent" value={record.stripePaymentIntentId} InputProps={ro} />
              </Grid>
            ) : null}

            {/* Save */}
            <Grid size={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
                {saveMessage ? (
                  <Typography variant="body2" color={saveMessage.type === 'success' ? 'success.main' : 'error.main'}>
                    {saveMessage.text}
                  </Typography>
                ) : null}
              </Stack>
            </Grid>

          </Grid>
        ) : null}
      </Box>

      {/* Lightbox */}
      <Dialog
        open={Boolean(lightboxUrl)}
        onClose={() => setLightboxUrl(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
      >
        <DialogContent sx={{ p: 1, position: 'relative' }}>
          <IconButton
            onClick={() => setLightboxUrl(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              zIndex: 1,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
            }}
          >
            <IconifyIcon icon="material-symbols:close-rounded" fontSize={22} />
          </IconButton>
          {lightboxUrl ? (
            <Box
              component="img"
              src={lightboxUrl}
              alt="Photo enlarged"
              sx={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block', borderRadius: 2 }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default ValueReportItem;
