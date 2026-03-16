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

function decodeCharvel(serialInput) {
  return decodeSerialForBackend('charvel', serialInput);
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
assertIbanezNumericOnly9Digit('220600378', '2022', 'June');
assertIbanezNumericOnly9DigitAmbiguous('311717707', '2003', 'November');
assertIbanezNumericOnly9Digit('141209632', '2014', 'December');
assertIbanezNumericOnly9Digit('02010903', '2002', 'January');
assertIbanezNumericOnly8DigitAmbiguous('40800605', '2004', 'August');
assertIbanezNumericOnly7Digit('4120210', '2014', 'December');
assertIbanezNumericOnly10DigitFactoryLeading('5230401406', '2023', 'April');
assertIbanezModelCodeFallback('SR305EDX');
assertIbanezModelCodeFallbackGRG('GRG170DX');
assertIbanezExistingSamples();
assertBCRichIShortImport('i50311', '2005', 'March');
assertBCRichUSA5DigitOffset('36642', '1982-1983 (estimated)');
assertKramerModernS('S106020848', '2010', 'June');
assertKramerVPrefix('V9954', 'mid-to-late 1980s (estimated)');
assertKramerCFPrefix('CF22271', '1985-1989 (estimated)');
assertKramerNumeric5Prefix('5062786', '1987-1991 (estimated)');
assertYamahaLetterZeroLetter('IOL033214');
assertYamahaLetterZeroLetter('I0L033214');
assertGretschFenderEraWithSuffix('CYG16080893', '2016', 'August');
assertDeanHPrefixIndia('H22020 143', '2022', 'February');
assertDeanHPrefixIndia('H22020143', '2022', 'February');
assertDeanHPrefixIndia('H22020', '2022', 'February');
assertCortIEPrefix('ie220403666', '2022', 'April');
assertCharvelCFPrefix('CF22271', '2022');
assertFenderTrailingFTypoCorrection('E528104f', 'E5281043', '1985');
assertFenderJDPrefix('JD13006111', '2013');
assertFenderICSPrefix('ICS11185000', '2011');
assertFenderInternalPartNumber('0060579747');
assertCharvelNumeric8('05050187', '2005', 'May');
assertGodinAmbiguous7Digit('4284009');
assertDecodeFails('ovation', '123456789');

console.log('Regression tests passed.');
