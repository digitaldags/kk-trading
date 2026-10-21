import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import {
  isId,
  MAX_SEARCH_LENGTH,
  PRODUCT_NOT_FOUND,
  productInputSchema,
  type ProductInput,
} from "@/lib/domain/schemas";
import { isProductImageUrl } from "@/lib/domain/productImages";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import type { Product, ProductWithCategory } from "@/lib/domain/types";
import type {
  CategoryRepo,
  ProductPatch,
  ProductRepo,
} from "@/lib/repositories/types";
import type { ImageStore } from "./imageStore";

type ProductField = keyof ProductInput;

const UNKNOWN_CATEGORY = "Choose a category.";
const BAD_IMAGE = "Upload the photo again.";

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
    /** One product for the editor, or null when the id is unknown or malformed. */
    async get(id: string): Promise<Product | null> {
      return isId(id) ? deps.products.findById(id) : null;
    },

    /**
     * The admin list: every product, or those whose name or key spec contains `q`
     * (ignoring case), with the totals the page needs whatever the search.
     */
    async listForAdmin({ q }: { q?: string } = {}): Promise<{
      products: ProductWithCategory[];
      totalCount: number;
      sampleCount: number;
    }> {
      const all = await deps.products.listWithCategory();
      const needle = (q ?? "").trim().slice(0, MAX_SEARCH_LENGTH).toLowerCase();
      const products = needle
        ? all.filter((p) =>
            `${p.name} ${p.keySpec}`.toLowerCase().includes(needle),
          )
        : all;
      return {
        products,
        totalCount: all.length,
        sampleCount: all.filter((p) => p.isSample).length,
      };
    },

    /**
     * Deletes a photo the editor uploaded but never saved (the admin cancelled after a
     * failed save). Only product photos, and never one a product still shows.
     */
    async discardUnusedImage(url: string): Promise<void> {
      if (!isProductImageUrl(url)) return;
      if (await deps.products.isImageInUse(url)) return;
      await deleteImage(url);
    },

    async create(
      input: ProductInput,
    ): Promise<ServiceResult<Product, ProductField>> {
      const parsed = productInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { price, image, ...values } = parsed.data;

      if (!(await deps.categories.findById(values.categoryId))) {
        return fieldError("categoryId", UNKNOWN_CATEGORY);
      }
      if (image && !isProductImageUrl(image.url)) {
        return fieldError("image", BAD_IMAGE);
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
      if (!existing) return formError(PRODUCT_NOT_FOUND);

      const parsed = productInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { price, image, ...values } = parsed.data;

      if (!(await deps.categories.findById(values.categoryId))) {
        return fieldError("categoryId", UNKNOWN_CATEGORY);
      }
      if (image && !isProductImageUrl(image.url)) {
        return fieldError("image", BAD_IMAGE);
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
      if (!product) return formError(PRODUCT_NOT_FOUND);

      // Delete the replaced or removed photo only once the new row is saved.
      if (existing.imageUrl && existing.imageUrl !== product.imageUrl) {
        await deleteImage(existing.imageUrl);
      }
      return ok(product);
    },

    async delete(id: string): Promise<ServiceResult<Product, never>> {
      const product = isId(id) ? await deps.products.delete(id) : null;
      if (!product) return formError(PRODUCT_NOT_FOUND);
      if (product.imageUrl) await deleteImage(product.imageUrl);
      return ok(product);
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;
