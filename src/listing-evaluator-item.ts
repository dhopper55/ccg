type ListingRecordResponse = {
  id: string;
  fields: Record<string, unknown>;
  message?: string;
};

export {};

const titleEl = document.getElementById('listing-item-title') as HTMLHeadingElement | null;
const metaEl = document.getElementById('listing-item-meta') as HTMLDListElement | null;
const descriptionEl = document.getElementById('listing-item-description') as HTMLDivElement | null;
const aiEl = document.getElementById('listing-item-ai') as HTMLDivElement | null;
const aiTitleEl = document.getElementById('listing-item-ai-title') as HTMLHeadingElement | null;
const openLink = document.getElementById('listing-item-open') as HTMLAnchorElement | null;
const errorSection = document.getElementById('listing-item-error') as HTMLDivElement | null;

function getRecordId(): string | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const itemIndex = parts.indexOf('listing-evaluator-item');
  if (itemIndex !== -1 && parts.length > itemIndex + 1) {
    return parts[itemIndex + 1];
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function clearError(): void {
  if (!errorSection) return;
  errorSection.textContent = '';
  errorSection.classList.add('hidden');
}

function showError(message: string): void {
  if (!errorSection) return;
  errorSection.textContent = message;
  errorSection.classList.remove('hidden');
}

function normalizeValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' && value.trim().length === 0) return '—';
  if (typeof value === 'number') return value.toString();
  return String(value);
}

function buildTextBlock(tag: keyof HTMLElementTagNameMap, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function formatAiSummary(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  let currentList: HTMLUListElement | null = null;

  const flushList = (): void => {
    if (currentList) {
      fragment.appendChild(currentList);
      currentList = null;
    }
  };

  const bulletPattern = /^[-•*–]\s+/;
  const bulletStripper = /^([-•*–]\s+)+/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (bulletPattern.test(line)) {
      if (!currentList) {
        currentList = document.createElement('ul');
      }
      const item = document.createElement('li');
      item.textContent = line.replace(bulletStripper, '');
      currentList.appendChild(item);
      continue;
    }

    flushList();
    const headingMatch = line.match(/^[A-Za-z].+$/);
    if (headingMatch && line.length < 80) {
      fragment.appendChild(buildTextBlock('h3', line));
    } else {
      fragment.appendChild(buildTextBlock('p', line));
    }
  }

  flushList();
  return fragment;
}

function addMetaRow(label: string, value: unknown): void {
  if (!metaEl) return;
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = normalizeValue(value);
  metaEl.appendChild(term);
  metaEl.appendChild(detail);
}

function renderRecord(record: ListingRecordResponse): void {
  const fields = record.fields || {};
  const title = normalizeValue(fields.title);
  const askingPrice = normalizeValue(fields.price_asking);

  if (titleEl) titleEl.textContent = title === '—' ? 'Listing Details' : title;
  if (aiTitleEl) {
    const baseTitle = title === '—' ? 'Listing Summary' : title;
    aiTitleEl.textContent = askingPrice === '—' ? baseTitle : `${baseTitle} (${askingPrice})`;
  }

  if (metaEl) metaEl.innerHTML = '';
  addMetaRow('Status', fields.status);
  addMetaRow('Source', fields.source);
  addMetaRow('Submitted', fields.submitted_at);
  addMetaRow('Listing URL', fields.url);
  addMetaRow('Asking Price', fields.price_asking);
  addMetaRow('Private Party Range', fields.price_private_party);
  addMetaRow('Ideal Price', fields.price_ideal);
  addMetaRow('Score', fields.score);
  addMetaRow('Location', fields.location);

  const url = typeof fields.url === 'string' ? fields.url : '';
  if (openLink) {
    if (url) {
      openLink.href = url;
      openLink.classList.remove('hidden');
    } else {
      openLink.classList.add('hidden');
    }
  }

  if (descriptionEl) {
    const description = normalizeValue(fields.description);
    descriptionEl.textContent = description === '—' ? 'No description available.' : description;
  }

  if (aiEl) {
    const summary = normalizeValue(fields.ai_summary);
    aiEl.innerHTML = '';
    if (summary === '—') {
      aiEl.textContent = 'No AI summary available yet.';
    } else {
      aiEl.appendChild(formatAiSummary(summary));
    }
  }
}

async function loadRecord(): Promise<void> {
  clearError();
  const recordId = getRecordId();

  if (!recordId) {
    showError('Missing listing ID. Return to the results page and select a listing.');
    return;
  }

  try {
    const response = await fetch(`/api/listings/${encodeURIComponent(recordId)}`);
    const data = (await response.json()) as ListingRecordResponse;

    if (!response.ok) {
      throw new Error(data.message || 'Unable to load listing.');
    }

    renderRecord(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load listing.';
    showError(message);
  }
}

void loadRecord();
