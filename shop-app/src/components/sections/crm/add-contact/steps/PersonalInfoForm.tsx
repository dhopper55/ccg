import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  Divider,
  Link,
  MenuItem,
  Select,
  FormControl,
  FormHelperText,
  InputLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import * as yup from 'yup';
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
          <Link
            href={SAMPLE_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            underline="always"
            variant="body2"
          >
            Click here to view a sample evaluation report
          </Link>
          <Typography variant="body2" fontStyle="italic" sx={{ mt: 0.5 }}>
            Ready in less than 24 hours
          </Typography>
        </Box>
      </Box>

      <Stack direction="column" spacing={4}>
        <ContactFormSection title="Guitar Information">
          <Grid container spacing={2} sx={{ width: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={
                  <span>
                    Serial #{' '}
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      ( optional )
                    </Box>
                  </span>
                }
                error={!!errors.personalInfo?.serialNumber}
                helperText={errors.personalInfo?.serialNumber?.message}
                {...register('personalInfo.serialNumber')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="personalInfo.brand"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.personalInfo?.brand}>
                    <InputLabel>Brand</InputLabel>
                    <Select {...field} label="Brand">
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
              <TextField
                fullWidth
                label={
                  <span>
                    Model{' '}
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      ( optional )
                    </Box>
                  </span>
                }
                error={!!errors.personalInfo?.model}
                helperText={errors.personalInfo?.model?.message}
                {...register('personalInfo.model')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="personalInfo.includesCase"
                control={control}
                defaultValue="no"
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.personalInfo?.includesCase}>
                    <InputLabel>Includes Case or Bag?</InputLabel>
                    <Select {...field} label="Includes Case or Bag?">
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
          <TextField
            fullWidth
            label="Guitar Notes"
            multiline
            rows={3}
            error={!!errors.personalInfo?.note}
            helperText={errors.personalInfo?.note?.message}
            {...register('personalInfo.note')}
          />
          <TextField
            fullWidth
            label={
              <span>
                Any Damage Worth Noting?{' '}
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  ( optional )
                </Box>
              </span>
            }
            multiline
            rows={3}
            error={!!errors.personalInfo?.damage}
            helperText={errors.personalInfo?.damage?.message}
            {...register('personalInfo.damage')}
          />
        </ContactFormSection>
      </Stack>
    </div>
  );
};

export default PersonalInfoForm;
