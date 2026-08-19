import { Box, Stack, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const PromoBanner = () => {
  return (
    <Stack
      direction="row"
      spacing={{ xs: 1, sm: 1.5 }}
      sx={{
        px: { xs: 2, md: 5 },
        py: { xs: 1, md: 0.75 },
        minHeight: { xs: 44, md: 42 },
        bgcolor: 'background.elevation1',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconifyIcon
        icon="material-symbols:local-shipping-outline-rounded"
        sx={{ color: 'success.main', fontSize: { xs: 21, md: 24 }, flexShrink: 0 }}
      />
      <Typography
        variant="h6"
        color="text.primary"
        sx={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'center',
          columnGap: 1,
          rowGap: 0.25,
          lineHeight: 1.25,
          textAlign: 'center',
        }}
      >
        <Box component="span" fontWeight={800}>
          Free shipping on all orders
        </Box>
      </Typography>
    </Stack>
  );
};

export default PromoBanner;
