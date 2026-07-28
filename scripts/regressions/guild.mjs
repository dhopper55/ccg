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

function assertGuildKoreaSPGKSG(serialInput, expectedYear, expectedSequence, expectedSuffixNote) {
  const result = decodeGuild(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(
    result.info.factory === 'SPG (Sound Professional Guitar Co., Ltd.), Korea',
    `Expected SPG Korea factory for ${serialInput}, got ${result.info.factory}`
  );
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
  assert(
    result.info.notes && result.info.notes.includes(`unit ${expectedSequence}`),
    `Expected sequence unit ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  if (expectedSuffixNote) {
    assert(
      result.info.notes.includes(expectedSuffixNote),
      `Expected suffix note "${expectedSuffixNote}" for ${serialInput}, got ${result.info.notes}`
    );
  }
  assert(
    result.patternKey === 'guild-korea-spg-ksg-yy-sequence',
    `Expected Guild KSG patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertGuildIndonesiaSamickISG(serialInput, expectedYear, expectedMonth) {
  const result = decodeGuild(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.info.factory === 'P.T. Samick, Indonesia',
    `Expected P.T. Samick, Indonesia for ${serialInput}, got ${result.info.factory}`
  );
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'guild-indonesia-samick-isg-yymm-sequence',
    `Expected Guild ISG patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertGuildGADNeckBlock('1102290034', '2011', 'February');
  assertGuildKoreaSPGKSG('KSG1704056', '2017', 4056, undefined);
  assertGuildKoreaSPGKSG('KSG170405L', '2017', 405, 'left-handed');
  assertGuildIndonesiaSamickISG('isg220854850', '2022', 'August');
  assertGuildIndonesiaSamickISG('isg230550388', '2023', 'May');
  assertGuildKoreaWMIKWM('KWM1601676', '2016', 1676);
}

function assertGuildKoreaWMIKWM(serialInput, expectedYear, expectedSequence) {
  const result = decodeGuild(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(
    result.info.factory === 'World Musical Instrument Co., Ltd. (WMI), Incheon, Korea',
    `Expected WMI Incheon factory for ${serialInput}, got ${result.info.factory}`
  );
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
  assert(
    result.info.notes && result.info.notes.includes(`unit ${expectedSequence}`),
    `Expected sequence unit ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'guild-korea-wmi-kwm-yy-sequence',
    `Expected KWM patternKey for ${serialInput}, got ${result.patternKey}`
  );
}
