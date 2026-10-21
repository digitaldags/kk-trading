import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStoreSettings } from "@/app/_data/storefront";
import { SignInForm } from "@/components/admin/SignInForm";
import { getOptionalAdmin } from "@/lib/auth/requireAdmin";
import { safeAdminPath } from "@/lib/auth/safeNext";
import { signIn } from "./actions";
import styles from "./page.module.css";

// Reads the session cookie, so it renders per request. Blocking, like the storefront:
// the form works before JavaScript loads.
export const instant = false;

export async function generateMetadata({
  searchParams,
}: PageProps<"/admin/login">): Promise<Metadata> {
  // Request data first, like the page, so `pnpm build` doesn't read the store name from
  // the database. (`connection()` here fails the dev check for uncached metadata.)
  await searchParams;
  const settings = await getStoreSettings();
  return { title: `Admin · ${settings.name}` };
}

export default async function LoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  // Request data first (the URL, then the cookie), so the build never prerenders the
  // database read below. Already signed in: go straight on.
  const { next } = await searchParams;
  const target = safeAdminPath(next);
  if (await getOptionalAdmin()) redirect(target);

  const settings = await getStoreSettings();
  return (
    <main className={styles.main}>
      <SignInForm action={signIn} storeName={settings.name} next={target} />
    </main>
  );
}
