import { useEffect, useState } from 'react';
import { Box, Button, FormControl, MenuItem, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';
import StyledTextField from 'components/styled/StyledTextField';
import { useProducts } from './providers/ProductsProvider';

interface FilterHeadProps {
  toggleDrawer: () => void;
  isDrawerOpen: boolean;
  resultLabel: string;
  resultCount: number;
  resetKey: string;
}

const sortByOptions = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'lowToHight', label: 'Price Low-High' },
  { value: 'highToLow', label: 'Price High-Low' },
  { value: 'highestRated', label: 'Highest rated' },
];

const ProductTopSection = ({
  isDrawerOpen,
  toggleDrawer,
  resultLabel,
  resultCount,
  resetKey,
}: FilterHeadProps) => {
  const [sortBy, setSortBy] = useState('recommended');

  const { handleProductsSort } = useProducts();

  useEffect(() => {
    setSortBy('recommended');
  }, [resetKey]);

  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Grid
        container
        spacing={2}
        sx={{
          alignItems: 'center',
        }}
      >
        <Grid
          sx={{
            order: { lg: 1 },
          }}
          size={{
            xs: 12,
            lg: 'auto',
          }}
        >
          <Typography variant="h6">
            Showing
            <Box
              component="span"
              sx={{
                fontWeight: 'medium',
                ml: 1.5,
              }}
            >
              {resultLabel}
            </Box>
          </Typography>
        </Grid>

        <Grid size="auto">
          <Button
            onClick={toggleDrawer}
            variant="soft"
            sx={{
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Box
              component="span"
              sx={{
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {isDrawerOpen ? 'Hide filters' : 'Show filters'}
            </Box>
            <IconifyIcon icon="material-symbols:filter-alt-outline" sx={{ fontSize: '20px' }} />
          </Button>
        </Grid>

        <Grid
          sx={{
            ml: 'auto',
            flexGrow: 1,
            order: { lg: 1 },
          }}
          size="auto"
        >
          <Stack
            sx={{
              alignItems: 'center',
              gap: 2,
              justifyContent: 'flex-end',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'nowrap',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {resultCount} results
            </Typography>
            <FormControl sx={{ maxWidth: 160, width: 1 }}>
              <StyledTextField
                select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value);
                  handleProductsSort(event.target.value);
                }}
              >
                {sortByOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </StyledTextField>
            </FormControl>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ProductTopSection;
