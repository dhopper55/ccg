import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Godin Guitar Serial Number Decoder
 *
 * Supports all Godin family brands:
 * - Godin (electric and hybrid acoustic-electric)
 * - Seagull (acoustic)
 * - Norman (acoustic)
 * - Simon & Patrick (acoustic)
 * - Art & Lutherie (budget acoustic)
 * - La Patrie (classical/nylon)
 *
 * Serial number formats by era:
 * - Pre-1987: 6 digits or less, not decodable
 * - 1987-1991: 4-digit sequential
 * - 1992-1993: 5-digit transitional
 * - 1990s: 7-digit (Y + sequential)
 * - 1993-2007: 8-digit YYWWDRRR (most decodable)
 * - 2007-2022: 12-digit SKU-based
 * - 2023+: 8-digit YYWWDRRR (returned format)
 *
 * Factory locations:
 * - La Patrie, Quebec: Necks, bodies, acoustic assembly
 * - Richmond, Quebec: Godin electric assembly, TRIC cases
 * - Princeville, Quebec: Wooden parts, Art & Lutherie assembly
 * - Berlin, New Hampshire: Electric guitar assembly (USA)
 *
 * Note: Godin's production year runs August 1 - July 31 (fiscal year)
 */

export function decodeGodin(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Handle B prefix (Norman 1980-1988)
  if (/^B\d+$/.test(normalized)) {
    return decodeNormanBPrefix(normalized);
  }

  // Handle F prefix (Factory second)
  if (/^F\d+$/.test(normalized)) {
    const digits = normalized.substring(1);
    // Recursively decode the number portion, then mark as factory second
    const result = decodeGodin(digits);
    if (result.success && result.info) {
      result.info.notes = `FACTORY SECOND (F prefix). ${result.info.notes}`;
    }
    return result;
  }

  // 12-digit format: SKU-based (2007-2022)
  if (/^\d{12}$/.test(normalized)) {
    return decode12Digit(normalized);
  }

  // 8-digit format: YYWWDRRR (1993-2007, 2023+)
  if (/^\d{8}$/.test(normalized)) {
    return decode8Digit(normalized);
  }

  // 7-digit format: Y + sequential (1990s)
  if (/^\d{7}$/.test(normalized)) {
    return decode7Digit(normalized);
  }

  // 5-digit format: Transitional (1992-1993)
  if (/^\d{5}$/.test(normalized)) {
    return decode5Digit(normalized);
  }

  // 4-digit format: Sequential (1987-1991)
  if (/^\d{4}$/.test(normalized)) {
    return decode4Digit(normalized);
  }

  // 6 digits or less: Pre-1987 (not decodable)
  if (/^\d{1,6}$/.test(normalized)) {
    return decodePreModern(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Godin serial number. Common formats include: 8 digits (YYWWDRRR for 1993-2007 and 2023+), 12 digits (SKU-based 2007-2022), or 4-7 digits (older sequential). For undecodable serials, contact info@godinguitars.com. This decoder works for all Godin family brands: Godin, Seagull, Norman, Simon & Patrick, Art & Lutherie, and La Patrie.',
  };
}

// Norman B prefix (1980-1988)
function decodeNormanBPrefix(serial: string): DecodeResult {
  const digits = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'Norman (Godin)',
    serialNumber: serial,
    year: '1980-1988',
    factory: 'La Patrie, Quebec',
    country: 'Canada',
    notes: `Norman guitar with "B" prefix indicates production between 1980-1988. Serial: ${digits}. Norman is a Godin family brand. For exact dating, contact info@godinguitars.com.`,
  };

  return { success: true, info };
}

// 12-digit format: SKU-based (2007-2022)
function decode12Digit(serial: string): DecodeResult {
  const sku = serial.substring(0, 6);
  const factorySecond = serial.charAt(6);
  const productionCount = serial.substring(7);

  const isSecond = factorySecond === '9';

  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: '2007-2022 (12-digit era)',
    factory: 'Quebec, Canada (various) or Berlin, NH',
    country: 'Canada (or USA assembly)',
    notes: `12-digit SKU-based format (late 2007-2022). SKU: ${sku} (check godinguitars.com or brand website to identify model). ${isSecond ? 'FACTORY SECOND (digit 7 = 9).' : 'Standard production (digit 7 = 0).'} This is the ${parseInt(productionCount, 10).toLocaleString()}${getOrdinalSuffix(parseInt(productionCount, 10))} unit of this model since 2007. No production date encoded in this format.`,
  };

  return { success: true, info };
}

// 8-digit format: YYWWDRRR (1993-2007, 2023+)
function decode8Digit(serial: string): DecodeResult {
  const yearCode = parseInt(serial.substring(0, 2), 10);
  const weekCode = parseInt(serial.substring(2, 4), 10);
  const dayCode = parseInt(serial.charAt(4), 10);
  const rankCode = serial.substring(5);

  // Validate week (1-52)
  if (weekCode < 1 || weekCode > 52) {
    return decodeNumericFallback(serial);
  }

  // Validate day (1-7)
  if (dayCode < 1 || dayCode > 7) {
    return decodeNumericFallback(serial);
  }

  // Godin fiscal year: August 1 - July 31
  // Week 1 = first week of August
  // So year code 06 means Aug 2005 - Jul 2006 production year

  // Calculate approximate calendar date
  const fiscalYearEnd = 2000 + yearCode; // e.g., 06 = 2006 fiscal year (ends July 2006)
  const fiscalYearStart = fiscalYearEnd - 1; // Starts August of previous year

  // Approximate month based on week
  // Week 1 = August, Week 5 = September, Week 9 = October, etc.
  const monthOffset = Math.floor((weekCode - 1) / 4.33);
  const months = [
    'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
  ];
  const month = months[Math.min(monthOffset, 11)];

  // Determine if in first or second half of fiscal year
  const calendarYear = monthOffset < 5 ? fiscalYearStart : fiscalYearEnd;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayName = days[dayCode - 1];

  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: calendarYear.toString(),
    month: month,
    factory: 'Quebec, Canada (various) or Berlin, NH',
    country: 'Canada (or USA assembly)',
    notes: `8-digit format (YYWWDRRR). Fiscal year ${yearCode} (Aug ${fiscalYearStart} - Jul ${fiscalYearEnd}), Week ${weekCode}, ${dayName}. Production rank: ${parseInt(rankCode, 10)}${getOrdinalSuffix(parseInt(rankCode, 10))} guitar that week. Approximate date: ${month} ${calendarYear}. Note: Godin uses fiscal years (Aug-Jul), so "year 06" means production during Aug 2005-Jul 2006.`,
  };

  return { success: true, info };
}

// 7-digit format: Y + sequential (1990s)
function decode7Digit(serial: string): DecodeResult {
  const yearDigit = parseInt(serial.charAt(0), 10);
  const sequence = serial.substring(1);

  // Year digit 1-9 = 1991-1999
  let year: string;
  if (yearDigit >= 1 && yearDigit <= 9) {
    year = `199${yearDigit}`;
  } else {
    year = '1990s';
  }

  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: year,
    factory: 'Quebec, Canada',
    country: 'Canada',
    notes: `7-digit format (1990s). First digit "${yearDigit}" indicates year ${year}. Remaining digits (${sequence}) are sequential production number. Some sources indicate this may also encode week and day information.`,
  };

  return { success: true, info };
}

// 5-digit format: Transitional (1992-1993)
function decode5Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: '1992-1993 (estimated)',
    factory: 'Quebec, Canada',
    country: 'Canada',
    notes: `5-digit transitional format. Serial number ${num.toLocaleString()} falls in the 1992-1993 production range. This was a transitional period between the 4-digit sequential and the 7-digit formats. For exact dating, contact info@godinguitars.com.`,
  };

  return { success: true, info };
}

// 4-digit format: Sequential (1987-1991)
function decode4Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // Approximate year based on known data points
  let yearEstimate: string;
  if (num < 3000) {
    yearEstimate = '1987-1989';
  } else if (num < 5500) {
    yearEstimate = '1990';
  } else if (num < 10000) {
    yearEstimate = '1991';
  } else {
    yearEstimate = '1987-1991';
  }

  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: yearEstimate,
    factory: 'Quebec, Canada',
    country: 'Canada',
    notes: `4-digit sequential format (1987-1991). Serial ${num.toLocaleString()} estimates to approximately ${yearEstimate}. Location: Stamped on soundhole label. For exact dating, contact info@godinguitars.com.`,
  };

  return { success: true, info };
}

// Pre-1987 format (not decodable)
function decodePreModern(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: 'Pre-1987 (contact Godin)',
    factory: 'Quebec, Canada',
    country: 'Canada',
    notes: `Short serial number format predates the modern encoding system. This guitar was likely made before 1987. For exact dating, contact Godin directly at info@godinguitars.com. Check inside the guitar for additional date stamps on the neck heel or braces.`,
  };

  return { success: true, info };
}

// Fallback for numeric serials that don't match expected patterns
function decodeNumericFallback(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Godin/Seagull/Norman/S&P/A&L/La Patrie',
    serialNumber: serial,
    year: 'Check with Godin',
    factory: 'Quebec, Canada (various) or Berlin, NH',
    country: 'Canada (or USA assembly)',
    notes: `This serial number format could not be definitively decoded. For accurate dating, contact Godin directly at info@godinguitars.com. Also check the neck heel inside the guitar for additional date stamps.`,
  };

  return { success: true, info };
}

// Helper: Get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
