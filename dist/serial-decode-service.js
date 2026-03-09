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
import { decodeBCRich } from './decoders/bcrich.js';
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
    const serial = serialInput.trim();
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
    if (result.success && result.info && isFutureYearResult(result.info)) {
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
    addCandidate(serial.toUpperCase());
    addCandidate(serial.replace(/[\s-]/g, ''));
    addCandidate(serial.replace(/[\s-]/g, '').toUpperCase());
    addCandidate(serial.replace(/[^A-Za-z0-9]/g, ''));
    addCandidate(serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
    if (normalizedBrand === 'ibanez' && serial.length >= 2 && serial[0] === '1') {
        addCandidate(`I${serial.slice(1)}`.toUpperCase());
    }
    if (normalizedBrand === 'ibanez') {
        addCandidate(serial.toUpperCase().replace(/O/g, '0'));
        addCandidate(serial.toUpperCase().replace(/0/g, 'O'));
        // Known Ibanez typo variant: HU + 9 digits is often intended as U + 9 digits.
        const alnumUpper = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^HU\d{9}$/.test(alnumUpper)) {
            addCandidate(alnumUpper.slice(1));
        }
    }
    return candidates;
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
