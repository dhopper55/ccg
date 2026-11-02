import { assert, decodeSerialForBackend } from './shared.mjs';

function assertErnieBallStingRayC(serialInput) {
  const result = decodeSerialForBackend('ernieball', serialInput);
  assert(result.success, `Expected decode success for ernieball:${serialInput}`);
  assert(result.info, `Expected decoded info for ernieball:${serialInput}`);
  assert(result.info.model === 'StingRay (bass)', `Expected StingRay model for ${serialInput}, got ${result.info.model}`);
  assert(
    result.patternKey === 'ernieball-stingray-c-prefix-2017',
    `Expected StingRay C-prefix patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertErnieBallStingRayC('C01418');
  assertErnieBallStingRayC('c30118');
  assertNoDecode('ernieball', 'C002820');
  assertNoDecode('ernieball', 'C0141');
  assertNoDecode('ernieball', 'K09130');
}

function assertNoDecode(brand, serialInput) {
  const result = decodeSerialForBackend(brand, serialInput);
  assert(!result.success, `Expected decode failure for ${brand}:${serialInput}`);
}
