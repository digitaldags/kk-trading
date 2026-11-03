import { describe, expect, it } from "vitest";
import {
  deliveryReceiptInputSchema,
  productInputSchema,
  quotationInputSchema,
  storeSettingsInputSchema,
} from "./schemas";

// The ticket 17 fields and the ticket 19 document schemas. The other rules are covered
// through the services' tests.

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
      width: 400,
      height: 100,
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
        logo: { ...logo, url: "not a url" },
      }).success,
    ).toBe(false);
  });

  it("needs the logo's size in whole pixels, 1 to 20,000 (ticket 40)", () => {
    const logo = {
      url: "https://store.public.blob.vercel-storage.com/branding/logo.png",
      pathname: "branding/logo.png",
      width: 400,
      height: 100,
    };
    const refused = (overrides: object) =>
      !storeSettingsInputSchema.safeParse({
        ...settings,
        logo: { ...logo, ...overrides },
      }).success;
    expect(refused({ width: undefined })).toBe(true);
    expect(refused({ height: 0 })).toBe(true);
    expect(refused({ width: 400.5 })).toBe(true);
    expect(refused({ width: 20_001 })).toBe(true);
    expect(refused({ width: 1, height: 20_000 })).toBe(false);
  });
});

describe("quotationInputSchema", () => {
  const productId = "00000000-0000-4000-8000-000000000001";
  const quotation = {
    number: " Q-2026-001 ",
    quoteDate: "2026-10-27",
    customerName: "Acme Gym",
  };
  const parse = (overrides: object) =>
    quotationInputSchema.safeParse({ ...quotation, ...overrides });

  it("trims the number, defaults the text and allows no items", () => {
    expect(quotationInputSchema.parse(quotation)).toMatchObject({
      number: "Q-2026-001",
      customerAddress: "",
      notes: "",
      items: [],
    });
  });

  it("needs a number, a date and the customer's name", () => {
    expect(
      errorsOf(
        quotationInputSchema.safeParse({
          number: "  ",
          quoteDate: "",
          customerName: "",
        }),
      ),
    ).toEqual({
      number: "Enter the quotation number.",
      quoteDate: "Enter a date.",
      customerName: "Enter the customer's name.",
    });
    expect(errorsOf(quotationInputSchema.safeParse({}))).toMatchObject({
      number: "Enter the quotation number.",
      quoteDate: "Enter a date.",
      customerName: "Enter the customer's name.",
    });
  });

  it.each(["2026-02-30", "2026-13-01", "27/10/2026", "2026-1-5"])(
    "rejects the date %s",
    (quoteDate) => {
      expect(errorsOf(parse({ quoteDate }))).toEqual({
        quoteDate: "Enter a date.",
      });
    },
  );

  it.each([
    ["number", 60],
    ["customerName", 120],
    ["customerAddress", 300],
    ["customerTin", 40],
    ["deliveryAddress", 300],
    ["deliveryTerm", 120],
    ["paymentTerms", 120],
    ["remarks", 120],
    ["leadTime", 120],
    ["notes", 1000],
    ["acknowledgement", 1000],
  ])("limits %s to %i characters", (field, max) => {
    expect(parse({ [field]: "x".repeat(max) }).success).toBe(true);
    expect(errorsOf(parse({ [field]: "x".repeat(max + 1) }))).toEqual({
      [field]: `Use ${max} characters or fewer.`,
    });
  });

  it("parses typed quantities and prices", () => {
    const parsed = quotationInputSchema.parse({
      ...quotation,
      items: [{ productId, quantity: "20", unitPrice: "₱2,745.50" }],
    });
    expect(parsed.items).toEqual([
      { productId, quantity: 20, unitPrice: 274550 },
    ]);
  });

  it.each([0, -1, 1.5, "", "abc", 100_001])(
    "rejects the quantity %s",
    (quantity) => {
      const result = parse({ items: [{ productId, quantity, unitPrice: 1 }] });
      expect(result.error?.issues[0]).toMatchObject({
        path: ["items", 0, "quantity"],
        message: "Enter a whole number of 1 or more.",
      });
    },
  );

  it("accepts up to 100,000 of a product", () => {
    expect(
      parse({ items: [{ productId, quantity: 100_000, unitPrice: 1 }] })
        .success,
    ).toBe(true);
  });

  it("reuses the product price error", () => {
    const result = parse({
      items: [{ productId, quantity: 1, unitPrice: "-5" }],
    });
    expect(result.error?.issues[0]?.message).toBe(
      "Enter a price of 0 or more, numbers only.",
    );
  });

  it("rejects the same product twice, on the second row", () => {
    const result = parse({
      items: [
        { productId, quantity: 1, unitPrice: 1 },
        { productId, quantity: 2, unitPrice: 1 },
      ],
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["items", 1],
        message: "This product is already on the quotation.",
      }),
    ]);
  });
});

describe("deliveryReceiptInputSchema", () => {
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  const receipt = { number: "DR-1", receiptDate: "2026-10-28" };

  it("drops lines set to 0", () => {
    const parsed = deliveryReceiptInputSchema.parse({
      ...receipt,
      lines: [
        { quotationItemId: a, quantity: "0" },
        { quotationItemId: b, quantity: "3" },
      ],
    });
    expect(parsed.lines).toEqual([{ quotationItemId: b, quantity: 3 }]);
    expect(parsed.deliveryAddress).toBe("");
  });

  it("needs at least one line left", () => {
    for (const lines of [[], [{ quotationItemId: a, quantity: 0 }]]) {
      expect(
        errorsOf(deliveryReceiptInputSchema.safeParse({ ...receipt, lines })),
      ).toEqual({ lines: "Enter a quantity for at least one item." });
    }
  });

  it("needs a number and a date", () => {
    expect(
      errorsOf(
        deliveryReceiptInputSchema.safeParse({
          number: "",
          receiptDate: "2026-02-30",
          lines: [{ quotationItemId: a, quantity: 1 }],
        }),
      ),
    ).toEqual({
      number: "Enter the receipt number.",
      receiptDate: "Enter a date.",
    });
  });

  it("rejects negative and fractional quantities, and a line twice", () => {
    const result = deliveryReceiptInputSchema.safeParse({
      ...receipt,
      lines: [
        { quotationItemId: a, quantity: -1 },
        { quotationItemId: b, quantity: 1.5 },
      ],
    });
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      "Enter a whole number of 0 or more.",
      "Enter a whole number of 0 or more.",
    ]);
    const twice = deliveryReceiptInputSchema.safeParse({
      ...receipt,
      lines: [
        { quotationItemId: a, quantity: 1 },
        { quotationItemId: a, quantity: 1 },
      ],
    });
    expect(twice.error?.issues).toEqual([
      expect.objectContaining({
        path: ["lines", 1],
        message: "This item is already on the receipt.",
      }),
    ]);
  });
});
