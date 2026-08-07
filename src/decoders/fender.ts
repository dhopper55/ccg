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

  // DN prefix (American Deluxe launch, 1998-1999 — predecessor of DZ)
  const dnMatch = normalized.match(/^DN(\d)(\d+)$/);
  if (dnMatch) {
    return decodeDNPrefix(dnMatch[1], dnMatch[2], normalized);
  }

  // Z prefix (2000s)
  const zMatch = normalized.match(/^Z(\d)(\d+)$/);
  if (zMatch) {
    return decodeZPrefix(zMatch[1], zMatch[2], normalized);
  }

  // SZ prefix (Signature Series, 2000s decade)
  const szMatch = normalized.match(/^SZ(\d)(\d+)$/);
  if (szMatch) {
    return decodeSZPrefix(szMatch[1], szMatch[2], normalized);
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

  // JD prefix (modern Japan production, ~2012+): JD + 8 digits
  const jdMatch = normalized.match(/^JD(\d{2})(\d{6})$/);
  if (jdMatch) {
    return decodeJDPrefix(jdMatch[1], jdMatch[2], normalized);
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

  // Vintage L-series neck plate (1963–1965): L + sequential number
  const lVintageMatch = normalized.match(/^L(\d{3,6})$/);
  if (lVintageMatch) {
    return decodeVintageLSeries(lVintageMatch[1], normalized);
  }

  // A, B, C, etc prefixes for Japan (CIJ era); Y also used on Fender Japan
  const japanLetterMatch = normalized.match(/^([A-HY])(\d+)$/);
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

  // Squier Indonesia Cor-Tek with month letter: ICS + month-letter(A-L) + YY + 6-digit sequence
  // e.g. ICSC22001163 = Indonesia, Cor-Tek, Squier, March 2022, seq 001163
  const icsMonthLetterMatch = normalized.match(/^ICS([A-L])(\d{2})(\d{6})$/);
  if (icsMonthLetterMatch) {
    return decodeICSMonthLetterPrefix(icsMonthLetterMatch[1], icsMonthLetterMatch[2], icsMonthLetterMatch[3], normalized);
  }

  // Fender-branded Indonesia Cor-Tek: ICF + YY + 6-digit sequence (no month letter)
  // e.g. ICF21004892 = Indonesia, Cor-Tek, Fender, 2021, seq 004892
  const icfMatch = normalized.match(/^ICF(\d{2})(\d{6})$/);
  if (icfMatch) {
    return decodeICFPrefix(icfMatch[1], icfMatch[2], normalized);
  }

  // Indonesian formats (IC, ICS prefixes)
  const indoMatch = normalized.match(/^I(?:CS|C|S)?(\d{2})(\d+)$/);
  if (indoMatch) {
    return decodeIndonesianPrefix(indoMatch[1], indoMatch[2], normalized);
  }

  // Japan T-prefix: T + 6 digits (ambiguous between 1994-1995 "Made in Japan" and 2007-2008 "Made/Crafted in Japan" eras)
  const tMatch = normalized.match(/^T(\d{6})$/);
  if (tMatch) {
    return decodeTPrefix(tMatch[1], normalized);
  }

  // EVH Wolfgang (Fender-owned brand): WG + YY + 4-digit sequence + country-of-origin letter
  // e.g. WG188218M = 2018, seq 8218, M = Mexico; WG110049J = Japan
  const wgMatch = normalized.match(/^WG(\d{2})(\d{4})([A-Z])$/);
  if (wgMatch) {
    return decodeEVHWolfgangWG(wgMatch[1], wgMatch[2], wgMatch[3], normalized);
  }

  // Signature Edition (USA): SE + single year digit + 5-digit sequence
  // SE9 decals were ordered in 1989 but used on instruments through ~1994
  if (/^SE\d{6}$/.test(normalized)) {
    return decodeSignatureEditionSE(normalized);
  }

  // Grand Reward China factory for Squier: CGS + YY + 5-digit sequence (e.g. CGS0928207 = 2009)
  // C = China, G = Grand Reward factory, S = Squier brand line
  if (/^CGS\d{7}$/.test(normalized)) {
    return decodeCGSSquierGrandReward(normalized);
  }

  // Cort China factory for Fender/Squier: CC + YY + 7-digit sequence (e.g. CC210709447 = 2021)
  if (/^CC\d{9}$/.test(normalized)) {
    return decodeCortChinaCC(normalized);
  }

  // China acoustic factory CSJ prefix: C=China, SJ=factory, YY + sequence
  if (/^CSJ\d{7}$/.test(normalized)) {
    return decodeChinaCSJAcoustic(normalized);
  }

  // Fender internal part-number style: 00 + 8 digits (not date-coded serial)
  if (/^00\d{8}$/.test(normalized)) {
    return decodeInternalPartNumber(normalized);
  }

  // Custom Shop CZ prefix: sequential production number (year not encoded in serial)
  if (/^CZ\d{6,8}$/.test(normalized)) {
    return decodeCZCustomShop(normalized);
  }

  // Vintage 5-6 digit serials (pre-1976)
  if (/^\d{5,6}$/.test(normalized)) {
    return decodeVintageFender(normalized);
  }

  // Some Fender Japan acoustics from the mid-1980s use a plain 7-digit label number
  // rather than a later standardized Fender serial. These usually cannot be fully decoded,
  // but they still carry useful production clues.
  if (/^\d{7}$/.test(normalized)) {
    return decodeJapanAcousticLabelNumber(normalized);
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

function decodeVintageLSeries(sequence: string, serial: string): DecodeResult {
  const seqNum = parseInt(sequence, 10);
  let year: string;
  if (seqNum <= 20000) {
    year = '1963';
  } else if (seqNum <= 55000) {
    year = '1964';
  } else {
    year = '1965';
  }

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Fender, Fullerton, California',
    country: 'USA',
    notes: `Vintage Fender L-series neck plate serial. The "L" prefix was used from mid-1963 through 1965 on the metal neck plate. Sequence number ${seqNum} falls in the approximate range for ${year}. L1–L20000 = 1963; L20001–L55000 = 1964; L55001+ = 1965. These ranges are approximate as Fender used serial blocks non-linearly. Confirm with pot date codes, neck date stamps, and body features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-vintage-l-series-neck-plate-1963-1965',
    patternLabel: 'Fender vintage L-series neck plate 1963–1965',
    additionalContext: {
      title: 'Fender vintage L-series neck plate serial',
      summary: 'This serial matches the Fender vintage L-series neck plate format used from mid-1963 through 1965 on American-made Fender instruments.',
      highlights: [
        'The "L" prefix was used on Fender neck plates from approximately mid-1963 through 1965.',
        `Sequence ${seqNum} places this guitar in approximately ${year}.`,
        'L-series guitars were made in Fullerton, California.',
      ],
      caveats: [
        'Fender L-series serial ranges are approximate — Fender used blocks of pre-stamped necks non-linearly.',
        'Verify the year with pot date codes, the neck heel date stamp, and body features.',
        'A guitar with an L-series neck plate may have had its neck replaced — verify all components.',
      ],
      verificationTips: [
        'Check the pot date codes: the code on the back of the volume pot encodes the year and week.',
        'Look for a penciled date stamp on the heel of the neck inside the neck pocket.',
        'Compare the body contours, pickguard, tuner buttons, and pickup covers to known period examples.',
        'Consider a professional appraisal or consultation with a Fender vintage specialist for high-value instruments.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Fender vintage L-series neck plate format used from mid-1963 through 1965 on American-made Fender instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The "L" prefix was applied to neck plates from approximately mid-1963 through 1965. Sequence ${seqNum} places this guitar in approximately ${year}. Ranges: L1–L20000 (1963), L20001–L55000 (1964), L55001+ (1965). These ranges are approximate.</p><h3>What To Verify</h3><ul><li>Check pot date codes on the back of the volume pot.</li><li>Look for a neck heel date stamp inside the neck pocket.</li><li>Compare body contours, pickguard, and tuner buttons to known period examples.</li><li>Consider professional appraisal for high-value instruments.</li></ul>`,
  };
}

function decodeCZCustomShop(serial: string): DecodeResult {
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    factory: 'Fender Custom Shop, Corona, California',
    country: 'United States',
    model: 'Fender Custom Shop',
    notes: `CZ prefix identifies Fender Custom Shop instruments. The digits ${sequence} are a sequential production number. Custom Shop serials do not encode the build year in the serial itself — the date appears on the neck heel or in the case paperwork. Contact Fender Customer Relations with photos for official build record verification.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-custom-shop-cz-sequential',
    patternLabel: 'Fender Custom Shop CZ sequential',
  };
}

const EVH_WOLFGANG_COUNTRY_MAP: Record<string, string> = {
  J: 'Japan',
  M: 'Mexico',
  C: 'China',
};

function decodeEVHWolfgangWG(year: string, sequence: string, countryLetter: string, serial: string): DecodeResult {
  const fullYear = '20' + year;
  const country = EVH_WOLFGANG_COUNTRY_MAP[countryLetter] ?? `Unknown (letter code "${countryLetter}")`;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'EVH (Fender-owned brand)',
    country,
    model: 'EVH Wolfgang',
    notes: `WG prefix indicates an EVH Wolfgang model — EVH is a Fender-owned and distributed brand. Digits ${year} decode as production year ${fullYear}; ${sequence} is the production sequence; trailing letter "${countryLetter}" indicates country of origin (${country}). Note: EVH Wolfgang serials are often missed by generic Fender lookup tools since EVH is a secondary Fender-owned brand.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-evh-wolfgang-wg-yy-sequence-country',
    patternLabel: 'Fender EVH Wolfgang WG-prefix YY sequence + country letter',
    additionalContext: {
      title: 'EVH Wolfgang WG-prefix serial',
      summary: 'This serial matches the WG-prefix format used on EVH Wolfgang guitars — EVH is a brand owned, built, and distributed by Fender Musical Instruments Corporation.',
      highlights: [
        'WG identifies the EVH Wolfgang model line.',
        `The digits ${year} decode as production year ${fullYear}.`,
        `The digits ${sequence} decode as the production sequence.`,
        `The trailing letter "${countryLetter}" indicates country of origin: ${country}.`,
      ],
      caveats: [
        'EVH is a secondary Fender-owned brand and is often omitted from generic Fender serial lookup tools.',
        'Confirm the exact model (Wolfgang Standard, Special, USA, etc.) from the headstock and body features.',
      ],
      verificationTips: [
        'Check the back of the headstock for the country-of-origin marking.',
        'Compare body and hardware features against EVH Wolfgang catalog specs for the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the WG-prefix format used on EVH Wolfgang guitars. EVH is a brand owned, built, and distributed by Fender Musical Instruments Corporation.</p><h3>How This Pattern Is Typically Read</h3><p>WG identifies the EVH Wolfgang model line. The digits ${year} decode as production year ${fullYear}. The digits ${sequence} decode as the production sequence. The trailing letter "${countryLetter}" indicates country of origin: ${country}.</p><h3>What To Verify</h3><ul><li>EVH is a secondary Fender-owned brand and is often omitted from generic Fender serial lookup tools.</li><li>Confirm the exact model from the headstock and body features.</li></ul>`,
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

function decodeJapanAcousticLabelNumber(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: '1984-1987 (NOT DEFINITIVE)',
    factory: 'Fender Japan acoustic production / FujiGen-era label format',
    country: 'Japan',
    model: 'Fender Japan acoustic (Gemini-era possible)',
    notes:
      'This 7-digit number does not match the later standardized Fender serial formats. ' +
      'On many Fender Japan acoustics from the mid-1980s, a plain 7-digit number on the paper label is a production or batch-style label number rather than a traceable Fender serial. ' +
      'That means the exact year and model usually cannot be confirmed from the number alone, but it is commonly associated with mid-1980s Fender Japan acoustics, including Gemini-era instruments. ' +
      'Use the interior label wording, headstock logo style, and country-of-origin markings to narrow the exact model.',
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

function decodeDNPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '199' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Corona, California',
    country: 'USA',
    model: 'American Deluxe Series',
    notes: `DN prefix indicates the American Deluxe Series launch (1998-1999), predecessor of the DZ prefix used in the 2000s. Production sequence: ${sequence}.`
  };

  return { success: true, info };
}

function decodeSZPrefix(yearDigit: string, sequence: string, serial: string): DecodeResult {
  const year = '200' + yearDigit;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Corona, California',
    country: 'USA',
    model: 'Signature Series',
    notes: `SZ prefix indicates an American-made Signature Series instrument from the 2000s ("S" = Signature Series, "Z" = 2000s decade code, matching the Z-prefix decade convention). Production sequence: ${sequence}.`
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

function decodeJDPrefix(yearDigits: string, sequence: string, serial: string): DecodeResult {
  const fullYear = `20${yearDigits}`;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'Dyna Gakki / Fender Japan network',
    country: 'Japan',
    notes: `JD prefix indicates modern Japanese Fender production (commonly seen from around 2012 onward). Parsed as JD + YY + sequence. Year: ${fullYear}. Production sequence: ${sequence}. Confirm exact plant from model documentation and markings.`,
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
    'Y': 'Late 1980s–1990s (Japan, Crafted in Japan era)',
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

const CALENDAR_MONTH_LETTERS: Record<string, string> = {
  A: 'January', B: 'February', C: 'March', D: 'April',
  E: 'May', F: 'June', G: 'July', H: 'August',
  I: 'September', J: 'October', K: 'November', L: 'December',
};

function decodeICSMonthLetterPrefix(monthLetter: string, year: string, sequence: string, serial: string): DecodeResult {
  const fullYear = '20' + year;
  const monthName = CALENDAR_MONTH_LETTERS[monthLetter];

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    month: monthName,
    factory: 'Cor-Tek (Cort), Indonesia',
    country: 'Indonesia',
    model: 'Squier',
    notes: `ICS prefix indicates a Squier built at the Cor-Tek factory in Indonesia (I=Indonesia, C=Cor-Tek, S=Squier). Month letter "${monthLetter}" decodes as ${monthName}. Digits ${year} decode as production year ${fullYear}; ${sequence} is the production sequence. This format has been used from 2021 to current. Budget overseas-built Squiers are not always reflected in Fender's consumer-facing online serial lookup — that does not indicate a counterfeit.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-squier-ics-indonesia-month-letter-yy-sequence',
    patternLabel: 'Fender Squier ICS Indonesia month-letter YY sequence',
    additionalContext: {
      title: 'Squier ICS-prefix (Indonesia Cor-Tek) serial',
      summary: 'This serial matches the ICS-prefix format used on Squier guitars built at the Cor-Tek factory in Indonesia, used from 2021 to current.',
      highlights: [
        'ICS identifies Indonesia, Cor-Tek factory, Squier.',
        `The month letter "${monthLetter}" decodes as ${monthName}.`,
        `The digits ${year} decode as production year ${fullYear}.`,
        `The remaining digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'Budget overseas-built Squiers often do not appear in Fender\'s consumer-facing online serial lookup tool — this is normal, not a sign of a counterfeit.',
        'Confirm the exact model from the headstock decal and body features.',
      ],
      verificationTips: [
        'Check the back of the headstock for "Crafted in Indonesia".',
        'Compare body shape and hardware against Squier catalog specs for the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ICS-prefix format used on Squier guitars built at the Cor-Tek factory in Indonesia, used from 2021 to current.</p><h3>How This Pattern Is Typically Read</h3><p>ICS identifies Indonesia, Cor-Tek factory, Squier. The month letter "${monthLetter}" decodes as ${monthName}. The digits ${year} decode as production year ${fullYear}. The remaining digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Budget overseas-built Squiers often do not appear in Fender's consumer-facing online serial lookup — this is normal.</li><li>Confirm the exact model from the headstock decal and body features.</li></ul>`,
  };
}

function decodeICFPrefix(year: string, sequence: string, serial: string): DecodeResult {
  const fullYear = '20' + year;

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: fullYear,
    factory: 'Cor-Tek (Cort), Indonesia',
    country: 'Indonesia',
    notes: `ICF prefix indicates a Fender-branded instrument built at the Cor-Tek factory in Indonesia (I=Indonesia, C=Cor-Tek, F=Fender). Fender moved production of specific standard-run lines to Indonesia starting mid-2009. Digits ${year} decode as production year ${fullYear}; ${sequence} is the production sequence. Budget overseas-built Fenders are not always reflected in Fender's consumer-facing online serial lookup — that does not indicate a counterfeit.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-icf-indonesia-cortek-yy-sequence',
    patternLabel: 'Fender ICF Indonesia Cor-Tek YY sequence',
    additionalContext: {
      title: 'Fender ICF-prefix (Indonesia Cor-Tek) serial',
      summary: 'This serial matches the ICF-prefix format used on Fender-branded guitars built at the Cor-Tek factory in Indonesia, introduced mid-2009.',
      highlights: [
        'ICF identifies Indonesia, Cor-Tek factory, Fender-branded.',
        `The digits ${year} decode as production year ${fullYear}.`,
        `The remaining digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'Budget overseas-built Fenders often do not appear in Fender\'s consumer-facing online serial lookup tool — this is normal, not a sign of a counterfeit.',
        'Confirm the exact model (Stratocaster, Telecaster, bass, etc.) from the headstock decal and body features.',
      ],
      verificationTips: [
        'Check the back of the headstock for "Crafted in Indonesia".',
        'Compare body shape and hardware against Fender catalog specs for the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ICF-prefix format used on Fender-branded guitars built at the Cor-Tek factory in Indonesia, introduced mid-2009.</p><h3>How This Pattern Is Typically Read</h3><p>ICF identifies Indonesia, Cor-Tek factory, Fender-branded. The digits ${year} decode as production year ${fullYear}. The remaining digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Budget overseas-built Fenders often do not appear in Fender's consumer-facing online serial lookup — this is normal.</li><li>Confirm the exact model from the headstock decal and body features.</li></ul>`,
  };
}

function decodeTPrefix(sequence: string, serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: '1994-1995 or 2007-2008 (ambiguous)',
    factory: 'Fender Japan',
    country: 'Japan',
    notes: `T-prefix + 6 digits indicates a Fender Japan-made instrument, but the era is ambiguous between two windows: 1994-1995 ("Made in Japan" decal) or 2007-2008 (both "Made in Japan" and "Crafted in Japan" decals were used that period). Production sequence: ${sequence}. Check whether the neck decal says "Made in Japan" or "Crafted in Japan" — a "Crafted in Japan" decal points to the 2007-2008 window, since that phrase was standard from 1997 onward.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-japan-t-prefix-6digit-ambiguous-era',
    patternLabel: 'Fender Japan T-prefix 6-digit (ambiguous era)',
    additionalContext: {
      title: 'Fender Japan T-prefix serial',
      summary: 'This serial matches the Fender Japan T-prefix format, which spans two distinct, non-adjacent production windows.',
      highlights: [
        'T-prefix + 6 digits identifies Fender Japan production.',
        'The window is ambiguous: 1994-1995, or 2007-2008.',
        `The digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'A "Crafted in Japan" decal points to 2007-2008, since that phrasing was standard from 1997 onward.',
        'A plain "Made in Japan" decal without "Crafted in Japan" wording could be either era — check other hardware and construction details.',
      ],
      verificationTips: [
        'Check whether the neck decal says "Made in Japan" or "Crafted in Japan".',
        'Compare hardware, pickups, and construction details against the two candidate eras.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Fender Japan T-prefix format, which spans two distinct, non-adjacent production windows: 1994-1995 and 2007-2008.</p><h3>How This Pattern Is Typically Read</h3><p>T-prefix + 6 digits identifies Fender Japan production. The digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>A "Crafted in Japan" decal points to 2007-2008, since that phrasing was standard from 1997 onward.</li><li>A plain "Made in Japan" decal without "Crafted in Japan" wording could be either era — check other hardware and construction details.</li></ul>`,
  };
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

function decodeSignatureEditionSE(serial: string): DecodeResult {
  const yearDigit = serial.charAt(2);
  const sequence = serial.substring(3);
  const yearNum = parseInt(yearDigit, 10);
  // SE9 was ordered in 1989 but used through ~1994; SE0 would be 1990, etc.
  const baseYear = yearNum === 0 ? 1990 : 1980 + yearNum;
  const year = baseYear === 1989 ? '1989' : baseYear.toString();
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year,
    factory: 'Fender USA (Corona, California)',
    country: 'USA',
    model: 'Artist Signature Series',
    notes: `SE-prefix Fender Signature Edition serial. SE indicates an American-made artist signature model. The digit ${yearDigit} indicates a ${year} production batch. Sequence number: ${sequenceNumber}. Fender over-ordered SE9 headstock decals in 1989 and continued using them on signature models into the early-to-mid 1990s, so the actual build date may be 1989–1994 regardless of the decade digit. Common signature models using this prefix include the Eric Clapton, Yngwie Malmsteen, and Jeff Beck Stratocasters. Remove the neck and check the heel date stamp for the exact build date.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-se-signature-edition-usa-year-sequence',
    patternLabel: 'Fender SE Signature Edition USA year sequence',
    additionalContext: {
      title: 'Fender SE Signature Edition serial',
      summary: 'This serial uses the Fender SE (Signature Edition) prefix identifying an American-made artist signature model from around 1989 onward.',
      highlights: [
        `SE identifies a Fender USA artist Signature Edition instrument.`,
        `Year digit ${yearDigit} indicates a ${year} production batch code.`,
        `Sequence number: ${sequenceNumber}.`,
        'The SE9 decal batch was produced in 1989 but continued in use on signature models into the early-to-mid 1990s.',
      ],
      caveats: [
        'Because Fender over-ordered SE9 decals, the actual build date may be 1989–1994 even though the digit reads 9.',
        'The serial alone does not identify the artist signature (e.g., Clapton, Malmsteen, Beck) — confirm from the headstock logo and model features.',
        "For the exact build date, remove the neck and check the date stamp on the neck heel.",
      ],
      verificationTips: [
        'Confirm the headstock logo to identify the specific signature artist and model.',
        'Remove the neck and look for a handwritten or stamped date on the heel for the precise manufacture date.',
        'Check the back of the headstock for a Made in USA stamp.',
        'Compare the electronics, hardware, and finish against known specs for the identified signature model.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial uses the Fender SE (Signature Edition) prefix for American-made artist signature models. SE + a single year digit + a five-digit sequence number.</p><h3>How This Pattern Is Typically Read</h3><p>SE indicates a Fender USA Signature Edition instrument. Year digit ${yearDigit} indicates a ${year} production batch. Sequence number: ${sequenceNumber}. Fender over-ordered SE9 headstock decals in 1989 and continued using them through the early-to-mid 1990s, so the actual build date may span 1989–1994.</p><h3>What To Verify</h3><ul><li>Confirm the headstock logo to identify the specific signature artist and model.</li><li>Remove the neck and check the date stamp on the neck heel for the precise build date.</li><li>Verify the electronics, hardware, and finish against known specs for the identified signature model.</li></ul>`,
  };
}

function decodeCGSSquierGrandReward(serial: string): DecodeResult {
  const yearDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Grand Reward Musical Instruments, China',
    country: 'China',
    model: 'Squier (CGS prefix)',
    notes: `CGS-prefix serial identifies a Squier instrument made at the Grand Reward factory in China. C = China, G = Grand Reward factory, S = Squier brand. Year code ${yearDigits} decodes as ${year}. Production sequence: ${sequenceNumber}. Instruments with this prefix are typically Squier Classic Vibe or related China-built Squier models. Verify the model and branding from the headstock logo.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-squier-cgs-grand-reward-china-yy-sequence',
    patternLabel: 'Fender/Squier Grand Reward China CGS-prefix YY sequence',
    additionalContext: {
      title: 'Squier Grand Reward China (CGS-prefix) serial',
      summary: `This serial uses the CGS-prefix format: C=China, G=Grand Reward factory, S=Squier. Year ${year}, sequence ${sequenceNumber}.`,
      highlights: [
        'CGS: C=China, G=Grand Reward factory, S=Squier brand line.',
        `Year code ${yearDigits} decodes as ${year}.`,
        `Production sequence: unit ${sequenceNumber}.`,
        'Associated with Squier Classic Vibe and related China-built Squier models from this era.',
      ],
      caveats: [
        'CGS is a Squier prefix, not a Fender USA prefix — the headstock should say Squier.',
        'A CGS serial on a guitar with a Fender (not Squier) headstock is a counterfeit warning sign.',
        'Some Fender Modern Player China-built instruments use a CGF prefix (F=Fender) rather than CGS.',
      ],
      verificationTips: [
        'Verify the headstock reads Squier, not Fender.',
        'Check the back of the headstock for a Made in China stamp.',
        'Compare the model, hardware, and finish against Squier Classic Vibe catalog specs from the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial uses the CGS-prefix format identifying a Squier instrument made at the Grand Reward factory in China: C=China, G=Grand Reward, S=Squier.</p><h3>How It Decodes</h3><p>Year code ${yearDigits} decodes as ${year}. Production sequence: ${sequenceNumber}. This format is associated with Squier Classic Vibe and related Squier models manufactured at Grand Reward in China.</p><h3>What To Verify</h3><ul><li>Verify the headstock reads Squier — CGS is a Squier prefix, and a Fender logo with a CGS serial is a counterfeit red flag.</li><li>Check the back of the headstock for a Made in China marking.</li><li>Compare the model against Squier Classic Vibe catalog specs for ${year}.</li></ul>`,
  };
}

function decodeCortChinaCC(serial: string): DecodeResult {
  const yearDigits = serial.substring(2, 4);
  const sequence = serial.substring(4);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Cort, China (CC factory prefix)',
    country: 'China',
    notes: `CC-prefix serial identifies a Cort China factory instrument made for Fender or Squier. Format: CC + YY (production year) + 7-digit sequence. Year code ${yearDigits} decodes as ${year}. Production sequence: ${sequence} (unit ${sequenceNumber}).`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-cc-cort-china-yy-sequence',
    patternLabel: 'Fender/Squier Cort China CC-prefix YY sequence',
    additionalContext: {
      title: 'Fender/Squier Cort China (CC-prefix) serial',
      summary: `This serial uses the CC-prefix format identifying a Cort China factory instrument produced for Fender or Squier. CC = Cort China, ${yearDigits} = ${year}.`,
      highlights: [
        'CC prefix indicates the Cort manufacturing facility in China.',
        `${yearDigits} decodes as production year ${year}.`,
        `${sequence} is the production sequence number (unit ${sequenceNumber}).`,
      ],
      caveats: [
        'Cort China produces instruments for multiple brands; the exact model should be confirmed from headstock and label markings.',
        'This format is used on both Fender and Squier branded instruments from this factory.',
      ],
      verificationTips: [
        'Check the back of the headstock for "Made in China" and the Fender or Squier brand name.',
        'Compare hardware, finish, and specs against Fender/Squier China import catalog from the decoded year.',
        'Use the Fender serial number lookup tool to cross-reference this serial against indexed records.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial uses the CC-prefix format, identifying an instrument produced at the Cort manufacturing facility in China for Fender or its Squier sub-brand.</p><h3>How It Decodes</h3><p>CC identifies the Cort China factory. The digits ${yearDigits} decode as production year ${year}. The remaining seven digits (${sequence}) are the production sequence number (unit ${sequenceNumber}).</p><h3>Coal Creek Guitars Note</h3><p>Verify the brand (Fender or Squier) and model from the headstock and any interior labels. Compare the decoded year (${year}) against the catalog to confirm model specifications.</p>`,
  };
}

function decodeChinaCSJAcoustic(serial: string): DecodeResult {
  const yearDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    year: year.toString(),
    factory: 'China SJ acoustic factory',
    country: 'China',
    notes: `CSJ-prefix Fender acoustic format. C = China; SJ = factory code for the acoustic production facility (associated with T-Bucket and related Chinese acoustic lines); ${yearDigits} = ${year}; production sequence: ${sequenceNumber}. Verify model name from the headstock or interior label.`,
  };

  return {
    success: true,
    info,
    patternKey: 'fender-china-csj-yy-sequence',
    patternLabel: 'Fender China CSJ acoustic YY sequence',
    additionalContext: {
      title: 'Fender China CSJ acoustic serial',
      summary: `This serial matches the Fender China CSJ-prefix format for acoustic guitars. C=China, SJ=factory, ${yearDigits}=${year}.`,
      highlights: [
        'C identifies China; SJ identifies the acoustic production facility.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'CSJ-prefix serials are associated with acoustic models such as the T-Bucket series.',
        'The serial encodes factory, year, and sequence — not the specific model name.',
      ],
      verificationTips: [
        'Check the headstock or interior label for the model name and Made in China marking.',
        'Compare the instrument against Fender acoustic catalog specs for the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Fender China CSJ-prefix format associated with acoustic guitar production. C=China, SJ=factory code, ${yearDigits}=${year}.</p><h3>How This Pattern Is Typically Read</h3><p>C identifies China; SJ identifies the acoustic facility. The digits ${yearDigits} decode as ${year}. The remaining digits are production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock or interior label for the model name.</li><li>Look for "Made in China" on the back of the headstock.</li><li>Compare the instrument against Fender acoustic specs from ${year}.</li></ul>`,
  };
}

function decodeInternalPartNumber(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Fender',
    serialNumber: serial,
    model: 'Internal Fender part number (not date-coded serial)',
    notes: `10-digit numeric value beginning with "00" is commonly an internal Fender part/product identifier (for example on replacement components) rather than a standard date-coded guitar serial number. Use model markings, neck stamps, and component details for dating.`
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
