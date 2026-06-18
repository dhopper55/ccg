import { useState } from 'react';
import { Box, Dialog, Stack, Typography } from '@mui/material';

const SAMPLE_REPORT_URL =
  'https://www.coalcreekguitars.com/guitar-value-report-evaluation/sample-report.html';
const EVAL_SAMPLE_IMAGES = [1, 2, 3, 4, 5].map((n) => `/images/eval-samples/${n}.png`);

interface EvalPitchPanelProps {
  brand: string;
  year?: string;
  serial: string;
  decodeEventId: number | null;
}

const EvalPitchPanel = ({ brand, year, serial, decodeEventId }: EvalPitchPanelProps) => {
  // Hidden until report pricing is finalized — restore by removing this line
  return null;

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const params = new URLSearchParams({ brand, serial });
  if (decodeEventId != null) params.set('decodeId', String(decodeEventId));
  const evalHref = `/guitar-value-report-evaluation/?${params.toString()}`;
  const headline = year ? `What's your ${year} ${brand} worth?` : `What's your ${brand} worth?`;

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Mini pitch */}
      <Box
        sx={{
          border: 1,
          borderColor: 'warning.main',
          borderRadius: 2,
          px: 2.5,
          py: 2,
          mb: 3,
        }}
      >
        <Box component="p" sx={{ m: 0, typography: 'body2', lineHeight: 1.9 }}>
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {headline}
          </Box>
        </Box>
        <Box component="p" sx={{ m: 0, mt: 0.5, typography: 'body2', lineHeight: 1.9 }}>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            Get Reverb comps, dealer offers &amp; a ready-to-post listing &mdash; just $1.99
          </Box>
        </Box>
        <Box sx={{ mt: 1 }}>
          <Box
            component="a"
            href={evalHref}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              color: 'warning.main',
              fontWeight: 600,
              fontSize: '0.8rem',
              border: 1,
              borderColor: 'warning.main',
              borderRadius: 1,
              px: 1,
              py: 0.25,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: 'rgba(184,150,12,0.08)' },
              transition: 'background-color 0.15s',
            }}
          >
            → Get My Report
          </Box>
        </Box>
      </Box>

      {/* Social proof */}
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
        We have checked many other {brand} sales recently so you don't have to.
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        100's of highly detailed reports delivered — usually ready in 1–2 hours, at most a few hours.
      </Typography>

      {/* Sample link */}
      <Box
        component="a"
        href={SAMPLE_REPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          color: 'text.secondary',
          textDecoration: 'underline',
          fontSize: '0.875rem',
          mb: 2.5,
          '&:hover': { color: 'text.primary' },
        }}
      >
        <Box
          component="img"
          src="/images/html.png"
          alt="HTML"
          sx={{ width: 18, height: 18, objectFit: 'contain' }}
        />
        Click here to see a sample report.
      </Box>

      {/* Thumbnails */}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {EVAL_SAMPLE_IMAGES.map((src) => (
          <Box
            key={src}
            component="img"
            src={src}
            onClick={() => setLightboxSrc(src)}
            sx={{
              width: 80,
              height: 60,
              objectFit: 'cover',
              borderRadius: 1,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'border-color 0.15s, opacity 0.15s',
              '&:hover': { borderColor: 'warning.main', opacity: 0.85 },
            }}
          />
        ))}
      </Stack>

      {/* Lightbox */}
      <Dialog
        open={Boolean(lightboxSrc)}
        onClose={() => setLightboxSrc(null)}
        maxWidth={false}
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', m: 1 } }}
      >
        <Box
          component="img"
          src={lightboxSrc || ''}
          onClick={() => setLightboxSrc(null)}
          sx={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            display: 'block',
            borderRadius: 1,
            cursor: 'pointer',
          }}
        />
      </Dialog>
    </Box>
  );
};

export default EvalPitchPanel;
