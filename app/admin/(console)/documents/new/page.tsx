import type { Metadata } from "next";
import { FreshOnNavigation } from "@/components/admin/FreshOnNavigation";
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

export const metadata: Metadata = { title: "New quotation · Admin" };

/** An empty quotation editor (Figma 75:915). Nothing is written until the first Save. */
export default async function NewQuotationPage() {
  await requireAdmin();
  const [{ products }, categories] = await Promise.all([
    productService.listForAdmin(),
    categoryService.list(),
  ]);

  // A fresh editor on every visit, not the one hidden since the last save (BUG-01).
  return (
    <FreshOnNavigation>
      <QuotationEditor
        quotation={null}
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
