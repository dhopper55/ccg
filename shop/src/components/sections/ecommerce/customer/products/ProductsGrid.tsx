import { Box, CircularProgress, Pagination, Stack, Typography } from '@mui/material';
import illustrationDark from 'assets/images/illustrations/1-dark.webp';
import illustration from 'assets/images/illustrations/1.webp';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { ProductDetails } from 'types/ecommerce';
import Image from 'components/base/Image';
import ProductCard from '../common/ProductCard';

interface ProductsGridProps {
  products: ProductDetails[];
  isLoading?: boolean;
}

const ProductsGrid = ({ products, isLoading = false }: ProductsGridProps) => {
  const { up } = useBreakpoints();
  const upSm = up('sm');

  return (
    <>
      <Box sx={{ flex: 1 }}>
        {isLoading ? (
          <Stack
            direction="column"
            sx={{
              minHeight: 520,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              textAlign: 'center',
              p: 5,
              bgcolor: 'transparent',
            }}
          >
            <CircularProgress size={40} thickness={4} />
          </Stack>
        ) : products.length > 0 ? (
          <Box
            sx={{
              p: 2,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            }}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Box>
        ) : (
          <Stack
            direction="column"
            sx={{
              height: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 3,
              textAlign: 'center',
              p: 5,
            }}
          >
            <Image
              src={{
                light: illustration,
                dark: illustrationDark,
              }}
              alt="Products Fallback"
              height={340}
              width={340}
            />
            <Typography variant="h5" maxWidth={540} color="text.secondary">
              Whoops, looks like we didn't find any matches for your search, so here’s a dinosaur in
              a box.
            </Typography>
          </Stack>
        )}
      </Box>

      <Stack
        sx={{
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Pagination
          variant="solid"
          color="primary"
          showFirstButton
          showLastButton
          count={10}
          siblingCount={upSm ? 1 : 0}
        />
      </Stack>
    </>
  );
};

export default ProductsGrid;
