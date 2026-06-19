import { assert, assertDecodeFails, decodeSerialForBackend } from './shared.mjs';

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

export function runTests() {
  assertOvationSnPrefixedUsa('SN487892', '1994');
  assertOvationKoreanImport7Digit('2121282');
  assertDecodeFails('ovation', '123456789');
  assertOvationImport8DigitYYMM('14100207', '2014', 'October');
}

function assertOvationImport8DigitYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('ovation', serialInput);
  assert(result.success, `Expected decode success for ovation:${serialInput}`);
  assert(result.info, `Expected decoded info for ovation:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
}
