import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeKramer(serialInput) {
  return decodeSerialForBackend('kramer', serialInput);
}

function assertKramerModernS(serialInput, expectedYear, expectedMonth) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Samick', `Expected Samick factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
}

function assertKramerSJSaemyungChina(serialInput, expectedYear, expectedMonth) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Saemyung', `Expected Saemyung factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-sj-saemyung-china-yymm-sequence',
    `Expected Kramer SJ Saemyung China pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertKramerMusicYoStrikerS(serialInput, expectedYear) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.model === 'Striker Series', `Expected Striker Series for ${serialInput}, got ${info.model}`);
  assert(info.country === 'South Korea or China', `Expected South Korea or China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-musicyo-striker-s-yy-sequence',
    `Expected Kramer MusicYo Striker pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertKramerVPrefix(serialInput, expectedYearRange) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(
    info.notes && info.notes.includes('not always chronological'),
    `Expected non-chronological note for ${serialInput}, got ${info.notes}`
  );
}

function assertKramerCFPrefix(serialInput, expectedYearRange) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Focus/Striker-era'),
    `Expected Focus/Striker-era note for ${serialInput}, got ${info.notes}`
  );
}

function assertKramerSESamickKorea(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1980s to early 1990s (estimated)',
    `Expected late 1980s to early 1990s estimate for ${serialInput}, got ${info.year}`
  );
  assert(info.factory === 'Samick', `Expected Samick factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Overseas import model, commonly Striker, Aerostar, or Focus family',
    `Expected Striker/Aerostar/Focus model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'kramer-se-samick-korea-4-digit',
    `Expected Kramer SE Samick Korea pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 8280'),
    `Expected Kramer SE Samick Korea rich text for ${serialInput}`
  );
}

function assertKramerSCJapanImport(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === 'mid-to-late 1980s (estimated)', `Expected mid-to-late 1980s estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'ESP Japan-associated overseas production',
    `Expected ESP Japan-associated production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Overseas import model, commonly Focus or Striker family',
    `Expected Focus/Striker model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'kramer-sc-japan-focus-striker-4-digit',
    `Expected Kramer SC Japan pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 9117'),
    `Expected Kramer SC Japan rich text for ${serialInput}`
  );
}

function assertKramerNumeric5Prefix(serialInput, expectedYearRange) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Korean import production line',
    `Expected Korean import production line for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
}

function assertKramerSDSamickKorea(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '1987-1989 (estimated)', `Expected late-1980s estimate for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Samick', `Expected Samick factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-sd-samick-korea-striker-sequence',
    `Expected Kramer SD Samick Korea pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertKramerModernGibsonEraNumeric(serialInput, expectedYear, expectedMonth, expectedFactory) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === expectedFactory, `Expected factory ${expectedFactory} for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-modern-gibson-era-11-digit-yymm-factory-sequence',
    `Expected Kramer modern Gibson-era 11-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 4'),
    `Expected Kramer modern Gibson-era rich text for ${serialInput}`
  );
}

function assertKramerModernGibsonEraFactoryNumeric(serialInput, expectedYear, expectedMonth, expectedFactory) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === expectedFactory, `Expected factory ${expectedFactory} for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-modern-gibson-era-9-digit-factory-yym-sequence',
    `Expected Kramer modern Gibson-era 9-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertKramerVintage5Digit(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '1980s (estimated)', `Expected 1980s estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Neptune, NJ plate-era production',
    `Expected Neptune, NJ plate-era production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA or Japan', `Expected USA or Japan for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-vintage-5-digit-plate',
    `Expected Kramer vintage 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('plate sequence here is 70630'),
    `Expected Kramer vintage 5-digit rich text for ${serialInput}`
  );
}

function assertKramerPlain4Digit(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '1980s (estimated)', `Expected 1980s estimate for ${serialInput}, got ${info.year}`);
  assert(
    result.patternKey === 'kramer-plain-4-digit-plate-unverified',
    `Expected Kramer plain 4-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('plain 4-digit'),
    `Expected Kramer plain 4-digit rich text for ${serialInput}`
  );
}

function assertKramerSBStriker(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for kramer:${serialInput}`);
  assert(result.info, `Expected decoded info for kramer:${serialInput}`);

  const info = result.info;
  assert(
    info.year === '1986–1989 (estimated)',
    `Expected 1986–1989 estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Samick Korea or Japanese contracted facility',
    `Expected Samick Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea or Japan', `Expected South Korea or Japan for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-sb-striker-1980s-sequential',
    `Expected Kramer SB Striker pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertKramerJKIndonesia(serialInput, expectedYear, expectedMonth) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Indonesian factory (Gibson/Epiphone era)',
    `Expected Indonesian factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'kramer-jk-indonesia-gibson-era-yymm-sequence',
    `Expected JK Indonesia pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertKramerSASamickKorea(serialInput) {
  const result = decodeKramer(serialInput);
  assert(result.success, `Expected decode success for kramer:${serialInput}`);
  assert(result.info, `Expected decoded info for kramer:${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'mid-to-late 1980s (estimated)',
    `Expected mid-to-late 1980s estimate for ${serialInput}, got ${info.year}`
  );
  assert(info.factory === 'Samick Korea', `Expected Samick Korea factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Striker Series (Striker 100, 200, or 300) or related import line',
    `Expected Striker model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'kramer-sa-samick-korea-striker-sequence',
    `Expected Kramer SA Samick Korea pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence (9933)'),
    `Expected production sequence 9933 in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertKramerModernS('S106020848', '2010', 'June');
  assertKramerSJSaemyungChina('SJ03120763', '2003', 'December');
  assertKramerMusicYoStrikerS('S01517', '2001');
  assertKramerVPrefix('V9954', 'mid-to-late 1980s (estimated)');
  assertKramerCFPrefix('CF22271', '1985-1989 (estimated)');
  assertKramerSESamickKorea('se 8280');
  assertKramerSCJapanImport('SC9117');
  assertKramerVintage5Digit('70630');
  assertKramerNumeric5Prefix('5062786', '1987-1991 (estimated)');
  assertKramerSDSamickKorea('SD4425');
  assertKramerModernGibsonEraNumeric('25051300004', '2025', 'May', 'Factory 13');
  assertKramerModernGibsonEraFactoryNumeric('311763081', '2017', 'June', 'Qingdao');
  assertKramerSBStriker('SB 2063');
  assertKramerSASamickKorea('Sa9933');
  assertKramerPlain4Digit('8586');
  assertKramerJKIndonesia('JK99100467', '1999', 'October');
  assertKramerJKIndonesia('JK99090162', '1999', 'September');
}
