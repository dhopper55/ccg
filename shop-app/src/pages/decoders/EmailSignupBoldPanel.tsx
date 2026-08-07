import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import StyledTextField from 'components/styled/StyledTextField';

const EMAIL_SIGNUP_URL = 'https://www.coalcreekguitars.com/api/email-signup';

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

const EmailSignupBoldPanel = () => {
  const [listEmail, setListEmail] = useState('');
  const [isSubmittingListEmail, setIsSubmittingListEmail] = useState(false);
  const [listEmailDone, setListEmailDone] = useState(false);

  const handleListSignup = async () => {
    const trimmed = listEmail.trim().toLowerCase();
    if (!isValidEmailAddress(trimmed)) return;
    setIsSubmittingListEmail(true);
    try {
      const response = await fetch(EMAIL_SIGNUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (response.ok) setListEmailDone(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setIsSubmittingListEmail(false);
    }
  };

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
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', mb: 0.5 }}>
          Get our free 5-point fretboard care guide.
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'block', mb: 1.75 }}>
          Join our email list and we'll send it right over — plus first access to new acquisitions, some of which go to the list before they hit the shop.
        </Typography>

        {listEmailDone ? (
          <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700 }}>
            ✓ You're on the list — guide on its way!
          </Typography>
        ) : (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { sm: 'flex-start' } }}
          >
            <StyledTextField
              type="email"
              value={listEmail}
              placeholder="Email address"
              onChange={(e) => setListEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleListSignup(); }}
              disabled={isSubmittingListEmail}
              inputProps={{ maxLength: 200 }}
              sx={{ maxWidth: 300, width: 1, bgcolor: 'background.paper' }}
            />
            <Button
              variant="contained"
              color="warning"
              onClick={() => void handleListSignup()}
              disabled={isSubmittingListEmail || !isValidEmailAddress(listEmail.trim())}
              sx={{
                fontWeight: 700,
                minWidth: 80,
                mt: { sm: 0.5 },
                animation: 'emailPulse 3s ease-in-out infinite',
                '@keyframes emailPulse': {
                  '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 167, 38, 0)' },
                  '55%': { boxShadow: '0 0 0 6px rgba(255, 167, 38, 0.30)' },
                },
              }}
            >
              {isSubmittingListEmail ? '...' : 'Send Me the Guide'}
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default EmailSignupBoldPanel;
