import { assert, decodeSerialForBackend } from './shared.mjs';

function assertAlvarezTwoLetterPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('alvarez', serialInput);
  assert(result.success, `Expected decode success for alvarez:${serialInput}`);
  assert(result.info, `Expected decoded info for alvarez:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country !== undefined, `Expected country for ${serialInput}`);
}

function assertAlvarezSingleLetterTenDigit(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('alvarez', serialInput);
  assert(result.success, `Expected decode success for alvarez:${serialInput}`);
  assert(result.info, `Expected decoded info for alvarez:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
}

export function runTests() {
  // CC05046845: CC prefix + 8-digit suffix (2005, April)
  assertAlvarezTwoLetterPrefix('CC05046845', '2005', 'April');
  // F1005031124: single-letter prefix + 10 digits (2010, May)
  assertAlvarezSingleLetterTenDigit('F1005031124', '2010', 'May');
}
