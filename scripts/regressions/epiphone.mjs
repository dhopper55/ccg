import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeEpiphone(serialInput) {
  return decodeSerialForBackend('epiphone', serialInput);
}

function assertEpiphoneKoreaSingleLetter(serialInput, expectedYear, expectedMonth, expectedFactory, expectedSequence) {
  const result = decodeEpiphone(serialInput);
  assert(result.success, `Expected decode success for Epiphone ${serialInput}`);
  assert(result.info, `Expected decoded info for Epiphone ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === expectedFactory, `Expected factory ${expectedFactory} for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`Production sequence: ${expectedSequence}`),
    `Expected production sequence ${expectedSequence} for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'epiphone-korea-single-letter-factory-yymm-sequence',
    `Expected Epiphone Korean single-letter pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('The prefix U indicates Unsung'),
    `Expected Epiphone Korean rich text for ${serialInput}`
  );
}

function assertEpiphone1990sNumeric(serialInput, expectedYear, expectedMonth, expectedSequence) {
  const result = decodeEpiphone(serialInput);
  assert(result.success, `Expected decode success for Epiphone ${serialInput}`);
  assert(result.info, `Expected decoded info for Epiphone ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown Korean or Japanese contract factory',
    `Expected unknown Korean/Japanese contract factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea or Japan', `Expected South Korea or Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`production sequence ${expectedSequence}`),
    `Expected production sequence ${expectedSequence} for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'epiphone-1990s-numeric-y-mm-sequence',
    `Expected Epiphone 1990s numeric pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertEpiphoneKoreaSingleLetter('U97040128', '1997', 'April', 'Unsung', 128);
  assertEpiphoneKoreaSingleLetter('U97040228', '1997', 'April', 'Unsung', 228);
  assertEpiphone1990sNumeric('6043399', '1996', 'April', 3399);
}
