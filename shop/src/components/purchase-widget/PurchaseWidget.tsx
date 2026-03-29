import { useState } from 'react';
import { useLocation } from 'react-router';
import { keyframes } from '@emotion/react';
import { Box, Link, alpha } from '@mui/material';
import paths from 'routes/paths';
import { green } from 'theme/colors/base';
import IconifyIcon from 'components/base/IconifyIcon';

const btnGlow = keyframes`
  0% { background-position: 0 100%; }
  100% { background-position: 0 300%; }
`;

const PurchaseWidget = () => {
  const [isHovered, setIsHovered] = useState(false);
  const { pathname } = useLocation();

  const isPodcast = pathname.startsWith(paths.podcastDetails(''));

  return (
    <Link
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      href="https://mui.com/store/items/aurora/"
      target="_blank"
      rel="noopener noreferrer"
      variant="subtitle2"
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          position: 'fixed',
          right: 40,
          bottom: isPodcast ? 180 : 40,
          zIndex: (theme) => theme.zIndex.appBar,
          width: 160,
          height: 52,
          borderRadius: '30px !important',
          color: ({ vars }) => vars.palette.common.white,
          background: `linear-gradient(to bottom, ${green[500]}, ${alpha(green[500], 0.1)})`,
          verticalAlign: 'middle',
          textAlign: 'center',
          transition: 'background 0.3s ease',
          fontWeight: 600,
          boxShadow: ({ vars }) => vars.shadows[6],

          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 7.5,
            background: `linear-gradient(to bottom, ${green[500]}, ${green[500]})`,
            transition: 'opacity 0.2s ease',
          },

          '&::after': {
            content: '""',
            position: 'absolute',
            inset: '1px',
            zIndex: 2,
            borderRadius: '29px',
            bgcolor: ({ vars }) => vars.palette.grey[950],
            backgroundBlendMode: 'overlay',
            transition: 'background 0.4s ease',
          },
        },
      ]}
    >
      <Box
        component="span"
        sx={(theme) => ({
          position: 'relative',
          zIndex: 5,
          bgcolor: 'transparent',
          willChange: 'transform',
          transition: 'transform 0.2s ease',
          ...(isHovered && { transform: `translate3d(-${theme.spacing(2)}, 0, 0)` }),
        })}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1 },
            transition: 'all 0.2s ease',
            ...(isHovered && { transform: 'translateX(-12px)' }),
          }}
        >
          Purchase Now
        </Box>

        <IconifyIcon
          icon="material-symbols:arrow-forward-rounded"
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: { xs: 16, sm: 20 },
            opacity: 0,
            willChange: 'right, opacity',
            transition: 'all 0.2s ease',
            ...(isHovered && { opacity: 1, right: { xs: -10, sm: -14 } }),
          }}
        />
      </Box>

      <Box
        component="span"
        sx={{
          position: 'absolute',
          inset: 0,

          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 7.5,
            animation: `${btnGlow} 5s linear infinite`,
            filter: 'blur(5px)',
          },

          '&::before': {
            zIndex: 0,
            background:
              'linear-gradient(-20deg,#00FFA2,#00FFA220 16.5%,#00FFA2 33%,#00FFA210 49.5%,#00FFA2 66%,#00FFA200 85.5%,#00FFA2 100%) 0 100% / 100% 200%',
            opacity: 1,
          },

          '&::after': {
            zIndex: 3,
            background:
              'linear-gradient(20deg,#00FFA2,transparent 16.5%,transparent 33%,transparent 49.5%,#00FFA2 66%,#00FFA260 85.5%,transparent 100%) 0 100% / 100% 200%',
            opacity: 0.2,
          },
        }}
      />
    </Link>
  );
};

export default PurchaseWidget;
