import { Box, Typography } from '@mui/material';

interface DecoderHistoryPanelProps {
  title: string;
  html: string;
}

// Long-form serial history (eras, example photos, prefix table) for brands whose history
// page was merged into the decoder. Markup comes from decoder-configs.json `historyHtml`.
const DecoderHistoryPanel = ({ title, html }: DecoderHistoryPanelProps) => {
  return (
    <Box id="serial-history" sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h6" mb={3} sx={{ color: 'warning.main' }}>
        {title}
      </Typography>

      <Box
        sx={{
          color: 'text.secondary',
          '& p': { mt: 0, mb: 2.5, typography: 'body2', lineHeight: 1.65 },
          '& h3': { mt: 4, mb: 2, color: 'text.primary', typography: 'h6' },
          '& h4': { mt: 0.5, mb: 1, color: 'text.primary', typography: 'subtitle1', fontWeight: 700 },
          '& strong': { color: 'text.primary', fontWeight: 600, opacity: 0.9 },
          '& em': { color: 'text.primary', fontStyle: 'normal', fontWeight: 600 },
          '& .era-block': { borderLeft: 2, borderColor: 'warning.main', pl: 2, mb: 3 },
          '& .era-label': { typography: 'caption', color: 'warning.main', letterSpacing: '0.08em', textTransform: 'uppercase' },
          '& .serial-badge': {
            fontFamily: 'Spline Sans Mono, monospace',
            fontSize: '0.8em',
            color: 'text.primary',
            bgcolor: 'rgba(224, 212, 189, 0.08)',
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            whiteSpace: 'nowrap',
          },
          '& .photo-grid': {
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mb: 2,
          },
          '& .photo-card img': { width: 1, height: 'auto', display: 'block', borderRadius: 2 },
          '& .photo-cap': { mt: 1, typography: 'caption', display: 'block', lineHeight: 1.6 },
          '& .photo-cap strong': { display: 'block' },
          '& table': { width: 1, borderCollapse: 'collapse', mb: 3, typography: 'body2' },
          '& th, & td': { textAlign: 'left', py: 0.75, pr: 1.5, borderBottom: 1, borderColor: 'divider', verticalAlign: 'top' },
          '& th': { color: 'text.primary', fontWeight: 600 },
          '& .callout-creek': { border: 1, borderColor: 'warning.main', borderRadius: 2, px: 2.5, pt: 2, pb: 0.5, mb: 3 },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Box>
  );
};

export default DecoderHistoryPanel;
