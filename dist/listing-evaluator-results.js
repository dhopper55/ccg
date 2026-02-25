import { initListingAuth } from './listing-auth.js?version=088533';
initListingAuth();
const tableBody = document.getElementById('listing-results-body');
const errorSection = document.getElementById('listing-results-error');
const emptySection = document.getElementById('listing-results-empty');
const prevButton = document.getElementById('listing-results-prev');
const nextButton = document.getElementById('listing-results-next');
const pageLabel = document.getElementById('listing-results-page');
const titleLabel = document.getElementById('listing-results-title');
const primaryLink = document.getElementById('listing-results-link-primary');
const secondaryLink = document.getElementById('listing-results-link-secondary');
const refreshButton = document.getElementById('listing-results-refresh');
const PAGE_SIZE = 20;
let currentOffset = null;
let nextOffset = null;
let pageIndex = 1;
let totalCount = null;
const offsetHistory = [];
const viewMode = resolveViewMode();
if (titleLabel) {
    if (viewMode === 'saved') {
        titleLabel.textContent = 'Saved Listings';
    }
    else if (viewMode === 'archived') {
        titleLabel.textContent = 'Archived Listings';
    }
}
function resolveViewMode() {
    const params = new URLSearchParams(window.location.search);
    const showSaved = params.get('showSaved') === '1';
    const showArchived = params.get('showArchived') === '1';
    if (showSaved)
        return 'saved';
    if (showArchived)
        return 'archived';
    return 'default';
}
function setResultsLinks() {
    if (!primaryLink || !secondaryLink)
        return;
    const saveIcon = `
    <span class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
        <path d="M5 4h11l3 3v13H5V4zm2 2v6h10V7.8L14.2 6H7zm2 9h6v5H9v-5z" fill="currentColor"></path>
      </svg>
    </span>
  `;
    const archiveIcon = `
    <span class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 7h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8z" fill="currentColor"></path>
      </svg>
    </span>
  `;
    const setTextLink = (el, text, href, className, ariaLabel) => {
        el.textContent = text;
        el.href = href;
        el.className = className;
        if (ariaLabel) {
            el.setAttribute('aria-label', ariaLabel);
            el.title = ariaLabel;
        }
        else {
            el.removeAttribute('aria-label');
            el.removeAttribute('title');
        }
    };
    const setIconLink = (el, iconMarkup, href, className, ariaLabel) => {
        el.innerHTML = iconMarkup;
        el.href = href;
        el.className = className;
        el.setAttribute('aria-label', ariaLabel);
        el.title = ariaLabel;
    };
    if (viewMode === 'saved') {
        setTextLink(primaryLink, 'Results', 'listing-evaluator-results.html', 'button-link', 'Results');
        setIconLink(secondaryLink, archiveIcon, 'listing-evaluator-results.html?showArchived=1', 'button-link danger', 'Archived Results');
        return;
    }
    if (viewMode === 'archived') {
        setTextLink(primaryLink, 'Results', 'listing-evaluator-results.html', 'button-link', 'Results');
        setIconLink(secondaryLink, saveIcon, 'listing-evaluator-results.html?showSaved=1', 'button-link save', 'Saved Results');
        return;
    }
    setIconLink(primaryLink, saveIcon, 'listing-evaluator-results.html?showSaved=1', 'button-link save', 'Saved Results');
    setIconLink(secondaryLink, archiveIcon, 'listing-evaluator-results.html?showArchived=1', 'button-link danger', 'Archived Results');
}
setResultsLinks();
function buildSourceIcon(value) {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase();
    const img = document.createElement('img');
    img.className = 'source-icon';
    if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
        img.src = '/images/fb.png';
        img.alt = 'Facebook Marketplace';
        return img;
    }
    if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
        img.src = '/images/cl.png';
        img.alt = 'Craigslist';
        return img;
    }
    return null;
}
function isProxyImage(url) {
    const normalized = url.toLowerCase();
    return normalized.includes('fbcdn.net') || normalized.includes('scontent-') || normalized.includes('scontent.');
}
function buildImageSrc(imageUrl, referrer) {
    const cleaned = imageUrl.trim().split(/\s+/)[0];
    if (isProxyImage(cleaned)) {
        const params = new URLSearchParams();
        params.set('url', cleaned);
        if (referrer)
            params.set('ref', referrer);
        return `/api/image?${params.toString()}`;
    }
    return cleaned;
}
function formatCurrencyValue(value) {
    if (value == null)
        return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    }
    const trimmed = String(value).trim();
    if (!trimmed)
        return '';
    if (trimmed.includes('$'))
        return trimmed;
    const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(numeric)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
    }
    return trimmed;
}
function setLoading(isLoading) {
    if (prevButton) {
        prevButton.disabled = isLoading || offsetHistory.length === 0;
        prevButton.classList.toggle('hidden', offsetHistory.length === 0);
    }
    if (nextButton) {
        nextButton.disabled = isLoading || !nextOffset;
        nextButton.classList.toggle('hidden', !nextOffset);
    }
    if (pageLabel) {
        if (isLoading) {
            pageLabel.textContent = 'Loading…';
            return;
        }
        const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
        pageLabel.textContent = totalPages ? `Page ${pageIndex} of ${totalPages}` : `Page ${pageIndex}`;
    }
}
function clearMessages() {
    if (errorSection) {
        errorSection.textContent = '';
        errorSection.classList.add('hidden');
    }
    if (emptySection) {
        emptySection.classList.add('hidden');
    }
}
function renderRows(records) {
    if (!tableBody)
        return;
    tableBody.innerHTML = '';
    if (records.length === 0) {
        if (emptySection)
            emptySection.classList.remove('hidden');
        return;
    }
    records.forEach((record) => {
        const row = document.createElement('tr');
        const isQueued = record.status?.toLowerCase() === 'queued';
        if (isQueued)
            row.classList.add('is-queued');
        const titleCell = document.createElement('td');
        const titleWrap = document.createElement('div');
        titleWrap.className = 'listing-title-cell';
        if (record.imageUrl) {
            const thumb = document.createElement('img');
            thumb.className = 'listing-row-thumb';
            thumb.src = buildImageSrc(record.imageUrl, record.url);
            thumb.alt = record.title ? `${record.title} thumbnail` : 'Listing thumbnail';
            thumb.loading = 'lazy';
            thumb.addEventListener('error', () => {
                thumb.remove();
            });
            titleWrap.appendChild(thumb);
        }
        const titleText = record.title?.trim()
            || (isQueued ? 'Queued — awaiting scrape' : (record.url ? record.url.replace(/^https?:\/\//i, '') : 'Untitled listing'));
        const asking = formatCurrencyValue(record.askingPrice);
        const titleLabel = asking ? `${titleText} (${asking})` : titleText;
        if (isQueued) {
            const titleSpan = document.createElement('span');
            titleSpan.textContent = titleLabel;
            titleSpan.className = 'listing-item-link listing-item-link--queued';
            titleWrap.appendChild(titleSpan);
        }
        else {
            const titleLink = document.createElement('a');
            titleLink.href = `listing-evaluator-item.html?id=${encodeURIComponent(record.id)}`;
            titleLink.textContent = titleLabel;
            titleLink.className = 'listing-item-link';
            titleWrap.appendChild(titleLink);
        }
        titleCell.appendChild(titleWrap);
        const sourceCell = document.createElement('td');
        const sourceIcon = buildSourceIcon(record.source);
        if (sourceIcon) {
            sourceCell.appendChild(sourceIcon);
        }
        else {
            sourceCell.textContent = record.source && record.source.trim().length > 0 ? record.source : '—';
        }
        const actionsCell = document.createElement('td');
        const addToInventory = document.createElement('a');
        addToInventory.className = 'button-link secondary add-to-inventory-link';
        addToInventory.textContent = record.inInventory ? 'In Inventory' : 'Inv. Add';
        addToInventory.href = record.inInventory
            ? '#'
            : `inventory-item.html?fromListingId=${encodeURIComponent(record.id)}`;
        if (record.inInventory) {
            addToInventory.classList.add('disabled');
            addToInventory.setAttribute('aria-disabled', 'true');
        }
        actionsCell.appendChild(addToInventory);
        row.appendChild(titleCell);
        row.appendChild(sourceCell);
        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });
}
async function loadListings() {
    clearMessages();
    setLoading(true);
    try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        if (currentOffset)
            params.set('offset', currentOffset);
        if (viewMode === 'saved') {
            params.set('showSaved', '1');
        }
        else if (viewMode === 'archived') {
            params.set('showArchived', '1');
        }
        const url = new URL('/api/listings/', window.location.origin);
        url.search = params.toString();
        const response = await fetch(url.toString());
        const data = (await response.json());
        if (!response.ok) {
            throw new Error(data.message || 'Unable to load listings.');
        }
        nextOffset = data.nextOffset ?? null;
        totalCount = typeof data.total === 'number' ? data.total : null;
        renderRows(data.records || []);
    }
    catch (error) {
        if (errorSection) {
            const message = error instanceof Error ? error.message : 'Unable to load listings.';
            errorSection.textContent = message;
            errorSection.classList.remove('hidden');
        }
    }
    finally {
        setLoading(false);
    }
}
function handleNext() {
    if (!nextOffset)
        return;
    offsetHistory.push(currentOffset);
    currentOffset = nextOffset;
    pageIndex += 1;
    void loadListings();
}
function handlePrev() {
    if (offsetHistory.length === 0)
        return;
    const previous = offsetHistory.pop();
    currentOffset = previous ?? null;
    pageIndex = Math.max(1, pageIndex - 1);
    void loadListings();
}
if (prevButton) {
    prevButton.addEventListener('click', (event) => {
        event.preventDefault();
        handlePrev();
    });
}
if (nextButton) {
    nextButton.addEventListener('click', (event) => {
        event.preventDefault();
        handleNext();
    });
}
if (refreshButton) {
    refreshButton.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.reload();
    });
}
void loadListings();
