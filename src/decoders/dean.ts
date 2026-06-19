import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * Dean Guitar Serial Number Decoder
 *
 * Supports:
 * - USA-made guitars (7-digit format, 1977-1985 and 1996+)
 * - UnSung Korea (US prefix, 2006+)
 * - World Korea (E prefix, WK prefix)
 * - Legacy Korea E-prefix import line (E + Y + 5 digits)
 * - China imports (Z prefix, O prefix; YooJin Y prefix, 2006+)
 * - Indonesia (CT, IW prefixes)
 * - Samick Korea (S prefix, 1993-1996)
 * - Japan FujiGen (J, JF prefixes)
 * - Czech Republic (5-6 digit, 1997-2000)
 *
 * Note: Guitars from 1986-1995 (Tropical Music era) have serial numbers
 * on the last fret and cannot be reliably dated.
 */

export function decodeDean(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // UnSung Korea: US prefix (don't confuse with USA!)
  if (/^US\d{8,10}$/.test(normalized)) {
    return decodeUnSungKorea(normalized);
  }

  // World Korea: WK prefix (newer format)
  if (/^WK\d{8}$/.test(normalized)) {
    return decodeWorldKoreaWK(normalized);
  }

  // Legacy Korea E-prefix import line: E + single year digit + 5-digit sequence
  if (/^E[7-9]\d{5}$/.test(normalized)) {
    return decodeLegacyKoreaESingleYearDigit(normalized);
  }

  // World Korea: E prefix (older format)
  if (/^E\d{6,8}$/.test(normalized)) {
    return decodeWorldKoreaE(normalized);
  }

  // YooJin China: Y prefix
  if (/^Y\d{8,10}$/.test(normalized)) {
    return decodeYooJinChina(normalized);
  }

  // China import line: Z prefix
  if (/^Z\d{7,8}$/.test(normalized)) {
    return decodeChinaZ(normalized);
  }

  // Asian partner import line: A + YYMM + sequence
  if (/^A\d{8}$/.test(normalized)) {
    return decodeAsianPartnerA(normalized);
  }

  // Asian partner import line: D + YYMM + sequence
  if (/^D\d{8}$/.test(normalized)) {
    return decodeAsianPartnerD(normalized);
  }

  // Cort Korea: C + YY + batch + sequence (e.g. C2122845 = Cort 2021, batch 22, seq 845)
  if (/^C\d{7}$/.test(normalized)) {
    return decodeCortKoreaC(normalized);
  }

  // Indonesia: IW prefix
  if (/^IW\d{8,10}$/.test(normalized)) {
    return decodeIndonesiaIW(normalized);
  }

  // Indonesia: CT prefix
  if (/^CT\d{8,10}$/.test(normalized)) {
    return decodeIndonesiaCT(normalized);
  }

  // Japan FujiGen: JF prefix
  if (/^JF\d{6,8}$/.test(normalized)) {
    return decodeJapanFujiGen(normalized);
  }

  // Japan: J prefix
  if (/^J\d{6,8}$/.test(normalized)) {
    return decodeJapanJ(normalized);
  }

  // Samick Korea: S prefix (1993-1996)
  if (/^S\d{6,8}$/.test(normalized)) {
    return decodeSamickKorea(normalized);
  }

  // China: O prefix
  if (/^O\d{6,8}$/.test(normalized)) {
    return decodeChinaO(normalized);
  }

  // Korea: W prefix (DBZ Bolero and others)
  if (/^W\d{6,8}$/.test(normalized)) {
    return decodeKoreaW(normalized);
  }

  // India import line: H prefix (modern import pattern)
  if (/^H\d{5,10}$/.test(normalized)) {
    return decodeIndiaH(normalized);
  }

  // USA-made: 7-digit numeric (standard format)
  if (/^\d{7}$/.test(normalized)) {
    return decodeUSA7Digit(normalized);
  }

  // Czech Republic or USA: 5-6 digit (1997-2000 Czech or early USA)
  if (/^\d{5,6}$/.test(normalized)) {
    return decode5or6Digit(normalized);
  }

  // Older numeric formats (4+ digits, could be various eras)
  if (/^\d{4,8}$/.test(normalized)) {
    return decodeNumericGeneral(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Dean serial number. The format was not recognized. Common formats include: 7-digit (USA), US prefix (UnSung Korea), WK prefix (World Korea), Z/O/Y prefix (China imports), IW/CT prefix (Indonesia), C-prefix 8-digit (Cort Korea), or 5-6 digit (Czech Republic 1997-2000). Note: Guitars from 1986-1995 with serial numbers on the last fret cannot be reliably dated.',
  };
}

// UnSung Korea: US prefix (2006+)
function decodeUnSungKorea(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);

  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);

  let monthName: string | undefined;
  if (month >= 1 && month <= 12) {
    monthName = getMonthName(month);
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'UnSung Factory, Incheon',
    country: 'South Korea',
    notes: `US prefix indicates UnSung factory in Korea (not USA). UnSung has produced Dean guitars since 2006. Production sequence: ${sequence}. Note: Do not confuse "US" prefix with USA-made guitars.`,
  };

  return { success: true, info };
}

// World Korea: WK prefix (newer format, 2017+)
function decodeWorldKoreaWK(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);

  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);

  let monthName: string | undefined;
  if (month >= 1 && month <= 12) {
    monthName = getMonthName(month);
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'World Musical Instruments Co Ltd',
    country: 'South Korea',
    notes: `WK prefix indicates World factory in Korea (newer designation, 2017+). Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// World Korea: E prefix (older format, 2000-2015)
function decodeWorldKoreaE(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const yearNum = parseInt(yearDigits, 10);
  let year: string;

  if (yearNum >= 0 && yearNum <= 25) {
    year = (2000 + yearNum).toString();
  } else {
    year = `Possibly 20${yearDigits}`;
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year,
    factory: 'World Musical Instruments Co Ltd',
    country: 'South Korea',
    notes: `E prefix indicates World factory in Korea (older designation, primarily 2000-2015). Production sequence: ${sequence}. Note: Some E-prefix serials from early 2000s may have inconsistent year coding.`,
  };

  return { success: true, info };
}

// Legacy Korea E-prefix import line: E + Y + 5-digit sequence
function decodeLegacyKoreaESingleYearDigit(serial: string): DecodeResult {
  const yearDigit = serial[1];
  const sequence = serial.substring(2);
  const firstCandidate = `199${yearDigit}`;
  const secondCandidate = `200${yearDigit}`;

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: `${firstCandidate} or ${secondCandidate} (estimated)`,
    factory: 'Korean import production line',
    country: 'South Korea',
    notes: `E prefix is seen on Korean-made Dean imports. In this shorter E-prefix format, the first digit after E is commonly treated as a year digit, so ${yearDigit} may indicate ${firstCandidate} or ${secondCandidate}; the remaining digits are production sequence ${parseInt(sequence, 10)}. Verify with a Made in Korea headstock stamp, model features, and Dean support when exact dating matters.`,
  };

  return {
    success: true,
    info,
    patternKey: 'dean-legacy-korea-e-single-year-digit',
    patternLabel: 'Dean legacy Korea E-prefix single-year-digit format',
    additionalContext: {
      title: 'Dean legacy Korea E-prefix serial',
      summary: 'This serial matches a shorter E-prefix format seen on Korean-made Dean imports.',
      highlights: [
        'The E prefix is associated with Korean import production on many Dean guitars.',
        `The first digit after E is treated as a year digit, giving likely candidates of ${firstCandidate} or ${secondCandidate}.`,
        `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'Dean import serials can be inconsistent, especially across older Korean production runs.',
        'This decode identifies a likely country and era, not an exact model.',
        'The same year digit can overlap decades, so physical markings matter.',
      ],
      verificationTips: [
        'Check the back of the headstock for a Made in Korea stamp.',
        'Compare the guitar to Korean Dean models from the likely era, such as Icon, Vendetta, or Cadillac variants.',
        'Contact Dean support if a definitive production record is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a shorter E-prefix format seen on Korean-made Dean imports.</p><h3>How This Pattern Is Typically Read</h3><p>The E prefix is associated with Korean import production on many Dean guitars. The first digit after E is treated as a year digit, giving likely candidates of ${firstCandidate} or ${secondCandidate}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Dean import serials can be inconsistent, especially across older Korean production runs.</li><li>This decode identifies a likely country and era, not an exact model.</li><li>The same year digit can overlap decades, so physical markings matter.</li></ul><h3>Coal Creek Guitars Note</h3><p>Check for a Made in Korea headstock stamp, compare the model to Korean Dean specs from the likely era, and contact Dean support if exact dating is required.</p>`,
  };
}

// YooJin China: Y prefix (2006+)
function decodeYooJinChina(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);

  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);

  let monthName: string | undefined;
  if (month >= 1 && month <= 12) {
    monthName = getMonthName(month);
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'YooJin Factory',
    country: 'China',
    notes: `Y prefix indicates YooJin factory in China. YooJin has produced Dean guitars since 2006. Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// China import line: Z prefix
// Typical pattern: Z + YY + production sequence
function decodeChinaZ(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    factory: 'China import production line',
    country: 'China',
    notes: `Z prefix is commonly seen on Chinese-made Dean imports. Interpreted as Z + YY + production sequence, so ${yearDigits} indicates ${year}. Production sequence: ${sequence}. Verify with country-of-origin markings when exact authentication matters.`,
  };

  return {
    success: true,
    info,
    patternKey: 'dean-china-z-yy-sequence',
    patternLabel: 'Dean China Z-prefix YY sequence format',
    additionalContext: {
      title: 'Dean China Z-prefix serial',
      summary: 'This serial matches a Z-prefix format seen on Chinese-made Dean imports.',
      highlights: [
        'The Z prefix is commonly associated with Chinese Dean import production.',
        `The first two digits after Z are treated as the production year: ${year}.`,
        `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'Dean import serials can vary by factory and production run.',
        'This decode identifies the likely country and year, not a complete authenticity guarantee.',
      ],
      verificationTips: [
        'Check for a Made in China marking on the headstock, neck plate, or label.',
        'Compare the model features against Dean import specs from the decoded year.',
        'Contact Dean support if a definitive factory record is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Z-prefix format seen on Chinese-made Dean imports.</p><h3>How This Pattern Is Typically Read</h3><p>The Z prefix is commonly associated with Chinese Dean import production. The first two digits after Z are treated as the production year, giving ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Dean import serials can vary by factory and production run.</li><li>This decode identifies the likely country and year, not a complete authenticity guarantee.</li></ul><h3>Coal Creek Guitars Note</h3><p>Check for a Made in China marking, compare the guitar to Dean import specs from ${year}, and contact Dean support if exact dating is required.</p>`,
  };
}

function decodeAsianPartnerA(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);
  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);
  const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Asian partner import production line',
    country: 'China or Indonesia',
    notes: `A-prefix Dean import format interpreted as A + YYMM + production sequence. The A prefix identifies an Asian partner factory code; ${yearDigits} indicates ${year}; ${monthDigits} indicates ${monthName || 'an unverified month code'}; ${sequence} is the production sequence. Dean import serials identify production tracking more reliably than exact model identity, so verify the model from headstock markings and catalog specs.`,
  };

  return {
    success: true,
    info,
    patternKey: 'dean-asian-partner-a-yymm-sequence',
    patternLabel: 'Dean Asian partner A-prefix YYMM sequence',
    additionalContext: {
      title: 'Dean A-prefix import serial',
      summary: 'This serial matches an A-prefix Dean import format used by Asian manufacturing partners.',
      highlights: [
        'A is treated as an Asian partner factory code.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are treated as a month or internal production code.`,
        `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
      ],
      caveats: [
        'Dean import prefix letters can vary by partner and production run.',
        'This decode identifies likely production timing, not the exact model name.',
        'Country should be confirmed from Made in China, Made in Indonesia, label, or headstock markings.',
      ],
      verificationTips: [
        'Check the back of the headstock and neck plate for country-of-origin markings.',
        'Compare the guitar against 2007 Dean import specs such as Dimebag, EVO, Vendetta, and related import lines.',
        'Contact Dean support with photos if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an A-prefix Dean import format used by Asian manufacturing partners.</p><h3>How This Pattern Is Typically Read</h3><p>A is treated as an Asian partner factory code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits}${monthName ? ` decode as ${monthName}` : ' are treated as a month or internal production code'}. The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Dean import prefix letters can vary by partner and production run.</li><li>This decode identifies likely production timing, not the exact model name.</li><li>Confirm country of origin from headstock, neck plate, label, or other physical markings.</li></ul>`,
  };
}

function decodeAsianPartnerD(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);
  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);
  const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Asian partner import production line',
    country: 'China, South Korea, or Indonesia',
    notes: `D-prefix Dean import format interpreted as D + YYMM + production sequence. The D prefix identifies an Asian partner factory code; ${yearDigits} indicates ${year}; ${monthDigits} indicates ${monthName || 'an unverified month code'}; ${sequence} is production sequence ${sequenceNumber}. Dean factory codes can shift by run, so confirm country and exact model from headstock markings and catalog specs.`,
  };

  return {
    success: true,
    info,
    patternKey: 'dean-asian-partner-d-yymm-sequence',
    patternLabel: 'Dean Asian partner D-prefix YYMM sequence',
    additionalContext: {
      title: 'Dean D-prefix import serial',
      summary: 'This serial matches a D-prefix Dean import format used by Asian manufacturing partners.',
      highlights: [
        'D is treated as an Asian partner factory code.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are treated as a month or internal production code.`,
        `The final digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'Dean import prefix letters can vary by partner and production run.',
        'This decode identifies likely production timing, not the exact model name.',
        'Country should be confirmed from Made in markings, label, or headstock details.',
      ],
      verificationTips: [
        'Check the back of the headstock for country-of-origin markings.',
        'Compare hardware, body shape, and finish against Dean import specs from the decoded year.',
        'Contact Dean support with photos if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a D-prefix Dean import format used by Asian manufacturing partners.</p><h3>How This Pattern Is Typically Read</h3><p>D is treated as an Asian partner factory code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits}${monthName ? ` decode as ${monthName}` : ' are treated as a month or internal production code'}. The final digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Dean import prefix letters can vary by partner and production run.</li><li>This decode identifies likely production timing, not the exact model name.</li><li>Confirm country of origin from headstock, neck plate, label, or other physical markings.</li></ul>`,
  };
}

// Indonesia: IW prefix
function decodeIndonesiaIW(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);

  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);

  let monthName: string | undefined;
  if (month >= 1 && month <= 12) {
    monthName = getMonthName(month);
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Indonesia',
    country: 'Indonesia',
    notes: `IW prefix indicates Indonesian production. Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Indonesia: CT prefix
function decodeIndonesiaCT(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);

  const year = 2000 + parseInt(yearDigits, 10);
  const month = parseInt(monthDigits, 10);

  let monthName: string | undefined;
  if (month >= 1 && month <= 12) {
    monthName = getMonthName(month);
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Indonesia (CT factory)',
    country: 'Indonesia',
    notes: `CT prefix indicates Indonesian production. Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Japan FujiGen: JF prefix
function decodeJapanFujiGen(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const yearNum = parseInt(yearDigits, 10);
  let year: string;

  if (yearNum >= 80 && yearNum <= 99) {
    year = `19${yearDigits}`;
  } else if (yearNum >= 0 && yearNum <= 30) {
    year = `20${yearDigits.padStart(2, '0')}`;
  } else {
    year = `Possibly 19${yearDigits} or 20${yearDigits}`;
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year,
    factory: 'FujiGen Gakki',
    country: 'Japan',
    notes: `JF prefix indicates FujiGen factory in Japan. FujiGen is known for high-quality production. Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Japan: J prefix
function decodeJapanJ(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const yearNum = parseInt(yearDigits, 10);
  let year: string;

  if (yearNum >= 80 && yearNum <= 99) {
    year = `19${yearDigits}`;
  } else if (yearNum >= 0 && yearNum <= 30) {
    year = `20${yearDigits.padStart(2, '0')}`;
  } else {
    year = `Possibly 19${yearDigits} or 20${yearDigits}`;
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year,
    factory: 'Japan (possibly FujiGen or similar)',
    country: 'Japan',
    notes: `J prefix indicates Japanese production (possibly FujiGen or China in some cases). Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Samick Korea: S prefix (1993-1996)
function decodeSamickKorea(serial: string): DecodeResult {
  const digits = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: '1993-1996 (exact year uncertain)',
    factory: 'Samick',
    country: 'South Korea',
    notes: `S prefix indicates Samick factory in Korea, used from 1993-1996. Serial number format from this era does not reliably encode the year. Production number: ${digits}.`,
  };

  return { success: true, info };
}

// China: O prefix
function decodeChinaO(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    factory: 'China',
    country: 'China',
    notes: `O prefix indicates Chinese production. Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// Korea: W prefix (DBZ Bolero and others)
function decodeKoreaW(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);

  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Korea',
    country: 'South Korea',
    notes: `W prefix indicates Korean production (often seen on DBZ Bolero models). Production sequence: ${sequence}.`,
  };

  return { success: true, info };
}

// India import line: H prefix
// Typical pattern: H + YYMM + sequence (variable sequence length in the wild)
function decodeIndiaH(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.length >= 4 ? digits.substring(2, 4) : '';
  const sequence = digits.length > 4 ? digits.substring(4) : '';

  const yearNum = parseInt(yearDigits, 10);
  const monthNum = monthDigits ? parseInt(monthDigits, 10) : NaN;

  let year: string | undefined;
  if (!Number.isNaN(yearNum)) {
    const fullYear = 2000 + yearNum;
    if (fullYear <= new Date().getFullYear()) {
      year = fullYear.toString();
    } else if (yearNum >= 80) {
      year = (1900 + yearNum).toString();
    } else {
      year = `20${yearDigits}`;
    }
  }

  const month = !Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12
    ? getMonthName(monthNum)
    : undefined;

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year,
    month,
    factory: 'India import production line',
    country: 'India',
    notes: `H prefix import format interpreted as H + YYMM + sequence. Parsed digits: ${digits}.${sequence ? ` Sequence: ${sequence}.` : ''} Spacing/hyphen differences are normalization variants of the same serial.`
  };

  return { success: true, info };
}

// USA-made: 7-digit format
function decodeUSA7Digit(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const sequence = serial.substring(2);

  const yearNum = parseInt(yearDigits, 10);
  let year: string;
  let notes: string;

  if (yearNum >= 77 && yearNum <= 85) {
    year = `19${yearDigits}`;
    notes = `USA-made Dean from the original Zelinsky era (1977-1985). These guitars were made in Evanston, IL (1976-1978) or Chicago (1979+). Production sequence: ${sequence}.`;
  } else if (yearNum >= 86 && yearNum <= 95) {
    // Tropical Music era - unreliable
    year = `Possibly 19${yearDigits} (uncertain)`;
    notes = `This serial number format suggests 19${yearDigits}, but guitars from 1986-1995 (Tropical Music era) have inconsistent serial numbers. Check if the serial is stamped on the last fret - if so, dating is unreliable. Production sequence: ${sequence}.`;
  } else if (yearNum >= 96 && yearNum <= 99) {
    year = `19${yearDigits}`;
    notes = `USA-made Dean from the Armadillo Enterprises era (1997+). Production returned to consistent serial numbering. Production sequence: ${sequence}.`;
  } else if (yearNum >= 0 && yearNum <= 30) {
    year = `20${yearDigits.padStart(2, '0')}`;
    notes = `USA-made Dean (Armadillo Enterprises era). 7-digit serials indicate USA production. Production sequence: ${sequence}.`;
  } else {
    year = `Unknown (first digits: ${yearDigits})`;
    notes = `7-digit format typically indicates USA production. First two digits (${yearDigits}) should indicate year. Production sequence: ${sequence}.`;
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year,
    factory: 'Dean USA',
    country: 'USA',
    notes: notes,
  };

  return { success: true, info };
}

// Czech Republic or USA: 5-6 digit format
function decode5or6Digit(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const sequence = serial.substring(2);

  const yearNum = parseInt(yearDigits, 10);
  let year: string;
  let country: string;
  let factory: string;
  let notes: string;

  if (yearNum >= 97 && yearNum <= 99) {
    // Likely Czech Republic 1997-1999
    year = `19${yearDigits}`;
    country = 'Czech Republic (likely) or USA';
    factory = 'Strunal Schönbach (Czech Republic) or Dean USA';
    notes = `5-6 digit serial from 1997-2000 era. Dean guitars were made in Czech Republic during this period at Strunal Schönbach factory. These are sought after for their build quality. If marked "Made in USA" it's American; otherwise likely Czech. Production sequence: ${sequence}.`;
  } else if (yearNum === 0) {
    year = '2000';
    country = 'Czech Republic (likely) or USA';
    factory = 'Strunal Schönbach (Czech Republic) or Dean USA';
    notes = `5-6 digit serial from ~2000. Could be Czech Republic production (phased out early 2000s) or USA. Production sequence: ${sequence}.`;
  } else if (yearNum >= 77 && yearNum <= 85) {
    year = `19${yearDigits}`;
    country = 'USA';
    factory = 'Dean USA (Evanston/Chicago)';
    notes = `Early USA-made Dean from the original Zelinsky era (1977-1985). Production sequence: ${sequence}.`;
  } else if (serial.length === 5) {
    year = 'Unknown (likely late 1990s-early 2000s Czech import or vintage USA, verify markings)';
    country = 'Czech Republic or USA';
    factory = 'Dean European Custom Select / Strunal Schönbach or Dean USA';
    notes = `5-digit numeric Dean serial treated as a sequential production number rather than a reliable embedded date. This format is seen on some Czech Republic European Custom Select instruments from the late 1990s to early 2000s, and can overlap visually with older USA Dean numeric stamps. Sequence/tracking number: ${parseInt(serial, 10)}. Check for "Handcrafted in the Czech Republic", "Made in USA", headstock markings, and model details before assigning a factory or year.`;
  } else {
    year = `Possibly 19${yearDigits} or 20${yearDigits}`;
    country = 'Unknown';
    factory = 'Unknown';
    notes = `5-6 digit format. First two digits (${yearDigits}) may indicate year. Could be Czech Republic (1997-2000), USA, or import. Check for "Made in" marking on instrument. Production sequence: ${sequence}.`;
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year,
    factory: factory,
    country: country,
    model: serial.length === 5 && !(yearNum >= 77 && yearNum <= 85) && !(yearNum >= 97 && yearNum <= 99)
      ? '5-digit numeric Dean format'
      : undefined,
    notes: notes,
  };

  if (serial.length === 5 && !(yearNum >= 77 && yearNum <= 85) && !(yearNum >= 97 && yearNum <= 99)) {
    return {
      success: true,
      info,
      patternKey: 'dean-five-digit-sequential-czech-or-usa',
      patternLabel: 'Dean 5-digit sequential Czech/USA ambiguous format',
      additionalContext: {
        title: 'Dean 5-digit numeric serial',
        summary: 'This serial matches a 5-digit Dean numeric format best treated as a sequential tracking number unless country markings provide more context.',
        highlights: [
          `The full number ${serial} is treated as sequence/tracking number ${parseInt(serial, 10)}.`,
          'This style can be seen on late-1990s to early-2000s Czech European Custom Select instruments.',
          'A visually similar 5-digit numeric stamp can also appear on older USA Dean instruments.',
        ],
        caveats: [
          'The digits do not reliably encode an exact year or month by themselves.',
          'Do not assign Czech Republic or USA production from the serial alone.',
          'Model, logo, country stamp, and construction details are required for confident identification.',
        ],
        verificationTips: [
          'Look for Handcrafted in the Czech Republic or Made in USA near the serial or on the headstock.',
          'Compare the body shape and hardware against Dean European Custom Select and vintage USA catalog examples.',
          'Contact Dean support with photos if exact dating or authentication matters.',
        ],
      },
      additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 5-digit Dean numeric format best treated as a sequential tracking number unless country markings provide more context.</p><h3>How This Pattern Is Typically Read</h3><p>The full number ${serial} is treated as sequence/tracking number ${parseInt(serial, 10)}. This style can be seen on late-1990s to early-2000s Czech European Custom Select instruments, while visually similar 5-digit numeric stamps can also appear on older USA Dean instruments.</p><h3>What To Verify</h3><ul><li>The digits do not reliably encode an exact year or month by themselves.</li><li>Do not assign Czech Republic or USA production from the serial alone.</li><li>Check for Handcrafted in the Czech Republic, Made in USA, model markings, and period-correct construction details.</li></ul>`,
    };
  }

  return { success: true, info };
}

// General numeric format (various eras)
function decodeNumericGeneral(serial: string): DecodeResult {
  const length = serial.length;
  const yearDigits = serial.substring(0, 2);
  const yearNum = parseInt(yearDigits, 10);

  let year: string;
  let notes: string;

  if (length === 4) {
    // Very short - likely early production or Tropical era
    year = 'Unknown (short serial)';
    notes = `4-digit serial number. This format was used in various eras. If the serial is on the last fret rather than headstock, it's from the Tropical Music era (1986-1995) and cannot be reliably dated.`;
  } else if (length === 8) {
    // 8-digit without prefix - likely import
    if (yearNum >= 0 && yearNum <= 30) {
      year = `20${yearDigits.padStart(2, '0')}`;
    } else if (yearNum >= 80 && yearNum <= 99) {
      year = `19${yearDigits}`;
    } else {
      year = `Unknown (first digits: ${yearDigits})`;
    }
    notes = `8-digit numeric serial without letter prefix. First two digits (${yearDigits}) likely indicate year. This may be an import guitar - check for "Made in" marking.`;
  } else {
    if (yearNum >= 77 && yearNum <= 99) {
      year = `Possibly 19${yearDigits}`;
    } else if (yearNum >= 0 && yearNum <= 30) {
      year = `Possibly 20${yearDigits.padStart(2, '0')}`;
    } else {
      year = 'Unknown';
    }
    notes = `${length}-digit serial number. Dating is uncertain without additional context. If serial is on the last fret, it's from the Tropical Music era (1986-1995) and cannot be reliably dated.`;
  }

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year,
    factory: 'Unknown',
    country: 'Unknown (check "Made in" marking)',
    notes: notes,
  };

  return { success: true, info };
}

function decodeCortKoreaC(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const batchDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Dean',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Cort, Daejeon, South Korea',
    country: 'South Korea',
    notes: `C prefix identifies the Cort/Cor-Tek facility in Daejeon, South Korea. Format: C + YY + batch + sequence. The digits ${yearDigits} decode as production year ${year}. Batch code: ${batchDigits}. Production sequence: ${sequence}. Dean has used Cort as a manufacturing partner for many mid-range and import models.`,
  };

  return {
    success: true,
    info,
    patternKey: 'dean-cort-korea-c-yy-batch-sequence',
    patternLabel: 'Dean Cort Korea C-prefix YY batch sequence',
  };
}

// Helper function for month names
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}
