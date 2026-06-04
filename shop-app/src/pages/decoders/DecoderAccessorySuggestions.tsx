import { useEffect, useState } from 'react';
import { Box, Card, CardMedia, Link, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { currencyFormat, slugifyCategory } from 'lib/utils';

const SHOP_BASE = '/guitars-and-gear-for-sale';
// Picks, Slides, Capos, Electric Strings, Acoustic Strings, Care & Maintenance, Polishes/Oils
const CATEGORY_IDS = [53, 55, 57, 20, 21, 50, 51];

type AccessoryProduct = {
  id: string;
  mainImage: string;
  saleTitle: string;
  saleUrlSlug: string;
  salePrice: number;
  regularPrice: number | null;
  primaryCategoryName: string;
};

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface DecoderAccessorySuggestionsProps {
  count?: number;
}

const DecoderAccessorySuggestions = ({ count = 9 }: DecoderAccessorySuggestionsProps) => {
  const [products, setProducts] = useState<AccessoryProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        for (const id of CATEGORY_IDS) {
          params.append('categoryIds', String(id));
        }
        const res = await fetch(`/api/shop/products?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { records?: AccessoryProduct[] };
        if (cancelled) return;
        const records = Array.isArray(data.records) ? data.records : [];
        const withImages = records.filter((p) => Boolean(p.mainImage));
        setProducts(fisherYatesShuffle(withImages).slice(0, count));
      } catch {
        // silently fail — suggestions are non-critical
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [count]);

  if (products.length === 0) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        Free shipping over $75
      </Typography>
      <Grid container spacing={1.5}>
        {products.map((product) => {
          const categorySlug = slugifyCategory(product.primaryCategoryName);
          const productUrl =
            categorySlug && product.saleUrlSlug
              ? `${SHOP_BASE}/${categorySlug}/${product.saleUrlSlug}`
              : SHOP_BASE;
          const displayPrice =
            product.salePrice > 0 ? product.salePrice : (product.regularPrice ?? 0);

          return (
            <Grid key={product.id} size={{ xs: 4 }}>
              <Card
                component="a"
                href={productUrl}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  overflow: 'hidden',
                  color: 'inherit',
                  textDecoration: 'none',
                  transition: 'transform 0.18s, box-shadow 0.18s',
                  height: '100%',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                }}
              >
                <CardMedia
                  component="img"
                  image={product.mainImage}
                  alt={product.saleTitle}
                  loading="lazy"
                  decoding="async"
                  sx={{
                    height: 88,
                    objectFit: 'contain',
                    bgcolor: 'background.elevation1',
                    p: 0.75,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ p: 1, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.35,
                      fontWeight: 500,
                    }}
                  >
                    {product.saleTitle}
                  </Typography>
                  {displayPrice > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'warning.main', fontWeight: 700, display: 'block' }}
                    >
                      {currencyFormat(displayPrice)}
                    </Typography>
                  )}
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Box sx={{ mt: 1.5, textAlign: 'center' }}>
        <Link href={SHOP_BASE} variant="caption" color="text.secondary" underline="hover">
          See more...
        </Link>
      </Box>
    </Box>
  );
};

export default DecoderAccessorySuggestions;
