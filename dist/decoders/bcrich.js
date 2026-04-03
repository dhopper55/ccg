/**
 * B.C. Rich Guitar Serial Number Decoder
 *
 * Supported formats (based on published B.C. Rich serial number guides and NJ series references):
 * - USA neck-through: 5-digit YYXXX format (year + production sequence)
 * - Class Axe era: B0XXX / BXXXXX / BCXXXXX (year not encoded)
 * - Import pre-2000: F7XXXXX/F8XXXXX/F9XXXXX/F0XXXXX (year in second digit)
 * - Date-stamp numeric: 8 digits like 121XXXXX (year digit + quarter + production)
 * - Month/factory code: A08140023 (month letter + factory + year + production)
 * - NJ Series: R/P + 6 digits with year in first two digits
 */
const MONTH_CODE_MAP = {
    A: 'January',
    C: 'February',
    E: 'March',
    F: 'April',
    G: 'May',
    H: 'June',
    J: 'July',
    K: 'August',
    L: 'September',
    M: 'October',
    N: 'November',
    P: 'December',
};
const FACTORY_MAP = {
    '00': { name: 'Fine China', country: 'China' },
    '01': { name: 'Sejung China', country: 'China' },
    '02': { name: 'HW China', country: 'China' },
    '03': { name: 'Great China', country: 'China' },
    '04': { name: 'Daewon China', country: 'China' },
    '05': { name: 'Taiki China', country: 'China' },
    '06': { name: 'Orient China', country: 'China' },
    '07': { name: 'Huakai China', country: 'China' },
    '08': { name: 'World Korea', country: 'South Korea' },
    '09': { name: 'Fine Korea', country: 'South Korea' },
    '10': { name: 'SW Korea', country: 'South Korea' },
};
export function decodeBCRich(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    if (/^[SIFN]\d{8}$/.test(normalized)) {
        return decodeImportLetterPrefix(normalized);
    }
    if (/^[ACEFGHJKLMNP][0-9]{8}$/.test(normalized)) {
        return decodeMonthFactory(normalized);
    }
    if (/^F[7890]\d{5}$/.test(normalized)) {
        return decodeFSeries(normalized);
    }
    if (/^BO\d{3}$/.test(normalized)) {
        return decodeBoltOn2000(normalized);
    }
    if (/^\d{8}$/.test(normalized)) {
        return decodeDateStampNumeric(normalized);
    }
    if (/^[RP]\d{6}$/.test(normalized)) {
        return decodeNJSeries(normalized);
    }
    if (/^BC\d{5}$/.test(normalized)) {
        return decodeClassAxeBC(normalized);
    }
    if (/^B\d{3,5}$/.test(normalized)) {
        return decodeClassAxeB(normalized);
    }
    if (/^I\d{5}$/.test(normalized)) {
        return decodeIShortImport(normalized);
    }
    if (/^\d{5}$/.test(normalized)) {
        return decodeUSA5Digit(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this B.C. Rich serial number. Known formats include: 5-digit USA neck-through (YYXXX), F7/F8/F9/F0 import serials, 8-digit date-stamp (e.g., 121XXXXX), month/factory codes like A08140023, NJ series R/P + 6 digits, Class Axe BC/B0 series, or short I-prefix import estimates (I + 5 digits).',
    };
}
const IMPORT_PREFIX_MAP = {
    S: 'S-prefix (factory or series designation)',
    I: 'I-prefix (import production)',
    F: 'F-prefix (factory designation)',
    N: 'N-prefix (NJ Series or import designation)',
};
function decodeImportLetterPrefix(serial) {
    const prefix = serial[0];
    const yearDigits = serial.slice(1, 3);
    const yearNum = parseInt(yearDigits, 10);
    const production = serial.slice(3);
    const prefixDesc = IMPORT_PREFIX_MAP[prefix] || `${prefix}-prefix`;
    // Year digits 00-30 map to 2000-2030; higher values could be 1990s
    let year;
    let yearNote;
    if (yearNum <= 30) {
        year = `${2000 + yearNum}`;
        yearNote = `Digits "${yearDigits}" interpreted as ${year}`;
    }
    else {
        const year2k = 2000 + yearNum;
        const year19 = 1900 + yearNum;
        year = `${year19} or ${year2k}`;
        yearNote = `Digits "${yearDigits}" could indicate ${year19} or ${year2k}`;
    }
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year,
        factory: `Import production (${prefixDesc})`,
        country: 'South Korea / China',
        notes: `${prefixDesc} with 8-digit format, typical of Korean or Chinese-made B.C. Rich imports (NJ Series, Platinum Series, or similar). ${yearNote}. Production sequence: ${production}. B.C. Rich serial numbering is inconsistent across eras — confirm with headstock markings, neck pocket stamps, or country-of-origin stickers.`,
    };
    return { success: true, info };
}
function decodeMonthFactory(serial) {
    const monthCode = serial[0];
    const factoryCode = serial.slice(1, 3);
    const yearCode = serial.slice(3, 5);
    const production = serial.slice(5);
    const month = MONTH_CODE_MAP[monthCode];
    const yearValue = 2000 + parseInt(yearCode, 10);
    const factoryInfo = FACTORY_MAP[factoryCode];
    const factoryLabel = factoryInfo ? factoryInfo.name : `Factory ${factoryCode}`;
    const country = factoryInfo ? factoryInfo.country : 'Unknown';
    const factoryNote = factoryInfo
        ? ''
        : ` Factory code ${factoryCode} is not listed in B.C. Rich's published factory list (00–10).`;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: yearValue.toString(),
        month: month,
        factory: factoryLabel,
        country,
        notes: `Month/factory code format. Production sequence: ${production}.${factoryNote}`,
    };
    return { success: true, info };
}
function decodeFSeries(serial) {
    const yearDigit = serial[1];
    const yearMap = {
        '7': '1997',
        '8': '1998',
        '9': '1999',
        '0': '2000',
    };
    const year = yearMap[yearDigit] || 'Unknown';
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year,
        notes: 'Import serial format used before November 2000. The second digit indicates the year (7=1997, 8=1998, 9=1999, 0=2000).',
    };
    return { success: true, info };
}
function decodeBoltOn2000(serial) {
    const production = serial.slice(2);
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: '2000',
        notes: `B0/BO bolt-on format introduced in 2000. Production sequence: ${production}.`,
    };
    return { success: true, info };
}
function decodeDateStampNumeric(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const quarterDigit = parseInt(serial[2], 10);
    const production = serial.slice(3);
    const year = 2000 + yearDigit;
    const quarter = quarterDigit >= 1 && quarterDigit <= 4 ? `Q${quarterDigit}` : undefined;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: year.toString(),
        notes: `Date-stamp format used for imports and USA handmades (2001-era). Second digit is a placeholder; third digit is the quarter${quarter ? ` (${quarter})` : ''}. Production sequence: ${production}.`,
    };
    return { success: true, info };
}
function decodeUSA5Digit(serial) {
    const yearDigits = serial.slice(0, 2);
    const sequence = serial.slice(2);
    const yearNum = parseInt(yearDigits, 10);
    // B.C. Rich 5-digit neck-through serials can drift ahead of actual build year
    // in the early/mid-1980s due to numbering inconsistencies.
    if (yearNum >= 30 && yearNum <= 49) {
        const apparentYear = 1950 + yearNum;
        const likelyStart = apparentYear - 4;
        const likelyEnd = apparentYear - 3;
        const info = {
            brand: 'B.C. Rich',
            serialNumber: serial,
            year: `${likelyStart}-${likelyEnd} (estimated)`,
            factory: 'USA (neck-through)',
            country: 'United States',
            notes: `5-digit USA neck-through format (YYXXX). Production sequence: ${sequence}. Apparent code "${yearDigits}" often reads as ${apparentYear}, but known B.C. Rich serial drift in this era means actual production is typically earlier (about 3-4 years), so this is estimated as ${likelyStart}-${likelyEnd}.`,
        };
        return { success: true, info };
    }
    const year = yearNum >= 70 ? `19${yearDigits}` : `20${yearDigits.padStart(2, '0')}`;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year,
        factory: 'USA (neck-through)',
        country: 'United States',
        notes: `5-digit USA neck-through format (YYXXX). Production sequence: ${sequence}. Note: early/mid-1980s serials can be out of sequence, so treat the year as an estimate.`,
    };
    return { success: true, info };
}
function decodeClassAxeBC(serial) {
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: '1990s-early 2000s (estimated)',
        factory: 'Import production (Class Axe / post-Class Axe era)',
        country: 'South Korea / China',
        notes: 'BC-prefixed bolt-on/import serial commonly seen on Class Axe-era and later budget B.C. Rich models. These generally do not encode a precise build date, so treat the 1990s-early 2000s range as an estimate and confirm with country-of-origin stickers, neck plate markings, and model-era features.',
    };
    return { success: true, info };
}
function decodeClassAxeB(serial) {
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: '1989-1993 (estimated)',
        factory: 'Class Axe-era import production',
        country: 'Japan / South Korea',
        notes: 'B-prefixed short serial used on many late-1980s to early-1990s bolt-on B.C. Rich imports. These usually do not encode an exact year, so 1989-1993 should be treated as an estimate and confirmed with headstock, neck plate, or electronics-cavity markings.',
    };
    return { success: true, info };
}
function decodeIShortImport(serial) {
    const yearDigit = parseInt(serial[1], 10);
    const monthDigits = serial.slice(2, 4);
    const monthValue = parseInt(monthDigits, 10);
    const sequence = serial.slice(4);
    const year = 2000 + yearDigit;
    const monthText = monthValue >= 1 && monthValue <= 12 ? MONTH_NAME(monthValue) : undefined;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: year.toString(),
        month: monthText,
        factory: 'Import production (I-prefix short format)',
        country: 'Asia (factory unspecified)',
        notes: `Short I-prefix import format interpreted as I + Y + MM + sequence. Parsed as ${year}${monthText ? `, ${monthText}` : ''} with sequence ${sequence}. B.C. Rich serial records are inconsistent across eras, so treat this as an estimate and confirm with headstock/soundhole country markings.`,
    };
    return { success: true, info };
}
function decodeNJSeries(serial) {
    const yearDigits = serial.slice(1, 3);
    const sequence = serial.slice(3);
    const yearNum = parseInt(yearDigits, 10);
    const year = `19${yearDigits}`;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: yearNum >= 70 ? year : year,
        notes: `Likely NJ Series serial (R/P prefix). The first two digits often indicate the year. Production sequence: ${sequence}. NJ Series production spans Japan and later Korea, so confirm with headstock markings.`,
    };
    return { success: true, info };
}
function MONTH_NAME(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[month - 1];
}
