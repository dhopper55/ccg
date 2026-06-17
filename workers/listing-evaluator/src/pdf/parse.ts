import type { PdfImageAsset } from './types.js';
import { concatenatePdfParts } from './utils.js';

export function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

export function isPngBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export function parseJpegPdfAsset(bytes: Uint8Array): PdfImageAsset | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;

    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      const bitsPerComponent = bytes[offset + 2];
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const components = bytes[offset + 7];
      const colorSpace =
        components === 1 ? '/DeviceGray' : components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      return {
        width,
        height,
        colorSpace,
        bitsPerComponent,
        filter: '/DCTDecode',
        data: bytes,
      };
    }

    offset += length;
  }

  return null;
}

export function parsePngPdfAsset(bytes: Uint8Array): PdfImageAsset | null {
  if (!isPngBytes(bytes)) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compression = 0;
  let filter = 0;
  let interlace = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = readUint32Be(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null;

    if (type === 'IHDR') {
      width = readUint32Be(bytes, dataStart);
      height = readUint32Be(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      compression = bytes[dataStart + 10];
      filter = bytes[dataStart + 11];
      interlace = bytes[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(bytes.slice(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || idatChunks.length < 1) return null;
  if (compression !== 0 || filter !== 0 || interlace !== 0 || bitDepth !== 8) return null;

  if (colorType === 0) {
    return {
      width,
      height,
      colorSpace: '/DeviceGray',
      bitsPerComponent: 8,
      filter: '/FlateDecode',
      decodeParms: `<< /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ${width} >>`,
      data: concatenatePdfParts(idatChunks),
    };
  }

  if (colorType === 2) {
    return {
      width,
      height,
      colorSpace: '/DeviceRGB',
      bitsPerComponent: 8,
      filter: '/FlateDecode',
      decodeParms: `<< /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${width} >>`,
      data: concatenatePdfParts(idatChunks),
    };
  }

  return null;
}

export function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}
