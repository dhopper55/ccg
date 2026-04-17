import { Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import OrderCustomization from './OrderCustomization';
import Price from './Price';
import PurchaseDetails from './PurchaseDetails';
import Quantity from './Quantity';

interface ProductDetailsAsideProps {
  regularPrice?: number | null;
  salePrice?: number;
}

const ProductDetailsAside = ({ regularPrice, salePrice }: ProductDetailsAsideProps) => {
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
          <Price sx={{ height: 1 }} regularPrice={regularPrice} salePrice={salePrice} />
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
          <Quantity sx={{ height: 1 }} />
        </Grid>
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
