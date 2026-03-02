import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type SubmitResponse = {
  accepted?: number;
  rejected?: Array<{ url: string; reason: string }>;
  message?: string;
};

type FieldMode = 'single' | 'multi';
type FieldStatus = 'idle' | 'pasting' | 'submitting';

const PLACEHOLDERS: Record<FieldMode, string> = {
  single: 'Single Item Listing URL (paste here)',
  multi: 'Multi-Item Listing URL (paste here)',
};

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }

  if (/^(www\.|facebook\.com|m\.facebook\.com|craigslist\.)/i.test(trimmed)) {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }

  return null;
}

function extractUrls(input: string): string[] {
  const matches = input.match(/https?:\/\/[^\s]+/gi) || [];
  const candidates = matches.length > 0 ? matches : input.split(/[\s,]+/g);
  const urls = candidates
    .map((candidate) => normalizeUrl(candidate))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(urls));
}

function isSupportedListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('facebook.com')) {
      return path.includes('/marketplace/item/') || path.startsWith('/share/');
    }

    if (host.endsWith('craigslist.org')) {
      return path.includes('/d/') || path.startsWith('/msg/');
    }

    return false;
  } catch {
    return false;
  }
}

const ListingEvaluator = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [singleUrl, setSingleUrl] = useState('');
  const [multiUrl, setMultiUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeField, setActiveField] = useState<FieldMode | null>(null);
  const [fieldStatus, setFieldStatus] = useState<FieldStatus>('idle');
  const focusAttemptRef = useRef<Record<FieldMode, boolean>>({
    single: false,
    multi: false,
  });
  const lastAutoPasteRef = useRef<Record<FieldMode, string>>({
    single: '',
    multi: '',
  });

  useEffect(() => {
    document.title = 'CCG Admin | Listing Evaluator';
  }, []);

  const resultsAction = useMemo(
    () => (
      <Tooltip title="Results">
        <IconButton
          aria-label="Results"
          onClick={() => navigate(paths.listingEvaluatorResults)}
          sx={{
            width: 40,
            height: 40,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.elevation1',
            color: 'text.primary',
            '&:hover': {
              bgcolor: 'background.elevation2',
            },
          }}
        >
          <IconifyIcon icon="material-symbols:list-alt-rounded" fontSize={20} />
        </IconButton>
      </Tooltip>
    ),
    [navigate],
  );

  const clearFields = () => {
    setSingleUrl('');
    setMultiUrl('');
  };

  const submitUrl = async (mode: FieldMode, rawValue: string) => {
    if (isSubmitting) return;

    const firstUrl = extractUrls(rawValue)[0];
    if (!firstUrl || !isSupportedListingUrl(firstUrl)) {
      const message =
        'Please paste a valid Craigslist or Facebook Marketplace item URL.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
      clearFields();
      return;
    }

    setIsSubmitting(true);
    setActiveField(mode);
    setFieldStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/listings/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          urls: [{ url: firstUrl, isMulti: mode === 'multi' }],
        }),
      });

      const data = (await response.json()) as SubmitResponse;

      if (!response.ok) {
        throw new Error(data.message || 'Unable to queue listing.');
      }

      const rejection = data.rejected?.[0];
      if ((data.accepted || 0) < 1 && rejection) {
        const message = rejection.reason || 'Unable to queue listing.';
        setErrorMessage(message);
        enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
        return;
      }

      enqueueSnackbar('Url Submitted', { variant: 'success', autoHideDuration: 3000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to queue listing.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
    } finally {
      clearFields();
      setIsSubmitting(false);
      setFieldStatus('idle');
    }
  };

  const handleFocus = async (mode: FieldMode) => {
    if (isSubmitting || focusAttemptRef.current[mode]) return;

    focusAttemptRef.current[mode] = true;
    setActiveField(mode);
    setFieldStatus('pasting');

    try {
      const clipboardText = await navigator.clipboard?.readText?.();
      if (!clipboardText) {
        setFieldStatus('idle');
        return;
      }

      const firstUrl = extractUrls(clipboardText)[0];
      if (!firstUrl || !isSupportedListingUrl(firstUrl)) {
        setFieldStatus('idle');
        return;
      }
      if (lastAutoPasteRef.current[mode] === firstUrl) {
        setFieldStatus('idle');
        return;
      }

      lastAutoPasteRef.current[mode] = firstUrl;

      if (mode === 'single') {
        setSingleUrl(firstUrl);
        setMultiUrl('');
      } else {
        setMultiUrl(firstUrl);
        setSingleUrl('');
      }

      await submitUrl(mode, firstUrl);
    } catch {
      // Wait for manual paste if clipboard access is unavailable.
      setFieldStatus('idle');
    }
  };

  const handleBlur = (mode: FieldMode) => {
    focusAttemptRef.current[mode] = false;
    if (!isSubmitting && activeField === mode) {
      setFieldStatus('idle');
    }
  };

  const handlePaste = async (
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    mode: FieldMode,
  ) => {
    event.preventDefault();
    if (isSubmitting) return;

    const pastedText = event.nativeEvent.clipboardData?.getData('text') || '';
    const firstUrl = extractUrls(pastedText)[0] || pastedText.trim();

    if (mode === 'single') {
      setSingleUrl(firstUrl);
      setMultiUrl('');
    } else {
      setMultiUrl(firstUrl);
      setSingleUrl('');
    }

    await submitUrl(mode, pastedText);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const allowedKeys = new Set([
      'Tab',
      'Escape',
      'Shift',
      'Meta',
      'Control',
      'Alt',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]);

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
      return;
    }

    if (allowedKeys.has(event.key)) {
      return;
    }

    event.preventDefault();
  };

  const buildInputProps = (
    mode: FieldMode,
    value: string,
    setValue: (nextValue: string) => void,
  ) => ({
    value,
    placeholder: PLACEHOLDERS[mode],
    disabled: isSubmitting,
    fullWidth: true as const,
    size: 'medium' as const,
    autoComplete: 'off',
    onFocus: () => {
      void handleFocus(mode);
    },
    onBlur: () => handleBlur(mode),
    onPaste: (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      void handlePaste(event, mode);
    },
    onKeyDown: handleKeyDown,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      setErrorMessage('');
    },
    InputProps: {
      endAdornment:
        activeField === mode ? (
          <InputAdornment position="end">
            {fieldStatus === 'pasting' ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={14} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Pasting...
                </Typography>
              </Stack>
            ) : fieldStatus === 'submitting' ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={14} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Submitting...
                </Typography>
              </Stack>
            ) : (
              <IconifyIcon
                icon="material-symbols:content-paste-go-outline-rounded"
                sx={{ color: 'text.secondary', fontSize: 20 }}
              />
            )}
          </InputAdornment>
        ) : null,
    },
    slotProps: {
      htmlInput: {
        inputMode: 'url',
        spellCheck: 'false',
        autoCapitalize: 'none',
        autoCorrect: 'off',
      },
    },
  });

  return (
    <Grid container>
      <Grid size={12}>
        <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
          <Stack
            sx={{
              gap: 2,
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h4">Listing Evaluator</Typography>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {resultsAction}
            </Stack>
          </Stack>
        </Paper>
      </Grid>

      <Grid size={12}>
        <Box sx={{ mt: 3 }}>
          <Container
            maxWidth={false}
            disableGutters
            sx={{
              py: { xs: 4, md: 5 },
              px: { xs: 3, md: 5, lg: 6 },
            }}
          >
            <Stack direction="column" spacing={4}>
              <Typography sx={{ color: 'text.secondary', maxWidth: 1 }}>
                Focus a field to try clipboard paste automatically, or paste manually. Submission
                starts as soon as a valid URL is pasted.
              </Typography>

              <Stack direction="column" spacing={3} sx={{ width: 1 }}>
                <Box sx={{ width: 1, display: 'block' }}>
                  <TextField
                    {...buildInputProps('single', singleUrl, setSingleUrl)}
                    hiddenLabel
                    variant="filled"
                    sx={{
                      width: 1,
                      display: 'block',
                      '& .MuiFilledInput-root': {
                        minHeight: 72,
                        borderRadius: 3,
                        bgcolor: 'background.elevation2',
                        border: 1,
                        borderColor: 'divider',
                        boxShadow: 'none',
                        '&:before, &:after': {
                          display: 'none',
                        },
                        '&:hover': {
                          bgcolor: 'background.elevation2',
                        },
                        '&.Mui-focused': {
                          bgcolor: 'background.elevation2',
                          borderColor: 'primary.main',
                        },
                        '&.Mui-disabled': {
                          bgcolor: 'background.elevation2',
                          opacity: 0.72,
                        },
                      },
                      '& .MuiFilledInput-input': {
                        py: 0,
                      },
                    }}
                  />
                </Box>
                <Box sx={{ width: 1, display: 'block' }}>
                  <TextField
                    {...buildInputProps('multi', multiUrl, setMultiUrl)}
                    hiddenLabel
                    variant="filled"
                    sx={{
                      width: 1,
                      display: 'block',
                      '& .MuiFilledInput-root': {
                        minHeight: 72,
                        borderRadius: 3,
                        bgcolor: 'background.elevation2',
                        border: 1,
                        borderColor: 'divider',
                        boxShadow: 'none',
                        '&:before, &:after': {
                          display: 'none',
                        },
                        '&:hover': {
                          bgcolor: 'background.elevation2',
                        },
                        '&.Mui-focused': {
                          bgcolor: 'background.elevation2',
                          borderColor: 'primary.main',
                        },
                        '&.Mui-disabled': {
                          bgcolor: 'background.elevation2',
                          opacity: 0.72,
                        },
                      },
                      '& .MuiFilledInput-input': {
                        py: 0,
                      },
                    }}
                  />
                </Box>
              </Stack>

              {errorMessage ? (
                <Alert severity="error" sx={{ alignSelf: 'flex-start' }}>
                  {errorMessage}
                </Alert>
              ) : null}

              <Box
                sx={{
                  color: 'text.secondary',
                  fontSize: 'body2.fontSize',
                }}
              >
                {isSubmitting
                  ? 'Submitting URL...'
                  : 'Typing is disabled by design. Use clipboard paste or let the browser auto-paste when permission allows.'}
              </Box>
            </Stack>
          </Container>
        </Box>
      </Grid>
    </Grid>
  );
};

export default ListingEvaluator;
