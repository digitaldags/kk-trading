import type { Metadata } from "next";
import { DocumentsAdmin } from "@/components/admin/DocumentsAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { QUOTATION_STATUSES } from "@/lib/domain/documents";
import { MAX_SEARCH_LENGTH } from "@/lib/domain/schemas";
import { quotationService } from "@/lib/services";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = { title: "Documents · Admin" };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The quotations list (Figma 74:879), filtered by `?q=` and `?status=`. Malformed
 * values are ignored. Quotations are outside draft and publish, so nothing here changes
 * the Publish bar.
 */
export default async function DocumentsPage({
  searchParams,
}: PageProps<"/admin/documents">) {
  const params = await searchParams;
  await requireAdmin();

  const q = (first(params.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const status =
    QUOTATION_STATUSES.find((s) => s === first(params.status)) ?? null;
  const filtered = Boolean(q || status);

  // The total tells "No quotations yet." apart from "no matches".
  const [quotations, all] = await Promise.all([
    quotationService.list({ q, status: status ?? undefined }),
    filtered ? quotationService.list() : null,
  ]);

  return (
    <DocumentsAdmin
      quotations={quotations}
      totalCount={(all ?? quotations).length}
      q={q}
      status={status}
    />
  );
}
