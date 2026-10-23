import { describe, expect, it } from "vitest";
import { absoluteUrl, siteUrl } from "./site";

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL first, without a trailing slash", () => {
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: " https://kktrading.ph/ ",
        VERCEL_PROJECT_PRODUCTION_URL: "kk-trading.vercel.app",
      }),
    ).toBe("https://kktrading.ph");
  });

  it("falls back to Vercel's production domain, then localhost", () => {
    expect(
      siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "kk-trading.vercel.app" }),
    ).toBe("https://kk-trading.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});

describe("absoluteUrl", () => {
  it("joins a path onto the site", () => {
    expect(absoluteUrl("/products/desk", "https://kktrading.ph")).toBe(
      "https://kktrading.ph/products/desk",
    );
    expect(absoluteUrl("/", "https://kktrading.ph")).toBe(
      "https://kktrading.ph/",
    );
  });
});
