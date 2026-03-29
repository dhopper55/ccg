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
  MenuItem,
  Paper,
  Stack,
  SvgIcon,
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
  images?: InventoryImageRecord[];
  videoUrl?: string;
  saleTitle?: string;
  regularPrice?: number | null;
  salePrice?: number | null;
  condition?: string;
  saleDescription?: string;
  title: string;
  categoryId?: number | null;
  categoryName?: string;
  categoryPath?: string;
  brand?: string;
  yearRange?: string;
  model?: string;
  finish?: string;
  repairNotes?: string;
  originalListingDesc?: string;
  purchasedDate?: string;
  purchasePrice?: number | null;
  privatePartyValue?: number | null;
  purchaseNotes?: string;
  serialNumber?: string;
  weightLbs?: string;
  neckProfile?: string;
  neckThickness?: string;
  nutWidth?: string;
  width12Fret?: string;
  fretboardRadius?: string;
  twelveFretAction?: string;
  isActive?: boolean;
  isMarked?: boolean;
  isPersonal?: boolean;
  isRented?: boolean;
  needsRepair?: boolean;
  forSale?: boolean;
  forSaleDate?: string | null;
  groupCount?: number | null;
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
    photos?: string;
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
  qty: number;
  ccgNumber: string;
  videoUrl: string;
  saleTitle: string;
  regularPrice: string;
  salePrice: string;
  condition: string;
  saleDescription: string;
  title: string;
  categoryId: string;
  brand: string;
  yearRange: string;
  model: string;
  finish: string;
  repairNotes: string;
  originalListingDesc: string;
  purchasedDate: string;
  purchasePrice: string;
  privatePartyValue: string;
  purchaseNotes: string;
  serialNumber: string;
  weightLbs: string;
  neckProfile: string;
  neckThickness: string;
  nutWidth: string;
  width12Fret: string;
  fretboardRadius: string;
  twelveFretAction: string;
  isActive: boolean;
  isMarked: boolean;
  isPersonal: boolean;
  isRented: boolean;
  needsRepair: boolean;
  forSale: boolean;
  isSold: boolean;
  soldAmount: string;
  sellNotes: string;
};

const INVENTORY_MAX_IMAGES = 20;
const GUITAR_CATEGORY_NAMES = new Set([
  'Acoustic Bass',
  'Acoustic Guitars',
  'Electric Bass',
  'Electric Guitars',
]);

const SALE_CONDITION_OPTIONS = [
  '',
  'New',
  'Used - Like New',
  'Used - Good',
  'Used - Fair',
];

type InventoryCategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: InventoryCategoryNode[];
};

type InventoryCategoriesResponse = {
  tree?: InventoryCategoryNode[];
  message?: string;
};

type InventoryCategoryOption = {
  id: string;
  name: string;
  label: string;
};

type InventoryImageRecord = {
  id?: string;
  url: string;
  isPrivate: boolean;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeImages(images: InventoryImageRecord[]): InventoryImageRecord[] {
  const seen = new Set<string>();
  const normalized = images
    .map((image) => ({
      id: image.id,
      url: typeof image.url === 'string' ? image.url.trim() : '',
      isPrivate: Boolean(image.isPrivate),
    }))
    .filter((image) => image.url)
    .filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    })
    .slice(0, INVENTORY_MAX_IMAGES);

  if (normalized.length > 0) {
    normalized[0] = { ...normalized[0], isPrivate: false };
  }

  return normalized;
}

const DEFAULT_FORM: FormState = {
  qty: 1,
  ccgNumber: 'Auto-generated on save',
  videoUrl: '',
  saleTitle: '',
  regularPrice: '',
  salePrice: '0',
  condition: '',
  saleDescription: '',
  title: '',
  categoryId: '',
  brand: '',
  yearRange: '',
  model: '',
  finish: '',
  repairNotes: '',
  originalListingDesc: '',
  purchasedDate: todayYmd(),
  purchasePrice: '',
  privatePartyValue: '0',
  purchaseNotes: '',
  serialNumber: '',
  weightLbs: '',
  neckProfile: '',
  neckThickness: '',
  nutWidth: '',
  width12Fret: '',
  fretboardRadius: '',
  twelveFretAction: '',
  isActive: true,
  isMarked: false,
  isPersonal: false,
  isRented: false,
  needsRepair: false,
  forSale: false,
  isSold: false,
  soldAmount: '',
  sellNotes: '',
};

const notesFieldSx = {
  '& .MuiInputBase-root.MuiInputBase-multiline': {
    pt: 2.25,
    pb: 1.25,
  },
  '& .MuiInputBase-inputMultiline': {
    lineHeight: 1.5,
  },
};

const LockToggleIcon = ({ filled }: { filled: boolean }) => (
  <SvgIcon sx={{ fontSize: 18 }} viewBox="0 0 24 24">
    <path
      d="M7 10V8a5 5 0 0 1 10 0v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="5.5"
      y="10"
      width="13"
      height="10"
      rx="2.25"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
    />
    {filled ? (
      <path
        d="M12 13.2a1.8 1.8 0 0 1 .9 3.36V18a.9.9 0 1 1-1.8 0v-1.44a1.8 1.8 0 0 1 .9-3.36Z"
        fill="rgba(0,0,0,0.55)"
      />
    ) : (
      <circle cx="12" cy="15" r="1.35" fill="currentColor" />
    )}
  </SvgIcon>
);

const InventoryItem = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [sourceListingId, setSourceListingId] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [groupCount, setGroupCount] = useState(1);
  const [images, setImages] = useState<InventoryImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<InventoryCategoryOption[]>([]);

  const mode = editId ? 'edit' : 'add';
  const pageTitle = mode === 'edit' ? 'Edit Inventory Item' : 'Add Inventory Item';
  const submitLabel = mode === 'edit' ? 'Save Changes' : 'Add Inventory Item';

  useEffect(() => {
    document.title = `CCG Admin | ${pageTitle}`;
  }, [pageTitle]);

  useEffect(() => {
    let cancelled = false;

    const flattenCategoryTree = (
      nodes: InventoryCategoryNode[],
      depth = 0,
    ): InventoryCategoryOption[] =>
      nodes.flatMap((node) => [
        {
          id: String(node.id),
          name: node.name,
          label: `${depth > 0 ? `${'---'.repeat(depth)} ` : ''}${node.name}`,
        },
        ...flattenCategoryTree(Array.isArray(node.children) ? node.children : [], depth + 1),
      ]);

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/admin-v2/inventory/categories', {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as InventoryCategoriesResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load inventory categories.');
        }
        if (cancelled) return;
        setCategoryOptions(flattenCategoryTree(Array.isArray(data.tree) ? data.tree : []));
      } catch (error) {
        if (cancelled) return;
        setMessage({
          severity: 'error',
          text: error instanceof Error ? error.message : 'Unable to load inventory categories.',
        });
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

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
          setGroupCount(Math.max(1, Number(record.groupCount || 1)));
          setForm({
            qty: 1,
            ccgNumber: record.ccgNumber || '',
            videoUrl: record.videoUrl || '',
            saleTitle: record.saleTitle || '',
            regularPrice: record.regularPrice != null ? String(record.regularPrice) : '',
            salePrice: record.salePrice != null ? String(record.salePrice) : '0',
            condition: record.condition || '',
            saleDescription: record.saleDescription || '',
            title: record.title || '',
            categoryId: record.categoryId != null ? String(record.categoryId) : '',
            brand: record.brand || '',
            yearRange: record.yearRange || '',
            model: record.model || '',
            finish: record.finish || '',
            repairNotes: record.repairNotes || '',
            originalListingDesc: record.originalListingDesc || '',
            purchasedDate: record.purchasedDate || todayYmd(),
            purchasePrice:
              record.purchasePrice != null ? String(record.purchasePrice) : '',
            privatePartyValue:
              record.privatePartyValue != null ? String(record.privatePartyValue) : '0',
            purchaseNotes: record.purchaseNotes || '',
            serialNumber: record.serialNumber || '',
            weightLbs: record.weightLbs || '',
            neckProfile: record.neckProfile || '',
            neckThickness: record.neckThickness || '',
            nutWidth: record.nutWidth || '',
            width12Fret: record.width12Fret || '',
            fretboardRadius: record.fretboardRadius || '',
            twelveFretAction: record.twelveFretAction || '',
            isActive: Boolean(record.isActive),
            isMarked: Boolean(record.isMarked),
            isPersonal: Boolean(record.isPersonal),
            isRented: Boolean(record.isRented),
            needsRepair: Boolean(record.needsRepair),
            forSale: Boolean(record.forSale),
            isSold: Boolean(record.isSold),
            soldAmount: record.soldAmount != null ? String(record.soldAmount) : '',
            sellNotes: record.sellNotes || '',
          });

          const existingImages = Array.isArray(record.images) && record.images.length
            ? record.images.map((image) => ({
              id: image.id,
              url: image.url,
              isPrivate: Boolean(image.isPrivate),
            }))
            : (
              Array.isArray(record.imageUrls) && record.imageUrls.length
                ? record.imageUrls
                : record.imageUrl
                  ? [record.imageUrl]
                  : []
            ).map((url) => ({ url, isPrivate: false }));
          setImages(normalizeImages(existingImages));
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
          setGroupCount(1);
          const photoCandidates = (fields.photos || '')
            .split(/\r?\n/)
            .map((u: string) => u.trim())
            .filter(Boolean);
          const singleImage = (fields.image_url || '').trim();
          const allImages = Array.from(new Set([...photoCandidates, singleImage].filter(Boolean)));
          setSourceImageUrl(singleImage || null);
          if (allImages.length > 0) {
            setImages(normalizeImages(allImages.map((url) => ({ url, isPrivate: false }))));
          }
          const year = (fields.year || '').trim();
          const brand = (fields.brand || '').trim();
          const model = (fields.model || '').trim();
          const finish = (fields.finish || '').trim();
          const concatTitle = [year, brand, model, finish].filter(Boolean).join(' ');
          setForm((current) => ({
            ...current,
            title: concatTitle || (fields.title || '').trim(),
            categoryId: '',
            brand,
            yearRange: year,
            model,
            finish,
            originalListingDesc: (fields.description || '').trim(),
          }));
          if (allImages.length > 0) {
            setMessage({
              severity: 'success',
              text: `Prefilled from listing with ${allImages.length} image(s).`,
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
          if (!id && !fromListingId) setGroupCount(1);
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

  const updateImages = (nextImages: InventoryImageRecord[]) => {
    setImages(normalizeImages(nextImages));
  };

  const createSavePayload = (nextImages: InventoryImageRecord[]) => ({
    sourceListingId,
    qty: editId ? 1 : form.qty,
    imageUrl: nextImages[0]?.url,
    imageUrls: nextImages.map((image) => image.url),
    images: nextImages.map((image) => ({ url: image.url, isPrivate: image.isPrivate })),
    videoUrl: form.videoUrl.trim(),
    saleTitle: form.saleTitle.trim(),
    regularPrice: form.regularPrice.trim(),
    salePrice: form.salePrice.trim(),
    condition: form.condition.trim(),
    saleDescription: form.saleDescription.trim(),
    title: form.title.trim(),
    categoryId: form.categoryId,
    brand: form.brand.trim(),
    yearRange: form.yearRange.trim(),
    model: form.model.trim(),
    finish: form.finish.trim(),
    repairNotes: form.repairNotes.trim(),
    originalListingDesc: form.originalListingDesc.trim(),
    purchasedDate: form.purchasedDate.trim(),
    purchasePrice: form.purchasePrice.trim(),
    privatePartyValue: form.privatePartyValue.trim() || '0',
    purchaseNotes: form.purchaseNotes.trim(),
    isActive: form.isActive,
    isMarked: form.isMarked,
    isPersonal: form.isPersonal,
    isRented: form.isRented,
    needsRepair: form.needsRepair,
    forSale: form.forSale,
    isSold: form.isSold,
    serialNumber: form.serialNumber.trim(),
    weightLbs: form.weightLbs.trim(),
    neckProfile: form.neckProfile.trim(),
    neckThickness: form.neckThickness.trim(),
    nutWidth: form.nutWidth.trim(),
    width12Fret: form.width12Fret.trim(),
    fretboardRadius: form.fretboardRadius.trim(),
    twelveFretAction: form.twelveFretAction.trim(),
    soldAmount: form.soldAmount.trim(),
    sellNotes: form.sellNotes.trim(),
  });

  const persistImages = async (
    nextImages: InventoryImageRecord[],
    previousImages: InventoryImageRecord[],
    successMessage: string,
    failureMessage: string,
  ) => {
    if (!editId) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/inventory/${encodeURIComponent(editId)}/update`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createSavePayload(nextImages)),
        credentials: 'same-origin',
      });

      const data = (await response.json().catch(() => ({}))) as SaveResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.message || failureMessage);
      }

      enqueueSnackbar(successMessage, { variant: 'success' });
    } catch (error) {
      updateImages(previousImages);
      const text = error instanceof Error ? error.message : failureMessage;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromoteImage = async (index: number) => {
    if (index <= 0 || index >= images.length) return;

    const previousImages = [...images];
    const nextImages = [...images];
    const [selected] = nextImages.splice(index, 1);
    nextImages.unshift({ ...selected, isPrivate: false });
    updateImages(nextImages);

    if (!editId) {
      return;
    }
    await persistImages(nextImages, previousImages, 'Primary image updated.', 'Unable to update inventory item.');
  };

  const handleMoveImage = async (index: number, direction: 'left' | 'right') => {
    if (index < 0 || index >= images.length) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const previousImages = [...images];
    const nextImages = [...images];
    const [selected] = nextImages.splice(index, 1);
    nextImages.splice(targetIndex, 0, selected);
    updateImages(nextImages);

    if (!editId) {
      return;
    }
    await persistImages(nextImages, previousImages, 'Image order updated.', 'Unable to reorder inventory images.');
  };

  const handleToggleImagePrivate = async (index: number) => {
    if (index <= 0 || index >= images.length) return;

    const previousImages = [...images];
    const nextImages = [...images];
    nextImages[index] = {
      ...nextImages[index],
      isPrivate: !nextImages[index].isPrivate,
    };
    updateImages(nextImages);

    if (!editId) {
      return;
    }

    await persistImages(
      nextImages,
      previousImages,
      nextImages[index].isPrivate ? 'Image marked private.' : 'Image marked public.',
      'Unable to update image privacy.',
    );
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
    if (images.length >= INVENTORY_MAX_IMAGES) {
      const text = `You can upload up to ${INVENTORY_MAX_IMAGES} images.`;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      let nextImages = [...images];
      let uploadedCount = 0;

      for (const file of files) {
        if (nextImages.length >= INVENTORY_MAX_IMAGES) break;
        const imageUrl = await uploadImage(file);
        nextImages = normalizeImages([...nextImages, { url: imageUrl, isPrivate: false }]);
        uploadedCount += 1;
        setImages(nextImages);
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
    if (images.length >= INVENTORY_MAX_IMAGES) {
      const text = `You can upload up to ${INVENTORY_MAX_IMAGES} images.`;
      setMessage({ severity: 'error', text });
      enqueueSnackbar(text, { variant: 'error' });
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const importedUrl = await importSourceImage(sourceImageUrl);
      updateImages([...images, { url: importedUrl, isPrivate: false }]);
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
    if (!form.categoryId.trim()) {
      setMessage({ severity: 'error', text: 'Category is required.' });
      return;
    }
    if (images.length < 1) {
      setMessage({ severity: 'error', text: 'Please upload at least one image before saving.' });
      return;
    }
    if (!editId) {
      if (!Number.isInteger(form.qty) || form.qty < 1 || form.qty > 100) {
        setMessage({ severity: 'error', text: 'Quantity must be a whole number between 1 and 100.' });
        return;
      }
    }
    setIsSubmitting(true);
    setMessage(null);

    try {
      const endpoint = editId
        ? `/api/inventory/${encodeURIComponent(editId)}/update`
        : '/api/inventory';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createSavePayload(images)),
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
    return images.length > 0 ? 'Add Images' : 'Upload Images';
  }, [images.length, isUploading]);

  const selectedCategoryName = useMemo(
    () => categoryOptions.find((option) => option.id === form.categoryId)?.name || '',
    [categoryOptions, form.categoryId],
  );

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
        {editId && groupCount > 1 ? (
          <Paper
            variant="outlined"
            sx={{
              mt: 2,
              width: 1,
              p: 1.5,
              borderRadius: 2,
              borderColor: 'info.main',
              bgcolor: 'info.lighter',
            }}
          >
            <Typography variant="body2" sx={{ color: 'info.darker', fontWeight: 600 }}>
              Unit edit: Unit ID {editId} of {form.ccgNumber} (Qty {groupCount}). Shared fields
              update all units with this CCG#. Sold fields update only this unit.
            </Typography>
          </Paper>
        ) : null}
      </Paper>

      {message ? <Alert severity={message.severity}>{message.text}</Alert> : null}

      <Box sx={{ p: { xs: 2, md: 5 }, minWidth: 0 }}>
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
              <Grid size={{ xs: 12, md: editId ? 6 : 3 }}>
                <TextField
                  fullWidth
                  label="Purchased Date"
                  type="date"
                  value={form.purchasedDate}
                  onChange={(event) => setField('purchasedDate', event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              {!editId ? (
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Qty"
                    type="number"
                    value={form.qty}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      setField('qty', Number.isFinite(parsed) ? parsed : 1);
                    }}
                    inputProps={{ min: 1, max: 100, step: 1 }}
                  />
                </Grid>
              ) : null}

              <Grid size={12}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Images</Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                </Stack>
              </Grid>

              <Grid size={12}>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { md: 'center' }, width: 1 }}
                  >
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
                      label={`${images.length}/${INVENTORY_MAX_IMAGES} images`}
                      color="primary"
                      variant="soft"
                    />
                  </Stack>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Upload 1 primary image plus up to 19 additional images.
                  </Typography>
                </Stack>
              </Grid>

              {images.length ? (
                <Grid size={12}>
                  <Grid container spacing={2}>
                    {images.map((image, index) => (
                      <Grid key={`${image.url}-${index}`} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1,
                            borderRadius: 3,
                            bgcolor: 'background.default',
                            '&:hover .inventory-image-promote': {
                              opacity: 1,
                              transform: 'translateY(0)',
                            },
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
                              onClick={() => setPreviewImage(image.url)}
                            >
                              {index > 0 ? (
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  className="inventory-image-promote"
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    zIndex: 1,
                                    opacity: 0,
                                    transform: 'translateY(-4px)',
                                    transition: 'opacity 160ms ease, transform 160ms ease',
                                  }}
                                >
                                  {index > 0 ? (
                                    <Tooltip title="Make primary">
                                      <IconButton
                                        size="small"
                                        aria-label="Make image primary"
                                        disabled={isSubmitting}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handlePromoteImage(index);
                                        }}
                                        sx={{
                                          bgcolor: 'rgba(15, 23, 42, 0.78)',
                                          color: 'common.white',
                                          border: 1,
                                          borderColor: 'rgba(255,255,255,0.12)',
                                          '&:hover': {
                                            bgcolor: 'rgba(15, 23, 42, 0.92)',
                                          },
                                        }}
                                      >
                                        <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={18} />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                  {index < images.length - 1 ? (
                                    <Tooltip title="Move right">
                                      <IconButton
                                        size="small"
                                        aria-label="Move image right"
                                        disabled={isSubmitting}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleMoveImage(index, 'right');
                                        }}
                                        sx={{
                                          bgcolor: 'rgba(15, 23, 42, 0.78)',
                                          color: 'common.white',
                                          border: 1,
                                          borderColor: 'rgba(255,255,255,0.12)',
                                          '&:hover': {
                                            bgcolor: 'rgba(15, 23, 42, 0.92)',
                                          },
                                        }}
                                      >
                                        <IconifyIcon icon="material-symbols:arrow-forward-rounded" fontSize={18} />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                </Stack>
                              ) : null}
                              <Box
                                component="img"
                                src={image.url}
                                alt={`Inventory image ${index + 1}`}
                                sx={{ width: 1, height: 1, objectFit: 'cover' }}
                              />
                            </Box>

                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              {index === 0 ? (
                                <Chip label="Primary" size="small" color="warning" variant="soft" />
                              ) : (
                                <Tooltip title={image.isPrivate ? 'Private image' : 'Public image'}>
                                  <IconButton
                                    size="small"
                                    aria-label={image.isPrivate ? 'Mark image public' : 'Mark image private'}
                                    disabled={isSubmitting}
                                    onClick={() => {
                                      void handleToggleImagePrivate(index);
                                    }}
                                    sx={{
                                      color: image.isPrivate ? 'warning.main' : 'text.secondary',
                                    }}
                                  >
                                    <LockToggleIcon filled={image.isPrivate} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <IconButton
                                size="small"
                                aria-label="Remove image"
                                disabled={images.length <= 1 || isSubmitting}
                                onClick={() => updateImages(images.filter((_, i) => i !== index))}
                              >
                                <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={18} />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              ) : null}

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="YouTube Url"
                  value={form.videoUrl}
                  onChange={(event) => setField('videoUrl', event.target.value)}
                  inputProps={{ maxLength: 200 }}
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                  Shared Across Qty
                </Typography>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Serial Number"
                  value={form.serialNumber}
                  onChange={(event) => setField('serialNumber', event.target.value)}
                  inputProps={{ maxLength: 180 }}
                />
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
                  value={form.categoryId}
                  onChange={(event) => setField('categoryId', event.target.value)}
                >
                  {categoryOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
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
                  minRows={3}
                  maxRows={4}
                  label="Repair/Cleaning Notes"
                  value={form.repairNotes}
                  onChange={(event) => setField('repairNotes', event.target.value)}
                  inputProps={{ maxLength: 12000 }}
                  sx={notesFieldSx}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={4}
                  label="Original Listing Desc."
                  value={form.originalListingDesc}
                  onChange={(event) => setField('originalListingDesc', event.target.value)}
                  inputProps={{ maxLength: 12000 }}
                  sx={notesFieldSx}
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
                          checked={form.isPersonal}
                          onChange={(event) => setField('isPersonal', event.target.checked)}
                        />
                      }
                      label="Is Personal"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.isRented}
                          onChange={(event) => setField('isRented', event.target.checked)}
                        />
                      }
                      label="Is Rented"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.needsRepair}
                          onChange={(event) => setField('needsRepair', event.target.checked)}
                        />
                      }
                      label="Needs Repair"
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
                  </Stack>
                </Paper>
              </Grid>

              {form.forSale ? (
                <Grid size={12}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                    <Grid container spacing={3}>
                      <Grid size={12}>
                        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                          Sale Details
                        </Typography>
                      </Grid>
                      <Grid size={12}>
                        <TextField
                          fullWidth
                          label="Title"
                          value={form.saleTitle}
                          onChange={(event) => setField('saleTitle', event.target.value)}
                          inputProps={{ maxLength: 200 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          label="Regular Price"
                          type="number"
                          value={form.regularPrice}
                          onChange={(event) => setField('regularPrice', event.target.value)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          label="Sale Price"
                          type="number"
                          value={form.salePrice}
                          onChange={(event) => setField('salePrice', event.target.value)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          select
                          fullWidth
                          label="Condition"
                          value={form.condition}
                          onChange={(event) => setField('condition', event.target.value)}
                        >
                          {SALE_CONDITION_OPTIONS.map((option) => (
                            <MenuItem key={option || 'blank'} value={option}>
                              {option || ' '}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={12}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={4}
                          maxRows={8}
                          label="Description"
                          value={form.saleDescription}
                          onChange={(event) => setField('saleDescription', event.target.value)}
                          inputProps={{ maxLength: 12000 }}
                          sx={notesFieldSx}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ) : null}

              {GUITAR_CATEGORY_NAMES.has(selectedCategoryName) ? (
                <>
                  <Grid size={12}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                      Guitar Specs
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Weight (lbs)"
                      value={form.weightLbs}
                      onChange={(event) => setField('weightLbs', event.target.value)}
                      inputProps={{ maxLength: 10 }}
                      placeholder='e.g. 9.5'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Neck Profile"
                      value={form.neckProfile}
                      onChange={(event) => setField('neckProfile', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder="e.g. C Shape (modern, rounded)"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Neck Thickness"
                      value={form.neckThickness}
                      onChange={(event) => setField('neckThickness', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 0.86"–0.95"+ (chunky)'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Nut Width"
                      value={form.nutWidth}
                      onChange={(event) => setField('nutWidth', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 1.69" (standard)'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Neck Width (12th Fret)"
                      value={form.width12Fret}
                      onChange={(event) => setField('width12Fret', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 2.06"'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Fretboard Radius"
                      value={form.fretboardRadius}
                      onChange={(event) => setField('fretboardRadius', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. 9.5" → modern Fender'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="12th Fret Action"
                      value={form.twelveFretAction}
                      onChange={(event) => setField('twelveFretAction', event.target.value)}
                      inputProps={{ maxLength: 100 }}
                      placeholder='e.g. ~4/64"–5/64"'
                    />
                  </Grid>
                </>
              ) : null}

              <Grid size={12}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                  This Unit Only
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.default' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.isSold}
                        onChange={(event) => setField('isSold', event.target.checked)}
                      />
                    }
                    label="Is Sold"
                  />
                </Paper>
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

              <Grid size={12}>
                <Box sx={{ pt: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting || isUploading || isImporting}
                    onClick={handleSubmit}
                    startIcon={
                      isSubmitting ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <IconifyIcon icon="material-symbols:save-outline-rounded" />
                      )
                    }
                  >
                    {isSubmitting ? 'Saving...' : submitLabel}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Stack>
        )}
      </Box>

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
