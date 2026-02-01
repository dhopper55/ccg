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
const archiveButton = document.getElementById('listing-item-archive') as HTMLButtonElement | null;
const archiveLabel = archiveButton?.querySelector('.archive-label') as HTMLSpanElement | null;
const mediaEl = document.getElementById('listing-item-media') as HTMLDivElement | null;
const thumbnailEl = document.getElementById('listing-item-thumbnail') as HTMLImageElement | null;

let currentRecordId: string | null = null;
let isArchiving = false;

function formatMountainTimestamp(date: Date): string {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const datePart = dateFormatter.format(date);
  const timeParts = timeFormatter.formatToParts(date);
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '';
  const dayPeriod = timeParts.find((part) => part.type === 'dayPeriod')?.value ?? '';
  const timePart = hour && minute && dayPeriod ? `${hour}:${minute}${dayPeriod}` : timeFormatter.format(date).replace(' ', '');
  return `${datePart} ${timePart} MST`;
}

function formatSubmittedAt(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (!trimmed.includes('T') && /\\b(MST|MDT|MT)\\b/i.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return formatMountainTimestamp(parsed);
    return trimmed;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatMountainTimestamp(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatMountainTimestamp(new Date(value));
  }
  return String(value);
}

function formatSourceLabel(value: unknown): string {
  const raw = normalizeValue(value);
  if (raw === '—') return raw;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) return 'FBM';
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) return 'CG';
  return raw;
}

function formatCurrencyValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (trimmed.includes('$')) return trimmed;
    const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
    }
    return trimmed;
  }
  return String(value);
}

function formatScoreValue(value: unknown): string {
  const raw = normalizeValue(value);
  if (raw === '—') return raw;
  if (raw.includes('/10')) return raw;
  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric)) return `${numeric}/10`;
  return raw;
}

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

function isArchivedValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function isMultiValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function updateArchiveButton(archived: boolean): void {
  if (!archiveButton) return;
  archiveButton.disabled = archived || isArchiving;
  if (archiveLabel) {
    if (archived) {
      archiveLabel.textContent = 'Archived';
    } else if (isArchiving) {
      archiveLabel.textContent = 'Archiving...';
    } else {
      archiveLabel.textContent = 'Archive';
    }
  }
}

function buildTextBlock(tag: keyof HTMLElementTagNameMap, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function formatAiSummary(text: string, options?: { isMulti?: boolean }): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  let currentList: HTMLUListElement | null = null;
  const isMulti = options?.isMulti ?? false;
  let pendingMultiDetails = false;

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

    if (isMulti && line === '---') {
      flushList();
      fragment.appendChild(document.createElement('hr'));
      pendingMultiDetails = false;
      continue;
    }

    if (bulletPattern.test(line)) {
      const bulletText = line.replace(bulletStripper, '');
      if (isMulti && pendingMultiDetails) {
        const makeMatch = bulletText.match(/^Make\/model\/variant:\s*(.+)$/i);
        if (makeMatch?.[1]) {
          flushList();
          const title = document.createElement('h2');
          title.className = 'multi-item-title';
          title.textContent = makeMatch[1].trim();
          fragment.appendChild(title);

          fragment.appendChild(buildTextBlock('h3', 'Details'));
          pendingMultiDetails = false;
          continue;
        }
      }
      if (!currentList) {
        currentList = document.createElement('ul');
      }
      const item = document.createElement('li');
      item.textContent = bulletText;
      currentList.appendChild(item);
      continue;
    }

    flushList();
    const headingMatch = line.match(/^[A-Za-z].+$/);
    if (headingMatch && line.length < 80) {
      if (isMulti && /^What it appears to be$/i.test(line)) {
        pendingMultiDetails = true;
        continue;
      }
      fragment.appendChild(buildTextBlock('h3', line));
    } else {
      fragment.appendChild(buildTextBlock('p', line));
    }
  }

  flushList();
  return fragment;
}

function getAiSummary(fields: Record<string, unknown>): string {
  const parts: string[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const key = index === 1 ? 'ai_summary' : `ai_summary${index}`;
    const value = fields[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      parts.push(value.trim());
    }
  }
  if (parts.length === 0) return '—';
  return parts.join('\n\n');
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

function extractFirstPhoto(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
    return first ? String(first).trim() : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim().length > 0);
    return firstLine ? firstLine.trim() : null;
  }
  return null;
}

function renderRecord(record: ListingRecordResponse): void {
  const fields = record.fields || {};
  const title = normalizeValue(fields.title);
  const askingPrice = formatCurrencyValue(fields.price_asking);
  const archived = isArchivedValue(fields.archived);
  updateArchiveButton(archived);

  if (titleEl) titleEl.textContent = title === '—' ? 'Listing Details' : title;
  if (aiTitleEl) {
    const baseTitle = title === '—' ? 'Listing Summary' : title;
    aiTitleEl.textContent = askingPrice === '—' ? baseTitle : `${baseTitle} (${askingPrice})`;
  }

  if (metaEl) metaEl.innerHTML = '';
  addMetaRow('Status', fields.status);
  addMetaRow('Source', formatSourceLabel(fields.source));
  addMetaRow('Submitted', formatSubmittedAt(fields.submitted_at));
  addMetaRow('Listing URL', fields.url);
  addMetaRow('Asking Price', formatCurrencyValue(fields.price_asking));
  addMetaRow('Private Party Range', fields.price_private_party);
  addMetaRow('Ideal Price', formatCurrencyValue(fields.price_ideal));
  addMetaRow('Score', formatScoreValue(fields.score));
  addMetaRow('Location', fields.location);

  if (thumbnailEl && mediaEl) {
    const photoUrl = extractFirstPhoto(fields.photos);
    if (photoUrl) {
      thumbnailEl.src = photoUrl;
      thumbnailEl.alt = title === '—' ? 'Listing photo' : `${title} photo`;
      mediaEl.classList.remove('hidden');
    } else {
      thumbnailEl.removeAttribute('src');
      thumbnailEl.alt = '';
      mediaEl.classList.add('hidden');
    }
  }

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
    const summary = getAiSummary(fields);
    const isMulti = isMultiValue(fields.IsMulti);
    aiEl.innerHTML = '';
    if (summary === '—') {
      aiEl.textContent = 'No AI summary available yet.';
    } else {
      aiEl.appendChild(formatAiSummary(summary, { isMulti }));
    }
  }
}

async function archiveListing(): Promise<void> {
  if (!currentRecordId || !archiveButton) return;
  if (archiveButton.disabled) return;

  clearError();
  isArchiving = true;
  archiveButton.disabled = true;
  updateArchiveButton(false);

  try {
    const response = await fetch(`/api/listings/${encodeURIComponent(currentRecordId)}/archive`, {
      method: 'POST',
    });
    const data = (await response.json()) as ListingRecordResponse;
    if (!response.ok) {
      throw new Error(data.message || 'Unable to archive listing.');
    }

    updateArchiveButton(true);
    window.location.href = 'listing-evaluator-results.html';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to archive listing.';
    showError(message);
    archiveButton.disabled = false;
    updateArchiveButton(false);
  } finally {
    isArchiving = false;
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

    currentRecordId = recordId;
    renderRecord(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load listing.';
    showError(message);
  }
}

if (archiveButton) {
  archiveButton.addEventListener('click', (event) => {
    event.preventDefault();
    void archiveListing();
  });
}

void loadRecord();
