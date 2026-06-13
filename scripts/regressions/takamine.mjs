import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeTakamine(serialInput) {
  return decodeSerialForBackend('takamine', serialInput);
}

function assertTakamine8DigitYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeTakamine(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

export function runTests() {
  assertTakamine8DigitYYMM('93041401', '1993', 'April');
}
