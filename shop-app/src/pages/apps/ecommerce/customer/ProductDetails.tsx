import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Box, Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  featuredProducts,
  products,
  productColorVariants,
  suggestedProducts,
} from 'data/e-commerce/products';
import { useEcommerce } from 'providers/EcommerceProvider';
import SuggestedProducts from 'components/sections/ecommerce/customer/common/SuggestedProducts';
import GeneralInfo from 'components/sections/ecommerce/customer/product-details/GeneralInfo';
import PricingBottomBar from 'components/sections/ecommerce/customer/product-details/PricingBottomBar';
import ProductDetailsAside from 'components/sections/ecommerce/customer/product-details/aside';
import FrequentProducts from 'components/sections/ecommerce/customer/product-details/aside/FrequentProducts';
import ProductGallery from 'components/sections/ecommerce/customer/product-details/gallery';
import ProductInformation from 'components/sections/ecommerce/customer/product-details/information';

type ShopProduct = {
  id: string;
  saleTitle: string;
  category: string;
  secondaryCategory: string;
};

type ShopProductsResponse = {
  records: ShopProduct[];
};

const ProductDetails = () => {
  const { id } = useParams();
  const { setProduct, product } = useEcommerce();
  const [shopProduct, setShopProduct] = useState<ShopProduct | null>(null);

  useEffect(() => {
    setProduct({ ...products[0], quantity: 1, selected: false });
  }, [setProduct]);

  useEffect(() => {
    let cancelled = false;
    const loadProduct = async () => {
      if (!id) return;
      try {
        const response = await fetch('/api/shop/products');
        const data = (await response.json()) as ShopProductsResponse;
        const record = Array.isArray(data.records)
          ? data.records.find((item) => item.id === id)
          : null;
        if (!cancelled) setShopProduct(record || null);
      } catch {
        if (!cancelled) setShopProduct(null);
      }
    };
    void loadProduct();
    return () => { cancelled = true; };
  }, [id]);

  const [selectedVariantKey, setSelectedVariantKey] = useState('satin-linen');

  const selectedVariant = useMemo(() => {
    return productColorVariants.find((variant) => variant.id === selectedVariantKey);
  }, [selectedVariantKey]);

  const handleSelectedVariantKey = (value: string) => setSelectedVariantKey(value);

  if (!product) {
    return null;
  }

  return (
    <Grid container>
      <Grid
        size={{
          xs: 12,
          lg: 8,
        }}
      >
        <Paper
          sx={(theme) => ({
            position: 'sticky',
            height: { lg: `calc(100vh - ${theme.mixins.ecommerceTopbar.md}px - 58px)` },
            top: theme.mixins.ecommerceTopbar,
            p: { xs: 3, md: 5 },
            display: 'flex',
            overflow: 'hidden',
            flexDirection: 'column',
          })}
        >
          <GeneralInfo
            sx={{ mb: 5 }}
            category={shopProduct?.category}
            secondaryCategory={shopProduct?.secondaryCategory}
            title={shopProduct?.saleTitle}
          />
          {selectedVariant && <ProductGallery images={selectedVariant.images} />}
        </Paper>
      </Grid>
      <Grid
        size={{
          xs: 12,
          lg: 4,
        }}
      >
        <ProductDetailsAside
          selectedVariantKey={selectedVariantKey}
          handleSelectedVariantKey={handleSelectedVariantKey}
        />
      </Grid>
      <Grid
        size={{
          xs: 12,
          lg: 8,
        }}
      >
        <ProductInformation />
      </Grid>
      <Grid
        size={{
          xs: 12,
          lg: 4,
        }}
      >
        <Box
          sx={(theme) => ({
            position: 'sticky',
            top: theme.mixins.ecommerceTopbar,
            p: { xs: 3, md: 5 },
          })}
        >
          <FrequentProducts frequentProducts={featuredProducts} />
        </Box>
      </Grid>
      <Grid sx={{ position: 'sticky', zIndex: 999, width: 1, bottom: 0 }} size={12}>
        <PricingBottomBar />
      </Grid>
      <Grid size={12}>
        <Paper sx={{ p: { xs: 3, md: 5 } }}>
          <SuggestedProducts products={suggestedProducts} />
        </Paper>
      </Grid>
    </Grid>
  );
};

export default ProductDetails;
