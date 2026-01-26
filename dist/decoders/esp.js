export function decodeESP(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // ESP USA format: US + 5 digits
    if (/^US\d{5}$/.test(normalized)) {
        return decodeESPUSA(normalized);
    }
    // 2016+ ESP format: E + 7 digits (E = ESP brand)
    if (/^E\d{7}$/.test(normalized)) {
        return decodeESP2016Plus(normalized);
    }
    // 2016+ E-II format: ES + 7 digits
    if (/^ES\d{7}$/.test(normalized)) {
        return decodeEII2016Plus(normalized);
    }
    // 2000-2015 Japan ESP Custom Shop format: SS + 7 digits
    if (/^SS\d{7}$/.test(normalized)) {
        return decodeESPCustomShop(normalized);
    }
    // 2000-2015 Japan factory formats: K/N/S/T/CH/CS/TH + 7 digits
    if (/^(K|N|S|T|CH|CS|TH)\d{7}$/.test(normalized)) {
        return decodeESPJapanFactory(normalized);
    }
    // Kirk Hammett Signature: K- + 4-5 digits or K + 4-5 digits
    if (/^K-?\d{4,5}$/.test(normalized)) {
        return decodeKirkHammett(normalized);
    }
    // LTD Asian formats with letter prefixes
    // Indonesia: IW, W, IC, C, IS, S + 7-8 digits
    if (/^(IW|IC|IS|IR)\d{7,8}$/.test(normalized)) {
        return decodeLTDIndonesia(normalized);
    }
    // Korea: W, E, U + 7-8 digits
    if (/^(W|E|U)\d{7,8}$/.test(normalized)) {
        return decodeLTDKorea(normalized);
    }
    // China: L, RS, SH, SX, SK, SP + 7-8 digits
    if (/^(L|RS|SH|SX|SK|SP)\d{7,8}$/.test(normalized)) {
        return decodeLTDChina(normalized);
    }
    // Vietnam: I + 7-8 digits (but not IW, IC, IS, IR)
    if (/^I\d{7,8}$/.test(normalized)) {
        return decodeLTDVietnam(normalized);
    }
    // Pre-2000 format: 6-8 digits (DDMMYNNN or shorter variants)
    if (/^\d{6,8}$/.test(normalized)) {
        return decodePre2000(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this ESP serial number. The format was not recognized. Please check the serial number and try again.'
    };
}
function decodeESPUSA(serial) {
    const year = parseInt(serial.substring(2, 4), 10) + 2000;
    const buildNum = serial.substring(4);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP USA Custom Shop',
        country: 'USA (California)',
        model: 'ESP USA Custom',
        notes: `USA-made ESP. Build number: ${buildNum}.`
    };
    return { success: true, info };
}
function decodeESP2016Plus(serial) {
    const productionNum = serial.substring(1, 5);
    const year = parseInt(serial.substring(5, 7), 10) + 2000;
    const seriesCode = serial[7];
    let series;
    switch (seriesCode) {
        case '1':
            series = 'Custom Series';
            break;
        case '2':
            series = 'Signatures Series';
            break;
        case '3':
            series = 'E-II Series';
            break;
        default:
            series = 'Unknown Series';
    }
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan',
        country: 'Japan',
        model: series,
        notes: `Production number: ${productionNum}. 2016+ serial format.`
    };
    return { success: true, info };
}
function decodeEII2016Plus(serial) {
    const productionNum = serial.substring(2, 6);
    const year = parseInt(serial.substring(6, 8), 10) + 2000;
    const seriesCode = serial[8];
    let series;
    switch (seriesCode) {
        case '1':
            series = 'E-II Custom Series';
            break;
        case '2':
            series = 'E-II Signatures Series';
            break;
        case '3':
            series = 'E-II Standard Series';
            break;
        default:
            series = 'E-II Series';
    }
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan',
        country: 'Japan',
        model: series,
        notes: `E-II line. Production number: ${productionNum}. 2016+ serial format.`
    };
    return { success: true, info };
}
function decodeESPCustomShop(serial) {
    const year = parseInt(serial.substring(2, 4), 10) + 2000;
    const week = parseInt(serial.substring(4, 6), 10);
    const dayOfWeek = parseInt(serial[6], 10);
    const productionNum = serial.substring(7);
    // Calculate approximate date from week and day
    const dateInfo = getDateFromWeekDay(year, week, dayOfWeek);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: dateInfo.month,
        day: dateInfo.day,
        factory: 'ESP Custom Shop, Tokyo',
        country: 'Japan',
        model: 'ESP Custom Shop',
        notes: `Week ${week}, Day ${dayOfWeek} of week. Production #${productionNum} that day.`
    };
    return { success: true, info };
}
function decodeESPJapanFactory(serial) {
    // Extract factory code (1 or 2 letters)
    let factoryCode;
    let digits;
    if (/^(CH|CS|TH)/.test(serial)) {
        factoryCode = serial.substring(0, 2);
        digits = serial.substring(2);
    }
    else {
        factoryCode = serial[0];
        digits = serial.substring(1);
    }
    const year = parseInt(digits.substring(0, 2), 10) + 2000;
    const week = parseInt(digits.substring(2, 4), 10);
    const dayOfWeek = parseInt(digits[4], 10);
    const productionNum = digits.substring(5);
    const factory = getJapanFactory(factoryCode);
    const dateInfo = getDateFromWeekDay(year, week, dayOfWeek);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: dateInfo.month,
        day: dateInfo.day,
        factory: factory,
        country: 'Japan',
        model: 'ESP Japan',
        notes: `Week ${week}, Day ${dayOfWeek} of week. Production #${productionNum} that day.`
    };
    return { success: true, info };
}
function decodeKirkHammett(serial) {
    const numPart = serial.replace(/^K-?/, '');
    const productionNum = parseInt(numPart, 10);
    let year;
    if (numPart.length === 4) {
        year = '1993-1994';
    }
    else {
        year = '1995 or later';
    }
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        factory: 'ESP Japan',
        country: 'Japan',
        model: 'Kirk Hammett Signature (KH Series)',
        notes: `Kirk Hammett Signature model. Production number: ${productionNum}. Early models (1993) used 4 digits; after 1995 launch, expanded to 5 digits.`
    };
    return { success: true, info };
}
function decodeLTDIndonesia(serial) {
    const prefix = serial.match(/^(IW|IC|IS|IR)/)?.[0] || '';
    const digits = serial.substring(prefix.length);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const factory = getLTDIndonesiaFactory(prefix);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: 'Indonesia',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDKorea(serial) {
    const prefix = serial[0];
    const digits = serial.substring(1);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const factory = getLTDKoreaFactory(prefix);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: 'South Korea',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDChina(serial) {
    let prefix;
    let digits;
    if (/^(RS|SH|SX|SK|SP)/.test(serial)) {
        prefix = serial.substring(0, 2);
        digits = serial.substring(2);
    }
    else {
        prefix = serial[0];
        digits = serial.substring(1);
    }
    const { year, month, productionNum } = parseLTDDigits(digits);
    const factory = getLTDChinaFactory(prefix);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: 'China',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDVietnam(serial) {
    const digits = serial.substring(1);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Vietnam Factory',
        country: 'Vietnam',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodePre2000(serial) {
    // Pre-2000 format: DDMMYNNN (8 digits) or shorter variants (6-7 digits)
    // Sometimes leading zeros are dropped
    let day;
    let month;
    let yearDigit;
    let productionNum;
    if (serial.length === 8) {
        // Full format: DDMMYNNN
        day = serial.substring(0, 2);
        month = serial.substring(2, 4);
        yearDigit = serial[4];
        productionNum = serial.substring(5);
    }
    else if (serial.length === 7) {
        // Missing leading zero on day: DMMYNNN
        day = '0' + serial[0];
        month = serial.substring(1, 3);
        yearDigit = serial[3];
        productionNum = serial.substring(4);
    }
    else {
        // 6 digits - missing leading zeros on day and/or month
        day = '0' + serial[0];
        month = '0' + serial[1];
        yearDigit = serial[2];
        productionNum = serial.substring(3);
    }
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(yearDigit, 10);
    // Validate day and month
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        return {
            success: false,
            error: 'Unable to decode this ESP serial number. The date values appear invalid.'
        };
    }
    // Year digit could be 1980s or 1990s
    const possibleYears = getPre2000Years(yearNum);
    const monthName = getMonthName(monthNum);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: possibleYears,
        month: monthName,
        day: dayNum.toString(),
        factory: 'ESP Japan',
        country: 'Japan',
        notes: `Pre-2000 format. Production #${parseInt(productionNum, 10)} on this date. Note: Year could be ${possibleYears} - check model history to confirm decade.`
    };
    return { success: true, info };
}
function parseLTDDigits(digits) {
    // LTD format: YYMM + remaining digits for production number
    // 7 digits = 2000-2010 era, 8 digits = 2010+ era
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const productionNum = digits.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const monthNum = parseInt(monthDigits, 10);
    const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
    return { year, month: month || '', productionNum };
}
function getJapanFactory(code) {
    switch (code) {
        case 'K':
            return 'Kiso Factory, Japan';
        case 'N':
            return 'Nagano Factory, Japan';
        case 'S':
            return 'Sado Factory, Japan';
        case 'T':
            return 'Takada Factory, Japan';
        case 'CH':
        case 'CS':
            return 'Craft House, Japan';
        case 'TH':
            return 'Technical House, Japan';
        default:
            return 'ESP Japan';
    }
}
function getLTDIndonesiaFactory(prefix) {
    switch (prefix) {
        case 'IW':
            return 'P.T. Wildwood, Indonesia';
        case 'IC':
            return 'Cor-tek, Indonesia';
        case 'IS':
            return 'Samick, Indonesia';
        case 'IR':
            return 'Indonesia Factory';
        default:
            return 'Indonesia Factory';
    }
}
function getLTDKoreaFactory(prefix) {
    switch (prefix) {
        case 'W':
            return 'World Musical Instruments, Incheon';
        case 'E':
        case 'U':
            return 'South Korea Factory';
        default:
            return 'South Korea Factory';
    }
}
function getLTDChinaFactory(prefix) {
    switch (prefix) {
        case 'L':
            return 'China Factory';
        case 'RS':
            return 'China Factory (possibly Wildwood)';
        case 'SH':
            return 'China Factory (possibly SaeJun)';
        case 'SX':
        case 'SK':
        case 'SP':
            return 'China Factory';
        default:
            return 'China Factory';
    }
}
function getPre2000Years(digit) {
    // Single digit could represent 1980s or 1990s
    const year80s = 1980 + digit;
    const year90s = 1990 + digit;
    if (digit >= 0 && digit <= 9) {
        return `${year80s} or ${year90s}`;
    }
    return 'Unknown';
}
function getDateFromWeekDay(year, week, dayOfWeek) {
    // Calculate approximate date from ISO week number and day of week
    // Day 1 = Monday, Day 7 = Sunday
    const jan4 = new Date(year, 0, 4);
    const startOfYear = new Date(jan4);
    startOfYear.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const targetDate = new Date(startOfYear);
    targetDate.setDate(startOfYear.getDate() + (week - 1) * 7 + (dayOfWeek - 1));
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return {
        month: monthNames[targetDate.getMonth()],
        day: targetDate.getDate().toString()
    };
}
function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
}
