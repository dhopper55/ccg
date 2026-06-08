import { Controller, useFormContext } from 'react-hook-form';
import {
  Box,
  Divider,
  FormHelperText,
  Stack,
  Typography,
} from '@mui/material';
import * as yup from 'yup';
import AvatarDropBox from 'components/base/AvatarDropBox';
import ContactFormSection from 'components/sections/crm/add-contact/ContactFormSection';

export interface CompanyInfo {
  companyInfo: {
    profileImage?: File | string;
    avatar?: File | string;
  };
}

export const companyInfoSchema = yup.object().shape({
  companyInfo: yup.object({
    profileImage: yup.mixed().optional(),
    avatar: yup.mixed().optional(),
  }),
});

const CompanyInfoForm = ({ label }: { label: string }) => {
  const {
    register: _register,
    control,
    formState: { errors },
  } = useFormContext<CompanyInfo>();

  return (
    <div>
      <Box sx={{ mb: 4.5 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {label}
        </Typography>
        <Divider />
      </Box>

      <Stack direction="column" spacing={4}>
        <ContactFormSection title="Profile Picture">
          <Controller
            control={control}
            name="companyInfo.profileImage"
            render={({ field: { value, onChange } }) => (
              <AvatarDropBox
                defaultFile={value}
                onDrop={(acceptedFiles) => {
                  if (acceptedFiles.length > 0) onChange(acceptedFiles[0]);
                }}
                sx={{ '& img': { objectFit: 'cover' } }}
                error={errors.companyInfo?.profileImage ? 'Invalid image' : undefined}
              />
            )}
          />
          {errors.companyInfo?.profileImage?.message && (
            <FormHelperText error>{String(errors.companyInfo.profileImage.message)}</FormHelperText>
          )}
          <Typography variant="caption" color="text.secondary">
            JPG or PNG, Recommended size 1:1, Up to 10MB.
          </Typography>
        </ContactFormSection>

        <ContactFormSection title="Guitar Photos">
          <Controller
            control={control}
            name="companyInfo.avatar"
            render={({ field: { value, onChange } }) => (
              <AvatarDropBox
                defaultFile={value}
                onDrop={(acceptedFiles) => {
                  if (acceptedFiles.length > 0) onChange(acceptedFiles[0]);
                }}
                error={errors.companyInfo?.avatar ? 'Invalid image' : undefined}
              />
            )}
          />
          {errors.companyInfo?.avatar?.message && (
            <FormHelperText error>{String(errors.companyInfo.avatar.message)}</FormHelperText>
          )}
          <Typography variant="caption" color="text.secondary">
            Upload photos of your guitar. JPG or PNG, Up to 10MB each.
          </Typography>
        </ContactFormSection>
      </Stack>
    </div>
  );
};

export default CompanyInfoForm;
