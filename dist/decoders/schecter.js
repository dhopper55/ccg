export function decodeSchecter(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // USA Custom Shop: A/B/C/G + 4-5 digits
    if (/^[ABCG]\d{4,5}$/.test(normalized)) {
        return decodeUSACustomShop(normalized);
    }
    // Indonesia IW prefix: IW + 8-9 digits (World Musical Instruments)
    if (/^IW\d{8,9}$/.test(normalized)) {
        return decodeIndonesiaIW(normalized);
    }
    // Indonesia IC/ICS prefix: IC/ICS + 8-9 digits (Cor-Tek/Cort)
    if (/^IC[S]?\d{7,9}$/.test(normalized)) {
        return decodeIndonesiaIC(normalized);
    }
    // Indonesia N prefix: N + 8-9 digits
    if (/^N\d{8,9}$/.test(normalized)) {
        return decodeIndonesiaN(normalized);
    }
    // Korea/Indonesia W prefix: W + 8-9 digits (World/Wildwood)
    // 8 digits = Korea, 9 digits = Indonesia
    if (/^W\d{8,9}$/.test(normalized)) {
        return decodeW(normalized);
    }
    // Korea C prefix: C + 7-8 digits (Cort Korea)
    if (/^C\d{7,8}$/.test(normalized)) {
        return decodeKoreaC(normalized);
    }
    // Korea H prefix: H + 7-8 digits
    if (/^H\d{7,8}$/.test(normalized)) {
        return decodeKoreaH(normalized);
    }
    // China S/SK prefix: S/SK + 7-9 digits (Sejung)
    if (/^S[K]?\d{7,9}$/.test(normalized)) {
        return decodeChinaS(normalized);
    }
    // China L prefix: L + 7-9 digits
    if (/^L\d{7,9}$/.test(normalized)) {
        return decodeChinaL(normalized);
    }
    // Japan SA/S prefix (ESP-related): SA + digits
    if (/^SA\d{6,8}$/.test(normalized)) {
        return decodeJapanSA(normalized);
    }
    // Pure numeric: Early 2000s or late 1990s Korean
    // Format: YYMM + sequence
    if (/^\d{7,9}$/.test(normalized)) {
        return decodeNumeric(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Schecter serial number. The format was not recognized. Please check the serial number and try again.'
    };
}
function decodeUSACustomShop(serial) {
    const prefix = serial[0];
    const sequence = serial.substring(1);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: 'USA Custom Shop Era',
        factory: 'Schecter USA Custom Shop',
        country: 'USA',
        model: 'USA Custom Shop',
        notes: `USA-made custom shop guitar. Prefix "${prefix}". Sequence: ${sequence}. Contact Schecter directly for exact production date.`
    };
    return { success: true, info };
}
function decodeIndonesiaIW(serial) {
    const digits = serial.substring(2);
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'World Musical Instruments (WMI)',
        country: 'Indonesia',
        model: 'Diamond Series or similar',
        notes: `IW prefix = Indonesia, World Musical Instruments. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeIndonesiaIC(serial) {
    let prefix;
    let digits;
    if (serial.startsWith('ICS')) {
        prefix = 'ICS';
        digits = serial.substring(3);
    }
    else {
        prefix = 'IC';
        digits = serial.substring(2);
    }
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Cor-Tek (Cort)',
        country: 'Indonesia',
        model: prefix === 'ICS' ? 'Special/FSR Run' : 'Standard Production',
        notes: `${prefix} prefix = Indonesia, Cor-Tek factory. ${prefix === 'ICS' ? 'ICS indicates special or FSR (Factory Special Run).' : ''} Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeIndonesiaN(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Indonesia Factory (possibly P.T. Wildwood)',
        country: 'Indonesia',
        model: 'Bolt-On Model',
        notes: `N prefix = Indonesia, exact factory unknown. Commonly seen on bolt-on models. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeW(serial) {
    const digits = serial.substring(1);
    const digitCount = digits.length;
    // 8 digits = Korea, 9 digits = Indonesia
    const country = digitCount === 8 ? 'South Korea' : 'Indonesia';
    const factory = digitCount === 8
        ? 'World/Wildwood Korea'
        : 'World Musical Instruments (WMI)';
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: country,
        model: 'Diamond Series',
        notes: `W prefix. ${digitCount} digits indicates ${country} manufacture. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeKoreaC(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Cor-Tek (Cort) Korea',
        country: 'South Korea',
        notes: `C prefix = Cort Korea. Older Korean production. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeKoreaH(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Korea Factory',
        country: 'South Korea',
        notes: `H prefix = Korea, exact factory unknown. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeChinaS(serial) {
    let prefix;
    let digits;
    if (serial.startsWith('SK')) {
        prefix = 'SK';
        digits = serial.substring(2);
    }
    else {
        prefix = 'S';
        digits = serial.substring(1);
    }
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Sejung (China)',
        country: 'China',
        model: 'Omen/Damien Series or entry-level',
        notes: `${prefix} prefix = China, Sejung factory. Common on Omen and Damien series. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeChinaL(serial) {
    const digits = serial.substring(1);
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'China Factory',
        country: 'China',
        notes: `L prefix = China, exact factory unknown. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeJapanSA(serial) {
    const digits = serial.substring(2);
    const { year, month, sequence } = parseStandardDigits(digits);
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Japan (ESP-related factory)',
        country: 'Japan',
        model: 'Japan Production',
        notes: `SA prefix = Japan, likely ESP-related Tokyo factory. Higher-end production. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeNumeric(serial) {
    // Pure numeric format: YYMM + sequence (or YY + sequence)
    const yearDigits = serial.substring(0, 2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 90 && yearNum <= 99) {
        year = (1900 + yearNum).toString();
    }
    else if (yearNum >= 0 && yearNum <= 50) {
        year = (2000 + yearNum).toString();
    }
    else {
        year = 'Unknown';
    }
    // Check if next two digits could be month
    let month;
    let sequence;
    if (serial.length >= 4) {
        const monthDigits = serial.substring(2, 4);
        const monthNum = parseInt(monthDigits, 10);
        if (monthNum >= 1 && monthNum <= 12) {
            month = getMonthName(monthNum);
            sequence = serial.substring(4);
        }
        else {
            sequence = serial.substring(2);
        }
    }
    else {
        sequence = serial.substring(2);
    }
    const info = {
        brand: 'Schecter',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Korea Factory',
        country: 'South Korea',
        notes: `Numeric-only serial indicates Korean manufacture (typically early 2000s or late 1990s). Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function parseStandardDigits(digits) {
    // Standard format: YYMM + sequence
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    // Determine century
    let year;
    if (yearNum >= 90 && yearNum <= 99) {
        year = (1900 + yearNum).toString();
    }
    else if (yearNum >= 0 && yearNum <= 50) {
        year = (2000 + yearNum).toString();
    }
    else {
        year = `20${yearDigits}`;
    }
    // Get month name if valid
    const month = (monthNum >= 1 && monthNum <= 12) ? getMonthName(monthNum) : '';
    return { year, month, sequence };
}
function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
}
