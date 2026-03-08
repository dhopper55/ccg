import { decodeIbanez } from '../dist/decoders/ibanez.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

assertIbanezBPrefix('B160100231');
assertIbanezBPrefix('B-160100231');
assertIbanez5BPrefix('5B160100231');
assertIbanez5BPrefix('5B-160100231');
assertIbanezCompoundGS('2Y03GS241108648', '2024', 'November');
assertIbanezCompoundGS('212Y03GS251101952', '2025', 'November');
assertIbanezCompoundNumeric('215N015N250401143', '2025', 'April');
assertIbanezCompoundNumeric('1P-01 I220300400', '2022', 'March');
assertIbanez4L('4L1901087937', '2019', 'January');
assertIbanezLegacyAlphaSuffix('83030041D', '1983', 'March');
assertIbanezLegacyAlphaSuffix('8303004ID', '1983', 'March');
assertIbanezJapanMonthLetterExtended('H83020056', '1983', 'August');
assertIbanezCompactAlphaSuffix('00906B', '2000', 'September');
assertIbanezIndonesiaI('I110626774', '2011', 'June');
assertIbanezIndonesiaGILegacy('GI0012180', '2000', 'December');
assertIbanezChinaGP('gp05105792', '2005', 'October');
assertIbanezNumericOnly9Digit('220600378', '2022', 'June');
assertIbanezNumericOnly9Digit('141209632', '2014', 'December');
assertIbanezNumericOnly9Digit('02010903', '2002', 'January');
assertIbanezNumericOnly7Digit('4120210', '2014', 'December');
assertIbanezModelCodeFallback('SR305EDX');
assertIbanezExistingSamples();

console.log('Regression tests passed.');
