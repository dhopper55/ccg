/**
 * B.C. Rich Guitar Serial Number Decoder
 *
 * Supported formats (based on published B.C. Rich serial number guides and NJ series references):
 * - USA neck-through: 5-digit YYXXX format (year + production sequence)
 * - Class Axe era: B0XXX / BXXXXX / BCXXXXX (year not encoded)
 * - Import pre-2000: F7XXXXX/F8XXXXX/F9XXXXX/F0XXXXX (year in second digit)
 * - Early-2000s short numeric import: 6 digits like 150979
 * - Hanser-era/date-stamp numeric: 8 digits like 41201627 (year digit + quarter + production)
 * - Month/factory code: A08140023 (month letter + factory + year + production)
 * - B-prefix month-code import: BA09030385 (B + month letter + YY + sequence)
 * - Two-letter Hanser-era import: CO1093111 (month + plant + YY + sequence)
 * - F-prefix six-digit import: F201422 (factory/line prefix + YY + sequence)
 * - Short modern month-code import: F2051631 (month + year + batch/factory + sequence)
 * - Class Axe/import B-prefix: B + 3-6 digits, including B007132
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
    const normalized = cleaned
        .replace(/^SR[#:.]?\s*/, '')
        .replace(/[\s-]/g, '');
    if (/^[SIFN]\d{8}$/.test(normalized)) {
        return decodeImportLetterPrefix(normalized);
    }
    if (/^[ACEFGHJKLMNP][A-Z]\d{7}$/.test(normalized)) {
        return decodeHanserTwoLetterMonthPlantImport(normalized);
    }
    if (/^[ACEFGHJKLMNP][0-9]{8}$/.test(normalized)) {
        return decodeMonthFactory(normalized);
    }
    if (/^[ACEFGHJKLMNP]\d{7}$/.test(normalized)) {
        return decodeShortMonthCodeImport(normalized);
    }
    if (/^B[ACEFGHJKLMNP]\d{8}$/.test(normalized)) {
        return decodeBPrefixMonthCodeImport(normalized);
    }
    if (/^F[7890]\d{5}$/.test(normalized)) {
        return decodeFSeries(normalized);
    }
    if (/^F\d{6}$/.test(normalized)) {
        return decodeFSixDigitImport(normalized);
    }
    if (/^BO\d{3}$/.test(normalized)) {
        return decodeBoltOn2000(normalized);
    }
    if (/^\d{8}$/.test(normalized)) {
        return decodeHanserEraNumericImport(normalized);
    }
    if (/^[RP]\d{6}$/.test(normalized)) {
        return decodeNJSeries(normalized);
    }
    if (/^BC\d{5}$/.test(normalized)) {
        return decodeClassAxeBC(normalized);
    }
    if (/^B\d{3,6}$/.test(normalized)) {
        return decodeClassAxeB(normalized);
    }
    if (/^I\d{5}$/.test(normalized)) {
        return decodeIShortImport(normalized);
    }
    if (/^\d{6}$/.test(normalized)) {
        return decodeShortNumericImport(normalized);
    }
    if (/^\d{5}$/.test(normalized)) {
        return decodeUSA5Digit(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this B.C. Rich serial number. Known formats include: 5-digit USA neck-through (YYXXX), F7/F8/F9/F0 import serials, F-prefix six-digit imports like F201422, 8-digit Hanser-era/import date stamps (e.g., Sr#41201627), month/factory codes like A08140023, two-letter Hanser-era imports like CO1093111, B-prefix month-code imports like BA09030385, NJ series R/P + 6 digits, Class Axe BC/B0/B-prefix series like B007132, or short I-prefix import estimates (I + 5 digits).',
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
function decodeHanserTwoLetterMonthPlantImport(serial) {
    const monthCode = serial[0];
    const plantCode = serial[1];
    const yearDigits = serial.slice(2, 4);
    const sequence = serial.slice(4);
    const month = MONTH_CODE_MAP[monthCode];
    const yearNum = parseInt(yearDigits, 10);
    const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: `Hanser-era import plant/contract code ${plantCode}`,
        country: 'China / Indonesia',
        notes: `Two-letter Hanser-era B.C. Rich import format interpreted as month code + plant/contract code + YY + sequence. ${monthCode} indicates ${month}; ${plantCode} is treated as an internal plant or contract-manufacturer code; digits ${yearDigits} indicate production year ${year}; remaining digits are production sequence ${parseInt(sequence, 10)}. B.C. Rich import serials from this era can be inconsistent, so verify with country-of-origin markings, body shape, neck construction, and neck pocket or electronics-cavity dates where available.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-hanser-two-letter-month-plant-import',
        patternLabel: 'B.C. Rich Hanser-era two-letter month/plant import',
        additionalContext: {
            title: 'B.C. Rich Hanser-era import serial',
            summary: 'This serial matches a Hanser-era B.C. Rich import format parsed as month code, plant or contract code, production year, and sequence.',
            highlights: [
                `The month code ${monthCode} decodes as ${month}.`,
                `The letter ${plantCode} is treated as an internal plant or contract-manufacturer code.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'B.C. Rich serial numbering is inconsistent across import eras and ownership periods.',
                'This serial pattern identifies likely date and import family, not the exact model name.',
                'Plant-letter meanings are less consistently documented than numeric factory codes.',
            ],
            verificationTips: [
                'Check for Made in China, Made in Indonesia, or other country-of-origin markings.',
                'Compare body shape, neck construction, pickups, bridge, and trim against late-2000s and early-2010s B.C. Rich import catalogs.',
                'Use neck pocket, electronics-cavity, or label dates if the instrument has them.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Hanser-era B.C. Rich import format parsed as month code, plant or contract code, production year, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The month code ${monthCode} decodes as ${month}. The letter ${plantCode} is treated as an internal plant or contract-manufacturer code. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across import eras and ownership periods.</li><li>This serial pattern identifies likely date and import family, not the exact model name.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
    };
}
function decodeShortMonthCodeImport(serial) {
    const monthCode = serial[0];
    const yearDigits = serial.slice(1, 3);
    const batchCode = serial[3];
    const sequence = serial.slice(4);
    const yearNum = parseInt(yearDigits, 10);
    const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    const month = MONTH_CODE_MAP[monthCode];
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: `Import production batch/factory code ${batchCode}`,
        country: 'South Korea / China / Indonesia',
        notes: `Short modern B.C. Rich month-code import format. ${monthCode} indicates ${month}; digits ${yearDigits} indicate ${year}; digit ${batchCode} is treated as a factory or batch code; production sequence: ${sequence}. If this serial is on an older neck plate, it could instead be a pre-2000 F-prefix import/Class Axe-era number, so verify with headstock markings, country-of-origin labels, and neck pocket or electronics-cavity dates.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-short-modern-month-code-import',
        patternLabel: 'B.C. Rich short modern month-code import',
        additionalContext: {
            title: 'B.C. Rich short month-code serial',
            summary: 'This serial matches a short modern B.C. Rich import format parsed as month code, year, batch/factory code, and production sequence.',
            highlights: [
                `The prefix ${monthCode} decodes as ${month}.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digit ${batchCode} is treated as a factory or batch code.`,
                `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'B.C. Rich used inconsistent import serial systems across ownership eras.',
                'F-prefix serials can also appear on older pre-2000 imports where the code may not follow this modern date format.',
                'Use the physical serial location, country marking, and model era to choose between the modern and older interpretations.',
            ],
            verificationTips: [
                'If the serial is on the back of the headstock, the modern month-code interpretation is more likely.',
                'If the serial is on a metal neck plate, treat the older import/Class Axe-era interpretation as possible.',
                'Check neck pocket or electronics-cavity dates when available.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a short modern B.C. Rich import format parsed as month code, year, batch/factory code, and production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The prefix ${monthCode} decodes as ${month}. The digits ${yearDigits} decode as production year ${year}. The digit ${batchCode} is treated as a factory or batch code. The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich used inconsistent import serial systems across ownership eras.</li><li>F-prefix serials can also appear on older pre-2000 imports where the code may not follow this modern date format.</li><li>Use the physical serial location, country marking, and model era to choose between the modern and older interpretations.</li></ul>`,
    };
}
function decodeBPrefixMonthCodeImport(serial) {
    const factoryPrefix = serial[0];
    const monthCode = serial[1];
    const yearDigits = serial.slice(2, 4);
    const sequence = serial.slice(4);
    const yearNum = parseInt(yearDigits, 10);
    const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    const month = MONTH_CODE_MAP[monthCode];
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'China import production (B-prefix factory/line)',
        country: 'China',
        notes: `B-prefix modern B.C. Rich import format interpreted as factory/line prefix + month code + YY + sequence. ${factoryPrefix} is treated as a Chinese import factory or production-line prefix; ${monthCode} indicates ${month}; digits ${yearDigits} indicate production year ${year}; remaining digits are production sequence ${parseInt(sequence, 10)}. B.C. Rich import serials from this era can be inconsistent, so verify with country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-b-prefix-month-code-import',
        patternLabel: 'B.C. Rich B-prefix month-code import',
        additionalContext: {
            title: 'B.C. Rich B-prefix import serial',
            summary: 'This serial matches a modern B.C. Rich import format parsed as B-prefix factory/line code, month letter, production year, and sequence.',
            highlights: [
                `${factoryPrefix} is treated as a Chinese import factory or production-line prefix.`,
                `The month code ${monthCode} decodes as ${month}.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'B.C. Rich serial numbering is inconsistent across import eras and ownership periods.',
                'This serial pattern identifies likely date and import family, not the exact model name.',
                'Some bolt-on budget models used serial systems that are less reliable than factory date stamps.',
            ],
            verificationTips: [
                'Check for Made in China or other country-of-origin markings near the serial or on the headstock.',
                'Compare body shape, pickups, bridge, and trim against late-2000s B.C. Rich import catalogs.',
                'Use neck pocket, electronics-cavity, or label dates if the instrument has them.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern B.C. Rich import format parsed as B-prefix factory/line code, month letter, production year, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>${factoryPrefix} is treated as a Chinese import factory or production-line prefix. The month code ${monthCode} decodes as ${month}. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across import eras and ownership periods.</li><li>This serial pattern identifies likely date and import family, not the exact model name.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
    };
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
function decodeFSixDigitImport(serial) {
    const prefix = serial[0];
    const yearDigits = serial.slice(1, 3);
    const sequence = serial.slice(3);
    const yearNum = parseInt(yearDigits, 10);
    const modernYear = 2000 + yearNum;
    const earlyYear = 2000 + parseInt(yearDigits[0], 10);
    const yearText = yearNum >= 10
        ? `${modernYear} or ${earlyYear} (context-dependent import estimate)`
        : `${modernYear} (estimated)`;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: yearText,
        factory: `${prefix}-prefix import production`,
        country: 'South Korea / China / Taiwan',
        notes: `F-prefix six-digit B.C. Rich import format interpreted as factory/line prefix + year code + sequence. ${prefix} is treated as an import factory, line, or product-tier prefix; digits ${yearDigits} can indicate ${modernYear}, or ${earlyYear} on early-2000s Hanser-era examples; remaining digits are production sequence ${parseInt(sequence, 10)}. If this serial is stamped on a metal neck plate, it may instead be a Class Axe-era import plate where the number is a non-date inventory ID. Verify with serial location, country-of-origin markings, neck construction, and model-era features.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-f-prefix-six-digit-import',
        patternLabel: 'B.C. Rich F-prefix six-digit import',
        additionalContext: {
            title: 'B.C. Rich F-prefix import serial',
            summary: 'This serial matches an F-prefix B.C. Rich import format that can represent a Hanser-era factory/date code or an older Class Axe-era plate number depending on where it appears.',
            highlights: [
                `${prefix} is treated as an import factory, line, or product-tier prefix.`,
                `The digits ${yearDigits} can indicate ${modernYear}, or ${earlyYear} on early-2000s examples.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)} in the date-code interpretation.`,
            ],
            caveats: [
                'B.C. Rich serial numbering is inconsistent across import eras and ownership periods.',
                'If this is on a metal bolt-on neck plate, the number may be a Class Axe-era inventory ID rather than a date code.',
                'This serial pattern identifies likely import family, not the exact model name.',
            ],
            verificationTips: [
                'Check whether the serial is printed on the headstock wood or stamped on a metal neck plate.',
                'Look for Made in Korea, China, Taiwan, or Indonesia markings.',
                'Compare body shape, neck construction, pickups, bridge, and trim against B.C. Rich import catalogs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an F-prefix B.C. Rich import format that can represent a Hanser-era factory/date code or an older Class Axe-era plate number depending on where it appears.</p><h3>How This Pattern Is Typically Read</h3><p>${prefix} is treated as an import factory, line, or product-tier prefix. The digits ${yearDigits} can indicate ${modernYear}, or ${earlyYear} on early-2000s examples. The remaining digits decode as production sequence ${parseInt(sequence, 10)} in the date-code interpretation.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across import eras and ownership periods.</li><li>If this is on a metal bolt-on neck plate, the number may be a Class Axe-era inventory ID rather than a date code.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
    };
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
function decodeHanserEraNumericImport(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const quarterDigit = parseInt(serial[1], 10);
    const production = serial.slice(2);
    const year = 2000 + yearDigit;
    const alternateYear = 2010 + yearDigit;
    const quarter = quarterDigit >= 1 && quarterDigit <= 4 ? `Q${quarterDigit}` : undefined;
    const yearText = yearDigit <= 5
        ? `${year} or ${alternateYear} (likely ${year} for mid-2000s Hanser-era imports)`
        : `${year} (likely import estimate)`;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: yearText,
        factory: 'Hanser-era import production',
        country: 'South Korea / China / Indonesia',
        notes: `8-digit B.C. Rich import date-stamp format commonly seen on Hanser-era bolt-on/import models. First digit "${serial[0]}" is the year code, second digit "${serial[1]}" is the quarter${quarter ? ` (${quarter})` : ''}, and the remaining digits are production sequence ${parseInt(production, 10)}. A leading Sr# or serial-number label is not part of the serial. B.C. Rich import records are inconsistent, so confirm with country-of-origin markings, neck plate or sticker location, and model-era features.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-hanser-era-8-digit-import',
        patternLabel: 'B.C. Rich Hanser-era 8-digit import',
        additionalContext: {
            title: 'B.C. Rich 8-digit import serial',
            summary: 'This serial matches an 8-digit B.C. Rich import format often associated with Hanser-era bolt-on and import models.',
            highlights: [
                `The first digit ${serial[0]} is interpreted as the year code: ${yearText}.`,
                quarter ? `The second digit ${serial[1]} is interpreted as ${quarter}.` : `The second digit ${serial[1]} is not a clean Q1-Q4 quarter code.`,
                `The remaining digits decode as production sequence ${parseInt(production, 10)}.`,
            ],
            caveats: [
                'B.C. Rich import serial numbering is inconsistent across ownership eras.',
                'This format helps estimate date and import family, not the exact model name.',
                'Neck-plate and sticker serials on budget imports can be less authoritative than factory date stamps.',
            ],
            verificationTips: [
                'Check for a country-of-origin sticker or stamp near the serial.',
                'Compare the logo, neck plate, bridge, and pickups against mid-2000s and mid-2010s B.C. Rich catalogs.',
                'Inspect the neck pocket or electronics cavity for additional date markings when available.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an 8-digit B.C. Rich import format often associated with Hanser-era bolt-on and import models.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${serial[0]} is interpreted as the year code: ${yearText}. ${quarter ? `The second digit ${serial[1]} is interpreted as ${quarter}.` : `The second digit ${serial[1]} is not a clean Q1-Q4 quarter code.`} The remaining digits decode as production sequence ${parseInt(production, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich import serial numbering is inconsistent across ownership eras.</li><li>This format helps estimate date and import family, not the exact model name.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
    };
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
    const sequence = serial.slice(1);
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: '1989-1993 (estimated)',
        factory: 'Class Axe-era import production',
        country: 'South Korea / Japan',
        notes: `B-prefixed serial used on many late-1980s to early-1990s bolt-on B.C. Rich imports, especially Class Axe-era and related import neck-plate formats. The digits are treated as a production or neck-plate sequence (${parseInt(sequence, 10)}) rather than a reliable encoded date. These serials are often inconsistent or non-sequential, so confirm with headstock markings, neck plate style, country-of-origin stickers, wood construction, and electronics-cavity or neck-pocket clues.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-class-axe-b-prefix-import',
        patternLabel: 'B.C. Rich Class Axe-era B-prefix import',
        additionalContext: {
            title: 'B.C. Rich B-prefix import serial',
            summary: 'This serial matches a B-prefixed Class Axe-era import format commonly seen on late-1980s to early-1990s B.C. Rich bolt-on models.',
            highlights: [
                'The B prefix is treated as a Class Axe-era/import neck-plate prefix.',
                'The likely manufacturing window is 1989-1993.',
                `The remaining digits are treated as production or neck-plate sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'B.C. Rich serial records from this era are inconsistent and often not sequential.',
                'The serial can support an era estimate, but it should not be treated as an exact production date.',
                'Some budget imports from this period used lower-cost construction, so physical inspection matters.',
            ],
            verificationTips: [
                'Check whether the guitar is a bolt-on import and whether the serial appears on a neck plate.',
                'Look for country-of-origin stickers or stamps.',
                'Inspect the electronics cavity or neck pocket for wood construction and additional date markings.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a B-prefixed Class Axe-era import format commonly seen on late-1980s to early-1990s B.C. Rich bolt-on models.</p><h3>How This Pattern Is Typically Read</h3><p>The B prefix is treated as a Class Axe-era/import neck-plate prefix. The likely manufacturing window is 1989-1993. The remaining digits are treated as production or neck-plate sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial records from this era are inconsistent and often not sequential.</li><li>The serial can support an era estimate, but it should not be treated as an exact production date.</li><li>Check bolt-on construction, neck plate style, country markings, and electronics-cavity or neck-pocket clues.</li></ul>`,
    };
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
function decodeShortNumericImport(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const fillerDigit = serial[1];
    const quarterDigit = parseInt(serial[2], 10);
    const sequence = serial.slice(3);
    const year = 2000 + yearDigit;
    const quarter = quarterDigit >= 1 && quarterDigit <= 4 ? `Q${quarterDigit}` : undefined;
    const quarterNote = quarter
        ? `third digit indicates ${quarter}`
        : `third digit "${serial[2]}" does not map cleanly to Q1-Q4`;
    const info = {
        brand: 'B.C. Rich',
        serialNumber: serial,
        year: `${year} (likely import estimate)`,
        factory: 'Early-2000s import production',
        country: 'South Korea / China / Indonesia',
        notes: `Short 6-digit numeric B.C. Rich import format. Most likely interpretation: first digit indicates ${year}, second digit "${fillerDigit}" is commonly treated as a placeholder, ${quarterNote}, and final digits are production sequence ${sequence}. Because B.C. Rich serial records are inconsistent, this can overlap with Class Axe-era neck-plate numbers; verify with country-of-origin markings, headstock logo details, and neck pocket or electronics-cavity dates.`,
    };
    return {
        success: true,
        info,
        patternKey: 'bcrich-short-numeric-import-y-filler-quarter-sequence',
        patternLabel: 'B.C. Rich short numeric import',
        additionalContext: {
            title: 'B.C. Rich short numeric serial',
            summary: 'This 6-digit serial fits an early-2000s B.C. Rich import interpretation, with a possible Class Axe-era ambiguity.',
            highlights: [
                `The first digit ${serial[0]} is interpreted as production year ${year}.`,
                `The second digit ${fillerDigit} is commonly treated as a placeholder in this format.`,
                quarter ? `The third digit ${serial[2]} is interpreted as ${quarter}.` : `The third digit ${serial[2]} is not a clean quarter code.`,
                `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'B.C. Rich serial records are inconsistent across import eras.',
                'A 6-digit neck-plate serial can also indicate a late-1980s to early-1990s Class Axe-era instrument.',
                'Use physical markings to separate early-2000s imports from older Class Axe-era examples.',
            ],
            verificationTips: [
                'Check for a Made In marking or country-of-origin sticker.',
                'Inspect the headstock logo and any TM mark for Class Axe-era clues.',
                'Look in the neck pocket or electronics cavity for handwritten dates or inspector marks.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This 6-digit serial fits an early-2000s B.C. Rich import interpretation, with a possible Class Axe-era ambiguity.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${serial[0]} is interpreted as production year ${year}. The second digit ${fillerDigit} is commonly treated as a placeholder. ${quarter ? `The third digit ${serial[2]} is interpreted as ${quarter}.` : `The third digit ${serial[2]} is not a clean quarter code.`} The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial records are inconsistent across import eras.</li><li>A 6-digit neck-plate serial can also indicate a late-1980s to early-1990s Class Axe-era instrument.</li><li>Check country-of-origin markings, logo details, and neck pocket or electronics-cavity dates.</li></ul>`,
    };
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
