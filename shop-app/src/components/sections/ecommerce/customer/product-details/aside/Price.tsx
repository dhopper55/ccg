import { useMemo } from 'react';
import { Chip, Paper, Stack, SxProps, Typography } from '@mui/material';
import useNumberFormat from 'hooks/useNumberFormat';

interface PriceProps {
  sx?: SxProps;
  regularPrice?: number | null;
  salePrice?: number;
  isUnavailable?: boolean;
}

const Price = ({ sx, regularPrice = 0, salePrice = 0, isUnavailable = false }: PriceProps) => {
  const { currencyFormat } = useNumberFormat();
  const displayPrice = salePrice > 0 ? salePrice : (regularPrice ?? 0);
  const hasDiscount =
    salePrice > 0 && regularPrice != null && regularPrice > salePrice && regularPrice !== salePrice;
  const savings = hasDiscount ? regularPrice - salePrice : 0;
  const savingsPercentage = hasDiscount ? Math.ceil((savings / regularPrice) * 100) : 0;

  const discountPrice = useMemo(() => {
    const formattedPrice = currencyFormat(displayPrice);

    return [formattedPrice.slice(0, 1), formattedPrice.slice(1, -3), formattedPrice.slice(-3)];
  }, [currencyFormat, displayPrice]);

  return (
    <Paper
      sx={{
        p: { xs: 3, md: 5 },
        display: 'flex',
        gap: 2,
        flexDirection: 'column',
        ...sx,
      }}
    >
      {isUnavailable ? (
        <Typography
          variant="h2"
          sx={{
            color: 'error.main',
            fontSize: { xs: 'h3.fontSize', md: 'h2.fontSize' },
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          SOLD
        </Typography>
      ) : (
        <>
      <Typography variant="h2" sx={{ fontSize: 'h1.fontSize' }}>
        <Typography variant="h5" component="span">
          {discountPrice[0]}
        </Typography>
        {discountPrice[1]}
        <Typography variant="h5" component="span">
          {discountPrice[2]}
        </Typography>
      </Typography>
      {hasDiscount && (
        <Stack
          sx={{
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Chip label={`Save ${savingsPercentage}%`} color="success" variant="filled" />
          <Typography
            variant="h6"
            sx={{
              color: 'error.main',
              fontWeight: 'medium',
              textDecoration: 'line-through',
            }}
          >
            {currencyFormat(regularPrice)}
          </Typography>
        </Stack>
      )}
        </>
      )}
    </Paper>
  );
};

export default Price;
