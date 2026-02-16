import { initListingAuth } from './listing-auth.js?version=980318';
const form = document.getElementById('inventory-form');
const pageTitleEl = document.getElementById('inventory-item-title');
const modeEl = document.getElementById('inventory-form-mode');
const statusEl = document.getElementById('inventory-status');
const ccgInput = document.getElementById('inventory-ccg');
const imageFileInput = document.getElementById('inventory-image-file');
const imageUrlInput = document.getElementById('inventory-image-url');
const imagePreview = document.getElementById('inventory-image-preview');
const importSourceButton = document.getElementById('inventory-import-source');
const titleInput = document.getElementById('inventory-title-input');
const categoryInput = document.getElementById('inventory-category');
const brandInput = document.getElementById('inventory-brand');
const yearRangeInput = document.getElementById('inventory-year-range');
const modelInput = document.getElementById('inventory-model');
const finishInput = document.getElementById('inventory-finish');
const originalDescInput = document.getElementById('inventory-original-desc');
const purchasePriceInput = document.getElementById('inventory-purchase-price');
const purchaseNotesInput = document.getElementById('inventory-purchase-notes');
const isActiveInput = document.getElementById('inventory-is-active');
const isSoldInput = document.getElementById('inventory-is-sold');
const soldAmountInput = document.getElementById('inventory-sold-amount');
const sellNotesInput = document.getElementById('inventory-sell-notes');
const submitButton = document.getElementById('inventory-submit');
let editId = null;
let sourceListingId = null;
let sourceImageUrl = null;
function setStatus(message, isError = false) {
    if (!statusEl)
        return;
    statusEl.textContent = message;
    statusEl.classList.toggle('error-section', isError);
    statusEl.classList.toggle('result-section', !isError);
    statusEl.classList.remove('hidden');
}
function setImagePreview(url) {
    if (!imagePreview || !imageUrlInput)
        return;
    imageUrlInput.value = url || '';
    if (!url) {
        imagePreview.classList.add('hidden');
        imagePreview.removeAttribute('src');
        return;
    }
    imagePreview.src = url;
    imagePreview.classList.remove('hidden');
}
function setMode(mode) {
    if (mode === 'edit') {
        if (pageTitleEl)
            pageTitleEl.textContent = 'Edit Inventory Item';
        if (modeEl)
            modeEl.textContent = 'Edit mode';
        if (submitButton)
            submitButton.textContent = 'Save Changes';
        return;
    }
    if (pageTitleEl)
        pageTitleEl.textContent = 'Add Inventory Item';
    if (modeEl)
        modeEl.textContent = 'Add mode';
    if (submitButton)
        submitButton.textContent = 'Add Inventory Item';
}
async function uploadImage(file) {
    const formData = new FormData();
    formData.set('image', file);
    const response = await fetch('/api/inventory/upload-image', {
        method: 'POST',
        body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.imageUrl) {
        throw new Error(data.message || 'Unable to upload image.');
    }
    return data.imageUrl;
}
async function importSourceImage(url) {
    const response = await fetch('/api/inventory/import-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceUrl: url }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.imageUrl) {
        throw new Error(data.message || 'Unable to import source image.');
    }
    return data.imageUrl;
}
async function fetchInventoryRows() {
    const response = await fetch('/api/inventory', { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Unable to load inventory.');
    }
    return Array.isArray(data.records) ? data.records : [];
}
async function fetchInventoryItem(id) {
    const response = await fetch(`/api/inventory/${encodeURIComponent(id)}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok || !data.record) {
        throw new Error(data.message || 'Unable to load inventory item.');
    }
    return data.record;
}
function fillFromInventoryRecord(record) {
    editId = record.id;
    sourceListingId = record.sourceListingId || null;
    setMode('edit');
    if (ccgInput)
        ccgInput.value = record.ccgNumber || '';
    if (titleInput)
        titleInput.value = record.title || '';
    if (categoryInput)
        categoryInput.value = record.category || '';
    if (brandInput)
        brandInput.value = record.brand || '';
    if (yearRangeInput)
        yearRangeInput.value = record.yearRange || '';
    if (modelInput)
        modelInput.value = record.model || '';
    if (finishInput)
        finishInput.value = record.finish || '';
    if (originalDescInput)
        originalDescInput.value = record.originalListingDesc || '';
    if (purchasePriceInput)
        purchasePriceInput.value = record.purchasePrice != null ? String(record.purchasePrice) : '';
    if (purchaseNotesInput)
        purchaseNotesInput.value = record.purchaseNotes || '';
    if (isActiveInput)
        isActiveInput.checked = Boolean(record.isActive);
    if (isSoldInput)
        isSoldInput.checked = Boolean(record.isSold);
    if (soldAmountInput)
        soldAmountInput.value = record.soldAmount != null ? String(record.soldAmount) : '';
    if (sellNotesInput)
        sellNotesInput.value = record.sellNotes || '';
    setImagePreview(record.imageUrl || null);
}
async function prefillFromListing(listingId) {
    sourceListingId = listingId;
    const rows = await fetchInventoryRows();
    const alreadyAdded = rows.some((row) => row.sourceListingId === listingId);
    if (alreadyAdded) {
        setStatus('This listing is already in inventory.', true);
        if (submitButton)
            submitButton.disabled = true;
        return;
    }
    const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Unable to load source listing.');
    }
    const fields = data.fields || {};
    if (titleInput)
        titleInput.value = (fields.title || '').trim();
    if (categoryInput)
        categoryInput.value = (fields.category || '').trim();
    if (brandInput)
        brandInput.value = (fields.brand || '').trim();
    if (yearRangeInput)
        yearRangeInput.value = (fields.year || '').trim();
    if (modelInput)
        modelInput.value = (fields.model || '').trim();
    if (finishInput)
        finishInput.value = (fields.finish || '').trim();
    if (originalDescInput)
        originalDescInput.value = (fields.description || '').trim();
    sourceImageUrl = (fields.image_url || '').trim() || null;
    if (sourceImageUrl) {
        importSourceButton?.classList.remove('hidden');
        setStatus('Prefilled from listing. Upload an image or import source image to secure storage.');
    }
}
async function handleImageFileChange() {
    const file = imageFileInput?.files?.[0];
    if (!file || !imageFileInput)
        return;
    imageFileInput.disabled = true;
    try {
        setStatus('Uploading image...');
        const imageUrl = await uploadImage(file);
        setImagePreview(imageUrl);
        setStatus('Image uploaded.');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to upload image.';
        setStatus(message, true);
    }
    finally {
        imageFileInput.disabled = false;
    }
}
async function handleImportSourceImage() {
    if (!sourceImageUrl || !importSourceButton)
        return;
    importSourceButton.disabled = true;
    try {
        setStatus('Importing source image...');
        const imageUrl = await importSourceImage(sourceImageUrl);
        setImagePreview(imageUrl);
        setStatus('Source image imported.');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to import source image.';
        setStatus(message, true);
    }
    finally {
        importSourceButton.disabled = false;
    }
}
async function handleSubmit(event) {
    event.preventDefault();
    if (!titleInput || !imageUrlInput || !submitButton)
        return;
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
            purchasePrice: purchasePriceInput?.value.trim() || '',
            purchaseNotes: purchaseNotesInput?.value.trim() || '',
            isActive: isActiveInput?.checked ?? true,
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
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.message || (editId ? 'Unable to update inventory item.' : 'Unable to create inventory item.'));
        }
        if (editId) {
            setStatus('Inventory item updated. Redirecting...');
        }
        else {
            if (ccgInput)
                ccgInput.value = data.ccgNumber || 'Created';
            setStatus(`Inventory item created: ${data.ccgNumber || ''}. Redirecting...`.trim());
        }
        window.setTimeout(() => {
            window.location.href = 'inventory.html';
        }, 250);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save inventory item.';
        setStatus(message, true);
    }
    finally {
        submitButton.disabled = false;
    }
}
async function init() {
    initListingAuth();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const fromListingId = params.get('fromListingId');
    if (id) {
        try {
            const record = await fetchInventoryItem(id);
            fillFromInventoryRecord(record);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load inventory item.';
            setStatus(message, true);
        }
    }
    else if (fromListingId) {
        try {
            await prefillFromListing(fromListingId);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to prefill from listing.';
            setStatus(message, true);
        }
    }
    else {
        setMode('add');
    }
    imageFileInput?.addEventListener('change', () => {
        void handleImageFileChange();
    });
    importSourceButton?.addEventListener('click', () => {
        void handleImportSourceImage();
    });
    form?.addEventListener('submit', (event) => {
        void handleSubmit(event);
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void init();
    });
}
else {
    void init();
}
