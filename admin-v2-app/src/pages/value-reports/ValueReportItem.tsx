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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
type Confidence = 'high' | 'medium' | 'low';

type AuthenticityReportData = {
  identity: { modelConfirmed: string; yearConfirmed: string; variantNotes: string; confidenceStatement: string };
  specs: SpecRow[];
  markers: MarkerRow[];
  redFlags: { none: boolean; items: RedFlagRow[] };
  verdict: { determination: VerdictValue; confidence: Confidence; reasoning: string; raiseConfidenceNote: string };
  certificateSummary: string;
};

const DEFAULT_AUTH_DATA: AuthenticityReportData = {
  identity: { modelConfirmed: '', yearConfirmed: '', variantNotes: '', confidenceStatement: '' },
  specs: [],
  markers: [],
  redFlags: { none: true, items: [] },
  verdict: { determination: 'inconclusive', confidence: 'medium', reasoning: '', raiseConfidenceNote: '' },
  certificateSummary: '',
};

type EvalFile = {
  id: number;
  file_name: string;
  r2_key: string;
  content_type: string;
  created_at: string;
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

  const [files, setFiles] = useState<EvalFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EvalFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadFiles = async () => {
      setIsLoadingFiles(true);
      setFilesError('');
      try {
        const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/files`, {
          credentials: 'same-origin',
        });
        const data = (await res.json()) as { files?: EvalFile[]; message?: string };
        if (!res.ok) throw new Error(data.message || 'Unable to load files.');
        if (!cancelled) setFiles(data.files ?? []);
      } catch (error) {
        if (!cancelled) setFilesError(error instanceof Error ? error.message : 'Unable to load files.');
      } finally {
        if (!cancelled) setIsLoadingFiles(false);
      }
    };
    void loadFiles();
    return () => { cancelled = true; };
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
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/fulfilled`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfilled }),
      });
      if (!res.ok) throw new Error('Save failed.');
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}/files`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message || 'Upload failed.');
      window.location.reload();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/admin-v2/value-reports/${encodeURIComponent(id)}/files/${deleteTarget.id}`,
        { method: 'DELETE', credentials: 'same-origin' },
      );
      if (!res.ok) throw new Error('Delete failed.');
      window.location.reload();
    } catch {
      setIsDeleting(false);
      setDeleteTarget(null);
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
          <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
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
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Model Confirmed"
                        value={authData.identity.modelConfirmed}
                        onChange={(e) => setAuthData((p) => ({ ...p, identity: { ...p.identity, modelConfirmed: e.target.value } }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
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
                        onChange={(e) => setAuthData((p) => ({ ...p, identity: { ...p.identity, confidenceStatement: e.target.value } }))}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>03 · Specifications</Typography>
                  <Stack spacing={1.5} sx={{ mt: 1, mb: 2 }}>
                    {authData.specs.map((row, idx) => (
                      <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
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

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>04 · Authenticity Markers</Typography>
                  <Stack spacing={1.5} sx={{ mt: 1, mb: 2 }}>
                    {authData.markers.map((row, idx) => (
                      <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
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

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>05 · Red Flags &amp; Inconsistencies</Typography>
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
                      <Stack spacing={1.5} sx={{ mt: 1, mb: 2 }}>
                        {authData.redFlags.items.map((row, idx) => (
                          <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
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

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>06 · Expert Verdict</Typography>
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
                          <MenuItem value="high">High</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="low">Low</MenuItem>
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
                        onChange={(e) => setAuthData((p) => ({ ...p, verdict: { ...p.verdict, reasoning: e.target.value } }))}
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

                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>07 · Certificate &amp; Summary</Typography>
                  <Box sx={{ mt: 1, mb: 3 }}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      label="Certificate Summary"
                      value={authData.certificateSummary}
                      onChange={(e) => setAuthData((p) => ({ ...p, certificateSummary: e.target.value }))}
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
                    "Add AI Analysis" rewrites your Identity/Verdict/Certificate notes into fuller prose using only
                    what you've already entered — it doesn't research the guitar or add new facts. If Specs or
                    Markers are still empty, it'll also suggest a starting checklist of what to look at (names only,
                    no findings) — it never fills in Status or an answer for you.
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

            {/* Files */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                Files
              </Typography>
            </Grid>
            <Grid size={12}>
              <Stack spacing={2}>
                <Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="outlined"
                    startIcon={
                      isUploading
                        ? <CircularProgress size={16} color="inherit" />
                        : <IconifyIcon icon="material-symbols:upload-rounded" fontSize={18} />
                    }
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? 'Uploading…' : 'Upload File'}
                  </Button>
                  {uploadError ? (
                    <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                      {uploadError}
                    </Typography>
                  ) : null}
                </Box>

                {isLoadingFiles ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading files…</Typography>
                  </Stack>
                ) : filesError ? (
                  <Alert severity="error" sx={{ maxWidth: 480 }}>{filesError}</Alert>
                ) : files.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>File Name</TableCell>
                          <TableCell>Uploaded</TableCell>
                          <TableCell align="right" sx={{ width: 56 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {files.map((f) => (
                          <TableRow key={f.id} hover>
                            <TableCell>
                              <a
                                href={`/api/admin-v2/value-report-files?key=${encodeURIComponent(f.r2_key)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ wordBreak: 'break-all' }}
                              >
                                {f.file_name}
                              </a>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                              {dayjs(f.created_at).format('MMM D, YYYY h:mm A')}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Delete file">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteTarget(f)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No files uploaded yet.
                  </Typography>
                )}
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

      {/* Delete confirm dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !isDeleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteTarget?.file_name}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
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
    </Stack>
  );
};

export default ValueReportItem;
