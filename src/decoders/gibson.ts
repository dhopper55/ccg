import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeGibson(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();

  // Remove any spaces or dashes
  const normalized = cleaned.replace(/[\s-]/g, '');

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
