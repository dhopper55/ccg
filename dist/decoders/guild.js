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
    // Korean production (modern solid-body electrics: T-Bird, Bluesbird, S-100): KWM prefix (Korea World Musical, WMI)
    if (/^KWM\d{6,8}$/.test(normalized)) {
        return decodeKoreaWMIKWM(normalized);
    }
    // Chinese production: Z prefix (Zaozhuang Saehan)
    if (/^Z\d{6,10}$/.test(normalized)) {
        return decodeChina(normalized);
    }
    // Indonesian production: SI prefix
    if (/^SI\d{6,10}$/.test(normalized)) {
        return decodeIndonesia(normalized);
    }
    // Korean production (Newark St. Collection): KSG prefix (Korea, SPG factory, Guild)
    // KSG + YY + 5-digit sequence, or KSG + YY + 4-digit sequence + trailing letter (e.g. L = left-handed)
    if (/^KSG\d{6,7}[A-Z]?$/.test(normalized)) {
        return decodeKoreaSPGGuildKSG(normalized);
    }
    // Indonesian production (Newark St. Collection / Starfire I): ISG prefix (Indonesia, Samick, Guild)
    // ISG + YYMM + 5-digit sequence
    if (/^ISG\d{9}$/.test(normalized)) {
        return decodeIndonesiaSamickGuildISG(normalized);
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
    // GAD-era 10-digit neck-block manufacturing code: YY MM BB UUUU
    if (/^\d{10}$/.test(normalized)) {
        return decodeGADNeckBlockCode(normalized);
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
// Korean production: KWM prefix (Korea World Musical, WMI factory)
function decodeKoreaWMIKWM(serial) {
    const digits = serial.substring(3);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: year.toString(),
        factory: 'World Musical Instrument Co., Ltd. (WMI), Incheon, Korea',
        country: 'South Korea',
        notes: `KWM prefix indicates Korea World Musical — the WMI factory in Incheon, South Korea, used for Guild's modern solid-body and semi-hollow electrics (T-Bird, Bluesbird, S-100). Digits ${yearDigits} decode as production year ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}).`,
    };
    return {
        success: true,
        info,
        patternKey: 'guild-korea-wmi-kwm-yy-sequence',
        patternLabel: 'Guild Korea WMI KWM-prefix YY sequence',
        additionalContext: {
            title: 'Guild KWM-prefix (Korea WMI) serial',
            summary: 'This serial matches the KWM-prefix format used on Guild solid-body electrics built at the WMI factory in Incheon, South Korea.',
            highlights: [
                'KWM identifies Korea World Musical — the WMI factory in Incheon, South Korea.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies factory and production date, not the exact model name.',
                'Commonly seen on T-Bird, Bluesbird solid, and S-100 models.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare body shape and hardware against Guild catalog specs for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the KWM-prefix format used on Guild solid-body electrics built at the WMI factory in Incheon, South Korea.</p><h3>How This Pattern Is Typically Read</h3><p>KWM identifies Korea World Musical — the WMI factory in Incheon, South Korea. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Commonly seen on T-Bird, Bluesbird solid, and S-100 models.</li><li>Check the back of the headstock for a Made in Korea stamp.</li></ul>`,
    };
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
// Korean production (Newark St. Collection): KSG prefix (Korea, SPG factory, Guild)
// KSG + YY + 5-digit sequence, or KSG + YY + 4-digit sequence + trailing letter suffix (e.g. L = left-handed)
function decodeKoreaSPGGuildKSG(serial) {
    const digits = serial.substring(3);
    const suffixMatch = digits.match(/^(\d+)([A-Z])?$/);
    const numericPart = suffixMatch ? suffixMatch[1] : digits;
    const suffix = suffixMatch && suffixMatch[2] ? suffixMatch[2] : undefined;
    const yearDigits = numericPart.substring(0, 2);
    const sequence = numericPart.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const suffixNote = suffix === 'L' ? ' The trailing "L" indicates a left-handed configuration.' : suffix ? ` The trailing "${suffix}" is a variant/configuration code.` : '';
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: year.toString(),
        factory: 'SPG (Sound Professional Guitar Co., Ltd.), Korea',
        country: 'South Korea',
        notes: `KSG prefix indicates the Newark St. Collection built at the SPG factory in Korea (K=Korea, S=SPG, G=Guild). Digits ${yearDigits} decode as production year ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}).${suffixNote}`,
    };
    return {
        success: true,
        info,
        patternKey: 'guild-korea-spg-ksg-yy-sequence',
        patternLabel: 'Guild Korea SPG KSG-prefix YY sequence',
        additionalContext: {
            title: 'Guild KSG-prefix (Korea SPG) serial',
            summary: 'This serial matches the KSG-prefix format used on Guild Newark St. Collection guitars built at the SPG factory in Korea.',
            highlights: [
                'KSG identifies Korea, SPG (Sound Professional Guitar Co., Ltd.), Guild.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies factory and production date, not the exact model name.',
                'Confirm the model (Starfire, Aristocrat, etc.) from headstock and body markings.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare body shape and hardware against Guild Newark St. Collection catalogs for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the KSG-prefix format used on Guild Newark St. Collection guitars built at the SPG factory in Korea.</p><h3>How This Pattern Is Typically Read</h3><p>KSG identifies Korea, SPG (Sound Professional Guitar Co., Ltd.), Guild. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.${suffixNote}</p><h3>What To Verify</h3><ul><li>Confirm the model (Starfire, Aristocrat, etc.) from headstock and body markings.</li><li>Check the back of the headstock for a Made in Korea stamp.</li></ul>`,
    };
}
// Indonesian production (Newark St. Collection / Starfire I): ISG prefix (Indonesia, Samick, Guild)
function decodeIndonesiaSamickGuildISG(serial) {
    const digits = serial.substring(3);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'P.T. Samick, Indonesia',
        country: 'Indonesia',
        notes: `ISG prefix indicates Indonesian production at the Samick factory (I=Indonesia, S=Samick, G=Guild), commonly seen on Starfire I and Polara models. Digits ${yearDigits} decode as production year ${year}; ${monthDigits} decodes as ${monthName || 'the production month'}; ${sequence} is the production sequence (unit ${sequenceNumber}).`,
    };
    return {
        success: true,
        info,
        patternKey: 'guild-indonesia-samick-isg-yymm-sequence',
        patternLabel: 'Guild Indonesia Samick ISG-prefix YYMM sequence',
        additionalContext: {
            title: 'Guild ISG-prefix (Indonesia Samick) serial',
            summary: 'This serial matches the ISG-prefix format used on Guild guitars built at the Samick factory in Indonesia.',
            highlights: [
                'ISG identifies Indonesia, Samick, Guild.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are the production month code.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies factory and production date, not the exact model name.',
                'Commonly seen on Starfire I and Polara series electrics.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Indonesia stamp.',
                'Compare body shape and hardware against Guild Starfire/Polara catalogs for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ISG-prefix format used on Guild guitars built at the Samick factory in Indonesia, commonly seen on Starfire I and Polara models.</p><h3>How This Pattern Is Typically Read</h3><p>ISG identifies Indonesia, Samick, Guild. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${monthName || 'the production month'}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for a Made in Indonesia stamp.</li><li>Compare against Guild Starfire/Polara catalogs for ${year}.</li></ul>`,
    };
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
function decodeGADNeckBlockCode(serial) {
    const yearPart = serial.substring(0, 2);
    const monthPart = serial.substring(2, 4);
    const batchCode = serial.substring(4, 6);
    const unitNumber = serial.substring(6);
    const yearValue = parseInt(yearPart, 10);
    const monthValue = parseInt(monthPart, 10);
    const monthName = getMonthName(monthValue);
    const fullYear = Number.isNaN(yearValue) ? undefined : 2000 + yearValue;
    const unit = parseInt(unitNumber, 10);
    if (!fullYear || !monthName) {
        return {
            success: false,
            error: 'Unable to decode this Guild serial number.',
        };
    }
    const info = {
        brand: 'Guild',
        serialNumber: serial,
        year: fullYear.toString(),
        month: monthName,
        factory: 'Guild GAD Chinese import production',
        country: 'China',
        model: 'GAD Series acoustic',
        notes: `GAD-era 10-digit neck-block manufacturing code interpreted as YYMMBBUUUU. Year: ${fullYear}; month: ${monthName}; batch/vendor code: ${batchCode}; unit number: ${unit}. This code is typically stamped into the wooden neck heel block on Guild GAD-Series Chinese imports and can differ from the paper-label GAD tracking number.`,
    };
    return {
        success: true,
        info,
        patternKey: 'guild-gad-10-digit-neck-block-yymm-batch-unit',
        patternLabel: 'Guild GAD 10-digit neck-block YYMM batch unit',
        additionalContext: {
            title: 'Guild GAD neck-block manufacturing code',
            summary: 'This serial matches the 10-digit neck-block manufacturing code used on Guild GAD-Series Chinese import acoustics.',
            highlights: [
                `The digits ${yearPart} decode as production year ${fullYear}.`,
                `The digits ${monthPart} decode as ${monthName}.`,
                `The digits ${batchCode} are an internal batch or vendor code.`,
                `The final four digits decode as unit number ${unit}.`,
            ],
            caveats: [
                'This neck-block code can differ from the paper soundhole label tracking number.',
                'The code identifies production date and batch tracking, not the exact model by itself.',
                'Confirm the model from the soundhole label and physical specifications.',
            ],
            verificationTips: [
                'Look for this number stamped into the wooden neck block inside the soundhole.',
                'Compare the label model, bracing, and woods to known GAD-Series specifications.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the 10-digit neck-block manufacturing code used on Guild GAD-Series Chinese import acoustics.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearPart} decode as production year ${fullYear}. The digits ${monthPart} decode as ${monthName}. The digits ${batchCode} are an internal batch or vendor code. The final four digits decode as unit number ${unit}.</p><h3>What To Verify</h3><ul><li>This neck-block code can differ from the paper soundhole label tracking number.</li><li>The code identifies production date and batch tracking, not the exact model by itself.</li><li>Confirm the model from the soundhole label and physical specifications.</li></ul>`,
    };
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
function getMonthName(monthValue) {
    switch (monthValue) {
        case 1:
            return 'January';
        case 2:
            return 'February';
        case 3:
            return 'March';
        case 4:
            return 'April';
        case 5:
            return 'May';
        case 6:
            return 'June';
        case 7:
            return 'July';
        case 8:
            return 'August';
        case 9:
            return 'September';
        case 10:
            return 'October';
        case 11:
            return 'November';
        case 12:
            return 'December';
        default:
            return undefined;
    }
}
