import { Button, Paper, SxProps, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const OrderCustomization = ({ sx }: { sx?: SxProps }) => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, ...sx }}>
      <Typography
        variant="h6"
        sx={{
          mb: 2,
        }}
      >
        Want this item setup to your specifications?
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        Contact us and we will talk through the details.
      </Typography>
      <Button
        variant="soft"
        color="neutral"
        fullWidth
        href="https://www.coalcreekguitars.com/contact-us"
        startIcon={
          <IconifyIcon icon="material-symbols:handyman-outline" fontSize="20px !important" />
        }
      >
        Order Customization
      </Button>
    </Paper>
  );
};

export default OrderCustomization;
