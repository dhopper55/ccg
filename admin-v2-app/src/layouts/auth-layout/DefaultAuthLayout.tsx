import { PropsWithChildren } from 'react';
import { Box, Stack } from '@mui/material';
import Grid from '@mui/material/Grid';
import Logo from 'components/common/Logo';

const DefaultAuthLayout = ({ children }: PropsWithChildren) => {
  return (
    <Grid
      container
      sx={{
        height: { md: '100vh' },
        minHeight: '100vh',
        flexDirection: {
          xs: 'column',
          md: 'row',
        },
      }}
    >
      <Grid
        sx={{
          borderRight: { md: 1 },
          borderColor: { md: 'divider' },
        }}
        size={{
          xs: 12,
          md: 6,
        }}
      >
        <Stack
          direction="column"
          sx={{
            height: 1,
            p: { xs: 3, sm: 5 },
          }}
        >
          <Stack
            sx={{
              justifyContent: { xs: 'center', md: 'flex-start' },
              mb: { xs: 5, md: 0 },
            }}
          >
            <Logo />
          </Stack>

          <Stack
            sx={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              display: { xs: 'none', md: 'flex', flexDirection: 'row-reverse' },
              transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : 'unset'),
            }}
          >
            <Stack
              sx={{
                width: 1,
                maxWidth: 420,
                aspectRatio: '3 / 2',
                borderRadius: 6,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Stack
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at top left, rgba(88,151,251,0.16), transparent 40%)',
                }}
              />
              <Box
                component="img"
                src="/images/coal-creek-logo.png"
                alt="Coal Creek Guitars"
                sx={{
                  position: 'relative',
                  width: 1,
                  height: 1,
                  objectFit: 'cover',
                }}
              />
            </Stack>
          </Stack>
        </Stack>
      </Grid>
      <Grid
        size={{
          md: 6,
          xs: 12,
        }}
        sx={{
          display: { xs: 'flex', md: 'block' },
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {children}
      </Grid>
    </Grid>
  );
};

export default DefaultAuthLayout;
