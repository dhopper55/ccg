import { initListingAuth } from './listing-auth.js';

type InventoryItem = {
  id: string;
  ccgNumber: string;
  imageUrl: string;
  title: string;
  category?: string;
  purchasePrice?: number | null;
  isSold?: boolean;
  soldAmount?: number | null;
  qtyAvailable?: number;
  groupCount?: number;
};

type InventoryListResponse = {
  records: InventoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  grouped: boolean;
  drillDownCcgNumber?: string | null;
  message?: string;
};

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

const statusEl = document.getElementById('inventory-status') as HTMLDivElement | null;
const gridBody = document.getElementById('inventory-grid-body') as HTMLTableSectionElement | null;
const categoryFilterEl = document.getElementById('inventory-filter-category') as HTMLSelectElement | null;
const soldOnlyFilterEl = document.getElementById('inventory-filter-sold') as HTMLInputElement | null;
const activeOnlyFilterEl = document.getElementById('inventory-filter-active') as HTMLInputElement | null;
const clearFiltersEl = document.getElementById('inventory-clear-filters') as HTMLButtonElement | null;
const pagePrevEl = document.getElementById('inventory-page-prev') as HTMLButtonElement | null;
const pageNextEl = document.getElementById('inventory-page-next') as HTMLButtonElement | null;
const pageLabelEl = document.getElementById('inventory-page-label') as HTMLSpanElement | null;
const toolbarEl = document.querySelector('.inventory-grid-toolbar') as HTMLDivElement | null;

let rows: InventoryItem[] = [];
let currentPage = 1;
let totalPages = 1;
let groupedView = true;
let drillDownCcgNumber: string | null = null;

function setStatus(message: string, isError = false): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error-section', isError);
  statusEl.classList.toggle('result-section', !isError);
  statusEl.classList.remove('hidden');
}

function clearStatus(): void {
  statusEl?.classList.add('hidden');
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyZero(value: number | null | undefined): string {
  const normalized = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(normalized);
}

function rowCell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.classList.add(className);
  return td;
}

function updatePaginationControls(): void {
  if (!pageLabelEl || !pagePrevEl || !pageNextEl) return;
  pageLabelEl.textContent = `Page ${currentPage} of ${totalPages}`;
  pagePrevEl.disabled = currentPage <= 1;
  pageNextEl.disabled = currentPage >= totalPages;
}

function setFilterDisabledState(disabled: boolean): void {
  categoryFilterEl && (categoryFilterEl.disabled = disabled);
  soldOnlyFilterEl && (soldOnlyFilterEl.disabled = disabled);
  activeOnlyFilterEl && (activeOnlyFilterEl.disabled = disabled);
  toolbarEl?.classList.toggle('is-drilldown', disabled);
}

function renderInventoryGrid(): void {
  if (!gridBody) return;
  gridBody.innerHTML = '';

  if (!rows.length) {
    const empty = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
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
    } else {
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
    } else {
      qtyTd.textContent = String(qtyValue);
    }
    tr.appendChild(qtyTd);

    tr.appendChild(rowCell(formatCurrency(row.purchasePrice), 'inventory-cell-sm'));
    const soldPrice = row.isSold ? row.soldAmount ?? 0 : 0;
    tr.appendChild(rowCell(formatCurrencyZero(soldPrice)));

    gridBody.appendChild(tr);
  });

  updatePaginationControls();
}

function setCategoryOptions(): void {
  if (!categoryFilterEl) return;

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

function buildListUrl(): string {
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

  if (category) params.set('category', category);
  params.set('sold', sold);
  params.set('active', active);

  return `/api/inventory?${params.toString()}`;
}

async function fetchInventoryRows(): Promise<InventoryListResponse> {
  const response = await fetch(buildListUrl(), { method: 'GET' });
  const data = (await response.json()) as InventoryListResponse;
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load inventory.');
  }
  return data;
}

async function loadGrid(): Promise<void> {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load inventory grid.';
    setStatus(message, true);
  }
}

function resetFiltersAndMode(): void {
  if (categoryFilterEl) categoryFilterEl.value = '';
  if (soldOnlyFilterEl) soldOnlyFilterEl.checked = false;
  if (activeOnlyFilterEl) activeOnlyFilterEl.checked = true;
  drillDownCcgNumber = null;
  currentPage = 1;
}

function bindFilterEvents(): void {
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
      if (currentPage <= 1) return;
      currentPage -= 1;
      void loadGrid();
    });
  }

  if (pageNextEl) {
    pageNextEl.addEventListener('click', () => {
      if (currentPage >= totalPages) return;
      currentPage += 1;
      void loadGrid();
    });
  }
}

async function init(): Promise<void> {
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
} else {
  void init();
}
