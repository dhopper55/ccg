import { initListingAuth } from './listing-auth.js?version=980318';
initListingAuth();
const tableBody = document.getElementById('listing-results-body');
const errorSection = document.getElementById('listing-results-error');
const emptySection = document.getElementById('listing-results-empty');
const prevButton = document.getElementById('listing-results-prev');
const nextButton = document.getElementById('listing-results-next');
const pageLabel = document.getElementById('listing-results-page');
const PAGE_SIZE = 20;
let currentOffset = null;
let nextOffset = null;
let pageIndex = 1;
const offsetHistory = [];
function buildSourceIcon(value) {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase();
    const img = document.createElement('img');
    img.className = 'source-icon';
    if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
        img.src = 'images/fb.png';
        img.alt = 'Facebook Marketplace';
        return img;
    }
    if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
        img.src = 'images/cl.png';
        img.alt = 'Craigslist';
        return img;
    }
    return null;
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
    if (pageLabel)
        pageLabel.textContent = isLoading ? 'Loading…' : `Page ${pageIndex}`;
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
        const titleText = record.title?.trim() || 'Untitled listing';
        const asking = formatCurrencyValue(record.askingPrice);
        const titleLabel = asking ? `${titleText} (${asking})` : titleText;
        if (isQueued) {
            const titleSpan = document.createElement('span');
            titleSpan.textContent = titleLabel;
            titleSpan.className = 'listing-item-link listing-item-link--queued';
            titleCell.appendChild(titleSpan);
        }
        else {
            const titleLink = document.createElement('a');
            titleLink.href = `/listing-evaluator-item.html?id=${encodeURIComponent(record.id)}`;
            titleLink.textContent = titleLabel;
            titleLink.className = 'listing-item-link';
            titleCell.appendChild(titleLink);
        }
        const sourceCell = document.createElement('td');
        const sourceIcon = buildSourceIcon(record.source);
        if (sourceIcon) {
            sourceCell.appendChild(sourceIcon);
        }
        else {
            sourceCell.textContent = '—';
        }
        row.appendChild(titleCell);
        row.appendChild(sourceCell);
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
        const url = new URL('/api/listings/', window.location.origin);
        url.search = params.toString();
        const response = await fetch(url.toString());
        const data = (await response.json());
        if (!response.ok) {
            throw new Error(data.message || 'Unable to load listings.');
        }
        nextOffset = data.nextOffset ?? null;
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
void loadListings();
