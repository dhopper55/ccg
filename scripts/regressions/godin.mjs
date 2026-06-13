import { assert, decodeSerialForBackend } from './shared.mjs';

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

export function runTests() {
  assertGodinAmbiguous7Digit('4284009');
}
