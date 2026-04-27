import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import { slugifyCategory } from 'lib/utils';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import { useEcommerce } from 'providers/EcommerceProvider';
import paths from 'routes/paths';
import { ProductDetails as CartProductDetails } from 'types/ecommerce';
import GeneralInfo from 'components/sections/ecommerce/customer/product-details/GeneralInfo';
import PricingBottomBar from 'components/sections/ecommerce/customer/product-details/PricingBottomBar';
import ProductDetailsAside from 'components/sections/ecommerce/customer/product-details/aside';
import ProductGallery from 'components/sections/ecommerce/customer/product-details/gallery';
import ProductInformation from 'components/sections/ecommerce/customer/product-details/information';

type ShopProduct = {
  id: string;
  ccgNumber?: string;
  mainImage: string;
  images: string[];
  saleTitle: string;
  saleUrlSlug: string;
  saleZip: string;
  saleDescription: string;
  brand: string;
  model: string;
  finish: string;
  regularPrice: number | null;
  salePrice: number;
  clearance: boolean;
  onlyInStore: boolean;
  category: string;
  primaryCategoryName: string;
  secondaryCategory: string;
  quantity: number;
  forSale: boolean;
  isSold: boolean;
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
  const { addItemToCart } = useEcommerce();
  const { isAssociateMode, isCheckingAssociateMode } = useAssociateMode();
  const [shopProduct, setShopProduct] = useState<ShopProduct | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const loadProduct = async () => {
      if (isCheckingAssociateMode) {
        setIsLoadingProduct(true);
        return;
      }
      if (!slugParam) {
        setIsLoadingProduct(false);
        return;
      }
      setIsLoadingProduct(true);
      try {
        const query = isAssociateMode ? '?associate=1' : '';
        const response = await fetch(`/api/shop/products/by-slug/${encodeURIComponent(slugParam)}${query}`);
        const data = (await response.json()) as ShopProductResponse;
        if (!cancelled) setShopProduct(data.record || null);
      } catch {
        if (!cancelled) setShopProduct(null);
      } finally {
        if (!cancelled) setIsLoadingProduct(false);
      }
    };
    void loadProduct();
    return () => { cancelled = true; };
  }, [isAssociateMode, isCheckingAssociateMode, slugParam]);

  useEffect(() => {
    if (!shopProduct) return;
    const canonicalCategory = slugifyCategory(shopProduct.primaryCategoryName);
    const canonicalSlug = shopProduct.saleUrlSlug.trim();
    if (!canonicalCategory || !canonicalSlug) return;
    if (categoryParam !== canonicalCategory || slugParam !== canonicalSlug) {
      navigate(paths.productDetails(canonicalCategory, canonicalSlug), { replace: true });
    }
  }, [shopProduct, categoryParam, slugParam, navigate]);

  const galleryImages = shopProduct?.images || [];
  const isUnavailable = Boolean(shopProduct?.isSold || !shopProduct?.forSale);
  const availableQuantity = shopProduct ? Math.max(1, Number(shopProduct.quantity || 1)) : 1;
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

  const cartProduct = useMemo<CartProductDetails | null>(() => {
    if (!shopProduct) return null;
    const categorySlug = slugifyCategory(shopProduct.primaryCategoryName);
    const productSlug = shopProduct.saleUrlSlug.trim();
    const regularPrice = shopProduct.regularPrice ?? shopProduct.salePrice;
    const productUrl =
      categorySlug && productSlug ? paths.productDetails(categorySlug, productSlug) : paths.products;

    return {
      id: Number(shopProduct.id),
      ccgNumber: shopProduct.ccgNumber,
      name: shopProduct.saleTitle,
      productUrl,
      images: (galleryImages.length > 0 ? galleryImages : [shopProduct.mainImage])
        .filter(Boolean)
        .map((src) => ({ src })),
      tags: [],
      ratings: 0,
      reviews: 0,
      price: {
        regular: regularPrice,
        discounted: displayPrice,
        offer:
          regularPrice > displayPrice && regularPrice > 0
            ? `${Math.ceil(((regularPrice - displayPrice) / regularPrice) * 100)}%`
            : undefined,
      },
      vat: 0,
      sold: 0,
      stock: isUnavailable ? 0 : availableQuantity,
      availability: isUnavailable ? ['Sold'] : [shopProduct.onlyInStore ? 'In store only' : 'In stock'],
      category: [shopProduct.category, shopProduct.secondaryCategory].filter(Boolean),
      features: shopProduct.highlights.map((highlight) => highlight.text).filter(Boolean),
    };
  }, [availableQuantity, displayPrice, galleryImages, isUnavailable, shopProduct]);

  const handleAddToCart = () => {
    if (!cartProduct || isUnavailable) return;
    addItemToCart(cartProduct, Math.min(quantity, availableQuantity));
  };

  if (isLoadingProduct || !shopProduct) {
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
          clearance={Boolean(shopProduct?.clearance)}
          highlights={shopProduct?.highlights || []}
          isUnavailable={isUnavailable}
          quantity={quantity}
          maxQuantity={availableQuantity}
          onQuantityChange={(nextQuantity) => setQuantity(Math.min(nextQuantity, availableQuantity))}
        />
      </Grid>
      <Grid size={12}>
        <ProductInformation
          description={shopProduct?.saleDescription}
          specifications={specifications}
          pickupZip={shopProduct?.saleZip}
        />
      </Grid>
      <Grid sx={{ position: 'sticky', zIndex: 999, width: 1, bottom: 0 }} size={12}>
        <PricingBottomBar
          imageUrl={shopProduct?.mainImage || galleryImages[0]}
          title={shopProduct?.saleTitle}
          price={displayPrice}
          disabled={isUnavailable}
          onAddToCart={handleAddToCart}
        />
      </Grid>
    </Grid>
  );
};

export default ProductDetails;
