import { useTranslation } from 'react-i18next';
import { Button, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

const Starter = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'grid',
        alignContent: { md: 'center' },
        height: 1,
        py: 10,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: { md: '1fr' },
        }}
      >
        <Paper
          sx={{
            gridColumn: { xs: '1/-1', md: '7/12', lg: '7/11', xl: '7/10' },
            gridRow: { md: '1/-1' },
            p: { xs: 3, lg: 5 },
            position: 'relative',
            order: { xs: 1, md: 0 },
          }}
          background={1}
        >
          <Paper sx={{ position: 'absolute', inset: 0, height: '25%', width: 1 }} />
          <Box
            sx={{
              width: 1,
              maxWidth: '25rem',
              margin: '0 auto',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                height: 240,
                borderRadius: 6,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                mb: 3,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 30% 25%, rgba(88,151,251,0.16), transparent 35%)',
                }}
              />
              <Stack sx={{ height: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 300, color: 'text.secondary' }}>
                  CCG Admin
                </Typography>
              </Stack>
            </Box>
            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                mb: 2,
                fontWeight: 500,
              }}
            >
              Edit me!
            </Typography>
            <Button variant="contained" color="primary" sx={{ width: 1 }}>
              Get Started
            </Button>
          </Box>
        </Paper>
        <Paper
          sx={{
            gridColumn: { xs: '1/-1', md: '2/7', lg: '3/7', xl: '4/7' },
            gridRow: { md: '1/-1' },
            p: { xs: 3, lg: 5 },
            position: 'relative',
          }}
        >
          <Paper
            background={1}
            sx={{
              position: 'absolute',
              inset: 0,
              height: '25%',
              width: 1,
              display: { xs: 'none', md: 'block' },
            }}
          />
          <Stack
            direction="column"
            sx={{
              justifyContent: { md: 'flex-end' },
              rowGap: 1,
              textAlign: { xs: 'center', md: 'end' },
              height: 1,
              position: 'relative',
            }}
          >
            <Typography variant="h3" sx={{ fontWeight: 'light', color: 'primary.main' }}>
              {t('create')}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'light', color: 'text.secondary' }}>
              {t('something')}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'light', color: 'text.secondary' }}>
              {t('beautiful')}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default Starter;
