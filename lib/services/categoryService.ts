import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  CATEGORY_NOT_FOUND,
  categoryInputSchema,
  isId,
  type CategoryInput,
} from "@/lib/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import type { Category, CategoryWithCount } from "@/lib/domain/types";
import type { CategoryRepo } from "@/lib/repositories/types";

type CategoryField = keyof CategoryInput;

const NOT_FOUND = CATEGORY_NOT_FOUND;
const DUPLICATE_NAME = "A category with this name already exists.";

const productCount = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

export type DeleteCategoryOptions = { moveProductsTo?: string };

export type DeletedCategory = {
  name: string;
  movedProducts: number;
  /** Where the products went; null when there were none. */
  movedTo: string | null;
};

export type MoveDirection = "up" | "down";

export function createCategoryService(deps: { categories: CategoryRepo }) {
  const { categories } = deps;

  async function isNameTaken(name: string, exceptId?: string) {
    const match = await categories.findByName(name);
    return match !== null && match.id !== exceptId;
  }

  return {
    list(): Promise<CategoryWithCount[]> {
      return categories.list();
    },

    async create(
      input: CategoryInput,
    ): Promise<ServiceResult<Category, CategoryField>> {
      const parsed = categoryInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const values = parsed.data;

      if (await isNameTaken(values.name)) {
        return fieldError("name", DUPLICATE_NAME);
      }

      const base = slugify(values.name, "category");
      const category = await categories.insert({
        ...values,
        slug: uniqueSlug(base, await categories.slugsStartingWith(base)),
        sortOrder: (await categories.maxSortOrder()) + 1,
      });
      return ok(category);
    },

    /** The slug stays the same so `/?category=` links keep working. */
    async update(
      id: string,
      input: CategoryInput,
    ): Promise<ServiceResult<Category, CategoryField>> {
      if (!isId(id)) return formError(NOT_FOUND);
      const parsed = categoryInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const values = parsed.data;

      if (await isNameTaken(values.name, id)) {
        return fieldError("name", DUPLICATE_NAME);
      }

      const category = await categories.update(id, values);
      return category ? ok(category) : formError(NOT_FOUND);
    },

    /**
     * Deletes a category. If it has products, `moveProductsTo` must name another
     * category; the move and the delete happen in one transaction.
     */
    async delete(
      id: string,
      { moveProductsTo }: DeleteCategoryOptions = {},
    ): Promise<ServiceResult<DeletedCategory, keyof DeleteCategoryOptions>> {
      const category = isId(id) ? await categories.findById(id) : null;
      if (!category) return formError(NOT_FOUND);

      const count = await categories.countProducts(id);
      if (count === 0) {
        await categories.delete(id);
        return ok({ name: category.name, movedProducts: 0, movedTo: null });
      }

      const others = (await categories.list()).filter((c) => c.id !== id);
      if (others.length === 0) {
        const them = count === 1 ? "it" : "them";
        return formError(
          `${category.name} still has ${productCount(count)} and there's no other category to move ${them} to. Add another category first, or delete the products.`,
        );
      }
      if (!moveProductsTo) {
        return fieldError(
          "moveProductsTo",
          "Choose a category to move the products to.",
        );
      }
      const target = others.find((c) => c.id === moveProductsTo);
      if (!target) {
        return fieldError("moveProductsTo", "Choose a different category.");
      }

      await categories.moveProductsAndDelete(id, target.id);
      return ok({
        name: category.name,
        movedProducts: count,
        movedTo: target.name,
      });
    },

    /**
     * Swaps a category with its neighbour in the storefront order (which also sets the
     * tone colors). Writes the whole order back as 0..n-1, which also repairs ties. At
     * either end it changes nothing.
     */
    async move(
      id: string,
      direction: MoveDirection,
    ): Promise<ServiceResult<{ name: string; moved: boolean }>> {
      const list = isId(id) ? await categories.list() : [];
      const index = list.findIndex((c) => c.id === id);
      if (index === -1) return formError(NOT_FOUND);

      const other = direction === "up" ? index - 1 : index + 1;
      const name = list[index]!.name;
      if (other < 0 || other >= list.length) return ok({ name, moved: false });

      const ids = list.map((c) => c.id);
      [ids[index], ids[other]] = [ids[other]!, ids[index]!];
      await categories.setSortOrders(ids);
      return ok({ name, moved: true });
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
