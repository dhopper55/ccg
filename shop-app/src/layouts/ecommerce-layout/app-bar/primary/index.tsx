'use client';

import {
  Badge,
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

const PrimaryAppbar = ({ children }: { children: React.ReactNode }) => {
  const { up } = useBreakpoints();
  const { handleDrawerToggle } = useSettingsContext();
  const { cartItems } = useEcommerce();
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

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
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                color="neutral"
                variant="soft"
                shape="circle"
                aria-label="open drawer"
                onClick={handleDrawerToggle}
              >
                <IconifyIcon icon="material-symbols:menu-rounded" sx={{ fontSize: 20 }} />
              </Button>
              <Logo showName={up('sm')} />
            </Stack>
          </Grid>
          <Grid size="auto">
            <Badge color="error" badgeContent={cartItemCount} invisible={cartItemCount === 0}>
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
          </Grid>
        </Grid>
      </Toolbar>
      {children}
    </MuiAppBar>
  );
};

export default PrimaryAppbar;
