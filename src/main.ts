import { Brand, DecodeResult, GuitarInfo } from './types.js';
import { decodeGibson } from './decoders/gibson.js';
import { decodeEpiphone } from './decoders/epiphone.js';
import { decodeFender } from './decoders/fender.js';
import { decodeTaylor } from './decoders/taylor.js';
import { decodeMartin } from './decoders/martin.js';
import { decodeIbanez } from './decoders/ibanez.js';
import { decodeYamaha } from './decoders/yamaha.js';
import { decodePRS } from './decoders/prs.js';
import { decodeESP } from './decoders/esp.js';
import { decodeSchecter } from './decoders/schecter.js';
import { decodeGretsch } from './decoders/gretsch.js';
import { decodeJackson } from './decoders/jackson.js';
import { decodeSquier } from './decoders/squier.js';
import { decodeCort } from './decoders/cort.js';
import { decodeTakamine } from './decoders/takamine.js';
import { decodeWashburn } from './decoders/washburn.js';
import { decodeDean } from './decoders/dean.js';
import { decodeErnieBall } from './decoders/ernieball.js';
import { decodeGuild } from './decoders/guild.js';
import { decodeAlvarez } from './decoders/alvarez.js';
import { decodeGodin } from './decoders/godin.js';
import { decodeOvation } from './decoders/ovation.js';
import { decodeCharvel } from './decoders/charvel.js';
import { decodeRickenbacker } from './decoders/rickenbacker.js';
import { decodeKramer } from './decoders/kramer.js';

// Google Forms tracking configuration
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScjlmEiQzVNnyGJIfbHZa3clFz97UqR6VwOAzwgBID7k04f5w/formResponse';
const FORM_FIELDS = {
  brand: 'entry.1337294788',
  serial: 'entry.1296168262',
  success: 'entry.1111959987',
  year: 'entry.1354356712',
  factory: 'entry.1430981141',
  country: 'entry.193038505',
  error: 'entry.429448273',
  timestamp: 'entry.844467292',
};

// Track decode attempts to Google Forms (fire and forget)
function trackDecode(data: {
  brand: string;
  serial: string;
  success: boolean;
  year?: string;
  factory?: string;
  country?: string;
  error?: string;
}): void {
  const timestamp = new Date().toLocaleDateString('en-US');
  const params = new URLSearchParams();

  params.append(FORM_FIELDS.brand, data.brand || '');
  params.append(FORM_FIELDS.serial, data.serial || '');
  params.append(FORM_FIELDS.success, data.success ? 'true' : 'false');
  params.append(FORM_FIELDS.year, data.year || '');
  params.append(FORM_FIELDS.factory, data.factory || '');
  params.append(FORM_FIELDS.country, data.country || '');
  params.append(FORM_FIELDS.error, data.error || '');
  params.append(FORM_FIELDS.timestamp, timestamp);

  // Send as fire-and-forget using fetch with no-cors mode
  fetch(`${GOOGLE_FORM_URL}?${params.toString()}`, {
    method: 'GET',
    mode: 'no-cors',
  }).catch(() => {
    // Silently ignore errors - tracking should not affect user experience
  });
}

// Decoder mapping
const decoders: Record<Brand, (serial: string) => DecodeResult> = {
  gibson: decodeGibson,
  epiphone: decodeEpiphone,
  fender: decodeFender,
  taylor: decodeTaylor,
  martin: decodeMartin,
  ibanez: decodeIbanez,
  yamaha: decodeYamaha,
  prs: decodePRS,
  esp: decodeESP,
  schecter: decodeSchecter,
  gretsch: decodeGretsch,
  jackson: decodeJackson,
  squier: decodeSquier,
  cort: decodeCort,
  takamine: decodeTakamine,
  washburn: decodeWashburn,
  dean: decodeDean,
  ernieball: decodeErnieBall,
  guild: decodeGuild,
  alvarez: decodeAlvarez,
  godin: decodeGodin,
  ovation: decodeOvation,
  charvel: decodeCharvel,
  rickenbacker: decodeRickenbacker,
  kramer: decodeKramer,
};

// DOM elements
const brandSelect = document.getElementById('brand') as HTMLSelectElement | null;
const serialInput = document.getElementById('serial') as HTMLInputElement;
const decodeButton = document.getElementById('decode-btn') as HTMLButtonElement;
const resultSection = document.getElementById('result') as HTMLDivElement;
const resultContent = document.getElementById('result-content') as HTMLDivElement;
const errorSection = document.getElementById('error') as HTMLDivElement;

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
    handleDecode();
  }
});

initModals();

function handleDecode(): void {
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

  // Get the decoder for the selected brand
  const decoder = decoders[brand];
  if (!decoder) {
    showError('Unknown brand selected.');
    return;
  }

  // Decode the serial number
  let result = decoder(serial);
  let correctedSerial: string | null = null;

  // If Ibanez decode fails and the first character is a "1", retry as "I"
  if (!result.success && brand === 'ibanez' && serial.length >= 2 && serial[0] === '1') {
    const retrySerial = `I${serial.slice(1)}`.toUpperCase();
    const retryResult = decoder(retrySerial);
    if (retryResult.success && retryResult.info) {
      correctedSerial = retrySerial;
      retryResult.info.serialNumber = retrySerial;
      const correctionNote = `Serial number corrected from ${serial} to ${retrySerial} (leading "1" interpreted as "I").`;
      retryResult.info.notes = retryResult.info.notes
        ? `${retryResult.info.notes} ${correctionNote}`
        : correctionNote;
      result = retryResult;
      serialInput.value = retrySerial;
    }
  }

  if (result.success && result.info && isFutureYearResult(result.info)) {
    result = {
      success: false,
      error: 'Unable to decode this serial number.',
    };
  }

  if (result.success && result.info) {
    displayResult(result.info);
    // Track successful decode
    trackDecode({
      brand: result.info.brand || brand,
      serial: correctedSerial || serial,
      success: true,
      year: result.info.year,
      factory: result.info.factory,
      country: result.info.country,
    });
  } else {
    const errorMsg = result.error || 'Unable to decode serial number.';
    showError(errorMsg);
    // Track failed decode
    trackDecode({
      brand,
      serial,
      success: false,
      error: errorMsg,
    });
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
}

function hideResults(): void {
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isFutureYearResult(info: GuitarInfo): boolean {
  if (!info.year) {
    return false;
  }
  const years = extractYears(info.year);
  if (!years.length) {
    return false;
  }
  const currentYear = new Date().getFullYear();
  return years.some((year) => year > currentYear);
}

function extractYears(text: string): number[] {
  const matches = text.match(/\b\d{4}\b/g);
  if (!matches) {
    return [];
  }
  return matches.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
}
