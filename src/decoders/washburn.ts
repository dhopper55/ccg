import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Washburn Guitar Serial Number Decoder
 *
 * Supports:
 * - Modern letter prefix format: F + YYMMRRRR (factory + year + month + sequence)
 * - Korean Samick: S prefix
 * - Indonesian Samick: SI prefix
 * - Indonesian generic: I prefix
 * - Chinese production: G prefix
 * - Cort production: C prefix
 * - 1980s-1990s numeric formats
 * - Short serial numbers (4-5 digits) from 1970s-1980s
 *
 * Note: Pre-1978 guitars have no reliable serial number system.
 * Washburn has used many formats over the years (4-12 characters).
 */

export function decodeWashburn(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Samick Indonesia: SI prefix
  if (/^SI\d{7,9}$/.test(normalized)) {
    return decodeSamickIndonesia(normalized);
  }

  // Samick Korea: S prefix followed by digits
  if (/^S\d{7,9}$/.test(normalized)) {
    return decodeSamickKorea(normalized);
  }

  // Indonesian: I prefix (non-SI)
  if (/^I\d{7,9}$/.test(normalized)) {
    return decodeIndonesia(normalized);
  }

  // Chinese: G prefix
  if (/^G\d{7,9}$/.test(normalized)) {
    return decodeChina(normalized);
  }

  // Cort: C prefix
  if (/^C\d{7,9}$/.test(normalized)) {
    return decodeCort(normalized);
  }

  // Yako: Y prefix
  if (/^Y\d{7,9}$/.test(normalized)) {
    return decodeYako(normalized);
  }

  // Zaozhuang Saehan: Z prefix (China)
  if (/^Z\d{7,9}$/.test(normalized)) {
    return decodeZaozhuang(normalized);
  }

  // Two-letter prefix format (e.g., OC, SC, N + digits)
  if (/^[A-Z]{1,2}\d{8,10}$/.test(normalized)) {
    return decodeLetterPrefix(normalized);
  }

  // Modern numeric: 8+ digits starting with year
  if (/^\d{8,12}$/.test(normalized)) {
    return decodeModernNumeric(normalized);
  }

  // 7-digit format (1990s)
  if (/^\d{7}$/.test(normalized)) {
    return decode7Digit(normalized);
  }

  // 6-digit format (1980s-1990s)
  if (/^\d{6}$/.test(normalized)) {
    return decode6Digit(normalized);
  }

  // Short 4-5 digit format (1970s-early 1980s)
  if (/^\d{4,5}$/.test(normalized)) {
    return decodeShort(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Washburn serial number. The format was not recognized. Washburn has used many serial number formats over the years (4-12 characters). Common formats include: letter prefix + digits (S, SI, I, G, C), or numeric formats where the first 1-2 digits indicate the year. For pre-1978 instruments, no reliable serial number records exist.',
  };
}

// Samick Indonesia: SI prefix
function decodeSamickIndonesia(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Samick Indonesia (Cileungsi)',
    country: 'Indonesia',
    notes: `SI prefix indicates Samick Indonesia production (Cileungsi facility, opened 1992). Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Samick Korea: S prefix
function decodeSamickKorea(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Samick Korea',
    country: 'South Korea',
    notes: `S prefix indicates Samick Korea production. By 1991, most Washburn production had shifted to Korea. Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Indonesian: I prefix
function decodeIndonesia(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Indonesia',
    country: 'Indonesia',
    notes: `I prefix indicates Indonesian production. Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Chinese: G prefix
function decodeChina(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'China',
    country: 'China',
    notes: `G prefix indicates Chinese production. As of 2017, primary production shifted from Korea to Indonesia and China. Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Cort: C prefix
function decodeCort(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Cort',
    country: 'South Korea',
    notes: `C prefix indicates Cort factory production. Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Yako: Y prefix
function decodeYako(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Yako',
    country: 'China',
    notes: `Y prefix indicates Yako factory production in China. Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Zaozhuang Saehan: Z prefix (China)
function decodeZaozhuang(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseYearMonthSequence(digits);

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Zaozhuang Saehan',
    country: 'China',
    notes: `Z prefix indicates Zaozhuang Saehan factory production in China (Shandong province). Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Two-letter prefix format
function decodeLetterPrefix(serial: string): DecodeResult {
  // Extract prefix and digits
  const match = serial.match(/^([A-Z]{1,2})(\d+)$/);
  if (!match) {
    return { success: false, error: 'Invalid letter prefix format.' };
  }

  const prefix = match[1];
  const digits = match[2];
  const { year, month, sequence } = parseYearMonthSequence(digits);

  // Try to identify factory from prefix
  let factory = 'Unknown factory';
  let country = 'Unknown';
  let notes = '';

  // Known prefixes
  switch (prefix) {
    case 'N':
      factory = 'Unknown factory';
      country = 'Asia';
      notes = 'N prefix - exact factory unknown.';
      break;
    case 'OC':
      factory = 'Unknown factory';
      country = 'Asia';
      notes = 'OC prefix - exact factory unknown.';
      break;
    case 'SC':
      factory = 'Unknown factory';
      country = 'Asia';
      notes = 'SC prefix - exact factory unknown.';
      break;
    case 'R':
      factory = 'Peerless Korea';
      country = 'South Korea';
      notes = 'R prefix indicates Peerless factory in Korea.';
      break;
    default:
      notes = `${prefix} prefix - factory identification uncertain.`;
  }

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: factory,
    country: country,
    notes: `${notes} Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Modern numeric format (8+ digits)
function decodeModernNumeric(serial: string): DecodeResult {
  const length = serial.length;

  // For 8-9 digit serials, first 2 digits are typically year
  if (length === 8 || length === 9) {
    const yearDigits = serial.substring(0, 2);
    const yearNum = parseInt(yearDigits, 10);

    let year: string;
    if (yearNum >= 70 && yearNum <= 99) {
      year = `19${yearDigits}`;
    } else if (yearNum >= 0 && yearNum <= 30) {
      year = `20${yearDigits.padStart(2, '0')}`;
    } else {
      year = `Possibly 19${yearDigits} or 20${yearDigits}`;
    }

    const remaining = serial.substring(2);
    let month: string | undefined;

    // Check if next 2 digits could be month
    if (remaining.length >= 2) {
      const monthNum = parseInt(remaining.substring(0, 2), 10);
      if (monthNum >= 1 && monthNum <= 12) {
        month = getMonthName(monthNum);
      }
    }

    const info: GuitarInfo = {
      brand: 'Washburn',
      serialNumber: serial,
      year: year,
      month: month,
      factory: 'Various (Korea, Indonesia, or China)',
      country: 'Asia',
      notes: `Numeric serial number format. First two digits (${yearDigits}) typically indicate year of manufacture. Production location requires additional identification from the instrument.`,
    };

    return { success: true, info };
  }

  // For 10+ digit serials (post-2010), first 4 digits may be YYMM
  if (length >= 10) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);

    let year: string;
    if (yearNum >= 10 && yearNum <= 30) {
      year = `20${yearDigits}`;
    } else {
      year = `20${yearDigits}`;
    }

    let month: string | undefined;
    if (monthNum >= 1 && monthNum <= 12) {
      month = getMonthName(monthNum);
    }

    const sequence = serial.substring(4);

    const info: GuitarInfo = {
      brand: 'Washburn',
      serialNumber: serial,
      year: year,
      month: month,
      factory: 'Various',
      country: 'Asia',
      notes: `Post-2010 format. First four digits (${yearDigits}${monthDigits}) typically indicate year and month of manufacture. Sequence: ${sequence}.`,
    };

    return { success: true, info };
  }

  return {
    success: false,
    error: 'Unable to interpret this numeric serial number format.',
  };
}

// 7-digit format (1990s)
function decode7Digit(serial: string): DecodeResult {
  // First digit or first two digits could be year
  const firstTwo = serial.substring(0, 2);
  const yearNum = parseInt(firstTwo, 10);

  let year: string;
  let monthDigits: string;
  let sequence: string;

  if (yearNum >= 80 && yearNum <= 99) {
    // Two-digit year (80-99 = 1980-1999)
    year = `19${firstTwo}`;
    monthDigits = serial.substring(2, 4);
    sequence = serial.substring(4);
  } else {
    // Single-digit year (0-9 = 1990-1999)
    const singleYear = parseInt(serial.substring(0, 1), 10);
    year = `199${singleYear}`;
    monthDigits = serial.substring(1, 3);
    sequence = serial.substring(3);
  }

  const monthNum = parseInt(monthDigits, 10);
  let month: string | undefined;
  if (monthNum >= 1 && monthNum <= 12) {
    month = getMonthName(monthNum);
  }

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Samick Korea or similar',
    country: 'South Korea',
    notes: `7-digit format typical of 1990s Korean production. Sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// 6-digit format (1980s-1990s)
function decode6Digit(serial: string): DecodeResult {
  const firstTwo = serial.substring(0, 2);
  const yearNum = parseInt(firstTwo, 10);

  let year: string;
  if (yearNum >= 80 && yearNum <= 99) {
    year = `19${firstTwo}`;
  } else if (yearNum >= 0 && yearNum <= 30) {
    year = `Possibly 19${firstTwo} or 20${firstTwo}`;
  } else {
    year = `Unknown (first digits: ${firstTwo})`;
  }

  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: year,
    factory: 'Various',
    country: 'Japan, Korea, or USA',
    notes: `6-digit serial number. For 1980s instruments, the first two digits (${firstTwo}) typically indicate year of manufacture. Production location may be Japan (1970s-1980s), Korea (1980s+), or USA Custom Shop. Check the headstock label or body sticker for "Made in" location.`,
  };

  return { success: true, info };
}

// Short 4-5 digit format (1970s-early 1980s)
function decodeShort(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Washburn',
    serialNumber: serial,
    year: '1970s-early 1980s',
    factory: 'Various (likely Japan)',
    country: 'Japan',
    notes: `Short ${serial.length}-digit serial numbers are typically from the 1970s-early 1980s when Washburn instruments were made in Japan. Pre-1978 instruments have no reliable serial number records - Washburn recommends checking their guitar archives and period catalogs for identification.`,
  };

  return { success: true, info };
}

// Helper: Parse year, month, sequence from digit string
function parseYearMonthSequence(digits: string): { year: string; month?: string; sequence: string } {
  if (digits.length < 4) {
    return { year: 'Unknown', sequence: digits };
  }

  const firstTwo = digits.substring(0, 2);
  const yearNum = parseInt(firstTwo, 10);

  let year: string;
  if (yearNum >= 70 && yearNum <= 99) {
    year = `19${firstTwo}`;
  } else if (yearNum >= 0 && yearNum <= 30) {
    year = `20${firstTwo.padStart(2, '0')}`;
  } else {
    year = `19${firstTwo}`;
  }

  let month: string | undefined;
  let sequence: string;

  if (digits.length >= 4) {
    const monthPart = digits.substring(2, 4);
    const monthNum = parseInt(monthPart, 10);

    if (monthNum >= 1 && monthNum <= 12) {
      month = getMonthName(monthNum);
      sequence = digits.substring(4);
    } else {
      // Check if it's a letter-based month (A=Jan, B=Feb, etc.)
      const letterMonth = digits.charAt(2);
      if (/^[A-L]$/.test(letterMonth)) {
        month = getMonthName(letterMonth.charCodeAt(0) - 64);
        sequence = digits.substring(3);
      } else {
        sequence = digits.substring(2);
      }
    }
  } else {
    sequence = digits.substring(2);
  }

  return { year, month, sequence };
}

// Helper function for month names
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}
