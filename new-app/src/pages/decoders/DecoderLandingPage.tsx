import { FormEvent, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useNavigate } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import StyledTextField from 'components/styled/StyledTextField';
import decoderConfigs from './decoder-configs.json';

const FEATURED_BRAND_KEYS = ['gibson', 'fender', 'ibanez', 'yamaha', 'prs', 'epiphone', 'martin', 'taylor', 'esp'] as const;

const featuredDescriptions: Record<string, string> = {
  gibson: 'Lookup Gibson serial numbers for year, plant, and production clues.',
  fender: 'Decode Fender serial formats across USA, Mexico, Japan, and import eras.',
  ibanez: 'Check modern and legacy Ibanez serial systems across multiple factories.',
  yamaha: 'Research Yamaha acoustic and electric serial formats across eras and plants.',
  prs: 'Identify PRS year and production details across USA Core, SE, S2, and CE lines.',
  epiphone: 'Trace Epiphone serial formats across Korean, Chinese, Japanese, and newer production.',
  martin: 'Look up Martin serial numbers to estimate production year and era context.',
  taylor: 'Decode Taylor serial numbers for year, factory, and production sequencing details.',
  esp: 'Navigate ESP, LTD, and related serial formats across factories and production periods.',
};

const helpTopics = [
  {
    title: 'Where To Find Your Guitar Serial Number',
    body:
      'Most guitars place the serial number on the back of the headstock, but some use a neck plate, heel stamp, or label inside the soundhole. Acoustics and vintage instruments often differ from modern electrics, so checking more than one location is common.',
  },
  {
    title: 'What A Serial Number Can Tell You',
    body:
      'A serial number can often reveal the production year, factory code, country of origin, and approximate place in a production run. Some brands also encode month, day, or line information, while others only support a narrower year estimate.',
  },
  {
    title: 'Why Some Serial Numbers Do Not Decode Cleanly',
    body:
      'Serial systems change over time, and many brands used overlapping, inconsistent, or factory-specific formats. Worn stamps, partial labels, unusual imports, and model numbers mistaken for serial numbers are all common causes of failed lookups.',
  },
  {
    title: 'Why Year And Factory Estimates Can Vary By Brand',
    body:
      'Some guitars can only be dated to a range rather than an exact year or day. Reissues, transitional production periods, outsourced factories, and missing historical factory records can all affect decoding confidence.',
  },
] as const;

const faqItems = [
  {
    question: 'Where can I find my guitar serial number?',
    answer:
      'Most guitars place the serial number on the back of the headstock. Acoustics may list it inside the soundhole on a paper label, and some older guitars use a neck plate or stamped marking. Check the headstock back and neck joint first.',
  },
  {
    question: 'What can this guitar serial number lookup/decoder tell me?',
    answer:
      'It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by brand and era.',
  },
  {
    question: "Why won't my guitar serial number decode?",
    answer:
      'Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, contact us so we can review it and improve the decoder.',
  },
  {
    question: 'Is a model number the same as a serial number?',
    answer:
      'No. A model number identifies the instrument line or configuration, while a serial number is the unique production identifier. Entering the model instead of the serial is one of the most common reasons a lookup fails.',
  },
] as const;

const DecoderLandingPage = () => {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState(FEATURED_BRAND_KEYS[0]);
  const [serial, setSerial] = useState('');

  const featuredBrands = useMemo(
    () => decoderConfigs.filter((config) => FEATURED_BRAND_KEYS.includes(config.brandKey as (typeof FEATURED_BRAND_KEYS)[number])),
    [],
  );
  const remainingBrands = useMemo(
    () => decoderConfigs.filter((config) => !FEATURED_BRAND_KEYS.includes(config.brandKey as (typeof FEATURED_BRAND_KEYS)[number])),
    [],
  );

  const handleSpringboardSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = decoderConfigs.find((config) => config.brandKey === selectedBrand);
    if (!target) return;

    const params = new URLSearchParams();
    const trimmedSerial = serial.trim();
    if (trimmedSerial) {
      params.set('serial', trimmedSerial);
    }

    navigate(`${target.routePath}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <Paper
      sx={{
        minHeight: '100vh',
        borderRadius: 0,
        bgcolor: 'background.default',
        p: { xs: 2, md: 5 },
      }}
    >
      <Container maxWidth="xl" disableGutters>
        <Stack spacing={4}>
          <Paper
            sx={{
              p: { xs: 3, md: 5 },
              overflow: 'hidden',
              background:
                'radial-gradient(circle at top left, rgba(224, 212, 189, 0.16), transparent 42%), linear-gradient(135deg, rgba(24, 21, 15, 0.98), rgba(37, 32, 23, 0.9))',
              border: '1px solid rgba(224, 212, 189, 0.18)',
            }}
          >
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Stack spacing={2.5}>
                  <Chip
                    label="26 Brand-Specific Decoders"
                    color="warning"
                    variant="soft"
                    sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
                  />
                  <Typography variant="h2" sx={{ maxWidth: 760 }}>
                    Guitar Serial Number Lookup/Decoder
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 780, lineHeight: 1.8 }}>
                    Use our guitar serial number lookup tools to identify the production year, factory, country of
                    origin, and other build details for many major guitar brands. Because serial systems vary widely by
                    maker and era, choose the brand-specific decoder that matches your instrument.
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <Paper
                  component="form"
                  onSubmit={handleSpringboardSubmit}
                  sx={{
                    p: { xs: 3, md: 4 },
                    bgcolor: 'rgba(17, 14, 10, 0.78)',
                    border: '1px solid rgba(224, 212, 189, 0.18)',
                  }}
                >
                  <Stack spacing={2.5}>
                    <Typography variant="h5">Start With A Brand</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pick the correct brand decoder, optionally pass your serial over, and continue on the
                      brand-specific page.
                    </Typography>
                    <StyledTextField
                      select
                      fullWidth
                      label="Brand"
                      value={selectedBrand}
                      onChange={(event) => setSelectedBrand(event.target.value)}
                    >
                      {decoderConfigs.map((config) => (
                        <MenuItem key={config.brandKey} value={config.brandKey}>
                          {config.brandName}
                        </MenuItem>
                      ))}
                    </StyledTextField>
                    <StyledTextField
                      fullWidth
                      label="Serial Number"
                      placeholder="Optional"
                      value={serial}
                      onChange={(event) => setSerial(event.target.value)}
                    />
                    <Button
                      type="submit"
                      variant="soft"
                      color="warning"
                      startIcon={<IconifyIcon icon="material-symbols:arrow-forward-rounded" />}
                      sx={{ fontWeight: 700, alignSelf: 'flex-start' }}
                    >
                      Go To Decoder
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  Featured Brand Decoders
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                  Start with the most commonly used guitar serial number lookup tools. Each decoder is tailored to the
                  brand&apos;s own serial formats, factory codes, and production eras.
                </Typography>
              </Box>
              <Grid container spacing={3}>
                {featuredBrands.map((config) => (
                  <Grid key={config.brandKey} size={{ xs: 12, sm: 6, xl: 4 }}>
                    <Paper
                      component="a"
                      href={config.publicUrl}
                      sx={{
                        display: 'block',
                        p: { xs: 3, md: 4 },
                        textDecoration: 'none',
                        height: 1,
                        border: '1px solid rgba(224, 212, 189, 0.14)',
                        transition: 'transform 180ms ease, border-color 180ms ease, background-color 180ms ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: 'rgba(224, 212, 189, 0.32)',
                          bgcolor: 'rgba(224, 212, 189, 0.03)',
                        },
                      }}
                    >
                      <Stack spacing={2.5} sx={{ height: 1 }}>
                        <Box
                          component="img"
                          src={config.logoSrc}
                          alt={config.brandName}
                          sx={{
                            height: 40,
                            width: 'auto',
                            maxWidth: 180,
                            objectFit: 'contain',
                            filter: 'invert(1)',
                          }}
                        />
                        <Box>
                          <Typography variant="h5" sx={{ mb: 1 }}>
                            {config.brandName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                            {featuredDescriptions[config.brandKey]}
                          </Typography>
                        </Box>
                        <Box sx={{ mt: 'auto' }}>
                          <Button
                            variant="soft"
                            color="warning"
                            endIcon={<IconifyIcon icon="material-symbols:arrow-forward-rounded" />}
                            sx={{ fontWeight: 700 }}
                          >
                            Open Decoder
                          </Button>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  All Decoder Brands
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Browse the complete decoder directory for supported guitar brands.
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {remainingBrands.map((config) => (
                  <Grid key={config.brandKey} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                    <Paper
                      component="a"
                      href={config.publicUrl}
                      sx={{
                        display: 'block',
                        p: 2.5,
                        textDecoration: 'none',
                        border: '1px solid rgba(224, 212, 189, 0.12)',
                        transition: 'border-color 160ms ease, background-color 160ms ease',
                        '&:hover': {
                          borderColor: 'rgba(224, 212, 189, 0.28)',
                          bgcolor: 'rgba(224, 212, 189, 0.03)',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                        <Box
                          component="img"
                          src={config.logoSrc}
                          alt={config.brandName}
                          sx={{
                            height: 24,
                            width: 'auto',
                            maxWidth: 100,
                            objectFit: 'contain',
                            filter: 'invert(1)',
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {config.brandName}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Paper>

          <Grid container spacing={3}>
            {helpTopics.map((topic) => (
              <Grid key={topic.title} size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: { xs: 3, md: 4 }, height: 1 }}>
                  <Typography variant="h5" sx={{ mb: 1.5 }}>
                    {topic.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                    {topic.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
              Guitar Serial Number Lookup FAQs
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Common questions about guitar serial numbers across brands, factories, and production eras.
            </Typography>
            <Stack divider={<Divider />}>
              {faqItems.map((item) => (
                <Box key={item.question} sx={{ py: 2.5 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {item.question}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.85 }}>
                    {item.answer}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Paper>
  );
};

export default DecoderLandingPage;
