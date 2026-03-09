import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Kramer Guitar Serial Number Decoder
 *
 * Kramer serials are inconsistent across eras, so this decoder focuses on
 * broad ranges and common prefix patterns.
 */
export function decodeKramer(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  if (!normalized) {
    return {
      success: false,
      error: 'Please enter a serial number.',
    };
  }

  // Letter prefix A-F (early USA era)
  if (/^[A-F]\d+$/.test(normalized)) {
    const prefix = normalized.charAt(0);
    const yearRange = getPrefixYearRange(prefix);
    const info: GuitarInfo = {
      brand: 'Kramer',
      serialNumber: cleaned,
      year: yearRange,
      notes: `${prefix}-prefix serial. These generally indicate early Kramer production periods and should be cross-referenced with headstock and neck-plate details for accuracy.`,
    };
    return { success: true, info };
  }

  // V-prefix vintage/import plates (often Vanguard/Voyager-era, non-chronological)
  if (/^V\d{4,6}$/.test(normalized)) {
    const sequence = normalized.substring(1);
    const info: GuitarInfo = {
      brand: 'Kramer',
      serialNumber: cleaned,
      year: 'mid-to-late 1980s (estimated)',
      notes: `V-prefix plate serial. These are commonly seen on 1980s import-era Kramer runs (often Vanguard/Voyager-associated), but plate numbers were not always chronological. Sequence: ${sequence}. Confirm era with headstock shape, logo style, and neck-plate markings.`,
    };
    return { success: true, info };
  }

  // Two-letter overseas prefixes (e.g., FA, FB, CF)
  if (/^[A-Z]{2}\d+$/.test(normalized)) {
    const prefix = normalized.substring(0, 2);
    const yearRange = getOverseasYearRange(prefix);
    const country = getOverseasCountry(prefix);
    const info: GuitarInfo = {
      brand: 'Kramer',
      serialNumber: cleaned,
      year: yearRange,
      country,
      notes:
        prefix === 'CF'
          ? `Overseas model prefix ${prefix}. This prefix is commonly associated with Japan-built Focus/Striker-era instruments from the mid-to-late 1980s (often around 1985-1989). Verify with headstock shape, neck-plate details, and hardware.`
          : `Overseas model prefix ${prefix}. The second letter often indicates the production year range, but verification with features is recommended.`,
    };
    return { success: true, info };
  }

  // Modern Samick import pattern: S + YYMM + sequence (8-9 digits after S)
  if (/^S\d{8,9}$/.test(normalized)) {
    return decodeModernSamickS(normalized, cleaned);
  }

  // S / SS prefixes on some overseas Striker-era plates (format often SS-YYMM-RR)
  if (/^S{1,2}\d{6,8}$/.test(normalized)) {
    const prefixMatch = normalized.match(/^S{1,2}/);
    const prefix = prefixMatch ? prefixMatch[0] : 'S';
    const remainder = normalized.substring(prefix.length);
    const yearPart = remainder.substring(0, 2);
    const monthPart = remainder.substring(2, 4);
    const yearValue = parseInt(yearPart, 10);
    const monthValue = parseInt(monthPart, 10);
    const fullYear = Number.isNaN(yearValue) ? undefined : `20${yearPart}`;
    const monthName = getMonthName(monthValue);
    const yearDisplay =
      fullYear && monthName ? `${monthName} ${fullYear}` : fullYear;
    const sequence = remainder.length > 4 ? remainder.substring(4) : undefined;

    const info: GuitarInfo = {
      brand: 'Kramer',
      serialNumber: cleaned,
      year: yearDisplay,
      notes: `${prefix}-prefix serial often appears on overseas models (including some Strikers). Interpreted as ${prefix}-YYMM-RR${sequence ? ` with sequence ${sequence}` : ''}. Confirm with country-of-origin markings and hardware details.`,
    };
    return { success: true, info };
  }

  // Musicyo reissue style (e.g., 04xxxx)
  if (/^\d{5,}$/.test(normalized)) {
    const yearPrefix = normalized.substring(0, 2);
    const yearValue = parseInt(yearPrefix, 10);

    if (!Number.isNaN(yearValue) && yearValue <= 24) {
      const info: GuitarInfo = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: `20${yearPrefix}`,
        notes: 'Numeric serials with a two-digit year prefix often indicate Musicyo-era reissues (early 2000s). Confirm with model features and hardware details.',
      };
      return { success: true, info };
    }

    const info: GuitarInfo = {
      brand: 'Kramer',
      serialNumber: cleaned,
      notes: 'Numeric-only serials are common on some USA-era instruments and do not always encode the date. Use the Vintage Kramer registry and feature checks for accurate dating.',
    };
    return { success: true, info };
  }

  return {
    success: false,
    error: 'Unable to decode this Kramer serial number. Kramer serials vary by era, and many vintage records were lost. Try the Vintage Kramer registry or HTPG serial search for additional context.',
  };
}

function decodeModernSamickS(normalized: string, cleaned: string): DecodeResult {
  const yearPart = normalized.substring(1, 3);
  const monthPart = normalized.substring(3, 5);
  let sequence = normalized.substring(5);

  const yearValue = parseInt(yearPart, 10);
  let monthValue = parseInt(monthPart, 10);
  const fullYear = Number.isNaN(yearValue) ? undefined : 2000 + yearValue;
  let monthName = getMonthName(monthValue);

  // Some S-prefix runs appear to use a single month digit after YY
  // (e.g., S106020848 => YY=10, M=6, sequence=020848).
  if (!monthName) {
    const singleMonthDigit = parseInt(normalized.charAt(3), 10);
    const singleMonthName = getMonthName(singleMonthDigit);
    if (singleMonthName) {
      monthValue = singleMonthDigit;
      monthName = singleMonthName;
      sequence = normalized.substring(4);
    }
  }

  const info: GuitarInfo = {
    brand: 'Kramer',
    serialNumber: cleaned,
    year: fullYear ? fullYear.toString() : undefined,
    month: monthName,
    factory: 'Samick',
    country: 'South Korea',
    notes: `Modern S-prefix import format interpreted as S + YYMM + sequence${monthPart && !getMonthName(parseInt(monthPart, 10)) && monthName ? ' (single-digit month fallback applied as S + YY + M + sequence)' : ''}. Sequence: ${sequence}. S prefix is commonly associated with Samick Korea on Gibson-era imports; confirm with country-of-origin stamp for certainty.`,
  };

  return { success: true, info };
}

function getPrefixYearRange(prefix: string): string {
  switch (prefix) {
    case 'A':
      return '1980–early 1981';
    case 'B':
      return 'early 1981–early 1983';
    default:
      return 'mid-1980s (approx.)';
  }
}

function getOverseasYearRange(prefix: string): string | undefined {
  if (prefix === 'CF') return '1985-1989 (estimated)';
  if (prefix === 'FA') return 'late 1985–1986';
  if (prefix === 'FB') return '1987–1988';
  return undefined;
}

function getOverseasCountry(prefix: string): string | undefined {
  if (prefix === 'CF') return 'Japan';
  return undefined;
}

function getMonthName(monthValue: number): string | undefined {
  switch (monthValue) {
    case 1:
      return 'January';
    case 2:
      return 'February';
    case 3:
      return 'March';
    case 4:
      return 'April';
    case 5:
      return 'May';
    case 6:
      return 'June';
    case 7:
      return 'July';
    case 8:
      return 'August';
    case 9:
      return 'September';
    case 10:
      return 'October';
    case 11:
      return 'November';
    case 12:
      return 'December';
    default:
      return undefined;
  }
}
