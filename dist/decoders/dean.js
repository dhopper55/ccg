/**
 * Dean Guitar Serial Number Decoder
 *
 * Supports:
 * - USA-made guitars (7-digit format, 1977-1985 and 1996+)
 * - UnSung Korea (US prefix, 2006+)
 * - World Korea (E prefix, WK prefix)
 * - YooJin China (Y prefix, 2006+)
 * - Indonesia (CT, IW prefixes)
 * - Samick Korea (S prefix, 1993-1996)
 * - Japan FujiGen (J, JF prefixes)
 * - Czech Republic (5-6 digit, 1997-2000)
 *
 * Note: Guitars from 1986-1995 (Tropical Music era) have serial numbers
 * on the last fret and cannot be reliably dated.
 */
export function decodeDean(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // UnSung Korea: US prefix (don't confuse with USA!)
    if (/^US\d{8,10}$/.test(normalized)) {
        return decodeUnSungKorea(normalized);
    }
    // World Korea: WK prefix (newer format)
    if (/^WK\d{8}$/.test(normalized)) {
        return decodeWorldKoreaWK(normalized);
    }
    // World Korea: E prefix (older format)
    if (/^E\d{6,8}$/.test(normalized)) {
        return decodeWorldKoreaE(normalized);
    }
    // YooJin China: Y prefix
    if (/^Y\d{8,10}$/.test(normalized)) {
        return decodeYooJinChina(normalized);
    }
    // Indonesia: IW prefix
    if (/^IW\d{8,10}$/.test(normalized)) {
        return decodeIndonesiaIW(normalized);
    }
    // Indonesia: CT prefix
    if (/^CT\d{8,10}$/.test(normalized)) {
        return decodeIndonesiaCT(normalized);
    }
    // Japan FujiGen: JF prefix
    if (/^JF\d{6,8}$/.test(normalized)) {
        return decodeJapanFujiGen(normalized);
    }
    // Japan: J prefix
    if (/^J\d{6,8}$/.test(normalized)) {
        return decodeJapanJ(normalized);
    }
    // Samick Korea: S prefix (1993-1996)
    if (/^S\d{6,8}$/.test(normalized)) {
        return decodeSamickKorea(normalized);
    }
    // China: O prefix
    if (/^O\d{6,8}$/.test(normalized)) {
        return decodeChinaO(normalized);
    }
    // Korea: W prefix (DBZ Bolero and others)
    if (/^W\d{6,8}$/.test(normalized)) {
        return decodeKoreaW(normalized);
    }
    // USA-made: 7-digit numeric (standard format)
    if (/^\d{7}$/.test(normalized)) {
        return decodeUSA7Digit(normalized);
    }
    // Czech Republic or USA: 5-6 digit (1997-2000 Czech or early USA)
    if (/^\d{5,6}$/.test(normalized)) {
        return decode5or6Digit(normalized);
    }
    // Older numeric formats (4+ digits, could be various eras)
    if (/^\d{4,8}$/.test(normalized)) {
        return decodeNumericGeneral(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Dean serial number. The format was not recognized. Common formats include: 7-digit (USA), US prefix (UnSung Korea), WK prefix (World Korea), Y prefix (YooJin China), IW/CT prefix (Indonesia), or 5-6 digit (Czech Republic 1997-2000). Note: Guitars from 1986-1995 with serial numbers on the last fret cannot be reliably dated.',
    };
}
// UnSung Korea: US prefix (2006+)
function decodeUnSungKorea(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'UnSung Factory, Incheon',
        country: 'South Korea',
        notes: `US prefix indicates UnSung factory in Korea (not USA). UnSung has produced Dean guitars since 2006. Production sequence: ${sequence}. Note: Do not confuse "US" prefix with USA-made guitars.`,
    };
    return { success: true, info };
}
// World Korea: WK prefix (newer format, 2017+)
function decodeWorldKoreaWK(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'World Musical Instruments Co Ltd',
        country: 'South Korea',
        notes: `WK prefix indicates World factory in Korea (newer designation, 2017+). Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// World Korea: E prefix (older format, 2000-2015)
function decodeWorldKoreaE(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 0 && yearNum <= 25) {
        year = (2000 + yearNum).toString();
    }
    else {
        year = `Possibly 20${yearDigits}`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'World Musical Instruments Co Ltd',
        country: 'South Korea',
        notes: `E prefix indicates World factory in Korea (older designation, primarily 2000-2015). Production sequence: ${sequence}. Note: Some E-prefix serials from early 2000s may have inconsistent year coding.`,
    };
    return { success: true, info };
}
// YooJin China: Y prefix (2006+)
function decodeYooJinChina(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'YooJin Factory',
        country: 'China',
        notes: `Y prefix indicates YooJin factory in China. YooJin has produced Dean guitars since 2006. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesia: IW prefix
function decodeIndonesiaIW(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Indonesia',
        country: 'Indonesia',
        notes: `IW prefix indicates Indonesian production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesia: CT prefix
function decodeIndonesiaCT(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Indonesia (CT factory)',
        country: 'Indonesia',
        notes: `CT prefix indicates Indonesian production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Japan FujiGen: JF prefix
function decodeJapanFujiGen(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 80 && yearNum <= 99) {
        year = `19${yearDigits}`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
    }
    else {
        year = `Possibly 19${yearDigits} or 20${yearDigits}`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: `JF prefix indicates FujiGen factory in Japan. FujiGen is known for high-quality production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Japan: J prefix
function decodeJapanJ(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 80 && yearNum <= 99) {
        year = `19${yearDigits}`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
    }
    else {
        year = `Possibly 19${yearDigits} or 20${yearDigits}`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'Japan (possibly FujiGen or similar)',
        country: 'Japan',
        notes: `J prefix indicates Japanese production (possibly FujiGen or China in some cases). Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Samick Korea: S prefix (1993-1996)
function decodeSamickKorea(serial) {
    const digits = serial.substring(1);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: '1993-1996 (exact year uncertain)',
        factory: 'Samick',
        country: 'South Korea',
        notes: `S prefix indicates Samick factory in Korea, used from 1993-1996. Serial number format from this era does not reliably encode the year. Production number: ${digits}.`,
    };
    return { success: true, info };
}
// China: O prefix
function decodeChinaO(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'China',
        country: 'China',
        notes: `O prefix indicates Chinese production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Korea: W prefix (DBZ Bolero and others)
function decodeKoreaW(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Korea',
        country: 'South Korea',
        notes: `W prefix indicates Korean production (often seen on DBZ Bolero models). Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// USA-made: 7-digit format
function decodeUSA7Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    let notes;
    if (yearNum >= 77 && yearNum <= 85) {
        year = `19${yearDigits}`;
        notes = `USA-made Dean from the original Zelinsky era (1977-1985). These guitars were made in Evanston, IL (1976-1978) or Chicago (1979+). Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 86 && yearNum <= 95) {
        // Tropical Music era - unreliable
        year = `Possibly 19${yearDigits} (uncertain)`;
        notes = `This serial number format suggests 19${yearDigits}, but guitars from 1986-1995 (Tropical Music era) have inconsistent serial numbers. Check if the serial is stamped on the last fret - if so, dating is unreliable. Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 96 && yearNum <= 99) {
        year = `19${yearDigits}`;
        notes = `USA-made Dean from the Armadillo Enterprises era (1997+). Production returned to consistent serial numbering. Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
        notes = `USA-made Dean (Armadillo Enterprises era). 7-digit serials indicate USA production. Production sequence: ${sequence}.`;
    }
    else {
        year = `Unknown (first digits: ${yearDigits})`;
        notes = `7-digit format typically indicates USA production. First two digits (${yearDigits}) should indicate year. Production sequence: ${sequence}.`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'Dean USA',
        country: 'USA',
        notes: notes,
    };
    return { success: true, info };
}
// Czech Republic or USA: 5-6 digit format
function decode5or6Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    let country;
    let factory;
    let notes;
    if (yearNum >= 97 && yearNum <= 99) {
        // Likely Czech Republic 1997-1999
        year = `19${yearDigits}`;
        country = 'Czech Republic (likely) or USA';
        factory = 'Strunal Schönbach (Czech Republic) or Dean USA';
        notes = `5-6 digit serial from 1997-2000 era. Dean guitars were made in Czech Republic during this period at Strunal Schönbach factory. These are sought after for their build quality. If marked "Made in USA" it's American; otherwise likely Czech. Production sequence: ${sequence}.`;
    }
    else if (yearNum === 0) {
        year = '2000';
        country = 'Czech Republic (likely) or USA';
        factory = 'Strunal Schönbach (Czech Republic) or Dean USA';
        notes = `5-6 digit serial from ~2000. Could be Czech Republic production (phased out early 2000s) or USA. Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 77 && yearNum <= 85) {
        year = `19${yearDigits}`;
        country = 'USA';
        factory = 'Dean USA (Evanston/Chicago)';
        notes = `Early USA-made Dean from the original Zelinsky era (1977-1985). Production sequence: ${sequence}.`;
    }
    else {
        year = `Possibly 19${yearDigits} or 20${yearDigits}`;
        country = 'Unknown';
        factory = 'Unknown';
        notes = `5-6 digit format. First two digits (${yearDigits}) may indicate year. Could be Czech Republic (1997-2000), USA, or import. Check for "Made in" marking on instrument. Production sequence: ${sequence}.`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: factory,
        country: country,
        notes: notes,
    };
    return { success: true, info };
}
// General numeric format (various eras)
function decodeNumericGeneral(serial) {
    const length = serial.length;
    const yearDigits = serial.substring(0, 2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    let notes;
    if (length === 4) {
        // Very short - likely early production or Tropical era
        year = 'Unknown (short serial)';
        notes = `4-digit serial number. This format was used in various eras. If the serial is on the last fret rather than headstock, it's from the Tropical Music era (1986-1995) and cannot be reliably dated.`;
    }
    else if (length === 8) {
        // 8-digit without prefix - likely import
        if (yearNum >= 0 && yearNum <= 30) {
            year = `20${yearDigits.padStart(2, '0')}`;
        }
        else if (yearNum >= 80 && yearNum <= 99) {
            year = `19${yearDigits}`;
        }
        else {
            year = `Unknown (first digits: ${yearDigits})`;
        }
        notes = `8-digit numeric serial without letter prefix. First two digits (${yearDigits}) likely indicate year. This may be an import guitar - check for "Made in" marking.`;
    }
    else {
        if (yearNum >= 77 && yearNum <= 99) {
            year = `Possibly 19${yearDigits}`;
        }
        else if (yearNum >= 0 && yearNum <= 30) {
            year = `Possibly 20${yearDigits.padStart(2, '0')}`;
        }
        else {
            year = 'Unknown';
        }
        notes = `${length}-digit serial number. Dating is uncertain without additional context. If serial is on the last fret, it's from the Tropical Music era (1986-1995) and cannot be reliably dated.`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'Unknown',
        country: 'Unknown (check "Made in" marking)',
        notes: notes,
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
