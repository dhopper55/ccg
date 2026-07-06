import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeGibson(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();

  // Remove any spaces or dashes
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Artist Custom Shop: ZW + 3-4 digits (Zakk Wylde signature series)
  if (/^ZW\d{3,4}$/.test(normalized)) {
    return decodeZakkWyldeCustomShop(normalized);
  }

  // Modern Gibson Custom Shop non-reissue format: CS + Y + 4/5-digit rank
  if (/^CS\d{5,6}$/.test(normalized)) {
    return decodeModernCustomShop(normalized);
  }

  // Check for 8-digit format (1977-2005): YDDDYRRR
  if (/^\d{8}$/.test(normalized)) {
    return decode8Digit(normalized);
  }

  // Check for 9-digit format (2005-present): YDDDYBRRR
  if (/^\d{9}$/.test(normalized)) {
    return decode9Digit(normalized);
  }

  // Check for 6-digit format (1970s)
  if (/^\d{6}$/.test(normalized)) {
    return decode6Digit(normalized);
  }

  // Check for older formats (pre-1977)
  if (/^\d{4,5}$/.test(normalized)) {
    return decodeVintage(normalized);
  }

  return {
    success: false,
    error: 'Unrecognized Gibson serial number format. Gibson serials are typically 6-9 digits for guitars made after 1970.'
  };
}

function decodeZakkWyldeCustomShop(serial: string): DecodeResult {
  const productionRank = serial.substring(2);
  const rankNumber = parseInt(productionRank, 10);

  const info: GuitarInfo = {
    brand: 'Gibson',
    serialNumber: serial,
    year: 'Gibson Custom Shop (exact year requires COA or factory confirmation)',
    factory: 'Gibson Custom Shop, Nashville, Tennessee',
    country: 'USA',
    model: 'Zakk Wylde Signature Les Paul Custom',
    notes: `ZW prefix uniquely identifies this as a Zakk Wylde Signature model from the Gibson Custom Shop. The digits ${productionRank} are the sequential production number (unit ${rankNumber} in the ZW artist run). The ZW series does not embed the calendar year directly in the serial; exact production year requires the Certificate of Authenticity or Gibson Custom Shop confirmation. Authentic ZW Custom Shop guitars feature EMG 81/85 active pickups, a Les Paul Custom body (typically in Bullseye or Camo finish), and neck binding with fret nibs. Counterfeits are common on this signature line.`,
  };

  return {
    success: true,
    info,
    patternKey: 'gibson-custom-shop-zakk-wylde-zw-prefix',
    patternLabel: 'Gibson Custom Shop Zakk Wylde ZW-prefix artist format',
    additionalContext: {
      title: 'Gibson Zakk Wylde Custom Shop serial',
      summary: 'ZW is the Gibson Custom Shop artist prefix uniquely identifying this as a Zakk Wylde Signature Les Paul Custom. The digits are the sequential production number within the ZW artist run.',
      highlights: [
        'ZW prefix identifies Gibson Custom Shop Zakk Wylde Signature production.',
        `Production rank: ${rankNumber} (unit ${rankNumber} in the ZW artist series).`,
        'Authentic ZW Les Pauls feature EMG 81/85 active pickups and a Bullseye or Camo finish.',
        'The serial does not directly encode the calendar year; a COA or Gibson registry is needed for exact dating.',
      ],
      caveats: [
        'ZW Bullseye and Camo Les Pauls are among the most counterfeited guitars in the world.',
        'A correct serial number alone does not authenticate the instrument — counterfeits often copy valid serials.',
        'The serial number sequence does not map directly to a calendar year for ZW artist runs.',
      ],
      verificationTips: [
        'Check that the headstock front has the E-II — wait, the correct feature: the Gibson Custom Shop badge and Zakk Wylde caricature/graphic on the back of the headstock.',
        'Verify fret nibs: authentic Gibson Custom Shop guitars have binding that rolls up over fret ends (fret nibs/nubs). Counterfeits usually omit this.',
        'Confirm EMG 81/85 active pickups with a battery compartment routed into the back of the body.',
        'Match the serial against the Certificate of Authenticity (COA) booklet if available.',
        'Contact Gibson Custom Shop directly with the serial and clear photos for factory confirmation.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>ZW is the Gibson Custom Shop artist prefix uniquely identifying this as a Zakk Wylde Signature Les Paul Custom. The digits are the sequential production number within the ZW artist run.</p><h3>How This Pattern Is Typically Read</h3><p>ZW identifies the guitar as a Zakk Wylde Signature model built at the Gibson Custom Shop in Nashville. The digits ${productionRank} are production rank ${rankNumber} within the ZW series. Unlike standard production Gibsons, the ZW series does not encode the calendar year in the serial — exact production year requires the Certificate of Authenticity or Gibson Custom Shop confirmation.</p><h3>What To Verify</h3><ul><li>ZW Bullseye and Camo Les Pauls are among the most counterfeited guitars. A correct serial alone does not authenticate the guitar.</li><li>Check fret nibs: real Gibson Custom Shop guitars have binding that rolls up over fret ends; counterfeits almost always miss this.</li><li>Confirm EMG 81/85 active pickups with a rear battery compartment.</li><li>Match the serial against the COA if one is present.</li></ul><h3>Coal Creek Guitars Note</h3><p>Treat this as a genuine ZW Custom Shop decode, but always verify physical features and COA before buying, selling, or valuing this instrument due to the high counterfeit prevalence.</p>`,
  };
}

function decodeModernCustomShop(serial: string): DecodeResult {
  const digits = serial.slice(2);
  const yearDigit = parseInt(digits[0], 10);
  const productionRank = digits.slice(1);
  const year = determineCustomShopYearRange(yearDigit);

  const info: GuitarInfo = {
    brand: 'Gibson',
    serialNumber: serial,
    year,
    factory: 'Gibson Custom Shop, Nashville, Tennessee',
    country: 'USA',
    model: 'Custom Shop non-reissue / Les Paul Custom family',
    notes: `Modern Gibson Custom Shop CS-prefix format. CS indicates Custom Shop; ${yearDigit} is the last digit of the production year, commonly decoded as ${year} for this regular Custom Shop format; ${productionRank} is the production rank. Spaces after the CS prefix are optional. Historic reissues and some Custom Shop instruments use different serial formats, so verify against the COA, headstock stamp, model details, and Gibson support when exact provenance matters.`
  };

  return {
    success: true,
    info,
    patternKey: 'gibson-modern-custom-shop-cs-prefix',
    patternLabel: 'Gibson modern Custom Shop CS-prefix format',
    additionalContext: {
      title: 'Gibson Custom Shop CS-prefix serial',
      summary: 'Modern regular-production Gibson Custom Shop instruments often use CS followed by a one-digit year code and a production rank.',
      highlights: [
        `CS prefix identifies Gibson Custom Shop production.`,
        `Year digit ${yearDigit} points to ${year}; model features and paperwork usually narrow the decade.`,
        `Production rank: ${productionRank}.`
      ],
      caveats: [
        'This is for regular Custom Shop production, not every Historic Reissue or special-run format.',
        'Gibson Custom Shop serial dating often needs model details, features, and the Certificate of Authenticity for certainty.'
      ],
      verificationTips: [
        'Compare the serial against the COA and the stamp on the back of the headstock.',
        'Use the model, finish, hardware, and case paperwork to distinguish possible decades.'
      ]
    }
  };
}

function decode8Digit(serial: string): DecodeResult {
  // Format: YDDDYRRR
  // Y (positions 1 and 5) = year
  // DDD (positions 2-4) = day of year
  // RRR (positions 6-8) = ranking/factory code

  const yearDigit1 = serial[0];
  const dayOfYear = parseInt(serial.substring(1, 4), 10);
  const yearDigit2 = serial[4];
  const ranking = parseInt(serial.substring(5, 8), 10);

  const yearSuffix = yearDigit1 + yearDigit2;

  // Determine the full year (could be 1977-2005)
  let year = determineYear(parseInt(yearSuffix, 10), 1977, 2005);

  // Validate day of year
  if (dayOfYear < 1 || dayOfYear > 366) {
    return {
      success: false,
      error: `Invalid day of year: ${dayOfYear}. Must be between 1 and 366.`
    };
  }

  // Determine factory location based on ranking
  let factory: string;
  let country = 'USA';

  if (ranking < 500) {
    // Before 1984: Kalamazoo, After 1984: Nashville
    if (year && parseInt(year) < 1984) {
      factory = 'Kalamazoo, Michigan';
    } else {
      factory = 'Nashville, Tennessee';
    }
  } else {
    factory = 'Nashville, Tennessee';
  }

  // Special case: Bozeman acoustics (1989+)
  // Note: Can't determine acoustic vs electric from serial alone

  const date = dayOfYearToDate(dayOfYear, parseInt(year || '2000'));

  const info: GuitarInfo = {
    brand: 'Gibson',
    serialNumber: serial,
    year: year || 'Unknown',
    month: date.month,
    day: date.day,
    factory,
    country,
    notes: `Ranking number: ${ranking}. Factory codes <500 indicate Kalamazoo (pre-1984) or Nashville. Codes 500-999 indicate Nashville. Acoustic guitars made after 1989 were built in Bozeman, Montana.`
  };

  return { success: true, info };
}

function decode9Digit(serial: string): DecodeResult {
  // Format: YDDDYBRRR (since July 2005)
  // Y (positions 1 and 5) = year
  // DDD (positions 2-4) = day of year
  // B (position 6) = batch number
  // RRR (positions 7-9) = ranking

  const yearDigit1 = serial[0];
  const dayOfYear = parseInt(serial.substring(1, 4), 10);
  const yearDigit2 = serial[4];
  const batch = serial[5];
  const ranking = parseInt(serial.substring(6, 9), 10);

  const yearSuffix = yearDigit1 + yearDigit2;
  let year = determineYear(parseInt(yearSuffix, 10), 2005, 2029);

  if (dayOfYear < 1 || dayOfYear > 366) {
    // YDDDYBRRR parse gave invalid day — fall back to treating first 2 digits as YY and rest as sequence
    const altYearNum = parseInt(serial.substring(0, 2), 10);
    const altYear = determineYear(altYearNum, 1960, 2029);
    const altSeq = parseInt(serial.substring(2), 10);
    if (altYear) {
      return {
        success: true,
        info: {
          brand: 'Gibson',
          serialNumber: serial,
          year: altYear,
          factory: 'Nashville, Tennessee (electric) or Bozeman, Montana (acoustic)',
          country: 'USA',
          notes: `9-digit serial interpreted as YY+sequence (day-of-year ${dayOfYear} exceeded valid range for standard YDDDYBRRR format). Year decoded from first two digits: ${altYear}. Production sequence: ${altSeq}. Verify with headstock logo, model, and factory markings.`,
        },
      };
    }
    return {
      success: false,
      error: `Invalid day of year: ${dayOfYear}. Must be between 1 and 366.`
    };
  }

  const date = dayOfYearToDate(dayOfYear, parseInt(year || '2020'));

  // Determine factory - most Gibson USA guitars are Nashville
  // Acoustics are Bozeman
  let factory = 'Nashville, Tennessee (electric) or Bozeman, Montana (acoustic)';

  const info: GuitarInfo = {
    brand: 'Gibson',
    serialNumber: serial,
    year: year || 'Unknown',
    month: date.month,
    day: date.day,
    factory,
    country: 'USA',
    notes: `Batch: ${batch}, Ranking: ${ranking}. This 9-digit format has been used since July 2005. Batch resets to 0 each day.`
  };

  return { success: true, info };
}

function decode6Digit(serial: string): DecodeResult {
  // 6-digit serials from the 1970s
  // Less consistent format - provide approximate info

  const info: GuitarInfo = {
    brand: 'Gibson',
    serialNumber: serial,
    year: '1970-1977 (approximate)',
    factory: 'Kalamazoo, Michigan',
    country: 'USA',
    notes: 'Six-digit serial numbers were used inconsistently in the 1970s. Dating these guitars often requires examining other features like potentiometer codes, pickup stamps, or construction details.'
  };

  return { success: true, info };
}

function decodeVintage(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  let year = 'Pre-1977';
  let notes = 'Vintage Gibson serial numbers varied significantly by era. ';

  // Very rough estimates based on serial ranges
  if (num < 10000) {
    year = '1950s or earlier';
    notes += 'Low serial numbers suggest an early vintage instrument. Consult a Gibson expert for precise dating.';
  } else if (num < 100000) {
    year = '1950s-1960s (approximate)';
    notes += 'Serial numbers in this range span multiple decades. Other features must be examined for accurate dating.';
  } else {
    year = '1960s-1970s (approximate)';
    notes += 'Higher serial numbers suggest later production, but Gibson reused number ranges multiple times.';
  }

  const info: GuitarInfo = {
    brand: 'Gibson',
    serialNumber: serial,
    year,
    factory: 'Kalamazoo, Michigan',
    country: 'USA',
    notes
  };

  return { success: true, info };
}

function determineCustomShopYearRange(yearDigit: number): string {
  const firstCandidate = 2000 + yearDigit;
  const secondCandidate = 2010 + yearDigit;

  return `${firstCandidate} or ${secondCandidate} (context-dependent Custom Shop estimate)`;
}

function determineYear(suffix: number, minYear: number, maxYear: number): string {
  // Convert 2-digit year to full year within expected range
  for (let year = maxYear; year >= minYear; year--) {
    if (year % 100 === suffix) {
      return year.toString();
    }
  }
  // If no exact match in range, expand search to find the most likely 4-digit year
  // Try 2000s first (most common for recent guitars), then 1900s
  if (suffix + 2000 >= minYear) {
    return (suffix + 2000).toString();
  }
  if (suffix + 1900 >= minYear) {
    return (suffix + 1900).toString();
  }
  // Fallback: always return a 4-digit year
  return (suffix + 2000).toString();
}

function dayOfYearToDate(day: number, year: number): { month: string; day: string } {
  const date = new Date(year, 0, day);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return {
    month: months[date.getMonth()],
    day: date.getDate().toString()
  };
}
