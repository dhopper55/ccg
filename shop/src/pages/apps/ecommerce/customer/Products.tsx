import { useEffect, useState } from 'react';
import { Paper, Stack } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { ProductDetails } from 'types/ecommerce';
import FilterDrawer from 'components/sections/ecommerce/customer/products/FilterDrawer';
import ProductTopSection from 'components/sections/ecommerce/customer/products/ProductTopSection';
import ProductsGrid from 'components/sections/ecommerce/customer/products/ProductsGrid';
import ActiveFilters from 'components/sections/ecommerce/customer/products/filter-panel/ActiveFilters';
import ProductsProvider, {
  useProducts,
} from 'components/sections/ecommerce/customer/products/providers/ProductsProvider';

const filterDrawerWidth = 320;

type ShopProductResponse = {
  id: string;
  mainImage: string;
  saleTitle: string;
  saleUrl: string | null;
  saleCondition: string;
  regularPrice: number | null;
  salePrice: number;
  category: string;
  secondaryCategory?: string;
  isSold: boolean;
};

const defaultProductFilterOptions = {
  priceRange: [0, 5000],
  category: [],
  material: [],
  sale: [],
};

const mapShopProductToProductDetails = (product: ShopProductResponse): ProductDetails => {
  const regularPrice = Number(product.regularPrice || 0);
  const salePrice = Number(product.salePrice || 0);
  const discounted = salePrice > 0 ? salePrice : regularPrice;

  return {
    id: Number(product.id),
    name: product.saleTitle || 'Untitled Product',
    categoryLabel: product.category || '',
    categoryLabels: [product.category, product.secondaryCategory || ''].filter(Boolean),
    saleUrl: product.saleUrl,
    images: [{ src: product.mainImage || '' }],
    tags: [],
    ratings: 0,
    reviews: 0,
    price: {
      regular: regularPrice,
      discounted,
    },
    vat: 0,
    sold: 0,
    stock: 99,
    availability: ['in-stock'],
  };
};

const index = () => {
  const [products, setProducts] = useState<ProductDetails[]>([]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch('/api/shop/products?showSold=0', {
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { records?: ShopProductResponse[] };
        if (!isMounted || !Array.isArray(payload.records)) return;
        setProducts(payload.records.map(mapShopProductToProductDetails));
      } catch {
        if (isMounted) setProducts([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ProductsProvider products={products}>
      <Products />
    </ProductsProvider>
  );
};

const Products = () => {
  const { up } = useBreakpoints();
  const upMd = up('md');
  const [isDrawerOpen, setIsDrawerOpen] = useState(upMd ? true : false);

  const { filterItems, visibleProducts } = useProducts();

  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  useEffect(() => {
    if (upMd) {
      setIsDrawerOpen(true);
    } else {
      setIsDrawerOpen(false);
    }
  }, [upMd]);

  return (
    <Grid container>
      <Grid size={12}>
        <ProductTopSection isDrawerOpen={isDrawerOpen} toggleDrawer={toggleDrawer} />
      </Grid>
      <Grid size={12}>
        <Stack>
          <FilterDrawer
            handleClose={closeDrawer}
            open={isDrawerOpen}
            drawerWidth={filterDrawerWidth}
            filterOptions={defaultProductFilterOptions}
          />
          <Paper
            sx={(theme) => ({
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              marginLeft: { md: `-${filterDrawerWidth}px` },
              transition: theme.transitions.create('margin', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              ...(isDrawerOpen && {
                transition: theme.transitions.create('margin', {
                  easing: theme.transitions.easing.easeOut,
                  duration: theme.transitions.duration.enteringScreen,
                }),
                marginLeft: 0,
              }),
            })}
          >
            {filterItems.length > 0 && <ActiveFilters />}
            <ProductsGrid products={visibleProducts} />
          </Paper>
        </Stack>
      </Grid>
    </Grid>
  );
};

export default index;
