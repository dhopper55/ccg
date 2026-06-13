import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeGuild(serialInput) {
  return decodeSerialForBackend('guild', serialInput);
}

function assertGuildGADNeckBlock(serialInput, expectedYear, expectedMonth) {
  const result = decodeGuild(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Guild GAD Chinese import production',
    `Expected Guild GAD Chinese import production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(info.model === 'GAD Series acoustic', `Expected GAD Series acoustic for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'guild-gad-10-digit-neck-block-yymm-batch-unit',
    `Expected Guild GAD neck-block pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertGuildGADNeckBlock('1102290034', '2011', 'February');
}
