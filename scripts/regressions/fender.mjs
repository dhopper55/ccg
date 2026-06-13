import { assert, decodeSerialForBackend } from './shared.mjs';

function assertFenderTrailingFTypoCorrection(serialInput, expectedCorrected, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(
    result.correctedSerial === expectedCorrected,
    `Expected corrected serial ${expectedCorrected} for ${serialInput}, got ${result.correctedSerial}`
  );

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected corrected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
}

function assertFenderJDPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'Dyna Gakki / Fender Japan network',
    `Expected Dyna Gakki / Fender Japan network for ${serialInput}, got ${info.factory}`
  );
}

function assertFenderICSPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'Indonesian Factory (Cort or other)',
    `Expected Indonesian Factory (Cort or other) for ${serialInput}, got ${info.factory}`
  );
}

function assertFenderInternalPartNumber(serialInput) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);

  const info = result.info;
  assert(
    info.model === 'Internal Fender part number (not date-coded serial)',
    `Expected internal part-number model for ${serialInput}, got ${info.model}`
  );
  assert(
    info.notes && info.notes.includes('internal Fender part/product identifier'),
    `Expected internal part-number note for ${serialInput}, got ${info.notes}`
  );
}

export function runTests() {
  assertFenderTrailingFTypoCorrection('E528104f', 'E5281043', '1985');
  assertFenderJDPrefix('JD13006111', '2013');
  assertFenderICSPrefix('ICS11185000', '2011');
  assertFenderInternalPartNumber('0060579747');
}
