import { Box, Divider, Paper, Typography } from '@mui/material';

const faqItems = [
  {
    question: 'Where can I find the Ibanez serial number?',
    answer:
      'Most Ibanez guitars list the serial number on the back of the headstock. Some acoustics place it inside the soundhole on a paper label, and older instruments may use a neck plate or stamped marking. If you cannot find it, check the headstock back and the neck joint first.',
  },
  {
    question: 'What can this Ibanez serial number lookup/decoder tell me?',
    answer:
      'It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by era.',
  },
  {
    question: "Why won't my Ibanez serial number decode?",
    answer:
      "Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. The decoder now retries common formatting fixes automatically (such as removing spaces/hyphens), but some serials still require manual review. Also, model codes (for example SR305EDX or GRG170DX) are not serial numbers and usually cannot provide exact month/year without the actual stamped serial.",
  },
] as const;

const IbanezFaqPanel = () => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Typography variant="h6" mb={3}>
        Ibanez Serial Number Lookup/Decoder FAQs
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

export default IbanezFaqPanel;
