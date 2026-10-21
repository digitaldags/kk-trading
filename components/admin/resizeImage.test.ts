import { describe, expect, it } from "vitest";
import {
  fitWithin,
  ImageFileError,
  MAX_IMAGE_SIDE,
  NOT_AN_IMAGE,
  resizeImage,
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
