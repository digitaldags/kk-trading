import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuotationEditor } from "@/components/admin/QuotationEditor";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  categoryService,
  productService,
  quotationService,
} from "@/lib/services";
import {
  completeQuotation,
  declineQuotation,
  deleteQuotation,
  saveQuotation,
} from "../actions";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

// Not the number: metadata would read the quotation before the session is checked.
export const metadata: Metadata = { title: "Quotation · Admin" };

/**
 * One quotation. A draft opens the editor; completed and declined ones open it
 * read-only until ticket 22 gives them their own view. An unknown id is a 404.
 */
export default async function QuotationPage({
  params,
}: PageProps<"/admin/documents/[id]">) {
  const { id } = await params;
  await requireAdmin();

  const [quotation, { products }, categories] = await Promise.all([
    quotationService.get(id),
    productService.listForAdmin(),
    categoryService.list(),
  ]);
  if (!quotation) notFound();

  return (
    <QuotationEditor
      // Remounts with fresh data once the status changes (completed or declined).
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
  );
}
