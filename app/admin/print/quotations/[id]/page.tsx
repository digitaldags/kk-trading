import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { quotationUrl } from "@/components/admin/adminUrl";
import { PrintPage } from "@/components/print/PrintPage";
import { QuotationPrint } from "@/components/print/QuotationPrint";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  productService,
  quotationService,
  settingsService,
} from "@/lib/services";
import { categoryIcons } from "../../categoryIcons";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = {
  title: "Print quotation · Admin",
  robots: { index: false, follow: false },
};

/**
 * A quotation's print preview (Figma 78:1190). Any status prints; a draft carries the
 * DRAFT tag. The letterhead is the store details admin last saved, not the published copy.
 */
export default async function PrintQuotationPage({
  params,
}: PageProps<"/admin/print/quotations/[id]">) {
  const { id } = await params;
  await requireAdmin();

  const [quotation, settings, { products }] = await Promise.all([
    quotationService.get(id),
    settingsService.get(),
    productService.listForAdmin(),
  ]);
  if (!quotation) notFound();

  return (
    <PrintPage backHref={quotationUrl(quotation.id)}>
      <QuotationPrint
        quotation={quotation}
        settings={settings}
        icons={categoryIcons(products)}
      />
    </PrintPage>
  );
}
