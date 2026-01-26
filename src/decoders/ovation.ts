import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Ovation Guitar Serial Number Decoder
 *
 * Supports:
 * - USA Production (New Hartford, CT):
 *   - 3-digit series (1966-1967)
 *   - 4-digit series (1967-1968)
 *   - 5-digit series (1970-1972)
 *   - Letter prefix series (1968-1981)
 *   - 6-digit series (1972-2013) - main production
 * - Adamas series (separate numbering 1977-2013)
 * - Import models (7+ digits): Korea (Un Sung, World), China (Yoojin), Indonesia
 *
 * Sub-brands:
 * - Applause: Imported from China (budget line)
 * - Celebrity: Korea/China (entry to mid-level)
 * - Ovation: USA and import depending on era
 * - Adamas: Premium USA-made
 */

export function decodeOvation(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Letter prefix series (1968-1981)
  if (/^[A-L]\d{3,6}$/.test(normalized)) {
    return decodeLetterPrefix(normalized);
  }

  // 3-digit series (1966-1967)
  if (/^\d{3}$/.test(normalized)) {
    return decode3Digit(normalized);
  }

  // 4-digit series (1967-1968)
  if (/^\d{4}$/.test(normalized)) {
    return decode4Digit(normalized);
  }

  // 5-digit series (1970-1972) or Adamas
  if (/^\d{5}$/.test(normalized)) {
    return decode5Digit(normalized);
  }

  // 6-digit series (1972-2013) - main USA production
  if (/^\d{6}$/.test(normalized)) {
    return decode6DigitUSA(normalized);
  }

  // 7+ digit series - typically imports
  if (/^\d{7,10}$/.test(normalized)) {
    return decodeImport(normalized);
  }

  // Import with letter prefix (factory codes)
  if (/^[A-Z]{1,2}\d{6,10}$/.test(normalized)) {
    return decodeImportWithPrefix(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Ovation serial number. Common formats include: 6 digits (USA 1972-2013), letter prefix + digits (1968-1981), or 7+ digits (imports). Check the label inside the soundhole for country of origin.',
  };
}

// 3-digit series (1966-1967)
function decode3Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  let year: string;
  let notes: string;

  if (num >= 6 && num <= 319) {
    year = '1966';
    notes = 'Very early Ovation production. Red ink serial, three digits.';
  } else if (num >= 320 && num <= 999) {
    year = '1967 (Feb-Nov)';
    notes = 'Early New Hartford production. Red ink serial.';
  } else {
    year = '1966-1967';
    notes = 'Very early Ovation production.';
  }

  const info: GuitarInfo = {
    brand: 'Ovation',
    serialNumber: serial,
    year: year,
    factory: 'New Hartford, Connecticut',
    country: 'USA',
    notes: `${notes} These early guitars are highly collectible. Serial ${num} indicates one of the first Ovation guitars produced.`,
  };

  return { success: true, info };
}

// 4-digit series (1967-1968)
function decode4Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Ovation',
    serialNumber: serial,
    year: '1967-1968 (Nov 1967 - July 1968)',
    factory: 'New Hartford, Connecticut',
    country: 'USA',
    notes: `4-digit series. Black ink serial. Serial ${num.toLocaleString()} from early New Hartford production.`,
  };

  return { success: true, info };
}

// 5-digit series (1970-1972) or could be Adamas
function decode5Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // Check if it could be Adamas (lower numbers, typically under 25000)
  if (num < 25000) {
    // Could be either 5-digit regular or Adamas
    const adamasResult = checkAdamasRange(num);
    if (adamasResult) {
      return adamasResult;
    }
  }

  // Regular 5-digit series
  if (num >= 10000) {
    const info: GuitarInfo = {
      brand: 'Ovation',
      serialNumber: serial,
      year: '1970-1972 (Feb 1970 - May 1972)',
      factory: 'New Hartford, Connecticut',
      country: 'USA',
      notes: `5-digit series. Serial ${num.toLocaleString()} from early 1970s USA production.`,
    };
    return { success: true, info };
  }

  // Lower 5-digit numbers - likely Adamas
  const adamasResult = checkAdamasRange(num);
  if (adamasResult) {
    return adamasResult;
  }

  const info: GuitarInfo = {
    brand: 'Ovation',
    serialNumber: serial,
    year: 'Check Ovation records',
    factory: 'New Hartford, Connecticut (likely)',
    country: 'USA',
    notes: `5-digit serial number. Could be early 1970s production or Adamas series. Check the label inside the soundhole for model information.`,
  };

  return { success: true, info };
}

// Check Adamas serial number ranges
function checkAdamasRange(num: number): DecodeResult | null {
  // Adamas serial number ranges by year
  const adamasRanges: Array<{ min: number; max: number; year: string }> = [
    { min: 77, max: 99, year: '1977 (Sept+)' },
    { min: 100, max: 608, year: '1978' },
    { min: 609, max: 1453, year: '1979' },
    { min: 1454, max: 2324, year: '1980' },
    { min: 2325, max: 3057, year: '1981' },
    { min: 3058, max: 3814, year: '1982' },
    { min: 3815, max: 4171, year: '1983' },
    { min: 4172, max: 4380, year: '1984' },
    { min: 4381, max: 4512, year: '1985' },
    { min: 4513, max: 4650, year: '1986' },
    { min: 4651, max: 4791, year: '1987' },
    { min: 4792, max: 4867, year: '1988' },
    { min: 4868, max: 4974, year: '1989' },
    { min: 4975, max: 5541, year: '1990' },
    { min: 5542, max: 6278, year: '1991' },
    { min: 6279, max: 7088, year: '1992' },
    { min: 7089, max: 8159, year: '1993' },
    { min: 8160, max: 9778, year: '1994' },
    { min: 9779, max: 11213, year: '1995' },
    { min: 11214, max: 12680, year: '1996' },
    { min: 12681, max: 14300, year: '1997' },
    { min: 14301, max: 16000, year: '1998' },
    { min: 16001, max: 17500, year: '1999' },
    { min: 17501, max: 19000, year: '2000' },
    { min: 19001, max: 20500, year: '2001-2005' },
    { min: 20501, max: 23845, year: '2006-2013' },
  ];

  for (const range of adamasRanges) {
    if (num >= range.min && num <= range.max) {
      const info: GuitarInfo = {
        brand: 'Ovation Adamas',
        serialNumber: num.toString(),
        year: range.year,
        factory: 'New Hartford, Connecticut',
        country: 'USA',
        notes: `Adamas series serial number. The Adamas line represents Ovation's premium USA-made guitars, featuring carbon fiber tops and advanced construction. Serial ${num} falls within the ${range.year} production range.`,
      };
      return { success: true, info };
    }
  }

  return null;
}

// 6-digit series (1972-2013) - main USA production
function decode6DigitUSA(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // USA 6-digit serial number ranges
  const usaRanges: Array<{ min: number; max: number; year: string }> = [
    { min: 1, max: 7000, year: '1972 (May-Dec)' },
    { min: 7001, max: 20000, year: '1973' },
    { min: 20001, max: 39000, year: '1974' },
    { min: 39001, max: 67000, year: '1975' },
    { min: 67001, max: 86000, year: '1976' },
    { min: 86001, max: 103000, year: '1977 (Jan-Sept)' },
    { min: 103001, max: 126000, year: '1977-1978 (Sept 1977 - April 1978)' },
    { min: 126001, max: 157000, year: '1978 (April-Dec)' },
    { min: 157001, max: 203000, year: '1979' },
    { min: 211011, max: 214933, year: '1980' },
    { min: 214934, max: 263633, year: '1981' },
    { min: 263634, max: 291456, year: '1982' },
    { min: 291457, max: 302669, year: '1983' },
    { min: 302670, max: 313600, year: '1984' },
    { min: 313601, max: 330000, year: '1985' },
    { min: 330001, max: 355000, year: '1986' },
    { min: 355001, max: 380000, year: '1987' },
    { min: 380001, max: 405000, year: '1988' },
    { min: 405001, max: 425000, year: '1989' },
    { min: 425001, max: 454000, year: '1990' },
    { min: 454001, max: 470000, year: '1991' },
    { min: 470001, max: 475000, year: '1992' },
    { min: 475001, max: 480000, year: '1993' },
    { min: 480001, max: 484400, year: '1994' },
    { min: 484401, max: 501470, year: '1995' },
    { min: 501471, max: 520000, year: '1996' },
    { min: 520001, max: 540000, year: '1997' },
    { min: 540001, max: 560000, year: '1998' },
    { min: 560001, max: 575000, year: '1999' },
    { min: 575001, max: 590000, year: '2000' },
    { min: 590001, max: 600000, year: '2001-2005' },
    { min: 600001, max: 615000, year: '2006-2010' },
    { min: 615001, max: 622539, year: '2011-2013' },
  ];

  for (const range of usaRanges) {
    if (num >= range.min && num <= range.max) {
      const info: GuitarInfo = {
        brand: 'Ovation',
        serialNumber: serial,
        year: range.year,
        factory: 'New Hartford, Connecticut',
        country: 'USA',
        notes: `USA-made Ovation. 6-digit serial ${num.toLocaleString()} falls within the ${range.year} production range. New Hartford was Ovation's primary USA factory until 2014.`,
      };
      return { success: true, info };
    }
  }

  // Check for gap (1979-1980 transition)
  if (num > 203000 && num < 211011) {
    const info: GuitarInfo = {
      brand: 'Ovation',
      serialNumber: serial,
      year: '1979-1980 (transition period)',
      factory: 'New Hartford, Connecticut',
      country: 'USA',
      notes: `Serial ${num.toLocaleString()} falls in a gap between documented ranges (203000-211011). This is likely from the 1979-1980 transition period. USA-made at New Hartford.`,
    };
    return { success: true, info };
  }

  // Serial out of known range
  const info: GuitarInfo = {
    brand: 'Ovation',
    serialNumber: serial,
    year: 'Check Ovation records',
    factory: 'New Hartford, Connecticut (likely)',
    country: 'USA (likely)',
    notes: `6-digit serial number ${num.toLocaleString()} is outside documented ranges. This could be USA production not in the standard database. Check the label inside the soundhole for confirmation.`,
  };

  return { success: true, info };
}

// Letter prefix series (1968-1981)
function decodeLetterPrefix(serial: string): DecodeResult {
  const prefix = serial.charAt(0);
  const digits = serial.substring(1);
  const num = parseInt(digits, 10);

  const prefixYears: Record<string, { year: string; notes: string }> = {
    'A': { year: '1968 (July-Nov)', notes: 'A prefix, 3 digits' },
    'B': { year: '1968-1979', notes: 'B prefix. 3 digits = 1968-1969, 5 digits = 1974-1979 (Magnum solidbody basses)' },
    'C': { year: '1969 (Feb-Sept)', notes: 'C prefix, 3 digits' },
    'D': { year: '1969-1970 (Sept 1969 - Feb 1970)', notes: 'D prefix, 3 digits' },
    'E': { year: '1973-1981', notes: 'E prefix. 4 digits = 1973-1975, 5 digits = 1975-1980, 6 digits = 1980-1981 (solidbodies and UK IIs)' },
    'F': { year: '1968-1970', notes: 'F prefix series' },
    'G': { year: '1969-1971', notes: 'G prefix series' },
    'H': { year: '1970-1972', notes: 'H prefix series' },
    'I': { year: '1971-1972', notes: 'I prefix series' },
    'J': { year: '1972-1973', notes: 'J prefix series' },
    'K': { year: '1972-1973', notes: 'K prefix series' },
    'L': { year: '1973', notes: 'L prefix series' },
  };

  const prefixInfo = prefixYears[prefix] || { year: 'Late 1960s - early 1970s', notes: 'Letter prefix series' };

  const info: GuitarInfo = {
    brand: 'Ovation',
    serialNumber: serial,
    year: prefixInfo.year,
    factory: 'New Hartford, Connecticut',
    country: 'USA',
    notes: `${prefixInfo.notes}. Serial ${prefix}${num.toLocaleString()} from USA production.`,
  };

  return { success: true, info };
}

// Import models (7+ digits without prefix)
function decodeImport(serial: string): DecodeResult {
  // Try to extract year from first 2 digits if they look like a year
  const firstTwo = serial.substring(0, 2);
  const yearNum = parseInt(firstTwo, 10);

  let yearGuess = 'Unknown';
  if (yearNum >= 0 && yearNum <= 25) {
    yearGuess = `Possibly 20${firstTwo.padStart(2, '0')}`;
  } else if (yearNum >= 90 && yearNum <= 99) {
    yearGuess = `Possibly 19${firstTwo}`;
  }

  const info: GuitarInfo = {
    brand: 'Ovation / Celebrity / Applause',
    serialNumber: serial,
    year: yearGuess,
    factory: 'Korea or China',
    country: 'Import (check label)',
    notes: `7+ digit serial number indicates an import model. Could be Celebrity (Korea/China), Applause (China), or import Ovation. Check the label inside the soundhole for country of origin. Import serial numbers are less standardized than USA production.`,
  };

  return { success: true, info };
}

// Import with letter prefix (factory codes)
function decodeImportWithPrefix(serial: string): DecodeResult {
  // Extract prefix and digits
  let prefix: string;
  let digits: string;

  if (/^[A-Z]{2}\d/.test(serial)) {
    prefix = serial.substring(0, 2);
    digits = serial.substring(2);
  } else {
    prefix = serial.charAt(0);
    digits = serial.substring(1);
  }

  // Known factory prefixes
  const factoryPrefixes: Record<string, { factory: string; country: string }> = {
    'US': { factory: 'Un Sung', country: 'South Korea' },
    'E': { factory: 'World', country: 'South Korea' },
    'Y': { factory: 'Yoojin', country: 'China' },
  };

  const factoryInfo = factoryPrefixes[prefix] || { factory: 'Unknown', country: 'Import (Korea/China)' };

  // Try to extract year/month from digits
  let yearMonth = '';
  if (digits.length >= 4) {
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);

    if (yearNum >= 0 && yearNum <= 25 && monthNum >= 1 && monthNum <= 12) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      yearMonth = `20${yearDigits.padStart(2, '0')}, ${months[monthNum - 1]}`;
    }
  }

  const info: GuitarInfo = {
    brand: 'Ovation / Celebrity / Applause',
    serialNumber: serial,
    year: yearMonth || 'Check label',
    factory: factoryInfo.factory,
    country: factoryInfo.country,
    notes: `Import model with "${prefix}" prefix indicating ${factoryInfo.factory} factory in ${factoryInfo.country}. ${yearMonth ? `Estimated date: ${yearMonth}.` : ''} Check the label inside the soundhole for exact country and model information.`,
  };

  return { success: true, info };
}
