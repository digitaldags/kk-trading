import { describe, expect, it } from "vitest";
import { logoDisplaySize } from "./logo";

describe("logoDisplaySize", () => {
  it("shows a square logo at 40 × 40", () => {
    expect(logoDisplaySize(512, 512)).toEqual({ width: 40, height: 40 });
  });

  it("keeps a 4:1 logo at full height, 160 wide", () => {
    expect(logoDisplaySize(400, 100)).toEqual({ width: 160, height: 40 });
  });

  it("shrinks a wider logo to 160 wide", () => {
    expect(logoDisplaySize(1000, 100)).toEqual({ width: 160, height: 16 });
  });

  it("keeps a tall logo 40 high", () => {
    expect(logoDisplaySize(100, 200)).toEqual({ width: 20, height: 40 });
  });

  it("never rounds a side down to 0", () => {
    expect(logoDisplaySize(20_000, 1)).toEqual({ width: 160, height: 1 });
    expect(logoDisplaySize(1, 20_000)).toEqual({ width: 1, height: 40 });
  });

  it("uses the icon tile's 40 × 40 box for a logo saved without a size", () => {
    expect(logoDisplaySize(null, null)).toEqual({ width: 40, height: 40 });
  });
});
