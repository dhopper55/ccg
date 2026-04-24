import { KeyboardEvent, useMemo, useState } from 'react';
import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import SectionHeader from 'components/common/SectionHeader';
import StyledTextField from 'components/styled/StyledTextField';

const DECODE_URL = 'https://www.coalcreekguitars.com/api/decode';

interface GuitarInfo {
  serialNumber?: string;
  year?: string;
  month?: string;
  day?: string;
  model?: string;
  factory?: string;
  country?: string;
  notes?: string;
}

interface DecodeResponse {
  success?: boolean;
  info?: GuitarInfo;
  error?: string;
  additionalContextRichText?: string;
}

interface ActiveUsersProps {
  onAdditionalInfoChange: (richText: string) => void;
}

const ActiveUsers = ({ onAdditionalInfoChange }: ActiveUsersProps) => {
  const [serial, setSerial] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [decodedInfo, setDecodedInfo] = useState<GuitarInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const resultFields = useMemo(
    () =>
      [
        { label: 'Serial Number', value: decodedInfo?.serialNumber },
        { label: 'Year', value: decodedInfo?.year },
        { label: 'Month', value: decodedInfo?.month },
        { label: 'Day', value: decodedInfo?.day },
        { label: 'Model', value: decodedInfo?.model },
        { label: 'Factory', value: decodedInfo?.factory },
        { label: 'Country', value: decodedInfo?.country },
        { label: 'Notes', value: decodedInfo?.notes },
      ].filter((field) => Boolean(field.value && field.value.trim())),
    [decodedInfo],
  );

  const clearDecodeOutput = () => {
    setDecodedInfo(null);
    setErrorMessage('');
    onAdditionalInfoChange('');
  };

  const handleDecode = async () => {
    const trimmed = serial.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
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

      let result: DecodeResponse | null = null;
      try {
        result = (await response.json()) as DecodeResponse;
      } catch {
        result = null;
      }

      if (result?.success && result.info) {
        setDecodedInfo(result.info);
        setSerial(result.info.serialNumber?.trim() || trimmed);
        onAdditionalInfoChange((result.additionalContextRichText || '').trim());
        return;
      }

      clearDecodeOutput();
      setErrorMessage(result?.error || 'Unable to decode serial number.');
    } catch {
      clearDecodeOutput();
      setErrorMessage('Unable to decode serial number.');
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

      <Stack sx={{ gap: 2.5, maxWidth: 540, width: 1 }}>
        <StyledTextField
          variant="outlined"
          fullWidth
          placeholder="Enter serial number"
          autoFocus
          value={serial}
          onChange={(event) => {
            setSerial(event.target.value);
            if (!event.target.value.trim()) {
              clearDecodeOutput();
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(17, 14, 10, 0.68) !important',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(224, 212, 189, 0.55) !important',
              borderWidth: '1px !important',
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(224, 212, 189, 0.7) !important',
            },
            '& .MuiOutlinedInput-root.Mui-focused': {
              bgcolor: 'rgba(17, 14, 10, 0.68) !important',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(224, 212, 189, 0.7) !important',
            },
            '& .MuiOutlinedInput-input::placeholder': {
              opacity: 1,
            },
          }}
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

        {errorMessage && (
          <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 600 }}>
            {errorMessage}
          </Typography>
        )}

        {resultFields.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'dividerLight', mt: 2, opacity: 0.59 }} />
            <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
              Ibanez Guitar Info
            </Typography>
            <Stack direction="column" divider={<Divider sx={{ borderColor: 'dividerLight', opacity: 0.59 }} />}>
              {resultFields.map((field) => (
                <Stack
                  key={field.label}
                  direction="row"
                  sx={{
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 3,
                    py: 1.5,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {field.label}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'text.primary',
                      fontWeight: 700,
                      textAlign: 'right',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxWidth: '70%',
                    }}
                  >
                    {field.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
};

export default ActiveUsers;
