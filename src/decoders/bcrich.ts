import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * B.C. Rich Guitar Serial Number Decoder
 *
 * Supported formats (based on published B.C. Rich serial number guides and NJ series references):
 * - USA neck-through: 5-digit YYXXX format (year + production sequence)
 * - Class Axe era: B0XXX / BXXXXX / BCXXXXX (year not encoded)
 * - Import pre-2000: F7XXXXX/F8XXXXX/F9XXXXX/F0XXXXX (year in second digit)
 * - Date-stamp numeric: 8 digits like 121XXXXX (year digit + quarter + production)
 * - Month/factory code: A08140023 (month letter + factory + year + production)
 * - NJ Series: R/P + 6 digits with year in first two digits
 */

const MONTH_CODE_MAP: Record<string, string> = {
  A: 'January',
  C: 'February',
  E: 'March',
  F: 'April',
  G: 'May',
  H: 'June',
  J: 'July',
  K: 'August',
  L: 'September',
  M: 'October',
  N: 'November',
  P: 'December',
};

const FACTORY_MAP: Record<string, { name: string; country: string }> = {
  '00': { name: 'Fine China', country: 'China' },
  '01': { name: 'Sejung China', country: 'China' },
  '02': { name: 'HW China', country: 'China' },
  '03': { name: 'Great China', country: 'China' },
  '04': { name: 'Daewon China', country: 'China' },
  '05': { name: 'Taiki China', country: 'China' },
  '06': { name: 'Orient China', country: 'China' },
  '07': { name: 'Huakai China', country: 'China' },
  '08': { name: 'World Korea', country: 'South Korea' },
  '09': { name: 'Fine Korea', country: 'South Korea' },
  '10': { name: 'SW Korea', country: 'South Korea' },
};

export function decodeBCRich(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  if (/^[ACEFGHJKLMNP][0-9]{8}$/.test(normalized)) {
    return decodeMonthFactory(normalized);
  }

  if (/^F[7890]\d{5}$/.test(normalized)) {
    return decodeFSeries(normalized);
  }

  if (/^BO\d{3}$/.test(normalized)) {
    return decodeBoltOn2000(normalized);
  }

  if (/^\d{8}$/.test(normalized)) {
    return decodeDateStampNumeric(normalized);
  }

  if (/^[RP]\d{6}$/.test(normalized)) {
    return decodeNJSeries(normalized);
  }

  if (/^BC\d{5}$/.test(normalized)) {
    return decodeClassAxeBC(normalized);
  }

  if (/^B\d{3,5}$/.test(normalized)) {
    return decodeClassAxeB(normalized);
  }

  if (/^\d{5}$/.test(normalized)) {
    return decodeUSA5Digit(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this B.C. Rich serial number. Known formats include: 5-digit USA neck-through (YYXXX), F7/F8/F9/F0 import serials, 8-digit date-stamp (e.g., 121XXXXX), month/factory codes like A08140023, NJ series R/P + 6 digits, or Class Axe BC/B0 series.',
  };
}

function decodeMonthFactory(serial: string): DecodeResult {
  const monthCode = serial[0];
  const factoryCode = serial.slice(1, 3);
  const yearCode = serial.slice(3, 5);
  const production = serial.slice(5);

  const month = MONTH_CODE_MAP[monthCode];
  const yearValue = 2000 + parseInt(yearCode, 10);
  const factoryInfo = FACTORY_MAP[factoryCode];
  const factoryLabel = factoryInfo ? factoryInfo.name : `Factory ${factoryCode}`;
  const country = factoryInfo ? factoryInfo.country : 'Unknown';
  const factoryNote = factoryInfo
    ? ''
    : ` Factory code ${factoryCode} is not listed in B.C. Rich's published factory list (00–10).`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: yearValue.toString(),
    month: month,
    factory: factoryLabel,
    country,
    notes: `Month/factory code format. Production sequence: ${production}.${factoryNote}`,
  };

  return { success: true, info };
}

function decodeFSeries(serial: string): DecodeResult {
  const yearDigit = serial[1];
  const yearMap: Record<string, string> = {
    '7': '1997',
    '8': '1998',
    '9': '1999',
    '0': '2000',
  };
  const year = yearMap[yearDigit] || 'Unknown';

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    notes: 'Import serial format used before November 2000. The second digit indicates the year (7=1997, 8=1998, 9=1999, 0=2000).',
  };

  return { success: true, info };
}

function decodeBoltOn2000(serial: string): DecodeResult {
  const production = serial.slice(2);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '2000',
    notes: `B0/BO bolt-on format introduced in 2000. Production sequence: ${production}.`,
  };

  return { success: true, info };
}

function decodeDateStampNumeric(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const quarterDigit = parseInt(serial[2], 10);
  const production = serial.slice(3);

  const year = 2000 + yearDigit;
  const quarter = quarterDigit >= 1 && quarterDigit <= 4 ? `Q${quarterDigit}` : undefined;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    notes: `Date-stamp format used for imports and USA handmades (2001-era). Second digit is a placeholder; third digit is the quarter${quarter ? ` (${quarter})` : ''}. Production sequence: ${production}.`,
  };

  return { success: true, info };
}

function decodeUSA5Digit(serial: string): DecodeResult {
  const yearDigits = serial.slice(0, 2);
  const sequence = serial.slice(2);
  const yearNum = parseInt(yearDigits, 10);
  const year = yearNum >= 70 ? `19${yearDigits}` : `20${yearDigits.padStart(2, '0')}`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    factory: 'USA (neck-through)',
    country: 'United States',
    notes: `5-digit USA neck-through format (YYXXX). Production sequence: ${sequence}. Note: early/mid-1980s serials can be out of sequence, so treat the year as an estimate.`,
  };

  return { success: true, info };
}

function decodeClassAxeBC(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    notes: 'BC-prefixed bolt-on/Class Axe era serial (1989–1993). These generally do not encode a reliable year.',
  };

  return { success: true, info };
}

function decodeClassAxeB(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    notes: 'B-prefixed Class Axe/NJ-era serials can be hard to date. These typically do not encode a reliable year.',
  };

  return { success: true, info };
}

function decodeNJSeries(serial: string): DecodeResult {
  const yearDigits = serial.slice(1, 3);
  const sequence = serial.slice(3);
  const yearNum = parseInt(yearDigits, 10);
  const year = `19${yearDigits}`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: yearNum >= 70 ? year : year,
    notes: `Likely NJ Series serial (R/P prefix). The first two digits often indicate the year. Production sequence: ${sequence}. NJ Series production spans Japan and later Korea, so confirm with headstock markings.`,
  };

  return { success: true, info };
}
