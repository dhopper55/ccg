const titleEl = document.getElementById('listing-item-title');
const metaEl = document.getElementById('listing-item-meta');
const descriptionEl = document.getElementById('listing-item-description');
const aiEl = document.getElementById('listing-item-ai');
const aiTitleEl = document.getElementById('listing-item-ai-title');
const singleBlockEl = document.getElementById('listing-item-single-block');
const singleEl = document.getElementById('listing-item-single');
const multiBlockEl = document.getElementById('listing-item-multi-block');
const multiEl = document.getElementById('listing-item-multi');
const openLink = document.getElementById('listing-item-open');
const errorSection = document.getElementById('listing-item-error');
const archiveButton = document.getElementById('listing-item-archive');
const archiveLabel = archiveButton?.querySelector('.archive-label');
const mediaEl = document.getElementById('listing-item-media');
const thumbnailEl = document.getElementById('listing-item-thumbnail');
const copyButton = document.getElementById('listing-item-copy');
const doubleCheckButton = document.getElementById('listing-item-double-check');
let currentRecordId = null;
let isArchiving = false;
const BUILD_TAG = '2026-02-05a';
const SINGLE_FIELDS = [
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'finish', label: 'Finish' },
    { key: 'year', label: 'Year' },
    { key: 'condition', label: 'Condition' },
    { key: 'serial', label: 'Serial' },
    { key: 'serial_brand', label: 'Serial Brand' },
    { key: 'serial_year', label: 'Serial Year' },
    { key: 'serial_model', label: 'Serial Model' },
    { key: 'value_private_party_low', label: 'Private Party Low', currency: true },
    { key: 'value_private_party_medium', label: 'Private Party Medium', currency: true },
    { key: 'value_private_party_high', label: 'Private Party High', currency: true },
    { key: 'value_pawn_shop_notes', label: 'Pawn Shop Notes' },
    { key: 'value_online_notes', label: 'Online Marketplace Notes' },
    { key: 'known_weak_points', label: 'Known Weak Points' },
    { key: 'typical_repair_needs', label: 'Typical Repair Needs' },
    { key: 'buyers_worry', label: 'Buyer Worries' },
    { key: 'og_specs_pickups', label: 'Original Pickups' },
    { key: 'og_specs_tuners', label: 'Original Tuners' },
    { key: 'og_specs_common_mods', label: 'Common Mods' },
    { key: 'buyer_what_to_check', label: 'Buyer: What to Check' },
    { key: 'buyer_common_misrepresent', label: 'Buyer: Common Misrepresentation' },
    { key: 'seller_how_to_price_realistic', label: 'Seller: Price Realistically' },
    { key: 'seller_fixes_add_value_or_waste', label: 'Seller: Fixes That Add Value or Waste' },
    { key: 'seller_as_is_notes', label: 'Seller: As-Is Notes' },
];
function formatMountainTimestamp(date) {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Denver',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Denver',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const datePart = dateFormatter.format(date);
    const timeParts = timeFormatter.formatToParts(date);
    const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '';
    const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '';
    const dayPeriod = timeParts.find((part) => part.type === 'dayPeriod')?.value ?? '';
    const timePart = hour && minute && dayPeriod ? `${hour}:${minute}${dayPeriod}` : timeFormatter.format(date).replace(' ', '');
    return `${datePart} ${timePart} MST`;
}
function formatSubmittedAt(value) {
    if (value == null)
        return '—';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return '—';
        if (!trimmed.includes('T') && /\\b(MST|MDT|MT)\\b/i.test(trimmed))
            return trimmed;
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime()))
            return formatMountainTimestamp(parsed);
        return trimmed;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatMountainTimestamp(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return formatMountainTimestamp(new Date(value));
    }
    return String(value);
}
function formatSourceLabel(value) {
    const raw = normalizeValue(value);
    if (raw === '—')
        return raw;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook'))
        return 'FBM';
    if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist'))
        return 'CG';
    return raw;
}
function formatCurrencyValue(value) {
    if (value == null)
        return '—';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return '—';
        if (trimmed.includes('$'))
            return trimmed;
        const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(numeric)) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
        }
        return trimmed;
    }
    return String(value);
}
function formatScoreValue(value) {
    const raw = normalizeValue(value);
    if (raw === '—')
        return raw;
    if (raw.includes('/10'))
        return raw;
    const numeric = Number.parseInt(raw, 10);
    if (Number.isFinite(numeric))
        return `${numeric}/10`;
    return raw;
}
function getRecordId() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const itemIndex = parts.indexOf('listing-evaluator-item');
    if (itemIndex !== -1 && parts.length > itemIndex + 1) {
        return parts[itemIndex + 1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}
function clearError() {
    if (!errorSection)
        return;
    errorSection.textContent = '';
    errorSection.classList.add('hidden');
}
function showError(message) {
    if (!errorSection)
        return;
    errorSection.textContent = message;
    errorSection.classList.remove('hidden');
}
function normalizeValue(value) {
    if (value == null)
        return '—';
    if (typeof value === 'string' && value.trim().length === 0)
        return '—';
    if (typeof value === 'number')
        return value.toString();
    return String(value);
}
function cleanSearchToken(value) {
    const raw = normalizeValue(value);
    if (raw === '—')
        return '';
    let cleaned = raw.replace(/\(NOT DEFINITIVE\)/gi, '');
    cleaned = cleaned.replace(/\bGuess:\s*/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}
function buildDoubleCheckQuery(fields) {
    const year = cleanSearchToken(fields.year);
    const brand = cleanSearchToken(fields.brand);
    const model = cleanSearchToken(fields.model);
    const finish = cleanSearchToken(fields.finish);
    const parts = [year, brand, model, finish].filter(Boolean);
    return `${parts.join(' ')} used value`.trim();
}
function openDoubleCheck(fields) {
    const query = buildDoubleCheckQuery(fields);
    if (!query)
        return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener');
}
function isArchivedValue(value) {
    if (value === true)
        return true;
    if (typeof value === 'number')
        return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === 'yes' || normalized === '1';
    }
    return false;
}
function isMultiValue(value) {
    if (value === true)
        return true;
    if (typeof value === 'number')
        return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === 'yes' || normalized === '1';
    }
    return false;
}
function updateArchiveButton(archived) {
    if (!archiveButton)
        return;
    archiveButton.disabled = archived || isArchiving;
    if (archiveLabel) {
        if (archived) {
            archiveLabel.textContent = 'Archived';
        }
        else if (isArchiving) {
            archiveLabel.textContent = 'Archiving...';
        }
        else {
            archiveLabel.textContent = 'Archive';
        }
    }
}
function buildTextBlock(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
}
function parseMoneyValue(input) {
    const cleaned = input.replace(/[^0-9.]/g, '');
    if (!cleaned)
        return null;
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : null;
}
function formatMultiSummary(text, fields) {
    const totalsAskingFromSummary = text.match(/Total listing asking price:\s*([^\n]+)/i)?.[1]?.trim();
    const totalsRangeFromSummary = text.match(/Used market range for all:\s*([^\n]+)/i)?.[1]?.trim();
    const totalsIdealFromSummary = text.match(/Ideal price for all:\s*([^\n]+)/i)?.[1]?.trim();
    let totalsAsking = totalsAskingFromSummary || formatCurrencyValue(fields.price_asking);
    let totalsRange = totalsRangeFromSummary || normalizeValue(fields.price_private_party);
    let totalsIdeal = totalsIdealFromSummary || formatCurrencyValue(fields.price_ideal);
    const rows = [];
    let askingSum = 0;
    let lowSum = 0;
    let highSum = 0;
    let idealSum = 0;
    let askingCount = 0;
    let rangeCount = 0;
    let idealCount = 0;
    const recapMatch = text.match(/Itemized recap\s*:?(.*?)(?:\nTotals\s*:?.*|$)/is);
    if (recapMatch) {
        const recapLines = recapMatch[1]
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.startsWith('-'));
        const linePattern = /^-\s*(.+?)\s+-\s*\$?([\d,]+|Unknown)\s+asking,\s+used range\s+\$?([\d,]+|Unknown)\s+to\s+\$?([\d,]+|Unknown),\s+\$?([\d,]+|Unknown)\s+ideal/i;
        for (const line of recapLines) {
            const match = line.match(linePattern);
            if (!match)
                continue;
            const title = match[1].trim();
            const asking = match[2];
            const low = match[3];
            const high = match[4];
            const ideal = match[5];
            rows.push(`${title}, $${asking} asking, sell range ${low}-${high}, ideal $${ideal}`);
            const askingValue = parseMoneyValue(String(asking));
            const lowValue = parseMoneyValue(String(low));
            const highValue = parseMoneyValue(String(high));
            const idealValue = parseMoneyValue(String(ideal));
            if (askingValue != null) {
                askingSum += askingValue;
                askingCount += 1;
            }
            if (lowValue != null && highValue != null) {
                lowSum += lowValue;
                highSum += highValue;
                rangeCount += 1;
            }
            if (idealValue != null) {
                idealSum += idealValue;
                idealCount += 1;
            }
        }
    }
    else {
        const blocks = text.split(/\n---\n/).map((block) => block.trim()).filter(Boolean);
        for (const block of blocks) {
            const titleMatch = block.match(/Make\/model\/variant:\s*([^\n]+)/i);
            const title = titleMatch?.[1]?.trim() || 'Unknown item';
            const askingMatch = block.match(/Asking price \(from listing text\):\s*([^\n]+)/i);
            const asking = askingMatch?.[1]?.trim() || 'Unknown';
            const rangeMatch = block.match(/Typical private-party value:\s*([^\n]+)/i);
            const range = rangeMatch?.[1]?.trim() || 'Unknown';
            const idealMatch = block.match(/Ideal buy price:\s*([^\n]+)/i);
            const ideal = idealMatch?.[1]?.trim() || 'Unknown';
            rows.push(`${title}, ${asking} asking, sell range ${range}, ideal ${ideal}`);
            const askingValue = parseMoneyValue(asking);
            const idealValue = parseMoneyValue(ideal);
            if (askingValue != null) {
                askingSum += askingValue;
                askingCount += 1;
            }
            if (idealValue != null) {
                idealSum += idealValue;
                idealCount += 1;
            }
            const rangeParts = range.split(/[-–]/).map((part) => part.trim());
            if (rangeParts.length === 2) {
                const lowValue = parseMoneyValue(rangeParts[0]);
                const highValue = parseMoneyValue(rangeParts[1]);
                if (lowValue != null && highValue != null) {
                    lowSum += lowValue;
                    highSum += highValue;
                    rangeCount += 1;
                }
            }
        }
    }
    if (rows.length === 0)
        return null;
    if ((totalsAsking === 'Unknown' || totalsAsking === '—') && askingCount > 0) {
        totalsAsking = formatCurrencyValue(askingSum);
    }
    if ((totalsRange === 'Unknown' || totalsRange === '—') && rangeCount > 0) {
        totalsRange = `${formatCurrencyValue(lowSum)}-${formatCurrencyValue(highSum)}`;
    }
    if ((totalsIdeal === 'Unknown' || totalsIdeal === '—') && idealCount > 0) {
        totalsIdeal = formatCurrencyValue(idealSum);
    }
    if (totalsAsking !== '—' || totalsRange !== '—' || totalsIdeal !== '—') {
        rows.push(`Total: ${totalsAsking} asking, sell range ${totalsRange}, ideal ${totalsIdeal}`);
    }
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
        fragment.appendChild(buildTextBlock('p', row));
    }
    return fragment;
}
function formatAiSummary(text, options) {
    const fragment = document.createDocumentFragment();
    const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
    let currentList = null;
    const isMulti = options?.isMulti ?? false;
    let pendingMultiDetails = false;
    const flushList = () => {
        if (currentList) {
            fragment.appendChild(currentList);
            currentList = null;
        }
    };
    const bulletPattern = /^[-•*–]\s+/;
    const bulletStripper = /^([-•*–]\s+)+/;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            flushList();
            continue;
        }
        if (isMulti && line === '---') {
            flushList();
            fragment.appendChild(document.createElement('hr'));
            pendingMultiDetails = false;
            continue;
        }
        if (bulletPattern.test(line)) {
            const bulletText = line.replace(bulletStripper, '');
            if (isMulti && pendingMultiDetails) {
                const makeMatch = bulletText.match(/^Make\/model\/variant:\s*(.+)$/i);
                if (makeMatch?.[1]) {
                    flushList();
                    const title = document.createElement('h2');
                    title.className = 'multi-item-title';
                    title.textContent = makeMatch[1].trim();
                    fragment.appendChild(title);
                    fragment.appendChild(buildTextBlock('h3', 'Details'));
                    pendingMultiDetails = false;
                    continue;
                }
            }
            if (!currentList) {
                currentList = document.createElement('ul');
            }
            const item = document.createElement('li');
            item.textContent = bulletText;
            currentList.appendChild(item);
            continue;
        }
        flushList();
        const headingMatch = line.match(/^[A-Za-z].+$/);
        if (headingMatch && line.length < 80) {
            if (isMulti && /^What it appears to be$/i.test(line)) {
                pendingMultiDetails = true;
                continue;
            }
            fragment.appendChild(buildTextBlock('h3', line));
        }
        else {
            fragment.appendChild(buildTextBlock('p', line));
        }
    }
    flushList();
    return fragment;
}
function getAiSummary(fields) {
    const parts = [];
    for (let index = 1; index <= 10; index += 1) {
        const key = index === 1 ? 'ai_summary' : `ai_summary${index}`;
        const value = fields[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            parts.push(value.trim());
        }
    }
    if (parts.length === 0)
        return '—';
    return parts.join('\n\n');
}
function addMetaRow(label, value) {
    if (!metaEl)
        return;
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = normalizeValue(value);
    metaEl.appendChild(term);
    metaEl.appendChild(detail);
}
function addMetaIconRow(label, value) {
    if (!metaEl)
        return;
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    const normalized = (value || '').trim().toLowerCase();
    const img = document.createElement('img');
    img.className = 'source-icon';
    if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
        img.src = 'images/cl.png';
        img.alt = 'Craigslist';
    }
    else if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
        img.src = 'images/fb.png';
        img.alt = 'Facebook Marketplace';
    }
    else {
        detail.textContent = normalizeValue(value);
        metaEl.appendChild(term);
        metaEl.appendChild(detail);
        return;
    }
    detail.appendChild(img);
    metaEl.appendChild(term);
    metaEl.appendChild(detail);
}
function addSingleRow(label, value, options) {
    if (!singleEl)
        return;
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    if (options?.currency) {
        detail.textContent = formatCurrencyValue(value);
    }
    else {
        const normalized = normalizeValue(value);
        if (normalized === '—') {
            detail.textContent = '— (blank)';
        }
        else {
            const parts = normalized
                .replace(/\bGeneral:\s*/gi, '')
                .replace(/[\u061B\uFF1B\uFE54\u037E]/g, ';')
                .split(/\s*;\s*|\r?\n|\s+[•*-]\s+/g)
                .map((part) => part.replace(/^[-–—•*]+\s*/g, '').trim())
                .map((part) => part.replace(/\bUnknown\.?\s*$/i, '').trim())
                .filter((part) => part.length > 0 && !/^unknown\.?$/i.test(part));
            if (parts.length === 0) {
                detail.textContent = '';
            }
            else if (parts.length === 1) {
                detail.textContent = parts[0];
            }
            else {
                parts.forEach((part, index) => {
                    if (index > 0)
                        detail.appendChild(document.createElement('br'));
                    detail.appendChild(document.createTextNode(`• ${part}`));
                });
            }
        }
    }
    singleEl.appendChild(term);
    singleEl.appendChild(detail);
}
function addValueWithNote(label, value, note) {
    if (!singleEl)
        return;
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = formatCurrencyValue(value);
    const noteText = normalizeValue(note).replace(/^[-–—•]+\\s*/g, '').trim();
    if (noteText !== '—') {
        const noteEl = document.createElement('span');
        noteEl.className = 'inline-note';
        noteEl.textContent = ` (${noteText})`;
        detail.appendChild(noteEl);
    }
    singleEl.appendChild(term);
    singleEl.appendChild(detail);
}
async function copySingleJson(fields) {
    if (!copyButton)
        return;
    const payload = {};
    SINGLE_FIELDS.forEach((field) => {
        payload[field.key] = fields[field.key] ?? '';
    });
    payload.value_private_party_low_notes = fields.value_private_party_low_notes ?? '';
    payload.value_private_party_medium_notes = fields.value_private_party_medium_notes ?? '';
    payload.value_private_party_high_notes = fields.value_private_party_high_notes ?? '';
    try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        const original = copyButton.textContent || 'Copy JSON';
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
            if (copyButton)
                copyButton.textContent = original;
        }, 1500);
    }
    catch {
        const original = copyButton.textContent || 'Copy JSON';
        copyButton.textContent = 'Copy failed';
        setTimeout(() => {
            if (copyButton)
                copyButton.textContent = original;
        }, 1500);
    }
}
function extractFirstPhoto(value) {
    if (!value)
        return null;
    if (Array.isArray(value)) {
        const first = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
        return first ? String(first).trim() : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim().length > 0);
        return firstLine ? firstLine.trim() : null;
    }
    return null;
}
function renderRecord(record) {
    document.body.dataset.buildTag = BUILD_TAG;
    const fields = record.fields || {};
    const title = normalizeValue(fields.title);
    const askingPrice = formatCurrencyValue(fields.price_asking);
    const archived = isArchivedValue(fields.archived);
    const isMulti = isMultiValue(fields.IsMulti);
    updateArchiveButton(archived);
    if (titleEl)
        titleEl.textContent = title === '—' ? 'Listing Details' : title;
    if (aiTitleEl) {
        const baseTitle = title === '—' ? 'Listing Summary' : title;
        aiTitleEl.textContent = askingPrice === '—' ? baseTitle : `${baseTitle} (${askingPrice})`;
    }
    if (metaEl)
        metaEl.innerHTML = '';
    addMetaIconRow('Source', typeof fields.source === 'string' ? fields.source : '');
    addMetaRow('Submitted', formatSubmittedAt(fields.submitted_at));
    addMetaRow('Asking Price', formatCurrencyValue(fields.price_asking));
    const lowValue = parseMoneyValue(String(fields.value_private_party_low ?? ''));
    const highValue = parseMoneyValue(String(fields.value_private_party_high ?? ''));
    const privateRange = lowValue != null && highValue != null
        ? `${formatCurrencyValue(lowValue)}–${formatCurrencyValue(highValue)}`
        : normalizeValue(fields.price_private_party);
    addMetaRow('Private Party Range', privateRange);
    const idealFromField = formatCurrencyValue(fields.price_ideal);
    const idealFromLow = lowValue != null ? formatCurrencyValue(Math.round(lowValue * 0.8)) : '';
    const idealValue = idealFromField ? idealFromField : (idealFromLow || '—');
    addMetaRow('Ideal Price', idealValue);
    addMetaRow('Location', fields.location);
    if (thumbnailEl && mediaEl) {
        const photoUrl = extractFirstPhoto(fields.photos);
        if (photoUrl) {
            thumbnailEl.src = photoUrl;
            thumbnailEl.alt = title === '—' ? 'Listing photo' : `${title} photo`;
            mediaEl.classList.remove('hidden');
        }
        else {
            thumbnailEl.removeAttribute('src');
            thumbnailEl.alt = '';
            mediaEl.classList.add('hidden');
        }
    }
    const url = typeof fields.url === 'string' ? fields.url : '';
    if (openLink) {
        if (url) {
            openLink.href = url;
            openLink.classList.remove('hidden');
        }
        else {
            openLink.classList.add('hidden');
        }
    }
    if (descriptionEl) {
        const description = normalizeValue(fields.description);
        descriptionEl.textContent = description === '—' ? 'No description available.' : description;
    }
    if (multiBlockEl && multiEl) {
        const summary = getAiSummary(fields);
        multiEl.innerHTML = '';
        if (isMulti && summary !== '—') {
            const formatted = formatMultiSummary(summary, fields);
            if (formatted) {
                multiBlockEl.classList.remove('hidden');
                multiEl.appendChild(formatted);
            }
            else {
                multiBlockEl.classList.add('hidden');
            }
        }
        else {
            multiBlockEl.classList.add('hidden');
        }
    }
    if (singleBlockEl && singleEl) {
        singleEl.innerHTML = '';
        if (!isMulti) {
            singleBlockEl.classList.remove('hidden');
            const serialValue = normalizeValue(fields.serial);
            const showSerial = serialValue !== '—';
            SINGLE_FIELDS.forEach((field) => {
                if (!showSerial && (field.key === 'serial' || field.key === 'serial_brand' || field.key === 'serial_year' || field.key === 'serial_model')) {
                    return;
                }
                if (field.key === 'value_private_party_low') {
                    addValueWithNote(field.label, fields.value_private_party_low, fields.value_private_party_low_notes);
                    return;
                }
                if (field.key === 'value_private_party_medium') {
                    addValueWithNote(field.label, fields.value_private_party_medium, fields.value_private_party_medium_notes);
                    return;
                }
                if (field.key === 'value_private_party_high') {
                    addValueWithNote(field.label, fields.value_private_party_high, fields.value_private_party_high_notes);
                    return;
                }
                addSingleRow(field.label, fields[field.key], { currency: field.currency });
            });
            if (copyButton) {
                copyButton.classList.remove('hidden');
                copyButton.onclick = () => {
                    void copySingleJson(fields);
                };
            }
        }
        else {
            singleBlockEl.classList.add('hidden');
            if (copyButton)
                copyButton.classList.add('hidden');
        }
    }
    if (aiEl) {
        const summary = getAiSummary(fields);
        aiEl.innerHTML = '';
        if (isMulti) {
            if (summary === '—') {
                aiEl.textContent = 'No AI summary available yet.';
            }
            else {
                aiEl.appendChild(formatAiSummary(summary, { isMulti }));
            }
        }
        else {
            aiEl.textContent = 'Single listing details are shown above.';
        }
    }
    if (doubleCheckButton) {
        doubleCheckButton.onclick = (event) => {
            event.preventDefault();
            openDoubleCheck(fields);
        };
    }
}
async function archiveListing() {
    if (!currentRecordId || !archiveButton)
        return;
    if (archiveButton.disabled)
        return;
    clearError();
    isArchiving = true;
    archiveButton.disabled = true;
    updateArchiveButton(false);
    try {
        const response = await fetch(`/api/listings/${encodeURIComponent(currentRecordId)}/archive`, {
            method: 'POST',
        });
        const data = (await response.json());
        if (!response.ok) {
            throw new Error(data.message || 'Unable to archive listing.');
        }
        updateArchiveButton(true);
        window.location.href = 'listing-evaluator-results.html';
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to archive listing.';
        showError(message);
        archiveButton.disabled = false;
        updateArchiveButton(false);
    }
    finally {
        isArchiving = false;
    }
}
async function loadRecord() {
    clearError();
    const recordId = getRecordId();
    if (!recordId) {
        showError('Missing listing ID. Return to the results page and select a listing.');
        return;
    }
    try {
        const response = await fetch(`/api/listings/${encodeURIComponent(recordId)}`);
        const data = (await response.json());
        if (!response.ok) {
            throw new Error(data.message || 'Unable to load listing.');
        }
        currentRecordId = recordId;
        renderRecord(data);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load listing.';
        showError(message);
    }
}
if (archiveButton) {
    archiveButton.addEventListener('click', (event) => {
        event.preventDefault();
        void archiveListing();
    });
}
void loadRecord();
export {};
