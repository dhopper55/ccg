import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import IconifyIcon from 'components/base/IconifyIcon';

const PromoBanner = () => {
  const { down } = useBreakpoints();
  const downSm = down('sm');

  return (
    <Stack
      component={downSm ? ButtonBase : Stack}
      gap={2}
      sx={{
        px: { xs: 3, md: 5 },
        py: { xs: 1, md: 0 },
        minHeight: { xs: 52, md: 46 },
        bgcolor: 'background.elevation1',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        alignItems: 'center',
        justifyContent: { md: 'center' },
      }}
    >
      <Box sx={{ flexGrow: { xs: 1, md: 0 }, overflow: 'hidden' }}>
        <Typography
          variant="h6"
          color="text.primary"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            whiteSpace: 'nowrap',
            '@keyframes marquee': {
              '0%': {
                ml: '100%',
                transform: 'translateX(0%)',
              },
              '100%': {
                ml: 0,
                transform: 'translateX(-100%)',
              },
            },
            animation: { xs: 'marquee 7s linear infinite', md: 'none' },
          }}
        >
          <IconifyIcon
            icon="material-symbols:local-shipping-outline-rounded"
            sx={{ color: 'success.main', fontSize: 24, flexShrink: 0 }}
          />
          Free shipping at $75+{' '}
          <Box component="span" fontWeight={500} fontSize="subtitle1.fontSize">
            on eligible items in the 50 states. Orders under $75 ship flat rate{' '}
          </Box>
          <Box component="span" fontWeight={800} fontSize="subtitle1.fontSize" color="success.main">
            $6
          </Box>
        </Typography>
      </Box>
      {!downSm && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 2, flexShrink: 0 }}>
          {['50 states', '$6 under $75', 'Free $75+'].map((label) => (
            <Box
              key={label}
              sx={{
                bgcolor: 'action.hover',
                color: 'text.secondary',
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
              }}
            >
              <Typography variant="body2" fontWeight={700}>
                {label}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default PromoBanner;
