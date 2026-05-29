import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeESP(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // ESP USA format: US + 5 digits
  if (/^US\d{5}$/.test(normalized)) {
    return decodeESPUSA(normalized);
  }

  // 2016+ ESP format: E + 7 digits (E = ESP brand)
  if (/^E\d{7}$/.test(normalized)) {
    return decodeESP2016Plus(normalized);
  }

  // 2016+ E-II format: ES + 7 digits
  if (/^ES\d{7}$/.test(normalized)) {
    return decodeEII2016Plus(normalized);
  }

  // Ambiguous ESP-owned E-prefix 6-digit format: early E-II Japan or early LTD Korea
  if (/^E\d{6}$/.test(normalized)) {
    return decodeAmbiguousEPrefix6Digit(normalized);
  }

  // Edwards by ESP format: ED + YY + 5-digit production sequence
  if (/^ED\d{7}$/.test(normalized)) {
    return decodeEdwardsEDPrefix(normalized);
  }

  // 2000-2015 Japan ESP Custom Shop format: SS + 7 digits
  if (/^SS\d{7}$/.test(normalized)) {
    return decodeESPCustomShop(normalized);
  }

  // 2000-2015 Japan factory formats: K/N/S/T/CH/CS/TH + 7-8 digits
  if (/^(K|N|S|T|CH|CS|TH)\d{7,8}$/.test(normalized)) {
    return decodeESPJapanFactory(normalized);
  }

  // Kirk Hammett Signature: K- + 4-5 digits or K + 4-5 digits
  if (/^K-?\d{4,5}$/.test(normalized)) {
    return decodeKirkHammett(normalized);
  }

  // LTD Asian formats with letter prefixes
  // Korea: R + YY + week + 3-digit sequence (Peerless)
  if (/^R\d{7}$/.test(normalized)) {
    const week = parseInt(normalized.substring(3, 5), 10);
    if (week >= 1 && week <= 53) {
      return decodeLTDKoreaPeerlessR(normalized);
    }
  }

  // Indonesia: IW, W, IC, C, IS, S + 7-8 digits
  if (/^(IW|IC|IS|IR)\d{7,8}$/.test(normalized)) {
    return decodeLTDIndonesia(normalized);
  }

  // Korea: W + YY + week + 5-digit sequence (World Musical Instruments)
  if (/^W\d{9}$/.test(normalized)) {
    return decodeLTDKoreaWMI9Digit(normalized);
  }

  // Early Korea: U + 6-digit sequential tracking number (Unsung-era LTD)
  if (/^U\d{6}$/.test(normalized)) {
    return decodeLTDEarlyKoreaUSequential(normalized);
  }

  // Korea: W, E, U + 7-8 digits
  if (/^(W|E|U)\d{7,8}$/.test(normalized)) {
    return decodeLTDKorea(normalized);
  }

  // China: L, RS, SH, SX, SK, SP + 7-8 digits
  if (/^(L|RS|SH|SX|SK|SP)\d{7,8}$/.test(normalized)) {
    return decodeLTDChina(normalized);
  }

  // Vietnam: I + 7-8 digits (but not IW, IC, IS, IR)
  if (/^I\d{7,8}$/.test(normalized)) {
    return decodeLTDVietnam(normalized);
  }

  // LTD transitional Korean/Indonesian format: YY + week + 3-digit sequence
  if (/^\d{7}$/.test(normalized)) {
    const week = parseInt(normalized.substring(2, 4), 10);
    if (week >= 1 && week <= 53) {
      return decodeLTDTransitionalNumeric(normalized);
    }
  }

  // Pre-2000 format: 6-8 digits (DDMMYNNN or shorter variants)
  if (/^\d{6,8}$/.test(normalized)) {
    return decodePre2000(normalized);
  }

  // Older Japanese neck-plate numeric format: 5 digits
  if (/^\d{5}$/.test(normalized)) {
    return decodeVintageJapan5Digit(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this ESP serial number. The format was not recognized. Please check the serial number and try again.'
  };
}

function decodeESPUSA(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const buildNum = serial.substring(4);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year.toString(),
    factory: 'ESP USA Custom Shop',
    country: 'USA (California)',
    model: 'ESP USA Custom',
    notes: `USA-made ESP. Build number: ${buildNum}.`
  };
  return { success: true, info };
}

function decodeESP2016Plus(serial: string): DecodeResult {
  const productionNum = serial.substring(1, 5);
  const year = parseInt(serial.substring(5, 7), 10) + 2000;
  const seriesCode = serial[7];

  let series: string;
  switch (seriesCode) {
    case '1':
      series = 'Custom Series';
      break;
    case '2':
      series = 'Signatures Series';
      break;
    case '3':
      series = 'E-II Series';
      break;
    default:
      series = 'Unknown Series';
  }

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year.toString(),
    factory: 'ESP Japan',
    country: 'Japan',
    model: series,
    notes: `Production number: ${productionNum}. 2016+ serial format.`
  };
  return { success: true, info };
}

function decodeEII2016Plus(serial: string): DecodeResult {
  const productionNum = serial.substring(2, 6);
  const year = parseInt(serial.substring(6, 8), 10) + 2000;
  const seriesCode = serial[8];

  let series: string;
  switch (seriesCode) {
    case '1':
      series = 'E-II Custom Series';
      break;
    case '2':
      series = 'E-II Signatures Series';
      break;
    case '3':
      series = 'E-II Standard Series';
      break;
    default:
      series = 'E-II Series';
  }

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year.toString(),
    factory: 'ESP Japan',
    country: 'Japan',
    model: series,
    notes: `E-II line. Production number: ${productionNum}. 2016+ serial format.`
  };
  return { success: true, info };
}

function decodeAmbiguousEPrefix6Digit(serial: string): DecodeResult {
  const ltdYearDigit = serial[1];
  const ltdYear = 2000 + parseInt(ltdYearDigit, 10);
  const ltdSequence = serial.substring(2);
  const eiiYear = '2014';

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: `${eiiYear} or ${ltdYear} (context-dependent ESP/E-II vs LTD estimate)`,
    factory: 'ESP Japan E-II production or Saehan/Sunghak Korea LTD production',
    country: 'Japan / South Korea',
    model: 'ESP-owned E-prefix instrument',
    notes: `Ambiguous ESP-owned E-prefix 6-digit format. If the headstock says E-II, this format is commonly interpreted as early E-II Japan production around ${eiiYear}. If the headstock says LTD or has Made in Korea markings, E indicates the Korean Saehan/Sunghak-era factory, ${ltdYearDigit} indicates ${ltdYear}, and ${ltdSequence} is the production sequence. Use the headstock logo and country marking to choose the correct interpretation.`
  };

  return {
    success: true,
    info,
    patternKey: 'esp-ambiguous-e-prefix-6-digit-eii-ltd',
    patternLabel: 'ESP ambiguous E-prefix 6-digit E-II/LTD format',
    additionalContext: {
      title: 'ESP E-prefix 6-digit serial',
      summary: 'This serial shape is valid for ESP-owned instruments, but the meaning depends on whether the guitar is branded E-II or LTD.',
      highlights: [
        `E-II interpretation: Japanese E-II production around ${eiiYear}.`,
        `LTD interpretation: Korean LTD production from ${ltdYear}, sequence ${ltdSequence}.`,
        'Headstock logo and country markings are required to choose the right result.'
      ],
      caveats: [
        'The serial alone cannot distinguish E-II Japan from LTD Korea for this format.',
        'Early ESP/LTD serial documentation is less consistent than newer 8-digit ESP/E-II formats.'
      ],
      verificationTips: [
        'If the front of the headstock says E-II, use the Japan/E-II interpretation.',
        'If the guitar says LTD or Made in Korea, use the Korean LTD interpretation.',
        'Check the back of the headstock for Made in Japan, Made in Korea, or ESP build stamps.'
      ]
    },
    additionalContextRichText: `<h3>Overview</h3><p>This E-prefix 6-digit serial is valid for ESP-owned instruments, but it is context-dependent.</p><h3>How This Pattern Is Typically Read</h3><p>If the guitar is branded E-II, ${serial} points to early Japanese E-II production around ${eiiYear}. If it is branded LTD or marked Made in Korea, E indicates the Korean Saehan/Sunghak-era factory, ${ltdYearDigit} indicates ${ltdYear}, and ${ltdSequence} is the production sequence.</p><h3>What To Verify</h3><ul><li>Check whether the headstock says E-II or LTD.</li><li>Look for Made in Japan, Made in Korea, or ESP build stamps on the back of the headstock.</li><li>Use the model name and hardware specs to confirm the production line.</li></ul>`
  };
}

function decodeEdwardsEDPrefix(serial: string): DecodeResult {
  const yearDigits = serial.substring(2, 4);
  const productionNum = serial.substring(4);
  const yearNum = parseInt(yearDigits, 10);
  const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year,
    factory: 'Edwards / ESP Japan domestic-market production',
    country: 'Japan',
    model: 'Edwards by ESP',
    notes: `Edwards ED-prefix format. ED indicates Edwards, an ESP Guitar Company Japanese domestic-market line; ${yearDigits} indicates ${year}; ${productionNum} is the production sequence. These serials are commonly stamped on the back of the headstock or at the end of the fretboard.`
  };

  return {
    success: true,
    info,
    patternKey: 'esp-edwards-ed-yy-sequence',
    patternLabel: 'ESP Edwards ED YY sequence format',
    additionalContext: {
      title: 'ESP Edwards ED-prefix serial',
      summary: 'Edwards guitars are Japanese domestic-market instruments produced and distributed by the ESP Guitar Company.',
      highlights: [
        'ED prefix identifies the Edwards line.',
        `Year code ${yearDigits} decodes to ${year}.`,
        `Production sequence: ${productionNum}.`
      ],
      caveats: [
        'Edwards serial documentation is less centralized than major export ESP lines.',
        'The serial confirms the format, but model and market details should be checked against the instrument features.'
      ],
      verificationTips: [
        'Check the back of the headstock or fretboard end for the stamped serial.',
        'Compare the model markings and specs against known Edwards model catalogs or ESP support.'
      ]
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an Edwards ED-prefix format used on Japanese domestic-market guitars produced and distributed by ESP.</p><h3>How This Pattern Is Typically Read</h3><p>ED identifies Edwards. The next two digits, ${yearDigits}, indicate ${year}. The remaining digits are production sequence ${productionNum}.</p><h3>What To Verify</h3><ul><li>Confirm the serial location on the back of the headstock or at the fretboard end.</li><li>Compare the model, finish, hardware, and headstock markings against Edwards catalog references.</li><li>Contact ESP support with photos if authentication matters.</li></ul>`
  };
}

function decodeESPCustomShop(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const week = parseInt(serial.substring(4, 6), 10);
  const dayOfWeek = parseInt(serial[6], 10);
  const productionNum = serial.substring(7);

  // Calculate approximate date from week and day
  const dateInfo = getDateFromWeekDay(year, week, dayOfWeek);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year.toString(),
    month: dateInfo.month,
    day: dateInfo.day,
    factory: 'ESP Custom Shop, Tokyo',
    country: 'Japan',
    model: 'ESP Custom Shop',
    notes: `Week ${week}, Day ${dayOfWeek} of week. Production #${productionNum} that day.`
  };
  return { success: true, info };
}

function decodeESPJapanFactory(serial: string): DecodeResult {
  // Extract factory code (1 or 2 letters)
  let factoryCode: string;
  let digits: string;

  if (/^(CH|CS|TH)/.test(serial)) {
    factoryCode = serial.substring(0, 2);
    digits = serial.substring(2);
  } else {
    factoryCode = serial[0];
    digits = serial.substring(1);
  }

  const year = parseInt(digits.substring(0, 2), 10) + 2000;
  const week = parseInt(digits.substring(2, 4), 10);
  const dayOfWeek = parseInt(digits[4], 10);
  const productionNum = digits.substring(5);

  const factory = getJapanFactory(factoryCode);
  const dateInfo = getDateFromWeekDay(year, week, dayOfWeek);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year.toString(),
    month: dateInfo.month,
    day: dateInfo.day,
    factory: factory,
    country: 'Japan',
    model: 'ESP Japan',
    notes: `Week ${week}, Day ${dayOfWeek} of week. Production #${productionNum} that day.`
  };
  return { success: true, info };
}

function decodeKirkHammett(serial: string): DecodeResult {
  const numPart = serial.replace(/^K-?/, '');
  const productionNum = parseInt(numPart, 10);

  let year: string;
  if (numPart.length === 4) {
    year = '1993-1994';
  } else {
    year = '1995 or later';
  }

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year,
    factory: 'ESP Japan',
    country: 'Japan',
    model: 'Kirk Hammett Signature (KH Series)',
    notes: `Kirk Hammett Signature model. Production number: ${productionNum}. Early models (1993) used 4 digits; after 1995 launch, expanded to 5 digits.`
  };
  return { success: true, info };
}

function decodeLTDIndonesia(serial: string): DecodeResult {
  const prefix = serial.match(/^(IW|IC|IS|IR)/)?.[0] || '';
  const digits = serial.substring(prefix.length);

  const { year, month, productionNum } = parseLTDDigits(digits);
  const factory = getLTDIndonesiaFactory(prefix);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year,
    month: month,
    factory: factory,
    country: 'Indonesia',
    model: 'LTD',
    notes: `LTD series. Production number: ${productionNum}.`
  };
  return { success: true, info };
}

function decodeLTDKorea(serial: string): DecodeResult {
  const prefix = serial[0];
  const digits = serial.substring(1);

  const { year, month, productionNum } = parseLTDDigits(digits);
  const factory = getLTDKoreaFactory(prefix);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year,
    month: month,
    factory: factory,
    country: 'South Korea',
    model: 'LTD',
    notes: `LTD series. Production number: ${productionNum}.`
  };
  return { success: true, info };
}

function decodeLTDKoreaWMI9Digit(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const weekDigits = serial.substring(3, 5);
  const sequence = serial.substring(5);
  const year = 2000 + parseInt(yearDigits, 10);
  const week = parseInt(weekDigits, 10);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year.toString(),
    month: week === 0 ? 'January' : undefined,
    factory: 'World Musical Instruments, South Korea',
    country: 'South Korea',
    model: 'LTD Deluxe / high-tier LTD import',
    notes: `Modern ESP LTD Korean W-prefix format. W indicates World Musical Instruments (WMI); ${yearDigits} indicates ${year}; ${weekDigits} is the production week or early-year production run code; ${sequence} is the factory tracking sequence. Week 00 is typically treated as the start of the production year.`
  };

  return {
    success: true,
    info,
    patternKey: 'esp-ltd-korea-wmi-w-yy-week-sequence',
    patternLabel: 'ESP LTD Korea WMI W + YY + week + sequence',
    additionalContext: {
      title: 'ESP LTD Korea WMI serial',
      summary: 'This serial matches a modern ESP LTD Korean W-prefix format associated with World Musical Instruments.',
      highlights: [
        'W indicates World Musical Instruments in South Korea.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The digits ${weekDigits} decode as production week or early-year run code.`,
        `The final digits decode as tracking sequence ${sequence}.`
      ],
      caveats: [
        'The serial identifies factory timing and sequence, not the exact model name.',
        'Week 00 is best read as very early-year production or wood/prep run timing rather than a normal calendar week.'
      ],
      verificationTips: [
        'Check the headstock for LTD branding and the back of the headstock for Made in Korea markings.',
        'Compare the guitar against LTD Deluxe 1000 Series or signature-model specs from the decoded year.'
      ]
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern ESP LTD Korean W-prefix format associated with World Musical Instruments.</p><h3>How This Pattern Is Typically Read</h3><p>W indicates World Musical Instruments in South Korea. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as the production week or early-year run code. The final digits decode as tracking sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>The serial identifies factory timing and sequence, not the exact model name.</li><li>Week 00 is best read as very early-year production or wood/prep run timing.</li><li>Check for LTD branding and Made in Korea markings.</li></ul>`
  };
}

function decodeLTDEarlyKoreaUSequential(serial: string): DecodeResult {
  const sequence = serial.substring(1);
  const sequenceNumber = parseInt(sequence, 10);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: '2000-2001 (estimated)',
    factory: 'Unsung, South Korea',
    country: 'South Korea',
    model: 'LTD',
    notes: `Early ESP LTD Korean U-prefix format. U is associated with Unsung production, and the six digits are treated as a sequential factory tracking number rather than a reliable YYMM date code. Sequence/tracking number: ${sequenceNumber}. This format is best dated broadly to around 2000-2001 and should be verified with Made in Korea markings, headstock logo, model specs, and serial location.`,
  };

  return {
    success: true,
    info,
    patternKey: 'esp-ltd-early-korea-u-sequential',
    patternLabel: 'ESP LTD early Korea U-prefix sequential format',
    additionalContext: {
      title: 'ESP LTD early Korea U-prefix serial',
      summary: 'This serial matches an early ESP LTD Korean U-prefix format associated with Unsung production.',
      highlights: [
        'U is treated as an Unsung Korea factory prefix for this early LTD format.',
        `The six digits are treated as sequential tracking number ${sequenceNumber}.`,
        'The likely production window is around 2000-2001.',
      ],
      caveats: [
        'The six digits do not reliably encode an exact year, month, or week.',
        'This applies to LTD-branded Korean imports, not Japanese ESP Original, E-II, Edwards, or Navigator instruments.',
        'Factory and date should be confirmed from Made in Korea markings and model details.',
      ],
      verificationTips: [
        'Check the back of the headstock or final fret area for the serial and Made in Korea marking.',
        'Compare the guitar against early-2000s LTD model specs such as M, H, MH, EC, and related Korean lines.',
        'Contact ESP support with clear photos if exact production confirmation is needed.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early ESP LTD Korean U-prefix format associated with Unsung production.</p><h3>How This Pattern Is Typically Read</h3><p>U is treated as an Unsung Korea factory prefix for this early LTD format. The six digits are treated as sequential tracking number ${sequenceNumber}. The likely production window is around 2000-2001.</p><h3>What To Verify</h3><ul><li>The six digits do not reliably encode an exact year, month, or week.</li><li>This applies to LTD-branded Korean imports, not Japanese ESP Original, E-II, Edwards, or Navigator instruments.</li><li>Confirm with Made in Korea markings, model details, and serial location.</li></ul>`,
  };
}

function decodeLTDChina(serial: string): DecodeResult {
  let prefix: string;
  let digits: string;

  if (/^(RS|SH|SX|SK|SP)/.test(serial)) {
    prefix = serial.substring(0, 2);
    digits = serial.substring(2);
  } else {
    prefix = serial[0];
    digits = serial.substring(1);
  }

  const { year, month, productionNum } = parseLTDDigits(digits);
  const factory = getLTDChinaFactory(prefix);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year,
    month: month,
    factory: factory,
    country: 'China',
    model: 'LTD',
    notes: `LTD series. Production number: ${productionNum}.`
  };
  return { success: true, info };
}

function decodeLTDVietnam(serial: string): DecodeResult {
  const digits = serial.substring(1);
  const { year, month, productionNum } = parseLTDDigits(digits);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: year,
    month: month,
    factory: 'Vietnam Factory',
    country: 'Vietnam',
    model: 'LTD',
    notes: `LTD series. Production number: ${productionNum}.`
  };
  return { success: true, info };
}

function decodeLTDKoreaPeerlessR(serial: string): DecodeResult {
  const yearDigits = serial.substring(1, 3);
  const weekDigits = serial.substring(3, 5);
  const productionNum = serial.substring(5);
  const yearNum = parseInt(yearDigits, 10);
  const year = (yearNum < 80 ? 2000 + yearNum : 1900 + yearNum).toString();
  const week = parseInt(weekDigits, 10);
  const sequence = parseInt(productionNum, 10);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year,
    factory: 'Peerless Guitar Co.',
    country: 'South Korea',
    model: 'LTD Korean import',
    notes: `R-prefix ESP LTD Korean format. R indicates Peerless Guitar Co. in South Korea; the digits ${yearDigits} indicate ${year}; ${weekDigits} indicates production week ${week}; and ${productionNum} is production sequence ${sequence}. This format is associated with early-to-mid-2000s Korean LTD production. Verify the model, logo style, and Made in Korea marking on the back of the headstock.`,
  };

  return {
    success: true,
    info,
    patternKey: 'esp-ltd-korea-peerless-r-yy-week-sequence',
    patternLabel: 'ESP LTD Korea Peerless R YY week sequence',
    additionalContext: {
      title: 'ESP LTD Peerless Korea R-prefix serial',
      summary: 'This serial matches an R-prefix ESP LTD format associated with Peerless-built Korean production.',
      highlights: [
        'R indicates Peerless Guitar Co. in South Korea.',
        `The digits ${yearDigits} decode as production year ${year}.`,
        `The digits ${weekDigits} decode as production week ${week}.`,
        `The final three digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'This format identifies factory timing and sequence, not the exact model name.',
        'Factory-letter usage varies across ESP LTD production eras and partners.',
        'Confirm the guitar is LTD-branded and marked Made in Korea before relying on the Peerless interpretation.',
      ],
      verificationTips: [
        'Check for LTD branding on the headstock.',
        'Look for a Made in Korea stamp or decal on the back of the headstock.',
        'Compare the finish, neck construction, hardware, and pickups against 2006 LTD catalog specs.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an R-prefix ESP LTD format associated with Peerless-built Korean production.</p><h3>How This Pattern Is Typically Read</h3><p>R indicates Peerless Guitar Co. in South Korea. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as production week ${week}. The final three digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This format identifies factory timing and sequence, not the exact model name.</li><li>Confirm the guitar is LTD-branded and marked Made in Korea before relying on the Peerless interpretation.</li><li>Compare the finish, neck construction, hardware, and pickups against 2006 LTD catalog specs.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a mid-2000s Peerless Korea LTD decode, then verify the exact model from the headstock logo, country stamp, and physical specs.</p>`,
  };
}

function decodeLTDTransitionalNumeric(serial: string): DecodeResult {
  const yearDigits = serial.substring(0, 2);
  const weekDigits = serial.substring(2, 4);
  const productionNum = serial.substring(4);
  const yearNum = parseInt(yearDigits, 10);
  const year = (yearNum < 80 ? 2000 + yearNum : 1900 + yearNum).toString();
  const week = parseInt(weekDigits, 10);
  const sequence = parseInt(productionNum, 10);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year,
    factory: 'ESP LTD Korean / Indonesian partner factory',
    country: 'South Korea or Indonesia',
    model: 'LTD transitional import',
    notes: `Seven-digit LTD transitional numeric format. The first two digits (${yearDigits}) indicate ${year}; the next two digits (${weekDigits}) indicate production week ${week}; the final three digits indicate production sequence ${sequence}. These pure numeric serials are seen on late-1990s through mid-2000s ESP LTD imports, before later factory-letter formats became more standardized. Verify the exact factory from the Made in Korea or Made in Indonesia marking.`,
  };

  return {
    success: true,
    info,
    patternKey: 'esp-ltd-transitional-yy-week-sequence',
    patternLabel: 'ESP LTD transitional YY week sequence',
    additionalContext: {
      title: 'ESP LTD transitional numeric serial',
      summary: 'This serial matches a seven-digit pure numeric ESP LTD format used on some late-1990s through mid-2000s Korean and Indonesian imports.',
      highlights: [
        `The first two digits ${yearDigits} decode as production year ${year}.`,
        `The next two digits ${weekDigits} decode as production week ${week}.`,
        `The final three digits decode as production sequence ${sequence}.`,
      ],
      caveats: [
        'This format identifies production timing and sequence, not the exact model name.',
        'The serial alone usually cannot distinguish Korea from Indonesia.',
        'Modern ESP LTD instruments more commonly use leading factory-letter serial formats.',
      ],
      verificationTips: [
        'Check whether the headstock is branded LTD rather than ESP Original, E-II, Edwards, or Navigator.',
        'Look for Made in Korea or Made in Indonesia on the back of the headstock.',
        'Compare the logo style and model specs against mid-2000s LTD catalog examples.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches a seven-digit pure numeric ESP LTD format used on some late-1990s through mid-2000s Korean and Indonesian imports.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits, ${yearDigits}, decode as production year ${year}. The next two digits, ${weekDigits}, decode as production week ${week}. The final three digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This format identifies production timing and sequence, not the exact model name.</li><li>The serial alone usually cannot distinguish Korea from Indonesia.</li><li>Check for LTD branding and Made in Korea or Made in Indonesia markings on the back of the headstock.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a mid-2000s ESP LTD import decode, then verify the exact model and factory from the headstock logo, country stamp, and catalog specs.</p>`,
  };
}

function decodePre2000(serial: string): DecodeResult {
  // Pre-2000 format: DDMMYNNN (8 digits) or shorter variants (6-7 digits)
  // Sometimes leading zeros are dropped

  let day: string;
  let month: string;
  let yearDigit: string;
  let productionNum: string;

  if (serial.length === 8) {
    // Full format: DDMMYNNN
    day = serial.substring(0, 2);
    month = serial.substring(2, 4);
    yearDigit = serial[4];
    productionNum = serial.substring(5);
  } else if (serial.length === 7) {
    // Missing leading zero on day: DMMYNNN
    day = '0' + serial[0];
    month = serial.substring(1, 3);
    yearDigit = serial[3];
    productionNum = serial.substring(4);
  } else {
    // 6 digits - missing leading zeros on day and/or month
    day = '0' + serial[0];
    month = '0' + serial[1];
    yearDigit = serial[2];
    productionNum = serial.substring(3);
  }

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(yearDigit, 10);

  // Validate day and month
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
    return {
      success: false,
      error: 'Unable to decode this ESP serial number. The date values appear invalid.'
    };
  }

  // Year digit could be 1980s or 1990s
  const possibleYears = getPre2000Years(yearNum);
  const monthName = getMonthName(monthNum);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: possibleYears,
    month: monthName,
    day: dayNum.toString(),
    factory: 'ESP Japan',
    country: 'Japan',
    notes: `Pre-2000 format. Production #${parseInt(productionNum, 10)} on this date. Note: Year could be ${possibleYears} - check model history to confirm decade.`
  };
  return { success: true, info };
}

function decodeVintageJapan5Digit(serial: string): DecodeResult {
  const sequence = parseInt(serial, 10);

  const info: GuitarInfo = {
    brand: 'ESP',
    serialNumber: serial,
    year: 'late 1980s to early 1990s (estimated)',
    factory: 'ESP Japan (Sado or Takada factory likely)',
    country: 'Japan',
    model: 'Traditional / 400 Series or early Custom Shop',
    notes: `Older ESP 5-digit numeric serial, commonly seen on Japanese-made Traditional, 400 Series, Original Series, or early Custom Shop instruments. Sequence: ${sequence}. ESP serial records from this era are not consistently date-coded, so confirm the exact date from neck-heel or neck-pocket markings when possible.`,
  };

  return {
    success: true,
    info,
    patternKey: 'esp-vintage-japan-5-digit',
    patternLabel: 'ESP vintage Japan 5-digit',
    additionalContext: {
      title: 'ESP vintage Japan 5-digit serial',
      summary: 'This serial matches an older Japanese ESP 5-digit numeric format seen on late-1980s and early-1990s instruments.',
      highlights: [
        'Five-digit numeric serials are commonly seen on older ESP Japan neck plates.',
        'The likely era is late 1980s to early 1990s.',
        'Common matches include Traditional, 400 Series, Original Series, or early Custom Shop instruments.',
        `The digits are best treated as sequence ${sequence}, not a reliable date code.`,
      ],
      caveats: [
        'ESP historical records from this era are incomplete and often not public-facing.',
        'The serial alone usually cannot confirm an exact month or day.',
        'Factory attribution should be verified from physical markings and model details.',
      ],
      verificationTips: [
        'Check whether the serial is stamped into a metal neck plate.',
        'Inspect the neck heel or neck pocket for a handwritten or stamped production date.',
        'Contact ESP customer service with clear photos of the serial, headstock, neck plate, and bridge if authenticity matters.',
      ],
    },
    additionalContextRichText: `<h3>Overview</h3><p>This serial matches an older Japanese ESP 5-digit numeric format seen on late-1980s and early-1990s instruments.</p><h3>How This Pattern Is Typically Read</h3><p>Five-digit numeric serials are commonly seen on older ESP Japan neck plates. The likely era is late 1980s to early 1990s. Common matches include Traditional, 400 Series, Original Series, or early Custom Shop instruments. The digits are best treated as sequence ${sequence}, not a reliable date code.</p><h3>What To Verify</h3><ul><li>ESP historical records from this era are incomplete and often not public-facing.</li><li>The serial alone usually cannot confirm an exact month or day.</li><li>Factory attribution should be verified from physical markings and model details.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a vintage Japan ESP decode, then confirm with the neck plate, neck-heel or neck-pocket date markings, and ESP support when authenticity matters.</p>`,
  };
}

function parseLTDDigits(digits: string): { year: string; month: string; productionNum: string } {
  // LTD format: YYMM + remaining digits for production number
  // 7 digits = 2000-2010 era, 8 digits = 2010+ era

  const yearDigits = digits.substring(0, 2);
  const monthDigits = digits.substring(2, 4);
  const productionNum = digits.substring(4);

  const yearNum = parseInt(yearDigits, 10);
  const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
  const monthNum = parseInt(monthDigits, 10);
  const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;

  return { year, month: month || '', productionNum };
}

function getJapanFactory(code: string): string {
  switch (code) {
    case 'K':
      return 'Kiso Factory, Japan';
    case 'N':
      return 'Nagano Factory, Japan';
    case 'S':
      return 'Sado Factory, Japan';
    case 'T':
      return 'Takada Factory, Japan';
    case 'CH':
    case 'CS':
      return 'Craft House, Japan';
    case 'TH':
      return 'Technical House, Japan';
    default:
      return 'ESP Japan';
  }
}

function getLTDIndonesiaFactory(prefix: string): string {
  switch (prefix) {
    case 'IW':
      return 'P.T. Wildwood, Indonesia';
    case 'IC':
      return 'Cor-tek, Indonesia';
    case 'IS':
      return 'Samick, Indonesia';
    case 'IR':
      return 'Indonesia Factory';
    default:
      return 'Indonesia Factory';
  }
}

function getLTDKoreaFactory(prefix: string): string {
  switch (prefix) {
    case 'W':
      return 'World Musical Instruments, Incheon';
    case 'E':
    case 'U':
      return 'South Korea Factory';
    default:
      return 'South Korea Factory';
  }
}

function getLTDChinaFactory(prefix: string): string {
  switch (prefix) {
    case 'L':
      return 'China Factory';
    case 'RS':
      return 'China Factory (possibly Wildwood)';
    case 'SH':
      return 'China Factory (possibly SaeJun)';
    case 'SX':
    case 'SK':
    case 'SP':
      return 'China Factory';
    default:
      return 'China Factory';
  }
}

function getPre2000Years(digit: number): string {
  // Single digit could represent 1980s or 1990s
  const year80s = 1980 + digit;
  const year90s = 1990 + digit;

  if (digit >= 0 && digit <= 9) {
    return `${year80s} or ${year90s}`;
  }
  return 'Unknown';
}

function getDateFromWeekDay(year: number, week: number, dayOfWeek: number): { month: string; day: string } {
  // Calculate approximate date from ISO week number and day of week
  // Day 1 = Monday, Day 7 = Sunday
  const jan4 = new Date(year, 0, 4);
  const startOfYear = new Date(jan4);
  startOfYear.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);

  const targetDate = new Date(startOfYear);
  targetDate.setDate(startOfYear.getDate() + (week - 1) * 7 + (dayOfWeek - 1));

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    month: monthNames[targetDate.getMonth()],
    day: targetDate.getDate().toString()
  };
}

function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}
