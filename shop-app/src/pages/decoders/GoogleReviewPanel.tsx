import { Box, Button, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

const GOOGLE_REVIEW_URL = 'https://g.page/r/CYgEveOaLAOjEBM/review';

const GoogleReviewPanel = () => {
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'warning.main',
          borderRadius: 2,
          px: 2.5,
          py: 2,
          bgcolor: 'warning.lighter',
          boxShadow: '0 0 18px 3px rgba(255, 175, 0, 0.10)',
        }}
      >
        {/* Stars */}
        <Box sx={{ display: 'flex', gap: 0.25, mb: 1.25 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Box
              key={n}
              component="span"
              sx={{ color: 'warning.main', fontSize: '1.25rem', lineHeight: 1, userSelect: 'none' }}
            >
              ★
            </Box>
          ))}
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', mb: 0.5 }}>
          5-star rated on Google &mdash; our decodes are always free.
        </Typography>

        {/* Customer quote */}
        <Box
          sx={{
            borderLeft: '3px solid',
            borderColor: 'warning.main',
            pl: 1.25,
            my: 1.25,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, fontStyle: 'italic', display: 'block' }}>
            &ldquo;Gave me some info I was definitely interested in such as the year and country it was built in.&rdquo;
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'block', mb: 1.75 }}>
          If we've helped you, a quick review makes a real difference for a small shop like ours.
        </Typography>

        <Button
          variant="contained"
          color="warning"
          size="small"
          startIcon={<IconifyIcon icon="logos:google-icon" />}
          component="a"
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            fontWeight: 700,
            animation: 'reviewPulse 3s ease-in-out infinite',
            '@keyframes reviewPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 167, 38, 0)' },
              '55%': { boxShadow: '0 0 0 6px rgba(255, 167, 38, 0.30)' },
            },
          }}
        >
          Leave a Google Review
        </Button>
      </Box>
    </Box>
  );
};

export default GoogleReviewPanel;
