import { Box, Typography } from '@mui/material';

interface DecoderHowToPanelProps {
  title: string;
  html: string;
}

const DecoderHowToPanel = ({ title, html }: DecoderHowToPanelProps) => {
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h6" mb={3}>
        {title}
      </Typography>

      <Box
        sx={{
          color: 'text.secondary',
          '& p': { mt: 0, mb: 2.5, typography: 'body2', lineHeight: 1.65 },
          '& h3': { mt: 4, mb: 2, color: 'text.primary', typography: 'h6' },
          '& ul, & ol': { mt: 0, mb: 2.5, pl: 3 },
          '& li': { mb: 1.5, typography: 'body2', lineHeight: 1.7 },
          '& strong': { color: 'text.primary', fontWeight: 600, opacity: 0.9 },
          '& a': { color: 'warning.main' },
          '& img': { width: 1, display: 'block', borderRadius: 2, maxWidth: 720 },
          '& figure': { m: 0, mt: 4 },
          '& figcaption': { mt: 1.5, display: 'block', typography: 'caption', color: 'text.secondary' },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Box>
  );
};

export default DecoderHowToPanel;
