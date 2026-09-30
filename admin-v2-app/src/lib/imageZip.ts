const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Build an uncompressed (store) ZIP archive from in-memory files.
function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Array<{ offset: number; header: Uint8Array }> = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // compression: store
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0, true); // mod date
    const crc = crc32(file.data);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true); // compressed size
    view.setUint32(22, file.data.length, true); // uncompressed size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // extra field length
    localHeader.set(nameBytes, 30);

    const offset = parts.reduce((s, p) => s + p.length, 0);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralHeader.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true);
    cView.setUint16(6, 20, true);
    cView.setUint16(8, 0, true);
    cView.setUint16(10, 0, true);
    cView.setUint16(12, 0, true);
    cView.setUint16(14, 0, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, file.data.length, true);
    cView.setUint32(24, file.data.length, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);
    cView.setUint16(32, 0, true);
    cView.setUint16(34, 0, true);
    cView.setUint16(36, 0, true);
    cView.setUint32(38, 0, true);
    cView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    directory.push({ offset, header: centralHeader });
    parts.push(localHeader);
    parts.push(file.data);
  }

  const centralStart = parts.reduce((s, p) => s + p.length, 0);
  for (const entry of directory) {
    parts.push(entry.header);
  }
  const centralSize = parts.reduce((s, p) => s + p.length, 0) - centralStart;

  const endRecord = new Uint8Array(22);
  const eView = new DataView(endRecord.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, directory.length, true);
  eView.setUint16(10, directory.length, true);
  eView.setUint32(12, centralSize, true);
  eView.setUint32(16, centralStart, true);
  eView.setUint16(20, 0, true);
  parts.push(endRecord);

  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const zipBuffer = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of parts) {
    zipBuffer.set(part, pos);
    pos += part.length;
  }
  return zipBuffer;
}

// Fetch each image URL and download them together as a ZIP. Images that fail to
// fetch are skipped. Returns the number of images included.
export async function downloadImagesAsZip(imageUrls: string[], filename: string): Promise<number> {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const res = await fetch(imageUrls[i]);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const ct = res.headers.get('content-type') || '';
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
      files.push({ name: `image-${i + 1}.${ext}`, data: new Uint8Array(buf) });
    } catch { /* skip failed images */ }
  }
  if (files.length === 0) return 0;

  const blob = new Blob([buildZip(files).buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return files.length;
}
