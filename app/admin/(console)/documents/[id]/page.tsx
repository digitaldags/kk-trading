import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FreshOnNavigation } from "@/components/admin/FreshOnNavigation";
import { QuotationEditor } from "@/components/admin/QuotationEditor";
import { QuotationView } from "@/components/admin/QuotationView";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  categoryService,
  deliveryReceiptService,
  productService,
  quotationService,
} from "@/lib/services";
import {
  completeQuotation,
  createDeliveryReceipt,
  declineQuotation,
  deleteDeliveryReceipt,
  deleteQuotation,
  saveQuotation,
} from "../actions";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

// Not the number: metadata would read the quotation before the session is checked.
export const metadata: Metadata = { title: "Quotation · Admin" };

/**
 * One quotation. A draft opens the editor; a completed or declined one opens the
 * read-only view, with its delivery receipts once completed. An unknown id is a 404.
 */
export default async function QuotationPage({
  params,
}: PageProps<"/admin/documents/[id]">) {
  const { id } = await params;
  await requireAdmin();

  const quotation = await quotationService.get(id);
  if (!quotation) notFound();

  if (quotation.status === "draft") {
    const [{ products }, categories] = await Promise.all([
      productService.listForAdmin(),
      categoryService.list(),
    ]);
    // FreshOnNavigation: opening it again from a link shows what's saved, not edits
    // left in the hidden instance from an earlier visit (BUG-01).
    return (
      <FreshOnNavigation>
        <QuotationEditor
          // Remounts as the view once the status changes (completed or declined).
          key={`${quotation.id}-${quotation.status}`}
          quotation={quotation}
          defaults={quotationService.newDraftDefaults()}
          catalog={products}
          categories={categories}
          saveAction={saveQuotation}
          completeAction={completeQuotation}
          declineAction={declineQuotation}
          deleteAction={deleteQuotation}
        />
      </FreshOnNavigation>
    );
  }

  const [defaults, receipts] =
    quotation.status === "completed"
      ? await Promise.all([
          deliveryReceiptService.newReceiptDefaults(quotation.id),
          deliveryReceiptService.listForQuotation(quotation.id),
        ])
      : [null, []];

  return (
    <FreshOnNavigation>
      <QuotationView
        key={`${quotation.id}-${quotation.status}`}
        quotation={quotation}
        receiptDefaults={defaults?.ok ? defaults.data : null}
        receipts={receipts}
        createReceiptAction={createDeliveryReceipt}
        deleteReceiptAction={deleteDeliveryReceipt}
      />
    </FreshOnNavigation>
  );
}
