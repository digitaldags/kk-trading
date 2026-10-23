import type { Metadata } from "next";
import { SettingsAdmin } from "@/components/admin/SettingsAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { settingsService } from "@/lib/services";
import { changePassword, saveStoreDetails } from "./actions";

// Reads the session cookie, so it renders per request and blocks until it's checked.
export const instant = false;

export const metadata: Metadata = { title: "Store details · Admin" };

/**
 * Store details and the admin password (Figma 12:1149). Reads the database directly,
 * never the storefront's cache, so it always shows the latest save.
 */
export default async function SettingsPage() {
  await requireAdmin();
  const settings = await settingsService.get();
  return (
    <SettingsAdmin
      settings={settings}
      saveDetailsAction={saveStoreDetails}
      changePasswordAction={changePassword}
    />
  );
}
