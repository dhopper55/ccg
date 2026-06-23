import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Jackson Guitar Serial Number Decoder
 *
 * Supports:
 * - USA Custom Shop Neck-Through (J prefix, 1983-present)
 * - USA Randy Rhoads (RR prefix, 1983-1990)
 * - USA Production (U0/UO prefix, 1990-present)
 * - USA U-series (U + 4-5 digits, late 1990s-2000s)
 * - USA Bolt-On Custom Shop (4-digit, 1986-1997)
 * - USA Bolt-On Production (6-digit 00xxxx, 1990+)
 * - Jackson Junior (JJ suffix, 1994-2000)
 * - Japan Professional (5-digit, 1990-1995)
 * - Japan Professional (6-digit, 1990-1995)
 * - Japan Professional transition (6-digit, 1996)
 * - Japan Professional late 1990s (6-digit, 98-99 prefix)
 * - Japan MIJ import numeric sequence (6-digit 7 prefix, late 1990s-2000s estimated)
 * - Japan Fusion (6-digit 90-95 prefix, 1990-1995)
 * - Japan mid-1990s MIJ (7-digit, 90-95 prefix)
 * - Japan 1996+ (7-digit, 96+ prefix)
 * - Japan Chushin 200C import format (early-mid 2000s)
 * - Indonesia (I prefix with factory codes)
 * - China (C prefix with factory codes)
 * - India (N prefix or 8-10 digit numeric)
 * - Korea (7-digit starting with 1)
 * - Taiwan (8-9 digits starting with 6)
 * - Modern 10-digit alphanumeric (2013+)
 * - Modern 3-letter prefix + 7-digit (2013+, prefix+modelCode+YY+sequence, e.g. ICJ3215352)
 * - China CWJ-prefix (CWJ + YY + sequence, 10-11 digits, 2022+)
 * - China 9-digit factory sequence (3-digit factory code + 6-digit sequence, no year encoding)
 */

// USA Neck-Through serial ranges (U0/UO prefix)
const USA_NECK_THROUGH_RANGES: { start: number; end: number; year: string }[] = [
  { start: 1, end: 852, year: '1990' },
  { start: 853, end: 1750, year: '1991' },
  { start: 1751, end: 2070, year: '1992' },
  { start: 2071, end: 2527, year: '1993' },
  { start: 2528, end: 2941, year: '1994' },
  { start: 2942, end: 3211, year: '1995' },
  { start: 3212, end: 3685, year: '1996' },
  { start: 3686, end: 4190, year: '1997' },
  { start: 4191, end: 4692, year: '1998' },
  { start: 4693, end: 5353, year: '1999' },
  { start: 5354, end: 6124, year: '2000' },
  { start: 6125, end: 6781, year: '2001' },
  { start: 6782, end: 7345, year: '2002' },
  { start: 7346, end: 7867, year: '2003' },
  { start: 7868, end: 8412, year: '2004' },
  { start: 8413, end: 8956, year: '2005' },
  { start: 8957, end: 9500, year: '2006' },
  { start: 9501, end: 10100, year: '2007' },
  { start: 10101, end: 10800, year: '2008' },
  { start: 10801, end: 11500, year: '2009' },
  { start: 11501, end: 12200, year: '2010' },
  { start: 12201, end: 13000, year: '2011' },
  { start: 13001, end: 14000, year: '2012' },
];

// USA Bolt-On serial ranges (00xxxx format)
const USA_BOLT_ON_RANGES: { start: number; end: number; year: string }[] = [
  { start: 1, end: 450, year: '1990' },
  { start: 451, end: 923, year: '1991' },
  { start: 924, end: 1135, year: '1992' },
  { start: 1136, end: 1425, year: '1993' },
  { start: 1426, end: 1789, year: '1994' },
  { start: 1790, end: 2115, year: '1995' },
  { start: 2116, end: 2567, year: '1996' },
  { start: 2568, end: 3045, year: '1997' },
  { start: 3046, end: 3523, year: '1998' },
  { start: 3524, end: 4000, year: '1999' },
  { start: 4001, end: 4500, year: '2000' },
  { start: 4501, end: 4923, year: '2001' },
];

// Indonesia factory codes
const INDONESIA_FACTORY_CODES: Record<string, string> = {
  'W': 'P.T. Wildwood',
  'S': 'Samick',
  'C': 'Cort',
  'H': 'Harmony Musical Instruments',
  'J': 'Jackson Indonesia',
};

// China factory codes
const CHINA_FACTORY_CODES: Record<string, string> = {
  'Y': 'Yako',
  'J': 'Jackson China',
};

export function decodeJackson(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Try each decoder pattern

  // USA Randy Rhoads (RR prefix, 1983-1990)
  if (/^RR\d{3,5}$/i.test(normalized)) {
    return decodeUSARandyRhoads(normalized);
  }

  // USA Player's Choice Series Randy Rhoads (PCS + 4 digits, 1993 limited run of 150)
  if (/^PCS\d{4}$/i.test(normalized)) {
    return decodeUSAPlayerChoiceSeries(normalized);
  }

  // Modern Indonesia J-prefix: J + YY + 5-digit sequence (2013+, e.g. J2245267)
  // Must be checked before USA Custom Shop J-prefix (which only matches 4-6 digits)
  if (/^J\d{7}$/i.test(normalized)) {
    return decodeModernJIndonesia(normalized);
  }

  // USA Custom Shop Neck-Through (J prefix)
  if (/^J\d{4,6}$/i.test(normalized)) {
    return decodeUSACustomNeckThrough(normalized);
  }

  // USA Production Neck-Through (U0 or UO prefix)
  if (/^U[O0]\d{4,5}$/i.test(normalized)) {
    return decodeUSANeckThrough(normalized);
  }

  // USA U-series sequential format (U + 4-5 digits)
  if (/^U\d{4,5}$/i.test(normalized)) {
    return decodeUSAUSeries(normalized);
  }

  // Jackson Junior (JJ suffix)
  if (/^\d{4}JJ$/i.test(normalized)) {
    return decodeJacksonJunior(normalized);
  }

  // Korea/Sung-Eum 4-letter NJHK prefix: NJHK + YY + sequence (e.g. NJHK08007429 = 2008)
  // Must be checked before the NHJ India handler and the 3-letter prefix handler
  if (/^NJHK\d{8}$/i.test(normalized)) {
    return decodeKoreaNJHK(normalized);
  }

  // India format (NHJ prefix — digits with optional trailing batch letter)
  if (/^NHJ\d{6,8}[A-Z]?$/i.test(normalized)) {
    return decodeIndia(normalized);
  }

  // China CWJ-prefix: CWJ + YY + sequence (7 or 8 digits after prefix = 10-11 chars total)
  // Must be checked BEFORE the generic 3-letter prefix handler, which would misparse CWJ2257232
  // as modelCode=22, yearDigits=57 → year 2057. CWJ format uses prefix-yy-seq, not modelcode-yy-seq.
  if (/^CWJ\d{7,8}$/i.test(normalized)) {
    return decodeChinaCWJ(normalized);
  }

  // Modern 3-letter prefix + 7-digit: prefix(3) + modelCode(2) + YY(2) + sequence(3)
  // Checked before the I[WSCHJ]J Indonesia and C[YJ]J China checks because serials like
  // ICJ3215352 and CYJ3215352 use the 3-letter prefix as a single country/factory/brand code.
  if (/^[A-Z]{3}\d{7}$/i.test(normalized)) {
    return decodeModern10DigitThreeLetterPrefix(normalized);
  }

  // Indonesia format (I + factory code + optional J + digits)
  if (/^I[WSCHJ]J?\d{7,8}$/i.test(normalized)) {
    return decodeIndonesia(normalized);
  }

  // China format (C + factory code + optional J + digits)
  if (/^C[YJ]J?\d{7,8}$/i.test(normalized)) {
    return decodeChina(normalized);
  }

  // Japan mid-1990s MIJ 7-digit (90-95 prefix, commonly Professional/Performer)
  if (/^9[0-5]\d{5}$/.test(normalized) && normalized.length === 7) {
    return decodeJapanMij1990to1995SevenDigit(normalized);
  }

  // Japan 7-digit (1996+, starts with 96-99 or 0x for 2000s)
  if (/^(9[6-9]|0[0-9]|1[0-9]|2[0-5])\d{5}$/i.test(normalized) && normalized.length === 7) {
    return decodeJapan1996Plus(normalized);
  }

  // Japan 7-digit bolt-on import (3-prefix, early-to-mid 1990s)
  if (/^3\d{6}$/.test(normalized) && normalized.length === 7) {
    return decodeJapanMijThreePrefix(normalized);
  }

  // Japan Professional 6-digit (1990-1995, first digit 0-5)
  if (/^[0-5]\d{5}$/.test(normalized) && normalized.length === 6) {
    return decodeJapanProfessional(normalized);
  }

  // Japan Professional 5-digit (1990-1995, first digit 0-5)
  if (/^[0-5]\d{4}$/.test(normalized) && normalized.length === 5) {
    return decodeJapanProfessionalFiveDigit(normalized);
  }

  // Japan Professional transition 6-digit (1996, first digit 6)
  if (/^6\d{5}$/.test(normalized) && normalized.length === 6) {
    return decodeJapanProfessionalTransition1996(normalized);
  }

  // Japan MIJ import numeric sequence (6-digit 7 prefix, late 1990s-2000s estimated)
  if (/^7\d{5}$/.test(normalized) && normalized.length === 6) {
    return decodeJapanMijSevenPrefixSixDigit(normalized);
  }

  // Japan Professional late-1990s 6-digit (98-99 prefix)
  if (/^9[8-9]\d{4}$/.test(normalized) && normalized.length === 6) {
    return decodeJapanMijLate1990sSixDigit(normalized);
  }

  // Japan Fusion 6-digit (90-95 prefix)
  if (/^9[0-5]\d{4}$/.test(normalized) && normalized.length === 6) {
    return decodeJapanFusion(normalized);
  }

  // Japan Chushin import format (200C + 5 digits, early-mid 2000s)
  if (/^200C\d{5}$/i.test(normalized)) {
    return decodeJapanChushin200C(normalized);
  }

  // India 8-digit (JS20/X series, 96-04 prefix)
  if (/^(9[6-9]|0[0-4])\d{6}$/.test(normalized) && normalized.length === 8) {
    return decodeIndiaNumeric8(normalized);
  }

  // Modern Indonesia/Korea 8-digit import: YY + sequence (2005-2029)
  // Must follow India check so 96xx-04xx still routes correctly
  if (/^(0[5-9]|[12]\d)\d{6}$/.test(normalized) && normalized.length === 8) {
    return decodeModernIndonesiaKorea8Digit(normalized);
  }

  // India 9-digit (JS30xx, 2004-2007 prefix)
  if (/^200[4-7]\d{5}$/.test(normalized) && normalized.length === 9) {
    return decodeIndiaNumeric9(normalized);
  }

  // China 9-digit factory sequence: 3-digit factory code + 6-digit production sequence
  // No year is encoded in this format; the factory code identifies the contracted facility.
  if (/^3\d{8}$/.test(normalized)) {
    return decodeChina3DigitFactorySequence(normalized);
  }

  // India 10-digit (JS30xx, 2008+ prefix)
  if (/^20(0[8-9]|[1-2]\d)\d{6}$/.test(normalized) && normalized.length === 10) {
    return decodeIndiaNumeric10(normalized);
  }

  // Korea 7-digit (Performers, starts with 1)
  if (/^1\d{6}$/.test(normalized) && normalized.length === 7) {
    return decodeKorea(normalized);
  }

  // Taiwan 8-9 digit JS-series format (starts with 6)
  if (/^6\d{7,8}$/.test(normalized) && (normalized.length === 8 || normalized.length === 9)) {
    return decodeTaiwan(normalized);
  }

  // USA Bolt-On Production (00xxxx format, 6 digits starting with 00)
  if (/^00\d{4}$/.test(normalized)) {
    return decodeUSABoltOnProduction(normalized);
  }

  // USA Custom Shop Bolt-On (4-digit, 1-8999 including early sub-1001 plates)
  if (/^\d{4}$/.test(normalized)) {
    const num = parseInt(normalized, 10);
    if (num >= 1 && num <= 8999) {
      return decodeUSACustomBoltOn(normalized);
    }
  }

  return {
    success: false,
    error: 'Unable to decode this Jackson serial number. The format was not recognized. Known formats include: USA Custom Shop (J/RR/PCS prefix), Indonesia J-prefix modern, Korea NJHK-prefix, 3-letter prefix modern imports (ICJ, CYJ, CWJ, etc.), NHJ India prefix, numeric Japan/Indonesia/India. Please verify the serial number is correct.',
  };
}

function decodeUSAPlayerChoiceSeries(serial: string): DecodeResult {
  const unitNum = parseInt(serial.substring(3), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: '1993',
    model: "Player's Choice Series Randy Rhoads",
    factory: 'Jackson USA (Ontario, California)',
    country: 'USA',
    notes: `Player's Choice Series (PCS) Randy Rhoads — unit ${unitNum} of 150. Jackson built only 150 of these in 1993 at the Ontario, California factory as a tribute to Randy Rhoads using exact early-1980s specifications. Factory specs include a quartersawn maple neck-through design, bound ebony fingerboard, solid brass hardware (gold/brass pickguard, V-shaped tailpiece, Tune-O-Matic bridge), scaled-down mother-of-pearl shark fin inlays, and Seymour Duncan JB (neck) and Duncan Distortion (bridge) pickups. Because of the 150-unit production run and tribute pedigree, these are highly sought-after collector instruments. Verify originality by confirming the solid brass hardware, neck-through construction, ebony fingerboard, and the matching original hardshell case when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-usa-player-choice-series-pcs',
    patternLabel: "Jackson USA Player's Choice Series Randy Rhoads (1993)",
    additionalContext: {
      title: "Jackson Player's Choice Series Randy Rhoads",
      summary: `This serial identifies a Player's Choice Series (PCS) Randy Rhoads, unit ${unitNum} of only 150 built in 1993 at the Jackson USA factory in Ontario, California.`,
      highlights: [
        "PCS stands for Player's Choice Series — a 1993 limited tribute run honoring Randy Rhoads.",
        'Only 150 were built, making this one of the rarest production Jackson models.',
        `This serial identifies unit number ${unitNum} of 150.`,
        'Factory: Jackson USA, Ontario, California, 1993.',
      ],
      caveats: [
        'Because of the rarity and collector value, verifying originality of all hardware, pickups, and case is important before purchase.',
        'The solid brass hardware (pickguard, tailpiece, bridge) is a key authentication marker — replacements significantly affect collectibility.',
        'These are not in Jackson\'s standard serial lookup and may require direct authentication from Jackson USA or a recognized collector registry.',
      ],
      verificationTips: [
        'Confirm the neck-through quartersawn maple neck and bound ebony fingerboard.',
        'Verify the solid brass hardware: gold/brass pickguard, V-shaped tailpiece, and Tune-O-Matic bridge.',
        'Check for the scaled-down mother-of-pearl shark fin inlays that match Randy\'s personal guitar specs.',
        'Look for the original hardshell case and factory hangtags, which significantly affect collector value.',
        'Cross-reference the unit number against known PCS registry entries if available.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial identifies a Player's Choice Series (PCS) Randy Rhoads — unit ${unitNum} of only 150 built in 1993 at the Jackson USA factory in Ontario, California as a tribute to Randy Rhoads using exact early-1980s specifications.</p><h3>How This Pattern Is Typically Read</h3><p>PCS stands for Player's Choice Series. The four digits encode the unit number within the 150-guitar run. This serial is unit ${unitNum} of 150. Factory specs include a quartersawn maple neck-through design, bound ebony fingerboard, solid brass hardware (gold/brass pickguard, V-shaped tailpiece, Tune-O-Matic bridge), scaled-down mother-of-pearl shark fin inlays, and Seymour Duncan JB/Duncan Distortion pickups.</p><h3>What To Verify</h3><ul><li>Confirm the neck-through quartersawn maple neck and bound ebony fingerboard.</li><li>Verify the solid brass hardware: gold/brass pickguard, V-shaped tailpiece, and Tune-O-Matic bridge — these are the primary authentication markers.</li><li>Check for the original hardshell case and factory hangtags, which significantly affect collector value.</li><li>Cross-reference the unit number against known PCS registry entries if available.</li></ul><h3>Coal Creek Guitars Note</h3><p>These command significant collector value when original and complete. Solid brass hardware, correct inlays, and an original case are the most important factors when evaluating condition and price.</p>`,
  };
}

function decodeUSARandyRhoads(serial: string): DecodeResult {
  const num = parseInt(serial.substring(2), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    model: 'Randy Rhoads',
    factory: 'Jackson USA Custom Shop',
    country: 'USA',
    notes: 'Randy Rhoads neck-through-body model. RR serial numbers were used from 1983 to spring 1990.',
  };

  // Rough year estimation based on serial progression
  if (num <= 500) {
    info.year = '1983-1985';
  } else if (num <= 1500) {
    info.year = '1985-1987';
  } else if (num <= 3000) {
    info.year = '1987-1989';
  } else {
    info.year = '1989-1990';
  }

  return { success: true, info };
}

function decodeUSACustomNeckThrough(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    factory: 'Jackson USA Custom Shop',
    country: 'USA',
    notes: 'USA Custom Shop neck-through-body guitar. J prefix serial numbers were used for non-Randy Rhoads models including Soloist, King V, Kelly, and Concert Bass.',
  };

  return { success: true, info };
}

function decodeModernJIndonesia(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const sequence = serial.substring(3);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Jackson Indonesia (PT. Cort or similar contracted facility)',
    country: 'Indonesia',
    notes: `Modern Jackson import format (2013+). J indicates Indonesian production. The digits ${yearDigits} decode as production year ${year}. The remaining digits are the sequential production number ${sequenceNumber}. This format is common on JS, X Series, and Pro Series models built in Indonesia. The serial does not encode the exact model name; verify from the headstock logo, catalog specs, and Made in Indonesia marking.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-modern-j-indonesia-yy-sequence',
    patternLabel: 'Jackson modern J-prefix Indonesia YY sequence (2013+)',
    additionalContext: {
      title: 'Jackson modern Indonesia J-prefix serial',
      summary: 'This serial matches the modern Jackson J-prefix import format used on Indonesian-built JS, X Series, and Pro Series guitars.',
      highlights: [
        'J indicates Indonesian production (PT. Cort or similar contracted facility).',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as sequential production number ${sequenceNumber}.`,
        'This format was introduced around 2013 for modern Jackson import production.',
      ],
      caveats: [
        'The serial does not encode the exact model name or body shape.',
        'Indonesian J-prefix serials may not appear in Jackson\'s USA Custom Shop database.',
        'Quality and features vary by series (JS, X, Pro); verify from the headstock, pickups, and hardware.',
      ],
      verificationTips: [
        'Check the back of the headstock or neck plate for a Made in Indonesia stamp.',
        'Compare the body shape, inlay style, pickup configuration, and headstock logo against Jackson catalog specs for the decoded year.',
        'Use the Jackson official serial number lookup to attempt factory confirmation.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Jackson J-prefix import format used on Indonesian-built JS, X Series, and Pro Series guitars.</p><h3>How This Pattern Is Typically Read</h3><p>J indicates Indonesian production. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as sequential production number ${sequenceNumber}. This format was introduced around 2013 for modern Jackson import production.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or neck plate for a Made in Indonesia stamp.</li><li>The serial does not encode the exact model name; verify body shape, inlays, and pickups against the Jackson catalog for the decoded year.</li><li>Indonesian J-prefix serials may not appear in Jackson's USA Custom Shop database.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed modern Indonesian Jackson decode, then identify the exact series and model from physical features and Jackson's catalog.</p>`,
  };
}

function decodeUSANeckThrough(serial: string): DecodeResult {
  // Extract the numeric portion (after U0 or UO)
  const numStr = serial.substring(2);
  const num = parseInt(numStr, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    factory: 'Jackson USA (Ontario, CA)',
    country: 'USA',
    notes: 'USA production neck-through-body guitar. Includes Soloist, Kelly, King V, and other production models.',
  };

  // Find the year based on serial ranges
  for (const range of USA_NECK_THROUGH_RANGES) {
    if (num >= range.start && num <= range.end) {
      info.year = range.year;
      break;
    }
  }

  if (!info.year && num > 14000) {
    info.year = '2013 or later';
  }

  return { success: true, info };
}

function decodeUSAUSeries(serial: string): DecodeResult {
  const sequence = parseInt(serial.substring(1), 10);
  let estimatedEra = 'late 1990s to 2000s (estimated)';

  if (sequence >= 17000) {
    estimatedEra = '2006-2007 (estimated)';
  } else if (sequence >= 15000) {
    estimatedEra = 'early to mid-2000s (estimated)';
  } else if (sequence >= 10000) {
    estimatedEra = 'late 1990s to early 2000s (estimated)';
  }

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: estimatedEra,
    factory: 'Jackson USA',
    country: 'USA',
    notes: `USA U-series serial. These are largely sequential rather than strict date codes. Sequence ${sequence} falls in the ${estimatedEra} range and is commonly associated with USA production or Custom Shop instruments such as Soloist, Rhoads, Kelly, and Warrior models. Verify with Made in USA headstock marking, neck-pocket stamps, and model features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-usa-u-series',
    patternLabel: 'Jackson USA U-series',
    additionalContext: {
      title: 'Jackson USA U-series serial',
      summary: 'This serial matches a Jackson USA U-series sequential format used on USA production and Custom Shop instruments.',
      highlights: [
        'The U prefix indicates Jackson USA series usage.',
        `The numeric sequence is ${sequence}.`,
        `This sequence range points to the ${estimatedEra} era.`,
        'The serial is sequential rather than a month/day production code.',
      ],
      caveats: [
        'Jackson U-series serials are not strict date codes, so the year is an estimate.',
        'Factory location may be Ontario/San Dimas for earlier examples or Corona, California after the Fender acquisition.',
        'The exact model should be verified from the headstock, body style, hardware, and neck-pocket markings.',
      ],
      verificationTips: [
        'Look for a Made in USA headstock stamp or marking.',
        'Check the neck pocket for a date stamp or builder initials when exact dating matters.',
        'Use the official Jackson lookup where available, but expect many older records to be incomplete.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Jackson USA U-series sequential format used on USA production and Custom Shop instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The U prefix indicates Jackson USA series usage. The numeric sequence is ${sequence}. This sequence range points to the ${estimatedEra} era. The serial is sequential rather than a month/day production code.</p><h3>What To Verify</h3><ul><li>Jackson U-series serials are not strict date codes, so the year is an estimate.</li><li>Factory location may be Ontario/San Dimas for earlier examples or Corona, California after the Fender acquisition.</li><li>The exact model should be verified from the headstock, body style, hardware, and neck-pocket markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a USA-series decode, then confirm with Made in USA markings, neck-pocket stamps, and model features.</p>`,
  };
}

function decodeUSABoltOnProduction(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    factory: 'Jackson USA (Ontario, CA)',
    country: 'USA',
    notes: 'USA production bolt-on-neck guitar.',
  };

  for (const range of USA_BOLT_ON_RANGES) {
    if (num >= range.start && num <= range.end) {
      info.year = range.year;
      break;
    }
  }

  if (!info.year && num > 4923) {
    info.year = '2002 or later';
  }

  return { success: true, info };
}

function decodeUSACustomBoltOn(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    factory: 'Jackson USA Custom Shop (Ontario, CA)',
    country: 'USA',
    notes: 'USA Custom Shop bolt-on-neck guitar. Production from 1986-1997. Note: From 1987-1989, guitars were not assembled in strict serial number order.',
  };

  // Rough year estimation
  if (num <= 2000) {
    info.year = '1986-1989';
  } else if (num <= 4000) {
    info.year = '1989-1992';
  } else if (num <= 6000) {
    info.year = '1992-1995';
  } else if (num <= 8200) {
    info.year = '1995-1997';
  } else {
    info.year = '1994-1995 (estimated)';
  }

  return { success: true, info };
}

function decodeJacksonJunior(serial: string): DecodeResult {
  const num = parseInt(serial.substring(0, 4), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    model: 'Jackson Junior',
    factory: 'Jackson USA (Ontario, CA)',
    country: 'USA',
    notes: 'Jackson Junior model - the only Jackson bolt-on without a neck plate. Serial stamped into fingerboard.',
  };

  // Rough year estimation (1994-2000)
  if (num <= 200) {
    info.year = '1994-1996';
  } else if (num <= 400) {
    info.year = '1996-1998';
  } else {
    info.year = '1998-2000';
  }

  return { success: true, info };
}

function decodeJapanProfessional(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const year = 1990 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Professional Series Factory',
    country: 'Japan',
    notes: 'Made in Japan Professional series. High-quality import models produced 1990-1995.',
  };

  return { success: true, info };
}

function decodeJapanProfessionalFiveDigit(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const year = 1990 + yearDigit;
  const sequence = parseInt(serial.substring(1), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Chushin Gakki',
    country: 'Japan',
    model: 'Professional Series',
    notes: `Likely made in Japan Professional Series model. This 5-digit early-1990s Jackson import format uses the first digit as the production year within 1990-1995 (${serial[0]} = ${year}) and the remaining four digits as production sequence ${sequence}. Verify with Professional headstock script, serial placement, neck plate, and neck-pocket or heel markings when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-mij-professional-5-digit',
    patternLabel: 'Jackson MIJ Professional 5-digit',
    additionalContext: {
      title: 'Jackson MIJ Professional 5-digit serial',
      summary: 'This serial matches an early-1990s Japanese Jackson Professional Series 5-digit format.',
      highlights: [
        `The first digit ${serial[0]} points to ${year}.`,
        `The remaining four digits decode as production sequence ${sequence}.`,
        'This format is commonly associated with Japanese Professional Series instruments.',
      ],
      caveats: [
        'Jackson import records from this era are incomplete.',
        'The serial supports an era/origin decode, but exact model confirmation requires physical inspection.',
        'Serial placement can vary, including fretboard stamp or neck plate.',
      ],
      verificationTips: [
        'Look for Professional script on the headstock.',
        'Check whether the serial is stamped into the fretboard or appears on a neck plate.',
        'Inspect neck-pocket or heel markings when exact date/model confirmation matters.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early-1990s Japanese Jackson Professional Series 5-digit format.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${serial[0]} points to ${year}. The remaining four digits decode as production sequence ${sequence}. This format is commonly associated with Japanese Professional Series instruments.</p><h3>What To Verify</h3><ul><li>Jackson import records from this era are incomplete.</li><li>The serial supports an era and origin decode, but exact model confirmation requires physical inspection.</li><li>Serial placement can vary, including fretboard stamp or neck plate.</li></ul>`,
  };
}

function decodeJapanProfessionalTransition1996(serial: string): DecodeResult {
  const sequence = serial.substring(1);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: '1996',
    factory: 'Chushin Gakki',
    country: 'Japan',
    notes: `Likely made in Japan Professional Series or no-S-series bolt-on model from the 1996 transition period. The first digit indicates 1996 and the remaining five digits are production sequence ${sequenceNumber}. Jackson moved many Japanese serials to a 7-digit 96xxxxx format around this time, but some 6-digit serials beginning with 6 are associated with early/mid-1996 MIJ production. Verify with neck-pocket or heel stamps when possible; a small number of similar 6-prefix instruments may be Taiwan-made.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-mij-6-digit-1996-transition',
    patternLabel: 'Jackson MIJ 6-digit 1996 transition',
    additionalContext: {
      title: 'Jackson MIJ 6-digit 1996 transition serial',
      summary: 'This 6-digit serial beginning with 6 fits a mid-1990s Jackson Japanese bolt-on pattern, commonly associated with Professional Series or no-S-series instruments around the 1996 transition.',
      highlights: [
        'The first digit points to 1996 in the 1990s Japanese 6-digit sequence.',
        'These instruments are commonly associated with Chushin Gakki production in Japan.',
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'Jackson serial records from this era are incomplete, and the official lookup may not include many pre-2002 instruments.',
        'Some 1996 Japanese models moved to a 7-digit 96xxxxx format, so this 6-digit interpretation should be verified against physical markings.',
        'A small number of similar 6-prefix bolt-ons have been linked to Taiwan production.',
      ],
      verificationTips: [
        'Check the neck plate for the absence of a USA address and compare the model to MIJ Professional or no-S-series specs.',
        'If possible, remove the neck and inspect the neck pocket or heel stamp for model and date markings.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 6-digit serial beginning with 6 fits a mid-1990s Jackson Japanese bolt-on pattern, commonly associated with Professional Series or no-S-series instruments around the 1996 transition.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit points to 1996 in the 1990s Japanese 6-digit sequence. These instruments are commonly associated with Chushin Gakki production in Japan. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Jackson serial records from this era are incomplete, and the official lookup may not include many pre-2002 instruments.</li><li>Some 1996 Japanese models moved to a 7-digit 96xxxxx format, so this 6-digit interpretation should be verified against physical markings.</li><li>A small number of similar 6-prefix bolt-ons have been linked to Taiwan production.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical decode, then confirm with the neck plate, model features, and neck-pocket or heel stamps when possible.</p>`,
  };
}

function decodeJapanMijSevenPrefixSixDigit(serial: string): DecodeResult {
  const sequence = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: 'late 1990s to late 2000s (estimated)',
    factory: 'Japan import production, likely Chushin Gakki',
    country: 'Japan',
    notes: `Likely made in Japan. This 6-digit numeric serial beginning with 7 fits a Japanese Jackson import sequence associated with late-1990s to late-2000s bolt-on models such as DKMG, DXMG, DX10, and related MIJ lines. It is treated as production sequence ${sequence}, not an exact date code. Note: many references describe a similar 7-prefix Japanese format as 7 digits; this submitted serial is 6 digits, so verify against the physical instrument.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-mij-6-digit-7-prefix-import-sequence',
    patternLabel: 'Jackson MIJ 6-digit 7-prefix import sequence',
    additionalContext: {
      title: 'Jackson MIJ 7-prefix import serial',
      summary: 'This serial matches a 6-digit 7-prefix Japanese Jackson import sequence associated with late-1990s to late-2000s bolt-on models.',
      highlights: [
        'The leading 7 points to a Japanese import sequence rather than a precise calendar year.',
        'This style is commonly associated with MIJ bolt-on Jackson models from the late 1990s through the late 2000s.',
        `The full number is treated as production sequence ${sequence}.`,
      ],
      caveats: [
        'Exact dating is limited because many Japanese Jackson factory records from this era are incomplete or unavailable.',
        'Some references describe related 7-prefix MIJ serials as 7-digit numbers; this serial has 6 digits.',
        'Use this as a likely MIJ era/origin decode, not exact model authentication.',
      ],
      verificationTips: [
        'Check for Made in Japan markings and compare the guitar to DKMG, DXMG, DX10, or related MIJ specs.',
        'Inspect the neck pocket or neck heel for model/date stamps when exact dating matters.',
        'Official Jackson lookup coverage may be limited for these Japanese import serials.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 6-digit 7-prefix Japanese Jackson import sequence associated with late-1990s to late-2000s bolt-on models.</p><h3>How This Pattern Is Typically Read</h3><p>The leading 7 points to a Japanese import sequence rather than a precise calendar year. This style is commonly associated with MIJ bolt-on Jackson models from the late 1990s through the late 2000s. The full number is treated as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Exact dating is limited because many Japanese Jackson factory records from this era are incomplete or unavailable.</li><li>Some references describe related 7-prefix MIJ serials as 7-digit numbers; this serial has 6 digits.</li><li>Use this as a likely MIJ era/origin decode, not exact model authentication.</li></ul><h3>Coal Creek Guitars Note</h3><p>Check for Made in Japan markings, compare the guitar to DKMG, DXMG, DX10, or related MIJ specs, and inspect neck-pocket or heel stamps when possible.</p>`,
  };
}

function decodeJapanMijLate1990sSixDigit(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const year = 1900 + parseInt(yearDigits, 10);
  const sequence = parseInt(serial.substring(2), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Chushin Gakki',
    country: 'Japan',
    notes: `Likely made in Japan Professional Series or related MIJ bolt-on model. This 6-digit late-1990s Jackson import format uses the first two digits as the year (${yearDigits} = ${year}) and the remaining four digits as production sequence ${sequence}. Many pre-2002 Jackson import records are incomplete, so verify with neck plate, headstock, neck-pocket, or heel markings when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-mij-6-digit-late-1990s-professional',
    patternLabel: 'Jackson MIJ 6-digit late-1990s Professional format',
    additionalContext: {
      title: 'Jackson MIJ late-1990s 6-digit serial',
      summary: 'This 6-digit serial matches a late-1990s Japanese Jackson import pattern commonly associated with Professional Series and related MIJ bolt-on models.',
      highlights: [
        `The first two digits point to ${year}.`,
        'These serials are commonly associated with Japanese Professional Series or related MIJ import models.',
        `The remaining four digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'Jackson records from this era are incomplete, especially for pre-2002 import instruments.',
        'Official Jackson lookup results may be missing even when the serial format is valid.',
        'Use this as a production-era and country decode, not exact model authentication by itself.',
      ],
      verificationTips: [
        'Check whether the serial is on a bolt-on neck plate or on the back of the headstock.',
        'Look for Made in Japan markings and compare the instrument to late-1990s Professional Series specs.',
        'If possible, inspect the neck pocket or neck heel for model/date stamps.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 6-digit serial matches a late-1990s Japanese Jackson import pattern commonly associated with Professional Series and related MIJ bolt-on models.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits point to ${year}. These serials are commonly associated with Japanese Professional Series or related MIJ import models. The remaining four digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Jackson records from this era are incomplete, especially for pre-2002 import instruments.</li><li>Official Jackson lookup results may be missing even when the serial format is valid.</li><li>Use this as a production-era and country decode, not exact model authentication by itself.</li></ul><h3>Coal Creek Guitars Note</h3><p>Confirm with Made in Japan markings, model specs, and neck-pocket or heel stamps when possible.</p>`,
  };
}

function decodeJapanMij1990to1995SevenDigit(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const year = 1900 + parseInt(yearDigits, 10);
  const sequence = parseInt(serial.substring(2), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Chushin Gakki',
    country: 'Japan',
    notes: `Likely made in Japan at Chushin Gakki. This 7-digit mid-1990s Jackson import format uses the first two digits as the year (${yearDigits} = ${year}) and the remaining five digits as production sequence ${sequence}. It is commonly seen on Japanese Professional Series, Performer-era, and related MIJ bolt-on models. Exact model identification requires physical verification because Jackson records from this era are incomplete.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-mij-7-digit-1990-1995-chushin',
    patternLabel: 'Jackson MIJ 7-digit 1990-1995 Chushin format',
    additionalContext: {
      title: 'Jackson MIJ 7-digit mid-1990s serial',
      summary: 'This serial matches a 7-digit Jackson Japanese import format commonly associated with Chushin Gakki production in the early-to-mid 1990s.',
      highlights: [
        `The first two digits point to ${year}.`,
        'These serials are commonly associated with Japanese Professional Series, Performer-era, and related MIJ bolt-on models.',
        `The remaining digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'Jackson records from this era are incomplete, so the exact model cannot be confirmed from the serial alone.',
        'Stickered headstock serials from this period can overlap across nearby import series.',
        'Use this as a production-era and country decode, not a model authentication by itself.',
      ],
      verificationTips: [
        'Check for Made in Japan markings and compare the instrument to mid-1990s Jackson Professional or Performer specs.',
        'If possible, inspect the neck pocket or neck heel for model/date stamps.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 7-digit Jackson Japanese import format commonly associated with Chushin Gakki production in the early-to-mid 1990s.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits point to ${year}. These serials are commonly associated with Japanese Professional Series, Performer-era, and related MIJ bolt-on models. The remaining digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Jackson records from this era are incomplete, so the exact model cannot be confirmed from the serial alone.</li><li>Stickered headstock serials from this period can overlap across nearby import series.</li><li>Use this as a production-era and country decode, not a model authentication by itself.</li></ul><h3>Coal Creek Guitars Note</h3><p>Confirm with Made in Japan markings, model specs, and neck-pocket or heel stamps when possible.</p>`,
  };
}

function decodeJapanFusion(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const year = 1900 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    model: 'Fusion',
    factory: 'Professional Series Factory',
    country: 'Japan',
    notes: 'Made in Japan Fusion model. Used a different serial format with 2-digit year prefix.',
  };

  return { success: true, info };
}

function decodeJapan1996Plus(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  let year: number;

  if (yearDigits.startsWith('9')) {
    year = 1900 + parseInt(yearDigits, 10);
  } else {
    year = 2000 + parseInt(yearDigits, 10);
  }

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    country: 'Japan',
    notes: 'Made in Japan (1996 or later). Includes JS, Stars, and other import series.',
  };

  return { success: true, info };
}

function decodeJapanMijThreePrefix(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: '1993-1995 (estimated)',
    factory: 'Japanese contract manufacturer (Akai or Yamano Music-era production)',
    country: 'Japan',
    notes: 'Japan-made bolt-on import with a 3-prefix 7-digit serial (Dinky XL and related bolt-on series era, early-to-mid 1990s). The 3-prefix was used by certain Japanese OEM contractors during this period. No encoded year, month, or factory in this format.',
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-japan-mij-3prefix-7digit-1993-1995',
    patternLabel: 'Jackson Japan MIJ 3-prefix 7-digit (1993–1995)',
    additionalContext: {
      title: 'Jackson Japan MIJ bolt-on serial (3-prefix)',
      summary: 'This 7-digit serial starting with 3 indicates a Japan-made Jackson bolt-on import from the early-to-mid 1990s.',
      highlights: [
        'The 3-prefix was used by certain Japanese OEM contractors during the 1993–1995 era.',
        'Models from this period include the Dinky XL, Performer, and related bolt-on series.',
        'Made in Japan instruments from this era are generally well-regarded for quality.',
      ],
      caveats: [
        'No year, month, or factory code is directly encoded in this serial format.',
        'Physical dating features (headstock logo, finish, hardware) should be used to narrow the production year.',
      ],
      verificationTips: [
        'Compare the headstock logo style against known 1993–1995 Jackson catalog images for the Dinky XL and Performer series.',
        'Check the tuner brand and headstock shape — Japanese-made Jacksons from this era typically used Gotoh or Schaller hardware.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 7-digit serial beginning with 3 identifies a Japan-made Jackson bolt-on import from roughly 1993–1995. The 3-prefix was used by certain Japanese OEM contractors producing models like the Dinky XL and Performer series.</p><h3>What's Encoded</h3><p>No year, month, or factory is encoded in this format — it is a plain sequential serial. Physical features (headstock logo style, finish quality, hardware) will help narrow the production year.</p><h3>Coal Creek Guitars Note</h3><p>Japanese Jackson instruments from this era are well-regarded. Compare the headstock logo, tuner style, and pickguard configuration against known 1993–1995 Jackson catalog images to confirm the model and era.</p>`,
  };
}

function decodeJapanChushin200C(serial: string): DecodeResult {
  const sequence = parseInt(serial.substring(4), 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: '2002-2006 (estimated)',
    factory: 'Chushin Gakki',
    country: 'Japan',
    notes: `This serial matches a Jackson MIJ import format seen as 200C + 5 digits. The C is commonly associated with Chushin Gakki, and sequence ${sequence} fits the early-to-mid 2000s Japanese import era. This is a sequential import format rather than a precise year code, so exact dating should be confirmed from model specs, neck-pocket stamps, or other instrument markings when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-mij-200c-chushin',
    patternLabel: 'Jackson MIJ 200C Chushin format',
    additionalContext: {
      title: 'Jackson MIJ 200C serial',
      summary: 'This serial matches a Jackson Japanese import pattern seen as 200C plus a 5-digit sequence, commonly associated with Chushin Gakki production in the early-to-mid 2000s.',
      highlights: [
        'The 200C prefix is treated as a Japanese import-era identifier rather than a strict year code.',
        'The C is commonly associated with Chushin Gakki production.',
        `The remaining digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'Jackson import serial records from this era are incomplete, and official lookup coverage is limited.',
        'This pattern supports era/factory attribution more confidently than an exact calendar year.',
        'Exact model confirmation should come from physical markings, specs, and neck-pocket or heel stamps.',
      ],
      verificationTips: [
        'Check for Made in Japan marking and compare the model to early-2000s Jackson Pro or X-series specs.',
        'Inspect neck-pocket, heel, or body cavity stamps if exact dating matters.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Jackson Japanese import pattern seen as 200C plus a 5-digit sequence, commonly associated with Chushin Gakki production in the early-to-mid 2000s.</p><h3>How This Pattern Is Typically Read</h3><p>The 200C prefix is treated as a Japanese import-era identifier rather than a strict year code. The C is commonly associated with Chushin Gakki production. The remaining digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Jackson import serial records from this era are incomplete, and official lookup coverage is limited.</li><li>This pattern supports era/factory attribution more confidently than an exact calendar year.</li><li>Exact model confirmation should come from physical markings, specs, and neck-pocket or heel stamps.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as an early-to-mid 2000s MIJ Jackson decode, then confirm the exact model and production details from the instrument itself.</p>`,
  };
}

function decodeIndonesia(serial: string): DecodeResult {
  // Format: I + factory + optional J + year(2) + month(2) + sequence
  let factoryCode = serial[1];
  let digitStart = 2;

  // Check if there's a J after the factory code
  if (serial[2] === 'J') {
    digitStart = 3;
  }

  const digits = serial.substring(digitStart);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);

  let year = parseInt(yearDigits, 10);
  year = year >= 90 ? 1900 + year : 2000 + year;

  const month = parseInt(monthDigits, 10);
  const monthName = getMonthName(month);

  const factory = INDONESIA_FACTORY_CODES[factoryCode] || 'Unknown Factory';

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: factory,
    country: 'Indonesia',
  };

  return { success: true, info };
}

function decodeChina(serial: string): DecodeResult {
  // Format: C + factory + optional J + year(2) + month(2) + sequence
  let factoryCode = serial[1];
  let digitStart = 2;

  if (serial[2] === 'J') {
    digitStart = 3;
  }

  const digits = serial.substring(digitStart);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);

  let year = parseInt(yearDigits, 10);
  year = year >= 90 ? 1900 + year : 2000 + year;

  const month = parseInt(monthDigits, 10);
  const monthName = getMonthName(month);

  const factory = CHINA_FACTORY_CODES[factoryCode] || 'Unknown Factory';

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: factory,
    country: 'China',
  };

  return { success: true, info };
}

function decodeIndia(serial: string): DecodeResult {
  // Format: NHJ + year(2) + sequence + optional batch letter suffix
  // e.g. NHJ111644B → year=11 (2011), sequence=1644, batch=B
  const withoutPrefix = serial.substring(3);
  const digits = withoutPrefix.replace(/[A-Z]$/i, ''); // strip optional trailing batch letter
  const batchCode = /[A-Z]$/i.test(withoutPrefix) ? withoutPrefix.slice(-1).toUpperCase() : null;

  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);

  let year = parseInt(yearDigits, 10);
  year = year >= 90 ? 1900 + year : 2000 + year;

  const month = parseInt(monthDigits, 10);
  const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
  const sequence = monthName ? digits.substring(4) : digits.substring(2);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Jackson India (contracted factory)',
    country: 'India',
    notes: `NHJ-series Jackson JS Series import (mid-2000s to early 2010s). Built at a contracted Asian facility. Year: ${year}${monthName ? `, Month: ${monthName}` : ''}. Production sequence: ${sequence}${batchCode ? `. Batch code: ${batchCode}` : ''}. These instruments are not in the official Jackson online lookup — verify with headstock markings and model features.`,
  };

  return { success: true, info };
}

function decodeIndiaNumeric8(serial: string): DecodeResult {
  // Format: year(2) + sequence(6) - JS20 and X series
  const yearDigits = serial.substring(0, 2);

  let year = parseInt(yearDigits, 10);
  year = year >= 90 ? 1900 + year : 2000 + year;

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    country: 'India',
    notes: 'JS20 or X series made in India.',
  };

  return { success: true, info };
}

function decodeIndiaNumeric9(serial: string): DecodeResult {
  // Format: year(4) + sequence(5) - JS30xx series 2004-2007
  const yearDigits = serial.substring(0, 4);
  const year = parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    model: 'JS30xx Series',
    country: 'India',
  };

  return { success: true, info };
}

function decodeIndiaNumeric10(serial: string): DecodeResult {
  // Format: year(4) + sequence(6) - JS30xx series 2008+
  const yearDigits = serial.substring(0, 4);
  const year = parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    model: 'JS30xx Series',
    country: 'India',
  };

  return { success: true, info };
}

function decodeKorea(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    factory: 'Performer Series Factory',
    country: 'South Korea',
    notes: 'Made in Korea Performer series. Produced 1995-1998. Unfortunately, exact year dating is not possible for these serials.',
  };

  return { success: true, info };
}

function decodeTaiwan(serial: string): DecodeResult {
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: '1996',
    model: 'JS20',
    factory: 'MIT Taiwan factory',
    country: 'Taiwan',
    notes: `Made in Taiwan JS-series format, most commonly associated with the JS20 Dinky during the short 1996 Taiwan production period. The first digit indicates 1996; remaining digits are production sequence ${sequence}. Verify with a Made in Taiwan sticker or neck-pocket markings when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-taiwan-js-series-1996',
    patternLabel: 'Jackson Taiwan JS-series 1996',
    additionalContext: {
      title: 'Jackson Taiwan JS-series serial',
      summary: 'This serial matches a mid-1990s Jackson Taiwan JS-series numeric format, most commonly associated with JS20 Dinky instruments.',
      highlights: [
        'The leading 6 points to 1996 in this Taiwan JS-series pattern.',
        'The format is commonly associated with the JS20 Dinky and related entry-level Jackson imports.',
        `The remaining digits are production sequence ${sequence}.`,
      ],
      caveats: [
        'Official Jackson lookup coverage for this era is incomplete and mostly focused on later instruments.',
        'These mid-1990s import models used numeric sequences that varied by factory partner.',
        'Exact model confirmation should come from physical markings and specs, not the serial alone.',
      ],
      verificationTips: [
        'Check for a Made in Taiwan sticker or marking on the back of the headstock.',
        'Inspect the neck pocket if exact production confirmation matters.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a mid-1990s Jackson Taiwan JS-series numeric format, most commonly associated with JS20 Dinky instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The leading 6 points to 1996 in this Taiwan JS-series pattern. The format is commonly associated with the JS20 Dinky and related entry-level Jackson imports. The remaining digits are production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Official Jackson lookup coverage for this era is incomplete and mostly focused on later instruments.</li><li>These mid-1990s import models used numeric sequences that varied by factory partner.</li><li>Exact model confirmation should come from physical markings and specs, not the serial alone.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical Taiwan JS-series decode, then confirm with Made in Taiwan markings, model specs, or neck-pocket stamps.</p>`,
  };
}

function decodeModern(serial: string): DecodeResult {
  // Modern 10-digit alphanumeric format (2013+)
  // First two characters might be country/factory codes
  // Next digits typically include year

  const letterPrefix = serial.match(/^[A-Z]+/)?.[0] || '';
  const digits = serial.substring(letterPrefix.length);
  const yearDigits = digits.substring(0, 2);

  let year = parseInt(yearDigits, 10);
  year = year >= 90 ? 1900 + year : 2000 + year;

  let country = 'Unknown';
  let factory = 'Unknown';

  // Determine country/factory from prefix
  if (letterPrefix.startsWith('I')) {
    country = 'Indonesia';
    if (letterPrefix.length > 1) {
      const factoryCode = letterPrefix[1];
      factory = INDONESIA_FACTORY_CODES[factoryCode] || 'Unknown Factory';
    }
  } else if (letterPrefix.startsWith('C')) {
    country = 'China';
    if (letterPrefix.length > 1) {
      const factoryCode = letterPrefix[1];
      factory = CHINA_FACTORY_CODES[factoryCode] || 'Unknown Factory';
    }
  } else if (letterPrefix.startsWith('N')) {
    country = 'India';
    factory = 'Jackson India';
  } else if (letterPrefix.startsWith('US')) {
    country = 'USA';
    factory = 'Jackson USA';
  }

  const monthDigits = digits.substring(2, 4);
  const month = parseInt(monthDigits, 10);
  const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: factory !== 'Unknown' ? factory : undefined,
    country: country,
    notes: 'Modern format serial number (2013+).',
  };

  return { success: true, info };
}

function decodeModernIndonesiaKorea8Digit(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const sequence = serial.substring(2);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Jackson Indonesian or Korean import facility',
    country: 'Indonesia or South Korea',
    notes: `Modern 8-digit Jackson import format. The first two digits ${yearDigits} decode as production year ${year}. The remaining digits are the sequential production number ${sequenceNumber}. This format is commonly seen on JS Series, X Series, and entry-level Pro Series models built at contracted Asian factories. Exact factory (Indonesia vs. Korea) and model require verification from the headstock, neck pocket, and country-of-origin marking.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-modern-8-digit-yy-sequence-import',
    patternLabel: 'Jackson modern 8-digit YY sequence import (Indonesia/Korea)',
    additionalContext: {
      title: 'Jackson modern 8-digit import serial',
      summary: 'This serial matches a modern Jackson 8-digit import format where the first two digits identify the production year.',
      highlights: [
        `The first two digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as sequential production number ${sequenceNumber}.`,
        'This format is common on JS, X Series, and entry-level Pro Series import models.',
      ],
      caveats: [
        'The serial does not encode the exact factory location or model name.',
        'Indonesian and Korean import facilities both used this format during this era.',
        'Not all import serials appear in Jackson\'s USA Custom Shop lookup database.',
      ],
      verificationTips: [
        'Check the back of the headstock or neck plate for a Made in Indonesia or Made in Korea stamp.',
        'Remove the neck and check the neck pocket for a date stamp and model designation if present.',
        'Compare body shape, inlays, and hardware to Jackson catalog specs for the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Jackson 8-digit import format where the first two digits identify the production year.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as sequential production number ${sequenceNumber}. This format is commonly seen on JS, X Series, and entry-level Pro Series models built at contracted Asian factories.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or neck plate for a country-of-origin stamp.</li><li>Remove the neck and check the neck pocket for a date stamp and model designation.</li><li>Compare body shape, inlays, pickup configuration, and hardware to Jackson catalog specs for the decoded year.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed modern Jackson import decode, then identify the exact model and factory from physical markings and catalog comparison.</p>`,
  };
}

function decodeModern10DigitThreeLetterPrefix(serial: string): DecodeResult {
  const letterPrefix = serial.substring(0, 3);
  const modelCode = serial.substring(3, 5);
  const yearDigits = serial.substring(5, 7);
  const sequenceStr = serial.substring(7);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequence = parseInt(sequenceStr, 10);

  let country = 'Unknown';
  let factory = 'Unknown';

  if (letterPrefix[0] === 'I') {
    country = 'Indonesia';
    factory = INDONESIA_FACTORY_CODES[letterPrefix[1]] || `Indonesian factory (${letterPrefix[1]})`;
  } else if (letterPrefix[0] === 'C') {
    country = 'China';
    factory = CHINA_FACTORY_CODES[letterPrefix[1]] || `Chinese factory (${letterPrefix[1]})`;
  } else if (letterPrefix[0] === 'N') {
    country = 'India';
    factory = 'Jackson India';
  }

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: factory !== 'Unknown' ? factory : undefined,
    country,
    notes: `Modern Jackson 10-digit format (3-letter prefix variant). "${letterPrefix}" encodes country/factory/brand (${letterPrefix[0]} = ${country}${factory !== 'Unknown' ? `, ${letterPrefix[1]} = ${factory}` : ''}). Model variation code: ${parseInt(modelCode, 10)}. Year digits "${yearDigits}" decode as ${year}. Production sequence: ${sequence}. This format is common on modern Jackson import models built at contracted Asian facilities after 2013.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-modern-10digit-3letter-prefix-modelcode-yy-sequence',
    patternLabel: 'Jackson modern 10-digit 3-letter prefix (2013+)',
    additionalContext: {
      title: 'Jackson modern 3-letter prefix 10-digit serial',
      summary: 'This serial matches a modern Jackson import format: 3-letter country/factory/brand prefix + 2-digit model code + 2-digit production year + 3-digit sequence.',
      highlights: [
        `"${letterPrefix}" encodes country, factory, and brand: ${letterPrefix[0]} = ${country}, ${letterPrefix[1]} = ${factory}.`,
        `Model variation code is ${parseInt(modelCode, 10)}.`,
        `The digits "${yearDigits}" decode as production year ${year}.`,
        `The remaining digits are production sequence ${sequence}.`,
      ],
      caveats: [
        'The model code does not directly identify the guitar model name or series.',
        'Country and factory confirm Asian import production, not USA Custom Shop.',
        'Verify the exact model from the headstock, series name, and catalog specs for the decoded year.',
      ],
      verificationTips: [
        'Check the back of the headstock or neck plate for a country-of-origin stamp.',
        'Compare the body shape, pickup configuration, and hardware against Jackson catalog specs for the decoded year.',
        'Use the Jackson official serial lookup where available.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Jackson import format: 3-letter country/factory/brand prefix + 2-digit model code + 2-digit production year + 3-digit sequence.</p><h3>How This Pattern Is Typically Read</h3><p>"${letterPrefix}" encodes country, factory, and brand: ${letterPrefix[0]} = ${country}, ${letterPrefix[1]} = ${factory}. Model variation code is ${parseInt(modelCode, 10)}. The digits "${yearDigits}" decode as production year ${year}. The remaining digits are production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or neck plate for a country-of-origin stamp.</li><li>The model code does not directly identify the guitar model name — verify from headstock, series name, and catalog.</li><li>Use the Jackson official serial lookup where available.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed modern Jackson import decode, then identify the exact model from physical markings and catalog comparison.</p>`,
  };
}

function decodeChinaCWJ(serial: string): DecodeResult {
  const yearDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Chinese contracted factory (CWJ)',
    country: 'China',
    model: 'JS Series or X Series',
    notes: `CWJ-prefix Jackson China import format. CWJ identifies the contracted Chinese production facility. The digits "${yearDigits}" decode as production year ${year}. The remaining ${sequence.length} digits are the sequential production number ${sequenceNumber}. This format is commonly seen on JS Series and X Series models built in China. Verify with a Made in China headstock marking and model specs.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-china-cwj-yy-sequence',
    patternLabel: 'Jackson China CWJ YY sequence',
    additionalContext: {
      title: 'Jackson China CWJ-prefix serial',
      summary: 'This serial matches a Jackson CWJ-prefix import format used on Chinese-built JS Series and X Series guitars.',
      highlights: [
        'CWJ identifies a contracted Chinese production facility.',
        `The digits "${yearDigits}" decode as production year ${year}.`,
        `The remaining digits decode as sequential production number ${sequenceNumber}.`,
        'This format is used on Chinese-manufactured Jackson JS and X Series import guitars.',
      ],
      caveats: [
        'The serial does not encode the exact factory name, model, or body shape.',
        'CWJ-prefix serials may not appear in the Jackson USA Custom Shop database.',
        'Quality and features vary by series; verify from the headstock, pickups, and hardware.',
      ],
      verificationTips: [
        'Check the back of the headstock or neck plate for a Made in China stamp.',
        'Compare body shape, inlay style, pickup configuration, and headstock logo against Jackson catalog specs for the decoded year.',
        'Use the Jackson official serial number lookup to attempt factory confirmation.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Jackson CWJ-prefix import format used on Chinese-built JS Series and X Series guitars.</p><h3>How This Pattern Is Typically Read</h3><p>CWJ identifies a contracted Chinese production facility. The digits "${yearDigits}" decode as production year ${year}. The remaining digits decode as sequential production number ${sequenceNumber}. This format is used on Chinese-manufactured Jackson JS and X Series import guitars.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or neck plate for a Made in China stamp.</li><li>The serial does not encode the exact model name; verify body shape, inlays, and pickups against the Jackson catalog for the decoded year.</li><li>CWJ-prefix serials may not appear in Jackson's USA Custom Shop database.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed Chinese Jackson import decode, then identify the exact series and model from physical features and Jackson's catalog.</p>`,
  };
}

function decodeChina3DigitFactorySequence(serial: string): DecodeResult {
  const factoryCode = serial.substring(0, 3);
  const sequence = serial.substring(3);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: 'Unknown (factory sequence format, no year encoding)',
    factory: `Chinese contracted facility (factory code ${factoryCode})`,
    country: 'China',
    model: 'JS Series or X Series import',
    notes: `9-digit numeric Jackson China import format. The first three digits (${factoryCode}) identify the contracted manufacturing facility; the remaining six digits (${sequence}) are the sequential production number ${sequenceNumber}. This format does not encode the production year in the serial number itself — verify the approximate manufacturing date from the guitar's physical markings, neck pocket, or documentation. These instruments are commonly JS Series or X Series models built at contracted Chinese factories.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-china-numeric-9digit-factory-sequence',
    patternLabel: 'Jackson China 9-digit factory sequence (no year)',
    additionalContext: {
      title: 'Jackson China 9-digit factory sequence serial',
      summary: 'This serial matches a 9-digit numeric Jackson China import format where the first three digits identify the factory and the remaining digits are a pure production sequence with no year encoding.',
      highlights: [
        `The first three digits (${factoryCode}) identify the contracted Chinese manufacturing facility.`,
        `The remaining six digits (${sequence}) form the sequential production number ${sequenceNumber}.`,
        'This format does not encode a production year within the serial number itself.',
        'These instruments are typically JS Series or X Series imports built at contracted Chinese factories.',
      ],
      caveats: [
        'No production year can be decoded from this serial — the manufacture date is not embedded in the format.',
        `The factory code (${factoryCode}) identifies the facility but may not match publicly documented factory identifiers.`,
        'These serials may not appear in the Jackson USA Custom Shop lookup.',
      ],
      verificationTips: [
        'Check the back of the headstock or neck plate for a Made in China stamp and approximate production period.',
        'Inspect the neck pocket or body cavity for internal date stamps when exact dating matters.',
        'Compare model specs, hardware, and inlays to Jackson catalog entries to estimate the production era.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 9-digit numeric Jackson China import format where the first three digits identify the factory and the remaining digits are a pure production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first three digits (${factoryCode}) identify the contracted Chinese manufacturing facility. The remaining six digits (${sequence}) form the sequential production number ${sequenceNumber}. This format does not encode a production year within the serial number itself.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or neck plate for a Made in China stamp.</li><li>Inspect the neck pocket or body cavity for internal date stamps when exact dating is important.</li><li>Compare model specs, hardware, and inlays to Jackson catalog entries to estimate the production era.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed Chinese Jackson import decode. Production year cannot be determined from the serial alone — verify from physical markings and model features.</p>`,
  };
}

function decodeKoreaNJHK(serial: string): DecodeResult {
  const yearDigits = serial.substring(4, 6);
  const sequence = serial.substring(6);
  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Jackson',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Sung-Eum, Incheon, South Korea',
    country: 'South Korea',
    notes: `NJHK prefix identifies Korean production at the Sung-Eum (also associated with Samick-era Korean contracting) facility. Format: NJHK + YY + sequence. The digits ${yearDigits} decode as production year ${year}. Production sequence: ${sequence}. This format appears on Jackson Pro Series and similar mid-range Korean-built instruments.`,
  };

  return {
    success: true,
    info,
    patternKey: 'jackson-njhk-korea-yy-sequence',
    patternLabel: 'Jackson NJHK Korea YY sequence',
  };
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}
