import { decodeGibson } from './decoders/gibson.js?version=805837';
import { decodeEpiphone } from './decoders/epiphone.js?version=493352';
import { decodeFender } from './decoders/fender.js?version=940349';
import { decodeTaylor } from './decoders/taylor.js?version=378527';
import { decodeMartin } from './decoders/martin.js?version=695834';
import { decodeIbanez } from './decoders/ibanez.js?version=316960';
import { decodeYamaha } from './decoders/yamaha.js?version=073362';
import { decodePRS } from './decoders/prs.js?version=677739';
import { decodeESP } from './decoders/esp.js?version=568506';
import { decodeSchecter } from './decoders/schecter.js?version=042948';
import { decodeGretsch } from './decoders/gretsch.js?version=916316';
import { decodeJackson } from './decoders/jackson.js?version=802948';
import { decodeSquier } from './decoders/squier.js?version=430608';
import { decodeCort } from './decoders/cort.js?version=557654';
import { decodeTakamine } from './decoders/takamine.js?version=847856';
import { decodeWashburn } from './decoders/washburn.js?version=566695';
import { decodeDean } from './decoders/dean.js?version=568278';
import { decodeErnieBall } from './decoders/ernieball.js?version=375548';
import { decodeGuild } from './decoders/guild.js?version=242409';
import { decodeAlvarez } from './decoders/alvarez.js?version=962736';
import { decodeGodin } from './decoders/godin.js?version=247017';
import { decodeOvation } from './decoders/ovation.js?version=695857';
import { decodeCharvel } from './decoders/charvel.js?version=381205';
import { decodeRickenbacker } from './decoders/rickenbacker.js?version=961802';
import { decodeKramer } from './decoders/kramer.js?version=098263';
import { decodeBCRich } from './decoders/bcrich.js?version=038990';
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
export function decodeSerialForBackend(brandInput, serialInput) {
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
    // Normalize fullwidth Unicode characters (U+FF01–U+FF5E) to ASCII equivalents
    const serial = serialInput.trim().replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
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
    return candidates;
}
function getAllowedFutureYearOffset(normalizedBrand) {
    // Cort often ships upcoming model-year inventory before that calendar year starts.
    if (normalizedBrand === 'cort') {
        return 1;
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
