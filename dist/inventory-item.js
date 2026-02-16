import { initListingAuth } from './listing-auth.js?version=980318';
const INVENTORY_MAX_IMAGES = 10;
const form = document.getElementById('inventory-form');
const pageTitleEl = document.getElementById('inventory-item-title');
const modeEl = document.getElementById('inventory-form-mode');
const statusEl = document.getElementById('inventory-status');
const ccgInput = document.getElementById('inventory-ccg');
const imageFileInput = document.getElementById('inventory-image-file');
const imageUrlInput = document.getElementById('inventory-image-url');
const imageGallery = document.getElementById('inventory-image-gallery');
const importSourceButton = document.getElementById('inventory-import-source');
const titleInput = document.getElementById('inventory-title-input');
const categoryInput = document.getElementById('inventory-category');
const brandInput = document.getElementById('inventory-brand');
const yearRangeInput = document.getElementById('inventory-year-range');
const modelInput = document.getElementById('inventory-model');
const finishInput = document.getElementById('inventory-finish');
const originalDescInput = document.getElementById('inventory-original-desc');
const purchasedDateInput = document.getElementById('inventory-purchased-date');
const purchasePriceInput = document.getElementById('inventory-purchase-price');
const privatePartyValueInput = document.getElementById('inventory-private-party-value');
const purchaseNotesInput = document.getElementById('inventory-purchase-notes');
const isActiveInput = document.getElementById('inventory-is-active');
const forSaleInput = document.getElementById('inventory-for-sale');
const isSoldInput = document.getElementById('inventory-is-sold');
const serialNumberInput = document.getElementById('inventory-serial-number');
const soldAmountInput = document.getElementById('inventory-sold-amount');
const sellNotesInput = document.getElementById('inventory-sell-notes');
const submitButton = document.getElementById('inventory-submit');
let editId = null;
let sourceListingId = null;
let sourceImageUrl = null;
let inventoryImageUrls = [];
function setStatus(message, isError = false) {
    if (!statusEl)
        return;
    statusEl.textContent = message;
    statusEl.classList.toggle('error-section', isError);
    statusEl.classList.toggle('result-section', !isError);
    statusEl.classList.remove('hidden');
}
function normalizeImageUrls(urls) {
    return Array.from(new Set(urls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean))).slice(0, INVENTORY_MAX_IMAGES);
}
function syncPrimaryImage() {
    if (!imageUrlInput)
        return;
    imageUrlInput.value = inventoryImageUrls[0] || '';
}
function setInventoryImageUrls(urls) {
    inventoryImageUrls = normalizeImageUrls(urls);
    syncPrimaryImage();
    renderImageGallery();
}
function renderImageGallery() {
    if (!imageGallery)
        return;
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
function todayYmd() {
    return new Date().toISOString().slice(0, 10);
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
    if (purchasedDateInput)
        purchasedDateInput.value = record.purchasedDate || todayYmd();
    if (purchasePriceInput)
        purchasePriceInput.value = record.purchasePrice != null ? String(record.purchasePrice) : '';
    if (privatePartyValueInput) {
        privatePartyValueInput.value = record.privatePartyValue != null ? String(record.privatePartyValue) : '0';
    }
    if (purchaseNotesInput)
        purchaseNotesInput.value = record.purchaseNotes || '';
    if (isActiveInput)
        isActiveInput.checked = Boolean(record.isActive);
    if (forSaleInput)
        forSaleInput.checked = Boolean(record.forSale);
    if (isSoldInput)
        isSoldInput.checked = Boolean(record.isSold);
    if (serialNumberInput)
        serialNumberInput.value = record.serialNumber || '';
    if (soldAmountInput)
        soldAmountInput.value = record.soldAmount != null ? String(record.soldAmount) : '';
    if (sellNotesInput)
        sellNotesInput.value = record.sellNotes || '';
    const existingImages = Array.isArray(record.imageUrls) && record.imageUrls.length
        ? record.imageUrls
        : (record.imageUrl ? [record.imageUrl] : []);
    setInventoryImageUrls(existingImages);
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
        setStatus('Prefilled from listing. Upload image(s) or import source image to secure storage.');
    }
}
async function handleImageFileChange() {
    if (!imageFileInput || !imageFileInput.files || imageFileInput.files.length === 0)
        return;
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
            if (inventoryImageUrls.length >= INVENTORY_MAX_IMAGES)
                break;
            setStatus(`Uploading image ${uploadedCount + 1} of ${files.length}...`);
            const imageUrl = await uploadImage(file);
            setInventoryImageUrls([...inventoryImageUrls, imageUrl]);
            uploadedCount += 1;
        }
        if (uploadedCount === 0) {
            setStatus('No images were uploaded.', true);
        }
        else if (inventoryImageUrls.length >= INVENTORY_MAX_IMAGES && uploadedCount < files.length) {
            setStatus(`Uploaded ${uploadedCount} image(s). Max ${INVENTORY_MAX_IMAGES} images reached.`);
        }
        else {
            setStatus(`Uploaded ${uploadedCount} image(s).`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to upload image.';
        setStatus(message, true);
    }
    finally {
        imageFileInput.disabled = false;
        imageFileInput.value = '';
    }
}
async function handleImportSourceImage() {
    if (!sourceImageUrl || !importSourceButton)
        return;
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
    if (!titleInput || !submitButton || !purchasedDateInput)
        return;
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
    if (!categoryInput?.value.trim()) {
        setStatus('Category is required.', true);
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
            privatePartyValue: privatePartyValueInput?.value.trim() || '0',
            purchaseNotes: purchaseNotesInput?.value.trim() || '',
            isActive: isActiveInput?.checked ?? true,
            forSale: forSaleInput?.checked ?? false,
            isSold: isSoldInput?.checked ?? false,
            serialNumber: serialNumberInput?.value.trim() || '',
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
        const shouldRedirectToMarketplace = Boolean(forSaleInput?.checked) && !Boolean(isSoldInput?.checked);
        const rawPrice = purchasePriceInput?.value.trim() || '';
        const parsedPrice = Number.parseFloat(rawPrice);
        const priceDollars = Number.isFinite(parsedPrice) && parsedPrice > 0 ? Math.round(parsedPrice) : 0;
        if (editId) {
            setStatus('Inventory item updated. Redirecting...');
        }
        else {
            if (ccgInput)
                ccgInput.value = data.ccgNumber || 'Created';
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
    if (purchasedDateInput && !purchasedDateInput.value)
        purchasedDateInput.value = todayYmd();
    if (privatePartyValueInput && !privatePartyValueInput.value)
        privatePartyValueInput.value = '0';
    if (forSaleInput && !editId)
        forSaleInput.checked = false;
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
        if (purchasedDateInput)
            purchasedDateInput.value = todayYmd();
        if (forSaleInput)
            forSaleInput.checked = false;
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
