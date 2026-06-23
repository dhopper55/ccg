import { DecodeResult, GuitarInfo } from '../types.js';

// Factory codes for Epiphone guitars
const FACTORY_CODES: Record<string, { name: string; country: string }> = {
  // Korean factories
  'I': { name: 'Saein', country: 'South Korea' },
  'U': { name: 'Unsung', country: 'South Korea' },
  'S': { name: 'Samick', country: 'South Korea' },
  'P': { name: 'Peerless', country: 'South Korea' },
  'R': { name: 'Peerless', country: 'South Korea' },
  'K': { name: 'Unknown Korean Factory', country: 'South Korea' },
  'F': { name: 'Fine Guitars', country: 'South Korea' },
  'C': { name: 'Unknown Korean Factory', country: 'South Korea' },

  // Chinese factories (letter codes)
  'MR': { name: 'Unknown Chinese Factory', country: 'China' },
  'DW': { name: 'DaeWon', country: 'China' },
  'EA': { name: 'Qingdao (Acoustic)', country: 'China' },
  'EE': { name: 'Qingdao', country: 'China' },
  'ED': { name: 'Dongbei', country: 'China' },
  'Z': { name: 'Zaozhuang Saehan', country: 'China' },

  // Indonesian factories
  'CI': { name: 'Cort Indonesia', country: 'Indonesia' },
  'SI': { name: 'Samick Indonesia', country: 'Indonesia' },
  'MC': { name: 'Unknown Indonesian Factory', country: 'Indonesia' },
};

// Numeric factory codes (used since ~2008)
const NUMERIC_FACTORY_CODES: Record<string, { name: string; country: string }> = {
  '11': { name: 'Unknown (Masterbilt)', country: 'China' },
  '12': { name: 'DaeWon or Unsung', country: 'China' },
  '15': { name: 'Qingdao (Electric)', country: 'China' },
  '16': { name: 'Qingdao (Acoustic)', country: 'China' },
  '17': { name: 'Unknown Chinese Factory', country: 'China' },
  '20': { name: 'DaeWon or Unsung', country: 'China' },
  '21': { name: 'Unsung', country: 'South Korea' },
  '23': { name: 'Samick', country: 'Indonesia' },
};

export function decodeEpiphone(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Try different formats

  // Pre-check: correct 'L' (uppercase) misread as '1' in the digit portion of letter-factory serials.
  // e.g. R94l158 → normalized to R94L158 → L is a worn/misread '1' → treat digits as R941158.
  const lMisreadMatch = normalized.match(/^([A-Z])(\d+)L(\d+)$/);
  if (lMisreadMatch) {
    const correctedDigits = lMisreadMatch[2] + '1' + lMisreadMatch[3];
    return decodeSingleLetterFormat(lMisreadMatch[1], correctedDigits, normalized);
  }

  // Format 1: Two letters + 8+ digits (e.g., SI02060234)
  // Common modern format: FF YYMMNNNN
  const twoLetterMatch = normalized.match(/^([A-Z]{2})(\d{8,})$/);
  if (twoLetterMatch) {
    return decodeTwoLetterFormat(twoLetterMatch[1], twoLetterMatch[2], normalized);
  }

  // Format 2: Single letter + digits (e.g., S1234567, U0312345)
  const singleLetterMatch = normalized.match(/^([A-Z])(\d{7,})$/);
  if (singleLetterMatch) {
    return decodeSingleLetterFormat(singleLetterMatch[1], singleLetterMatch[2], normalized);
  }

  // Format 2b: 1990s all-numeric import format, YMM#### (e.g., 6043399 = April 1996)
  const numeric1990sMatch = normalized.match(/^(\d)(\d{2})(\d{4})$/);
  if (numeric1990sMatch) {
    return decode1990sNumericImportFormat(
      numeric1990sMatch[1],
      numeric1990sMatch[2],
      numeric1990sMatch[3],
      normalized
    );
  }

  // MIRC format: 311 + 6 digits (Manufacturer's Inspection and Repair Center — Gibson refurbishment)
  if (/^311\d{6}$/.test(normalized)) {
    return decodeMIRCRefurb(normalized);
  }

  // Format 3: YYMM + 2-digit factory code + 3-6 digits (since 2008)
  // e.g., 0807230809 = July 2008, factory 23, #809
  // e.g., 08121512345 = Dec 2008, factory 15, #12345
  const numericFactoryMatch = normalized.match(/^(\d{2})(\d{2})(\d{2})(\d{3,6})$/);
  if (numericFactoryMatch) {
    return decodeNumericFactoryFormat(
      numericFactoryMatch[1],
      numericFactoryMatch[2],
      numericFactoryMatch[3],
      numericFactoryMatch[4],
      normalized
    );
  }

  // Format 4: Letter + single digit year + sequence (e.g., Z051234)
  const letterYearMatch = normalized.match(/^([A-Z])(\d)(\d+)$/);
  if (letterYearMatch && letterYearMatch[3].length >= 4) {
    return decodeLetterYearFormat(letterYearMatch[1], letterYearMatch[2], letterYearMatch[3], normalized);
  }

  // Format 5: F-serial format (Les Paul Standards, Tributes)
  if (normalized.startsWith('F')) {
    return decodeFSerialFormat(normalized);
  }

  // Kalamazoo-era Epiphone (Gibson ownership, 1958-1969): 6-digit all-numeric serials
  if (/^\d{6}$/.test(normalized)) {
    return decodeKalamazooSixDigit(normalized);
  }

  // Vintage Epiphone (pre-Gibson ownership, 1930s-1957)
  if (/^\d{4,5}$/.test(normalized)) {
    return decodeVintageEpiphone(normalized);
  }

  return {
    success: false,
    error: 'Unrecognized Epiphone serial number format. Modern Epiphone serials typically start with 1-2 letters (factory code) followed by digits indicating year, month, and production number. MIRC refurbishment units begin with 311 (9 digits total).'
  };
}

function decodeTwoLetterFormat(factory: string, digits: string, serial: string): DecodeResult {
  const factoryInfo = FACTORY_CODES[factory];

  if (!factoryInfo) {
    return {
      success: false,
      error: `Unknown factory code: ${factory}. This may be a newer or less common factory code.`
    };
  }

  // Format: YYMMNNNN or YYMMNNNNN
  const year = '20' + digits.substring(0, 2);
  const month = parseInt(digits.substring(2, 4), 10);
  const sequence = digits.substring(4);

  if (month < 1 || month > 12) {
    return {
      success: false,
      error: `Invalid month value: ${month}. Expected 01-12.`
    };
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year,
    month: months[month - 1],
    factory: factoryInfo.name,
    country: factoryInfo.country,
    notes: `Production sequence: ${sequence}. Factory code ${factory} = ${factoryInfo.name}, ${factoryInfo.country}.`
  };

  return { success: true, info };
}

function decodeSingleLetterFormat(factory: string, digits: string, serial: string): DecodeResult {
  const factoryInfo = FACTORY_CODES[factory];

  // Try to parse: YYMMNNNNN format
  const yearDigits = digits.substring(0, 2);
  const yearValue = parseInt(yearDigits, 10);
  const year = yearValue >= 80 ? `19${yearDigits}` : `20${yearDigits}`;
  const month = parseInt(digits.substring(2, 4), 10);
  const sequence = digits.substring(4);

  let factoryName = factoryInfo?.name || 'Unknown';
  let country = factoryInfo?.country || 'Unknown';

  if (month >= 1 && month <= 12) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const info: GuitarInfo = {
      brand: 'Epiphone',
      serialNumber: serial,
      year,
      month: months[month - 1],
      factory: factoryName,
      country,
      notes: `Production sequence: ${parseInt(sequence, 10)}. Factory code ${factory} = ${factoryName}, ${country}. Single-letter Epiphone serials from this era commonly use factory + YYMM + production sequence. Korean-made Epiphones from factories such as Unsung and Samick are often associated with late-1980s through early-2000s production, but model, neck joint, hardware, and headstock details should still be verified.`
    };

    return {
      success: true,
      info,
      patternKey: 'epiphone-korea-single-letter-factory-yymm-sequence',
      patternLabel: 'Epiphone Korean single-letter factory YYMM sequence',
      additionalContext: {
        title: 'Epiphone Korean factory serial',
        summary: 'This serial matches a classic single-letter Epiphone factory format used on Korean-made instruments.',
        highlights: [
          `The prefix ${factory} indicates ${factoryName}.`,
          `The digits ${yearDigits} decode as production year ${year}.`,
          `The digits ${digits.substring(2, 4)} decode as ${months[month - 1]}.`,
          `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
        ],
        caveats: [
          'The serial identifies factory and production timing, not the exact model name.',
          'Late-1990s Epiphone specs can vary by model and factory run.',
        ],
        verificationTips: [
          'Check the back of the headstock for a gold or silver silkscreened serial.',
          'Confirm the model from body style, pickups, bridge, and headstock markings.',
          'Use neck construction, hardware style, and label or cavity markings to verify the exact instrument.',
        ],
      },
      additionalContextRichText: `<h3>Overview</h3><p>This serial matches a classic single-letter Epiphone factory format used on Korean-made instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The prefix ${factory} indicates ${factoryName}. The digits ${yearDigits} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${months[month - 1]}. The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>The serial identifies factory and production timing, not the exact model name.</li><li>Check the back of the headstock for a gold or silver silkscreened serial.</li><li>Confirm the exact model from body style, neck construction, pickups, bridge, and headstock markings.</li></ul>`,
    };
  }

  // If month parsing failed, provide basic info
  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    factory: factoryName,
    country,
    notes: `Factory code ${factory}. Unable to determine exact date from this serial number format.`
  };

  return { success: true, info };
}

// Vintage Japanese Epiphone format: Y(1) + ModelCode(1) + Sequence(5)
// Used on Terada/FujiGen-built Epiphones from roughly 1987-1997
const EPIPHONE_VINTAGE_JAPAN_MODEL_CODES: Record<string, string> = {
  '0': 'Entry-level or unspecified model',
  '1': 'Casino / ES-style thinline hollowbody',
  '2': 'Riviera or Sheraton style',
  '3': 'Riviera or Casino variant',
  '5': 'SG or similar solidbody',
  '6': 'Les Paul model',
  '7': 'Flying V or angular style',
  '8': 'Explorer or angular solidbody',
  '9': 'Emperor-J or Emperor hollowbody',
};

function decodeVintageJapanese7Digit(yearDigit: string, remainingFiveDigits: string, serial: string): DecodeResult {
  const yearNum = parseInt(yearDigit, 10);
  const modelCode = remainingFiveDigits[0];
  const sequence = remainingFiveDigits.substring(1);
  const sequenceNumber = parseInt(sequence, 10);

  // Year digit: ending in 7-9 = probably 1987-1989; ending in 0-6 = 1990-1996 or ambiguous
  const possibleYear = yearNum >= 7
    ? `198${yearNum} or 199${yearNum}`
    : `199${yearNum}`;

  const modelDescription = EPIPHONE_VINTAGE_JAPAN_MODEL_CODES[modelCode] ?? `Body style code ${modelCode}`;

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year: possibleYear,
    factory: 'Terada or FujiGen, Japan',
    country: 'Japan',
    model: modelDescription,
    notes: `Vintage Japanese Epiphone format (Terada or FujiGen production, roughly 1987–1997). Interpreted as: ${yearDigit} (year ending, pointing to ${possibleYear}), ${modelCode} (model/body style code = ${modelDescription}), ${sequence} (production sequence #${sequenceNumber}). This era produced some of Epiphone's most collectible instruments — hollow and semi-hollow Epiphones from Terada (Casino, Sheraton, Emperor) and solidbodies from FujiGen. Verify the exact year, model, and factory from the headstock logo, truss rod cover, interior soundhole or neck-heel label, and hardware details.`,
  };

  return {
    success: true,
    info,
    patternKey: 'epiphone-vintage-japanese-year-model-sequence',
    patternLabel: 'Epiphone vintage Japan Y + model code + sequence (1987–1997)',
    additionalContext: {
      title: 'Epiphone vintage Japanese 7-digit serial (1987–1997)',
      summary: 'This 7-digit all-numeric serial matches the vintage Japanese Epiphone format used on Terada and FujiGen-built instruments, decoded as a year digit, a body-style model code, and a 5-digit production sequence.',
      highlights: [
        `The year digit ${yearDigit} points to production year ${possibleYear}.`,
        `The model code ${modelCode} indicates ${modelDescription}.`,
        `The final five digits decode as production sequence #${sequenceNumber}.`,
        'Vintage Japanese Epiphones from this era are often regarded as some of the brand\'s finest — particularly Terada-built hollowbodies.',
      ],
      caveats: [
        'The year digit is ambiguous between the 1980s and 1990s without model context.',
        'The model code identifies the body style category, not the exact model name.',
        'This format applies to Japanese-built Epiphone instruments; later Chinese and Korean models use a different system.',
      ],
      verificationTips: [
        'Check the soundhole label or back-of-headstock sticker for country-of-origin (Made in Japan).',
        'Compare the neck-heel or neck-pocket markings for a handwritten or stamped production date.',
        'For a Casino, Sheraton, or Emperor, Terada is the most common Japanese contract factory from this era.',
        'For Les Paul, SG, and solidbodies, FujiGen is more common.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 7-digit all-numeric serial matches the vintage Japanese Epiphone format used on Terada and FujiGen-built instruments from roughly 1987–1997.</p><h3>How This Pattern Is Typically Read</h3><p>The year digit ${yearDigit} points to production year ${possibleYear}. The model code ${modelCode} indicates ${modelDescription}. The final five digits decode as production sequence #${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the soundhole label or back-of-headstock sticker for "Made in Japan" markings.</li><li>Compare the neck-heel or neck-pocket for a handwritten or stamped production date.</li><li>Terada built most vintage Japanese hollowbodies (Casino, Sheraton, Emperor); FujiGen handled many solidbodies.</li></ul><h3>Coal Creek Guitars Note</h3><p>Vintage Japanese Epiphones are among the brand's most collectible instruments. Use the year and model code as a starting point, then confirm details from the label, hardware, and physical construction.</p>`,
  };
}

function decode1990sNumericImportFormat(
  yearDigit: string,
  monthDigits: string,
  sequence: string,
  serial: string
): DecodeResult {
  const year = `199${yearDigit}`;
  const month = parseInt(monthDigits, 10);

  if (month < 1 || month > 12) {
    // Month is invalid for a standard YMM#### format — fall back to vintage Japanese interpretation:
    // Y(1) + ModelCode(1) + Sequence(5), as used on Terada/FujiGen builds ~1987-1997
    return decodeVintageJapanese7Digit(yearDigit, monthDigits + sequence, serial);
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = months[month - 1];
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year,
    month: monthName,
    factory: 'Unknown Korean or Japanese contract factory',
    country: 'South Korea or Japan',
    notes: `1990s all-numeric Epiphone import format interpreted as Y + MM + production sequence. The first digit ${yearDigit} indicates ${year}; ${monthDigits} indicates ${monthName}; the final four digits are production sequence ${sequenceNumber}. This format does not include a factory-letter code, so verify country and factory from headstock markings, label details, and model specs.`,
  };

  return {
    success: true,
    info,
    patternKey: 'epiphone-1990s-numeric-y-mm-sequence',
    patternLabel: 'Epiphone 1990s numeric YMM sequence',
    additionalContext: {
      title: 'Epiphone 1990s numeric serial',
      summary: 'This serial matches a 1990s all-numeric Epiphone import format parsed as single-digit year, month, and sequence.',
      highlights: [
        `The first digit ${yearDigit} decodes as production year ${year}.`,
        `The next two digits ${monthDigits} decode as ${monthName}.`,
        `The final four digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format does not identify a specific factory by letter code.',
        'Factory attribution is usually Korean, with some uncertainty across 1990s contract production.',
        'The serial identifies production timing, not the exact model name.',
      ],
      verificationTips: [
        'Check the back of the headstock for Made in Korea, Made in Japan, or other origin markings.',
        'Compare truss rod cover, headstock shape, hardware, and label details against mid-1990s Epiphone specs.',
        'Contact Gibson/Epiphone support with photos if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 1990s all-numeric Epiphone import format parsed as single-digit year, month, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${yearDigit} decodes as production year ${year}. The next two digits ${monthDigits} decode as ${monthName}. The final four digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format does not identify a specific factory by letter code.</li><li>Factory attribution is usually Korean, with some uncertainty across 1990s contract production.</li><li>Confirm model and country from the headstock, label, hardware, and other physical markings.</li></ul>`,
  };
}

function decodeNumericFactoryFormat(
  year: string,
  month: string,
  factory: string,
  sequence: string,
  serial: string
): DecodeResult {
  const factoryInfo = NUMERIC_FACTORY_CODES[factory];

  const fullYear = '20' + year;
  const monthNum = parseInt(month, 10);

  if (monthNum < 1 || monthNum > 12) {
    return {
      success: false,
      error: `Invalid month value: ${monthNum}. Expected 01-12.`
    };
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year: fullYear,
    month: months[monthNum - 1],
    factory: factoryInfo?.name || `Factory ${factory}`,
    country: factoryInfo?.country || 'Unknown (likely China)',
    notes: `Production sequence: ${sequence}. Numeric factory code format (used since 2008).`
  };

  return { success: true, info };
}

function decodeLetterYearFormat(factory: string, yearDigit: string, sequence: string, serial: string): DecodeResult {
  const factoryInfo = FACTORY_CODES[factory];

  // Year digit represents 200X
  const year = '200' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year,
    factory: factoryInfo?.name || 'Unknown',
    country: factoryInfo?.country || 'China',
    notes: `Production sequence: ${sequence}. Factory code ${factory}.`
  };

  return { success: true, info };
}

function decodeMIRCRefurb(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    factory: 'Gibson MIRC (Manufacturer\'s Inspection and Repair Center)',
    country: 'USA',
    notes: 'The 311 prefix identifies this as a MIRC (Manufacturer\'s Inspection and Repair Center) refurbishment serial. These numbers are assigned by Gibson\'s repair and refurbishment center to Epiphone instruments that were processed for quality remediation, warranty repair, or factory refurbishment. The serial does not encode a standard production year or factory — the 311 prefix is the MIRC identifier. Verify the guitar\'s model and year from the label inside the body.',
  };

  return {
    success: true,
    info,
    patternKey: 'epiphone-mirc-311-refurb',
    patternLabel: 'Epiphone MIRC 311-prefix refurbishment',
  };
}

function decodeFSerialFormat(serial: string): DecodeResult {
  // F-serial format is not fully documented
  // Used on LP Std '59/'60 models and Tribute/Plus models
  // Made in China

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    country: 'China',
    notes: 'F-serial format used on Les Paul Standard \'59/\'60 models and Tribute/Plus models. This format does not clearly encode the year or month. Typically made in China.'
  };

  return { success: true, info };
}

function decodeKalamazooSixDigit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  let year: string;
  if (num >= 100000 && num <= 199999) {
    year = '1960–1964 (Kalamazoo estimate)';
  } else if (num >= 200000 && num <= 299999) {
    year = '1963–1967 (Kalamazoo estimate)';
  } else if (num >= 300000 && num <= 599999) {
    year = '1965–1969 (Kalamazoo estimate)';
  } else if (num >= 600000 && num <= 799999) {
    year = '1966–1969 (Kalamazoo estimate)';
  } else if (num >= 800000 && num <= 843835) {
    year = '1966 or 1969 (Kalamazoo estimate)';
  } else {
    year = 'Late 1950s–1969 (Kalamazoo era, range unclear)';
  }

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year,
    factory: 'Gibson Kalamazoo plant, Kalamazoo, Michigan',
    country: 'USA',
    notes: `6-digit all-numeric serial in the Kalamazoo era range. Epiphone guitars were made alongside Gibson instruments at the Kalamazoo, Michigan factory from 1958 until production moved overseas in the early 1970s. Serial number ${serial} falls in the ${year} production window. Confirm authenticity with the headstock logo style, neck binding, hardware finish, and internal label. Kalamazoo-era Epiphones are highly collectible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'epiphone-kalamazoo-usa-6digit-1960s',
    patternLabel: 'Epiphone Kalamazoo USA 6-digit 1958–1969',
    additionalContext: {
      title: 'Epiphone Kalamazoo USA serial',
      summary: 'This 6-digit numeric serial falls in the Kalamazoo-era range for Epiphone guitars made at the Gibson plant in Michigan from 1958 into the early 1970s.',
      highlights: [
        'Kalamazoo-era Epiphones were made alongside Gibson instruments at the Kalamazoo, Michigan factory.',
        `Serial ${serial} falls in the estimated production window: ${year}.`,
        'This era covers models like the Casino, Riviera, Sheraton, and Rivoli Bass.',
      ],
      caveats: [
        'Serial number ranges from this era overlapped — the same number could appear across multiple years.',
        'Dating requires cross-referencing the number with the headstock logo, hardware, and internal label.',
        'A Union Made or Kalamazoo, Michigan label inside the body is a strong authenticity indicator for hollow-body models.',
      ],
      verificationTips: [
        'Check inside the body for a Union Made label reading "Kalamazoo, Michigan."',
        'Compare the headstock logo style and inlay pattern against known 1960s Epiphone catalog examples.',
        'Contact Gibson/Epiphone customer service with photos for official verification.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 6-digit numeric serial falls in the Kalamazoo-era range for Epiphone guitars made at the Gibson plant in Michigan from 1958 into the early 1970s.</p><h3>How This Pattern Is Typically Read</h3><p>Kalamazoo-era Epiphones were made alongside Gibson instruments at the Kalamazoo, Michigan factory. Serial ${serial} falls in the estimated production window: ${year}. This era covers highly collectible models such as the Casino, Riviera, Sheraton, and Rivoli Bass.</p><h3>What To Verify</h3><ul><li>Serial number ranges from this era overlapped — the same number could appear in multiple years, so dating requires additional physical evidence.</li><li>Check inside the body for a "Union Made" label reading "Kalamazoo, Michigan" as a strong authenticity indicator.</li><li>Compare the headstock logo style and inlay pattern against known 1960s Epiphone catalog examples.</li></ul><h3>Coal Creek Guitars Note</h3><p>If confirmed as a Kalamazoo-era Epiphone, this is a highly collectible vintage instrument. Contact Gibson/Epiphone customer service with clear photos for official verification and model identification.</p>`,
  };
}

function decodeVintageEpiphone(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  let year = 'Pre-1957';
  let notes = 'Vintage Epiphone (before Gibson acquisition in 1957). ';

  if (num < 10000) {
    year = '1930s-1940s (approximate)';
  } else {
    year = '1940s-1957 (approximate)';
  }

  notes += 'Original Epiphone instruments were made in New York. Dating requires examination of other features.';

  const info: GuitarInfo = {
    brand: 'Epiphone',
    serialNumber: serial,
    year,
    factory: 'Epiphone (Original)',
    country: 'USA (New York)',
    notes
  };

  return { success: true, info };
}
