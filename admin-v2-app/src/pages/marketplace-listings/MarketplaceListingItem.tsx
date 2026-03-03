import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type MarketplaceRecord = {
  id: string;
  source: string;
  title: string;
  priceDollars: number;
  currency: string;
  imageUrl: string;
  listingUrl: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type MarketplaceListResponse = {
  records?: MarketplaceRecord[];
  message?: string;
};

type SaveResponse = {
  ok?: boolean;
  id?: string;
  message?: string;
};

type FormState = {
  title: string;
  priceDollars: string;
  listingUrl: string;
  imageUrl: string;
  notes: string;
};

const DEFAULT_FORM: FormState = {
  title: '',
  priceDollars: '',
  listingUrl: '',
  imageUrl: '',
  notes: '',
};

const MarketplaceListingItem = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(
    null,
  );

  const mode = editId ? 'edit' : 'add';
  const pageTitle = mode === 'edit' ? 'Edit Marketplace Listing' : 'Add Marketplace Listing';
  const submitLabel = mode === 'edit' ? 'Update Listing' : 'Add Listing';
  const submitIcon =
    mode === 'edit'
      ? 'material-symbols:save-outline-rounded'
      : 'material-symbols:add-circle-outline-rounded';

  useEffect(() => {
    document.title = `CCG Admin | ${pageTitle}`;
  }, [pageTitle]);

  useEffect(() => {
    let cancelled = false;
    const id = searchParams.get('id');

    const initialize = async () => {
      setIsLoading(true);
      setMessage(null);

      try {
        if (!id) {
          if (!cancelled) {
            setEditId(null);
            setForm(DEFAULT_FORM);
          }
          return;
        }

        const response = await fetch('/api/marketplace-listings', {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as MarketplaceListResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load marketplace listing.');
        }

        if (cancelled) return;

        const record = (data.records || []).find((item) => item.id === id);
        if (!record) {
          throw new Error('Marketplace listing not found.');
        }

        setEditId(record.id);
        setForm({
          title: record.title || '',
          priceDollars:
            typeof record.priceDollars === 'number' && Number.isFinite(record.priceDollars)
              ? String(record.priceDollars)
              : '',
          listingUrl: record.listingUrl || '',
          imageUrl: record.imageUrl || '',
          notes: record.notes || '',
        });
      } catch (error) {
        if (!cancelled) {
          setMessage({
            severity: 'error',
            text:
              error instanceof Error
                ? error.message
                : 'Unable to initialize marketplace listing.',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!form.title.trim()) {
      setMessage({ severity: 'error', text: 'Title is required.' });
      return;
    }

    const priceDollars = Number.parseInt(form.priceDollars.trim(), 10);
    if (!Number.isFinite(priceDollars) || priceDollars < 1) {
      setMessage({
        severity: 'error',
        text: 'Price must be a whole dollar amount greater than 0.',
      });
      return;
    }

    if (!form.listingUrl.trim()) {
      setMessage({ severity: 'error', text: 'Facebook Marketplace URL is required.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        title: form.title.trim(),
        priceDollars,
        listingUrl: form.listingUrl.trim(),
        imageUrl: form.imageUrl.trim(),
        notes: form.notes.trim(),
      };

      const endpoint = editId
        ? `/api/marketplace-listings/${encodeURIComponent(editId)}/update`
        : '/api/marketplace-listings';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      const data = (await response.json().catch(() => ({}))) as SaveResponse;
      if (!response.ok || (!editId && !data.ok)) {
        throw new Error(
          data.message ||
            (editId ? 'Unable to update marketplace listing.' : 'Unable to add marketplace listing.'),
        );
      }

      const text = editId ? 'Marketplace listing updated.' : 'Marketplace listing added.';
      enqueueSnackbar(text, { variant: 'success' });
      navigate(paths.marketplaceListings);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : 'Unable to save marketplace listing.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack direction="column" height={1} gap={3} sx={{ minWidth: 0 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            gap: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h4">{pageTitle}</Typography>

          <Tooltip title="Back">
            <IconButton
              aria-label="Back"
              onClick={() => navigate(paths.marketplaceListings)}
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: 'background.elevation2',
                },
              }}
            >
              <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {message ? <Alert severity={message.severity}>{message.text}</Alert> : null}

      <Box sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
        {isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>
              Loading marketplace listing…
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={form.title}
                  onChange={(event) => setField('title', event.target.value)}
                  inputProps={{ maxLength: 200 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Price (whole dollars)"
                  type="number"
                  value={form.priceDollars}
                  onChange={(event) => setField('priceDollars', event.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Facebook Marketplace URL"
                  value={form.listingUrl}
                  onChange={(event) => setField('listingUrl', event.target.value)}
                  placeholder="https://www.facebook.com/marketplace/item/..."
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Main Image URL"
                  value={form.imageUrl}
                  onChange={(event) => setField('imageUrl', event.target.value)}
                  placeholder="https://..."
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Notes"
                  value={form.notes}
                  onChange={(event) => setField('notes', event.target.value)}
                  inputProps={{ maxLength: 2000 }}
                />
              </Grid>

              <Grid size={12}>
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <IconifyIcon icon={submitIcon} />
                      )
                    }
                  >
                    {isSubmitting ? 'Saving...' : submitLabel}
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={isSubmitting}
                    onClick={() => navigate(paths.marketplaceListings)}
                    startIcon={<IconifyIcon icon="material-symbols:cancel-outline-rounded" />}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};

export default MarketplaceListingItem;
