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
function formatSourceLabel(value) {
    if (!value)
        return '—';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook'))
        return 'FBM';
    if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist'))
        return 'CG';
    return value;
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
function formatScoreValue(value) {
    if (value == null)
        return '—';
    if (typeof value === 'number' && Number.isFinite(value))
        return `${value}/10`;
    const trimmed = String(value).trim();
    if (!trimmed)
        return '—';
    if (trimmed.includes('/10'))
        return trimmed;
    const numeric = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numeric))
        return `${numeric}/10`;
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
    const visibleRecords = records.filter((record) => record.status?.toLowerCase() !== 'queued');
    if (visibleRecords.length === 0) {
        if (emptySection)
            emptySection.classList.remove('hidden');
        return;
    }
    visibleRecords.forEach((record) => {
        const row = document.createElement('tr');
        const titleCell = document.createElement('td');
        const titleLink = document.createElement('a');
        titleLink.href = `/listing-evaluator-item.html?id=${encodeURIComponent(record.id)}`;
        const titleText = record.title?.trim() || 'Untitled listing';
        const asking = formatCurrencyValue(record.askingPrice);
        titleLink.textContent = asking ? `${titleText} (${asking})` : titleText;
        titleLink.className = 'listing-item-link';
        titleCell.appendChild(titleLink);
        const scoreCell = document.createElement('td');
        scoreCell.textContent = `(${formatScoreValue(record.score)})`;
        const sourceCell = document.createElement('td');
        sourceCell.textContent = formatSourceLabel(record.source);
        const urlCell = document.createElement('td');
        if (record.url) {
            const openLink = document.createElement('a');
            openLink.href = record.url;
            openLink.textContent = 'Open';
            openLink.target = '_blank';
            openLink.rel = 'noopener';
            urlCell.appendChild(openLink);
        }
        else {
            urlCell.textContent = '—';
        }
        row.appendChild(titleCell);
        row.appendChild(scoreCell);
        row.appendChild(sourceCell);
        row.appendChild(urlCell);
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
export {};
