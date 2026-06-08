import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import IconifyIcon from 'components/base/IconifyIcon';
import PageBreadcrumb from 'components/sections/common/PageBreadcrumb';
import AddContactStepper from 'components/sections/crm/add-contact/AddContactStepper';

const GuitarEvalPage = () => {
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
                Answer a few questions about your instrument and get a professional-grade valuation report in less than 24 hours. We identify your gear, price it across Reverb, eBay, dealers, and local sale, flag what raises or lowers its value, and hand you a ready-to-post listing for your area. Read it on screen, save it as a PDF, or print it.{' '}
                <Box
                  component="a"
                  href="https://www.coalcreekguitars.com/guitar-value-report-evaluation/sample-report.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', textDecoration: 'underline', verticalAlign: 'middle' }}
                >
                  <Box component="img" src="/images/pdf.png" alt="PDF" sx={{ width: 18, height: 18, objectFit: 'contain' }} />
                  Click here to see a sample report.
                </Box>
              </Typography>
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
