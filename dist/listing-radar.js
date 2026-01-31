"use strict";
const bodyEl = document.getElementById('radar-results-body');
const errorEl = document.getElementById('radar-error');
const emptyEl = document.getElementById('radar-empty');
const runLabel = document.getElementById('radar-run-label');
const includeAllToggle = document.getElementById('radar-include-all');
const refreshButton = document.getElementById('radar-refresh');
const params = new URLSearchParams(window.location.search);
const runId = params.get('run_id');
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
function formatPrice(value) {
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
function setError(message) {
    if (!errorEl)
        return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}
function clearMessages() {
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
    if (emptyEl) {
        emptyEl.classList.add('hidden');
    }
}
function renderRows(records) {
    if (!bodyEl)
        return;
    bodyEl.innerHTML = '';
    if (!records.length) {
        if (emptyEl)
            emptyEl.classList.remove('hidden');
        return;
    }
    records.forEach((record) => {
        const row = document.createElement('tr');
        const titleCell = document.createElement('td');
        const titleText = record.fields.title?.trim() || 'Untitled listing';
        const priceText = formatPrice(record.fields.price);
        if (record.fields.url) {
            const link = document.createElement('a');
            link.href = record.fields.url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.className = 'listing-item-link';
            link.textContent = priceText ? `${titleText} (${priceText})` : titleText;
            titleCell.appendChild(link);
        }
        else {
            titleCell.textContent = priceText ? `${titleText} (${priceText})` : titleText;
        }
        const sourceCell = document.createElement('td');
        sourceCell.textContent = formatSourceLabel(record.fields.source);
        const guitarCell = document.createElement('td');
        if (record.fields.is_guitar === true)
            guitarCell.textContent = 'Yes';
        else if (record.fields.is_guitar === false)
            guitarCell.textContent = 'No';
        else
            guitarCell.textContent = '—';
        const actionsCell = document.createElement('td');
        const archiveButton = document.createElement('button');
        archiveButton.className = 'secondary';
        archiveButton.textContent = 'Archive';
        archiveButton.addEventListener('click', () => {
            void archiveRecord(record.id, row, archiveButton);
        });
        const queueButton = document.createElement('button');
        queueButton.className = 'secondary';
        queueButton.textContent = 'AI Search';
        queueButton.addEventListener('click', () => {
            void queueRecord(record.id, queueButton);
        });
        actionsCell.appendChild(archiveButton);
        actionsCell.appendChild(queueButton);
        row.appendChild(titleCell);
        row.appendChild(sourceCell);
        row.appendChild(guitarCell);
        row.appendChild(actionsCell);
        bodyEl.appendChild(row);
    });
}
async function archiveRecord(recordId, row, button) {
    button.disabled = true;
    try {
        const response = await fetch(`/api/search-results/${encodeURIComponent(recordId)}/archive`, { method: 'POST' });
        if (!response.ok)
            throw new Error('Archive failed.');
        row.remove();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Archive failed.';
        setError(message);
        button.disabled = false;
    }
}
async function queueRecord(recordId, button) {
    button.disabled = true;
    try {
        const response = await fetch(`/api/search-results/${encodeURIComponent(recordId)}/queue`, { method: 'POST' });
        if (!response.ok)
            throw new Error('Queue failed.');
        button.textContent = 'Queued';
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Queue failed.';
        setError(message);
        button.disabled = false;
    }
}
async function loadResults() {
    if (!runId) {
        setError('Missing run_id in URL.');
        return;
    }
    clearMessages();
    if (runLabel)
        runLabel.textContent = `Run: ${runId}`;
    const includeAll = includeAllToggle?.checked ? 'true' : 'false';
    const url = new URL('/api/search-results', window.location.origin);
    url.searchParams.set('run_id', runId);
    url.searchParams.set('include_all', includeAll);
    try {
        const response = await fetch(url.toString());
        const data = (await response.json());
        if (!response.ok)
            throw new Error(data.message || 'Unable to load search results.');
        const records = data.records || [];
        renderRows(records);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load search results.';
        setError(message);
    }
}
if (includeAllToggle) {
    includeAllToggle.addEventListener('change', () => {
        void loadResults();
    });
}
if (refreshButton) {
    refreshButton.addEventListener('click', () => {
        void loadResults();
    });
}
void loadResults();
