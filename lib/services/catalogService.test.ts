import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogService } from "./catalogService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let service: ReturnType<typeof createCatalogService>;

beforeEach(async () => {
  store = createFakeStore();
  service = createCatalogService({
    products: store.productRepo,
    categories: store.categoryRepo,
  });
  const office = await store.addCategory({ name: "Office", slug: "office" });
  const gym = await store.addCategory({ name: "Gym", slug: "gym" });
  await store.addProduct({
    name: "Ergonomic mesh chair",
    categoryId: office.id,
  });
  await store.addProduct({
    name: "Adjustable FID bench",
    categoryId: gym.id,
    keySpec: "7 back positions",
  });
});

const names = (products: { name: string }[]) => products.map((p) => p.name);

describe("catalogService.listForStorefront", () => {
  it("lists every product in category order", async () => {
    expect(names(await service.listForStorefront())).toEqual([
      "Ergonomic mesh chair",
      "Adjustable FID bench",
    ]);
  });

  it("filters by category slug", async () => {
    expect(
      names(await service.listForStorefront({ categorySlug: "gym" })),
    ).toEqual(["Adjustable FID bench"]);
  });

  it("returns nothing for an unknown category", async () => {
    expect(await service.listForStorefront({ categorySlug: "garden" })).toEqual(
      [],
    );
  });

  it("trims the search text and ignores it when blank", async () => {
    expect(names(await service.listForStorefront({ q: "  BENCH " }))).toEqual([
      "Adjustable FID bench",
    ]);
    expect(await service.listForStorefront({ q: "   " })).toHaveLength(2);
  });
});

describe("catalogService.getProductBySlug", () => {
  it("returns the product with its category, or null", async () => {
    const product = await service.getProductBySlug("ergonomic-mesh-chair");
    expect(product?.category.slug).toBe("office");
    expect(await service.getProductBySlug("missing")).toBeNull();
  });

  it("treats a malformed slug as not found without querying", async () => {
    let calls = 0;
    const find = store.productRepo.findBySlug;
    store.productRepo.findBySlug = async (slug) => {
      calls += 1;
      return find(slug);
    };
    for (const slug of [
      "",
      "Ergonomic-Mesh-Chair",
      "a b",
      "-chair",
      "x".repeat(101),
    ]) {
      expect(await service.getProductBySlug(slug)).toBeNull();
    }
    expect(calls).toBe(0);
    expect(
      await service.getProductBySlug("ergonomic-mesh-chair"),
    ).not.toBeNull();
  });
});

describe("catalogService input from the URL", () => {
  it("ignores malformed filter values instead of failing", async () => {
    const filter = { categorySlug: ["gym"], q: 42 } as unknown as {
      categorySlug?: string;
      q?: string;
    };
    expect(await service.listForStorefront(filter)).toHaveLength(2);
  });

  it("caps the search text at 100 characters", async () => {
    const seen: (string | undefined)[] = [];
    const spy = store.productRepo.listWithCategory;
    store.productRepo.listWithCategory = async (f) => {
      seen.push(f?.q);
      return spy(f);
    };
    await service.listForStorefront({ q: "x".repeat(150) });
    expect(seen[0]).toHaveLength(100);
  });
});
