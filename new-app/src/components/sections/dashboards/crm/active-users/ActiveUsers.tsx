import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Divider, Link, Paper, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router';
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
  brand: string;
  brandDisplayName: string;
  onAdditionalInfoChange: (richText: string) => void;
}

const ActiveUsers = ({ brand, brandDisplayName, onAdditionalInfoChange }: ActiveUsersProps) => {
  const [searchParams] = useSearchParams();
  const [serial, setSerial] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [decodedInfo, setDecodedInfo] = useState<GuitarInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const initialSerial = searchParams.get('serial')?.trim() || '';
  const hasAutoDecodedRef = useRef(false);

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

  const handleDecode = async (serialOverride?: string) => {
    const trimmed = (serialOverride ?? serial).trim();
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
          brand,
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

  useEffect(() => {
    if (initialSerial && !serial) {
      setSerial(initialSerial);
    }
  }, [initialSerial, serial]);

  useEffect(() => {
    if (!initialSerial || hasAutoDecodedRef.current || decodedInfo || errorMessage || isLoading) return;
    hasAutoDecodedRef.current = true;
    void handleDecode(initialSerial);
  }, [decodedInfo, errorMessage, initialSerial, isLoading]);

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
      {!decodedInfo && (
        <SectionHeader title={`${brandDisplayName} Number to Decode`} sx={{ mb: { xs: 2, md: 4 } }} />
      )}

      <Box sx={{ width: 1 }}>
        {!decodedInfo && (
          <>
            <Box sx={{ maxWidth: 540 }}>
              <StyledTextField
                variant="outlined"
                fullWidth
                placeholder={`Enter ${brandDisplayName} serial number`}
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
            </Box>

            <Box sx={{ mt: 2.5 }}>
              <Button
                variant="soft"
                color="warning"
                startIcon={<IconifyIcon icon="material-symbols:psychology-alt-rounded" />}
                onClick={() => {
                  void handleDecode();
                }}
                disabled={isLoading}
                sx={{ fontWeight: 700 }}
              >
                {isLoading ? 'Decoding...' : 'Decode'}
              </Button>
            </Box>
          </>
        )}

        {errorMessage && (
          <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 600, mt: 2.5 }}>
            {errorMessage}
          </Typography>
        )}

        {resultFields.length > 0 && (
          <Box sx={{ width: 1, mt: 3 }}>
            <Divider sx={{ borderColor: 'dividerLight', opacity: 0.59 }} />
            <Stack
              direction="row"
              sx={{
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 2,
                mt: 2.5,
                mb: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
                Decoder Results
              </Typography>
              <Link
                component="button"
                type="button"
                onClick={() => window.location.reload()}
                underline="hover"
                color="warning.main"
                sx={{ fontSize: 12, fontWeight: 600 }}
              >
                Start Over..
              </Link>
            </Stack>
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
                    width: 1,
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
                      maxWidth: { xs: '60%', md: '70%' },
                    }}
                  >
                    {field.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ActiveUsers;
