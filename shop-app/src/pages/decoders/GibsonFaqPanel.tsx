import { Box, Divider, Paper, Typography } from '@mui/material';

const faqItems = [
  {
    question: 'Where can I find the Gibson serial number?',
    answer:
      'Most Gibson guitars list the serial number on the back of the headstock. Some acoustics place it inside the soundhole on a paper label, and older instruments may use a neck plate or stamped marking. If you cannot find it, check the headstock back and the neck joint first.',
  },
  {
    question: 'What can this Gibson serial number lookup/decoder tell me?',
    answer:
      'It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by era.',
  },
  {
    question: "Why won't my Gibson serial number decode?",
    answer:
      'Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, reach out so we can review it and improve the decoder.',
  },
] as const;

const GibsonFaqPanel = () => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Typography variant="h6" mb={3}>
        Gibson Serial Number Lookup/Decoder FAQs
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {faqItems.map((item, index) => (
          <Box key={item.question}>
            <Typography variant="h6" sx={{ mb: 1.5, color: 'text.primary' }}>
              {item.question}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
              {item.answer}
            </Typography>
            {index < faqItems.length - 1 && <Divider sx={{ mt: 3 }} />}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default GibsonFaqPanel;
