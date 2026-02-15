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
  purchasePrice?: number | null;
  purchaseNotes?: string;
  isActive?: boolean;
  isSold?: boolean;
  soldAmount?: number | null;
  sellNotes?: string;
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
const modeEl = document.getElementById('inventory-form-mode') as HTMLParagraphElement | null;
const statusEl = document.getElementById('inventory-status') as HTMLDivElement | null;
const ccgInput = document.getElementById('inventory-ccg') as HTMLInputElement | null;
const imageFileInput = document.getElementById('inventory-image-file') as HTMLInputElement | null;
const imageUrlInput = document.getElementById('inventory-image-url') as HTMLInputElement | null;
const imagePreview = document.getElementById('inventory-image-preview') as HTMLImageElement | null;
const importSourceButton = document.getElementById('inventory-import-source') as HTMLButtonElement | null;
const titleInput = document.getElementById('inventory-title') as HTMLInputElement | null;
const categoryInput = document.getElementById('inventory-category') as HTMLInputElement | null;
const brandInput = document.getElementById('inventory-brand') as HTMLInputElement | null;
const yearRangeInput = document.getElementById('inventory-year-range') as HTMLInputElement | null;
const modelInput = document.getElementById('inventory-model') as HTMLInputElement | null;
const finishInput = document.getElementById('inventory-finish') as HTMLInputElement | null;
const originalDescInput = document.getElementById('inventory-original-desc') as HTMLTextAreaElement | null;
const purchasePriceInput = document.getElementById('inventory-purchase-price') as HTMLInputElement | null;
const purchaseNotesInput = document.getElementById('inventory-purchase-notes') as HTMLTextAreaElement | null;
const isActiveInput = document.getElementById('inventory-is-active') as HTMLInputElement | null;
const isSoldInput = document.getElementById('inventory-is-sold') as HTMLInputElement | null;
const soldAmountInput = document.getElementById('inventory-sold-amount') as HTMLInputElement | null;
const sellNotesInput = document.getElementById('inventory-sell-notes') as HTMLTextAreaElement | null;
const submitButton = document.getElementById('inventory-submit') as HTMLButtonElement | null;
const gridBody = document.getElementById('inventory-grid-body') as HTMLTableSectionElement | null;

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

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function boolMark(value: boolean | undefined): string {
  return value ? 'Yes' : 'No';
}

function rowCell(text: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function renderInventoryGrid(rows: InventoryItem[]): void {
  if (!gridBody) return;
  gridBody.innerHTML = '';

  if (!rows.length) {
    const empty = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 12;
    td.textContent = 'No inventory items yet.';
    empty.appendChild(td);
    gridBody.appendChild(empty);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.appendChild(rowCell(row.ccgNumber || '—'));

    const imageTd = document.createElement('td');
    if (row.imageUrl) {
      const img = document.createElement('img');
      img.className = 'listing-row-thumb';
      img.src = row.imageUrl;
      img.alt = `${row.title || 'Inventory'} image`;
      img.loading = 'lazy';
      imageTd.appendChild(img);
    } else {
      imageTd.textContent = '—';
    }
    tr.appendChild(imageTd);

    tr.appendChild(rowCell(row.title || '—'));
    tr.appendChild(rowCell(row.category || '—'));
    tr.appendChild(rowCell(row.brand || '—'));
    tr.appendChild(rowCell(row.yearRange || '—'));
    tr.appendChild(rowCell(row.model || '—'));
    tr.appendChild(rowCell(row.finish || '—'));
    tr.appendChild(rowCell(formatCurrency(row.purchasePrice)));
    tr.appendChild(rowCell(boolMark(row.isActive)));
    tr.appendChild(rowCell(boolMark(row.isSold)));
    tr.appendChild(rowCell(formatCurrency(row.soldAmount)));

    gridBody.appendChild(tr);
  });
}

async function fetchInventoryRows(): Promise<InventoryItem[]> {
  const response = await fetch('/api/inventory', { method: 'GET' });
  const data = await response.json() as InventoryListResponse;
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load inventory.');
  }
  return Array.isArray(data.records) ? data.records : [];
}

async function refreshGrid(): Promise<InventoryItem[]> {
  const rows = await fetchInventoryRows();
  renderInventoryGrid(rows);
  return rows;
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

async function prefillFromListing(id: string, inventoryRows: InventoryItem[]): Promise<void> {
  sourceListingId = id;
  const alreadyAdded = inventoryRows.some((row) => row.sourceListingId === id);
  if (alreadyAdded) {
    setStatus('This listing is already in inventory.', true);
    if (submitButton) submitButton.disabled = true;
    if (modeEl) modeEl.textContent = 'Add mode (already in inventory)';
    return;
  }

  const response = await fetch(`/api/listings/${encodeURIComponent(id)}`, { method: 'GET' });
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
    setStatus('Prefilled from listing. Upload an image or import source image to Cloudflare Images.');
  } else {
    importSourceButton?.classList.add('hidden');
  }

  if (modeEl) modeEl.textContent = `Add mode (from listing #${id})`;
}

async function handleImageFileChange(): Promise<void> {
  const file = imageFileInput?.files?.[0];
  if (!file) return;

  imageFileInput!.disabled = true;
  try {
    setStatus('Uploading image...');
    const imageUrl = await uploadImage(file);
    setImagePreview(imageUrl);
    setStatus('Image uploaded to Cloudflare Images.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload image.';
    setStatus(message, true);
  } finally {
    imageFileInput!.disabled = false;
  }
}

async function handleImportSourceImage(): Promise<void> {
  if (!sourceImageUrl || !importSourceButton) return;
  importSourceButton.disabled = true;
  try {
    setStatus('Importing source image...');
    const imageUrl = await importSourceImage(sourceImageUrl);
    setImagePreview(imageUrl);
    setStatus('Source image imported to Cloudflare Images.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import source image.';
    setStatus(message, true);
  } finally {
    importSourceButton.disabled = false;
  }
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!titleInput || !imageUrlInput || !submitButton) return;

  const title = titleInput.value.trim();
  let imageUrl = imageUrlInput.value.trim();
  if (!title) {
    setStatus('Title is required.', true);
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
        setStatus('Image uploaded to Cloudflare Images.');
      }
    }

    if (!imageUrl) {
      setStatus('Please upload an image before saving.', true);
      return;
    }

    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceListingId,
        imageUrl,
        title,
        category: categoryInput?.value.trim() || '',
        brand: brandInput?.value.trim() || '',
        yearRange: yearRangeInput?.value.trim() || '',
        model: modelInput?.value.trim() || '',
        finish: finishInput?.value.trim() || '',
        originalListingDesc: originalDescInput?.value.trim() || '',
        purchasePrice: purchasePriceInput?.value.trim() || '',
        purchaseNotes: purchaseNotesInput?.value.trim() || '',
        isActive: isActiveInput?.checked ?? true,
        isSold: isSoldInput?.checked ?? false,
        soldAmount: soldAmountInput?.value.trim() || '',
        sellNotes: sellNotesInput?.value.trim() || '',
      }),
    });

    const data = await response.json() as { ok?: boolean; ccgNumber?: string; message?: string };
    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'Unable to create inventory item.');
    }

    ccgInput && (ccgInput.value = data.ccgNumber || 'Created');
    setStatus(`Inventory item created: ${data.ccgNumber || ''}`.trim());
    form?.reset();
    setImagePreview(null);
    sourceListingId = null;
    sourceImageUrl = null;
    importSourceButton?.classList.add('hidden');
    if (modeEl) modeEl.textContent = 'Add mode';
    if (isActiveInput) isActiveInput.checked = true;
    if (isSoldInput) isSoldInput.checked = false;
    if (submitButton) submitButton.disabled = false;
    await refreshGrid();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create inventory item.';
    setStatus(message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function init(): Promise<void> {
  initListingAuth();

  const rows = await refreshGrid().catch(() => {
    setStatus('Could not load inventory grid.', true);
    return [] as InventoryItem[];
  });

  const params = new URLSearchParams(window.location.search);
  const fromListingId = params.get('fromListingId');
  if (fromListingId) {
    try {
      await prefillFromListing(fromListingId, rows);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prefill from listing.';
      setStatus(message, true);
    }
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
