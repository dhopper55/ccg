import { DecodeResult, GuitarInfo } from '../types.js';

export function decodePRS(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[^A-Z0-9]/g, '');

  // S2 Series: S2 + 6 digits (2013+)
  if (/^S2\d{6}$/.test(normalized)) {
    return decodeS2Series(normalized);
  }

  // Acoustic: A + 2-digit year + sequence (e.g., A12001)
  if (/^A\d{5,}$/.test(normalized)) {
    return decodeAcoustic(normalized);
  }

  // SE Series: CTI + numeric digits only (no year letter — e.g. CTI02544 = Cort Indonesia 2002)
  // Must be checked before the CT[CI][A-Z] handler which requires a letter after the factory code
  if (/^CTI\d{5,}$/.test(normalized)) {
    return decodeSECortIndonesiaNumericYear(normalized);
  }

  // SE Series with factory code: CTC/CTI + letter + digits (China/Indonesia)
  if (/^CT[CI][A-Z]\d+$/.test(normalized)) {
    return decodeSECort(normalized);
  }

  // SE Series: Single letter + digits (Korean, 2000+)
  if (/^[A-Z]\d{4,6}$/.test(normalized)) {
    return decodeSEKorea(normalized);
  }

  // CE Models: CE + digits (1998-2008)
  if (/^CE\d+$/.test(normalized)) {
    return decodeCE(normalized);
  }

  // EG Models: EC + digits (1990-1995)
  if (/^EC\d+$/.test(normalized)) {
    return decodeEG(normalized);
  }

  // Swamp Ash Special: SA + digits (1998-2009)
  if (/^SA\d+$/.test(normalized)) {
    return decodeSwampAsh(normalized);
  }

  // Electric Bass: EB + digits (2000-2004)
  if (/^EB\d+$/.test(normalized)) {
    return decodeElectricBass(normalized);
  }

  // USA Set-Neck with 2-digit year prefix: 08+, 09+, 10+, etc. (2008+)
  // Require at least 7 digits total (YY + 5+ sequence) to avoid misreading
  // older single-digit prefixes that are often entered without a space (e.g., "2 15107" -> "215107").
  if (/^(0[89]|[1-4]\d)\d{5,}$/.test(normalized)) {
    return decodeUSASetNeck2008Plus(normalized);
  }

  // USA Set-Neck: Single digit + sequence (1985-2007)
  // Check if this could be a USA set-neck based on sequence number
  if (/^\d{5,7}$/.test(normalized)) {
    return decodeUSASetNeck(normalized);
  }

  // CE Models with year-digit prefix: single digit + CE + digits (1985-2009)
  // e.g. 7CE17029 = year code 7 (1987/1997/2007) + CE model + sequence 17029
  if (/^[0-9]CE\d+$/.test(normalized)) {
    return decodeCEWithYearDigit(normalized);
  }

  // Bolt-on models with prefix codes
  // CE prefix "7" (1988-1997)
  if (/^7\d{4,}$/.test(normalized)) {
    return decodeCEOld(normalized);
  }

  // EG prefix "5" (1990-1995)
  if (/^5\d{4,}$/.test(normalized)) {
    return decodeEGOld(normalized);
  }

  // Swamp Ash prefix "8" (1997)
  if (/^8\d{4,}$/.test(normalized)) {
    return decodeSwampAshOld(normalized);
  }

  // Bass prefix "4" (bolt-on 1989-1991)
  if (/^4\d{4,}$/.test(normalized)) {
    return decodeBoltOnBass(normalized);
  }

  // Bass prefix "9" (set-neck 1986-1991)
  if (/^9\d{4,}$/.test(normalized)) {
    return decodeSetNeckBass(normalized);
  }

  // Private Stock: "Private Stock" + number (entered as text with number, e.g. "Private stock 9973")
  if (/^PRIVATESTOCK\d+$/.test(normalized)) {
    return decodePrivateStock(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this PRS serial number. The format was not recognized. Known formats include: S2-prefix (USA S2 Series), CTC/CTI-prefix (SE Cort China/Indonesia), single letter (SE Korea), numeric 5-7 digits (USA Core), 2-digit year prefix (USA Core 2008+). Please check the serial number and try again.'
  };
}

function decodePrivateStock(normalized: string): DecodeResult {
  const numStr = normalized.substring('PRIVATESTOCK'.length);
  const psNumber = parseInt(numStr, 10);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: normalized,
    factory: 'PRS Guitars (Stevensville, Maryland)',
    country: 'USA',
    model: 'Private Stock',
    notes: `PRS Private Stock guitar, number ${psNumber}. Private Stock instruments are hand-built at PRS headquarters in Stevensville, Maryland using premium tonewoods and customized specifications. Each Private Stock piece is individually crafted to the customer's or artist's specifications. Contact PRS directly at privatestock@prsguitars.com for detailed build history and specifications for this instrument.`,
  };

  return {
    success: true,
    info,
    patternKey: 'prs-private-stock-sequential',
    patternLabel: 'PRS Private Stock sequential number',
    additionalContext: {
      title: 'PRS Private Stock serial',
      summary: 'This is a PRS Private Stock serial — a hand-built custom instrument from PRS Guitars in Stevensville, Maryland.',
      highlights: [
        `Private Stock number: ${psNumber}.`,
        'Private Stock instruments are hand-built at PRS headquarters in Stevensville, Maryland.',
        'Each piece uses premium, hand-selected tonewoods and custom specifications.',
      ],
      caveats: [
        'Private Stock production numbers do not directly encode the production year.',
        'Exact build date, wood selection, and specifications require PRS records lookup.',
      ],
      verificationTips: [
        'Contact PRS directly at privatestock@prsguitars.com for detailed build history.',
        'Look for the Private Stock certificate or documentation that accompanied the guitar.',
        'Confirm authenticity from the PRS Private Stock headstock inlay and label inside the body.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This is a PRS Private Stock serial — a hand-built custom instrument from PRS Guitars in Stevensville, Maryland.</p><h3>How This Pattern Is Typically Read</h3><p>Private Stock number ${psNumber}. Private Stock instruments are individually crafted at PRS headquarters using premium, hand-selected tonewoods and customer-specified configurations.</p><h3>What To Verify</h3><ul><li>Contact PRS directly at privatestock@prsguitars.com for detailed build history.</li><li>Look for the Private Stock certificate or documentation that accompanied the guitar.</li><li>Confirm authenticity from the PRS Private Stock headstock inlay and label inside the body.</li></ul>`,
  };
}

// USA Set-Neck Sequential Ranges (1985-2006+)
const USA_SERIAL_RANGES: { start: number; end: number; year: number }[] = [
  { start: 1, end: 400, year: 1985 },
  { start: 401, end: 1700, year: 1986 },
  { start: 1701, end: 3500, year: 1987 },
  { start: 3501, end: 5400, year: 1988 },
  { start: 5401, end: 7600, year: 1989 },
  { start: 7601, end: 10100, year: 1990 },
  { start: 10101, end: 12600, year: 1991 },
  { start: 12601, end: 15000, year: 1992 },
  { start: 15001, end: 17900, year: 1993 },
  { start: 17901, end: 20900, year: 1994 },
  { start: 20901, end: 24600, year: 1995 },
  { start: 24601, end: 29500, year: 1996 },
  { start: 29501, end: 34600, year: 1997 },
  { start: 34601, end: 39100, year: 1998 },
  { start: 39101, end: 44499, year: 1999 },
  { start: 44500, end: 52199, year: 2000 },
  { start: 52200, end: 62199, year: 2001 },
  { start: 62200, end: 72353, year: 2002 },
  { start: 72354, end: 82254, year: 2003 },
  { start: 82255, end: 92555, year: 2004 },
  { start: 92556, end: 103103, year: 2005 },
  { start: 103104, end: 115000, year: 2006 },
  { start: 115001, end: 128000, year: 2007 },
];

// SE Letter year codes (A=2000, B=2001, etc.)
function getSEYear(letter: string): number {
  const baseYear = 2000;
  const letterCode = letter.charCodeAt(0) - 'A'.charCodeAt(0);
  return baseYear + letterCode;
}

function decodeUSASetNeck(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // Later pre-2008 Core/set-neck examples can be written as a single year digit
  // followed by the six-digit production sequence, e.g. 7 126922 = 2007.
  if (/^\d{7}$/.test(serial)) {
    const yearDigit = parseInt(serial[0], 10);
    const sequence = parseInt(serial.substring(1), 10);
    const matchingRange = USA_SERIAL_RANGES.find((range) =>
      sequence >= range.start &&
      sequence <= range.end &&
      range.year % 10 === yearDigit
    );

    if (matchingRange) {
      const info: GuitarInfo = {
        brand: 'PRS',
        serialNumber: serial,
        year: matchingRange.year.toString(),
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Core set-neck model',
        notes: `USA-made PRS Core/set-neck guitar. First digit ${yearDigit} indicates ${matchingRange.year}; production sequence ${sequence}. Core model serial numbers are typically written on the back of the headstock and identify year and production order, not the exact model name.`,
      };

      return {
        success: true,
        info,
        patternKey: 'prs-usa-core-single-year-digit-six-sequence',
        patternLabel: 'PRS USA Core year digit + six-digit sequence',
        additionalContext: {
          title: 'PRS USA Core serial',
          summary: 'This serial matches a PRS USA Core/set-neck format using a single year digit followed by a six-digit production sequence.',
          highlights: [
            `The first digit ${yearDigit} decodes as production year ${matchingRange.year}.`,
            `The remaining digits decode as production sequence ${sequence}.`,
            'This format is associated with USA-made Core/set-neck instruments before PRS moved to two-digit year prefixes.',
          ],
          caveats: [
            'The serial identifies year and production order, not the exact model name.',
            'A 2007 Core serial should normally be written on the back of the headstock rather than printed on a sticker.',
            'Model identification should be confirmed from the guitar itself, case paperwork, hang tag, or PRS support.',
          ],
          verificationTips: [
            'Check the back of the headstock for the handwritten or stamped serial.',
            'Compare the model features against PRS Core specifications from the estimated year.',
            'Contact PRS support with photos if exact model confirmation matters.',
          ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a PRS USA Core/set-neck format using a single year digit followed by a six-digit production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${yearDigit} decodes as production year ${matchingRange.year}. The remaining digits decode as production sequence ${sequence}. This format is associated with USA-made Core/set-neck instruments before PRS moved to two-digit year prefixes.</p><h3>What To Verify</h3><ul><li>The serial identifies year and production order, not the exact model name.</li><li>A 2007 Core serial should normally be written on the back of the headstock rather than printed on a sticker.</li><li>Model identification should be confirmed from the guitar itself, case paperwork, hang tag, or PRS support.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a USA Core production decode, then verify the exact model from physical features, paperwork, or PRS support.</p>`,
      };
    }
  }

  // Try to find year from sequential ranges
  for (const range of USA_SERIAL_RANGES) {
    if (num >= range.start && num <= range.end) {
      const info: GuitarInfo = {
        brand: 'PRS',
        serialNumber: serial,
        year: range.year.toString(),
        factory: 'PRS Factory, Stevensville, Maryland',
        country: 'USA',
        model: 'Set-Neck Model',
        notes: `Production number ${num}. USA-made set-neck guitar with serial on headstock.`
      };
      return { success: true, info };
    }
  }

  // If beyond known ranges, use first digit as year indicator
  const firstDigit = parseInt(serial[0], 10);
  const possibleYears = getYearsFromDigit(firstDigit);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: possibleYears.length === 1 ? possibleYears[0].toString() : possibleYears.join(' or '),
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Set-Neck Model',
    notes: `USA-made set-neck guitar. First digit indicates year. Serial located on headstock.`
  };
  return { success: true, info };
}

function decodeUSASetNeck2008Plus(serial: string): DecodeResult {
  // Extract 2-digit year prefix
  const yearPrefix = serial.substring(0, 2);
  const year = 2000 + parseInt(yearPrefix, 10);
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: year.toString(),
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Set-Neck Model',
    notes: `Production sequence: ${sequence}. Starting in 2008, PRS uses 2-digit year prefixes.`
  };
  return { success: true, info };
}

function decodeS2Series(serial: string): DecodeResult {
  const sequence = parseInt(serial.substring(2), 10);

  // S2 series production started 2013
  let year: string;
  if (sequence <= 3391) {
    year = '2013';
  } else if (sequence <= 10000) {
    year = '2014';
  } else if (sequence <= 17000) {
    year = '2015';
  } else if (sequence <= 23391) {
    year = '2016';
  } else {
    year = '2017 or later';
  }

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: year,
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'S2 Series',
    notes: `S2 Series - USA-made, more affordable line. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeSEKorea(serial: string): DecodeResult {
  const yearLetter = serial[0];
  const year = getSEYear(yearLetter);
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: year.toString(),
    factory: 'World Musical Instruments (WMI)',
    country: 'South Korea',
    model: 'SE Series',
    notes: `SE Series import model. Letter "${yearLetter}" indicates ${year}. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeSECortIndonesiaNumericYear(serial: string): DecodeResult {
  const yearDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const yearNum = parseInt(yearDigits, 10);
  const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Cort, Cikarang, Indonesia',
    country: 'Indonesia',
    model: 'SE Series',
    notes: `CTI prefix identifies the Cort Indonesia facility in Cikarang. Format: CTI + YY + sequence. The digits ${yearDigits} decode as production year ${year}. Production sequence: ${sequence}. This variant of the Cort Indonesia format uses a 2-digit year directly rather than a letter year code. Verify the model from the headstock and body markings.`,
  };

  return {
    success: true,
    info,
    patternKey: 'prs-se-cort-indonesia-cti-numeric-year',
    patternLabel: 'PRS SE Cort Indonesia CTI numeric year sequence',
  };
}

function decodeSECort(serial: string): DecodeResult {
  const factoryCode = serial.substring(0, 3);
  const yearLetter = serial[3];
  const year = getSEYear(yearLetter);
  const sequence = serial.substring(4);

  let factory: string;
  let country: string;
  if (factoryCode === 'CTC') {
    factory = 'Cort China';
    country = 'China';
  } else {
    factory = 'Cort Indonesia';
    country = 'Indonesia';
  }

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: year.toString(),
    factory: factory,
    country: country,
    model: 'SE Series',
    notes: `SE Series import. Factory code "${factoryCode}". Year letter "${yearLetter}" = ${year}. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeAcoustic(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequence = serial.substring(3);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: year.toString(),
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Acoustic Guitar',
    notes: `Acoustic model. "A" prefix denotes acoustic line. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeCE(serial: string): DecodeResult {
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1998-2008',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'CE (Classic Electric) Bolt-On',
    notes: `CE Series bolt-on neck model. "CE" prefix used 1998-2008. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeCEOld(serial: string): DecodeResult {
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1988-1997',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'CE (Classic Electric) Bolt-On',
    notes: `CE Series bolt-on neck model. "7" prefix used 1988-1997. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeEG(serial: string): DecodeResult {
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1990-1995',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'EG Series',
    notes: `EG Series bolt-on neck model. "EC" prefix. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeEGOld(serial: string): DecodeResult {
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1990-1995',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'EG Series',
    notes: `EG Series bolt-on neck model. "5" prefix. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeSwampAsh(serial: string): DecodeResult {
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1998-2009',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Swamp Ash Special',
    notes: `Swamp Ash Special bolt-on model. "SA" prefix used 1998-2009. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeSwampAshOld(serial: string): DecodeResult {
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1997',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Swamp Ash Special',
    notes: `Swamp Ash Special bolt-on model. "8" prefix used in 1997. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeElectricBass(serial: string): DecodeResult {
  const sequence = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '2000-2004',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Electric Bass',
    notes: `PRS Electric Bass. "EB" prefix used 2000-2004. Serial on headstock. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeBoltOnBass(serial: string): DecodeResult {
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1989-1991',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Bolt-On Bass',
    notes: `PRS Bolt-On Bass. "4" prefix used 1989-1991. Serial on neck plate. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeSetNeckBass(serial: string): DecodeResult {
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: '1986-1991',
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'Set-Neck Bass',
    notes: `PRS Set-Neck Bass. "9" prefix used 1986-1991. Serial on headstock. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeCEWithYearDigit(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const sequence = serial.substring(3);
  const possibleYears = getYearsFromDigit(yearDigit);
  const yearStr = possibleYears.length === 1 ? possibleYears[0].toString() : possibleYears.join(' or ');

  const info: GuitarInfo = {
    brand: 'PRS',
    serialNumber: serial,
    year: yearStr,
    factory: 'PRS Factory, Stevensville, Maryland',
    country: 'USA',
    model: 'CE (Classic Electric) Bolt-On',
    notes: `CE Series bolt-on neck model. First digit ${yearDigit} is a year code indicating ${yearStr}; "CE" identifies the Classic Electric bolt-on model; production sequence: ${sequence}. Serial is typically stamped on the neck plate (older models) or back of headstock (newer models). Exact model variant (CE 22, CE 24) must be confirmed from the guitar's physical specifications or MODCAT code.`,
  };

  return {
    success: true,
    info,
    patternKey: 'prs-ce-year-digit-prefix',
    patternLabel: 'PRS CE bolt-on year-digit prefix',
    additionalContext: {
      title: 'PRS CE bolt-on year-digit serial',
      summary: 'This serial matches the PRS CE (Classic Electric) bolt-on format where a single year-code digit precedes the CE model identifier and production sequence.',
      highlights: [
        `The leading digit ${yearDigit} is a PRS year code indicating ${yearStr}.`,
        '"CE" identifies the Classic Electric bolt-on neck model.',
        `The remaining digits are the production sequence: ${sequence}.`,
      ],
      caveats: [
        'The year digit repeats across decades (e.g., 7 can mean 1987, 1997, or 2007), so the exact year requires cross-referencing with model features and documentation.',
        'The serial does not specify the CE variant (CE 22 vs. CE 24).',
        'PRS recommends using the MODCAT code (found in the bridge pickup cavity or on the original hang tag) to confirm exact model specs.',
      ],
      verificationTips: [
        'Check the neck plate (older models) or back of headstock (newer models) for the stamped serial.',
        'The MODCAT code in the bridge pickup cavity is the definitive way to identify the exact model, woods, and pickups.',
        'Contact PRS support with photos if exact year and model confirmation matters.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the PRS CE (Classic Electric) bolt-on format where a single year-code digit precedes the CE model identifier and production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The leading digit ${yearDigit} is a PRS year code indicating ${yearStr}. "CE" identifies the Classic Electric bolt-on neck model. The remaining digits are the production sequence: ${sequence}.</p><h3>What To Verify</h3><ul><li>The year digit can represent multiple decades — confirm the exact year from model features, documentation, or PRS support.</li><li>The serial does not specify the CE variant (CE 22 vs. CE 24).</li><li>The MODCAT code in the bridge pickup cavity is the definitive source for exact model specs.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a CE bolt-on production decode, then verify the exact year and model variant from the MODCAT code, case paperwork, or PRS support.</p>`,
  };
}

function getYearsFromDigit(digit: number): number[] {
  // PRS year prefixes cycle: digit can represent multiple decades
  const years: number[] = [];

  if (digit === 5) {
    years.push(1985, 1995, 2005);
  } else if (digit === 6) {
    years.push(1986, 1996, 2006);
  } else if (digit === 7) {
    years.push(1987, 1997, 2007);
  } else if (digit === 8) {
    years.push(1988, 1998);
  } else if (digit === 9) {
    years.push(1989, 1999);
  } else if (digit === 0) {
    years.push(1990, 2000);
  } else if (digit === 1) {
    years.push(1991, 2001);
  } else if (digit === 2) {
    years.push(1992, 2002);
  } else if (digit === 3) {
    years.push(1993, 2003);
  } else if (digit === 4) {
    years.push(1994, 2004);
  }

  return years;
}
