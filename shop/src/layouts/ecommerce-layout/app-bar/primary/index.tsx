'use client';

import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  InputAdornment,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  inputBaseClasses,
  listClasses,
} from '@mui/material';
import MuiAppBar from '@mui/material/AppBar';
import Grid from '@mui/material/Grid';
import SearchTextField from 'layouts/main-layout/common/search-box/SearchTextField';
import { kebabCase } from 'lib/utils';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useEcommerce } from 'providers/EcommerceProvider';
import IconifyIcon from 'components/base/IconifyIcon';
import Logo from 'components/common/Logo';
import OutlinedBadge from 'components/styled/OutlinedBadge';
import CartDrawer from './CartDrawer';
import CategoryPopover from './CategoryPopover';

const searchCategories = ['All', 'Popular', 'New', 'Discounted', 'Top Rated', 'Featured'];

export interface ShopCategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: ShopCategoryNode[];
}

const PrimaryAppbar = ({ children }: { children: React.ReactNode }) => {
  const categoryBtnRef = useRef<HTMLButtonElement | null>(null);
  const [openCartDrawer, setOpenCartDrawer] = useState(false);
  const [openItem, setOpenItem] = useState(0);
  const [searchMenuAnchorEl, setSearchMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCategory, setSelectedCategory] = useState(searchCategories[0]);
  const [shopCategories, setShopCategories] = useState<ShopCategoryNode[]>([]);
  const { up, currentBreakpoint } = useBreakpoints();

  const { cartItems } = useEcommerce();

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch('/api/shop/categories', {
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { tree?: ShopCategoryNode[] };
        if (!isMounted || !Array.isArray(payload.tree)) return;
        setShopCategories(payload.tree);
      } catch {
        if (isMounted) {
          setShopCategories([]);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchMenuClick = (event: MouseEvent<HTMLElement>) => {
    setSearchMenuAnchorEl(event.currentTarget);
  };

  const handleSearchMenuClose = () => {
    setSearchMenuAnchorEl(null);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <MuiAppBar>
      <Toolbar
        component="nav"
        variant="appbar"
        sx={{ px: { xs: 3, md: 5 }, py: { xs: 1, md: 0 }, minHeight: { md: 78 } }}
      >
        <Grid
          container
          spacing={{ xs: 1, md: 2 }}
          sx={{
            width: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Grid size="auto">
            <Logo showName={up('sm')} href="https://www.coalcreekguitars.com/" />
          </Grid>
          <Grid
            sx={{
              order: { md: 1 },
            }}
            size="auto"
            >
              <Stack
                sx={{
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <OutlinedBadge color="error" overlap="circular" badgeContent={cartItems.length}>
                  <Button
                    color="neutral"
                  variant="soft"
                  shape="circle"
                  onClick={() => setOpenCartDrawer(true)}
                >
                  <IconifyIcon
                    icon="material-symbols-light:shopping-cart-outline-rounded"
                    sx={{ fontSize: 22 }}
                  />
                </Button>
              </OutlinedBadge>
            </Stack>
          </Grid>
          <Grid
            sx={{ flexGrow: { xs: 1 } }}
            size={{
              xs: 12,
              md: 'auto',
            }}
          >
            <Stack
              spacing={{ xs: 1, lg: 2 }}
              sx={{
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Button
                color="neutral"
                variant="text"
                shape={
                  currentBreakpoint === 'xs' ||
                  currentBreakpoint === 'sm' ||
                  currentBreakpoint === 'md'
                    ? 'circle'
                    : undefined
                }
                ref={categoryBtnRef}
                onClick={() => {
                  setOpenItem(1);
                }}
                sx={{
                  gap: 1,
                  borderRadius: 7,
                  flexShrink: 0,
                }}
              >
                <IconifyIcon
                  icon="material-symbols:apps"
                  sx={{
                    fontSize: 20,
                    display: 'inline-block',
                    width: 20,
                    height: 20,
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    display: { xs: 'none', lg: 'block' },
                  }}
                >
                  Category
                </Box>
              </Button>

              <CategoryPopover
                anchorEl={categoryBtnRef.current}
                categories={shopCategories}
                openItem={openItem}
                setOpenItem={setOpenItem}
                handleClose={() => {
                  setOpenItem(0);
                }}
              />

              <Stack spacing={0.5} sx={{ width: 1, maxWidth: { lg: 602 } }}>
                <Box
                  sx={({ vars }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    width: 1,
                    borderRadius: 6,
                    backgroundColor: 'action.hover',
                    overflow: 'hidden',
                    transition: 'background-color .1s ease, border-color .1s ease',
                    border: '1px solid transparent',
                    '&:has(form:hover):not(:has(form:focus-within))': {
                      backgroundColor: 'background.elevation3',
                      '& > button': {
                        bgcolor: vars.palette.background.elevation3,
                      },
                    },
                    [`&:has(.${inputBaseClasses.root}.${inputBaseClasses.focused})`]: {
                      backgroundColor: 'primary.lighter',
                      borderColor: 'primary.main',
                      '& > button': {
                        bgcolor: 'primary.lighter',
                      },
                    },
                  })}
                >
                  <Button
                    disableRipple
                    color="neutral"
                    variant="text"
                    onClick={handleSearchMenuClick}
                    sx={({ vars }) => ({
                      flexShrink: 0,
                      pr: 0.5,
                      py: 1,
                      borderRadius: 0,
                      minWidth: 'auto',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'text.secondary',
                      display: { xs: 'none', md: 'flex' },
                      transition: 'color 0.2s ease, background-color 0.2s ease',
                      bgcolor: vars.palette.background.elevation2,
                      '&:hover': {
                        color: vars.palette.text.primary,
                      },
                    })}
                  >
                    {selectedCategory}
                    <IconifyIcon
                      icon="material-symbols:expand-more-rounded"
                      sx={{ fontSize: 18, ml: 0.5 }}
                    />
                  </Button>
                  <Menu
                    anchorEl={searchMenuAnchorEl}
                    open={Boolean(searchMenuAnchorEl)}
                    onClose={handleSearchMenuClose}
                    onClick={handleSearchMenuClose}
                    transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                    sx={{
                      [`& .${listClasses.root}`]: {
                        minWidth: 160,
                      },
                    }}
                  >
                    {searchCategories.map((category) => (
                      <MenuItem
                        key={kebabCase(category)}
                        onClick={() => {
                          setSelectedCategory(category);
                        }}
                      >
                        <ListItemText primary={category} />
                      </MenuItem>
                    ))}
                  </Menu>
                  <SearchTextField
                    component="form"
                    onSubmit={handleSearchSubmit}
                    sx={{
                      flexGrow: 1,
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
                        pl: { xs: '16px !important', md: '8px !important' },
                      },
                    }}
                    placeholder="Search product"
                    slotProps={{
                      input: {
                        inputProps: {
                          style: { fontSize: 14 },
                        },
                        startAdornment: null,
                        endAdornment: (
                          <InputAdornment position="end" sx={{ mr: 2 }}>
                            <IconifyIcon
                              icon="material-symbols:search-rounded"
                              sx={{ fontSize: 20, color: 'text.secondary' }}
                            />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Toolbar>
      {children}
      <CartDrawer open={openCartDrawer} handleClose={() => setOpenCartDrawer(false)} />
    </MuiAppBar>
  );
};

export default PrimaryAppbar;
