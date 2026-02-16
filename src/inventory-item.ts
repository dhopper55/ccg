import { initListingAuth } from './listing-auth.js';

type InventoryItem = {
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

const INVENTORY_MAX_IMAGES = 10;

const form = document.getElementById('inventory-form') as HTMLFormElement | null;
const pageTitleEl = document.getElementById('inventory-item-title') as HTMLHeadingElement | null;
const modeEl = document.getElementById('inventory-form-mode') as HTMLParagraphElement | null;
const statusEl = document.getElementById('inventory-status') as HTMLDivElement | null;
const ccgInput = document.getElementById('inventory-ccg') as HTMLInputElement | null;
const imageFileInput = document.getElementById('inventory-image-file') as HTMLInputElement | null;
const imageUrlInput = document.getElementById('inventory-image-url') as HTMLInputElement | null;
const imageGallery = document.getElementById('inventory-image-gallery') as HTMLDivElement | null;
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
let inventoryImageUrls: string[] = [];

function setStatus(message: string, isError = false): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error-section', isError);
  statusEl.classList.toggle('result-section', !isError);
  statusEl.classList.remove('hidden');
}

function normalizeImageUrls(urls: string[]): string[] {
  return Array.from(new Set(
    urls
      .map((url) => (typeof url === 'string' ? url.trim() : ''))
      .filter(Boolean)
  )).slice(0, INVENTORY_MAX_IMAGES);
}

function syncPrimaryImage(): void {
  if (!imageUrlInput) return;
  imageUrlInput.value = inventoryImageUrls[0] || '';
}

function setInventoryImageUrls(urls: string[]): void {
  inventoryImageUrls = normalizeImageUrls(urls);
  syncPrimaryImage();
  renderImageGallery();
}

function renderImageGallery(): void {
  if (!imageGallery) return;
  imageGallery.innerHTML = '';

  if (!inventoryImageUrls.length) {
    imageGallery.classList.add('hidden');
    return;
  }

  inventoryImageUrls.forEach((url, index) => {
    const card = document.createElement('div');
    card.className = 'inventory-image-card';

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Inventory image ${index + 1}`;
    img.loading = 'lazy';
    card.appendChild(img);

    if (index === 0) {
      const primaryBadge = document.createElement('span');
      primaryBadge.className = 'inventory-image-primary-badge';
      primaryBadge.title = 'Primary image';
      primaryBadge.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.4l1.1-6.5-4.7-4.6 6.5-.9L12 2.5z"></path>
        </svg>
      `;
      card.appendChild(primaryBadge);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'inventory-image-remove';
    removeButton.title = 'Remove image';
    removeButton.setAttribute('aria-label', 'Remove image');
    removeButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"></path>
      </svg>
    `;
    removeButton.disabled = inventoryImageUrls.length <= 1;
    removeButton.addEventListener('click', () => {
      if (inventoryImageUrls.length <= 1) {
        setStatus('At least one image is required.', true);
        return;
      }
      setInventoryImageUrls(inventoryImageUrls.filter((_, i) => i !== index));
    });
    card.appendChild(removeButton);
    imageGallery.appendChild(card);
  });

  imageGallery.classList.remove('hidden');
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

  const existingImages = Array.isArray(record.imageUrls) && record.imageUrls.length
    ? record.imageUrls
    : (record.imageUrl ? [record.imageUrl] : []);
  setInventoryImageUrls(existingImages);
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
    setStatus('Prefilled from listing. Upload image(s) or import source image to secure storage.');
  }
}

async function handleImageFileChange(): Promise<void> {
  if (!imageFileInput || !imageFileInput.files || imageFileInput.files.length === 0) return;
  const files = Array.from(imageFileInput.files);

  if (inventoryImageUrls.length >= INVENTORY_MAX_IMAGES) {
    setStatus(`You can upload up to ${INVENTORY_MAX_IMAGES} images.`, true);
    imageFileInput.value = '';
    return;
  }

  imageFileInput.disabled = true;
  try {
    let uploadedCount = 0;
    for (const file of files) {
      if (inventoryImageUrls.length >= INVENTORY_MAX_IMAGES) break;
      setStatus(`Uploading image ${uploadedCount + 1} of ${files.length}...`);
      const imageUrl = await uploadImage(file);
      setInventoryImageUrls([...inventoryImageUrls, imageUrl]);
      uploadedCount += 1;
    }
    if (uploadedCount === 0) {
      setStatus('No images were uploaded.', true);
    } else if (inventoryImageUrls.length >= INVENTORY_MAX_IMAGES && uploadedCount < files.length) {
      setStatus(`Uploaded ${uploadedCount} image(s). Max ${INVENTORY_MAX_IMAGES} images reached.`);
    } else {
      setStatus(`Uploaded ${uploadedCount} image(s).`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload image.';
    setStatus(message, true);
  } finally {
    imageFileInput.disabled = false;
    imageFileInput.value = '';
  }
}

async function handleImportSourceImage(): Promise<void> {
  if (!sourceImageUrl || !importSourceButton) return;
  if (inventoryImageUrls.length >= INVENTORY_MAX_IMAGES) {
    setStatus(`You can upload up to ${INVENTORY_MAX_IMAGES} images.`, true);
    return;
  }
  importSourceButton.disabled = true;
  try {
    setStatus('Importing source image...');
    const imageUrl = await importSourceImage(sourceImageUrl);
    setInventoryImageUrls([...inventoryImageUrls, imageUrl]);
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
  if (!titleInput || !submitButton || !purchasedDateInput) return;

  const title = titleInput.value.trim();
  const purchasedDate = purchasedDateInput.value.trim();

  if (!title) {
    setStatus('Title is required.', true);
    return;
  }
  if (!purchasedDate) {
    setStatus('Purchased date is required.', true);
    return;
  }
  if (inventoryImageUrls.length < 1) {
    setStatus('Please upload at least one image before saving.', true);
    return;
  }

  submitButton.disabled = true;
  try {
    const payload = {
      sourceListingId,
      imageUrl: inventoryImageUrls[0],
      imageUrls: [...inventoryImageUrls],
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

    const shouldRedirectToMarketplace = Boolean(forSaleInput?.checked) && !Boolean(isSoldInput?.checked);
    const rawPrice = purchasePriceInput?.value.trim() || '';
    const parsedPrice = Number.parseFloat(rawPrice);
    const priceDollars = Number.isFinite(parsedPrice) && parsedPrice > 0 ? Math.round(parsedPrice) : 0;

    if (editId) {
      setStatus('Inventory item updated. Redirecting...');
    } else {
      if (ccgInput) ccgInput.value = data.ccgNumber || 'Created';
      setStatus(`Inventory item created: ${data.ccgNumber || ''}. Redirecting...`.trim());
    }
    window.setTimeout(() => {
      if (shouldRedirectToMarketplace) {
        const params = new URLSearchParams();
        params.set('prefillTitle', title);
        if (priceDollars > 0) {
          params.set('prefillPriceDollars', String(priceDollars));
        }
        window.location.href = `https://www.coalcreekguitars.com/admin/marketplace-listings.html?${params.toString()}`;
        return;
      }
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
  isSoldInput?.addEventListener('change', () => {
    if (isSoldInput.checked && forSaleInput) {
      forSaleInput.checked = false;
    }
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
