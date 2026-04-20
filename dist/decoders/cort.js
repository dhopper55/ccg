/**
 * Cort Guitar Serial Number Decoder
 *
 * Supports:
 * - Modern format: YYMMXXXX (2000-2004)
 * - Modern format extended: YYMMXXXXX (2005-present)
 * - 1990s format: YMMXXXX (early 1990s-1999)
 * - W.O. prefix: 1970s-1980s Korean production
 * - Indonesian production: Various prefixes (AI, I, IC, ICS, etc.)
 * - Chinese production: COS, COB prefixes
 *
 * Note: Pre-mid-1990s guitars often have randomly generated serial numbers.
 */
export function decodeCort(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // W.O. prefix - 1970s/1980s Korean production
    if (/^W\.?O\.?\d+/i.test(cleaned)) {
        return decodeWOPrefix(cleaned);
    }
    // Indonesian Cort factory: ICS prefix (Factory Special Run)
    if (/^ICS\d{8,9}$/.test(normalized)) {
        return decodeIndonesiaICS(normalized);
    }
    // Indonesian Cort factory: AI prefix
    if (/^AI\d{9}$/.test(normalized)) {
        return decodeIndonesiaAI(normalized);
    }
    // Indonesian Cort factory: IC prefix
    if (/^IC\d{8}$/.test(normalized)) {
        return decodeIndonesiaIC(normalized);
    }
    // Indonesian Cort factory: ICF prefix (Fender branded)
    if (/^ICF\d{8}$/.test(normalized)) {
        return decodeIndonesiaICF(normalized);
    }
    // Indonesian Cort factory: IE prefix
    if (/^IE\d{8,9}$/.test(normalized)) {
        return decodeIndonesiaIE(normalized);
    }
    // Chinese Cort factory: COS prefix
    if (/^COS\d{8,9}$/.test(normalized)) {
        return decodeChinaCOS(normalized);
    }
    // Chinese Cort factory: COB prefix
    if (/^COB\d{8,9}$/.test(normalized)) {
        return decodeChinaCOB(normalized);
    }
    // Modern format with 9 digits: YYMMXXXXX (2005-present)
    if (/^\d{9}$/.test(normalized)) {
        return decodeModern9Digit(normalized);
    }
    // Modern format with 8 digits: YYMMXXXX (2000-2004)
    if (/^\d{8}$/.test(normalized)) {
        return decodeModern8Digit(normalized);
    }
    // 1990s format: YMMXXXX (7 digits, single year digit)
    if (/^00\d{5}$/.test(normalized)) {
        return decodeYearSequence7Digit(normalized);
    }
    if (/^\d{7}$/.test(normalized)) {
        return decode1990s7Digit(normalized);
    }
    // 6-digit format (older/ambiguous)
    if (/^\d{6}$/.test(normalized)) {
        return decode6Digit(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Cort serial number. The format was not recognized. Common formats include: YYMMXXXX (8 digits, 2000-2004), YYMMXXXXX (9 digits, 2005+), YMMXXXX (7 digits, 1990s), or W.O. prefix (1970s-80s). Note: Pre-mid-1990s guitars often have randomly generated serial numbers.',
    };
}
// Indonesian AI prefix
function decodeIndonesiaAI(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'PT. Cort Indonesia, Mojokerto',
        country: 'Indonesia',
        notes: `AI prefix indicates Indonesian Cor-Tek/Cort production. Parsed as AI + YYMM + sequence. Sequence: ${sequence}. Cort serials identify factory and production date, but not the exact model name; verify model from headstock, label, or other instrument markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-ai-indonesia-yymm-sequence',
        patternLabel: 'Cort AI Indonesia YYMM sequence',
        additionalContext: {
            title: 'Cort AI Indonesia serial',
            summary: 'This serial matches an Indonesian Cort/Cor-Tek AI-prefix format parsed as factory prefix plus YYMM production date and sequence.',
            highlights: [
                'AI indicates Indonesian Cort/Cor-Tek production.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits are production sequence ${sequence}.`,
            ],
            caveats: [
                'Cort serials usually identify factory and date, not the exact model name.',
                'Confirm the model from the headstock, soundhole label, neck heel, or other physical markings.',
            ],
            verificationTips: [
                'Compare the model features against Cort catalog specs for the decoded year.',
                'Check whether the label or headstock identifies Indonesia or Cor-Tek production.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an Indonesian Cort/Cor-Tek AI-prefix format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>AI indicates Indonesian Cort/Cor-Tek production. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits are production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify factory and date, not the exact model name.</li><li>Confirm the model from the headstock, soundhole label, neck heel, or other physical markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical factory/date decode, then verify the exact model from physical markings and catalog specs for the decoded year.</p>`,
    };
}
// W.O. prefix - 1970s/1980s Korean production
function decodeWOPrefix(serial) {
    // Extract number after W.O. prefix
    const match = serial.match(/^W\.?O\.?(\d+)/i);
    const numericPart = match ? match[1] : '';
    // Check if last two digits could indicate year (e.g., ending in 86 = 1986)
    let yearNote = '';
    if (numericPart.length >= 2) {
        const lastTwo = numericPart.slice(-2);
        const potentialYear = parseInt(lastTwo, 10);
        if (potentialYear >= 73 && potentialYear <= 95) {
            yearNote = ` The serial ends in "${lastTwo}" which may indicate 19${lastTwo}, though this pattern is unconfirmed.`;
        }
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: '1970s-1980s (exact year uncertain)',
        factory: 'Cort Korea (Incheon)',
        country: 'South Korea',
        notes: `W.O. prefix indicates Korean Cort production from the 1970s-1980s. These serial numbers were typically on white stickers with black borders on the headstock or neck heel.${yearNote}`,
    };
    return { success: true, info };
}
// Indonesian ICS prefix (Factory Special Run)
function decodeIndonesiaICS(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `ICS prefix indicates Indonesian Cor-Tek factory production. The "S" typically designates a Factory Special Run (FSR) model. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian IC prefix
function decodeIndonesiaIC(serial) {
    const yearDigits = serial.substring(2, 4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(4);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `IC prefix indicates Indonesian Cor-Tek factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian ICF prefix (Fender branded)
function decodeIndonesiaICF(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `ICF prefix indicates Indonesian Cor-Tek factory production. The "F" typically indicates this was a Fender-branded instrument manufactured by Cort. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian IE prefix
function decodeIndonesiaIE(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: month >= 1 && month <= 12 ? getMonthName(month) : undefined,
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `IE prefix indicates Indonesian Cor-Tek factory production. Parsed as IE + YYMM + sequence. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Chinese COS prefix
function decodeChinaCOS(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort China (Cor-Tek)',
        country: 'China',
        notes: `COS prefix indicates Chinese Cor-Tek factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Chinese COB prefix
function decodeChinaCOB(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort China (Cor-Tek)',
        country: 'China',
        notes: `COB prefix indicates Chinese Cor-Tek factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Modern 9-digit format: YYMMXXXXX (2005-present)
function decodeModern9Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern 9-digit format (YYMMXXXXX) used since 2005. Production sequence: ${sequence}. Exact factory location requires additional identification from the instrument.`,
    };
    return { success: true, info };
}
// Modern 8-digit format: YYMMXXXX (2000-2004)
function decodeModern8Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort (location varies - Korea or Indonesia)',
        country: 'Korea or Indonesia',
        notes: `Modern 8-digit format (YYMMXXXX) used 2000-2004. Production sequence: ${sequence}. Exact factory location requires additional identification from the instrument.`,
    };
    return { success: true, info };
}
function decodeYearSequence7Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort (location varies - Korea or Indonesia)',
        country: 'Korea or Indonesia',
        notes: `Year-first 7-digit Cort format. The first two digits (${yearDigits}) indicate production year ${year}; the remaining digits are production sequence ${parseInt(sequence, 10)}. Cort serials do not identify the exact model name, so verify the model from the headstock or internal label.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-year-sequence-7-digit',
        patternLabel: 'Cort year-first 7-digit sequence',
        additionalContext: {
            title: 'Cort year-first 7-digit serial',
            summary: 'This serial matches a Cort year-first numeric format where the first two digits identify the production year and the remaining digits are a sequence.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
                'The serial does not encode the exact model name.',
            ],
            caveats: [
                'Cort has used multiple numeric serial systems, especially around the 1990s and early 2000s.',
                'Model identification requires the headstock, label, or other physical markings.',
                'Production location may require country-of-origin markings on the instrument.',
            ],
            verificationTips: [
                'Check the headstock or soundhole label for the model name.',
                'Look for Made in Korea or Made in Indonesia markings to confirm production location.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort year-first numeric format where the first two digits identify the production year and the remaining digits are a sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}. The serial does not encode the exact model name.</p><h3>What To Verify</h3><ul><li>Cort has used multiple numeric serial systems, especially around the 1990s and early 2000s.</li><li>Model identification requires the headstock, label, or other physical markings.</li><li>Production location may require country-of-origin markings on the instrument.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical year/sequence decode, then verify the exact model from the headstock, soundhole label, and country-of-origin markings.</p>`,
    };
}
// 1990s 7-digit format: YMMXXXX
function decode1990s7Digit(serial) {
    const yearDigit = serial.substring(0, 1);
    const monthDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const yearNum = parseInt(yearDigit, 10);
    // Single digit: 0-9 maps to 1990-1999
    const year = 1990 + yearNum;
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort Korea (Incheon or Daejeon)',
        country: 'South Korea',
        notes: `1990s 7-digit format (YMMXXXX). Production sequence: ${sequence}. Cort operated factories in Incheon (1987-2007) and Daejeon (1991-2007) during this era.`,
    };
    return { success: true, info };
}
// 6-digit format (older/ambiguous)
function decode6Digit(serial) {
    // This format is ambiguous - could be various things
    // Try to interpret as YMMXXX or MMXXXX
    const firstTwo = serial.substring(0, 2);
    const possibleMonth = parseInt(firstTwo, 10);
    if (possibleMonth >= 1 && possibleMonth <= 12) {
        // Could be MMXXXX format
        const sequence = serial.substring(2);
        const info = {
            brand: 'Cort',
            serialNumber: serial,
            year: 'Unknown (pre-2000)',
            month: getMonthName(possibleMonth),
            factory: 'Cort Korea',
            country: 'South Korea',
            notes: `6-digit format. If the first two digits (${firstTwo}) represent the month, production sequence would be ${sequence}. Exact year cannot be determined from this format. This may be a pre-mid-1990s guitar with a non-standard serial number.`,
        };
        return { success: true, info };
    }
    // Otherwise, treat as older random format
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: 'Unknown (likely pre-1995)',
        factory: 'Cort Korea',
        country: 'South Korea',
        notes: 'This 6-digit serial number may be from the pre-mid-1990s era when Cort used randomly generated serial numbers. Contact Cort customer service with photos of the instrument for more accurate identification.',
    };
    return { success: true, info };
}
// Helper function for month names
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
}
