/**
 * Alvarez Guitar Serial Number Decoder
 *
 * Supports:
 * - Modern standard format: Letter prefix + 8-9 digits (LYYMMXXXXX)
 * - Alvarez-Yairi (Japan): 4-5 digit sequential numbers
 * - Alvarez-Yairi heel block: Emperor dating code (Showa/Heisei eras)
 * - Older Japan models: Various formats (1970s-1980s)
 *
 * Factory locations:
 * - Japan: Alvarez-Yairi (Kani, Gifu - Kazuo Yairi factory), various pre-1985
 * - Korea: Post-1985
 * - China: Current production (Artist, Regent, Masterworks series)
 *
 * Note: K. Yairi and Alvarez Yairi are the same guitars - just different branding
 * for different markets (K. Yairi in Europe, Alvarez Yairi in USA).
 */
export function decodeAlvarez(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Modern standard format: Letter prefix + 8-9 digits (e.g., E24113487, F606120413)
    if (/^[A-Z]\d{8,9}$/.test(normalized)) {
        return decodeModernStandard(normalized);
    }
    // Emperor dating code format: 4 digits YYMM (heel block stamp)
    if (/^\d{4}$/.test(normalized)) {
        return decodeEmperorCode(normalized);
    }
    // Alvarez-Yairi sequential: 5 digits (Japan)
    if (/^\d{5}$/.test(normalized)) {
        return decodeYairiSequential(normalized);
    }
    // Emperor code with sequence: 6-7 digits YYMMXXX (heel block stamp)
    if (/^\d{6,7}$/.test(normalized)) {
        return decodeEmperorWithSequence(normalized);
    }
    // 8-digit numeric (could be modern without prefix or older format)
    if (/^\d{8}$/.test(normalized)) {
        return decodeNumeric8Digit(normalized);
    }
    // Longer numeric formats
    if (/^\d{9,12}$/.test(normalized)) {
        return decodeLongNumeric(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Alvarez serial number. Common formats include: letter prefix + 8-9 digits (modern), 4-5 digit numbers (Yairi Japan), or Emperor dating codes on heel block (Yairi). For vintage Japanese Alvarez guitars, the serial number may not be decodable - check inside the guitar for date stamps on braces or the label.',
    };
}
// Modern standard format: Letter + 8-9 digits
function decodeModernStandard(serial) {
    const prefix = serial.charAt(0);
    const digits = serial.substring(1);
    // Extract year and month from first 4 digits after prefix
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const productionNum = digits.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    // Validate month
    let monthStr;
    if (monthNum >= 1 && monthNum <= 12) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ];
        monthStr = months[monthNum - 1];
    }
    // Determine year (assume 2000s for modern format)
    let year;
    if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
    }
    else if (yearNum >= 85 && yearNum <= 99) {
        year = `19${yearDigits}`;
    }
    else {
        year = `Unknown (${yearDigits})`;
    }
    // Known prefixes (not officially documented)
    const prefixInfo = {
        'E': 'Standard production line',
        'F': 'Production line F',
        'S': 'Production line S',
        'SL': 'SL production designation',
    };
    const prefixMeaning = prefixInfo[prefix] || 'Production line indicator';
    const info = {
        brand: 'Alvarez',
        serialNumber: serial,
        year: year,
        month: monthStr,
        factory: 'China or Korea',
        country: 'China or Korea (check label)',
        notes: `Modern Alvarez format. Prefix "${prefix}" = ${prefixMeaning}. Year: ${year}, Month: ${monthStr || 'Unknown'}. Production number: ${productionNum}. Current Alvarez Artist, Regent, and Masterworks series guitars are made in China. Check the label inside the guitar to confirm country of origin.`,
    };
    return { success: true, info };
}
// Emperor dating code: 4 digits YYMM (Showa/Heisei eras)
function decodeEmperorCode(serial) {
    const emperorYear = parseInt(serial.substring(0, 2), 10);
    const month = parseInt(serial.substring(2, 4), 10);
    const result = convertEmperorYear(emperorYear);
    const monthStr = getMonthName(month);
    const info = {
        brand: 'Alvarez Yairi',
        serialNumber: serial,
        year: result.year,
        month: monthStr,
        factory: 'Kani, Gifu (K. Yairi)',
        country: 'Japan',
        notes: `Emperor dating code from heel block. ${result.notes} Month: ${monthStr || 'Unknown'}. Alvarez Yairi guitars are handmade at the Yairi factory in Kani, Japan. This is the same as K. Yairi guitars - different branding for US market.`,
    };
    return { success: true, info };
}
// Alvarez-Yairi sequential: 5 digits
function decodeYairiSequential(serial) {
    const num = parseInt(serial, 10);
    const info = {
        brand: 'Alvarez Yairi',
        serialNumber: serial,
        year: 'Check Alvarez date finder',
        factory: 'Kani, Gifu (K. Yairi)',
        country: 'Japan',
        notes: `5-digit Alvarez Yairi serial number (${num}). This is a sequential number used on the soundhole label. For accurate dating, use the official Alvarez date finder at alvarezguitars.com or check the heel block stamp inside the guitar for the Emperor dating code. The heel block date is more reliable than the label serial.`,
    };
    return { success: true, info };
}
// Emperor code with sequence: 6-7 digits YYMMXXX
function decodeEmperorWithSequence(serial) {
    const emperorYear = parseInt(serial.substring(0, 2), 10);
    const month = parseInt(serial.substring(2, 4), 10);
    const sequence = serial.substring(4);
    const result = convertEmperorYear(emperorYear);
    const monthStr = getMonthName(month);
    const info = {
        brand: 'Alvarez Yairi',
        serialNumber: serial,
        year: result.year,
        month: monthStr,
        factory: 'Kani, Gifu (K. Yairi)',
        country: 'Japan',
        notes: `Emperor dating code with sequence from heel block. ${result.notes} Month: ${monthStr || 'Unknown'}. Production sequence: ${sequence}. Alvarez Yairi guitars are handmade at the Yairi factory in Kani, Japan.`,
    };
    return { success: true, info };
}
// 8-digit numeric format
function decodeNumeric8Digit(serial) {
    // Could be modern format without prefix (YYMMXXXX) or other format
    const firstTwo = serial.substring(0, 2);
    const nextTwo = serial.substring(2, 4);
    const yearNum = parseInt(firstTwo, 10);
    const monthNum = parseInt(nextTwo, 10);
    let year;
    let monthStr;
    // Try to interpret as YYMMXXXX
    if (monthNum >= 1 && monthNum <= 12) {
        if (yearNum >= 0 && yearNum <= 30) {
            year = `20${firstTwo.padStart(2, '0')}`;
        }
        else if (yearNum >= 85 && yearNum <= 99) {
            year = `19${firstTwo}`;
        }
        else {
            year = 'Unknown';
        }
        monthStr = getMonthName(monthNum);
    }
    else {
        year = 'Unknown';
    }
    const info = {
        brand: 'Alvarez',
        serialNumber: serial,
        year: year,
        month: monthStr,
        factory: 'Various',
        country: 'Check label',
        notes: `8-digit serial number. If format is YYMMXXXX: Year ${year}, Month ${monthStr || 'Unknown'}. Production number: ${serial.substring(4)}. Check the label inside the guitar for country of origin. For Alvarez Yairi models, also check the heel block for the Emperor dating code.`,
    };
    return { success: true, info };
}
// Longer numeric formats (9-12 digits)
function decodeLongNumeric(serial) {
    const firstTwo = serial.substring(0, 2);
    const yearNum = parseInt(firstTwo, 10);
    let year;
    if (yearNum >= 0 && yearNum <= 30) {
        year = `Possibly 20${firstTwo.padStart(2, '0')}`;
    }
    else if (yearNum >= 85 && yearNum <= 99) {
        year = `Possibly 19${firstTwo}`;
    }
    else {
        year = 'Unknown';
    }
    const info = {
        brand: 'Alvarez',
        serialNumber: serial,
        year: year,
        factory: 'Various',
        country: 'Check label',
        notes: `Long numeric serial number. First two digits (${firstTwo}) may indicate year. Check the label inside the guitar for country of origin. For accurate dating, use the official Alvarez date finder at alvarezguitars.com.`,
    };
    return { success: true, info };
}
// Convert Emperor year to Western year
function convertEmperorYear(emperorYear) {
    // Post-2000: Direct year encoding (01 = 2001, etc.)
    if (emperorYear >= 1 && emperorYear <= 30) {
        // Could be Heisei (1989-2000) or post-2000 direct encoding
        // Heisei 1-12 = 1989-2000
        // Post-2000: 01-30 = 2001-2030
        // Ambiguous range: 01-12 could be either
        if (emperorYear <= 12) {
            const heiseiYear = 1988 + emperorYear;
            const modernYear = 2000 + emperorYear;
            return {
                year: `${heiseiYear} or ${modernYear}`,
                notes: `Emperor year ${emperorYear} is ambiguous: could be Heisei ${emperorYear} (${heiseiYear}) or post-2000 encoding (${modernYear}). Check guitar features and label to determine era.`,
            };
        }
        else {
            // 13-30 is definitely post-2000
            const year = 2000 + emperorYear;
            return {
                year: year.toString(),
                notes: `Post-2000 encoding: ${emperorYear} = ${year}.`,
            };
        }
    }
    // Showa era: 45-64 = 1970-1989
    if (emperorYear >= 45 && emperorYear <= 64) {
        const year = 1925 + emperorYear;
        return {
            year: year.toString(),
            notes: `Showa ${emperorYear} = ${year}.`,
        };
    }
    // Extended range for early Showa if needed
    if (emperorYear >= 35 && emperorYear < 45) {
        const year = 1925 + emperorYear;
        return {
            year: year.toString(),
            notes: `Showa ${emperorYear} = ${year} (early production).`,
        };
    }
    return {
        year: 'Unknown',
        notes: `Emperor year ${emperorYear} could not be decoded. May require checking official Alvarez records.`,
    };
}
// Get month name from number
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    if (month >= 1 && month <= 12) {
        return months[month - 1];
    }
    return undefined;
}
