export function decodePRS(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // S2 Series: S2 + 6 digits (2013+)
    if (/^S2\d{6}$/.test(normalized)) {
        return decodeS2Series(normalized);
    }
    // Acoustic: A + 2-digit year + sequence (e.g., A12001)
    if (/^A\d{5,}$/.test(normalized)) {
        return decodeAcoustic(normalized);
    }
    // SE Series with factory code: CTC/CTI + letter + digits (China/Indonesia)
    if (/^CT[CI][A-Z]\d+$/.test(normalized)) {
        return decodeSECort(normalized);
    }
    // SE Series: Single letter + digits (Korean, 2000+)
    if (/^[A-Z]\d{4,6}$/.test(normalized)) {
        return decodeSEKorea(normalized);
    }
    // CE Models: CE + digits (1998-2008)
    if (/^CE\d+$/.test(normalized)) {
        return decodeCE(normalized);
    }
    // EG Models: EC + digits (1990-1995)
    if (/^EC\d+$/.test(normalized)) {
        return decodeEG(normalized);
    }
    // Swamp Ash Special: SA + digits (1998-2009)
    if (/^SA\d+$/.test(normalized)) {
        return decodeSwampAsh(normalized);
    }
    // Electric Bass: EB + digits (2000-2004)
    if (/^EB\d+$/.test(normalized)) {
        return decodeElectricBass(normalized);
    }
    // USA Set-Neck with 2-digit year prefix: 08+, 09+, 10+, etc. (2008+)
    if (/^(0[89]|[1-9]\d)\d{4,}$/.test(normalized)) {
        return decodeUSASetNeck2008Plus(normalized);
    }
    // USA Set-Neck: Single digit + sequence (1985-2007)
    // Check if this could be a USA set-neck based on sequence number
    if (/^\d{5,7}$/.test(normalized)) {
        return decodeUSASetNeck(normalized);
    }
    // Bolt-on models with prefix codes
    // CE prefix "7" (1988-1997)
    if (/^7\d{4,}$/.test(normalized)) {
        return decodeCEOld(normalized);
    }
    // EG prefix "5" (1990-1995)
    if (/^5\d{4,}$/.test(normalized)) {
        return decodeEGOld(normalized);
    }
    // Swamp Ash prefix "8" (1997)
    if (/^8\d{4,}$/.test(normalized)) {
        return decodeSwampAshOld(normalized);
    }
    // Bass prefix "4" (bolt-on 1989-1991)
    if (/^4\d{4,}$/.test(normalized)) {
        return decodeBoltOnBass(normalized);
    }
    // Bass prefix "9" (set-neck 1986-1991)
    if (/^9\d{4,}$/.test(normalized)) {
        return decodeSetNeckBass(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this PRS serial number. The format was not recognized. Please check the serial number and try again.'
    };
}
// USA Set-Neck Sequential Ranges (1985-2006+)
const USA_SERIAL_RANGES = [
    { start: 1, end: 400, year: 1985 },
    { start: 401, end: 1700, year: 1986 },
    { start: 1701, end: 3500, year: 1987 },
    { start: 3501, end: 5400, year: 1988 },
    { start: 5401, end: 7600, year: 1989 },
    { start: 7601, end: 10100, year: 1990 },
    { start: 10101, end: 12600, year: 1991 },
    { start: 12601, end: 15000, year: 1992 },
    { start: 15001, end: 17900, year: 1993 },
    { start: 17901, end: 20900, year: 1994 },
    { start: 20901, end: 24600, year: 1995 },
    { start: 24601, end: 29500, year: 1996 },
    { start: 29501, end: 34600, year: 1997 },
    { start: 34601, end: 39100, year: 1998 },
    { start: 39101, end: 44499, year: 1999 },
    { start: 44500, end: 52199, year: 2000 },
    { start: 52200, end: 62199, year: 2001 },
    { start: 62200, end: 72353, year: 2002 },
    { start: 72354, end: 82254, year: 2003 },
    { start: 82255, end: 92555, year: 2004 },
    { start: 92556, end: 103103, year: 2005 },
    { start: 103104, end: 115000, year: 2006 },
    { start: 115001, end: 128000, year: 2007 },
];
// SE Letter year codes (A=2000, B=2001, etc.)
function getSEYear(letter) {
    const baseYear = 2000;
    const letterCode = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    return baseYear + letterCode;
}
function decodeUSASetNeck(serial) {
    const num = parseInt(serial, 10);
    // Try to find year from sequential ranges
    for (const range of USA_SERIAL_RANGES) {
        if (num >= range.start && num <= range.end) {
            const info = {
                brand: 'PRS',
                serialNumber: serial,
                year: range.year.toString(),
                factory: 'PRS Factory, Stevensville, Maryland',
                country: 'USA',
                model: 'Set-Neck Model',
                notes: `Production number ${num}. USA-made set-neck guitar with serial on headstock.`
            };
            return { success: true, info };
        }
    }
    // If beyond known ranges, use first digit as year indicator
    const firstDigit = parseInt(serial[0], 10);
    const possibleYears = getYearsFromDigit(firstDigit);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: possibleYears.length === 1 ? possibleYears[0].toString() : possibleYears.join(' or '),
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Set-Neck Model',
        notes: `USA-made set-neck guitar. First digit indicates year. Serial located on headstock.`
    };
    return { success: true, info };
}
function decodeUSASetNeck2008Plus(serial) {
    // Extract 2-digit year prefix
    const yearPrefix = serial.substring(0, 2);
    const year = 2000 + parseInt(yearPrefix, 10);
    const sequence = serial.substring(2);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Set-Neck Model',
        notes: `Production sequence: ${sequence}. Starting in 2008, PRS uses 2-digit year prefixes.`
    };
    return { success: true, info };
}
function decodeS2Series(serial) {
    const sequence = parseInt(serial.substring(2), 10);
    // S2 series production started 2013
    let year;
    if (sequence <= 3391) {
        year = '2013';
    }
    else if (sequence <= 10000) {
        year = '2014';
    }
    else if (sequence <= 17000) {
        year = '2015';
    }
    else if (sequence <= 23391) {
        year = '2016';
    }
    else {
        year = '2017 or later';
    }
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: year,
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'S2 Series',
        notes: `S2 Series - USA-made, more affordable line. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeSEKorea(serial) {
    const yearLetter = serial[0];
    const year = getSEYear(yearLetter);
    const sequence = serial.substring(1);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: year.toString(),
        factory: 'World Musical Instruments (WMI)',
        country: 'South Korea',
        model: 'SE Series',
        notes: `SE Series import model. Letter "${yearLetter}" indicates ${year}. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeSECort(serial) {
    const factoryCode = serial.substring(0, 3);
    const yearLetter = serial[3];
    const year = getSEYear(yearLetter);
    const sequence = serial.substring(4);
    let factory;
    let country;
    if (factoryCode === 'CTC') {
        factory = 'Cort China';
        country = 'China';
    }
    else {
        factory = 'Cort Indonesia';
        country = 'Indonesia';
    }
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: year.toString(),
        factory: factory,
        country: country,
        model: 'SE Series',
        notes: `SE Series import. Factory code "${factoryCode}". Year letter "${yearLetter}" = ${year}. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeAcoustic(serial) {
    const yearDigits = serial.substring(1, 3);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(3);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Acoustic Guitar',
        notes: `Acoustic model. "A" prefix denotes acoustic line. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeCE(serial) {
    const sequence = serial.substring(2);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1998-2008',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'CE (Classic Electric) Bolt-On',
        notes: `CE Series bolt-on neck model. "CE" prefix used 1998-2008. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeCEOld(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1988-1997',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'CE (Classic Electric) Bolt-On',
        notes: `CE Series bolt-on neck model. "7" prefix used 1988-1997. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeEG(serial) {
    const sequence = serial.substring(2);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1990-1995',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'EG Series',
        notes: `EG Series bolt-on neck model. "EC" prefix. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeEGOld(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1990-1995',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'EG Series',
        notes: `EG Series bolt-on neck model. "5" prefix. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeSwampAsh(serial) {
    const sequence = serial.substring(2);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1998-2009',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Swamp Ash Special',
        notes: `Swamp Ash Special bolt-on model. "SA" prefix used 1998-2009. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeSwampAshOld(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1997',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Swamp Ash Special',
        notes: `Swamp Ash Special bolt-on model. "8" prefix used in 1997. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeElectricBass(serial) {
    const sequence = serial.substring(2);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '2000-2004',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Electric Bass',
        notes: `PRS Electric Bass. "EB" prefix used 2000-2004. Serial on headstock. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeBoltOnBass(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1989-1991',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Bolt-On Bass',
        notes: `PRS Bolt-On Bass. "4" prefix used 1989-1991. Serial on neck plate. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeSetNeckBass(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'PRS',
        serialNumber: serial,
        year: '1986-1991',
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Set-Neck Bass',
        notes: `PRS Set-Neck Bass. "9" prefix used 1986-1991. Serial on headstock. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function getYearsFromDigit(digit) {
    // PRS year prefixes cycle: digit can represent multiple decades
    const years = [];
    if (digit === 5) {
        years.push(1985, 1995, 2005);
    }
    else if (digit === 6) {
        years.push(1986, 1996, 2006);
    }
    else if (digit === 7) {
        years.push(1987, 1997, 2007);
    }
    else if (digit === 8) {
        years.push(1988, 1998);
    }
    else if (digit === 9) {
        years.push(1989, 1999);
    }
    else if (digit === 0) {
        years.push(1990, 2000);
    }
    else if (digit === 1) {
        years.push(1991, 2001);
    }
    else if (digit === 2) {
        years.push(1992, 2002);
    }
    else if (digit === 3) {
        years.push(1993, 2003);
    }
    else if (digit === 4) {
        years.push(1994, 2004);
    }
    return years;
}
