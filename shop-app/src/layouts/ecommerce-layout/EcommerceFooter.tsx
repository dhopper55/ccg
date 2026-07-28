import { FormEvent, useState } from 'react';
import { Box, Button, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { kebabCase } from 'lib/utils';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import StyledTextField from 'components/styled/StyledTextField';

const footerLinks = {
  company: [
    {
      label: 'About Us',
      url: 'https://www.coalcreekguitars.com/about-us',
    },
  ],
  help: [
    {
      label: 'Serial Decoders',
      url: 'https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup/',
    },
  ],
  contacts: [
    {
      label: 'Contact Us',
      url: 'https://www.coalcreekguitars.com/contact-us',
    },
  ],
};

const EcommerceFooter = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      enqueueSnackbar('Enter your email address.', { variant: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/shop/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Unable to subscribe.');
      enqueueSnackbar(data.message || 'You are subscribed.', { variant: 'success' });
      setEmail('');
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to subscribe.', {
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper background={1} sx={{ position: 'relative', px: { xs: 3, md: 5 }, py: { xs: 5, md: 7 } }}>
      <Grid container columnSpacing={1}>
        <Grid
          sx={{ mb: { xs: 6, md: 8, lg: 0 } }}
          size={{
            xs: 12,
            lg: 6,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row', lg: 'column' }}
            sx={{
              rowGap: 6,
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="h5"
              sx={{
                color: 'text.disabled',
                lineHeight: 1.5,
              }}
            >
              <Box component="span" sx={{ display: 'block' }}>
                Coal Creek Guitars
              </Box>
            </Typography>

            <Box
              component="form"
              noValidate
              onSubmit={handleNewsletterSubmit}
              sx={{
                textAlign: { md: 'right', lg: 'left' },
              }}
            >
              <Stack
                sx={{
                  gap: 2,
                  mb: 2,
                  justifyContent: { md: 'flex-end', lg: 'flex-start' },
                }}
              >
                <StyledTextField
                  id="email"
                  type="email"
                  placeholder="Your email"
                  variant="filled"
                  value={email}
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  sx={{
                    maxWidth: 260,
                    width: 1,
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="neutral"
                  disabled={isSubmitting}
                  sx={{
                    flexShrink: 0,
                  }}
                  endIcon={
                    isSubmitting ? (
                      <CircularProgress color="inherit" size={16} />
                    ) : (
                      <IconifyIcon icon="material-symbols:arrow-right-alt-rounded" />
                    )
                  }
                >
                  Subscribe
                </Button>
              </Stack>
              <Typography
                component="p"
                variant="subtitle2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Subscribe to our newsletter for exclusive deals and promotions
              </Typography>
            </Box>
          </Stack>
        </Grid>

        <Grid
          sx={{ mb: { xs: 6, sm: 0 } }}
          size={{
            xs: 12,
            sm: 4,
            lg: 2,
          }}
        >
          <Stack direction="column" spacing={2}>
            {footerLinks['company'].map(({ label, url }) => (
              <Link
                key={kebabCase(label)}
                href={url}
                variant="subtitle2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  alignSelf: 'flex-start',
                }}
              >
                {label}
              </Link>
            ))}
          </Stack>
        </Grid>

        <Grid
          sx={{ mb: { xs: 6, sm: 0 } }}
          size={{
            xs: 12,
            sm: 4,
            lg: 2,
          }}
        >
          <Stack direction="column" spacing={2}>
            {footerLinks['help'].map(({ label, url }) => (
              <Link
                key={kebabCase(label)}
                href={url}
                variant="subtitle2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  alignSelf: 'flex-start',
                }}
              >
                {label}
              </Link>
            ))}
          </Stack>
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 4,
            lg: 2,
          }}
        >
          <Stack
            direction="column"
            spacing={2}
            sx={{
              height: 1,
              justifyContent: 'space-between',
            }}
          >
            {footerLinks['contacts'].map(({ label, url }) => (
              <Link
                key={kebabCase(label)}
                href={url}
                variant="subtitle2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  alignSelf: 'flex-start',
                }}
              >
                {label}
              </Link>
            ))}
            <Box
              sx={{
                mt: 'auto',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 'bold',
                  mb: 2,
                }}
              >
                Follow us at
              </Typography>
              <Stack
                sx={{
                  gap: 1,
                  color: 'text.secondary',
                }}
              >
                <Button
                  href="https://www.facebook.com/profile.php?id=61587059786524"
                  target="_blank"
                  shape="circle"
                  variant="soft"
                  color="neutral"
                  size="small"
                  sx={{
                    '&:hover': {
                      bgcolor: 'background.elevation2',
                    },
                  }}
                >
                  <IconifyIcon icon="eva:facebook-fill" fontSize={16} />
                </Button>
                <Button
                  href="https://www.youtube.com/channel/UCV-kDQjH_cWcsxwg0GZKX3g/"
                  target="_blank"
                  shape="circle"
                  variant="soft"
                  color="neutral"
                  size="small"
                  sx={{
                    '&:hover': {
                      bgcolor: 'background.elevation2',
                    },
                  }}
                >
                  <IconifyIcon icon="mdi:youtube" fontSize={16} />
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default EcommerceFooter;
