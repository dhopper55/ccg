import { PropsWithChildren, useState } from 'react';
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
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const SIDEBAR_WIDTH = 280;

const decoderItems = [
  {
    name: 'Ibanez',
    logo: '/images/brand-logos/Ibanez_guitars_logo.webp',
  },
  {
    name: 'Gibson',
    logo: '/images/brand-logos/Gibson-logo.png',
  },
  {
    name: 'Fender',
    logo: '/images/brand-logos/Fender-logo.jpg',
  },
] as const;

const DecoderPreviewLayout = ({ children }: PropsWithChildren) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
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
            <Typography
              sx={{
                color: 'text.primary',
                fontWeight: 700,
                fontSize: 24,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              Serial Decoders
            </Typography>
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 3 }}>
          <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {decoderItems.map((item, index) => {
              return (
                <ListItemButton
                  key={item.name}
                  onClick={() => setMobileNavOpen(false)}
                  selected={index === 0}
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
                    <Box
                      component="img"
                      src={item.logo}
                      alt={item.name}
                      sx={{
                        width: 18,
                        height: 18,
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
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
