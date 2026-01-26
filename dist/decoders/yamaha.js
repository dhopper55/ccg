export function decodeYamaha(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Try each format in order of specificity
    // Japan Custom Shop 2004+: Letter-Letter-Letter-###-Letter (e.g., QLY111C)
    if (/^[A-Z]{3}\d{3}[A-Z]$/.test(normalized)) {
        return decodeJapanCustomShop2004(normalized);
    }
    // Japan Music Craft 2001+: Letter-Letter-Letter-###-Letter (e.g., QIL123A)
    // Same format as custom shop, handled above
    // Japan Custom Shop 1997-2003: Letter-Letter-### (e.g., NK333)
    if (/^[A-Z]{2}\d{3}$/.test(normalized)) {
        return decodeJapanCustomShop1997(normalized);
    }
    // Japan Custom Shop 1991-1996: Letter-Letter-###-Letter (e.g., HP213J)
    if (/^[A-Z]{2}\d{3}[A-Z]$/.test(normalized)) {
        return decodeJapanCustomShop1991(normalized);
    }
    // Japan Electric 2002+: Letter-Letter-Letter-###-Letter (e.g., QJM111E)
    // Same as custom shop format, handled above
    // Japan Electric 1997+: #-Letter-Letter-#### (e.g., 8FJ0013)
    if (/^\d[A-Z]{2}\d{4}$/.test(normalized)) {
        return decodeJapanElectric1997(normalized);
    }
    // Japan Electric 1994-1997: #-Letter-Letter-### (e.g., 7FM123)
    if (/^\d[A-Z]{2}\d{3}$/.test(normalized)) {
        return decodeJapanElectric1994(normalized);
    }
    // Japan Electric 1989-2002: Letter-Letter-Letter-Letter-### (e.g., SKJL321)
    if (/^[A-Z]{4}\d{3}$/.test(normalized)) {
        return decodeJapanElectric1989(normalized);
    }
    // Japan Electric 1986-1989: #-Letter-##### (e.g., 5I04013)
    if (/^\d[A-Z]\d{5}$/.test(normalized)) {
        return decodeJapanElectric1986(normalized);
    }
    // Japan Electric 1984-1996: Letter-Letter-#### (e.g., MI0031)
    if (/^[A-Z]{2}\d{4}$/.test(normalized)) {
        return decodeJapanElectric1984(normalized);
    }
    // Japan Tenryu 1969-1984: 6 digits YYMMUU (e.g., 710502)
    if (/^\d{6}$/.test(normalized)) {
        return decodeTenryu1969(normalized);
    }
    // Japan Tenryu 1946-1968: 5 digits (sequential only)
    if (/^\d{5}$/.test(normalized)) {
        return decodeTenryu1946(normalized);
    }
    // Standard format: Letter-Letter-##-### (e.g., HM02316)
    if (/^[A-Z]{2}\d{5}$/.test(normalized)) {
        return decodeStandard(normalized);
    }
    // Taiwan 2002+: Letter-Letter-Letter-###### (e.g., QJM120013)
    if (/^[A-Z]{3}\d{6}$/.test(normalized)) {
        return decodeTaiwan2002(normalized);
    }
    // Taiwan 1984-2002: Letter-Letter-##### (e.g., PH07123)
    // This overlaps with standard format, handled by decodeStandard
    // Indonesia 2001+: Letter-Letter-Letter-###### (e.g., QIM180013)
    // Same format as Taiwan 2002+, factory determined by context
    // Indonesia 2000+: 10 digits YYMMDDXXXX
    if (/^\d{10}$/.test(normalized)) {
        return decodeIndonesia2000(normalized);
    }
    // Indonesia 1997-1999: 9 digits YMMDDXXXX
    if (/^\d{9}$/.test(normalized)) {
        return decodeIndonesia1997(normalized);
    }
    // Indonesia 1990-1996: 8 digits YMMDDXXX
    if (/^\d{8}$/.test(normalized)) {
        return decodeIndonesia1990(normalized);
    }
    // Korea/China 2003+: Letter-Letter-Letter-####-Letter (e.g., QKJ0011Y)
    if (/^[A-Z]{3}\d{4}[A-Z]$/.test(normalized)) {
        return decodeKoreaChina2003(normalized);
    }
    return {
        success: false,
        error: 'Unrecognized Yamaha serial number format. Yamaha has used many different serial number systems across factories in Japan, Taiwan, Indonesia, Korea, and China. Common formats include: 2 letters + 5 digits (standard), 3 letters + 6 digits (Taiwan/Indonesia 2001+), or various numeric formats.'
    };
}
// Year letter mapping (H=1, I=2, ... Q=0)
function getYearDigit(letter) {
    const mapping = {
        'H': 1, 'I': 2, 'J': 3, 'K': 4, 'L': 5,
        'M': 6, 'N': 7, 'O': 8, 'P': 9, 'Q': 0
    };
    return mapping[letter] ?? -1;
}
// Month letter mapping
function getMonthFromLetter(letter) {
    const mapping = {
        'H': 1, // January
        'I': 2, // February
        'J': 3, // March
        'K': 4, // April
        'L': 5, // May
        'M': 6, // June
        'N': 7, // July
        'O': 8, // August
        'P': 9, // September
        'X': 10, // October
        'Y': 11, // November
        'Z': 12 // December
    };
    return mapping[letter] ?? 0;
}
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return month >= 1 && month <= 12 ? months[month - 1] : 'Unknown';
}
// Determine likely decade based on year digit
function getPossibleYears(yearDigit) {
    const baseYears = [];
    for (let decade = 1960; decade <= 2020; decade += 10) {
        const year = decade + yearDigit;
        if (year >= 1966 && year <= new Date().getFullYear()) {
            baseYears.push(year);
        }
    }
    if (baseYears.length === 1) {
        return baseYears[0].toString();
    }
    return baseYears.join(' or ');
}
// Standard format: Letter-Letter-##-### (e.g., HM02316)
function decodeStandard(serial) {
    const yearLetter = serial[0];
    const monthLetter = serial[1];
    const day = parseInt(serial.substring(2, 4), 10);
    const unit = parseInt(serial.substring(4), 10);
    const yearDigit = getYearDigit(yearLetter);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit === -1 || month === 0) {
        return {
            success: false,
            error: 'Invalid year or month code in serial number.'
        };
    }
    const possibleYears = getPossibleYears(yearDigit);
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: possibleYears,
        month: getMonthName(month),
        day: day > 0 && day <= 31 ? day.toString() : undefined,
        country: 'Japan (likely)',
        notes: `Unit #${unit} built on day ${day}. Yamaha serial numbers repeat every 10 years, so the exact decade may need to be determined by model features.`
    };
    return { success: true, info };
}
// Japan Custom Shop 2004+: Letter-Letter-Letter-###-Letter
function decodeJapanCustomShop2004(serial) {
    const yearLetter1 = serial[0];
    const yearLetter2 = serial[1];
    const monthLetter = serial[2];
    const unit = parseInt(serial.substring(3, 6), 10);
    const yearDigit1 = getYearDigit(yearLetter1);
    const yearDigit2 = getYearDigit(yearLetter2);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit1 === -1 || yearDigit2 === -1) {
        return {
            success: false,
            error: 'Invalid year code in serial number.'
        };
    }
    // Two-digit year: e.g., QI = 02 = 2002, QN = 07 = 2007
    const twoDigitYear = yearDigit1 * 10 + yearDigit2;
    const year = 2000 + twoDigitYear;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Yamaha Custom Shop / Music Craft',
        country: 'Japan',
        notes: `Unit #${unit}. This format is used for premium Japanese-made guitars from 2004 onwards.`
    };
    return { success: true, info };
}
// Japan Custom Shop 1997-2003: Letter-Letter-###
function decodeJapanCustomShop1997(serial) {
    const yearLetter = serial[0];
    const monthLetter = serial[1];
    const unit = parseInt(serial.substring(2), 10);
    const yearDigit = getYearDigit(yearLetter);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit === -1) {
        return {
            success: false,
            error: 'Invalid year code in serial number.'
        };
    }
    // Single digit year in 1997-2003 range
    const year = yearDigit >= 7 ? 1990 + yearDigit : 2000 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Yamaha Custom Shop',
        country: 'Japan',
        notes: `Unit #${unit}. Custom Shop format used 1997-2003.`
    };
    return { success: true, info };
}
// Japan Custom Shop 1991-1996: Letter-Letter-###-Letter
function decodeJapanCustomShop1991(serial) {
    const yearLetter = serial[0];
    const monthLetter = serial[1];
    const unit = parseInt(serial.substring(2, 5), 10);
    const yearDigit = getYearDigit(yearLetter);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit === -1) {
        return {
            success: false,
            error: 'Invalid year code in serial number.'
        };
    }
    const year = 1990 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Yamaha Custom Shop',
        country: 'Japan',
        notes: `Unit #${unit}. Custom Shop format used 1991-1996.`
    };
    return { success: true, info };
}
// Japan Electric 1997+: #-Letter-Letter-####
function decodeJapanElectric1997(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const factoryLetter = serial[1];
    const monthLetter = serial[2];
    const unit = parseInt(serial.substring(3), 10);
    const month = getMonthFromLetter(monthLetter);
    // Determine year (1997-2009 range for single digit)
    const year = yearDigit >= 7 ? 1990 + yearDigit : 2000 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Japan Electric Guitar Factory',
        country: 'Japan',
        notes: `Unit #${unit}. Factory code: ${factoryLetter}. Format used for electric/bass guitars 1997+.`
    };
    return { success: true, info };
}
// Japan Electric 1994-1997: #-Letter-Letter-###
function decodeJapanElectric1994(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const factoryLetter = serial[1];
    const monthLetter = serial[2];
    const unit = parseInt(serial.substring(3), 10);
    const month = getMonthFromLetter(monthLetter);
    const year = 1990 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Japan Electric Guitar Factory',
        country: 'Japan',
        notes: `Unit #${unit}. Factory code: ${factoryLetter}. Format used 1994-1997.`
    };
    return { success: true, info };
}
// Japan Electric 1989-2002: Letter-Letter-Letter-Letter-###
function decodeJapanElectric1989(serial) {
    const letter1 = serial[0];
    const letter2 = serial[1];
    const letter3 = serial[2];
    const letter4 = serial[3];
    const unit = parseInt(serial.substring(4), 10);
    // First letter might be factory, second year, third month
    const yearDigit = getYearDigit(letter2);
    const month = getMonthFromLetter(letter3);
    let year;
    if (yearDigit !== -1) {
        const possibleYear = yearDigit >= 9 ? 1980 + yearDigit : (yearDigit >= 0 ? 1990 + yearDigit : 2000 + yearDigit);
        year = possibleYear.toString();
    }
    else {
        year = '1989-2002';
    }
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year,
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Japan Electric Guitar Factory',
        country: 'Japan',
        notes: `Unit #${unit}. Four-letter prefix format used 1989-2002 for electric/bass guitars.`
    };
    return { success: true, info };
}
// Japan Electric 1986-1989: #-Letter-#####
function decodeJapanElectric1986(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const monthLetter = serial[1];
    const remaining = serial.substring(2);
    const month = getMonthFromLetter(monthLetter);
    const year = 1980 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Japan Electric Guitar Factory',
        country: 'Japan',
        notes: `Production code: ${remaining}. Format used 1986-1989.`
    };
    return { success: true, info };
}
// Japan Electric 1984-1996: Letter-Letter-####
function decodeJapanElectric1984(serial) {
    const yearLetter = serial[0];
    const monthLetter = serial[1];
    const unit = parseInt(serial.substring(2), 10);
    const yearDigit = getYearDigit(yearLetter);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit === -1) {
        return {
            success: false,
            error: 'Invalid year code in serial number.'
        };
    }
    // Could be 1984-1996
    const possibleYears = getPossibleYears(yearDigit);
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: possibleYears,
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Japan Electric Guitar Factory',
        country: 'Japan',
        notes: `Unit #${unit}. Format used 1984-1996 for electric/bass guitars.`
    };
    return { success: true, info };
}
// Tenryu/Wada 1969-1984: 6 digits YYMMUU
function decodeTenryu1969(serial) {
    const yearDigits = serial.substring(0, 2);
    const month = parseInt(serial.substring(2, 4), 10);
    const unit = parseInt(serial.substring(4), 10);
    const year = parseInt(yearDigits, 10);
    const fullYear = year >= 69 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: fullYear.toString(),
        month: month >= 1 && month <= 12 ? getMonthName(month) : undefined,
        factory: 'Tenryu/Wada Factory',
        country: 'Japan',
        notes: `Unit #${unit}. Tenryu/Wada factory produced acoustic guitars 1969-1984.`
    };
    return { success: true, info };
}
// Tenryu/Wada 1946-1968: 5 digits (sequential)
function decodeTenryu1946(serial) {
    const unit = parseInt(serial, 10);
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: '1946-1968',
        factory: 'Tenryu/Wada Factory',
        country: 'Japan',
        notes: `Sequential serial #${unit}. Early Tenryu/Wada production used sequential numbering without date encoding.`
    };
    return { success: true, info };
}
// Taiwan 2002+: Letter-Letter-Letter-######
function decodeTaiwan2002(serial) {
    const yearLetter1 = serial[0];
    const yearLetter2 = serial[1];
    const monthLetter = serial[2];
    const day = parseInt(serial.substring(3, 5), 10);
    const unit = parseInt(serial.substring(5), 10);
    const yearDigit1 = getYearDigit(yearLetter1);
    const yearDigit2 = getYearDigit(yearLetter2);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit1 === -1 || yearDigit2 === -1) {
        return {
            success: false,
            error: 'Invalid year code in serial number.'
        };
    }
    const twoDigitYear = yearDigit1 * 10 + yearDigit2;
    const year = 2000 + twoDigitYear;
    // Could be Taiwan or Indonesia - both use this format
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        day: day > 0 && day <= 31 ? day.toString() : undefined,
        factory: 'Kaohsiung (Taiwan) or YMMI (Indonesia)',
        country: 'Taiwan or Indonesia',
        notes: `Unit #${unit}. This format is used by both Taiwan and Indonesia factories from 2001/2002 onwards. Check the label inside your guitar for exact origin.`
    };
    return { success: true, info };
}
// Indonesia 2000+: 10 digits YYMMDDXXXX
function decodeIndonesia2000(serial) {
    const year = parseInt(serial.substring(0, 2), 10) + 2000;
    const month = parseInt(serial.substring(2, 4), 10);
    const day = parseInt(serial.substring(4, 6), 10);
    const unit = parseInt(serial.substring(6), 10);
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month >= 1 && month <= 12 ? getMonthName(month) : undefined,
        day: day > 0 && day <= 31 ? day.toString() : undefined,
        factory: 'YMMI (Yamaha Music Manufacturing Indonesia)',
        country: 'Indonesia',
        notes: `Unit #${unit}. 10-digit format used from 2000 onwards.`
    };
    return { success: true, info };
}
// Indonesia 1997-1999: 9 digits YMMDDXXXX
function decodeIndonesia1997(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const month = parseInt(serial.substring(1, 3), 10);
    const day = parseInt(serial.substring(3, 5), 10);
    const unit = parseInt(serial.substring(5), 10);
    const year = 1990 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month >= 1 && month <= 12 ? getMonthName(month) : undefined,
        day: day > 0 && day <= 31 ? day.toString() : undefined,
        factory: 'YMMI (Yamaha Music Manufacturing Indonesia)',
        country: 'Indonesia',
        notes: `Unit #${unit}. 9-digit format used 1997-1999.`
    };
    return { success: true, info };
}
// Indonesia 1990-1996: 8 digits YMMDDXXX
function decodeIndonesia1990(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const month = parseInt(serial.substring(1, 3), 10);
    const day = parseInt(serial.substring(3, 5), 10);
    const unit = parseInt(serial.substring(5), 10);
    const year = 1990 + yearDigit;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month >= 1 && month <= 12 ? getMonthName(month) : undefined,
        day: day > 0 && day <= 31 ? day.toString() : undefined,
        factory: 'YMMI (Yamaha Music Manufacturing Indonesia)',
        country: 'Indonesia',
        notes: `Unit #${unit}. 8-digit format used 1990-1996.`
    };
    return { success: true, info };
}
// Korea/China 2003+: Letter-Letter-Letter-####-Letter
function decodeKoreaChina2003(serial) {
    const yearLetter1 = serial[0];
    const yearLetter2 = serial[1];
    const monthLetter = serial[2];
    const unit = parseInt(serial.substring(3, 7), 10);
    const yearDigit1 = getYearDigit(yearLetter1);
    const yearDigit2 = getYearDigit(yearLetter2);
    const month = getMonthFromLetter(monthLetter);
    if (yearDigit1 === -1 || yearDigit2 === -1) {
        return {
            success: false,
            error: 'Invalid year code in serial number.'
        };
    }
    const twoDigitYear = yearDigit1 * 10 + yearDigit2;
    const year = 2000 + twoDigitYear;
    const info = {
        brand: 'Yamaha',
        serialNumber: serial,
        year: year.toString(),
        month: month > 0 ? getMonthName(month) : undefined,
        factory: 'Korea or China',
        country: 'Korea or China',
        notes: `Unit #${unit}. This format is used for Korean and Chinese production from 2003 onwards.`
    };
    return { success: true, info };
}
