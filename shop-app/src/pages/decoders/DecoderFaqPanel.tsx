import { Box, Divider, Typography } from '@mui/material';

interface DecoderFaqItem {
  question: string;
  answerHtml: string;
}

interface DecoderFaqPanelProps {
  title: string;
  items: DecoderFaqItem[];
}

const DecoderFaqPanel = ({ title, items }: DecoderFaqPanelProps) => {
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h6" mb={3}>
        {title}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((item, index) => (
          <Box key={item.question}>
            <Typography variant="h6" sx={{ mb: 1.5, color: 'text.primary' }}>
              {item.question}
            </Typography>
            <Box
              sx={{
                color: 'text.secondary',
                '& p': { m: 0, typography: 'body2', lineHeight: 1.75 },
                '& strong': { color: 'text.primary', fontWeight: 600 },
                '& a': { color: 'warning.main' },
              }}
              dangerouslySetInnerHTML={{ __html: item.answerHtml }}
            />
            {index < items.length - 1 && <Divider sx={{ mt: 3 }} />}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default DecoderFaqPanel;
