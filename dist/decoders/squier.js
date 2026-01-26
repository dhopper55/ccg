/**
 * Squier Guitar Serial Number Decoder
 *
 * Supports:
 * - Japan JV series (1982-1984) - FujiGen
 * - Japan SQ series (1983-1984) - FujiGen
 * - Japan E series (1984-1987) - FujiGen
 * - Japan Letter prefixes (A-U, 1985-2008) - FujiGen/Tokai/Dyna
 * - Korea S prefix (Samick, late 80s-90s)
 * - Korea E prefix (Young Chang, late 80s-90s)
 * - Korea M prefix (early 90s)
 * - Korea VN prefix (Sunghan, 1990s)
 * - Korea KC/KV prefixes (Cor-Tek/Sunghan, 2-digit year)
 * - Korea CN prefix (Cor-Tek)
 * - Korea numeric-only (first digit = year)
 * - Indonesia IC/ICF/ICO prefix (Cort)
 * - Indonesia ICS + letter prefix (Cort, 2021+)
 * - Indonesia IS/ISS/SI prefix (Samick)
 * - China CY/YN prefix (Yako)
 * - China CXS/CA/CAE prefix (AXL)
 * - China CGS/CGR/CGT prefix (Grand Reward)
 * - China COB/COS prefix (Cor-Tek)
 * - China CSS prefix (Samick)
 * - China CYK + letter prefix (Yako, 2020+)
 * - China NC prefix (mid-90s)
 * - Mexico MN prefix (1990s)
 * - Mexico MZ prefix (2000s)
 * - USA E prefix (1980s)
 * - USA N prefix (1990s)
 */
// Japan letter prefixes for Crafted in Japan (CIJ) era
const JAPAN_LETTER_YEARS = {
    'A': { years: '1997-1998', factory: 'Tokai/Dyna' },
    'B': { years: '1998-1999', factory: 'Tokai/Dyna' },
    'N': { years: '1995-1996', factory: 'Tokai/Dyna' },
    'O': { years: '1997-2000', factory: 'Tokai/Dyna' },
    'P': { years: '1999-2002', factory: 'Tokai/Dyna' },
    'Q': { years: '2002-2004', factory: 'Tokai/Dyna' },
    'R': { years: '2004-2006', factory: 'Tokai/Dyna' },
    'S': { years: '2006-2008', factory: 'Tokai/Dyna' },
    'T': { years: '2007-2008', factory: 'Tokai/Dyna' },
    'U': { years: '2008+', factory: 'Tokai/Dyna' },
};
// Month letter codes used in modern serials (2020+)
const MONTH_LETTERS = {
    'A': 'January',
    'B': 'February',
    'C': 'March',
    'D': 'April',
    'E': 'May',
    'F': 'June',
    'G': 'July',
    'H': 'August',
    'I': 'September',
    'J': 'October',
    'K': 'November',
    'L': 'December',
};
export function decodeSquier(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Japan JV prefix (1982-1984) - FujiGen, highly collectible
    if (/^JV\d{5,6}$/.test(normalized)) {
        return decodeJapanJV(normalized);
    }
    // Japan SQ prefix (1983-1984) - FujiGen
    if (/^SQ\d{5,6}$/.test(normalized)) {
        return decodeJapanSQ(normalized);
    }
    // Japan E prefix (1984-1987) - FujiGen (when Made in Japan marked)
    // Note: E prefix is also used for USA 1980s and Korea Young Chang
    if (/^E\d{6,7}$/.test(normalized)) {
        return decodeEPrefix(normalized);
    }
    // Japan letter prefixes A-U (1985-2008) - CIJ era
    const japanLetterMatch = normalized.match(/^([A-U])(\d{6,7})$/);
    if (japanLetterMatch && JAPAN_LETTER_YEARS[japanLetterMatch[1]]) {
        return decodeJapanLetter(japanLetterMatch[1], japanLetterMatch[2], normalized);
    }
    // Korea VN prefix (Sunghan, 1990s)
    if (/^VN\d{6,7}$/.test(normalized)) {
        return decodeKoreaVN(normalized);
    }
    // Korea KC prefix (Cor-Tek, 2-digit year)
    if (/^KC\d{8}$/.test(normalized)) {
        return decodeKoreaKC(normalized);
    }
    // Korea KV prefix (Sunghan, 2-digit year)
    if (/^KV\d{8}$/.test(normalized)) {
        return decodeKoreaKV(normalized);
    }
    // Korea CN prefix (Cor-Tek)
    if (/^CN\d{6,7}$/.test(normalized)) {
        return decodeKoreaCN(normalized);
    }
    // Korea S prefix (Samick)
    if (/^S\d{6,7}$/.test(normalized)) {
        return decodeKoreaS(normalized);
    }
    // Korea M prefix (early 90s)
    if (/^M\d{7}$/.test(normalized)) {
        return decodeKoreaM(normalized);
    }
    // Indonesia ICS + letter prefix (Cort, 2021+)
    const icsMatch = normalized.match(/^ICS([A-L])(\d{2})(\d+)$/);
    if (icsMatch) {
        return decodeIndonesiaICS(icsMatch[1], icsMatch[2], icsMatch[3], normalized);
    }
    // Indonesia IC/ICF/ICO prefix (Cort)
    const icMatch = normalized.match(/^IC[FO]?(\d{2})(\d+)$/);
    if (icMatch) {
        return decodeIndonesiaIC(icMatch[1], icMatch[2], normalized);
    }
    // Indonesia ISS prefix (Samick)
    if (/^ISS\d{6}$/.test(normalized)) {
        return decodeIndonesiaISS(normalized);
    }
    // Indonesia IS prefix (Samick)
    const isMatch = normalized.match(/^IS(\d{2})(\d+)$/);
    if (isMatch) {
        return decodeIndonesiaIS(isMatch[1], isMatch[2], normalized);
    }
    // Indonesia SI prefix (Samick)
    const siMatch = normalized.match(/^SI(\d{2})(\d+)$/);
    if (siMatch) {
        return decodeIndonesiaSI(siMatch[1], siMatch[2], normalized);
    }
    // China CYK + letter prefix (Yako, 2020+)
    const cykMatch = normalized.match(/^CYK([A-L])(\d{2})(\d+)$/);
    if (cykMatch) {
        return decodeChinaCYK(cykMatch[1], cykMatch[2], cykMatch[3], normalized);
    }
    // China CY prefix (Yako)
    const cyMatch = normalized.match(/^CY(\d{2})(\d+)$/);
    if (cyMatch) {
        return decodeChinaCY(cyMatch[1], cyMatch[2], normalized);
    }
    // China YN prefix (Yako)
    if (/^YN\d{6,7}$/.test(normalized)) {
        return decodeChinaYN(normalized);
    }
    // China CXS prefix (AXL)
    const cxsMatch = normalized.match(/^CXS(\d{2})(\d{2})(\d+)$/);
    if (cxsMatch) {
        return decodeChinaCXS(cxsMatch[1], cxsMatch[2], cxsMatch[3], normalized);
    }
    // China CA/CAE prefix (AXL)
    const caMatch = normalized.match(/^CAE?(\d{2})(\d+)$/);
    if (caMatch) {
        return decodeChinaCA(caMatch[1], caMatch[2], normalized);
    }
    // China CGS/CGR/CGT prefix (Grand Reward)
    const cgMatch = normalized.match(/^CG[SRT](\d{2})(\d+)$/);
    if (cgMatch) {
        return decodeChinaCG(cgMatch[1], cgMatch[2], normalized);
    }
    // China COB/COS prefix (Cor-Tek)
    const coMatch = normalized.match(/^CO[BS](\d{2})(\d+)$/);
    if (coMatch) {
        return decodeChinaCO(coMatch[1], coMatch[2], normalized);
    }
    // China CSS prefix (Samick)
    const cssMatch = normalized.match(/^CSS(\d{2})(\d+)$/);
    if (cssMatch) {
        return decodeChinaCSS(cssMatch[1], cssMatch[2], normalized);
    }
    // China NC prefix (mid-90s)
    if (/^NC\d{6}$/.test(normalized)) {
        return decodeChinaNC(normalized);
    }
    // Mexico MN prefix (1990s)
    const mnMatch = normalized.match(/^MN(\d)(\d+)$/);
    if (mnMatch) {
        return decodeMexicoMN(mnMatch[1], mnMatch[2], normalized);
    }
    // Mexico MZ prefix (2000s)
    const mzMatch = normalized.match(/^MZ(\d)(\d+)$/);
    if (mzMatch) {
        return decodeMexicoMZ(mzMatch[1], mzMatch[2], normalized);
    }
    // USA N prefix (1990s) - rare for Squier
    if (/^N\d{6,7}$/.test(normalized)) {
        return decodeUSAN(normalized);
    }
    // Korea numeric-only (6-7 digits, first digit = year)
    if (/^\d{6,7}$/.test(normalized)) {
        return decodeKoreaNumeric(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Squier serial number. The format was not recognized. Please verify the serial number is correct and check for a "Made in..." label on the guitar.',
    };
}
function decodeJapanJV(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: '1982-1984',
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: 'Legendary JV (Japanese Vintage) series. These early Squiers are highly collectible and considered equal or superior to American Fenders of the same era. Made at the renowned FujiGen factory.',
    };
    return { success: true, info };
}
function decodeJapanSQ(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: '1983-1984',
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: 'SQ series with 70s Reissue specifications. Made at the FujiGen factory in Japan. These are well-regarded vintage Squiers.',
    };
    return { success: true, info };
}
function decodeEPrefix(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `198${yearDigit}`,
        notes: 'E prefix guitars from this era could be: (1) Made in Japan at FujiGen (1984-1987), (2) Made in USA (rare), or (3) Made in Korea by Young Chang. Check the guitar for "Made in..." label to confirm origin.',
    };
    return { success: true, info };
}
function decodeJapanLetter(letter, sequence, serial) {
    const letterInfo = JAPAN_LETTER_YEARS[letter];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: letterInfo.years,
        factory: letterInfo.factory,
        country: 'Japan',
        notes: `Crafted in Japan (CIJ) era Squier. Letter prefix ${letter} indicates ${letterInfo.years} production at ${letterInfo.factory} factory.`,
    };
    return { success: true, info };
}
function decodeKoreaVN(serial) {
    const yearDigit = serial[2];
    const year = `199${yearDigit}`;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        factory: 'Saehan/Sunghan',
        country: 'South Korea',
        notes: 'VN prefix indicates Korean production at the Saehan (also known as Sunghan) factory in the 1990s.',
    };
    return { success: true, info };
}
function decodeKoreaKC(serial) {
    const yearDigits = serial.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'South Korea',
        notes: 'KC prefix indicates Korean production at the Cor-Tek (Cort) factory.',
    };
    return { success: true, info };
}
function decodeKoreaKV(serial) {
    const yearDigits = serial.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Saehan/Sunghan',
        country: 'South Korea',
        notes: 'KV prefix indicates Korean production at the Saehan/Sunghan factory.',
    };
    return { success: true, info };
}
function decodeKoreaCN(serial) {
    const yearDigit = serial[2];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        factory: 'Cor-Tek (Cort)',
        country: 'South Korea',
        notes: 'CN prefix indicates Korean production at the Cor-Tek factory in the 1990s.',
    };
    return { success: true, info };
}
function decodeKoreaS(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `Late 1980s - early 1990s (digit ${yearDigit})`,
        factory: 'Samick',
        country: 'South Korea',
        notes: 'S prefix indicates Korean production at the Samick factory. Common in late 1980s and early 1990s.',
    };
    return { success: true, info };
}
function decodeKoreaM(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'South Korea',
        notes: 'M prefix Korean Squiers from the early 1990s. These often featured high gloss maple necks and slimmer 40mm bodies made from plywood.',
    };
    return { success: true, info };
}
function decodeKoreaNumeric(serial) {
    const yearDigit = serial[0];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'South Korea',
        notes: `Korean Squier with numeric-only serial. First digit (${yearDigit}) indicates the year 199${yearDigit}.`,
    };
    return { success: true, info };
}
function decodeIndonesiaICS(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter] || 'Unknown';
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Cor-Tek (Cort)',
        country: 'Indonesia',
        notes: 'ICS prefix indicates Indonesian Cort production (2021+). Uses modern 4-letter prefix format with month code.',
    };
    return { success: true, info };
}
function decodeIndonesiaIC(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'Indonesia',
        notes: 'IC prefix indicates Indonesian production at the Cort factory.',
    };
    return { success: true, info };
}
function decodeIndonesiaISS(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        factory: 'Samick',
        country: 'Indonesia',
        notes: 'ISS prefix indicates Indonesian production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeIndonesiaIS(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Samick',
        country: 'Indonesia',
        notes: 'IS prefix indicates Indonesian production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeIndonesiaSI(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Samick',
        country: 'Indonesia',
        notes: 'SI prefix indicates Indonesian Squier production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeChinaCYK(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter] || 'Unknown';
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Yako',
        country: 'China',
        notes: 'CYK prefix indicates Chinese Yako factory production (2020+). Uses modern 4-letter prefix format with month code.',
    };
    return { success: true, info };
}
function decodeChinaCY(yearDigits, sequence, serial) {
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Yako (Taiwan-owned)',
        country: 'China',
        notes: 'CY prefix indicates Chinese production at the Yako facility. Often marked as "Crafted in China".',
    };
    return { success: true, info };
}
function decodeChinaYN(serial) {
    const yearDigit = serial[2];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit} or 200${yearDigit}`,
        factory: 'Yako',
        country: 'China',
        notes: 'YN prefix indicates Chinese production at the Yako factory.',
    };
    return { success: true, info };
}
function decodeChinaCXS(monthDigits, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = getMonthName(month);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'AXL',
        country: 'China',
        notes: 'CXS prefix indicates Chinese production at the AXL factory (2007-2012).',
    };
    return { success: true, info };
}
function decodeChinaCA(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'AXL',
        country: 'China',
        notes: 'CA/CAE prefix indicates Chinese production at the AXL factory.',
    };
    return { success: true, info };
}
function decodeChinaCG(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Grand Reward',
        country: 'China',
        notes: 'CGS/CGR/CGT prefix indicates Chinese production at the Grand Reward factory.',
    };
    return { success: true, info };
}
function decodeChinaCO(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'China',
        notes: 'COB/COS prefix indicates Chinese production at the Cor-Tek factory.',
    };
    return { success: true, info };
}
function decodeChinaCSS(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Samick',
        country: 'China',
        notes: 'CSS prefix indicates Chinese production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeChinaNC(serial) {
    const yearDigit = serial[2];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'China',
        notes: 'NC prefix with "Made in China" on neck plate. Used between late 1994-1997.',
    };
    return { success: true, info };
}
function decodeMexicoMN(yearDigit, sequence, serial) {
    const year = `199${yearDigit}`;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: 'MN prefix indicates Mexican production in the 1990s. Squier production started in Mexico in 1991.',
    };
    return { success: true, info };
}
function decodeMexicoMZ(yearDigit, sequence, serial) {
    const year = `200${yearDigit}`;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: 'MZ prefix indicates Mexican production in the 2000s.',
    };
    return { success: true, info };
}
function decodeUSAN(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'USA',
        notes: 'N prefix USA-made Squier. These are rare - most N prefix guitars are Fenders, not Squiers. Verify the "Squier by Fender" logo on headstock.',
    };
    return { success: true, info };
}
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
}
