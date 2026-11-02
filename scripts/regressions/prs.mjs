import { assert, decodeSerialForBackend } from './shared.mjs';

function assertPRSUsaCoreSingleYearDigit(serialInput) {
  const result = decodeSerialForBackend('prs', serialInput);
  assert(result.success, `Expected decode success for prs:${serialInput}`);
  assert(result.info, `Expected decoded info for prs:${serialInput}`);

  const info = result.info;
  assert(info.year === '2007', `Expected year 2007 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'PRS Factory, Stevensville, Maryland',
    `Expected PRS Stevensville factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'USA', `Expected USA for ${serialInput}, got ${info.country}`);
  assert(info.model === 'Core set-neck model', `Expected Core set-neck model for ${serialInput}, got ${info.model}`);
  assert(
    result.patternKey === 'prs-usa-core-single-year-digit-six-sequence',
    `Expected PRS USA Core pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 126922'),
    `Expected PRS USA Core rich text for ${serialInput}`
  );
}

export function runTests() {
  assertPRSUsaCoreSingleYearDigit('7126922');
  assertPRSUsaCoreSingleYearDigit('7 126922');
  assertPRSUsaCoreSingleYearDigit('7/126922');
  assertPRSSECortIndonesiaCTINumeric('CTI02544', '2002');

  // S2 with 2-digit year prefix, sequence consistent with the published S2 ranges.
  assertPRSDecode('13s2000115', '2013', 'prs-s2-year-prefix-sequence', 'S2 Series');
  assertPRSDecode('15S2016219', '2015', 'prs-s2-year-prefix-sequence', 'S2 Series');
  assertPRSDecode('15S2O16219', '2015', 'prs-s2-year-prefix-sequence', 'S2 Series');
  assertPRSDecode('18S2034142', '2018', 'prs-s2-year-prefix-sequence', 'S2 Series');
  assertPRSFails('20S2010000'); // 2015-range sequence with a 2020 prefix
  assertPRSFails('12S2000115'); // S2 line started in 2013
  assertPRSFails('17 S20225309'); // 7-digit sequence is not the documented layout

  // SE Indonesia I + year letter (IA=2014 ... IE=2018).
  assertPRSDecode('Ic00947', '2016', 'prs-se-indonesia-i-letter-year', 'SE Series');
  assertPRSDecode('id05145', '2017', 'prs-se-indonesia-i-letter-year', 'SE Series');
  assertPRSDecode('ie00643', '2018', 'prs-se-indonesia-i-letter-year', 'SE Series');
  assertPRSFails('IF00643');
  assertPRSFails('je00643');
  assertPRSFails('ceid05145');
}

function assertPRSDecode(serialInput, expectedYear, expectedPatternKey, expectedModel) {
  const result = decodeSerialForBackend('prs', serialInput);
  assert(result.success, `Expected decode success for prs:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.model === expectedModel, `Expected model ${expectedModel} for ${serialInput}, got ${result.info.model}`);
  assert(result.patternKey === expectedPatternKey, `Expected ${expectedPatternKey} for ${serialInput}, got ${result.patternKey}`);
}

function assertPRSFails(serialInput) {
  const result = decodeSerialForBackend('prs', serialInput);
  assert(!result.success, `Expected decode failure for prs:${serialInput}, got ${result.info && result.info.year}`);
}

function assertPRSSECortIndonesiaCTINumeric(serialInput, expectedYear) {
  const result = decodeSerialForBackend('prs', serialInput);
  assert(result.success, `Expected decode success for prs:${serialInput}`);
  assert(result.info, `Expected decoded info for prs:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'prs-se-cort-indonesia-cti-numeric-year', `Expected CTI numeric pattern key for ${serialInput}, got ${result.patternKey}`);
}
