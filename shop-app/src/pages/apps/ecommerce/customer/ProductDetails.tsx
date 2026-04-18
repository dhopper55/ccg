import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  products,
  productColorVariants,
} from 'data/e-commerce/products';
import { useEcommerce } from 'providers/EcommerceProvider';
import { slugifyCategory } from 'lib/utils';
import paths from 'routes/paths';
import GeneralInfo from 'components/sections/ecommerce/customer/product-details/GeneralInfo';
import PricingBottomBar from 'components/sections/ecommerce/customer/product-details/PricingBottomBar';
import ProductDetailsAside from 'components/sections/ecommerce/customer/product-details/aside';
import ProductGallery from 'components/sections/ecommerce/customer/product-details/gallery';
import ProductInformation from 'components/sections/ecommerce/customer/product-details/information';

type ShopProduct = {
  id: string;
  mainImage: string;
  images: string[];
  saleTitle: string;
  saleUrlSlug: string;
  saleDescription: string;
  brand: string;
  model: string;
  finish: string;
  regularPrice: number | null;
  salePrice: number;
  category: string;
  primaryCategoryName: string;
  secondaryCategory: string;
  highlights: { text: string; danger?: boolean; highlight?: boolean }[];
  guitarSpecs: { label: string; value: string }[];
};

type ShopProductResponse = {
  record?: ShopProduct;
};

const normalizeSpecValue = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text || /^unknown$/i.test(text)) return '';
  return text;
};

const ProductDetails = () => {
  const { category: categoryParam, slug: slugParam } = useParams();
  const navigate = useNavigate();
  const { setProduct, product } = useEcommerce();
  const [shopProduct, setShopProduct] = useState<ShopProduct | null>(null);

  useEffect(() => {
    setProduct({ ...products[0], quantity: 1, selected: false });
  }, [setProduct]);

  useEffect(() => {
    let cancelled = false;
    const loadProduct = async () => {
      if (!slugParam) return;
      try {
        const response = await fetch(`/api/shop/products/by-slug/${encodeURIComponent(slugParam)}`);
        const data = (await response.json()) as ShopProductResponse;
        if (!cancelled) setShopProduct(data.record || null);
      } catch {
        if (!cancelled) setShopProduct(null);
      }
    };
    void loadProduct();
    return () => { cancelled = true; };
  }, [slugParam]);

  useEffect(() => {
    if (!shopProduct) return;
    const canonicalCategory = slugifyCategory(shopProduct.primaryCategoryName);
    const canonicalSlug = shopProduct.saleUrlSlug.trim();
    if (!canonicalCategory || !canonicalSlug) return;
    if (categoryParam !== canonicalCategory || slugParam !== canonicalSlug) {
      navigate(paths.productDetails(canonicalCategory, canonicalSlug), { replace: true });
    }
  }, [shopProduct, categoryParam, slugParam, navigate]);

  const [selectedVariantKey] = useState('satin-linen');

  const selectedVariant = useMemo(() => {
    return productColorVariants.find((variant) => variant.id === selectedVariantKey);
  }, [selectedVariantKey]);
  const galleryImages = shopProduct?.images?.length
    ? shopProduct.images
    : (selectedVariant?.images || []);
  const displayPrice = shopProduct
    ? shopProduct.salePrice > 0
      ? shopProduct.salePrice
      : (shopProduct.regularPrice ?? 0)
    : 0;
  const specifications = useMemo(() => {
    const categoryValues = [
      normalizeSpecValue(shopProduct?.category),
      normalizeSpecValue(shopProduct?.secondaryCategory),
    ].filter(Boolean);
    const baseSpecs = [
      categoryValues.length > 0 ? { label: 'Category', values: categoryValues } : null,
      normalizeSpecValue(shopProduct?.brand)
        ? { label: 'Brand', value: normalizeSpecValue(shopProduct?.brand) }
        : null,
      normalizeSpecValue(shopProduct?.model)
        ? { label: 'Model', value: normalizeSpecValue(shopProduct?.model) }
        : null,
      normalizeSpecValue(shopProduct?.finish)
        ? { label: 'Finish', value: normalizeSpecValue(shopProduct?.finish) }
        : null,
    ].filter(Boolean) as { label: string; value?: string; values?: string[] }[];

    const guitarSpecs = (shopProduct?.guitarSpecs || [])
      .map((item) => ({ label: item.label, value: normalizeSpecValue(item.value) }))
      .filter((item) => item.value);

    return [...baseSpecs, ...guitarSpecs];
  }, [shopProduct]);

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
          {galleryImages.length > 0 && <ProductGallery images={galleryImages} />}
        </Paper>
      </Grid>
      <Grid
        size={{
          xs: 12,
          lg: 4,
        }}
      >
        <ProductDetailsAside
          regularPrice={shopProduct?.regularPrice}
          salePrice={shopProduct?.salePrice}
          highlights={shopProduct?.highlights || []}
        />
      </Grid>
      <Grid size={12}>
        <ProductInformation
          description={shopProduct?.saleDescription}
          specifications={specifications}
        />
      </Grid>
      <Grid sx={{ position: 'sticky', zIndex: 999, width: 1, bottom: 0 }} size={12}>
        <PricingBottomBar
          imageUrl={shopProduct?.mainImage || galleryImages[0]}
          title={shopProduct?.saleTitle}
          price={displayPrice}
        />
      </Grid>
    </Grid>
  );
};

export default ProductDetails;
