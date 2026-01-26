/**
 * Ernie Ball Music Man Guitar/Bass Serial Number Decoder
 *
 * Supports:
 * - G prefix (1998-2021): Standard production, PDN, BFR
 * - H prefix (2021+): Current standard production
 * - D prefix (2021+): Ball Family Reserve (BFR)
 * - M prefix (2016+): Majesty guitars (6-digit)
 * - L prefix: Left-handed instruments
 * - F prefix: 7-string Petrucci and special runs
 * - S prefix: Artist signature models (Tosin Abasi, Jason Richardson)
 * - X prefix (2003-2007): SUB-1 guitars
 * - A prefix (1990s): Transitional period
 * - E prefix: Early EB production
 * - B prefix: Pre-EB and early EB basses
 * - 5-digit numeric (1985-1989): Early headstock format
 * - 5-digit numeric (1990s): Neck plate format
 *
 * Note: All EBMM instruments are made in San Luis Obispo, CA, USA.
 * Sterling by Music Man (Indonesia) serials are not supported by EBMM database.
 */
export function decodeErnieBall(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Majesty guitars: M + 6 digits (2016+)
    if (/^M\d{6}$/.test(normalized)) {
        return decodeMajesty(normalized);
    }
    // H prefix: Current production (2021+)
    if (/^H\d{5}$/.test(normalized)) {
        return decodeHSeries(normalized);
    }
    // G prefix: Standard production (1998-2021)
    if (/^G\d{5}$/.test(normalized)) {
        return decodeGSeries(normalized);
    }
    // D prefix: Ball Family Reserve (2021+)
    if (/^D\d{5}$/.test(normalized)) {
        return decodeDSeries(normalized);
    }
    // L prefix: Left-handed instruments
    if (/^L\d{5}$/.test(normalized)) {
        return decodeLSeries(normalized);
    }
    // F prefix: 7-string Petrucci and special runs
    if (/^F\d{5}$/.test(normalized)) {
        return decodeFSeries(normalized);
    }
    // S prefix: Artist signature models
    if (/^S\d{5}$/.test(normalized)) {
        return decodeSSeries(normalized);
    }
    // X prefix: SUB-1 guitars (2003-2007)
    if (/^X\d{5}$/.test(normalized)) {
        return decodeXSeries(normalized);
    }
    // A prefix: Transitional period (1990s)
    if (/^A\d{5,6}$/.test(normalized)) {
        return decodeASeries(normalized);
    }
    // E prefix: Early EB production
    if (/^E\d{5,6}$/.test(normalized)) {
        return decodeESeries(normalized);
    }
    // B prefix: Pre-EB and early EB basses
    if (/^B\d{5,6}$/.test(normalized)) {
        return decodeBSeries(normalized);
    }
    // Sterling by Music Man: SR prefix (Indonesia)
    if (/^SR\d{5,6}$/.test(normalized)) {
        return decodeSterling(normalized);
    }
    // 5-digit numeric: 1985-1999 (various eras)
    if (/^\d{5}$/.test(normalized)) {
        return decode5Digit(normalized);
    }
    // 6-digit numeric
    if (/^\d{6}$/.test(normalized)) {
        return decode6Digit(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Ernie Ball Music Man serial number. The format was not recognized. Common formats include: G/H/D + 5 digits (USA production), M + 6 digits (Majesty), L prefix (left-handed), or 5-digit numeric (1985-1999). Note: Sterling by Music Man (Indonesian) instruments are not in the EBMM database - contact info@sterlingbymusicman.com for those.',
    };
}
// Majesty guitars: M + 6 digits (Oct 2016+)
function decodeMajesty(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: '2016 or later',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        model: 'Majesty',
        notes: `M-prefix indicates a Majesty guitar (John Petrucci signature, available in 6, 7, and 8-string models). Serial is silk-screened under the California logo on the back of the headstock. Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// H prefix: Current production (2021+)
function decodeHSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: '2021 or later',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: `H-prefix is the current default for regular production instruments from mid-2021 onward. Serial numbers are non-sequential. Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// G prefix: Standard production (1998-2021)
function decodeGSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: '1998-2021 (approximately)',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: `G-prefix was the default for most guitars from December 1997 through early 2021. Used for regular production, limited editions, Premier Dealer Network (PDN), and Ball Family Reserve (BFR) instruments. Serial numbers are non-sequential. Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// D prefix: Ball Family Reserve (2021+)
function decodeDSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: '2021 or later',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        model: 'Ball Family Reserve (BFR)',
        notes: `D-prefix is used for Ball Family Reserve (BFR) runs from 2021 onward. BFR instruments are limited edition, high-end models with premium features. Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// L prefix: Left-handed instruments
function decodeLSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: 'Various (check EBMM database)',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: `L-prefix indicates a left-handed instrument. Used concurrently with G-series and later prefixes. Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// F prefix: 7-string Petrucci and special runs
function decodeFSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: 'Various (check EBMM database)',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        model: '7-string or Special Dealer Run',
        notes: `F-prefix is used for 7-string Petrucci models and some special dealer limited runs. Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// S prefix: Artist signature models
function decodeSSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: 'Various (check EBMM database)',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        model: 'Artist Signature Model',
        notes: `S-prefix is used for artist signature models (such as Tosin Abasi, Jason Richardson, and others). Production sequence: ${sequence}. Use the official EBMM database at music-man.com for exact date.`,
    };
    return { success: true, info };
}
// X prefix: SUB-1 guitars (2003-2007)
function decodeXSeries(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: '2003-2007',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        model: 'SUB-1',
        notes: `X-prefix was used for SUB-1 guitars from 2003-2007. These were more affordable USA-made instruments. The serial number was typically on a sticker on the back of the headstock. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// A prefix: Transitional period (1990s)
function decodeASeries(serial) {
    const digits = serial.substring(1);
    // A8xxxx, A9xxxx, A91xxx, A92xxx patterns
    let yearRange = '1990-1997';
    if (digits.startsWith('8')) {
        yearRange = '1988-1990 (approximately)';
    }
    else if (digits.startsWith('90')) {
        yearRange = '1990';
    }
    else if (digits.startsWith('91')) {
        yearRange = '1991';
    }
    else if (digits.startsWith('92')) {
        yearRange = '1992';
    }
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: yearRange,
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: `A-prefix was used during the transitional period in the early 1990s. There may be number overlap with non-prefixed 1990-1992 guitars (e.g., 92111 and A92111 are both possible). Production number: ${digits}.`,
    };
    return { success: true, info };
}
// E prefix: Early EB production
function decodeESeries(serial) {
    const digits = serial.substring(1);
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: '1984-1990s (early EB era)',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: `E-prefix indicates early Ernie Ball era production. Ernie Ball acquired Music Man on March 3, 1984. Production number: ${digits}. Older serial numbers may not appear in the online database.`,
    };
    return { success: true, info };
}
// B prefix: Pre-EB and early EB basses
function decodeBSeries(serial) {
    const digits = serial.substring(1);
    const serialNum = parseInt(digits, 10);
    let yearEstimate;
    let notes;
    // Rough estimates based on known serial ranges
    if (serialNum <= 2500) {
        yearEstimate = '1976-1977 (Pre-EB)';
        notes = 'Very early production. Pre-Ernie Ball Music Man era (CLF Research production for Music Man).';
    }
    else if (serialNum <= 7000) {
        yearEstimate = '1977-1978 (Pre-EB)';
        notes = 'Pre-Ernie Ball Music Man era.';
    }
    else if (serialNum <= 15000) {
        yearEstimate = '1978-1979 (Pre-EB)';
        notes = 'Pre-Ernie Ball Music Man era. 1979 was the peak production year.';
    }
    else if (serialNum <= 25000) {
        yearEstimate = '1979-1983 (Pre-EB)';
        notes = 'Late Pre-Ernie Ball era. Production declined significantly after 1979.';
    }
    else {
        yearEstimate = '1984+ (Early EB) or Pre-EB';
        notes = 'Could be early Ernie Ball production (1984+) or late Pre-EB. B-prefix was used in both eras.';
    }
    const info = {
        brand: 'Music Man',
        serialNumber: serial,
        year: yearEstimate,
        factory: 'CLF Research (Pre-EB) or Ernie Ball Music Man',
        country: 'USA',
        notes: `B-prefix serial. ${notes} Pre-EB instruments have slab bodies with string retainer on D&G and 3 dot markers past the 12th fret. EB instruments have contoured bodies with retainer on A&D and 4 dot markers. To accurately date, remove the neck to see date stamps. Serial: ${digits}.`,
    };
    return { success: true, info };
}
// Sterling by Music Man: SR prefix (Indonesia)
function decodeSterling(serial) {
    const digits = serial.substring(2);
    const info = {
        brand: 'Sterling by Music Man',
        serialNumber: serial,
        year: 'Unknown (contact Sterling)',
        factory: 'Sterling by Music Man',
        country: 'Indonesia',
        notes: `SR-prefix indicates Sterling by Music Man production (Indonesia). These are NOT in the official EBMM database. To get the manufacture date, contact Sterling by Music Man at info@sterlingbymusicman.com with your serial number. Serial: ${digits}.`,
    };
    return { success: true, info };
}
// 5-digit numeric: Various eras (1985-1999)
function decode5Digit(serial) {
    const firstTwo = serial.substring(0, 2);
    const firstTwoNum = parseInt(firstTwo, 10);
    let year;
    let notes;
    if (firstTwoNum >= 85 && firstTwoNum <= 89) {
        // 1985-1989: YYNNN format on headstock
        year = `19${firstTwo}`;
        notes = `5-digit format from 1985-1989. First two digits indicate year. Stamped on back of headstock under G-string tuner. The remaining digits may be sequential but are unreliable for precise dating. Check neck pocket or neck heel for date stamps.`;
    }
    else if (firstTwoNum >= 90 && firstTwoNum <= 96) {
        // 1990s: On neck plate
        year = `19${firstTwo}`;
        notes = `5-digit format from 1990s. First two digits indicate year. Located on neck plate between two lowest screws. For EVH/Axis guitars (8xxxx series) or Steve Morse/Albert Lee/Luke/Silhouette models (9xxxx series).`;
    }
    else if (firstTwo === '97') {
        year = '1997';
        notes = '1997 production, transitional period before G-series was introduced.';
    }
    else {
        // Ambiguous
        year = 'Unknown (check EBMM database)';
        notes = '5-digit serial number. Could be 1985-1999 production. Use the official EBMM database at music-man.com or check date stamps on neck/body.';
    }
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: year,
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: notes,
    };
    return { success: true, info };
}
// 6-digit numeric
function decode6Digit(serial) {
    const info = {
        brand: 'Ernie Ball Music Man',
        serialNumber: serial,
        year: 'Unknown (check EBMM database)',
        factory: 'Ernie Ball Music Man',
        country: 'USA (San Luis Obispo, CA)',
        notes: '6-digit serial number without prefix. Use the official EBMM database at music-man.com for exact date, or check date stamps on neck pocket/heel.',
    };
    return { success: true, info };
}
