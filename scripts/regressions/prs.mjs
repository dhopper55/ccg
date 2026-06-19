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
}

function assertPRSSECortIndonesiaCTINumeric(serialInput, expectedYear) {
  const result = decodeSerialForBackend('prs', serialInput);
  assert(result.success, `Expected decode success for prs:${serialInput}`);
  assert(result.info, `Expected decoded info for prs:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${result.info.country}`);
  assert(result.patternKey === 'prs-se-cort-indonesia-cti-numeric-year', `Expected CTI numeric pattern key for ${serialInput}, got ${result.patternKey}`);
}
