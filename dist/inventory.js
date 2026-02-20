import { initListingAuth } from './listing-auth.js?version=980318';
const PAGE_SIZE = 20;
const INVENTORY_CATEGORIES = [
    'Electric Guitars',
    'Acoustic Guitars',
    'Electric Bass',
    'Acoustic Bass',
    'Effects Pedals',
    'Amplification',
    'Pro Audio',
    'Keyboards & Synthesizers',
    'Accessories',
];
const statusEl = document.getElementById('inventory-status');
const gridBody = document.getElementById('inventory-grid-body');
const categoryFilterEl = document.getElementById('inventory-filter-category');
const soldOnlyFilterEl = document.getElementById('inventory-filter-sold');
const activeOnlyFilterEl = document.getElementById('inventory-filter-active');
const pagePrevEl = document.getElementById('inventory-page-prev');
const pageNextEl = document.getElementById('inventory-page-next');
const pageLabelEl = document.getElementById('inventory-page-label');
let allRows = [];
let filteredRows = [];
let currentPage = 1;
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
function rowCell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className)
        td.classList.add(className);
    return td;
}
function normalizeCategory(value) {
    return (value || '').trim().toLowerCase();
}
function totalPages() {
    return Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
}
function updatePaginationControls() {
    if (!pageLabelEl || !pagePrevEl || !pageNextEl)
        return;
    const pages = totalPages();
    pageLabelEl.textContent = `Page ${currentPage} of ${pages}`;
    pagePrevEl.disabled = currentPage <= 1;
    pageNextEl.disabled = currentPage >= pages;
}
function renderInventoryGrid() {
    if (!gridBody)
        return;
    gridBody.innerHTML = '';
    if (!filteredRows.length) {
        const empty = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'No inventory items match the selected filters.';
        empty.appendChild(td);
        gridBody.appendChild(empty);
        updatePaginationControls();
        return;
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
    pageRows.forEach((row) => {
        const tr = document.createElement('tr');
        const ccgTd = document.createElement('td');
        ccgTd.classList.add('inventory-cell-sm');
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
        tr.appendChild(rowCell(row.title || '—', 'inventory-cell-sm'));
        tr.appendChild(rowCell(formatCurrency(row.purchasePrice), 'inventory-cell-sm'));
        const soldPrice = row.isSold ? row.soldAmount ?? 0 : 0;
        tr.appendChild(rowCell(formatCurrency(soldPrice)));
        gridBody.appendChild(tr);
    });
    updatePaginationControls();
}
function applyFilters(resetToFirstPage = false) {
    if (resetToFirstPage)
        currentPage = 1;
    const categoryFilter = normalizeCategory(categoryFilterEl?.value);
    const soldChecked = Boolean(soldOnlyFilterEl?.checked);
    const activeChecked = activeOnlyFilterEl ? activeOnlyFilterEl.checked : true;
    filteredRows = allRows.filter((row) => {
        const isSold = row.isSold === true;
        const isActive = row.isActive !== false;
        if (soldChecked) {
            if (!isSold)
                return false;
        }
        else if (isSold) {
            return false;
        }
        if (activeChecked) {
            if (!isActive)
                return false;
        }
        else if (isActive) {
            return false;
        }
        if (categoryFilter) {
            const rowCategory = normalizeCategory(row.category);
            if (rowCategory !== categoryFilter)
                return false;
        }
        return true;
    });
    const pages = totalPages();
    if (currentPage > pages)
        currentPage = pages;
    renderInventoryGrid();
}
function bindFilterEvents() {
    if (categoryFilterEl) {
        categoryFilterEl.addEventListener('change', () => {
            applyFilters(true);
        });
    }
    if (soldOnlyFilterEl) {
        soldOnlyFilterEl.addEventListener('change', () => {
            applyFilters(true);
        });
    }
    if (activeOnlyFilterEl) {
        activeOnlyFilterEl.addEventListener('change', () => {
            applyFilters(true);
        });
    }
    if (pagePrevEl) {
        pagePrevEl.addEventListener('click', () => {
            if (currentPage <= 1)
                return;
            currentPage -= 1;
            renderInventoryGrid();
        });
    }
    if (pageNextEl) {
        pageNextEl.addEventListener('click', () => {
            const pages = totalPages();
            if (currentPage >= pages)
                return;
            currentPage += 1;
            renderInventoryGrid();
        });
    }
}
function setCategoryOptions(rows) {
    if (!categoryFilterEl)
        return;
    const categories = Array.from(new Set([
        ...INVENTORY_CATEGORIES,
        ...rows
            .map((row) => (row.category || '').trim())
            .filter((category) => category.length > 0),
    ])).sort((a, b) => a.localeCompare(b));
    categoryFilterEl.innerHTML = '';
    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent = '';
    categoryFilterEl.appendChild(blankOption);
    categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterEl.appendChild(option);
    });
    categoryFilterEl.value = '';
}
async function fetchInventoryRows() {
    const response = await fetch('/api/inventory', { method: 'GET' });
    const data = (await response.json());
    if (!response.ok) {
        throw new Error(data.message || 'Unable to load inventory.');
    }
    return Array.isArray(data.records) ? data.records : [];
}
async function init() {
    initListingAuth();
    bindFilterEvents();
    try {
        allRows = await fetchInventoryRows();
        setCategoryOptions(allRows);
        applyFilters(true);
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
