import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Grid from '@mui/material/Grid';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type ValueReportRecord = {
  id: number;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  brand: string | null;
  brandOther: string | null;
  colorFinish: string | null;
  model: string | null;
  serialNumber: string | null;
  includesCase: string | null;
  location: string | null;
  note: string | null;
  damage: string | null;
  type: string | null;
  curiosityReason: string | null;
  authenticityReportData: AuthenticityReportData | null;
  stripePaymentIntentId: string | null;
  fulfilled: number;
  imageUrls: string[];
  reportGuid: string | null;
  reportR2Key: string | null;
  reportError: string | null;
  reportCost: number | null;
};

// ── Authenticity report (human-forward, zero-AI) ────────────────────────────
type SpecRow = { label: string; expected: string; observed: string };
type MarkerStatus = 'consistent' | 'inconsistent' | 'unable_to_verify';
type MarkerRow = { marker: string; status: MarkerStatus; note: string };
type Severity = 'minor' | 'moderate' | 'major';
type RedFlagRow = { description: string; severity: Severity };
type VerdictValue = 'genuine' | 'likely_genuine' | 'inconclusive' | 'likely_not_authentic';
type Confidence = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

type AuthenticityReportData = {
  identity: { brandConfirmed: string; modelConfirmed: string; yearConfirmed: string; variantNotes: string; confidenceStatement: string };
  specs: SpecRow[];
  markers: MarkerRow[];
  redFlags: { none: boolean; items: RedFlagRow[] };
  verdict: { determination: VerdictValue; confidence: Confidence; reasoning: string; raiseConfidenceNote: string };
  certificateSummary: string;
};

const DEFAULT_AUTH_DATA: AuthenticityReportData = {
  identity: { brandConfirmed: '', modelConfirmed: '', yearConfirmed: '', variantNotes: '', confidenceStatement: '' },
  specs: [],
  markers: [],
  redFlags: { none: true, items: [] },
  verdict: { determination: 'inconclusive', confidence: 'medium', reasoning: '', raiseConfidenceNote: '' },
  certificateSummary: '',
};

type ValueReportItemResponse = {
  record?: ValueReportRecord;
  message?: string;
};

const ro = { readOnly: true };

const ValueReportItem = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [record, setRecord] = useState<ValueReportRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [fulfilled, setFulfilled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Authenticity report (human-forward; AI polish is optional and only rewrites given text)
  const [authData, setAuthData] = useState<AuthenticityReportData>(DEFAULT_AUTH_DATA);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistText, setChecklistText] = useState('');
  const [isParsingChecklist, setIsParsingChecklist] = useState(false);
  const [checklistError, setChecklistError] = useState('');

  const [altEmailModalOpen, setAltEmailModalOpen] = useState(false);
  const [altEmail, setAltEmail] = useState('info@coalcreekguitars.com');
  const [isSendingAltEmail, setIsSendingAltEmail] = useState(false);
  const [altEmailError, setAltEmailError] = useState('');
  const [altEmailSuccess, setAltEmailSuccess] = useState('');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const loadRecord = async (suppressLoading = false) => {
    if (!id) return;
    if (!suppressLoading) setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as ValueReportItemResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to load value report.');
      const rec = payload.record ?? null;
      setRecord(rec);
      setFulfilled(Boolean(rec?.fulfilled));
      if (rec?.authenticityReportData) {
        const d = rec.authenticityReportData;
        setAuthData({
          identity: { ...DEFAULT_AUTH_DATA.identity, ...d.identity },
          specs: d.specs ?? [],
          markers: d.markers ?? [],
          redFlags: { ...DEFAULT_AUTH_DATA.redFlags, ...d.redFlags },
          verdict: { ...DEFAULT_AUTH_DATA.verdict, ...d.verdict },
          certificateSummary: d.certificateSummary ?? '',
        });
      } else if (rec?.type === 'AUTHENTICITY') {
        // No draft yet — seed Brand/Model with what the customer submitted; admin can correct it
        const customerBrand = rec.brand === 'Other' ? (rec.brandOther || '') : (rec.brand || '');
        setAuthData((prev) => ({
          ...prev,
          identity: { ...prev.identity, brandConfirmed: customerBrand, modelConfirmed: rec.model || '' },
        }));
      }
      return rec;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load value report.');
      return null;
    } finally {
      if (!suppressLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setErrorMessage('No record ID provided.');
      setIsLoading(false);
      return;
    }
    void loadRecord();
  }, [id]);

  // Poll while generating — stop when reportGuid appears
  useEffect(() => {
    if (!generating) return;
    pollRef.current = setInterval(async () => {
      const rec = await loadRecord(true);
      if (rec?.reportGuid) {
        setGenerating(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [generating]);

  const handleGenerateReport = async () => {
    if (!id) return;
    setGenerateError('');
    setGenerating(true);
    // Clear guid locally so View Report disappears and poll waits for the new one
    setRecord((prev) => prev ? { ...prev, reportGuid: null, reportR2Key: null } : prev);
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/generate-report`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as { generating?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message || 'Failed to start generation.');
      // Generation is running in background — polling handles the rest
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Failed to start report generation.');
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const requests = [
        fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/fulfilled`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fulfilled }),
        }),
      ];
      // The bottom "Save" button is the obvious save action on the page — it must also
      // persist the authenticity draft, or edits above look saved but vanish on reload.
      if (record?.type === 'AUTHENTICITY') {
        requests.push(
          fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/authenticity-draft`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: authData }),
          }),
        );
      }
      const results = await Promise.all(requests);
      if (results.some((res) => !res.ok)) throw new Error('Save failed.');
      setSaveMessage({ type: 'success', text: 'Saved.' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Authenticity report row helpers ─────────────────────────────────────
  const addSpecRow = () => setAuthData((prev) => ({ ...prev, specs: [...prev.specs, { label: '', expected: '', observed: '' }] }));
  const updateSpecRow = (idx: number, field: keyof SpecRow, value: string) =>
    setAuthData((prev) => ({ ...prev, specs: prev.specs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) }));
  const removeSpecRow = (idx: number) => setAuthData((prev) => ({ ...prev, specs: prev.specs.filter((_, i) => i !== idx) }));

  const addMarkerRow = () => setAuthData((prev) => ({ ...prev, markers: [...prev.markers, { marker: '', status: 'consistent', note: '' }] }));
  const updateMarkerRow = (idx: number, field: keyof MarkerRow, value: string) =>
    setAuthData((prev) => ({ ...prev, markers: prev.markers.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) }));
  const removeMarkerRow = (idx: number) => setAuthData((prev) => ({ ...prev, markers: prev.markers.filter((_, i) => i !== idx) }));

  const addRedFlagRow = () =>
    setAuthData((prev) => ({ ...prev, redFlags: { ...prev.redFlags, items: [...prev.redFlags.items, { description: '', severity: 'minor' }] } }));
  const updateRedFlagRow = (idx: number, field: keyof RedFlagRow, value: string) =>
    setAuthData((prev) => ({
      ...prev,
      redFlags: { ...prev.redFlags, items: prev.redFlags.items.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) },
    }));
  const removeRedFlagRow = (idx: number) =>
    setAuthData((prev) => ({ ...prev, redFlags: { ...prev.redFlags, items: prev.redFlags.items.filter((_, i) => i !== idx) } }));

  const handleSaveAuthDraft = async () => {
    if (!id) return;
    setIsSavingDraft(true);
    setDraftMessage(null);
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/authenticity-draft`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: authData }),
      });
      if (!res.ok) throw new Error('Save failed.');
      setDraftMessage({ type: 'success', text: 'Draft saved.' });
    } catch {
      setDraftMessage({ type: 'error', text: 'Failed to save draft.' });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePreviewAuthReport = async () => {
    if (!id) return;
    setIsPreviewing(true);
    setPreviewError('');
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/authenticity-preview`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: authData }),
      });
      const payload = (await res.json()) as { html?: string; message?: string };
      if (!res.ok || !payload.html) throw new Error(payload.message || 'Preview failed.');
      const blobUrl = URL.createObjectURL(new Blob([payload.html], { type: 'text/html' }));
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Preview failed.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePolishWithAi = async () => {
    if (!id) return;
    setIsPolishing(true);
    setPolishError('');
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/authenticity-ai-polish`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: authData }),
      });
      const payload = (await res.json()) as {
        confidenceStatement?: string;
        verdictReasoning?: string;
        certificateSummary?: string;
        suggestedSpecs?: string[];
        suggestedMarkers?: string[];
        message?: string;
      };
      if (!res.ok || !payload.confidenceStatement || !payload.verdictReasoning || !payload.certificateSummary) {
        throw new Error(payload.message || 'AI polish failed.');
      }
      setAuthData((p) => ({
        ...p,
        identity: { ...p.identity, confidenceStatement: payload.confidenceStatement! },
        verdict: { ...p.verdict, reasoning: payload.verdictReasoning! },
        certificateSummary: payload.certificateSummary!,
        // Only seed checklist rows when the section is still empty — never overwrite/duplicate what's already there
        specs: p.specs.length === 0 && payload.suggestedSpecs?.length
          ? payload.suggestedSpecs.map((label) => ({ label, expected: '', observed: '' }))
          : p.specs,
        markers: p.markers.length === 0 && payload.suggestedMarkers?.length
          ? payload.suggestedMarkers.map((marker) => ({ marker, status: 'unable_to_verify' as MarkerStatus, note: '' }))
          : p.markers,
      }));
    } catch (error) {
      setPolishError(error instanceof Error ? error.message : 'AI polish failed.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleParseChecklist = async () => {
    if (!id || !checklistText.trim()) return;
    setIsParsingChecklist(true);
    setChecklistError('');
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/authenticity-parse-checklist`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: checklistText, identity: authData.identity }),
      });
      const payload = (await res.json()) as {
        specs?: { label: string; expected: string }[];
        markers?: string[];
        message?: string;
      };
      if (!res.ok) throw new Error(payload.message || 'Failed to parse text.');
      setAuthData((p) => ({
        ...p,
        specs: [...p.specs, ...(payload.specs ?? []).map((s) => ({ label: s.label, expected: s.expected, observed: '' }))],
        markers: [...p.markers, ...(payload.markers ?? []).map((marker) => ({ marker, status: 'unable_to_verify' as MarkerStatus, note: '' }))],
      }));
      setChecklistModalOpen(false);
      setChecklistText('');
    } catch (error) {
      setChecklistError(error instanceof Error ? error.message : 'Failed to parse text.');
    } finally {
      setIsParsingChecklist(false);
    }
  };

  const handleSendAuthReport = async () => {
    if (!id) return;
    setIsSending(true);
    setSendError('');
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/authenticity-send`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: authData }),
      });
      const payload = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.message || 'Send failed.');
      setSendConfirmOpen(false);
      await loadRecord(true);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Send failed.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAltEmail = async () => {
    if (!id) return;
    setIsSendingAltEmail(true);
    setAltEmailError('');
    setAltEmailSuccess('');
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/send-alt-email`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: altEmail }),
      });
      const payload = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.message || 'Send failed.');
      setAltEmailSuccess(`Sent to ${altEmail}.`);
    } catch (error) {
      setAltEmailError(error instanceof Error ? error.message : 'Send failed.');
    } finally {
      setIsSendingAltEmail(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!id) return;
    setIsGeneratingPdf(true);
    setPdfError('');
    try {
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/generate-pdf`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || 'Failed to generate PDF.');
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formattedDate = record?.createdAt
    ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A')
    : 'Value Report';

  const reportUrl = record?.reportGuid
    ? `/api/guitar-eval-report/${record.reportGuid}`
    : null;

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Typography variant="h4">{formattedDate}</Typography>

            {/* Generate / View Report — not available for authenticity reports (no AI involved) */}
            {record?.type !== 'AUTHENTICITY' ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
                {reportUrl ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<IconifyIcon icon="material-symbols:open-in-new-rounded" fontSize={16} />}
                    onClick={() => window.open(reportUrl, '_blank', 'noopener,noreferrer')}
                  >
                    View Report
                  </Button>
                ) : null}

                {reportUrl ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<IconifyIcon icon="material-symbols:mail-outline-rounded" fontSize={16} />}
                    onClick={() => {
                      setAltEmailError('');
                      setAltEmailSuccess('');
                      setAltEmailModalOpen(true);
                    }}
                  >
                    Send Email To Alt Addr.
                  </Button>
                ) : null}

                {reportUrl ? (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isGeneratingPdf}
                    startIcon={
                      isGeneratingPdf
                        ? <CircularProgress size={14} color="inherit" />
                        : <IconifyIcon icon="material-symbols:picture-as-pdf-outline-rounded" fontSize={16} />
                    }
                    onClick={() => void handleGeneratePdf()}
                  >
                    {isGeneratingPdf ? 'Generating…' : 'Generate PDF From HTML'}
                  </Button>
                ) : null}

                {pdfError ? (
                  <Typography variant="caption" color="error.main">{pdfError}</Typography>
                ) : null}

                <Button
                  variant={reportUrl ? 'text' : 'contained'}
                  size="small"
                  disabled={generating}
                  startIcon={
                    generating
                      ? <CircularProgress size={14} color="inherit" />
                      : <IconifyIcon icon="material-symbols:auto-awesome-rounded" fontSize={16} />
                  }
                  onClick={() => void handleGenerateReport()}
                >
                  {generating ? 'Generating… (2–4 min)' : reportUrl ? 'Regenerate' : 'Generate Report'}
                </Button>

                {generateError ? (
                  <Typography variant="caption" color="error.main">{generateError}</Typography>
                ) : null}
                {!generating && record?.reportError ? (
                  <Typography variant="caption" color="error.main">
                    Last attempt failed: {record.reportError}
                  </Typography>
                ) : null}
                {!generating && record?.reportCost != null ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Last run: ${(Math.ceil(record.reportCost * 100) / 100).toFixed(2)}
                  </Typography>
                ) : null}
              </Stack>
            ) : null}
          </Box>

          <Tooltip title="Back to Value Reports">
            <IconButton
              aria-label="Back"
              onClick={() => navigate(paths.valueReports)}
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                color: 'text.primary',
                '&:hover': { bgcolor: 'background.elevation2' },
              }}
            >
              <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Box sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
        {isLoading ? (
          <Stack direction="column" sx={{ alignItems: 'center', py: 8 }} spacing={2}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>Loading value report…</Typography>
          </Stack>
        ) : record ? (
          <Grid container spacing={3}>

            {/* Photos */}
            {record.imageUrls.length > 0 ? (
              <>
                <Grid size={12}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                    Photos
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <Stack direction="row" flexWrap="wrap" gap={1.5}>
                    {record.imageUrls.map((url, index) => (
                      <Box
                        key={index}
                        component="img"
                        src={url}
                        alt={`Photo ${index + 1}`}
                        onClick={() => setLightboxUrl(url)}
                        sx={{
                          width: 120,
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: 1,
                          borderColor: 'divider',
                          '&:hover': { opacity: 0.85 },
                          transition: 'opacity 0.15s',
                        }}
                      />
                    ))}
                  </Stack>
                </Grid>
              </>
            ) : null}

            {/* Contact */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Contact
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="First Name" value={record.firstName || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Last Name" value={record.lastName || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Email" value={record.email || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Location" value={record.location || '—'} InputProps={ro} />
            </Grid>

            {/* Guitar */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Guitar
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Brand" value={record.brand || '—'} InputProps={ro} />
            </Grid>
            {record.brandOther ? (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField fullWidth label="Brand (Other)" value={record.brandOther} InputProps={ro} />
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Color / Finish (owner's description)" value={record.colorFinish || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Model" value={record.model || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Serial Number" value={record.serialNumber || '—'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Includes Case?" value={record.includesCase || '—'} InputProps={ro} />
            </Grid>

            {/* Condition */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Condition
              </Typography>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline minRows={3} label="Notes" value={record.note || '—'} InputProps={ro} />
            </Grid>
            {record.type === 'AUTHENTICITY' ? (
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="What Made Them Curious About Authenticity"
                  value={record.curiosityReason || '—'}
                  InputProps={ro}
                />
              </Grid>
            ) : (
              <Grid size={12}>
                <TextField fullWidth multiline minRows={3} label="Damage / Wear" value={record.damage || '—'} InputProps={ro} />
              </Grid>
            )}

            {/* Complete Authenticity Report — human-forward, zero-AI */}
            {record.type === 'AUTHENTICITY' ? (
              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Complete Authenticity Report</Typography>

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>01 · Identity</Typography>
                  <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label="Brand Confirmed"
                        value={authData.identity.brandConfirmed}
                        onChange={(e) => setAuthData((p) => ({ ...p, identity: { ...p.identity, brandConfirmed: e.target.value } }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label="Model Confirmed"
                        value={authData.identity.modelConfirmed}
                        onChange={(e) => setAuthData((p) => ({ ...p, identity: { ...p.identity, modelConfirmed: e.target.value } }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label="Year Confirmed"
                        value={authData.identity.yearConfirmed}
                        onChange={(e) => setAuthData((p) => ({ ...p, identity: { ...p.identity, yearConfirmed: e.target.value } }))}
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Build / Variant Notes"
                        value={authData.identity.variantNotes}
                        onChange={(e) => setAuthData((p) => ({ ...p, identity: { ...p.identity, variantNotes: e.target.value } }))}
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Confidence Statement"
                        value={authData.identity.confidenceStatement}
                        InputProps={ro}
                        helperText="Written by Add AI Analysis — not directly editable"
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 3 }} />

                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="overline" sx={{ color: 'text.secondary' }}>03 · Specifications &amp; Authenticity Markers</Typography>
                    <Tooltip title="Populate with AI Analysis">
                      <IconButton
                        size="small"
                        color="secondary"
                        aria-label="Populate with AI Analysis"
                        onClick={() => setChecklistModalOpen(true)}
                      >
                        <IconifyIcon icon="material-symbols:upload-rounded" fontSize={20} />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Specifications</Typography>
                  <Stack direction="column" spacing={1.5} sx={{ mb: 2, width: '100%' }}>
                    {authData.specs.map((row, idx) => (
                      <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: '100%' }}>
                        <TextField label="Spec" value={row.label} onChange={(e) => updateSpecRow(idx, 'label', e.target.value)} sx={{ flex: 1 }} />
                        <TextField label="Expected" value={row.expected} onChange={(e) => updateSpecRow(idx, 'expected', e.target.value)} sx={{ flex: 1 }} />
                        <TextField label="Observed" value={row.observed} onChange={(e) => updateSpecRow(idx, 'observed', e.target.value)} sx={{ flex: 1 }} />
                        <IconButton size="small" color="error" onClick={() => removeSpecRow(idx)}>
                          <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IconifyIcon icon="material-symbols:add-rounded" fontSize={16} />}
                    onClick={addSpecRow}
                  >
                    Add Spec
                  </Button>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Authenticity Markers</Typography>
                  <Stack direction="column" spacing={1.5} sx={{ mb: 2, width: '100%' }}>
                    {authData.markers.map((row, idx) => (
                      <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: '100%' }}>
                        <TextField label="Marker" value={row.marker} onChange={(e) => updateMarkerRow(idx, 'marker', e.target.value)} sx={{ flex: 1 }} />
                        <FormControl sx={{ minWidth: 190 }}>
                          <InputLabel>Status</InputLabel>
                          <Select
                            label="Status"
                            value={row.status}
                            onChange={(e) => updateMarkerRow(idx, 'status', e.target.value)}
                          >
                            <MenuItem value="consistent">Consistent</MenuItem>
                            <MenuItem value="inconsistent">Inconsistent</MenuItem>
                            <MenuItem value="unable_to_verify">Unable to Verify</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField label="Note" value={row.note} onChange={(e) => updateMarkerRow(idx, 'note', e.target.value)} sx={{ flex: 2 }} />
                        <IconButton size="small" color="error" onClick={() => removeMarkerRow(idx)}>
                          <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IconifyIcon icon="material-symbols:add-rounded" fontSize={16} />}
                    onClick={addMarkerRow}
                  >
                    Add Marker
                  </Button>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>04 · Red Flags &amp; Inconsistencies</Typography>
                  <FormControlLabel
                    sx={{ display: 'block', mt: 1 }}
                    control={
                      <Switch
                        checked={authData.redFlags.none}
                        onChange={(e) => setAuthData((p) => ({ ...p, redFlags: { ...p.redFlags, none: e.target.checked } }))}
                      />
                    }
                    label="No red flags found"
                  />
                  {!authData.redFlags.none ? (
                    <>
                      <Stack direction="column" spacing={1.5} sx={{ mt: 1, mb: 2, width: '100%' }}>
                        {authData.redFlags.items.map((row, idx) => (
                          <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: '100%' }}>
                            <TextField
                              label="Description"
                              value={row.description}
                              onChange={(e) => updateRedFlagRow(idx, 'description', e.target.value)}
                              sx={{ flex: 1 }}
                            />
                            <FormControl sx={{ minWidth: 160 }}>
                              <InputLabel>Severity</InputLabel>
                              <Select
                                label="Severity"
                                value={row.severity}
                                onChange={(e) => updateRedFlagRow(idx, 'severity', e.target.value)}
                              >
                                <MenuItem value="minor">Minor</MenuItem>
                                <MenuItem value="moderate">Moderate</MenuItem>
                                <MenuItem value="major">Major</MenuItem>
                              </Select>
                            </FormControl>
                            <IconButton size="small" color="error" onClick={() => removeRedFlagRow(idx)}>
                              <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<IconifyIcon icon="material-symbols:add-rounded" fontSize={16} />}
                        onClick={addRedFlagRow}
                      >
                        Add Red Flag
                      </Button>
                    </>
                  ) : null}

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>05 · Expert Verdict</Typography>
                  <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Determination</InputLabel>
                        <Select
                          label="Determination"
                          value={authData.verdict.determination}
                          onChange={(e) =>
                            setAuthData((p) => ({ ...p, verdict: { ...p.verdict, determination: e.target.value as VerdictValue } }))
                          }
                        >
                          <MenuItem value="genuine">Genuine</MenuItem>
                          <MenuItem value="likely_genuine">Likely Genuine</MenuItem>
                          <MenuItem value="inconclusive">Inconclusive</MenuItem>
                          <MenuItem value="likely_not_authentic">Likely Not Authentic</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Confidence</InputLabel>
                        <Select
                          label="Confidence"
                          value={authData.verdict.confidence}
                          onChange={(e) =>
                            setAuthData((p) => ({ ...p, verdict: { ...p.verdict, confidence: e.target.value as Confidence } }))
                          }
                        >
                          <MenuItem value="very_high">Very High</MenuItem>
                          <MenuItem value="high">High</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="low">Low</MenuItem>
                          <MenuItem value="very_low">Very Low</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Reasoning"
                        value={authData.verdict.reasoning}
                        InputProps={ro}
                        helperText="Written by Add AI Analysis — not directly editable"
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="What Would Raise Confidence (optional)"
                        value={authData.verdict.raiseConfidenceNote}
                        onChange={(e) => setAuthData((p) => ({ ...p, verdict: { ...p.verdict, raiseConfidenceNote: e.target.value } }))}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>06 · Certificate &amp; Summary</Typography>
                  <Box sx={{ mt: 1, mb: 3 }}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      label="Certificate Summary"
                      value={authData.certificateSummary}
                      InputProps={ro}
                      helperText="Written by Add AI Analysis — not directly editable"
                    />
                  </Box>

                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<IconifyIcon icon="material-symbols:auto-awesome-rounded" fontSize={16} />}
                      onClick={() => void handlePolishWithAi()}
                      disabled={isPolishing}
                    >
                      {isPolishing ? 'Polishing…' : 'Add AI Analysis'}
                    </Button>
                    <Button variant="outlined" onClick={() => void handleSaveAuthDraft()} disabled={isSavingDraft}>
                      {isSavingDraft ? 'Saving…' : 'Save Draft'}
                    </Button>
                    <Button variant="outlined" onClick={() => void handlePreviewAuthReport()} disabled={isPreviewing}>
                      {isPreviewing ? 'Rendering…' : 'Preview Report'}
                    </Button>
                    <Button variant="contained" color="primary" onClick={() => setSendConfirmOpen(true)}>
                      Send to Customer
                    </Button>
                    {draftMessage ? (
                      <Typography variant="body2" color={draftMessage.type === 'success' ? 'success.main' : 'error.main'}>
                        {draftMessage.text}
                      </Typography>
                    ) : null}
                    {previewError ? <Typography variant="body2" color="error.main">{previewError}</Typography> : null}
                    {polishError ? <Typography variant="body2" color="error.main">{polishError}</Typography> : null}
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                    The Confidence Statement, Reasoning, and Certificate Summary fields are written by "Add AI
                    Analysis" only. It writes them from your Specs/Markers/Red Flags/Verdict findings, may search the
                    web for general brand/model authenticity context (never anything about this specific serial
                    number), and never invents a fact about this instrument or changes your Verdict/Confidence. If
                    Specs or Markers are still empty, it'll also suggest a starting checklist of what to look at
                    (names only, no findings) — it never fills in Status or an answer for you.
                  </Typography>
                </Paper>
              </Grid>
            ) : null}

            {/* Status */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Status
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Paid" value={record.stripePaymentIntentId ? 'Yes' : 'No'} InputProps={ro} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={fulfilled}
                    onChange={(e) => setFulfilled(e.target.checked)}
                  />
                }
                label="Fulfilled"
              />
            </Grid>
            {record.stripePaymentIntentId ? (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Stripe Payment Intent" value={record.stripePaymentIntentId} InputProps={ro} />
              </Grid>
            ) : null}

            {/* Save */}
            <Grid size={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
                {saveMessage ? (
                  <Typography variant="body2" color={saveMessage.type === 'success' ? 'success.main' : 'error.main'}>
                    {saveMessage.text}
                  </Typography>
                ) : null}
              </Stack>
            </Grid>

          </Grid>
        ) : null}
      </Box>

      {/* Lightbox */}
      <Dialog
        open={Boolean(lightboxUrl)}
        onClose={() => setLightboxUrl(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
      >
        <DialogContent sx={{ p: 1, position: 'relative' }}>
          <IconButton
            onClick={() => setLightboxUrl(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              zIndex: 1,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
            }}
          >
            <IconifyIcon icon="material-symbols:close-rounded" fontSize={22} />
          </IconButton>
          {lightboxUrl ? (
            <Box
              component="img"
              src={lightboxUrl}
              alt="Photo enlarged"
              sx={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block', borderRadius: 2 }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Send authenticity report confirm dialog */}
      <Dialog open={sendConfirmOpen} onClose={() => !isSending && setSendConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Send Report to Customer?</DialogTitle>
        <DialogContent>
          <Typography>
            This emails the finished authenticity report to {record?.email || 'the customer'} right now. Make sure
            you've previewed it first — this cannot be unsent.
          </Typography>
          {sendError ? (
            <Alert severity="error" sx={{ mt: 2 }}>{sendError}</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendConfirmOpen(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void handleSendAuthReport()}
            disabled={isSending}
            startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSending ? 'Sending…' : 'Send to Customer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Populate with AI Analysis — paste external AI output, we parse it into Specs + Markers */}
      <Dialog
        open={checklistModalOpen}
        onClose={() => !isParsingChecklist && setChecklistModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Populate with AI Analysis</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Ask another AI tool for 5–6 specifications to check and 5–6 authenticity markers for this specific
            brand/model, then paste the raw response below. We'll parse it and add rows to Specifications
            (spec + expected value) and Authenticity Markers (marker name) for you to fill in the rest.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={12}
            placeholder="Paste the AI's response here…"
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
          />
          {checklistError ? (
            <Alert severity="error" sx={{ mt: 2 }}>{checklistError}</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChecklistModalOpen(false)} disabled={isParsingChecklist}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void handleParseChecklist()}
            disabled={isParsingChecklist || !checklistText.trim()}
            startIcon={isParsingChecklist ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isParsingChecklist ? 'Parsing…' : 'Parse & Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send the customer's report-ready email to an alternate address */}
      <Dialog
        open={altEmailModalOpen}
        onClose={() => !isSendingAltEmail && setAltEmailModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Send Email To Alt Address</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Sends the same report-ready email this customer received to a different address.
          </Typography>
          <TextField
            fullWidth
            label="Email address"
            type="email"
            value={altEmail}
            onChange={(e) => setAltEmail(e.target.value)}
          />
          {altEmailError ? (
            <Alert severity="error" sx={{ mt: 2 }}>{altEmailError}</Alert>
          ) : null}
          {altEmailSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>{altEmailSuccess}</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAltEmailModalOpen(false)} disabled={isSendingAltEmail}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void handleSendAltEmail()}
            disabled={isSendingAltEmail || !altEmail.trim()}
            startIcon={isSendingAltEmail ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSendingAltEmail ? 'Sending…' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ValueReportItem;
