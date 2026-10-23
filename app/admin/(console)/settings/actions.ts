"use server";

import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import type {
  PasswordField,
  SaveResult,
  StoreDetailsField,
} from "@/components/admin/actionTypes";
import { clientIp } from "@/lib/auth/clientIp";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";
import { SETTINGS_TAG } from "@/lib/cacheTags";
import type {
  PasswordChangeInput,
  StoreSettingsInput,
} from "@/lib/domain/schemas";
import { authService, settingsService } from "@/lib/services";

// Every admin action starts with `await requireAdmin()` (see ../../actions-guard.test.ts).

/** The store name, hero copy and contact details. `updateTag` makes `/` show them next load. */
export async function saveStoreDetails(
  input: StoreSettingsInput,
): Promise<SaveResult<StoreDetailsField>> {
  await requireAdmin();
  const result = await settingsService.update(input);
  if (!result.ok) {
    return {
      ok: false,
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: true, message: "Store details saved." };
}

/**
 * Changes the signed-in admin's password. That signs out every other session, so this
 * browser gets a new session cookie for the new password.
 */
export async function changePassword(
  input: PasswordChangeInput,
): Promise<SaveResult<PasswordField>> {
  const admin = await requireAdmin();
  const result = await authService.changePassword(
    admin.id,
    input,
    await clientIp(),
  );
  if (!result.ok) {
    return {
      ok: false,
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    await signSession(result.data),
    sessionCookieOptions,
  );
  return {
    ok: true,
    message: "Password updated. Other devices are signed out.",
  };
}
