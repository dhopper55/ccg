import { useState } from 'react';
import { Box, Button, Container, Divider, MenuItem, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useNavigate } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import StyledTextField from 'components/styled/StyledTextField';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import decoderConfigs from './decoder-configs.json';

const FEATURED_BRAND_KEYS = ['gibson', 'fender', 'ibanez', 'yamaha', 'prs', 'epiphone', 'martin', 'taylor', 'esp'] as const;

const findSerialTips = [
  'Back of the headstock',
  'Neck plate or heel area',
  'Soundhole label or stamp',
  'Interior paper label on acoustics',
] as const;

const whatYouCanLearn = [
  'Production year or range',
  'Factory or plant code',
  'Country of origin',
  'Era and format clues',
] as const;

const quickFaqs = [
  'Why some serial numbers do not decode cleanly',
  'Why year estimates can vary by brand',
  'Model number vs serial number',
  'Why imports and reissues can be tricky',
] as const;

interface BrandLinkItem {
  brandKey: string;
  brandName: string;
  logoSrc: string;
  routePath: string;
}

const DecoderBrandList = ({ items }: { items: BrandLinkItem[] }) => {
  const { up } = useBreakpoints();
  const upSm = up('sm');

  return (
    <Stack direction="column" sx={{ gap: 1, mb: 2, alignItems: 'flex-start' }}>
      {items.map((item) => (
        <Button
          color="neutral"
          key={item.brandKey}
          href={item.routePath}
          size={upSm ? 'large' : 'medium'}
          sx={{
            justifyContent: 'flex-start',
            whiteSpace: 'nowrap',
            py: '15px',
            width: 1,
            maxWidth: 320,
            gap: 1.5,
            overflow: 'hidden',
          }}
          startIcon={
            <Box
              component="img"
              src={item.logoSrc}
              alt={item.brandName}
              sx={{
                width: 56,
                height: 20,
                objectFit: 'contain',
                filter: 'invert(1)',
              }}
            />
          }
        >
          {item.brandName}
        </Button>
      ))}
    </Stack>
  );
};

const SimpleTopicList = ({ items }: { items: readonly string[] }) => {
  const { up } = useBreakpoints();
  const upSm = up('sm');

  return (
    <Stack direction="column" sx={{ gap: 1, mb: 2, alignItems: 'flex-start' }}>
      {items.map((item) => (
        <Button
          color="neutral"
          key={item}
          size={upSm ? 'large' : 'medium'}
          sx={{
            justifyContent: 'flex-start',
            whiteSpace: 'normal',
            py: '15px',
            width: 1,
            maxWidth: 320,
          }}
        >
          {item}
        </Button>
      ))}
    </Stack>
  );
};

const DecoderLandingPage = () => {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState(FEATURED_BRAND_KEYS[0]);
  const [serial, setSerial] = useState('');

  const featuredBrands = decoderConfigs.filter((config) =>
    FEATURED_BRAND_KEYS.includes(config.brandKey as (typeof FEATURED_BRAND_KEYS)[number]),
  );
  const remainingBrands = decoderConfigs.filter(
    (config) => !FEATURED_BRAND_KEYS.includes(config.brandKey as (typeof FEATURED_BRAND_KEYS)[number]),
  );

  const handleGoToDecoder = () => {
    const target = decoderConfigs.find((config) => config.brandKey === selectedBrand);
    if (!target) return;

    const params = new URLSearchParams();
    if (serial.trim()) {
      params.set('serial', serial.trim());
    }

    navigate(`${target.routePath}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <Container
      maxWidth="md"
      sx={{
        p: { xs: 3, md: 5 },
      }}
    >
      <Stack sx={{ gap: 4 }}>
        <Stack
          sx={{
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              Guitar Serial Number Lookup/Decoder
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.8 }}>
              Choose the brand-specific decoder that matches your guitar. Different makers use different
              serial systems, so selecting the correct brand is the fastest way to identify year, factory,
              country, and other production details.
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            alignItems: { xs: 'stretch', md: 'center' },
          }}
        >
          <StyledTextField
            select
            fullWidth
            size="large"
            label="Brand"
            value={selectedBrand}
            onChange={(event) => setSelectedBrand(event.target.value)}
            sx={{ maxWidth: { md: 280 } }}
          >
            {decoderConfigs.map((config) => (
              <MenuItem key={config.brandKey} value={config.brandKey}>
                {config.brandName}
              </MenuItem>
            ))}
          </StyledTextField>

          <StyledTextField
            fullWidth
            size="large"
            label="Serial Number"
            placeholder="Optional"
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
          />

          <Button
            variant="soft"
            color="warning"
            size="large"
            onClick={handleGoToDecoder}
            endIcon={<IconifyIcon icon="material-symbols:arrow-forward-rounded" />}
            sx={{ fontWeight: 700, alignSelf: { xs: 'flex-start', md: 'stretch' } }}
          >
            Go To Decoder
          </Button>
        </Stack>

        <Divider />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Featured Brands
            </Typography>
            <DecoderBrandList items={featuredBrands.slice(0, 5)} />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              More Featured
            </Typography>
            <DecoderBrandList items={featuredBrands.slice(5)} />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              All Brands
            </Typography>
            <DecoderBrandList items={remainingBrands.slice(0, 9)} />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              More Brands
            </Typography>
            <DecoderBrandList items={remainingBrands.slice(9)} />
          </Grid>
        </Grid>

        <Divider />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Where To Look
            </Typography>
            <SimpleTopicList items={findSerialTips} />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              What You Can Learn
            </Typography>
            <SimpleTopicList items={whatYouCanLearn} />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ p: { sm: 1 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Quick FAQs
            </Typography>
            <SimpleTopicList items={quickFaqs} />
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
};

export default DecoderLandingPage;
