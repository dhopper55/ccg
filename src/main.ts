import { Brand, DecodeResult, GuitarInfo } from './types.js';

// DOM elements
const brandSelect = document.getElementById('brand') as HTMLSelectElement | null;
const serialInput = document.getElementById('serial') as HTMLInputElement;
const decodeButton = document.getElementById('decode-btn') as HTMLButtonElement;
const inputSection = document.querySelector('.input-section') as HTMLDivElement | null;
const resultSection = document.getElementById('result') as HTMLDivElement;
const resultContent = document.getElementById('result-content') as HTMLDivElement;
const errorSection = document.getElementById('error') as HTMLDivElement;
const decodeButtonDefaultText = decodeButton.textContent?.trim() || 'Decode Serial Number';

// Check for pre-selected brand from data attribute (used on brand-specific pages without dropdown)
const preselectedBrand = document.body.dataset.preselectBrand as Brand | undefined;

// If there's a dropdown and a preselected brand, set it
if (preselectedBrand && brandSelect) {
  brandSelect.value = preselectedBrand;
}

// Event listeners
decodeButton.addEventListener('click', handleDecode);
serialInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    void handleDecode();
  }
});

initModals();
initQueryParamDecode();

function initQueryParamDecode(): void {
  const params = new URLSearchParams(window.location.search);
  const serial = params.get('serial');
  if (!serial) return;
  const trimmed = serial.trim();
  if (!trimmed) return;
  serialInput.value = trimmed;
  void handleDecode();
}

async function handleDecode(): Promise<void> {
  // Use preselected brand if no dropdown exists, otherwise get from dropdown
  const brand: Brand | '' = preselectedBrand || (brandSelect ? brandSelect.value as Brand | '' : '');
  const serial = serialInput.value.trim();

  // Clear previous results
  hideResults();

  // Validate serial input
  if (!serial) {
    showError('Please enter a serial number.');
    return;
  }

  // Validate brand is selected
  if (!brand) {
    showError('Please select a brand.');
    return;
  }

  setDecodingState(true);
  try {
    const response = await fetch('/api/decode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand,
        serial,
        pagePath: window.location.pathname,
        userAgent: navigator.userAgent,
        clientTimestamp: new Date().toString(),
      }),
    });

    let result: DecodeResult | null = null;
    try {
      result = await response.json() as DecodeResult;
    } catch {
      result = null;
    }

    if (result && result.success && result.info) {
      if (hasRenderableDecodeInfo(result.info)) {
        if (result.info.serialNumber) {
          serialInput.value = result.info.serialNumber;
        }
        displayResult(result.info);
        return;
      }
      showError('Unable to decode serial number.');
      return;
    }

    const errorMsg = (result && result.error) || 'Unable to decode serial number.';
    showError(errorMsg);
  } catch {
    showError('Unable to decode serial number.');
  } finally {
    setDecodingState(false);
  }
}

function setDecodingState(isLoading: boolean): void {
  if (inputSection) {
    inputSection.classList.toggle('is-loading', isLoading);
    inputSection.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  const controls = [brandSelect, serialInput, decodeButton];
  controls.forEach((control) => {
    if (control) {
      control.disabled = isLoading;
    }
  });

  if (isLoading) {
    decodeButton.innerHTML = '<span class="button-loading-spinner" aria-hidden="true"></span>Decoding...';
  } else {
    decodeButton.textContent = decodeButtonDefaultText;
  }
}

function displayResult(info: GuitarInfo): void {
  resultContent.innerHTML = '';

  // Update the result heading to include brand name
  const resultHeading = resultSection.querySelector('h2');
  if (resultHeading && info.brand) {
    resultHeading.textContent = `${info.brand} Guitar Info`;
  }

  // Fields to display (excluding Brand since it's in the heading now)
  const fields: { label: string; value: string | undefined }[] = [
    { label: 'Serial Number', value: info.serialNumber },
    { label: 'Year', value: info.year },
    { label: 'Month', value: info.month },
    { label: 'Day', value: info.day },
    { label: 'Model', value: info.model },
    { label: 'Factory', value: info.factory },
    { label: 'Country', value: info.country },
  ];

  for (const field of fields) {
    if (field.value) {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <span class="result-label">${field.label}</span>
        <span class="result-value">${escapeHtml(field.value)}</span>
      `;
      resultContent.appendChild(item);
    }
  }

  // Add notes if present
  if (info.notes) {
    const notesDiv = document.createElement('div');
    notesDiv.className = 'notes';
    notesDiv.innerHTML = `<strong>Notes:</strong> ${escapeHtml(info.notes)}`;
    resultContent.appendChild(notesDiv);
  }

  resultSection.classList.remove('hidden');
  errorSection.classList.add('hidden');
  scrollToDecodeFeedback(resultSection);
}

function initModals(): void {
  const triggers = document.querySelectorAll<HTMLElement>('[data-modal-target]');
  if (!triggers.length) {
    return;
  }

  const openModal = (modal: HTMLElement, trigger?: HTMLElement) => {
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    const focusTarget = modal.querySelector<HTMLElement>(
      'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusTarget) {
      focusTarget.focus();
    }
    if (trigger) {
      modal.dataset.modalTriggerId = trigger.id || '';
    }
  };

  const closeModal = (modal: HTMLElement) => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    const triggerId = modal.dataset.modalTriggerId;
    if (triggerId) {
      const trigger = document.getElementById(triggerId);
      if (trigger) {
        trigger.focus();
      }
    }
    modal.dataset.modalTriggerId = '';
  };

  triggers.forEach((trigger, index) => {
    const targetId = trigger.getAttribute('data-modal-target');
    if (!targetId) {
      return;
    }

    const modal = document.getElementById(targetId) as HTMLElement | null;
    if (!modal) {
      return;
    }

    if (!trigger.id) {
      trigger.id = `modal-trigger-${index}`;
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(modal, trigger);
    });

    const closeTargets = modal.querySelectorAll<HTMLElement>('[data-modal-close]');
    closeTargets.forEach((el) => {
      el.addEventListener('click', () => closeModal(modal));
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    const openModalEl = document.querySelector<HTMLElement>('.decoder-modal:not(.hidden)');
    if (openModalEl) {
      closeModal(openModalEl);
    }
  });
}

function showError(message: string): void {
  errorSection.textContent = message;
  errorSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  scrollToDecodeFeedback(errorSection);
}

function hideResults(): void {
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');
}

function hasRenderableDecodeInfo(info: GuitarInfo): boolean {
  const fields = [
    info.year,
    info.month,
    info.day,
    info.model,
    info.factory,
    info.country,
    info.notes,
  ];
  return fields.some((value) => Boolean(value && value.trim().length > 0));
}

function scrollToDecodeFeedback(element: HTMLElement): void {
  try {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    // Ignore if scrolling API is unavailable.
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
