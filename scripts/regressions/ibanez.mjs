import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeIbanez(serialInput) {
  return decodeSerialForBackend('ibanez', serialInput);
}

function assertIbanezBPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2016', `Expected year 2016 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'February', `Expected month February for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown (B used as month-letter code, not a factory code)',
    `Expected month-letter factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez5BPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2016', `Expected year 2016 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (5B prefix)',
    `Expected 5B prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez5APrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2021', `Expected year 2021 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'April', `Expected month April for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (5A prefix)',
    `Expected 5A prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez5NPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2023', `Expected year 2023 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'April', `Expected month April for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (5N prefix)',
    `Expected 5N prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanez4HPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2014', `Expected year 2014 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'August', `Expected month August for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (4H-prefix factory)',
    `Expected 4H prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanez4HExtended(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2023', `Expected year 2023 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (4H-prefix factory)',
    `Expected 4H prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezOZPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2010', `Expected year 2010 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'May', `Expected month May for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (OZ-prefix factory)',
    `Expected OZ prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezHPrefix(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2008', `Expected year 2008 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'November', `Expected month November for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (H-prefix factory)',
    `Expected H prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezExistingSamples() {
  const samples = ['F0712345', 'F523456', 'I120426682', 'GS140406094'];

  for (const sample of samples) {
    const result = decodeIbanez(sample);
    assert(result.success, `Expected decode success for ${sample}`);
    assert(result.info, `Expected decoded info for ${sample}`);
  }
}

function assertIbanezFujiGenPost2004EightDigit(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'FujiGen Gakki, Nagano',
    `Expected FujiGen factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    result.patternKey === 'ibanez-fujigen-post-2004-f-yy-sequence',
    `Expected post-2004 FujiGen pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertIbanezNumericOnly9Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (numeric-only format)',
    `Expected numeric-only factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezNumericOnly9DigitAmbiguous(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumericOnly8DigitAmbiguous(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumericOnly8DigitLate1900s(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Likely Korean import factory (possibly Cort)',
    `Expected likely Korean factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertIbanezNumericOnly7Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown import factory (numeric-only format)',
    `Expected numeric-only factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezNumericOnly10DigitFactoryLeading(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Unknown China factory (numeric 10-digit format)',
    `Expected numeric 10-digit China factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezModelCodeFallback(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.model === 'SR305EDX', `Expected model SR305EDX for ${serialInput}, got ${info.model}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('model code, not a stamped serial number'),
    `Expected model-code note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezModelCodeFallbackGRG(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.model === 'GRG170DX', `Expected model GRG170DX for ${serialInput}, got ${info.model}`);
  assert(info.country === 'China or Indonesia', `Expected country China or Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('model code, not a stamped serial number'),
    `Expected model-code note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezKnownProductCode(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.model === 'JEM7V Steve Vai Signature', `Expected JEM7V model for ${serialInput}, got ${info.model}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('GTIN/UPC retail product barcode'),
    `Expected UPC/GTIN note for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes('not the stamped instrument serial number'),
    `Expected not-serial note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'ibanez-known-upc-jem7v',
    `Expected Ibanez UPC pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertIbanezCompoundGS(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezGSMixedContractor(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China / Indonesia', `Expected China / Indonesia country guidance for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'GS-prefix GIO/budget production; U subcontractor code (commonly associated with Unsung or a partner facility)',
    `Expected U subcontractor factory note for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('production sequence 4325'),
    `Expected production sequence 4325 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'ibanez-gs-mixed-contractor-yy-plant-mm-sequence',
    `Expected GS mixed contractor pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('mixed GS-prefix Ibanez format'),
    `Expected GS mixed contractor rich text for ${serialInput}`
  );
}

function assertIbanezIndonesiaI(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
}

function assertIbanezIndonesiaPremiumJ(serialInput, expectedYear) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(!info.month, `Expected no month for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'Indonesia Premium Factory',
    `Expected Indonesia Premium Factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.model === 'Premium Series', `Expected Premium Series model guidance for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'ibanez-indonesia-premium-j-yy-sequence',
    `Expected Ibanez Premium J pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertIbanezIndonesiaExtended10(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Line code:'),
    `Expected line-code note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezKnownHUVariant(serialInput, correctedSerial, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === correctedSerial, `Expected corrected serial ${correctedSerial} for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${correctedSerial}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezMonthLetterCompactWithOTypo(serialInput, correctedSerial, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === correctedSerial, `Expected corrected serial ${correctedSerial} for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${correctedSerial}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezIndonesiaGILegacy(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
}

function assertIbanezChinaGP(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezChinaGZ(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'China (GZ-prefix factory/line)',
    `Expected GZ factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezChinaGaoqingGrandStar(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
  assert(
    info.factory === 'Gaoqing Grand Star, China',
    `Expected Gaoqing Grand Star factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.model === 'GIO Series (likely)', `Expected likely GIO model family for ${serialInput}, got ${info.model}`);
  assert(
    info.notes && info.notes.includes('production sequence 2301'),
    `Expected production sequence 2301 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'ibanez-china-gaoqing-grand-star-g-yymm-sequence',
    `Expected Gaoqing Grand Star pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Gaoqing Grand Star'),
    `Expected Gaoqing Grand Star rich text for ${serialInput}`
  );
}

function assertIbanezFujiGenFD(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezWorldExtended(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'World Musical Instruments Co.', `Expected World factory for ${serialInput}, got ${info.factory}`);
}

function assertIbanezWorldShortWK(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2000', `Expected year 2000 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'October', `Expected month October for ${serialInput}, got ${info.month}`);
  assert(info.factory === 'World Musical Instruments Co.', `Expected World factory for ${serialInput}, got ${info.factory}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezRPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Peerless Korea Co., Pusan',
    `Expected Peerless Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertIbanezSQMonthLetter(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Saehan Guitar Technology (acoustic production)',
    `Expected Saehan acoustic factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezKorea7DigitC(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort Guitars, Incheon/Daejeon',
    `Expected Cort Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
}

function assertIbanezKoreaSaeinSA(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Saein Musical Instrument Co., South Korea',
    `Expected Saein South Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected country South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'ibanez-korea-saein-sa-yymm-sequence',
    `Expected Ibanez Saein SA pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 05051'),
    `Expected Ibanez Saein SA rich text for ${serialInput}`
  );
}

function assertIbanezVPrefix(serialInput, expectedYear) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Unknown V-prefix production line (Japan or Korea)',
    `Expected V-prefix factory note for ${serialInput}, got ${info.factory}`
  );
}

function assertIbanezMPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate interpretation'),
    `Expected alternate interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezLegacyKoreaMPrefix(serialInput, expectedYear) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Mirr / Korean import production',
    `Expected Mirr / Korean import production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'ibanez-legacy-korea-m-prefix-yy-sequence',
    `Expected Ibanez legacy Korea M-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertIbanezChinaL(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezChinaN(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China (N-prefix factory)',
    `Expected N-prefix China factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanez4L(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'China', `Expected country China for ${serialInput}, got ${info.country}`);
}

function assertIbanezLegacyAlphaSuffix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezJapanMonthLetterExtended(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezCompoundNumeric(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Prefix code:'),
    `Expected prefix note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezCompactAlphaSuffix(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
}

function assertIbanezLegacyNumericLate80s(serialInput, expectedYear) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.country === 'USA/Japan (ambiguous)',
    `Expected ambiguous USA/Japan country note for ${serialInput}, got ${info.country}`
  );
}

function assertIbanezNumeric6DigitYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('Alternate vintage interpretation'),
    `Expected alternate vintage interpretation note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumeric6DigitPreLetter(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('pre-letter YMMNNN'),
    `Expected pre-letter YMMNNN note for ${serialInput}, got ${info.notes}`
  );
}

function assertIbanezNumeric6DigitOmittedPrefixJapan(serialInput, expectedYear, expectedMonth) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Terada Musical Instrument Co., Nagoya (possible omitted-prefix format)',
    `Expected Terada omitted-prefix factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected country Japan for ${serialInput}, got ${info.country}`);
}

function assertIbanezAmbiguous6DigitImpossibleYY(serialInput) {
  const result = decodeIbanez(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'Unknown - likely missing prefix or misread digit',
    `Expected unknown ambiguous year for ${serialInput}, got ${info.year}`
  );
  assert(
    info.notes && info.notes.includes('F414159') && info.notes.includes('C414159'),
    `Expected missing-prefix guidance for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'ibanez-ambiguous-6-digit-numeric-impossible-yy',
    `Expected ambiguous 6-digit Ibanez pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

export function runTests() {
  assertIbanezBPrefix('B160100231');
  assertIbanezBPrefix('B-160100231');
  assertIbanez5APrefix('5A210401373');
  assertIbanez5BPrefix('5B160100231');
  assertIbanez5BPrefix('5B-160100231');
  assertIbanez5NPrefix('5N230401406');
  assertIbanez4HPrefix('4H140800605');
  assertIbanez4HExtended('4H2300501778');
  assertIbanezOZPrefix('OZ100500158');
  assertIbanezHPrefix('H081100181');
  assertIbanezCompoundGS('2Y03GS241108648', '2024', 'November');
  assertIbanezCompoundGS('212Y03GS251101952', '2025', 'November');
  assertIbanezGSMixedContractor('GS08U094325', '2008', 'September');
  assertIbanezCompoundNumeric('215N015N250401143', '2025', 'April');
  assertIbanezCompoundNumeric('1P-01 I220300400', '2022', 'March');
  assertIbanez4L('4L1901087937', '2019', 'January');
  assertIbanezLegacyAlphaSuffix('83030041D', '1983', 'March');
  assertIbanezLegacyAlphaSuffix('8303004ID', '1983', 'March');
  assertIbanezJapanMonthLetterExtended('H83020056', '1983', 'August');
  assertIbanezCompactAlphaSuffix('00906B', '2000', 'September');
  assertIbanezLegacyNumericLate80s('881865', '1988');
  assertIbanezNumeric6DigitYYMM('041195', '2004', 'November');
  assertIbanezNumeric6DigitOmittedPrefixJapan('510192', '1995 or 2005', 'October');
  assertIbanezNumeric6DigitPreLetter('402989', '1974', 'February');
  assertIbanezAmbiguous6DigitImpossibleYY('414159');
  assertIbanezIndonesiaI('I110626774', '2011', 'June');
  assertIbanezIndonesiaPremiumJ('J151403', '2015');
  assertIbanezIndonesiaExtended10('I1161207864', '2011', 'December');
  assertIbanezIndonesiaI('U081100181', '2008', 'November');
  assertIbanezKnownHUVariant('HU081100181', 'U081100181', '2008', 'November');
  assertIbanezMonthLetterCompactWithOTypo('Ao3oooo9', 'A0300009', '2003', 'January');
  assertIbanezIndonesiaGILegacy('GI0012180', '2000', 'December');
  assertIbanezChinaGP('gp05105792', '2005', 'October');
  assertIbanezChinaGZ('GZ150102324', '2015', 'January');
  assertIbanezChinaGaoqingGrandStar('G12042301', '2012', 'April');
  assertIbanezFujiGenFD('FD2468031', '2024', 'July');
  assertIbanezVPrefix('V054683', '2005');
  assertIbanezVPrefix('vo54683', '2005');
  assertIbanezLegacyKoreaMPrefix('m850413', '1985');
  assertIbanezMPrefix('M3013293', '2003', 'January');
  assertIbanezChinaL('L160200319', '2016', 'February');
  assertIbanezChinaN('N230401406', '2023', 'April');
  assertIbanezWorldExtended('W0111538', '2000', 'November');
  assertIbanezWorldShortWK('WK1007');
  assertIbanezRPrefix('R060300616', '2006', 'March');
  assertIbanezSQMonthLetter('SQ08E06597', '2008', 'May');
  assertIbanezKorea7DigitC('C8016949', '1998', 'January');
  assertIbanezKoreaSaeinSA('SA150105051', '2015', 'January');
  assertIbanezFujiGenPost2004EightDigit('F22011214', '2022', 'February');
  assertIbanezNumericOnly9Digit('220600378', '2022', 'June');
  assertIbanezNumericOnly9DigitAmbiguous('311717707', '2003', 'November');
  assertIbanezNumericOnly9Digit('141209632', '2014', 'December');
  assertIbanezNumericOnly9Digit('02010903', '2002', 'January');
  assertIbanezNumericOnly8DigitAmbiguous('40800605', '2004', 'August');
  assertIbanezNumericOnly8DigitLate1900s('92120182', '1992', 'December');
  assertIbanezNumericOnly7Digit('4120210', '2014', 'December');
  assertIbanezNumericOnly10DigitFactoryLeading('5230401406', '2023', 'April');
  assertIbanezModelCodeFallback('SR305EDX');
  assertIbanezModelCodeFallbackGRG('GRG170DX');
  assertIbanezKnownProductCode('0606559014521');
  assertIbanezExistingSamples();
}
