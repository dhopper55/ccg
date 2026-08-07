import { assert, decodeSerialForBackend } from './shared.mjs';

function assertDeanHPrefixIndia(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'India import production line',
    `Expected India import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'India', `Expected country India for ${serialInput}, got ${info.country}`);
}

function assertDeanUnSungKorea(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'UnSung Factory, Incheon',
    `Expected UnSung Factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertDeanLegacyKoreaESingleYearDigit(serialInput, expectedYear) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Korean import production line',
    `Expected Korean import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-legacy-korea-e-single-year-digit',
    `Expected Dean legacy E-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanChinaZPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'China import production line',
    `Expected China import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-china-z-yy-sequence',
    `Expected Dean Z-prefix China pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanAsianPartnerAPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Asian partner import production line',
    `Expected Asian partner import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China or Indonesia', `Expected country China or Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-asian-partner-a-yymm-sequence',
    `Expected Dean A-prefix Asian partner pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`production sequence ${serialInput.slice(-4)}`),
    `Expected Dean A-prefix rich text for ${serialInput}`
  );
}

function assertDeanAsianPartnerDPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Asian partner import production line',
    `Expected Asian partner import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China, South Korea, or Indonesia', `Expected mixed Asian country guidance for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-asian-partner-d-yymm-sequence',
    `Expected Dean D-prefix Asian partner pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanLegacyKoreaD(serialInput, expectedYear, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(!info.month, `Expected no month for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Music Instruments, Korea',
    `Expected World Music Instruments, Korea for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`unit ${expectedSequence}`),
    `Expected production sequence unit ${expectedSequence} for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'dean-legacy-korea-d-yy-sequence',
    `Expected Dean legacy Korea D-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanFiveDigitSequential(serialInput) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'Unknown (likely late 1990s-early 2000s Czech import or vintage USA, verify markings)',
    `Expected ambiguous Dean 5-digit year guidance for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Dean European Custom Select / Strunal Schönbach or Dean USA',
    `Expected Dean Czech/USA factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Czech Republic or USA', `Expected Czech Republic or USA for ${serialInput}, got ${info.country}`);
  assert(info.model === '5-digit numeric Dean format', `Expected 5-digit Dean model guidance for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'dean-five-digit-sequential-czech-or-usa',
    `Expected Dean 5-digit sequential pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanWorldKoreaWK(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Musical Instruments Co Ltd',
    `Expected World Musical Instruments for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-world-korea-wk-yymm-sequence',
    `Expected WK pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence (unit 3338)'),
    `Expected production sequence in rich text for ${serialInput}`
  );
}

function assertDeanWorldKoreaKW(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Musical Instruments Co Ltd',
    `Expected World Musical Instruments for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'dean-world-korea-kw-yymm-sequence',
    `Expected KW pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence (unit 3338)'),
    `Expected production sequence in rich text for ${serialInput}`
  );
}

function assertDeanNumeric9DigitYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Asian import factory (China or Indonesia)',
    `Expected Asian import factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    result.patternKey === 'dean-numeric-9digit-yymm-sequence',
    `Expected 9-digit YYMM pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertDeanHPrefixIndia('H22020 143', '2022', 'February');
  assertDeanHPrefixIndia('H22020143', '2022', 'February');
  assertDeanHPrefixIndia('H22020', '2022', 'February');
  assertDeanLegacyKoreaESingleYearDigit('E805978', '1998 or 2008 (estimated)');
  assertDeanUnSungKorea('US080-3865', '2008', 'March');
  assertDeanChinaZPrefix('z1300165', '2013');
  assertDeanAsianPartnerAPrefix('A07043194', '2007', 'April');
  assertDeanAsianPartnerAPrefix('a10091499', '2010', 'September');
  assertDeanAsianPartnerDPrefix('D21010091', '2021', 'January');
  assertDeanLegacyKoreaD('d950093', '1995', 93);
  assertDeanFiveDigitSequential('52760');
  assertDeanCortKoreaC('C2122845', '2021');
  assertDeanWorldKoreaWK('WK170303338', '2017', 'March');
  assertDeanWorldKoreaKW('kw170303338', '2017', 'March');
  assertDeanNumeric9DigitYYMM('170303338', '2017', 'March');
  assertDeanKHFactory('Kh190630183', '2019', 'June');
  assertDeanAsianPartnerAShort('A800729', '1980', 729);
  assertDeanUnSungKoreaShort('US865632', '1986', 5632);
  assertDeanDSeriesTropicalKorea('D4495', 4495);
  assertDeanYooJinChinaShort('Y0512507', '2005', 'December', 507);
  assertDeanYooJinChinaShort('Y1412014', '2014', 'December', '014');
  assertDeanYooJinChinaYC('YC09110537', '2009', 'November', '0537');
  assertDeanWorldSoundWS('ws10106599', '2010', 'October', 6599);
  assertDeanOnetekChina0C('0C030002', '2003', 2);
  assertDeanCortKoreaC('C16978648', '2016');
  assertDeanCortKoreaCImplausibleYearFails('C36978648');
  assertDeanIndonesiaWI('WI13030009', '2013', 'March', '0009');
}

function assertDeanCortKoreaCImplausibleYearFails(serialInput) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(!result.success, `Expected decode failure for dean:${serialInput}`);
  assert(
    result.error && result.error.includes('implausible future year'),
    `Expected implausible-future-year error for ${serialInput}, got ${result.error}`
  );
}

function assertDeanIndonesiaWI(serialInput, expectedYear, expectedMonth, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.info.notes && result.info.notes.includes(`sequence: ${expectedSequence}`),
    `Expected sequence ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-wi-indonesia-wildwood-yymm-sequence',
    `Expected WI patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanAsianPartnerAShort(serialInput, expectedYear, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(
    result.info.notes && result.info.notes.includes(`unit ${expectedSequence}`),
    `Expected sequence unit ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-asian-partner-a-yy-sequence-short',
    `Expected A-short patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanUnSungKoreaShort(serialInput, expectedYear, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(
    result.info.notes && result.info.notes.includes(`unit ${expectedSequence}`),
    `Expected sequence unit ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-unsung-korea-us-yy-sequence-short',
    `Expected US-short patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanDSeriesTropicalKorea(serialInput, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(
    result.info.year && result.info.year.includes('1994-1996'),
    `Expected 1994-1996 era for ${serialInput}, got ${result.info.year}`
  );
  assert(
    result.info.notes && result.info.notes.includes(`sequence "${expectedSequence}"`),
    `Expected sequence "${expectedSequence}" for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-d-series-tropical-korea-sequential',
    `Expected D-Series patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanYooJinChinaShort(serialInput, expectedYear, expectedMonth, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.info.notes && result.info.notes.includes(`sequence: ${expectedSequence}`),
    `Expected sequence ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
}

function assertDeanYooJinChinaYC(serialInput, expectedYear, expectedMonth, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.info.notes && result.info.notes.includes(`sequence: ${expectedSequence}`),
    `Expected sequence ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-yc-yoojin-china-yymm-sequence',
    `Expected YC patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanWorldSoundWS(serialInput, expectedYear, expectedMonth, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.info.notes && result.info.notes.includes(`sequence: ${expectedSequence}`),
    `Expected sequence ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-ws-china-yymm-sequence',
    `Expected WS patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanOnetekChina0C(serialInput, expectedYear, expectedSequence) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(
    result.info.notes && result.info.notes.includes(`unit ${expectedSequence}`),
    `Expected sequence unit ${expectedSequence} for ${serialInput}, got ${result.info.notes}`
  );
  assert(
    result.patternKey === 'dean-0c-onetek-china-yy-sequence',
    `Expected 0C patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanKHFactory(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(
    result.patternKey === 'dean-kh-factory-yymm-sequence',
    `Expected KH factory patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertDeanCortKoreaC(serialInput, expectedYear) {
  const result = decodeSerialForBackend('dean', serialInput);
  assert(result.success, `Expected decode success for dean:${serialInput}`);
  assert(result.info, `Expected decoded info for dean:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'dean-cort-korea-c-yy-batch-sequence', `Expected C-prefix pattern key for ${serialInput}, got ${result.patternKey}`);
}
