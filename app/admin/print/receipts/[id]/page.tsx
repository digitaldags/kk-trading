import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { quotationUrl } from "@/components/admin/adminUrl";
import { PrintPage } from "@/components/print/PrintPage";
import { ReceiptPrint } from "@/components/print/ReceiptPrint";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  deliveryReceiptService,
  productService,
  settingsService,
} from "@/lib/services";
import { categoryIcons } from "../../categoryIcons";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = {
  title: "Print delivery receipt · Admin",
  robots: { index: false, follow: false },
};

/**
 * A delivery receipt's print preview (Figma 78:1307): its own lines and quantities, the
 * customer from its quotation, and the letterhead admin last saved.
 */
export default async function PrintReceiptPage({
  params,
}: PageProps<"/admin/print/receipts/[id]">) {
  const { id } = await params;
  await requireAdmin();

  const [found, settings, { products }] = await Promise.all([
    deliveryReceiptService.get(id),
    settingsService.get(),
    productService.listForAdmin(),
  ]);
  if (!found) notFound();
  const { receipt, quotation } = found;

  return (
    <PrintPage backHref={quotationUrl(quotation.id)}>
      <ReceiptPrint
        receipt={receipt}
        quotation={quotation}
        settings={settings}
        icons={categoryIcons(products)}
      />
    </PrintPage>
  );
}
