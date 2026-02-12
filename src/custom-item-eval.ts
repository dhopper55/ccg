export {};

type CustomSubmitResponse = {
  ok?: boolean;
  recordId?: string;
  status?: string;
  message?: string;
};

type StatusResponse = {
  ok?: boolean;
  id?: string;
  status?: string;
  message?: string;
};

const MAX_PHOTOS = 10;
const MAX_TEXT_LENGTH = 5000;
const POLL_INTERVAL_MS = 2000;

const form = document.getElementById('custom-item-form') as HTMLFormElement | null;
const photosInput = document.getElementById('custom-item-photos') as HTMLInputElement | null;
const detailsInput = document.getElementById('custom-item-details') as HTMLTextAreaElement | null;
const goButton = document.getElementById('custom-item-submit') as HTMLButtonElement | null;
const statusSection = document.getElementById('custom-item-status') as HTMLDivElement | null;
const statusText = document.getElementById('custom-item-status-text') as HTMLParagraphElement | null;
const errorSection = document.getElementById('custom-item-error') as HTMLDivElement | null;
const photosHelp = document.getElementById('custom-item-photos-help') as HTMLParagraphElement | null;
const countText = document.getElementById('custom-item-count') as HTMLParagraphElement | null;

let activeRecordId: string | null = null;

if (form && photosInput && detailsInput && goButton) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSubmit();
  });

  photosInput.addEventListener('change', () => {
    validatePhotoSelection();
  });

  detailsInput.addEventListener('input', () => {
    const length = detailsInput.value.length;
    if (countText) countText.textContent = `${length}/${MAX_TEXT_LENGTH} characters`;
  });
}

function setLoading(isLoading: boolean): void {
  if (goButton) {
    goButton.disabled = isLoading;
    goButton.textContent = isLoading ? 'Processing…' : 'Go';
  }
  if (photosInput) photosInput.disabled = isLoading;
  if (detailsInput) detailsInput.disabled = isLoading;
}

function clearStatus(): void {
  if (errorSection) {
    errorSection.classList.add('hidden');
    errorSection.textContent = '';
  }
  if (statusSection) statusSection.classList.add('hidden');
  if (statusText) statusText.textContent = '';
}

function showError(message: string): void {
  if (!errorSection) return;
  errorSection.textContent = message;
  errorSection.classList.remove('hidden');
}

function setStatus(message: string): void {
  if (!statusSection || !statusText) return;
  statusText.textContent = message;
  statusSection.classList.remove('hidden');
}

function validatePhotoSelection(): boolean {
  if (!photosInput) return false;
  const count = photosInput.files?.length ?? 0;
  if (photosHelp) {
    photosHelp.textContent = count > 0
      ? `${count}/${MAX_PHOTOS} selected`
      : 'Take clear photos in good lighting that show all parts of the item.';
  }
  if (count > MAX_PHOTOS) {
    showError(`You can upload up to ${MAX_PHOTOS} photos.`);
    return false;
  }
  return count > 0;
}

async function pollUntilComplete(recordId: string): Promise<void> {
  activeRecordId = recordId;
  while (activeRecordId === recordId) {
    const response = await fetch(`/api/custom-items/status?id=${encodeURIComponent(recordId)}`);
    const data = (await response.json()) as StatusResponse;
    if (!response.ok) {
      throw new Error(data?.message || 'Unable to check processing status.');
    }
    const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
    if (status === 'complete') {
      window.location.href = `listing-evaluator-item?id=${encodeURIComponent(recordId)}`;
      return;
    }
    if (status === 'failed') {
      throw new Error('Processing failed. Please re-submit and try again.');
    }
    setStatus('Processing your item…');
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function handleSubmit(): Promise<void> {
  if (!photosInput || !detailsInput) return;

  clearStatus();
  const details = detailsInput.value.trim();
  if (!details) {
    showError('"What is it?" is required.');
    return;
  }
  if (details.length > MAX_TEXT_LENGTH) {
    showError(`Please keep the description under ${MAX_TEXT_LENGTH} characters.`);
    return;
  }
  if (!validatePhotoSelection()) {
    showError('At least one photo is required.');
    return;
  }

  const files = Array.from(photosInput.files || []);
  if (files.length < 1 || files.length > MAX_PHOTOS) {
    showError(`Please upload between 1 and ${MAX_PHOTOS} photos.`);
    return;
  }

  const formData = new FormData();
  formData.set('whatIsIt', details);
  files.forEach((file) => formData.append('photos', file));

  setLoading(true);
  setStatus('Uploading photos…');

  try {
    const response = await fetch('/api/custom-items/submit', {
      method: 'POST',
      body: formData,
    });
    const data = (await response.json()) as CustomSubmitResponse;
    if (!response.ok || !data.recordId) {
      throw new Error(data?.message || 'Unable to submit custom item.');
    }

    setStatus('Queued. Running AI evaluation…');
    await pollUntilComplete(data.recordId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process custom item.';
    showError(message);
  } finally {
    setLoading(false);
  }
}
