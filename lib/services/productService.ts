import {
  fieldError,
  formError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import { ProductCodeTakenError } from "@/lib/domain/errors";
import {
  isId,
  MAX_SEARCH_LENGTH,
  PRODUCT_CODE_TAKEN,
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
  // A photo the published store still shows (or another product uses) stays until a
  // publish no longer needs it; publishService deletes it then.
  async function deleteImage(url: string) {
    if (await deps.products.isImageInUse(url)) return;
    try {
      await deps.imageStore.delete(url);
    } catch (error) {
      logError(`Couldn't delete product image ${url}`, error);
    }
  }

  /**
   * Whether a product other than `exceptId` already has this code, ignoring case. The
   * code is optional, so any number of products can have none.
   */
  async function codeTaken(code: string, exceptId?: string) {
    if (!code) return false;
    const other = await deps.products.findByCode(code);
    return other !== null && other.id !== exceptId;
  }

  /**
   * Runs a write, turning a lost race for the code (the unique index) into the same
   * field error as the check before it.
   */
  async function guardCode<T>(
    write: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    try {
      return { ok: true, value: await write() };
    } catch (error) {
      if (error instanceof ProductCodeTakenError) return { ok: false };
      throw error;
    }
  }

  return {
    /** One product for the editor, or null when the id is unknown or malformed. */
    async get(id: string): Promise<Product | null> {
      return isId(id) ? deps.products.findById(id) : null;
    },

    /**
     * The admin list: every product, or those whose name, code or key spec contains `q`
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
            [p.name, p.code, p.keySpec].some((t) =>
              t.toLowerCase().includes(needle),
            ),
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
      if (await codeTaken(values.code)) {
        return fieldError("code", PRODUCT_CODE_TAKEN);
      }

      const base = slugify(values.name, "product");
      const slug = uniqueSlug(
        base,
        await deps.products.slugsStartingWith(base),
      );
      const sortOrder = (await deps.products.maxSortOrder()) + 1;
      const inserted = await guardCode(() =>
        deps.products.insert({
          ...values,
          slug,
          priceCentavos: price,
          imageUrl: image?.url ?? null,
          imagePathname: image?.pathname ?? null,
          isSample: false,
          sortOrder,
        }),
      );
      if (!inserted.ok) return fieldError("code", PRODUCT_CODE_TAKEN);
      return ok(inserted.value);
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
      if (await codeTaken(values.code, id)) {
        return fieldError("code", PRODUCT_CODE_TAKEN);
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

      const updated = await guardCode(() => deps.products.update(id, patch));
      if (!updated.ok) return fieldError("code", PRODUCT_CODE_TAKEN);
      const product = updated.value;
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
