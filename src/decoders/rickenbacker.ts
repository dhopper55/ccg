import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Rickenbacker Guitar Serial Number Decoder
 *
 * All Rickenbacker guitars and basses are made in the USA at Santa Ana, California.
 *
 * Supports:
 * - 1954-1959: Solidbody format (Model + Type + Year + Sequence)
 * - 1958-1960: Hollowbody format (Pickup count + Tailpiece + Sequence)
 * - 1961-1986: Two-letter code (YearLetter + MonthLetter + Sequence)
 * - 1987-1996: Reversed format (MonthLetter + YearDigit + Sequence)
 * - 1997-1998: Transitional format (MonthLetter M-X + YearDigit 0-1 + Sequence)
 * - 1999-Present: Modern format (YY + WW + NNN)
 *
 * Note: Pre-1954 serial numbers are not reliably datable.
 */

export function decodeRickenbacker(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Modern format (1999-present): YYWWNNN (7-8 digits)
  if (/^\d{7,8}$/.test(normalized)) {
    return decodeModern(normalized);
  }

  // Two-letter format (1961-1986): Letter + Letter + digits
  if (/^[A-Z]{2}\d{2,4}$/.test(normalized)) {
    return decodeTwoLetter(normalized);
  }

  // Reversed format (1987-1996): Letter + Digit + digits
  if (/^[A-L][0-9]\d{2,4}$/.test(normalized)) {
    return decodeReversed(normalized);
  }

  // Transitional format (1997-1998): Letter (M-X) + Digit (0-1) + digits
  if (/^[M-X][01]\d{2,4}$/.test(normalized)) {
    return decodeTransitional(normalized);
  }

  // Early solidbody format (1954-1959): Model + Letter + Year + Sequence
  if (/^(4|6|65|8|85)[CBMV][4-9]\d{2,4}$/.test(normalized)) {
    return decodeEarlySolidbody(normalized);
  }

  // Short scale format (1954-1959): V + Year + Sequence
  if (/^V[4-9]\d{2,4}$/.test(normalized)) {
    return decodeShortScale(normalized);
  }

  // Hollowbody format (1958-1960): Pickup count + Tailpiece + Sequence
  if (/^[23][TVR]\d{2,4}$/.test(normalized)) {
    return decodeHollowbody(normalized);
  }

  // CM prefix (1961)
  if (/^CM\d{2,5}$/.test(normalized)) {
    return decodeCM(normalized);
  }

  // Sequence only (could be 1959-1960 gap period)
  if (/^\d{3,5}$/.test(normalized)) {
    return decodeSequenceOnly(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Rickenbacker serial number. Common formats include: 7-8 digits (1999-present), two letters + digits (1961-1986), letter + digit + digits (1987-1998). All Rickenbacker guitars are made in Santa Ana, California, USA.',
  };
}

// Modern format (1999-present): YYWWNNN
function decodeModern(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const weekDigits = serial.substring(2, 4);
  const sequence = serial.substring(4);

  const yearNum = parseInt(yearDigits, 10);
  const weekNum = parseInt(weekDigits, 10);

  // Validate week (1-52)
  if (weekNum < 1 || weekNum > 52) {
    return {
      success: false,
      error: `Invalid week number ${weekNum} in serial. Weeks should be 01-52.`,
    };
  }

  // Determine full year (1999-2098)
  const year = yearNum >= 99 ? 1900 + yearNum : 2000 + yearNum;

  // Calculate approximate month from week
  const monthIndex = Math.floor((weekNum - 1) / 4.33);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = months[Math.min(monthIndex, 11)];

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: year.toString(),
    month: month,
    factory: 'Santa Ana, California',
    country: 'USA',
    notes: `Modern format (1999-present). Year: ${year}, Week: ${weekNum} (approximately ${month}). Production sequence: ${parseInt(sequence, 10)}. All Rickenbacker instruments are handcrafted in Santa Ana, California.`,
  };

  return { success: true, info };
}

// Two-letter format (1961-1986): YearLetter + MonthLetter + Sequence
function decodeTwoLetter(serial: string): DecodeResult {
  const yearLetter = serial.charAt(0);
  const monthLetter = serial.charAt(1);
  const sequence = serial.substring(2);

  // Year codes A=1961 through Z=1986 (J can also mean 1960 Nov-Dec)
  const yearCodes: Record<string, number> = {
    'A': 1961, 'B': 1962, 'C': 1963, 'D': 1964, 'E': 1965,
    'F': 1966, 'G': 1967, 'H': 1968, 'I': 1969, 'J': 1970,
    'K': 1971, 'L': 1972, 'M': 1973, 'N': 1974, 'O': 1975,
    'P': 1976, 'Q': 1977, 'R': 1978, 'S': 1979, 'T': 1980,
    'U': 1981, 'V': 1982, 'W': 1983, 'X': 1984, 'Y': 1985,
    'Z': 1986,
  };

  // Month codes A=January through L=December
  const monthCodes: Record<string, string> = {
    'A': 'January', 'B': 'February', 'C': 'March', 'D': 'April',
    'E': 'May', 'F': 'June', 'G': 'July', 'H': 'August',
    'I': 'September', 'J': 'October', 'K': 'November', 'L': 'December',
  };

  const year = yearCodes[yearLetter];
  const month = monthCodes[monthLetter];

  if (!year || !month) {
    return {
      success: false,
      error: `Unable to decode letters "${yearLetter}${monthLetter}". Year letter should be A-Z (1961-1986), month letter A-L (Jan-Dec).`,
    };
  }

  // Special case: J can mean 1960 (Nov-Dec experimental) or 1970
  let yearNote = year.toString();
  if (yearLetter === 'J') {
    yearNote = '1960 (Nov-Dec) or 1970';
  }

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: yearNote,
    month: month,
    factory: 'Santa Ana, California',
    country: 'USA',
    notes: `Two-letter format (1961-1986). Year letter "${yearLetter}" = ${yearNote}. Month letter "${monthLetter}" = ${month}. Sequence: ${parseInt(sequence, 10)}.${yearLetter === 'J' ? ' Note: "J" can indicate either Nov-Dec 1960 (experimental) or 1970. Check physical features to determine exact year.' : ''}`,
  };

  return { success: true, info };
}

// Reversed format (1987-1996): MonthLetter + YearDigit + Sequence
function decodeReversed(serial: string): DecodeResult {
  const monthLetter = serial.charAt(0);
  const yearDigit = serial.charAt(1);
  const sequence = serial.substring(2);

  // Month codes A=January through L=December
  const monthCodes: Record<string, string> = {
    'A': 'January', 'B': 'February', 'C': 'March', 'D': 'April',
    'E': 'May', 'F': 'June', 'G': 'July', 'H': 'August',
    'I': 'September', 'J': 'October', 'K': 'November', 'L': 'December',
  };

  // Year codes 0=1987 through 9=1996
  const yearCodes: Record<string, number> = {
    '0': 1987, '1': 1988, '2': 1989, '3': 1990, '4': 1991,
    '5': 1992, '6': 1993, '7': 1994, '8': 1995, '9': 1996,
  };

  const month = monthCodes[monthLetter];
  const year = yearCodes[yearDigit];

  if (!month || !year) {
    return {
      success: false,
      error: `Unable to decode "${monthLetter}${yearDigit}". Month letter should be A-L (Jan-Dec), year digit 0-9 (1987-1996).`,
    };
  }

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: year.toString(),
    month: month,
    factory: 'Santa Ana, California',
    country: 'USA',
    notes: `Reversed format (1987-1996). Month letter "${monthLetter}" = ${month}. Year digit "${yearDigit}" = ${year}. Sequence: ${parseInt(sequence, 10)}.`,
  };

  return { success: true, info };
}

// Transitional format (1997-1998): MonthLetter (M-X) + YearDigit (0-1) + Sequence
function decodeTransitional(serial: string): DecodeResult {
  const monthLetter = serial.charAt(0);
  const yearDigit = serial.charAt(1);
  const sequence = serial.substring(2);

  // Month codes M-X (O skipped)
  const monthCodes: Record<string, string> = {
    'M': 'January', 'N': 'February', 'P': 'March', 'Q': 'April',
    'R': 'May', 'S': 'July', 'T': 'August', 'U': 'September',
    'V': 'October', 'W': 'November', 'X': 'December',
  };

  // Year codes 0=1997, 1=1998
  const yearCodes: Record<string, number> = {
    '0': 1997, '1': 1998,
  };

  const month = monthCodes[monthLetter];
  const year = yearCodes[yearDigit];

  if (!month || !year) {
    return {
      success: false,
      error: `Unable to decode "${monthLetter}${yearDigit}". For 1997-1998, month letters are M-X (O skipped), year digit 0-1.`,
    };
  }

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: year.toString(),
    month: month,
    factory: 'Santa Ana, California',
    country: 'USA',
    notes: `Transitional format (1997-1998). Month letter "${monthLetter}" = ${month}. Year digit "${yearDigit}" = ${year}. Sequence: ${parseInt(sequence, 10)}. Note: Letter "O" was skipped to avoid confusion with digit "0".`,
  };

  return { success: true, info };
}

// Early solidbody format (1954-1959): Model + Type + Year + Sequence
function decodeEarlySolidbody(serial: string): DecodeResult {
  // Parse model prefix
  let model: string;
  let remaining: string;

  if (serial.startsWith('65') || serial.startsWith('85')) {
    model = serial.substring(0, 2) + '0 series';
    remaining = serial.substring(2);
  } else {
    model = serial.charAt(0) + '00 series';
    remaining = serial.substring(1);
  }

  const typeLetter = remaining.charAt(0);
  const yearDigit = remaining.charAt(1);
  const sequence = remaining.substring(2);

  // Type codes
  const typeCodes: Record<string, string> = {
    'C': 'Combo (guitar)',
    'B': 'Bass',
    'M': 'Mandolin',
    'V': '3/4 size guitar',
  };

  const typeDesc = typeCodes[typeLetter] || 'Unknown type';
  const year = 1950 + parseInt(yearDigit, 10);

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: year.toString(),
    model: model,
    factory: 'Los Angeles, California',
    country: 'USA',
    notes: `Early solidbody format (1954-1959). Model: ${model}. Type: ${typeDesc} (${typeLetter}). Year: ${year} (digit ${yearDigit}). Sequence: ${parseInt(sequence, 10)}. Made at the original Electro String factory in Los Angeles.`,
  };

  return { success: true, info };
}

// Short scale format (1954-1959): V + Year + Sequence
function decodeShortScale(serial: string): DecodeResult {
  const yearDigit = serial.charAt(1);
  const sequence = serial.substring(2);
  const year = 1950 + parseInt(yearDigit, 10);

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: year.toString(),
    model: '900/950/1000 series (short scale/student)',
    factory: 'Los Angeles, California',
    country: 'USA',
    notes: `Short scale/student format (1954-1959). "V" prefix indicates 900, 950, or 1000 series. Year: ${year} (digit ${yearDigit}). Sequence: ${parseInt(sequence, 10)}. Made at the original Electro String factory in Los Angeles.`,
  };

  return { success: true, info };
}

// Hollowbody format (1958-1960): Pickup count + Tailpiece + Sequence
function decodeHollowbody(serial: string): DecodeResult {
  const pickups = serial.charAt(0);
  const tailpiece = serial.charAt(1);
  const sequence = serial.substring(2);

  const tailpieceCodes: Record<string, string> = {
    'T': 'Standard trapeze tailpiece (non-vibrato)',
    'V': 'Vibrato tailpiece',
    'R': 'Rick-O-Sound stereo output',
  };

  const tailpieceDesc = tailpieceCodes[tailpiece] || 'Unknown tailpiece';

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: '1958-1960 (check features)',
    model: `${pickups}-pickup hollowbody/semi-hollow`,
    factory: 'Los Angeles, California',
    country: 'USA',
    notes: `Hollowbody format (1958-1960). ${pickups} pickups. Tailpiece: ${tailpieceDesc} (${tailpiece}). Sequence: ${parseInt(sequence, 10)}. This format does NOT encode the exact year - dating requires examination of physical features. Rick-O-Sound (R) appeared around July 1960.`,
  };

  return { success: true, info };
}

// CM prefix (1961)
function decodeCM(serial: string): DecodeResult {
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: '1961',
    factory: 'Los Angeles, California',
    country: 'USA',
    notes: `CM prefix indicates 1961 manufacturing. Sequence: ${parseInt(sequence, 10)}. This was a transitional period between the early numbering systems and the two-letter code system.`,
  };

  return { success: true, info };
}

// Sequence only (could be 1959-1960 gap period)
function decodeSequenceOnly(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Rickenbacker',
    serialNumber: serial,
    year: '1959-1960 (dating gap)',
    factory: 'Los Angeles/Santa Ana, California',
    country: 'USA',
    notes: `Sequential serial number only (${num.toLocaleString()}). During September 1959 through October 1960, Rickenbacker used only production sequence numbers without date encoding. Dating requires examination of physical features. Production moved from Los Angeles to Santa Ana in 1964.`,
  };

  return { success: true, info };
}
