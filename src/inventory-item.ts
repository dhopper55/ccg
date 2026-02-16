import { initListingAuth } from './listing-auth.js';

type InventoryItem = {
  id: string;
  sourceListingId?: string | null;
  ccgNumber: string;
  imageUrl: string;
  title: string;
  category?: string;
  brand?: string;
  yearRange?: string;
  model?: string;
  finish?: string;
  originalListingDesc?: string;
  purchasedDate?: string;
  purchasePrice?: number | null;
  purchaseNotes?: string;
  isActive?: boolean;
  forSale?: boolean;
  forSaleDate?: string | null;
  isSold?: boolean;
  soldDate?: string | null;
  soldAmount?: number | null;
  sellNotes?: string;
};

type InventoryRecordResponse = {
  record?: InventoryItem;
  message?: string;
};

type InventoryListResponse = {
  records: InventoryItem[];
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

const form = document.getElementById('inventory-form') as HTMLFormElement | null;
const pageTitleEl = document.getElementById('inventory-item-title') as HTMLHeadingElement | null;
const modeEl = document.getElementById('inventory-form-mode') as HTMLParagraphElement | null;
const statusEl = document.getElementById('inventory-status') as HTMLDivElement | null;
const ccgInput = document.getElementById('inventory-ccg') as HTMLInputElement | null;
const imageFileInput = document.getElementById('inventory-image-file') as HTMLInputElement | null;
const imageUrlInput = document.getElementById('inventory-image-url') as HTMLInputElement | null;
const imagePreview = document.getElementById('inventory-image-preview') as HTMLImageElement | null;
const importSourceButton = document.getElementById('inventory-import-source') as HTMLButtonElement | null;
const titleInput = document.getElementById('inventory-title-input') as HTMLInputElement | null;
const categoryInput = document.getElementById('inventory-category') as HTMLInputElement | null;
const brandInput = document.getElementById('inventory-brand') as HTMLInputElement | null;
const yearRangeInput = document.getElementById('inventory-year-range') as HTMLInputElement | null;
const modelInput = document.getElementById('inventory-model') as HTMLInputElement | null;
const finishInput = document.getElementById('inventory-finish') as HTMLInputElement | null;
const originalDescInput = document.getElementById('inventory-original-desc') as HTMLTextAreaElement | null;
const purchasedDateInput = document.getElementById('inventory-purchased-date') as HTMLInputElement | null;
const purchasePriceInput = document.getElementById('inventory-purchase-price') as HTMLInputElement | null;
const purchaseNotesInput = document.getElementById('inventory-purchase-notes') as HTMLTextAreaElement | null;
const isActiveInput = document.getElementById('inventory-is-active') as HTMLInputElement | null;
const forSaleInput = document.getElementById('inventory-for-sale') as HTMLInputElement | null;
const isSoldInput = document.getElementById('inventory-is-sold') as HTMLInputElement | null;
const soldAmountInput = document.getElementById('inventory-sold-amount') as HTMLInputElement | null;
const sellNotesInput = document.getElementById('inventory-sell-notes') as HTMLTextAreaElement | null;
const submitButton = document.getElementById('inventory-submit') as HTMLButtonElement | null;

let editId: string | null = null;
let sourceListingId: string | null = null;
let sourceImageUrl: string | null = null;

function setStatus(message: string, isError = false): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error-section', isError);
  statusEl.classList.toggle('result-section', !isError);
  statusEl.classList.remove('hidden');
}

function setImagePreview(url: string | null): void {
  if (!imagePreview || !imageUrlInput) return;
  imageUrlInput.value = url || '';
  if (!url) {
    imagePreview.classList.add('hidden');
    imagePreview.removeAttribute('src');
    return;
  }
  imagePreview.src = url;
  imagePreview.classList.remove('hidden');
}

function setMode(mode: 'add' | 'edit'): void {
  if (mode === 'edit') {
    if (pageTitleEl) pageTitleEl.textContent = 'Edit Inventory Item';
    if (modeEl) modeEl.textContent = 'Edit mode';
    if (submitButton) submitButton.textContent = 'Save Changes';
    return;
  }
  if (pageTitleEl) pageTitleEl.textContent = 'Add Inventory Item';
  if (modeEl) modeEl.textContent = 'Add mode';
  if (submitButton) submitButton.textContent = 'Add Inventory Item';
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.set('image', file);
  const response = await fetch('/api/inventory/upload-image', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({})) as { imageUrl?: string; message?: string };
  if (!response.ok || !data.imageUrl) {
    throw new Error(data.message || 'Unable to upload image.');
  }
  return data.imageUrl;
}

async function importSourceImage(url: string): Promise<string> {
  const response = await fetch('/api/inventory/import-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceUrl: url }),
  });
  const data = await response.json().catch(() => ({})) as { imageUrl?: string; message?: string };
  if (!response.ok || !data.imageUrl) {
    throw new Error(data.message || 'Unable to import source image.');
  }
  return data.imageUrl;
}

async function fetchInventoryRows(): Promise<InventoryItem[]> {
  const response = await fetch('/api/inventory', { method: 'GET' });
  const data = await response.json() as InventoryListResponse;
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load inventory.');
  }
  return Array.isArray(data.records) ? data.records : [];
}

async function fetchInventoryItem(id: string): Promise<InventoryItem> {
  const response = await fetch(`/api/inventory/${encodeURIComponent(id)}`, { method: 'GET' });
  const data = await response.json() as InventoryRecordResponse;
  if (!response.ok || !data.record) {
    throw new Error(data.message || 'Unable to load inventory item.');
  }
  return data.record;
}

function fillFromInventoryRecord(record: InventoryItem): void {
  editId = record.id;
  sourceListingId = record.sourceListingId || null;
  setMode('edit');

  if (ccgInput) ccgInput.value = record.ccgNumber || '';
  if (titleInput) titleInput.value = record.title || '';
  if (categoryInput) categoryInput.value = record.category || '';
  if (brandInput) brandInput.value = record.brand || '';
  if (yearRangeInput) yearRangeInput.value = record.yearRange || '';
  if (modelInput) modelInput.value = record.model || '';
  if (finishInput) finishInput.value = record.finish || '';
  if (originalDescInput) originalDescInput.value = record.originalListingDesc || '';
  if (purchasedDateInput) purchasedDateInput.value = record.purchasedDate || todayYmd();
  if (purchasePriceInput) purchasePriceInput.value = record.purchasePrice != null ? String(record.purchasePrice) : '';
  if (purchaseNotesInput) purchaseNotesInput.value = record.purchaseNotes || '';
  if (isActiveInput) isActiveInput.checked = Boolean(record.isActive);
  if (forSaleInput) forSaleInput.checked = Boolean(record.forSale);
  if (isSoldInput) isSoldInput.checked = Boolean(record.isSold);
  if (soldAmountInput) soldAmountInput.value = record.soldAmount != null ? String(record.soldAmount) : '';
  if (sellNotesInput) sellNotesInput.value = record.sellNotes || '';
  setImagePreview(record.imageUrl || null);
}

async function prefillFromListing(listingId: string): Promise<void> {
  sourceListingId = listingId;
  const rows = await fetchInventoryRows();
  const alreadyAdded = rows.some((row) => row.sourceListingId === listingId);
  if (alreadyAdded) {
    setStatus('This listing is already in inventory.', true);
    if (submitButton) submitButton.disabled = true;
    return;
  }

  const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, { method: 'GET' });
  const data = await response.json() as ListingRecordResponse;
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load source listing.');
  }

  const fields = data.fields || {};
  if (titleInput) titleInput.value = (fields.title || '').trim();
  if (categoryInput) categoryInput.value = (fields.category || '').trim();
  if (brandInput) brandInput.value = (fields.brand || '').trim();
  if (yearRangeInput) yearRangeInput.value = (fields.year || '').trim();
  if (modelInput) modelInput.value = (fields.model || '').trim();
  if (finishInput) finishInput.value = (fields.finish || '').trim();
  if (originalDescInput) originalDescInput.value = (fields.description || '').trim();

  sourceImageUrl = (fields.image_url || '').trim() || null;
  if (sourceImageUrl) {
    importSourceButton?.classList.remove('hidden');
    setStatus('Prefilled from listing. Upload an image or import source image to secure storage.');
  }
}

async function handleImageFileChange(): Promise<void> {
  const file = imageFileInput?.files?.[0];
  if (!file || !imageFileInput) return;

  imageFileInput.disabled = true;
  try {
    setStatus('Uploading image...');
    const imageUrl = await uploadImage(file);
    setImagePreview(imageUrl);
    setStatus('Image uploaded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload image.';
    setStatus(message, true);
  } finally {
    imageFileInput.disabled = false;
  }
}

async function handleImportSourceImage(): Promise<void> {
  if (!sourceImageUrl || !importSourceButton) return;
  importSourceButton.disabled = true;
  try {
    setStatus('Importing source image...');
    const imageUrl = await importSourceImage(sourceImageUrl);
    setImagePreview(imageUrl);
    setStatus('Source image imported.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import source image.';
    setStatus(message, true);
  } finally {
    importSourceButton.disabled = false;
  }
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!titleInput || !imageUrlInput || !submitButton || !purchasedDateInput) return;

  const title = titleInput.value.trim();
  const purchasedDate = purchasedDateInput.value.trim();
  let imageUrl = imageUrlInput.value.trim();
  if (!title) {
    setStatus('Title is required.', true);
    return;
  }
  if (!purchasedDate) {
    setStatus('Purchased date is required.', true);
    return;
  }

  submitButton.disabled = true;
  try {
    if (!imageUrl) {
      const selectedFile = imageFileInput?.files?.[0];
      if (selectedFile) {
        setStatus('Uploading image...');
        imageUrl = await uploadImage(selectedFile);
        setImagePreview(imageUrl);
        setStatus('Image uploaded.');
      }
    }

    if (!imageUrl) {
      setStatus('Please upload an image before saving.', true);
      return;
    }

    const payload = {
      sourceListingId,
      imageUrl,
      title,
      category: categoryInput?.value.trim() || '',
      brand: brandInput?.value.trim() || '',
      yearRange: yearRangeInput?.value.trim() || '',
      model: modelInput?.value.trim() || '',
      finish: finishInput?.value.trim() || '',
      originalListingDesc: originalDescInput?.value.trim() || '',
      purchasedDate,
      purchasePrice: purchasePriceInput?.value.trim() || '',
      purchaseNotes: purchaseNotesInput?.value.trim() || '',
      isActive: isActiveInput?.checked ?? true,
      forSale: forSaleInput?.checked ?? false,
      isSold: isSoldInput?.checked ?? false,
      soldAmount: soldAmountInput?.value.trim() || '',
      sellNotes: sellNotesInput?.value.trim() || '',
    };

    const endpoint = editId
      ? `/api/inventory/${encodeURIComponent(editId)}/update`
      : '/api/inventory';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({})) as { ok?: boolean; ccgNumber?: string; message?: string };
    if (!response.ok || !data.ok) {
      throw new Error(data.message || (editId ? 'Unable to update inventory item.' : 'Unable to create inventory item.'));
    }

    if (editId) {
      setStatus('Inventory item updated. Redirecting...');
    } else {
      if (ccgInput) ccgInput.value = data.ccgNumber || 'Created';
      setStatus(`Inventory item created: ${data.ccgNumber || ''}. Redirecting...`.trim());
    }
    window.setTimeout(() => {
      window.location.href = 'inventory.html';
    }, 250);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save inventory item.';
    setStatus(message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function init(): Promise<void> {
  initListingAuth();
  if (purchasedDateInput && !purchasedDateInput.value) purchasedDateInput.value = todayYmd();
  if (forSaleInput && !editId) forSaleInput.checked = false;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const fromListingId = params.get('fromListingId');

  if (id) {
    try {
      const record = await fetchInventoryItem(id);
      fillFromInventoryRecord(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load inventory item.';
      setStatus(message, true);
    }
  } else if (fromListingId) {
    try {
      await prefillFromListing(fromListingId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prefill from listing.';
      setStatus(message, true);
    }
  } else {
    setMode('add');
    if (purchasedDateInput) purchasedDateInput.value = todayYmd();
    if (forSaleInput) forSaleInput.checked = false;
  }

  imageFileInput?.addEventListener('change', () => {
    void handleImageFileChange();
  });
  importSourceButton?.addEventListener('click', () => {
    void handleImportSourceImage();
  });
  form?.addEventListener('submit', (event) => {
    void handleSubmit(event as SubmitEvent);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
