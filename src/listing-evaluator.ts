type SubmitResponse = {
  accepted: number;
  rejected?: Array<{ url: string; reason: string }>;
  queued?: Array<{ url: string; source?: string; jobId?: string }>;
  message?: string;
};

export {};

const MAX_URLS = 20;

const form = document.getElementById('listing-form') as HTMLFormElement | null;
const urlsInput = document.getElementById('listing-urls') as HTMLTextAreaElement | null;
const submitButton = document.getElementById('listing-submit') as HTMLButtonElement | null;
const successSection = document.getElementById('listing-success') as HTMLDivElement | null;
const successMessage = document.getElementById('listing-success-message') as HTMLParagraphElement | null;
const rejectedSection = document.getElementById('listing-rejected') as HTMLDivElement | null;
const errorSection = document.getElementById('listing-error') as HTMLDivElement | null;

if (form && urlsInput && submitButton) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSubmit();
  });
}

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

  const urls = extractUrls(urlsInput.value).slice(0, MAX_URLS);
  if (urls.length === 0) {
    errorSection.textContent = 'Please paste at least one valid Craigslist or Facebook Marketplace URL.';
    errorSection.classList.remove('hidden');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/listings/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    const data = (await response.json()) as SubmitResponse;

    if (!response.ok) {
      throw new Error(data.message || 'Unable to queue listings. Please try again.');
    }

    const accepted = data.accepted ?? 0;
    successMessage.textContent = `Queued ${accepted} listing${accepted === 1 ? '' : 's'}. Check your Google Sheet in a few minutes.`;
    successSection.classList.remove('hidden');

    if (data.rejected && data.rejected.length > 0) {
      renderRejected(data.rejected);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    errorSection.textContent = message;
    errorSection.classList.remove('hidden');
  } finally {
    setLoading(false);
  }
}
