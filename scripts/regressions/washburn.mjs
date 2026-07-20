import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeWashburn(serialInput) {
  return decodeSerialForBackend('washburn', serialInput);
}

function assertWashburnTwoCharFactory7Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Chinese contract factory (Qingdao or Cort/Cor-Tek China facility)',
    `Expected Chinese contract factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertWashburnSuffixStripped(serialInput, expectedSuffixNote) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === '1993', `Expected year 1993 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(info.serialNumber === serialInput, `Expected original serial preserved for ${serialInput}, got ${info.serialNumber}`);
  assert(
    info.notes && info.notes.includes(expectedSuffixNote),
    `Expected suffix note "${expectedSuffixNote}" for ${serialInput}, got ${info.notes}`
  );
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

function assertWashburnNumeric8Vintage1960s(serialInput, expectedYear) {
  const result = decodeSerialForBackend('washburn', serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.brand === 'Washburn', `Expected Washburn brand for ${serialInput}, got ${info.brand}`);
}

function assertWashburnBCChina(serialInput, expectedYear) {
  const result = decodeSerialForBackend('washburn', serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'China factory (BC series)', `Expected BC China factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-bc-china-plant-yy-sequence',
    `Expected BC China pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertWashburnCOVariantFactory(serialInput, expectedPrefix, expectedYear, expectedSequence) {
  const result = decodeWashburn(serialInput);
  assert(result.success, `Expected decode success for Washburn ${serialInput}`);
  assert(result.info, `Expected decoded info for Washburn ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Chinese contract factory (CO/OC overseas facility, Qingdao or Cort China)',
    `Expected CO-variant factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'washburn-co-variant-factory-y-sequence',
    `Expected CO-variant pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`production sequence (unit ${expectedSequence})`),
    `Expected production sequence ${expectedSequence} in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertWashburnTwoCharFactory7Digit('0c0810230', '2008', 'October');
  assertWashburnSuffixStripped('93050751-S', 'Solid Top');
  assertWashburnSuffixStripped('93050751-S.E', 'Solid Top');
  assertWashburnSuffixStripped('93050751-S.E', 'Electric');
  assertWashburnIndonesiaYearLetter('I8C112846');
  assertWashburnLegacyJapan6Digit('298093');
  assertWashburn1990s10DigitYYMM('9212000236');
  assertWashburnNumeric8Vintage1960s('66810111', '1966');
  assertWashburnBCChina('BC6061796', '2006');
  assertWashburnCOVariantFactory('CO7052236', 'CO', '2007', 52236);
  assertWashburnCOVariantFactory('O7052236', 'O', '2007', 52236);
  assertWashburnCOVariantFactory('OCO7052236', 'OCO', '2007', 52236);
  assertWashburnNFactoryYYMM('NO6050166', '2006', 'May');
}

function assertWashburnNFactoryYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('washburn', serialInput);
  assert(result.success, `Expected decode success for washburn:${serialInput}`);
  assert(result.info, `Expected decoded info for washburn:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.patternKey === 'washburn-n-factory-yymm-sequence',
    `Expected N-factory patternKey for ${serialInput}, got ${result.patternKey}`
  );
}
