"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/shared/cx";
import type { FieldErrors } from "@/lib/domain/result";
import styles from "./SignInForm.module.css";

/** What the sign-in action returns after a failed attempt. */
export type SignInState = {
  fieldErrors: FieldErrors<"email" | "password">;
  formError?: string;
  /** Typed back into the form after a failed attempt. Never the password. */
  email?: string;
  /** Changes on every attempt, so the same error is announced again. */
  attempt?: number;
};

type SignInFormProps = {
  /** The sign-in server action. Passed in, so the form renders the same in tests. */
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  storeName: string;
  /** Where to go after signing in, already checked by `safeAdminPath`. */
  next: string;
};

const INITIAL: SignInState = { fieldErrors: {} };

/**
 * The admin sign-in card (Figma 12:285). A plain form posting to a server action, so it
 * works before JavaScript loads. Copy follows the prototype's `loginHTML()`.
 */
export function SignInForm({ action, storeName, next }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className={styles.card} noValidate>
      <input type="hidden" name="next" value={next} />
      <span className={styles.mark}>
        <Icon name="lock" size={28} />
      </span>
      <h1 className="t-headline-medium">Store admin</h1>
      <p className={cx(styles.lead, "t-body-medium")}>
        Sign in to manage products and categories for {storeName}.
      </p>
      <TextField
        label="Email"
        name="email"
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.email}
        // React resets a form after its action runs; remount to keep the typed email.
        key={`email-${state.attempt ?? 0}`}
        error={state.fieldErrors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors.password}
      />
      {state.formError && (
        <p
          key={state.attempt}
          role="alert"
          className={cx(styles.formError, "t-body-small")}
        >
          {state.formError}
        </p>
      )}
      <Button type="submit" disabled={pending} className={styles.wide}>
        Sign in
      </Button>
      <Button variant="text" icon="arrow_back" href="/" className={styles.wide}>
        Back to store
      </Button>
    </form>
  );
}
