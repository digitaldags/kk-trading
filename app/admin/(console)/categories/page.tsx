import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/admin/SectionPlaceholder";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const instant = false;

export const metadata: Metadata = { title: "Categories · Admin" };

/** Placeholder until ticket 11 builds categories management. */
export default async function CategoriesPage() {
  await requireAdmin();
  return (
    <SectionPlaceholder title="Categories">
      Adding, renaming and removing categories isn&apos;t available yet.
    </SectionPlaceholder>
  );
}
