"use server";

import type {
  ActionMessage,
  SaveQuotationInput,
  SaveQuotationResult,
} from "@/components/admin/actionTypes";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { QUOTATION_NOT_FOUND } from "@/lib/domain/schemas";
import { quotationService } from "@/lib/services";

// Every admin action starts with `await requireAdmin()` (see ../../actions-guard.test.ts).
// Quotations are outside draft and publish, so nothing here touches the cache tags. The
// editor navigates itself after these return, so the snackbar in the layout can show
// the message (a server redirect would drop it).

export async function saveQuotation(
  input: SaveQuotationInput,
): Promise<SaveQuotationResult> {
  await requireAdmin();
  const { id, ...fields } = input;
  const result = id
    ? await quotationService.updateDraft(String(id), fields)
    : await quotationService.createDraft(fields);
  if (!result.ok) {
    return {
      ok: false,
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }
  const { data } = result;
  return {
    ok: true,
    message: `Saved quotation ${data.number}.`,
    id: data.id,
    number: data.number,
    updatedAt: data.updatedAt.toISOString(),
  };
}

export async function completeQuotation(id: string): Promise<ActionMessage> {
  await requireAdmin();
  const result = await quotationService.complete(String(id));
  if (!result.ok) {
    return { ok: false, message: result.formError ?? QUOTATION_NOT_FOUND };
  }
  return { ok: true, message: `Marked ${result.data.number} as completed.` };
}

export async function declineQuotation(id: string): Promise<ActionMessage> {
  await requireAdmin();
  const result = await quotationService.decline(String(id));
  if (!result.ok) {
    return { ok: false, message: result.formError ?? QUOTATION_NOT_FOUND };
  }
  return { ok: true, message: `Marked ${result.data.number} as declined.` };
}

export async function deleteQuotation(id: string): Promise<ActionMessage> {
  await requireAdmin();
  const existing = await quotationService.get(String(id));
  const result = await quotationService.deleteDraft(String(id));
  if (!result.ok) {
    return { ok: false, message: result.formError ?? QUOTATION_NOT_FOUND };
  }
  return { ok: true, message: `Deleted quotation ${existing?.number ?? ""}.` };
}
