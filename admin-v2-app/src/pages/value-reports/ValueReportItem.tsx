import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
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
};

type ValueReportItemResponse = {
  record?: ValueReportRecord;
  message?: string;
};

const ReadField = ({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) => (
  <TextField
    fullWidth
    label={label}
    value={value || '—'}
    multiline={multiline}
    minRows={multiline ? 3 : undefined}
    InputProps={{ readOnly: true }}
    inputProps={{ style: { cursor: 'default' } }}
  />
);

const ValueReportItem = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [record, setRecord] = useState<ValueReportRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setErrorMessage('No record ID provided.');
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}`, {
          credentials: 'same-origin',
        });
        const payload = (await response.json()) as ValueReportItemResponse;
        if (!response.ok) throw new Error(payload.message || 'Unable to load value report.');
        setRecord(payload.record ?? null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load value report.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id]);

  const pageTitle = record
    ? `${[record.firstName, record.lastName].filter(Boolean).join(' ') || 'Value Report'}`
    : 'Value Report';

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h4">{pageTitle}</Typography>
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

      <Box sx={{ px: { xs: 2, md: 5 }, pb: 5, minWidth: 0 }}>
        {isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>Loading value report…</Typography>
          </Stack>
        ) : record ? (
          <Stack spacing={4}>

            {/* Contact */}
            <Stack spacing={2}>
              <Typography variant="h6">Contact</Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="First Name" value={record.firstName} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Last Name" value={record.lastName} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Email" value={record.email} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Location" value={record.location} />
                </Grid>
              </Grid>
            </Stack>

            {/* Guitar */}
            <Stack spacing={2}>
              <Typography variant="h6">Guitar</Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Brand" value={record.brand} />
                </Grid>
                {record.brandOther ? (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <ReadField label="Brand (Other)" value={record.brandOther} />
                  </Grid>
                ) : null}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Model" value={record.model} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Serial Number" value={record.serialNumber} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <ReadField label="Includes Case?" value={record.includesCase} />
                </Grid>
              </Grid>
            </Stack>

            {/* Condition */}
            <Stack spacing={2}>
              <Typography variant="h6">Condition</Typography>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <ReadField label="Notes" value={record.note} multiline />
                </Grid>
                <Grid size={12}>
                  <ReadField label="Damage / Wear" value={record.damage} multiline />
                </Grid>
              </Grid>
            </Stack>

            {/* Status */}
            <Stack spacing={2}>
              <Typography variant="h6">Status</Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <ReadField
                    label="Submitted"
                    value={record.createdAt ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A') : null}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <ReadField
                    label="Paid"
                    value={record.stripePaymentIntentId ? 'Yes' : 'No'}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <ReadField
                    label="Fulfilled"
                    value={record.fulfilled ? 'Yes' : 'No'}
                  />
                </Grid>
                {record.stripePaymentIntentId ? (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <ReadField label="Stripe Payment Intent" value={record.stripePaymentIntentId} />
                  </Grid>
                ) : null}
              </Grid>
            </Stack>

          </Stack>
        ) : null}
      </Box>
    </Stack>
  );
};

export default ValueReportItem;
