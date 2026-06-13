import { decodeSerialForBackend } from '../../dist/serial-decode-service.js';

export { decodeSerialForBackend };

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertDecodeFails(brandInput, serialInput) {
  const result = decodeSerialForBackend(brandInput, serialInput);
  assert(!result.success, `Expected decode failure for ${brandInput}:${serialInput}`);
  assert(
    result.error === 'Unable to decode this serial number.',
    `Expected generic decode failure message for ${brandInput}:${serialInput}, got ${result.error}`
  );
}
