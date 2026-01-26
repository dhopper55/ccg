/**
 * Guild Guitar Serial Number Decoder
 *
 * Supports:
 * - Tacoma production (2005-2008): T + year letter + 6 digits
 * - New Hartford production (2008+): N + year letter + 6 digits
 * - Corona production: C prefix
 * - Korean production: Y prefix, KS prefix
 * - Chinese production: Z prefix (Zaozhuang Saehan)
 * - Indonesian production: SI prefix
 * - Westerly/model prefix format (1965-1999): Two-letter prefix + digits
 * - Sequential numeric format (1952-1979)
 *
 * Year letter system (for Tacoma/New Hartford):
 * B=1998, C=1999, D=2000, E=2001, F=2002, G=2003, H=2004,
 * I=2005, J=2006, K=2007, L=2008, M=2009, N=2010, O=2011,
 * P=2012, Q=2013, R=2014, S=2015, T=2016, U=2017, V=2018,
 * W=2019, X=2020, Y=2021, Z=2022
 */
export function decodeGuild(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Tacoma production: T + year letter + 6 digits (2005-2008)
    if (/^T[A-Z]\d{6}$/.test(normalized)) {
        return decodeTacoma(normalized);
    }
    // New Hartford production: N + year letter + 6 digits (2008+)
    if (/^N[A-Z]\d{6}$/.test(normalized)) {
        return decodeNewHartford(normalized);
    }
    // Corona production: C prefix
    if (/^C[A-Z]?\d{5,8}$/.test(normalized)) {
        return decodeCorona(normalized);
    }
    // Korean production: Y prefix
    if (/^Y\d{6,10}$/.test(normalized)) {
        return decodeKorea(normalized);
    }
    // Korean production: KS prefix
    if (/^KS\d{6,10}$/.test(normalized)) {
        return decodeKoreaKS(normalized);
    }
    // Chinese production: Z prefix (Zaozhuang Saehan)
    if (/^Z\d{6,10}$/.test(normalized)) {
        return decodeChina(normalized);
    }
    // Indonesian production: SI prefix
    if (/^SI\d{6,10}$/.test(normalized)) {
        return decodeIndonesia(normalized);
    }
    // GAD series with numeric serial
    if (/^GAD\d+$/i.test(normalized)) {
        return decodeGAD(normalized);
    }
    // Model prefix format (two letters + digits): 1965-1999 era
    if (/^[A-Z]{2}\d{5,8}$/.test(normalized)) {
        return decodeModelPrefix(normalized);
    }
    // Sequential numeric format (5-6 digits): Various eras
    if (/^\d{5,6}$/.test(normalized)) {
        return decodeSequential(normalized);
    }
    // Longer numeric format
    if (/^\d{7,10}$/.test(normalized)) {
        return decodeLongNumeric(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Guild serial number. The format was not recognized. Common formats include: T/N + letter + 6 digits (Tacoma/New Hartford), two-letter prefix + digits (model-specific), or sequential numbers (vintage). Guild has used many different serial number systems over the years depending on era and factory location.',
    };
}
// Year letter to year mapping (Tacoma system, B=1998)
function getYearFromLetter(letter) {
    const baseYear = 1998; // B = 1998
    const baseCode = 'B'.charCodeAt(0);
    const letterCode = letter.toUpperCase().charCodeAt(0);
    if (letterCode < 'B'.charCodeAt(0) || letterCode > 'Z'.charCodeAt(0)) {
        return null;
    }
    return baseYear + (letterCode - baseCode);
}
// Convert Julian day (1-365) to month/day
function julianToDate(julian) {
    if (julian < 1 || julian > 366)
        return null;
    const months = [
        { name: 'January', days: 31 },
        { name: 'February', days: 29 }, // Assume leap year for simplicity
        { name: 'March', days: 31 },
        { name: 'April', days: 30 },
        { name: 'May', days: 31 },
        { name: 'June', days: 30 },
        { name: 'July', days: 31 },
        { name: 'August', days: 31 },
        { name: 'September', days: 30 },
        { name: 'October', days: 31 },
        { name: 'November', days: 30 },
        { name: 'December', days: 31 },
    ];
    let remaining = julian;
    for (const m of months) {
        if (remaining <= m.days) {
            return { month: m.name, day: remaining };
        }
        remaining -= m.days;
    }
    return null;
}
// Tacoma production: T + year letter + 6 digits
function decodeTacoma(serial) {
    const yearLetter = serial.charAt(1);
    const julianStr = serial.substring(2, 5);
    const unitNum = serial.substring(5);
    const year = getYearFromLetter(yearLetter);
    const julian = parseInt(julianStr, 10);
    const dateInfo = julianToDate(julian);
    let yearStr = year ? year.toString() : `Unknown (letter ${yearLetter})`;
    let monthStr;
    let dayStr;
    if (dateInfo) {
        monthStr = dateInfo.month;
        dayStr = dateInfo.day.toString();
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearStr,
        month: monthStr,
        day: dayStr,
        factory: 'Tacoma, Washington (FMIC)',
        country: 'USA',
        notes: `T prefix indicates Tacoma, WA production (2005-2008). Year letter "${yearLetter}" = ${yearStr}. Julian day ${julian} = ${monthStr || 'Unknown'} ${dayStr || ''}. Unit #${unitNum} built that day. FMIC began building Guild guitars in Tacoma in early 2005.`,
    };
    return { success: true, info };
}
// New Hartford production: N + year letter + 6 digits
function decodeNewHartford(serial) {
    const yearLetter = serial.charAt(1);
    const julianStr = serial.substring(2, 5);
    const unitNum = serial.substring(5);
    const year = getYearFromLetter(yearLetter);
    const julian = parseInt(julianStr, 10);
    const dateInfo = julianToDate(julian);
    let yearStr = year ? year.toString() : `Unknown (letter ${yearLetter})`;
    let monthStr;
    let dayStr;
    if (dateInfo) {
        monthStr = dateInfo.month;
        dayStr = dateInfo.day.toString();
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearStr,
        month: monthStr,
        day: dayStr,
        factory: 'New Hartford, Connecticut',
        country: 'USA',
        notes: `N prefix indicates New Hartford, CT production (2008+). Year letter "${yearLetter}" = ${yearStr}. Julian day ${julian} = ${monthStr || 'Unknown'} ${dayStr || ''}. Unit #${unitNum} built that day.`,
    };
    return { success: true, info };
}
// Corona production: C prefix
function decodeCorona(serial) {
    const digits = serial.replace(/^C[A-Z]?/, '');
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: 'Corona era (check Guild records)',
        factory: 'Corona, California (Fender)',
        country: 'USA',
        notes: `C prefix indicates Corona, California production during Fender ownership. Production number: ${digits}. Contact Guild or check official records for exact date.`,
    };
    return { success: true, info };
}
// Korean production: Y prefix
function decodeKorea(serial) {
    const digits = serial.substring(1);
    // Try to extract year from first digits
    let yearInfo = 'Unknown';
    if (digits.length >= 2) {
        const firstTwo = digits.substring(0, 2);
        const yearNum = parseInt(firstTwo, 10);
        if (yearNum >= 0 && yearNum <= 30) {
            yearInfo = `20${firstTwo.padStart(2, '0')}`;
        }
        else if (yearNum >= 90 && yearNum <= 99) {
            yearInfo = `19${firstTwo}`;
        }
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearInfo,
        factory: 'Korea',
        country: 'South Korea',
        notes: `Y prefix indicates Korean production. Serial: ${digits}. Guild has produced various models in Korea, particularly the Newark St. electric guitar line.`,
    };
    return { success: true, info };
}
// Korean production: KS prefix
function decodeKoreaKS(serial) {
    const digits = serial.substring(2);
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: 'Check Guild records',
        factory: 'Korea',
        country: 'South Korea',
        notes: `KS prefix indicates Korean production. Serial: ${digits}. Contact Guild or check official records for exact date.`,
    };
    return { success: true, info };
}
// Chinese production: Z prefix
function decodeChina(serial) {
    const digits = serial.substring(1);
    // Try to extract year from first digits
    let yearInfo = 'Unknown';
    if (digits.length >= 2) {
        const firstTwo = digits.substring(0, 2);
        const yearNum = parseInt(firstTwo, 10);
        if (yearNum >= 0 && yearNum <= 30) {
            yearInfo = `20${firstTwo.padStart(2, '0')}`;
        }
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearInfo,
        factory: 'Zaozhuang Saehan (China)',
        country: 'China',
        notes: `Z prefix indicates Chinese production at Zaozhuang Saehan factory. Serial: ${digits}. Guild Westerly Collection acoustic models are made in China.`,
    };
    return { success: true, info };
}
// Indonesian production: SI prefix
function decodeIndonesia(serial) {
    const digits = serial.substring(2);
    // Try to extract year from first digits
    let yearInfo = 'Unknown';
    if (digits.length >= 2) {
        const firstTwo = digits.substring(0, 2);
        const yearNum = parseInt(firstTwo, 10);
        if (yearNum >= 0 && yearNum <= 30) {
            yearInfo = `20${firstTwo.padStart(2, '0')}`;
        }
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearInfo,
        factory: 'Indonesia (Samick)',
        country: 'Indonesia',
        notes: `SI prefix indicates Indonesian production (Samick Indonesia). Serial: ${digits}. Some Guild models, particularly in the Newark St. line, are made in Indonesia.`,
    };
    return { success: true, info };
}
// GAD series
function decodeGAD(serial) {
    const digits = serial.replace(/^GAD/i, '');
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: 'Check neck block for date',
        factory: 'Various',
        country: 'Various',
        notes: `GAD series guitar. The GAD number (${digits}) is a consecutive model number but does NOT indicate the production date. The actual serial number correlating to production date can be found on the heel block inside the guitar.`,
    };
    return { success: true, info };
}
// Model prefix format: Two letters + digits
function decodeModelPrefix(serial) {
    const prefix = serial.substring(0, 2);
    const digits = serial.substring(2);
    // Known model prefixes and their approximate meanings
    const modelPrefixes = {
        'AA': 'Artist Award',
        'AB': 'A-series acoustic',
        'AC': 'A-series acoustic',
        'AD': 'D-series (D4, etc.)',
        'AE': 'E-series',
        'AF': 'F-series (F30, F40, F50, etc.)',
        'AG': 'G-series',
        'AJ': 'D40/Jumbo series',
        'BA': 'B-series',
        'DA': 'D-series acoustic',
        'FA': 'F-series acoustic',
        'GA': 'G-series',
        'GF': 'Guild electric',
        'JF': 'Jumbo/F-series',
    };
    const modelGuess = modelPrefixes[prefix] || 'Unknown model series';
    // Determine era based on prefix format
    let era = '';
    if (/^[A-G][A-Z]$/.test(prefix)) {
        era = '1965-1999 (model-specific serial number system)';
    }
    else {
        era = '1979-1999 (model prefix era)';
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: era,
        factory: 'Westerly, Rhode Island (likely)',
        country: 'USA',
        model: modelGuess,
        notes: `Model prefix "${prefix}" suggests ${modelGuess}. Guild used model-specific serial number prefixes from 1965-1969 and again from 1979-1999. Production number: ${digits}. Check Guild's official dating charts for exact year based on serial number range.`,
    };
    return { success: true, info };
}
// Sequential numeric format (5-6 digits)
function decodeSequential(serial) {
    const num = parseInt(serial, 10);
    // Approximate year ranges based on known data
    let yearEstimate;
    let notes;
    if (num <= 1500) {
        yearEstimate = '1952-1953';
        notes = 'Very early Guild production in Manhattan, New York.';
    }
    else if (num <= 3000) {
        yearEstimate = '1954-1955';
        notes = 'Early Guild production.';
    }
    else if (num <= 5700) {
        yearEstimate = '1956-1957';
        notes = 'Early Guild production.';
    }
    else if (num <= 12035) {
        yearEstimate = '1958-1959';
        notes = 'Late 1950s Guild production.';
    }
    else if (num <= 22722) {
        yearEstimate = '1960-1963';
        notes = 'Early 1960s Guild production.';
    }
    else if (num <= 46695) {
        yearEstimate = '1964-1969';
        notes = 'Mid-to-late 1960s production. Note: From 1965-1969, Guild also used model-specific serial numbers.';
    }
    else if (num <= 95496) {
        yearEstimate = '1970-1973';
        notes = 'Early 1970s production in Westerly, Rhode Island.';
    }
    else if (num <= 150000) {
        yearEstimate = '1974-1976';
        notes = 'Mid-1970s production in Westerly, Rhode Island.';
    }
    else if (num <= 211877) {
        yearEstimate = '1977-1979';
        notes = 'Late 1970s production. After September 1979, Guild resumed model-specific prefixes.';
    }
    else {
        yearEstimate = 'Post-1979 or uncertain';
        notes = 'This serial number may be from after the sequential system ended (Sept 1979), or could be a model-specific number missing its prefix.';
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearEstimate,
        factory: 'New York / Hoboken / Westerly',
        country: 'USA',
        notes: `Sequential serial number format. ${notes} Guild production locations: Manhattan (1952-1956), Hoboken NJ (1956-1968), Westerly RI (1968-2001). Pre-1960 records are incomplete.`,
    };
    return { success: true, info };
}
// Longer numeric format (7+ digits)
function decodeLongNumeric(serial) {
    // Try to extract year from first digits
    const firstTwo = serial.substring(0, 2);
    const yearNum = parseInt(firstTwo, 10);
    let yearInfo = 'Unknown';
    if (yearNum >= 0 && yearNum <= 30) {
        yearInfo = `Possibly 20${firstTwo.padStart(2, '0')}`;
    }
    else if (yearNum >= 85 && yearNum <= 99) {
        yearInfo = `Possibly 19${firstTwo}`;
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: yearInfo,
        factory: 'Various (check instrument markings)',
        country: 'Check "Made in" label',
        notes: `Long numeric serial number. First two digits (${firstTwo}) may indicate year. Check the instrument for "Made in" marking to determine country of origin. Guild has produced guitars in USA, Korea, Indonesia, and China at various times.`,
    };
    return { success: true, info };
}
