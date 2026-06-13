import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeCharvel(serialInput) {
  return decodeSerialForBackend('charvel', serialInput);
}

function assertCharvelJapanYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('charvel', serialInput);
  assert(result.success, `Expected decode success for charvel:${serialInput}`);
  assert(result.info, `Expected decoded info for charvel:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Chushin Gakki (Nagano Prefecture)', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'charvel-japan-yymm-4-digit',
    `Expected charvel-japan-yymm-4-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Fort Worth, Texas neck plate'),
    `Expected YYMM rich text for ${serialInput}`
  );
}

function assertCharvelCFPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('charvel', serialInput);
  assert(result.success, `Expected decode success for charvel:${serialInput}`);
  assert(result.info, `Expected decoded info for charvel:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'World Music Instruments (WMI)',
    `Expected WMI factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
}

function assertCharvelJapanIMC7Digit(serialInput) {
  const result = decodeSerialForBackend('charvel', serialInput);
  assert(result.success, `Expected decode success for charvel:${serialInput}`);
  assert(result.info, `Expected decoded info for charvel:${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'mid-to-late 1980s or early 1990s (estimated)',
    `Expected MIJ era estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Chushin Gakki / IMC-era Japanese import production',
    `Expected Chushin/IMC-era production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'charvel-japan-imc-7-digit-neck-plate',
    `Expected Charvel 7-digit MIJ pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCharvelNumeric8(serialInput, expectedYear, expectedMonth) {
  const result = decodeCharvel(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown (8-digit numeric format)',
    `Expected 8-digit numeric factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertCharvelUCChina(serialInput, expectedYear) {
  const result = decodeSerialForBackend('charvel', serialInput);
  assert(result.success, `Expected decode success for charvel:${serialInput}`);
  assert(result.info, `Expected decoded info for charvel:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'China (UC-prefix import facility)',
    `Expected China UC-prefix factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'charvel-uc-china-yy-sequence',
    `Expected charvel-uc-china-yy-sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertCharvelJapanYYMM('8911', '1989', 'November');
  assertCharvelJapanYYMM('8706', '1987', 'June');
  assertCharvelCFPrefix('CF22271', '2022');
  assertCharvelJapanIMC7Digit('0904460');
  assertCharvelUCChina('UC210191', '2021');
  assertCharvelNumeric8('05050187', '2005', 'May');
}
