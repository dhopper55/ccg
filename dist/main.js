import { decodeGibson } from './decoders/gibson.js';
import { decodeEpiphone } from './decoders/epiphone.js';
import { decodeFender } from './decoders/fender.js';
import { decodeTaylor } from './decoders/taylor.js';
import { decodeMartin } from './decoders/martin.js';
import { decodeIbanez } from './decoders/ibanez.js';
import { detectBrand } from './decoders/brandDetector.js';
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
function trackDecode(data) {
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
const decoders = {
    gibson: decodeGibson,
    epiphone: decodeEpiphone,
    fender: decodeFender,
    taylor: decodeTaylor,
    martin: decodeMartin,
    ibanez: decodeIbanez,
};
// DOM elements
const brandSelect = document.getElementById('brand');
const serialInput = document.getElementById('serial');
const decodeButton = document.getElementById('decode-btn');
const resultSection = document.getElementById('result');
const resultContent = document.getElementById('result-content');
const errorSection = document.getElementById('error');
// Check for pre-selected brand from data attribute (used on brand-specific pages without dropdown)
const preselectedBrand = document.body.dataset.preselectBrand;
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
function handleDecode() {
    // Use preselected brand if no dropdown exists, otherwise get from dropdown
    let brand = preselectedBrand || (brandSelect ? brandSelect.value : '');
    const serial = serialInput.value.trim();
    // Clear previous results
    hideResults();
    // Validate serial input
    if (!serial) {
        showError('Please enter a serial number.');
        return;
    }
    // If no brand selected/preselected, try to auto-detect
    if (!brand) {
        const detection = detectBrand(serial);
        if (detection.confident && detection.possibleBrands.length === 1) {
            // We're confident in the brand, use it
            brand = detection.possibleBrands[0];
        }
        else if (detection.possibleBrands.length === 0) {
            // Couldn't identify any brand
            showError(detection.message || 'Unable to identify the brand from this serial number. Please select a brand manually.');
            return;
        }
        else {
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
        // Track successful decode
        trackDecode({
            brand: result.info.brand || brand,
            serial,
            success: true,
            year: result.info.year,
            factory: result.info.factory,
            country: result.info.country,
        });
    }
    else {
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
function displayResult(info) {
    resultContent.innerHTML = '';
    // Update the result heading to include brand name
    const resultHeading = resultSection.querySelector('h2');
    if (resultHeading && info.brand) {
        resultHeading.textContent = `${info.brand} Guitar Info`;
    }
    // Fields to display (excluding Brand since it's in the heading now)
    const fields = [
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
function showAmbiguousResult(possibleBrands, serial) {
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
            if (brandSelect) {
                brandSelect.value = brand;
            }
            handleDecode();
        });
        buttonContainer.appendChild(button);
    }
    resultContent.appendChild(buttonContainer);
    resultSection.classList.remove('hidden');
    errorSection.classList.add('hidden');
}
function showError(message) {
    errorSection.textContent = message;
    errorSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
}
function hideResults() {
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
