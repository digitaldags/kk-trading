import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  categoryInputSchema,
  isId,
  type CategoryInput,
} from "@/lib/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import type { Category, CategoryWithCount } from "@/lib/domain/types";
import type { CategoryRepo } from "@/lib/repositories/types";

type CategoryField = keyof CategoryInput;

const NOT_FOUND = "This category no longer exists. Refresh the list.";
const DUPLICATE_NAME = "A category with this name already exists.";

const productCount = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

export type DeleteCategoryOptions = { moveProductsTo?: string };

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
    ): Promise<
      ServiceResult<{ movedProducts: number }, keyof DeleteCategoryOptions>
    > {
      const category = isId(id) ? await categories.findById(id) : null;
      if (!category) return formError(NOT_FOUND);

      const count = await categories.countProducts(id);
      if (count === 0) {
        await categories.delete(id);
        return ok({ movedProducts: 0 });
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
      if (!others.some((c) => c.id === moveProductsTo)) {
        return fieldError("moveProductsTo", "Choose a different category.");
      }

      await categories.moveProductsAndDelete(id, moveProductsTo);
      return ok({ movedProducts: count });
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
