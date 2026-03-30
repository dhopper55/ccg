import { PropsWithChildren } from 'react';
import {
  Box,
  Chip,
  Link,
  Stack,
  SxProps,
  Typography,
} from '@mui/material';
import { currencyFormat, kebabCase } from 'lib/utils';
import { ProductDetails } from 'types/ecommerce';
import Image from 'components/base/Image';

interface ProductCardProps {
  product: ProductDetails;
  sx?: SxProps;
}

const ProductCard = ({ product, sx, children }: PropsWithChildren<ProductCardProps>) => {
  const image = product.images[0]?.src || '';
  const regularPrice = Number(product.price.regular || 0);
  const displayPrice = Number(product.price.discounted || 0);
  const isOnSale = displayPrice > 0 && regularPrice > displayPrice;
  const savingsPercent = isOnSale ? Math.round(((regularPrice - displayPrice) / regularPrice) * 100) : 0;
  const categoryLabels = (product.categoryLabels && product.categoryLabels.length > 0
    ? product.categoryLabels
    : product.categoryLabel
      ? [product.categoryLabel]
      : []).filter(Boolean);

  return (
    <Stack
      component={Link}
      href="#"
      underline="none"
      direction="column"
      sx={{
        justifyContent: 'space-between',
        height: 1,
        color: 'currentcolor',
        textAlign: 'center',
        p: { xs: 3, lg: 5 },
        borderRadius: 2,
        '&:hover': {
          bgcolor: 'background.elevation1',
        },

        ...sx,
      }}
    >
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ position: 'relative', height: 240, width: 1, mb: 2 }}>
          <Image
            src={image}
            alt={kebabCase(product.name)}
            sx={{ objectFit: 'contain', height: 1, width: 1 }}
          />
        </Box>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            lineClamp: 2,
            mb: 1,
          }}
        >
          {product.name}
        </Typography>
        {categoryLabels.length ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
          >
            {categoryLabels.map((label) => (
              <Chip
                key={label}
                label={label}
                size="small"
                variant="outlined"
                sx={{
                  color: 'text.secondary',
                  borderColor: 'divider',
                  bgcolor: 'background.elevation1',
                  borderRadius: 999,
                  '& .MuiChip-label': {
                    px: 1.25,
                  },
                }}
              />
            ))}
          </Stack>
        ) : null}
      </Box>
      <div>
        <Typography
          variant="h4"
          sx={{
            lineHeight: 1.5,
            mb: 0.5,
          }}
        >
          {currencyFormat(displayPrice)}
        </Typography>
        {isOnSale ? (
          <Stack
            sx={{
              gap: 0.5,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                color: 'text.secondary',
                textDecoration: 'line-through',
              }}
            >
              {currencyFormat(regularPrice)}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'success.main',
                fontWeight: 600,
                px: 1.25,
                py: 0.375,
                borderRadius: 999,
                border: 1,
                borderColor: 'rgba(37, 208, 167, 0.35)',
                bgcolor: 'rgba(37, 208, 167, 0.12)',
              }}
            >
              Save {savingsPercent}%
            </Typography>
          </Stack>
        ) : null}
        {children}
      </div>
    </Stack>
  );
};

export default ProductCard;
