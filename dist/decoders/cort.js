/**
 * Cort Guitar Serial Number Decoder
 *
 * Supports:
 * - Modern format: YYMMXXXX (2000-2004)
 * - Modern format extended: YYMMXXXXX (2005-present)
 * - 1990s format: YMMXXXX (early 1990s-1999)
 * - W.O. prefix: 1970s-1980s Korean production
 * - Indonesian production: Various prefixes (I, IC, ICS, etc.)
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
    // Indonesian Cort factory: IC prefix
    if (/^IC\d{8}$/.test(normalized)) {
        return decodeIndonesiaIC(normalized);
    }
    // Indonesian Cort factory: ICF prefix (Fender branded)
    if (/^ICF\d{8}$/.test(normalized)) {
        return decodeIndonesiaICF(normalized);
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
