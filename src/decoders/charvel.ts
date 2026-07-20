import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Charvel Guitar Serial Number Decoder
 *
 * Supports:
 * - San Dimas USA (1981-1986): 4-digit serials 1001-5491
 * - Fender-era San Dimas reissue (2002-2005): 4-digit serials 5492-6999+
 * - Japanese late-1980s YYMM date stamp: 4-digit YYMM (e.g. 8911 = November 1989)
 * - Japanese MIJ neck plate (1986-early 1990s): 5-digit and 7-digit serials
 * - Japanese neck-through (1986-1991): C + digit + sequential
 * - Japanese bolt-on (1986-1991): 6-digit sequential (220000+)
 * - Modern Japan MIJ (2009-2012): JC + year + production
 * - USA Pro-Mod (2009+): 6-digit production numbers
 * - Mexican production (2013+): MC/CM prefix
 * - Indonesian Samick imports (2013+): ISC + YY + 4-digit sequence
 * - Indonesian/Chinese imports (2013+): 10-digit alphanumeric
 * - UC-prefix China import (2010s+): UC + YY + sequence
 *
 * Note: Charvel was founded by Wayne Charvel in 1974, sold to Grover Jackson
 * in 1978, and acquired by Fender in 2002.
 */

export function decodeCharvel(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Japanese neck-through: C + year digit + sequential (1986-1991)
  // Minimum 3 trailing digits to cover short early-run plates (e.g. C6208 = 1986, seq 208)
  if (/^C[0-9]\d{3,6}$/.test(normalized)) {
    return decodeJapanNeckThrough(normalized);
  }

  // Modern Korea/WMI run seen as CF + YY + sequence
  if (/^CF\d{5,8}$/.test(normalized)) {
    return decodeKoreaCF(normalized);
  }

  // Modern Japan MIJ: JC + year + production (2009-2012)
  if (/^JC\d{8,10}$/.test(normalized)) {
    return decodeModernJapan(normalized);
  }

  // Mexican production: MC + year + production (5-9 trailing digits; shorter runs and newer long serials)
  if (/^MC\d{5,9}$/.test(normalized)) {
    return decodeMexico(normalized);
  }

  // Mexican early 2013: CM prefix
  if (/^CM\d{6,8}$/.test(normalized)) {
    return decodeMexicoCM(normalized);
  }

  // Indonesian Samick modern import: ISC + YY + ####
  if (/^ISC\d{6}$/.test(normalized)) {
    return decodeIndonesiaSamickISC(normalized);
  }

  // Modern import: 10-digit alphanumeric (ICJ, ISJ, IWJ, CYJ, etc.)
  if (/^[ICMN][HWCS][JC]\d{7,8}$/.test(normalized)) {
    return decodeModernImport(normalized);
  }

  // UC-prefix: China import models (Desolation era and related, 2010s+)
  if (/^UC\d{4,8}$/.test(normalized)) {
    return decodeCharvelUCChina(normalized, cleaned);
  }

  // TX76113 is the IMC Fort Worth TX zip code stamped on neck plates of Japanese Charvels (1986-1991).
  // Customers sometimes enter this as a serial number; it is an importer address mark, not a serial.
  if (/^TX\d{5}$/.test(normalized)) {
    return decodeIMCAddressMark(normalized);
  }

  // USA Select/Pro-Mod: 10-digit format similar to imports
  if (/^[A-Z]{2,3}\d{7,8}$/.test(normalized)) {
    return decodeUSASelect(normalized);
  }

  // Numeric 8-digit modern import-style format (YYMM + sequence)
  if (/^\d{8}$/.test(normalized)) {
    return decodeNumeric8Modern(normalized);
  }

  // 4-digit: YYMM date-stamp (Japanese late-1980s) takes priority over San Dimas sequential.
  // San Dimas tops out at 5491, so any YYMM serial with yy 83-99 (≥8301) cannot be San Dimas.
  if (/^\d{4}$/.test(normalized)) {
    const yy = parseInt(normalized.slice(0, 2), 10);
    const mm = parseInt(normalized.slice(2), 10);
    if (yy >= 83 && yy <= 99 && mm >= 1 && mm <= 12) {
      return decodeJapanYYMM(normalized);
    }
    return decodeSanDimas(normalized);
  }

  // Japanese MIJ neck plate: 5-digit (roughly 1986-1989)
  if (/^\d{5}$/.test(normalized)) {
    return decodeJapanNeckPlate(normalized);
  }

  // Japanese bolt-on: 6-digit sequential (220000+)
  if (/^\d{6}$/.test(normalized)) {
    return decodeJapanBoltOn(normalized);
  }

  // Japanese MIJ/IMC-era neck plate: 7-digit sequential
  if (/^\d{7}$/.test(normalized)) {
    return decodeJapanNeckPlate7Digit(normalized);
  }

  // USA Pro-Mod 2009-2010: 00XXXX format
  if (/^00\d{4}$/.test(normalized)) {
    return decodeUSAProMod(normalized);
  }

  // USA Pro-Mod 2010+: 1XXXXXXX or 11XXXXXX format
  if (/^1[01]\d{6,7}$/.test(normalized)) {
    return decodeUSAProMod2010(normalized);
  }

  // Surfcaster: 365XXX-388XXX
  if (/^3[6-8]\d{4}$/.test(normalized)) {
    const num = parseInt(normalized, 10);
    if (num >= 365000 && num <= 388999) {
      return decodeSurfcaster(normalized);
    }
  }

  return {
    success: false,
    error: 'Unable to decode this Charvel serial number. Common formats include: 4-digit YYMM date stamps like 8911 (Japanese late-1980s), 4-digit sequentials 1001-5491 (San Dimas USA 1981-1986), C + digit + numbers (Japan neck-through 1986-1991), 5-7 digit numeric MIJ neck plate/bolt-on serials, JC + numbers (Modern MIJ), MC + numbers (Mexico), UC + YY + sequence (China Desolation-era), ISC + YY + #### (modern Indonesia), or 10-character codes (modern imports). Note: Pre-1981 San Dimas guitars have no serial numbers.',
  };
}

// Japanese late-1980s YYMM date stamp: 4-digit (e.g. 8911 = November 1989)
function decodeJapanYYMM(serial: string): DecodeResult {
  const yy = parseInt(serial.slice(0, 2), 10);
  const mm = parseInt(serial.slice(2), 10);
  const year = (1900 + yy).toString();
  const month = getMonthName(mm) as string;

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year,
    month,
    factory: 'Chushin Gakki (Nagano Prefecture)',
    country: 'Japan',
    notes: `4-digit Japanese Charvel YYMM date-stamp format. The first two digits "${serial.slice(0, 2)}" decode as ${year}; the last two digits "${serial.slice(2)}" decode as ${month}. This format was used on Japanese-made Charvel models from approximately 1986 through the early 1990s, including the Model Series and Fusion Series. Despite the Fort Worth, Texas neck plate (corporate headquarters address), these guitars were manufactured at Chushin Gakki in Nagano Prefecture, Japan. Headstock logos from this era often feature the "toothpaste" script. Verify with neck plate text, headstock logo, tremolo type, and country-of-origin markings.`,
  };

  return {
    success: true,
    info,
    patternKey: 'charvel-japan-yymm-4-digit',
    patternLabel: 'Charvel Japanese late-1980s YYMM date stamp',
    additionalContext: {
      title: 'Charvel Japanese YYMM date-stamp serial',
      summary: `This 4-digit serial matches the Japanese Charvel YYMM date-stamp format: the first two digits encode the year and the last two encode the production month.`,
      highlights: [
        `The first two digits "${serial.slice(0, 2)}" decode as production year ${year}.`,
        `The last two digits "${serial.slice(2)}" decode as ${month}.`,
        'This format is associated with Japanese Charvel production at Chushin Gakki in the late 1980s.',
        'The Fort Worth, Texas neck plate indicates the corporate address, not USA manufacture.',
      ],
      caveats: [
        'The Fort Worth, Texas neck plate is a common source of confusion — it is the importer/corporate address, not a Made in USA indicator.',
        'Headstock logo style ("toothpaste" vs standard script) and tremolo type help narrow the exact year and model within this era.',
        'Blank or replacement neck plates can appear on these instruments, so physical feature verification matters.',
      ],
      verificationTips: [
        'Check the headstock for the "toothpaste" Charvel script logo, which is characteristic of this era.',
        'Look for a Made in Japan marking on the headstock back or in the neck pocket.',
        'Compare the tremolo type (Kahler vs JT-6), pickup layout, and finish options against late-1980s Charvel catalogs.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This 4-digit serial matches the Japanese Charvel YYMM date-stamp format: the first two digits encode the year and the last two encode the production month.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits "${serial.slice(0, 2)}" decode as production year ${year}. The last two digits "${serial.slice(2)}" decode as ${month}. This format was used on Japanese-made Charvel models from approximately 1986 through the early 1990s, including the Model Series and Fusion Series. Despite the Fort Worth, Texas neck plate, these guitars were manufactured at Chushin Gakki in Nagano Prefecture, Japan.</p><h3>What To Verify</h3><ul><li>The Fort Worth, Texas neck plate is the corporate/importer address — it does not indicate USA manufacture.</li><li>Look for the "toothpaste" Charvel script logo on the headstock, which is characteristic of this era.</li><li>Check for a Made in Japan marking and compare the tremolo, pickups, and finish against late-1980s Charvel catalogs to narrow the exact model.</li></ul>`,
  };
}

// San Dimas USA: 4-digit (1001-5491)
function decodeSanDimas(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // Sub-1001: very early Charvel pre-production or early Japanese import convention
  if (num < 1001) {
    const info: GuitarInfo = {
      brand: 'Charvel',
      serialNumber: serial,
      year: 'circa 1979-1981 (very early or pre-production)',
      factory: 'San Dimas, California (pre-production) or early Japanese import',
      country: 'USA or Japan',
      notes: `Serial ${num} is below the main San Dimas production range (1001-5491, 1981-1986). Very low 4-digit serials in this range are consistent with pre-production USA prototypes from approximately 1979-1981, before the official serialized production began in November 1981. Some early Japanese import Charvels also used a leading-zero prefix convention for initial production years. Verify with neck plate markings, headstock logo, tremolo type, and country-of-origin stamp.`,
    };
    return {
      success: true,
      info,
      patternKey: 'charvel-early-pre-production-4digit',
      patternLabel: 'Charvel early pre-production or very early 4-digit serial',
      additionalContext: {
        title: 'Charvel very early 4-digit serial',
        summary: `Serial ${num} falls below the main San Dimas range (1001-5491) and is consistent with very early Charvel pre-production (circa 1979-1981) or an early Japanese import format.`,
        highlights: [
          'Serials below 1001 predate the official San Dimas serialized production that began in November 1981.',
          'Very early USA pre-production Charvels and some early Japanese imports may use serials in this range.',
          `Serial ${num} should be verified against the physical instrument for conclusive dating.`,
        ],
        caveats: [
          'Pre-1981 guitars typically have no serial numbers at all — sub-1001 serials may be from custom orders or prototypes.',
          'Some early Japanese import Charvels used a leading-zero convention for first-year production runs.',
          'Blank neck plates were available on the market; physical verification is important for any early Charvel.',
        ],
        verificationTips: [
          'Check the neck plate for the Charvel name and San Dimas, California address.',
          'Inspect for USA-made construction details: hand-shaped neck, alder or ash body, Floyd Rose or Kahler tremolo.',
          'The headstock logo style helps distinguish USA production (toothpaste/hockey-stick script) from early Japanese imports.',
        ],
      },
      additionalContextRichText: `<h3>Overview</h3><p>This 4-digit serial below 1001 is consistent with very early Charvel pre-production (circa 1979-1981) or an early Japanese import format. The main San Dimas production range (1001-5491) officially began in November 1981.</p><h3>What To Verify</h3><ul><li>Check the neck plate for the Charvel name — original San Dimas plates carry a San Dimas, California address.</li><li>Inspect for USA-made construction: hand-shaped neck, alder or ash body, Floyd Rose or Kahler tremolo.</li><li>The headstock logo style helps distinguish USA production from early Japanese imports.</li></ul><h3>Coal Creek Guitars Note</h3><p>Charvels with sub-1001 serials are rare and should be authenticated against the physical instrument. If it is a genuine USA pre-production piece, it may have significant collector value.</p>`,
    };
  }

  if (num > 5491) {
    const info: GuitarInfo = {
      brand: 'Charvel',
      serialNumber: serial,
      year: '2002-2005 (estimated)',
      factory: 'Charvel/Fender (post-acquisition era)',
      country: 'USA',
      model: 'San Dimas reissue',
      notes: `Serial ${num} is above the original San Dimas production range (1001-5491, 1981-1986). Serials in the 5492-6999+ range are associated with early Fender-era Charvel San Dimas reissues produced after Fender's 2002 acquisition, using period-style neck plates with sequential numbers continuing above the original range. Verify the neck plate text, headstock logo, tremolo, and country-of-origin marking to confirm this is a legitimate Fender-era instrument rather than a non-original blank plate.`,
    };
    return {
      success: true,
      info,
      patternKey: 'charvel-san-dimas-fender-era-reissue-4digit',
      patternLabel: 'Charvel San Dimas Fender-era reissue 4-digit',
      additionalContext: {
        title: 'Charvel San Dimas Fender-era reissue serial',
        summary: `This 4-digit serial above 5491 is consistent with an early Fender-era Charvel San Dimas reissue (2002-2005), using neck plates with sequential numbers continuing above the original San Dimas range.`,
        highlights: [
          'Original San Dimas production ran from serial 1001 to 5491 (1981-1986).',
          `Serial ${num} is above the original range and is consistent with early Fender-era San Dimas reissue production.`,
          'Fender acquired Charvel in 2002 and produced San Dimas reissues using a similar neck-plate sequential format.',
          'Early Fender-era serials in the 5492-6999+ range are a documented continuation format.',
        ],
        caveats: [
          'Blank neck plates were sold on the black market after 1986, so physical verification is important.',
          'Fender-era reissues will have modern construction details relative to the original 1981-1986 instruments.',
          'Verify with the headstock logo, neck plate text, tremolo type, and country-of-origin marking.',
        ],
        verificationTips: [
          'Confirm the headstock logo — Fender-era reissues often have a slightly updated logo style relative to 1981-1986 originals.',
          'Check the neck-through or bolt-on construction against early 2000s Pro-Mod specs.',
          'Look for a Made in USA marking on the headstock, neck, or neck pocket.',
        ],
      },
      additionalContextRichText: `<h3>Overview</h3><p>This 4-digit serial above 5491 is consistent with an early Fender-era Charvel San Dimas reissue (2002-2005), produced after Fender's 2002 acquisition using a continuation of the original San Dimas sequential neck-plate format.</p><h3>How This Pattern Is Typically Read</h3><p>Original San Dimas production ran from serial 1001 to 5491 (1981-1986). Serial ${num} is above the original range and is consistent with early Fender-era production (2002-2005). Early Fender-era serials in the 5492-6999+ range are a documented continuation format on similar neck plates.</p><h3>What To Verify</h3><ul><li>Blank neck plates were sold on the black market after 1986, so physical verification is essential.</li><li>Confirm the headstock logo, neck plate text, tremolo, pickups, and construction against early 2000s Pro-Mod specs.</li><li>Look for a Made in USA marking.</li></ul><h3>Coal Creek Guitars Note</h3><p>Treat this as a Fender-era San Dimas reissue candidate, then verify the instrument against its headstock logo, construction, and hardware to confirm authenticity.</p>`,
    };
  }

  // Determine year from serial range
  let year: string;
  if (num <= 1095) {
    year = 'Late 1981';
  } else if (num <= 1724) {
    year = '1982';
  } else if (num <= 2938) {
    year = '1983';
  } else if (num <= 4261) {
    year = '1984';
  } else if (num <= 5303) {
    year = '1985';
  } else {
    year = '1986';
  }

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: year,
    factory: 'San Dimas, California',
    country: 'USA',
    notes: `Authentic San Dimas Charvel. Serial ${num} indicates ${year} production. These guitars feature a neckplate reading "Charvel, P.O. Box 245, San Dimas, CA 91773" and "MADE IN USA" on the headstock. Highly collectible vintage instruments.`,
  };

  return { success: true, info };
}

// Japanese neck-through: C + year digit + sequential (1986-1991)
function decodeJapanNeckThrough(serial: string): DecodeResult {
  const yearDigit = serial.charAt(1);
  const sequence = serial.substring(2);

  // Decode year from digit
  const yearMap: Record<string, string> = {
    '6': '1986',
    '7': '1987',
    '8': '1988',
    '9': '1989',
    '0': '1990',
    '1': '1991',
  };

  const year = yearMap[yearDigit] || 'Unknown';

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: year,
    factory: 'Chushin Gakki (Nagano Prefecture)',
    country: 'Japan',
    model: 'Model 5 or Model 6 (neck-through)',
    notes: `Japanese neck-through model. "C${yearDigit}" indicates ${year} production. Sequence: ${sequence}. These were made at Chushin Gakki in Japan. 1986 serials appear on a sticker on the headstock back; 1987+ are stamped into the final fret of the fingerboard.`,
  };

  return { success: true, info };
}

// Modern Korea/WMI: CF + YY + sequence
function decodeKoreaCF(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const yearNum = parseInt(yearDigits, 10);
  const year = Number.isNaN(yearNum) ? undefined : (2000 + yearNum).toString();

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year,
    factory: 'World Music Instruments (WMI)',
    country: 'South Korea',
    notes: `CF-prefix modern production format interpreted as CF + YY + sequence. Parsed year: ${year || 'unknown'}. Sequence: ${sequence}. Confirm with country-of-origin marking and model specs.`,
  };

  return { success: true, info };
}

// Japanese MIJ neck plate: 5-digit (roughly 1986-1989)
function decodeJapanNeckPlate(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: '~1986-1989',
    factory: 'Chushin Gakki (Nagano Prefecture)',
    country: 'Japan',
    notes: `5-digit MIJ (Made in Japan) serial number ${num.toLocaleString()}, typically found on a neck plate reading "Fort Worth, Texas" despite being manufactured in Japan. These Charvel guitars were bolt-on models from the late 1980s. The serial is sequential and not date-coded — determine the exact year by checking headstock logo style ("toothpaste" vs "Strat-style"), tremolo type (Kahler vs JT-6), and other physical features. Caution: blank or forged neck plates exist, so verify the guitar's features match the era.`,
  };

  return { success: true, info };
}

// Japanese bolt-on: 6-digit sequential (220000+)
function decodeJapanBoltOn(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // Japanese bolt-ons started at 220000
  if (num >= 220000) {
    const info: GuitarInfo = {
      brand: 'Charvel',
      serialNumber: serial,
      year: '1986-1991 (check physical features)',
      factory: 'Chushin Gakki (Nagano Prefecture)',
      country: 'Japan',
      model: 'Model 1, 2, 3, 3A, 4, or 7 (bolt-on)',
      notes: `Japanese bolt-on model. Serial ${num.toLocaleString()} is from the 6-digit sequential series. These serials are NOT date-coded. To determine year: 1986 = "TM" above L + no neckplate gasket + Kahler tremolo; 1987 = "TM" beside L + gasket + JT-6 tremolo; 1988+ = (R) symbol + gasket + JT-6. Neckplate says Fort Worth, Texas (despite being Made in Japan).`,
    };
    return { success: true, info };
  }

  // Could be USA Pro-Mod or other 6-digit format
  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: 'Check model/features',
    factory: 'Various',
    country: 'Check label',
    notes: `6-digit serial number ${num.toLocaleString()}. Could be Japanese production (if 220000+) or USA Pro-Mod. Check the guitar for country of origin marking.`,
  };

  return { success: true, info };
}

// Japanese MIJ/IMC-era neck plate: 7-digit sequential
function decodeJapanNeckPlate7Digit(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: 'mid-to-late 1980s or early 1990s (estimated)',
    factory: 'Chushin Gakki / IMC-era Japanese import production',
    country: 'Japan',
    notes: `7-digit numeric Charvel serial ${num.toLocaleString()} fits the Japanese-made IMC-era import neck-plate family, often seen on plates marked "Fort Worth, TX" despite being made in Japan. These serials are usually sequential rather than reliably date-coded, so use the serial with headstock logo, neck plate, tremolo, electronics, and country-of-origin markings to confirm the exact model and year.`,
  };

  return {
    success: true,
    info,
    patternKey: 'charvel-japan-imc-7-digit-neck-plate',
    patternLabel: 'Charvel Japanese IMC-era 7-digit neck-plate serial',
    additionalContext: {
      title: 'Charvel Japanese IMC-era serial',
      summary: 'This serial matches a 7-digit numeric pattern associated with Japanese Charvel imports from the IMC era.',
      highlights: [
        '7-digit numeric serials are commonly associated with Japanese-made Charvel import neck-plate instruments from the late 1980s into the early 1990s.',
        'A Fort Worth, TX neck plate on this era usually indicates the importer address, not USA manufacture.',
        `The numeric sequence reads as ${num.toLocaleString()}.`,
      ],
      caveats: [
        'The serial is best treated as sequential, not a precise date code.',
        'Blank or swapped neck plates can exist, so physical feature verification matters.',
      ],
      verificationTips: [
        'Check the headstock logo style, tremolo type, neck plate, and electronics.',
        'Look for Made in Japan or other country-of-origin markings.',
        'Compare photos with Charvel/Jackson import-era reference databases for the specific model.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 7-digit numeric pattern associated with Japanese Charvel imports from the IMC era.</p><h3>How This Pattern Is Typically Read</h3><p>These serials are generally treated as sequential rather than reliably date-coded. A Fort Worth, TX neck plate on this era usually indicates the importer address, not USA manufacture. The numeric sequence reads as ${num.toLocaleString()}.</p><h3>What To Verify</h3><ul><li>Check the headstock logo style, tremolo type, neck plate, and electronics.</li><li>Look for Made in Japan or other country-of-origin markings.</li><li>Blank or swapped neck plates can exist, so physical feature verification matters.</li></ul>`,
  };
}

// Modern Japan MIJ: JC + year + production (2009-2012)
function decodeModernJapan(serial: string): DecodeResult {
  const yearDigits = serial.substring(2, 4);
  const production = serial.substring(4);
  const year = `20${yearDigits}`;

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: year,
    factory: 'Chushin Gakki',
    country: 'Japan',
    model: 'Pro-Mod San Dimas Reissue',
    notes: `Modern Japanese (MIJ) Pro-Mod. "JC" = Japan/Charvel/Chushin. Year: ${year}. Production number: ${production}. These were the first run of Pro-Mod series before production moved to Mexico in 2013.`,
  };

  return { success: true, info };
}

// Mexican production: MC + year + production
function decodeMexico(serial: string): DecodeResult {
  const yearDigits = serial.substring(2, 4);
  const production = serial.substring(4);
  const year = `20${yearDigits}`;
  const yearInt = parseInt(year, 10);
  const currentYear = new Date().getFullYear();
  const yearIsFuture = yearInt > currentYear + 2;

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    ...(yearIsFuture ? {} : { year }),
    factory: 'Fender Mexico (Ensenada)',
    country: 'Mexico',
    model: 'Pro-Mod Series',
    notes: yearIsFuture
      ? `Mexican-made Pro-Mod. "MC" prefix indicates Mexico/Charvel. Production number: ${production}. Made at Fender's Ensenada facility. The digits ${yearDigits} encode a year "${year}" which appears to be in the future — this may indicate a misread digit or a non-standard serial encoding. Models include Pro-Mod Style 1, Style 2, DK22, DK24, and So-Cal series.`
      : `Mexican-made Pro-Mod. "MC" prefix indicates Mexico/Charvel. Year: ${year}. Production number: ${production}. Made at Fender's Ensenada facility. Models include Pro-Mod Style 1, Style 2, DK22, DK24, and So-Cal series.`,
  };

  return { success: true, info };
}

// Mexican early 2013: CM prefix
function decodeMexicoCM(serial: string): DecodeResult {
  const production = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: '2013 (early)',
    factory: 'Fender Mexico (Ensenada)',
    country: 'Mexico',
    model: 'Pro-Mod Series',
    notes: `Early 2013 Mexican production. "CM" prefix was used on early 2013 neckplates. Production number: ${production}. Made at Fender's Ensenada facility.`,
  };

  return { success: true, info };
}

// Indonesian Samick modern import: ISC + YY + ####
function decodeIndonesiaSamickISC(serial: string): DecodeResult {
  const yearDigits = serial.substring(3, 5);
  const production = serial.substring(5);
  const year = `20${yearDigits}`;

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year,
    factory: 'Samick Indonesia',
    country: 'Indonesia',
    notes: `Modern Indonesian Charvel import. "ISC" is interpreted as Indonesia/Samick/Charvel. Year: ${year}. Production number: ${production}. Verify with the headstock or neck-plate country-of-origin marking if exact factory attribution matters.`,
  };

  return { success: true, info };
}

// Modern import: 10-digit alphanumeric
function decodeModernImport(serial: string): DecodeResult {
  const countryCode = serial.charAt(0);
  const factoryCode = serial.charAt(1);
  const brandCode = serial.charAt(2);
  const yearDigits = serial.substring(3, 5);
  const production = serial.substring(5);

  // Country codes
  const countries: Record<string, string> = {
    'I': 'Indonesia',
    'C': 'China',
    'M': 'Mexico',
    'N': 'India',
  };

  // Factory codes
  const factories: Record<string, string> = {
    'H': 'Harmony Musical Instruments',
    'W': 'World Music Instruments (WMI)',
    'C': 'Cort',
    'S': 'Samick',
  };

  const country = countries[countryCode] || 'Unknown';
  const factory = factories[factoryCode] || 'Unknown';
  const year = `20${yearDigits}`;

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: year,
    factory: factory,
    country: country,
    notes: `Modern import model. Country: ${country} (${countryCode}). Factory: ${factory} (${factoryCode}). Brand code: ${brandCode}. Year: ${year}. Production number: ${production}.`,
  };

  return { success: true, info };
}

// USA Select/Pro-Mod: 10-digit format
function decodeUSASelect(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: 'Contact Charvel',
    factory: 'Corona, California (likely)',
    country: 'USA (likely)',
    model: 'USA Select or Pro-Mod',
    notes: `This appears to be a USA Select or Pro-Mod format. For exact dating of USA models, contact consumerrelations@charvel.com. Serial number: ${serial}.`,
  };

  return { success: true, info };
}

// USA Pro-Mod 2009-2010: 00XXXX format
function decodeUSAProMod(serial: string): DecodeResult {
  const production = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: '2009-2010',
    factory: 'Corona, California',
    country: 'USA',
    model: 'USA Pro-Mod',
    notes: `USA Pro-Mod. Production number: ${production}. First batch started at 0000 in 2009. Made at Fender's Corona, California facility.`,
  };

  return { success: true, info };
}

// USA Pro-Mod 2010+: 10000XXX or 11000XXX format
function decodeUSAProMod2010(serial: string): DecodeResult {
  const firstTwo = serial.substring(0, 2);

  let year: string;
  if (firstTwo === '10') {
    year = '2010';
  } else if (firstTwo === '11') {
    year = '2011';
  } else {
    year = '2010+';
  }

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: year,
    factory: 'Corona, California',
    country: 'USA',
    model: 'USA Pro-Mod',
    notes: `USA Pro-Mod. Year: ${year}. Serial prefix "${firstTwo}" indicates year. Made at Fender's Corona, California facility.`,
  };

  return { success: true, info };
}

// Surfcaster: 365XXX-388XXX
function decodeSurfcaster(serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: '1990s',
    factory: 'Various',
    country: 'Check label',
    model: 'Surfcaster',
    notes: `Surfcaster series. Serial range 365XXX-388XXX. The first Surfcaster series did not include gold sparkle finish. Check the guitar for country of origin.`,
  };

  return { success: true, info };
}

// Numeric 8-digit modern import-style format: YYMM + sequence
function decodeNumeric8Modern(serial: string): DecodeResult {
  const yy = parseInt(serial.substring(0, 2), 10);
  const mm = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  const monthName = getMonthName(mm);

  const info: GuitarInfo = {
    brand: 'Charvel',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Unknown (8-digit numeric format)',
    country: 'Unknown (likely import)',
    notes: `8-digit numeric format interpreted as YYMM + sequence. Sequence: ${sequence}. Charvel serial schemes vary by factory and era, so this read is a best-effort estimate; verify with country-of-origin markings.`,
  };

  return { success: true, info };
}

// UC-prefix: China import models (Desolation era and related)
function decodeCharvelUCChina(normalized: string, cleaned: string): DecodeResult {
  const yearDigits = normalized.substring(2, 4);
  const sequence = normalized.substring(4);
  const yearNum = parseInt(yearDigits, 10);
  const year = Number.isNaN(yearNum) ? undefined : (2000 + yearNum).toString();
  const sequenceNumber = parseInt(sequence, 10);

  return {
    success: true,
    info: {
      brand: 'Charvel',
      serialNumber: cleaned,
      year: year ?? 'Unknown',
      factory: 'China (UC-prefix import facility)',
      country: 'China',
      model: 'Desolation Series or related China import model',
      notes: `UC-prefix Charvel import serial. UC identifies a Chinese-manufactured Charvel model (Desolation Series and related budget/mid-tier import lines). The digits ${yearDigits} decode as production year ${year ?? 'unknown'}. The remaining digits are production sequence ${sequenceNumber}. Verify with country-of-origin markings on the back of the headstock and compare specs against Desolation Series catalog entries for ${year ?? 'the decoded year'}.`,
    },
    patternKey: 'charvel-uc-china-yy-sequence',
    patternLabel: 'Charvel UC-prefix China YY sequence',
    additionalContext: {
      title: 'Charvel UC-prefix China serial',
      summary: 'This serial matches a Charvel UC-prefix format associated with Chinese-manufactured models, primarily the Desolation Series and related budget/mid-tier import lines.',
      highlights: [
        'UC identifies a Chinese-manufactured Charvel import model.',
        `The digits ${yearDigits} decode as production year ${year ?? 'unknown'}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
        'Associated primarily with the Charvel Desolation Series produced during the 2010s.',
      ],
      caveats: [
        'The serial identifies factory origin and approximate year, not the exact model name or configuration.',
        'UC-prefix instruments are Chinese factory builds under the Charvel brand, not Fender Mexico or USA Charvel production.',
        'Confirm the model name from the headstock or body markings.',
      ],
      verificationTips: [
        'Check the back of the headstock for "Made in China" and the Charvel logo.',
        'Use the Fender serial lookup tool — Charvel is a Fender-owned brand and some modern serials can be cross-referenced.',
        `Compare body shape, pickup layout, and hardware against Charvel Desolation Series catalog specs from ${year ?? 'the decoded year'}.`,
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Charvel UC-prefix format associated with Chinese-manufactured models, primarily the Desolation Series and related budget/mid-tier import lines.</p><h3>How This Pattern Is Typically Read</h3><p>UC identifies a Chinese-manufactured Charvel import model. The digits ${yearDigits} decode as production year ${year ?? 'unknown'}. The remaining digits decode as production sequence ${sequenceNumber}. This format is primarily associated with the Charvel Desolation Series produced during the 2010s.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for "Made in China" and the Charvel logo.</li><li>The serial identifies origin and approximate year — confirm the exact model name from the headstock or body markings.</li><li>Compare the body shape, pickup layout, and hardware against Charvel Desolation Series catalog specs.</li></ul>`,
  };
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

function decodeIMCAddressMark(serial: string): DecodeResult {
  return {
    success: true,
    info: {
      brand: 'Charvel',
      serialNumber: serial,
      year: '1986-1991 (estimated)',
      factory: 'Chushin Gakki, Nagano Prefecture',
      country: 'Japan',
      notes: 'TX76113 is not a serial number — it is the Fort Worth, Texas zip code (P.O. Box 2344, Fort Worth, TX 76113) stamped on the neck plate by U.S. importer IMC Inc. This identifies a genuine vintage Japanese-made Charvel from the Chushin Gakki era (1986–1991). The actual serial number is typically found on the headstock, body cavity, or neck heel of the instrument.',
    },
    patternKey: 'charvel-imc-address-tx-mark',
    patternLabel: 'Charvel IMC address mark (TX + 5-digit zip)',
    additionalContext: {
      title: 'Charvel IMC Fort Worth address stamp',
      summary: 'TX76113 is the Fort Worth, TX zip code of Charvel\'s U.S. importer IMC Inc., stamped on vintage Japanese neck plates. It identifies the era and origin but is not a serial number.',
      highlights: [
        'TX76113 = IMC Inc., P.O. Box 2344, Fort Worth, TX 76113 — the U.S. importer.',
        'Guitars with this stamp were built by Chushin Gakki in Nagano Prefecture, Japan.',
        'Production window: approximately 1986–1991.',
        'The actual serial number is located elsewhere — headstock, body cavity, or neck heel.',
      ],
      caveats: [
        'This is an importer address stamp, not a production serial number.',
        'The real serial number encodes more specific production date and factory information.',
        'Chushin Gakki also built guitars for other brands during this era (e.g. BC Rich, Westone, Grover Jackson).',
      ],
      verificationTips: [
        'Look for the actual serial number on the headstock (ink stamp or sticker) or inside the body cavity.',
        'Check the neck heel or neck pocket for a date stamp.',
        'Compare hardware, logo style, and body construction against known Chushin-built Charvel examples from 1986–1991.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>TX76113 is not a serial number — it is the U.S. zip code of Charvel's importer IMC Inc. (P.O. Box 2344, Fort Worth, TX 76113), stamped on the neck plates of vintage Japanese-made Charvels from 1986–1991. The guitar was built by Chushin Gakki in Nagano Prefecture, Japan.</p><h3>Finding the Real Serial Number</h3><p>The actual serial number is typically found on the headstock (ink stamp or sticker), inside the body cavity, or at the neck heel. The real serial encodes more specific production information.</p><h3>What To Verify</h3><ul><li>Look for the serial on the headstock, body cavity, or neck heel rather than the neck plate.</li><li>Check for any date stamps at the neck pocket.</li><li>Compare hardware, logo style, and construction against known Chushin-built Charvel examples from 1986–1991.</li></ul>`,
  };
}
