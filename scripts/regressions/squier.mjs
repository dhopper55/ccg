import { assert, decodeSerialForBackend } from './shared.mjs';

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

function assertSquierChinaSE8Digit2004(serialInput, expectedMonth) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === '2004', `Expected year 2004 for ${serialInput}, got ${info.year}`);
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
    result.patternKey === 'squier-china-se-2004-8-digit-yymm-sequence',
    `Expected Squier SE 2004 8-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierChinaCPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Yako / Chinese Squier production',
    `Expected Yako / Chinese Squier production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'squier-china-c-prefix-yy-sequence',
    `Expected Squier China C-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierIndonesiaICSYear(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Cor-Tek (Cort)', `Expected Cor-Tek (Cort) for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'squier-indonesia-ics-yy-sequence',
    `Expected Squier ICS YY pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierNumericOnly8DigitRejected(serialInput) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(!result.success, `Expected decode failure for squier:${serialInput}`);
  assert(
    result.error?.includes('Eight-digit numeric-only Squier serials are not a standard supported pattern'),
    `Expected Squier 8-digit numeric-only rejection for ${serialInput}, got ${result.error}`
  );
}

function assertSquierChinaCRN(serialInput) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for Squier ${serialInput}`);
  assert(result.info, `Expected decoded info for Squier ${serialInput}`);

  const info = result.info;
  assert(info.year === '2026', `Expected year 2026 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China RN contracted facility',
    `Expected China RN factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'squier-china-crn-month-letter-yy-sequence',
    `Expected CRN pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 7293'),
    `Expected production sequence 7293 in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertSquierChinaSE9Digit('040811254', '2004', 'August');
  assertSquierChinaSE8Digit2004('04090431', 'September');
  assertSquierChinaCPrefix('c004039', '2000');
  assertSquierIndonesiaICSYear('ICS18291833', '2018');
  assertSquierNumericOnly8DigitRejected('05021913');
  assertSquierChinaCRN('crna26007293');
}
