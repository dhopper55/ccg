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
const failedDecodeEmailPrompt =
  'Coal Creek Guitars logs all serial number decode attempts for all brands. Since this decode failed, we will automatically research the number in the coming days and if we find out it is in fact a valid serial number, we will update the decoder. If you would like us to email you in the event that this number is valid, please enter your email below and click submit.';

type FailedDecodeEmailContext = {
  decodeEventId: number | null;
  brand: Brand;
  serial: string;
};

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
        displayResult(result.info, result);
        return;
      }
      showError('Unable to decode serial number.');
      return;
    }

    const errorMsg = (result && result.error) || 'Unable to decode serial number.';
    showError(errorMsg, {
      decodeEventId: typeof result?.serialDecodeEventId === 'number' ? result.serialDecodeEventId : null,
      brand,
      serial,
    });
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

function displayResult(info: GuitarInfo, decodeResult?: DecodeResult): void {
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

  const richText = (decodeResult?.additionalContextRichText || '').trim();
  if (richText) {
    const item = document.createElement('div');
    item.className = 'result-item result-item-addtl';
    item.innerHTML = `
      <span class="result-label">Addtl. Info</span>
      <span class="result-value"></span>
    `;
    const content = document.createElement('div');
    content.className = 'result-item-addtl-content';
    content.appendChild(buildRichTextContext(richText));
    item.appendChild(content);
    resultContent.appendChild(item);
  }

  if (info.notes) {
    const item = document.createElement('div');
    item.className = 'result-item result-item-notes';
    item.innerHTML = `
      <span class="result-label">Notes</span>
      <span class="result-value"></span>
      <div class="result-item-notes-content">
        <p class="result-notes-text">${escapeHtml(info.notes).replace(/\r?\n/g, '<br>')}</p>
      </div>
    `;
    resultContent.appendChild(item);
  }

  const context = decodeResult?.additionalContext;
  if (!richText && context && (context.summary || context.highlights.length || context.caveats.length || context.verificationTips.length)) {
    const contextDiv = document.createElement('div');
    contextDiv.className = 'additional-context';
    contextDiv.appendChild(buildContextHeading(context.title));
    if (context.summary) {
      contextDiv.appendChild(buildContextSection('Summary', [context.summary]));
    }
    if (context.highlights.length) contextDiv.appendChild(buildContextSection('Highlights', context.highlights));
    if (context.caveats.length) contextDiv.appendChild(buildContextSection('Caveats', context.caveats));
    if (context.verificationTips.length) {
      contextDiv.appendChild(buildContextSection('How to verify', context.verificationTips));
    }
    resultContent.appendChild(contextDiv);
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

function showError(message: string, emailContext?: FailedDecodeEmailContext): void {
  errorSection.innerHTML = '';
  const messageElement = document.createElement('p');
  messageElement.className = 'decode-error-message';
  messageElement.textContent = message;
  errorSection.appendChild(messageElement);
  if (emailContext) {
    errorSection.appendChild(buildFailedDecodeEmailCapture(emailContext));
  }
  errorSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  scrollToDecodeFeedback(errorSection);
}

function hideResults(): void {
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  errorSection.innerHTML = '';
}

function buildFailedDecodeEmailCapture(context: FailedDecodeEmailContext): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'failed-decode-email-capture';

  const prompt = document.createElement('p');
  prompt.textContent = failedDecodeEmailPrompt;
  wrapper.appendChild(prompt);

  const form = document.createElement('form');
  form.className = 'failed-decode-email-form';
  form.noValidate = true;

  const input = document.createElement('input');
  input.type = 'email';
  input.name = 'email';
  input.placeholder = 'Email address';
  input.maxLength = 200;
  input.required = true;

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Submit';

  const feedback = document.createElement('p');
  feedback.className = 'failed-decode-email-feedback';

  form.appendChild(input);
  form.appendChild(button);
  wrapper.appendChild(form);
  wrapper.appendChild(feedback);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitFailedDecodeEmail(context, input, button, feedback);
  });

  return wrapper;
}

async function submitFailedDecodeEmail(
  context: FailedDecodeEmailContext,
  input: HTMLInputElement,
  button: HTMLButtonElement,
  feedback: HTMLParagraphElement,
): Promise<void> {
  const email = input.value.trim().toLowerCase();
  feedback.classList.remove('is-success', 'is-error');
  feedback.textContent = '';

  if (!context.decodeEventId) {
    feedback.classList.add('is-error');
    feedback.textContent = 'Unable to attach email to this decode record.';
    return;
  }
  if (!isValidEmailAddress(email)) {
    feedback.classList.add('is-error');
    feedback.textContent = 'Enter a valid email address.';
    return;
  }

  input.disabled = true;
  button.disabled = true;
  button.textContent = 'Submitting...';
  try {
    const response = await fetch('/api/decode/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        decodeEventId: context.decodeEventId,
        brand: context.brand,
        serial: context.serial,
        email,
      }),
    });
    const result = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      throw new Error(result?.message || 'Unable to submit email address.');
    }
    input.value = email;
    feedback.classList.add('is-success');
    feedback.textContent = 'Email submitted. We will follow up if this serial number is verified.';
  } catch (error) {
    input.disabled = false;
    button.disabled = false;
    feedback.classList.add('is-error');
    feedback.textContent = error instanceof Error ? error.message : 'Unable to submit email address.';
  } finally {
    button.textContent = 'Submit';
  }
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 200;
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

function buildContextHeading(title: string): HTMLElement {
  const heading = document.createElement('h3');
  heading.className = 'additional-context-title';
  heading.textContent = title || 'Additional Context';
  return heading;
}

function buildContextSection(label: string, lines: string[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'additional-context-section';

  const title = document.createElement('strong');
  title.className = 'additional-context-section-title';
  title.textContent = label;
  section.appendChild(title);

  if (lines.length === 1) {
    const p = document.createElement('p');
    p.className = 'additional-context-summary';
    p.textContent = lines[0];
    section.appendChild(p);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'additional-context-list';
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

function buildRichTextContext(text: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'additional-context-richtext';
  const hasHtml = /<\s*[a-z][^>]*>/i.test(text);
  if (hasHtml) {
    container.innerHTML = sanitizeAdditionalContextHtmlClient(text);
    return container;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    const p = document.createElement('p');
    p.className = 'additional-context-summary';
    p.textContent = text;
    container.appendChild(p);
    return container;
  }

  let currentList: HTMLUListElement | null = null;
  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList) {
        currentList = document.createElement('ul');
        currentList.className = 'additional-context-list';
        container.appendChild(currentList);
      }
      const li = document.createElement('li');
      li.textContent = bulletMatch[1];
      currentList.appendChild(li);
      continue;
    }

    currentList = null;
    const p = document.createElement('p');
    p.className = 'additional-context-summary';
    p.textContent = line;
    container.appendChild(p);
  }

  return container;
}

function sanitizeAdditionalContextHtmlClient(input: string): string {
  const template = document.createElement('template');
  template.innerHTML = input;
  const allowedTags = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'A', 'H3', 'H4', 'BLOCKQUOTE']);

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (!allowedTags.has(tag)) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return;
      }

      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (tag === 'A' && name === 'href') return;
        el.removeAttribute(attr.name);
      });

      if (tag === 'A') {
        const href = (el.getAttribute('href') || '').trim();
        if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
          el.setAttribute('href', '#');
        }
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }

    Array.from(node.childNodes).forEach((child) => walk(child));
  };

  walk(template.content);
  return template.innerHTML;
}
