'use client';

import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Stack,
  Toolbar,
} from '@mui/material';
import MuiAppBar from '@mui/material/AppBar';
import Grid from '@mui/material/Grid';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useEcommerce } from 'providers/EcommerceProvider';
import { useSettingsContext } from 'providers/SettingsProvider';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import Logo from 'components/common/Logo';
import PrimarySearchBox from './PrimarySearchBox';
import ShopCategoryDrawer from './ShopCategoryDrawer';

const PrimaryAppbar = () => {
  const { up } = useBreakpoints();
  const { handleDrawerToggle } = useSettingsContext();
  const { cartItems } = useEcommerce();
  const [shopDrawerOpen, setShopDrawerOpen] = useState(false);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <MuiAppBar>
      <Toolbar
        component="nav"
        variant="appbar"
        sx={{ px: { xs: 2, sm: 3, md: 5 }, py: { xs: 1, md: 0 }, minHeight: { md: 78 } }}
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                color="neutral"
                variant="soft"
                shape="circle"
                aria-label="Filter by category"
                onClick={() => setShopDrawerOpen(true)}
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <IconifyIcon icon="material-symbols:filter-list-rounded" sx={{ fontSize: 20 }} />
              </Button>
              {cartItemCount > 0 && (
                <Badge color="error" badgeContent={cartItemCount}>
                  <Button
                    color="neutral"
                    variant="soft"
                    shape="circle"
                    aria-label="cart"
                    href={paths.cart}
                  >
                    <IconifyIcon icon="material-symbols:shopping-cart-outline-rounded" sx={{ fontSize: 20 }} />
                  </Button>
                </Badge>
              )}
            </Stack>
          </Grid>
          <Grid
            size={{ xs: 12, md: 'grow' }}
            order={{ xs: 3, md: 2 }}
            sx={{
              minWidth: 0,
              maxWidth: { md: 460 },
              mx: { md: 1 },
            }}
          >
            <PrimarySearchBox />
          </Grid>
          <Grid size="auto" order={{ xs: 2, md: 3 }}>
            <Logo showName={up('sm')} onClick={handleDrawerToggle} />
          </Grid>
        </Grid>
      </Toolbar>
      <ShopCategoryDrawer open={shopDrawerOpen} onClose={() => setShopDrawerOpen(false)} />
    </MuiAppBar>
  );
};

export default PrimaryAppbar;
