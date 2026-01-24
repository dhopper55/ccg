import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeFender(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // US prefix (2010+): US + 2 digit year + sequence
  const usMatch = normalized.match(/^US(\d{2})(\d+)$/);
  if (usMatch) {
    return decodeUSPrefix(usMatch[1], usMatch[2], normalized);
  }

  // DZ prefix (American Deluxe 2000s)
  const dzMatch = normalized.match(/^DZ(\d)(\d+)$/);
  if (dzMatch) {
    return decodeDZPrefix(dzMatch[1], dzMatch[2], normalized);
  }

  // Z prefix (2000s)
  const zMatch = normalized.match(/^Z(\d)(\d+)$/);
  if (zMatch) {
    return decodeZPrefix(zMatch[1], zMatch[2], normalized);
  }

  // N prefix (1990s)
  const nMatch = normalized.match(/^N(\d)(\d+)$/);
  if (nMatch) {
    return decodeNPrefix(nMatch[1], nMatch[2], normalized);
  }

  // E prefix (1980s)
  const eMatch = normalized.match(/^E(\d)(\d+)$/);
  if (eMatch) {
    return decodeEPrefix(eMatch[1], eMatch[2], normalized);
  }

  // S prefix (1970s)
  const sMatch = normalized.match(/^S(\d)(\d+)$/);
  if (sMatch) {
    return decodeSPrefix(sMatch[1], sMatch[2], normalized);
  }

  // Mexican formats
  // MX prefix (2010+)
  const mxMatch = normalized.match(/^MX(\d{2})(\d+)$/);
  if (mxMatch) {
    return decodeMXPrefix(mxMatch[1], mxMatch[2], normalized);
  }

  // MZ prefix (2000s Mexico)
  const mzMatch = normalized.match(/^MZ(\d)(\d+)$/);
  if (mzMatch) {
    return decodeMZPrefix(mzMatch[1], mzMatch[2], normalized);
  }

  // MN prefix (1990s Mexico)
  const mnMatch = normalized.match(/^MN(\d)(\d+)$/);
  if (mnMatch) {
    return decodeMNPrefix(mnMatch[1], mnMatch[2], normalized);
  }

  // Japanese formats
  // JFF prefix (2019+ Japan "Superstrats" and modern production)
  // Format: JFF + letter (month/factory) + 2-digit year + sequence
  const jffMatch = normalized.match(/^JFF([A-Z])(\d{2})(\d+)$/);
  if (jffMatch) {
    return decodeJFFPrefix(jffMatch[1], jffMatch[2], jffMatch[3], normalized);
  }

  // JV prefix (early 1980s Japan)
  const jvMatch = normalized.match(/^JV(\d+)$/);
  if (jvMatch) {
    return decodeJVPrefix(jvMatch[1], normalized);
  }

  // Single J prefix (Japan)
  const jMatch = normalized.match(/^J(\d+)$/);
  if (jMatch) {
    return decodeJPrefix(jMatch[1], normalized);
  }

  // A, B, C, etc prefixes for Japan (CIJ era)
  const japanLetterMatch = normalized.match(/^([A-H])(\d+)$/);
  if (japanLetterMatch) {
    return decodeJapanLetterPrefix(japanLetterMatch[1], japanLetterMatch[2], normalized);
  }

  // V prefix (American Vintage Reissue)
  const vMatch = normalized.match(/^V(\d+)$/);
  if (vMatch) {
    return decodeVPrefix(vMatch[1], normalized);
  }

  // Korean formats (KO prefix or just K)
  const koMatch = normalized.match(/^K[O]?(\d+)$/);
  if (koMatch) {
    return decodeKoreanPrefix(koMatch[1], normalized);
  }

  // Indonesian formats (IC, ICS prefixes)
  const indoMatch = normalized.match(/^I[CS]?(\d{2})(\d+)$/);
  if (indoMatch) {
    return decodeIndonesianPrefix(indoMatch[1], indoMatch[2], normalized);
  }

  // Vintage 5-6 digit serials (pre-1976)
  if (/^\d{5,6}$/.test(normalized)) {
    return decodeVintageFender(normalized);
  }

  // 4 digit serials (very early)
  if (/^\d{4}$/.test(normalized)) {
    return decodeEarlyVintage(normalized);
  }

  return {
    success: false,
    error: 'Unrecognized Fender serial number format. Fender serials typically start with a letter prefix (US, MX, S, E, N, Z, J, etc.) followed by digits.'
  };
}

function decodeUSPrefix(year: string, sequence: string, serial: string): DecodeResult {
  const fullYear = '20' + year;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'Corona, California',
    country: 'USA',
    notes: `US prefix indicates American-made Fender (2010 or later). Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeDZPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '200' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Corona, California',
    country: 'USA',
    model: 'American Deluxe Series',
    notes: `DZ prefix indicates American Deluxe Series from the 2000s. Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeZPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '200' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Corona, California',
    country: 'USA',
    notes: `Z prefix indicates USA production (2000-2009). Typically American Standard or regular production models. Sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeNPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '199' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Corona, California',
    country: 'USA',
    notes: `N prefix indicates USA production (1990s). Production sequence: ${sequence}. Note: Some Japanese Fenders also used N prefix - check for "Made in Japan" marking.`
  };

  return { success: true, info };
}

function decodeEPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '198' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Corona, California (or Fullerton pre-1985)',
    country: 'USA',
    notes: `E prefix indicates USA production (1980s). Production sequence: ${sequence}. Note: Some Japanese Fenders also used E prefix - check for country of origin marking.`
  };

  return { success: true, info };
}

function decodeSPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '197' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Fullerton, California',
    country: 'USA',
    notes: `S prefix indicates USA production (late 1970s). Production sequence: ${sequence}. This was during the CBS ownership era.`
  };

  return { success: true, info };
}

function decodeMXPrefix(year: string, sequence: string, serial: string): DecodeResult {
  const fullYear = '20' + year;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'Ensenada',
    country: 'Mexico',
    notes: `MX prefix indicates Mexican production (2010 or later). Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeMZPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '200' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Ensenada',
    country: 'Mexico',
    notes: `MZ prefix indicates Mexican production (2000s). Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeMNPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '199' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Ensenada',
    country: 'Mexico',
    notes: `MN prefix indicates Mexican production (1990s). Mexico production began in 1990. Sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeJFFPrefix(letter: string, year: string, sequence: string, serial: string): DecodeResult {
  const fullYear = '20' + year;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'Japan',
    country: 'Japan',
    notes: `JFF prefix was adopted by Fender Japan starting in 2019 for specific modern production lines, often referred to as "Superstrats". The fourth letter "${letter}" may indicate the month of production or specific factory within the Japanese manufacturing network. Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeJVPrefix(sequence: string, serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: '1982-1984',
    factory: 'FujiGen Gakki',
    country: 'Japan',
    notes: `JV prefix indicates early Japanese production (1982-1984). These were high-quality instruments made at FujiGen. Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeJPrefix(sequence: string, serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: '1980s',
    factory: 'FujiGen Gakki',
    country: 'Japan',
    notes: `J prefix indicates Japanese production from the 1980s. Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeJapanLetterPrefix(letter: string, sequence: string, serial: string): DecodeResult {
  // Japanese letter prefixes used in different eras
  const letterYears: Record<string, string> = {
    'A': '1985-1986, or 1997-1998 (CIJ)',
    'B': '1985-1986, or 1997-1998 (CIJ)',
    'C': '1985-1986, or 1997-1998 (CIJ)',
    'D': '1986 (MIJ)',
    'E': '1984-1987 (MIJ)',
    'F': '1986-1987 (MIJ)',
    'G': '1987-1988 (MIJ)',
    'H': '1988-1989 (MIJ)',
  };

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: letterYears[letter] || 'Mid-1980s to 1990s',
    factory: 'FujiGen Gakki or other Japanese factory',
    country: 'Japan',
    notes: `Letter prefix ${letter} was used on Japanese Fenders. Check for "Made in Japan" (MIJ) or "Crafted in Japan" (CIJ) labels to narrow the date. Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeVPrefix(sequence: string, serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: 'Various (AVRI series)',
    factory: 'Corona, California',
    country: 'USA',
    model: 'American Vintage Reissue (AVRI)',
    notes: `V prefix indicates American Vintage Reissue series. These serials do not directly correlate to production year. Other features or date stamps should be checked for accurate dating. Sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeKoreanPrefix(sequence: string, serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: '1980s-1990s (approximate)',
    factory: 'Korean Factory (Cort, Samick, or other)',
    country: 'South Korea',
    notes: `Korean-made Fender (Squier or budget models). Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeIndonesianPrefix(year: string, sequence: string, serial: string): DecodeResult {
  const fullYear = '20' + year;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'Indonesian Factory (Cort or other)',
    country: 'Indonesia',
    notes: `Indonesian-made Fender (typically Squier line). Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeVintageFender(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  let year = 'Pre-1976';
  let notes = '';

  // Rough serial ranges for vintage Fenders
  if (num < 10000) {
    year = '1950-1954';
    notes = 'Early Fender production. These serials were on the bridge plate or neck plate.';
  } else if (num < 20000) {
    year = '1954-1956';
    notes = 'Mid-1950s production.';
  } else if (num < 50000) {
    year = '1956-1959';
    notes = 'Late 1950s production.';
  } else if (num < 100000) {
    year = '1959-1963';
    notes = 'Early 1960s production. The golden era of Fender.';
  } else if (num < 200000) {
    year = '1963-1965';
    notes = 'Pre-CBS era (CBS acquired Fender in January 1965).';
  } else if (num < 300000) {
    year = '1965-1969';
    notes = 'Early CBS era.';
  } else if (num < 400000) {
    year = '1969-1972';
    notes = 'CBS era production.';
  } else if (num < 600000) {
    year = '1972-1976';
    notes = 'CBS era. Serial numbering became less consistent during this period.';
  } else {
    year = '1970s';
    notes = 'Later CBS era. Consider checking neck date stamps for more accuracy.';
  }

  notes += ' Vintage Fender dating can be complex - neck dates, pot codes, and other features should be checked for verification.';

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Fullerton, California',
    country: 'USA',
    notes
  };

  return { success: true, info };
}

function decodeEarlyVintage(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: '1950-1954 (approximate)',
    factory: 'Fullerton, California',
    country: 'USA',
    notes: 'Very early Fender production. Four-digit serials were used on the earliest Fender guitars. Dating requires examination of other features like pickups, hardware, and construction details.'
  };

  return { success: true, info };
}
