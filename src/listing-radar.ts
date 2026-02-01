type SearchResultRecord = {
  id: string;
  fields: {
    run_id?: string;
    source?: string;
    keyword?: string;
    url?: string;
    title?: string;
    price?: number | string;
    image_url?: string;
    is_guitar?: boolean;
    archived?: boolean;
    ai_reason?: string;
  };
};

type SearchResultsResponse = {
  records: SearchResultRecord[];
  message?: string;
};

const bodyEl = document.getElementById('radar-results-body') as HTMLTableSectionElement | null;
const errorEl = document.getElementById('radar-error') as HTMLDivElement | null;
const emptyEl = document.getElementById('radar-empty') as HTMLDivElement | null;
const includeAllToggle = document.getElementById('radar-include-all') as HTMLInputElement | null;
const refreshButton = document.getElementById('radar-refresh') as HTMLButtonElement | null;

const params = new URLSearchParams(window.location.search);
const runId = params.get('run_id');

function formatSourceLabel(value: string | undefined): { label: string; icon: string } {
  if (!value) return { label: '—', icon: '•' };
  const normalized = value.trim().toLowerCase();
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
    return { label: 'Facebook Marketplace', icon: 'f' };
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return { label: 'Craigslist', icon: '✌' };
  }
  return { label: value, icon: '•' };
}

function formatPrice(value: number | string | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (trimmed.includes('$')) return trimmed;
  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
  }
  return trimmed;
}

function setError(message: string): void {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearMessages(): void {
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (emptyEl) {
    emptyEl.classList.add('hidden');
  }
}

function renderRows(records: SearchResultRecord[]): void {
  if (!bodyEl) return;
  bodyEl.innerHTML = '';

  if (!records.length) {
    if (emptyEl) emptyEl.classList.remove('hidden');
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
    } else {
      titleCell.textContent = priceText ? `${titleText} (${priceText})` : titleText;
    }

    const sourceCell = document.createElement('td');
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'source-badge';
    const { label, icon } = formatSourceLabel(record.fields.source);
    sourceBadge.title = label;
    sourceBadge.textContent = icon;
    sourceCell.appendChild(sourceBadge);

    const guitarCell = document.createElement('td');
    if (record.fields.is_guitar === true) guitarCell.textContent = 'Yes';
    else if (record.fields.is_guitar === false) guitarCell.textContent = 'No';
    else guitarCell.textContent = '—';

    const actionsCell = document.createElement('td');
    const archiveButton = document.createElement('button');
    archiveButton.className = 'icon-button';
    archiveButton.type = 'button';
    archiveButton.setAttribute('aria-label', 'Archive');
    archiveButton.innerHTML = '<span class="icon-archive" aria-hidden="true">🗄</span>';
    archiveButton.addEventListener('click', () => {
      void archiveRecord(record.id, row, archiveButton);
    });

    const queueButton = document.createElement('button');
    queueButton.className = 'secondary deep-search';
    queueButton.textContent = 'Deep Search';
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

async function archiveRecord(recordId: string, row: HTMLTableRowElement, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  try {
    const response = await fetch(`/api/search-results/${encodeURIComponent(recordId)}/archive`, { method: 'POST' });
    if (!response.ok) throw new Error('Archive failed.');
    row.remove();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Archive failed.';
    setError(message);
    button.disabled = false;
  }
}

async function queueRecord(recordId: string, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  try {
    const response = await fetch(`/api/search-results/${encodeURIComponent(recordId)}/queue`, { method: 'POST' });
    if (!response.ok) throw new Error('Queue failed.');
    button.textContent = 'Queued';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Queue failed.';
    setError(message);
    button.disabled = false;
  }
}

async function loadResults(): Promise<void> {
  if (!runId) {
    setError('Missing run_id in URL.');
    return;
  }
  clearMessages();

  const includeAll = includeAllToggle?.checked ? 'true' : 'false';
  const url = new URL('/api/search-results', window.location.origin);
  url.searchParams.set('run_id', runId);
  url.searchParams.set('include_all', includeAll);

  try {
    const response = await fetch(url.toString());
    const data = (await response.json()) as SearchResultsResponse;
    if (!response.ok) throw new Error(data.message || 'Unable to load search results.');

    const records = data.records || [];
    renderRows(records);
  } catch (error) {
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
