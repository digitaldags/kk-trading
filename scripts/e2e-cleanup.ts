import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import {
  categoryService,
  productService,
  settingsService,
} from "@/lib/services";

// Undoes what an interrupted e2e run left on the dev branch, so the storefront specs see
// the seed again. Run by the admin specs before they start.
// - Products named "E2E …" (e2e/admin-products.spec.ts), photos included.
// - Categories named "E2E …" (e2e/admin-categories.spec.ts). They never keep products.
// - A store name ending in " E2E" (e2e/admin-settings.spec.ts), put back without it.

/** What e2e/admin-settings.spec.ts appends to the store name. */
const E2E_NAME_SUFFIX = " E2E";

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

  console.log(
    `Deleted ${leftovers.length} e2e products and ${categories.length} e2e categories${renamed ? ", and restored the store name" : ""}.`,
  );
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
