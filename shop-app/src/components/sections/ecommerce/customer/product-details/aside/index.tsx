import { Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import Highlights, { ProductHighlight } from './Highlights';
import OrderCustomization from './OrderCustomization';
import Price from './Price';
import PurchaseDetails from './PurchaseDetails';

interface ProductDetailsAsideProps {
  regularPrice?: number | null;
  salePrice?: number;
  highlights: ProductHighlight[];
}

const ProductDetailsAside = ({ regularPrice, salePrice, highlights }: ProductDetailsAsideProps) => {
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
          <Highlights sx={{ height: 1 }} highlights={highlights} />
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
