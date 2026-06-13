import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeWashburn(serialInput) {
  return decodeSerialForBackend('washburn', serialInput);
}

function assertWashburnIndonesiaYearLetter(serialInput) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === '1998 or 2008', `Expected ambiguous 1998 or 2008 year for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Indonesia (Samick or PT Cort facility)',
    `Expected Indonesian Washburn factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-indonesia-i-year-letter-sequence',
    `Expected Washburn Indonesian pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 112846'),
    `Expected Washburn Indonesian rich text for ${serialInput}`
  );
}

function assertWashburnLegacyJapan6Digit(serialInput) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1970s-early 1980s (estimated)',
    `Expected legacy Washburn era guidance for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Japan (often Yamaki or another Japanese partner)',
    `Expected Japan legacy Washburn factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-legacy-japan-6-digit',
    `Expected Washburn legacy Japan pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`Serial ${serialInput} is best treated as a late-1970s to early-1980s Washburn sequence`),
    `Expected Washburn legacy Japan rich text for ${serialInput}`
  );
}

function assertWashburn1990s10DigitYYMM(serialInput) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === '1992', `Expected 1992 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'December', `Expected December for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Washburn import tracking format; likely South Korea unless USA/custom-shop markings indicate otherwise',
    `Expected Washburn 1990s tracking factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea or USA', `Expected South Korea or USA for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-1990s-10-digit-yymm-sequence',
    `Expected Washburn 1990s 10-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('tracking sequence 000236'),
    `Expected Washburn 1990s 10-digit rich text for ${serialInput}`
  );
}

export function runTests() {
  assertWashburnIndonesiaYearLetter('I8C112846');
  assertWashburnLegacyJapan6Digit('298093');
  assertWashburn1990s10DigitYYMM('9212000236');
}
