// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fitWithin,
  ImageFileError,
  MAX_IMAGE_SIDE,
  NOT_AN_IMAGE,
  readImageSize,
  resizeImage,
  UNREADABLE_IMAGE,
} from "./resizeImage";

describe("fitWithin", () => {
  it("scales the long side down to the limit, keeping the shape", () => {
    expect(fitWithin(4000, 3000, MAX_IMAGE_SIDE)).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(fitWithin(1000, 5000, MAX_IMAGE_SIDE)).toEqual({
      width: 320,
      height: 1600,
    });
  });

  it("never scales a small image up", () => {
    expect(fitWithin(800, 600, MAX_IMAGE_SIDE)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("keeps at least one pixel on each side", () => {
    expect(fitWithin(10000, 1, MAX_IMAGE_SIDE)).toEqual({
      width: 1600,
      height: 1,
    });
  });
});

describe("resizeImage", () => {
  it("refuses a file that isn't an image", async () => {
    const pdf = new File(["%PDF"], "spec.pdf", { type: "application/pdf" });
    await expect(resizeImage(pdf)).rejects.toThrow(
      new ImageFileError(NOT_AN_IMAGE),
    );
  });
});

describe("resizeImage with a file createImageBitmap refuses (BUG-02)", () => {
  const WIDTH = 10;
  const HEIGHT = 100;
  const webp = new Blob(["webp"], { type: "image/webp" });
  const png = new File(["png"], "cut-off.png", { type: "image/png" });

  const createImageBitmap = vi.fn();
  const revokeObjectURL = vi.fn();
  let imagesLoaded: number;
  let imageSize: { width: number; height: number } | "error";
  let decoded: number;

  /** Stands in for <img>, which jsdom never loads. */
  class FakeImage {
    onload?: () => void;
    onerror?: () => void;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(_url: string) {
      imagesLoaded++;
      if (imageSize === "error") {
        queueMicrotask(() => this.onerror?.());
        return;
      }
      this.naturalWidth = imageSize.width;
      this.naturalHeight = imageSize.height;
      queueMicrotask(() => this.onload?.());
    }
  }

  beforeEach(() => {
    imagesLoaded = 0;
    imageSize = { width: WIDTH, height: HEIGHT };
    decoded = HEIGHT;
    createImageBitmap.mockReset();
    createImageBitmap.mockRejectedValue(new Error("could not be decoded"));
    revokeObjectURL.mockReset();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    vi.stubGlobal("Image", FakeImage);
    URL.createObjectURL = vi.fn(() => "blob:cut-off");
    URL.revokeObjectURL = revokeObjectURL;

    // jsdom has no canvas. Rows below `decoded` are transparent, as <img> leaves them.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        data.fill(255, 0, Math.min(decoded, h) * w * 4);
        return { data };
      },
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(webp),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("re-encodes what <img> could decode", async () => {
    decoded = HEIGHT - 1;
    await expect(resizeImage(png)).resolves.toBe(webp);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cut-off");
  });

  it("keeps a file with exactly the rows it needs", async () => {
    decoded = 98;
    await expect(resizeImage(png)).resolves.toBe(webp);
  });

  it("refuses a file with too little of it decoded", async () => {
    decoded = 97;
    await expect(resizeImage(png)).rejects.toThrow(
      new ImageFileError(UNREADABLE_IMAGE),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cut-off");
  });

  it("refuses a file that loads as a blank image", async () => {
    decoded = 0;
    await expect(resizeImage(png)).rejects.toThrow(
      new ImageFileError(UNREADABLE_IMAGE),
    );
  });

  it("refuses a file <img> can't load either", async () => {
    imageSize = "error";
    await expect(resizeImage(png)).rejects.toThrow(
      new ImageFileError(UNREADABLE_IMAGE),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cut-off");
  });

  it("refuses an image with no size", async () => {
    imageSize = { width: 0, height: 0 };
    await expect(resizeImage(png)).rejects.toThrow(
      new ImageFileError(UNREADABLE_IMAGE),
    );
  });

  it("refuses an SVG without trying <img>", async () => {
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    await expect(resizeImage(svg)).rejects.toThrow(
      new ImageFileError(UNREADABLE_IMAGE),
    );
    expect(imagesLoaded).toBe(0);
  });

  it("doesn't use <img> for a file createImageBitmap reads", async () => {
    const close = vi.fn();
    createImageBitmap.mockResolvedValue({
      width: WIDTH,
      height: HEIGHT,
      close,
    });
    await expect(resizeImage(png)).resolves.toBe(webp);
    expect(imagesLoaded).toBe(0);
    expect(close).toHaveBeenCalled();
  });

  it("keeps refusing the same file as a logo, which isn't re-encoded", async () => {
    await expect(readImageSize(png)).rejects.toThrow(
      new ImageFileError(UNREADABLE_IMAGE),
    );
    expect(imagesLoaded).toBe(0);
  });
});
