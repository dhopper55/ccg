import { Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import Highlights, { ProductHighlight } from './Highlights';
import OrderCustomization from './OrderCustomization';
import Price from './Price';
import PurchaseDetails from './PurchaseDetails';
import Quantity from './Quantity';

interface ProductDetailsAsideProps {
  regularPrice?: number | null;
  salePrice?: number;
  clearance?: boolean;
  highlights: ProductHighlight[];
  isUnavailable?: boolean;
  quantity: number;
  maxQuantity?: number;
  onQuantityChange: (quantity: number) => void;
}

const ProductDetailsAside = ({
  regularPrice,
  salePrice,
  clearance = false,
  highlights,
  isUnavailable = false,
  quantity,
  maxQuantity,
  onQuantityChange,
}: ProductDetailsAsideProps) => {
  return (
    <Paper>
      <Grid container>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 4,
            lg: 12,
            xl: 6,
          }}
        >
          <Price
            sx={{ height: 1 }}
            regularPrice={regularPrice}
            salePrice={salePrice}
            clearance={clearance}
            isUnavailable={isUnavailable}
          />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 4,
            lg: 12,
            xl: 6,
          }}
        >
          <Highlights sx={{ height: 1 }} highlights={highlights} />
        </Grid>
        {!isUnavailable && (
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 4,
              lg: 12,
              xl: 6,
            }}
          >
            <Quantity
              sx={{ height: 1 }}
              quantity={quantity}
              max={maxQuantity}
              disabled={isUnavailable}
              onChange={onQuantityChange}
            />
          </Grid>
        )}
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 12,
          }}
        >
          <PurchaseDetails sx={{ height: 1 }} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 12,
          }}
        >
          <OrderCustomization sx={{ height: 1 }} />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ProductDetailsAside;
