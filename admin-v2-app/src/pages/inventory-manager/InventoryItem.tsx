import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

type InventoryItemRecord = {
  id: string;
  sourceListingId?: string | null;
  ccgNumber: string;
  imageUrl: string;
  imageUrls?: string[];
  title: string;
  category?: string;
  brand?: string;
  yearRange?: string;
  model?: string;
  finish?: string;
  originalListingDesc?: string;
  purchasedDate?: string;
  purchasePrice?: number | null;
  privatePartyValue?: number | null;
  purchaseNotes?: string;
  serialNumber?: string;
  isActive?: boolean;
  isMarked?: boolean;
  forSale?: boolean;
  forSaleDate?: string | null;
  isSold?: boolean;
  soldDate?: string | null;
  soldAmount?: number | null;
  sellNotes?: string;
};

type InventoryRecordResponse = {
  record?: InventoryItemRecord;
  message?: string;
};

type ListingRecordResponse = {
  id: string;
  fields?: {
    title?: string;
    category?: string;
    brand?: string;
    year?: string;
    model?: string;
    finish?: string;
    description?: string;
    image_url?: string;
  };
  message?: string;
};

type SaveResponse = {
  ok?: boolean;
  ccgNumber?: string;
  message?: string;
  createdCount?: number;
  duplicateSuppressed?: boolean;
};

type FormState = {
  ccgNumber: string;
  title: string;
  category: string;
  brand: string;
  yearRange: string;
  model: string;
  finish: string;
  originalListingDesc: string;
  purchasedDate: string;
  purchasePrice: string;
  privatePartyValue: string;
  purchaseNotes: string;
  serialNumber: string;
  isActive: boolean;
  isMarked: boolean;
  forSale: boolean;
  isSold: boolean;
  soldAmount: string;
  sellNotes: string;
};

const INVENTORY_MAX_IMAGES = 10;
const CATEGORY_OPTIONS = [
  'Accessories',
  'Acoustic Bass',
  'Acoustic Guitars',
  'Amplification',
  'Cases & Bags',
  'Effects Pedals',
  'Electric Bass',
  'Electric Guitars',
  'Keyboards & Synthesizers',
  'Packages',
  'Pro Audio',
];

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeImageUrls(urls: string[]): string[] {
  return Array.from(
    new Set(
      urls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean),
    ),
  ).slice(0, INVENTORY_MAX_IMAGES);
}

const DEFAULT_FORM: FormState = {
  ccgNumber: 'Auto-generated on save',
  title: '',
  category: '',
  brand: '',
  yearRange: '',
  model: '',
  finish: '',
  originalListingDesc: '',
  purchasedDate: todayYmd(),
  purchasePrice: '',
  privatePartyValue: '0',
  purchaseNotes: '',
  serialNumber: '',
  isActive: true,
  isMarked: false,
  forSale: false,
  isSold: false,
  soldAmount: '',
  sellNotes: '',
};

const InventoryItem = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [sourceListingId, setSourceListingId] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const mode = editId ? 'edit' : 'add';
  const pageTitle = mode === 'edit' ? 'Edit Inventory Item' : 'Add Inventory Item';
  const submitLabel = mode === 'edit' ? 'Save Changes' : 'Add Inventory Item';

  useEffect(() => {
    document.title = `CCG Admin | ${pageTitle}`;
  }, [pageTitle]);

  useEffect(() => {
    let cancelled = false;
    const id = searchParams.get('id');
    const fromListingId = searchParams.get('fromListingId');

    const initialize = async () => {
      setIsLoading(true);
      setMessage(null);

      try {
        if (id) {
          const response = await fetch(`/api/inventory/${encodeURIComponent(id)}`, {
            method: 'GET',
            credentials: 'same-origin',
          });
          const data = (await response.json()) as InventoryRecordResponse;
          if (!response.ok || !data.record) {
            throw new Error(data.message || 'Unable to load inventory item.');
          }
          if (cancelled) return;

          const record = data.record;
          setEditId(record.id);
          setSourceListingId(record.sourceListingId || null);
          setForm({
            ccgNumber: record.ccgNumber || '',
            title: record.title || '',
            category: record.category || '',
            brand: record.brand || '',
            yearRange: record.yearRange || '',
            model: record.model || '',
            finish: record.finish || '',
            originalListingDesc: record.originalListingDesc || '',
            purchasedDate: record.purchasedDate || todayYmd(),
            purchasePrice:
              record.purchasePrice != null ? String(record.purchasePrice) : '',
            privatePartyValue:
              record.privatePartyValue != null ? String(record.privatePartyValue) : '0',
            purchaseNotes: record.purchaseNotes || '',
            serialNumber: record.serialNumber || '',
            isActive: Boolean(record.isActive),
            isMarked: Boolean(record.isMarked),
            forSale: Boolean(record.forSale),
            isSold: Boolean(record.isSold),
            soldAmount: record.soldAmount != null ? String(record.soldAmount) : '',
            sellNotes: record.sellNotes || '',
          });

          const existingImages =
            Array.isArray(record.imageUrls) && record.imageUrls.length
              ? record.imageUrls
              : record.imageUrl
                ? [record.imageUrl]
                : [];
          setImageUrls(normalizeImageUrls(existingImages));
          return;
        }

        if (fromListingId) {
          const response = await fetch(`/api/listings/${encodeURIComponent(fromListingId)}`, {
            method: 'GET',
            credentials: 'same-origin',
          });
          const data = (await response.json()) as ListingRecordResponse;
          if (!response.ok) {
            throw new Error(data.message || 'Unable to load source listing.');
          }
          if (cancelled) return;

          const fields = data.fields || {};
          setSourceListingId(fromListingId);
          setSourceImageUrl((fields.image_url || '').trim() || null);
          setForm((current) => ({
            ...current,
            title: (fields.title || '').trim(),
            category: (fields.category || '').trim(),
            brand: (fields.brand || '').trim(),
            yearRange: (fields.year || '').trim(),
            model: (fields.model || '').trim(),
            finish: (fields.finish || '').trim(),
            originalListingDesc: (fields.description || '').trim(),
          }));
          if (fields.image_url) {
            setMessage({
              severity: 'success',
              text: 'Prefilled from listing. Upload image(s) or import the source image.',
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({
            severity: 'error',
            text: error instanceof Error ? error.message : 'Unable to initialize inventory item.',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      if (key === 'isSold' && value === true) {
        return { ...current, isSold: true, forSale: false };
      }
      return { ...current, [key]: value };
    });
    setMessage(null);
  };

  const updateImageUrls = (urls: string[]) => {
    setImageUrls(normalizeImageUrls(urls));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.set('image', file);
    const response = await fetch('/api/inventory/upload-image', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    });
    const data = (await response.json().catch(() => ({}))) as { imageUrl?: string; message?: string };
    if (!response.ok || !data.imageUrl) {
      throw new Error(data.message || 'Unable to upload image.');
    }
    return data.imageUrl;
  };

  const importSourceImage = async (url: string): Promise<string> => {
    const response = await fetch('/api/inventory/import-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceUrl: url }),
      credentials: 'same-origin',
    });
    const data = (await response.json().catch(() => ({}))) as { imageUrl?: string; message?: string };
    if (!response.ok || !data.imageUrl) {
      throw new Error(data.message || 'Unable to import source image.');
    }
    return data.imageUrl;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (imageUrls.length >= INVENTORY_MAX_IMAGES) {
      const text = `You can upload up to ${INVENTORY_MAX_IMAGES} images.`;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      let nextUrls = [...imageUrls];
      let uploadedCount = 0;

      for (const file of files) {
        if (nextUrls.length >= INVENTORY_MAX_IMAGES) break;
        const imageUrl = await uploadImage(file);
        nextUrls = normalizeImageUrls([...nextUrls, imageUrl]);
        uploadedCount += 1;
        setImageUrls(nextUrls);
      }

      const text =
        uploadedCount > 0 ? `Uploaded ${uploadedCount} image${uploadedCount === 1 ? '' : 's'}.` : 'No images were uploaded.';
      setMessage({ severity: uploadedCount > 0 ? 'success' : 'error', text });
      enqueueSnackbar(text, { variant: uploadedCount > 0 ? 'success' : 'error' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to upload image.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleImportSourceImage = async () => {
    if (!sourceImageUrl) return;
    if (imageUrls.length >= INVENTORY_MAX_IMAGES) {
      const text = `You can upload up to ${INVENTORY_MAX_IMAGES} images.`;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const importedUrl = await importSourceImage(sourceImageUrl);
      updateImageUrls([...imageUrls, importedUrl]);
      setMessage({ severity: 'success', text: 'Source image imported.' });
      enqueueSnackbar('Source image imported.', { variant: 'success' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to import source image.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!form.title.trim()) {
      setMessage({ severity: 'error', text: 'Title is required.' });
      return;
    }
    if (!form.purchasedDate.trim()) {
      setMessage({ severity: 'error', text: 'Purchased date is required.' });
      return;
    }
    if (!form.category.trim()) {
      setMessage({ severity: 'error', text: 'Category is required.' });
      return;
    }
    if (imageUrls.length < 1) {
      setMessage({ severity: 'error', text: 'Please upload at least one image before saving.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        sourceListingId,
        qty: 1,
        imageUrl: imageUrls[0],
        imageUrls: [...imageUrls],
        title: form.title.trim(),
        category: form.category.trim(),
        brand: form.brand.trim(),
        yearRange: form.yearRange.trim(),
        model: form.model.trim(),
        finish: form.finish.trim(),
        originalListingDesc: form.originalListingDesc.trim(),
        purchasedDate: form.purchasedDate.trim(),
        purchasePrice: form.purchasePrice.trim(),
        privatePartyValue: form.privatePartyValue.trim() || '0',
        purchaseNotes: form.purchaseNotes.trim(),
        isActive: form.isActive,
        isMarked: form.isMarked,
        forSale: form.forSale,
        isSold: form.isSold,
        serialNumber: form.serialNumber.trim(),
        soldAmount: form.soldAmount.trim(),
        sellNotes: form.sellNotes.trim(),
      };

      const endpoint = editId
        ? `/api/inventory/${encodeURIComponent(editId)}/update`
        : '/api/inventory';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      const data = (await response.json().catch(() => ({}))) as SaveResponse;
      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ||
            (editId ? 'Unable to update inventory item.' : 'Unable to create inventory item.'),
        );
      }

      const text = editId
        ? 'Inventory item updated.'
        : data.duplicateSuppressed
          ? `Duplicate submit prevented. Using existing item ${data.ccgNumber || ''}.`
          : `Created ${typeof data.createdCount === 'number' ? data.createdCount : 1} inventory item${(data.createdCount || 1) === 1 ? '' : 's'}: ${data.ccgNumber || ''}.`;
      enqueueSnackbar(text, { variant: 'success' });
      navigate(paths.inventoryManager);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to save inventory item.';
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadButtonLabel = useMemo(() => {
    if (isUploading) return 'Uploading...';
    return imageUrls.length > 0 ? 'Add Images' : 'Upload Images';
  }, [imageUrls.length, isUploading]);

  return (
    <Stack direction="column" height={1} gap={3} sx={{ minWidth: 0 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            gap: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h4">{pageTitle}</Typography>

          <Tooltip title="Back">
            <IconButton
              aria-label="Back"
              onClick={() => navigate(paths.inventoryManager)}
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
              <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {message ? <Alert severity={message.severity}>{message.text}</Alert> : null}

      <Paper sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
        {isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>Loading inventory item…</Typography>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="CCG Number"
                  value={form.ccgNumber}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Purchased Date"
                  type="date"
                  value={form.purchasedDate}
                  onChange={(event) => setField('purchasedDate', event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>

              <Grid size={12}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Images</Typography>
                  <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isImporting || isSubmitting}
                      startIcon={<IconifyIcon icon="material-symbols:upload-rounded" />}
                    >
                      {uploadButtonLabel}
                    </Button>
                    {sourceImageUrl ? (
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleImportSourceImage}
                        disabled={isUploading || isImporting || isSubmitting}
                        startIcon={<IconifyIcon icon="material-symbols:download-rounded" />}
                      >
                        {isImporting ? 'Importing...' : 'Import Source Image'}
                      </Button>
                    ) : null}
                    <Chip
                      label={`${imageUrls.length}/${INVENTORY_MAX_IMAGES} images`}
                      color="primary"
                      variant="soft"
                    />
                  </Stack>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Upload 1 primary image plus up to 9 additional images.
                  </Typography>

                  {imageUrls.length ? (
                    <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
                      {imageUrls.map((url, index) => (
                        <Paper
                          key={url}
                          variant="outlined"
                          sx={{
                            p: 1,
                            width: 120,
                            borderRadius: 3,
                            bgcolor: 'background.default',
                          }}
                        >
                          <Stack spacing={1}>
                            <Box
                              sx={{
                                position: 'relative',
                                width: '100%',
                                aspectRatio: '1 / 1',
                                borderRadius: 2,
                                overflow: 'hidden',
                                bgcolor: 'background.elevation1',
                                cursor: 'pointer',
                              }}
                              onClick={() => setPreviewImage(url)}
                            >
                              <Box
                                component="img"
                                src={url}
                                alt={`Inventory image ${index + 1}`}
                                sx={{ width: 1, height: 1, objectFit: 'cover' }}
                              />
                            </Box>

                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              {index === 0 ? (
                                <Chip label="Primary" size="small" color="warning" variant="soft" />
                              ) : (
                                <Box />
                              )}
                              <IconButton
                                size="small"
                                aria-label="Remove image"
                                disabled={imageUrls.length <= 1 || isSubmitting}
                                onClick={() => updateImageUrls(imageUrls.filter((_, i) => i !== index))}
                              >
                                <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={form.title}
                  onChange={(event) => setField('title', event.target.value)}
                  inputProps={{ maxLength: 240 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={form.category}
                  onChange={(event) => setField('category', event.target.value)}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Brand"
                  value={form.brand}
                  onChange={(event) => setField('brand', event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Year Range"
                  value={form.yearRange}
                  onChange={(event) => setField('yearRange', event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Model"
                  value={form.model}
                  onChange={(event) => setField('model', event.target.value)}
                  inputProps={{ maxLength: 180 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Finish"
                  value={form.finish}
                  onChange={(event) => setField('finish', event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Original Listing Desc."
                  value={form.originalListingDesc}
                  onChange={(event) => setField('originalListingDesc', event.target.value)}
                  inputProps={{ maxLength: 12000 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="How Much Paid? ($)"
                  type="number"
                  value={form.purchasePrice}
                  onChange={(event) => setField('purchasePrice', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Private Party Value ($)"
                  type="number"
                  value={form.privatePartyValue}
                  onChange={(event) => setField('privatePartyValue', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Purchase Notes"
                  value={form.purchaseNotes}
                  onChange={(event) => setField('purchaseNotes', event.target.value)}
                  inputProps={{ maxLength: 4000 }}
                />
              </Grid>

              <Grid size={12}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                  <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isActive}
                          onChange={(event) => setField('isActive', event.target.checked)}
                        />
                      }
                      label="Is Active"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isMarked}
                          onChange={(event) => setField('isMarked', event.target.checked)}
                        />
                      }
                      label="Is Marked"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.forSale}
                          onChange={(event) => setField('forSale', event.target.checked)}
                        />
                      }
                      label="For Sale"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isSold}
                          onChange={(event) => setField('isSold', event.target.checked)}
                        />
                      }
                      label="Is Sold"
                    />
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Serial Number"
                  value={form.serialNumber}
                  onChange={(event) => setField('serialNumber', event.target.value)}
                  inputProps={{ maxLength: 180 }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Sold Amount"
                  type="number"
                  value={form.soldAmount}
                  onChange={(event) => setField('soldAmount', event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Sell Notes"
                  value={form.sellNotes}
                  onChange={(event) => setField('sellNotes', event.target.value)}
                  inputProps={{ maxLength: 4000 }}
                />
              </Grid>
            </Grid>

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                disabled={isSubmitting || isUploading || isImporting}
                onClick={handleSubmit}
                startIcon={
                  isSubmitting ? <CircularProgress color="inherit" size={16} /> : <IconifyIcon icon="material-symbols:save-outline-rounded" />
                }
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>

      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="lg">
        <DialogContent sx={{ p: 1, bgcolor: 'background.default' }}>
          {previewImage ? (
            <Box
              component="img"
              src={previewImage}
              alt="Inventory preview"
              sx={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh' }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default InventoryItem;
