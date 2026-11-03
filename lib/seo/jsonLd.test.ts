import { describe, expect, it } from "vitest";
import type { ProductWithCategory, StoreSettings } from "@/lib/domain/types";
import {
  productDescription,
  productJsonLd,
  schemaPrice,
  serializeJsonLd,
  storeJsonLd,
} from "./jsonLd";

const at = new Date("2026-01-01T00:00:00Z");

const BENCH: ProductWithCategory = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "adjustable-fid-bench",
  categoryId: "00000000-0000-4000-8000-0000000000c1",
  name: "Adjustable FID bench",
  code: "KK-BENCH-01",
  uom: "unit",
  specs: "",
  priceCentavos: 545000,
  stockStatus: "low_stock",
  keySpec: "7 back positions",
  description: "Flat, incline and decline.",
  imageUrl: "https://store.public.blob.vercel-storage.com/products/bench.webp",
  imagePathname: "products/bench.webp",
  isSample: false,
  sortOrder: 0,
  createdAt: at,
  updatedAt: at,
  category: {
    id: "00000000-0000-4000-8000-0000000000c1",
    slug: "gym",
    name: "Gym equipment",
    icon: "fitness_center",
    sortOrder: 1,
  },
};

const SETTINGS: StoreSettings = {
  name: "KK Trading",
  slogan: "",
  logoUrl: null,
  logoPathname: null,
  logoWidth: null,
  logoHeight: null,
  phone2: "",
  headline: "Equipment for the desk and the gym",
  tagline: "Office furniture and fitness gear.",
  phone: "0917 000 0000",
  email: "hello@example.com",
  address: "Quezon City",
  updatedAt: at,
};

const URL = "https://kktrading.ph/products/adjustable-fid-bench";

describe("productJsonLd", () => {
  it("describes a Product with a PHP offer and its availability", () => {
    expect(productJsonLd(BENCH, { url: URL, storeName: "KK Trading" })).toEqual(
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Adjustable FID bench",
        description: "Flat, incline and decline.",
        sku: "adjustable-fid-bench",
        category: "Gym equipment",
        image: [BENCH.imageUrl],
        url: URL,
        offers: {
          "@type": "Offer",
          url: URL,
          price: "5450.00",
          priceCurrency: "PHP",
          availability: "https://schema.org/LimitedAvailability",
          seller: { "@type": "Organization", name: "KK Trading" },
        },
      },
    );
  });

  it("maps each stock status, and leaves out a missing photo", () => {
    const availability = (stockStatus: ProductWithCategory["stockStatus"]) =>
      productJsonLd(
        { ...BENCH, stockStatus },
        { url: URL, storeName: "KK Trading" },
      ).offers.availability;
    expect(availability("in_stock")).toBe("https://schema.org/InStock");
    expect(availability("out_of_stock")).toBe("https://schema.org/OutOfStock");

    const noPhoto = productJsonLd(
      { ...BENCH, imageUrl: null, description: "" },
      { url: URL, storeName: "KK Trading" },
    );
    expect(noPhoto).not.toHaveProperty("image");
    expect(noPhoto.description).toBe("7 back positions · ₱5,450");
  });
});

describe("storeJsonLd", () => {
  it("describes the Store with its contact details", () => {
    expect(
      storeJsonLd(SETTINGS, {
        url: "https://kktrading.ph/",
        image: "https://kktrading.ph/opengraph-image",
      }),
    ).toMatchObject({
      "@type": "Store",
      name: "KK Trading",
      telephone: "0917 000 0000",
      email: "hello@example.com",
      address: "Quezon City",
    });
  });

  it("leaves out contact details that are blank", () => {
    const data = storeJsonLd(
      { ...SETTINGS, phone: "", address: "" },
      { url: "https://kktrading.ph/", image: "https://kktrading.ph/og" },
    );
    expect(data).not.toHaveProperty("telephone");
    expect(data).not.toHaveProperty("address");
  });

  it("names the published logo, and leaves logo out without one", () => {
    const page = {
      url: "https://kktrading.ph/",
      image: "https://kktrading.ph/og",
    };
    const logoUrl =
      "https://store.public.blob.vercel-storage.com/branding/kk.png";
    expect(
      storeJsonLd(
        { ...SETTINGS, logoUrl, logoWidth: 400, logoHeight: 100 },
        page,
      ),
    ).toMatchObject({ logo: logoUrl, image: page.image });
    expect(storeJsonLd(SETTINGS, page)).not.toHaveProperty("logo");
  });
});

describe("helpers", () => {
  it("formats prices and descriptions", () => {
    expect(schemaPrice(895050)).toBe("8950.50");
    expect(productDescription({ keySpec: "", priceCentavos: 260000 })).toBe(
      "₱2,600",
    );
  });

  it("escapes < so admin text can't close the script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)" });
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)" });
  });
});
