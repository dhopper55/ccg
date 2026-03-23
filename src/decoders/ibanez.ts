import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeIbanez(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Known model-code fallback (not a serial number)
  if (normalized === 'SR305EDX' || normalized === 'GRG170DX') {
    return decodeKnownModelCode(normalized);
  }

  // Check for compound serial numbers with model prefix + actual serial
  // Format: Model code (e.g., 2Y03, 5B01) followed by standard serial (GS..., PW..., etc.)
  const compoundMatch = normalized.match(/^([A-Z0-9]{4,8})(GS\d{9})$/);
  if (compoundMatch) {
    const modelCode = compoundMatch[1];
    const actualSerial = compoundMatch[2];
    const result = decodeChinaGS(actualSerial);
    if (result.success && result.info) {
      result.info.notes = `Model code: ${modelCode}. ${result.info.notes}`;
    }
    return result;
  }

  const compoundMatchPW = normalized.match(/^([A-Z0-9]{4,8})(PW\d{8,9})$/);
  if (compoundMatchPW) {
    const modelCode = compoundMatchPW[1];
    const actualSerial = compoundMatchPW[2];
    const result = decodePW(actualSerial);
    if (result.success && result.info) {
      result.info.notes = `Model code: ${modelCode}. ${result.info.notes}`;
    }
    return result;
  }

  // Try each format in order of specificity

  // Japan: F + 7 digits (1997-present, FujiGen)
  if (/^F\d{7}$/.test(normalized)) {
    return decodeFujiGenModern(normalized);
  }

  // Japan: FD + 7 digits (FujiGen variant)
  if (/^FD\d{7}$/.test(normalized)) {
    return decodeFujiGenFD(normalized);
  }

  // Japan: Letter (A-L) + 6 digits (1975-1988, month-year format)
  // Disambiguate from 1987-1996 F/H/I factory code format.
  const monthYearMatch = normalized.match(/^([A-L])(\d{2})\d{4}$/);
  if (monthYearMatch) {
    const monthLetter = monthYearMatch[1];
    const yearDigits = parseInt(monthYearMatch[2], 10);
    const isFactoryCode = monthLetter === 'F' || monthLetter === 'H' || monthLetter === 'I';
    if (!isFactoryCode || yearDigits <= 86) {
      return decodeJapan1975to1988(normalized);
    }
  }

  // Japan: Letter (A-L) + 8 digits (extended 1975-1988 month-year format)
  const monthYearExtendedMatch = normalized.match(/^([A-L])(\d{2})\d{6}$/);
  if (monthYearExtendedMatch) {
    const monthLetter = monthYearExtendedMatch[1];
    const yearDigits = parseInt(monthYearExtendedMatch[2], 10);
    const isFactoryCode = monthLetter === 'F' || monthLetter === 'H' || monthLetter === 'I';
    if (!isFactoryCode || yearDigits <= 86) {
      return decodeJapan1975to1988Extended(normalized);
    }
  }

  // Japan: F/H/I + 6 digits (1987-1996)
  if (/^[FHI]\d{6}$/.test(normalized)) {
    return decodeJapan1987to1996(normalized);
  }

  // Japan: Sugi/J-Custom - Letter + 5 digits (2005-present)
  if (/^[A-L]\d{5}$/.test(normalized)) {
    return decodeSugi(normalized);
  }

  // Japan: IGDC format - IG + 6 digits (2016-2017)
  if (/^IG\d{6}$/.test(normalized)) {
    return decodeIGDC(normalized);
  }

  // Japan: H + 6 digits (1994-1998)
  if (/^H\d{6}$/.test(normalized)) {
    return decodeH1994to1998(normalized);
  }

  // Japan/Korea hybrid: FC + 7 digits
  if (/^FC\d{7}$/.test(normalized)) {
    return decodeFCHybrid(normalized);
  }

  // Korea: C/S/A/Y/P/R + 9 digits (2000-2008)
  if (/^[CSAYPR]\d{9}$/.test(normalized)) {
    return decodeKorea2000to2008(normalized);
  }

  // Korea: C/S/A/Y/P + 8 digits (1995-1999)
  if (/^[CSAYP]\d{8}$/.test(normalized)) {
    return decodeKorea1995to1999(normalized);
  }

  // Korea: C/Y/A/P + 6 digits (1987-1995)
  if (/^[CYAP]\d{6}$/.test(normalized)) {
    return decodeKorea1987to1995(normalized);
  }

  // Korea: C + 7 digits (1990s Cort variant)
  if (/^C\d{7}$/.test(normalized)) {
    return decodeKoreaCort1990s7Digit(normalized);
  }

  // Korea: E + 7 digits (Sung-Eum factory)
  if (/^E\d{7}$/.test(normalized)) {
    return decodeSungEum(normalized);
  }

  // Korea: W + 6 digits (World factory, 1999-2008)
  if (/^W\d{6}$/.test(normalized)) {
    return decodeWorld(normalized);
  }

  // Korea: W + 7 digits (World factory variant, numeric MM)
  if (/^W\d{7}$/.test(normalized)) {
    return decodeWorldExtended(normalized);
  }

  // Korea: WK + 4 digits (short World factory format)
  if (/^WK\d{4}$/.test(normalized)) {
    return decodeWorldShortWK(normalized);
  }

  // Korea: S + 7 digits (Samick, 1990-1995)
  if (/^S\d{7}$/.test(normalized)) {
    return decodeSamick(normalized);
  }

  // Saehan acoustics month-letter format: SQ + YY + month-letter + 5 digits
  if (/^SQ\d{2}[A-L]\d{5}$/.test(normalized)) {
    return decodeSaehanMonthLetter(normalized);
  }

  // Saehan acoustics: SQ + digits (fallback)
  if (/^SQ\d+$/.test(normalized)) {
    return decodeSaehan(normalized);
  }

  // Less-common V prefix: V + 6 digits (supports O/0 in 2nd position)
  if (/^V[0O]\d{5}$/.test(normalized)) {
    return decodeVPrefix(normalized);
  }

  // Less-common M prefix: M + 7 digits
  if (/^M\d{7}$/.test(normalized)) {
    return decodeMPrefix(normalized);
  }

  // Korea: KR + 9 digits (2004-2006)
  if (/^KR\d{9}$/.test(normalized)) {
    return decodeKR(normalized);
  }

  // Korea: CP + digits (2003-2008)
  if (/^CP\d+$/.test(normalized)) {
    return decodeCP(normalized);
  }

  // Import two-character prefix variant: 5A/5B/5N + 9 digits
  // Treats the prefix as a plant/line code and parses YYMM + sequence from digits.
  if (/^5[ABN]\d{9}$/.test(normalized)) {
    return decodeTwoCharImportPrefix9Digit(normalized);
  }

  // Month-letter variant seen on some imports: B + 9 digits
  // Treats leading letter as month code (A=Jan, B=Feb, ...), not factory code.
  if (/^B\d{9}$/.test(normalized)) {
    return decodeMonthLetterPrefix9Digit(normalized);
  }

  // Indonesia: I/K/J/U + 9 digits (2001-present)
  if (/^[IKJU]\d{9}$/.test(normalized)) {
    return decodeIndonesia2001(normalized);
  }

  // Indonesia: I/K/J/U + 10 digits (extended variant with internal line digit)
  // Interpreted as factory + YY + line + MM + 5-digit sequence.
  if (/^[IKJU]\d{10}$/.test(normalized)) {
    return decodeIndonesia2001Extended(normalized);
  }

  // Indonesia: I + 7 digits (1997-2000)
  if (/^I\d{7}$/.test(normalized)) {
    return decodeIndonesia1997to2000(normalized);
  }

  // Month-letter compact variant: A-L + 7 digits
  // Interpreted as month-letter + YY + 5-digit sequence.
  // This stays after I + 7 digits so Indonesia serials like I9123856
  // do not get misread as a future-dated month-letter format.
  if (/^[A-L]\d{7}$/.test(normalized)) {
    return decodeMonthLetterPrefix7Digit(normalized);
  }

  // Indonesia GIO (legacy): GI + 7 digits
  if (/^GI\d{7}$/.test(normalized)) {
    return decodeGioIndonesiaLegacy(normalized);
  }

  // Indonesia: PR + 9 digits (2004-2007)
  if (/^PR\d{9}$/.test(normalized)) {
    return decodePR(normalized);
  }

  // Indonesia: PW + 8-9 digits (2019-present, PT Woonan)
  if (/^PW\d{8,9}$/.test(normalized)) {
    return decodePW(normalized);
  }

  // Indonesia Premium: 6 chars with letter at end (2010-2015)
  if (/^[A-L]\d{4}[A-F]$/.test(normalized)) {
    return decodeIndonesiaPremium(normalized);
  }

  // China: J + 9 digits (2004-2012)
  if (/^J\d{9}$/.test(normalized)) {
    return decodeChinaJ(normalized);
  }

  // China: S + 8 digits (2002-present)
  if (/^S\d{8}$/.test(normalized)) {
    return decodeChinaS(normalized);
  }

  // China: GS + 9 digits (2007-present, GIO series)
  if (/^GS\d{9}$/.test(normalized)) {
    return decodeChinaGS(normalized);
  }

  // China: GZ + 9 digits (GIO-style variant)
  if (/^GZ\d{9}$/.test(normalized)) {
    return decodeChinaGZ(normalized);
  }

  // China: Z + 6 characters (Yeou Chern, 1999-2006)
  if (/^Z[0-9XYZ]\d{5}$/.test(normalized)) {
    return decodeYeouChern(normalized);
  }

  // China: A + 8 digits (2005-present)
  if (/^A\d{8}$/.test(normalized)) {
    return decodeChinaA(normalized);
  }

  // China: L + 9 digits
  if (/^L\d{9}$/.test(normalized)) {
    return decodeChinaL(normalized);
  }

  // China: N + 9 digits
  if (/^N\d{9}$/.test(normalized)) {
    return decodeChinaN(normalized);
  }

  // China: H + 9 digits
  if (/^H\d{9}$/.test(normalized)) {
    return decodeChinaH(normalized);
  }

  // China: GP + 8 digits
  if (/^GP\d{8}$/.test(normalized)) {
    return decodeChinaGP(normalized);
  }

  // China: 4L + 9-10 digits
  if (/^4L\d{9,10}$/.test(normalized)) {
    return decodeChina4L(normalized);
  }

  // China two-character prefixes: 4H/OZ + 9 digits
  if (/^(4H|OZ)\d{9}$/.test(normalized)) {
    return decodeChinaTwoCharPrefix9Digit(normalized);
  }

  // China 4H extended format: 4H + 10 digits
  // Interpreted as YY + batch/line + MM + sequence.
  if (/^4H\d{10}$/.test(normalized)) {
    return decodeChina4HExtended10(normalized);
  }

  // Compound extended prefix + 9-digit date payload
  // Example: 215N015N250401143 -> prefix 215N015N + 250401143
  const compoundNumericMatch = normalized.match(/^([A-Z0-9]{5,12})(\d{9})$/);
  if (compoundNumericMatch && /[A-Z]/.test(compoundNumericMatch[1])) {
    const prefixCode = compoundNumericMatch[1];
    const actualSerial = compoundNumericMatch[2];
    const result = decodeNumeric9DigitModern(actualSerial);
    if (result.success && result.info) {
      result.info.serialNumber = normalized;
      result.info.notes = `Prefix code: ${prefixCode}. ${result.info.notes}`;
    }
    return result;
  }

  // Legacy alpha-suffix format: YYMM###/#### + 1-2 letters
  if (/^\d{7,8}[A-Z]{1,2}$/.test(normalized)) {
    return decodeLegacyAlphaSuffix(normalized);
  }

  // Compact legacy format: YYMSS + suffix letter (6 chars total)
  if (/^\d{5}[A-Z]$/.test(normalized)) {
    return decodeCompactAlphaSuffix(normalized);
  }

  // Legacy numeric late-80s format: YY + sequence (6 digits)
  if (/^\d{6}$/.test(normalized)) {
    return decodeLegacyNumericLate80s(normalized);
  }

  // Numeric-only 9 digits: YYMM + sequence (seen on some modern imports)
  if (/^\d{9}$/.test(normalized)) {
    return decodeNumeric9DigitModern(normalized);
  }

  // Numeric-only 8 digits: YYMM + sequence (short variant on some imports)
  if (/^\d{8}$/.test(normalized)) {
    return decodeNumeric8DigitModern(normalized);
  }

  // Numeric-only 7 digits: YMM + sequence (short import variant)
  if (/^\d{7}$/.test(normalized)) {
    return decodeNumeric7DigitModern(normalized);
  }

  // Numeric-only 10 digits: factory digit + YYMM + sequence
  if (/^\d{10}$/.test(normalized)) {
    return decodeNumeric10DigitFactoryLeading(normalized);
  }

  // Japan: 5-digit J-Custom (2001-2004)
  if (/^\d{5}$/.test(normalized)) {
    return decodeJCustom5Digit(normalized);
  }

  return {
    success: false,
    error: 'Unrecognized Ibanez serial number format. Ibanez has used many different serial number systems across factories in Japan, Korea, Indonesia, and China. Common formats include: F + 7 digits (Japan), letter + 6-10 digits (various factories), numeric 6-10 digits (legacy or modern date/sequence variants), compact/legacy alpha suffix variants, or factory prefix + digits.'
  };
}

function decodeKnownModelCode(modelCode: string): DecodeResult {
  if (modelCode === 'GRG170DX') {
    const info: GuitarInfo = {
      brand: 'Ibanez',
      serialNumber: modelCode,
      model: modelCode,
      country: 'China or Indonesia',
      factory: 'Likely China or Indonesia GIO production facility',
      notes: `${modelCode} is a model code, not a stamped serial number. GRG (GIO) models are commonly built in China or Indonesia, but exact month/year requires the actual serial from the headstock/label.`
    };

    return { success: true, info };
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: modelCode,
    model: modelCode,
    country: 'Indonesia',
    factory: 'Likely Cort Indonesia (Cor-Tek) or another Indonesia facility',
    notes: `${modelCode} is a model code, not a stamped serial number. Model lookup can indicate likely origin, but exact manufacture date requires the actual serial from the headstock/label.`
  };

  return { success: true, info };
}

// Japan FujiGen 1997-present: F + 7 digits
function decodeFujiGenModern(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10);
  const productionNum = parseInt(serial.substring(3), 10);

  // Determine full year (97-99 = 1997-1999, 00+ = 2000+)
  const fullYear = year >= 97 ? 1900 + year : 2000 + year;

  // Calculate approximate month from production number
  // Post-2004: 3000 units/month, Pre-2004: 5000 units/month
  const unitsPerMonth = fullYear >= 2005 ? 3000 : 5000;
  const monthNum = Math.floor(productionNum / unitsPerMonth) + 1;
  const month = monthNum <= 12 ? getMonthName(monthNum) : undefined;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: fullYear.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano',
    country: 'Japan',
    notes: `Production number: ${productionNum}. FujiGen is Ibanez's premium Japanese factory, known for high-quality Prestige and J-Custom models.`
  };

  return { success: true, info };
}

// Japan FujiGen variant: FD + 7 digits
function decodeFujiGenFD(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10);
  const productionNum = parseInt(serial.substring(4), 10);

  const fullYear = year >= 97 ? 1900 + year : 2000 + year;
  const baseUnitsPerMonth = fullYear >= 2005 ? 3000 : 5000;
  let monthNum = Math.floor(productionNum / baseUnitsPerMonth) + 1;
  let month = monthNum <= 12 ? getMonthName(monthNum) : undefined;

  // Some FD runs appear to use larger monthly blocks than standard F-prefix assumptions.
  if (!month) {
    monthNum = Math.floor(productionNum / 10000) + 1;
    month = monthNum <= 12 ? getMonthName(monthNum) : undefined;
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: fullYear.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano',
    country: 'Japan',
    notes: `Production number: ${productionNum}. FD is treated as a FujiGen variant prefix used on some modern Japan production.`
  };

  return { success: true, info };
}

// Japan 1987-1996: F/H/I + 6 digits
function decodeJapan1987to1996(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const productionNum = parseInt(serial.substring(2), 10);

  // Year digit: 7=1987 through 6=1996
  let year: number;
  if (yearDigit >= 7) {
    year = 1980 + yearDigit;
  } else {
    year = 1990 + yearDigit;
  }

  let factory: string;
  switch (factoryCode) {
    case 'F':
      factory = 'FujiGen Gakki, Nagano';
      break;
    case 'H':
      factory = 'Terada Musical Instrument Co., Nagoya';
      break;
    case 'I':
      factory = 'Iida Gakki, Nagoya';
      break;
    default:
      factory = 'Unknown Japanese Factory';
  }

  // Calculate month (FujiGen used ~3600/month increments)
  const monthNum = Math.floor(productionNum / 3600) + 1;
  const month = monthNum <= 12 ? getMonthName(monthNum) : undefined;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory,
    country: 'Japan',
    notes: `Production number: ${productionNum}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Japan 1975-1988: Month letter + 6 digits
function decodeJapan1975to1988(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const yearDigits = serial.substring(1, 3);
  const productionNum = serial.substring(3);

  const monthNum = monthLetter.charCodeAt(0) - 64; // A=1, B=2, etc.
  const month = getMonthName(monthNum);

  // Parse year - could be 75-88
  let year = parseInt(yearDigits, 10);
  if (year >= 75 && year <= 99) {
    year = 1900 + year;
  } else if (year >= 0 && year <= 88) {
    year = 1900 + year;
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano (most likely)',
    country: 'Japan',
    notes: `Production number: ${productionNum}. This format was used from 1975-1988 for Japanese-made guitars.`
  };

  return { success: true, info };
}

// Japan 1975-1988 (extended): Month letter + 8 digits
function decodeJapan1975to1988Extended(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const year = parseInt(serial.substring(1, 3), 10);
  const sequence = serial.substring(3);

  const monthNum = monthLetter.charCodeAt(0) - 64;
  const month = getMonthName(monthNum);

  const fullYear = year >= 75 ? 1900 + year : 2000 + year;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: fullYear.toString(),
    month,
    factory: 'Japan (likely FujiGen or Terada)',
    country: 'Japan',
    notes: `Sequence: ${sequence}. Extended month-letter format from the pre-1987 Japanese period. "${monthLetter}" indicates month ${month}.`
  };

  return { success: true, info };
}

// Japan Sugi/J-Custom: Letter + 5 digits (2005-present)
function decodeSugi(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const yearDigits = serial.substring(1, 3);
  const modelCode = serial[3];
  const sequenceNum = serial.substring(4);

  const monthNum = monthLetter.charCodeAt(0) - 64;
  const month = getMonthName(monthNum);
  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'Sugi Musical Instruments Ltd.',
    country: 'Japan',
    notes: `Model code: ${modelCode}, Sequence: ${sequenceNum}. Sugi manufactures high-end J-Custom models for Ibanez.`
  };

  return { success: true, info };
}

// Japan IGDC: IG + 6 digits (2016-2017)
function decodeIGDC(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Ibanez Guitar Development Center (IGDC)',
    country: 'Japan',
    notes: `Sequence: ${sequence}. IGDC serial numbers are typically hand-written on the back of the headstock.`
  };

  return { success: true, info };
}

// Japan H format 1994-1998
function decodeH1994to1998(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10);
  const sequence = serial.substring(3);

  const fullYear = year >= 94 ? 1900 + year : 2000 + year;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: fullYear.toString(),
    factory: 'Japan (manufacturer unclear)',
    country: 'Japan',
    notes: `Sequence: ${sequence}. This H-prefix format was used 1994-1998, possibly for historic reissue models.`
  };

  return { success: true, info };
}

// Japan/Korea hybrid: FC + 7 digits
function decodeFCHybrid(serial: string): DecodeResult {
  const yearDigit = serial[2];
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  // Year digit in mid-90s
  let year = parseInt(yearDigit, 10);
  year = year >= 5 ? 1990 + year : 2000 + year;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'FujiGen (Japan) / Cort (Korea) - Hybrid Production',
    country: 'Japan/Korea',
    notes: `Sequence: ${sequence}. FC prefix indicates hybrid production: necks from FujiGen Japan, bodies from Cort Korea.`
  };

  return { success: true, info };
}

// Korea 2000-2008: Letter + 9 digits
function decodeKorea2000to2008(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea 1995-1999: Letter + 8 digits
function decodeKorea1995to1999(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  // Single digit year: 5-9 = 1995-1999
  const year = 1990 + yearDigit;
  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea 1987-1995: Letter + 6 digits
function decodeKorea1987to1995(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const sequence = serial.substring(2);

  // Year digit: 7-9 = 1987-1989, 0-5 = 1990-1995
  let year: number;
  if (yearDigit >= 7) {
    year = 1980 + yearDigit;
  } else {
    year = 1990 + yearDigit;
  }

  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea 1990s Cort variant: C + 7 digits (YMM + sequence)
function decodeKoreaCort1990s7Digit(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  const year = 1990 + yearDigit;
  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. 7-digit Korean format interpreted as factory code + YMM + sequence. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea Sung-Eum: E + 7 digits
function decodeSungEum(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  const year = yearDigit >= 7 ? 1980 + yearDigit : 1990 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Sung-Eum Music Co., Yangju',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. E prefix indicates Sung-Eum factory production.`
  };

  return { success: true, info };
}

// Korea World: W + 6 digits (1999-2008)
function decodeWorld(serial: string): DecodeResult {
  const monthCode = serial[1];
  const yearDigit = parseInt(serial[2], 10);
  const sequence = serial.substring(3);

  // Month: 1-9 for Jan-Sep, X=Oct, Y=Nov, Z=Dec
  let month: number;
  if (monthCode >= '1' && monthCode <= '9') {
    month = parseInt(monthCode, 10);
  } else if (monthCode === 'X') {
    month = 10;
  } else if (monthCode === 'Y') {
    month = 11;
  } else if (monthCode === 'Z') {
    month = 12;
  } else {
    month = 0;
  }

  // Year digit: 9=1999, 0-8 = 2000-2008
  const year = yearDigit === 9 ? 1999 : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: month > 0 ? getMonthName(month) : undefined,
    factory: 'World Musical Instruments Co.',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. W prefix indicates World factory production.`
  };

  return { success: true, info };
}

// Korea World (variant): W + 7 digits (YMM####)
function decodeWorldExtended(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  const year = yearDigit === 9 ? 1999 : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'World Musical Instruments Co.',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. W-prefix variant using numeric month digits (MM).`
  };

  return { success: true, info };
}

// Korea World short format: WK + 4 digits
function decodeWorldShortWK(serial: string): DecodeResult {
  const yy = serial.substring(2, 4);
  const seq = serial.substring(4);
  const yearDigit = parseInt(yy[1], 10);
  const year = yearDigit === 9 ? 1999 : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: 'October',
    factory: 'World Musical Instruments Co.',
    country: 'South Korea',
    notes: `Sequence: ${seq}. WK short-format interpretation defaults to K=October with year digit from "${yy}". Alternate interpretation used in some analyses: year 2001 with "007" treated as July/sequence context.`
  };

  return { success: true, info };
}

// Korea Samick: S + 7 digits (1990-1995)
function decodeSamick(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  // Year: 0-5 = 1990-1995
  const year = 1990 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Samick Musical Instruments, Incheon',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. S prefix indicates Samick factory production.`
  };

  return { success: true, info };
}

// Saehan acoustics: SQ + YY + month-letter + 5 digits
function decodeSaehanMonthLetter(serial: string): DecodeResult {
  const year = 2000 + parseInt(serial.substring(2, 4), 10);
  const monthLetter = serial[4];
  const month = monthLetter.charCodeAt(0) - 64; // A=1 ... L=12
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Saehan Guitar Technology (acoustic production)',
    country: 'China',
    notes: `Sequence: ${sequence}. SQ acoustic format uses YY + month-letter (A=Jan ... L=Dec) after the SQ prefix.`
  };

  return { success: true, info };
}

// Saehan acoustics fallback: SQ + digits
function decodeSaehan(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: '2000s',
    factory: 'Saehan Guitar Technology',
    country: 'South Korea or China',
    notes: `SQ prefix indicates Saehan factory, typically used for acoustic models.`
  };

  return { success: true, info };
}

// Less-common V prefix: V + 6 digits
function decodeVPrefix(serial: string): DecodeResult {
  const yearPart = serial.substring(1, 3).replace('O', '0');
  const year = parseInt(yearPart, 10) + 2000;
  const sequence = serial.substring(3);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Unknown V-prefix production line (Japan or Korea)',
    country: 'Japan or South Korea',
    notes: `Sequence: ${sequence}. V prefix is treated as a less-common factory/series code. If original stamp used a letter "O", the serial may be a 2005-format read (e.g., V054683).`
  };

  return { success: true, info };
}

// Less-common M prefix: M + 7 digits
function decodeMPrefix(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  const primaryYear = 2000 + yearDigit;
  const alternateYear = 2010 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: primaryYear.toString(),
    month: getMonthName(month),
    factory: 'Unknown M-prefix production line (Korea or China)',
    country: 'South Korea or China',
    notes: `Sequence: ${sequence}. M-prefix format interpreted with year digit "${yearDigit}". Alternate interpretation in some series: ${alternateYear}, ${getMonthName(month)}.`
  };

  return { success: true, info };
}

// Korea KR format: KR + 9 digits (2004-2006)
function decodeKR(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'South Korea (factory unspecified)',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. KR prefix was used 2004-2006.`
  };

  return { success: true, info };
}

// Korea CP format: CP + digits (2003-2008)
function decodeCP(serial: string): DecodeResult {
  const remaining = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: '2003-2008',
    factory: 'South Korea (possibly Cort partnership)',
    country: 'South Korea',
    notes: `CP prefix was used 2003-2008. Exact manufacturer unclear.`
  };

  return { success: true, info };
}

// Import two-character prefix variant: 5A/5B/5N + 9 digits
function decodeTwoCharImportPrefix9Digit(serial: string): DecodeResult {
  const prefix = serial.substring(0, 2);
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: `Unknown import factory (${prefix} prefix)`,
    country: 'China or Indonesia',
    notes: `Sequence: ${sequence}. "${prefix}" appears as a two-character import prefix; this decoder uses YYMM from the following digits.`
  };

  return { success: true, info };
}

// Numeric-only modern import variant: YYMM + sequence (9 digits)
function decodeNumeric9DigitModern(serial: string): DecodeResult {
  const yyYear = parseInt(serial.substring(0, 2), 10) + 2000;
  const yyMonth = parseInt(serial.substring(2, 4), 10);
  const yySequence = serial.substring(4);

  // Primary interpretation: YYMM + sequence.
  // Fallback interpretation: YMM + sequence when YYMM produces an invalid month.
  if (yyMonth >= 1 && yyMonth <= 12) {
    const info: GuitarInfo = {
      brand: 'Ibanez',
      serialNumber: serial,
      year: yyYear.toString(),
      month: getMonthName(yyMonth),
      factory: 'Unknown import factory (numeric-only format)',
      country: 'China or Indonesia',
      notes: `Sequence: ${yySequence}. Numeric-only 9-digit pattern interpreted as YYMM + production sequence.`
    };

    return { success: true, info };
  }

  const yearDigit = parseInt(serial[0], 10);
  const month = parseInt(serial.substring(1, 3), 10);
  const sequence = serial.substring(3);
  const primaryYear = 2000 + yearDigit;
  const alternateYear = 2010 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: primaryYear.toString(),
    month: getMonthName(month),
    factory: 'Unknown import factory (numeric-only format)',
    country: 'South Korea or China',
    notes: `Sequence: ${sequence}. YYMM parse was invalid (month ${yyMonth}), so fallback YMM + sequence was used. Alternate interpretation sometimes used in newer runs: ${alternateYear}, ${getMonthName(month)}.`
  };

  return { success: true, info };
}

// Numeric-only modern import variant: YYMM + sequence (8 digits)
function decodeNumeric8DigitModern(serial: string): DecodeResult {
  const yy = parseInt(serial.substring(0, 2), 10);
  const yyYear = yy >= 80 ? 1900 + yy : 2000 + yy;
  const yyMonth = parseInt(serial.substring(2, 4), 10);
  const yySequence = serial.substring(4);

  // Primary interpretation: YYMM + sequence.
  // Fallback interpretation: YMM + sequence when YYMM produces an invalid month.
  if (yyMonth >= 1 && yyMonth <= 12) {
    const likelyKorean90s = yy >= 80;
    const info: GuitarInfo = {
      brand: 'Ibanez',
      serialNumber: serial,
      year: yyYear.toString(),
      month: getMonthName(yyMonth),
      factory: likelyKorean90s
        ? 'Likely Korean import factory (possibly Cort)'
        : 'Unknown import factory (numeric-only format)',
      country: likelyKorean90s ? 'South Korea' : 'China or Indonesia',
      notes: likelyKorean90s
        ? `Sequence: ${yySequence}. Numeric-only 8-digit pattern interpreted as YYMM + production sequence. For 80-99 year prefixes, this decoder treats the serial as a late-1900s import format; 92 12 reads as December 1992.`
        : `Sequence: ${yySequence}. Numeric-only 8-digit pattern interpreted as YYMM + production sequence.`
    };

    return { success: true, info };
  }

  const yearDigit = parseInt(serial[0], 10);
  const month = parseInt(serial.substring(1, 3), 10);
  const sequence = serial.substring(3);
  const primaryYear = 2000 + yearDigit;
  const alternateYear = 2010 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: primaryYear.toString(),
    month: getMonthName(month),
    factory: 'Unknown import factory (numeric-only format)',
    country: 'South Korea or China',
    notes: `Sequence: ${sequence}. YYMM parse was invalid (month ${yyMonth}), so fallback YMM + sequence was used. Alternate interpretation sometimes used in newer runs: ${alternateYear}, ${getMonthName(month)}.`
  };

  return { success: true, info };
}

// Numeric-only import variant: YMM + sequence (7 digits)
function decodeNumeric7DigitModern(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const month = parseInt(serial.substring(1, 3), 10);
  const sequence = serial.substring(3);

  const year = 2010 + yearDigit;
  const monthText = getMonthName(month);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: monthText,
    factory: 'Unknown import factory (numeric-only format)',
    country: 'China or Korea',
    notes: `Sequence: ${sequence}. Numeric-only 7-digit pattern interpreted as YMM + production sequence (assumed 2010s decade; month ${monthText}).`
  };

  return { success: true, info };
}

// Numeric-only modern variant: factory digit + YYMM + sequence (10 digits)
function decodeNumeric10DigitFactoryLeading(serial: string): DecodeResult {
  const factoryDigit = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);
  const monthText = getMonthName(month);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: monthText,
    factory: 'Unknown China factory (numeric 10-digit format)',
    country: 'China',
    notes: `Factory digit: ${factoryDigit}. Sequence: ${sequence}. Numeric-only 10-digit pattern interpreted as factory digit + YYMM + production sequence.`
  };

  return { success: true, info };
}

// Month-letter prefix variant: B + 9 digits
function decodeMonthLetterPrefix9Digit(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const monthFromLetter = getMonthName(monthLetter.charCodeAt(0) - 64);
  const numericMonth = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const monthNote = numericMonth >= 1 && numericMonth <= 12 && getMonthName(numericMonth) !== monthFromLetter
    ? ` Digits 4-5 read as ${getMonthName(numericMonth)}, but this decode prioritizes the leading month-letter convention.`
    : '';

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: monthFromLetter,
    factory: 'Unknown (B used as month-letter code, not a factory code)',
    notes: `Sequence: ${sequence}. Leading "${monthLetter}" interpreted as month code (A=January, B=February, ...).${monthNote}`
  };

  return { success: true, info };
}

// Month-letter compact variant: A-L + 7 digits
function decodeMonthLetterPrefix7Digit(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const yearDigits = parseInt(serial.substring(1, 3), 10);
  const monthFromLetter = getMonthName(monthLetter.charCodeAt(0) - 64);
  const sequence = serial.substring(3);

  const year = 2000 + yearDigits;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: monthFromLetter,
    factory: 'Unknown Japan/import factory (month-letter compact format)',
    country: 'Japan or import',
    notes: `Sequence: ${sequence}. Compact month-letter format interpreted as ${monthLetter}=month, ${yearDigits.toString().padStart(2, '0')}=year (20YY).`
  };

  return { success: true, info };
}

// Indonesia 2001-present: I/K/J/U + 9 digits
function decodeIndonesia2001(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = parseInt(serial.substring(5), 10);

  let factory: string;
  switch (factoryCode) {
    case 'I':
      factory = 'Cort Indonesia (Cor-Tek)';
      break;
    case 'K':
      factory = 'Kwo Hsiao Co., Ltd.';
      break;
    case 'J':
      factory = 'Sejung';
      break;
    case 'U':
      factory = 'Cort Indonesia (Cor-Tek)';
      break;
    default:
      factory = 'Indonesia (factory unspecified)';
  }

  // Production number ranges: 00001-49999 for acoustics, 50000-99999 for electrics/basses
  let instrumentType = '';
  if (sequence < 50000) {
    instrumentType = ' This sequence range (< 50000) typically indicates acoustic guitars.';
  } else {
    instrumentType = ' This sequence range (50000+) typically indicates electric guitars or basses.';
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'Indonesia',
    notes: `Sequence: ${sequence}.${instrumentType}`
  };

  return { success: true, info };
}

// Indonesia extended variant: I/K/J/U + 10 digits
// Format: [factory][YY][line][MM][sequence(5)]
function decodeIndonesia2001Extended(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const lineCode = serial[3];
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = parseInt(serial.substring(6), 10);

  let factory: string;
  switch (factoryCode) {
    case 'I':
      factory = 'Cort Indonesia (Cor-Tek)';
      break;
    case 'K':
      factory = 'Kwo Hsiao Co., Ltd.';
      break;
    case 'J':
      factory = 'Sejung';
      break;
    case 'U':
      factory = 'Cort Indonesia (Cor-Tek)';
      break;
    default:
      factory = 'Indonesia (factory unspecified)';
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'Indonesia',
    notes: `Line code: ${lineCode}. Sequence: ${sequence}. Extended Indonesia format interpreted as factory + YY + line + MM + sequence.`
  };

  return { success: true, info };
}

// Indonesia 1997-2000: I + 7 digits
function decodeIndonesia1997to2000(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  // Year: 7-9 = 1997-1999, 0 = 2000
  const year = yearDigit >= 7 ? 1990 + yearDigit : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Cort Indonesia (Cor-Tek)',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. Early Indonesian production began in 1997.`
  };

  return { success: true, info };
}

// Indonesia GIO legacy: GI + 7 digits
function decodeGioIndonesiaLegacy(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Indonesia (GIO legacy prefix)',
    country: 'Indonesia',
    model: 'GIO Series (likely)',
    notes: `Sequence: ${sequence}. GI prefix appears on early Indonesia GIO production.`
  };

  return { success: true, info };
}

// Indonesia PR format: PR + 9 digits (2004-2007)
function decodePR(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Indonesia (manufacturer unclear)',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. PR prefix was used 2004-2007.`
  };

  return { success: true, info };
}

// Indonesia PW format: PW + 8-9 digits (2019-present)
function decodePW(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'P.T. Woonan Music, Ngoro (East Java)',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. PW prefix indicates PT Woonan factory (2019-present).`
  };

  return { success: true, info };
}

// Indonesia Premium: Letter + 4 digits + Letter (2010-2015)
function decodeIndonesiaPremium(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const sequence = serial.substring(1, 5);
  const yearLetter = serial[5];

  const monthNum = monthLetter.charCodeAt(0) - 64;
  const month = getMonthName(monthNum);

  // Year letter: A=2010, B=2011, C=2012, D=2013, E=2014, F=2015
  const yearOffset = yearLetter.charCodeAt(0) - 65;
  const year = 2010 + yearOffset;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'Indonesia Premium Factory',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. This format was used for Indonesian Premium series guitars 2010-2015.`
  };

  return { success: true, info };
}

// China J format: J + 9 digits (2004-2012)
function decodeChinaJ(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Sejung Musical Instrument Manufacturing, Qingdao (likely)',
    country: 'China',
    notes: `Sequence: ${sequence}. J prefix with 9 digits was used 2004-2012.`
  };

  return { success: true, info };
}

// China S format: S + 8 digits (2002-present)
function decodeChinaS(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (manufacturer unclear)',
    country: 'China',
    notes: `Sequence: ${sequence}. S + 8 digits format used since 2002.`
  };

  return { success: true, info };
}

// China GS format: GS + 9 digits (2007-present, GIO series)
function decodeChinaGS(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China',
    country: 'China',
    model: 'GIO Series (likely)',
    notes: `Sequence: ${sequence}. GS prefix typically indicates GIO series budget models.`
  };

  return { success: true, info };
}

// China GZ format: GZ + 9 digits (GIO-style variant)
function decodeChinaGZ(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (GZ-prefix factory/line)',
    country: 'China',
    model: 'GIO Series (likely)',
    notes: `Sequence: ${sequence}. GZ prefix appears on China GIO/entry-level production using YYMM + sequence.`
  };

  return { success: true, info };
}

// China Yeou Chern: Z + letter/digit + 5 digits (1999-2006)
function decodeYeouChern(serial: string): DecodeResult {
  const monthCode = serial[1];
  const yearDigit = parseInt(serial[2], 10);
  const sequence = serial.substring(3);

  // Month: 1-9 for Jan-Sep, X=Oct, Y=Nov, Z=Dec
  let month: number;
  if (monthCode >= '1' && monthCode <= '9') {
    month = parseInt(monthCode, 10);
  } else if (monthCode === 'X') {
    month = 10;
  } else if (monthCode === 'Y') {
    month = 11;
  } else if (monthCode === 'Z') {
    month = 12;
  } else {
    month = 0;
  }

  // Year: 9=1999, 0-6 = 2000-2006
  const year = yearDigit === 9 ? 1999 : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: month > 0 ? getMonthName(month) : undefined,
    factory: 'Yeou Chern Enterprises, Guangdong',
    country: 'China',
    notes: `Sequence: ${sequence}. Z prefix indicates Yeou Chern factory (1999-2006).`
  };

  return { success: true, info };
}

// China A format: A + 8 digits (2005-present)
function decodeChinaA(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China',
    country: 'China',
    notes: `Sequence: ${sequence}. A + 8 digits format used since 2005.`
  };

  return { success: true, info };
}

// China L format: L + 9 digits
function decodeChinaL(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (L-prefix factory)',
    country: 'China',
    notes: `Sequence: ${sequence}. L prefix appears on modern China production serials.`
  };

  return { success: true, info };
}

// China N format: N + 9 digits
function decodeChinaN(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (N-prefix factory)',
    country: 'China',
    notes: `Sequence: ${sequence}. N prefix appears on modern China production serials using YYMM + sequence.`
  };

  return { success: true, info };
}

// China H format: H + 9 digits
function decodeChinaH(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (H-prefix factory)',
    country: 'China',
    notes: `Sequence: ${sequence}. H prefix appears on some modern China production serials using YYMM + sequence.`
  };

  return { success: true, info };
}

// China GP format: GP + 8 digits
function decodeChinaGP(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (GP prefix factory)',
    country: 'China',
    model: 'GIO Series (likely)',
    notes: `Sequence: ${sequence}. GP prefix appears on mid-2000s China GIO/entry-level production.`
  };

  return { success: true, info };
}

// China 4L format: 4L + 9-10 digits
function decodeChina4L(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China',
    country: 'China',
    notes: `Sequence: ${sequence}. 4L prefix format.`
  };

  return { success: true, info };
}

// China two-character prefix format: 4H/OZ + 9 digits
function decodeChinaTwoCharPrefix9Digit(serial: string): DecodeResult {
  const prefix = serial.substring(0, 2);
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: `China (${prefix}-prefix factory)`,
    country: 'China',
    notes: `Sequence: ${sequence}. ${prefix} prefix appears on some modern China production serials using YYMM + sequence.`
  };

  return { success: true, info };
}

// China 4H extended format: 4H + 10 digits
function decodeChina4HExtended10(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const batchCode = serial[4];
  const month = parseInt(serial.substring(5, 7), 10);
  const sequence = serial.substring(7);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (4H-prefix factory)',
    country: 'China',
    notes: `Batch/line code: ${batchCode}. Sequence: ${sequence}. 4H extended format interpreted as YY + batch/line + MM + sequence.`
  };

  return { success: true, info };
}

// Legacy alpha-suffix format: YYMM###/#### + 1-2 letters
function decodeLegacyAlphaSuffix(serial: string): DecodeResult {
  const suffixMatch = serial.match(/[A-Z]{1,2}$/);
  const suffix = suffixMatch ? suffixMatch[0] : '';
  const numeric = suffix ? serial.slice(0, -suffix.length) : serial;
  const yy = parseInt(numeric.substring(0, 2), 10);
  const month = parseInt(numeric.substring(2, 4), 10);
  const sequence = numeric.substring(4);

  const year = yy >= 70 ? 1900 + yy : 2000 + yy;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Japan (legacy format, exact factory unclear)',
    country: 'Japan',
    notes: `Sequence: ${sequence}. Suffix "${suffix}" is treated as a factory/inspector/batch marker in legacy serial usage.`
  };

  return { success: true, info };
}

// Compact legacy format: YYMSS + suffix letter (6 chars)
function decodeCompactAlphaSuffix(serial: string): DecodeResult {
  const yy = parseInt(serial.substring(0, 2), 10);
  const month = parseInt(serial[2], 10);
  const sequence = serial.substring(3, 5);
  const suffix = serial[5];

  const year = yy >= 70 ? 1900 + yy : 2000 + yy;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Unknown (compact legacy alpha-suffix format)',
    country: 'China or Korea',
    notes: `Sequence: ${sequence}. Suffix "${suffix}" is treated as a batch/inspector marker in compact legacy serial usage.`
  };

  return { success: true, info };
}

// Legacy numeric late-80s format: YY + sequence (6 digits)
function decodeLegacyNumericLate80s(serial: string): DecodeResult {
  const yy = parseInt(serial.substring(0, 2), 10);
  const monthCandidate = parseInt(serial.substring(2, 4), 10);

  // If middle digits form a valid month, prefer YYMMSS interpretation.
  if (monthCandidate >= 1 && monthCandidate <= 12) {
    const sequence = serial.substring(4);
    const year2000s = 2000 + yy;
    const year1900s = 1990 + yy;

    const info: GuitarInfo = {
      brand: 'Ibanez',
      serialNumber: serial,
      year: year2000s.toString(),
      month: getMonthName(monthCandidate),
      factory: 'Unknown numeric-only format (likely Korea or China)',
      country: 'South Korea or China',
      notes: `Sequence: ${sequence}. 6-digit numeric format interpreted as YYMMSS. Alternate vintage interpretation seen in some analyses: ${year1900s} with the same month.`
    };

    return { success: true, info };
  }

  // Pre-letter-era interpretation (commonly cited for early 1970s):
  // YMMNNN, where Y is year-in-decade and MM is month.
  const yearDigit = parseInt(serial[0], 10);
  const ymmMonth = parseInt(serial.substring(1, 3), 10);
  if (ymmMonth >= 1 && ymmMonth <= 12) {
    const sequence = serial.substring(3);
    const preLetterYear = 1970 + yearDigit;
    const altYear = 1980 + yearDigit;

    const info: GuitarInfo = {
      brand: 'Ibanez',
      serialNumber: serial,
      year: preLetterYear.toString(),
      month: getMonthName(ymmMonth),
      factory: 'Japan pre-letter numeric format (likely FujiGen)',
      country: 'Japan (likely)',
      notes: `Sequence: ${sequence}. 6-digit numeric format interpreted as pre-letter YMMNNN. Alternate interpretation used in some analyses is ${altYear} with the same month.`
    };

    return { success: true, info };
  }

  const sequence = serial.substring(2);
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    factory: 'USA-linked assembly (H&S/Bensalem) or omitted-prefix Japan format',
    country: 'USA/Japan (ambiguous)',
    notes: `Sequence: ${sequence}. 6-digit late-80s numeric format is often seen on USA-linked Ibanez runs, but can also represent a Japanese serial where the expected letter prefix (e.g., F/H/I) is omitted.`
  };

  return { success: true, info };
}

// Japan J-Custom 5-digit: YMXXX (2001-2004)
function decodeJCustom5Digit(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const monthDigit = parseInt(serial[1], 10);
  const sequence = serial.substring(2);

  // Year: 1-4 = 2001-2004
  const year = 2000 + yearDigit;

  // Month: 1-9 for Jan-Sep, but also 0 could be Oct
  const month = monthDigit > 0 && monthDigit <= 12 ? getMonthName(monthDigit) : undefined;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano',
    country: 'Japan',
    model: 'J-Custom (likely)',
    notes: `Sequence: ${sequence}. 5-digit format was used for J-Custom models 2001-2004.`
  };

  return { success: true, info };
}

// Helper functions
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return month >= 1 && month <= 12 ? months[month - 1] : 'Unknown';
}

function getKoreanFactory(code: string): string {
  switch (code) {
    case 'C':
      return 'Cort Guitars, Incheon/Daejeon';
    case 'S':
      return 'Saehan Guitar Technology';
    case 'A':
      return 'Saein Musical Instrument Co., Incheon';
    case 'Y':
      return 'Yoojin Industrial Co.';
    case 'P':
      return 'Peerless Korea Co., Pusan';
    case 'R':
      return 'Peerless Korea Co., Pusan';
    default:
      return 'South Korea (factory unspecified)';
  }
}
