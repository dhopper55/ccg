import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeGibson(serialInput) {
  return decodeSerialForBackend('gibson', serialInput);
}

function assertGibsonModernCustomShop(serialInput, expectedYear) {
  const result = decodeGibson(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Gibson Custom Shop, Nashville, Tennessee',
    `Expected Gibson Custom Shop factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes?.includes('CS indicates Custom Shop'),
    `Expected Custom Shop notes for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'gibson-modern-custom-shop-cs-prefix',
    `Expected Gibson Custom Shop pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertGibsonYear(serialInput, expectedYear, expectedPatternKey) {
  const result = decodeGibson(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info?.brand === 'Gibson', `Expected Gibson brand for ${serialInput}, got ${result.info?.brand}`);
  assert(result.info?.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info?.year}`);
  assert(result.patternKey === expectedPatternKey, `Expected pattern ${expectedPatternKey} for ${serialInput}, got ${result.patternKey}`);
}

export function runTests() {
  // 1947-1961 A-series, dated from the year-end number chart.
  assertGibsonYear('A100', '1947', 'gibson-vintage-a-series');
  assertGibsonYear('A5550', '1950', 'gibson-vintage-a-series');
  assertGibsonYear('A-12460', '1952', 'gibson-vintage-a-series');
  assertGibsonYear('A12461', '1953', 'gibson-vintage-a-series');
  assertGibsonYear('A36147', '1961', 'gibson-vintage-a-series');
  // Above the last A-series number, or zero-padded (never used on vintage labels).
  assert(!decodeGibson('A36148').success, 'Expected A36148 to fail');
  assert(!decodeGibson('A05550').success, 'Expected A05550 to fail');

  // 1973-1975 stamped letter + 6 digits (real failed lookups).
  assertGibsonYear('a345328', '1973-1975', 'gibson-1970s-letter-six-digit');
  assertGibsonYear('D344001', '1974-1975', 'gibson-1970s-letter-six-digit');

  // 1975-1977 decal prefixes and 1994 Centennial.
  assertGibsonYear('99123456', '1975', 'gibson-1975-1977-decal-prefix');
  assertGibsonYear('06010562', '1977', 'gibson-1975-1977-decal-prefix');
  assertGibsonYear('94012345', '1994', 'gibson-1994-centennial-94-prefix');
  // 00 + 6 digits stays on YDDDYRRR (2000-2005), since that reading is valid.
  assert(decodeGibson('00123456').info?.year === '2003', 'Expected 00123456 to stay a 2003 YDDDYRRR serial');

  assertGibsonModernCustomShop('CS403228', '2004 or 2014 (context-dependent Custom Shop estimate)');
  assertGibsonModernCustomShop('CS 403228', '2004 or 2014 (context-dependent Custom Shop estimate)');
  assertGibsonModernCustomShop('CS40322', '2004 or 2014 (context-dependent Custom Shop estimate)');
}
