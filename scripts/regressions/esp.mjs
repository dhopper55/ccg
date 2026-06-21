import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeESP(serialInput) {
  return decodeSerialForBackend('esp', serialInput);
}

function assertESPVintageJapan5Digit(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1980s to early 1990s (estimated)',
    `Expected late 1980s to early 1990s estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'ESP Japan (Sado or Takada factory likely)',
    `Expected ESP Japan factory estimate for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Traditional / 400 Series or early Custom Shop',
    `Expected vintage ESP model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'esp-vintage-japan-5-digit',
    `Expected ESP vintage Japan 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`sequence ${parseInt(serialInput, 10)}`),
    `Expected ESP vintage Japan rich text for ${serialInput}`
  );
}

function assertESPEdwardsEDPrefix(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === '2009', `Expected 2009 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Edwards / ESP Japan domestic-market production',
    `Expected Edwards / ESP Japan production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Edwards by ESP', `Expected Edwards by ESP model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'esp-edwards-ed-yy-sequence',
    `Expected ESP Edwards ED pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production week'),
    `Expected ESP Edwards ED rich text for ${serialInput}`
  );
}

function assertESPEdwardsEDPrefix2021(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === '2021', `Expected 2021 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Edwards / ESP Japan domestic-market production',
    `Expected Edwards / ESP Japan production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Edwards by ESP', `Expected Edwards by ESP model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'esp-edwards-ed-yy-sequence',
    `Expected ESP Edwards ED pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production week'),
    `Expected ESP Edwards ED rich text for ${serialInput}`
  );
}

function assertESPAmbiguousEPrefix6Digit(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(
    info.year === '2014 or 2000 (context-dependent ESP/E-II vs LTD estimate)',
    `Expected ambiguous E-II/LTD year for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'ESP Japan E-II production or Saehan/Sunghak Korea LTD production',
    `Expected ambiguous E-II/LTD factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan / South Korea', `Expected Japan/Korea country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'ESP-owned E-prefix instrument',
    `Expected ESP-owned E-prefix model for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'esp-ambiguous-e-prefix-6-digit-eii-ltd',
    `Expected ESP ambiguous E-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('35054 is the production sequence'),
    `Expected ESP ambiguous E-prefix rich text for ${serialInput}`
  );
}

function assertESPLTDKoreaWMI9Digit(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === '2012', `Expected 2012 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected January for week 00 ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Musical Instruments, South Korea',
    `Expected WMI South Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'esp-ltd-korea-wmi-w-yy-week-sequence',
    `Expected ESP LTD WMI 9-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('tracking sequence 61141'),
    `Expected ESP LTD WMI rich text for ${serialInput}`
  );
}

function assertESPJapanKisoFactory(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === '2012', `Expected 2012 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Kiso Factory, Japan',
    `Expected Kiso Factory, Japan for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Week 21') && info.notes.includes('Production #303'),
    `Expected week 21 and production #303 for ${serialInput}, got ${info.notes}`
  );
}

function assertESPAmbiguous6DigitAllNumeric(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(
    info.factory === 'ESP Japan Original/Custom Shop / Korean LTD import factory (context-dependent)',
    `Expected ambiguous factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan / South Korea', `Expected Japan / South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'esp-ambiguous-6-digit-all-numeric',
    `Expected ESP ambiguous 6-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('2002'),
    `Expected ESP ambiguous 6-digit rich text with year reference for ${serialInput}`
  );
}

function assertESPLTDEarlyKoreaUSequential(serialInput) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === '2000-2001 (estimated)', `Expected 2000-2001 estimate for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Unsung, South Korea', `Expected Unsung South Korea for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(info.model === 'LTD', `Expected LTD model guidance for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'esp-ltd-early-korea-u-sequential',
    `Expected ESP LTD early Korea U pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertESPLTDIndonesiaSamickIS(serialInput, expectedYear, expectedMonth) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Samick, Indonesia', `Expected Samick Indonesia for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${info.country}`);
  assert(info.model === 'LTD', `Expected LTD model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'esp-ltd-indonesia-is-samick-yymm-sequence',
    `Expected IS Samick pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertESPLTDNumeric9Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeESP(serialInput);
  assert(result.success, `Expected decode success for ESP ${serialInput}`);
  assert(result.info, `Expected decoded info for ESP ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'ESP LTD partner factory (Korea or Indonesia)',
    `Expected LTD partner factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    result.patternKey === 'esp-ltd-numeric-9digit-yy-ww-d-sequence',
    `Expected 9-digit numeric pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(expectedDay),
    `Expected day ${expectedDay} in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertESPVintageJapan5Digit('22944');
  assertESPVintageJapan5Digit('29290');
  assertESPEdwardsEDPrefix('ED0903516');
  assertESPEdwardsEDPrefix2021('ed212253');
  assertESPAmbiguousEPrefix6Digit('E035054');
  assertESPLTDKoreaWMI9Digit('W120061141');
  assertESPJapanKisoFactory('K12211303');
  assertESPLTDEarlyKoreaUSequential('U080879');
  assertESPAmbiguous6DigitAllNumeric('028304');
  assertESPLTDIndonesiaSamickIS('IS090417067', '2009', 'April');
  assertESPLTDNumeric9Digit('090417067', '2009', 'January', 'Monday');
  assertESPKisoCustomSpecial('K09164080W15', '2009');
  assertESPLTDIndonesiaCIPrefix('CI25100523', '2025', 'October');
  assertESPLTDIndonesiaIMPrefix('IM24120398', '2024', 'December');
  assertESP1WCorrectsToIW('1W211112431', '2021', 'November');
}

function assertESPLTDIndonesiaCIPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('esp', serialInput);
  assert(result.success, `Expected decode success for esp:${serialInput}`);
  assert(result.info, `Expected decoded info for esp:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'esp-ltd-indonesia-ci-cort-yymm-sequence', `Expected CI pattern key for ${serialInput}, got ${result.patternKey}`);
}

function assertESPLTDIndonesiaIMPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('esp', serialInput);
  assert(result.success, `Expected decode success for esp:${serialInput}`);
  assert(result.info, `Expected decoded info for esp:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'esp-ltd-indonesia-im-cort-yymm-sequence', `Expected IM pattern key for ${serialInput}, got ${result.patternKey}`);
}

function assertESP1WCorrectsToIW(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('esp', serialInput);
  assert(result.success, `Expected decode success for esp:${serialInput}`);
  assert(result.info, `Expected decoded info for esp:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
}

function assertESPKisoCustomSpecial(serialInput, expectedYear) {
  const result = decodeSerialForBackend('esp', serialInput);
  assert(result.success, `Expected decode success for esp:${serialInput}`);
  assert(result.info, `Expected decoded info for esp:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Japan', `Expected Japan for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'esp-kiso-custom-k-yy-special', `Expected Kiso Custom pattern key for ${serialInput}, got ${result.patternKey}`);
}
