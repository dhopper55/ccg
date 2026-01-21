export function decodeTaylor(serial) {
    const cleaned = serial.trim();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // 10-digit format (November 2009 - present)
    if (/^\d{10}$/.test(normalized)) {
        return decode10Digit(normalized);
    }
    // 11-digit format (January 2000 - October 2009)
    if (/^\d{11}$/.test(normalized)) {
        return decode11Digit(normalized);
    }
    // 9-digit format (1993-1999)
    if (/^\d{9}$/.test(normalized)) {
        return decode9Digit(normalized);
    }
    // Early serials (pre-1993) - typically 5-8 digits
    if (/^\d{5,8}$/.test(normalized)) {
        return decodeEarlyTaylor(normalized);
    }
    return {
        success: false,
        error: 'Unrecognized Taylor serial number format. Taylor serials are typically 9-11 digits (1993-2009) or 10 digits (2009-present).'
    };
}
function decode10Digit(serial) {
    // Format (since November 2009):
    // Position 1: Factory (1 = El Cajon, CA; 2 = Tecate, Mexico)
    // Position 2: First digit of year
    // Position 3-4: Month (01-12)
    // Position 5-6: Day of month
    // Position 7: Second digit of year
    // Position 8-10: Production sequence for that day
    const factoryCode = serial[0];
    const yearDigit1 = serial[1];
    const month = parseInt(serial.substring(2, 4), 10);
    const day = parseInt(serial.substring(4, 6), 10);
    const yearDigit2 = serial[6];
    const sequence = serial.substring(7, 10);
    // Reconstruct the year
    const yearSuffix = yearDigit1 + yearDigit2;
    const year = '20' + yearSuffix;
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month: ${month}. Expected 01-12.`
        };
    }
    // Validate day (basic check)
    if (day < 1 || day > 31) {
        return {
            success: false,
            error: `Invalid day: ${day}. Expected 01-31.`
        };
    }
    // Determine factory
    let factory;
    let country;
    switch (factoryCode) {
        case '1':
            factory = 'El Cajon, California';
            country = 'USA';
            break;
        case '2':
            factory = 'Tecate';
            country = 'Mexico';
            break;
        default:
            factory = `Unknown (code: ${factoryCode})`;
            country = 'Unknown';
    }
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const info = {
        brand: 'Taylor',
        serialNumber: serial,
        year,
        month: months[month - 1],
        day: day.toString(),
        factory,
        country,
        notes: `Production sequence #${parseInt(sequence, 10) + 1} for that day. This 10-digit format has been used since November 2009.`
    };
    return { success: true, info };
}
function decode11Digit(serial) {
    // Format (January 2000 - October 2009):
    // Position 1-4: Year (YYYY)
    // Position 5-6: Month (01-12)
    // Position 7-8: Day of month
    // Position 9: Series indicator
    // Position 10-11: Production sequence
    const year = serial.substring(0, 4);
    const month = parseInt(serial.substring(4, 6), 10);
    const day = parseInt(serial.substring(6, 8), 10);
    const series = serial[8];
    const sequence = serial.substring(9, 11);
    // Validate year
    const yearNum = parseInt(year, 10);
    if (yearNum < 2000 || yearNum > 2009) {
        return {
            success: false,
            error: `Year ${year} is outside expected range for 11-digit format (2000-2009).`
        };
    }
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month: ${month}. Expected 01-12.`
        };
    }
    // Validate day
    if (day < 1 || day > 31) {
        return {
            success: false,
            error: `Invalid day: ${day}. Expected 01-31.`
        };
    }
    // Series codes indicate different model lines
    const seriesNames = {
        '0': 'Standard series',
        '1': '100 series',
        '2': '200 series',
        '3': '300 series',
        '4': '400 series',
        '5': '500 series',
        '6': '600 series',
        '7': '700 series',
        '8': '800 series',
        '9': '900 series or specialty model',
    };
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const info = {
        brand: 'Taylor',
        serialNumber: serial,
        year,
        month: months[month - 1],
        day: day.toString(),
        factory: 'El Cajon, California',
        country: 'USA',
        model: seriesNames[series] || `Series ${series}`,
        notes: `Production sequence: ${sequence}. Series indicator: ${series} (${seriesNames[series] || 'Unknown series'}). This 11-digit format was used from January 2000 to October 2009.`
    };
    return { success: true, info };
}
function decode9Digit(serial) {
    // Format (1993-1999):
    // Position 1-2: Year (YY, representing 19YY)
    // Position 3-4: Month (01-12)
    // Position 5-6: Day of month
    // Position 7: Series indicator
    // Position 8-9: Production sequence
    const year = '19' + serial.substring(0, 2);
    const month = parseInt(serial.substring(2, 4), 10);
    const day = parseInt(serial.substring(4, 6), 10);
    const series = serial[6];
    const sequence = serial.substring(7, 9);
    // Validate year
    const yearNum = parseInt(year, 10);
    if (yearNum < 1993 || yearNum > 1999) {
        return {
            success: false,
            error: `Year ${year} is outside expected range for 9-digit format (1993-1999).`
        };
    }
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month: ${month}. Expected 01-12.`
        };
    }
    // Validate day
    if (day < 1 || day > 31) {
        return {
            success: false,
            error: `Invalid day: ${day}. Expected 01-31.`
        };
    }
    const seriesNames = {
        '0': 'Standard series',
        '1': '100 series',
        '2': '200 series',
        '3': '300 series',
        '4': '400 series',
        '5': '500 series',
        '6': '600 series',
        '7': '700 series',
        '8': '800 series',
        '9': '900 series or specialty model',
    };
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const info = {
        brand: 'Taylor',
        serialNumber: serial,
        year,
        month: months[month - 1],
        day: day.toString(),
        factory: 'El Cajon, California',
        country: 'USA',
        model: seriesNames[series] || `Series ${series}`,
        notes: `Production sequence: ${sequence}. Series indicator: ${series} (${seriesNames[series] || 'Unknown series'}). This 9-digit format was used from 1993 to 1999.`
    };
    return { success: true, info };
}
function decodeEarlyTaylor(serial) {
    const num = parseInt(serial, 10);
    let year = 'Pre-1993';
    let notes = 'Early Taylor guitar. ';
    // Taylor was founded in 1974
    // Very rough estimates based on production numbers
    if (num < 1000) {
        year = '1974-1979 (approximate)';
        notes += 'Very early Taylor production. The company was founded in 1974 by Bob Taylor and Kurt Listug.';
    }
    else if (num < 5000) {
        year = '1979-1984 (approximate)';
        notes += 'Early Taylor production from the first decade of the company.';
    }
    else if (num < 15000) {
        year = '1984-1988 (approximate)';
        notes += 'Taylor was growing during this period and refining their designs.';
    }
    else if (num < 50000) {
        year = '1988-1993 (approximate)';
        notes += 'Taylor continued to expand production in the late 1980s and early 1990s.';
    }
    else {
        year = 'Pre-1993';
        notes += 'Early Taylor serial numbers did not follow a consistent format until 1993.';
    }
    notes += ' For accurate dating of early Taylors, contact Taylor customer service with your serial number.';
    const info = {
        brand: 'Taylor',
        serialNumber: serial,
        year,
        factory: 'El Cajon, California (or earlier Lemon Grove location)',
        country: 'USA',
        notes
    };
    return { success: true, info };
}
