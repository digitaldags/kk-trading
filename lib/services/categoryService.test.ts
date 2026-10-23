import { beforeEach, describe, expect, it } from "vitest";
import type { Category } from "@/lib/domain/types";
import { createCategoryService } from "./categoryService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let service: ReturnType<typeof createCategoryService>;

beforeEach(() => {
  store = createFakeStore();
  service = createCategoryService({ categories: store.categoryRepo });
});

async function withProducts(name: string, count: number): Promise<Category> {
  const category = await store.addCategory({ name });
  for (let i = 0; i < count; i++) {
    await store.addProduct({
      name: `${name} item ${i}`,
      categoryId: category.id,
    });
  }
  return category;
}

describe("categoryService.create and update", () => {
  it("creates a category with a slug and the next sort order", async () => {
    await store.addCategory({ name: "Office equipment" });
    const result = await service.create({
      name: "Outdoor gear",
      blurb: "Tents and tables",
      icon: "pool",
    });
    expect(result.ok && result.data).toMatchObject({
      slug: "outdoor-gear",
      sortOrder: 1,
    });
  });

  it("rejects a name that exists in another case", async () => {
    await store.addCategory({ name: "Gym equipment" });
    const result = await service.create({
      name: " GYM equipment ",
      icon: "pool",
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { name: "A category with this name already exists." },
    });
  });

  it("lets a category keep its own name when it's edited", async () => {
    const gym = await store.addCategory({ name: "Gym equipment" });
    const result = await service.update(gym.id, {
      name: "Gym Equipment",
      icon: "fitness_center",
    });
    expect(result.ok && result.data.name).toBe("Gym Equipment");
  });

  it("rejects renaming to another category's name", async () => {
    await store.addCategory({ name: "Gym equipment" });
    const office = await store.addCategory({ name: "Office equipment" });
    const result = await service.update(office.id, {
      name: "gym equipment",
      icon: "chair",
    });
    expect(result.ok).toBe(false);
  });

  it("validates the name, blurb and icon", async () => {
    const result = await service.create({
      name: "x".repeat(41),
      blurb: "x".repeat(71),
      icon: "rocket" as "chair",
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: "Use 40 characters or fewer.",
        blurb: "Use 70 characters or fewer.",
        icon: "Choose an icon.",
      },
    });
  });

  it("asks for a name when it's empty", async () => {
    const result = await service.create({ name: "", icon: "chair" });
    expect(result.ok || result.fieldErrors.name).toBe("Enter a category name.");
  });
});

describe("categoryService.delete", () => {
  it("deletes a category with no products", async () => {
    const empty = await store.addCategory({ name: "Empty" });
    await store.addCategory({ name: "Other" });
    expect(await service.delete(empty.id)).toEqual({
      ok: true,
      data: { name: "Empty", movedProducts: 0, movedTo: null },
    });
    expect(store.categories.has(empty.id)).toBe(false);
  });

  it("deletes the only category when it has no products", async () => {
    const only = await store.addCategory({ name: "Only" });
    expect((await service.delete(only.id)).ok).toBe(true);
  });

  it("needs somewhere to move the products", async () => {
    const gym = await withProducts("Gym", 2);
    await store.addCategory({ name: "Office" });
    expect(await service.delete(gym.id)).toEqual({
      ok: false,
      fieldErrors: {
        moveProductsTo: "Choose a category to move the products to.",
      },
    });
    expect(store.categories.has(gym.id)).toBe(true);
  });

  it("moves the products and deletes the category", async () => {
    const gym = await withProducts("Gym", 3);
    const office = await withProducts("Office", 1);
    expect(await service.delete(gym.id, { moveProductsTo: office.id })).toEqual(
      {
        ok: true,
        data: { name: "Gym", movedProducts: 3, movedTo: "Office" },
      },
    );
    expect(store.categories.has(gym.id)).toBe(false);
    expect(await store.categoryRepo.countProducts(office.id)).toBe(4);
  });

  it("won't move products into the category being deleted", async () => {
    const gym = await withProducts("Gym", 1);
    await store.addCategory({ name: "Office" });
    const result = await service.delete(gym.id, { moveProductsTo: gym.id });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { moveProductsTo: "Choose a different category." },
    });
  });

  it("won't move products into a category that doesn't exist", async () => {
    const gym = await withProducts("Gym", 1);
    await store.addCategory({ name: "Office" });
    const result = await service.delete(gym.id, {
      moveProductsTo: "00000000-0000-4000-8000-999999999999",
    });
    expect(result.ok).toBe(false);
    expect(store.categories.has(gym.id)).toBe(true);
  });

  it("won't delete the last category while it has products", async () => {
    const gym = await withProducts("Gym equipment", 2);
    expect(await service.delete(gym.id)).toEqual({
      ok: false,
      fieldErrors: {},
      formError:
        "Gym equipment still has 2 products and there's no other category to move them to. Add another category first, or delete the products.",
    });
    expect(store.categories.has(gym.id)).toBe(true);
  });

  it("uses the singular for one product", async () => {
    const gym = await withProducts("Gym", 1);
    const result = await service.delete(gym.id);
    expect(!result.ok && result.formError).toContain(
      "still has 1 product and there's no other category to move it to.",
    );
  });

  it("leaves everything in place when the move fails", async () => {
    const gym = await withProducts("Gym", 2);
    const office = await store.addCategory({ name: "Office" });
    store.failNextWrite();
    await expect(
      service.delete(gym.id, { moveProductsTo: office.id }),
    ).rejects.toThrow();
    expect(store.categories.has(gym.id)).toBe(true);
    expect(await store.categoryRepo.countProducts(gym.id)).toBe(2);
  });

  it("reports a category that no longer exists", async () => {
    const result = await service.delete("00000000-0000-4000-8000-999999999999");
    expect(result).toEqual({
      ok: false,
      fieldErrors: {},
      formError: "That category no longer exists.",
    });
  });
});

describe("categoryService.move", () => {
  const order = async () => (await service.list()).map((c) => c.name);

  it("moves a category up or down one place", async () => {
    await store.addCategory({ name: "A" });
    const b = await store.addCategory({ name: "B" });
    await store.addCategory({ name: "C" });

    expect(await service.move(b.id, "up")).toEqual({
      ok: true,
      data: { name: "B", moved: true },
    });
    expect(await order()).toEqual(["B", "A", "C"]);

    await service.move(b.id, "down");
    await service.move(b.id, "down");
    expect(await order()).toEqual(["A", "C", "B"]);
  });

  it("changes nothing at either end", async () => {
    const a = await store.addCategory({ name: "A" });
    const b = await store.addCategory({ name: "B" });
    expect(await service.move(a.id, "up")).toEqual({
      ok: true,
      data: { name: "A", moved: false },
    });
    expect((await service.move(b.id, "down")).ok).toBe(true);
    expect(await order()).toEqual(["A", "B"]);
  });

  it("writes the whole order back, which repairs ties", async () => {
    await store.addCategory({ name: "A", sortOrder: 0 });
    const b = await store.addCategory({ name: "B", sortOrder: 0 });
    const c = await store.addCategory({ name: "C", sortOrder: 0 });
    await service.move(c.id, "up");
    expect(await order()).toEqual(["A", "C", "B"]);
    expect(store.categories.get(b.id)?.sortOrder).toBe(2);
  });

  it("reports a category that no longer exists", async () => {
    await store.addCategory({ name: "A" });
    for (const id of ["abc", "00000000-0000-4000-8000-999999999999"]) {
      expect(await service.move(id, "up")).toEqual({
        ok: false,
        fieldErrors: {},
        formError: "That category no longer exists.",
      });
    }
  });
});

describe("categoryService ids", () => {
  it("treats an id that isn't a uuid as not found", async () => {
    expect(
      await service.update("abc", { name: "Gym", icon: "pool" }),
    ).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(await service.delete("abc")).toMatchObject({
      ok: false,
      formError: expect.any(String),
    });
  });
});
