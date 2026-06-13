import { assert, decodeSerialForBackend } from './shared.mjs';

function decodeBCRich(serialInput) {
  return decodeSerialForBackend('bcrich', serialInput);
}

function assertBCRichIShortImport(serialInput, expectedYear, expectedMonth) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Import production (I-prefix short format)',
    `Expected I-prefix short import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.country === 'Asia (factory unspecified)',
    `Expected Asia import country note for ${serialInput}, got ${info.country}`
  );
}

function assertBCRichShortNumericImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2001 (likely import estimate)', `Expected likely 2001 import estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Early-2000s import production',
    `Expected early-2000s import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('Class Axe-era'),
    `Expected Class Axe-era ambiguity note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-short-numeric-import-y-filler-quarter-sequence',
    `Expected B.C. Rich short numeric pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 979'),
    `Expected B.C. Rich short numeric rich text for ${serialInput}`
  );
}

function assertBCRichSevenDigitNumericImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(
    info.year === '2000 or 2010 (broad import estimate; serial may be arbitrary)',
    `Expected broad 2000/2010 import estimate for ${serialInput}, got ${info.year}`
  );
  assert(
    info.factory === 'Hanser-era/import production',
    `Expected Hanser-era/import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea / China', `Expected Korea/China country guidance for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('sequence 27150'),
    `Expected production sequence 27150 for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes('arbitrary factory or neck-plate numbers'),
    `Expected arbitrary-number caveat for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-7-digit-numeric-import-yy-sequence',
    `Expected B.C. Rich 7-digit numeric pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('sequence 27150'),
    `Expected B.C. Rich 7-digit numeric rich text for ${serialInput}`
  );
}

function assertBCRichShortMonthCodeImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2020', `Expected year 2020 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'April', `Expected month April for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Import production batch/factory code 5',
    `Expected batch/factory code 5 for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('pre-2000 F-prefix'),
    `Expected pre-2000 F-prefix ambiguity note for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-short-modern-month-code-import',
    `Expected B.C. Rich short month-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 1631'),
    `Expected B.C. Rich short month-code rich text for ${serialInput}`
  );
}

function assertBCRichFPrefixSixDigitImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2020 or 2002 (context-dependent import estimate)', `Expected 2020/2002 estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'F-prefix import production',
    `Expected F-prefix import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea / China / Taiwan', `Expected import country guidance for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 1422'),
    `Expected production sequence 1422 for ${serialInput}, got ${info.notes}`
  );
  assert(
    info.notes && info.notes.includes('Class Axe-era import plate'),
    `Expected Class Axe-era plate ambiguity for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-f-prefix-six-digit-import',
    `Expected B.C. Rich F-prefix six-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertBCRichBPrefixMonthCodeImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2009', `Expected year 2009 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China import production (B-prefix factory/line)',
    `Expected B-prefix China import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 30385'),
    `Expected production sequence 30385 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-b-prefix-month-code-import',
    `Expected B.C. Rich B-prefix month-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2009'),
    `Expected B.C. Rich B-prefix rich text for ${serialInput}`
  );
}

function assertBCRichHanserTwoLetterMonthPlantImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === 'CO1093111', `Expected normalized serial CO1093111 for ${serialInput}, got ${info.serialNumber}`);
  assert(info.year === '2010', `Expected year 2010 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'February', `Expected month February for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Hanser-era import plant/contract code O',
    `Expected Hanser-era O plant code for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China / Indonesia', `Expected China / Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 93111'),
    `Expected production sequence 93111 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-hanser-two-letter-month-plant-import',
    `Expected B.C. Rich two-letter Hanser pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2010'),
    `Expected B.C. Rich two-letter Hanser rich text for ${serialInput}`
  );
}

function assertBCRichHanserShortMonthCodeImport(serialInput, expectedYear, expectedMonth) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.country === 'China / Indonesia / South Korea',
    `Expected China / Indonesia / South Korea for ${serialInput}, got ${info.country}`
  );
  assert(
    result.patternKey === 'bcrich-hanser-short-month-code-import',
    `Expected B.C. Rich Hanser short month-code pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Hanser Music Group import models'),
    `Expected Hanser short month-code rich text for ${serialInput}`
  );
}

function assertBCRichHanserSingleLetterCalendarMonthImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '2003', `Expected year 2003 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'March', `Expected month March for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Hanser-era Korean import production batch/filler code 0',
    `Expected Hanser-era Korean import factory note for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 1288'),
    `Expected production sequence 1288 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-hanser-single-letter-calendar-month-import',
    `Expected B.C. Rich single-letter Hanser pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('early-to-mid 2000s Korean-made import models'),
    `Expected B.C. Rich single-letter Hanser rich text for ${serialInput}`
  );
}

function assertBCRichHanserEraEightDigitImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(
    info.serialNumber === '41201627',
    `Expected Sr# label to be stripped for ${serialInput}, got ${info.serialNumber}`
  );
  assert(
    info.year === '2004 or 2014 (likely 2004 for mid-2000s Hanser-era imports)',
    `Expected Hanser-era ambiguous 2004/2014 year for ${serialInput}, got ${info.year}`
  );
  assert(
    info.notes && info.notes.includes('production sequence 201627'),
    `Expected production sequence 201627 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-hanser-era-8-digit-import',
    `Expected B.C. Rich Hanser-era 8-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('Q1'),
    `Expected B.C. Rich Hanser-era rich text for ${serialInput}`
  );
}

function assertBCRichClassAxeBPrefixImport(serialInput) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === '1989-1993 (estimated)', `Expected Class Axe-era estimate for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Class Axe-era import production',
    `Expected Class Axe-era import production for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.country === 'South Korea / Japan',
    `Expected Korea/Japan country note for ${serialInput}, got ${info.country}`
  );
  assert(
    info.notes && info.notes.includes('neck-plate sequence (7132)'),
    `Expected neck-plate sequence 7132 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'bcrich-class-axe-b-prefix-import',
    `Expected B.C. Rich Class Axe B-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('1989-1993'),
    `Expected B.C. Rich Class Axe B-prefix rich text for ${serialInput}`
  );
}

function assertBCRichUSA5DigitOffset(serialInput, expectedYearRange) {
  const result = decodeBCRich(serialInput);
  assert(result.success, `Expected decode success for ${serialInput}`);
  assert(result.info, `Expected decoded info for ${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYearRange, `Expected year range ${expectedYearRange} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'USA (neck-through)',
    `Expected USA neck-through factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('serial drift'),
    `Expected serial-drift note for ${serialInput}, got ${info.notes}`
  );
}

export function runTests() {
  assertBCRichIShortImport('i50311', '2005', 'March');
  assertBCRichShortNumericImport('150979');
  assertBCRichSevenDigitNumericImport('0127150');
  assertBCRichShortMonthCodeImport('F2051631');
  assertBCRichFPrefixSixDigitImport('F201422');
  assertBCRichBPrefixMonthCodeImport('BA09030385');
  assertBCRichHanserTwoLetterMonthPlantImport('co1093111');
  assertBCRichHanserShortMonthCodeImport('J50212', '2005', 'July');
  assertBCRichHanserSingleLetterCalendarMonthImport('C301288');
  assertBCRichHanserEraEightDigitImport('Sr#41201627');
  assertBCRichClassAxeBPrefixImport('B007132');
  assertBCRichUSA5DigitOffset('36642', '1982-1983 (estimated)');
}
