import { Link, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';

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

const socialLinks = [
  {
    label: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61587059786524',
  },
  {
    label: 'YouTube',
    url: 'https://www.youtube.com/@CoalCreekGuitars',
  },
];

const EcommerceFooter = () => {
  return (
    <Paper background={1} sx={{ px: { xs: 3, md: 5 }, py: { xs: 5, md: 6 } }}>
      <Grid container spacing={{ xs: 5, md: 8 }}>
        <Grid
          size={{
            xs: 12,
            md: 8,
            lg: 9,
          }}
        >
          <Stack direction="column" spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Coal Creek Guitars
            </Typography>
            <Grid container spacing={{ xs: 2, md: 3 }}>
              {siteLinks.map(({ label, url }) => (
                <Grid
                  key={label}
                  size={{
                    xs: 12,
                    sm: 6,
                    lg: 4,
                  }}
                >
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
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Grid>

        <Grid
          size={{
            xs: 12,
            md: 4,
            lg: 3,
          }}
        >
          <Stack direction="column" spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Follow us
            </Typography>
            <Stack direction="column" spacing={1.5}>
              {socialLinks.map(({ label, url }) => (
                <Link
                  key={label}
                  href={url}
                  variant="subtitle2"
                  underline="hover"
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    width: 'fit-content',
                  }}
                >
                  {label}
                </Link>
              ))}
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default EcommerceFooter;
