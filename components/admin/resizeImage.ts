// Product photos are resized in the browser before upload (ticket 10): at most 1600px on
// the long side, as WebP at quality 0.82. Browsers that can't encode WebP get JPEG.

export const MAX_IMAGE_SIDE = 1600;
export const IMAGE_QUALITY = 0.82;

export const NOT_AN_IMAGE = "Choose an image file (JPG, PNG or WebP).";
export const UNREADABLE_IMAGE =
  "That image couldn't be read. Try a JPG or PNG.";

/** Thrown with copy that can be shown under the Photo field as is. */
export class ImageFileError extends Error {}

/** Scales `width` × `height` down to fit within `max` on the long side. Never scales up. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new ImageFileError(NOT_AN_IMAGE);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageFileError(UNREADABLE_IMAGE);
  }

  try {
    const { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      MAX_IMAGE_SIDE,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageFileError(UNREADABLE_IMAGE);

    context.drawImage(bitmap, 0, 0, width, height);
    const webp = await toBlob(canvas, "image/webp");
    if (webp?.type === "image/webp") return webp;

    // JPEG has no transparency: put the photo on white, as the prototype did.
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    const jpeg = await toBlob(canvas, "image/jpeg");
    if (jpeg) return jpeg;
    throw new ImageFileError(UNREADABLE_IMAGE);
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, IMAGE_QUALITY),
  );
}
