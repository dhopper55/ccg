import { decodeGibson } from './decoders/gibson.js?version=917338';
import { decodeEpiphone } from './decoders/epiphone.js?version=262979';
import { decodeFender } from './decoders/fender.js?version=411815';
import { decodeTaylor } from './decoders/taylor.js?version=678368';
import { decodeMartin } from './decoders/martin.js?version=695834';
import { decodeIbanez } from './decoders/ibanez.js?version=642173';
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
import { decodeBCRich } from './decoders/bcrich.js?version=330486';
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
