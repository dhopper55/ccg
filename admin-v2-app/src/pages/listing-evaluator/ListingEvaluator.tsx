import { Box, Paper, Stack, Typography } from '@mui/material';

const ListingEvaluator = () => {
  return (
    <Box sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
      <Paper sx={{ p: { xs: 3, md: 5 } }}>
        <Stack direction="column" spacing={2} sx={{ minWidth: 0 }}>
          <Typography variant="h4">Listing Evaluator</Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 640 }}>
            This page has not been rebuilt yet. The next version will be created here using Aurora
            components and the existing worker methods where they fit.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ListingEvaluator;
