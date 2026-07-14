import { useState } from 'react';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import StyledTextField from 'components/styled/StyledTextField';

const EMAIL_SIGNUP_URL = 'https://www.coalcreekguitars.com/api/email-signup';

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

const EmailSignupPanel = () => {
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
      <Divider sx={{ borderColor: 'dividerLight', opacity: 0.59, mb: 2 }} />
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Get our free 5-point fretboard care guide
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
        Join our list for first access to new acquisitions — some items go to the list before they hit the shop.
      </Typography>
      {listEmailDone ? (
        <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mt: 1.5, fontWeight: 600 }}>
          ✓ You're on the list — guide on its way!
        </Typography>
      ) : (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 1.5, alignItems: { sm: 'flex-start' } }}
        >
          <StyledTextField
            type="email"
            value={listEmail}
            placeholder="Email address"
            onChange={(e) => setListEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleListSignup(); }}
            disabled={isSubmittingListEmail}
            inputProps={{ maxLength: 200 }}
            sx={{ maxWidth: 300, width: 1 }}
          />
          <Button
            variant="soft"
            color="warning"
            onClick={() => void handleListSignup()}
            disabled={isSubmittingListEmail || !isValidEmailAddress(listEmail.trim())}
            sx={{ fontWeight: 700, minWidth: 80, mt: { sm: 0.5 } }}
          >
            {isSubmittingListEmail ? '...' : 'Join'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default EmailSignupPanel;
