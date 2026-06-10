import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  Divider,
  FormHelperText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import * as yup from 'yup';
import AvatarDropBox from 'components/base/AvatarDropBox';

export interface CompanyInfo {
  companyInfo: {
    mainPhoto?: File | string;
    photos?: (File | string | undefined)[];
  };
}

export const companyInfoSchema = yup.object().shape({
  companyInfo: yup.object({
    mainPhoto: yup.mixed().required('A main photo is required'),
    photos: yup.array().of(yup.mixed().optional()).optional(),
  }),
});

const TooltipBubble = ({ title }: { title: string }) => (
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

const ADDITIONAL_PHOTO_SIZE = 88;

const CompanyInfoForm = ({ label: _label }: { label: string }) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<CompanyInfo>();

  return (
    <div>
      <Box sx={{ mb: 4.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h6">Guitar Photos</Typography>
          <TooltipBubble title="Tooltip text coming soon" />
        </Stack>
        <Divider />
      </Box>

      <Box
        sx={{
          mb: 3,
          p: 2,
          border: '1px solid',
          borderColor: 'warning.main',
          borderRadius: 2,
          bgcolor: 'rgba(184,150,12,0.06)',
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ color: 'warning.main', mb: 0.5 }}>
          At least 1 photo is required — the more you provide, the better your report.
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          We cannot process your report until at least 1 photo has been added.
        </Typography>
      </Box>

      <Stack direction="column" spacing={3} alignItems="center">
        <Typography variant="subtitle2" fontWeight={700} textAlign="center">
          Main Photo
        </Typography>

        <Controller
          control={control}
          name="companyInfo.mainPhoto"
          render={({ field: { value, onChange } }) => (
            <AvatarDropBox
              defaultFile={value}
              onDrop={(acceptedFiles) => {
                if (acceptedFiles.length > 0) onChange(acceptedFiles[0]);
              }}
              sx={{ '& img': { objectFit: 'cover' } }}
              error={errors.companyInfo?.mainPhoto ? 'A main photo is required' : undefined}
            />
          )}
        />
        {errors.companyInfo?.mainPhoto && (
          <FormHelperText error sx={{ mt: -1 }}>
            {String(errors.companyInfo.mainPhoto.message)}
          </FormHelperText>
        )}

        <Typography variant="caption" color="text.secondary" textAlign="center">
          Upload photos of your guitar. JPG or PNG, Up to 10MB each.
        </Typography>

        <Stack direction="column" spacing={1.5} alignItems="center" sx={{ width: 1 }}>
          {[0, 1].map((row) => (
            <Stack key={row} direction="row" spacing={1.5} justifyContent="center">
              {Array.from({ length: 5 }, (_, col) => {
                const index = row * 5 + col;
                return (
                  <Controller
                    key={index}
                    control={control}
                    name={`companyInfo.photos.${index}` as any}
                    render={({ field: { value, onChange } }) => (
                      <AvatarDropBox
                        defaultFile={value as File | string | undefined}
                        onDrop={(acceptedFiles) => {
                          if (acceptedFiles.length > 0) onChange(acceptedFiles[0]);
                        }}
                        sx={{ width: ADDITIONAL_PHOTO_SIZE, height: ADDITIONAL_PHOTO_SIZE }}
                      />
                    )}
                  />
                );
              })}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </div>
  );
};

export default CompanyInfoForm;
