import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/domain/types";
import { createProductService } from "./productService";
import { createPublishService } from "./publishService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

const photo = (name: string) =>
  `https://store.public.blob.vercel-storage.com/products/${name}.webp`;
const image = (name: string) => ({
  url: photo(name),
  pathname: `products/${name}.webp`,
});

let store: FakeStore;
let publish: ReturnType<typeof createPublishService>;
let products: ReturnType<typeof createProductService>;
let office: Category;

beforeEach(async () => {
  store = createFakeStore();
  publish = createPublishService({
    publish: store.publishRepo,
    products: store.productRepo,
    imageStore: store.imageStore,
  });
  products = createProductService({
    products: store.productRepo,
    categories: store.categoryRepo,
    imageStore: store.imageStore,
  });
  office = await store.addCategory({ name: "Office" });
});

const input = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  categoryId: office.id,
  price: "100",
  stockStatus: "in_stock" as const,
  ...extra,
});

describe("publishService.status", () => {
  it("has unpublished changes until the first publish, and after any edit", async () => {
    expect(await publish.status()).toEqual({ unpublished: true });
    await publish.publish();
    expect(await publish.status()).toEqual({ unpublished: false });

    await products.create(input("Desk lamp"));
    expect(await publish.status()).toEqual({ unpublished: true });
    await publish.publish();
    expect(await publish.status()).toEqual({ unpublished: false });
  });

  it("ignores a save that changes nothing but the timestamps", async () => {
    await publish.publish();
    await store.categoryRepo.update(office.id, { name: "Office" });
    expect(await publish.status()).toEqual({ unpublished: false });
  });
});

describe("photos while there's a draft", () => {
  it("keeps a replaced photo until the replacement is published", async () => {
    const created = await products.create(
      input("Desk lamp", { image: image("old") }),
    );
    const id = created.ok ? created.data.id : "";
    await publish.publish();

    await products.update(id, input("Desk lamp", { image: image("new") }));
    // The storefront still shows the old photo, so it stays.
    expect(store.imageStore.deleted).toEqual([]);

    await publish.publish();
    expect(store.imageStore.deleted).toEqual([photo("old")]);
  });

  it("keeps a deleted product's photo until the delete is published", async () => {
    const created = await products.create(
      input("Desk lamp", { image: image("lamp") }),
    );
    await publish.publish();
    await products.delete(created.ok ? created.data.id : "");
    expect(store.imageStore.deleted).toEqual([]);

    await publish.publish();
    expect(store.imageStore.deleted).toEqual([photo("lamp")]);
  });

  it("deletes a never-published product's photo straight away", async () => {
    await publish.publish();
    const created = await products.create(
      input("Desk lamp", { image: image("draft") }),
    );
    await products.delete(created.ok ? created.data.id : "");
    expect(store.imageStore.deleted).toEqual([photo("draft")]);
  });
});

describe("publishService.discard", () => {
  it("puts the draft back to what was published, and deletes photos added since", async () => {
    const created = await products.create(
      input("Desk lamp", { image: image("lamp") }),
    );
    const lampId = created.ok ? created.data.id : "";
    await publish.publish();

    await products.update(
      lampId,
      input("Renamed lamp", { image: image("replacement") }),
    );
    await products.create(input("Added since", { image: image("added") }));
    await store.categoryRepo.update(office.id, { name: "Workspace" });

    expect(await publish.discard()).toBe(true);

    const names = (await store.productRepo.listWithCategory()).map(
      (p) => p.name,
    );
    expect(names).toEqual(["Desk lamp"]);
    expect((await store.productRepo.findById(lampId))?.imageUrl).toBe(
      photo("lamp"),
    );
    expect((await store.categoryRepo.findById(office.id))?.name).toBe("Office");
    // The published photo stays; the two uploaded since are deleted.
    expect(store.imageStore.deleted.sort()).toEqual(
      [photo("added"), photo("replacement")].sort(),
    );
    expect(await publish.status()).toEqual({ unpublished: false });
  });

  it("does nothing before the first publish", async () => {
    await products.create(input("Desk lamp", { image: image("lamp") }));
    expect(await publish.discard()).toBe(false);
    expect(await store.productRepo.listWithCategory()).toHaveLength(1);
    expect(store.imageStore.deleted).toEqual([]);
  });

  it("logs a photo it couldn't delete, and still discards", async () => {
    const logError = vi.fn();
    const failing = createPublishService({
      publish: store.publishRepo,
      products: store.productRepo,
      imageStore: {
        delete: async () => {
          throw new Error("Blob is down");
        },
      },
      logError,
    });
    await failing.publish();
    await products.create(input("Desk lamp", { image: image("lamp") }));

    expect(await failing.discard()).toBe(true);
    expect(await store.productRepo.listWithCategory()).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      `Couldn't delete product image ${photo("lamp")}`,
      expect.any(Error),
    );
  });
});
