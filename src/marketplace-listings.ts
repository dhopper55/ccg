import { initListingAuth } from './listing-auth.js';

type MarketplaceListing = {
  id: string;
  source: string;
  title: string;
  priceDollars: number;
  currency: string;
  imageUrl: string;
  listingUrl: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  records: MarketplaceListing[];
};

const form = document.getElementById('marketplace-form') as HTMLFormElement | null;
const titleInput = document.getElementById('marketplace-title') as HTMLInputElement | null;
const priceInput = document.getElementById('marketplace-price') as HTMLInputElement | null;
const urlInput = document.getElementById('marketplace-url') as HTMLInputElement | null;
const imageInput = document.getElementById('marketplace-image') as HTMLInputElement | null;
const notesInput = document.getElementById('marketplace-notes') as HTMLTextAreaElement | null;
const submitButton = document.getElementById('marketplace-submit') as HTMLButtonElement | null;
const statusEl = document.getElementById('marketplace-status') as HTMLDivElement | null;
const rowsEl = document.getElementById('marketplace-rows') as HTMLDivElement | null;

function setStatus(message: string, isError = false): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error-section', isError);
  statusEl.classList.toggle('result-section', !isError);
  statusEl.classList.remove('hidden');
}

async function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  const response = await fetch('/api/marketplace-listings', { method: 'GET' });
  if (!response.ok) throw new Error('Unable to load listings.');
  const data = await response.json() as ListResponse;
  return Array.isArray(data.records) ? data.records : [];
}

async function removeMarketplaceListing(id: string): Promise<void> {
  const response = await fetch(`/api/marketplace-listings/${encodeURIComponent(id)}/remove`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ removed: true }),
  });
  if (!response.ok) throw new Error('Unable to remove listing.');
}

function formatPrice(priceDollars: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(priceDollars);
  } catch {
    return `$${priceDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function renderRows(rows: MarketplaceListing[]): void {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';

  if (rows.length === 0) {
    rowsEl.innerHTML = '<p class="listing-hint">No marketplace listings yet.</p>';
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement('article');
    item.className = 'marketplace-row';

    const title = document.createElement('h3');
    title.className = 'marketplace-row-title';
    title.textContent = row.title || 'Untitled listing';

    const meta = document.createElement('p');
    meta.className = 'marketplace-row-meta';
    meta.textContent = `${formatPrice(row.priceDollars, row.currency)} • ${row.status}`;

    const link = document.createElement('a');
    link.href = row.listingUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'listing-link';
    link.textContent = row.listingUrl;

    const actions = document.createElement('div');
    actions.className = 'marketplace-row-actions';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'secondary danger';
    removeButton.textContent = row.status === 'removed' ? 'Removed' : 'Remove';
    removeButton.disabled = row.status === 'removed';
    removeButton.addEventListener('click', async () => {
      try {
        await removeMarketplaceListing(row.id);
        setStatus('Listing removed.');
        await refreshRows();
      } catch {
        setStatus('Could not remove listing.', true);
      }
    });

    actions.appendChild(removeButton);
    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(link);
    item.appendChild(actions);
    rowsEl.appendChild(item);
  });
}

async function refreshRows(): Promise<void> {
  try {
    const rows = await fetchMarketplaceListings();
    renderRows(rows);
  } catch {
    setStatus('Could not load marketplace listings.', true);
  }
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!titleInput || !priceInput || !urlInput || !submitButton) return;

  const priceDollars = Number.parseInt(priceInput.value.trim(), 10);
  if (!Number.isFinite(priceDollars) || priceDollars < 1) {
    setStatus('Price must be a whole dollar amount greater than 0.', true);
    return;
  }

  submitButton.disabled = true;
  try {
    const response = await fetch('/api/marketplace-listings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: titleInput.value.trim(),
        priceDollars,
        listingUrl: urlInput.value.trim(),
        imageUrl: imageInput?.value.trim() || '',
        notes: notesInput?.value.trim() || '',
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Unable to add listing.' }));
      throw new Error(typeof data?.message === 'string' ? data.message : 'Unable to add listing.');
    }
    form?.reset();
    setStatus('Listing added.');
    await refreshRows();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add listing.';
    setStatus(message, true);
  } finally {
    submitButton.disabled = false;
  }
}

function init(): void {
  initListingAuth();
  form?.addEventListener('submit', (event) => {
    void handleSubmit(event as SubmitEvent);
  });
  void refreshRows();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
