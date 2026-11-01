import { Box, Typography } from '@mui/material';
import { trackReportLinkClick } from './reportLinks';

interface DecoderReportsPanelProps {
  brand: string;
  title: string;
  html: string;
}

// Always-visible report mention. The same HTML is in the page's server-rendered snapshot,
// so search engines see it without running the decoder.
const DecoderReportsPanel = ({ brand, title, html }: DecoderReportsPanelProps) => {
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h6" mb={1.5} sx={{ color: 'warning.main' }}>
        {title}
      </Typography>
      <Box
        onClick={(event) => trackReportLinkClick(event, brand, 'decoder_static')}
        sx={{
          color: 'text.secondary',
          '& p': { m: 0, typography: 'body2', lineHeight: 1.75 },
          '& ul': { m: 0, mt: 1, pl: 2.5, typography: 'body2', lineHeight: 1.75 },
          '& a': { color: 'warning.main', fontWeight: 600 },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Box>
  );
};

export default DecoderReportsPanel;
