import { Box, Divider, Stack, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const ConfirmationForm = ({ label }: { label: string }) => {
  return (
    <div>
      <Box sx={{ mb: 4.5 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {label}
        </Typography>
        <Divider />
      </Box>

      <Stack direction="column" alignItems="center" spacing={2} sx={{ py: 4, textAlign: 'center' }}>
        <IconifyIcon
          icon="material-symbols:check-circle-rounded"
          sx={{ fontSize: 64, color: 'success.main' }}
        />
        <Typography variant="h5" fontWeight={700}>
          We've received your request!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
          Your guitar evaluation report is being prepared. You'll receive it in less than 24 hours.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mt: 1 }}>
          If you have any questions in the meantime, feel free to contact us at{' '}
          <Box
            component="a"
            href="https://www.coalcreekguitars.com/contact-us"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main' }}
          >
            Coal Creek Guitars
          </Box>
          .
        </Typography>
      </Stack>
    </div>
  );
};

export default ConfirmationForm;
