import { decodeGibson } from './decoders/gibson.js?version=917338';
import { decodeEpiphone } from './decoders/epiphone.js?version=262979';
import { decodeFender } from './decoders/fender.js?version=411815';
import { decodeTaylor } from './decoders/taylor.js?version=678368';
import { decodeMartin } from './decoders/martin.js?version=695834';
import { decodeIbanez } from './decoders/ibanez.js?version=248304';
import { decodeYamaha } from './decoders/yamaha.js?version=952461';
import { decodePRS } from './decoders/prs.js?version=790194';
import { decodeESP } from './decoders/esp.js?version=188311';
import { decodeSchecter } from './decoders/schecter.js?version=187652';
import { decodeGretsch } from './decoders/gretsch.js?version=232391';
import { decodeJackson } from './decoders/jackson.js?version=406866';
import { decodeSquier } from './decoders/squier.js?version=126188';
import { decodeCort } from './decoders/cort.js?version=165226';
import { decodeTakamine } from './decoders/takamine.js?version=112324';
import { decodeWashburn } from './decoders/washburn.js?version=141474';
import { decodeDean } from './decoders/dean.js?version=932781';
import { decodeErnieBall } from './decoders/ernieball.js?version=707110';
import { decodeGuild } from './decoders/guild.js?version=441239';
import { decodeAlvarez } from './decoders/alvarez.js?version=638619';
import { decodeGodin } from './decoders/godin.js?version=699990';
import { decodeOvation } from './decoders/ovation.js?version=823009';
import { decodeCharvel } from './decoders/charvel.js?version=988463';
import { decodeRickenbacker } from './decoders/rickenbacker.js?version=961802';
import { decodeKramer } from './decoders/kramer.js?version=253470';
import { decodeBCRich } from './decoders/bcrich.js?version=672169';
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
    bcrich: decodeBCRich,
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
initModals();
initQueryParamDecode();
function initQueryParamDecode() {
    const params = new URLSearchParams(window.location.search);
    const serial = params.get('serial');
    if (!serial)
        return;
    const trimmed = serial.trim();
    if (!trimmed)
        return;
    serialInput.value = trimmed;
    handleDecode();
}
function handleDecode() {
    // Use preselected brand if no dropdown exists, otherwise get from dropdown
    const brand = preselectedBrand || (brandSelect ? brandSelect.value : '');
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
    let correctedSerial = null;
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
function initModals() {
    const triggers = document.querySelectorAll('[data-modal-target]');
    if (!triggers.length) {
        return;
    }
    const openModal = (modal, trigger) => {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        const focusTarget = modal.querySelector('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (focusTarget) {
            focusTarget.focus();
        }
        if (trigger) {
            modal.dataset.modalTriggerId = trigger.id || '';
        }
    };
    const closeModal = (modal) => {
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
        const modal = document.getElementById(targetId);
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
        const closeTargets = modal.querySelectorAll('[data-modal-close]');
        closeTargets.forEach((el) => {
            el.addEventListener('click', () => closeModal(modal));
        });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        const openModalEl = document.querySelector('.decoder-modal:not(.hidden)');
        if (openModalEl) {
            closeModal(openModalEl);
        }
    });
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
function isFutureYearResult(info) {
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
function extractYears(text) {
    const matches = text.match(/\b\d{4}\b/g);
    if (!matches) {
        return [];
    }
    return matches.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
}
