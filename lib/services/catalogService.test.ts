import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogService } from "./catalogService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let service: ReturnType<typeof createCatalogService>;

const SETTINGS = {
  name: "KK Trading",
  headline: "Equipment for the desk and the gym",
  tagline: "",
  phone: "",
  email: "hello@example.com",
  address: "",
};

beforeEach(async () => {
  store = createFakeStore();
  service = createCatalogService({ published: store.publishRepo });
  await store.settingsRepo.update(SETTINGS);
  const office = await store.addCategory({ name: "Office", slug: "office" });
  const gym = await store.addCategory({ name: "Gym", slug: "gym" });
  await store.addProduct({
    name: "Ergonomic mesh chair",
    categoryId: office.id,
    description: "Breathable mesh. 100% recycled frame.",
  });
  await store.addProduct({
    name: "Adjustable FID bench",
    categoryId: gym.id,
    keySpec: "7 back positions",
  });
  await store.publishRepo.publish();
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

  it("searches the name, key spec and description, ignoring case", async () => {
    expect(names(await service.listForStorefront({ q: "  BENCH " }))).toEqual([
      "Adjustable FID bench",
    ]);
    expect(names(await service.listForStorefront({ q: "back POS" }))).toEqual([
      "Adjustable FID bench",
    ]);
    expect(names(await service.listForStorefront({ q: "recycled" }))).toEqual([
      "Ergonomic mesh chair",
    ]);
    expect(await service.listForStorefront({ q: "   " })).toHaveLength(2);
  });

  it("treats % and _ in the search as plain text", async () => {
    expect(names(await service.listForStorefront({ q: "100%" }))).toEqual([
      "Ergonomic mesh chair",
    ]);
    expect(await service.listForStorefront({ q: "_" })).toEqual([]);
  });
});

describe("catalogService shows only what's published", () => {
  it("doesn't show draft edits until they're published", async () => {
    const [chair] = await store.productRepo.listWithCategory({ q: "chair" });
    await store.productRepo.update(chair!.id, { name: "Mesh office chair" });
    await store.settingsRepo.update({ ...SETTINGS, name: "KK Trading PH" });

    expect(names(await service.listForStorefront())).toContain(
      "Ergonomic mesh chair",
    );
    expect((await service.getSettings()).name).toBe("KK Trading");

    await store.publishRepo.publish();
    expect(names(await service.listForStorefront())).toContain(
      "Mesh office chair",
    );
    expect((await service.getSettings()).name).toBe("KK Trading PH");
  });

  it("counts each category's published products", async () => {
    expect(
      (await service.listCategories()).map((c) => [c.slug, c.productCount]),
    ).toEqual([
      ["office", 1],
      ["gym", 1],
    ]);
  });

  it("shows an empty store, and says how to fix it, before the first publish", async () => {
    const fresh = createCatalogService({
      published: createFakeStore().publishRepo,
    });
    expect(await fresh.listForStorefront()).toEqual([]);
    expect(await fresh.listCategories()).toEqual([]);
    expect(await fresh.getProductBySlug("ergonomic-mesh-chair")).toBeNull();
    await expect(fresh.getSettings()).rejects.toThrow("pnpm db:seed");
  });
});

describe("catalogService.getProductBySlug", () => {
  it("returns the product with its category, or null", async () => {
    const product = await service.getProductBySlug("ergonomic-mesh-chair");
    expect(product?.category.slug).toBe("office");
    expect(await service.getProductBySlug("missing")).toBeNull();
  });

  it("treats a malformed slug as not found without reading the store", async () => {
    let calls = 0;
    const get = store.publishRepo.getPublished;
    store.publishRepo.getPublished = async () => {
      calls += 1;
      return get();
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
    const [office] = await store.categoryRepo.list();
    await store.addProduct({
      name: "Long spec",
      categoryId: office!.id,
      keySpec: "x".repeat(100),
    });
    await store.publishRepo.publish();
    // Only a search cut to its first 100 characters matches.
    expect(
      names(await service.listForStorefront({ q: "x".repeat(150) })),
    ).toEqual(["Long spec"]);
  });
});
