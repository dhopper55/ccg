import { assert, decodeSerialForBackend } from './shared.mjs';

function assertSisterFallback(selectedBrand, serialInput, expectedBrand, expectedYear) {
  const result = decodeSerialForBackend(selectedBrand, serialInput);
  assert(result.success, `Expected ${selectedBrand} -> ${expectedBrand} fallback success for ${serialInput}`);
  assert(result.info?.brand === expectedBrand, `Expected brand ${expectedBrand} for ${serialInput}, got ${result.info?.brand}`);
  assert(result.info?.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info?.year}`);
  assert(
    result.info?.notes?.startsWith(`This serial number does not match a ${selectedBrand === 'fender' ? 'Fender' : 'Gibson'} format`),
    `Expected sister-brand note for ${serialInput}, got ${result.info?.notes}`
  );
  assert(result.normalizedBrand === selectedBrand, `Expected normalizedBrand ${selectedBrand} for ${serialInput}, got ${result.normalizedBrand}`);
}

function assertNoSisterFallback(selectedBrand, serialInput) {
  const result = decodeSerialForBackend(selectedBrand, serialInput);
  assert(!result.success, `Expected no sister-brand fallback for ${selectedBrand}:${serialInput}, got ${result.info?.brand} ${result.info?.year}`);
}

export function runTests() {
  // Squier serials entered on the Fender decoder (real failed lookups).
  assertSisterFallback('fender', 'CY170402359', 'Squier', '2017');
  assertSisterFallback('fender', 'CY00047452', 'Squier', '2000');
  assertSisterFallback('fender', 'ISSD26000401', 'Squier', '2026');
  assertSisterFallback('fender', 'CSSF21020080', 'Squier', '2021');
  assertSisterFallback('fender', 'CYKF25004201', 'Squier', '2025');

  // Epiphone serials entered on the Gibson decoder (real failed lookups).
  assertSisterFallback('gibson', '25091524144', 'Epiphone', '2025');
  assertSisterFallback('gibson', 'S8539 26', 'Epiphone', '2008');
  assertSisterFallback('gibson', 's07070037', 'Epiphone', '2007');

  // Fender serials still decode as Fender, untouched by the fallback.
  const fenderResult = decodeSerialForBackend('fender', 'US17302681');
  assert(!fenderResult.success || fenderResult.info?.brand === 'Fender', 'Expected Fender serial to stay Fender');

  // Sister results without a real year are not shown.
  assertNoSisterFallback('fender', '123456789');
  assertNoSisterFallback('gibson', 's2017012');

  // Gibson-shaped serials Epiphone's numeric/A-prefix rules would otherwise claim.
  assertNoSisterFallback('gibson', '71011358');
  assertNoSisterFallback('gibson', '9099898');
  assertNoSisterFallback('gibson', 'A05550');

  // Epiphone matches with no identified factory are too loose to show on the Gibson decoder.
  assertNoSisterFallback('gibson', 'w410309');
  assertNoSisterFallback('gibson', 'K00111108');

  // Brands without a sister mapping are unaffected.
  assertNoSisterFallback('squier', 'not-a-serial');

  // The fallback can be disabled (the Worker does so to try V2 patterns in order).
  const disabled = decodeSerialForBackend('fender', 'CY170402359', { sisterFallback: false });
  assert(!disabled.success, 'Expected no fallback when sisterFallback is false');
}
