import { Box, Paper, Stack, SxProps, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const PurchaseDetails = ({ allowShipping = false, sx }: { allowShipping?: boolean; sx?: SxProps }) => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, ...sx }}>
      <Typography
        variant="h6"
        sx={{
          mb: 3,
        }}
      >
        Purchase details
      </Typography>
      <Stack
        sx={{
          gap: 2,
          mb: 3,
        }}
      >
        <IconifyIcon
          icon="material-symbols:local-shipping-outline-rounded"
          sx={{ flexShrink: 0, fontSize: 22 }}
        />
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {allowShipping ? (
            'Store pickup, local delivery, or shipping in the US available'
          ) : (
            <>
              Store pickup in Englewood & local delivery
              <Box
                sx={{
                  display: 'block',
                  fontWeight: 700,
                  color: 'success.main',
                }}
                component="span"
              >
                Both available
              </Box>
            </>
          )}
        </Typography>
      </Stack>
      <Stack
        sx={{
          gap: 2,
        }}
      >
        <IconifyIcon
          icon="material-symbols:u-turn-left-rounded"
          sx={{ flexShrink: 0, fontSize: 22, rotate: '90deg' }}
        />
        <div>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Eligible for refund within 7 days of product pickup.
          </Typography>
        </div>
      </Stack>
    </Paper>
  );
};

export default PurchaseDetails;
