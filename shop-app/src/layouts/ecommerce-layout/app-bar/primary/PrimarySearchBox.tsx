'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  CircularProgress,
  ClickAwayListener,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
  inputBaseClasses,
} from '@mui/material';
import { useNavigate } from 'react-router';
import SearchTextField from 'layouts/main-layout/common/search-box/SearchTextField';
import { slugifyCategory } from 'lib/utils';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';

type SearchProduct = {
  id: string;
  mainImage: string;
  saleTitle: string;
  saleUrlSlug: string;
  primaryCategoryName: string;
};

type SearchResponse = {
  records?: SearchProduct[];
};

const PrimarySearchBox = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    abortControllerRef.current?.abort();

    if (!trimmedQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsLoading(true);

    const timeout = window.setTimeout(() => {
      fetch(`/api/shop/product-search?query=${encodeURIComponent(trimmedQuery)}`, {
        signal: abortController.signal,
      })
        .then((response) => response.json() as Promise<SearchResponse>)
        .then((data) => {
          if (!abortController.signal.aborted) {
            setResults(Array.isArray(data.records) ? data.records.slice(0, 10) : []);
            setIsOpen(true);
          }
        })
        .catch(() => {
          if (!abortController.signal.aborted) {
            setResults([]);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, 150);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [trimmedQuery]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setIsOpen(true);
  };

  const handleSelect = (product: SearchProduct) => {
    const categorySlug = slugifyCategory(product.primaryCategoryName);
    const productSlug = product.saleUrlSlug.trim();
    if (!categorySlug || !productSlug) return;

    setQuery('');
    setResults([]);
    setIsOpen(false);
    navigate(paths.productDetails(categorySlug, productSlug));
  };

  const showDropdown = isOpen && trimmedQuery.length > 0;

  return (
    <ClickAwayListener onClickAway={() => setIsOpen(false)}>
      <Stack spacing={0.5} sx={{ width: 1, maxWidth: { sm: 360, lg: 460 }, position: 'relative' }}>
        <Box
          sx={({ vars }) => ({
            display: 'flex',
            alignItems: 'center',
            width: 1,
            borderRadius: 6,
            backgroundColor: 'action.hover',
            overflow: 'hidden',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
            border: '1px solid transparent',
            '&:has(form:hover):not(:has(form:focus-within))': {
              backgroundColor: 'background.elevation3',
            },
            [`&:has(.${inputBaseClasses.root}.${inputBaseClasses.focused})`]: {
              backgroundColor: 'primary.lighter',
              borderColor: 'primary.main',
            },
          })}
        >
          <SearchTextField
            component="form"
            value={query}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            onSubmit={(event) => event.preventDefault()}
            sx={{
              flexGrow: 1,
              minWidth: 0,
              [`& .${inputBaseClasses.root}`]: {
                p: 0,
                borderRadius: 0,
                border: 'none',
                '&:after': {
                  display: 'none',
                },
                '&.Mui-focused': {
                  boxShadow: 'none',
                },
                '&.Mui-focused:hover': {
                  bgcolor: 'transparent !important',
                },
                '&.Mui-active': {
                  bgcolor: 'transparent !important',
                },
              },
              [`& .${inputBaseClasses.input}`]: {
                pl: '16px !important',
              },
            }}
            placeholder="Search for products"
            slotProps={{
              input: {
                inputProps: {
                  style: { fontSize: 14 },
                },
                startAdornment: null,
                endAdornment: (
                  <InputAdornment position="end" sx={{ mr: 2 }}>
                    {isLoading ? (
                      <CircularProgress color="inherit" size={18} />
                    ) : (
                      <IconifyIcon
                        icon="material-symbols:search-rounded"
                        sx={{ fontSize: 20, color: 'text.secondary' }}
                      />
                    )}
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {showDropdown && (
          <Paper
            sx={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: (theme) => theme.zIndex.modal,
              overflow: 'hidden',
              boxShadow: (theme) => theme.vars.shadows[4],
            }}
          >
            {results.length > 0 ? (
              <List disablePadding>
                {results.map((product) => (
                  <ListItemButton
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    sx={{ py: 1, px: 1.5 }}
                  >
                    <ListItemAvatar sx={{ minWidth: 48 }}>
                      <Avatar
                        variant="rounded"
                        src={product.mainImage}
                        alt={product.saleTitle}
                        sx={{ width: 40, height: 40 }}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={product.saleTitle}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: 600,
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              !isLoading && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                  No products found
                </Typography>
              )
            )}
          </Paper>
        )}
      </Stack>
    </ClickAwayListener>
  );
};

export default PrimarySearchBox;
