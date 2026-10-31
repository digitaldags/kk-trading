import { describeError, loadDatabaseUrl } from "@/lib/db/env";
import { grandTotal } from "@/lib/domain/documents";
import { formatPesoExact } from "@/lib/format";
import {
  deliveryReceiptService,
  productService,
  quotationService,
} from "@/lib/services";

// The documents e2e/admin-print.spec.ts prints, made through the services: a completed
// quotation with a delivery receipt for part of it, and a draft. Numbered "E2E-…", so
// scripts/e2e-cleanup.ts removes them. Prints what the spec checks as JSON.

async function main() {
  loadDatabaseUrl();
  const run = Date.now();

  const { products } = await productService.listForAdmin();
  const coded = products.filter((p) => p.code);
  if (coded.length < 2) {
    throw new Error("Needs two products with codes. Run `pnpm db:seed`.");
  }
  const [first, second] = coded as [(typeof coded)[0], (typeof coded)[0]];

  const items = [
    { productId: first.id, quantity: 2, unitPrice: "8,450" },
    { productId: second.id, quantity: 5, unitPrice: "6,155" },
  ];
  const header = {
    quoteDate: "2026-10-27",
    customerName: "E2E Customer",
    customerAddress: "Makati City",
    customerTin: "010-865-925-000",
    deliveryAddress: "Lapu-Lapu City, Cebu",
    items,
  };

  const completed = await quotationService.createDraft({
    ...header,
    number: `E2E-${run}-1`,
  });
  if (!completed.ok) throw new Error(JSON.stringify(completed));
  const decided = await quotationService.complete(completed.data.id);
  if (!decided.ok) throw new Error(JSON.stringify(decided));

  const firstLine = completed.data.items[0]!;
  const receipt = await deliveryReceiptService.create(completed.data.id, {
    number: `E2E-${run}-DR`,
    receiptDate: "2026-10-29",
    deliveryAddress: header.deliveryAddress,
    lines: [{ quotationItemId: firstLine.id, quantity: 1 }],
  });
  if (!receipt.ok) throw new Error(JSON.stringify(receipt));

  const draft = await quotationService.createDraft({
    ...header,
    number: `E2E-${run}-2`,
  });
  if (!draft.ok) throw new Error(JSON.stringify(draft));

  console.log(
    JSON.stringify({
      completed: { id: completed.data.id, number: completed.data.number },
      draft: { id: draft.data.id, number: draft.data.number },
      receipt: {
        id: receipt.data.id,
        number: receipt.data.number,
        code: firstLine.code,
      },
      grandTotal: formatPesoExact(grandTotal(completed.data.items)),
    }),
  );
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
