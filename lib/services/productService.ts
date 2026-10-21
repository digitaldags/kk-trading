import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  isId,
  productInputSchema,
  type ProductInput,
} from "@/lib/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import type { Product } from "@/lib/domain/types";
import type {
  CategoryRepo,
  ProductPatch,
  ProductRepo,
} from "@/lib/repositories/types";
import type { ImageStore } from "./imageStore";

type ProductField = keyof ProductInput;

const NOT_FOUND = "This product no longer exists. Refresh the list.";
const UNKNOWN_CATEGORY = "Choose a category.";

export function createProductService(deps: {
  products: ProductRepo;
  categories: CategoryRepo;
  imageStore: ImageStore;
  /** Where a failed photo cleanup is reported. The save itself still succeeds. */
  logError?: (message: string, error: unknown) => void;
}) {
  const logError = deps.logError ?? console.error;

  // Called after the database write succeeded, so a failure here only leaves an orphan blob.
  async function deleteImage(url: string) {
    try {
      await deps.imageStore.delete(url);
    } catch (error) {
      logError(`Couldn't delete product image ${url}`, error);
    }
  }

  return {
    async create(
      input: ProductInput,
    ): Promise<ServiceResult<Product, ProductField>> {
      const parsed = productInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { price, image, ...values } = parsed.data;

      if (!(await deps.categories.findById(values.categoryId))) {
        return fieldError("categoryId", UNKNOWN_CATEGORY);
      }

      const base = slugify(values.name, "product");
      const slug = uniqueSlug(
        base,
        await deps.products.slugsStartingWith(base),
      );
      const product = await deps.products.insert({
        ...values,
        slug,
        priceCentavos: price,
        imageUrl: image?.url ?? null,
        imagePathname: image?.pathname ?? null,
        isSample: false,
        sortOrder: (await deps.products.maxSortOrder()) + 1,
      });
      return ok(product);
    },

    /**
     * Saves the editor's fields. The slug stays the same so shared links keep working.
     * Any edit turns a sample product into a real one.
     */
    async update(
      id: string,
      input: ProductInput,
    ): Promise<ServiceResult<Product, ProductField>> {
      const existing = isId(id) ? await deps.products.findById(id) : null;
      if (!existing) return formError(NOT_FOUND);

      const parsed = productInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { price, image, ...values } = parsed.data;

      if (!(await deps.categories.findById(values.categoryId))) {
        return fieldError("categoryId", UNKNOWN_CATEGORY);
      }

      const patch: ProductPatch = {
        ...values,
        priceCentavos: price,
        isSample: false,
      };
      if (image !== undefined) {
        patch.imageUrl = image?.url ?? null;
        patch.imagePathname = image?.pathname ?? null;
      }

      const product = await deps.products.update(id, patch);
      if (!product) return formError(NOT_FOUND);

      // Delete the replaced or removed photo only once the new row is saved.
      if (existing.imageUrl && existing.imageUrl !== product.imageUrl) {
        await deleteImage(existing.imageUrl);
      }
      return ok(product);
    },

    async delete(id: string): Promise<ServiceResult<Product, never>> {
      const product = isId(id) ? await deps.products.delete(id) : null;
      if (!product) return formError(NOT_FOUND);
      if (product.imageUrl) await deleteImage(product.imageUrl);
      return ok(product);
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;
