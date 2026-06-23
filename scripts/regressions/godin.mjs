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
  assertGodin8DigitPre2000('98196441', '1997');
  assertGodin13Digit('0319860009106');
}

function assertGodin13Digit(serialInput) {
  const result = decodeSerialForBackend('godin', serialInput);
  assert(result.success, `Expected decode success for godin:${serialInput}`);
  assert(result.info, `Expected decoded info for godin:${serialInput}`);
  assert(result.info.country === 'Canada (or USA assembly)', `Expected Canada for ${serialInput}, got ${result.info.country}`);
  assert(
    result.info.year && result.info.year.includes('13-digit'),
    `Expected 13-digit year label for ${serialInput}, got ${result.info.year}`
  );
  assert(
    result.patternKey === 'godin-sku-quality-sequence-13-digit',
    `Expected 13-digit patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertGodin8DigitPre2000(serialInput, expectedYear) {
  const result = decodeSerialForBackend('godin', serialInput);
  assert(result.success, `Expected decode success for godin:${serialInput}`);
  assert(result.info, `Expected decoded info for godin:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Canada', `Expected Canada for ${serialInput}, got ${result.info.country}`);
  assert(!result.info.year.includes(' or '), `Expected unambiguous year for ${serialInput}, got ${result.info.year}`);
}
