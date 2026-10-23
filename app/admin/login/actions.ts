"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/clientIp";
import { safeAdminPath } from "@/lib/auth/safeNext";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";
import type { SignInState } from "@/components/admin/SignInForm";
import { authService } from "@/lib/services";

/**
 * The one admin action without `requireAdmin()`: it's how a session starts. It's rate
 * limited by the auth service instead.
 */
export async function signIn(
  previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const input = {
    email: typeof email === "string" ? email : "",
    password: typeof password === "string" ? password : "",
  };

  const result = await authService.signIn(input, await clientIp());
  if (!result.ok) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
      email: input.email,
      attempt: (previous.attempt ?? 0) + 1,
    };
  }

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    await signSession(result.data),
    sessionCookieOptions,
  );
  redirect(safeAdminPath(formData.get("next")));
}
