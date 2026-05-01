import { useMemo } from 'react';
import { Chip, Paper, Stack, SxProps, Typography } from '@mui/material';
import useNumberFormat from 'hooks/useNumberFormat';

interface PriceProps {
  sx?: SxProps;
  regularPrice?: number | null;
  salePrice?: number;
  clearance?: boolean;
  isUnavailable?: boolean;
}

const Price = ({
  sx,
  regularPrice = 0,
  salePrice = 0,
  clearance = false,
  isUnavailable = false,
}: PriceProps) => {
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
        p: { xs: 2.5, md: 3 },
        display: 'flex',
        gap: 1.5,
        flexDirection: 'column',
        alignItems: 'flex-start',
        minHeight: 0,
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
          {clearance && (
            <Chip
              label="CLEARANCE"
              color="warning"
              variant="filled"
              sx={{
                alignSelf: 'flex-start',
                height: 32,
                px: 0.75,
                '& .MuiChip-label': {
                  fontSize: 16,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: 0,
                  px: 0.75,
                },
              }}
            />
          )}
          <Stack
            direction="row"
            sx={{
              alignItems: 'baseline',
              gap: { xs: 1.5, md: 2 },
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: 'h4.fontSize', md: 'h2.fontSize' }, lineHeight: 1 }}
            >
              <Typography variant="h6" component="span" sx={{ verticalAlign: 'baseline' }}>
                {discountPrice[0]}
              </Typography>
              {discountPrice[1]}
              <Typography variant="h6" component="span" sx={{ verticalAlign: 'baseline' }}>
                {discountPrice[2]}
              </Typography>
            </Typography>
            {hasDiscount && (
              <Typography
                variant="subtitle1"
                sx={{
                  color: 'error.main',
                  fontWeight: 'medium',
                  textDecoration: 'line-through',
                  whiteSpace: 'nowrap',
                }}
              >
                {currencyFormat(regularPrice)}
              </Typography>
            )}
            {hasDiscount && (
              <Chip
                label={`Save ${savingsPercentage}%`}
                color="success"
                variant="filled"
                size="small"
              />
            )}
          </Stack>
        </>
      )}
    </Paper>
  );
};

export default Price;
