import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductInput } from "@/lib/domain/schemas";
import type { Category } from "@/lib/domain/types";
import { createProductService } from "./productService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let office: Category;
let gym: Category;
let service: ReturnType<typeof createProductService>;
const logError = vi.fn();

const PHOTO_A = {
  url: "https://blob.example.com/products/a.webp",
  pathname: "products/a.webp",
};
const PHOTO_B = {
  url: "https://blob.example.com/products/b.webp",
  pathname: "products/b.webp",
};

const input = (overrides: Partial<ProductInput> = {}): ProductInput => ({
  name: "Ergonomic mesh chair",
  categoryId: office.id,
  price: "₱8,950",
  stockStatus: "in_stock",
  keySpec: "Seat height 44–54 cm",
  description: "Breathable mesh back.",
  ...overrides,
});

beforeEach(async () => {
  store = createFakeStore();
  office = await store.addCategory({
    name: "Office equipment",
    slug: "office",
  });
  gym = await store.addCategory({ name: "Gym equipment", slug: "gym" });
  logError.mockReset();
  service = createProductService({
    products: store.productRepo,
    categories: store.categoryRepo,
    imageStore: store.imageStore,
    logError,
  });
});

async function created(overrides: Partial<ProductInput> = {}) {
  const result = await service.create(input(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.data;
}

describe("productService.create", () => {
  it("stores the price in centavos and makes a slug from the name", async () => {
    const product = await created();
    expect(product).toMatchObject({
      slug: "ergonomic-mesh-chair",
      priceCentavos: 895000,
      isSample: false,
      imageUrl: null,
    });
  });

  it("adds -2 and -3 to the slug when the name is taken", async () => {
    await created();
    expect((await created()).slug).toBe("ergonomic-mesh-chair-2");
    expect((await created()).slug).toBe("ergonomic-mesh-chair-3");
  });

  it("returns typed field errors for invalid input and writes nothing", async () => {
    const result = await service.create(
      input({ name: "  ", price: "-5", keySpec: "x".repeat(91) }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: "Enter a product name.",
        price: "Enter a price of 0 or more, numbers only.",
        keySpec: "Use 90 characters or fewer.",
      },
    });
    expect(store.products.size).toBe(0);
  });

  it("rejects names over 80 characters and descriptions over 600", async () => {
    const result = await service.create(
      input({ name: "x".repeat(81), description: "x".repeat(601) }),
    );
    expect(result.ok || result.fieldErrors).toEqual({
      name: "Use 80 characters or fewer.",
      description: "Use 600 characters or fewer.",
    });
  });

  it("rejects a category that doesn't exist", async () => {
    const result = await service.create(
      input({ categoryId: "00000000-0000-4000-8000-999999999999" }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: { categoryId: "Choose a category." },
    });
  });

  it("adds new products after the existing ones", async () => {
    const first = await created();
    const second = await created({ name: "Dual monitor arm" });
    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
  });
});

describe("productService.update", () => {
  it("clears the sample flag when a sample product is edited", async () => {
    const sample = await store.addProduct({
      name: "Ergonomic mesh chair",
      categoryId: office.id,
      isSample: true,
    });
    const result = await service.update(sample.id, input({ price: "9000" }));
    expect(result.ok && result.data).toMatchObject({
      isSample: false,
      priceCentavos: 900000,
    });
  });

  it("keeps the slug when the name changes", async () => {
    const product = await created();
    const result = await service.update(
      product.id,
      input({ name: "Mesh office chair", categoryId: gym.id }),
    );
    expect(result.ok && result.data).toMatchObject({
      slug: "ergonomic-mesh-chair",
      name: "Mesh office chair",
      categoryId: gym.id,
    });
  });

  it("keeps the photo when the input leaves it out", async () => {
    const product = await created({ image: PHOTO_A });
    const result = await service.update(product.id, input());
    expect(result.ok && result.data.imageUrl).toBe(PHOTO_A.url);
    expect(store.imageStore.deleted).toEqual([]);
  });

  it("deletes the old photo after replacing it", async () => {
    const product = await created({ image: PHOTO_A });
    const result = await service.update(product.id, input({ image: PHOTO_B }));
    expect(result.ok && result.data).toMatchObject({
      imageUrl: PHOTO_B.url,
      imagePathname: PHOTO_B.pathname,
    });
    expect(store.imageStore.deleted).toEqual([PHOTO_A.url]);
  });

  it("deletes the photo when it's removed", async () => {
    const product = await created({ image: PHOTO_A });
    await service.update(product.id, input({ image: null }));
    expect(store.products.get(product.id)?.imageUrl).toBeNull();
    expect(store.imageStore.deleted).toEqual([PHOTO_A.url]);
  });

  it("keeps the old photo when the save fails", async () => {
    const product = await created({ image: PHOTO_A });
    store.failNextWrite();
    await expect(
      service.update(product.id, input({ image: PHOTO_B })),
    ).rejects.toThrow("Simulated database failure");
    expect(store.products.get(product.id)?.imageUrl).toBe(PHOTO_A.url);
    expect(store.imageStore.deleted).toEqual([]);
  });

  it("still saves when the old photo can't be deleted", async () => {
    const product = await created({ image: PHOTO_A });
    store.imageStore.delete = async () => {
      throw new Error("Blob unavailable");
    };
    const result = await service.update(product.id, input({ image: PHOTO_B }));
    expect(result.ok).toBe(true);
    expect(logError).toHaveBeenCalledOnce();
  });

  it("returns field errors without saving", async () => {
    const product = await created();
    const result = await service.update(product.id, input({ price: "abc" }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: { price: "Enter a price of 0 or more, numbers only." },
    });
    expect(store.products.get(product.id)?.priceCentavos).toBe(895000);
  });

  it("reports a product that no longer exists", async () => {
    const result = await service.update(
      "00000000-0000-4000-8000-999999999999",
      input(),
    );
    expect(result).toMatchObject({
      ok: false,
      formError: "This product no longer exists. Refresh the list.",
    });
  });
});

describe("productService.delete", () => {
  it("deletes the product and its photo", async () => {
    const product = await created({ image: PHOTO_A });
    const result = await service.delete(product.id);
    expect(result.ok).toBe(true);
    expect(store.products.has(product.id)).toBe(false);
    expect(store.imageStore.deleted).toEqual([PHOTO_A.url]);
  });

  it("doesn't touch the image store for a product without a photo", async () => {
    const product = await created();
    await service.delete(product.id);
    expect(store.imageStore.deleted).toEqual([]);
  });

  it("reports a product that no longer exists", async () => {
    const result = await service.delete("00000000-0000-4000-8000-999999999999");
    expect(result.ok).toBe(false);
  });
});

describe("productService ids", () => {
  it("treats an id that isn't a uuid as not found, without querying", async () => {
    const findById = vi.spyOn(store.productRepo, "findById");
    const remove = vi.spyOn(store.productRepo, "delete");
    expect(await service.update("abc", input())).toMatchObject({
      ok: false,
      formError: "This product no longer exists. Refresh the list.",
    });
    expect(await service.delete("1; drop table products")).toMatchObject({
      ok: false,
    });
    expect(findById).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
