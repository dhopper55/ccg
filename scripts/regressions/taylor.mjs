import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeTaylor(serialInput) {
  return decodeSerialForBackend('taylor', serialInput);
}

function assertTaylorModernShort9Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(info.factory === 'El Cajon, California', `Expected El Cajon factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'USA', `Expected USA country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Modern Taylor 9-digit variant'),
    `Expected shortened-format note for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes('production sequence #4'),
    `Expected Taylor production sequence #4 note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'taylor-modern-short-9',
    `Expected Taylor shortened-modern pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence #4'),
    `Expected Taylor shortened-modern rich text for ${serialInput}`
  );
}

function assertTaylorModern10Digit(serialInput, expectedYear, expectedMonth, expectedDay, expectedFactory, expectedCountry) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(info.factory === expectedFactory, `Expected factory ${expectedFactory} for ${serialInput}, got ${info.factory}`);
  assert(info.country === expectedCountry, `Expected country ${expectedCountry} for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'taylor-modern-10-digit-factory-date-sequence',
    `Expected Taylor modern 10-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertTaylorModern10DigitRejectedAsFuture(serialInput) {
  const result = decodeTaylor(serialInput);
  assert(!result.success, `Expected backend Taylor decode failure for ${serialInput}`);
  assert(
    result.error === 'Unable to decode this serial number.',
    `Expected generic future-year decode failure for ${serialInput}, got ${result.error}`
  );
}

function assertTaylorLegacy9Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(
    info.notes && info.notes.includes('This 9-digit format was used from 1993 to 1999'),
    `Expected legacy 9-digit note for ${serialInput}, got ${info.notes}`
  );
}

function assertTaylorLegacy9DigitYearCode(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(
    info.model === '500 Series through Presentation Series',
    `Expected 500 Series through Presentation Series for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'taylor-legacy-9-digit-year-code',
    `Expected Taylor legacy year-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 55'),
    `Expected Taylor legacy year-code rich text for ${serialInput}`
  );
}

function assertTaylorModernExtended11Digit(serialInput, expectedYear, expectedMonth, expectedDay) {
  const result = decodeTaylor(serialInput);
  assert(result.success, `Expected decode success for Taylor ${serialInput}`);
  assert(result.info, `Expected decoded info for Taylor ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(info.day === expectedDay, `Expected day ${expectedDay} for ${serialInput}, got ${info.day}`);
  assert(info.factory === 'Tecate, Baja California', `Expected Tecate factory for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Mexico', `Expected Mexico country for ${serialInput}, got ${info.country}`);
  assert(
    info.model === '300 or 400 Series',
    `Expected 300 or 400 Series model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    info.notes && info.notes.includes('production sequence #138'),
    `Expected Taylor production sequence #138 note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'taylor-modern-extended-11',
    `Expected Taylor modern extended 11-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('series-code digit'),
    `Expected Taylor modern extended 11-digit rich text for ${serialInput}`
  );
}

export function runTests() {
  assertTaylorModern10Digit('1107289190', '2019', 'July', '28', 'El Cajon, California', 'USA');
  assertTaylorModern10Digit('2107289190', '2019', 'July', '28', 'Tecate, Baja California', 'Mexico');
  assertTaylorModern10DigitRejectedAsFuture('1207289190');
  assertTaylorModernShort9Digit('111130804', '2018', 'November', '30');
  assertTaylorLegacy9Digit('980311301', '1998', 'March', '11');
  assertTaylorLegacy9DigitYearCode('050913155', '1993', 'September', '13');
  assertTaylorModernExtended11Digit('21092006138', '2016', 'September', '20');
}
