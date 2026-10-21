import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/admin/SectionPlaceholder";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const instant = false;

export const metadata: Metadata = { title: "Store details · Admin" };

/** Placeholder until ticket 12 builds store details and the password change. */
export default async function SettingsPage() {
  await requireAdmin();
  return (
    <SectionPlaceholder title="Store details">
      Editing the store details and the admin password isn&apos;t available yet.
    </SectionPlaceholder>
  );
}
