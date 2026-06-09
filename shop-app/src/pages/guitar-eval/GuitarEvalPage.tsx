import { useEffect } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import IconifyIcon from 'components/base/IconifyIcon';
import PageBreadcrumb from 'components/sections/common/PageBreadcrumb';
import AddContactStepper from 'components/sections/crm/add-contact/AddContactStepper';
import { trackShopAnalyticsEvent } from 'lib/shopAnalytics';

const GuitarEvalPage = () => {
  useEffect(() => {
    trackShopAnalyticsEvent({ eventType: 'value_report_initiate' });
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pt: '5px', px: { xs: 2, md: 5 }, pb: { xs: 2, md: 5 } }}>
        <Grid container sx={{ gap: 2 }}>
          <Grid size={12}>
            <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 2, mb: 1 }}>
                <Box
                  component="a"
                  href="https://www.coalcreekguitars.com"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', flexShrink: 0 }}
                >
                  <Box
                    component="img"
                    src="/images/coal-creek-logo.png"
                    alt="Coal Creek Guitars"
                    sx={{ width: 32, height: 32, objectFit: 'contain' }}
                  />
                  <Typography fontWeight={700} fontSize={15} color="text.primary" sx={{ whiteSpace: 'nowrap' }}>
                    Coal Creek Guitars
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <PageBreadcrumb
                  items={[
                    { label: 'Home', url: 'https://www.coalcreekguitars.com' },
                    { label: 'Guitar Evaluation Report', active: true },
                  ]}
                />
              </Stack>
              <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                    <IconifyIcon
                      icon="mdi:currency-usd"
                      color="#b8960c"
                      sx={{ fontSize: '2.125rem', flexShrink: 0 }}
                    />
                    <Typography variant="h4">
                      Comprehensive Guitar Evaluation Report
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                    Answer a few questions about your instrument and get a professional-grade valuation report in less than 24 hours.
                    <br />
                    We identify your gear, price it across Reverb, eBay, dealers, and local sale, flag what raises or lowers its value, and hand you a ready-to-post listing for your area.
                    <br />
                    We also give you a professionally written title and description for an online marketplace listing if you plan on selling.
                    <br />
                    Read it on screen, save it as a PDF, or print it.
                    <br />
                    <Box
                      component="a"
                      href="https://www.coalcreekguitars.com/guitar-value-report-evaluation/sample-report.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', textDecoration: 'underline', verticalAlign: 'middle', mt: 0.5 }}
                    >
                      <Box component="img" src="/images/html.png" alt="HTML" sx={{ width: 18, height: 18, objectFit: 'contain' }} />
                      Click here to see a sample report.
                    </Box>
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Box
                    component="a"
                    href="https://www.coalcreekguitars.com/guitar-value-report-evaluation/sample-report.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'block', width: 1 }}
                  >
                    <Box
                      component="img"
                      src="/images/report-sample.png"
                      alt="Sample guitar evaluation report"
                      sx={{ width: 1, height: 'auto', borderRadius: 2, display: 'block' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          <Grid size={12}>
            <Paper sx={{ p: { xs: 3, md: 5 } }}>
              <AddContactStepper />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default GuitarEvalPage;
