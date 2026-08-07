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
  assertFenderCortChinaCC('CC210709447', '2021');
  assertFenderEVHWolfgang('WG188218M', '2018', 'Mexico');
  assertFenderEVHWolfgang('WG110049J', '2011', 'Japan');
  assertFenderICSMonthLetter('Icsc22001163', '2022', 'March');
  assertFenderTPrefixAmbiguousEra('T011165');
  assertFenderICFPrefix('ICF21004892', '2021');
  assertFenderDNPrefix('DN808159', '1998');
  assertFenderSZPrefix('Sz3186640', '2003');
}

function assertFenderDNPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.model === 'American Deluxe Series', `Expected American Deluxe Series for ${serialInput}, got ${result.info.model}`);
}

function assertFenderSZPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.model === 'Signature Series', `Expected Signature Series for ${serialInput}, got ${result.info.model}`);
}

function assertFenderICFPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'fender-icf-indonesia-cortek-yy-sequence',
    `Expected ICF patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertFenderICSMonthLetter(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(result.info.model === 'Squier', `Expected Squier model for ${serialInput}, got ${result.info.model}`);
  assert(
    result.patternKey === 'fender-squier-ics-indonesia-month-letter-yy-sequence',
    `Expected ICS month-letter patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertFenderTPrefixAmbiguousEra(serialInput) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(
    result.info.year && result.info.year.includes('1994-1995') && result.info.year.includes('2007-2008'),
    `Expected ambiguous 1994-1995/2007-2008 era for ${serialInput}, got ${result.info.year}`
  );
  assert(result.info.country === 'Japan', `Expected Japan for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'fender-japan-t-prefix-6digit-ambiguous-era',
    `Expected T-prefix patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertFenderEVHWolfgang(serialInput, expectedYear, expectedCountry) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === expectedCountry, `Expected country ${expectedCountry} for ${serialInput}, got ${result.info.country}`);
  assert(result.info.model === 'EVH Wolfgang', `Expected EVH Wolfgang model for ${serialInput}, got ${result.info.model}`);
  assert(
    result.patternKey === 'fender-evh-wolfgang-wg-yy-sequence-country',
    `Expected EVH Wolfgang patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertFenderCortChinaCC(serialInput, expectedYear) {
  const result = decodeSerialForBackend('fender', serialInput);
  assert(result.success, `Expected decode success for fender:${serialInput}`);
  assert(result.info, `Expected decoded info for fender:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'China', `Expected China for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'fender-cc-cort-china-yy-sequence',
    `Expected CC Cort China patternKey for ${serialInput}, got ${result.patternKey}`
  );
}
