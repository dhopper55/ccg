async function fetchListings() {
    const response = await fetch('/api/for-sale', { method: 'GET' });
    if (!response.ok) {
        throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.records) ? data.records : [];
}
function formatPrice(priceDollars, currency) {
    const safeAmount = Number.isFinite(priceDollars) ? priceDollars : 0;
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(safeAmount);
    }
    catch {
        return `$${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
function createListingCard(listing) {
    const card = document.createElement('a');
    card.className = 'listing-card';
    card.href = listing.listingUrl;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    const imageWrap = document.createElement('div');
    imageWrap.className = 'listing-image';
    if (listing.imageUrl) {
        const img = document.createElement('img');
        img.src = listing.imageUrl;
        img.alt = listing.title || 'Listing photo';
        img.loading = 'lazy';
        imageWrap.appendChild(img);
    }
    else {
        const placeholder = document.createElement('div');
        placeholder.className = 'listing-placeholder';
        placeholder.textContent = 'No Image';
        imageWrap.appendChild(placeholder);
    }
    const info = document.createElement('div');
    info.className = 'listing-info';
    const title = document.createElement('h3');
    title.className = 'listing-title';
    title.textContent = listing.title || 'Untitled listing';
    const source = document.createElement('span');
    source.className = `listing-source listing-source--${listing.source}`;
    source.textContent = listing.source === 'facebook' ? 'Facebook' : 'Reverb';
    const priceGroup = document.createElement('div');
    priceGroup.className = 'listing-price-group';
    const price = document.createElement('p');
    price.className = 'listing-price';
    price.textContent = formatPrice(listing.priceDollars, listing.currency);
    priceGroup.appendChild(price);
    info.appendChild(source);
    info.appendChild(title);
    info.appendChild(priceGroup);
    card.appendChild(imageWrap);
    card.appendChild(info);
    return card;
}
function showError(message) {
    const errorEl = document.getElementById('listings-error');
    const loadingEl = document.getElementById('listings-loading');
    if (loadingEl)
        loadingEl.classList.add('hidden');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}
function showEmpty() {
    const emptyEl = document.getElementById('listings-empty');
    const loadingEl = document.getElementById('listings-loading');
    if (loadingEl)
        loadingEl.classList.add('hidden');
    if (emptyEl)
        emptyEl.classList.remove('hidden');
}
function renderListings(listings) {
    const gridEl = document.getElementById('listings-grid');
    const loadingEl = document.getElementById('listings-loading');
    if (loadingEl)
        loadingEl.classList.add('hidden');
    if (!gridEl)
        return;
    if (listings.length === 0) {
        showEmpty();
        return;
    }
    gridEl.innerHTML = '';
    listings.forEach((listing) => {
        gridEl.appendChild(createListingCard(listing));
    });
}
async function init() {
    try {
        const listings = await fetchListings();
        renderListings(listings);
    }
    catch (error) {
        console.error('Error fetching for-sale listings:', error);
        showError('Unable to load listings. Please try again later.');
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    void init();
}
export {};
