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
  assertEpiphoneMIRC311('311619011');
  assertEpiphonePeerlessLMisread('R94l158', '1994', 'November', 'Peerless');
  assertEpiphoneKalamazoo6Digit('810386', '1966 or 1969 (Kalamazoo estimate)');
  assertEpiphone8DigitNumericImport('60010859', '1996', 'January');
}

function assertEpiphone8DigitNumericImport(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('epiphone', serialInput);
  assert(result.success, `Expected decode success for epiphone:${serialInput}`);
  assert(result.info, `Expected decoded info for epiphone:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.patternKey === 'epiphone-8digit-numeric-import-y-mm-sequence',
    `Expected 8-digit numeric import patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertEpiphoneKalamazoo6Digit(serialInput, expectedYear) {
  const result = decodeSerialForBackend('epiphone', serialInput);
  assert(result.success, `Expected decode success for epiphone:${serialInput}`);
  assert(result.info, `Expected decoded info for epiphone:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.factory === 'Gibson Kalamazoo plant, Kalamazoo, Michigan', `Expected Kalamazoo factory for ${serialInput}, got ${result.info.factory}`);
  assert(result.info.country === 'USA', `Expected USA for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'epiphone-kalamazoo-usa-6digit-1960s',
    `Expected Kalamazoo patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertEpiphonePeerlessLMisread(serialInput, expectedYear, expectedMonth, expectedFactoryPartial) {
  const result = decodeSerialForBackend('epiphone', serialInput);
  assert(result.success, `Expected decode success for epiphone:${serialInput}`);
  assert(result.info, `Expected decoded info for epiphone:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.factory && result.info.factory.includes(expectedFactoryPartial), `Expected factory containing "${expectedFactoryPartial}" for ${serialInput}, got ${result.info.factory}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
}

function assertEpiphoneMIRC311(serialInput) {
  const result = decodeSerialForBackend('epiphone', serialInput);
  assert(result.success, `Expected decode success for epiphone:${serialInput}`);
  assert(result.info, `Expected decoded info for epiphone:${serialInput}`);
  assert(result.info.country === 'USA', `Expected USA for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'epiphone-mirc-311-refurb', `Expected MIRC pattern key for ${serialInput}, got ${result.patternKey}`);
}
