import { assert, decodeSerialForBackend } from './shared.mjs';

function assertGretschFenderEraWithSuffix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('gretsch', serialInput);
  assert(result.success, `Expected decode success for gretsch:${serialInput}`);
  assert(result.info, `Expected decoded info for gretsch:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Yako Facility', `Expected Yako Facility for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Additional prefix letter "G"'),
    `Expected suffix-letter note for ${serialInput}, got ${info.notes}`
  );
}

function assertGretschIndonesiaSamickIS(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('gretsch', serialInput);
  assert(result.success, `Expected decode success for gretsch:${serialInput}`);
  assert(result.info, `Expected decoded info for gretsch:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.factory === 'Samick Factory', `Expected Samick Factory for ${serialInput}, got ${result.info.factory}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'gretsch-indonesia-samick-is-yymm-sequence',
    `Expected Gretsch IS patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertGretschFenderEraWithSuffix('CYG16080893', '2016', 'August');
  assertGretschIndonesiaSamickIS('IS181000573', '2018', 'October');
}
