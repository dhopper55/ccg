/**
 * Charvel Guitar Serial Number Decoder
 *
 * Supports:
 * - San Dimas USA (1981-1986): 4-digit serials 1001-5491
 * - Japanese neck-through (1986-1991): C + digit + sequential
 * - Japanese bolt-on (1986-1991): 6-digit sequential (220000+)
 * - Modern Japan MIJ (2009-2012): JC + year + production
 * - USA Pro-Mod (2009+): 6-digit production numbers
 * - Mexican production (2013+): MC/CM prefix
 * - Indonesian/Chinese imports (2013+): 10-digit alphanumeric
 *
 * Note: Charvel was founded by Wayne Charvel in 1974, sold to Grover Jackson
 * in 1978, and acquired by Fender in 2002.
 */
export function decodeCharvel(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Japanese neck-through: C + year digit + sequential (1986-1991)
    if (/^C[0-9]\d{4,6}$/.test(normalized)) {
        return decodeJapanNeckThrough(normalized);
    }
    // Modern Japan MIJ: JC + year + production (2009-2012)
    if (/^JC\d{8,10}$/.test(normalized)) {
        return decodeModernJapan(normalized);
    }
    // Mexican production: MC + year + production
    if (/^MC\d{6,8}$/.test(normalized)) {
        return decodeMexico(normalized);
    }
    // Mexican early 2013: CM prefix
    if (/^CM\d{6,8}$/.test(normalized)) {
        return decodeMexicoCM(normalized);
    }
    // Modern import: 10-digit alphanumeric (ICJ, ISJ, IWJ, CYJ, etc.)
    if (/^[ICMN][HWCS][JC]\d{7,8}$/.test(normalized)) {
        return decodeModernImport(normalized);
    }
    // USA Select/Pro-Mod: 10-digit format similar to imports
    if (/^[A-Z]{2,3}\d{7,8}$/.test(normalized)) {
        return decodeUSASelect(normalized);
    }
    // San Dimas USA: 4-digit (1001-5491)
    if (/^\d{4}$/.test(normalized)) {
        return decodeSanDimas(normalized);
    }
    // Japanese bolt-on: 6-digit sequential (220000+)
    if (/^\d{6}$/.test(normalized)) {
        return decodeJapanBoltOn(normalized);
    }
    // USA Pro-Mod 2009-2010: 00XXXX format
    if (/^00\d{4}$/.test(normalized)) {
        return decodeUSAProMod(normalized);
    }
    // USA Pro-Mod 2010+: 1XXXXXXX or 11XXXXXX format
    if (/^1[01]\d{6,7}$/.test(normalized)) {
        return decodeUSAProMod2010(normalized);
    }
    // Surfcaster: 365XXX-388XXX
    if (/^3[6-8]\d{4}$/.test(normalized)) {
        const num = parseInt(normalized, 10);
        if (num >= 365000 && num <= 388999) {
            return decodeSurfcaster(normalized);
        }
    }
    return {
        success: false,
        error: 'Unable to decode this Charvel serial number. Common formats include: 4 digits (San Dimas USA 1981-1986), C + digit + numbers (Japan neck-through 1986-1991), 6 digits (Japan bolt-on), JC + numbers (Modern MIJ), MC + numbers (Mexico), or 10-character codes (modern imports). Note: Pre-1981 San Dimas guitars have no serial numbers.',
    };
}
// San Dimas USA: 4-digit (1001-5491)
function decodeSanDimas(serial) {
    const num = parseInt(serial, 10);
    // Validate authentic San Dimas range
    if (num < 1001) {
        return {
            success: false,
            error: `Serial ${num} is below the San Dimas production range (starts at 1001). Pre-serial guitars (before late 1981) have no serial numbers.`,
        };
    }
    if (num > 5491) {
        const info = {
            brand: 'Charvel',
            serialNumber: serial,
            year: 'CAUTION',
            factory: 'Unknown',
            country: 'Unknown',
            notes: `WARNING: Serial numbers above 5491 are NOT authentic San Dimas Charvels. Blank neckplates were sold on the black market after San Dimas production ceased in 1986. Serial ${num} is likely on a counterfeit or non-original neckplate. Authentic San Dimas production ended at serial 5491.`,
        };
        return { success: true, info };
    }
    // Determine year from serial range
    let year;
    if (num <= 1095) {
        year = 'Late 1981';
    }
    else if (num <= 1724) {
        year = '1982';
    }
    else if (num <= 2938) {
        year = '1983';
    }
    else if (num <= 4261) {
        year = '1984';
    }
    else if (num <= 5303) {
        year = '1985';
    }
    else {
        year = '1986';
    }
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: year,
        factory: 'San Dimas, California',
        country: 'USA',
        notes: `Authentic San Dimas Charvel. Serial ${num} indicates ${year} production. These guitars feature a neckplate reading "Charvel, P.O. Box 245, San Dimas, CA 91773" and "MADE IN USA" on the headstock. Highly collectible vintage instruments.`,
    };
    return { success: true, info };
}
// Japanese neck-through: C + year digit + sequential (1986-1991)
function decodeJapanNeckThrough(serial) {
    const yearDigit = serial.charAt(1);
    const sequence = serial.substring(2);
    // Decode year from digit
    const yearMap = {
        '6': '1986',
        '7': '1987',
        '8': '1988',
        '9': '1989',
        '0': '1990',
        '1': '1991',
    };
    const year = yearMap[yearDigit] || 'Unknown';
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: year,
        factory: 'Chushin Gakki (Nagano Prefecture)',
        country: 'Japan',
        model: 'Model 5 or Model 6 (neck-through)',
        notes: `Japanese neck-through model. "C${yearDigit}" indicates ${year} production. Sequence: ${sequence}. These were made at Chushin Gakki in Japan. 1986 serials appear on a sticker on the headstock back; 1987+ are stamped into the final fret of the fingerboard.`,
    };
    return { success: true, info };
}
// Japanese bolt-on: 6-digit sequential (220000+)
function decodeJapanBoltOn(serial) {
    const num = parseInt(serial, 10);
    // Japanese bolt-ons started at 220000
    if (num >= 220000) {
        const info = {
            brand: 'Charvel',
            serialNumber: serial,
            year: '1986-1991 (check physical features)',
            factory: 'Chushin Gakki (Nagano Prefecture)',
            country: 'Japan',
            model: 'Model 1, 2, 3, 3A, 4, or 7 (bolt-on)',
            notes: `Japanese bolt-on model. Serial ${num.toLocaleString()} is from the 6-digit sequential series. These serials are NOT date-coded. To determine year: 1986 = "TM" above L + no neckplate gasket + Kahler tremolo; 1987 = "TM" beside L + gasket + JT-6 tremolo; 1988+ = (R) symbol + gasket + JT-6. Neckplate says Fort Worth, Texas (despite being Made in Japan).`,
        };
        return { success: true, info };
    }
    // Could be USA Pro-Mod or other 6-digit format
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: 'Check model/features',
        factory: 'Various',
        country: 'Check label',
        notes: `6-digit serial number ${num.toLocaleString()}. Could be Japanese production (if 220000+) or USA Pro-Mod. Check the guitar for country of origin marking.`,
    };
    return { success: true, info };
}
// Modern Japan MIJ: JC + year + production (2009-2012)
function decodeModernJapan(serial) {
    const yearDigits = serial.substring(2, 4);
    const production = serial.substring(4);
    const year = `20${yearDigits}`;
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: year,
        factory: 'Chushin Gakki',
        country: 'Japan',
        model: 'Pro-Mod San Dimas Reissue',
        notes: `Modern Japanese (MIJ) Pro-Mod. "JC" = Japan/Charvel/Chushin. Year: ${year}. Production number: ${production}. These were the first run of Pro-Mod series before production moved to Mexico in 2013.`,
    };
    return { success: true, info };
}
// Mexican production: MC + year + production
function decodeMexico(serial) {
    const yearDigits = serial.substring(2, 4);
    const production = serial.substring(4);
    const year = `20${yearDigits}`;
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: year,
        factory: 'Fender Mexico (Ensenada)',
        country: 'Mexico',
        model: 'Pro-Mod Series',
        notes: `Mexican-made Pro-Mod. "MC" prefix indicates Mexico/Charvel. Year: ${year}. Production number: ${production}. Made at Fender's Ensenada facility. Models include Pro-Mod Style 1, Style 2, DK22, DK24, and So-Cal series.`,
    };
    return { success: true, info };
}
// Mexican early 2013: CM prefix
function decodeMexicoCM(serial) {
    const production = serial.substring(2);
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: '2013 (early)',
        factory: 'Fender Mexico (Ensenada)',
        country: 'Mexico',
        model: 'Pro-Mod Series',
        notes: `Early 2013 Mexican production. "CM" prefix was used on early 2013 neckplates. Production number: ${production}. Made at Fender's Ensenada facility.`,
    };
    return { success: true, info };
}
// Modern import: 10-digit alphanumeric
function decodeModernImport(serial) {
    const countryCode = serial.charAt(0);
    const factoryCode = serial.charAt(1);
    const brandCode = serial.charAt(2);
    const yearDigits = serial.substring(3, 5);
    const production = serial.substring(5);
    // Country codes
    const countries = {
        'I': 'Indonesia',
        'C': 'China',
        'M': 'Mexico',
        'N': 'India',
    };
    // Factory codes
    const factories = {
        'H': 'Harmony Musical Instruments',
        'W': 'World Music Instruments (WMI)',
        'C': 'Cort',
        'S': 'Samick',
    };
    const country = countries[countryCode] || 'Unknown';
    const factory = factories[factoryCode] || 'Unknown';
    const year = `20${yearDigits}`;
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: year,
        factory: factory,
        country: country,
        notes: `Modern import model. Country: ${country} (${countryCode}). Factory: ${factory} (${factoryCode}). Brand code: ${brandCode}. Year: ${year}. Production number: ${production}.`,
    };
    return { success: true, info };
}
// USA Select/Pro-Mod: 10-digit format
function decodeUSASelect(serial) {
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: 'Contact Charvel',
        factory: 'Corona, California (likely)',
        country: 'USA (likely)',
        model: 'USA Select or Pro-Mod',
        notes: `This appears to be a USA Select or Pro-Mod format. For exact dating of USA models, contact consumerrelations@charvel.com. Serial number: ${serial}.`,
    };
    return { success: true, info };
}
// USA Pro-Mod 2009-2010: 00XXXX format
function decodeUSAProMod(serial) {
    const production = parseInt(serial, 10);
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: '2009-2010',
        factory: 'Corona, California',
        country: 'USA',
        model: 'USA Pro-Mod',
        notes: `USA Pro-Mod. Production number: ${production}. First batch started at 0000 in 2009. Made at Fender's Corona, California facility.`,
    };
    return { success: true, info };
}
// USA Pro-Mod 2010+: 10000XXX or 11000XXX format
function decodeUSAProMod2010(serial) {
    const firstTwo = serial.substring(0, 2);
    let year;
    if (firstTwo === '10') {
        year = '2010';
    }
    else if (firstTwo === '11') {
        year = '2011';
    }
    else {
        year = '2010+';
    }
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: year,
        factory: 'Corona, California',
        country: 'USA',
        model: 'USA Pro-Mod',
        notes: `USA Pro-Mod. Year: ${year}. Serial prefix "${firstTwo}" indicates year. Made at Fender's Corona, California facility.`,
    };
    return { success: true, info };
}
// Surfcaster: 365XXX-388XXX
function decodeSurfcaster(serial) {
    const info = {
        brand: 'Charvel',
        serialNumber: serial,
        year: '1990s',
        factory: 'Various',
        country: 'Check label',
        model: 'Surfcaster',
        notes: `Surfcaster series. Serial range 365XXX-388XXX. The first Surfcaster series did not include gold sparkle finish. Check the guitar for country of origin.`,
    };
    return { success: true, info };
}
