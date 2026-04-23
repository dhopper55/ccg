import { PropsWithChildren, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import Logo from 'components/common/Logo';
import sitemap from 'routes/sitemap';

const SIDEBAR_WIDTH = 280;

const DecoderPreviewLayout = ({ children }: PropsWithChildren) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  const navItems = useMemo(() => sitemap.flatMap((section) => section.items), []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {mobileNavOpen && (
        <Box
          onClick={() => setMobileNavOpen(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1198,
            display: { xs: 'block', md: 'none' },
          }}
        />
      )}

      <Box
        component="aside"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          zIndex: 1199,
          transform: {
            xs: mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
            md: 'translateX(0)',
          },
          transition: 'transform 180ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ px: 3, py: 4 }}>
          <Logo />
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 3 }}>
          <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {navItems.map((item) => {
              const isDisabled = item.path === '#';
              const isActive =
                !isDisabled &&
                (pathname === item.path ||
                  (item.selectionPrefix && pathname.includes(item.selectionPrefix)));

              return (
                <ListItemButton
                  key={item.pathName}
                  component={isDisabled ? 'div' : NavLink}
                  to={isDisabled ? undefined : item.path}
                  onClick={() => setMobileNavOpen(false)}
                  selected={isActive}
                  sx={{
                    minHeight: 48,
                    borderRadius: 2,
                    px: 1.5,
                    '&.active': {
                      bgcolor: 'primary.dark',
                      color: 'common.black',
                      '& .MuiListItemIcon-root': {
                        color: 'common.black',
                      },
                      '& .MuiListItemText-primary': {
                        color: 'common.black',
                      },
                    },
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      color: 'common.black',
                      '& .MuiListItemIcon-root': {
                        color: 'common.black',
                      },
                      '& .MuiListItemText-primary': {
                        color: 'common.black',
                      },
                    },
                    '&.Mui-selected': {
                      bgcolor: 'primary.dark',
                      color: 'common.black',
                      '& .MuiListItemIcon-root': {
                        color: 'common.black',
                      },
                      '& .MuiListItemText-primary': {
                        color: 'common.black',
                      },
                      '&:hover': {
                        bgcolor: 'primary.dark',
                        color: 'common.black',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                    <IconifyIcon icon={item.icon || 'material-symbols:circle-outline'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    primaryTypographyProps={{
                      fontSize: 16,
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Box>

      <Box sx={{ ml: { md: `${SIDEBAR_WIDTH}px` }, minWidth: 0 }}>
        <Box
          component="header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1100,
            bgcolor: 'background.default',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              px: { xs: 2, md: 5 },
              py: 2,
              minWidth: 0,
            }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <IconButton
                onClick={() => setMobileNavOpen((open) => !open)}
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <IconifyIcon icon="material-symbols:menu-rounded" />
              </IconButton>

              <Box
                component="img"
                src="/images/coal-creek-logo.png"
                alt="Coal Creek Guitars"
                sx={{
                  width: 32,
                  height: 32,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </Stack>

            <Button
              variant="soft"
              color="neutral"
              startIcon={<IconifyIcon icon="material-symbols:arrow-left-alt-rounded" />}
              onClick={() => {}}
            >
              Back
            </Button>
          </Stack>
        </Box>

        <Box component="main" sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
          <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none', minWidth: 0 }}>{children}</Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default DecoderPreviewLayout;
