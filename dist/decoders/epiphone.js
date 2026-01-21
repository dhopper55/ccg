// Factory codes for Epiphone guitars
const FACTORY_CODES = {
    // Korean factories
    'I': { name: 'Saein', country: 'South Korea' },
    'U': { name: 'Unsung', country: 'South Korea' },
    'S': { name: 'Samick', country: 'South Korea' },
    'P': { name: 'Peerless', country: 'South Korea' },
    'R': { name: 'Peerless', country: 'South Korea' },
    'K': { name: 'Unknown Korean Factory', country: 'South Korea' },
    'F': { name: 'Fine Guitars', country: 'South Korea' },
    'C': { name: 'Unknown Korean Factory', country: 'South Korea' },
    // Chinese factories (letter codes)
    'MR': { name: 'Unknown Chinese Factory', country: 'China' },
    'DW': { name: 'DaeWon', country: 'China' },
    'EA': { name: 'Qingdao (Acoustic)', country: 'China' },
    'EE': { name: 'Qingdao', country: 'China' },
    'ED': { name: 'Dongbei', country: 'China' },
    'Z': { name: 'Zaozhuang Saehan', country: 'China' },
    // Indonesian factories
    'CI': { name: 'Cort Indonesia', country: 'Indonesia' },
    'SI': { name: 'Samick Indonesia', country: 'Indonesia' },
    'MC': { name: 'Unknown Indonesian Factory', country: 'Indonesia' },
};
// Numeric factory codes (used since ~2008)
const NUMERIC_FACTORY_CODES = {
    '11': { name: 'Unknown (Masterbilt)', country: 'China' },
    '12': { name: 'DaeWon or Unsung', country: 'China' },
    '15': { name: 'Qingdao (Electric)', country: 'China' },
    '16': { name: 'Qingdao (Acoustic)', country: 'China' },
    '17': { name: 'Unknown Chinese Factory', country: 'China' },
    '20': { name: 'DaeWon or Unsung', country: 'China' },
    '21': { name: 'Unsung', country: 'South Korea' },
    '23': { name: 'Samick', country: 'Indonesia' },
};
export function decodeEpiphone(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Try different formats
    // Format 1: Two letters + 8+ digits (e.g., SI02060234)
    // Common modern format: FF YYMMNNNN
    const twoLetterMatch = normalized.match(/^([A-Z]{2})(\d{8,})$/);
    if (twoLetterMatch) {
        return decodeTwoLetterFormat(twoLetterMatch[1], twoLetterMatch[2], normalized);
    }
    // Format 2: Single letter + digits (e.g., S1234567, U0312345)
    const singleLetterMatch = normalized.match(/^([A-Z])(\d{7,})$/);
    if (singleLetterMatch) {
        return decodeSingleLetterFormat(singleLetterMatch[1], singleLetterMatch[2], normalized);
    }
    // Format 3: YYMM + 2-digit factory code + 3-6 digits (since 2008)
    // e.g., 0807230809 = July 2008, factory 23, #809
    // e.g., 08121512345 = Dec 2008, factory 15, #12345
    const numericFactoryMatch = normalized.match(/^(\d{2})(\d{2})(\d{2})(\d{3,6})$/);
    if (numericFactoryMatch) {
        return decodeNumericFactoryFormat(numericFactoryMatch[1], numericFactoryMatch[2], numericFactoryMatch[3], numericFactoryMatch[4], normalized);
    }
    // Format 4: Letter + single digit year + sequence (e.g., Z051234)
    const letterYearMatch = normalized.match(/^([A-Z])(\d)(\d+)$/);
    if (letterYearMatch && letterYearMatch[3].length >= 4) {
        return decodeLetterYearFormat(letterYearMatch[1], letterYearMatch[2], letterYearMatch[3], normalized);
    }
    // Format 5: F-serial format (Les Paul Standards, Tributes)
    if (normalized.startsWith('F')) {
        return decodeFSerialFormat(normalized);
    }
    // Vintage Epiphone (pre-Gibson ownership, 1930s-1957)
    if (/^\d{4,5}$/.test(normalized)) {
        return decodeVintageEpiphone(normalized);
    }
    return {
        success: false,
        error: 'Unrecognized Epiphone serial number format. Modern Epiphone serials typically start with 1-2 letters (factory code) followed by digits indicating year, month, and production number.'
    };
}
function decodeTwoLetterFormat(factory, digits, serial) {
    const factoryInfo = FACTORY_CODES[factory];
    if (!factoryInfo) {
        return {
            success: false,
            error: `Unknown factory code: ${factory}. This may be a newer or less common factory code.`
        };
    }
    // Format: YYMMNNNN or YYMMNNNNN
    const year = '20' + digits.substring(0, 2);
    const month = parseInt(digits.substring(2, 4), 10);
    const sequence = digits.substring(4);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month value: ${month}. Expected 01-12.`
        };
    }
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const info = {
        brand: 'Epiphone',
        serialNumber: serial,
        year,
        month: months[month - 1],
        factory: factoryInfo.name,
        country: factoryInfo.country,
        notes: `Production sequence: ${sequence}. Factory code ${factory} = ${factoryInfo.name}, ${factoryInfo.country}.`
    };
    return { success: true, info };
}
function decodeSingleLetterFormat(factory, digits, serial) {
    const factoryInfo = FACTORY_CODES[factory];
    // Try to parse: YYMMNNNNN format
    const year = '20' + digits.substring(0, 2);
    const month = parseInt(digits.substring(2, 4), 10);
    const sequence = digits.substring(4);
    let factoryName = factoryInfo?.name || 'Unknown';
    let country = factoryInfo?.country || 'Unknown';
    if (month >= 1 && month <= 12) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const info = {
            brand: 'Epiphone',
            serialNumber: serial,
            year,
            month: months[month - 1],
            factory: factoryName,
            country,
            notes: `Production sequence: ${sequence}. Factory code ${factory}.`
        };
        return { success: true, info };
    }
    // If month parsing failed, provide basic info
    const info = {
        brand: 'Epiphone',
        serialNumber: serial,
        factory: factoryName,
        country,
        notes: `Factory code ${factory}. Unable to determine exact date from this serial number format.`
    };
    return { success: true, info };
}
function decodeNumericFactoryFormat(year, month, factory, sequence, serial) {
    const factoryInfo = NUMERIC_FACTORY_CODES[factory];
    const fullYear = '20' + year;
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
        return {
            success: false,
            error: `Invalid month value: ${monthNum}. Expected 01-12.`
        };
    }
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const info = {
        brand: 'Epiphone',
        serialNumber: serial,
        year: fullYear,
        month: months[monthNum - 1],
        factory: factoryInfo?.name || `Factory ${factory}`,
        country: factoryInfo?.country || 'Unknown (likely China)',
        notes: `Production sequence: ${sequence}. Numeric factory code format (used since 2008).`
    };
    return { success: true, info };
}
function decodeLetterYearFormat(factory, yearDigit, sequence, serial) {
    const factoryInfo = FACTORY_CODES[factory];
    // Year digit represents 200X
    const year = '200' + yearDigit;
    const info = {
        brand: 'Epiphone',
        serialNumber: serial,
        year,
        factory: factoryInfo?.name || 'Unknown',
        country: factoryInfo?.country || 'China',
        notes: `Production sequence: ${sequence}. Factory code ${factory}.`
    };
    return { success: true, info };
}
function decodeFSerialFormat(serial) {
    // F-serial format is not fully documented
    // Used on LP Std '59/'60 models and Tribute/Plus models
    // Made in China
    const info = {
        brand: 'Epiphone',
        serialNumber: serial,
        country: 'China',
        notes: 'F-serial format used on Les Paul Standard \'59/\'60 models and Tribute/Plus models. This format does not clearly encode the year or month. Typically made in China.'
    };
    return { success: true, info };
}
function decodeVintageEpiphone(serial) {
    const num = parseInt(serial, 10);
    let year = 'Pre-1957';
    let notes = 'Vintage Epiphone (before Gibson acquisition in 1957). ';
    if (num < 10000) {
        year = '1930s-1940s (approximate)';
    }
    else {
        year = '1940s-1957 (approximate)';
    }
    notes += 'Original Epiphone instruments were made in New York. Dating requires examination of other features.';
    const info = {
        brand: 'Epiphone',
        serialNumber: serial,
        year,
        factory: 'Epiphone (Original)',
        country: 'USA (New York)',
        notes
    };
    return { success: true, info };
}
