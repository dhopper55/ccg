import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import Logo from 'components/common/Logo';
import NotificationMenu from 'layouts/main-layout/common/NotificationMenu';
import ProfileMenu from 'layouts/main-layout/common/ProfileMenu';
import SearchDropdown from 'layouts/main-layout/common/SearchDropdown';
import sitemap, { SubMenuItem } from 'routes/sitemap';

const SIDEBAR_WIDTH = 280;

const MainLayout = ({ children }: PropsWithChildren) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const { pathname } = useLocation();

  const navItems = useMemo(() => sitemap.flatMap((section) => section.items), []);
  const isItemActive = (item: SubMenuItem): boolean => (
    pathname === item.path
    || Boolean(item.selectionPrefix && pathname.includes(item.selectionPrefix))
    || Boolean(item.items?.some(isItemActive))
  );

  useEffect(() => {
    const activeParents = navItems
      .filter((item) => item.items?.some(isItemActive))
      .map((item) => item.pathName);
    setOpenItems((current) => Array.from(new Set([...current, ...activeParents])));
  }, [pathname, navItems]);

  const toggleItem = (pathName: string) => {
    setOpenItems((current) => (
      current.includes(pathName)
        ? current.filter((item) => item !== pathName)
        : [...current, pathName]
    ));
  };

  const renderNavItem = (item: SubMenuItem, level = 0) => {
    const hasChildren = Boolean(item.items?.length);
    const isActive = isItemActive(item);
    const isSelfActive = pathname === item.path || Boolean(item.selectionPrefix && pathname.includes(item.selectionPrefix));
    const isOpen = openItems.includes(item.pathName);

    return (
      <Box key={item.pathName}>
        <ListItemButton
          component={hasChildren || !item.path ? 'div' : NavLink}
          to={!hasChildren && item.path ? item.path : undefined}
          onClick={() => {
            if (hasChildren) {
              toggleItem(item.pathName);
            } else {
              setMobileNavOpen(false);
            }
          }}
          selected={hasChildren ? isSelfActive : isActive}
          sx={{
            minHeight: 48,
            borderRadius: 2,
            px: 1.5,
            pl: 1.5 + level * 2.5,
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
              fontSize: level === 0 ? 16 : 14,
              fontWeight: level === 0 ? 500 : 400,
            }}
          />
          {hasChildren ? (
            <IconifyIcon
              icon="material-symbols:expand-more-rounded"
              sx={{
                fontSize: 20,
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 180ms ease',
              }}
            />
          ) : null}
        </ListItemButton>
        {hasChildren ? (
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
              {item.items?.map((child) => renderNavItem(child, level + 1))}
            </List>
          </Collapse>
        ) : null}
      </Box>
    );
  };

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
            {navItems.map((item) => renderNavItem(item))}
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
              gap: 2,
              px: { xs: 2, md: 5 },
              py: 2,
              minWidth: 0,
            }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
              <IconButton
                onClick={() => setMobileNavOpen((open) => !open)}
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <IconifyIcon icon="material-symbols:menu-rounded" />
              </IconButton>

              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Logo showName={false} />
              </Box>

              <SearchDropdown />
            </Stack>

            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <NotificationMenu />
              <ProfileMenu />
            </Stack>
          </Stack>
        </Box>

        <Box component="main" sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
          <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none', minWidth: 0 }}>{children}</Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
