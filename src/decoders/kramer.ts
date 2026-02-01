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

  // Two-letter overseas prefixes (e.g., FA, FB)
  if (/^[A-Z]{2}\d+$/.test(normalized)) {
    const prefix = normalized.substring(0, 2);
    const yearRange = getOverseasYearRange(prefix);
    const info: GuitarInfo = {
      brand: 'Kramer',
      serialNumber: cleaned,
      year: yearRange,
      notes: `Overseas model prefix ${prefix}. The second letter often indicates the production year range, but verification with features is recommended.`,
    };
    return { success: true, info };
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
  if (prefix === 'FA') return 'late 1985–1986';
  if (prefix === 'FB') return '1987–1988';
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
