import { assert, decodeSerialForBackend } from './shared.mjs';

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

function assertYamahaCustomShop1991FourDigitUnit(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('yamaha', serialInput);
  assert(result.success, `Expected decode success for yamaha:${serialInput}`);
  assert(result.info, `Expected decoded info for yamaha:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.info.factory === 'Yamaha Custom Shop',
    `Expected Yamaha Custom Shop factory for ${serialInput}, got ${result.info.factory}`
  );
}

export function runTests() {
  assertYamahaLetterZeroLetter('IOL033214');
  assertYamahaLetterZeroLetter('I0L033214');
  assertYamahaThreeLetterYearExtended('HNI1244732', '2017', 'February');
  assertYamahaCustomShop1991FourDigitUnit('HP2 070 E', '1991', 'September');
}

function assertYamahaThreeLetterYearExtended(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('yamaha', serialInput);
  assert(result.success, `Expected decode success for yamaha:${serialInput}`);
  assert(result.info, `Expected decoded info for yamaha:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.patternKey === 'yamaha-three-letter-year-month-7digit',
    `Expected 3-letter year extended patternKey for ${serialInput}, got ${result.patternKey}`
  );
}
