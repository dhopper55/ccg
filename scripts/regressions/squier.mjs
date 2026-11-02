import { assert, decodeSerialForBackend } from './shared.mjs';

function assertSquierSNLabelStripped(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Cor-Tek (Cort)',
    `Expected Cor-Tek (Cort) factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${info.country}`);
}

function assertSquierChinaSE9Digit(serialInput, expectedYear, expectedMonth) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China Strat Pack / SE production',
    `Expected China Strat Pack / SE production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Squier Strat SE (Special Edition)',
    `Expected Squier Strat SE model for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'squier-china-se-9-digit-yymm-sequence',
    `Expected Squier SE 9-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierChinaSE8Digit2004(serialInput, expectedMonth) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === '2004', `Expected year 2004 for ${serialInput}, got ${info.year}`);
  assert(info.month === expectedMonth, `Expected month ${expectedMonth} for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China Strat Pack / SE production',
    `Expected China Strat Pack / SE production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    info.model === 'Squier Strat SE (Special Edition)',
    `Expected Squier Strat SE model for ${serialInput}, got ${info.model}`
  );
  assert(
    result.patternKey === 'squier-china-se-2004-8-digit-yymm-sequence',
    `Expected Squier SE 2004 8-digit pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierChinaCPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(
    info.factory === 'Yako / Chinese Squier production',
    `Expected Yako / Chinese Squier production for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'squier-china-c-prefix-yy-sequence',
    `Expected Squier China C-prefix pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierIndonesiaICSYear(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);

  const info = result.info;
  assert(info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${info.year}`);
  assert(info.factory === 'Cor-Tek (Cort)', `Expected Cor-Tek (Cort) for ${serialInput}, got ${info.factory}`);
  assert(info.country === 'Indonesia', `Expected Indonesia for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'squier-indonesia-ics-yy-sequence',
    `Expected Squier ICS YY pattern key for ${serialInput}, got ${result.patternKey}`
  );
}

function assertSquierNumericOnly8DigitRejected(serialInput) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(!result.success, `Expected decode failure for squier:${serialInput}`);
  assert(
    result.error?.includes('Eight-digit numeric-only Squier serials are not a standard supported pattern'),
    `Expected Squier 8-digit numeric-only rejection for ${serialInput}, got ${result.error}`
  );
}

function assertSquierChinaCRN(serialInput) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for Squier ${serialInput}`);
  assert(result.info, `Expected decoded info for Squier ${serialInput}`);

  const info = result.info;
  assert(info.year === '2026', `Expected year 2026 for ${serialInput}, got ${info.year}`);
  assert(info.month === 'January', `Expected month January for ${serialInput}, got ${info.month}`);
  assert(
    info.factory === 'China RN contracted facility',
    `Expected China RN factory for ${serialInput}, got ${info.factory}`
  );
  assert(info.country === 'China', `Expected China for ${serialInput}, got ${info.country}`);
  assert(
    result.patternKey === 'squier-china-crn-month-letter-yy-sequence',
    `Expected CRN pattern key for ${serialInput}, got ${result.patternKey}`
  );
  assert(
    result.additionalContextRichText && result.additionalContextRichText.includes('production sequence 7293'),
    `Expected production sequence 7293 in rich text for ${serialInput}`
  );
}

export function runTests() {
  assertSquierSNLabelStripped('S/nics10042349', '2010');
  assertSquierChinaSE9Digit('040811254', '2004', 'August');
  assertSquierChinaSE8Digit2004('04090431', 'September');
  assertSquierChinaCPrefix('c004039', '2000');
  assertSquierIndonesiaICSYear('ICS18291833', '2018');
  assertSquierNumericOnly8DigitRejected('05021913');
  assertSquierChinaCRN('crna26007293');
  assertSquierChinaCYFutureYearRemap('CY31117497', '2003');
  assertSquierChinaCYWithSnPrefix('s/n CY31117497', '2003');

  // Researched formats from the failed-lookup backlog
  assertSquierDecodes('CGRD20000107', { year: '2020', month: 'April', factory: 'Grand Reward', country: 'China', patternKey: 'squier-china-cgr-month-letter-yy-sequence' });
  assertSquierDecodes('CGRA20000465', { year: '2020', month: 'January', patternKey: 'squier-china-cgr-month-letter-yy-sequence' });
  assertSquierDecodes('CGRK08002342', { year: '2008', month: 'November', patternKey: 'squier-china-cgr-month-letter-yy-sequence' });
  assertSquierDecodes('cgrj08000189', { year: '2008', month: 'October' });
  assertSquierDecodes('CMYJ21000429', { year: '2021', month: 'October', country: 'China', patternKey: 'squier-china-cmy-month-letter-yy-sequence' });
  assertSquierDecodes('CMYI18003092', { year: '2018', month: 'September' });
  assertSquierDecodes('Cmya20000038', { year: '2020', month: 'January' });
  assertSquierDecodes('CMHC21007456', { year: '2021', month: 'March', factory: 'Muse factory, China', patternKey: 'squier-china-cmh-month-letter-yy-sequence' });
  assertSquierDecodes('CGF1204565', { year: '2012', factory: 'Grand Reward', patternKey: 'squier-china-cgf-yy-sequence' });
  assertSquierDecodes('cd98111516', { year: '1998', factory: 'Dalian Dong Fang', country: 'China', patternKey: 'squier-china-cd-yy-sequence' });
  assertSquierDecodes('SH07069939', { year: '2007-2008', country: 'India', patternKey: 'squier-india-sh-yy-sequence' });
  assertSquierDecodes('L011362', { year: '1991-1992', country: 'Japan', patternKey: 'squier-japan-mij-letter-sequence' });
  assertSquierDecodes('M036538', { year: '1992-1993', country: 'Japan', patternKey: 'squier-japan-mij-letter-sequence' });
  assertSquierDecodes('V030619', { year: '1996-1997', country: 'Japan', patternKey: 'squier-japan-mij-letter-sequence' });
  assertSquierDecodes('N02065', { year: '1995-1996', country: 'Japan', patternKey: 'squier-japan-mij-letter-sequence' });
  assertSquierDecodes('ISS2018958', { year: '2020', factory: 'Samick', country: 'Indonesia', patternKey: 'squier-indonesia-iss-yy-sequence' });

  // Lookalikes that must still fail
  for (const serial of [
    'CMY118003092', // no month letter
    'CMY20000985', // no month letter
    'CMYJ2000', // truncated
    'CGRM20000107', // M is not a month letter
    'CGRD15000107', // CGR + letter only documented for 2008-09 and 2020+
    'CHRG08003234', // CHR is not a documented prefix
    'CKYE23004623', // CKY undocumented
    'CFSC2203545', // CFS undocumented
    'CGF1004565', // CGF documented 2011-2014 only
    'CD05111516', // CD documented 1998-1999 only
    'SH12069939', // SH documented 2007-2008 only
    'NHS1032925', // NHS10 is documented with 6 digits
    'W122811',
    'ISS2118958', // ISS + YY + 5 digits documented for 2019-2020 only
  ]) {
    assertSquierFails(serial);
  }
}

function assertSquierDecodes(serialInput, expected) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);
  for (const [key, value] of Object.entries(expected)) {
    const actual = key === 'patternKey' ? result.patternKey : result.info[key];
    assert(actual === value, `Expected ${key} ${value} for ${serialInput}, got ${actual}`);
  }
}

function assertSquierFails(serialInput) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(!result.success, `Expected decode failure for squier:${serialInput}, got ${JSON.stringify(result.info)}`);
}

function assertSquierChinaCYFutureYearRemap(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'China', `Expected China for ${serialInput}, got ${result.info.country}`);
}

function assertSquierChinaCYWithSnPrefix(serialInput, expectedYear) {
  const result = decodeSerialForBackend('squier', serialInput);
  assert(result.success, `Expected decode success for squier:${serialInput}`);
  assert(result.info, `Expected decoded info for squier:${serialInput}`);
  assert(result.info.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info.year}`);
  assert(result.info.country === 'China', `Expected China for ${serialInput}, got ${result.info.country}`);
}
