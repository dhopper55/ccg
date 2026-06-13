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

export function runTests() {
  assertGibsonModernCustomShop('CS403228', '2004 or 2014 (context-dependent Custom Shop estimate)');
  assertGibsonModernCustomShop('CS 403228', '2004 or 2014 (context-dependent Custom Shop estimate)');
  assertGibsonModernCustomShop('CS40322', '2004 or 2014 (context-dependent Custom Shop estimate)');
}
