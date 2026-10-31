import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { deliveryReceiptRepo, quotationRepo } from "@/lib/repositories";
import {
  categoryService,
  productService,
  publishService,
  settingsService,
} from "@/lib/services";

// Undoes what an interrupted e2e run left on the dev branch, so the storefront specs see
// the seed again. Run by the admin specs before they start.
// - Products named "E2E …" (e2e/admin-products.spec.ts), photos included.
// - Categories named "E2E …" (e2e/admin-categories.spec.ts). They never keep products.
// - A store name ending in " E2E" (e2e/admin-settings.spec.ts), put back without it.
// - Quotations numbered "E2E-…" and their delivery receipts (e2e/admin-print.spec.ts).
//   Documents are outside draft and publish, so removing them never publishes.
// If it removed anything, it publishes, so the storefront drops it too. On the dev branch
// that also publishes any other draft; the e2e specs publish anyway.

/** What e2e/admin-settings.spec.ts appends to the store name. */
const E2E_NAME_SUFFIX = " E2E";

/** How e2e quotations and receipts are numbered (scripts/e2e-seed-documents.ts). */
const E2E_NUMBER_PREFIX = "E2E-";

/**
 * Deletes "E2E-…" quotations, receipts first. Through the repositories, not the services:
 * quotationService only deletes drafts, and the e2e quotations are completed.
 */
async function deleteE2eDocuments(): Promise<number> {
  const quotations = (
    await quotationRepo.list({ q: E2E_NUMBER_PREFIX })
  ).filter((q) => q.number.startsWith(E2E_NUMBER_PREFIX));
  for (const quotation of quotations) {
    for (const receipt of await deliveryReceiptRepo.listForQuotation(
      quotation.id,
    )) {
      await deliveryReceiptRepo.delete(receipt.id);
    }
    await quotationRepo.delete(quotation.id);
  }
  return quotations.length;
}

async function main() {
  // Sets DATABASE_URL (from .env.local) before the services first connect.
  loadDatabaseUrl();

  const { products } = await productService.listForAdmin({ q: "E2E " });
  const leftovers = products.filter((p) => p.name.startsWith("E2E "));
  for (const product of leftovers) await productService.delete(product.id);

  const categories = (await categoryService.list()).filter((c) =>
    c.name.startsWith("E2E "),
  );
  for (const category of categories) await categoryService.delete(category.id);

  const settings = await settingsService.get();
  let renamed = false;
  if (settings.name.endsWith(E2E_NAME_SUFFIX)) {
    const { updatedAt: _, ...values } = settings;
    await settingsService.update({
      ...values,
      name: settings.name.slice(0, -E2E_NAME_SUFFIX.length),
    });
    renamed = true;
  }

  const changed = leftovers.length > 0 || categories.length > 0 || renamed;
  if (changed) await publishService.publish();

  const documents = await deleteE2eDocuments();

  console.log(
    `Deleted ${leftovers.length} e2e products, ${categories.length} e2e categories and ${documents} e2e quotations${renamed ? ", and restored the store name" : ""}${changed ? ", then published" : ""}.`,
  );
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
