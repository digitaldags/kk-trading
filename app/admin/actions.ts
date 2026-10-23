"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Every admin action starts with `await requireAdmin()` (see actions-guard.test.ts).

export async function signOut() {
  await requireAdmin();
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, path: "/" });
  redirect("/");
}
