export type AiImagePayload = { mediaType: string; data: string };

// Longest edge sent to Claude; larger photos only cost more tokens without adding detail.
const AI_IMAGE_MAX_EDGE = 1568;
const AI_IMAGE_JPEG_QUALITY = 0.85;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function downscaleToJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, AI_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Unable to encode image.'))),
        'image/jpeg',
        AI_IMAGE_JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}

// Fetch each image URL (same sources as the ZIP download), downscale it to a JPEG and
// return base64 payloads for the AI photo analysis. Images that fail are skipped.
export async function fetchImagesForAi(imageUrls: string[]): Promise<AiImagePayload[]> {
  const results = await Promise.all(imageUrls.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const jpeg = await downscaleToJpeg(await res.blob());
      return { mediaType: 'image/jpeg', data: await blobToBase64(jpeg) };
    } catch {
      return null;
    }
  }));
  return results.filter((image): image is AiImagePayload => image !== null);
}
