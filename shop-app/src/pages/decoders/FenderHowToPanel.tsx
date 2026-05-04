import { Box, Paper, Typography } from '@mui/material';

const howToHtml = `
  <p>Fender serial formats have changed many times and can vary by factory, model line, and era. Use the steps below to narrow down the date and origin, then cross-check with hardware and specs.</p>

  <h3>1) Find the serial number</h3>
  <p>On most Fender electrics, the serial number is on the back of the headstock or the neck plate. On many Fender acoustics, it appears on a label or stamp visible through the soundhole.</p>

  <h3>2) Match the format to a production era</h3>
  <ul>
    <li><strong>1950-1954:</strong> Serial is often stamped on the bridge plate. Early serial ranges are model-specific.</li>
    <li><strong>1954-1963:</strong> Serial typically moves to the neck plate with no letter prefix.</li>
    <li><strong>1963-1965:</strong> "L" prefix, often called the L-series, appears on the neck plate.</li>
    <li><strong>1965-1976:</strong> The "Big F" neck plate commonly uses six-digit serials.</li>
    <li><strong>Post-1976 USA:</strong> Serial moves to the headstock and commonly uses a decade letter such as S, E, N, or Z plus a year digit. Later USA instruments often use a US prefix followed by two digits for the year.</li>
    <li><strong>Mexico:</strong> M-prefixed serials indicate Mexico. MN usually points to the 1990s, MZ to the 2000s, and MX to the 2010s and later.</li>
    <li><strong>Indonesia:</strong> Prefixes like <strong>IC</strong>, <strong>IS</strong>, and <strong>ICS</strong> are common. In formats like <strong>ICS11185000</strong>, the first two digits after the prefix indicate the year.</li>
    <li><strong>Japan:</strong> Many MIJ and CIJ instruments use letter-prefix serials, often located near the neck joint. Modern JD serials such as <strong>JD13006111</strong> typically use <strong>JD + YY + 6-digit sequence</strong>.</li>
    <li><strong>10-digit numeric IDs:</strong> Codes like <strong>0060579747</strong> can be internal Fender identifiers rather than date-coded guitar serials.</li>
    <li><strong>Typo or OCR caveat:</strong> If one character looks wrong, try common lookalike swaps such as <strong>O</strong> to <strong>0</strong>.</li>
  </ul>

  <h3>3) Cross-check with features</h3>
  <p>Fender production overlaps are common. Confirm your estimate using logo style, pickup types, neck heel stamps, pot codes, and other era-specific details.</p>

  <p>If your serial does not match the common formats above, it may be a special run, limited edition, or reissue.</p>

  <p><a href="https://reverb.com/news/how-to-date-a-fender" target="_blank" rel="noopener noreferrer">How to Date a Fender</a></p>
`;

const galleryItems = [
  {
    src: '/images/serial-number-examples/fender-us-tele.jpeg',
    alt: 'Fender USA Telecaster serial number',
    caption: 'Electric example: neck plate serial number.',
  },
  {
    src: '/images/serial-number-examples/fender-california-label-closeup.jpg',
    alt: 'Fender acoustic soundhole label with serial number',
    caption: 'Acoustic example: soundhole label serial number.',
  },
] as const;

const FenderHowToPanel = () => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, height: 1 }}>
      <Typography variant="h6" mb={3}>
        How to decode a Fender serial number
      </Typography>

      <Box
        sx={{
          color: 'text.secondary',
          '& p': { mt: 0, mb: 2.5, typography: 'body2', lineHeight: 1.65 },
          '& h3': { mt: 4, mb: 2, color: 'text.primary', typography: 'h6' },
          '& ul': { mt: 0, mb: 2.5, pl: 3 },
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
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
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

export default FenderHowToPanel;
