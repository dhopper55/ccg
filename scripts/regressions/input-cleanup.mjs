import { assert, decodeSerialForBackend } from './shared.mjs';

function assertCleanedDecode(brandInput, serialInput, expectedSerial, expectedYear) {
  const result = decodeSerialForBackend(brandInput, serialInput);
  assert(result.success, `Expected cleaned decode success for ${brandInput}:${serialInput}`);
  assert(
    result.info?.serialNumber === expectedSerial,
    `Expected ${serialInput} to be read as ${expectedSerial}, got ${result.info?.serialNumber}`
  );
  assert(result.info?.year === expectedYear, `Expected year ${expectedYear} for ${serialInput}, got ${result.info?.year}`);
}

function assertStillFails(brandInput, serialInput) {
  const result = decodeSerialForBackend(brandInput, serialInput);
  assert(!result.success, `Expected decode failure for ${brandInput}:${serialInput}, got ${result.info?.serialNumber} ${result.info?.year}`);
}

export function runTests() {
  // Letter O typed for zero next to digits (real failed lookups).
  assertCleanedDecode('fender', 'NO14079', 'N014079', '1990');
  assertCleanedDecode('squier', 'Cyo2o43560', 'CY02043560', '2002');
  assertCleanedDecode('squier', 'ICO3O111987', 'IC030111987', '2003');

  // Leading 1 typed for the I of Indonesian IC/ICS/ISS prefixes, combined with an O for zero.
  assertCleanedDecode('fender', '1cso9003233', 'ICS09003233', '2009');
  assertCleanedDecode('squier', '1ssd25001760', 'ISSD25001760', '2025');

  // "S/N" labels and surrounding words.
  assertCleanedDecode('fender', 'S/n1cs09003233', 'ICS09003233', '2009');
  assertCleanedDecode('squier', 'Sn/ics11119724', 'ICS11119724', '2011');
  assertCleanedDecode('fender', '359178 usa', '359178', '1969-1972');

  // Cyrillic letters that look identical to Latin ones.
  assertCleanedDecode('squier', 'СY090800817', 'СY090800817'.replace('С', 'C'), '2009');

  // Cleanup must not invent serials from unrelated text.
  assertStillFails('fender', "US1234' OR '1'='1");
  assertStillFails('fender', 'Fender F-260S');
  assertStillFails('gibson', 'es330td');
}
