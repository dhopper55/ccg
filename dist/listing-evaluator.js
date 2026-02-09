import { initListingAuth } from './listing-auth.js?version=980318';
initListingAuth();
const MAX_URLS = 20;
const BATCH_SIZE = 5;
const form = document.getElementById('listing-form');
const urlsInput = document.getElementById('listing-urls');
const multiUrlsInput = document.getElementById('listing-urls-multi');
const submitButton = document.getElementById('listing-submit');
const successSection = document.getElementById('listing-success');
const successMessage = document.getElementById('listing-success-message');
const rejectedSection = document.getElementById('listing-rejected');
const errorSection = document.getElementById('listing-error');
const radarEnabledInput = document.getElementById('radar-enabled');
const radarStatus = document.getElementById('radar-status');
if (form && urlsInput && submitButton) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        void handleSubmit();
    });
}
if (radarEnabledInput) {
    radarEnabledInput.addEventListener('change', () => {
        void handleRadarSave();
    });
}
void loadRadarSettings();
function resetMessages() {
    if (successSection)
        successSection.classList.add('hidden');
    if (errorSection)
        errorSection.classList.add('hidden');
    if (rejectedSection)
        rejectedSection.classList.add('hidden');
    if (successMessage)
        successMessage.textContent = '';
    if (errorSection)
        errorSection.textContent = '';
    if (rejectedSection)
        rejectedSection.innerHTML = '';
}
function setLoading(isLoading) {
    if (!submitButton)
        return;
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Queuing…' : 'Queue Listings';
}
function setRadarStatus(message, isError = false) {
    if (!radarStatus)
        return;
    radarStatus.textContent = message;
    radarStatus.style.color = isError ? '#ffb1b1' : '';
}
async function loadRadarSettings() {
    if (!radarEnabledInput)
        return;
    try {
        const response = await fetch('/api/radar/settings');
        const data = await response.json();
        if (!response.ok)
            throw new Error(data?.message || 'Unable to load radar settings.');
        radarEnabledInput.checked = Boolean(data?.enabled);
        if (data?.lastSummary) {
            setRadarStatus(data.lastSummary);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load radar settings.';
        setRadarStatus(message, true);
    }
}
async function handleRadarSave() {
    if (!radarEnabledInput)
        return;
    setRadarStatus('Saving...');
    try {
        const response = await fetch('/api/radar/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: radarEnabledInput.checked,
            }),
        });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data?.message || 'Unable to save radar settings.');
        radarEnabledInput.checked = Boolean(data?.enabled);
        setRadarStatus('Saved.');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save radar settings.';
        setRadarStatus(message, true);
    }
}
function normalizeUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            return new URL(trimmed).toString();
        }
        catch {
            return null;
        }
    }
    if (/^(www\.|facebook\.com|m\.facebook\.com|craigslist\.)/i.test(trimmed)) {
        try {
            return new URL(`https://${trimmed}`).toString();
        }
        catch {
            return null;
        }
    }
    return null;
}
function extractUrls(input) {
    const matches = input.match(/https?:\/\/[^\s]+/gi) || [];
    const candidates = matches.length > 0 ? matches : input.split(/[\s,]+/g);
    const urls = [];
    for (const candidate of candidates) {
        const normalized = normalizeUrl(candidate);
        if (normalized)
            urls.push(normalized);
    }
    return Array.from(new Set(urls));
}
function buildPayload() {
    const singleUrls = urlsInput ? extractUrls(urlsInput.value) : [];
    const multiUrls = multiUrlsInput ? extractUrls(multiUrlsInput.value) : [];
    const combined = [
        ...singleUrls.map((url) => ({ url, isMulti: false })),
        ...multiUrls.map((url) => ({ url, isMulti: true })),
    ];
    return combined.slice(0, MAX_URLS);
}
function renderRejected(rejected) {
    if (!rejectedSection)
        return;
    const items = rejected.map(({ url, reason }) => `<li><strong>${url}</strong> — ${reason}</li>`);
    rejectedSection.innerHTML = `
    <h3>Rejected</h3>
    <ul>${items.join('')}</ul>
  `;
    rejectedSection.classList.remove('hidden');
}
async function handleSubmit() {
    if (!urlsInput || !successSection || !successMessage || !errorSection)
        return;
    resetMessages();
    const payload = buildPayload();
    if (payload.length === 0) {
        errorSection.textContent = 'Please paste at least one valid Craigslist or Facebook Marketplace URL.';
        errorSection.classList.remove('hidden');
        return;
    }
    setLoading(true);
    const rejected = [];
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
                const data = (await response.json());
                if (!response.ok) {
                    throw new Error(data.message || 'Unable to queue listings. Please try again.');
                }
                anyBatchSucceeded = true;
                acceptedTotal += data.accepted ?? 0;
                if (data.rejected && data.rejected.length > 0) {
                    rejected.push(...data.rejected);
                }
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Unable to queue this batch. Please try again.';
                rejected.push(...batch.map((item) => ({ url: item.url, reason: message })));
            }
        }
        if (anyBatchSucceeded) {
            successMessage.textContent = `Queued ${acceptedTotal} listing${acceptedTotal === 1 ? '' : 's'}. Check your Google Sheet in a few minutes.`;
            successSection.classList.remove('hidden');
        }
        else {
            errorSection.textContent = 'Unable to queue listings. Please try again.';
            errorSection.classList.remove('hidden');
        }
        if (rejected.length > 0) {
            renderRejected(rejected);
        }
    }
    finally {
        setLoading(false);
        urlsInput.value = '';
        if (multiUrlsInput)
            multiUrlsInput.value = '';
    }
}
