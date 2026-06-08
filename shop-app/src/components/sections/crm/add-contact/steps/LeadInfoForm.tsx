import { useFormContext } from 'react-hook-form';
import { Box, Divider, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import * as yup from 'yup';

export interface LeadInfo {
  leadInfo: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export const leadInfoSchema = yup.object().shape({
  leadInfo: yup.object({
    firstName: yup.string().required('First name is required'),
    lastName: yup.string().required('Last name is required'),
    email: yup.string().email('Must be a valid email address').required('Email is required'),
  }),
});

const FieldLabel = ({ text }: { text: string }) => (
  <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5, lineHeight: 1.4 }}>
    {text}
  </Typography>
);

const LeadInfoForm = ({ label }: { label: string }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<LeadInfo>();

  return (
    <div>
      <Box sx={{ mb: 4.5 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {label}
        </Typography>
        <Divider />
      </Box>

      <Stack direction="column" spacing={2}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FieldLabel text="First Name" />
            <TextField
              fullWidth
              error={!!errors.leadInfo?.firstName}
              helperText={errors.leadInfo?.firstName?.message}
              {...register('leadInfo.firstName')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FieldLabel text="Last Name" />
            <TextField
              fullWidth
              error={!!errors.leadInfo?.lastName}
              helperText={errors.leadInfo?.lastName?.message}
              {...register('leadInfo.lastName')}
            />
          </Grid>
        </Grid>

        <Box>
          <FieldLabel text="Email" />
          <TextField
            fullWidth
            type="email"
            error={!!errors.leadInfo?.email}
            helperText={errors.leadInfo?.email?.message}
            {...register('leadInfo.email')}
          />
        </Box>
      </Stack>
    </div>
  );
};

export default LeadInfoForm;
