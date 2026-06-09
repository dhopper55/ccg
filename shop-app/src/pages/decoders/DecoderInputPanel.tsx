import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Divider, Link, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import SectionHeader from 'components/common/SectionHeader';
import StyledTextField from 'components/styled/StyledTextField';

const GOOGLE_REVIEW_URL = 'https://g.page/r/CYgEveOaLAOjEBM/review';

const DECODE_URL = 'https://www.coalcreekguitars.com/api/decode';
const DECODE_EMAIL_URL = 'https://www.coalcreekguitars.com/api/decode/email';
const FAILED_DECODE_EMAIL_PROMPT =
  'Coal Creek Guitars logs all serial number decode attempts for all brands. Since this decode failed, we will automatically research the number in the coming days and if we find out it is in fact a valid serial number, we will update the decoder. If you would like us to email you in the event that this number is valid, please enter your email below and click submit.';

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

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
  serialDecodeEventId?: number;
}

interface DecoderInputPanelProps {
  brand: string;
  brandDisplayName: string;
  onAdditionalInfoChange: (richText: string) => void;
  onDecodeSuccess?: (data: { serial: string; decodeEventId: number | null } | null) => void;
}

const DecoderInputPanel = ({ brand, brandDisplayName, onAdditionalInfoChange, onDecodeSuccess }: DecoderInputPanelProps) => {
  const [searchParams] = useSearchParams();
  const [serial, setSerial] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [decodedInfo, setDecodedInfo] = useState<GuitarInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedDecodeEventId, setFailedDecodeEventId] = useState<number | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubmitMessage, setEmailSubmitMessage] = useState('');
  const [emailSubmitError, setEmailSubmitError] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
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
    setFailedDecodeEventId(null);
    setEmailAddress('');
    setEmailSubmitMessage('');
    setEmailSubmitError('');
    onAdditionalInfoChange('');
    onDecodeSuccess?.(null);
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
        setFailedDecodeEventId(null);
        setEmailAddress('');
        setEmailSubmitMessage('');
        setEmailSubmitError('');
        const resolvedSerial = result.info.serialNumber?.trim() || trimmed;
        setSerial(resolvedSerial);
        onAdditionalInfoChange((result.additionalContextRichText || '').trim());
        onDecodeSuccess?.({
          serial: resolvedSerial,
          decodeEventId: typeof result.serialDecodeEventId === 'number' ? result.serialDecodeEventId : null,
        });
        return;
      }

      clearDecodeOutput();
      setErrorMessage(result?.error || 'Unable to decode serial number.');
      setFailedDecodeEventId(typeof result?.serialDecodeEventId === 'number' ? result.serialDecodeEventId : null);
    } catch {
      clearDecodeOutput();
      setErrorMessage('Unable to decode serial number.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    const trimmedEmail = emailAddress.trim().toLowerCase();
    const trimmedSerial = serial.trim();
    setEmailSubmitMessage('');
    setEmailSubmitError('');

    if (!failedDecodeEventId) {
      setEmailSubmitError('Unable to attach email to this decode record.');
      return;
    }
    if (!isValidEmailAddress(trimmedEmail)) {
      setEmailSubmitError('Enter a valid email address.');
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const response = await fetch(DECODE_EMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decodeEventId: failedDecodeEventId,
          brand,
          serial: trimmedSerial,
          email: trimmedEmail,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setEmailSubmitError(result?.message || 'Unable to submit email address.');
        return;
      }
      setEmailAddress(trimmedEmail);
      setEmailSubmitMessage('Email submitted. We will follow up if this serial number is verified.');
    } catch {
      setEmailSubmitError('Unable to submit email address.');
    } finally {
      setIsSubmittingEmail(false);
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
    <Box
      sx={{
        height: 1,
        pt: { xs: 2, md: 3 },
        pr: { xs: 2, md: 3 },
        pb: { xs: 2, md: 3 },
        pl: { xs: 1, md: '10px' },
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
            {errorMessage && (
              <Box sx={{ mt: 2.5, maxWidth: 720 }}>
                <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
                  {errorMessage}
                </Typography>
                <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 2, lineHeight: 1.7 }}>
                  {FAILED_DECODE_EMAIL_PROMPT}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2, alignItems: { sm: 'flex-start' } }}>
                  <StyledTextField
                    type="email"
                    value={emailAddress}
                    placeholder="Email address"
                    onChange={(event) => {
                      setEmailAddress(event.target.value);
                      setEmailSubmitError('');
                      setEmailSubmitMessage('');
                    }}
                    disabled={isSubmittingEmail || Boolean(emailSubmitMessage)}
                    inputProps={{ maxLength: 200 }}
                    error={Boolean(emailSubmitError)}
                    helperText={emailSubmitError || emailSubmitMessage || ' '}
                    sx={{ maxWidth: 340, width: 1 }}
                  />
                  <Button
                    variant="soft"
                    color="warning"
                    onClick={() => {
                      void handleEmailSubmit();
                    }}
                    disabled={isSubmittingEmail || Boolean(emailSubmitMessage)}
                    sx={{ fontWeight: 700, minWidth: 120, mt: { sm: 0.5 } }}
                  >
                    {isSubmittingEmail ? 'Submitting...' : 'Submit'}
                  </Button>
                </Stack>
              </Box>
            )}
          </>
        )}

        {resultFields.length > 0 && (
          <Box sx={{ width: 1, mt: 2 }}>
            <Divider sx={{ borderColor: 'dividerLight', opacity: 0.59 }} />
            <Stack
              direction="row"
              sx={{
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 2,
                mt: 1.5,
                mb: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700 }}>
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
              {resultFields.map((field) => {
                const isNotes = field.label === 'Notes';
                return (
                  <Stack
                    key={field.label}
                    direction="row"
                    sx={{
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 2,
                      py: 0.5,
                      width: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', fontWeight: 400, flexShrink: 0 }}
                    >
                      {field.label}
                    </Typography>
                    <Typography
                      variant={isNotes ? 'caption' : 'body2'}
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                        textAlign: 'right',
                        wordBreak: 'break-word',
                        maxWidth: { xs: '60%', md: '70%' },
                      }}
                    >
                      {field.value}
                    </Typography>
                  </Stack>
                );
              })}
              <Box sx={{ py: 0.75 }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.6 }}
                >
                  This decode was completely free — no catch. If it helped you, 30 seconds on Google goes a long way for us.
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="soft"
                color="warning"
                startIcon={<IconifyIcon icon="logos:google-icon" />}
                component="a"
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 700 }}
              >
                Leave a Google Review
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DecoderInputPanel;
