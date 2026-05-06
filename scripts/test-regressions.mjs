import { decodeSerialForBackend } from '../dist/serial-decode-service.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function decodeIbanez(serialInput) {
  return decodeSerialForBackend('ibanez', serialInput);
}

function decodeBCRich(serialInput) {
  return decodeSerialForBackend('bcrich', serialInput);
}

function decodeKramer(serialInput) {
  return decodeSerialForBackend('kramer', serialInput);
}

function decodeJackson(serialInput) {
  return decodeSerialForBackend('jackson', serialInput);
}

function decodeESP(serialInput) {
  return decodeSerialForBackend('esp', serialInput);
}

function decodeSchecter(serialInput) {
  return decodeSerialForBackend('schecter', serialInput);
}

function decodeWashburn(serialInput) {
  return decodeSerialForBackend('washburn', serialInput);
}

function decodeCharvel(serialInput) {
  return decodeSerialForBackend('charvel', serialInput);
}

function decodeTaylor(serialInput) {
  return decodeSerialForBackend('taylor', serialInput);
}

function assertIbanezBPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2016', `Expected year 2016 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'February', `Expected month February for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown (B used as month-letter code, not a factory code)',
    `Expected month-letter factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez5BPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2016', `Expected year 2016 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (5B prefix)',
    `Expected 5B prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez5APrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2021', `Expected year 2021 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'April', `Expected month April for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (5A prefix)',
    `Expected 5A prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez5NPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2023', `Expected year 2023 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'April', `Expected month April for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (5N prefix)',
    `Expected 5N prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez4HPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2014', `Expected year 2014 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'August', `Expected month August for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (4H-prefix factory)',
    `Expected 4H prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanez4HExtended(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2023', `Expected year 2023 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (4H-prefix factory)',
    `Expected 4H prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezOZPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2010', `Expected year 2010 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (OZ-prefix factory)',
    `Expected OZ prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezHPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2008', `Expected year 2008 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'November', `Expected month November for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (H-prefix factory)',
    `Expected H prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezExistingSamples() {
  const samples = ['F0712345', 'F523456', 'I120426682', 'GS140406094'];

  for (const sample of samples) {
    const result = decodeIbanez(sample);
    assert(result.success, `Expected decode success for ${sample}`);
    assert(result.info, `Expected decoded info for ${sample}`);
  }
}

function assertPRSUsaCoreSingleYearDigit(serialInput) {
  const result = decodeSerialForBackend('prs', serialInput);
  assert(result.success, `Expected decode success for prs:${serialInput}`);
  assert(result.info, `Expected decoded info for prs:${serialInput}`);

  const info = result.info;
  assert(info.year === '2007', `Expected year 2007 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'PRS Factory, Stevensville, Maryland',
    `Expected PRS Stevensville factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA', `Expected USA for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Core set-neck model', `Expected Core set-neck model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'prs-usa-core-single-year-digit-six-sequence',
    `Expected PRS USA Core pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 126922'),
    `Expected PRS USA Core rich text for ${serialInput}`
  );
}

function assertIbanezFujiGenPost2004EightDigit(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'FujiGen Gakki, Nagano',
    `Expected FujiGen factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    result.patternKey === 'ibanez-fujigen-post-2004-f-yy-sequence',
    `Expected post-2004 FujiGen pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertIbanezNumericOnly9Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (numeric-only format)',
    `Expected numeric-only factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezNumericOnly9DigitAmbiguous(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumericOnly8DigitAmbiguous(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumericOnly8DigitLate1900s(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Likely Korean import factory (possibly Cort)',
    `Expected likely Korean factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertIbanezNumericOnly7Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (numeric-only format)',
    `Expected numeric-only factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezNumericOnly10DigitFactoryLeading(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown China factory (numeric 10-digit format)',
    `Expected numeric 10-digit China factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezModelCodeFallback(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.model === 'SR305EDX', `Expected model SR305EDX for ${serialInput}, got ${info.model}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('model code, not a stamped serial number'),
    `Expected model-code note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezModelCodeFallbackGRG(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.model === 'GRG170DX', `Expected model GRG170DX for ${serialInput}, got ${info.model}`);
  assert(info.country === 'China or Indonesia', `Expected country China or Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('model code, not a stamped serial number'),
    `Expected model-code note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezKnownProductCode(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.model === 'JEM7V Steve Vai Signature', `Expected JEM7V model for ${serialInput}, got ${info.model}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('GTIN/UPC retail product barcode'),
    `Expected UPC/GTIN note for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes('not the stamped instrument serial number'),
    `Expected not-serial note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'ibanez-known-upc-jem7v',
    `Expected Ibanez UPC pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertIbanezCompoundGS(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezIndonesiaI(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
}

function assertIbanezIndonesiaExtended10(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Line code:'),
    `Expected line-code note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezKnownHUVariant(serialInput, correctedSerial, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === correctedSerial, `Expected corrected serial ${correctedSerial} for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${correctedSerial}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezMonthLetterCompactWithOTypo(serialInput, correctedSerial, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === correctedSerial, `Expected corrected serial ${correctedSerial} for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${correctedSerial}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezIndonesiaGILegacy(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
}

function assertIbanezChinaGP(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezChinaGZ(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'China (GZ-prefix factory/line)',
    `Expected GZ factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezFujiGenFD(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezWorldExtended(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'World Musical Instruments Co.', `Expected World factory for ${serialInput}, got ${info.factory}`);
}

function assertIbanezWorldShortWK(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2000', `Expected year 2000 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'October', `Expected month October for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'World Musical Instruments Co.', `Expected World factory for ${serialInput}, got ${info.factory}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezRPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Peerless Korea Co., Pusan',
    `Expected Peerless Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertIbanezSQMonthLetter(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Saehan Guitar Technology (acoustic production)',
    `Expected Saehan acoustic factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezKorea7DigitC(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort Guitars, Incheon/Daejeon',
    `Expected Cort Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertIbanezVPrefix(serialInput, expectedYear) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Unknown V-prefix production line (Japan or Korea)',
    `Expected V-prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezMPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezChinaL(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezChinaN(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (N-prefix factory)',
    `Expected N-prefix China factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanez4L(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezLegacyAlphaSuffix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezJapanMonthLetterExtended(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezCompoundNumeric(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Prefix code:'),
    `Expected prefix note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezCompactAlphaSuffix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
}

function assertIbanezLegacyNumericLate80s(serialInput, expectedYear) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.country === 'USA/Japan (ambiguous)',
    `Expected ambiguous USA/Japan country note for ${serialInput}, got ${info.country}`
  );
}

function assertIbanezNumeric6DigitYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate vintage interpretation'),
    `Expected alternate vintage interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumeric6DigitPreLetter(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('pre-letter YMMNNN'),
    `Expected pre-letter YMMNNN note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumeric6DigitOmittedPrefixJapan(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Terada Musical Instrument Co., Nagoya (possible omitted-prefix format)',
    `Expected Terada omitted-prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertBCRichIShortImport(serialInput, expectedYear, expectedMonth) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Import production (I-prefix short format)',
    `Expected I-prefix short import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.country === 'Asia (factory unspecified)',
    `Expected Asia import country note for ${serialInput}, got ${info.country}`
  );
}

function assertBCRichShortNumericImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2001 (likely import estimate)', `Expected likely 2001 import estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Early-2000s import production',
    `Expected early-2000s import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('Class Axe-era'),
    `Expected Class Axe-era ambiguity note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-short-numeric-import-y-filler-quarter-sequence',
    `Expected B.C. Rich short numeric pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 979'),
    `Expected B.C. Rich short numeric rich text for ${serialInput}`
  );
}

function assertBCRichShortMonthCodeImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2020', `Expected year 2020 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'April', `Expected month April for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Import production batch/factory code 5',
    `Expected batch/factory code 5 for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('pre-2000 F-prefix'),
    `Expected pre-2000 F-prefix ambiguity note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-short-modern-month-code-import',
    `Expected B.C. Rich short month-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 1631'),
    `Expected B.C. Rich short month-code rich text for ${serialInput}`
  );
}

function assertBCRichBPrefixMonthCodeImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2009', `Expected year 2009 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China import production (B-prefix factory/line)',
    `Expected B-prefix China import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 30385'),
    `Expected production sequence 30385 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-b-prefix-month-code-import',
    `Expected B.C. Rich B-prefix month-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2009'),
    `Expected B.C. Rich B-prefix rich text for ${serialInput}`
  );
}

function assertBCRichHanserEraEightDigitImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(
    info.serialNumber === '41201627',
    `Expected Sr# label to be stripped for ${serialInput}, got ${info.serialNumber}`
  );
  assert(
    info.year === '2004 or 2014 (likely 2004 for mid-2000s Hanser-era imports)',
    `Expected Hanser-era ambiguous 2004/2014 year for ${serialInput}, got ${info.year}`
  );
  assert(
    info.notes && info.notes.includes('production sequence 201627'),
    `Expected production sequence 201627 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-hanser-era-8-digit-import',
    `Expected B.C. Rich Hanser-era 8-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Q1'),
    `Expected B.C. Rich Hanser-era rich text for ${serialInput}`
  );
}

function assertBCRichClassAxeBPrefixImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '1989-1993 (estimated)', `Expected Class Axe-era estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Class Axe-era import production',
    `Expected Class Axe-era import production for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.country === 'South Korea / Japan',
    `Expected Korea/Japan country note for ${serialInput}, got ${info.country}`
  );
  assert(
    info.notes && info.notes.includes('neck-plate sequence (7132)'),
    `Expected neck-plate sequence 7132 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-class-axe-b-prefix-import',
    `Expected B.C. Rich Class Axe B-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('1989-1993'),
    `Expected B.C. Rich Class Axe B-prefix rich text for ${serialInput}`
  );
}

function assertBCRichUSA5DigitOffset(serialInput, expectedYearRange) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'USA (neck-through)',
    `Expected USA neck-through factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('serial drift'),
    `Expected serial-drift note for ${serialInput}, got ${info.notes}`
  );
}

function assertKramerModernS(serialInput, expectedYear, expectedMonth) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Samick', `Expected Samick factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
}

function assertKramerVPrefix(serialInput, expectedYearRange) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(
    info.notes && info.notes.includes('not always chronological'),
    `Expected non-chronological note for ${serialInput}, got ${info.notes}`
  );
}

function assertKramerCFPrefix(serialInput, expectedYearRange) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Focus/Striker-era'),
    `Expected Focus/Striker-era note for ${serialInput}, got ${info.notes}`
  );
}

function assertKramerSESamickKorea(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1980s to early 1990s (estimated)',
    `Expected late 1980s to early 1990s estimate for ${serialInput}, got ${info.year}`
  );
  assert(info.factory === 'Samick', `Expected Samick factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Overseas import model, commonly Striker, Aerostar, or Focus family',
    `Expected Striker/Aerostar/Focus model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'kramer-se-samick-korea-4-digit',
    `Expected Kramer SE Samick Korea pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 8280'),
    `Expected Kramer SE Samick Korea rich text for ${serialInput}`
  );
}

function assertKramerSCJapanImport(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === 'mid-to-late 1980s (estimated)', `Expected mid-to-late 1980s estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'ESP Japan-associated overseas production',
    `Expected ESP Japan-associated production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Overseas import model, commonly Focus or Striker family',
    `Expected Focus/Striker model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'kramer-sc-japan-focus-striker-4-digit',
    `Expected Kramer SC Japan pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 9117'),
    `Expected Kramer SC Japan rich text for ${serialInput}`
  );
}

function assertKramerNumeric5Prefix(serialInput, expectedYearRange) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Korean import production line',
    `Expected Korean import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
}

function assertKramerVintage5Digit(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '1980s (estimated)', `Expected 1980s estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Neptune, NJ plate-era production',
    `Expected Neptune, NJ plate-era production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA or Japan', `Expected USA or Japan for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-vintage-5-digit-plate',
    `Expected Kramer vintage 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('plate sequence here is 70630'),
    `Expected Kramer vintage 5-digit rich text for ${serialInput}`
  );
}

function assertYamahaLetterZeroLetter(serialInput) {
  const result = decodeSerialForBackend('yamaha', serialInput);
  assert(result.success, `Expected decode success for yamaha:${serialInput}`);
  assert(result.info, `Expected decoded info for yamaha:${serialInput}`);

  const info = result.info;
  assert(
    info.year === '2001 or 2011 or 2021',
    `Expected year candidates 2001/2011/2021 for ${serialInput}, got ${info.year}`
  );
  assert(info.month === 'October', `Expected month October for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('O and zero 0'),
    `Expected O/0 ambiguity note for ${serialInput}, got ${info.notes}`
  );
}

function assertGretschFenderEraWithSuffix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('gretsch', serialInput);
  assert(result.success, `Expected decode success for gretsch:${serialInput}`);
  assert(result.info, `Expected decoded info for gretsch:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Yako Facility', `Expected Yako Facility for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Additional prefix letter "G"'),
    `Expected suffix-letter note for ${serialInput}, got ${info.notes}`
  );
}

function assertDeanHPrefixIndia(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'India import production line',
    `Expected India import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'India', `Expected country India for ${serialInput}, got ${info.country}`);
}

function assertDeanLegacyKoreaESingleYearDigit(serialInput, expectedYear) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Korean import production line',
    `Expected Korean import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-legacy-korea-e-single-year-digit',
    `Expected Dean legacy E-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanChinaZPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'China import production line',
    `Expected China import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-china-z-yy-sequence',
    `Expected Dean Z-prefix China pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortIEPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Surabaya',
    `Expected PT. Cort Indonesia, Surabaya for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
}

function assertCortAIPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Mojokerto',
    `Expected PT. Cort Indonesia, Mojokerto for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-ai-indonesia-yymm-sequence',
    `Expected Cort AI pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2020'),
    `Expected Cort AI rich text for ${serialInput}`
  );
}

function assertCortICSEPrefix(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '2021', `Expected year 2021 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Surabaya',
    `Expected PT. Cort Indonesia, Surabaya for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Cort/Cor-Tek SE production line or series',
    `Expected ICSE model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'cort-icse-indonesia-yy-sequence',
    `Expected Cort ICSE pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 3319'),
    `Expected Cort ICSE rich text for ${serialInput}`
  );
}

function assertCortIATransposedPrefix(serialInput, expectedCorrected, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);
  assert(
    result.correctedSerial === expectedCorrected,
    `Expected corrected serial ${expectedCorrected} for ${serialInput}, got ${result.correctedSerial}`
  );

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected corrected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Mojokerto',
    `Expected PT. Cort Indonesia, Mojokerto for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${expectedCorrected}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertCortYearSequence7Digit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '2000', `Expected year 2000 for ${serialInput}, got ${info.year}`);
  assert(
    info.notes && info.notes.includes('production sequence 400'),
    `Expected production sequence 400 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-year-sequence-7-digit',
    `Expected Cort year-sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortLate1990s8Digit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1999', `Expected year 1999 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'December', `Expected month December for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort Korea (Incheon or Daejeon)',
    `Expected Cort Korea (Incheon or Daejeon) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-late-1990s-8-digit-yymm-sequence',
    `Expected Cort late-1990s 8-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 2466'),
    `Expected Cort late-1990s 8-digit rich text for ${serialInput}`
  );
}

function assertCortModern8DigitYearBatch(serialInput, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort (location varies - Korea, Indonesia, or China)',
    `Expected variable Cort factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Korea, Indonesia, or China', `Expected variable country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-modern-8-digit-year-batch-sequence',
    `Expected Cort modern 8-digit year/batch pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortRPrefixYearSequence(serialInput, expectedCorrected, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cor-Tek/Cort R-prefix production line or factory',
    `Expected Cort R-prefix factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Korea, Indonesia, or China', `Expected variable country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 11374'),
    `Expected R-prefix production sequence 11374 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-r-prefix-yy-sequence',
    `Expected Cort R-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2006'),
    `Expected Cort R-prefix rich text for ${serialInput}`
  );
}

function assertCort1980sKorea7Digit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1988', `Expected year 1988 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort Korea (Incheon)',
    `Expected Cort Korea (Incheon) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('sequence 8046'),
    `Expected sequence 8046 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-1980s-korea-7-digit-yy-sequence',
    `Expected Cort 1980s Korea pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 1988'),
    `Expected Cort 1980s Korea rich text for ${serialInput}`
  );
}

function assertCharvelCFPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('charvel', serialInput);
  assert(result.success, `Expected decode success for charvel:${serialInput}`);
  assert(result.info, `Expected decoded info for charvel:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'World Music Instruments (WMI)',
    `Expected WMI factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
}

function assertCharvelJapanIMC7Digit(serialInput) {
  const result = decodeSerialForBackend('charvel', serialInput);
  assert(result.success, `Expected decode success for charvel:${serialInput}`);
  assert(result.info, `Expected decoded info for charvel:${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'mid-to-late 1980s or early 1990s (estimated)',
    `Expected MIJ era estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Chushin Gakki / IMC-era Japanese import production',
    `Expected Chushin/IMC-era production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'charvel-japan-imc-7-digit-neck-plate',
    `Expected Charvel 7-digit MIJ pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierChinaSE9Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China Strat Pack / SE production',
    `Expected China Strat Pack / SE production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Squier Strat SE (Special Edition)',
    `Expected Squier Strat SE model for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'squier-china-se-9-digit-yymm-sequence',
    `Expected Squier SE 9-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertFenderTrailingFTypoCorrection(serialInput, expectedCorrected, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(
    result.correctedSerial === expectedCorrected,
    `Expected corrected serial ${expectedCorrected} for ${serialInput}, got ${result.correctedSerial}`
  );

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected corrected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
}

function assertFenderJDPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'Dyna Gakki / Fender Japan network',
    `Expected Dyna Gakki / Fender Japan network for ${serialInput}, got ${info.factory}`
  );
}

function assertFenderICSPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'Indonesian Factory (Cort or other)',
    `Expected Indonesian Factory (Cort or other) for ${serialInput}, got ${info.factory}`
  );
}

function assertFenderInternalPartNumber(serialInput) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);

  const info = result.info;
  assert(
    info.model === 'Internal Fender part number (not date-coded serial)',
    `Expected internal part-number model for ${serialInput}, got ${info.model}`
  );
  assert(
    info.notes && info.notes.includes('internal Fender part/product identifier'),
    `Expected internal part-number note for ${serialInput}, got ${info.notes}`
  );
}

function assertCharvelNumeric8(serialInput, expectedYear, expectedMonth) {
  const result = decodeCharvel(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown (8-digit numeric format)',
    `Expected 8-digit numeric factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertDecodeFails(brandInput, serialInput) {
  const result = decodeSerialForBackend(brandInput, serialInput);
  assert(!result.success, `Expected decode failure for ${brandInput}:${serialInput}`);
  assert(
    result.error === 'Unable to decode this serial number.',
    `Expected generic decode failure message for ${brandInput}:${serialInput}, got ${result.error}`
  );
}

function assertGodinAmbiguous7Digit(serialInput) {
  const result = decodeSerialForBackend('godin', serialInput);
  assert(result.success, `Expected decode success for godin:${serialInput}`);
  assert(result.info, `Expected decoded info for godin:${serialInput}`);

  const info = result.info;
  assert(info.year === 'Needs verification', `Expected advisory year for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Quebec, Canada', `Expected Quebec factory note for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Canada', `Expected Canada country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('missing a faded leading 0'),
    `Expected missing-digit note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.additionalContext && result.additionalContext.verificationTips.some((tip) => tip.includes('headstock')),
    `Expected verification tips for ${serialInput}`
  );
}

function assertOvationSnPrefixedUsa(serialInput, expectedYear) {
  const result = decodeSerialForBackend('ovation', serialInput);
  assert(result.success, `Expected decode success for ovation:${serialInput}`);
  assert(result.info, `Expected decoded info for ovation:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'New Hartford, Connecticut',
    `Expected New Hartford, Connecticut for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA', `Expected USA for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('4-digit model number'),
    `Expected model-identification guidance for ${serialInput}, got ${info.notes}`
  );
}

function assertOvationKoreanImport7Digit(serialInput) {
  const result = decodeSerialForBackend('ovation', serialInput);
  assert(result.success, `Expected decode success for ovation:${serialInput}`);
  assert(result.info, `Expected decoded info for ovation:${serialInput}`);

  const info = result.info;
  assert(info.year === 'post-1989 (estimated)', `Expected post-1989 estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Korean import production line',
    `Expected Korean import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Celebrity, Elite import, or AX series',
    `Expected Celebrity/Elite/AX model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'ovation-korea-7-digit-import',
    `Expected Ovation Korean import pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('import sequence 2121282'),
    `Expected Ovation Korean import rich text for ${serialInput}`
  );
}

function assertTaylorModernShort9Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(info.factory === 'El Cajon, California', `Expected El Cajon factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Modern Taylor 9-digit variant'),
    `Expected shortened-format note for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes('production sequence #4'),
    `Expected Taylor production sequence #4 note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'taylor-modern-short-9',
    `Expected Taylor shortened-modern pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence #4'),
    `Expected Taylor shortened-modern rich text for ${serialInput}`
  );
}

function assertTaylorLegacy9Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(
    info.notes && info.notes.includes('This 9-digit format was used from 1993 to 1999'),
    `Expected legacy 9-digit note for ${serialInput}, got ${info.notes}`
  );
}

function assertTaylorLegacy9DigitYearCode(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(
    info.model === '500 Series through Presentation Series',
    `Expected 500 Series through Presentation Series for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'taylor-legacy-9-digit-year-code',
    `Expected Taylor legacy year-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 55'),
    `Expected Taylor legacy year-code rich text for ${serialInput}`
  );
}

function assertTaylorModernExtended11Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(info.factory === 'Tecate, Baja California', `Expected Tecate factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Mexico', `Expected Mexico country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === '300 or 400 Series',
    `Expected 300 or 400 Series model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    info.notes && info.notes.includes('production sequence #138'),
    `Expected Taylor production sequence #138 note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'taylor-modern-extended-11',
    `Expected Taylor modern extended 11-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('series-code digit'),
    `Expected Taylor modern extended 11-digit rich text for ${serialInput}`
  );
}

function assertJacksonMij1996Transition(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '1996', `Expected year 1996 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('1996 transition period'),
    `Expected 1996 transition note for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes(`production sequence ${parseInt(serialInput.substring(1), 10)}`),
    `Expected production sequence note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-6-digit-1996-transition',
    `Expected Jackson MIJ transition pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Chushin Gakki'),
    `Expected Jackson MIJ transition rich text for ${serialInput}`
  );
}

function assertJacksonMijSevenDigit1990s(serialInput, expectedYear) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('7-digit mid-1990s Jackson import format'),
    `Expected mid-1990s MIJ note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-7-digit-1990-1995-chushin',
    `Expected Jackson MIJ 7-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Chushin Gakki'),
    `Expected Jackson MIJ 7-digit rich text for ${serialInput}`
  );
}

function assertJacksonMijSevenPrefixSixDigit(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1990s to late 2000s (estimated)',
    `Expected late 1990s to late 2000s estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Japan import production, likely Chushin Gakki',
    `Expected likely Japan import factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'jackson-mij-6-digit-7-prefix-import-sequence',
    `Expected Jackson MIJ 6-digit 7-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('this serial has 6 digits'),
    `Expected Jackson MIJ 6-digit caveat for ${serialInput}`
  );
}

function assertJacksonUSAUSeries(serialInput, expectedYear = 'early to mid-2000s (estimated)') {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(
    info.year === expectedYear,
    `Expected ${expectedYear} estimate for ${serialInput}, got ${info.year}`
  );
  assert(info.factory === 'Jackson USA', `Expected Jackson USA factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('USA U-series serial'),
    `Expected USA U-series note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-usa-u-series',
    `Expected Jackson USA U-series pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`numeric sequence is ${parseInt(serialInput.substring(1), 10)}`),
    `Expected Jackson USA U-series rich text for ${serialInput}`
  );
}

function assertJacksonTaiwanJSSeries(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '1996', `Expected year 1996 for ${serialInput}, got ${info.year}`);
  assert(info.model === 'JS20', `Expected JS20 model for ${serialInput}, got ${info.model}`);
  assert(info.factory === 'MIT Taiwan factory', `Expected MIT Taiwan factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Taiwan', `Expected Taiwan country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'jackson-taiwan-js-series-1996',
    `Expected Jackson Taiwan JS-series pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 50010694'),
    `Expected Jackson Taiwan JS-series rich text for ${serialInput}`
  );
}

function assertJacksonMij200C(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '2002-2006 (estimated)', `Expected estimated 2002-2006 year for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('200C + 5 digits'),
    `Expected 200C pattern note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-200c-chushin',
    `Expected Jackson 200C pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 541'),
    `Expected Jackson 200C rich text for ${serialInput}`
  );
}

function assertESPVintageJapan5Digit(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1980s to early 1990s (estimated)',
    `Expected late 1980s to early 1990s estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'ESP Japan (Sado or Takada factory likely)',
    `Expected ESP Japan factory estimate for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Traditional / 400 Series or early Custom Shop',
    `Expected vintage ESP model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'esp-vintage-japan-5-digit',
    `Expected ESP vintage Japan 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`sequence ${parseInt(serialInput, 10)}`),
    `Expected ESP vintage Japan rich text for ${serialInput}`
  );
}

function assertSchecterCAPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2024', `Expected year 2024 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China import factory / newer production partner',
    `Expected China import factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-ca-yymm-sequence',
    `Expected Schecter CA pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 5'),
    `Expected Schecter CA rich text for ${serialInput}`
  );
}

function assertSchecterRNPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === 'RN24100948', `Expected normalized serial RN24100948 for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === '2024', `Expected year 2024 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'October', `Expected month October for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'PT. Roxy Music', `Expected PT. Roxy Music factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-rn-yymm-sequence',
    `Expected Schecter RN pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 948'),
    `Expected Schecter RN rich text for ${serialInput}`
  );
}

function assertSchecterSTPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2019', `Expected year 2019 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'July', `Expected month July for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China import factory / ST production run',
    `Expected ST China import factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-st-yymm-sequence',
    `Expected Schecter ST pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 42'),
    `Expected Schecter ST rich text for ${serialInput}`
  );
}

function assertSchecterROPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2023', `Expected year 2023 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'PT Cort Indonesia', `Expected PT Cort Indonesia for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-ro-indonesia-yy-sequence',
    `Expected Schecter RO pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 100905'),
    `Expected Schecter RO rich text for ${serialInput}`
  );
}

function assertSchecterHPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2009', `Expected year 2009 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Korea / Asian import factory',
    `Expected H import factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Diamond Series or similar import',
    `Expected Diamond Series or similar import model for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'schecter-h-yymm-sequence',
    `Expected Schecter H pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 1093'),
    `Expected Schecter H rich text for ${serialInput}`
  );
}

function assertSchecterOneWCorrectsToIW(serialInput, expectedCorrected) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);
  assert(
    result.correctedSerial === expectedCorrected,
    `Expected corrected serial ${expectedCorrected} for ${serialInput}, got ${result.correctedSerial}`
  );

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected corrected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === '2017', `Expected year 2017 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'August', `Expected month August for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Musical Instruments (WMI)',
    `Expected WMI factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${expectedCorrected}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertSchecterLegacy6Digit(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2005', `Expected year 2005 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Korea Factory', `Expected Korea factory guidance for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Diamond Series or similar import',
    `Expected Diamond Series or similar import model for ${serialInput}, got ${info.model}`
  );
  assert(
    info.notes && info.notes.includes('legacy Korean import format'),
    `Expected legacy Korean import note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'schecter-korea-legacy-6-digit',
    `Expected Schecter legacy 6-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 27007'),
    `Expected Schecter legacy 6-digit rich text for ${serialInput}`
  );
}

function assertWashburnIndonesiaYearLetter(serialInput) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === '1998 or 2008', `Expected ambiguous 1998 or 2008 year for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Indonesia (Samick or PT Cort facility)',
    `Expected Indonesian Washburn factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-indonesia-i-year-letter-sequence',
    `Expected Washburn Indonesian pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 112846'),
    `Expected Washburn Indonesian rich text for ${serialInput}`
  );
}

function assertWashburnLegacyJapan6Digit(serialInput) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1970s-early 1980s (estimated)',
    `Expected legacy Washburn era guidance for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Japan (often Yamaki or another Japanese partner)',
    `Expected Japan legacy Washburn factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-legacy-japan-6-digit',
    `Expected Washburn legacy Japan pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`Serial ${serialInput} is best treated as a late-1970s to early-1980s Washburn sequence`),
    `Expected Washburn legacy Japan rich text for ${serialInput}`
  );
}

assertIbanezBPrefix('B160100231');
assertIbanezBPrefix('B-160100231');
assertIbanez5APrefix('5A210401373');
assertIbanez5BPrefix('5B160100231');
assertIbanez5BPrefix('5B-160100231');
assertIbanez5NPrefix('5N230401406');
assertIbanez4HPrefix('4H140800605');
assertIbanez4HExtended('4H2300501778');
assertIbanezOZPrefix('OZ100500158');
assertIbanezHPrefix('H081100181');
assertIbanezCompoundGS('2Y03GS241108648', '2024', 'November');
assertIbanezCompoundGS('212Y03GS251101952', '2025', 'November');
assertIbanezCompoundNumeric('215N015N250401143', '2025', 'April');
assertIbanezCompoundNumeric('1P-01 I220300400', '2022', 'March');
assertIbanez4L('4L1901087937', '2019', 'January');
assertIbanezLegacyAlphaSuffix('83030041D', '1983', 'March');
assertIbanezLegacyAlphaSuffix('8303004ID', '1983', 'March');
assertIbanezJapanMonthLetterExtended('H83020056', '1983', 'August');
assertIbanezCompactAlphaSuffix('00906B', '2000', 'September');
assertIbanezLegacyNumericLate80s('881865', '1988');
assertIbanezNumeric6DigitYYMM('041195', '2004', 'November');
assertIbanezNumeric6DigitOmittedPrefixJapan('510192', '1995 or 2005', 'October');
assertIbanezNumeric6DigitPreLetter('402989', '1974', 'February');
assertIbanezIndonesiaI('I110626774', '2011', 'June');
assertIbanezIndonesiaExtended10('I1161207864', '2011', 'December');
assertIbanezIndonesiaI('U081100181', '2008', 'November');
assertIbanezKnownHUVariant('HU081100181', 'U081100181', '2008', 'November');
assertIbanezMonthLetterCompactWithOTypo('Ao3oooo9', 'A0300009', '2003', 'January');
assertIbanezIndonesiaGILegacy('GI0012180', '2000', 'December');
assertIbanezChinaGP('gp05105792', '2005', 'October');
assertIbanezChinaGZ('GZ150102324', '2015', 'January');
assertIbanezFujiGenFD('FD2468031', '2024', 'July');
assertIbanezVPrefix('V054683', '2005');
assertIbanezVPrefix('vo54683', '2005');
assertIbanezMPrefix('M3013293', '2003', 'January');
assertIbanezChinaL('L160200319', '2016', 'February');
assertIbanezChinaN('N230401406', '2023', 'April');
assertIbanezWorldExtended('W0111538', '2000', 'November');
assertIbanezWorldShortWK('WK1007');
assertIbanezRPrefix('R060300616', '2006', 'March');
assertIbanezSQMonthLetter('SQ08E06597', '2008', 'May');
assertIbanezKorea7DigitC('C8016949', '1998', 'January');
assertIbanezFujiGenPost2004EightDigit('F22011214', '2022', 'February');
assertIbanezNumericOnly9Digit('220600378', '2022', 'June');
assertIbanezNumericOnly9DigitAmbiguous('311717707', '2003', 'November');
assertIbanezNumericOnly9Digit('141209632', '2014', 'December');
assertIbanezNumericOnly9Digit('02010903', '2002', 'January');
assertIbanezNumericOnly8DigitAmbiguous('40800605', '2004', 'August');
assertIbanezNumericOnly8DigitLate1900s('92120182', '1992', 'December');
assertIbanezNumericOnly7Digit('4120210', '2014', 'December');
assertIbanezNumericOnly10DigitFactoryLeading('5230401406', '2023', 'April');
assertIbanezModelCodeFallback('SR305EDX');
assertIbanezModelCodeFallbackGRG('GRG170DX');
assertIbanezKnownProductCode('0606559014521');
assertIbanezExistingSamples();
assertPRSUsaCoreSingleYearDigit('7126922');
assertPRSUsaCoreSingleYearDigit('7 126922');
assertPRSUsaCoreSingleYearDigit('7/126922');
assertBCRichIShortImport('i50311', '2005', 'March');
assertBCRichShortNumericImport('150979');
assertBCRichShortMonthCodeImport('F2051631');
assertBCRichBPrefixMonthCodeImport('BA09030385');
assertBCRichHanserEraEightDigitImport('Sr#41201627');
assertBCRichClassAxeBPrefixImport('B007132');
assertBCRichUSA5DigitOffset('36642', '1982-1983 (estimated)');
assertKramerModernS('S106020848', '2010', 'June');
assertKramerVPrefix('V9954', 'mid-to-late 1980s (estimated)');
assertKramerCFPrefix('CF22271', '1985-1989 (estimated)');
assertKramerSESamickKorea('se 8280');
assertKramerSCJapanImport('SC9117');
assertKramerVintage5Digit('70630');
assertKramerNumeric5Prefix('5062786', '1987-1991 (estimated)');
assertYamahaLetterZeroLetter('IOL033214');
assertYamahaLetterZeroLetter('I0L033214');
assertGretschFenderEraWithSuffix('CYG16080893', '2016', 'August');
assertDeanHPrefixIndia('H22020 143', '2022', 'February');
assertDeanHPrefixIndia('H22020143', '2022', 'February');
assertDeanHPrefixIndia('H22020', '2022', 'February');
assertDeanLegacyKoreaESingleYearDigit('E805978', '1998 or 2008 (estimated)');
assertDeanChinaZPrefix('z1300165', '2013');
assertCortIEPrefix('ie220403666', '2022', 'April');
assertCortAIPrefix('AI200750591', '2020', 'July');
assertCortICSEPrefix('ICSE21003319');
assertCortIATransposedPrefix('IA200750591', 'AI200750591', '2020', 'July');
assertCortYearSequence7Digit('0000400');
assertCortLate1990s8Digit('99122466');
assertCortModern8DigitYearBatch('20002219', '2020');
assertCortRPrefixYearSequence('R 0611374', 'R0611374', '2006');
assertCort1980sKorea7Digit('8808046');
assertCharvelCFPrefix('CF22271', '2022');
assertCharvelJapanIMC7Digit('0904460');
assertSquierChinaSE9Digit('040811254', '2004', 'August');
assertFenderTrailingFTypoCorrection('E528104f', 'E5281043', '1985');
assertFenderJDPrefix('JD13006111', '2013');
assertFenderICSPrefix('ICS11185000', '2011');
assertFenderInternalPartNumber('0060579747');
assertCharvelNumeric8('05050187', '2005', 'May');
assertGodinAmbiguous7Digit('4284009');
assertOvationSnPrefixedUsa('SN487892', '1994');
assertOvationKoreanImport7Digit('2121282');
assertTaylorModernShort9Digit('111130804', '2018', 'November', '30');
assertTaylorLegacy9Digit('980311301', '1998', 'March', '11');
assertTaylorLegacy9DigitYearCode('050913155', '1993', 'September', '13');
assertTaylorModernExtended11Digit('21092006138', '2016', 'September', '20');
assertJacksonMijSevenDigit1990s('9405251', '1994');
assertJacksonMijSevenPrefixSixDigit('702728');
assertJacksonMij1996Transition('600503');
assertJacksonMij1996Transition('600327');
assertJacksonUSAUSeries('U15648');
assertJacksonUSAUSeries('u17072', '2006-2007 (estimated)');
assertJacksonTaiwanJSSeries('650010694');
assertJacksonMij200C('200C00541');
assertESPVintageJapan5Digit('22944');
assertESPVintageJapan5Digit('29290');
assertSchecterCAPrefix('CA24010005');
assertSchecterRNPrefix('Rn24100948');
assertSchecterSTPrefix('ST19070042');
assertSchecterROPrefix('RO23100905');
assertSchecterHPrefix('H090501093');
assertSchecterOneWCorrectsToIW('1W17081558', 'IW17081558');
assertSchecterLegacy6Digit('527007');
assertWashburnIndonesiaYearLetter('I8C112846');
assertWashburnLegacyJapan6Digit('298093');
assertDecodeFails('ovation', '123456789');

console.log('Regression tests passed.');
