import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  Divider,
  FormControl,
  FormHelperText,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import * as yup from 'yup';
import IconifyIcon from 'components/base/IconifyIcon';
import ContactFormSection from 'components/sections/crm/add-contact/ContactFormSection';

export interface PersonalInfo {
  personalInfo: {
    serialNumber?: string;
    brand: string;
    model?: string;
    includesCase: string;
    phoneNumber?: string;
    alternatePhoneNumber?: string;
    note: string;
    damage?: string;
  };
}

export const personalInfoSchema = yup.object({
  personalInfo: yup.object({
    serialNumber: yup.string().optional(),
    brand: yup.string().required('Brand is required'),
    model: yup.string().optional(),
    includesCase: yup.string().required('This field is required'),
    phoneNumber: yup.string().optional(),
    alternatePhoneNumber: yup.string().optional(),
    note: yup.string().required('Guitar Notes are required'),
    damage: yup.string().optional(),
  }),
});

const GUITAR_BRANDS = [
  'Alvarez',
  'B.C. Rich',
  'Charvel',
  'Cort',
  'Dean',
  'Epiphone',
  'Ernie Ball Music Man',
  'ESP',
  'Fender',
  'Gibson',
  'Godin',
  'Gretsch',
  'Guild',
  'Ibanez',
  'Jackson',
  'Kramer',
  'Martin',
  'Ovation',
  'PRS',
  'Rickenbacker',
  'Schecter',
  'Squier',
  'Takamine',
  'Taylor',
  'Washburn',
  'Yamaha',
  'Other',
];

const SAMPLE_REPORT_URL = 'https://www.coalcreekguitars.com/guitar-value-report-evaluation/sample-report.pdf';

const FieldTooltip = ({ title }: { title: string }) => (
  <Tooltip title={title} placement="top" arrow>
    <Box
      component="span"
      tabIndex={-1}
      sx={{
        px: 0.75,
        py: 0.125,
        borderRadius: 999,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: 0.2,
        color: 'primary.dark',
        bgcolor: 'primary.lighter',
        border: 1,
        borderColor: 'primary.light',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      ?
    </Box>
  </Tooltip>
);

const FieldLabel = ({ text, optional }: { text: string; optional?: boolean }) => (
  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
    <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.4 }}>
      {text}
      {optional && (
        <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, ml: 0.5 }}>
          (optional)
        </Box>
      )}
    </Typography>
    <FieldTooltip title="Test text here for now" />
  </Stack>
);

const PersonalInfoForm = (_: { label?: string }) => {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<PersonalInfo>();

  return (
    <div>
      <Box sx={{ mb: 3 }}>
        <Divider />
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <IconifyIcon icon="mdi:file-pdf-box" sx={{ fontSize: 20, color: '#e53935', flexShrink: 0 }} />
            <Link
              href={SAMPLE_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              underline="always"
              variant="body2"
            >
              Click here to view a sample evaluation report
            </Link>
          </Stack>
          <Typography variant="body2" fontStyle="italic" sx={{ mt: 0.5 }}>
            Ready in less than 24 hours
          </Typography>
        </Box>
      </Box>

      <Stack direction="column" spacing={4}>
        <ContactFormSection title="Guitar Information">
          <Grid container spacing={2} sx={{ width: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldLabel text="Serial #" optional />
              <TextField
                fullWidth
                error={!!errors.personalInfo?.serialNumber}
                helperText={errors.personalInfo?.serialNumber?.message}
                {...register('personalInfo.serialNumber')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldLabel text="Brand" />
              <Controller
                name="personalInfo.brand"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.personalInfo?.brand}>
                    <Select {...field} displayEmpty>
                      <MenuItem value="" disabled>
                        <Box component="span" sx={{ color: 'text.disabled' }}>Select brand…</Box>
                      </MenuItem>
                      {GUITAR_BRANDS.map((brand) => (
                        <MenuItem key={brand} value={brand}>
                          {brand}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.personalInfo?.brand?.message && (
                      <FormHelperText>{errors.personalInfo.brand.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldLabel text="Model" optional />
              <TextField
                fullWidth
                error={!!errors.personalInfo?.model}
                helperText={errors.personalInfo?.model?.message}
                {...register('personalInfo.model')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldLabel text="Includes Case or Bag?" />
              <Controller
                name="personalInfo.includesCase"
                control={control}
                defaultValue="no"
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.personalInfo?.includesCase}>
                    <Select {...field}>
                      <MenuItem value="no">No</MenuItem>
                      <MenuItem value="gig_bag">Gig Bag</MenuItem>
                      <MenuItem value="hard_case">Hard Case</MenuItem>
                    </Select>
                    {errors.personalInfo?.includesCase?.message && (
                      <FormHelperText>{errors.personalInfo.includesCase.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
        </ContactFormSection>

        <ContactFormSection title="Additional Information">
          <Box sx={{ width: 1 }}>
            <FieldLabel text="Guitar Notes" />
            <TextField
              fullWidth
              multiline
              rows={3}
              error={!!errors.personalInfo?.note}
              helperText={errors.personalInfo?.note?.message}
              {...register('personalInfo.note')}
            />
          </Box>
          <Box sx={{ width: 1 }}>
            <FieldLabel text="Any Damage Worth Noting?" optional />
            <TextField
              fullWidth
              multiline
              rows={3}
              error={!!errors.personalInfo?.damage}
              helperText={errors.personalInfo?.damage?.message}
              {...register('personalInfo.damage')}
            />
          </Box>
        </ContactFormSection>
      </Stack>
    </div>
  );
};

export default PersonalInfoForm;
