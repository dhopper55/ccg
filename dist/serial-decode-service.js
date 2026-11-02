import { decodeGibson } from './decoders/gibson.js?version=170516';
import { decodeEpiphone } from './decoders/epiphone.js?version=111184';
import { decodeFender } from './decoders/fender.js?version=091562';
import { decodeTaylor } from './decoders/taylor.js?version=227397';
import { decodeMartin } from './decoders/martin.js?version=695834';
import { decodeIbanez } from './decoders/ibanez.js?version=562740';
import { decodeYamaha } from './decoders/yamaha.js?version=463664';
import { decodePRS } from './decoders/prs.js?version=193694';
import { decodeESP } from './decoders/esp.js?version=689817';
import { decodeSchecter } from './decoders/schecter.js?version=368161';
import { decodeGretsch } from './decoders/gretsch.js?version=864104';
import { decodeJackson } from './decoders/jackson.js?version=086464';
import { decodeSquier } from './decoders/squier.js?version=758187';
import { decodeCort } from './decoders/cort.js?version=763771';
import { decodeTakamine } from './decoders/takamine.js?version=714117';
import { decodeWashburn } from './decoders/washburn.js?version=414485';
import { decodeDean } from './decoders/dean.js?version=534008';
import { decodeErnieBall } from './decoders/ernieball.js?version=436489';
import { decodeGuild } from './decoders/guild.js?version=273034';
import { decodeAlvarez } from './decoders/alvarez.js?version=856102';
import { decodeGodin } from './decoders/godin.js?version=272071';
import { decodeOvation } from './decoders/ovation.js?version=875248';
import { decodeCharvel } from './decoders/charvel.js?version=609872';
import { decodeRickenbacker } from './decoders/rickenbacker.js?version=961802';
import { decodeKramer } from './decoders/kramer.js?version=918347';
import { decodeBCRich } from './decoders/bcrich.js?version=241882';
const DECODER_MAP = {
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
    ernieballmusicman: decodeErnieBall,
    musicman: decodeErnieBall,
    guild: decodeGuild,
    alvarez: decodeAlvarez,
    godin: decodeGodin,
    ovation: decodeOvation,
    charvel: decodeCharvel,
    rickenbacker: decodeRickenbacker,
    kramer: decodeKramer,
    bcrich: decodeBCRich,
};
export function normalizeBrandKey(input) {
    return input.trim().toLowerCase().replace(/[^a-z]/g, '');
}
// Customers often select the parent brand for a sister-brand guitar ("Squier by Fender" on the
// headstock, Epiphone being Gibson-owned). When the parent decoder fails, the sister decoder is
// tried and the result is labelled as the sister brand.
const SISTER_BRAND_FALLBACKS = {
    fender: {
        brand: 'squier',
        note: 'This serial number does not match a Fender format, but it does match a Squier by Fender format. Squier is Fender\'s own brand and many Squier guitars carry the Fender name on the headstock, so these results are for a Squier.',
    },
    gibson: {
        brand: 'epiphone',
        note: 'This serial number does not match a Gibson format, but it does match an Epiphone format. Epiphone is owned by Gibson and builds Gibson-designed models, so these results are for an Epiphone.',
    },
};
export function getSisterFallbackBrand(normalizedBrand) {
    return SISTER_BRAND_FALLBACKS[normalizedBrand]?.brand ?? null;
}
/**
 * Applies the sister-brand result if it is safe to show on the parent brand's decoder, or
 * returns null. Requires a real year, and for Gibson skips the Epiphone formats that overlap
 * Gibson's own: pure-numeric serials shorter than 11 digits (Gibson USA numbering),
 * "A"-prefixed serials (Gibson 1961-63 A-series), and matches with no identified factory.
 */
export function acceptSisterFallbackResult(normalizedBrand, serial, result) {
    const fallback = SISTER_BRAND_FALLBACKS[normalizedBrand];
    if (!fallback || !result.success || !result.info || !isMeaningfulYear(result.info.year)) {
        return null;
    }
    if (normalizedBrand === 'gibson') {
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^\d{1,10}$/.test(alnumUpper) || /^A\d+$/.test(alnumUpper)) {
            return null;
        }
        // Epiphone's letter-prefix rules also accept short Gibson-looking numbers; only trust
        // matches that identify a factory.
        if (!isMeaningfulDescriptor(result.info.factory, 'factory')) {
            return null;
        }
    }
    const info = { ...result.info };
    info.notes = info.notes ? `${fallback.note} ${info.notes}` : fallback.note;
    return { ...result, info };
}
export function decodeSerialForBackend(brandInput, serialInput, options = {}) {
    const primary = decodeSerialForBrand(brandInput, serialInput);
    if (primary.success || options.sisterFallback === false || !primary.normalizedBrand) {
        return primary;
    }
    const sisterBrand = getSisterFallbackBrand(primary.normalizedBrand);
    if (!sisterBrand) {
        return primary;
    }
    const sister = decodeSerialForBrand(sisterBrand, serialInput);
    const accepted = acceptSisterFallbackResult(primary.normalizedBrand, serialInput, sister);
    if (!accepted) {
        return primary;
    }
    return {
        ...accepted,
        normalizedBrand: primary.normalizedBrand,
        correctedSerial: sister.correctedSerial,
    };
}
function decodeSerialForBrand(brandInput, serialInput) {
    const normalizedBrand = normalizeBrandKey(brandInput);
    if (!normalizedBrand) {
        return {
            success: false,
            error: 'Please select a brand.',
        };
    }
    const decoder = DECODER_MAP[normalizedBrand];
    if (!decoder) {
        return {
            success: false,
            error: 'Unknown brand selected.',
            normalizedBrand,
        };
    }
    // Normalize fullwidth Unicode characters (U+FF01–U+FF5E) to ASCII equivalents, and Cyrillic
    // letters that look identical to Latin ones (Cyrillic keyboards produce e.g. "MС172398").
    const serial = serialInput.trim()
        .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[АВСЕНКМОРТХаеорсху]/g, (ch) => CYRILLIC_LOOKALIKES[ch] ?? ch);
    if (!serial) {
        return {
            success: false,
            error: 'Please enter a serial number.',
            normalizedBrand,
        };
    }
    let result = decoder(serial);
    let correctedSerial;
    if (!result.success) {
        const retrySerials = buildRetrySerials(serial, normalizedBrand);
        for (const retrySerial of retrySerials) {
            const retryResult = decoder(retrySerial);
            if (!retryResult.success || !retryResult.info) {
                continue;
            }
            correctedSerial = retrySerial;
            retryResult.info.serialNumber = retrySerial;
            const correctionNote = `Serial number corrected from ${serial} to ${retrySerial} after retrying with normalized formatting.`;
            retryResult.info.notes = retryResult.info.notes
                ? `${retryResult.info.notes} ${correctionNote}`
                : correctionNote;
            result = retryResult;
            break;
        }
    }
    if (result.success && result.info && isFutureYearResult(result.info, getAllowedFutureYearOffset(normalizedBrand))) {
        // Decoders that already flag a serial as suspicious/impossible intentionally return a future year
        // in the year field to convey the anomaly. Pass those through rather than silently dropping them.
        if (!result.patternKey?.includes('suspicious')) {
            return {
                success: false,
                error: 'Unable to decode this serial number.',
                normalizedBrand,
                correctedSerial,
            };
        }
    }
    if (result.success && result.info && !hasMeaningfulDecodedFields(result.info)) {
        return {
            success: false,
            error: 'Unable to decode this serial number.',
            normalizedBrand,
            correctedSerial,
        };
    }
    return {
        ...result,
        normalizedBrand,
        correctedSerial,
    };
}
const CYRILLIC_LOOKALIKES = {
    А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X',
    а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y',
};
// Brands whose retries also strip "S/N" labels, pull the serial out of surrounding words, and
// try common keying mistakes (letter O for zero, I/l for one, leading 1 for the I of Indonesian
// IC/ICS/ISS prefixes). Limited to brands whose decoders have been checked against these
// rewrites: looser decoders turn the extracted words into confident wrong dates.
const CLEANUP_RETRY_BRANDS = new Set(['fender', 'squier', 'gibson', 'epiphone', 'esp', 'schecter']);
function buildTypoCandidates(value) {
    const upper = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // A leading O is a real Fender/Squier Japan prefix (1997-2000), so only later Os are rewritten.
    const digitFixed = upper.slice(0, 1) + upper.slice(1)
        .replace(/O(?=\d)|(?<=\d)O/g, '0')
        .replace(/O(?=\d)|(?<=\d)O/g, '0')
        .replace(/(?<=\d)[IL](?=\d)/g, '1');
    const candidates = [digitFixed];
    for (const candidate of [upper, digitFixed]) {
        if (/^1(?:C|CS|SS|S)\d/.test(candidate) || /^1(?:C|CS|SS)[A-L]\d/.test(candidate)) {
            candidates.push(`I${candidate.slice(1)}`);
        }
    }
    return candidates;
}
function buildRetrySerials(serial, normalizedBrand) {
    const candidates = [];
    const addCandidate = (candidate) => {
        const cleaned = candidate.trim();
        if (!cleaned || cleaned === serial || candidates.includes(cleaned)) {
            return;
        }
        candidates.push(cleaned);
    };
    const spaceSeparatedParts = serial.trim().split(/\s+/).filter(Boolean);
    const lastSpaceSeparatedPart = spaceSeparatedParts.length > 1
        ? spaceSeparatedParts[spaceSeparatedParts.length - 1]
        : '';
    addCandidate(serial.toUpperCase());
    addCandidate(serial.replace(/[\s-]/g, ''));
    addCandidate(serial.replace(/[\s-]/g, '').toUpperCase());
    addCandidate(serial.replace(/[^A-Za-z0-9]/g, ''));
    addCandidate(serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
    if (lastSpaceSeparatedPart) {
        addCandidate(lastSpaceSeparatedPart);
        addCandidate(lastSpaceSeparatedPart.toUpperCase());
        addCandidate(lastSpaceSeparatedPart.replace(/[\s-]/g, ''));
        addCandidate(lastSpaceSeparatedPart.replace(/[\s-]/g, '').toUpperCase());
        addCandidate(lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, ''));
        addCandidate(lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
    }
    if (CLEANUP_RETRY_BRANDS.has(normalizedBrand)) {
        // "S/N:", "SN ", "Serial #" labels typed in front of the serial.
        const unlabeled = serial.replace(/^\s*(?:S\s*\/\s*N|SN(?=[\s:#.\/])|SERIAL(?:\s*(?:NO|NUMBER))?)\s*[:#.\/]?\s*/i, '');
        if (unlabeled !== serial.trim()) {
            addCandidate(unlabeled.replace(/[\s-]/g, '').toUpperCase());
        }
        // Serial typed alongside other words ("359178 usa", "SN: 62421124 MP"): use the one word
        // that carries digits, when exactly one does.
        const digitParts = spaceSeparatedParts.filter((part) => /\d/.test(part));
        if (spaceSeparatedParts.length > 1 && digitParts.length === 1) {
            const part = digitParts[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (part.length >= 5 && /\d{4,}/.test(part)) {
                addCandidate(part);
            }
        }
        for (const base of [...candidates]) {
            for (const typoCandidate of buildTypoCandidates(base)) {
                addCandidate(typoCandidate);
            }
        }
        for (const typoCandidate of buildTypoCandidates(serial)) {
            addCandidate(typoCandidate);
        }
        // ESP LTD and Schecter use two-letter factory prefixes followed directly by the year, so an
        // I or L right after the prefix is a mistyped 1 (IWI4082364 -> IW14082364).
        if (normalizedBrand === 'esp' || normalizedBrand === 'schecter') {
            for (const base of [...candidates, serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase()]) {
                const fixed = base.replace(/^([A-Z]{2})[IL](?=\d)/, '$11');
                if (fixed !== base) {
                    addCandidate(fixed);
                    for (const typoCandidate of buildTypoCandidates(fixed)) {
                        addCandidate(typoCandidate);
                    }
                }
            }
        }
    }
    if (normalizedBrand === 'ibanez' && serial.length >= 2 && serial[0] === '1') {
        addCandidate(`I${serial.slice(1)}`.toUpperCase());
    }
    if (normalizedBrand === 'ibanez') {
        addCandidate(serial.toUpperCase().replace(/O/g, '0'));
        addCandidate(serial.toUpperCase().replace(/0/g, 'O'));
        if (lastSpaceSeparatedPart) {
            addCandidate(lastSpaceSeparatedPart.toUpperCase().replace(/O/g, '0'));
            addCandidate(lastSpaceSeparatedPart.toUpperCase().replace(/0/g, 'O'));
        }
        // Known Ibanez typo variant: HU + 9 digits is often intended as U + 9 digits.
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^HU\d{9}$/.test(alnumUpper)) {
            addCandidate(alnumUpper.slice(1));
        }
        const lastPartAlnumUpper = lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^HU\d{9}$/.test(lastPartAlnumUpper)) {
            addCandidate(lastPartAlnumUpper.slice(1));
        }
    }
    if (normalizedBrand === 'fender') {
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Common OCR/mistype case on E-prefix 1980s serials: trailing "F" for "3".
        if (/^E\d+F$/.test(alnumUpper)) {
            addCandidate(alnumUpper.slice(0, -1) + '3');
        }
        const lastPartAlnumUpper = lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^E\d+F$/.test(lastPartAlnumUpper)) {
            addCandidate(lastPartAlnumUpper.slice(0, -1) + '3');
        }
    }
    if (normalizedBrand === 'cort') {
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Common transposition on Cort Indonesia AI-prefix serials: IA instead of AI.
        if (/^IA\d{9}$/.test(alnumUpper)) {
            addCandidate(`AI${alnumUpper.slice(2)}`);
        }
        const lastPartAlnumUpper = lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^IA\d{9}$/.test(lastPartAlnumUpper)) {
            addCandidate(`AI${lastPartAlnumUpper.slice(2)}`);
        }
    }
    if (normalizedBrand === 'schecter') {
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Common mistype/OCR case on Schecter IW serials: leading "1W" instead of "IW".
        if (/^1W\d{8,9}$/.test(alnumUpper)) {
            addCandidate(`IW${alnumUpper.slice(2)}`);
        }
        const lastPartAlnumUpper = lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^1W\d{8,9}$/.test(lastPartAlnumUpper)) {
            addCandidate(`IW${lastPartAlnumUpper.slice(2)}`);
        }
    }
    if (normalizedBrand === 'esp') {
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Common OCR/stamp misread on ESP LTD Indonesia serials: leading '1' instead of 'I'.
        // e.g. 1W211112431 → IW211112431 (P.T. Wildwood Indonesia)
        if (/^1[WCRI]\d{7,9}$/.test(alnumUpper)) {
            addCandidate(`I${alnumUpper.slice(1)}`);
        }
        // Common OCR/stamp misread on ESP LTD IW serials: 'I' (letter) at position 3 instead of '1' (digit).
        // e.g. IWI4071639 → IW14071639 (P.T. Wildwood Indonesia, year 2014)
        if (/^IWI\d{7}$/.test(alnumUpper)) {
            addCandidate(`IW1${alnumUpper.slice(3)}`);
        }
        const lastPartAlnumUpper = lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^1[WCRI]\d{7,9}$/.test(lastPartAlnumUpper)) {
            addCandidate(`I${lastPartAlnumUpper.slice(1)}`);
        }
        if (/^IWI\d{7}$/.test(lastPartAlnumUpper)) {
            addCandidate(`IW1${lastPartAlnumUpper.slice(3)}`);
        }
    }
    if (normalizedBrand === 'jackson') {
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Common OCR/stamp misread on Jackson modern import serials: leading '1' instead of 'I'.
        // e.g. 1CJ1705071 → ICJ1705071 (Indonesia/Cor-Tek/Jackson, 3-letter prefix format)
        if (/^1[A-Z]{2}\d{7}$/.test(alnumUpper)) {
            addCandidate(`I${alnumUpper.slice(1)}`);
        }
        const lastPartAlnumUpper = lastSpaceSeparatedPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^1[A-Z]{2}\d{7}$/.test(lastPartAlnumUpper)) {
            addCandidate(`I${lastPartAlnumUpper.slice(1)}`);
        }
    }
    return candidates;
}
function getAllowedFutureYearOffset(normalizedBrand) {
    // Cort often ships upcoming model-year inventory before that calendar year starts.
    if (normalizedBrand === 'cort') {
        return 1;
    }
    // Kramer modern numeric serials can encode near-future model years (factory pre-production batches).
    if (normalizedBrand === 'kramer') {
        return 5;
    }
    return 0;
}
function isFutureYearResult(info, allowedFutureYears = 0) {
    if (!info.year) {
        return false;
    }
    const years = extractYears(info.year);
    if (!years.length) {
        return false;
    }
    const currentYear = new Date().getFullYear();
    return years.some((year) => year > currentYear + allowedFutureYears);
}
function extractYears(text) {
    const matches = text.match(/\b\d{4}\b/g);
    if (!matches) {
        return [];
    }
    return matches.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
}
function hasMeaningfulDecodedFields(info) {
    return (isMeaningfulYear(info.year) ||
        isMeaningfulMonth(info.month) ||
        isMeaningfulDescriptor(info.factory, 'factory') ||
        isMeaningfulDescriptor(info.country, 'country') ||
        isMeaningfulDescriptor(info.model, 'model'));
}
function isMeaningfulYear(value) {
    if (!value)
        return false;
    const text = value.trim();
    if (!text)
        return false;
    if (/\b(possibly|likely|maybe|check|unknown|contact)\b/i.test(text))
        return false;
    return /\d{4}/.test(text);
}
function isMeaningfulMonth(value) {
    if (!value)
        return false;
    const month = value.trim();
    if (!month)
        return false;
    return /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(month);
}
function isMeaningfulDescriptor(value, kind) {
    if (!value)
        return false;
    const text = value.trim();
    if (!text)
        return false;
    if (/\b(unknown|unspecified|check|contact|n\/a|not available)\b/i.test(text))
        return false;
    if (/\s+or\s+/i.test(text))
        return false;
    if (kind === 'country' && /\bimport\b/i.test(text))
        return false;
    if (kind === 'factory' && /\blikely\b/i.test(text))
        return false;
    return true;
}
