// DOM elements
const brandSelect = document.getElementById('brand');
const serialInput = document.getElementById('serial');
const decodeButton = document.getElementById('decode-btn');
const inputSection = document.querySelector('.input-section');
const resultSection = document.getElementById('result');
const resultContent = document.getElementById('result-content');
const errorSection = document.getElementById('error');
const decodeButtonDefaultText = decodeButton.textContent?.trim() || 'Decode Serial Number';
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
        void handleDecode();
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
    void handleDecode();
}
async function handleDecode() {
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
        let result = null;
        try {
            result = await response.json();
        }
        catch {
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
        showError(errorMsg);
    }
    catch {
        showError('Unable to decode serial number.');
    }
    finally {
        setDecodingState(false);
    }
}
function setDecodingState(isLoading) {
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
    }
    else {
        decodeButton.textContent = decodeButtonDefaultText;
    }
}
function displayResult(info, decodeResult) {
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
    const context = decodeResult?.additionalContext;
    if (context && (context.summary || context.highlights.length || context.caveats.length || context.verificationTips.length)) {
        const contextDiv = document.createElement('div');
        contextDiv.className = 'additional-context';
        contextDiv.appendChild(buildContextHeading(context.title));
        if (context.summary) {
            contextDiv.appendChild(buildContextSection('Summary', [context.summary]));
        }
        if (context.highlights.length)
            contextDiv.appendChild(buildContextSection('Highlights', context.highlights));
        if (context.caveats.length)
            contextDiv.appendChild(buildContextSection('Caveats', context.caveats));
        if (context.verificationTips.length) {
            contextDiv.appendChild(buildContextSection('How to verify', context.verificationTips));
        }
        resultContent.appendChild(contextDiv);
    }
    resultSection.classList.remove('hidden');
    errorSection.classList.add('hidden');
    scrollToDecodeFeedback(resultSection);
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
    scrollToDecodeFeedback(errorSection);
}
function hideResults() {
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}
function hasRenderableDecodeInfo(info) {
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
function scrollToDecodeFeedback(element) {
    try {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    catch {
        // Ignore if scrolling API is unavailable.
    }
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function buildContextHeading(title) {
    const heading = document.createElement('h3');
    heading.className = 'additional-context-title';
    heading.textContent = title || 'Additional Context';
    return heading;
}
function buildContextSection(label, lines) {
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
export {};
