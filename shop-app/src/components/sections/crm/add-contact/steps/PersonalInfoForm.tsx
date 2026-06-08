import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  FormControl,
  FormHelperText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import * as yup from 'yup';
import ContactFormSection from 'components/sections/crm/add-contact/ContactFormSection';

export interface PersonalInfo {
  personalInfo: {
    serialNumber?: string;
    brand: string;
    brandOther?: string;
    model?: string;
    includesCase: string;
    phoneNumber?: string;
    alternatePhoneNumber?: string;
    location?: string;
    note: string;
    damage?: string;
  };
}

export const personalInfoSchema = yup.object({
  personalInfo: yup.object({
    serialNumber: yup.string().optional(),
    brand: yup.string().required('Brand is required'),
    brandOther: yup.string().when('brand', ([brand], schema) =>
      brand === 'Other' ? schema.required('Please specify the brand') : schema.optional()
    ),
    model: yup.string().optional(),
    includesCase: yup.string().required('This field is required'),
    phoneNumber: yup.string().optional(),
    alternatePhoneNumber: yup.string().optional(),
    location: yup.string().optional(),
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

const FieldTooltip = ({ title }: { title: React.ReactNode }) => (
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

const SERIAL_NUMBER_TOOLTIP = (
  <Box sx={{ p: 0.5, maxWidth: 320 }}>
    <Typography variant="caption" display="block" sx={{ mb: 1 }}>
      Most major guitar manufacturers assign a serial number to each instrument. The serial number can help identify the guitar's model, production year, factory of origin, and other important details.
    </Typography>
    <Typography variant="caption" display="block" sx={{ mb: 0.75 }}>
      Serial number locations vary by brand and model, but common places to check include:
    </Typography>
    {[
      'Front or back of the headstock (near the tuning machines)',
      'A label inside the soundhole of an acoustic guitar',
      'The neck plate on bolt-on neck guitars',
      'The back of the neck near the body joint',
      'Inside an electronics cavity or control compartment (less common)',
    ].map((item) => (
      <Typography key={item} variant="caption" display="block" sx={{ pl: 1, mb: 0.25 }}>
        • {item}
      </Typography>
    ))}
    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
      Enter the serial number exactly as it appears on the instrument, including any letters, numbers, spaces, or dashes. If you cannot find a serial number, leave this field blank and continue with the evaluation.
    </Typography>
  </Box>
);

const BRAND_TOOLTIP = (
  <Box sx={{ p: 0.5, maxWidth: 320 }}>
    <Typography variant="caption" display="block" sx={{ mb: 1 }}>
      The guitar's brand is one of the most important pieces of information used in determining its value. In most cases, an accurate evaluation is not possible without knowing the manufacturer.
    </Typography>
    <Typography variant="caption" display="block" sx={{ mb: 1 }}>
      The brand name is typically displayed on the headstock, but it may also appear on a label inside the soundhole of an acoustic guitar, on the neck plate, or elsewhere on the instrument.
    </Typography>
    <Typography variant="caption" display="block">
      If you're unsure of the brand, review the instrument carefully for logos, decals, labels, or serial number markings. If the brand cannot be identified but you have provided clear, comprehensive photos, select "Other" and enter "N/A" in the brand field. Our evaluators may still be able to identify the instrument from the photos provided.
    </Typography>
  </Box>
);

const FieldLabel = ({ text, optional, tooltip }: { text: string; optional?: boolean; tooltip?: React.ReactNode }) => (
  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
    <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.4 }}>
      {text}
      {optional && (
        <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, ml: 0.5 }}>
          (optional)
        </Box>
      )}
    </Typography>
    <FieldTooltip title={tooltip ?? 'Test text here for now'} />
  </Stack>
);

const PersonalInfoForm = (_: { label?: string }) => {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<PersonalInfo>();

  const isOtherBrand = watch('personalInfo.brand') === 'Other';

  return (
    <div>
      <Stack direction="column" spacing={4}>
        <ContactFormSection title="Guitar Information">
          <Grid container spacing={2} sx={{ width: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldLabel text="Serial #" optional tooltip={SERIAL_NUMBER_TOOLTIP} />
              <TextField
                fullWidth
                error={!!errors.personalInfo?.serialNumber}
                helperText={errors.personalInfo?.serialNumber?.message}
                {...register('personalInfo.serialNumber')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FieldLabel text="Brand" tooltip={BRAND_TOOLTIP} />
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
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: isOtherBrand ? undefined : 'none' }}>
              {/* empty left column — intentional */}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: isOtherBrand ? undefined : 'none' }}>
              <FieldLabel text="Please specify brand" />
              <TextField
                fullWidth
                error={!!errors.personalInfo?.brandOther}
                helperText={errors.personalInfo?.brandOther?.message}
                {...register('personalInfo.brandOther')}
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
            <FieldLabel text="Approx. Instrument Location" optional />
            <TextField
              fullWidth
              error={!!errors.personalInfo?.location}
              helperText={errors.personalInfo?.location?.message}
              {...register('personalInfo.location')}
            />
          </Box>
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
