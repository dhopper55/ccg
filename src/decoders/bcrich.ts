import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * B.C. Rich Guitar Serial Number Decoder
 *
 * Supported formats (based on published B.C. Rich serial number guides and NJ series references):
 * - Early USA 4-digit sequential: hand-numbered 1970s–early 1980s Los Angeles production
 * - USA neck-through: 5-digit YYXXX format (year + production sequence)
 * - Class Axe era: B0XXX / BXXXXX / BCXXXXX (year not encoded)
 * - BW-prefix import: BW + sequential number (Korean contract, Class Axe era)
 * - Import pre-2000: F7XXXXX/F8XXXXX/F9XXXXX/F0XXXXX (year in second digit)
 * - Letter-prefix 9-digit import: [SIFN] + YY + sequence (year definitively resolved when YY > 30)
 * - Early-2000s short numeric import: 6 digits like 150979
 * - 2000s 7-digit numeric import: 01XXXXX style serials like 0127150
 * - Hanser-era/date-stamp numeric: 8 digits like 41201627 (year digit + quarter + production)
 * - Month/factory code: A08140023 (month letter + factory + year + production)
 * - B-prefix month-code import: BA09030385 (B + month letter + YY + sequence)
 * - Two-letter Hanser-era import: CO1093111 (month + plant + YY + sequence)
 * - Hanser-era single-letter calendar month import: C301288 (calendar month + YY + sequence)
 * - Hanser-era short month-code import: J50212 (BC Rich month code + Y + 4-digit sequence)
 * - F-prefix six-digit import: F201422 (factory/line prefix + YY + sequence)
 * - Short modern month-code import: F2051631 (month + year + batch/factory + sequence)
 * - Class Axe/import B-prefix: B + 3-6 digits, including B007132
 * - SI-prefix Indonesia (Samil factory, SI + YYMM + sequence)
 * - NJ Series: R/P + 6 digits with year in first two digits
 * - Late 1980s–1990s import: 10-digit all-numeric (format-valid but serial not dateable; Class Axe/Platinum era)
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

const CALENDAR_MONTH_CODE_MAP: Record<string, string> = {
  A: 'January',
  B: 'February',
  C: 'March',
  D: 'April',
  E: 'May',
  F: 'June',
  G: 'July',
  H: 'August',
  I: 'September',
  J: 'October',
  K: 'November',
  L: 'December',
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
  const normalized = cleaned
    .replace(/^SR[#:.]?\s*/, '')
    .replace(/[\s-]/g, '');

  // Class Axe era: CA prefix + sequential production number (1989-1993)
  if (/^CA\d{3,6}$/.test(normalized)) {
    return decodeClassAxeCA(normalized);
  }

  // Samil Indonesia 2-letter prefix: SI + YYMM + sequence (10 digits total)
  // Must be checked before the single-letter [SIFN] handlers since SI is a 2-letter prefix
  if (/^SI\d{8}$/.test(normalized)) {
    return decodeSISamilIndonesiaImport(normalized);
  }

  if (/^[SIFN]\d{9}$/.test(normalized)) {
    return decodeImportLetterNineDigit(normalized);
  }

  if (/^[SIFN]\d{8}$/.test(normalized)) {
    return decodeImportLetterPrefix(normalized);
  }

  if (/^[ACEFGHJKLMNP][A-Z]\d{5,7}$/.test(normalized)) {
    return decodeHanserTwoLetterMonthPlantImport(normalized);
  }

  if (/^[ACEFGHJKLMNP][0-9]{8}$/.test(normalized)) {
    return decodeMonthFactory(normalized);
  }

  if (/^[ACEFGHJKLMNP]\d{7}$/.test(normalized)) {
    return decodeShortMonthCodeImport(normalized);
  }

  if (/^[ACEFGHJKLMNP]\d{5}$/.test(normalized)) {
    return decodeHanserShortMonthCodeImport(normalized);
  }

  if (/^B[ACEFGHJKLMNP]\d{8}$/.test(normalized)) {
    return decodeBPrefixMonthCodeImport(normalized);
  }

  // B-prefix 8-digit plain numeric: B + YY + MM + 4-digit sequence (no month-code letter)
  // e.g. B01081196 = 2001, August, seq 1196
  if (/^B\d{8}$/.test(normalized)) {
    return decodeBNumericYYMM(normalized);
  }

  // BW-prefix import: BW + sequential number (Class Axe era or specific Korean contractor)
  if (/^BW\d{2,6}$/.test(normalized)) {
    return decodeBWPrefixImport(normalized);
  }

  if (/^F[7890]\d{5}$/.test(normalized)) {
    return decodeFSeries(normalized);
  }

  if (/^F\d{6}$/.test(normalized)) {
    return decodeFSixDigitImport(normalized);
  }

  if (/^BO\d{3}$/.test(normalized)) {
    return decodeBoltOn2000(normalized);
  }

  if (/^\d{10}$/.test(normalized)) {
    return decode10DigitNumericImport(normalized);
  }

  if (/^\d{9}$/.test(normalized)) {
    return decodeNineDigitImport(normalized);
  }

  if (/^\d{8}$/.test(normalized)) {
    return decodeHanserEraNumericImport(normalized);
  }

  if (/^[RP]\d{5,6}$/.test(normalized)) {
    return decodeNJSeries(normalized);
  }

  if (/^BC\d{5}$/.test(normalized)) {
    return decodeClassAxeBC(normalized);
  }

  // B-prefix with trailing letter suffix (e.g. B164U): Class Axe / Korean import with line code
  if (/^B\d{2,6}[A-Z]$/.test(normalized)) {
    return decodeBWithTrailingLetter(normalized);
  }

  if (/^B\d{3,6}$/.test(normalized)) {
    return decodeClassAxeB(normalized);
  }

  if (/^[A-L]\d{6}$/.test(normalized)) {
    return decodeHanserSingleLetterCalendarMonthImport(normalized);
  }

  if (/^I\d{5}$/.test(normalized)) {
    return decodeIShortImport(normalized);
  }

  if (/^\d{7}$/.test(normalized)) {
    return decodeSevenDigitNumericImport(normalized);
  }

  if (/^\d{6}$/.test(normalized)) {
    return decodeShortNumericImport(normalized);
  }

  if (/^\d{5}$/.test(normalized)) {
    return decodeUSA5Digit(normalized);
  }

  // Early USA 4-digit sequential: hand-crafted 1970s–early 1980s Los Angeles production
  if (/^\d{4}$/.test(normalized)) {
    return decodeEarlyUSA4Digit(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this B.C. Rich serial number. Known formats include: 4-digit early USA sequential, 5-digit USA neck-through (YYXXX), BW-prefix import series, F7/F8/F9/F0 import serials, F-prefix six-digit imports like F201422, 7-digit numeric imports like 0127150, 8-digit Hanser-era/import date stamps (e.g., Sr#41201627), 9-digit or 10-digit all-numeric import serials, month/factory codes like A08140023, two-letter Hanser-era imports like CO1093111, single-letter Hanser-era imports like C301288, short Hanser-era month-code imports like J50212 (month + year digit + 4-digit sequence), B-prefix month-code imports like BA09030385, NJ series R/P + 6 digits, Class Axe BC/B0/B-prefix series like B007132, or short I-prefix import estimates (I + 5 digits).',
  };
}

const IMPORT_PREFIX_MAP: Record<string, string> = {
  S: 'S-prefix (factory or series designation)',
  I: 'I-prefix (import production)',
  F: 'F-prefix (factory designation)',
  N: 'N-prefix (NJ Series or import designation)',
};

const IMPORT_PREFIX_FACTORY_MAP: Record<string, { factory: string; country: string }> = {
  I: { factory: 'B.C. Rich import production (I-prefix)', country: 'South Korea or Indonesia' },
  S: { factory: 'Samick factory', country: 'South Korea or Indonesia' },
  F: { factory: 'Import factory (F-prefix)', country: 'South Korea / China' },
  N: { factory: 'NJ Series / import factory', country: 'South Korea / China' },
};

function decodeImportLetterNineDigit(serial: string): DecodeResult {
  const prefix = serial[0];
  const yearDigits = serial.substring(1, 3);
  const monthDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const yearNum = parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);
  const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
  const isValidMonth = monthNum >= 1 && monthNum <= 12;
  const monthName = isValidMonth ? MONTH_NAME(monthNum) : undefined;
  const sequenceNumber = parseInt(sequence, 10);
  const factoryInfo = IMPORT_PREFIX_FACTORY_MAP[prefix];
  const factory = factoryInfo?.factory ?? `${prefix}-prefix import factory`;
  const country = factoryInfo?.country ?? 'South Korea / China / Indonesia';

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    ...(monthName ? { month: monthName } : {}),
    factory,
    country,
    notes: `${prefix}-prefix 9-digit import format (${prefix} + YYMMXXXXX). "${prefix}" identifies the ${factory}; digits ${yearDigits} indicate ${year}; ${monthDigits} indicates ${isValidMonth ? monthName : 'an unrecognized batch code'}; ${sequence} is the factory sequence number (${sequenceNumber}). This format is associated with mid-to-late 2000s Korean and Indonesian B.C. Rich import models. Verify with headstock markings, country-of-origin labels, and body/neck construction details.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-import-letter-9-digit-yymm-sequence',
    patternLabel: `B.C. Rich ${prefix}-prefix 9-digit import YYMM sequence`,
    additionalContext: {
      title: `B.C. Rich ${prefix}-prefix 9-digit import serial`,
      summary: `This serial matches a 9-digit B.C. Rich import format where the leading "${prefix}" identifies the factory and the following digits encode year, month, and production sequence.`,
      highlights: [
        `"${prefix}" identifies the ${factory}.`,
        `The digits ${yearDigits} decode as production year ${year}.`,
        isValidMonth
          ? `The digits ${monthDigits} decode as ${monthName}.`
          : `The digits ${monthDigits} are an unrecognized batch code, not a standard calendar month.`,
        `The remaining digits decode as factory sequence number ${sequenceNumber}.`,
      ],
      caveats: [
        'B.C. Rich import serial numbering is inconsistent across ownership eras.',
        'This serial identifies date and import factory, not the exact model name or series tier.',
        'Common shapes from this era include Warlock, Mockingbird, Bich, and Beast in NJ, Platinum, or Bronze lines.',
      ],
      verificationTips: [
        'Check the headstock or truss-rod cover for series name markings.',
        `Look for "Made in Korea" or "Made in Indonesia" on the back of the headstock.`,
        `Compare body shape, hardware, and pickups against B.C. Rich import catalogs from ${year}.`,
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 9-digit B.C. Rich import format where "${prefix}" identifies the ${factory} and the digits encode year, month, and production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>"${prefix}" identifies the ${factory}. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${isValidMonth ? monthName : 'an unrecognized batch code'}. The remaining digits decode as factory sequence number ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock or truss-rod cover for series name markings.</li><li>Look for country-of-origin markings on the back of the headstock.</li><li>Compare body shape, hardware, and pickups against B.C. Rich import catalogs from ${year}.</li></ul>`,
  };
}

function decodeImportLetterPrefix(serial: string): DecodeResult {
  const prefix = serial[0];
  const yearDigits = serial.slice(1, 3);
  const yearNum = parseInt(yearDigits, 10);
  const production = serial.slice(3);
  const prefixDesc = IMPORT_PREFIX_MAP[prefix] || `${prefix}-prefix`;

  // Year digits 00-30 map to 2000-2030; higher values are definitively 1900s
  // (2000 + yearNum exceeds any plausible production year for yearNum > 30)
  const year = yearNum <= 30 ? `${2000 + yearNum}` : `${1900 + yearNum}`;
  const yearNote = `Digits "${yearDigits}" interpreted as ${year}`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    factory: `Import production (${prefixDesc})`,
    country: 'South Korea / China',
    notes: `${prefixDesc} with 8-digit format, typical of Korean or Chinese-made B.C. Rich imports (NJ Series, Platinum Series, or similar). ${yearNote}. Production sequence: ${production}. B.C. Rich serial numbering is inconsistent across eras — confirm with headstock markings, neck pocket stamps, or country-of-origin stickers.`,
  };

  return { success: true, info };
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

function decodeHanserTwoLetterMonthPlantImport(serial: string): DecodeResult {
  const monthCode = serial[0];
  const plantCode = serial[1];
  const yearDigits = serial.slice(2, 4);
  const sequence = serial.slice(4);
  const month = MONTH_CODE_MAP[monthCode];
  const yearNum = parseInt(yearDigits, 10);
  const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: `Hanser-era import plant/contract code ${plantCode}`,
    country: 'China / Indonesia',
    notes: `Two-letter Hanser-era B.C. Rich import format interpreted as month code + plant/contract code + YY + sequence. ${monthCode} indicates ${month}; ${plantCode} is treated as an internal plant or contract-manufacturer code; digits ${yearDigits} indicate production year ${year}; remaining digits are production sequence ${parseInt(sequence, 10)}. B.C. Rich import serials from this era can be inconsistent, so verify with country-of-origin markings, body shape, neck construction, and neck pocket or electronics-cavity dates where available.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-hanser-two-letter-month-plant-import',
    patternLabel: 'B.C. Rich Hanser-era two-letter month/plant import',
    additionalContext: {
      title: 'B.C. Rich Hanser-era import serial',
      summary: 'This serial matches a Hanser-era B.C. Rich import format parsed as month code, plant or contract code, production year, and sequence.',
      highlights: [
        `The month code ${monthCode} decodes as ${month}.`,
        `The letter ${plantCode} is treated as an internal plant or contract-manufacturer code.`,
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'B.C. Rich serial numbering is inconsistent across import eras and ownership periods.',
        'This serial pattern identifies likely date and import family, not the exact model name.',
        'Plant-letter meanings are less consistently documented than numeric factory codes.',
      ],
      verificationTips: [
        'Check for Made in China, Made in Indonesia, or other country-of-origin markings.',
        'Compare body shape, neck construction, pickups, bridge, and trim against late-2000s and early-2010s B.C. Rich import catalogs.',
        'Use neck pocket, electronics-cavity, or label dates if the instrument has them.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Hanser-era B.C. Rich import format parsed as month code, plant or contract code, production year, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The month code ${monthCode} decodes as ${month}. The letter ${plantCode} is treated as an internal plant or contract-manufacturer code. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across import eras and ownership periods.</li><li>This serial pattern identifies likely date and import family, not the exact model name.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
  };
}

function decodeHanserSingleLetterCalendarMonthImport(serial: string): DecodeResult {
  const monthCode = serial[0];
  const yearDigit = serial[1];
  const batchCode = serial[2];
  const sequence = serial.slice(3);
  const year = 2000 + parseInt(yearDigit, 10);
  const month = CALENDAR_MONTH_CODE_MAP[monthCode];
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: `Hanser-era Korean import production batch/filler code ${batchCode}`,
    country: 'South Korea',
    notes: `Hanser-era B.C. Rich import format interpreted as calendar month letter + year digit + batch/filler digit + sequence. ${monthCode} indicates ${month}; digit ${yearDigit} indicates production year ${year}; digit ${batchCode} is treated as a batch or filler code; remaining digits are production sequence ${sequenceNumber}. This pattern is commonly associated with early-to-mid 2000s Korean-made import models, but B.C. Rich serialization is inconsistent, so verify with headstock series markings, country-of-origin labels, model features, and neck pocket or electronics-cavity dates where available.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-hanser-single-letter-calendar-month-import',
    patternLabel: 'B.C. Rich Hanser-era single-letter calendar month import',
    additionalContext: {
      title: 'B.C. Rich Hanser-era Korean import serial',
      summary: 'This serial matches a B.C. Rich import format parsed as calendar month code, year digit, batch/filler digit, and sequence.',
      highlights: [
        `The prefix ${monthCode} decodes as ${month}.`,
        `The digit ${yearDigit} decodes as production year ${year}.`,
        `The digit ${batchCode} is treated as a batch or filler code.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'B.C. Rich serial numbering is inconsistent across ownership eras and import series.',
        'This serial pattern estimates date and import family, not the exact model name.',
        'Some older B.C. Rich neck-plate serials may not encode precise dates.',
      ],
      verificationTips: [
        'Check headstock series markings such as NJ Series, Platinum, or Bronze.',
        'Look for Made in Korea or other country-of-origin markings.',
        'Compare hardware, body style, and electronics against early-to-mid 2000s B.C. Rich import catalogs.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a B.C. Rich import format parsed as calendar month code, year digit, batch/filler digit, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The prefix ${monthCode} decodes as ${month}. The digit ${yearDigit} decodes as production year ${year}. The digit ${batchCode} is treated as a batch or filler code. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across ownership eras and import series.</li><li>This pattern is commonly associated with early-to-mid 2000s Korean-made import models.</li><li>Check headstock series markings, country-of-origin labels, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
  };
}

function decodeHanserShortMonthCodeImport(serial: string): DecodeResult {
  const monthCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const sequence = serial.slice(2);
  const year = 2000 + yearDigit;
  const month = MONTH_CODE_MAP[monthCode];
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'Hanser-era import production (short month-code format)',
    country: 'China / Indonesia / South Korea',
    notes: `Short Hanser-era B.C. Rich import format parsed as month code + single year digit + 4-digit sequence. ${monthCode} indicates ${month}; digit ${yearDigit} decodes as production year ${year}; remaining digits are production sequence ${sequenceNumber}. This format is associated with Hanser Music Group import models from the mid-2000s through approximately 2016. B.C. Rich serial numbering is inconsistent across eras, so verify with headstock series markings, country-of-origin labels, and model features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-hanser-short-month-code-import',
    patternLabel: 'B.C. Rich Hanser-era short month-code import',
    additionalContext: {
      title: 'B.C. Rich Hanser-era short month-code serial',
      summary: `This serial matches a short Hanser-era B.C. Rich import format parsed as month code, single year digit, and 4-digit production sequence.`,
      highlights: [
        `The month code ${monthCode} decodes as ${month}.`,
        `The digit ${yearDigit} decodes as production year ${year}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'B.C. Rich serial numbering is inconsistent across ownership eras and import series.',
        'This format is associated with Hanser Music Group import production, typically mid-2000s through 2016.',
        'The serial identifies date and import family, not the exact model name.',
      ],
      verificationTips: [
        'Check headstock series markings such as NJ Series, Platinum, or Bronze.',
        'Look for Made in China, Made in Indonesia, or Made in Korea markings.',
        'Compare hardware, body style, and electronics against mid-2000s B.C. Rich import catalogs.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a short Hanser-era B.C. Rich import format parsed as month code, single year digit, and 4-digit production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The month code ${monthCode} decodes as ${month}. The digit ${yearDigit} decodes as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across ownership eras.</li><li>This format is typically associated with Hanser Music Group import models from the mid-2000s through approximately 2016.</li><li>Check headstock series markings, country-of-origin labels, and model features.</li></ul>`,
  };
}

function decodeShortMonthCodeImport(serial: string): DecodeResult {
  const monthCode = serial[0];
  const yearDigits = serial.slice(1, 3);
  const batchCode = serial[3];
  const sequence = serial.slice(4);
  const yearNum = parseInt(yearDigits, 10);
  const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
  const month = MONTH_CODE_MAP[monthCode];

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: `Import production batch/factory code ${batchCode}`,
    country: 'South Korea / China / Indonesia',
    notes: `Short modern B.C. Rich month-code import format. ${monthCode} indicates ${month}; digits ${yearDigits} indicate ${year}; digit ${batchCode} is treated as a factory or batch code; production sequence: ${sequence}. If this serial is on an older neck plate, it could instead be a pre-2000 F-prefix import/Class Axe-era number, so verify with headstock markings, country-of-origin labels, and neck pocket or electronics-cavity dates.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-short-modern-month-code-import',
    patternLabel: 'B.C. Rich short modern month-code import',
    additionalContext: {
      title: 'B.C. Rich short month-code serial',
      summary: 'This serial matches a short modern B.C. Rich import format parsed as month code, year, batch/factory code, and production sequence.',
      highlights: [
        `The prefix ${monthCode} decodes as ${month}.`,
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The digit ${batchCode} is treated as a factory or batch code.`,
        `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'B.C. Rich used inconsistent import serial systems across ownership eras.',
        'F-prefix serials can also appear on older pre-2000 imports where the code may not follow this modern date format.',
        'Use the physical serial location, country marking, and model era to choose between the modern and older interpretations.',
      ],
      verificationTips: [
        'If the serial is on the back of the headstock, the modern month-code interpretation is more likely.',
        'If the serial is on a metal neck plate, treat the older import/Class Axe-era interpretation as possible.',
        'Check neck pocket or electronics-cavity dates when available.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a short modern B.C. Rich import format parsed as month code, year, batch/factory code, and production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The prefix ${monthCode} decodes as ${month}. The digits ${yearDigits} decode as production year ${year}. The digit ${batchCode} is treated as a factory or batch code. The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich used inconsistent import serial systems across ownership eras.</li><li>F-prefix serials can also appear on older pre-2000 imports where the code may not follow this modern date format.</li><li>Use the physical serial location, country marking, and model era to choose between the modern and older interpretations.</li></ul>`,
  };
}

function decodeBPrefixMonthCodeImport(serial: string): DecodeResult {
  const factoryPrefix = serial[0];
  const monthCode = serial[1];
  const yearDigits = serial.slice(2, 4);
  const sequence = serial.slice(4);
  const yearNum = parseInt(yearDigits, 10);
  const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
  const month = MONTH_CODE_MAP[monthCode];

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'China import production (B-prefix factory/line)',
    country: 'China',
    notes: `B-prefix modern B.C. Rich import format interpreted as factory/line prefix + month code + YY + sequence. ${factoryPrefix} is treated as a Chinese import factory or production-line prefix; ${monthCode} indicates ${month}; digits ${yearDigits} indicate production year ${year}; remaining digits are production sequence ${parseInt(sequence, 10)}. B.C. Rich import serials from this era can be inconsistent, so verify with country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-b-prefix-month-code-import',
    patternLabel: 'B.C. Rich B-prefix month-code import',
    additionalContext: {
      title: 'B.C. Rich B-prefix import serial',
      summary: 'This serial matches a modern B.C. Rich import format parsed as B-prefix factory/line code, month letter, production year, and sequence.',
      highlights: [
        `${factoryPrefix} is treated as a Chinese import factory or production-line prefix.`,
        `The month code ${monthCode} decodes as ${month}.`,
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'B.C. Rich serial numbering is inconsistent across import eras and ownership periods.',
        'This serial pattern identifies likely date and import family, not the exact model name.',
        'Some bolt-on budget models used serial systems that are less reliable than factory date stamps.',
      ],
      verificationTips: [
        'Check for Made in China or other country-of-origin markings near the serial or on the headstock.',
        'Compare body shape, pickups, bridge, and trim against late-2000s B.C. Rich import catalogs.',
        'Use neck pocket, electronics-cavity, or label dates if the instrument has them.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern B.C. Rich import format parsed as B-prefix factory/line code, month letter, production year, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>${factoryPrefix} is treated as a Chinese import factory or production-line prefix. The month code ${monthCode} decodes as ${month}. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across import eras and ownership periods.</li><li>This serial pattern identifies likely date and import family, not the exact model name.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
  };
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

function decodeFSixDigitImport(serial: string): DecodeResult {
  const prefix = serial[0];
  const yearDigits = serial.slice(1, 3);
  const sequence = serial.slice(3);
  const yearNum = parseInt(yearDigits, 10);
  const modernYear = 2000 + yearNum;
  const earlyYear = 2000 + parseInt(yearDigits[0], 10);
  const yearText = yearNum >= 10
    ? `${modernYear} or ${earlyYear} (context-dependent import estimate)`
    : `${modernYear} (estimated)`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: yearText,
    factory: `${prefix}-prefix import production`,
    country: 'South Korea / China / Taiwan',
    notes: `F-prefix six-digit B.C. Rich import format interpreted as factory/line prefix + year code + sequence. ${prefix} is treated as an import factory, line, or product-tier prefix; digits ${yearDigits} can indicate ${modernYear}, or ${earlyYear} on early-2000s Hanser-era examples; remaining digits are production sequence ${parseInt(sequence, 10)}. If this serial is stamped on a metal neck plate, it may instead be a Class Axe-era import plate where the number is a non-date inventory ID. Verify with serial location, country-of-origin markings, neck construction, and model-era features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-f-prefix-six-digit-import',
    patternLabel: 'B.C. Rich F-prefix six-digit import',
    additionalContext: {
      title: 'B.C. Rich F-prefix import serial',
      summary: 'This serial matches an F-prefix B.C. Rich import format that can represent a Hanser-era factory/date code or an older Class Axe-era plate number depending on where it appears.',
      highlights: [
        `${prefix} is treated as an import factory, line, or product-tier prefix.`,
        `The digits ${yearDigits} can indicate ${modernYear}, or ${earlyYear} on early-2000s examples.`,
        `The remaining digits decode as production sequence ${parseInt(sequence, 10)} in the date-code interpretation.`,
      ],
      caveats: [
        'B.C. Rich serial numbering is inconsistent across import eras and ownership periods.',
        'If this is on a metal bolt-on neck plate, the number may be a Class Axe-era inventory ID rather than a date code.',
        'This serial pattern identifies likely import family, not the exact model name.',
      ],
      verificationTips: [
        'Check whether the serial is printed on the headstock wood or stamped on a metal neck plate.',
        'Look for Made in Korea, China, Taiwan, or Indonesia markings.',
        'Compare body shape, neck construction, pickups, bridge, and trim against B.C. Rich import catalogs.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an F-prefix B.C. Rich import format that can represent a Hanser-era factory/date code or an older Class Axe-era plate number depending on where it appears.</p><h3>How This Pattern Is Typically Read</h3><p>${prefix} is treated as an import factory, line, or product-tier prefix. The digits ${yearDigits} can indicate ${modernYear}, or ${earlyYear} on early-2000s examples. The remaining digits decode as production sequence ${parseInt(sequence, 10)} in the date-code interpretation.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across import eras and ownership periods.</li><li>If this is on a metal bolt-on neck plate, the number may be a Class Axe-era inventory ID rather than a date code.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
  };
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

function decodeNineDigitImport(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const monthDigits = serial.substring(2, 4);
  const sequence = serial.substring(4);
  const yearNum = parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);
  const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
  const isValidMonth = monthNum >= 1 && monthNum <= 12;
  const monthName = isValidMonth ? MONTH_NAME(monthNum) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    ...(monthName ? { month: monthName } : {}),
    factory: 'Import production (Korea, China, or Indonesia)',
    country: 'South Korea / China / Indonesia',
    notes: `9-digit numeric B.C. Rich import format (YYMMXXXXX). The digits ${yearDigits} indicate ${year}; ${monthDigits} indicates ${isValidMonth ? monthName : `an unrecognized batch code (not a standard calendar month)`}; ${sequence} is the factory sequence number (${sequenceNumber}). This format is associated with mid-to-late 2000s Korean and Chinese import models. Verify with headstock series markings, country-of-origin labels, and body/neck construction details.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-9-digit-import-yymm-sequence',
    patternLabel: 'B.C. Rich 9-digit import YYMM sequence',
    additionalContext: {
      title: 'B.C. Rich 9-digit import serial',
      summary: 'This serial matches a 9-digit B.C. Rich import format where the first four digits encode the production year and month.',
      highlights: [
        `The digits ${yearDigits} decode as production year ${year}.`,
        isValidMonth
          ? `The digits ${monthDigits} decode as ${monthName}.`
          : `The digits ${monthDigits} are an unrecognized batch code, not a standard calendar month.`,
        `The remaining digits decode as factory sequence number ${sequenceNumber}.`,
      ],
      caveats: [
        'B.C. Rich import serial numbering is inconsistent across ownership eras.',
        'This serial identifies date and import family, not the exact model name or series tier.',
        'Common shapes from this era include Warlock, Mockingbird, Bich, and Beast in Bronze, Platinum, or NJ lines.',
      ],
      verificationTips: [
        'Check the headstock or truss-rod cover for series name markings.',
        'Look for "Made in Korea", "Made in China", or "Made in Indonesia" on the back of the headstock.',
        'Compare body shape, hardware, and pickups against B.C. Rich import catalogs from the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 9-digit B.C. Rich import format where the first four digits encode the production year and month.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${isValidMonth ? monthName : 'an unrecognized batch code, not a standard calendar month'}. The remaining digits decode as factory sequence number ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>B.C. Rich import serial numbering is inconsistent across ownership eras.</li><li>Check the headstock or truss-rod cover for series name markings.</li><li>Look for country-of-origin markings and compare the guitar against B.C. Rich import catalogs from ${year}.</li></ul>`,
  };
}

function decodeHanserEraNumericImport(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const quarterDigit = parseInt(serial[1], 10);
  const production = serial.slice(2);

  const year = 2000 + yearDigit;
  const alternateYear = 2010 + yearDigit;
  const quarter = quarterDigit >= 1 && quarterDigit <= 4 ? `Q${quarterDigit}` : undefined;
  const yearText = yearDigit <= 5
    ? `${year} or ${alternateYear} (likely ${year} for mid-2000s Hanser-era imports)`
    : `${year} (likely import estimate)`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: yearText,
    factory: 'Hanser-era import production',
    country: 'South Korea / China / Indonesia',
    notes: `8-digit B.C. Rich import date-stamp format commonly seen on Hanser-era bolt-on/import models. First digit "${serial[0]}" is the year code, second digit "${serial[1]}" is the quarter${quarter ? ` (${quarter})` : ''}, and the remaining digits are production sequence ${parseInt(production, 10)}. A leading Sr# or serial-number label is not part of the serial. B.C. Rich import records are inconsistent, so confirm with country-of-origin markings, neck plate or sticker location, and model-era features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-hanser-era-8-digit-import',
    patternLabel: 'B.C. Rich Hanser-era 8-digit import',
    additionalContext: {
      title: 'B.C. Rich 8-digit import serial',
      summary: 'This serial matches an 8-digit B.C. Rich import format often associated with Hanser-era bolt-on and import models.',
      highlights: [
        `The first digit ${serial[0]} is interpreted as the year code: ${yearText}.`,
        quarter ? `The second digit ${serial[1]} is interpreted as ${quarter}.` : `The second digit ${serial[1]} is not a clean Q1-Q4 quarter code.`,
        `The remaining digits decode as production sequence ${parseInt(production, 10)}.`,
      ],
      caveats: [
        'B.C. Rich import serial numbering is inconsistent across ownership eras.',
        'This format helps estimate date and import family, not the exact model name.',
        'Neck-plate and sticker serials on budget imports can be less authoritative than factory date stamps.',
      ],
      verificationTips: [
        'Check for a country-of-origin sticker or stamp near the serial.',
        'Compare the logo, neck plate, bridge, and pickups against mid-2000s and mid-2010s B.C. Rich catalogs.',
        'Inspect the neck pocket or electronics cavity for additional date markings when available.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an 8-digit B.C. Rich import format often associated with Hanser-era bolt-on and import models.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${serial[0]} is interpreted as the year code: ${yearText}. ${quarter ? `The second digit ${serial[1]} is interpreted as ${quarter}.` : `The second digit ${serial[1]} is not a clean Q1-Q4 quarter code.`} The remaining digits decode as production sequence ${parseInt(production, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich import serial numbering is inconsistent across ownership eras.</li><li>This format helps estimate date and import family, not the exact model name.</li><li>Check country-of-origin markings, model features, and neck pocket or electronics-cavity dates where available.</li></ul>`,
  };
}

function decodeUSA5Digit(serial: string): DecodeResult {
  const yearDigits = serial.slice(0, 2);
  const sequence = serial.slice(2);
  const yearNum = parseInt(yearDigits, 10);

  // B.C. Rich 5-digit neck-through serials can drift ahead of actual build year
  // in the early/mid-1980s due to numbering inconsistencies.
  if (yearNum >= 30 && yearNum <= 49) {
    const apparentYear = 1950 + yearNum;
    const likelyStart = apparentYear - 4;
    const likelyEnd = apparentYear - 3;

    const info: GuitarInfo = {
      brand: 'B.C. Rich',
      serialNumber: serial,
      year: `${likelyStart}-${likelyEnd} (estimated)`,
      factory: 'USA (neck-through)',
      country: 'United States',
      notes: `5-digit USA neck-through format (YYXXX). Production sequence: ${sequence}. Apparent code "${yearDigits}" often reads as ${apparentYear}, but known B.C. Rich serial drift in this era means actual production is typically earlier (about 3-4 years), so this is estimated as ${likelyStart}-${likelyEnd}.`,
    };

    return { success: true, info };
  }

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

function decodeClassAxeCA(serial: string): DecodeResult {
  const sequence = serial.slice(2);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '1989–1993',
    factory: 'Class Axe-era import production (Class Axe Inc., licensed distributor)',
    country: 'South Korea or Japan',
    notes: `CA prefix on B.C. Rich serial numbers stands for Class Axe, the company that held the B.C. Rich licensing and distribution rights from 1989 to 1993. The digits ${sequence} are a sequential production number (${sequenceNumber}) within that era. Class Axe records were inconsistent, so the number does not reliably encode a precise month or year. During this period the brand transitioned from high-end USA custom shop instruments to high-volume import models. Bolt-on neck construction is a strong indicator of a budget Korean or Japanese import; set-neck or neck-through construction suggests a higher-tier model. The presence of an L.A., California address on a neck plate does not confirm USA origin — many Class Axe import neck plates carried that address despite being manufactured overseas.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-class-axe-ca-prefix',
    patternLabel: 'B.C. Rich Class Axe-era CA-prefix serial (1989–1993)',
    additionalContext: {
      title: 'B.C. Rich Class Axe CA-prefix serial',
      summary: 'CA stands for Class Axe, the licensed B.C. Rich distributor from 1989 to 1993. The following digits are a sequential production number from that era.',
      highlights: [
        'CA explicitly identifies this as a Class Axe-era B.C. Rich (1989–1993).',
        `The digits ${sequence} are the sequential production number (${sequenceNumber}).`,
        'This era covers the brand\'s transition from USA custom shop to high-volume Asian imports.',
      ],
      caveats: [
        'Class Axe production records were notoriously inconsistent; the number does not encode an exact date.',
        'An L.A. or California address on a neck plate does not mean USA origin — Class Axe import plates often carried US addresses.',
        'Bolt-on necks are common on budget import models from this era; neck-through construction indicates a higher-tier instrument.',
      ],
      verificationTips: [
        'Check whether the neck is bolt-on (import) or neck-through (higher-tier).',
        'Look for Made in Korea or Made in Japan markings on the headstock, back of body, or neck pocket.',
        'Compare the body shape, pickups, and hardware against late-1980s to early-1990s B.C. Rich catalogs.',
        'Warlock, Mockingbird, and Virgin shapes are the most common from this era.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>CA stands for Class Axe, the licensed B.C. Rich distributor from 1989 to 1993. The following digits are a sequential production number from that era.</p><h3>How This Pattern Is Typically Read</h3><p>CA explicitly identifies this as a Class Axe-era B.C. Rich. The digits ${sequence} are sequential production number ${sequenceNumber}. Class Axe records were inconsistent, so the number does not encode an exact month or year within the 1989–1993 window.</p><h3>What To Verify</h3><ul><li>Bolt-on neck = budget import model. Neck-through construction = higher-tier instrument.</li><li>An L.A. or California address on the neck plate does not confirm USA origin; many Class Axe import plates carried US addresses.</li><li>Look for Made in Korea or Made in Japan markings on the headstock, back of body, or neck pocket.</li><li>Compare body shape, pickups, and hardware against late-1980s to early-1990s B.C. Rich catalogs.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed Class Axe-era decode. Neck construction and country-of-origin markings are the most reliable ways to separate budget imports from higher-tier instruments in this run.</p>`,
  };
}

function decodeClassAxeBC(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '1990s-early 2000s (estimated)',
    factory: 'Import production (Class Axe / post-Class Axe era)',
    country: 'South Korea / China',
    notes: 'BC-prefixed bolt-on/import serial commonly seen on Class Axe-era and later budget B.C. Rich models. These generally do not encode a precise build date, so treat the 1990s-early 2000s range as an estimate and confirm with country-of-origin stickers, neck plate markings, and model-era features.',
  };

  return { success: true, info };
}

function decodeClassAxeB(serial: string): DecodeResult {
  const sequence = serial.slice(1);
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '1989-1993 (estimated)',
    factory: 'Class Axe-era import production',
    country: 'South Korea / Japan',
    notes: `B-prefixed serial used on many late-1980s to early-1990s bolt-on B.C. Rich imports, especially Class Axe-era and related import neck-plate formats. The digits are treated as a production or neck-plate sequence (${parseInt(sequence, 10)}) rather than a reliable encoded date. These serials are often inconsistent or non-sequential, so confirm with headstock markings, neck plate style, country-of-origin stickers, wood construction, and electronics-cavity or neck-pocket clues.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-class-axe-b-prefix-import',
    patternLabel: 'B.C. Rich Class Axe-era B-prefix import',
    additionalContext: {
      title: 'B.C. Rich B-prefix import serial',
      summary: 'This serial matches a B-prefixed Class Axe-era import format commonly seen on late-1980s to early-1990s B.C. Rich bolt-on models.',
      highlights: [
        'The B prefix is treated as a Class Axe-era/import neck-plate prefix.',
        'The likely manufacturing window is 1989-1993.',
        `The remaining digits are treated as production or neck-plate sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'B.C. Rich serial records from this era are inconsistent and often not sequential.',
        'The serial can support an era estimate, but it should not be treated as an exact production date.',
        'Some budget imports from this period used lower-cost construction, so physical inspection matters.',
      ],
      verificationTips: [
        'Check whether the guitar is a bolt-on import and whether the serial appears on a neck plate.',
        'Look for country-of-origin stickers or stamps.',
        'Inspect the electronics cavity or neck pocket for wood construction and additional date markings.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a B-prefixed Class Axe-era import format commonly seen on late-1980s to early-1990s B.C. Rich bolt-on models.</p><h3>How This Pattern Is Typically Read</h3><p>The B prefix is treated as a Class Axe-era/import neck-plate prefix. The likely manufacturing window is 1989-1993. The remaining digits are treated as production or neck-plate sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial records from this era are inconsistent and often not sequential.</li><li>The serial can support an era estimate, but it should not be treated as an exact production date.</li><li>Check bolt-on construction, neck plate style, country markings, and electronics-cavity or neck-pocket clues.</li></ul>`,
  };
}

function decodeBWithTrailingLetter(serial: string): DecodeResult {
  const digits = serial.slice(1, -1);
  const suffix = serial.slice(-1);
  const sequenceNumber = parseInt(digits, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '1980s-1990s (estimated)',
    factory: 'Class Axe / Korean import facility (B-prefix series)',
    country: 'South Korea',
    notes: `B-prefix serial with trailing letter suffix "${suffix}". The B prefix indicates the Class Axe or early Korean import era. The trailing letter is a factory code or production-run designation. Sequence: ${sequenceNumber}. Confirm with headstock markings, neck plate style, and country-of-origin markings.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-b-prefix-trailing-letter-import',
    patternLabel: 'B.C. Rich B-prefix import with trailing letter suffix',
    additionalContext: {
      title: 'B.C. Rich B-prefix serial with letter suffix',
      summary: 'This serial matches a B-prefixed B.C. Rich import format where the trailing letter is a factory code or run designation.',
      highlights: [
        'The B prefix with a trailing letter suffix is associated with Class Axe or Korean import production.',
        `The trailing letter "${suffix}" identifies the factory line or production run code.`,
        `The numeric portion ${sequenceNumber} is treated as the production sequence.`,
        'The likely manufacturing window is the 1980s to mid-1990s.',
      ],
      caveats: [
        'B.C. Rich serial records from this era are inconsistent and not fully documented.',
        'The trailing letter suffix convention is not officially published; treat as a production-line marker.',
        'Physical inspection of construction, hardware, and country markings is the best confirmation method.',
      ],
      verificationTips: [
        'Check whether the serial appears on a bolt-on neck plate or stamped on the body.',
        'Look for "Made in Korea" or other country-of-origin markings.',
        'Compare hardware, pickups, and construction style against known Class Axe-era examples.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a B-prefixed B.C. Rich import format where a trailing letter identifies a factory line or production run code.</p><h3>How This Pattern Is Typically Read</h3><p>The B prefix with trailing letter "${suffix}" is associated with Class Axe or Korean import production from the 1980s to mid-1990s. The numeric portion ${sequenceNumber} is the production sequence. The trailing letter is a factory code or run designation not publicly documented by B.C. Rich.</p><h3>What To Verify</h3><ul><li>Check whether the serial appears on a bolt-on neck plate or stamped directly on the body.</li><li>Look for "Made in Korea" or other country-of-origin markings on the body or neck pocket.</li><li>Compare hardware, pickups, and construction style against known Class Axe-era examples.</li></ul>`,
  };
}

function decodeSISamilIndonesiaImport(serial: string): DecodeResult {
  const yearDigits = serial.substring(2, 4);
  const monthDigits = serial.substring(4, 6);
  const sequence = serial.substring(6);
  const yearNum = parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);
  const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
  const isValidMonth = monthNum >= 1 && monthNum <= 12;
  const monthName = isValidMonth ? MONTH_NAME(monthNum) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    ...(monthName ? { month: monthName } : {}),
    factory: 'Samil (Indonesian contract factory)',
    country: 'Indonesia',
    notes: `SI-prefix B.C. Rich import format. "SI" identifies the Samil contracted factory in Indonesia. The digits "${yearDigits}" indicate ${year}; "${monthDigits}" indicates ${isValidMonth ? monthName : 'a production batch code'}; "${sequence}" is the factory sequence number (${sequenceNumber}). This format is associated with mid-2000s Indonesian B.C. Rich import models in the Bronze or Platinum series. Verify with headstock markings, country-of-origin labels, and body/neck construction details.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-si-indonesia-yymm-sequence',
    patternLabel: 'B.C. Rich SI Indonesia YYMM sequence',
    additionalContext: {
      title: 'B.C. Rich SI-prefix Indonesian import serial',
      summary: 'This serial matches the B.C. Rich SI-prefix import format from the Samil contracted factory in Indonesia.',
      highlights: [
        '"SI" identifies the Samil contracted factory in Indonesia.',
        `The digits "${yearDigits}" decode as production year ${year}.`,
        isValidMonth
          ? `The digits "${monthDigits}" decode as ${monthName}.`
          : `The digits "${monthDigits}" appear to be a production batch code, not a standard calendar month.`,
        `The remaining digits decode as factory sequence number ${sequenceNumber}.`,
      ],
      caveats: [
        'This serial identifies factory origin, year, month, and sequence — not the exact model name or series tier.',
        'Common shapes from this era include Warlock, Mockingbird, and Beast in Bronze or Platinum lines.',
        'B.C. Rich import serial numbering varied across ownership eras; verify with physical instrument markings.',
      ],
      verificationTips: [
        'Check the headstock or truss-rod cover for series name markings (Bronze, Platinum, NJ).',
        'Look for "Made in Indonesia" on the back of the headstock.',
        `Compare body shape, hardware, and pickups against B.C. Rich import catalogs from ${year}.`,
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the B.C. Rich SI-prefix import format from the Samil contracted factory in Indonesia.</p><h3>How This Pattern Is Typically Read</h3><p>"SI" identifies the Samil contracted factory in Indonesia. The digits "${yearDigits}" decode as production year ${year}. The digits "${monthDigits}" indicate ${isValidMonth ? monthName : 'a production batch code'}. The remaining digits decode as factory sequence number ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock or truss-rod cover for series name markings (Bronze, Platinum, NJ).</li><li>Look for "Made in Indonesia" on the back of the headstock.</li><li>Compare body shape, hardware, and pickups against B.C. Rich import catalogs from ${year}.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed Indonesian B.C. Rich import decode. Verify the exact series and model from headstock markings and physical features.</p>`,
  };
}

function decodeIShortImport(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const monthDigits = serial.slice(2, 4);
  const monthValue = parseInt(monthDigits, 10);
  const sequence = serial.slice(4);

  const year = 2000 + yearDigit;
  const monthText = monthValue >= 1 && monthValue <= 12 ? MONTH_NAME(monthValue) : undefined;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: year.toString(),
    month: monthText,
    factory: 'Import production (I-prefix short format)',
    country: 'Asia (factory unspecified)',
    notes: `Short I-prefix import format interpreted as I + Y + MM + sequence. Parsed as ${year}${monthText ? `, ${monthText}` : ''} with sequence ${sequence}. B.C. Rich serial records are inconsistent across eras, so treat this as an estimate and confirm with headstock/soundhole country markings.`,
  };

  return { success: true, info };
}

function decodeShortNumericImport(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const fillerDigit = serial[1];
  const quarterDigit = parseInt(serial[2], 10);
  const sequence = serial.slice(3);
  const year = 2000 + yearDigit;
  const quarter = quarterDigit >= 1 && quarterDigit <= 4 ? `Q${quarterDigit}` : undefined;
  const quarterNote = quarter
    ? `third digit indicates ${quarter}`
    : `third digit "${serial[2]}" does not map cleanly to Q1-Q4`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: `${year} (likely import estimate)`,
    factory: 'Early-2000s import production',
    country: 'South Korea / China / Indonesia',
    notes: `Short 6-digit numeric B.C. Rich import format. Most likely interpretation: first digit indicates ${year}, second digit "${fillerDigit}" is commonly treated as a placeholder, ${quarterNote}, and final digits are production sequence ${sequence}. Because B.C. Rich serial records are inconsistent, this can overlap with Class Axe-era neck-plate numbers; verify with country-of-origin markings, headstock logo details, and neck pocket or electronics-cavity dates.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-short-numeric-import-y-filler-quarter-sequence',
    patternLabel: 'B.C. Rich short numeric import',
    additionalContext: {
      title: 'B.C. Rich short numeric serial',
      summary: 'This 6-digit serial fits an early-2000s B.C. Rich import interpretation, with a possible Class Axe-era ambiguity.',
      highlights: [
        `The first digit ${serial[0]} is interpreted as production year ${year}.`,
        `The second digit ${fillerDigit} is commonly treated as a placeholder in this format.`,
        quarter ? `The third digit ${serial[2]} is interpreted as ${quarter}.` : `The third digit ${serial[2]} is not a clean quarter code.`,
        `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'B.C. Rich serial records are inconsistent across import eras.',
        'A 6-digit neck-plate serial can also indicate a late-1980s to early-1990s Class Axe-era instrument.',
        'Use physical markings to separate early-2000s imports from older Class Axe-era examples.',
      ],
      verificationTips: [
        'Check for a Made In marking or country-of-origin sticker.',
        'Inspect the headstock logo and any TM mark for Class Axe-era clues.',
        'Look in the neck pocket or electronics cavity for handwritten dates or inspector marks.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 6-digit serial fits an early-2000s B.C. Rich import interpretation, with a possible Class Axe-era ambiguity.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${serial[0]} is interpreted as production year ${year}. The second digit ${fillerDigit} is commonly treated as a placeholder. ${quarter ? `The third digit ${serial[2]} is interpreted as ${quarter}.` : `The third digit ${serial[2]} is not a clean quarter code.`} The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial records are inconsistent across import eras.</li><li>A 6-digit neck-plate serial can also indicate a late-1980s to early-1990s Class Axe-era instrument.</li><li>Check country-of-origin markings, logo details, and neck pocket or electronics-cavity dates.</li></ul>`,
  };
}

function decodeSevenDigitNumericImport(serial: string): DecodeResult {
  const firstDigit = serial[0];
  const sequence = serial.slice(2);
  const sequenceNumber = parseInt(sequence, 10);
  const decadeYear = 2000 + parseInt(firstDigit, 10);
  const alternateDecadeYear = 2010 + parseInt(firstDigit, 10);
  const yearText = `${decadeYear} or ${alternateDecadeYear} (broad import estimate; serial may be arbitrary)`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: yearText,
    factory: 'Hanser-era/import production',
    country: 'South Korea / China',
    notes: `Seven-digit numeric B.C. Rich import format. Many 7-digit import serials beginning with 0, 1, or 2 from this era were assigned inconsistently and may be arbitrary factory or neck-plate numbers rather than precise date codes. The first digit ${firstDigit} can suggest ${decadeYear} or ${alternateDecadeYear} on some examples, but the serial alone should be treated as a broad Hanser-era/import indicator. Remaining digits are treated as sequence ${sequenceNumber}. Verify with Made in Korea or Made in China markings, headstock logo details, model features, and neck pocket, pickup-cavity, or electronics-cavity dates where available.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-7-digit-numeric-import-yy-sequence',
    patternLabel: 'B.C. Rich 7-digit numeric import',
    additionalContext: {
      title: 'B.C. Rich 7-digit numeric serial',
      summary: 'This serial matches a seven-digit numeric B.C. Rich import format commonly associated with Korean or Chinese import production, but it may not encode an exact production date.',
      highlights: [
        `The first digit ${firstDigit} can suggest ${decadeYear} or ${alternateDecadeYear} on some import examples.`,
        `The remaining digits are treated as sequence ${sequenceNumber}.`,
        'This format is generally associated with import models rather than USA neck-through serial systems.',
      ],
      caveats: [
        'B.C. Rich serial numbering is inconsistent across ownership eras and import series.',
        'Some 7-digit numeric import serials appear to be arbitrary factory or neck-plate numbers rather than reliable date codes.',
        'This format supports a broad import-era identification, not the exact year or model name.',
      ],
      verificationTips: [
        'Look for Made in Korea or Made in China markings on the back of the headstock.',
        'Compare hardware, electronics, headstock logo, and body style against 2000s B.C. Rich import catalogs.',
        'Check pickup-cavity, neck pocket, or electronics-cavity markings if the instrument can be inspected safely.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a seven-digit numeric B.C. Rich import format commonly associated with Korean or Chinese import production, but it may not encode an exact production date.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${firstDigit} can suggest ${decadeYear} or ${alternateDecadeYear} on some import examples. The remaining digits are treated as sequence ${sequenceNumber}. This format is generally associated with import models rather than USA neck-through serial systems.</p><h3>What To Verify</h3><ul><li>B.C. Rich serial numbering is inconsistent across ownership eras and import series.</li><li>Some 7-digit numeric import serials appear to be arbitrary factory or neck-plate numbers rather than reliable date codes.</li><li>Check country-of-origin markings, model features, and pickup-cavity, neck pocket, or electronics-cavity dates where available.</li></ul>`,
  };
}

function decodeNJSeries(serial: string): DecodeResult {
  const prefix = serial[0];
  const yearDigits = serial.slice(1, 3);
  const sequence = serial.slice(3);
  const yearNum = parseInt(yearDigits, 10);
  const year = `19${yearDigits}`;

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    factory: yearNum >= 83 && yearNum <= 93 ? 'NJ Series Japan (early years) or Korea (later Class Axe-era reissues)' : 'NJ Series Japan or Korean contractor',
    country: 'Japan or South Korea',
    notes: `NJ Series serial (${prefix} prefix). The first two digits after the prefix indicate the year. Year: ${year}. Production sequence: ${sequence}. NJ Series production originated in Japan (1983–early 1990s) and later shifted to Korean contractors. Confirm with headstock NJ Series marking and Made in Japan/Korea stamp.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-nj-series-r-prefix-japan-import',
    patternLabel: 'B.C. Rich NJ Series R/P-prefix Japan/Korea import',
    additionalContext: {
      title: 'B.C. Rich NJ Series R/P-prefix serial',
      summary: `This serial uses the B.C. Rich NJ Series R/P-prefix format. The first two digits after the prefix (${yearDigits}) indicate the production year (${year}).`,
      highlights: [
        `${prefix} prefix identifies an NJ Series or related Japan/Korea import serial.`,
        `${yearDigits} decodes as production year ${year}.`,
        `${sequence} is the production sequence number.`,
      ],
      caveats: [
        'NJ Series guitars were originally made in Japan (1983–early 1990s) and later sourced from Korean contractors during the Class Axe era.',
        'Some R-prefix serials from the 1989–1993 Class Axe era use random neck-plate stamps not tied to a specific year.',
        'The physical Made in Japan or Made in Korea stamp and headstock markings are the most reliable verification.',
      ],
      verificationTips: [
        'Check the back of the headstock or neck plate for a Made in Japan or Made in Korea country-of-origin marking.',
        'Look for an NJ Series logo printed near the B.C. Rich script on the headstock face.',
        'Remove the neck to check for a date stamp inked or stamped in the neck pocket.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This is a B.C. Rich NJ Series R/P-prefix serial. The prefix ${prefix} followed by a two-digit year code and production sequence is characteristic of Japanese-made NJ Series guitars from 1983 through the early 1990s, with some later Korean contractor production during the Class Axe era (1989–1993).</p><h3>How It Decodes</h3><p>The first two digits after the prefix decode as the production year: ${yearDigits} = ${year}. The remaining digits (${sequence}) are the production sequence number.</p><h3>Coal Creek Guitars Note</h3><p>Check the headstock for an NJ Series marking and the neck plate or back of the headstock for a country-of-origin stamp. Japanese NJ Series guitars from this era are generally considered good-quality imports with playability above the B.C. Rich budget lines.</p>`,
  };
}

function decode10DigitNumericImport(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: 'Late 1980s–1990s (estimated)',
    factory: 'Korea or China import production (bolt-on)',
    country: 'South Korea / China',
    notes: 'This 10-digit all-numeric serial is a format-valid B.C. Rich import number from the late 1980s through the 1990s. During the Class Axe era (roughly 1989–1993) and subsequent import runs, factories in Korea and China did not follow strict sequential logging. Workers frequently grabbed pre-stamped neck plates from a random box and attached them to bodies as they finished assembly — the number itself does not encode a year, factory, or sequence in a reliable way. A 10-digit all-numeric format typically indicates a budget-friendly import line such as the Platinum Series. Use headstock branding, hardware style, and wood-cavity markings to narrow down the exact model and era.',
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-10-digit-numeric-import',
    patternLabel: 'B.C. Rich 10-digit numeric import (late 1980s–1990s)',
    additionalContext: {
      title: 'B.C. Rich 10-digit import serial',
      summary: 'This is a format-valid 10-digit B.C. Rich import serial from the late 1980s through the 1990s. The number itself does not reliably encode a year, factory, or production sequence.',
      highlights: [
        'Format is consistent with bolt-on neck import models from the late 1980s through the 1990s.',
        'Typically associated with budget import lines such as the Platinum Series, NJ Series, or Bronze Series.',
        'Country of origin is South Korea or China depending on the specific production run.',
      ],
      caveats: [
        'During the Class Axe era (1989–1993) and subsequent import runs, neck plates were frequently assigned arbitrarily — the serial does not encode an exact year or factory.',
        'This format does not carry the provenance or valuation of USA Custom Shop instruments.',
        'Physical inspection is the most reliable way to identify the exact model and era.',
      ],
      verificationTips: [
        'Check headstock branding for series labels such as "Platinum Series", "NJ Series", or "Bronze Series".',
        'Unscrew the back electronics plate or neck pickup cavity cover — production dates were sometimes stamped or penciled into the raw wood.',
        'Note the bridge style: a standard hardtail, licensed Floyd Rose, or proprietary Bendmaster bridge can help place the instrument in its production era.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This is a format-valid 10-digit serial number commonly found on imported, bolt-on neck B.C. Rich guitars manufactured during the late 1980s through the 1990s.</p><h3>Why This Number Can't Be Decoded Further</h3><p>B.C. Rich serial numbers from this era are notorious for being structurally meaningless for precise dating. During the Class Axe era (roughly 1989–1993) and subsequent import production runs, factories in Korea and China did not follow strict sequential logging. Workers frequently grabbed pre-stamped neck plates from a random box and attached them to bodies as they finished assembly — the number does not encode a year, factory, or sequence in a reliable way.</p><h3>What This Format Tells You</h3><p>A 10-digit all-numeric serial like this typically indicates a budget-friendly import line such as the Platinum Series. These are great workhorse guitars but do not carry the high valuation of USA Custom Shop models.</p><h3>How to Better Identify the Guitar</h3><ul><li><strong>Headstock Branding:</strong> Look for series labels printed near the B.C. Rich script, such as "Platinum Series", "NJ Series", or "Bronze Series".</li><li><strong>Wood Cavities:</strong> Unscrew the plastic plate over the back electronics or the neck pickup cavity. Production dates were sometimes stamped or penciled into the raw wood during construction.</li><li><strong>Hardware:</strong> Note the style of the bridge — a standard hardtail, a licensed Floyd Rose, or a proprietary Bendmaster bridge common to the early 1990s.</li></ul>`,
  };
}

function decodeBWPrefixImport(serial: string): DecodeResult {
  const sequence = serial.substring(2);
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '1980s',
    factory: 'B.C. Rich import (BW-prefix series)',
    country: 'South Korea',
    notes: `BW-prefix serial number. The BW prefix appears on B.C. Rich import production, associated with the Class Axe era or a specific Korean contract manufacturing run (circa 1980s). Production sequence: ${sequence}. Exact factory and precise year cannot be determined from this format alone; verify with headstock markings, country-of-origin sticker, or neck pocket stamps.`,
  };
  return {
    success: true,
    info,
    patternKey: 'bcrich-bw-prefix-import',
    patternLabel: 'B.C. Rich BW-prefix Korean import (1980s)',
  };
}

function decodeEarlyUSA4Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);
  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year: '1970s-1980s',
    factory: 'B.C. Rich, Los Angeles, California',
    country: 'USA',
    notes: `4-digit sequential serial number. These early USA serials are associated with hand-crafted B.C. Rich guitars from the 1970s to early 1980s, when Bernie Rico numbered instruments in simple sequential order out of the Los Angeles shop. Lower numbers indicate earlier production. Unit ${num}. These guitars are highly sought after and typically feature neck-through construction, korina or mahogany bodies, and hand-wound pickups.`,
  };
  return {
    success: true,
    info,
    patternKey: 'bcrich-early-usa-4-digit-sequential',
    patternLabel: 'B.C. Rich early USA 4-digit sequential (1970s–1980s)',
  };
}

function MONTH_NAME(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1];
}

function decodeBNumericYYMM(serial: string): DecodeResult {
  // B + YY(2) + MM(2) + seq(4) — plain numeric, no month-code letter
  const yearDigits = serial.substring(1, 3);
  const monthDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const yearNum = parseInt(yearDigits, 10);
  const year = (yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum).toString();
  const monthNum = parseInt(monthDigits, 10);
  const month = monthNum >= 1 && monthNum <= 12 ? MONTH_NAME(monthNum) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'B.C. Rich',
    serialNumber: serial,
    year,
    ...(month ? { month } : {}),
    factory: 'China import production (B-prefix)',
    country: 'China',
    notes: `B-prefix numeric import format parsed as B + YY + MM + sequence. Year digits ${yearDigits} decode as ${year}${month ? `; month digits ${monthDigits} decode as ${month}` : ''}. Production sequence: ${sequenceNumber}. B.C. Rich import serials can be inconsistent; verify with country-of-origin markings and model features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'bcrich-b-prefix-numeric-yymm-import',
    patternLabel: 'B.C. Rich B-prefix plain numeric YYMM import',
    additionalContext: {
      title: 'B.C. Rich B-prefix numeric import serial',
      summary: 'This serial matches a B.C. Rich import format with B prefix followed by plain year, month, and production sequence digits.',
      highlights: [
        `Year digits ${yearDigits} decode as ${year}.`,
        month ? `Month digits ${monthDigits} decode as ${month}.` : `Month digits ${monthDigits} do not correspond to a standard calendar month.`,
        `Production sequence: ${sequenceNumber}.`,
      ],
      caveats: [
        'B.C. Rich import serial numbering is inconsistent across eras and ownership periods.',
        'This decode identifies likely production date and import family, not the exact model.',
      ],
      verificationTips: [
        'Check for Made in China or country-of-origin markings near the serial or on the headstock.',
        'Compare body shape, pickups, and hardware against B.C. Rich import catalogs from the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a B.C. Rich import format with B prefix followed by plain year, month, and production sequence digits.</p><h3>How This Pattern Is Typically Read</h3><p>Year digits ${yearDigits} decode as ${year}${month ? `. Month digits ${monthDigits} decode as ${month}` : ''}. Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>B.C. Rich import serial numbering is inconsistent across eras and ownership periods.</li><li>Check country-of-origin markings, model features, and any neck pocket or cavity dates.</li></ul>`,
  };
}
