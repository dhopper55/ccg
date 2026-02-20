import { initListingAuth } from './listing-auth.js';

type InventoryItem = {
  id: string;
  ccgNumber: string;
  imageUrl: string;
  title: string;
  category?: string;
  brand?: string;
  yearRange?: string;
  model?: string;
  finish?: string;
  purchasePrice?: number | null;
  isActive?: boolean;
  isSold?: boolean;
  soldAmount?: number | null;
};

type InventoryListResponse = {
  records: InventoryItem[];
  message?: string;
};

const PAGE_SIZE = 20;

const statusEl = document.getElementById('inventory-status') as HTMLDivElement | null;
const gridBody = document.getElementById('inventory-grid-body') as HTMLTableSectionElement | null;
const categoryFilterEl = document.getElementById('inventory-filter-category') as HTMLSelectElement | null;
const soldOnlyFilterEl = document.getElementById('inventory-filter-sold') as HTMLInputElement | null;
const activeOnlyFilterEl = document.getElementById('inventory-filter-active') as HTMLInputElement | null;
const pagePrevEl = document.getElementById('inventory-page-prev') as HTMLButtonElement | null;
const pageNextEl = document.getElementById('inventory-page-next') as HTMLButtonElement | null;
const pageLabelEl = document.getElementById('inventory-page-label') as HTMLSpanElement | null;

let allRows: InventoryItem[] = [];
let filteredRows: InventoryItem[] = [];
let currentPage = 1;

function setStatus(message: string, isError = false): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error-section', isError);
  statusEl.classList.toggle('result-section', !isError);
  statusEl.classList.remove('hidden');
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function rowCell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.classList.add(className);
  return td;
}

function normalizeCategory(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function totalPages(): number {
  return Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
}

function updatePaginationControls(): void {
  if (!pageLabelEl || !pagePrevEl || !pageNextEl) return;
  const pages = totalPages();
  pageLabelEl.textContent = `Page ${currentPage} of ${pages}`;
  pagePrevEl.disabled = currentPage <= 1;
  pageNextEl.disabled = currentPage >= pages;
}

function renderInventoryGrid(): void {
  if (!gridBody) return;
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
    } else {
      imageTd.textContent = '—';
    }
    tr.appendChild(imageTd);

    tr.appendChild(rowCell(row.title || '—', 'inventory-cell-sm'));
    tr.appendChild(rowCell(formatCurrency(row.purchasePrice), 'inventory-cell-sm'));
    tr.appendChild(rowCell(row.isSold ? 'Yes' : 'No'));

    gridBody.appendChild(tr);
  });

  updatePaginationControls();
}

function applyFilters(resetToFirstPage = false): void {
  if (resetToFirstPage) currentPage = 1;

  const categoryFilter = normalizeCategory(categoryFilterEl?.value);
  const soldOnly = Boolean(soldOnlyFilterEl?.checked);
  const activeOnly = activeOnlyFilterEl ? activeOnlyFilterEl.checked : true;

  filteredRows = allRows.filter((row) => {
    if (activeOnly && row.isActive === false) return false;
    if (soldOnly && row.isSold !== true) return false;
    if (categoryFilter) {
      const rowCategory = normalizeCategory(row.category);
      if (rowCategory !== categoryFilter) return false;
    }
    return true;
  });

  const pages = totalPages();
  if (currentPage > pages) currentPage = pages;
  renderInventoryGrid();
}

function bindFilterEvents(): void {
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
      if (currentPage <= 1) return;
      currentPage -= 1;
      renderInventoryGrid();
    });
  }

  if (pageNextEl) {
    pageNextEl.addEventListener('click', () => {
      const pages = totalPages();
      if (currentPage >= pages) return;
      currentPage += 1;
      renderInventoryGrid();
    });
  }
}

function setCategoryOptions(rows: InventoryItem[]): void {
  if (!categoryFilterEl) return;

  const categories = Array.from(
    new Set(
      rows
        .map((row) => (row.category || '').trim())
        .filter((category) => category.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  categoryFilterEl.innerHTML = '';

  const blankOption = document.createElement('option');
  blankOption.value = '';
  blankOption.textContent = 'Blank';
  categoryFilterEl.appendChild(blankOption);

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilterEl.appendChild(option);
  });

  categoryFilterEl.value = '';
}

async function fetchInventoryRows(): Promise<InventoryItem[]> {
  const response = await fetch('/api/inventory', { method: 'GET' });
  const data = (await response.json()) as InventoryListResponse;
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load inventory.');
  }
  return Array.isArray(data.records) ? data.records : [];
}

async function init(): Promise<void> {
  initListingAuth();
  bindFilterEvents();

  try {
    allRows = await fetchInventoryRows();
    setCategoryOptions(allRows);
    applyFilters(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load inventory grid.';
    setStatus(message, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
