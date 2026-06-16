import { assert, decodeSerialForBackend } from './shared.mjs';

function assertCortIEPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Surabaya',
    `Expected PT. Cort Indonesia, Surabaya for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
}

function assertCortAIPrefix(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Mojokerto',
    `Expected PT. Cort Indonesia, Mojokerto for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-ai-indonesia-yymm-sequence',
    `Expected Cort AI pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2020'),
    `Expected Cort AI rich text for ${serialInput}`
  );
}

function assertCortICSEPrefix(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '2021', `Expected year 2021 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Surabaya',
    `Expected PT. Cort Indonesia, Surabaya for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Cort/Cor-Tek SE production line or series',
    `Expected ICSE model guidance for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'cort-icse-indonesia-yy-sequence',
    `Expected Cort ICSE pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 3319'),
    `Expected Cort ICSE rich text for ${serialInput}`
  );
}

function assertCortIATransposedPrefix(serialInput, expectedCorrected, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);
  assert(
    result.correctedSerial === expectedCorrected,
    `Expected corrected serial ${expectedCorrected} for ${serialInput}, got ${result.correctedSerial}`
  );

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected corrected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT. Cort Indonesia, Mojokerto',
    `Expected PT. Cort Indonesia, Mojokerto for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected country Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes(`corrected from ${serialInput} to ${expectedCorrected}`),
    `Expected correction note for ${serialInput}, got ${info.notes}`
  );
}

function assertCortYearSequence7Digit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '2000', `Expected year 2000 for ${serialInput}, got ${info.year}`);
  assert(
    info.notes && info.notes.includes('production sequence 400'),
    `Expected production sequence 400 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-year-sequence-7-digit',
    `Expected Cort year-sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortLate1990s8Digit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1999', `Expected year 1999 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'December', `Expected month December for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort Korea (Incheon or Daejeon)',
    `Expected Cort Korea (Incheon or Daejeon) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-late-1990s-8-digit-yymm-sequence',
    `Expected Cort late-1990s 8-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 2466'),
    `Expected Cort late-1990s 8-digit rich text for ${serialInput}`
  );
}

function assertCortModern8DigitYearBatch(serialInput, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort (location varies - Korea, Indonesia, or China)',
    `Expected variable Cort factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Korea, Indonesia, or China', `Expected variable country for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-modern-8-digit-year-batch-sequence',
    `Expected Cort modern 8-digit year/batch pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortModern2000sYearSequence(serialInput, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(!info.month, `Expected no month for ${serialInput}, got ${info.month}`);
  assert(
    info.notes && info.notes.includes('production sequence 514001'),
    `Expected production sequence 514001 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-modern-2000s-y0-year-sequence',
    `Expected Cort Y0 year-sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortModernAlphaFactoryLine(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort modern factory/production line',
    `Expected Cort modern factory/production line for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes('Production sequence: 70842'),
    `Expected production sequence 70842 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-modern-alphanumeric-factory-line-yymm-sequence',
    `Expected Cort alphanumeric pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortModernTwoLetterFactoryLine(serialInput, expectedYear, expectedMonth, expectedSequence) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    typeof info.factory === 'string' && info.factory.length > 0,
    `Expected non-empty factory for ${serialInput}, got ${info.factory}`
  );
  assert(
    info.notes && info.notes.includes(`Production sequence: ${expectedSequence}`),
    `Expected production sequence ${expectedSequence} for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-modern-two-letter-factory-line-yymm-sequence',
    `Expected Cort two-letter pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortModern9DigitModelYear(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort (location varies - Korea, Indonesia, or China)',
    `Expected variable Cort factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Korea, Indonesia, or China', `Expected variable country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Production sequence: 27182'),
    `Expected production sequence 27182 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-modern-9-digit-yymm-sequence',
    `Expected Cort modern 9-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortModern12DigitTracking(serialInput, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort (location varies - Korea, Indonesia, or China)',
    `Expected variable Cort factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Korea, Indonesia, or China', `Expected variable country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('Tracking/batch sequence: 0000050443'),
    `Expected tracking sequence 0000050443 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-modern-12-digit-year-tracking-sequence',
    `Expected Cort modern 12-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortRPrefixYearSequence(serialInput, expectedCorrected, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.serialNumber === expectedCorrected, `Expected serialNumber ${expectedCorrected}, got ${info.serialNumber}`);
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cor-Tek/Cort R-prefix production line or factory',
    `Expected Cort R-prefix factory guidance for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Korea, Indonesia, or China', `Expected variable country for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 11374'),
    `Expected R-prefix production sequence 11374 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-r-prefix-yy-sequence',
    `Expected Cort R-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 2006'),
    `Expected Cort R-prefix rich text for ${serialInput}`
  );
}

function assertCort1980sKorea7Digit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1988', `Expected year 1988 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort Korea (Incheon)',
    `Expected Cort Korea (Incheon) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('sequence 8046'),
    `Expected sequence 8046 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-1980s-korea-7-digit-yy-sequence',
    `Expected Cort 1980s Korea pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production year 1988'),
    `Expected Cort 1980s Korea rich text for ${serialInput}`
  );
}

function assertCortVintageWOW0Prefix(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1984-1989 (estimated)', `Expected estimated 1984-1989 era for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Cort / Cor-Tek Korea', `Expected Cort / Cor-Tek Korea for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence (20881)'),
    `Expected production sequence 20881 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-vintage-wo-w0-korea-sequence',
    `Expected Cort W.O./W0 pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('vintage Cort W.O./W0-prefix'),
    `Expected Cort W.O./W0 rich text for ${serialInput}`
  );
}

function assertCortEarly1980sFiveDigit(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1982', `Expected year 1982 for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Cor-Tek Korea', `Expected Cor-Tek Korea for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 881'),
    `Expected production sequence 881 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-early-1980s-5-digit-neck-plate',
    `Expected Cort early 1980s 5-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('neck-plate stamped instruments'),
    `Expected Cort early 1980s 5-digit rich text for ${serialInput}`
  );
}

function assertCortVintage1990s7DigitYYMM(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1992', `Expected year 1992 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'February', `Expected month February for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'Cort Korea (Incheon or Daejeon)',
    `Expected Cort Korea (Incheon or Daejeon) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    info.notes && info.notes.includes('production sequence 539'),
    `Expected production sequence 539 for ${serialInput}, got ${info.notes}`
  );
  assert(
    result.patternKey === 'cort-vintage-1990s-7-digit-yymm-sequence',
    `Expected Cort vintage 1990s 7-digit YYMM pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortEarly1990s7DigitYearSequence(serialInput) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === '1990', `Expected year 1990 for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort Korea (Incheon or Daejeon)',
    `Expected Cort Korea (Incheon or Daejeon) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-early-1990s-7-digit-yy-sequence',
    `Expected Cort early 1990s YY sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCortIIAIndonesia(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'PT Cort Indonesia (IIA facility)',
    `Expected PT Cort Indonesia (IIA facility) for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-iia-indonesia-yymm-sequence',
    `Expected cort-iia-indonesia-yymm-sequence pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertCort1990s7DigitAnomalousMonth(serialInput, expectedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cort Korea (Incheon or Daejeon)',
    `Expected Cort Korea factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'South Korea', `Expected South Korea for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'cort-1990s-ymm-sequence-7-digit',
    `Expected cort-1990s-ymm-sequence-7-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContext && result.additionalContext.highlights &&
      result.additionalContext.highlights.some(h => h.includes('anomalous')),
    `Expected anomalous month highlight for ${serialInput}`
  );
}

function assertCort8DigitSuspiciousFutureYear(serialInput, expectedDecodedYear) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(
    info.year && info.year.includes(expectedDecodedYear.toString()) && info.year.includes('impossible'),
    `Expected year to include ${expectedDecodedYear} and 'impossible' for ${serialInput}, got ${info.year}`
  );
  assert(
    result.patternKey === 'cort-8digit-suspicious-future-year',
    `Expected cort-8digit-suspicious-future-year pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('impossible'),
    `Expected suspicious rich text for ${serialInput}`
  );
}

export function runTests() {
  assertCortIEPrefix('ie220403666', '2022', 'April');
  assertCortAIPrefix('AI200750591', '2020', 'July');
  assertCortICSEPrefix('ICSE21003319');
  assertCortIATransposedPrefix('IA200750591', 'AI200750591', '2020', 'July');
  assertCortYearSequence7Digit('0000400');
  assertCortLate1990s8Digit('99122466');
  assertCortModern8DigitYearBatch('20002219', '2020');
  assertCortModern2000sYearSequence('70514001', '2007');
  assertCortModernAlphaFactoryLine('1A241070842', '2024', 'October');
  assertCortModernTwoLetterFactoryLine('CA250624068', '2025', 'June', '24068');
  assertCortModernTwoLetterFactoryLine('CD06121547', '2006', 'December', '1547');
  assertCortModern9DigitModelYear('270327182', '2027', 'March');
  assertCortModern12DigitTracking('210000050443', '2021');
  assertCortRPrefixYearSequence('R 0611374', 'R0611374', '2006');
  assertCort1980sKorea7Digit('8808046');
  assertCortVintageWOW0Prefix('W0 20881');
  assertCortEarly1980sFiveDigit('20881');
  assertCortVintage1990s7DigitYYMM('9202539');
  assertCortEarly1990s7DigitYearSequence('9000895');
  assertCortIIAIndonesia('IIA241190604', '2024', 'November');
  assertCort1990s7DigitAnomalousMonth('5591410', '1995');
  assertCort8DigitSuspiciousFutureYear('52030600', 2052);
  assertCortModern10DigitYYMM('0404704234', '2004', 'April');
}

function assertCortModern10DigitYYMM(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('cort', serialInput);
  assert(result.success, `Expected decode success for cort:${serialInput}`);
  assert(result.info, `Expected decoded info for cort:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    result.patternKey === 'cort-modern-10-digit-yymm-sequence',
    `Expected 10-digit YYMM pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 704234'),
    `Expected production sequence 704234 in rich text for ${serialInput}`
  );
}
