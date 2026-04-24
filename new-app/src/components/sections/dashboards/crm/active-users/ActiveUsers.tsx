import { KeyboardEvent, useState } from 'react';
import { Button, Paper, Stack } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import SectionHeader from 'components/common/SectionHeader';
import StyledTextField from 'components/styled/StyledTextField';

const DECODE_URL = 'https://www.coalcreekguitars.com/api/decode';

const ActiveUsers = () => {
  const [serial, setSerial] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDecode = async () => {
    const trimmed = serial.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(DECODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: 'ibanez',
          serial: trimmed,
          pagePath: window.location.pathname,
          userAgent: navigator.userAgent,
          clientTimestamp: new Date().toString(),
        }),
      });

      let alertText = '';
      try {
        const json = await response.json();
        alertText = JSON.stringify(json);
      } catch {
        alertText = await response.text();
      }

      window.alert(alertText.slice(0, 200));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decode request failed';
      window.alert(message.slice(0, 200));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleDecode();
    }
  };

  return (
    <Paper
      sx={{
        height: 1,
        overflow: 'hidden',
        p: { xs: 3, md: 5 },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SectionHeader title="Ibanez Number to Decode" sx={{ mb: { xs: 2, md: 4 } }} />

      <Stack sx={{ gap: 2.5, maxWidth: 420 }}>
        <StyledTextField
          fullWidth
          placeholder="Enter serial number"
          autoFocus
          value={serial}
          onChange={(event) => setSerial(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <Button
          variant="soft"
          color="warning"
          startIcon={<IconifyIcon icon="material-symbols:psychology-alt-rounded" />}
          onClick={() => {
            void handleDecode();
          }}
          disabled={isLoading}
          sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
        >
          {isLoading ? 'Decoding...' : 'Decode'}
        </Button>
      </Stack>
    </Paper>
  );
};

export default ActiveUsers;
