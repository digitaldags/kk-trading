import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { productService } from "@/lib/services";

// Deletes products that e2e/admin-products.spec.ts made ("E2E product …", "E2E delete …")
// and an earlier, interrupted run left behind, photos included. Run by that spec before
// it starts, so the storefront counts stay those of the seed.
async function main() {
  // Sets DATABASE_URL (from .env.local) before the services first connect.
  loadDatabaseUrl();
  const { products } = await productService.listForAdmin({ q: "E2E " });
  const leftovers = products.filter((p) => p.name.startsWith("E2E "));
  for (const product of leftovers) await productService.delete(product.id);
  console.log(`Deleted ${leftovers.length} e2e products.`);
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
