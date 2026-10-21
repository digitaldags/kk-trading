import {
  adminUserRepo,
  categoryRepo,
  loginAttemptRepo,
  productRepo,
  settingsRepo,
} from "@/lib/repositories";
import { createAuthService } from "./authService";
import { createCatalogService } from "./catalogService";
import { createCategoryService } from "./categoryService";
import { vercelBlobImageStore } from "./imageStore";
import { argon2Passwords } from "./passwords";
import { createProductService } from "./productService";
import { createSettingsService } from "./settingsService";

// The services wired to the real database and Blob store. Routes and actions import these.

export const catalogService = createCatalogService({
  products: productRepo,
  categories: categoryRepo,
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
