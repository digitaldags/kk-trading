// Product photos are resized in the browser before upload (ticket 10): at most 1600px on
// the long side, as WebP at quality 0.82. Browsers that can't encode WebP get JPEG.

export const MAX_IMAGE_SIDE = 1600;
export const IMAGE_QUALITY = 0.82;
/** The share of its rows a damaged file must still have to be used (BUG-02). */
export const MIN_DECODED_ROWS = 0.98;

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

/**
 * An image's size in pixels, read in the browser. The store logo keeps its file as is,
 * but its size is saved so the storefront app bar can reserve its box (ticket 40).
 * Stricter than resizeImage on purpose: a logo isn't re-encoded, and sharp, behind
 * next/image, refuses a file that stops early, so it stays refused here in admin.
 */
export async function readImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageFileError(UNREADABLE_IMAGE);
  }
  const { width, height } = bitmap;
  bitmap.close();
  if (!width || !height) throw new ImageFileError(UNREADABLE_IMAGE);
  return { width, height };
}

export async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new ImageFileError(NOT_AN_IMAGE);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return resizeDamagedImage(file);
  }

  try {
    return await encode(drawFitted(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

/**
 * createImageBitmap refuses a file that stops early, but <img> shows what it could decode
 * (BUG-02: a phone screenshot missing its last 305 bytes). Re-encoding gives a clean file.
 * <img> also "loads" a file with almost nothing in it, as a blank image of the full size,
 * so what was decoded is measured. It loads SVG too, which createImageBitmap never does.
 */
async function resizeDamagedImage(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml") throw new ImageFileError(UNREADABLE_IMAGE);

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = drawFitted(image, image.naturalWidth, image.naturalHeight);
    if (decodedRows(canvas) / canvas.height < MIN_DECODED_ROWS) {
      throw new ImageFileError(UNREADABLE_IMAGE);
    }
    return await encode(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth && image.naturalHeight
        ? resolve(image)
        : reject(new ImageFileError(UNREADABLE_IMAGE));
    image.onerror = () => reject(new ImageFileError(UNREADABLE_IMAGE));
    image.src = url;
  });
}

function drawFitted(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) {
  const { width, height } = fitWithin(
    sourceWidth,
    sourceHeight,
    MAX_IMAGE_SIDE,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageFileError(UNREADABLE_IMAGE);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** How many rows there are down to the last one with a pixel that isn't transparent. */
function decodedRows(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, width, height);
  for (let row = height - 1; row >= 0; row--) {
    for (let x = 0; x < width; x++) {
      if (data[(row * width + x) * 4 + 3]) return row + 1;
    }
  }
  return 0;
}

async function encode(canvas: HTMLCanvasElement) {
  const webp = await toBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;

  // JPEG has no transparency: put the photo on white, as the prototype did.
  const context = canvas.getContext("2d")!;
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const jpeg = await toBlob(canvas, "image/jpeg");
  if (jpeg) return jpeg;
  throw new ImageFileError(UNREADABLE_IMAGE);
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, IMAGE_QUALITY),
  );
}
