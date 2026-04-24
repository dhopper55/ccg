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
import { useNavigate } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import decoderConfigs from 'pages/decoders/decoder-configs.json';

const SIDEBAR_WIDTH = 280;

interface DecoderPreviewLayoutProps extends PropsWithChildren {
  activeDecoderName: string;
  headerLogoSrc: string;
  headerLogoAlt: string;
}

const DecoderPreviewLayout = ({
  activeDecoderName,
  headerLogoAlt,
  headerLogoSrc,
  children,
}: DecoderPreviewLayoutProps) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

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
          <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
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
              component="div"
              sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
            >
              <Box
                component="span"
                sx={{
                  color: 'text.primary',
                  fontWeight: 700,
                  fontSize: 24,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  display: 'block',
                }}
              >
                Serial Decoders
              </Box>
              <Box
                component="span"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: 10,
                  lineHeight: 1.2,
                  letterSpacing: '0.18em',
                  display: 'block',
                }}
              >
                COAL CREEK GUITARS
              </Box>
            </Typography>
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 3 }}>
          <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {decoderConfigs.map((item) => {
              return (
                <ListItemButton
                  key={item.brandKey}
                  component="a"
                  href={item.publicUrl}
                  onClick={() => setMobileNavOpen(false)}
                  selected={item.brandName === activeDecoderName}
                  sx={{
                    minHeight: 56,
                    borderRadius: 2,
                    px: 1.5,
                    border: '1px solid transparent',
                    bgcolor: 'transparent',
                    color: 'text.secondary',
                    transition: 'border-color 160ms ease, background-color 160ms ease, color 160ms ease',
                    '&:hover': {
                      bgcolor: 'transparent',
                      borderColor: 'rgba(224, 212, 189, 0.32)',
                      color: 'text.primary',
                    },
                    '&.Mui-selected': {
                      bgcolor: 'transparent',
                      borderColor: 'rgba(224, 212, 189, 0.5)',
                      color: 'text.primary',
                      '&:hover': {
                        bgcolor: 'transparent',
                        borderColor: 'rgba(224, 212, 189, 0.6)',
                        color: 'text.primary',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 44, color: 'inherit' }}>
                    <Box
                      sx={{
                        width: 28,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'transparent',
                      }}
                    >
                      <Box
                        component="img"
                        src={item.logoSrc}
                        alt={item.brandName}
                        sx={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain',
                          display: 'block',
                          filter: 'invert(1)',
                        }}
                      />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={item.brandName}
                    primaryTypographyProps={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'inherit',
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

              <Stack direction="row" sx={{ alignItems: 'center', gap: 2, minWidth: 0 }}>
                <Box
                  component="img"
                  src={headerLogoSrc}
                  alt={headerLogoAlt}
                  sx={{
                    width: 120,
                    height: 54,
                    objectFit: 'contain',
                    display: 'block',
                    filter: 'invert(1)',
                    flexShrink: 0,
                  }}
                />
              </Stack>
            </Stack>

            <Button
              variant="soft"
              color="neutral"
              startIcon={<IconifyIcon icon="material-symbols:arrow-left-alt-rounded" />}
              onClick={() => navigate('/decoders/guitar-serial-decoder-lookup')}
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
