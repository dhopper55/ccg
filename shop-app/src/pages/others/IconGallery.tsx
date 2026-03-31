import { useMemo, useState } from 'react';
import { Box, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';
import { icons } from 'lib/iconifyIcons';

const IconGallery = () => {
  const [query, setQuery] = useState('');

  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return icons
      .filter((icon) => icon.startsWith('material-symbols') || icon.startsWith('flag:'))
      .filter((icon) => (normalizedQuery ? icon.toLowerCase().includes(normalizedQuery) : true))
      .slice(0, 180);
  }, [query]);

  return (
    <Box sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Icon Gallery
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 760 }}>
            These are Aurora&apos;s built-in icons. Pick any icon id shown below and I can assign it
            to a page link.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
          <TextField
            fullWidth
            label="Search icons"
            placeholder="dashboard, inventory, map, settings, flag..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Chip label={`${filteredIcons.length} shown`} color="primary" variant="soft" />
        </Stack>

        <Grid container spacing={2}>
          {filteredIcons.map((icon) => (
            <Grid key={icon} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
              <Paper
                background={1}
                sx={{
                  p: 2,
                  height: '100%',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'background.elevation1',
                    }}
                  >
                    <IconifyIcon icon={icon} sx={{ fontSize: 24 }} />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      wordBreak: 'break-word',
                      color: 'text.secondary',
                    }}
                  >
                    {icon}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Box>
  );
};

export default IconGallery;
