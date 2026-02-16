import { initListingAuth } from './listing-auth.js?version=980318';
const statusEl = document.getElementById('inventory-status');
const gridBody = document.getElementById('inventory-grid-body');
function setStatus(message, isError = false) {
    if (!statusEl)
        return;
    statusEl.textContent = message;
    statusEl.classList.toggle('error-section', isError);
    statusEl.classList.toggle('result-section', !isError);
    statusEl.classList.remove('hidden');
}
function formatCurrency(value) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
}
function boolMark(value) {
    return value ? 'Yes' : 'No';
}
function rowCell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
}
function renderInventoryGrid(rows) {
    if (!gridBody)
        return;
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
        const ccgTd = document.createElement('td');
        const ccgLink = document.createElement('a');
        ccgLink.className = 'listing-link';
        ccgLink.href = `inventory-item.html?id=${encodeURIComponent(row.id)}`;
        ccgLink.textContent = row.ccgNumber || '—';
        ccgTd.appendChild(ccgLink);
        tr.appendChild(ccgTd);
        const imageTd = document.createElement('td');
        if (row.imageUrl) {
            const img = document.createElement('img');
            img.className = 'listing-row-thumb';
            img.src = row.imageUrl;
            img.alt = `${row.title || 'Inventory'} image`;
            img.loading = 'lazy';
            imageTd.appendChild(img);
        }
        else {
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
async function fetchInventoryRows() {
    const response = await fetch('/api/inventory', { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Unable to load inventory.');
    }
    return Array.isArray(data.records) ? data.records : [];
}
async function init() {
    initListingAuth();
    try {
        const rows = await fetchInventoryRows();
        renderInventoryGrid(rows);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load inventory grid.';
        setStatus(message, true);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void init();
    });
}
else {
    void init();
}
