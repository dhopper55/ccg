/**
 * Jackson Guitar Serial Number Decoder
 *
 * Supports:
 * - USA Custom Shop Neck-Through (J prefix, 1983-present)
 * - USA Randy Rhoads (RR prefix, 1983-1990)
 * - USA Production (U0/UO prefix, 1990-present)
 * - USA Bolt-On Custom Shop (4-digit, 1986-1997)
 * - USA Bolt-On Production (6-digit 00xxxx, 1990+)
 * - Jackson Junior (JJ suffix, 1994-2000)
 * - Japan Professional (6-digit, 1990-1995)
 * - Japan Fusion (6-digit 90-95 prefix, 1990-1995)
 * - Japan 1996+ (7-digit, 96+ prefix)
 * - Indonesia (I prefix with factory codes)
 * - China (C prefix with factory codes)
 * - India (N prefix or 8-10 digit numeric)
 * - Korea (7-digit starting with 1)
 * - Taiwan (8-digit starting with 6)
 * - Modern 10-digit alphanumeric (2013+)
 */
// USA Neck-Through serial ranges (U0/UO prefix)
const USA_NECK_THROUGH_RANGES = [
    { start: 1, end: 852, year: '1990' },
    { start: 853, end: 1750, year: '1991' },
    { start: 1751, end: 2070, year: '1992' },
    { start: 2071, end: 2527, year: '1993' },
    { start: 2528, end: 2941, year: '1994' },
    { start: 2942, end: 3211, year: '1995' },
    { start: 3212, end: 3685, year: '1996' },
    { start: 3686, end: 4190, year: '1997' },
    { start: 4191, end: 4692, year: '1998' },
    { start: 4693, end: 5353, year: '1999' },
    { start: 5354, end: 6124, year: '2000' },
    { start: 6125, end: 6781, year: '2001' },
    { start: 6782, end: 7345, year: '2002' },
    { start: 7346, end: 7867, year: '2003' },
    { start: 7868, end: 8412, year: '2004' },
    { start: 8413, end: 8956, year: '2005' },
    { start: 8957, end: 9500, year: '2006' },
    { start: 9501, end: 10100, year: '2007' },
    { start: 10101, end: 10800, year: '2008' },
    { start: 10801, end: 11500, year: '2009' },
    { start: 11501, end: 12200, year: '2010' },
    { start: 12201, end: 13000, year: '2011' },
    { start: 13001, end: 14000, year: '2012' },
];
// USA Bolt-On serial ranges (00xxxx format)
const USA_BOLT_ON_RANGES = [
    { start: 1, end: 450, year: '1990' },
    { start: 451, end: 923, year: '1991' },
    { start: 924, end: 1135, year: '1992' },
    { start: 1136, end: 1425, year: '1993' },
    { start: 1426, end: 1789, year: '1994' },
    { start: 1790, end: 2115, year: '1995' },
    { start: 2116, end: 2567, year: '1996' },
    { start: 2568, end: 3045, year: '1997' },
    { start: 3046, end: 3523, year: '1998' },
    { start: 3524, end: 4000, year: '1999' },
    { start: 4001, end: 4500, year: '2000' },
    { start: 4501, end: 4923, year: '2001' },
];
// Indonesia factory codes
const INDONESIA_FACTORY_CODES = {
    'W': 'P.T. Wildwood',
    'S': 'Samick',
    'C': 'Cort',
    'H': 'Harmony Musical Instruments',
    'J': 'Jackson Indonesia',
};
// China factory codes
const CHINA_FACTORY_CODES = {
    'Y': 'Yako',
    'J': 'Jackson China',
};
export function decodeJackson(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Try each decoder pattern
    // USA Randy Rhoads (RR prefix, 1983-1990)
    if (/^RR\d{3,5}$/i.test(normalized)) {
        return decodeUSARandyRhoads(normalized);
    }
    // USA Custom Shop Neck-Through (J prefix)
    if (/^J\d{4,6}$/i.test(normalized)) {
        return decodeUSACustomNeckThrough(normalized);
    }
    // USA Production Neck-Through (U0 or UO prefix)
    if (/^U[O0]\d{4,5}$/i.test(normalized)) {
        return decodeUSANeckThrough(normalized);
    }
    // Jackson Junior (JJ suffix)
    if (/^\d{4}JJ$/i.test(normalized)) {
        return decodeJacksonJunior(normalized);
    }
    // Indonesia format (I + factory code + J + digits)
    if (/^I[WSCHJ]J?\d{7,8}$/i.test(normalized)) {
        return decodeIndonesia(normalized);
    }
    // China format (C + factory code + J + digits)
    if (/^C[YJ]J?\d{7,8}$/i.test(normalized)) {
        return decodeChina(normalized);
    }
    // India format (NHJ prefix or numeric with year prefix)
    if (/^NHJ\d{6,8}$/i.test(normalized)) {
        return decodeIndia(normalized);
    }
    // Modern 10-digit alphanumeric (2013+)
    if (/^[A-Z]{2,3}\d{7,8}$/i.test(normalized) && normalized.length >= 9) {
        return decodeModern(normalized);
    }
    // Japan 7-digit (1996+, starts with 96-99 or 0x for 2000s)
    if (/^(9[6-9]|0[0-9]|1[0-9]|2[0-5])\d{5}$/i.test(normalized) && normalized.length === 7) {
        return decodeJapan1996Plus(normalized);
    }
    // Japan Professional 6-digit (1990-1995, first digit 0-5)
    if (/^[0-5]\d{5}$/.test(normalized) && normalized.length === 6) {
        return decodeJapanProfessional(normalized);
    }
    // Japan Fusion 6-digit (90-95 prefix)
    if (/^9[0-5]\d{4}$/.test(normalized) && normalized.length === 6) {
        return decodeJapanFusion(normalized);
    }
    // India 8-digit (JS20/X series, 96-04 prefix)
    if (/^(9[6-9]|0[0-4])\d{6}$/.test(normalized) && normalized.length === 8) {
        return decodeIndiaNumeric8(normalized);
    }
    // India 9-digit (JS30xx, 2004-2007 prefix)
    if (/^200[4-7]\d{5}$/.test(normalized) && normalized.length === 9) {
        return decodeIndiaNumeric9(normalized);
    }
    // India 10-digit (JS30xx, 2008+ prefix)
    if (/^20(0[8-9]|[1-2]\d)\d{6}$/.test(normalized) && normalized.length === 10) {
        return decodeIndiaNumeric10(normalized);
    }
    // Korea 7-digit (Performers, starts with 1)
    if (/^1\d{6}$/.test(normalized) && normalized.length === 7) {
        return decodeKorea(normalized);
    }
    // Taiwan 8-digit (starts with 6)
    if (/^6\d{7}$/.test(normalized) && normalized.length === 8) {
        return decodeTaiwan(normalized);
    }
    // USA Bolt-On Production (00xxxx format, 6 digits starting with 00)
    if (/^00\d{4}$/.test(normalized)) {
        return decodeUSABoltOnProduction(normalized);
    }
    // USA Custom Shop Bolt-On (4-digit, 1001-8089)
    if (/^\d{4}$/.test(normalized)) {
        const num = parseInt(normalized, 10);
        if (num >= 1001 && num <= 8089) {
            return decodeUSACustomBoltOn(normalized);
        }
    }
    return {
        success: false,
        error: 'Unable to decode this Jackson serial number. The format was not recognized. Please verify the serial number is correct.',
    };
}
function decodeUSARandyRhoads(serial) {
    const num = parseInt(serial.substring(2), 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        model: 'Randy Rhoads',
        factory: 'Jackson USA Custom Shop',
        country: 'USA',
        notes: 'Randy Rhoads neck-through-body model. RR serial numbers were used from 1983 to spring 1990.',
    };
    // Rough year estimation based on serial progression
    if (num <= 500) {
        info.year = '1983-1985';
    }
    else if (num <= 1500) {
        info.year = '1985-1987';
    }
    else if (num <= 3000) {
        info.year = '1987-1989';
    }
    else {
        info.year = '1989-1990';
    }
    return { success: true, info };
}
function decodeUSACustomNeckThrough(serial) {
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        factory: 'Jackson USA Custom Shop',
        country: 'USA',
        notes: 'USA Custom Shop neck-through-body guitar. J prefix serial numbers were used for non-Randy Rhoads models including Soloist, King V, Kelly, and Concert Bass.',
    };
    return { success: true, info };
}
function decodeUSANeckThrough(serial) {
    // Extract the numeric portion (after U0 or UO)
    const numStr = serial.substring(2);
    const num = parseInt(numStr, 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        factory: 'Jackson USA (Ontario, CA)',
        country: 'USA',
        notes: 'USA production neck-through-body guitar. Includes Soloist, Kelly, King V, and other production models.',
    };
    // Find the year based on serial ranges
    for (const range of USA_NECK_THROUGH_RANGES) {
        if (num >= range.start && num <= range.end) {
            info.year = range.year;
            break;
        }
    }
    if (!info.year && num > 14000) {
        info.year = '2013 or later';
    }
    return { success: true, info };
}
function decodeUSABoltOnProduction(serial) {
    const num = parseInt(serial, 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        factory: 'Jackson USA (Ontario, CA)',
        country: 'USA',
        notes: 'USA production bolt-on-neck guitar.',
    };
    for (const range of USA_BOLT_ON_RANGES) {
        if (num >= range.start && num <= range.end) {
            info.year = range.year;
            break;
        }
    }
    if (!info.year && num > 4923) {
        info.year = '2002 or later';
    }
    return { success: true, info };
}
function decodeUSACustomBoltOn(serial) {
    const num = parseInt(serial, 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        factory: 'Jackson USA Custom Shop (Ontario, CA)',
        country: 'USA',
        notes: 'USA Custom Shop bolt-on-neck guitar. Production from 1986-1997. Note: From 1987-1989, guitars were not assembled in strict serial number order.',
    };
    // Rough year estimation
    if (num <= 2000) {
        info.year = '1986-1989';
    }
    else if (num <= 4000) {
        info.year = '1989-1992';
    }
    else if (num <= 6000) {
        info.year = '1992-1995';
    }
    else {
        info.year = '1995-1997';
    }
    return { success: true, info };
}
function decodeJacksonJunior(serial) {
    const num = parseInt(serial.substring(0, 4), 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        model: 'Jackson Junior',
        factory: 'Jackson USA (Ontario, CA)',
        country: 'USA',
        notes: 'Jackson Junior model - the only Jackson bolt-on without a neck plate. Serial stamped into fingerboard.',
    };
    // Rough year estimation (1994-2000)
    if (num <= 200) {
        info.year = '1994-1996';
    }
    else if (num <= 400) {
        info.year = '1996-1998';
    }
    else {
        info.year = '1998-2000';
    }
    return { success: true, info };
}
function decodeJapanProfessional(serial) {
    const yearDigit = parseInt(serial[0], 10);
    const year = 1990 + yearDigit;
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Professional Series Factory',
        country: 'Japan',
        notes: 'Made in Japan Professional series. High-quality import models produced 1990-1995.',
    };
    return { success: true, info };
}
function decodeJapanFusion(serial) {
    const yearDigits = serial.substring(0, 2);
    const year = 1900 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        model: 'Fusion',
        factory: 'Professional Series Factory',
        country: 'Japan',
        notes: 'Made in Japan Fusion model. Used a different serial format with 2-digit year prefix.',
    };
    return { success: true, info };
}
function decodeJapan1996Plus(serial) {
    const yearDigits = serial.substring(0, 2);
    let year;
    if (yearDigits.startsWith('9')) {
        year = 1900 + parseInt(yearDigits, 10);
    }
    else {
        year = 2000 + parseInt(yearDigits, 10);
    }
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        country: 'Japan',
        notes: 'Made in Japan (1996 or later). Includes JS, Stars, and other import series.',
    };
    return { success: true, info };
}
function decodeIndonesia(serial) {
    // Format: I + factory + optional J + year(2) + month(2) + sequence
    let factoryCode = serial[1];
    let digitStart = 2;
    // Check if there's a J after the factory code
    if (serial[2] === 'J') {
        digitStart = 3;
    }
    const digits = serial.substring(digitStart);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const month = parseInt(monthDigits, 10);
    const monthName = getMonthName(month);
    const factory = INDONESIA_FACTORY_CODES[factoryCode] || 'Unknown Factory';
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: factory,
        country: 'Indonesia',
    };
    return { success: true, info };
}
function decodeChina(serial) {
    // Format: C + factory + optional J + year(2) + month(2) + sequence
    let factoryCode = serial[1];
    let digitStart = 2;
    if (serial[2] === 'J') {
        digitStart = 3;
    }
    const digits = serial.substring(digitStart);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const month = parseInt(monthDigits, 10);
    const monthName = getMonthName(month);
    const factory = CHINA_FACTORY_CODES[factoryCode] || 'Unknown Factory';
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: factory,
        country: 'China',
    };
    return { success: true, info };
}
function decodeIndia(serial) {
    // Format: NHJ + year(2) + month(2) + sequence
    const digits = serial.substring(3);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const month = parseInt(monthDigits, 10);
    const monthName = getMonthName(month);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Jackson India',
        country: 'India',
    };
    return { success: true, info };
}
function decodeIndiaNumeric8(serial) {
    // Format: year(2) + sequence(6) - JS20 and X series
    const yearDigits = serial.substring(0, 2);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        country: 'India',
        notes: 'JS20 or X series made in India.',
    };
    return { success: true, info };
}
function decodeIndiaNumeric9(serial) {
    // Format: year(4) + sequence(5) - JS30xx series 2004-2007
    const yearDigits = serial.substring(0, 4);
    const year = parseInt(yearDigits, 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        model: 'JS30xx Series',
        country: 'India',
    };
    return { success: true, info };
}
function decodeIndiaNumeric10(serial) {
    // Format: year(4) + sequence(6) - JS30xx series 2008+
    const yearDigits = serial.substring(0, 4);
    const year = parseInt(yearDigits, 10);
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        model: 'JS30xx Series',
        country: 'India',
    };
    return { success: true, info };
}
function decodeKorea(serial) {
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        factory: 'Performer Series Factory',
        country: 'South Korea',
        notes: 'Made in Korea Performer series. Produced 1995-1998. Unfortunately, exact year dating is not possible for these serials.',
    };
    return { success: true, info };
}
function decodeTaiwan(serial) {
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: '1996',
        model: 'JS20',
        country: 'Taiwan',
        notes: 'Made in Taiwan JS20. Limited production during 1996 only.',
    };
    return { success: true, info };
}
function decodeModern(serial) {
    // Modern 10-digit alphanumeric format (2013+)
    // First two characters might be country/factory codes
    // Next digits typically include year
    const letterPrefix = serial.match(/^[A-Z]+/)?.[0] || '';
    const digits = serial.substring(letterPrefix.length);
    const yearDigits = digits.substring(0, 2);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    let country = 'Unknown';
    let factory = 'Unknown';
    // Determine country/factory from prefix
    if (letterPrefix.startsWith('I')) {
        country = 'Indonesia';
        if (letterPrefix.length > 1) {
            const factoryCode = letterPrefix[1];
            factory = INDONESIA_FACTORY_CODES[factoryCode] || 'Unknown Factory';
        }
    }
    else if (letterPrefix.startsWith('C')) {
        country = 'China';
        if (letterPrefix.length > 1) {
            const factoryCode = letterPrefix[1];
            factory = CHINA_FACTORY_CODES[factoryCode] || 'Unknown Factory';
        }
    }
    else if (letterPrefix.startsWith('N')) {
        country = 'India';
        factory = 'Jackson India';
    }
    else if (letterPrefix.startsWith('US')) {
        country = 'USA';
        factory = 'Jackson USA';
    }
    const monthDigits = digits.substring(2, 4);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Jackson',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: factory !== 'Unknown' ? factory : undefined,
        country: country,
        notes: 'Modern format serial number (2013+).',
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
