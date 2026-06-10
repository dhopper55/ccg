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
  FormControlLabel,
  IconButton,
  Link,
  Paper,
  Stack,
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
  model: string | null;
  serialNumber: string | null;
  includesCase: string | null;
  location: string | null;
  note: string | null;
  damage: string | null;
  stripePaymentIntentId: string | null;
  fulfilled: number;
  imageUrls: string[];
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

  useEffect(() => {
    if (!id) {
      setErrorMessage('No record ID provided.');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetch(`/api/admin-v2/value-reports/${encodeURIComponent(id)}`, {
          credentials: 'same-origin',
        });
        const payload = (await response.json()) as ValueReportItemResponse;
        if (!response.ok) throw new Error(payload.message || 'Unable to load value report.');
        if (!cancelled) {
          setRecord(payload.record ?? null);
          setFulfilled(Boolean(payload.record?.fulfilled));
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load value report.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
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

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h4">{formattedDate}</Typography>
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
            <Grid size={12}>
              <TextField fullWidth multiline minRows={3} label="Damage / Wear" value={record.damage || '—'} InputProps={ro} />
            </Grid>

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
                              <Link
                                href={`/api/admin-v2/value-report-files?key=${encodeURIComponent(f.r2_key)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ wordBreak: 'break-all' }}
                              >
                                {f.file_name}
                              </Link>
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
    </Stack>
  );
};

export default ValueReportItem;
