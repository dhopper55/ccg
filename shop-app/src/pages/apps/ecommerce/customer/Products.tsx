import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useAssociateMode } from 'providers/AssociateModeProvider';
import paths from 'routes/paths';
import { slugifyCategory } from 'lib/utils';
import FilterDrawer from 'components/sections/ecommerce/customer/products/FilterDrawer';
import ProductsProvider from 'components/sections/ecommerce/customer/products/providers/ProductsProvider';
import IconifyIcon from 'components/base/IconifyIcon';
import { ProductFilterOptions } from 'types/ecommerce';

type ShopProduct = {
  id: string;
  mainImage: string;
  saleTitle: string;
  saleUrlSlug: string;
  saleCondition: string;
  regularPrice: number | null;
  salePrice: number;
  category: string;
  primaryCategoryName: string;
  secondaryCategory: string;
  onlyInStore: boolean;
  isSold: boolean;
};

type ShopProductsResponse = {
  records: ShopProduct[];
};

type ShopCategoryNode = {
  id: number;
  name: string;
  path?: string;
  children?: ShopCategoryNode[];
};

type ShopCategoriesResponse = {
  tree?: ShopCategoryNode[];
};

const PAGE_SIZE = 20;
const filterDrawerWidth = 320;

const index = () => (
  <ProductsProvider products={[]}>
    <Products />
  </ProductsProvider>
);

const Products = () => {
  const { up } = useBreakpoints();
  const upMd = up('md');
  const { isAssociateMode, isCheckingAssociateMode } = useAssociateMode();
  const [isDrawerOpen, setIsDrawerOpen] = useState(upMd);
  const [allProducts, setAllProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategoryNode[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const { control, setValue } = useFormContext();
  const [searchParams] = useSearchParams();
  const searchTerm = (searchParams.get('search') ?? '').trim();
  const categoryParam = (searchParams.get('category') ?? '').trim();
  const priceRange = useWatch({ control, name: 'priceRange' }) as number[] | undefined;
  const selectedCategoryIds = useWatch({ control, name: 'category', defaultValue: [] }) as string[];
  const didInitializePriceRange = useRef(false);
  const previousSearchTerm = useRef(searchTerm);

  useEffect(() => {
    if (upMd) setIsDrawerOpen(true);
    else setIsDrawerOpen(false);
  }, [upMd]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/shop/categories');
        const data = (await res.json()) as ShopCategoriesResponse;
        if (!cancelled) setCategories(Array.isArray(data.tree) ? data.tree : []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const filterOptions = useMemo<ProductFilterOptions>(() => {
    return {
      category: flattenCategoryOptions(categories),
      price: [0, Math.max(maxPrice, 1)],
    };
  }, [categories, maxPrice]);

  useEffect(() => {
    if (!didInitializePriceRange.current && maxPrice > 0) {
      didInitializePriceRange.current = true;
      setValue('priceRange', [0, maxPrice]);
    }
  }, [maxPrice, setValue]);

  useEffect(() => {
    if (previousSearchTerm.current === searchTerm) return;
    previousSearchTerm.current = searchTerm;
    setValue('category', []);
    if (maxPrice > 0) {
      setValue('priceRange', [0, maxPrice]);
    }
  }, [maxPrice, searchTerm, setValue]);

  useEffect(() => {
    if (!categoryParam || categories.length === 0) return;
    const normalizedParam = normalizeCategoryQuery(categoryParam);
    const matchedCategory = flattenCategoryNodes(categories).find((node) => {
      return (
        normalizeCategoryQuery(node.name) === normalizedParam ||
        normalizeCategoryQuery(node.path || '') === normalizedParam
      );
    });
    if (!matchedCategory) return;
    setValue('category', [String(matchedCategory.id)]);
  }, [categories, categoryParam, setValue]);

  useEffect(() => {
    didInitializePriceRange.current = false;
    setMaxPrice(0);
    setValue('priceRange', [0, 0]);
  }, [isAssociateMode, setValue]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isCheckingAssociateMode) {
        setIsLoading(true);
        return;
      }
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (isAssociateMode) {
          params.set('associate', '1');
        }
        if (searchTerm) {
          params.set('search', searchTerm);
        }
        for (const categoryId of selectedCategoryIds || []) {
          params.append('categoryIds', categoryId);
        }

        if (Array.isArray(priceRange) && priceRange.length === 2) {
          const [min, max] = priceRange;
          if (min > 0 || (maxPrice > 0 && max < maxPrice)) {
            params.set('priceMin', String(min || 0));
            params.set('priceMax', String(max || 0));
          }
        }

        const query = params.toString();
        const res = await fetch(`/api/shop/products${query ? `?${query}` : ''}`);
        const data = (await res.json()) as ShopProductsResponse;
        if (cancelled) return;
        const records = Array.isArray(data.records) ? data.records : [];
        setAllProducts(records);
        if (maxPrice === 0 && (!selectedCategoryIds || selectedCategoryIds.length === 0)) {
          setMaxPrice(getHighestProductPrice(records));
        }
        setPage(1);
      } catch {
        if (!cancelled) setAllProducts([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isAssociateMode, isCheckingAssociateMode, maxPrice, priceRange, searchTerm, selectedCategoryIds]);

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PAGE_SIZE));
  const visibleProducts = allProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  return (
    <Grid container>
      <Grid size={12}>
        <Stack>
          <FilterDrawer
            handleClose={() => setIsDrawerOpen(false)}
            open={isDrawerOpen}
            drawerWidth={filterDrawerWidth}
            filterOptions={filterOptions}
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
            {isLoading ? (
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 12 }}>
                <CircularProgress />
              </Stack>
            ) : allProducts.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography sx={{ color: 'text.secondary' }}>No products available.</Typography>
              </Box>
            ) : (
              <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
                <Grid container spacing={3}>
                  {visibleProducts.map((product) => (
                    <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                      <ProductCard product={product} />
                    </Grid>
                  ))}
                </Grid>

                {totalPages > 1 && (
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'center', alignItems: 'center', gap: 2, mt: 4 }}
                  >
                    <Button
                      variant="outlined"
                      color="neutral"
                      size="small"
                      disabled={page <= 1}
                      onClick={handlePrev}
                      startIcon={<IconifyIcon icon="material-symbols:chevron-left-rounded" />}
                    >
                      Previous
                    </Button>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Page {page} of {totalPages}
                    </Typography>
                    <Button
                      variant="outlined"
                      color="neutral"
                      size="small"
                      disabled={page >= totalPages}
                      onClick={handleNext}
                      endIcon={<IconifyIcon icon="material-symbols:chevron-right-rounded" />}
                    >
                      Next
                    </Button>
                  </Stack>
                )}
              </Box>
            )}
          </Paper>
        </Stack>
      </Grid>
    </Grid>
  );
};

function flattenCategoryOptions(nodes: ShopCategoryNode[], depth = 0): { label: string; value: string }[] {
  return nodes.flatMap((node) => [
    {
      label: node.path || `${depth > 0 ? `${'  '.repeat(depth)}- ` : ''}${node.name}`,
      value: String(node.id),
    },
    ...flattenCategoryOptions(Array.isArray(node.children) ? node.children : [], depth + 1),
  ]);
}

function flattenCategoryNodes(nodes: ShopCategoryNode[]): ShopCategoryNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCategoryNodes(Array.isArray(node.children) ? node.children : []),
  ]);
}

function normalizeCategoryQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getHighestProductPrice(products: ShopProduct[]): number {
  return products.reduce((max, product) => {
    const price = product.salePrice > 0 ? product.salePrice : (product.regularPrice ?? 0);
    return Math.max(max, price);
  }, 0);
}

function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function calcDiscount(regular: number, sale: number): number {
  if (regular <= 0 || sale <= 0 || sale >= regular) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}

const ProductCard = ({ product }: { product: ShopProduct }) => {
  const { mainImage, saleTitle, salePrice, regularPrice, category, secondaryCategory, onlyInStore } = product;
  const hasDiscount = regularPrice != null && regularPrice > 0 && salePrice > 0 && salePrice < regularPrice;
  const discount = hasDiscount ? calcDiscount(regularPrice!, salePrice) : 0;
  const displayPrice = salePrice > 0 ? salePrice : (regularPrice ?? 0);

  const categorySlug = slugifyCategory(product.primaryCategoryName);
  const productSlug = product.saleUrlSlug.trim();
  const productUrl =
    categorySlug && productSlug ? paths.productDetails(categorySlug, productSlug) : '#';

  return (
    <Card
      component={RouterLink}
      to={productUrl}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        color: 'inherit',
        textDecoration: 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardMedia
        component="img"
        image={mainImage || undefined}
        alt={saleTitle}
        loading="lazy"
        decoding="async"
        sx={{
          height: 240,
          objectFit: 'contain',
          bgcolor: 'background.elevation1',
          p: 1,
        }}
      />
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          flexGrow: 1,
          gap: 1,
          px: 2,
          pb: 3,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {saleTitle}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {onlyInStore && <Chip label="In store only" color="warning" size="small" />}
          {category && <Chip label={category} size="small" variant="outlined" />}
          {secondaryCategory && <Chip label={secondaryCategory} size="small" variant="outlined" />}
        </Stack>

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Local pickup only. Please{' '}
          <a
            href="https://www.coalcreekguitars.com/contact-us"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', fontWeight: 600 }}
          >
            contact us
          </a>{' '}
          to purchase.
        </Typography>

        {displayPrice > 0 && (
          <Box sx={{ mt: 'auto', pt: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatPrice(displayPrice)}
            </Typography>
            {hasDiscount && (
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center', mt: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
                >
                  {formatPrice(regularPrice!)}
                </Typography>
                <Chip
                  label={`Save ${discount}%`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default index;
