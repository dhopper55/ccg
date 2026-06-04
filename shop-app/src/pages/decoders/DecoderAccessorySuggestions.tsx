import { useEffect, useState } from 'react';
import { Box, Card, CardMedia, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { currencyFormat, slugifyCategory } from 'lib/utils';

const SHOP_BASE = '/guitars-and-gear-for-sale';

// Category IDs by slot type
const PICK_CAT = [53];
const STRING_CAT = [20, 21];
// Maintenance slot pulls from Care & Maintenance + Polishes subcategory
const MAINTENANCE_NAMES = new Set(['Care & Maintenance', 'Polishes, Oils, & Cloths']);
// Full random pool
const ALL_CATS = [53, 55, 57, 20, 21, 50, 51];

type AccessoryProduct = {
  id: string;
  mainImage: string;
  saleTitle: string;
  saleUrlSlug: string;
  salePrice: number;
  regularPrice: number | null;
  primaryCategoryName: string;
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchCategory(ids: number[]): Promise<AccessoryProduct[]> {
  try {
    const params = new URLSearchParams();
    for (const id of ids) params.append('categoryIds', String(id));
    const res = await fetch(`/api/shop/products?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { records?: AccessoryProduct[] };
    return (Array.isArray(data.records) ? data.records : []).filter((p) => Boolean(p.mainImage));
  } catch {
    return [];
  }
}

// Use direct window.location navigation for all decoder→shop links to bypass
// the global MuiLink→RouterLink wiring that would otherwise do in-app routing.
function navigateTo(url: string) {
  window.location.href = url;
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
        // 3 parallel fetches: guaranteed-slot categories + full random pool
        const [picks, strings, allProducts] = await Promise.all([
          fetchCategory(PICK_CAT),
          fetchCategory(STRING_CAT),
          fetchCategory(ALL_CATS),
        ]);

        if (cancelled) return;

        // One guaranteed item per slot
        const guaranteedPick = shuffle(picks)[0];
        const guaranteedString = shuffle(strings)[0];
        const maintenancePool = allProducts.filter((p) => MAINTENANCE_NAMES.has(p.primaryCategoryName));
        const guaranteedMaintenance = shuffle(maintenancePool)[0];

        const guaranteed = [guaranteedPick, guaranteedString, guaranteedMaintenance].filter(Boolean) as AccessoryProduct[];
        const guaranteedIds = new Set(guaranteed.map((p) => p.id));

        // Fill remaining slots from the full pool, excluding guaranteed items
        const remaining = shuffle(allProducts.filter((p) => !guaranteedIds.has(p.id))).slice(
          0,
          Math.max(0, count - guaranteed.length),
        );

        setProducts([...guaranteed, ...remaining]);
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
              : `${SHOP_BASE}/`;
          const displayPrice =
            product.salePrice > 0 ? product.salePrice : (product.regularPrice ?? 0);

          return (
            <Grid key={product.id} size={{ xs: 4 }}>
              <Card
                onClick={() => navigateTo(productUrl)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  overflow: 'hidden',
                  color: 'inherit',
                  cursor: 'pointer',
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
        <Typography
          variant="caption"
          onClick={() => navigateTo(`${SHOP_BASE}/`)}
          sx={{
            color: 'text.secondary',
            cursor: 'pointer',
            textDecoration: 'underline',
            '&:hover': { color: 'text.primary' },
          }}
        >
          See more...
        </Typography>
      </Box>
    </Box>
  );
};

export default DecoderAccessorySuggestions;
