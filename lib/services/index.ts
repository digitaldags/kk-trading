import {
  adminUserRepo,
  categoryRepo,
  loginAttemptRepo,
  productRepo,
  publishRepo,
  settingsRepo,
} from "@/lib/repositories";
import { createAuthService } from "./authService";
import { createCatalogService } from "./catalogService";
import { createCategoryService } from "./categoryService";
import { vercelBlobImageStore } from "./imageStore";
import { argon2Passwords } from "./passwords";
import { createProductService } from "./productService";
import { createPublishService } from "./publishService";
import { createSettingsService } from "./settingsService";

// The services wired to the real database and Blob store. Routes and actions import these.

/** The storefront's reads: the published snapshot only. */
export const catalogService = createCatalogService({ published: publishRepo });

export const publishService = createPublishService({
  publish: publishRepo,
  products: productRepo,
  imageStore: vercelBlobImageStore,
});

export const productService = createProductService({
  products: productRepo,
  categories: categoryRepo,
  imageStore: vercelBlobImageStore,
});

export const categoryService = createCategoryService({
  categories: categoryRepo,
});

export const settingsService = createSettingsService({
  settings: settingsRepo,
});

export const authService = createAuthService({
  admins: adminUserRepo,
  attempts: loginAttemptRepo,
  passwords: argon2Passwords,
});
