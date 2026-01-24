import { Brand } from '../types.js';

export interface BrandDetectionResult {
  possibleBrands: Brand[];
  confident: boolean;
  message?: string;
}

/**
 * Attempts to detect the guitar brand from the serial number format.
 * Returns possible brands and whether we're confident in a single match.
 */
export function detectBrand(serial: string): BrandDetectionResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  const possibleBrands: Brand[] = [];

  // Check Fender patterns (most distinctive due to letter prefixes)
  if (isFenderPattern(normalized)) {
    possibleBrands.push('fender');
  }

  // Check Epiphone patterns (letter prefixes for factories)
  if (isEpiphonePattern(normalized)) {
    possibleBrands.push('epiphone');
  }

  // Check Gibson patterns (specific digit formats)
  if (isGibsonPattern(normalized)) {
    possibleBrands.push('gibson');
  }

  // Check Taylor patterns (specific digit formats with date encoding)
  if (isTaylorPattern(normalized)) {
    possibleBrands.push('taylor');
  }

  // Check Martin patterns (pure numeric, sequential)
  if (isMartinPattern(normalized)) {
    possibleBrands.push('martin');
  }

  // Determine confidence
  if (possibleBrands.length === 1) {
    return {
      possibleBrands,
      confident: true
    };
  } else if (possibleBrands.length === 0) {
    return {
      possibleBrands,
      confident: false,
      message: 'Unable to identify the brand from this serial number format. Please select a brand manually.'
    };
  } else {
    return {
      possibleBrands,
      confident: false,
      message: `This serial number could belong to: ${possibleBrands.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', ')}. Please select the correct brand.`
    };
  }
}

function isFenderPattern(serial: string): boolean {
  // US prefix (2010+)
  if (/^US\d{8,}$/.test(serial)) return true;

  // DZ prefix (American Deluxe 2000s)
  if (/^DZ\d+$/.test(serial)) return true;

  // Z prefix (2000s USA)
  if (/^Z\d+$/.test(serial)) return true;

  // N prefix (1990s) - Note: could overlap with other brands but N+digit is distinctive
  if (/^N\d{5,}$/.test(serial)) return true;

  // E prefix (1980s) - distinctive for Fender
  if (/^E\d{5,}$/.test(serial)) return true;

  // S prefix (1970s)
  if (/^S\d{5,}$/.test(serial)) return true;

  // Mexican prefixes (very distinctive)
  if (/^MX\d+$/.test(serial)) return true;
  if (/^MZ\d+$/.test(serial)) return true;
  if (/^MN\d+$/.test(serial)) return true;

  // Japanese prefixes
  if (/^JFF[A-Z]\d+$/.test(serial)) return true;
  if (/^JV\d+$/.test(serial)) return true;
  if (/^J\d+$/.test(serial)) return true;

  // V prefix (AVRI)
  if (/^V\d{5,}$/.test(serial)) return true;

  // Korean/Indonesian
  if (/^K[O]?\d+$/.test(serial)) return true;
  if (/^I[CS]?\d+$/.test(serial)) return true;

  return false;
}

function isEpiphonePattern(serial: string): boolean {
  // Two letter factory codes + 8+ digits (very common modern format)
  // Factory codes: SI, CI, EA, EE, ED, DW, MR, etc.
  if (/^(SI|CI|EA|EE|ED|DW|MR|MC)\d{8,}$/.test(serial)) return true;

  // Single letter Korean/Chinese factory codes + digits
  // I, U, S, P, R, K, F, C, Z followed by 7+ digits
  if (/^[IUSPRKCFZ]\d{7,}$/.test(serial)) return true;

  // F-serial format (Les Paul Standards)
  if (/^F\d{6,}$/.test(serial)) return true;

  // Numeric factory format: YYMMFF### to YYMMFF###### (9-12 digits)
  // Check if positions 5-6 could be a valid factory code (11-23 range)
  // e.g., 0807230809 = July 2008, factory 23, #809
  if (/^\d{9,12}$/.test(serial)) {
    const month = parseInt(serial.substring(2, 4), 10);
    const factoryCode = serial.substring(4, 6);
    const validFactoryCodes = ['11', '12', '15', '16', '17', '20', '21', '23'];
    if (month >= 1 && month <= 12 && validFactoryCodes.includes(factoryCode)) return true;
  }

  return false;
}

function isGibsonPattern(serial: string): boolean {
  // 8-digit format (1977-2005): YDDDYRRR
  // The key is that positions 1,5 form the year and 2-4 form day of year (001-366)
  if (/^\d{8}$/.test(serial)) {
    const dayOfYear = parseInt(serial.substring(1, 4), 10);
    if (dayOfYear >= 1 && dayOfYear <= 366) {
      return true;
    }
  }

  // 9-digit format (2005+): YDDDYBRRR
  if (/^\d{9}$/.test(serial)) {
    const dayOfYear = parseInt(serial.substring(1, 4), 10);
    if (dayOfYear >= 1 && dayOfYear <= 366) {
      return true;
    }
  }

  // 6-digit format (1970s)
  if (/^\d{6}$/.test(serial)) {
    return true;
  }

  return false;
}

function isTaylorPattern(serial: string): boolean {
  // 10-digit format (2009+): Factory + Year1 + Month + Day + Year2 + Sequence
  if (/^\d{10}$/.test(serial)) {
    const factory = serial[0];
    const month = parseInt(serial.substring(2, 4), 10);
    const day = parseInt(serial.substring(4, 6), 10);

    // Factory should be 1 or 2, month 1-12, day 1-31
    if ((factory === '1' || factory === '2') && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return true;
    }
  }

  // 11-digit format (2000-2009): YYYY + MM + DD + Series + Seq
  if (/^\d{11}$/.test(serial)) {
    const year = parseInt(serial.substring(0, 4), 10);
    const month = parseInt(serial.substring(4, 6), 10);
    const day = parseInt(serial.substring(6, 8), 10);

    if (year >= 2000 && year <= 2009 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return true;
    }
  }

  // 9-digit format (1993-1999): YY + MM + DD + Series + Seq
  if (/^\d{9}$/.test(serial)) {
    const year = parseInt(serial.substring(0, 2), 10);
    const month = parseInt(serial.substring(2, 4), 10);
    const day = parseInt(serial.substring(4, 6), 10);

    if (year >= 93 && year <= 99 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return true;
    }
  }

  return false;
}

function isMartinPattern(serial: string): boolean {
  // Martin uses pure sequential numeric serials
  // Range is roughly 8000+ (starting 1898) to ~3,000,000+ (current)
  if (/^\d+$/.test(serial)) {
    const num = parseInt(serial, 10);
    // Martin serials are typically 4-7 digits
    if (serial.length >= 4 && serial.length <= 7 && num >= 8000) {
      return true;
    }
  }

  return false;
}
