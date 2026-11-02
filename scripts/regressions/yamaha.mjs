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

  // Taiwan neck-block "T" + 7-digit sequential (1971-1973), real serials from the failed-lookup backlog.
  assertYamahaTaiwanNeckBlockT('t0021773', '1971-1972');
  assertYamahaTaiwanNeckBlockT('T0103373', '1971-1972');
  assertYamahaTaiwanNeckBlockT('t0128477', '1971-1972');
  assertYamahaTaiwanNeckBlockT('T0199649', '1972');
  assertYamahaTaiwanNeckBlockT('T0254626', '1972-1973');
  assertYamahaTaiwanNeckBlockT('T0304925', '1972-1973');
  // Lookalikes outside the documented T range, or with a different leading letter, still fail.
  assertYamahaFails('T0504925');
  assertYamahaFails('T1103373');
  assertYamahaFails('i0128477');
  assertYamahaFails('B0310276');
}

function assertYamahaFails(serialInput) {
  const result = decodeSerialForBackend('yamaha', serialInput);
  assert(!result.success, `Expected decode failure for yamaha:${serialInput}, got year ${result.info?.year}`);
}

function assertYamahaTaiwanNeckBlockT(serialInput, expectedYear) {
  const result = decodeSerialForBackend('yamaha', serialInput);
  assert(result.success, `Expected decode success for yamaha:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Taiwan', `Expected Taiwan for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'yamaha-taiwan-neck-block-t-7digit',
    `Expected Taiwan T neck-block patternKey for ${serialInput}, got ${result.patternKey}`
  );
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
