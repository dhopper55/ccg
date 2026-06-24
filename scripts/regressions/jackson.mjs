import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeJackson(serialInput) {
  return decodeSerialForBackend('jackson', serialInput);
}

function assertJacksonMij1996Transition(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '1996', `Expected year 1996 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('1996 transition period'),
    `Expected 1996 transition note for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes(`production sequence ${parseInt(serialInput.substring(1), 10)}`),
    `Expected production sequence note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-6-digit-1996-transition',
    `Expected Jackson MIJ transition pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Chushin Gakki'),
    `Expected Jackson MIJ transition rich text for ${serialInput}`
  );
}

function assertJacksonMijSevenDigit1990s(serialInput, expectedYear) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('7-digit mid-1990s Jackson import format'),
    `Expected mid-1990s MIJ note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-7-digit-1990-1995-chushin',
    `Expected Jackson MIJ 7-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Chushin Gakki'),
    `Expected Jackson MIJ 7-digit rich text for ${serialInput}`
  );
}

function assertJacksonMijSevenPrefixSixDigit(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'late 1990s to late 2000s (estimated)',
    `Expected late 1990s to late 2000s estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Japan import production, likely Chushin Gakki',
    `Expected likely Japan import factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'jackson-mij-6-digit-7-prefix-import-sequence',
    `Expected Jackson MIJ 6-digit 7-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('this serial has 6 digits'),
    `Expected Jackson MIJ 6-digit caveat for ${serialInput}`
  );
}

function assertJacksonMijLate1990sSixDigit(serialInput, expectedYear) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('6-digit late-1990s Jackson import format'),
    `Expected late-1990s MIJ note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-6-digit-late-1990s-professional',
    `Expected Jackson late-1990s MIJ 6-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('pre-2002 import instruments'),
    `Expected Jackson late-1990s MIJ rich text for ${serialInput}`
  );
}

function assertJacksonMijProfessionalFiveDigit(serialInput, expectedYear) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Professional Series', `Expected Professional Series for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'jackson-mij-professional-5-digit',
    `Expected Jackson MIJ Professional 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertJacksonUSACustomBoltOn(serialInput, expectedYear) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Jackson USA Custom Shop (Ontario, CA)',
    `Expected Ontario Custom Shop factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
}

function assertJacksonUSAUSeries(serialInput, expectedYear = 'early to mid-2000s (estimated)') {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(
    info.year === expectedYear,
    `Expected ${expectedYear} estimate for ${serialInput}, got ${info.year}`
  );
  assert(info.factory === 'Jackson USA', `Expected Jackson USA factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('USA U-series serial'),
    `Expected USA U-series note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-usa-u-series',
    `Expected Jackson USA U-series pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`numeric sequence is ${parseInt(serialInput.substring(1), 10)}`),
    `Expected Jackson USA U-series rich text for ${serialInput}`
  );
}

function assertJacksonTaiwanJSSeries(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '1996', `Expected year 1996 for ${serialInput}, got ${info.year}`);
  assert(info.model === 'JS20', `Expected JS20 model for ${serialInput}, got ${info.model}`);
  assert(info.factory === 'MIT Taiwan factory', `Expected MIT Taiwan factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Taiwan', `Expected Taiwan country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'jackson-taiwan-js-series-1996',
    `Expected Jackson Taiwan JS-series pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 50010694'),
    `Expected Jackson Taiwan JS-series rich text for ${serialInput}`
  );
}

function assertJacksonPlayerChoiceSeries(serialInput, expectedUnit) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '1993', `Expected year 1993 for ${serialInput}, got ${info.year}`);
  assert(info.country === 'USA', `Expected USA for ${serialInput}, got ${info.country}`);
  assert(info.factory === 'Jackson USA (Ontario, California)', `Expected Ontario factory for ${serialInput}, got ${info.factory}`);
  assert(
    info.notes && info.notes.includes(`unit ${expectedUnit} of 150`),
    `Expected unit ${expectedUnit} note for ${serialInput}`
  );
  assert(
    result.patternKey === 'jackson-usa-player-choice-series-pcs',
    `Expected PCS pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('150 built in 1993'),
    `Expected PCS rich text for ${serialInput}`
  );
}

function assertJacksonMij200C(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === '2002-2006 (estimated)', `Expected estimated 2002-2006 year for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Chushin Gakki', `Expected Chushin Gakki factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Japan', `Expected Japan country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('200C + 5 digits'),
    `Expected 200C pattern note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'jackson-mij-200c-chushin',
    `Expected Jackson 200C pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 541'),
    `Expected Jackson 200C rich text for ${serialInput}`
  );
}

function assertJacksonChinaCWJPrefix(serialInput, expectedYear, expectedSequence) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Chinese contracted factory (CWJ)',
    `Expected CWJ China factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(info.model === 'JS Series or X Series', `Expected JS/X Series for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'jackson-china-cwj-yy-sequence',
    `Expected CWJ pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes(`production number ${expectedSequence}`),
    `Expected production number ${expectedSequence} in rich text for ${serialInput}`
  );
}

function assertJacksonChinaNumeric9Digit(serialInput) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(
    info.year === 'Unknown (factory sequence format, no year encoding)',
    `Expected unknown year for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Chinese contracted facility (factory code 311)',
    `Expected factory code 311 for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'jackson-china-numeric-9digit-factory-sequence',
    `Expected 9-digit factory sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production number 740074'),
    `Expected production number 740074 in rich text for ${serialInput}`
  );
}

function assertJacksonModern10DigitThreeLetterPrefix(serialInput, expectedYear, expectedFactory, expectedCountry) {
  const result = decodeJackson(serialInput);
  assert(result.success, `Expected decode success for Jackson ${serialInput}`);
  assert(result.info, `Expected decoded info for Jackson ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === expectedFactory, `Expected factory ${expectedFactory} for ${serialInput}, got ${info.factory}`);
  assert(info.country === expectedCountry, `Expected country ${expectedCountry} for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'jackson-modern-10digit-3letter-prefix-modelcode-yy-sequence',
    `Expected 3-letter prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 352'),
    `Expected production sequence 352 in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertJacksonMijSevenDigit1990s('9405251', '1994');
  assertJacksonMijSevenPrefixSixDigit('702728');
  assertJacksonMijLate1990sSixDigit('985400', '1998');
  assertJacksonMijProfessionalFiveDigit('11394', '1991');
  assertJacksonUSACustomBoltOn('8274', '1994-1995 (estimated)');
  assertJacksonUSACustomBoltOn('0788', '1986-1989');
  assertJacksonMij1996Transition('600503');
  assertJacksonMij1996Transition('600327');
  assertJacksonUSAUSeries('U15648');
  assertJacksonUSAUSeries('u17072', '2006-2007 (estimated)');
  assertJacksonTaiwanJSSeries('650010694');
  assertJacksonPlayerChoiceSeries('PCS0056', 56);
  assertJacksonPlayerChoiceSeries('pcs0001', 1);
  assertJacksonMij200C('200C00541');
  assertJacksonModern10DigitThreeLetterPrefix('ICJ3215352', '2015', 'Cort', 'Indonesia');
  assertJacksonChinaCWJPrefix('CWJ2257232', '2022', 57232);
  assertJacksonChinaCWJPrefix('CWJ25124694', '2025', 124694);
  assertJacksonChinaNumeric9Digit('311740074');
  assertJacksonKoreaNJHK('NJHK08007429', '2008');
  assertJacksonMijThreePrefix('3064460');
  assertJacksonEightPrefix7Digit('8633116');
  assertJacksonNinePrefixNineDigit('900500961');
  assertJacksonMijSevenPrefixSevenDigit('7050100');
}

function assertJacksonMijSevenPrefixSevenDigit(serialInput) {
  const result = decodeSerialForBackend('jackson', serialInput);
  assert(result.success, `Expected decode success for jackson:${serialInput}`);
  assert(result.info, `Expected decoded info for jackson:${serialInput}`);
  assert(result.info.country === 'Japan', `Expected Japan for ${serialInput}, got ${result.info.country}`);
  assert(result.info.factory === 'Chushin Gakki, Japan', `Expected Chushin Gakki for ${serialInput}, got ${result.info.factory}`);
  assert(
    result.patternKey === 'jackson-mij-7digit-7prefix-chushin-sequential',
    `Expected 7-prefix 7-digit patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertJacksonEightPrefix7Digit(serialInput) {
  const result = decodeSerialForBackend('jackson', serialInput);
  assert(result.success, `Expected decode success for jackson:${serialInput}`);
  assert(result.info, `Expected decoded info for jackson:${serialInput}`);
  assert(result.info.country === 'Japan (likely)', `Expected Japan for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'jackson-japan-8prefix-7digit-late1980s-early1990s',
    `Expected 8-prefix 7-digit patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertJacksonNinePrefixNineDigit(serialInput) {
  const result = decodeSerialForBackend('jackson', serialInput);
  assert(result.success, `Expected decode success for jackson:${serialInput}`);
  assert(result.info, `Expected decoded info for jackson:${serialInput}`);
  assert(result.info.country === 'Japan', `Expected Japan for ${serialInput}, got ${result.info.country}`);
  assert(
    result.patternKey === 'jackson-japan-9prefix-9digit-1990s',
    `Expected 9-prefix 9-digit patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertJacksonMijThreePrefix(serialInput) {
  const result = decodeSerialForBackend('jackson', serialInput);
  assert(result.success, `Expected decode success for jackson:${serialInput}`);
  assert(result.info, `Expected decoded info for jackson:${serialInput}`);
  assert(result.info.country === 'Japan', `Expected Japan for ${serialInput}, got ${result.info.country}`);
  assert(
    result.info.year === '1993-1995 (estimated)',
    `Expected 1993-1995 estimate for ${serialInput}, got ${result.info.year}`
  );
  assert(
    result.patternKey === 'jackson-japan-mij-3prefix-7digit-1993-1995',
    `Expected MIJ 3-prefix patternKey for ${serialInput}, got ${result.patternKey}`
  );
}

function assertJacksonKoreaNJHK(serialInput, expectedYear) {
  const result = decodeSerialForBackend('jackson', serialInput);
  assert(result.success, `Expected decode success for jackson:${serialInput}`);
  assert(result.info, `Expected decoded info for jackson:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'jackson-njhk-korea-yy-sequence', `Expected NJHK pattern key for ${serialInput}, got ${result.patternKey}`);
}
