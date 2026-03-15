import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
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

type CustomSubmitResponse = {
  ok?: boolean;
  recordId?: string;
  status?: string;
  message?: string;
};

type FieldMode = 'single' | 'multi';
type FieldStatus = 'idle' | 'pasting' | 'submitting';

const PLACEHOLDERS: Record<FieldMode, string> = {
  single: 'Single Item Listing URL (paste here)',
  multi: 'Multi-Item Listing URL (paste here)',
};

const CUSTOM_MAX_PHOTOS = 10;

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

const urlFieldSx = {
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
};

const ListingEvaluator = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [singleUrl, setSingleUrl] = useState('');
  const [multiUrl, setMultiUrl] = useState('');
  const [isUrlSubmitting, setIsUrlSubmitting] = useState(false);
  const [isCustomSubmitting, setIsCustomSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeField, setActiveField] = useState<FieldMode | null>(null);
  const [fieldStatus, setFieldStatus] = useState<FieldStatus>('idle');
  const [customPhotos, setCustomPhotos] = useState<File[]>([]);
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customCondition, setCustomCondition] = useState('');
  const [customNotes, setCustomNotes] = useState('');
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

  const clearUrlFields = () => {
    setSingleUrl('');
    setMultiUrl('');
  };

  const clearCustomFields = () => {
    setCustomPhotos([]);
    setCustomBrand('');
    setCustomModel('');
    setCustomCondition('');
    setCustomNotes('');
  };

  const submitUrl = async (mode: FieldMode, rawValue: string) => {
    if (isUrlSubmitting || isCustomSubmitting) return;

    const firstUrl = extractUrls(rawValue)[0];
    if (!firstUrl || !isSupportedListingUrl(firstUrl)) {
      const message = 'Please paste a valid Craigslist or Facebook Marketplace item URL.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
      clearUrlFields();
      return;
    }

    setIsUrlSubmitting(true);
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

      enqueueSnackbar('URL submitted', { variant: 'success', autoHideDuration: 3000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to queue listing.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
    } finally {
      clearUrlFields();
      setIsUrlSubmitting(false);
      setFieldStatus('idle');
    }
  };

  const submitCustom = async () => {
    if (isUrlSubmitting || isCustomSubmitting) return;

    if (customPhotos.length < 1) {
      const message = 'Add at least one photo for a custom eval.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
      return;
    }

    if (customPhotos.length > CUSTOM_MAX_PHOTOS) {
      const message = `You can upload up to ${CUSTOM_MAX_PHOTOS} photos.`;
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
      return;
    }

    setIsCustomSubmitting(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      customPhotos.forEach((photo) => formData.append('photos', photo));
      formData.append('brand', customBrand.trim());
      formData.append('model', customModel.trim());
      formData.append('condition', customCondition.trim());
      formData.append('notes', customNotes.trim());

      const response = await fetch('/api/listings/custom', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      const data = (await response.json()) as CustomSubmitResponse;
      if (!response.ok) {
        throw new Error(data.message || 'Unable to queue custom eval.');
      }

      clearCustomFields();
      enqueueSnackbar('Custom eval submitted', { variant: 'success', autoHideDuration: 3000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to queue custom eval.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error', autoHideDuration: 3500 });
    } finally {
      setIsCustomSubmitting(false);
    }
  };

  const handleFocus = async (mode: FieldMode) => {
    if (isUrlSubmitting || isCustomSubmitting || focusAttemptRef.current[mode]) return;

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
      setFieldStatus('idle');
    }
  };

  const handleBlur = (mode: FieldMode) => {
    focusAttemptRef.current[mode] = false;
    if (!isUrlSubmitting && activeField === mode) {
      setFieldStatus('idle');
    }
  };

  const handlePaste = async (
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    mode: FieldMode,
  ) => {
    event.preventDefault();
    if (isUrlSubmitting || isCustomSubmitting) return;

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
    disabled: isUrlSubmitting || isCustomSubmitting,
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

  const handleCustomPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    setCustomPhotos(nextFiles.slice(0, CUSTOM_MAX_PHOTOS));
    setErrorMessage('');
    event.target.value = '';
  };

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
                Focus a URL field to try clipboard paste automatically, or paste manually.
                Custom evals let you upload photos for an item that is in front of you instead of
                already listed online.
              </Typography>

              <Stack direction="column" spacing={3} sx={{ width: 1 }}>
                <Box sx={{ width: 1, display: 'block' }}>
                  <TextField
                    {...buildInputProps('single', singleUrl, setSingleUrl)}
                    hiddenLabel
                    variant="filled"
                    sx={urlFieldSx}
                  />
                </Box>

                <Box sx={{ width: 1, display: 'block' }}>
                  <TextField
                    {...buildInputProps('multi', multiUrl, setMultiUrl)}
                    hiddenLabel
                    variant="filled"
                    sx={urlFieldSx}
                  />
                </Box>
              </Stack>

              <Divider sx={{ pt: 1 }} />

              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  bgcolor: 'background.elevation1',
                }}
              >
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6">Custom Item</Typography>
                  </Box>

                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    sx={{ alignItems: { md: 'center' }, width: 1 }}
                  >
                    <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                      Upload 1 to 10 photos.
                    </Typography>
                    <Button
                      component="label"
                      variant="outlined"
                      color="inherit"
                      startIcon={<IconifyIcon icon="material-symbols:add-photo-alternate-outline-rounded" />}
                      disabled={isUrlSubmitting || isCustomSubmitting}
                      sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                    >
                      {customPhotos.length > 0 ? 'Replace Photos' : 'Upload Photos'}
                      <input hidden accept="image/*" multiple type="file" onChange={handleCustomPhotoChange} />
                    </Button>
                    <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                      {customPhotos.length > 0
                        ? `${customPhotos.length} photo${customPhotos.length === 1 ? '' : 's'} selected`
                        : 'No photos selected yet'}
                    </Typography>
                    {customPhotos.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{ flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}
                      >
                        {customPhotos.map((photo) => (
                          <Typography
                            key={`${photo.name}-${photo.size}`}
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            {photo.name}
                          </Typography>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <TextField
                        fullWidth
                        label="Brand"
                        value={customBrand}
                        disabled={isUrlSubmitting || isCustomSubmitting}
                        onChange={(event) => {
                          setCustomBrand(event.target.value);
                          setErrorMessage('');
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <TextField
                        fullWidth
                        label="Model"
                        value={customModel}
                        disabled={isUrlSubmitting || isCustomSubmitting}
                        onChange={(event) => {
                          setCustomModel(event.target.value);
                          setErrorMessage('');
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <TextField
                        fullWidth
                        label="Condition"
                        value={customCondition}
                        disabled={isUrlSubmitting || isCustomSubmitting}
                        onChange={(event) => {
                          setCustomCondition(event.target.value);
                          setErrorMessage('');
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Notes"
                        value={customNotes}
                        multiline
                        minRows={1}
                        disabled={isUrlSubmitting || isCustomSubmitting}
                        onChange={(event) => {
                          setCustomNotes(event.target.value);
                          setErrorMessage('');
                        }}
                      />
                    </Grid>
                  </Grid>

                  <Stack direction="row" sx={{ width: 1 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        void submitCustom();
                      }}
                      disabled={isUrlSubmitting || isCustomSubmitting}
                      sx={{ alignSelf: 'flex-start' }}
                      startIcon={
                        isCustomSubmitting ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon="material-symbols:photo-camera-rounded" />
                      }
                    >
                      {isCustomSubmitting ? 'Submitting...' : 'Submit Custom Eval'}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

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
                {isUrlSubmitting
                  ? 'Submitting URL...'
                  : isCustomSubmitting
                    ? 'Submitting custom eval...'
                    : 'Typing is disabled for the URL boxes by design. Use clipboard paste there, or use the custom section for in-person items.'}
              </Box>
            </Stack>
          </Container>
        </Box>
      </Grid>
    </Grid>
  );
};

export default ListingEvaluator;
