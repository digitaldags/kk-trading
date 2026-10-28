import { describe, expect, it } from "vitest";
import { productInputSchema, storeSettingsInputSchema } from "./schemas";

// The ticket 17 fields. The other rules are covered through the services' tests.

const product = {
  name: "Ergonomic mesh chair",
  code: "KK-CHAIR-01",
  uom: "pcs",
  categoryId: "00000000-0000-4000-8000-000000000001",
  price: "8950",
  stockStatus: "in_stock",
} as const;

const errorsOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]),
  );

describe("productInputSchema: code, unit and specs", () => {
  it("trims the code and collapses its whitespace", () => {
    const parsed = productInputSchema.parse({
      ...product,
      code: "\tKK  CHAIR \n 01 ",
    });
    expect(parsed.code).toBe("KK CHAIR 01");
  });

  it("makes the code optional, up to 40 characters", () => {
    expect(productInputSchema.parse({ ...product, code: undefined }).code).toBe(
      "",
    );
    expect(productInputSchema.parse({ ...product, code: "   " }).code).toBe("");
    expect(
      productInputSchema.safeParse({ ...product, code: "x".repeat(40) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(
        productInputSchema.safeParse({ ...product, code: "x".repeat(41) }),
      ),
    ).toEqual({ code: "Use 40 characters or fewer." });
  });

  it("accepts only the listed units of measure", () => {
    for (const uom of ["pcs", "set", "pair", "unit", "lot"]) {
      expect(productInputSchema.safeParse({ ...product, uom }).success).toBe(
        true,
      );
    }
    expect(
      errorsOf(productInputSchema.safeParse({ ...product, uom: "box" })),
    ).toEqual({ uom: "Choose a unit of measure." });
    expect(
      errorsOf(productInputSchema.safeParse({ ...product, uom: undefined })),
    ).toEqual({ uom: "Choose a unit of measure." });
  });

  it("trims each spec line and drops blank ones", () => {
    const parsed = productInputSchema.parse({
      ...product,
      specs: "\r\n  Seat height 44–54 cm  \r\n\r\n   \n3D armrests\n",
    });
    expect(parsed.specs).toBe("Seat height 44–54 cm\n3D armrests");
    expect(productInputSchema.parse(product).specs).toBe("");
  });

  it("limits specs to 1,000 characters after tidying", () => {
    // 1,000 characters of text, with blank lines that don't count.
    const padded = `${"x".repeat(500)}\n\n\n${"y".repeat(499)}`;
    expect(
      productInputSchema.safeParse({ ...product, specs: padded }).success,
    ).toBe(true);
    expect(
      errorsOf(
        productInputSchema.safeParse({ ...product, specs: "x".repeat(1001) }),
      ),
    ).toEqual({ specs: "Use 1000 characters or fewer." });
  });
});

describe("storeSettingsInputSchema: slogan, second phone and logo", () => {
  const settings = {
    name: "KK Trading",
    headline: "Equipment",
    email: "hello@example.com",
  };

  it("defaults the slogan and second phone to empty, and leaves the logo out", () => {
    expect(storeSettingsInputSchema.parse(settings)).toMatchObject({
      slogan: "",
      phone2: "",
    });
    expect(storeSettingsInputSchema.parse(settings)).not.toHaveProperty("logo");
  });

  it("takes a logo, or null to remove it", () => {
    const logo = {
      url: "https://store.public.blob.vercel-storage.com/branding/logo.png",
      pathname: "branding/logo.png",
    };
    expect(storeSettingsInputSchema.parse({ ...settings, logo }).logo).toEqual(
      logo,
    );
    expect(
      storeSettingsInputSchema.parse({ ...settings, logo: null }).logo,
    ).toBeNull();
    expect(
      storeSettingsInputSchema.safeParse({
        ...settings,
        logo: { url: "not a url", pathname: "x" },
      }).success,
    ).toBe(false);
  });
});
