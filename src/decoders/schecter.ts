import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeSchecter(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // USA Custom Shop: A/B/C/G + 4-5 digits
  if (/^[ABCG]\d{4,5}$/.test(normalized)) {
    return decodeUSACustomShop(normalized);
  }

  // USA early-to-mid 1990s numeric: YY + sequence
  if (/^9\d{4}$/.test(normalized)) {
    return decodeUSA5DigitNumeric(normalized);
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

  // Korea/Indonesia W prefix: W + 8-9 digits (World/Wildwood)
  // 8 digits = Korea, 9 digits = Indonesia
  if (/^W\d{8,9}$/.test(normalized)) {
    return decodeW(normalized);
  }

  // Korea C prefix: C + 7-8 digits (Cort Korea)
  if (/^C\d{7,8}$/.test(normalized)) {
    return decodeKoreaC(normalized);
  }

  // China/newer import CA prefix: CA + YYMM + sequence
  if (/^CA\d{8}$/.test(normalized)) {
    return decodeChinaCA(normalized);
  }

  // Indonesia newer import RN prefix: RN + YYMM + sequence
  if (/^RN\d{8}$/.test(normalized)) {
    return decodeIndonesiaRN(normalized);
  }

  // Indonesia RO prefix: RO + YY + sequence
  if (/^RO\d{8}$/.test(normalized)) {
    return decodeIndonesiaRO(normalized);
  }

  // China/import ST prefix: ST + YYMM + sequence
  if (/^ST\d{8}$/.test(normalized)) {
    return decodeChinaST(normalized);
  }

  // Korea/import H prefix: H + YYMM + sequence
  if (/^H\d{7,9}$/.test(normalized)) {
    return decodeKoreaH(normalized);
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
    error: 'Unable to decode this Schecter serial number. The format was not recognized. Please check the serial number and try again.'
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

function decodeUSA5DigitNumeric(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const sequence = serial.substring(2);
  const year = 1900 + parseInt(yearDigits, 10);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: String(year),
    factory: 'Schecter USA Custom Shop',
    country: 'USA',
    model: 'USA Custom Shop / early 1990s USA production',
    notes: `Five-digit USA numeric format. First two digits indicate ${year}; remaining digits indicate production sequence ${sequenceNumber}. This is associated with early-to-mid 1990s USA Schecter production, not later Diamond Series import formats.`
  };

  return {
    success: true,
    info,
    patternKey: 'schecter-usa-5-digit-yy-sequence',
    patternLabel: 'Schecter USA 5-digit YY sequence',
    additionalContext: {
      title: 'Schecter USA 5-digit serial',
      summary: 'This serial matches a Schecter five-digit numeric format commonly associated with early-to-mid 1990s USA production.',
      highlights: [
        `The first two digits ${yearDigits} decode as production year ${year}.`,
        `The remaining digits decode as production sequence ${sequenceNumber}.`,
        'Pure five-digit 1990s serials are associated with USA production rather than later Diamond Series import serial formats.',
      ],
      caveats: [
        'Schecter serial documentation from this era is not as standardized as later import production.',
        'Exact factory-location confirmation may require photos or confirmation from Schecter.',
        'Use physical markings and construction details to distinguish USA Custom Shop/pro-era instruments from later imports.',
      ],
      verificationTips: [
        'Check for USA markings, neck-plate/headstock details, and period-correct hardware.',
        'Contact Schecter support with clear photos of the serial, front, back, and any neck-pocket or cavity markings for exact provenance.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Schecter five-digit numeric format commonly associated with early-to-mid 1990s USA production.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}. Pure five-digit 1990s serials are associated with USA production rather than later Diamond Series import serial formats.</p><h3>What To Verify</h3><ul><li>Schecter serial documentation from this era is not as standardized as later import production.</li><li>Exact factory-location confirmation may require photos or confirmation from Schecter.</li><li>Use physical markings and construction details to distinguish USA Custom Shop/pro-era instruments from later imports.</li></ul><h3>Coal Creek Guitars Note</h3><p>Treat this as an early 1990s USA Schecter decode, then verify the instrument against its markings, hardware, and Schecter support if exact provenance matters.</p>`,
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

function decodeW(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const digitCount = digits.length;

  // 8 digits = Korea, 9 digits = Indonesia
  const country = digitCount === 8 ? 'South Korea' : 'Indonesia';
  const factory = digitCount === 8
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

function decodeKoreaH(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, sequence } = parseStandardDigits(digits);

  if (!month) {
    return {
      success: false,
      error: 'Unable to decode this Schecter H serial number. The month field appears invalid.',
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
  } else if (yearNum >= 0 && yearNum <= 50) {
    year = (2000 + yearNum).toString();
  } else {
    year = 'Unknown';
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

  const info: GuitarInfo = {
    brand: 'Schecter',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Korea Factory',
    country: 'South Korea',
    notes: `Numeric-only serial indicates Korean manufacture (typically early 2000s or late 1990s). Sequence: ${sequence}.`
  };
  return { success: true, info };
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
