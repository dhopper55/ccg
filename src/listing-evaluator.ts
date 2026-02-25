import { initListingAuth } from './listing-auth.js';

export {};

initListingAuth();

type SubmitResponse = {
  accepted: number;
  rejected?: Array<{ url: string; reason: string }>;
  queued?: Array<{ url: string; source?: string; jobId?: string }>;
  message?: string;
};

const MAX_URLS = 20;
const BATCH_SIZE = 5;

const form = document.getElementById('listing-form') as HTMLFormElement | null;
const urlsInput = document.getElementById('listing-urls') as HTMLTextAreaElement | null;
const multiUrlsInput = document.getElementById('listing-urls-multi') as HTMLTextAreaElement | null;
const submitButton = document.getElementById('listing-submit') as HTMLButtonElement | null;
const successSection = document.getElementById('listing-success') as HTMLDivElement | null;
const successMessage = document.getElementById('listing-success-message') as HTMLParagraphElement | null;
const rejectedSection = document.getElementById('listing-rejected') as HTMLDivElement | null;
const errorSection = document.getElementById('listing-error') as HTMLDivElement | null;
const radarEnabledInput = document.getElementById('radar-enabled') as HTMLInputElement | null;
const radarIntervalInput = document.getElementById('radar-interval') as HTMLInputElement | null;
const radarResultsLimitInput = document.getElementById('radar-results-limit') as HTMLInputElement | null;
const radarStatus = document.getElementById('radar-status') as HTMLSpanElement | null;
const clipboardAutoPasteState = new WeakMap<HTMLTextAreaElement, { focusAttempted: boolean; lastPastedSignature: string }>();

if (form && urlsInput && submitButton) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSubmit();
  });
}

if (urlsInput) {
  setupClipboardHelpers(urlsInput, 'single');
}

if (multiUrlsInput) {
  setupClipboardHelpers(multiUrlsInput, 'multi');
}

if (radarEnabledInput) {
  radarEnabledInput.addEventListener('change', () => {
    void handleRadarSave();
  });
}

if (radarIntervalInput) {
  radarIntervalInput.addEventListener('change', () => {
    void handleRadarSave();
  });
}

if (radarResultsLimitInput) {
  radarResultsLimitInput.addEventListener('change', () => {
    void handleRadarSave();
  });
}


void loadRadarSettings();

function resetMessages(): void {
  if (successSection) successSection.classList.add('hidden');
  if (errorSection) errorSection.classList.add('hidden');
  if (rejectedSection) rejectedSection.classList.add('hidden');
  if (successMessage) successMessage.textContent = '';
  if (errorSection) errorSection.textContent = '';
  if (rejectedSection) rejectedSection.innerHTML = '';
}

function setLoading(isLoading: boolean): void {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Queuing…' : 'Queue Listings';
}

function setRadarStatus(message: string, isError = false): void {
  if (!radarStatus) return;
  radarStatus.textContent = message;
  radarStatus.style.color = isError ? '#ffb1b1' : '';
}

async function loadRadarSettings(): Promise<void> {
  if (!radarEnabledInput || !radarIntervalInput || !radarResultsLimitInput) return;
  try {
    const response = await fetch('/api/radar/settings');
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Unable to load radar settings.');
    radarEnabledInput.checked = Boolean(data?.enabled);
    radarIntervalInput.value = String(data?.intervalMinutes ?? 3);
    radarResultsLimitInput.value = String(data?.resultsLimit ?? 5);
    if (data?.lastSummary) {
      setRadarStatus(data.lastSummary);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load radar settings.';
    setRadarStatus(message, true);
  }
}

async function handleRadarSave(): Promise<void> {
  if (!radarEnabledInput || !radarIntervalInput || !radarResultsLimitInput) return;
  const interval = Number.parseInt(radarIntervalInput.value, 10);
  const resultsLimit = Number.parseInt(radarResultsLimitInput.value, 10);
  setRadarStatus('Saving...');
  try {
    const response = await fetch('/api/radar/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: radarEnabledInput.checked,
        intervalMinutes: Number.isFinite(interval) ? interval : 3,
        resultsLimit: Number.isFinite(resultsLimit) ? resultsLimit : 5,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Unable to save radar settings.');
    radarEnabledInput.checked = Boolean(data?.enabled);
    radarIntervalInput.value = String(data?.intervalMinutes ?? 3);
    radarResultsLimitInput.value = String(data?.resultsLimit ?? 5);
    setRadarStatus('Saved.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save radar settings.';
    setRadarStatus(message, true);
  }
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }

  if (/^(www\.|facebook\.com|m\.facebook\.com|craigslist\.)/i.test(trimmed)) {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }

  return null;
}

function extractUrls(input: string): string[] {
  const matches = input.match(/https?:\/\/[^\s]+/gi) || [];
  const candidates = matches.length > 0 ? matches : input.split(/[\s,]+/g);
  const urls: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (normalized) urls.push(normalized);
  }

  return Array.from(new Set(urls));
}

function isSupportedListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('facebook.com')) {
      return path.includes('/marketplace/item/');
    }

    if (host.endsWith('craigslist.org')) {
      return path.includes('/d/') || path.startsWith('/msg/');
    }

    return false;
  } catch {
    return false;
  }
}

function createPasteButton(textarea: HTMLTextAreaElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'clipboard-paste-btn';
  button.textContent = 'Paste Clipboard';
  button.setAttribute('aria-label', 'Paste URL from clipboard');
  button.addEventListener('click', () => {
    void tryPasteClipboardIntoTextarea(textarea, { isAuto: false });
  });
  return button;
}

function ensureClipboardUi(textarea: HTMLTextAreaElement): void {
  const formGroup = textarea.closest('.form-group') as HTMLDivElement | null;
  if (!formGroup) return;
  if (formGroup.querySelector('.clipboard-paste-btn')) return;

  const label = formGroup.querySelector(`label[for="${textarea.id}"]`);
  const button = createPasteButton(textarea);
  if (label && label.parentElement === formGroup) {
    label.insertAdjacentElement('afterend', button);
  } else {
    formGroup.insertBefore(button, textarea);
  }
}

function setupClipboardHelpers(textarea: HTMLTextAreaElement, _kind: 'single' | 'multi'): void {
  clipboardAutoPasteState.set(textarea, { focusAttempted: false, lastPastedSignature: '' });

  textarea.addEventListener('focus', () => {
    const state = clipboardAutoPasteState.get(textarea);
    if (!state || state.focusAttempted) return;
    state.focusAttempted = true;
    void tryPasteClipboardIntoTextarea(textarea, { isAuto: true });
  });

  textarea.addEventListener('blur', () => {
    const state = clipboardAutoPasteState.get(textarea);
    if (!state) return;
    // allow a fresh auto-attempt on the next focus, but don't repaste same clipboard content
    state.focusAttempted = false;
  });
}

function mergeUrlsIntoTextarea(textarea: HTMLTextAreaElement, urls: string[]): { added: number; signature: string } {
  const existingUrls = extractUrls(textarea.value);
  const seen = new Set(existingUrls.map((url) => url.toLowerCase()));
  const toAdd: string[] = [];
  for (const url of urls) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    toAdd.push(url);
  }
  if (!toAdd.length) {
    return { added: 0, signature: urls.join('|') };
  }

  const existing = textarea.value.trim();
  const appended = toAdd.join('\n');
  textarea.value = existing ? `${existing}\n${appended}` : appended;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  return { added: toAdd.length, signature: urls.join('|') };
}

async function readClipboardTextSafe(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null;
  try {
    const text = await navigator.clipboard.readText();
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
}

async function tryPasteClipboardIntoTextarea(
  textarea: HTMLTextAreaElement,
  options: { isAuto: boolean }
): Promise<void> {
  const button = (textarea.closest('.form-group')?.querySelector('.clipboard-paste-btn') as HTMLButtonElement | null) || null;
  const originalLabel = button?.textContent || 'Paste Clipboard';
  if (button && !options.isAuto) {
    button.disabled = true;
    button.textContent = 'Pasting…';
  }

  try {
    const text = await readClipboardTextSafe();
    if (!text) {
      if (button && !options.isAuto) button.textContent = 'No clipboard';
      return;
    }
    const urls = extractUrls(text);
    if (!urls.length) {
      if (button && !options.isAuto) button.textContent = 'No URL found';
      return;
    }

    const state = clipboardAutoPasteState.get(textarea);
    const signature = urls.join('|');
    if (options.isAuto && state && state.lastPastedSignature === signature) {
      return;
    }

    const result = mergeUrlsIntoTextarea(textarea, urls);
    if (state && result.added > 0) {
      state.lastPastedSignature = result.signature;
    }

    if (button) {
      if (result.added > 0) {
        button.textContent = options.isAuto ? `Pasted ${result.added}` : 'Pasted!';
      } else if (!options.isAuto) {
        button.textContent = 'Already pasted';
      }
    }

    if (
      options.isAuto &&
      result.added > 0 &&
      urls.some(isSupportedListingUrl) &&
      submitButton &&
      !submitButton.disabled
    ) {
      if (typeof form?.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        submitButton.click();
      }
    }
  } finally {
    if (button) {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
      }, 900);
    }
  }
}

function buildPayload(): Array<{ url: string; isMulti: boolean }> {
  const singleUrls = urlsInput ? extractUrls(urlsInput.value) : [];
  const multiUrls = multiUrlsInput ? extractUrls(multiUrlsInput.value) : [];
  const combined = [
    ...singleUrls.map((url) => ({ url, isMulti: false })),
    ...multiUrls.map((url) => ({ url, isMulti: true })),
  ];
  return combined.slice(0, MAX_URLS);
}

function renderRejected(rejected: Array<{ url: string; reason: string }>): void {
  if (!rejectedSection) return;
  const items = rejected.map(({ url, reason }) => `<li><strong>${url}</strong> — ${reason}</li>`);
  rejectedSection.innerHTML = `
    <h3>Rejected</h3>
    <ul>${items.join('')}</ul>
  `;
  rejectedSection.classList.remove('hidden');
}

async function handleSubmit(): Promise<void> {
  if (!urlsInput || !successSection || !successMessage || !errorSection) return;

  resetMessages();

  const payload = buildPayload();
  if (payload.length === 0) {
    errorSection.textContent = 'Please paste at least one valid Craigslist or Facebook Marketplace URL.';
    errorSection.classList.remove('hidden');
    return;
  }

  setLoading(true);

  const rejected: Array<{ url: string; reason: string }> = [];
  let acceptedTotal = 0;
  let anyBatchSucceeded = false;

  try {
    for (let start = 0; start < payload.length; start += BATCH_SIZE) {
      const batch = payload.slice(start, start + BATCH_SIZE);
      try {
        const response = await fetch('/api/listings/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ urls: batch }),
        });

        const data = (await response.json()) as SubmitResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to queue listings. Please try again.');
        }

        anyBatchSucceeded = true;
        acceptedTotal += data.accepted ?? 0;
        if (data.rejected && data.rejected.length > 0) {
          rejected.push(...data.rejected);
        }
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Unable to queue this batch. Please try again.';
        rejected.push(...batch.map((item) => ({ url: item.url, reason: message })));
      }
    }

    if (anyBatchSucceeded) {
      successMessage.textContent = `Queued ${acceptedTotal} listing${acceptedTotal === 1 ? '' : 's'}. Check your Google Sheet in a few minutes.`;
      successSection.classList.remove('hidden');
    } else {
      errorSection.textContent = 'Unable to queue listings. Please try again.';
      errorSection.classList.remove('hidden');
    }

    if (rejected.length > 0) {
      renderRejected(rejected);
    }
  } finally {
    setLoading(false);
    urlsInput.value = '';
    if (multiUrlsInput) multiUrlsInput.value = '';
  }
}
