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

export function runTests() {
  assertYamahaLetterZeroLetter('IOL033214');
  assertYamahaLetterZeroLetter('I0L033214');
}
