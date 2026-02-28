import { PropsWithChildren, Suspense } from 'react';
import { Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import Logo from 'components/common/Logo';
import DefaultLoader from 'components/loading/DefaultLoader';

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
            justifyContent: 'space-between',
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
                minHeight: 280,
                borderRadius: 6,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                position: 'relative',
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                px: 6,
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
              <Typography
                variant="h3"
                sx={{ position: 'relative', textAlign: 'center', fontWeight: 600 }}
              >
                CCG Admin
              </Typography>
            </Stack>
          </Stack>

          <Stack
            sx={{
              justifyContent: 'center',
              gap: 1,
              textAlign: { xs: 'center', md: 'left' },
            }}
          >
            <Typography variant="h4">Coal Creek Guitars Admin</Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 420 }}>
              Sign in with your existing admin username and password to access the new admin.
            </Typography>
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
        <Suspense fallback={<DefaultLoader />}>{children}</Suspense>
      </Grid>
    </Grid>
  );
};

export default DefaultAuthLayout;
