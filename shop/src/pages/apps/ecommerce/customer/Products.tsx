import { useEffect, useState } from 'react';
import { Box, Paper, Stack } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSearchParams } from 'react-router';
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
const PRODUCTS_PER_PAGE = 15;

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
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.toString();

  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams();
    params.set('showSold', '0');

    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    if (categoryId) {
      params.set('categoryId', categoryId);
    }

    if (search?.trim()) {
      params.set('search', search.trim());
    }

    setIsLoading(true);

    void (async () => {
      try {
        const response = await fetch(`/api/shop/products?${params.toString()}`, {
          credentials: 'same-origin',
        });
        if (!response.ok) {
          if (isMounted) {
            setProducts([]);
            setIsLoading(false);
          }
          return;
        }
        const payload = (await response.json()) as { records?: ShopProductResponse[] };
        if (!isMounted) return;
        if (!Array.isArray(payload.records)) {
          setProducts([]);
          setIsLoading(false);
          return;
        }
        setProducts(payload.records.map(mapShopProductToProductDetails));
        setIsLoading(false);
      } catch {
        if (isMounted) {
          setProducts([]);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  return (
    <ProductsProvider key={queryKey || 'default'} products={products}>
      <Products isLoading={isLoading} />
    </ProductsProvider>
  );
};

const Products = ({ isLoading }: { isLoading: boolean }) => {
  const { up } = useBreakpoints();
  const upMd = up('md');
  const [searchParams] = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(upMd ? true : false);
  const [page, setPage] = useState(1);

  const { filterItems, visibleProducts } = useProducts();
  const queryKey = searchParams.toString();
  const search = searchParams.get('search')?.trim() ?? '';
  const categoryId = searchParams.get('categoryId');
  const resultLabel = search ? `results for "${search}"` : categoryId ? 'selected category' : 'all products';
  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE));
  const pagedProducts = visibleProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  useEffect(() => {
    if (upMd) {
      setIsDrawerOpen(true);
    } else {
      setIsDrawerOpen(false);
    }
  }, [upMd]);

  useEffect(() => {
    setPage(1);
  }, [queryKey, filterItems.length, visibleProducts.length]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  return (
    <Grid container>
      {!upMd && (
        <Grid size={12}>
          <ProductTopSection
            isDrawerOpen={isDrawerOpen}
            toggleDrawer={toggleDrawer}
            resultCount={visibleProducts.length}
            resultLabel={resultLabel}
            resetKey={queryKey}
          />
        </Grid>
      )}
      <Grid size={12}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', width: 1 }}>
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
              mt: { md: 5 },
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
            <ProductsGrid
              products={pagedProducts}
              isLoading={isLoading}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </Paper>
        </Box>
      </Grid>
    </Grid>
  );
};

export default index;
