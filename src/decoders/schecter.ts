import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeSchecter(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // USA Custom Shop: A/B/C/G + 4-5 digits
  if (/^[ABCG]\d{4,5}$/.test(normalized)) {
    return decodeUSACustomShop(normalized);
  }

  // Import A-prefix factory + YY + 5-digit sequence (e.g., A0818910)
  // A with 7-8 digits is a Diamond Series import format, not USA Custom Shop (which uses 4-5 digits)
  if (/^A\d{7,8}$/.test(normalized)) {
    return decodeImportSingleLetterYYSequence(normalized);
  }

  // Vintage Van Nuys / early Dallas-era Schecter: S + short numeric sequence
  if (/^S\d{3,6}$/.test(normalized)) {
    return decodeVintageVanNuysS(normalized);
  }

  // USA California/Sunset Blvd-era 5-digit chronological sequence
  if (/^\d{5}$/.test(normalized)) {
    return decodeUSA5DigitNumeric(normalized);
  }

  // Indonesia WI prefix: WI + 8-9 digits (World Musical Instruments, reversed prefix variant)
  // e.g. WI15070398 = 2015, July, seq 0398
  if (/^WI\d{8,9}$/.test(normalized)) {
    return decodeIndonesiaWI(normalized);
  }

  // Indonesia IW prefix: IW + 8-9 digits (World Musical Instruments)
  if (/^IW\d{8,9}$/.test(normalized)) {
    return decodeIndonesiaIW(normalized);
  }

  // Indonesia IM prefix: IM + YYMM + sequence (Inwoo / PT Inwoo)
  if (/^IM\d{8}$/.test(normalized)) {
    return decodeIndonesiaIM(normalized);
  }

  // Indonesia IC/ICS prefix: IC/ICS + 8-9 digits (Cor-Tek/Cort)
  if (/^IC[S]?\d{7,9}$/.test(normalized)) {
    return decodeIndonesiaIC(normalized);
  }

  // Indonesia N prefix: N + 8-9 digits
  if (/^N\d{8,9}$/.test(normalized)) {
    return decodeIndonesiaN(normalized);
  }

  // Korea WA prefix: WA + YYMM + 4-digit sequence (World Audio / Korean factory)
  if (/^WA\d{8}$/.test(normalized)) {
    return decodeKoreaWA(normalized);
  }

  // Korea/Indonesia W prefix: W + 7-9 digits (World/Wildwood)
  // 7-8 digits = Korea, 9 digits = Indonesia
  if (/^W\d{7,9}$/.test(normalized)) {
    return decodeW(normalized);
  }

  // China CC-prefix factory: CC + YY + MM + sequence (9 digits = 11 chars total)
  // e.g. CC230803781 = 2023, August, seq 03781
  if (/^CC\d{9}$/.test(normalized)) {
    return decodeChinaCCFactory(normalized);
  }

  // Korea C prefix: C + 7-8 digits (Cort Korea)
  if (/^C\d{7,8}$/.test(normalized)) {
    return decodeKoreaC(normalized);
  }

  // China/newer import CA prefix: CA + YYMM + sequence
  if (/^CA\d{8}$/.test(normalized)) {
    return decodeChinaCA(normalized);
  }

  // China/Indonesia CS prefix: CS + YYMM + sequence
  if (/^CS\d{8}$/.test(normalized)) {
    return decodeChinaCS(normalized);
  }

  // Indonesia newer import RN prefix: RN + YYMM + sequence
  if (/^RN\d{8}$/.test(normalized)) {
    return decodeIndonesiaRN(normalized);
  }

  // Indonesia RO prefix: RO + YY + sequence
  // Also matches R0 (digit zero) in position 2 — a common OCR/typo variant of letter O
  if (/^R[O0]\d{8}$/.test(normalized)) {
    return decodeIndonesiaRO(normalized);
  }

  // China/import ST prefix: ST + YYMM + sequence
  if (/^ST\d{8}$/.test(normalized)) {
    return decodeChinaST(normalized);
  }

  // Import P prefix: P + YYMM + sequence
  if (/^P\d{8}$/.test(normalized)) {
    return decodeImportPFactory(normalized);
  }

  // Korea/import H prefix: H + YYMM + sequence
  if (/^H\d{7,9}$/.test(normalized)) {
    return decodeKoreaH(normalized);
  }

  // Korea import R prefix: R + YY + sequence
  if (/^R\d{7}$/.test(normalized)) {
    return decodeKoreaRYearSequence(normalized);
  }

  // China S/SK prefix: S/SK + 7-9 digits (Sejung)
  if (/^S[K]?\d{7,9}$/.test(normalized)) {
    return decodeChinaS(normalized);
  }

  // China L prefix: L + 7-9 digits
  if (/^L\d{7,9}$/.test(normalized)) {
    return decodeChinaL(normalized);
  }

  // Japan SA/S prefix (ESP-related): SA + digits
  if (/^SA\d{6,8}$/.test(normalized)) {
    return decodeJapanSA(normalized);
  }

  // Korea Y-prefix factory (Yeou-Tone or contracted facility): Y + YYMM + sequence
  // e.g. Y080501933 = 2008, May, sequence 01933; Y0808141 = 2008, August, seq 141
  if (/^Y\d{7,9}$/.test(normalized)) {
    return decodeKoreaYFactory(normalized);
  }

  // Korea Unsung: U + YYMM + sequence (e.g. U080901104 = Unsung 2008, September)
  if (/^U\d{9}$/.test(normalized)) {
    return decodeKoreaUnsungU(normalized);
  }

  // Pure numeric modern import: YY + long internal production/factory code
  if (/^\d{10,12}$/.test(normalized)) {
    return decodeNumericLongImport(normalized);
  }

  // Pure numeric: Early 2000s or late 1990s Korean
  // Format: YYMM + sequence
  if (/^\d{7,9}$/.test(normalized)) {
    return decodeNumeric(normalized);
  }

  // Pure numeric legacy 6-digit: early/mid-2000s Korean import
  // Commonly treated as Y + sequence rather than a full YYMM code
  if (/^\d{6}$/.test(normalized)) {
    return decodeNumericLegacy6(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Schecter serial number. The format was not recognized. Known formats include: USA Custom Shop (A/B/C/G + 4-5 digits), Korea Unsung (U + 9 digits), Korea WA/H/R/C prefix, Indonesia IM/RN/RO/IW/N prefix, China CA/CS/ST prefix, Japan SA prefix, numeric 6-9 digits (Korean/Indonesian). Please check the serial number and try again.'
  };
}

function decodeUSACustomShop(serial: string): DecodeResult {
  const prefix = serial[0];
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: 'USA Custom Shop Era',
    factory: 'Schecter USA Custom Shop',
    country: 'USA',
    model: 'USA Custom Shop',
    notes: `USA-made custom shop guitar. Prefix "${prefix}". Sequence: ${sequence}. Contact Schecter directly for exact production date.`
  };
  return { success: true, info };
}

function decodeVintageVanNuysS(serial: string): DecodeResult {
  const sequence = serial.substring(1);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: 'Early 1980s vintage era (estimated)',
    factory: 'Schecter Van Nuys / early Dallas-era USA assembly',
    country: 'USA',
    model: 'Vintage Schecter Dream Machine / parts-era instrument',
    notes: `Short S-prefix Schecter serial ${serial} is atypical for modern Diamond Series imports but is associated with vintage Van Nuys and early Dallas-era USA-assembled Schecter instruments. Treat S${sequence} as a chronological sequence (${sequenceNumber}) rather than a strict date code. Verify the serial location, neck plate or fretboard stamp, hardware, pickups, logo style, and any neck-pocket or cavity markings. Contact Schecter Guitar Research for exact confirmation.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-vintage-van-nuys-s-sequence',
    patternLabel: 'Schecter vintage Van Nuys S-prefix sequence',
    additionalContext: {
      title: 'Schecter vintage S-prefix serial',
      summary: 'This serial matches a short S-prefix format associated with vintage Van Nuys and early Dallas-era Schecter instruments.',
      highlights: [
        `The S prefix plus short numeric sequence ${sequenceNumber} is not a standard modern Diamond Series import format.`,
        'This format is most consistent with early 1980s Schecter Dream Machine / parts-era instruments.',
        'The sequence should be treated as a production sequence rather than a precise year/month date code.',
      ],
      caveats: [
        'Modern Schecter imports normally use longer factory/date serial formats.',
        'Short or generic-looking serials can also appear on incorrect or counterfeit instruments.',
        'Exact date and legitimacy require physical inspection and, ideally, Schecter factory confirmation.',
      ],
      verificationTips: [
        'Check whether the serial is stamped on a neck plate, fretboard, or another period-correct location.',
        'Compare the headstock logo, inlays, pickups, hardware, and construction to known early Schecter examples.',
        'Contact Schecter support with clear photos of the full instrument, serial, headstock, neck pocket, and electronics cavity.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a short S-prefix format associated with vintage Van Nuys and early Dallas-era Schecter instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The S prefix plus short numeric sequence ${sequenceNumber} is not a standard modern Diamond Series import format. It is most consistent with early 1980s Schecter Dream Machine / parts-era instruments. Treat the digits as a production sequence rather than a precise year/month date code.</p><h3>What To Verify</h3><ul><li>Modern Schecter imports normally use longer factory/date serial formats.</li><li>Short or generic-looking serials can also appear on incorrect or counterfeit instruments.</li><li>Verify the serial location, headstock logo, inlays, pickups, hardware, and any neck-pocket or cavity markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a vintage Schecter S-prefix match, then confirm the instrument against physical markings and Schecter Guitar Research if exact provenance matters.</p>`,
  };
}

function decodeUSA5DigitNumeric(serial: string): DecodeResult {
  const sequenceNumber = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: 'Late 1980s-mid 1990s (estimated)',
    factory: 'Schecter California / USA production',
    country: 'USA',
    model: 'USA California-era / early custom shop production',
    notes: `Five-digit USA Schecter numeric sequence associated with the Sunset Blvd / Pro Gauges / early California production era. The number ${serial} is best treated as a chronological production sequence, not as a strict YY date code. These serials generally require factory confirmation for exact year and specifications; contact Schecter with photos of the serial and full instrument for the most authoritative confirmation.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-usa-5-digit-yy-sequence',
    patternLabel: 'Schecter USA 5-digit chronological sequence',
    additionalContext: {
      title: 'Schecter USA 5-digit serial',
      summary: 'This serial matches a Schecter five-digit numeric format commonly associated with late-1980s to mid-1990s California/USA production.',
      highlights: [
        `The five digits are treated as chronological production sequence ${sequenceNumber}.`,
        'This format is associated with early USA/California Schecter production rather than later Diamond Series import serial formats.',
        'The first two digits should not be treated as a strict production year.',
      ],
      caveats: [
        'Schecter serial documentation from this era is not standardized like later import production.',
        'Exact year confirmation usually requires Schecter factory support.',
        'Use physical markings and construction details to distinguish USA Custom Shop/pro-era instruments from later imports.',
      ],
      verificationTips: [
        'Check whether the serial is stamped on a metal neck plate or on the wood.',
        'Check for California USA, Los Angeles, or period-correct Schecter Guitar Research logo details.',
        'Contact Schecter support with clear photos of the serial, front, back, and any neck-pocket or cavity markings for exact provenance.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter five-digit numeric format commonly associated with late-1980s to mid-1990s California/USA production.</p><h3>How This Pattern Is Typically Read</h3><p>The five digits are treated as chronological production sequence ${sequenceNumber}. This format is associated with early USA/California Schecter production rather than later Diamond Series import serial formats. The first two digits should not be treated as a strict production year.</p><h3>What To Verify</h3><ul><li>Schecter serial documentation from this era is not standardized like later import production.</li><li>Exact year confirmation usually requires Schecter factory support.</li><li>Use physical markings and construction details to distinguish USA Custom Shop/pro-era instruments from later imports.</li></ul><h3>Coal Creek Guitars Note</h3><p>Treat this as an early USA Schecter sequence decode, then verify the instrument against its markings, hardware, and Schecter support if exact provenance matters.</p>`,
  };
}

function decodeImportSingleLetterYYSequence(serial: string): DecodeResult {
  const factoryLetter = serial[0];
  const yearDigits = serial.substring(1, 3);
  const sequence = serial.substring(3);
  const yearNum = parseInt(yearDigits, 10);
  const year = (yearNum >= 90 ? 1900 + yearNum : 2000 + yearNum).toString();
  const sequenceNumber = parseInt(sequence, 10);

  const knownFactories: Record<string, { factory: string; country: string }> = {
    A: { factory: 'Arai / Associated Asian import factory', country: 'China' },
  };

  const known = knownFactories[factoryLetter];
  const factory = known ? known.factory : `Asian import factory (${factoryLetter} prefix)`;
  const country = known ? known.country : 'Asia';

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    factory,
    country,
    model: 'Diamond Series import',
    notes: `${factoryLetter}-prefix Schecter import format interpreted as factory letter + YY + production sequence. ${factoryLetter} indicates ${factory}; ${yearDigits} indicates ${year}; ${sequence} is the production sequence (${sequenceNumber}). This identifies production year and factory family, not the exact model name.`,
  };

  return {
    success: true,
    info,
    patternKey: `schecter-import-${factoryLetter.toLowerCase()}-yy-sequence`,
    patternLabel: `Schecter import ${factoryLetter}-prefix YY sequence`,
    additionalContext: {
      title: `Schecter ${factoryLetter}-prefix import serial`,
      summary: `This serial matches a Schecter single-letter import factory format parsed as factory prefix, 2-digit year, and production sequence.`,
      highlights: [
        `${factoryLetter} indicates ${factory}.`,
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production year and factory family, not the exact model name.',
        'Diamond Series models from this era commonly include the Omen, Damien, C-1, and related lines.',
        'Factory-code usage can vary by production run; confirm with country-of-origin markings when provenance matters.',
      ],
      verificationTips: [
        'Check the back of the headstock for Made in China, Korea, or Indonesia markings.',
        'Compare the model name on the headstock or truss rod cover against Schecter Diamond Series catalogs for the decoded year.',
        'Contact Schecter support with clear photos if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter single-letter import factory format parsed as factory prefix, 2-digit year, and production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>${factoryLetter} indicates ${factory}. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production year and factory family, not the exact model name.</li><li>Diamond Series models from this era commonly include the Omen, Damien, C-1, and related lines.</li><li>Check the back of the headstock for country-of-origin markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical import production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeIndonesiaIW(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'World Musical Instruments (WMI)',
    country: 'Indonesia',
    model: 'Diamond Series or similar',
    notes: `IW prefix = Indonesia, World Musical Instruments. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeIndonesiaWI(serial: string): DecodeResult {
  // WI prefix = Indonesia, World Musical Instruments (reversed prefix variant of IW)
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    ...(month ? { month } : {}),
    factory: 'World Musical Instruments (WMI)',
    country: 'Indonesia',
    model: 'Diamond Series or similar',
    notes: `WI prefix = Indonesia, World Musical Instruments (reversed-letter variant of IW prefix). Year: ${year}${month ? `, Month: ${month}` : ''}. Sequence: ${sequenceNumber}.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-wi-indonesia-yymm-sequence',
    patternLabel: 'Schecter WI Indonesia YYMM sequence',
    additionalContext: {
      title: 'Schecter WI serial',
      summary: 'This serial matches a Schecter WI-prefix Indonesian import format — WI is the reversed-letter variant of the IW factory prefix, both referring to World Musical Instruments Indonesia.',
      highlights: [
        'WI identifies World Musical Instruments (WMI) Indonesia — the reversed-letter variant of the IW prefix.',
        `Year: ${year}${month ? `. Month: ${month}` : ''}.`,
        `Production sequence: ${sequenceNumber}.`,
      ],
      caveats: [
        'WI and IW both refer to the same World Musical Instruments Indonesia factory.',
        'This format identifies production date and factory; the exact model must be confirmed from headstock markings.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for model name and country marking.',
        'Contact Schecter support with the serial for official confirmation.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter WI-prefix Indonesian import format. WI is the reversed-letter variant of the IW prefix, both referring to World Musical Instruments Indonesia.</p><h3>How This Pattern Is Typically Read</h3><p>WI indicates World Musical Instruments Indonesia. Year: ${year}${month ? `. Month: ${month}` : ''}. Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check headstock markings and the label for model name and country.</li><li>WI and IW both refer to the same factory — either prefix decodes the same way.</li></ul>`,
  };
}

function decodeIndonesiaIM(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    return {
      success: false,
      error: 'Unable to decode this Schecter IM serial number. The month field appears invalid.',
    };
  }

  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'Inwoo / PT Inwoo Indonesia',
    country: 'Indonesia',
    model: 'Diamond Series import',
    notes: `IM prefix indicates Indonesian Schecter import production, commonly associated with Inwoo / PT Inwoo. Parsed as IM + YYMM + sequence. Sequence: ${sequence}. This format identifies production date and factory family, not the exact model name; verify the exact model from the headstock, truss rod cover, or label.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-im-indonesia-yymm-sequence',
    patternLabel: 'Schecter IM Indonesia YYMM sequence',
    additionalContext: {
      title: 'Schecter IM serial',
      summary: 'This serial matches a Schecter IM-prefix Indonesian import format parsed as factory prefix plus YYMM production date and sequence.',
      highlights: [
        'IM indicates Indonesian Schecter import production, commonly associated with Inwoo / PT Inwoo.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        `The digits ${digits.substring(2, 4)} decode as ${month}.`,
        `The final four digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'IM-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for the model name and country marking.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter IM-prefix Indonesian import format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>IM indicates Indonesian Schecter import production, commonly associated with Inwoo / PT Inwoo. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month}. The final four digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>IM-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical Indonesian Schecter production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeIndonesiaIC(serial: string): DecodeResult {
  let prefix: string;
  let digits: string;

  if (serial.startsWith('ICS')) {
    prefix = 'ICS';
    digits = serial.substring(3);
  } else {
    prefix = 'IC';
    digits = serial.substring(2);
  }

  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Cor-Tek (Cort)',
    country: 'Indonesia',
    model: prefix === 'ICS' ? 'Special/FSR Run' : 'Standard Production',
    notes: `${prefix} prefix = Indonesia, Cor-Tek factory. ${prefix === 'ICS' ? 'ICS indicates special or FSR (Factory Special Run).' : ''} Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeIndonesiaN(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Indonesia Factory (possibly P.T. Wildwood)',
    country: 'Indonesia',
    model: 'Bolt-On Model',
    notes: `N prefix = Indonesia, exact factory unknown. Commonly seen on bolt-on models. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeKoreaWA(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  // When the month field is out of range (e.g. "31"), treat the entire digit string after
  // the year as a sequence number (WA + YY + seq) rather than failing. Some WA serials
  // use a 6-digit production sequence without a separate month field.
  const hasValidMonth = !!month;
  const effectiveSequence = hasValidMonth ? sequence : digits.substring(2);
  const sequenceNumber = parseInt(effectiveSequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    ...(hasValidMonth ? { month } : {}),
    factory: 'World Audio / Korean import factory',
    country: 'South Korea',
    model: 'Diamond Series import',
    notes: hasValidMonth
      ? `WA prefix indicates a Schecter import production run associated with World Audio or a related Korean factory partner. Parsed as WA + YYMM + sequence. Sequence: ${effectiveSequence}. This format identifies production date and factory family, not the exact model name; verify the exact model from the headstock, truss rod cover, or label.`
      : `WA prefix indicates a Schecter import production run associated with World Audio or a related Korean factory partner. Parsed as WA + YY + sequence (no month field). Year: ${year}, sequence: ${effectiveSequence}. This format identifies production date and factory family, not the exact model name; verify the exact model from the headstock, truss rod cover, or label.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-wa-korea-yymm-sequence',
    patternLabel: 'Schecter WA Korea YYMM sequence',
    additionalContext: {
      title: 'Schecter WA serial',
      summary: 'This serial matches a Schecter WA-prefix Korean import format parsed as factory prefix plus production date and sequence.',
      highlights: [
        'WA indicates a Schecter import production run associated with World Audio or a related Korean factory partner.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        ...(hasValidMonth
          ? [`The digits ${digits.substring(2, 4)} decode as ${month}.`]
          : [`The digits after the year (${digits.substring(2)}) are the production sequence — no separate month field in this variant.`]
        ),
        `Production sequence: ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'WA-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the back of the headstock for the country-of-origin marking.',
        'Check the headstock, truss rod cover, or label for the model name.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter WA-prefix Korean import format parsed as factory prefix plus production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>WA indicates a Schecter import production run associated with World Audio or a related Korean factory partner. The digits ${digits.substring(0, 2)} decode as production year ${year}. ${hasValidMonth ? `The digits ${digits.substring(2, 4)} decode as ${month}. The final digits decode as production sequence ${sequenceNumber}.` : `The digits after the year (${digits.substring(2)}) are the production sequence — this variant does not encode a month. Production sequence: ${sequenceNumber}.`}</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>WA-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical Korean Schecter production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeW(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const digitCount = digits.length;

  // 7-8 digits = Korea, 9 digits = Indonesia
  const country = digitCount <= 8 ? 'South Korea' : 'Indonesia';
  const factory = digitCount <= 8
    ? 'World/Wildwood Korea'
    : 'World Musical Instruments (WMI)';

  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: factory,
    country: country,
    model: 'Diamond Series',
    notes: `W prefix. ${digitCount} digits indicates ${country} manufacture. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeKoreaC(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Cor-Tek (Cort) Korea',
    country: 'South Korea',
    notes: `C prefix = Cort Korea. Older Korean production. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeChinaCA(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    return {
      success: false,
      error: 'Unable to decode this Schecter CA serial number. The month field appears invalid.',
    };
  }

  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'China import factory / newer production partner',
    country: 'China',
    model: 'Diamond Series import',
    notes: `CA prefix indicates a Schecter import production run, commonly associated with newer China factory partners. Parsed as CA + YYMM + sequence. Sequence: ${sequence}. This is commonly a Diamond Series import format; verify the exact model from the headstock, truss rod cover, or label.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-ca-yymm-sequence',
    patternLabel: 'Schecter CA YYMM sequence',
    additionalContext: {
      title: 'Schecter CA serial',
      summary: 'This serial matches a Schecter CA-prefix import format parsed as factory prefix plus YYMM production date and sequence.',
      highlights: [
        'CA indicates a Schecter import production run, commonly associated with newer China factory partners.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        `The digits ${digits.substring(2, 4)} decode as ${month}.`,
        `The final four digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'Most CA-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for the model name.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter CA-prefix import format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>CA indicates a Schecter import production run, commonly associated with newer China factory partners. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month}. The final four digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>Most CA-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical import production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeChinaCS(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    return {
      success: false,
      error: 'Unable to decode this Schecter CS serial number. The month field appears invalid.',
    };
  }

  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'China or Indonesia partner factory (CS)',
    country: 'China or Indonesia',
    model: 'Diamond Series import',
    notes: `CS prefix indicates a Schecter import production run, commonly associated with China or Indonesia-based partner factories. Parsed as CS + YYMM + sequence. Sequence: ${sequence}. Verify the exact model and factory from the headstock, truss rod cover, label, or Schecter support.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-cs-yymm-sequence',
    patternLabel: 'Schecter CS YYMM sequence',
    additionalContext: {
      title: 'Schecter CS serial',
      summary: 'This serial matches a Schecter CS-prefix import format parsed as factory prefix plus YYMM production date and sequence.',
      highlights: [
        'CS indicates a Schecter import production run, associated with China or Indonesia partner factories.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        `The digits ${digits.substring(2, 4)} decode as ${month}.`,
        `The final digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'CS-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.',
        'The country and factory should be confirmed from the headstock or label.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for the model name and country marking.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter CS-prefix import format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>CS indicates a Schecter import production run, associated with China or Indonesia partner factories. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month}. The final digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>CS-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.</li><li>Confirm the country and factory from the headstock or label.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical Schecter import production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeIndonesiaRN(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    return {
      success: false,
      error: 'Unable to decode this Schecter RN serial number. The month field appears invalid.',
    };
  }

  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'PT. Roxy Music',
    country: 'Indonesia',
    model: 'Diamond Series import',
    notes: `RN prefix indicates newer Schecter Indonesian production, commonly attributed to PT. Roxy Music. Parsed as RN + YYMM + sequence. Sequence: ${sequence}. This format appears on newer Indonesian-made Schecter models; verify the exact model from the headstock, truss rod cover, or label.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-rn-yymm-sequence',
    patternLabel: 'Schecter RN YYMM sequence',
    additionalContext: {
      title: 'Schecter RN serial',
      summary: 'This serial matches a Schecter RN-prefix Indonesian import format parsed as factory prefix plus YYMM production date and sequence.',
      highlights: [
        'RN indicates newer Schecter Indonesian production, commonly attributed to PT. Roxy Music.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        `The digits ${digits.substring(2, 4)} decode as ${month}.`,
        `The final four digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'RN-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for the model name and country marking.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter RN-prefix Indonesian import format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>RN indicates newer Schecter Indonesian production, commonly attributed to PT. Roxy Music. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month}. The final four digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>RN-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical Indonesian Schecter production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeIndonesiaRO(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const yearDigits = digits.substring(0, 2);
  const sequence = digits.substring(2);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year.toString(),
    factory: 'PT Cort Indonesia',
    country: 'Indonesia',
    model: 'Diamond Series import',
    notes: `RO prefix indicates Indonesian Schecter import production commonly associated with PT Cort. Parsed as RO + YY + sequence. The digits ${yearDigits} indicate ${year}; production sequence: ${sequence}. This format identifies production year and factory family, not the exact model name.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-ro-indonesia-yy-sequence',
    patternLabel: 'Schecter RO Indonesia YY sequence',
    additionalContext: {
      title: 'Schecter RO serial',
      summary: 'This serial matches a Schecter RO-prefix Indonesian import format parsed as factory prefix plus production year and sequence.',
      highlights: [
        'RO indicates Indonesian Schecter import production commonly associated with PT Cort.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production year and factory family, not the exact model name.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for the model name and country marking.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter RO-prefix Indonesian import format parsed as factory prefix plus production year and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>RO indicates Indonesian Schecter import production commonly associated with PT Cort. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production year and factory family, not the exact model name.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li><li>Check the headstock, truss rod cover, or label for model name and country marking.</li></ul>`,
  };
}

function decodeKoreaRYearSequence(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const sequence = serial.substring(3);
  const year = 2000 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Reliance / Korean import production',
    country: 'South Korea',
    model: 'Diamond Series import',
    notes: `R-prefix Schecter import format interpreted as R + YY + sequence. The digits ${yearDigits} indicate production year ${year}; the remaining digits are production sequence ${sequenceNumber}. R is commonly associated with Reliance or related Korean import production, though factory-code usage can vary by run. Verify exact model and factory from country-of-origin markings and Schecter support when needed.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-r-korea-yy-sequence',
    patternLabel: 'Schecter R Korea YY sequence',
    additionalContext: {
      title: 'Schecter R-prefix serial',
      summary: 'This serial matches a Schecter R-prefix import format parsed as factory prefix, production year, and sequence.',
      highlights: [
        'R is treated as a Korean import factory or production-line prefix, commonly associated with Reliance.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production year and factory family, not the exact model name.',
        'Factory-code usage can vary by production run.',
        'Exact factory confirmation may require Schecter support and photos.',
      ],
      verificationTips: [
        'Check the back of the headstock for Made in Korea or other country-of-origin markings.',
        'Compare the guitar against Schecter Diamond Series catalog specs for the decoded year.',
        'Use pickups, body shape, finish, and headstock/logo details to narrow the exact model.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter R-prefix import format parsed as factory prefix, production year, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>R is treated as a Korean import factory or production-line prefix, commonly associated with Reliance. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production year and factory family, not the exact model name.</li><li>Factory-code usage can vary by production run.</li><li>Check the back of the headstock for country-of-origin markings and compare physical specs against Schecter catalog references.</li></ul>`,
  };
}

function decodeChinaST(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    return {
      success: false,
      error: 'Unable to decode this Schecter ST serial number. The month field appears invalid.',
    };
  }

  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'China import factory / ST production run',
    country: 'China',
    model: 'Diamond Series import',
    notes: `ST prefix indicates a Schecter import production run, commonly associated with China-made Diamond Series instruments. Parsed as ST + YYMM + sequence. Sequence: ${sequence}. Verify the exact model from the headstock, truss rod cover, label, or Schecter support.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-st-yymm-sequence',
    patternLabel: 'Schecter ST YYMM sequence',
    additionalContext: {
      title: 'Schecter ST serial',
      summary: 'This serial matches a Schecter ST-prefix import format parsed as factory prefix plus YYMM production date and sequence.',
      highlights: [
        'ST indicates a Schecter import production run, commonly associated with China-made Diamond Series instruments.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        `The digits ${digits.substring(2, 4)} decode as ${month}.`,
        `The final four digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'ST-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the headstock, truss rod cover, or label for the model name and country marking.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter ST-prefix import format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>ST indicates a Schecter import production run, commonly associated with China-made Diamond Series instruments. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month}. The final four digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>ST-prefix examples are import/Diamond Series instruments rather than USA Custom Shop guitars.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical Schecter import production decode, then verify the exact model from the headstock, truss rod cover, label, or Schecter support.</p>`,
  };
}

function decodeImportPFactory(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);
  const yy = parseInt(yearDigits, 10);
  const monthValue = parseInt(monthDigits, 10);
  const year = (yy >= 90 ? 1900 + yy : 2000 + yy).toString();
  const month = monthValue >= 1 && monthValue <= 12 ? getMonthName(monthValue) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    ...(month ? { month } : {}),
    factory: 'Asian import factory (P-prefix)',
    country: 'South Korea',
    model: 'Diamond Series or similar import',
    notes: `P-prefix Schecter import format interpreted as P + YYMM + sequence. Year: ${year}; month: ${month || monthDigits}; production sequence: ${sequenceNumber}. Verify model from the headstock or interior label.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-p-factory-yymm-sequence',
    patternLabel: 'Schecter P-prefix import YYMM sequence',
    additionalContext: {
      title: 'Schecter P-prefix import serial',
      summary: 'This serial matches the Schecter P-prefix import format with YYMM production date encoding.',
      highlights: [
        'P identifies a contracted Asian import production facility.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The digits ${monthDigits} decode as ${month || 'production month'}.`,
        `The final digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'The serial identifies factory timing and sequence, not the exact model name.',
      ],
      verificationTips: [
        'Check the headstock for the model name and the back for Made in Korea markings.',
        'Compare the guitar against Schecter Diamond Series specs for the decoded year.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Schecter P-prefix import format, parsed as P + YYMM + sequence.</p><h3>How This Pattern Is Typically Read</h3><p>P identifies a contracted Asian import facility. The digits ${yearDigits} decode as ${year}. The digits ${monthDigits} decode as ${month || 'the production month'}. The final digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Verify the model from the headstock or interior label.</li><li>Check for Made in Korea markings on the back of the headstock.</li></ul>`,
  };
}

function decodeKoreaH(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    // Month field is invalid (e.g. "00") — fall back to H + YY + remaining sequence.
    const yearNum = parseInt(digits.substring(0, 2), 10);
    const fallbackYear = (yearNum >= 90 ? 1900 + yearNum : 2000 + yearNum).toString();
    const fallbackSeq = digits.substring(2);
    return {
      success: true,
      info: {
        brand: 'Schecter',
        serialNumber: serial,
        year: fallbackYear,
        factory: 'Korea / Asian import factory',
        country: 'South Korea',
        model: 'Diamond Series or similar import',
        notes: `H prefix Schecter import format. The standard YYMM month field "${digits.substring(2, 4)}" is not a valid month, so this is decoded as H + YY + sequence without a month component. Year: ${fallbackYear}. Sequence: ${parseInt(fallbackSeq, 10)}. Verify from country-of-origin markings and model features.`,
      },
      patternKey: 'schecter-h-yymm-sequence',
      patternLabel: 'Schecter H YYMM sequence',
    };
  }

  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'Korea / Asian import factory',
    country: 'South Korea',
    model: 'Diamond Series or similar import',
    notes: `H prefix is a recognized Schecter import format, commonly associated with Korean or Asian factory production runs. Parsed as H + YYMM + sequence. Sequence: ${sequence}. Verify exact factory and model from country-of-origin markings or Schecter support.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-h-yymm-sequence',
    patternLabel: 'Schecter H YYMM sequence',
    additionalContext: {
      title: 'Schecter H serial',
      summary: 'This serial matches a Schecter H-prefix import format parsed as factory prefix plus YYMM production date and sequence.',
      highlights: [
        'H is a recognized Schecter import prefix, commonly associated with Korean or Asian production runs.',
        `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
        `The digits ${digits.substring(2, 4)} decode as ${month}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
      ],
      caveats: [
        'This format identifies production date and factory family, not the exact model name.',
        'Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.',
      ],
      verificationTips: [
        'Check the back of the headstock for the country-of-origin marking.',
        'Contact Schecter support with photos of the serial and full instrument if exact factory confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter H-prefix import format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>H is a recognized Schecter import prefix, commonly associated with Korean or Asian production runs. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format identifies production date and factory family, not the exact model name.</li><li>Factory-code usage can vary by production run, so confirm with physical markings when provenance matters.</li><li>Check the back of the headstock for the country-of-origin marking.</li></ul>`,
  };
}

function decodeChinaS(serial: string): DecodeResult {
  let prefix: string;
  let digits: string;

  if (serial.startsWith('SK')) {
    prefix = 'SK';
    digits = serial.substring(2);
  } else {
    prefix = 'S';
    digits = serial.substring(1);
  }

  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Sejung (China)',
    country: 'China',
    model: 'Omen/Damien Series or entry-level',
    notes: `${prefix} prefix = China, Sejung factory. Common on Omen and Damien series. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeChinaL(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'China Factory',
    country: 'China',
    notes: `L prefix = China, exact factory unknown. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeJapanSA(serial: string): DecodeResult {
  const digits = serial.substring(2);
  const { year, month, sequence } = parseStandardDigits(digits);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Japan (ESP-related factory)',
    country: 'Japan',
    model: 'Japan Production',
    notes: `SA prefix = Japan, likely ESP-related Tokyo factory. Higher-end production. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeNumeric(serial: string): DecodeResult {
  // Pure numeric format: YYMM + sequence (or YY + sequence)
  const yearDigits = serial.substring(0, 2);
  const yearNum = parseInt(yearDigits, 10);

  let year: string;
  if (yearNum >= 90 && yearNum <= 99) {
    year = (1900 + yearNum).toString();
  } else if (yearNum >= 0 && yearNum <= 30) {
    year = (2000 + yearNum).toString();
  } else {
    // Year code 31-89 maps to future or implausible years — treat as sequential without year encoding
    year = 'early 2000s (estimated; year not directly encoded)';
  }

  // Check if next two digits could be month
  let month: string | undefined;
  let sequence: string;

  if (serial.length >= 4) {
    const monthDigits = serial.substring(2, 4);
    const monthNum = parseInt(monthDigits, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      month = getMonthName(monthNum);
      sequence = serial.substring(4);
    } else {
      sequence = serial.substring(2);
    }
  } else {
    sequence = serial.substring(2);
  }

  const patternKey = serial.length === 7 ? 'schecter-7digit-numeric-korea-wmi-sequential'
    : serial.length === 8 ? 'schecter-8digit-numeric-korea-wmi-sequential'
    : 'schecter-9digit-numeric-korea-wmi-sequential';

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    month,
    factory: 'Korea factory (likely World Musical Instruments or Unsung)',
    country: 'South Korea',
    notes: `All-numeric serial indicates Korean import manufacture, typically pre-2008 era (WMI or similar factory). Sequence: ${sequence}. Verify exact year and model from headstock markings.`,
  };
  return { success: true, info, patternKey };
}

function decodeChinaCCFactory(serial: string): DecodeResult {
  const yearDigits = serial.substring(2, 4);
  const monthDigits = serial.substring(4, 6);
  const sequence = serial.substring(6);
  const year = 2000 + parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);
  const monthName = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Chinese contracted factory (CC prefix)',
    country: 'China',
    notes: `CC-prefix Schecter China factory serial. CC identifies a contracted Chinese manufacturing facility used by Schecter for Diamond Series imports. Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${monthName || 'the production month'}. Production sequence: ${sequenceNumber}. Verify with a Made in China stamp on the back of the headstock.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-cc-china-yymm-sequence',
    patternLabel: 'Schecter CC China factory YYMM sequence',
    additionalContext: {
      title: 'Schecter CC-prefix China factory serial',
      summary: 'This serial uses the Schecter CC-prefix format for Chinese-manufactured Diamond Series instruments: CC + two-digit year + two-digit month + production sequence.',
      highlights: [
        'CC identifies a contracted Chinese production facility used for Schecter Diamond Series imports.',
        `Year digits ${yearDigits} decode as ${year}.`,
        monthName ? `Month digits ${monthDigits} decode as ${monthName}.` : `Month digits ${monthDigits} are the production month code.`,
        `Production sequence: unit ${sequenceNumber}.`,
      ],
      caveats: [
        "Schecter's serial database may have records for this serial — contact tech@schecterguitars.com with the serial and photos for official confirmation.",
        'The CC prefix distinguishes this from the CY (Cor-tek China) and CA prefixes used on other Schecter China-built instruments.',
        'The serial identifies the factory and production date; the exact model must be confirmed from headstock markings and body specs.',
      ],
      verificationTips: [
        'Check the back of the headstock for a Made in China stamp.',
        'Compare the body shape, headstock logo, pickups, and hardware against Schecter Diamond Series catalog specs from the decoded year.',
        'Email tech@schecterguitars.com with the serial number and photos for official model and finish confirmation.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial uses the Schecter CC-prefix format for Chinese-manufactured Diamond Series instruments. CC identifies the contracted Chinese facility; the year, month, and production sequence follow.</p><h3>How This Pattern Is Typically Read</h3><p>Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${monthName || 'the production month'}. Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for a Made in China stamp.</li><li>Compare the model against Schecter Diamond Series China catalog specs for ${year}.</li><li>Email tech@schecterguitars.com for official confirmation.</li></ul>`,
  };
}

function decodeKoreaYFactory(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const monthDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);
  const monthName = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: 'Yeou-Tone or contracted Korean facility (Y-prefix)',
    country: 'South Korea',
    notes: `Y-prefix Schecter Korea factory serial. The Y identifies a contracted Korean production facility, commonly cited as Yeou-Tone Music. Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${monthName || 'the production month'}. Sequence: ${sequenceNumber}. Schecter used several Korean contracted factories during the 2000s; the Y prefix is distinct from the Unsung (U prefix) designation but follows the same YYMM+sequence layout.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-y-factory-yymm-sequence',
    patternLabel: 'Schecter Y-prefix Korea factory YYMM sequence',
    additionalContext: {
      title: 'Schecter Y-prefix Korea factory serial',
      summary: 'This serial uses the Schecter Y-prefix Korea factory format: a Korean contracted facility (commonly cited as Yeou-Tone), with the year, month, and sequential production number encoded after the prefix.',
      highlights: [
        'Y identifies a contracted Korean production facility, commonly cited as Yeou-Tone Music.',
        `Year digits ${yearDigits} decode as ${year}.`,
        monthName ? `Month digits ${monthDigits} decode as ${monthName}.` : `Month digits ${monthDigits} are the production month code.`,
        `Production sequence: unit ${sequenceNumber}.`,
      ],
      caveats: [
        'The Y prefix is a contracted Korean facility distinct from the Unsung (U prefix) factory that Schecter also used in this era.',
        "Schecter's serial database may not have records for all Korean contracted factory runs.",
        'The serial identifies the production period and factory; the exact model must be confirmed from headstock markings, body shape, and hardware.',
      ],
      verificationTips: [
        'Check the back of the headstock for a Made in Korea stamp.',
        'Compare the body shape, headstock logo, pickups, and hardware against Schecter Diamond Series catalog specs from the decoded year.',
        'Contact Schecter customer support with the serial for official confirmation — Korean contracted factory records may be accessible.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial uses the Schecter Y-prefix Korea factory format: Y identifies a contracted Korean production facility (commonly cited as Yeou-Tone Music), with the production year, month, and sequential production number encoded after the prefix.</p><h3>How This Pattern Is Typically Read</h3><p>Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${monthName || 'the production month'}. Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for a Made in Korea stamp.</li><li>Compare the body shape, headstock logo, pickups, and hardware against Schecter Diamond Series catalog specs for ${year}.</li><li>Contact Schecter support for official confirmation from Korean contracted factory records.</li></ul>`,
  };
}

function decodeKoreaUnsungU(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const monthDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = monthNum >= 1 && monthNum <= 12 ? months[monthNum - 1] : undefined;

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year.toString(),
    ...(month ? { month } : {}),
    factory: 'Unsung, Incheon, South Korea',
    country: 'South Korea',
    notes: `U prefix identifies the Unsung factory in Incheon, South Korea. Format: U + YYMM + sequence. The digits ${yearDigits} decode as production year ${year}${month ? `, ${monthDigits} as ${month}` : ''}. Production sequence: ${sequence}. Schecter Diamond Series and other import models were produced at this facility during the 2000s.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-u-unsung-korea-yymm-sequence',
    patternLabel: 'Schecter Unsung Korea U-prefix YYMM sequence',
  };
}

function decodeNumericLongImport(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const yearNum = parseInt(yearDigits, 10);
  const year = yearNum >= 90 ? 1900 + yearNum : 2000 + yearNum;
  const internalCode = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year.toString(),
    factory: 'Import production line',
    country: 'China or other Asian import factory',
    model: 'Diamond Series or similar import',
    notes: `Long numeric Schecter import serial. The first two digits (${yearDigits}) are treated as production year ${year}; the remaining digits (${internalCode}) are internal factory, batch, or sequence coding. Schecter often uses letter prefixes for specific factories, so confirm country and model from the back-of-headstock marking, truss rod cover, label, or physical features.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-long-numeric-import-yy-sequence',
    patternLabel: 'Schecter long numeric import YY sequence',
    additionalContext: {
      title: 'Schecter long numeric import serial',
      summary: 'This serial matches a long numeric Schecter import format where the first two digits identify the production year.',
      highlights: [
        `The first two digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits are treated as internal production code ${internalCode}.`,
        'A pure numeric format commonly points to import production rather than USA Custom Shop formats.',
      ],
      caveats: [
        'Schecter factory attribution is stronger when a letter prefix is present.',
        'The serial identifies likely year, not exact model name.',
        'Country should be confirmed from Made in markings or physical labels.',
      ],
      verificationTips: [
        'Check the back of the headstock for Made in China, Indonesia, or Korea markings.',
        'Use the truss rod cover, pickups, and body shape to identify the exact model series.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a long numeric Schecter import format where the first two digits identify the production year.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits are treated as internal production code ${internalCode}. A pure numeric format commonly points to import production rather than USA Custom Shop formats.</p><h3>What To Verify</h3><ul><li>Schecter factory attribution is stronger when a letter prefix is present.</li><li>The serial identifies likely year, not exact model name.</li><li>Country should be confirmed from Made in markings or physical labels.</li></ul>`,
  };
}

function decodeNumericLegacy6(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const year = (2000 + yearDigit).toString();
  const sequence = serial.substring(1);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year,
    factory: 'Korea Factory',
    country: 'South Korea',
    model: 'Diamond Series or similar import',
    notes: `This 6-digit numeric Schecter serial fits a legacy Korean import format seen on some early-to-mid 2000s instruments. The leading digit is treated as the production year within the 2000s, so ${serial[0]} maps to ${year}. The remaining digits are best treated as sequence ${sequence} rather than a reliable month/week code. Verify the exact model and factory details from the headstock, hardware, and any country-of-origin markings when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-korea-legacy-6-digit',
    patternLabel: 'Schecter Korea legacy 6-digit',
    additionalContext: {
      title: 'Schecter legacy 6-digit serial',
      summary: 'This serial matches a legacy 6-digit numeric Schecter import pattern commonly associated with Korean Diamond Series era production.',
      highlights: [
        `The leading digit ${serial[0]} is treated as production year ${year} within the 2000s.`,
        `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
        'This is best used as an era/date estimate rather than an exact calendar-date decode.',
      ],
      caveats: [
        'Schecter legacy import serial formats were not always fully standardized across factories and runs.',
        'This pattern supports a practical year estimate, but not exact month/week dating.',
        'Model identity and exact factory should be confirmed from physical markings and specs.',
      ],
      verificationTips: [
        'Check the back of the headstock for Made in Korea wording or factory-related markings.',
        'Compare the instrument to Diamond Series catalogs/specs from the estimated production era.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a legacy 6-digit numeric Schecter import pattern commonly associated with Korean Diamond Series era production.</p><h3>How This Pattern Is Typically Read</h3><p>The leading digit ${serial[0]} is treated as production year ${year} within the 2000s. The remaining digits decode as production sequence ${parseInt(sequence, 10)}. This is best used as an era/date estimate rather than an exact calendar-date decode.</p><h3>What To Verify</h3><ul><li>Schecter legacy import serial formats were not always fully standardized across factories and runs.</li><li>This pattern supports a practical year estimate, but not exact month or week dating.</li><li>Model identity and exact factory should be confirmed from physical markings and specs.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical early-to-mid 2000s Korean Schecter decode, then confirm the exact model and provenance from the instrument itself.</p>`,
  };
}

function parseStandardDigits(digits: string): { year: string; month: string; sequence: string } {
  // Standard format: YYMM + sequence
  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const sequence = digits.substring(4);

  const yearNum = parseInt(yearDigits, 10);
  const monthNum = parseInt(monthDigits, 10);

  // Determine century
  let year: string;
  if (yearNum >= 90 && yearNum <= 99) {
    year = (1900 + yearNum).toString();
  } else if (yearNum >= 0 && yearNum <= 50) {
    year = (2000 + yearNum).toString();
  } else {
    year = `20${yearDigits}`;
  }

  // Get month name if valid
  const month = (monthNum >= 1 && monthNum <= 12) ? getMonthName(monthNum) : '';

  return { year, month, sequence };
}

function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}
