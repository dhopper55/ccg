/**
 * Washburn Guitar Serial Number Decoder
 *
 * Supports:
 * - Modern letter prefix format: F + YYMMRRRR (factory + year + month + sequence)
 * - Korean Samick: S prefix
 * - Indonesian Samick: SI prefix
 * - Indonesian generic: I prefix
 * - Chinese production: G prefix
 * - Cort production: C prefix
 * - Chinese CO/O/OCO variant prefix (single-digit year + 6-digit sequence)
 * - 1980s-1990s numeric formats
 * - Short serial numbers (4-5 digits) from 1970s-1980s
 *
 * Note: Pre-1978 guitars have no reliable serial number system.
 * Washburn has used many formats over the years (4-12 characters).
 */
export function decodeWashburn(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Samick Indonesia: SI prefix
    if (/^SI\d{7,9}$/.test(normalized)) {
        return decodeSamickIndonesia(normalized);
    }
    // Samick Korea: S prefix followed by digits
    if (/^S\d{7,9}$/.test(normalized)) {
        return decodeSamickKorea(normalized);
    }
    // Indonesian: I + year digit + factory/batch letter + sequence
    if (/^I\d[A-Z]\d{6}$/.test(normalized)) {
        return decodeIndonesiaYearFactorySequence(normalized);
    }
    // Indonesian: I prefix (non-SI)
    if (/^I\d{7,9}$/.test(normalized)) {
        return decodeIndonesia(normalized);
    }
    // Chinese: G prefix
    if (/^G\d{7,9}$/.test(normalized)) {
        return decodeChina(normalized);
    }
    // Cort: C prefix
    if (/^C\d{7,9}$/.test(normalized)) {
        return decodeCort(normalized);
    }
    // Yako: Y prefix
    if (/^Y\d{7,9}$/.test(normalized)) {
        return decodeYako(normalized);
    }
    // Zaozhuang Saehan: Z prefix (China)
    if (/^Z\d{7,9}$/.test(normalized)) {
        return decodeZaozhuang(normalized);
    }
    // Modern 2-character factory code + YYRRRR (6 digits, 8 chars total — no month segment)
    // e.g., 0C060872 = 0C factory, 2006, sequence 0872
    if (/^[A-Z0-9][A-Z]\d{6}$/.test(normalized)) {
        return decodeModernTwoCharFactoryYYSeq(normalized);
    }
    // Modern 2-character factory code (letter or leading digit) + YYMMRRRR (8 digits, 10 chars total)
    // e.g., OC05012755 = OC factory, 2005, January, #2755; 0C05012755 = same factory written with zero
    if (/^[A-Z0-9][A-Z]\d{8}$/.test(normalized)) {
        return decodeModernTwoCharFactoryYYMMSeq(normalized);
    }
    // China BC factory prefix: BC + plant(1) + YY(2) + sequence(4)
    // e.g. BC6061796 = China factory, plant 6, year 2006, sequence 1796
    if (/^BC\d{7}$/.test(normalized)) {
        return decodeWashburnBCChina(normalized);
    }
    // CO/O/OCO overseas China factory: prefix + single-digit year + 6-digit sequence
    // CO7052236 = CO factory, year 2007, sequence 052236; O and OCO are prefix variants
    // Must come before generic 2-letter YYWW handler which would misparse CO prefix as year 1970
    if (/^(OCO|CO|O)\d{7}$/.test(normalized)) {
        return decodeCOVariantFactory(normalized);
    }
    // N-factory YYMM sequence: N + [O0] + YYMM + 4-digit sequence
    // The second character is digit '0' commonly misread/entered as letter 'O'.
    // Must precede the generic 2-letter YYWW handler, which would parse NO as prefix and give year 2060.
    if (/^N[O0]\d{7}$/.test(normalized)) {
        return decodeNFactoryYYMMSequence(normalized);
    }
    // Modern 2-letter factory code + YYWW + 3-digit unit (e.g., UO2045971)
    if (/^[A-Z]{2}\d{7}$/.test(normalized)) {
        return decodeModernTwoLetterYYWW(normalized);
    }
    // Late-1980s Japanese: single letter + 1-digit year + 5-digit sequence (e.g., K801108)
    if (/^[A-Z]\d{6}$/.test(normalized)) {
        return decodeLate80sJapaneseSingleLetter(normalized);
    }
    // One-to-three letter prefix format (e.g., OC, SC, N, YBJ + digits)
    if (/^[A-Z]{1,3}\d{8,10}$/.test(normalized)) {
        return decodeLetterPrefix(normalized);
    }
    // Late-1980s/1990s 10-digit tracking format: YYMM + 6-digit sequence
    if (/^[89]\d{3}\d{6}$/.test(normalized)) {
        return decodeLate80s90sNumeric10Digit(normalized);
    }
    // Modern numeric: 8+ digits starting with year
    if (/^\d{8,12}$/.test(normalized)) {
        return decodeModernNumeric(normalized);
    }
    // 7-digit format (1990s)
    if (/^\d{7}$/.test(normalized)) {
        return decode7Digit(normalized);
    }
    // 6-digit format (1980s-1990s)
    if (/^\d{6}$/.test(normalized)) {
        return decode6Digit(normalized);
    }
    // Short 4-5 digit format (1970s-early 1980s)
    if (/^\d{4,5}$/.test(normalized)) {
        return decodeShort(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Washburn serial number. The format was not recognized. Washburn has used many serial number formats over the years (4-12 characters). Common formats include: letter prefix + digits (S, SI, I, G, C), or numeric formats where the first 1-2 digits indicate the year. For pre-1978 instruments, no reliable serial number records exist.',
    };
}
function decodeIndonesiaYearFactorySequence(serial) {
    const yearDigit = serial[1];
    const factoryCode = serial[2];
    const sequence = serial.substring(3);
    const possibleYears = getSingleDigitImportYears(parseInt(yearDigit, 10));
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: possibleYears,
        factory: 'Indonesia (Samick or PT Cort facility)',
        country: 'Indonesia',
        notes: `I prefix indicates Indonesian Washburn production. Parsed as I + single-digit year code (${yearDigit}) + factory/batch code ${factoryCode} + sequence ${sequence}. The year digit can indicate ${possibleYears} depending on the model era; verify the exact decade from the instrument model, label, and hardware.`,
    };
    return {
        success: true,
        info,
        patternKey: 'washburn-indonesia-i-year-letter-sequence',
        patternLabel: 'Washburn Indonesia I year-letter sequence',
        additionalContext: {
            title: 'Washburn Indonesian I-prefix serial',
            summary: 'This serial matches an Indonesian Washburn I-prefix import format with a single-digit year code, a factory or batch letter, and a production sequence.',
            highlights: [
                'I indicates Indonesian production.',
                `The year digit ${yearDigit} can point to ${possibleYears}, depending on model era.`,
                `The letter ${factoryCode} is treated as a factory or batch code.`,
                `The remaining digits are production sequence ${sequence}.`,
            ],
            caveats: [
                'Washburn serial systems varied significantly by factory and model era.',
                'The single year digit is ambiguous between decades without model context.',
                'The serial does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock or soundhole label for country-of-origin markings.',
                'Use the model name and specs to decide whether the year digit fits 1998 or 2008.',
                'Contact Washburn support with clear photos when exact identification matters.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an Indonesian Washburn I-prefix import format with a single-digit year code, a factory or batch letter, and a production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>I indicates Indonesian production. The year digit ${yearDigit} can point to ${possibleYears}, depending on model era. The letter ${factoryCode} is treated as a factory or batch code. The remaining digits are production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Washburn serial systems varied significantly by factory and model era.</li><li>The single year digit is ambiguous between decades without model context.</li><li>The serial does not encode the exact model name.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as an Indonesian Washburn decode, then confirm the decade and model from the headstock, soundhole label, hardware, and Washburn support if needed.</p>`,
    };
}
// Samick Indonesia: SI prefix
function decodeSamickIndonesia(serial) {
    const digits = serial.substring(2);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Samick Indonesia (Cileungsi)',
        country: 'Indonesia',
        notes: `SI prefix indicates Samick Indonesia production (Cileungsi facility, opened 1992). Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Samick Korea: S prefix
function decodeSamickKorea(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Samick Korea',
        country: 'South Korea',
        notes: `S prefix indicates Samick Korea production. By 1991, most Washburn production had shifted to Korea. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian: I prefix
function decodeIndonesia(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Indonesia',
        country: 'Indonesia',
        notes: `I prefix indicates Indonesian production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Chinese: G prefix
function decodeChina(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'China',
        country: 'China',
        notes: `G prefix indicates Chinese production. As of 2017, primary production shifted from Korea to Indonesia and China. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Cort: C prefix
function decodeCort(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Cort',
        country: 'South Korea',
        notes: `C prefix indicates Cort factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Yako: Y prefix
function decodeYako(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Yako',
        country: 'China',
        notes: `Y prefix indicates Yako factory production in China. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Zaozhuang Saehan: Z prefix (China)
function decodeZaozhuang(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseYearMonthSequence(digits);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Zaozhuang Saehan',
        country: 'China',
        notes: `Z prefix indicates Zaozhuang Saehan factory production in China (Shandong province). Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Modern 2-char factory code (letter or leading digit) + YYMMRRRR (10-char total)
const WASHBURN_MODERN_TWO_CHAR_FACTORY_MAP = {
    OC: { factory: 'Chinese contract factory (Qingdao or Cort/Cor-Tek China facility)', country: 'China' },
    '0C': { factory: 'Chinese contract factory (Qingdao or Cort/Cor-Tek China facility)', country: 'China' },
    SC: { factory: 'Asian contract factory (SC)', country: 'Asia' },
    NC: { factory: 'Asian contract factory (NC)', country: 'Asia' },
    YC: { factory: 'Asian contract factory (YC)', country: 'Asia' },
    IC: { factory: 'Indonesian contract factory (IC)', country: 'Indonesia' },
};
function decodeModernTwoCharFactoryYYMMSeq(serial) {
    const prefix = serial.substring(0, 2);
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const monthNum = parseInt(monthDigits, 10);
    const isValidMonth = monthNum >= 1 && monthNum <= 12;
    const monthName = isValidMonth ? getMonthName(monthNum) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const factoryInfo = WASHBURN_MODERN_TWO_CHAR_FACTORY_MAP[prefix];
    const factory = factoryInfo?.factory ?? `Asian contract factory (${prefix})`;
    const country = factoryInfo?.country ?? 'Asia';
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year,
        ...(monthName ? { month: monthName } : {}),
        factory,
        country,
        notes: `Modern Washburn import serial format (2-character factory code + YYMMRRRR). "${prefix}" is the factory code indicating ${factory}. The digits ${yearDigits} indicate production year ${year}. The digits ${monthDigits} indicate ${isValidMonth ? monthName : `a batch or production code ("${monthDigits}") rather than a standard calendar month`}. Production sequence: ${sequenceNumber}. Since the early 2000s, Washburn's Asian contracted factories settled on this 10-character format — two characters (factory code) followed by 8 digits (YYMMRRRR). Washburn serial numbers identify where and when a guitar was made; the model name must be confirmed separately from the headstock, soundhole label, or hardware. Electrics typically have this serial stamped on the back of the headstock; acoustics will have it on the interior soundhole label.`,
    };
    return {
        success: true,
        info,
        patternKey: `washburn-modern-two-char-factory-yymm-sequence`,
        patternLabel: `Washburn modern ${prefix} factory YYMMRRRR format`,
        additionalContext: {
            title: `Washburn modern ${prefix}-prefix serial`,
            summary: `This serial matches the modern Washburn import format: 2-character factory code + YYMMRRRR. The digits encode production year, month, and 4-digit production ranking.`,
            highlights: [
                `"${prefix}" is the factory code indicating ${factory}.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                isValidMonth
                    ? `The digits ${monthDigits} decode as ${monthName}.`
                    : `The digits ${monthDigits} are a batch or production code, not a standard calendar month.`,
                `The remaining digits decode as production ranking #${sequenceNumber} within that run.`,
            ],
            caveats: [
                'Washburn serial numbers only identify when and where a guitar was built — not the model name.',
                'Since Washburn has changed serial systems many times, the exact factory interpretation for some two-letter codes is approximate.',
                'The serial can confirm the era of production, but model-specific details require the headstock logo, label, and hardware.',
            ],
            verificationTips: [
                'For electrics: check the back of the headstock for the stamped or printed serial.',
                'For acoustics: look at the paper label inside the soundhole.',
                'Compare the body style, pickup configuration, and hardware against Washburn catalog specs for the decoded year.',
                'Contact Washburn support with clear photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Washburn import format: 2-character factory code + YYMMRRRR. Since the early 2000s, Washburn's Asian contracted factories settled on this 10-character formula.</p><h3>How This Pattern Is Typically Read</h3><p>"${prefix}" is the factory code indicating ${factory}. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${isValidMonth ? monthName : `a batch or production code, not a standard calendar month`}. The remaining digits decode as production ranking #${sequenceNumber} within that run.</p><h3>What To Verify</h3><ul><li>Washburn serial numbers only identify when and where a guitar was built — the model name must be confirmed separately.</li><li>For electrics, check the back of the headstock; for acoustics, check the soundhole label.</li><li>Compare the body style, pickups, and hardware against Washburn catalog specs for the decoded year.</li></ul>`,
    };
}
// Modern 2-character factory code + YYRRRR (8 chars total, no month segment)
// e.g., 0C060872 = 0C factory, 2006, sequence 0872
function decodeModernTwoCharFactoryYYSeq(serial) {
    const prefix = serial.substring(0, 2);
    const yearDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const sequenceNumber = parseInt(sequence, 10);
    const factoryInfo = WASHBURN_MODERN_TWO_CHAR_FACTORY_MAP[prefix];
    const factory = factoryInfo?.factory ?? `Asian contract factory (${prefix})`;
    const country = factoryInfo?.country ?? 'Asia';
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year,
        factory,
        country,
        notes: `Modern Washburn import serial format (2-character factory code + YY + 4-digit sequence). "${prefix}" is the factory code indicating ${factory}. The digits ${yearDigits} indicate production year ${year}. Production sequence: ${sequenceNumber}. This shorter format omits a month code. Washburn serial numbers identify where and when a guitar was made; confirm the model from the headstock, soundhole label, or hardware.`,
    };
    return {
        success: true,
        info,
        patternKey: `washburn-modern-two-char-factory-yy-sequence`,
        patternLabel: `Washburn modern ${prefix} factory YY sequence format`,
        additionalContext: {
            title: `Washburn modern ${prefix}-prefix serial`,
            summary: `This serial matches a modern Washburn import format: 2-character factory code + 2-digit year + 4-digit production sequence (no month segment).`,
            highlights: [
                `"${prefix}" is the factory code indicating ${factory}.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence #${sequenceNumber}.`,
            ],
            caveats: [
                'Washburn serial numbers only identify when and where a guitar was built — not the model name.',
                'This shorter format does not include a month code.',
                'The exact factory interpretation for some two-character codes is approximate.',
            ],
            verificationTips: [
                'For electrics: check the back of the headstock for the stamped or printed serial.',
                'For acoustics: look at the paper label inside the soundhole.',
                'Compare the body style, pickup configuration, and hardware against Washburn catalog specs for the decoded year.',
                'Contact Washburn support with clear photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Washburn import format: 2-character factory code + 2-digit year + 4-digit production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>"${prefix}" is the factory code indicating ${factory}. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence #${sequenceNumber}. This shorter format does not include a month code.</p><h3>What To Verify</h3><ul><li>Washburn serial numbers only identify when and where a guitar was built — the model name must be confirmed separately.</li><li>For electrics, check the back of the headstock; for acoustics, check the soundhole label.</li><li>Compare the body style, pickups, and hardware against Washburn catalog specs for the decoded year.</li></ul>`,
    };
}
// Modern 2-letter factory code + YYWW + 3-digit unit
function decodeNFactoryYYMMSequence(serial) {
    // Treat position 2 as digit '0' regardless of whether 'O' or '0' was entered
    const digits = '0' + serial.substring(2);
    const yy = parseInt(digits.substring(0, 2), 10);
    const mm = parseInt(digits.substring(2, 4), 10);
    const seq = digits.substring(4);
    const year = 2000 + yy;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = mm >= 1 && mm <= 12 ? monthNames[mm - 1] : undefined;
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Asian contracted factory (N-series)',
        country: 'Asia (China, Korea, or Indonesia)',
        notes: `N-factory YYMM sequence format. The second character may be the digit 0 entered or printed as the letter O — both are treated identically. N is the factory prefix code. ${String(yy).padStart(2, '0')} indicates ${year}. ${String(mm).padStart(2, '0')} indicates ${month ?? 'unknown month'}. Production sequence: ${seq}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'washburn-n-factory-yymm-sequence',
        patternLabel: 'Washburn N-factory YYMM sequence',
        additionalContext: {
            title: 'Washburn N-factory YYMM serial',
            summary: 'This serial matches a Washburn N-factory YYMM sequence format where the second character (O or 0) is the digit zero.',
            highlights: [
                `N is the factory prefix code for the contracted Asian manufacturing facility.`,
                `Production year: ${year}.`,
                `Production month: ${month ?? 'unknown'}.`,
                `Production sequence: ${seq}.`,
            ],
            caveats: [
                'The second character is frequently entered as the letter O when it is actually the digit 0 — both are decoded identically.',
                'Factory identification beyond the N-prefix requires the specific model label or factory sticker.',
            ],
            verificationTips: [
                'Check the label inside the body or the back of the headstock for the exact model name and country of manufacture.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Washburn N-factory YYMM sequence. The second character is the digit zero, which is commonly entered or printed as the letter O — both decode identically.</p><h3>How It Decodes</h3><p>N is the factory prefix. The digit string after N decodes as: year ${year}, month ${month ?? 'unknown'}, production sequence ${seq}.</p><h3>Coal Creek Guitars Note</h3><p>Confirm the model with the inside label or headstock markings. The N-prefix identifies the contracted Asian factory (Cort, Samick, or related) but the specific facility varies by year and model.</p>`,
    };
}
function decodeModernTwoLetterYYWW(serial) {
    const prefix = serial.substring(0, 2);
    const yearDigits = serial.substring(2, 4);
    const weekDigits = serial.substring(4, 6);
    const unit = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const week = parseInt(weekDigits, 10);
    const month = week >= 1 && week <= 53 ? getMonthName(Math.min(12, Math.ceil((week * 12) / 52))) : undefined;
    const twoLetterFactories = {
        UO: { factory: 'Unsung Musical Instrument Co.', country: 'South Korea or China' },
        SI: { factory: 'Samick Indonesia (Cileungsi)', country: 'Indonesia' },
        OC: { factory: 'Asian contracted factory (OC)', country: 'Asia' },
        SC: { factory: 'Asian contracted factory (SC)', country: 'Asia' },
    };
    const known = twoLetterFactories[prefix];
    const factory = known ? known.factory : `Asian contracted factory (${prefix})`;
    const country = known ? known.country : 'Asia';
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory,
        country,
        notes: `Modern Washburn 2-letter factory code format. ${prefix} is the factory prefix indicating ${factory}. ${yearDigits} indicates ${year}. ${weekDigits} is production week ${week}${month ? ` (approximately ${month})` : ''}. ${unit} is the unit number within that batch.`,
    };
    return {
        success: true,
        info,
        patternKey: `washburn-modern-2-letter-${prefix.toLowerCase()}-yyww-unit`,
        patternLabel: `Washburn modern ${prefix} factory YYWW unit format`,
        additionalContext: {
            title: `Washburn modern ${prefix}-prefix serial`,
            summary: `This serial matches a modern Washburn import format using a 2-letter factory code, 2-digit year, 2-digit production week, and 3-digit unit number.`,
            highlights: [
                `${prefix} is the factory code indicating ${factory}.`,
                `${yearDigits} decodes as production year ${year}.`,
                `${weekDigits} decodes as production week ${week}${month ? ` (approximately ${month})` : ''}.`,
                `${unit} is the unit number within that batch.`,
            ],
            caveats: [
                'Washburn has used many 2-letter factory codes across different Asian facilities.',
                'The week number gives an approximate month rather than an exact date.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock or soundhole label for the country-of-origin marking.',
                'Compare hardware, pickups, and finish against the catalog for the decoded year.',
                'Contact Washburn support with clear photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Washburn import format using a 2-letter factory code, 2-digit year, 2-digit production week, and 3-digit unit number.</p><h3>How This Pattern Is Typically Read</h3><p>${prefix} is the factory code indicating ${factory}. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as production week ${week}${month ? `, approximately ${month}` : ''}. The final digits ${unit} are the unit number within that batch.</p><h3>What To Verify</h3><ul><li>Washburn has used many 2-letter factory codes across different Asian facilities.</li><li>The week number gives an approximate month rather than an exact date.</li><li>This format does not encode the exact model name — confirm it from headstock, label, and hardware.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a modern Washburn import decode, then confirm the exact model and factory from the headstock, soundhole label, or Washburn support if needed.</p>`,
    };
}
function decodeCOVariantFactory(serial) {
    const prefixMatch = serial.match(/^(OCO|CO|O)(\d)(\d{6})$/);
    if (!prefixMatch)
        return { success: false, error: 'Unable to decode CO-variant factory serial.' };
    const prefix = prefixMatch[1];
    const yearDigit = prefixMatch[2];
    const sequence = prefixMatch[3];
    const year = 2000 + parseInt(yearDigit, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const factory = 'Chinese contract factory (CO/OC overseas facility, Qingdao or Cort China)';
    const country = 'China';
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year.toString(),
        factory,
        country,
        notes: `Washburn CO-variant factory prefix format. ${prefix} identifies a Chinese contracted production facility. ${yearDigit} is the single-digit year code indicating ${year}. ${sequence} is the 6-digit production sequence number ${sequenceNumber}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'washburn-co-variant-factory-y-sequence',
        patternLabel: 'Washburn CO-variant overseas factory single-year sequence',
        additionalContext: {
            title: `Washburn ${prefix}-prefix serial (CO-variant overseas factory)`,
            summary: `This serial follows a Washburn import format using a factory prefix (${prefix}), a single-digit year code, and a 6-digit production sequence number.`,
            highlights: [
                `${prefix} is the factory prefix indicating a Chinese contracted production facility.`,
                `${yearDigit} is the single-digit year code decoding as production year ${year}.`,
                `${sequence} is the 6-digit production sequence number (unit ${sequenceNumber}).`,
            ],
            caveats: [
                `The single-digit year is ambiguous — "${yearDigit}" most commonly indicates ${year} but could also indicate ${year + 10} for newer guitars.`,
                'CO, O, and OCO are all variants of the same Chinese overseas factory code used by Washburn on different label and stamp conventions.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock or soundhole label for country-of-origin and year markings.',
                'Compare hardware, pickups, and finish against the Washburn catalog for the decoded year.',
                'Contact Washburn support with clear photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial follows a Washburn import format using a factory prefix (${prefix}), a single-digit year code, and a 6-digit production sequence number.</p><h3>How This Pattern Is Typically Read</h3><p>${prefix} is the factory prefix identifying a Chinese contracted production facility. The digit ${yearDigit} is the single-digit year code decoding as production year ${year}. The remaining digits ${sequence} are the 6-digit production sequence (unit ${sequenceNumber}).</p><h3>What To Verify</h3><ul><li>The single-digit year is somewhat ambiguous — "${yearDigit}" most commonly indicates ${year} but could indicate ${year + 10} for guitars that appear to be from a decade later.</li><li>CO, O, and OCO are all variants of the same Chinese overseas factory code used on different Washburn label and stamp conventions.</li><li>This format does not encode the exact model name — confirm from headstock, label, and hardware.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a modern Washburn China import decode from ${year}. Verify the exact model and year from the guitar itself if needed.</p>`,
    };
}
// Late-1980s Japanese: single letter + 1-digit year + 5-digit sequence
function decodeLate80sJapaneseSingleLetter(serial) {
    const factoryLetter = serial[0];
    const yearDigit = parseInt(serial[1], 10);
    const sequence = serial.substring(2);
    // Year digit: 8=1988, 9=1989, 0=1990, 1=1991, etc.
    const year = yearDigit >= 5 ? 1980 + yearDigit : 1990 + yearDigit;
    const japaneseFactories = {
        K: 'Chushin Gakki (premium neck-through electrics)',
        M: 'Japanese factory (M-series)',
        R: 'Peerless / Japanese factory (R-series)',
        N: 'Japanese factory (N-series)',
    };
    const factory = japaneseFactories[factoryLetter] ?? `Japanese factory (${factoryLetter}-series)`;
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year.toString(),
        factory,
        country: 'Japan',
        notes: `Late-1980s Japanese Washburn format. ${factoryLetter} identifies the factory as ${factory}. ${serial[1]} is the year digit indicating ${year}. ${sequence} is the sequential production number. This era produced many of Washburn's highest-regarded instruments, including neck-through electrics with premium hardware.`,
    };
    return {
        success: true,
        info,
        patternKey: `washburn-late80s-japan-${factoryLetter.toLowerCase()}-year-sequence`,
        patternLabel: `Washburn late-1980s Japan ${factoryLetter}-prefix year sequence`,
        additionalContext: {
            title: `Washburn late-1980s Japanese ${factoryLetter}-prefix serial`,
            summary: `This serial matches a late-1980s Washburn serial format from Japanese production where a single factory letter is followed by a year digit and a 5-digit sequential production number.`,
            highlights: [
                `${factoryLetter} identifies the factory as ${factory}.`,
                `The digit ${serial[1]} decodes as production year ${year}.`,
                `${sequence} is the sequential production number within that year.`,
            ],
            caveats: [
                'Japanese Washburn serial documentation from this era is not fully standardized.',
                'The single year digit cannot distinguish between, for example, 1988 and 1998 without model context.',
                'Factory attribution for some letter prefixes is approximate; physical inspection is recommended.',
            ],
            verificationTips: [
                'Check the back of the headstock or neck plate for Made in Japan markings.',
                'Compare the instrument against late-1980s Washburn catalogs (EC, MG, and Festival series are common from this era).',
                'Look for neck-through construction, active electronics, and Floyd Rose hardware as era indicators.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a late-1980s Washburn format from Japanese production where a single factory letter is followed by a year digit and a 5-digit sequential production number.</p><h3>How This Pattern Is Typically Read</h3><p>${factoryLetter} identifies the factory as ${factory}. The digit ${serial[1]} decodes as production year ${year}. The digits ${sequence} are the sequential production number within that year.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or neck plate for Made in Japan markings.</li><li>Compare against late-1980s Washburn catalogs for the EC, MG, and shredder-era series.</li><li>Neck-through construction, active electronics, and premium hardware are common on these instruments.</li></ul><h3>Coal Creek Guitars Note</h3><p>Late-1980s Japanese Washburns are among the brand's most collectible instruments. Use the model features alongside this decode to confirm the exact year and series.</p>`,
    };
}
// One-to-three letter prefix format
function decodeLetterPrefix(serial) {
    const match = serial.match(/^([A-Z]{1,3})(\d+)$/);
    if (!match) {
        return { success: false, error: 'Invalid letter prefix format.' };
    }
    const prefix = match[1];
    const digits = match[2];
    const { year, month, sequence } = parseYearMonthSequence(digits);
    // Try to identify factory from prefix
    let factory = 'Unknown factory';
    let country = 'Unknown';
    let notes = '';
    // Known prefixes
    switch (prefix) {
        case 'N':
            factory = 'Unknown factory';
            country = 'Asia';
            notes = 'N prefix - exact factory unknown.';
            break;
        case 'OC':
            factory = 'Unknown factory';
            country = 'Asia';
            notes = 'OC prefix - exact factory unknown.';
            break;
        case 'SC':
            factory = 'Unknown factory';
            country = 'Asia';
            notes = 'SC prefix - exact factory unknown.';
            break;
        case 'R':
            factory = 'Peerless Korea';
            country = 'South Korea';
            notes = 'R prefix indicates Peerless factory in Korea.';
            break;
        case 'YBJ':
            factory = 'Asian contracted factory (YBJ)';
            country = 'China or Indonesia';
            notes = 'YBJ is a multi-letter factory code identifying a specific contracted Asian facility. Common on modern Washburn imports. Year and month are encoded in the first four digits after the prefix.';
            break;
        default:
            notes = `${prefix} prefix - factory identification uncertain.`;
    }
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: country,
        notes: `${notes} Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
function decodeLate80s90sNumeric10Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 1900 + parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Washburn import tracking format; likely South Korea unless USA/custom-shop markings indicate otherwise',
        country: 'South Korea or USA',
        notes: `Late-1980s/1990s Washburn 10-digit numeric tracking format. The first two digits (${yearDigits}) indicate ${year}; the next two digits (${monthDigits})${month ? ` indicate ${month}` : ' are not a valid calendar month'}; ${sequence} is the production tracking sequence. This format identifies production timing, but the exact factory and model require label, headstock, or country-of-origin markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'washburn-1990s-10-digit-yymm-sequence',
        patternLabel: 'Washburn 1990s 10-digit YYMM sequence',
        additionalContext: {
            title: 'Washburn 1990s 10-digit numeric serial',
            summary: 'This serial matches a late-1980s/1990s Washburn numeric tracking format where the first four digits identify production year and month.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                month ? `The next two digits ${monthDigits} decode as ${month}.` : `The next two digits ${monthDigits} are not a valid calendar month.`,
                `The final six digits decode as tracking sequence ${sequence}.`,
            ],
            caveats: [
                'Washburn used multiple factories and serial systems in this era.',
                'The serial alone does not identify the exact model name or body shape.',
                'South Korean import production was common in 1992, but USA/custom-shop markings should override that assumption.',
            ],
            verificationTips: [
                'Check for Made in Korea, USA, or custom-shop markings on the headstock, label, or neck plate.',
                'Compare the instrument against 1992 Washburn catalog models such as N-series, Mercury, or Festival-series instruments.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a late-1980s/1990s Washburn 10-digit numeric tracking format where the first four digits identify production year and month.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The next two digits ${monthDigits}${month ? ` decode as ${month}` : ' are not a valid calendar month'}. The final six digits decode as tracking sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Washburn used multiple factories and serial systems in this era.</li><li>The serial alone does not identify the exact model name or body shape.</li><li>Check country-of-origin, custom-shop, headstock, and label markings to separate Korean import production from USA production.</li></ul>`,
    };
}
// Modern numeric format (8+ digits)
function decodeModernNumeric(serial) {
    const length = serial.length;
    // For 8-9 digit serials, first 2 digits are typically year
    if (length === 8 || length === 9) {
        const yearDigits = serial.substring(0, 2);
        const yearNum = parseInt(yearDigits, 10);
        let year;
        if (yearNum >= 60 && yearNum <= 99) {
            year = `19${yearDigits}`;
        }
        else if (yearNum >= 0 && yearNum <= 30) {
            year = `20${yearDigits.padStart(2, '0')}`;
        }
        else {
            year = `Possibly 19${yearDigits} or 20${yearDigits}`;
        }
        const remaining = serial.substring(2);
        let month;
        // Check if next 2 digits could be month
        if (remaining.length >= 2) {
            const monthNum = parseInt(remaining.substring(0, 2), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                month = getMonthName(monthNum);
            }
        }
        const info = {
            brand: 'Washburn',
            serialNumber: serial,
            year: year,
            month: month,
            factory: 'Various (Korea, Indonesia, or China)',
            country: 'Asia',
            notes: `Numeric serial number format. First two digits (${yearDigits}) typically indicate year of manufacture. Production location requires additional identification from the instrument.`,
        };
        return { success: true, info };
    }
    // For 10+ digit serials (post-2010), first 4 digits may be YYMM
    if (length >= 10) {
        const yearDigits = serial.substring(0, 2);
        const monthDigits = serial.substring(2, 4);
        const yearNum = parseInt(yearDigits, 10);
        const monthNum = parseInt(monthDigits, 10);
        let year;
        if (yearNum >= 10 && yearNum <= 30) {
            year = `20${yearDigits}`;
        }
        else {
            year = `20${yearDigits}`;
        }
        let month;
        if (monthNum >= 1 && monthNum <= 12) {
            month = getMonthName(monthNum);
        }
        const sequence = serial.substring(4);
        const info = {
            brand: 'Washburn',
            serialNumber: serial,
            year: year,
            month: month,
            factory: 'Various',
            country: 'Asia',
            notes: `Post-2010 format. First four digits (${yearDigits}${monthDigits}) typically indicate year and month of manufacture. Sequence: ${sequence}.`,
        };
        return { success: true, info };
    }
    return {
        success: false,
        error: 'Unable to interpret this numeric serial number format.',
    };
}
// 7-digit format (1990s)
function decode7Digit(serial) {
    // First digit or first two digits could be year
    const firstTwo = serial.substring(0, 2);
    const yearNum = parseInt(firstTwo, 10);
    let year;
    let monthDigits;
    let sequence;
    if (yearNum >= 80 && yearNum <= 99) {
        // Two-digit year (80-99 = 1980-1999)
        year = `19${firstTwo}`;
        monthDigits = serial.substring(2, 4);
        sequence = serial.substring(4);
    }
    else {
        // Single-digit year (0-9 = 1990-1999)
        const singleYear = parseInt(serial.substring(0, 1), 10);
        year = `199${singleYear}`;
        monthDigits = serial.substring(1, 3);
        sequence = serial.substring(3);
    }
    const monthNum = parseInt(monthDigits, 10);
    let month;
    if (monthNum >= 1 && monthNum <= 12) {
        month = getMonthName(monthNum);
    }
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Samick Korea or similar',
        country: 'South Korea',
        notes: `7-digit format typical of 1990s Korean production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// 6-digit format (1980s-1990s)
function decode6Digit(serial) {
    const firstTwo = serial.substring(0, 2);
    const yearNum = parseInt(firstTwo, 10);
    if (yearNum >= 80 && yearNum <= 99) {
        const info = {
            brand: 'Washburn',
            serialNumber: serial,
            year: `19${firstTwo}`,
            factory: 'Various',
            country: 'Japan or South Korea',
            notes: `6-digit serial number. For 1980s instruments, the first two digits (${firstTwo}) typically indicate year of manufacture. Production location may be Japan or Korea depending on the model and label markings.`,
        };
        return { success: true, info };
    }
    if (yearNum >= 0 && yearNum <= 30) {
        const info = {
            brand: 'Washburn',
            serialNumber: serial,
            year: 'late 1970s-early 1980s (estimated)',
            factory: 'Japan (often Yamaki or another Japanese partner)',
            country: 'Japan',
            notes: `Short 6-digit numeric serials without a letter prefix are commonly associated with late-1970s to early-1980s Washburn production in Japan. Serial ${serial} fits that legacy import pattern better than later date-coded formats. Use the headstock logo, label, and hardware to narrow the exact year.`,
        };
        return {
            success: true,
            info,
            patternKey: 'washburn-legacy-japan-6-digit',
            patternLabel: 'Washburn legacy Japan 6-digit numeric',
            additionalContext: {
                title: 'Washburn legacy 6-digit numeric serial',
                summary: 'This short all-numeric serial aligns with an older Washburn Japan-era numbering style rather than a later modern date-coded import format.',
                highlights: [
                    'Commonly seen on late-1970s to early-1980s Washburns.',
                    'Often associated with Japanese production partners such as Yamaki.',
                    `Serial ${serial} should be treated as a legacy sequence, not a precise YYMM date code.`,
                ],
                caveats: [
                    'Washburn did not maintain a single consistent serial system across these early runs.',
                    'The serial alone usually does not identify the exact model.',
                    'The exact production year is typically estimated from physical features.',
                ],
                verificationTips: [
                    'Check for a Made in Japan marking on the headstock, neck plate, or interior label.',
                    'Compare the logo style, hardware, and model details against early-1980s Washburn catalogs.',
                    'Use this decode as era guidance rather than an exact birthday.',
                ],
            },
            additionalContextRichText: `<h3>Overview</h3><p>This short 6-digit all-numeric serial aligns with an older Washburn Japan-era numbering style rather than a later date-coded import format.</p><h3>Likely Era</h3><p>Serial ${serial} is best treated as a late-1970s to early-1980s Washburn sequence, often linked to Japanese production partners such as Yamaki.</p><h3>What To Verify</h3><ul><li>Look for a Made in Japan marking on the headstock, neck plate, or interior label.</li><li>Compare the logo style, hardware, and model details against early-1980s Washburn catalogs.</li><li>Use the serial as era guidance, not an exact day-or-month decode.</li></ul><h3>Coal Creek Guitars Note</h3><p>For these early numeric Washburns, model features are usually more reliable than the serial alone for exact dating.</p>`,
        };
    }
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: `Unknown (first digits: ${firstTwo})`,
        factory: 'Various',
        country: 'Japan, Korea, or USA',
        notes: `6-digit serial number. For 1980s instruments, the first two digits (${firstTwo}) typically indicate year of manufacture. Production location may be Japan (1970s-1980s), Korea (1980s+), or USA Custom Shop. Check the headstock label or body sticker for "Made in" location.`,
    };
    return { success: true, info };
}
// Short 4-5 digit format (1970s-early 1980s)
function decodeShort(serial) {
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: '1970s-early 1980s',
        factory: 'Various (likely Japan)',
        country: 'Japan',
        notes: `Short ${serial.length}-digit serial numbers are typically from the 1970s-early 1980s when Washburn instruments were made in Japan. Pre-1978 instruments have no reliable serial number records - Washburn recommends checking their guitar archives and period catalogs for identification.`,
    };
    return { success: true, info };
}
// China BC factory prefix: BC + plant(1) + YY(2) + sequence(4)
function decodeWashburnBCChina(serial) {
    const plant = serial[2];
    const yearDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Washburn',
        serialNumber: serial,
        year: year.toString(),
        factory: 'China factory (BC series)',
        country: 'China',
        notes: `BC prefix indicates a Chinese Washburn factory series using a shifted encoding. Parsed as BC + plant code ${plant} + YY${yearDigits} (${year}) + sequence ${sequence}. The plant code precedes the year digits, so the year appears at positions 3-4 of the digit block rather than positions 1-2. Production sequence: ${sequenceNumber}. Verify with a Made in China marking on the headstock or soundhole label.`,
    };
    return {
        success: true,
        info,
        patternKey: 'washburn-bc-china-plant-yy-sequence',
        patternLabel: 'Washburn BC China plant YY sequence',
        additionalContext: {
            title: 'Washburn BC-prefix China serial',
            summary: 'This serial matches a Washburn BC-prefix format associated with Chinese factory production, where the year digits appear at positions 3-4 after a plant code.',
            highlights: [
                'BC indicates a Chinese contracted factory series.',
                `Plant code ${plant} identifies the production line or sub-facility.`,
                `The digits "${yearDigits}" decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Washburn BC-prefix serials use a shifted encoding where a plant code precedes the year digits.',
                'The exact factory name within China is not encoded in the serial.',
                'The serial does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock or soundhole label for Made in China marking.',
                'Compare the body style, hardware, and finish against Washburn catalog specs for the decoded year.',
                'Contact Washburn support with clear photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Washburn BC-prefix format associated with Chinese factory production, where the year digits appear at positions 3-4 of the digit block after a plant code.</p><h3>How This Pattern Is Typically Read</h3><p>BC indicates a Chinese contracted factory series. Plant code ${plant} identifies the production line or sub-facility. The digits "${yearDigits}" decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Washburn BC-prefix serials use a shifted encoding where a plant code precedes the year digits.</li><li>Check the back of the headstock or soundhole label for Made in China marking.</li><li>Compare the body style, hardware, and finish against Washburn catalog specs for the decoded year.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed mid-2000s Chinese Washburn production decode, then confirm the exact model from the headstock, label, or Washburn support.</p>`,
    };
}
// Helper: Parse year, month, sequence from digit string
function parseYearMonthSequence(digits) {
    if (digits.length < 4) {
        return { year: 'Unknown', sequence: digits };
    }
    const firstTwo = digits.substring(0, 2);
    const yearNum = parseInt(firstTwo, 10);
    let year;
    if (yearNum >= 70 && yearNum <= 99) {
        year = `19${firstTwo}`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${firstTwo.padStart(2, '0')}`;
    }
    else {
        year = `19${firstTwo}`;
    }
    let month;
    let sequence;
    if (digits.length >= 4) {
        const monthPart = digits.substring(2, 4);
        const monthNum = parseInt(monthPart, 10);
        if (monthNum >= 1 && monthNum <= 12) {
            month = getMonthName(monthNum);
            sequence = digits.substring(4);
        }
        else {
            // Check if it's a letter-based month (A=Jan, B=Feb, etc.)
            const letterMonth = digits.charAt(2);
            if (/^[A-L]$/.test(letterMonth)) {
                month = getMonthName(letterMonth.charCodeAt(0) - 64);
                sequence = digits.substring(3);
            }
            else {
                sequence = digits.substring(2);
            }
        }
    }
    else {
        sequence = digits.substring(2);
    }
    return { year, month, sequence };
}
// Helper function for month names
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
}
function getSingleDigitImportYears(yearDigit) {
    if (Number.isNaN(yearDigit))
        return 'Unknown';
    return `199${yearDigit} or 200${yearDigit}`;
}
