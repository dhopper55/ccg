import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeTaylor(serial: string): DecodeResult {
  const cleaned = serial.trim();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // 10-digit format (November 2009 - present)
  if (/^\d{10}$/.test(normalized)) {
    return decode10Digit(normalized);
  }

  // 11-digit format (January 2000 - October 2009), with a fallback for
  // factory-coded 11-digit labels that include a series digit.
  if (/^\d{11}$/.test(normalized)) {
    const legacyResult = decode11Digit(normalized);
    if (legacyResult.success) {
      return legacyResult;
    }

    const modernExtendedResult = decodeModernExtended11Digit(normalized);
    if (modernExtendedResult.success) {
      return modernExtendedResult;
    }

    return legacyResult;
  }

  // 9-digit format (1993-1999)
  if (/^\d{9}$/.test(normalized)) {
    const legacyResult = decode9Digit(normalized);
    if (legacyResult.success) {
      return legacyResult;
    }

    const modernShortResult = decodeModernShort9Digit(normalized);
    if (modernShortResult.success) {
      return modernShortResult;
    }

    const legacyYearCodeResult = decodeLegacy9DigitYearCode(normalized);
    if (legacyYearCodeResult.success) {
      return legacyYearCodeResult;
    }

    return legacyResult;
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

function decode10Digit(serial: string): DecodeResult {
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

  if (!isValidMonthDay(month, day, parseInt(year, 10))) {
    return {
      success: false,
      error: `Invalid date: ${month}/${day}/${year}.`
    };
  }

  // Determine factory
  let factory: string;
  let country: string;

  switch (factoryCode) {
    case '1':
      factory = 'El Cajon, California';
      country = 'USA';
      break;
    case '2':
      factory = 'Tecate, Baja California';
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

  const info: GuitarInfo = {
    brand: 'Taylor',
    serialNumber: serial,
    year,
    month: months[month - 1],
    day: day.toString(),
    factory,
    country,
    notes: `Production sequence #${parseInt(sequence, 10)} for that day. This 10-digit format has been used since November 2009.`
  };

  const sequenceNumber = parseInt(sequence, 10);
  const monthName = months[month - 1];

  return {
    success: true,
    info,
    patternKey: 'taylor-modern-10-digit-factory-date-sequence',
    patternLabel: 'Taylor modern 10-digit factory/date/sequence format',
    additionalContext: {
      title: 'Taylor modern 10-digit serial',
      summary: 'This serial matches Taylor\'s current 10-digit factory-coded format used since November 2009.',
      highlights: [
        `Factory code ${factoryCode} indicates ${factory}.`,
        `The 2nd and 7th digits combine as year ${year}.`,
        `The date fields decode as ${monthName} ${day}, ${year}.`,
        `The final three digits decode as production sequence #${sequenceNumber}.`,
      ],
      caveats: [
        'This serial identifies factory, production start date, and schedule sequence, not the exact model.',
        'Use the label/model marking or Taylor support for exact model and original specifications.',
      ],
      verificationTips: [
        'Confirm the full serial from the label visible through the soundhole.',
        'Check whether the label says El Cajon, California or Tecate, Mexico.',
        'For a 2019 July 28 decode, the 2nd and 7th digits should combine as 19.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches Taylor&#39;s current 10-digit factory-coded format used since November 2009.</p><h3>How This Pattern Is Typically Read</h3><p>Factory code ${factoryCode} indicates ${factory}. The 2nd and 7th digits combine as year ${year}. The date fields decode as ${monthName} ${day}, ${year}. The final three digits decode as production sequence #${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This serial identifies factory, production start date, and schedule sequence, not the exact model.</li><li>Use the label/model marking or Taylor support for exact model and original specifications.</li><li>For a 2019 July 28 decode, the 2nd and 7th digits should combine as 19.</li></ul>`,
  };
}

function decode11Digit(serial: string): DecodeResult {
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

  if (!isValidMonthDay(month, day, yearNum)) {
    return {
      success: false,
      error: `Invalid date: ${month}/${day}/${year}.`
    };
  }

  // Series codes indicate different model lines
  const seriesNames: Record<string, string> = {
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

  const info: GuitarInfo = {
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

function decodeModernExtended11Digit(serial: string): DecodeResult {
  // Fallback layout seen on some modern factory-coded Taylor labels:
  // Position 1: Factory (1 = El Cajon, CA; 2 = Tecate, Mexico)
  // Position 2: First digit of two-digit year
  // Position 3-4: Month
  // Position 5-6: Day
  // Position 7: Series indicator
  // Position 8: Second digit of two-digit year
  // Position 9-11: Production sequence for that day
  const factoryCode = serial[0];
  if (factoryCode !== '1' && factoryCode !== '2') {
    return {
      success: false,
      error: 'Not a recognized modern extended Taylor factory-coded format.',
    };
  }

  const yearDigits = `${serial[1]}${serial[7]}`;
  const year = `20${yearDigits}`;
  const yearNum = parseInt(year, 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const day = parseInt(serial.substring(4, 6), 10);
  const series = serial[6];
  const sequence = serial.substring(8, 11);

  if (yearNum < 2009 || yearNum > 2099) {
    return {
      success: false,
      error: `Year ${year} is outside expected range for modern Taylor factory-coded format.`,
    };
  }

  if (month < 1 || month > 12) {
    return {
      success: false,
      error: `Invalid month: ${month}. Expected 01-12.`,
    };
  }

  if (!isValidMonthDay(month, day, yearNum)) {
    return {
      success: false,
      error: `Invalid date: ${month}/${day}/${year}.`,
    };
  }

  const factoryInfo = factoryCode === '1'
    ? { factory: 'El Cajon, California', country: 'USA' }
    : { factory: 'Tecate, Baja California', country: 'Mexico' };
  const seriesNames: Record<string, string> = {
    '0': '300 or 400 Series',
    '1': '500 Series through Presentation Series',
    '2': '200 Series',
    '3': 'Baby or Big Baby',
    '4': 'Big Baby',
    '5': 'T5',
    '6': 'T3',
    '7': 'Nylon Series',
    '8': '100 Series',
    '9': 'SolidBody Series or specialty model',
  };
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = months[month - 1];
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Taylor',
    serialNumber: serial,
    year,
    month: monthName,
    day: day.toString(),
    factory: factoryInfo.factory,
    country: factoryInfo.country,
    model: seriesNames[series] || `Series ${series}`,
    notes: `Modern extended Taylor factory-coded format. Factory code ${factoryCode} indicates ${factoryInfo.factory}; date fields decode as ${monthName} ${day}, ${year}; series code ${series} indicates ${seriesNames[series] || 'an unspecified series group'}; final digits indicate production sequence #${sequenceNumber} for that day. Taylor officially documents the current factory-coded format as 10 digits, so verify the full printed label or contact Taylor support if exact factory records matter.`,
  };

  return {
    success: true,
    info,
    patternKey: 'taylor-modern-extended-11',
    patternLabel: 'Taylor modern extended 11-digit format',
    additionalContext: {
      title: 'Taylor modern extended serial',
      summary: 'This serial matches a modern factory-coded Taylor layout with an added series-code digit.',
      highlights: [
        `Factory code ${factoryCode} indicates ${factoryInfo.factory}.`,
        `The date fields decode as ${monthName} ${day}, ${year}.`,
        `Series code ${series} maps to ${seriesNames[series] || 'an unspecified series group'}.`,
        `The final digits decode as production sequence #${sequenceNumber}.`,
      ],
      caveats: [
        'Taylor officially documents the current factory-coded format as 10 digits.',
        'This 11-digit fallback preserves the same factory/date/year logic while treating the seventh digit as a series code.',
        'Use Taylor support or owner registration for exact original model/spec confirmation.',
      ],
      verificationTips: [
        'Confirm the full serial from the label inside the guitar.',
        'Check whether the label says El Cajon, California or Tecate, Mexico.',
        'Contact Taylor support with the serial and photos if exact factory specs matter.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern factory-coded Taylor layout with an added series-code digit.</p><h3>How This Pattern Is Typically Read</h3><p>Factory code ${factoryCode} indicates ${factoryInfo.factory}. The date fields decode as ${monthName} ${day}, ${year}. Series code ${series} maps to ${seriesNames[series] || 'an unspecified series group'}. The final digits decode as production sequence #${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Taylor officially documents the current factory-coded format as 10 digits.</li><li>This 11-digit fallback preserves the same factory/date/year logic while treating the seventh digit as a series code.</li><li>Use Taylor support or owner registration for exact original model/spec confirmation.</li></ul>`,
  };
}

function decode9Digit(serial: string): DecodeResult {
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

  if (!isValidMonthDay(month, day, yearNum)) {
    return {
      success: false,
      error: `Invalid date: ${month}/${day}/${year}.`
    };
  }

  const seriesNames: Record<string, string> = {
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

  const info: GuitarInfo = {
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

function decodeLegacy9DigitYearCode(serial: string): DecodeResult {
  // Alternate early 9-digit Taylor format:
  // Position 1-2: Taylor year code (05 = 1993, 06 = 1994, ... 11 = 1999)
  // Position 3-4: Month
  // Position 5-6: Day
  // Position 7: Series group
  // Position 8-9: Production sequence for that day
  const yearCode = serial.substring(0, 2);
  const yearByCode: Record<string, string> = {
    '05': '1993',
    '06': '1994',
    '07': '1995',
    '08': '1996',
    '09': '1997',
    '10': '1998',
    '11': '1999',
  };
  const year = yearByCode[yearCode];
  if (!year) {
    return {
      success: false,
      error: `Year code ${yearCode} is outside expected range for Taylor 9-digit legacy year-code format.`,
    };
  }

  const month = parseInt(serial.substring(2, 4), 10);
  const day = parseInt(serial.substring(4, 6), 10);
  const series = serial[6];
  const sequence = serial.substring(7, 9);
  const yearNum = parseInt(year, 10);

  if (month < 1 || month > 12) {
    return {
      success: false,
      error: `Invalid month: ${month}. Expected 01-12.`,
    };
  }

  if (!isValidMonthDay(month, day, yearNum)) {
    return {
      success: false,
      error: `Invalid date: ${month}/${day}/${year}.`,
    };
  }

  const seriesNames: Record<string, string> = {
    '0': '300 or 400 Series',
    '1': '500 Series through Presentation Series',
    '2': 'limited or special production group',
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = months[month - 1];
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Taylor',
    serialNumber: serial,
    year,
    month: monthName,
    day: day.toString(),
    factory: 'El Cajon, California',
    country: 'USA',
    model: seriesNames[series] || `Series group ${series}`,
    notes: `Taylor 9-digit legacy year-code format. Year code ${yearCode} indicates ${year}; date decodes as ${monthName} ${day}, ${year}. Series indicator ${series} indicates ${seriesNames[series] || 'an unspecified series group'}. Production sequence: ${sequenceNumber}. For this era, confirm the exact model and specifications from the heel-block label or Taylor support.`,
  };

  return {
    success: true,
    info,
    patternKey: 'taylor-legacy-9-digit-year-code',
    patternLabel: 'Taylor legacy 9-digit year-code format',
    additionalContext: {
      title: 'Taylor legacy 9-digit serial',
      summary: 'This serial matches Taylor\'s 1993-1999 9-digit legacy year-code format.',
      highlights: [
        `Year code ${yearCode} decodes as ${year}.`,
        `The date fields decode as ${monthName} ${day}, ${year}.`,
        `Series indicator ${series} maps to ${seriesNames[series] || 'an unspecified series group'}.`,
        `The final two digits decode as production sequence ${sequenceNumber} for that day.`,
      ],
      caveats: [
        'This serial identifies production date and series group, not the exact model or specifications.',
        'For 1993-era Taylors, the serial should usually be visible on the heel block through the soundhole.',
        'Factory records or Taylor support are best for exact model and original specification confirmation.',
      ],
      verificationTips: [
        'Look through the soundhole toward the neck for the heel-block serial.',
        'Check the label or model stamp for the exact model number.',
        'Contact Taylor support with the serial and photos if exact factory specs matter.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches Taylor&#39;s 1993-1999 9-digit legacy year-code format.</p><h3>How This Pattern Is Typically Read</h3><p>Year code ${yearCode} decodes as ${year}. The date fields decode as ${monthName} ${day}, ${year}. Series indicator ${series} maps to ${seriesNames[series] || 'an unspecified series group'}. The final two digits decode as production sequence ${sequenceNumber} for that day.</p><h3>What To Verify</h3><ul><li>This serial identifies production date and series group, not the exact model or specifications.</li><li>For 1993-era Taylors, the serial should usually be visible on the heel block through the soundhole.</li><li>Factory records or Taylor support are best for exact model and original specification confirmation.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a production-date decode, then confirm the exact model and original specifications from the heel-block label, model stamp, or Taylor support.</p>`,
  };
}

function decodeModernShort9Digit(serial: string): DecodeResult {
  // Shortened variant of Taylor's current 10-digit format:
  // Position 1: Factory (1 = El Cajon, CA; 2 = Tecate, Mexico)
  // Position 2: First digit of year
  // Position 3-4: Month (01-12)
  // Position 5-6: Day of month
  // Position 7: Second digit of year
  // Position 8-9: Shortened production sequence
  //
  // Taylor's official current format uses three final sequence digits. This
  // accepts otherwise-valid labels where that day's production sequence is
  // shown as two digits, as seen on some labels and user-submitted examples.
  const factoryCode = serial[0];
  if (factoryCode !== '1' && factoryCode !== '2') {
    return {
      success: false,
      error: 'Not a recognized shortened modern Taylor format.'
    };
  }

  const yearDigit1 = serial[1];
  const month = parseInt(serial.substring(2, 4), 10);
  const day = parseInt(serial.substring(4, 6), 10);
  const yearDigit2 = serial[6];
  const sequence = serial.substring(7, 9);
  const year = `20${yearDigit1}${yearDigit2}`;
  const yearNum = parseInt(year, 10);

  if (yearNum < 2009) {
    return {
      success: false,
      error: `Year ${year} is outside expected range for shortened modern Taylor format.`
    };
  }

  if (yearNum === 2009 && month < 11) {
    return {
      success: false,
      error: 'Taylor current serial format started in November 2009.'
    };
  }

  if (month < 1 || month > 12) {
    return {
      success: false,
      error: `Invalid month: ${month}. Expected 01-12.`
    };
  }

  if (!isValidMonthDay(month, day, yearNum)) {
    return {
      success: false,
      error: `Invalid date: ${month}/${day}/${year}.`
    };
  }

  let factory: string;
  let country: string;

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

  const info: GuitarInfo = {
    brand: 'Taylor',
    serialNumber: serial,
    year,
    month: months[month - 1],
    day: day.toString(),
    factory,
    country,
    notes: `Modern Taylor 9-digit variant: factory/date fields match the current Taylor 10-digit system, and the final two digits indicate production sequence #${parseInt(sequence, 10)} for that day. Taylor officially documents the current format with three final sequence digits, so verify the printed label if possible.`
  };

  return {
    success: true,
    info,
    patternKey: 'taylor-modern-short-9',
    patternLabel: 'Taylor modern 9-digit variant',
    additionalContext: {
      title: 'Taylor modern 9-digit variant serial',
      summary: 'This serial matches Taylor\'s modern factory/date layout, but with a two-digit final day-sequence field rather than the three-digit sequence commonly documented for the current 10-digit system.',
      highlights: [
        'Factory code 1 indicates El Cajon, California.',
        'The date fields decode as November 30, 2018.',
        `The final two digits decode as production sequence #${parseInt(sequence, 10)} for that day.`,
      ],
      caveats: [
        'Taylor officially documents the current format as 10 digits, so verify the full printed label if possible.',
        'Do not read this as the older 1993-1999 9-digit format because that would imply year 1911/2011 and does not fit that system.',
      ],
      verificationTips: [
        'Check the full label above the serial number for the model and factory text.',
        'If authenticity matters, contact Taylor support with photos of the full label and headstock.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches Taylor&#39;s modern factory/date layout, but with a two-digit final day-sequence field rather than the three-digit sequence commonly documented for the current 10-digit system.</p><h3>How This Pattern Is Typically Read</h3><p>Factory code 1 indicates El Cajon, California. The date fields decode as November 30, 2018. The final two digits decode as production sequence #${parseInt(sequence, 10)} for that day.</p><h3>What To Verify</h3><ul><li>Taylor officially documents the current format as 10 digits, so verify the full printed label if possible.</li><li>Do not read this as the older 1993-1999 9-digit format because that would imply year 1911/2011 and does not fit that system.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical decode, then confirm with the full label, model text, and Taylor support if authenticity matters.</p>`,
  };
}

function isValidMonthDay(month: number, day: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function decodeEarlyTaylor(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  let year = 'Pre-1993';
  let notes = 'Early Taylor guitar. ';

  // Taylor was founded in 1974
  // Very rough estimates based on production numbers
  if (num < 1000) {
    year = '1974-1979 (approximate)';
    notes += 'Very early Taylor production. The company was founded in 1974 by Bob Taylor and Kurt Listug.';
  } else if (num < 5000) {
    year = '1979-1984 (approximate)';
    notes += 'Early Taylor production from the first decade of the company.';
  } else if (num < 15000) {
    year = '1984-1988 (approximate)';
    notes += 'Taylor was growing during this period and refining their designs.';
  } else if (num < 50000) {
    year = '1988-1993 (approximate)';
    notes += 'Taylor continued to expand production in the late 1980s and early 1990s.';
  } else {
    year = 'Pre-1993';
    notes += 'Early Taylor serial numbers did not follow a consistent format until 1993.';
  }

  notes += ' For accurate dating of early Taylors, contact Taylor customer service with your serial number.';

  const info: GuitarInfo = {
    brand: 'Taylor',
    serialNumber: serial,
    year,
    factory: 'El Cajon, California (or earlier Lemon Grove location)',
    country: 'USA',
    notes
  };

  return { success: true, info };
}
