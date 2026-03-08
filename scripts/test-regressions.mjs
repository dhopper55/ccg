import { decodeIbanez } from '../dist/decoders/ibanez.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

function assertIbanezExistingSamples() {
  const samples = ['F0712345', 'F523456', 'I120426682', 'GS140406094'];

  for (const sample of samples) {
    const result = decodeIbanez(sample);
    assert(result.success, `Expected decode success for ${sample}`);
    assert(result.info, `Expected decoded info for ${sample}`);
  }
}

assertIbanezBPrefix('B160100231');
assertIbanezBPrefix('B-160100231');
assertIbanez5BPrefix('5B160100231');
assertIbanez5BPrefix('5B-160100231');
assertIbanezExistingSamples();

console.log('Regression tests passed.');
