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
const clearFiltersEl = document.getElementById('inventory-clear-filters');
const pagePrevEl = document.getElementById('inventory-page-prev');
const pageNextEl = document.getElementById('inventory-page-next');
const pageLabelEl = document.getElementById('inventory-page-label');
const toolbarEl = document.querySelector('.inventory-grid-toolbar');
let rows = [];
let currentPage = 1;
let totalPages = 1;
let groupedView = true;
let drillDownCcgNumber = null;
function setStatus(message, isError = false) {
    if (!statusEl)
        return;
    statusEl.textContent = message;
    statusEl.classList.toggle('error-section', isError);
    statusEl.classList.toggle('result-section', !isError);
    statusEl.classList.remove('hidden');
}
function clearStatus() {
    statusEl?.classList.add('hidden');
}
function formatCurrency(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
}
function formatCurrencyZero(value) {
    const normalized = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(normalized);
}
function rowCell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className)
        td.classList.add(className);
    return td;
}
async function deleteInventoryItem(rowId, scope) {
    const response = await fetch(`/api/inventory/${encodeURIComponent(rowId)}/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope }),
    });
    const data = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new Error(data.message || 'Unable to delete inventory item.');
    }
}
function updatePaginationControls() {
    if (!pageLabelEl || !pagePrevEl || !pageNextEl)
        return;
    pageLabelEl.textContent = `Page ${currentPage} of ${totalPages}`;
    pagePrevEl.disabled = currentPage <= 1;
    pageNextEl.disabled = currentPage >= totalPages;
}
function setFilterDisabledState(disabled) {
    categoryFilterEl && (categoryFilterEl.disabled = disabled);
    soldOnlyFilterEl && (soldOnlyFilterEl.disabled = disabled);
    activeOnlyFilterEl && (activeOnlyFilterEl.disabled = disabled);
    toolbarEl?.classList.toggle('is-drilldown', disabled);
}
function renderInventoryGrid() {
    if (!gridBody)
        return;
    gridBody.innerHTML = '';
    if (!rows.length) {
        const empty = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = 'No inventory items match the selected filters.';
        empty.appendChild(td);
        gridBody.appendChild(empty);
        updatePaginationControls();
        return;
    }
    rows.forEach((row) => {
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
        const qtyTd = document.createElement('td');
        const qtyValue = groupedView
            ? Math.max(0, Number(row.qtyAvailable ?? 1))
            : 1;
        const groupCount = Math.max(1, Number(row.groupCount ?? 1));
        const canDrillDown = groupedView && groupCount > 1;
        if (canDrillDown) {
            const qtyBtn = document.createElement('button');
            qtyBtn.type = 'button';
            qtyBtn.className = 'inventory-qty-link';
            qtyBtn.textContent = String(qtyValue);
            qtyBtn.addEventListener('click', () => {
                drillDownCcgNumber = row.ccgNumber;
                currentPage = 1;
                void loadGrid();
            });
            qtyTd.appendChild(qtyBtn);
        }
        else {
            qtyTd.textContent = String(qtyValue);
        }
        tr.appendChild(qtyTd);
        tr.appendChild(rowCell(formatCurrency(row.purchasePrice), 'inventory-cell-sm'));
        const soldPrice = row.isSold ? row.soldAmount ?? 0 : 0;
        tr.appendChild(rowCell(formatCurrencyZero(soldPrice)));
        const actionsTd = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'inventory-delete-btn';
        deleteButton.setAttribute('aria-label', 'Delete inventory item');
        deleteButton.title = 'Delete';
        deleteButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"></path>
      </svg>
    `;
        deleteButton.addEventListener('click', () => {
            const confirmMessage = groupedView
                ? 'Are you sure you want to completely delete this row and all associated rows?'
                : 'Delete this 1 item completely?';
            if (!window.confirm(confirmMessage))
                return;
            deleteButton.disabled = true;
            const scope = groupedView ? 'group' : 'single';
            void (async () => {
                try {
                    await deleteInventoryItem(row.id, scope);
                    await loadGrid();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : 'Unable to delete inventory item.';
                    setStatus(message, true);
                    deleteButton.disabled = false;
                }
            })();
        });
        actionsTd.appendChild(deleteButton);
        tr.appendChild(actionsTd);
        gridBody.appendChild(tr);
    });
    updatePaginationControls();
}
function setCategoryOptions() {
    if (!categoryFilterEl)
        return;
    categoryFilterEl.innerHTML = '';
    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent = '';
    categoryFilterEl.appendChild(blankOption);
    INVENTORY_CATEGORIES.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterEl.appendChild(option);
    });
    categoryFilterEl.value = '';
}
function buildListUrl() {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(PAGE_SIZE));
    if (drillDownCcgNumber) {
        params.set('ccgNumber', drillDownCcgNumber);
        return `/api/inventory?${params.toString()}`;
    }
    const category = categoryFilterEl?.value.trim() || '';
    const sold = soldOnlyFilterEl?.checked ? '1' : '0';
    const active = activeOnlyFilterEl?.checked === false ? '0' : '1';
    if (category)
        params.set('category', category);
    params.set('sold', sold);
    params.set('active', active);
    return `/api/inventory?${params.toString()}`;
}
async function fetchInventoryRows() {
    const response = await fetch(buildListUrl(), { method: 'GET' });
    const data = (await response.json());
    if (!response.ok) {
        throw new Error(data.message || 'Unable to load inventory.');
    }
    return data;
}
async function loadGrid() {
    try {
        clearStatus();
        const data = await fetchInventoryRows();
        rows = Array.isArray(data.records) ? data.records : [];
        groupedView = Boolean(data.grouped);
        drillDownCcgNumber = data.drillDownCcgNumber || null;
        totalPages = Math.max(1, Number(data.totalPages || 1));
        currentPage = Math.max(1, Math.min(Number(data.page || 1), totalPages));
        setFilterDisabledState(Boolean(drillDownCcgNumber));
        renderInventoryGrid();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load inventory grid.';
        setStatus(message, true);
    }
}
function resetFiltersAndMode() {
    if (categoryFilterEl)
        categoryFilterEl.value = '';
    if (soldOnlyFilterEl)
        soldOnlyFilterEl.checked = false;
    if (activeOnlyFilterEl)
        activeOnlyFilterEl.checked = true;
    drillDownCcgNumber = null;
    currentPage = 1;
}
function bindFilterEvents() {
    if (categoryFilterEl) {
        categoryFilterEl.addEventListener('change', () => {
            currentPage = 1;
            void loadGrid();
        });
    }
    if (soldOnlyFilterEl) {
        soldOnlyFilterEl.addEventListener('change', () => {
            currentPage = 1;
            void loadGrid();
        });
    }
    if (activeOnlyFilterEl) {
        activeOnlyFilterEl.addEventListener('change', () => {
            currentPage = 1;
            void loadGrid();
        });
    }
    if (clearFiltersEl) {
        clearFiltersEl.addEventListener('click', () => {
            resetFiltersAndMode();
            void loadGrid();
        });
    }
    if (pagePrevEl) {
        pagePrevEl.addEventListener('click', () => {
            if (currentPage <= 1)
                return;
            currentPage -= 1;
            void loadGrid();
        });
    }
    if (pageNextEl) {
        pageNextEl.addEventListener('click', () => {
            if (currentPage >= totalPages)
                return;
            currentPage += 1;
            void loadGrid();
        });
    }
}
async function init() {
    initListingAuth();
    setCategoryOptions();
    bindFilterEvents();
    resetFiltersAndMode();
    await loadGrid();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void init();
    });
}
else {
    void init();
}
