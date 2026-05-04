import { Box, Paper, Typography } from '@mui/material';

const howToHtml = `
  <p>Gibson serial numbers have changed over time, but most modern Gibson USA, Gibson Acoustic, and Gibson Memphis instruments use an 8-digit stamp on the back of the headstock. If your serial doesn't match the standard pattern, it may be from a different era, model line, or special run. Use this decoder or the official Gibson guide to confirm.</p>

  <ol>
    <li><strong>Find the serial number.</strong> On many Gibsons it is stamped or impressed on the back of the headstock, often with "MADE IN USA" below.</li>
    <li><strong>Check the 8-digit format (1977-present).</strong> The most common pattern is <strong>YDDDYRRR</strong>. The 1st and 5th digits indicate the year, the middle three digits are the day of the year, and the last three digits are the factory ranking or plant designation for that day.</li>
    <li><strong>Watch for 1975-1977 decals.</strong> In that period, Gibson used an 8-digit decal where the first two digits indicate the year (99 = 1975, 00 = 1976, 06 = 1977).</li>
  </ol>

  <p>Still unsure? Gibson has multiple exceptions and model-specific formats. The official Gibson serial number guide is the best reference for tricky cases.</p>

  <p><a href="https://www.gibson.com/pages/serial-number-search" target="_blank" rel="noopener noreferrer">Gibson Serial Number Guide</a></p>
`;

const galleryItems = [
  {
    src: '/images/serial-number-examples/gibson-sg-serial-1984.jpg',
    alt: 'Gibson SG Standard headstock back with stamped serial number',
    caption: 'Electric example: headstock stamp.',
  },
  {
    src: '/images/serial-number-examples/gibson-les-paul-deluxe-serial.jpg',
    alt: 'Gibson Les Paul Deluxe serial number detail',
    caption: 'Electric example: serial number detail.',
  },
  {
    src: '/images/serial-number-examples/gibson-j200-soundhole-label.jpg',
    alt: 'Gibson acoustic soundhole label with serial number',
    caption: 'Acoustic example: soundhole label serial number.',
  },
] as const;

const GibsonHowToPanel = () => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, height: 1 }}>
      <Typography variant="h6" mb={3}>
        How to decode a Gibson serial number
      </Typography>

      <Box
        sx={{
          color: 'text.secondary',
          '& p': { mt: 0, mb: 2.5, typography: 'body2', lineHeight: 1.65 },
          '& ol': { mt: 0, mb: 2.5, pl: 3 },
          '& li': { mb: 1.5, typography: 'body2', lineHeight: 1.7 },
          '& strong': { color: 'text.primary', fontWeight: 600, opacity: 0.9 },
          '& a': { color: 'warning.main' },
        }}
        dangerouslySetInnerHTML={{ __html: howToHtml }}
      />

      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {galleryItems.map((item) => (
          <Box component="figure" key={item.src} sx={{ m: 0 }}>
            <Box
              component="img"
              src={item.src}
              alt={item.alt}
              loading="lazy"
              sx={{
                width: 1,
                borderRadius: 2,
                display: 'block',
              }}
            />
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              {item.caption}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default GibsonHowToPanel;
