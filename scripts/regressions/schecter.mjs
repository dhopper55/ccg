import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeSchecter(serialInput) {
  return decodeSerialForBackend('schecter', serialInput);
}

function assertSchecterCAPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2024', `Expected year 2024 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China import factory / newer production partner',
    `Expected China import factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-ca-yymm-sequence',
    `Expected Schecter CA pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 5'),
    `Expected Schecter CA rich text for ${serialInput}`
  );
}

function assertSchecterUSA5Digit(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'Late 1980s-mid 1990s (estimated)',
    `Expected estimated USA era for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Schecter California / USA production',
    `Expected Schecter California / USA production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'USA California-era / early custom shop production',
    `Expected early 1990s USA model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'schecter-usa-5-digit-yy-sequence',
    `Expected Schecter USA 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('chronological production sequence'),
    `Expected Schecter USA 5-digit rich text for ${serialInput}`
  );
}

function assertSchecterRNPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === 'RN24100948', `Expected normalized serial RN24100948 for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === '2024', `Expected year 2024 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'October', `Expected month October for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'PT. Roxy Music', `Expected PT. Roxy Music factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-rn-yymm-sequence',
    `Expected Schecter RN pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 948'),
    `Expected Schecter RN rich text for ${serialInput}`
  );
}

function assertSchecterIMPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === 'IM25100158', `Expected normalized serial IM25100158 for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === '2025', `Expected year 2025 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'October', `Expected month October for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'Inwoo / PT Inwoo Indonesia', `Expected Inwoo / PT Inwoo Indonesia factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    info.notes && info.notes.includes('Sequence: 0158'),
    `Expected sequence 0158 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'schecter-im-indonesia-yymm-sequence',
    `Expected Schecter IM pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 158'),
    `Expected Schecter IM rich text for ${serialInput}`
  );
}

function assertSchecterSTPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2019', `Expected year 2019 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'July', `Expected month July for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China import factory / ST production run',
    `Expected ST China import factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-st-yymm-sequence',
    `Expected Schecter ST pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 42'),
    `Expected Schecter ST rich text for ${serialInput}`
  );
}

function assertSchecterROPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2023', `Expected year 2023 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'PT Cort Indonesia', `Expected PT Cort Indonesia for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-ro-indonesia-yy-sequence',
    `Expected Schecter RO pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 100905'),
    `Expected Schecter RO rich text for ${serialInput}`
  );
}

function assertSchecterRPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2008', `Expected year 2008 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Reliance / Korean import production',
    `Expected Reliance / Korean import production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-r-korea-yy-sequence',
    `Expected Schecter R pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 269'),
    `Expected Schecter R rich text for ${serialInput}`
  );
}

function assertSchecterHPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2009', `Expected year 2009 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Korea / Asian import factory',
    `Expected H import factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Diamond Series or similar import',
    `Expected Diamond Series or similar import model for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'schecter-h-yymm-sequence',
    `Expected Schecter H pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 1093'),
    `Expected Schecter H rich text for ${serialInput}`
  );
}

function assertSchecterOneWCorrectsToIW(serialInput, expectedCorrected) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);
  assert(
    result.correctedSerial === expectedCorrected,
    `Expected corrected serial ${expectedCorrected} for ${serialInput}, got ${result.correctedSerial}`
  );

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected corrected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === '2017', `Expected year 2017 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'August', `Expected month August for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Musical Instruments (WMI)',
    `Expected WMI factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${expectedCorrected}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertSchecterLegacy6Digit(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2005', `Expected year 2005 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Korea Factory', `Expected Korea factory guidance for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Diamond Series or similar import',
    `Expected Diamond Series or similar import model for ${serialInput}, got ${info.model}`
  );
  assert(
    info.notes && info.notes.includes('legacy Korean import format'),
    `Expected legacy Korean import note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'schecter-korea-legacy-6-digit',
    `Expected Schecter legacy 6-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 27007'),
    `Expected Schecter legacy 6-digit rich text for ${serialInput}`
  );
}

function assertSchecterLongNumericImport(serialInput, expectedYear) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Import production line', `Expected import production line for ${serialInput}, got ${info.factory}`);
  assert(
    info.country === 'China or other Asian import factory',
    `Expected Asian import country guidance for ${serialInput}, got ${info.country}`
  );
  assert(
    result.patternKey === 'schecter-long-numeric-import-yy-sequence',
    `Expected Schecter long numeric import pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSchecterWAPrefix(serialInput) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === '2025', `Expected year 2025 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'December', `Expected month December for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'World Audio / Korean import factory',
    `Expected World Audio / Korean import factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-wa-korea-yymm-sequence',
    `Expected Schecter WA pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 53'),
    `Expected production sequence 53 in rich text for ${serialInput}`
  );
}

function assertSchecterCSPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSchecter(serialInput);
  assert(result.success, `Expected decode success for Schecter ${serialInput}`);
  assert(result.info, `Expected decoded info for Schecter ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China or Indonesia partner factory (CS)',
    `Expected CS partner factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.model === 'Diamond Series import', `Expected Diamond Series import model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'schecter-cs-yymm-sequence',
    `Expected Schecter CS pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 612'),
    `Expected production sequence 612 in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertSchecterCAPrefix('CA24010005');
  assertSchecterUSA5Digit('92244');
  assertSchecterUSA5Digit('86079');
  assertSchecterRNPrefix('Rn24100948');
  assertSchecterIMPrefix('IM25100158');
  assertSchecterSTPrefix('ST19070042');
  assertSchecterROPrefix('RO23100905');
  assertSchecterRODigitZeroVariant('R025051680');
  assertSchecterRPrefix('R0800269');
  assertSchecterHPrefix('H090501093');
  assertSchecterOneWCorrectsToIW('1W17081558', 'IW17081558');
  assertSchecterLegacy6Digit('527007');
  assertSchecterLongNumericImport('178152249447', '2017');
  assertSchecterCSPrefix('CS22100612', '2022', 'October');
  assertSchecterWAPrefix('wa25120053');
  assertSchecterUnsungUPrefix('u080901104', '2008', 'September');
  assertSchecterWPrefixShort('W0924045', '2009');
  assertSchecterNumericKoreaWMI('4111051');
}

function assertSchecterNumericKoreaWMI(serialInput) {
  const result = decodeSerialForBackend('schecter', serialInput);
  assert(result.success, `Expected decode success for schecter:${serialInput}`);
  assert(result.info, `Expected decoded info for schecter:${serialInput}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
  assert(
    result.info.year.includes('early 2000s'),
    `Expected early 2000s year for ${serialInput}, got ${result.info.year}`
  );
  assert(
    result.patternKey === 'schecter-7digit-numeric-korea-wmi-sequential',
    `Expected 7-digit numeric WMI patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSchecterRODigitZeroVariant(serialInput) {
  const result = decodeSerialForBackend('schecter', serialInput);
  assert(result.success, `Expected decode success for schecter:${serialInput}`);
  assert(result.info, `Expected decoded info for schecter:${serialInput}`);
  assert(result.info.year === '2025', `Expected year 2025 for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'schecter-ro-indonesia-yy-sequence',
    `Expected RO Indonesia patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSchecterWPrefixShort(serialInput, expectedYear) {
  const result = decodeSerialForBackend('schecter', serialInput);
  assert(result.success, `Expected decode success for schecter:${serialInput}`);
  assert(result.info, `Expected decoded info for schecter:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
}

function assertSchecterUnsungUPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('schecter', serialInput);
  assert(result.success, `Expected decode success for schecter:${serialInput}`);
  assert(result.info, `Expected decoded info for schecter:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${result.info.month}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'schecter-u-unsung-korea-yymm-sequence', `Expected U-prefix pattern key for ${serialInput}, got ${result.patternKey}`);
}
