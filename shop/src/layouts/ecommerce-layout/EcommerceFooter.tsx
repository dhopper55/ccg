import { Box, IconButton, Link, Paper, Stack, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const siteLinks = [
  { label: 'Home', url: 'https://www.coalcreekguitars.com' },
  {
    label: 'Gear for Sale',
    url: 'https://www.coalcreekguitars.com/guitars-and-gear-for-sale',
  },
  {
    label: 'Serial Decoders',
    url: 'https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup',
  },
  {
    label: 'Repair/Maintenance Videos',
    url: 'https://www.coalcreekguitars.com/guitar-repair-demo-lesson-videos',
  },
  { label: 'About Us', url: 'https://www.coalcreekguitars.com/about-us' },
  { label: 'Contact Us', url: 'https://www.coalcreekguitars.com/contact-us' },
];

const EcommerceFooter = () => {
  return (
    <Paper background={1} sx={{ px: { xs: 3, md: 5 }, py: { xs: 3, md: 3.5 } }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={{ xs: 2.5, lg: 4 }}
        sx={{
          alignItems: { xs: 'flex-start', lg: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Stack
          direction="row"
          sx={{
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 2,
            rowGap: 1.25,
          }}
        >
          {siteLinks.map(({ label, url }, index) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center' }}>
              <Link
                href={url}
                variant="subtitle2"
                underline="hover"
                target="_blank"
                rel="noreferrer"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                {label}
              </Link>
              {index < siteLinks.length - 1 ? (
                <Typography
                  component="span"
                  variant="subtitle2"
                  sx={{ color: 'text.disabled', mx: 1.25 }}
                >
                  |
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <IconButton
            component="a"
            href="https://www.facebook.com/profile.php?id=61587059786524"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
            color="neutral"
            variant="soft"
            size="small"
          >
            <IconifyIcon icon="eva:facebook-fill" fontSize={18} />
          </IconButton>
          <IconButton
            component="a"
            href="https://www.youtube.com/@CoalCreekGuitars"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
            color="neutral"
            variant="soft"
            size="small"
          >
            <IconifyIcon icon="mdi:youtube" fontSize={18} />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default EcommerceFooter;
