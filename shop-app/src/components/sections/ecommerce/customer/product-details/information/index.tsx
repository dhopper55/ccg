import { Box, Divider, Paper, Tab, Tabs, Toolbar } from '@mui/material';
import ProductDescription from './ProductDescription';
import ProductSpecification from './ProductSpecification';

interface ProductInformationProps {
  description?: string;
  specifications: { label: string; value?: string; values?: string[] }[];
}

const ProductInformation = ({ description, specifications }: ProductInformationProps) => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Box
        sx={(theme) => ({
          width: 1,
          position: 'sticky',
          zIndex: 10,
          py: 1,
          top: theme.mixins.ecommerceTopbar,
          bgcolor: 'background.default',
        })}
      >
        <Tabs value="desc" aria-label="product information tabs">
          <Tab value="desc" label="Description" />
        </Tabs>
      </Box>
      <Toolbar sx={{ minHeight: { xs: 40 } }} />
      <ProductDescription description={description} />
      <Divider sx={{ my: 5 }} />
      <ProductSpecification specifications={specifications} />
    </Paper>
  );
};

export default ProductInformation;
