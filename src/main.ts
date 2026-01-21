import { Brand, DecodeResult, GuitarInfo } from './types.js';
import { decodeGibson } from './decoders/gibson.js';
import { decodeEpiphone } from './decoders/epiphone.js';
import { decodeFender } from './decoders/fender.js';
import { decodeTaylor } from './decoders/taylor.js';
import { decodeMartin } from './decoders/martin.js';
import { detectBrand } from './decoders/brandDetector.js';

// Decoder mapping
const decoders: Record<Brand, (serial: string) => DecodeResult> = {
  gibson: decodeGibson,
  epiphone: decodeEpiphone,
  fender: decodeFender,
  taylor: decodeTaylor,
  martin: decodeMartin,
};

// DOM elements
const brandSelect = document.getElementById('brand') as HTMLSelectElement;
const serialInput = document.getElementById('serial') as HTMLInputElement;
const decodeButton = document.getElementById('decode-btn') as HTMLButtonElement;
const resultSection = document.getElementById('result') as HTMLDivElement;
const resultContent = document.getElementById('result-content') as HTMLDivElement;
const errorSection = document.getElementById('error') as HTMLDivElement;

// Check for pre-selected brand from data attribute
const preselectedBrand = document.body.dataset.preselectBrand;
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

function handleDecode(): void {
  let brand = brandSelect.value as Brand | '';
  const serial = serialInput.value.trim();

  // Clear previous results
  hideResults();

  // Validate serial input
  if (!serial) {
    showError('Please enter a serial number.');
    return;
  }

  // If no brand selected, try to auto-detect
  if (!brand) {
    const detection = detectBrand(serial);

    if (detection.confident && detection.possibleBrands.length === 1) {
      // We're confident in the brand, use it
      brand = detection.possibleBrands[0];
    } else if (detection.possibleBrands.length === 0) {
      // Couldn't identify any brand
      showError(detection.message || 'Unable to identify the brand from this serial number. Please select a brand manually.');
      return;
    } else {
      // Multiple possible brands - show ambiguity message
      showAmbiguousResult(detection.possibleBrands, serial);
      return;
    }
  }

  // Get the decoder for the selected/detected brand
  const decoder = decoders[brand];
  if (!decoder) {
    showError('Unknown brand selected.');
    return;
  }

  // Decode the serial number
  const result = decoder(serial);

  if (result.success && result.info) {
    displayResult(result.info);
  } else {
    showError(result.error || 'Unable to decode serial number.');
  }
}

function displayResult(info: GuitarInfo): void {
  resultContent.innerHTML = '';

  const fields: { label: string; value: string | undefined }[] = [
    { label: 'Brand', value: info.brand },
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

function showAmbiguousResult(possibleBrands: Brand[], serial: string): void {
  resultContent.innerHTML = '';

  // Create heading
  const heading = document.createElement('div');
  heading.className = 'result-item';
  heading.innerHTML = `
    <span class="result-label">Serial Number</span>
    <span class="result-value">${escapeHtml(serial)}</span>
  `;
  resultContent.appendChild(heading);

  // Create message about ambiguity
  const messageDiv = document.createElement('div');
  messageDiv.className = 'notes';
  messageDiv.innerHTML = `
    <strong>Multiple brands possible:</strong> This serial number format could belong to multiple brands.
    Please select the correct brand from the dropdown to get accurate results.
  `;
  resultContent.appendChild(messageDiv);

  // Create buttons for each possible brand
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'brand-buttons';
  buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap;';

  for (const brand of possibleBrands) {
    const button = document.createElement('button');
    button.className = 'brand-option-btn';
    button.textContent = brand.charAt(0).toUpperCase() + brand.slice(1);
    button.style.cssText = `
      padding: 10px 20px;
      background: rgba(245, 166, 35, 0.2);
      border: 1px solid #f5a623;
      border-radius: 6px;
      color: #f5a623;
      cursor: pointer;
      font-size: 0.95rem;
      transition: background 0.2s;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(245, 166, 35, 0.4)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(245, 166, 35, 0.2)';
    });
    button.addEventListener('click', () => {
      brandSelect.value = brand;
      handleDecode();
    });
    buttonContainer.appendChild(button);
  }

  resultContent.appendChild(buttonContainer);

  resultSection.classList.remove('hidden');
  errorSection.classList.add('hidden');
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
