import { Box, Button, Stack, Typography } from '@mui/material';

const Page404 = () => {
  return (
    <Stack
      sx={{
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: { xs: 2.5, sm: 5 },
      }}
    >
      <Stack
        direction="column"
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            variant="h2"
            sx={{ color: 'text.disabled', fontWeight: 'medium', mb: 2 }}
          >
            Page not found
          </Typography>
          <Typography
            variant="h5"
            sx={{ color: 'text.secondary', fontWeight: 'normal', mb: 5 }}
          >
            The page you are looking for does not exist.
          </Typography>
          <Button variant="contained" href="/" size="large" sx={{ px: 7 }}>
            Go Back Home
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};

export default Page404;
