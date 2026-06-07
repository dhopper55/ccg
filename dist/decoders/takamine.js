/**
 * Takamine Guitar Serial Number Decoder
 *
 * Supports:
 * - Pro Series 8-digit format: YYMMXXXX (year, month, sequence) - up to 2012
 * - Pro Series 8-digit format: YYMMXXXX (year offset from 1962) - 2013+
 * - Alternative 8-digit format: YYMMDDXX (year, month, day, daily sequence)
 * - 9-digit format: YYMMDDDXXX or YYMMXXXXX
 * - 10-digit format: YYMMXXXXXX
 * - Korean-made G Series: Various formats
 * - Chinese-made G Series: Various formats
 *
 * Note: G Series guitars do not follow a consistent serial number system.
 * Founded in 1959 at the base of Mount Takamine, officially named Takamine in 1962.
 */
export function decodeTakamine(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Check if it's all digits (standard formats)
    if (/^\d+$/.test(normalized)) {
        const length = normalized.length;
        // 10-digit format: YYMMXXXXXX
        if (length === 10) {
            return decode10Digit(normalized);
        }
        // 9-digit format: YYMMXXXXX
        if (length === 9) {
            return decode9Digit(normalized);
        }
        // 8-digit format (most common): YYMMXXXX
        if (length === 8) {
            return decode8Digit(normalized);
        }
        // 7-digit format
        if (length === 7) {
            return decode7Digit(normalized);
        }
        // 6-digit format (possibly Korean G Series)
        if (length === 6) {
            return decode6Digit(normalized);
        }
    }
    // Two-letter factory prefix alphanumeric formats (e.g. SI = Samick Indonesia)
    if (/^[A-Z]{2}\d{6,10}$/.test(normalized)) {
        return decodeTwoLetterPrefix(normalized);
    }
    // Alphanumeric formats (less common)
    if (/^[A-Z]\d+$/.test(normalized)) {
        return decodeAlphanumeric(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Takamine serial number. The format was not recognized. Standard Takamine Pro Series guitars use an 8-digit format (YYMMXXXX). G Series guitars may not follow a consistent dating system - contact Takamine directly for assistance.',
    };
}
// 10-digit format: YYMMXXXXXX
function decode10Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    // Determine year - post-2012 guitars use offset from 1962
    let year;
    let yearNote;
    if (yearNum >= 51) {
        // Post-2012 system: add to 1962
        year = 1962 + yearNum;
        yearNote = 'Year calculated using post-2012 system (offset from 1962).';
    }
    else if (yearNum <= 12) {
        // Could be 2000-2012 or post-2012 offset
        // Assume 2000s for now
        year = 2000 + yearNum;
        yearNote = 'Year assumed to be 20XX format.';
    }
    else {
        // 13-50 range - likely post-2012 offset
        year = 1962 + yearNum;
        yearNote = 'Year calculated using post-2012 system (offset from 1962).';
    }
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Takamine, Sakashita, Japan',
        country: 'Japan',
        notes: `10-digit format. Production sequence: ${sequence}. ${yearNote}`,
    };
    return { success: true, info };
}
// 9-digit format: YYMMXXXXX
function decode9Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const remaining = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    // Determine year
    let year;
    let yearNote;
    if (yearNum >= 51) {
        year = 1962 + yearNum;
        yearNote = 'Year calculated using post-2012 system (offset from 1962).';
    }
    else if (yearNum <= 12) {
        year = 2000 + yearNum;
        yearNote = 'Year assumed to be 20XX format.';
    }
    else {
        year = 1962 + yearNum;
        yearNote = 'Year calculated using post-2012 system (offset from 1962).';
    }
    // Check if remaining digits could be DDXXX (day + 3-digit sequence)
    const possibleDay = parseInt(remaining.substring(0, 2), 10);
    let dayInfo = '';
    let sequence = remaining;
    if (possibleDay >= 1 && possibleDay <= 31) {
        dayInfo = ` Possibly made on day ${possibleDay} of the month.`;
        sequence = remaining.substring(2);
    }
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Takamine, Sakashita, Japan',
        country: 'Japan',
        notes: `9-digit format. Production sequence: ${sequence}.${dayInfo} ${yearNote}`,
    };
    return { success: true, info };
}
// 8-digit format (most common): YYMMXXXX or YYMMDDXX
function decode8Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const remaining = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    // Determine year
    let year;
    let yearNote;
    if (yearNum >= 62 && yearNum <= 99) {
        // Standard pre-2000 YYMM sequence format.
        year = 1900 + yearNum;
        yearNote = '';
    }
    else if (yearNum >= 51) {
        // Post-2012 system: add to 1962 (51 = 2013, 52 = 2014, etc.)
        year = 1962 + yearNum;
        yearNote = 'Year calculated using post-2012 system (offset from 1962).';
    }
    else if (yearNum <= 24) {
        // 2000-2024 (or future years)
        year = 2000 + yearNum;
        yearNote = '';
    }
    else {
        // 25-50 range in post-2012 system would be 1987-2012
        // But these would more likely be from 2013+ using offset
        year = 1962 + yearNum;
        yearNote = 'Year calculated using offset from 1962.';
    }
    // Check if this could be YYMMDDXX format (day + 2-digit sequence)
    const possibleDay = parseInt(remaining.substring(0, 2), 10);
    let dayInfo = '';
    let sequence = remaining;
    let day;
    if (possibleDay >= 1 && possibleDay <= 31) {
        // Could be day of month
        day = possibleDay.toString();
        sequence = remaining.substring(2);
        dayInfo = `Made on day ${possibleDay}. Daily production number: ${sequence}.`;
    }
    else {
        dayInfo = `Monthly production sequence: ${remaining}.`;
    }
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        day,
        factory: 'Takamine, Sakashita, Japan',
        country: 'Japan',
        notes: `8-digit Pro Series format. ${dayInfo}${yearNote ? ' ' + yearNote : ''}`,
    };
    return { success: true, info };
}
// 7-digit format
function decode7Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        // Try alternate interpretation: YMMXXXX (single digit year)
        const altYear = parseInt(serial.substring(0, 1), 10);
        const altMonth = parseInt(serial.substring(1, 3), 10);
        const altSequence = serial.substring(3);
        if (altMonth >= 1 && altMonth <= 12) {
            const info = {
                brand: 'Takamine',
                serialNumber: serial,
                year: `199${altYear} or 200${altYear}`,
                month: getMonthName(altMonth),
                factory: 'Takamine',
                country: 'Japan',
                notes: `7-digit format with single-digit year. Production sequence: ${altSequence}. Year is ambiguous between 199X and 200X.`,
            };
            return { success: true, info };
        }
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number.`,
        };
    }
    // Standard interpretation
    let year = yearNum >= 62 ? 1900 + yearNum : 2000 + yearNum;
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Takamine',
        country: 'Japan',
        notes: `7-digit format. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// 6-digit format (possibly Korean G Series)
function decode6Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const remaining = serial.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    // Korean G Series interpretation: YY + week + sequence
    // First 2 digits = year, next 2 = week, last 2 = sequence
    const weekDigits = serial.substring(2, 4);
    const weekNum = parseInt(weekDigits, 10);
    let year;
    if (yearNum >= 80 && yearNum <= 99) {
        year = 1900 + yearNum;
    }
    else {
        year = 2000 + yearNum;
    }
    if (weekNum >= 1 && weekNum <= 53) {
        // Likely Korean format: YYWWXX
        const sequence = serial.substring(4);
        const info = {
            brand: 'Takamine',
            serialNumber: serial,
            year: year.toString(),
            factory: 'Korea (G Series)',
            country: 'South Korea',
            notes: `6-digit format. Possibly week ${weekNum} of ${year}, sequence ${sequence}. Korean-made G Series guitars may not follow standard dating patterns.`,
        };
        return { success: true, info };
    }
    // Generic interpretation
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Takamine',
        country: 'Japan or Korea',
        notes: `6-digit format. Sequence: ${remaining}. This may be a G Series guitar which does not follow standard serial number patterns. Contact Takamine for accurate dating.`,
    };
    return { success: true, info };
}
// Alphanumeric format (letter prefix)
const TWO_LETTER_FACTORY_MAP = {
    SI: { factory: 'Samick factory, Indonesia', country: 'Indonesia' },
    SK: { factory: 'Samick factory, South Korea', country: 'South Korea' },
    SC: { factory: 'Samick factory, China', country: 'China' },
};
function decodeTwoLetterPrefix(serial) {
    const prefix = serial.substring(0, 2);
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const isValidMonth = monthNum >= 1 && monthNum <= 12;
    const monthName = isValidMonth ? getMonthName(monthNum) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const factoryInfo = TWO_LETTER_FACTORY_MAP[prefix];
    const factory = factoryInfo?.factory ?? `${prefix}-prefix factory`;
    const country = factoryInfo?.country ?? 'Asia';
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year,
        ...(monthName ? { month: monthName } : {}),
        factory,
        country,
        notes: `Takamine G-Series two-letter factory prefix format. "${prefix}" identifies the ${factory}; ${yearDigits} indicates ${year}; ${monthDigits} indicates ${isValidMonth ? monthName : 'an unrecognized batch code'}; ${sequence} is the unit sequence number (${sequenceNumber}). This format is used on Takamine G-Series entry-level and intermediate models built at contract manufacturing facilities. Pro-Series and USA/Japanese Takamine guitars use a different all-numeric format.`,
    };
    return {
        success: true,
        info,
        patternKey: `takamine-two-letter-prefix-yymm-sequence`,
        patternLabel: `Takamine ${prefix} two-letter factory prefix format`,
        additionalContext: {
            title: `Takamine G-Series ${prefix}-prefix serial`,
            summary: `This serial matches a Takamine G-Series two-letter factory prefix format where "${prefix}" identifies the manufacturing facility and the digits encode year, month, and sequence.`,
            highlights: [
                `"${prefix}" identifies the ${factory}.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                isValidMonth
                    ? `The digits ${monthDigits} decode as ${monthName}.`
                    : `The digits ${monthDigits} are an unrecognized batch code, not a standard calendar month.`,
                `The remaining digits decode as unit sequence number ${sequenceNumber}.`,
            ],
            caveats: [
                'This format is used on Takamine G-Series models, not Pro-Series or Japanese-made instruments.',
                'The serial identifies factory and production date — not the specific G-Series model name.',
                'Standard online Takamine decoders expect all-numeric Pro-Series formats and will not recognize this format.',
            ],
            verificationTips: [
                'Check the paper label inside the soundhole for the model name and country of origin.',
                'Compare the instrument against the Takamine G-Series catalog for the decoded year.',
                'Contact Takamine support with the full serial and photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Takamine G-Series two-letter factory prefix format.</p><h3>How This Pattern Is Typically Read</h3><p>"${prefix}" identifies the ${factory}. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${isValidMonth ? monthName : 'an unrecognized batch code'}. The remaining digits decode as unit sequence number ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format is used on Takamine G-Series models, not Pro-Series or Japanese-made instruments.</li><li>Check the soundhole label for the model name and country of origin.</li><li>Standard Takamine online decoders only handle all-numeric Pro-Series formats — this format will not match them.</li></ul>`,
    };
}
function decodeAlphanumeric(serial) {
    const prefix = serial[0];
    const numericPart = serial.substring(1);
    const info = {
        brand: 'Takamine',
        serialNumber: serial,
        year: 'Unknown',
        factory: 'Takamine',
        country: 'Japan',
        notes: `Alphanumeric format with "${prefix}" prefix. This format may indicate a special series or export model. Contact Takamine directly for accurate dating and model information.`,
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
