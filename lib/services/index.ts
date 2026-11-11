import {
  adminUserRepo,
  categoryRepo,
  deliveryReceiptRepo,
  loginAttemptRepo,
  productRepo,
  publishRepo,
  quotationRepo,
  settingsRepo,
} from "@/lib/repositories";
import { createAuthService } from "./authService";
import { createCatalogService } from "./catalogService";
import { createCategoryService } from "./categoryService";
import { createDeliveryReceiptService } from "./deliveryReceiptService";
import { vercelBlobImageStore } from "./imageStore";
import { argon2Passwords } from "./passwords";
import { createProductImportService } from "./productImportService";
import { createProductService } from "./productService";
import { createPublishService } from "./publishService";
import { createQuotationService } from "./quotationService";
import { createSettingsService } from "./settingsService";

// The services wired to the real database and Blob store. Routes and actions import these.

/** The storefront's reads: the published snapshot only. */
export const catalogService = createCatalogService({ published: publishRepo });

export const publishService = createPublishService({
  publish: publishRepo,
  products: productRepo,
  settings: settingsRepo,
  imageStore: vercelBlobImageStore,
});

export const productService = createProductService({
  products: productRepo,
  categories: categoryRepo,
  imageStore: vercelBlobImageStore,
});

/** The Excel import (ticket 41). It adds to the live tables, which are the draft. */
export const productImportService = createProductImportService({
  products: productRepo,
  categories: categoryRepo,
});

export const categoryService = createCategoryService({
  categories: categoryRepo,
});

export const settingsService = createSettingsService({
  settings: settingsRepo,
  imageStore: vercelBlobImageStore,
});

/** Quotations (ticket 19). Products come from the live tables: the admin's catalog. */
export const quotationService = createQuotationService({
  quotations: quotationRepo,
  receipts: deliveryReceiptRepo,
  products: productRepo,
});

export const deliveryReceiptService = createDeliveryReceiptService({
  quotations: quotationRepo,
  receipts: deliveryReceiptRepo,
});

export const authService = createAuthService({
  admins: adminUserRepo,
  attempts: loginAttemptRepo,
  passwords: argon2Passwords,
});
